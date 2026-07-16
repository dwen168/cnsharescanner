import os
import json
import psycopg2
from psycopg2.extras import Json, execute_values

# SQL statements to initialize required database tables
DDL_STATEMENTS = [
    # Safe PL/SQL block to alter column types if tables already exist
    """
    DO $$ 
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'algo_config_versions') THEN
            ALTER TABLE algo_config_versions ALTER COLUMN version_code TYPE VARCHAR(50);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_snapshots') THEN
            ALTER TABLE market_snapshots ALTER COLUMN algo_version TYPE VARCHAR(50);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sector_signals') THEN
            ALTER TABLE sector_signals ALTER COLUMN algo_version TYPE VARCHAR(50);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_signals') THEN
            ALTER TABLE stock_signals ALTER COLUMN algo_version TYPE VARCHAR(50);
        END IF;
    END $$;
    """,
    """
    CREATE TABLE IF NOT EXISTS algo_config_versions (
        version_code VARCHAR(50) PRIMARY KEY,
        git_commit_sha VARCHAR(40),
        momentum_threshold_count INT DEFAULT 3,
        vol_spike_threshold NUMERIC(4,2),
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS market_snapshots (
        id SERIAL PRIMARY KEY,
        generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
        algo_version VARCHAR(50) REFERENCES algo_config_versions(version_code),
        trading_state VARCHAR(30) NOT NULL,
        payload JSONB NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS sector_signals (
        id BIGSERIAL PRIMARY KEY,
        date DATE NOT NULL,
        sector_name VARCHAR(50) NOT NULL,
        algo_version VARCHAR(50) REFERENCES algo_config_versions(version_code),
        up_count INT NOT NULL,
        down_count INT NOT NULL,
        avg_chg NUMERIC(6,2) NOT NULL,
        avg_vol_ratio NUMERIC(6,2) NOT NULL,
        avg_rs_5d NUMERIC(6,3) NOT NULL,
        avg_sentiment NUMERIC(4,2) NOT NULL,
        heat_score INT NOT NULL,
        signal VARCHAR(30) NOT NULL,
        zone VARCHAR(20) NOT NULL,
        matched_risks_count INT DEFAULT 0,
        matched_opportunities_count INT DEFAULT 0
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS stock_signals (
        id BIGSERIAL PRIMARY KEY,
        date DATE NOT NULL,
        symbol VARCHAR(10) NOT NULL,
        algo_version VARCHAR(50) REFERENCES algo_config_versions(version_code),
        price NUMERIC(10,2) NOT NULL,
        chg_pct NUMERIC(6,2) NOT NULL,
        chg_5d NUMERIC(6,2),
        vol_ratio NUMERIC(6,2),
        rsi NUMERIC(5,2),
        rs_ratio_5d NUMERIC(6,3),
        news_sentiment NUMERIC(4,2),
        heat_score INT,
        signal VARCHAR(30) NOT NULL,
        zone VARCHAR(20) NOT NULL,
        next_open NUMERIC(10,2)
    );
    """,
    """
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
    """,
    # Safe alter statement to append next_open to stock_signals if missing
    "ALTER TABLE stock_signals ADD COLUMN IF NOT EXISTS next_open NUMERIC(10,2);",
    "ALTER TABLE stock_signals ADD COLUMN IF NOT EXISTS heat_score INT;",
    "ALTER TABLE stock_signals ADD COLUMN IF NOT EXISTS bear_signal VARCHAR(40);",
    "ALTER TABLE stock_signals ADD COLUMN IF NOT EXISTS bear_zone VARCHAR(30);",
    # Add indexes for performance optimization
    "CREATE INDEX IF NOT EXISTS idx_snapshots_generated_at ON market_snapshots(generated_at DESC);",
    "CREATE INDEX IF NOT EXISTS idx_snapshots_payload_gin ON market_snapshots USING gin (payload);",
    "CREATE UNIQUE INDEX IF NOT EXISTS uidx_sector_date_version ON sector_signals(date, sector_name, algo_version);",
    "CREATE INDEX IF NOT EXISTS idx_sector_signals_query ON sector_signals(sector_name, date);",
    "CREATE UNIQUE INDEX IF NOT EXISTS uidx_date_symbol_version ON stock_signals(date, symbol, algo_version);",
    "CREATE INDEX IF NOT EXISTS idx_stock_signals_query ON stock_signals(symbol, date);",
    "CREATE INDEX IF NOT EXISTS idx_daily_prices_query ON daily_prices(symbol, date);"
]

