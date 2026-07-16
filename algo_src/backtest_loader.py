import os
import time
import pandas as pd
import yfinance as yf
import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="pandas")
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
    clean_tickers = [t.replace(".AX", "") for t in all_tickers]
    
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
        print(f"  [yfinance] Downloading missing daily history for {len(missing_tickers_info)} tickers...")
        download_rows = []
        
        # Pop proxy keys to ensure clean direct connection in sandbox
        for key in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY"]:
            if key in os.environ:
                os.environ.pop(key)
                
        for i, (t, period) in enumerate(missing_tickers_info.items()):
            if i > 0 and i % 15 == 0:
                time.sleep(2)
                
            yf_sym = t if t.startswith("^") else f"{t}.AX"
            try:
                ticker_df = yf.Ticker(yf_sym).history(period=period)
                if not ticker_df.empty:
                    for idx, row in ticker_df.iterrows():
                        download_rows.append({
                            "date": idx.tz_localize(None).normalize(),
                            "symbol": t,
                            "open": round(float(row.get("Open", 0)), 2),
                            "high": round(float(row.get("High", 0)), 2),
                            "low": round(float(row.get("Low", 0)), 2),
                            "close": round(float(row.get("Close", 0)), 2),
                            "volume": int(row.get("Volume", 0))
                        })
            except Exception as e:
                print(f"  ⚠️ Error downloading {yf_sym}: {e}")
                
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

