import os
import time
import pandas as pd
import akshare as ak
import yfinance as yf
import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="pandas")

def to_yahoo_ticker(symbol):
    # Sector indices are not reliably carried by Yahoo Finance; map them to CSI 300 (000300.SS) as proxy
    if symbol in ["sh000300", "000300"]:
        return "000300.SS"
    if symbol in ["sh000001", "000001"]:
        return "000001.SS"
    if symbol.startswith("sh000") or symbol.startswith("sz399"):
        return "000300.SS"
        
    if symbol.startswith("sh") and len(symbol) == 8:
        return f"{symbol[2:]}.SS"
    elif symbol.startswith("sz") and len(symbol) == 8:
        return f"{symbol[2:]}.SZ"
    # Stock codes
    if symbol.startswith("6") or symbol.startswith("9"):
        return f"{symbol}.SS"
    elif symbol.startswith("0") or symbol.startswith("3"):
        return f"{symbol}.SZ"
    return symbol
from psycopg2.extras import execute_values

def get_price_history_for_backtest(conn, symbols, benchmarks, start_date_str, end_date_str):
    """Fetches stock/benchmark daily prices from daily_prices database table, downloading missing ones."""
    price_df = pd.DataFrame()
    if conn:
        try:
            query = "SELECT date, symbol, open, high, low, close, volume FROM daily_prices;"
            price_df = pd.read_sql(query, conn)
            print(f"  [DB] Loaded {len(price_df)} price records from database.")
        except Exception as e:
            print(f"  ⚠️ Failed to read daily_prices table: {e}")
            
    # Check if we have data for all needed tickers, and if that data is up to date
    all_tickers = list(symbols) + list(benchmarks)
    clean_tickers = [t for t in all_tickers] # No .AX suffix in A-shares
    
    target_end_date = pd.to_datetime(end_date_str)
    missing_tickers_info = {}
    
    if not price_df.empty:
        price_df['date'] = pd.to_datetime(price_df['date'])
        for t in clean_tickers:
            ticker_df = price_df[price_df['symbol'] == t]
            if ticker_df.empty:
                missing_tickers_info[t] = "2y"
            else:
                max_date = ticker_df['date'].max()
                # If database is missing recent days (using 3-day buffer to ignore weekend gaps)
                if max_date < target_end_date - pd.Timedelta(days=3):
                    missing_tickers_info[t] = "1mo"
    else:
        for t in clean_tickers:
            missing_tickers_info[t] = "2y"
        
    if missing_tickers_info:
        print(f"  [akshare] Downloading missing daily history for {len(missing_tickers_info)} tickers...")
        download_rows = []
        
        # Pop proxy keys to ensure clean direct connection in sandbox
        for key in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY"]:
            if key in os.environ:
                os.environ.pop(key)
                
        today = pd.Timestamp.now()
        for i, (t, period) in enumerate(missing_tickers_info.items()):
            # Date calculations
            if period == "2y":
                start_dt = today - pd.Timedelta(days=730)
            else:
                start_dt = today - pd.Timedelta(days=30)
            
            yf_ticker = to_yahoo_ticker(t)
            try:
                print(f"  [yfinance] Downloading {t} as {yf_ticker} ({period})...")
                df = yf.download(yf_ticker, start=start_dt.strftime("%Y-%m-%d"), end=today.strftime("%Y-%m-%d"), progress=False)
                if not df.empty:
                    if isinstance(df.columns, pd.MultiIndex):
                        df.columns = df.columns.get_level_values(0)
                    df = df.reset_index()
                    df = df.rename(columns={
                        "Date": "date",
                        "Open": "open",
                        "High": "high",
                        "Low": "low",
                        "Close": "close",
                        "Volume": "volume"
                    })
                    df['date'] = pd.to_datetime(df['date'])
                    for idx, row in df.iterrows():
                        download_rows.append({
                            "date": row["date"].normalize(),
                            "symbol": t,
                            "open": round(float(row.get("open", 0)), 2) if not pd.isna(row.get("open")) else 0.0,
                            "high": round(float(row.get("high", 0)), 2) if not pd.isna(row.get("high")) else 0.0,
                            "low": round(float(row.get("low", 0)), 2) if not pd.isna(row.get("low")) else 0.0,
                            "close": round(float(row.get("close", 0)), 2) if not pd.isna(row.get("close")) else 0.0,
                            "volume": int(row.get("volume", 0)) if not pd.isna(row.get("volume")) else 0
                        })
            except Exception as e:
                print(f"  ⚠️ Error downloading {t} from yfinance: {e}")
                
        if download_rows:
            new_price_df = pd.DataFrame(download_rows)
            if conn:
                print(f"  [DB] Synchronizing {len(new_price_df)} new price records into daily_prices...")
                try:
                    cur = conn.cursor()
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS daily_prices (
                            date DATE NOT NULL,
                            symbol VARCHAR(10) NOT NULL,
                            open NUMERIC(10,2),
                            high NUMERIC(10,2),
                            low NUMERIC(10,2),
                            close NUMERIC(10,2) NOT NULL,
                            volume BIGINT,
                            PRIMARY KEY (date, symbol)
                        );
                    """)
                    cur.execute("CREATE INDEX IF NOT EXISTS idx_daily_prices_query ON daily_prices(symbol, date);")
                    
                    insert_query = """
                        INSERT INTO daily_prices (date, symbol, open, high, low, close, volume)
                        VALUES %s
                        ON CONFLICT (date, symbol) DO UPDATE SET
                            open = EXCLUDED.open,
                            high = EXCLUDED.high,
                            low = EXCLUDED.low,
                            close = EXCLUDED.close,
                            volume = EXCLUDED.volume;
                    """
                    values = [(
                        r['date'].strftime("%Y-%m-%d"),
                        r['symbol'],
                        r['open'],
                        r['high'],
                        r['low'],
                        r['close'],
                        r['volume']
                    ) for r in download_rows]
                    execute_values(cur, insert_query, values)
                    conn.commit()
                except Exception as db_err:
                    print(f"  ⚠️ Database price write error: {db_err}")
                    conn.rollback()
                    
            if not price_df.empty:
                price_df = pd.concat([price_df, new_price_df], ignore_index=True)
            else:
                price_df = new_price_df
                
    # Ensure required columns are present
    required_cols = ['date', 'symbol', 'open', 'high', 'low', 'close', 'volume']
    for col in required_cols:
        if col not in price_df.columns:
            price_df[col] = pd.Series(dtype='object')
            
    return price_df[required_cols]