def to_float(val, default=0.0):
    if val is None:
        return None
    try:
        if hasattr(val, 'item') and not isinstance(val, (str, bytes)):
            return float(val.item())
        return float(val)
    except Exception:
        return default

def to_int(val, default=0):
    if val is None:
        return None
    try:
        if hasattr(val, 'item') and not isinstance(val, (str, bytes)):
            return int(val.item())
        return int(val)
    except Exception:
        return default

def init_db(cur):
    """Initializes the database schema if tables do not exist."""
    print("  Initializing database tables...")
    for statement in DDL_STATEMENTS:
        cur.execute(statement)

def write_to_db(data, algo_version="v1.2.0", run_date=None):
    """
    Writes the analyzed data (market_snapshots, sector_signals, stock_signals)
    to the PostgreSQL database.
    """
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("\n[DB] DATABASE_URL env variable not found. Skipping database write.")
        return

    print("\n[DB] DATABASE_URL found. Connecting to PostgreSQL database...")
    
    conn = None
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # 1. Initialize Tables
        init_db(cur)
        
        # 2. Register current algorithm version if not exists
        cur.execute("""
            INSERT INTO algo_config_versions (version_code, git_commit_sha, momentum_threshold_count, vol_spike_threshold, description)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (version_code) DO NOTHING;
        """, (
            algo_version,
            os.environ.get("GITHUB_SHA", "local-dev"),
            3,
            1.0,
            "ASX Trader Expert Analyzer version with loose momentum (sum >= 3) and sector modifiers."
        ))
        
        generated_at = data.get("generated_at")
        trading_state = data.get("trading_state", "active")
        
        if run_date is None:
            # Use generated_at as transaction date (without time for historical daily daily signals)
            run_date = generated_at.split("T")[0]

        
        # 3. Insert market snapshot
        print(f"  Inserting market snapshot for {generated_at}...")
        
        # Convert any potential numpy types within the metadata
        cur.execute("""
            INSERT INTO market_snapshots (generated_at, algo_version, trading_state, payload)
            VALUES (%s, %s, %s, %s)
            RETURNING id;
        """, (generated_at, algo_version, trading_state, Json(data)))
        snapshot_id = cur.fetchone()[0]
        
        # 4. Insert normalized sector signals
        print("  Inserting normalized sector signals...")
        sector_values = []
        for sector in data.get("sectors", []):
            sector_values.append((
                run_date,
                sector.get("name"),
                algo_version,
                to_int(sector.get("up_count"), 0),
                to_int(sector.get("down_count"), 0),
                to_float(sector.get("avg_chg"), 0.0),
                to_float(sector.get("avg_vol_ratio"), 0.0),
                to_float(sector.get("avg_rs_5d"), 1.0),
                to_float(sector.get("avg_sentiment"), 0.0),
                to_int(sector.get("heat_score"), 50),
                sector.get("signal", "观望"),
                sector.get("zone", "neutral"),
                to_int(len(sector.get("matched_risks", [])), 0),
                to_int(len(sector.get("matched_opportunities", [])), 0)
            ))
            
        if sector_values:
            execute_values(cur, """
                INSERT INTO sector_signals (
                    date, sector_name, algo_version, up_count, down_count,
                    avg_chg, avg_vol_ratio, avg_rs_5d, avg_sentiment, heat_score,
                    signal, zone, matched_risks_count, matched_opportunities_count
                ) VALUES %s
                ON CONFLICT (date, sector_name, algo_version) DO UPDATE SET
                    up_count = EXCLUDED.up_count,
                    down_count = EXCLUDED.down_count,
                    avg_chg = EXCLUDED.avg_chg,
                    avg_vol_ratio = EXCLUDED.avg_vol_ratio,
                    avg_rs_5d = EXCLUDED.avg_rs_5d,
                    avg_sentiment = EXCLUDED.avg_sentiment,
                    heat_score = EXCLUDED.heat_score,
                    signal = EXCLUDED.signal,
                    zone = EXCLUDED.zone,
                    matched_risks_count = EXCLUDED.matched_risks_count,
                    matched_opportunities_count = EXCLUDED.matched_opportunities_count;
            """, sector_values)
            
        # 5. Insert normalized stock signals
        print("  Inserting normalized stock signals...")
        stock_values = []
        for stock in data.get("stocks", []):
            stock_values.append((
                run_date,
                stock.get("symbol"),
                algo_version,
                to_float(stock.get("price"), 0.0),
                to_float(stock.get("chg_pct"), 0.0),
                to_float(stock.get("chg_5d"), 0.0),
                to_float(stock.get("vol_ratio"), 1.0),
                to_float(stock.get("rsi"), 50.0),
                to_float(stock.get("rs_ratio_5d"), 1.0),
                to_float(stock.get("news_sentiment"), 0.0),
                to_int(stock.get("heat_score"), 50),
                stock.get("signal", "观望"),
                stock.get("zone", "neutral"),
                stock.get("bear_signal"),
                stock.get("bear_zone", "neutral"),
            ))
            
        if stock_values:
            execute_values(cur, """
                INSERT INTO stock_signals (
                    date, symbol, algo_version, price, chg_pct, chg_5d,
                    vol_ratio, rsi, rs_ratio_5d, news_sentiment, heat_score, signal, zone,
                    bear_signal, bear_zone
                ) VALUES %s
                ON CONFLICT (date, symbol, algo_version) DO UPDATE SET
                    price = EXCLUDED.price,
                    chg_pct = EXCLUDED.chg_pct,
                    chg_5d = EXCLUDED.chg_5d,
                    vol_ratio = EXCLUDED.vol_ratio,
                    rsi = EXCLUDED.rsi,
                    rs_ratio_5d = EXCLUDED.rs_ratio_5d,
                    news_sentiment = EXCLUDED.news_sentiment,
                    heat_score = EXCLUDED.heat_score,
                    signal = EXCLUDED.signal,
                    zone = EXCLUDED.zone,
                    bear_signal = EXCLUDED.bear_signal,
                    bear_zone = EXCLUDED.bear_zone;
            """, stock_values)
            
        conn.commit()
        print(f"[DB] Successfully synchronized snapshot #{snapshot_id} and all signals to PostgreSQL!")
        
    except Exception as e:
        print(f"[DB] Error writing to PostgreSQL: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            cur.close()
            conn.close()

def write_daily_prices_to_db(stock_dfs):
    """
    Writes the daily historical prices for all symbols (including benchmark indexes)
    to the PostgreSQL database.
    """
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        return

    print("\n[DB] Writing daily price history to database...")
    conn = None
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Ensure daily_prices table is initialized
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
        
        row_count = 0
        price_values = []
        for symbol, df in stock_dfs.items():
            clean_symbol = symbol.replace(".AX", "")
            for index, row in df.iterrows():
                date_str = index.strftime("%Y-%m-%d")
                price_values.append((
                    date_str,
                    clean_symbol,
                    to_float(row.get("Open")),
                    to_float(row.get("High")),
                    to_float(row.get("Low")),
                    to_float(row.get("Close")),
                    to_int(row.get("Volume"))
                ))
                row_count += 1
                
        if price_values:
            execute_values(cur, """
                INSERT INTO daily_prices (date, symbol, open, high, low, close, volume)
                VALUES %s
                ON CONFLICT (date, symbol) DO UPDATE SET
                    open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    volume = EXCLUDED.volume;
            """, price_values)
                
        conn.commit()
        print(f"[DB] Successfully saved {row_count} historical price records to PostgreSQL!")
    except Exception as e:
        print(f"[DB] Error writing daily prices: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            cur.close()
            conn.close()

