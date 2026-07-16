import os
import json
import psycopg2
import pandas as pd
import numpy as np
import warnings
from datetime import datetime, timedelta
warnings.filterwarnings("ignore", category=UserWarning, module="pandas")

from dotenv import load_dotenv
load_dotenv()
from strategy_config import ALGO_VERSION, STRATEGY_CONFIG, SECTORS, SECTOR_META, ALL_SYMBOLS
from backtest_mock import generate_offline_backtest_data
from backtest_loader import get_price_history_for_backtest
from backtest_portfolio import run_portfolio_backtest
from stock_analyzer import analyze_stock
from sector_analyzer import calc_sector_stats

def run_replay_backtest(algo_version=None):
    """
    Runs a strict Walk-Forward Strategy Replay backtest.
    Loops through historical trading days, slicing price/indicator data to only include dates <= signal_date.
    Generates signals dynamically, then audits their future 1d, 3d, 5d, 10d performance.
    """
    if algo_version is None:
        algo_version = ALGO_VERSION
        
    cfg = STRATEGY_CONFIG["backtest_engine"]
    db_url = os.environ.get("DATABASE_URL")
    
    conn = None
    offline_mode = False
    
    if not db_url:
        print("[REPLAY BACKTEST] DATABASE_URL not set. Running in Offline Fallback Simulation Mode.")
        offline_mode = True
    else:
        print("\n[REPLAY BACKTEST] Connecting to PostgreSQL database...")
        try:
            conn = psycopg2.connect(db_url)
        except Exception as e:
            print(f"[REPLAY BACKTEST] Failed to connect to DB: {e}. Falling back to Offline Mode.")
            offline_mode = True

    try:
        # 1. Load historical price history
        clean_symbols = [s.replace(".AX", "") for s in ALL_SYMBOLS]
        unique_benchmarks = list({meta.get("benchmark", "^AORD") for meta in SECTOR_META.values()})
        if "^AORD" not in unique_benchmarks:
            unique_benchmarks.append("^AORD")
            
        end_date_dt = datetime.now()
        start_date_dt = end_date_dt - timedelta(days=730)
        
        start_date_str = start_date_dt.strftime("%Y-%m-%d")
        end_date_str = end_date_dt.strftime("%Y-%m-%d")
        
        if offline_mode:
            # Generate offline mock prices (e.g. 180 days)
            _, _, price_df = generate_offline_backtest_data(algo_version)
        else:
            price_df = get_price_history_for_backtest(conn, ALL_SYMBOLS, unique_benchmarks, start_date_str, end_date_str)
            if price_df.empty:
                print("[REPLAY BACKTEST] Price history is empty. Falling back to offline mock prices.")
                _, _, price_df = generate_offline_backtest_data(algo_version)
                offline_mode = True

        price_df['date'] = pd.to_datetime(price_df['date']).dt.tz_localize(None).dt.normalize()
        
        # Safeguard: Ensure 'high' and 'low' columns exist (important for mock data / offline mode)
        if 'high' not in price_df.columns:
            price_df['high'] = price_df[['open', 'close']].max(axis=1) * 1.01
        if 'low' not in price_df.columns:
            price_df['low'] = price_df[['open', 'close']].min(axis=1) * 0.99
        
        # 2. Extract trading days from benchmark
        benchmark_name = "^AORD"
        if benchmark_name not in price_df['symbol'].unique():
            # fallback
            benchmark_name = price_df['symbol'].unique()[0] if len(price_df['symbol'].unique()) > 0 else 'XFJ'
            
        benchmark_prices = price_df[price_df['symbol'] == benchmark_name].sort_values('date').copy()
        trading_days = sorted(benchmark_prices['date'].unique())
        
        if not trading_days:
            print("[REPLAY BACKTEST] No trading days found. Aborting.")
            write_empty_replay("No trading days found", algo_version)
            return

        print(f"[REPLAY BACKTEST] Loaded {len(price_df)} price records. Replaying {len(trading_days)} trading days...")
        
        historical_states = {}
        historical_sentiment = {}
        historical_sector_sentiment = {}

        if not offline_mode and conn:
            try:
                cur = conn.cursor()
                # Historical states: get the snapshot state for each date, prioritizing target algo_version
                cur.execute("""
                    SELECT DISTINCT ON (date(generated_at)) 
                        date(generated_at), 
                        trading_state
                    FROM market_snapshots 
                    ORDER BY 
                        date(generated_at), 
                        CASE WHEN algo_version = %s THEN 0 ELSE 1 END,
                        generated_at DESC;
                """, (algo_version,))
                for d, state in cur.fetchall():
                    historical_states[pd.to_datetime(d).normalize()] = state
                
                # Historical stock news sentiment: get the latest recorded sentiment, prioritizing target algo_version
                cur.execute("""
                    SELECT DISTINCT ON (date, symbol) 
                        date, 
                        symbol, 
                        news_sentiment 
                    FROM stock_signals 
                    WHERE news_sentiment IS NOT NULL
                    ORDER BY 
                        date, 
                        symbol, 
                        CASE WHEN algo_version = %s THEN 0 ELSE 1 END,
                        id DESC;
                """, (algo_version,))
                for d, sym, s_val in cur.fetchall():
                    historical_sentiment[(pd.to_datetime(d).normalize(), sym)] = float(s_val)
                    
                # Historical sector sentiment: get the latest recorded sector sentiment, prioritizing target algo_version
                cur.execute("""
                    SELECT DISTINCT ON (date, sector_name) 
                        date, 
                        sector_name, 
                        avg_sentiment 
                    FROM sector_signals 
                    WHERE avg_sentiment IS NOT NULL
                    ORDER BY 
                        date, 
                        sector_name, 
                        CASE WHEN algo_version = %s THEN 0 ELSE 1 END,
                        id DESC;
                """, (algo_version,))
                for d, sec_name, s_val in cur.fetchall():
                    historical_sector_sentiment[(pd.to_datetime(d).normalize(), sec_name)] = float(s_val)
                cur.close()
                print(f"  [DB] Pre-loaded {len(historical_states)} states, {len(historical_sentiment)} stock sentiments, {len(historical_sector_sentiment)} sector sentiments.")
            except Exception as db_err:
                print(f"  ⚠️ Error loading historical meta: {db_err}")
        else:
            # Offline mock meta generators
            np.random.seed(42)
            for d in trading_days:
                d_norm = pd.to_datetime(d).normalize()
                historical_states[d_norm] = "active" if np.random.uniform(0, 1) > 0.15 else "low_risk"
                for sym in clean_symbols:
                    historical_sentiment[(d_norm, sym)] = round(float(np.random.uniform(-0.3, 0.4)), 2)
                for sec in SECTORS.keys():
                    historical_sector_sentiment[(d_norm, sec)] = round(float(np.random.uniform(-0.2, 0.3)), 2)

        # 4. Prepare indexing for quick date slicing
        prices_by_symbol = {}
        for sym in price_df['symbol'].unique():
            prices_by_symbol[sym] = price_df[price_df['symbol'] == sym].sort_values('date').set_index('date')

        # 5. Walk-Forward Loop
        # Start at index 60 to allow sufficient history for rolling windows (MA60, 60-day low, etc.)
        # Stop 10 trading days before the end so that all signals have fully matured 10-day future returns
        start_index = 60
        end_index = len(trading_days) - 10
        if end_index <= start_index:
            end_index = len(trading_days)
            start_index = min(25, len(trading_days) - 1)
            
        replayed_stock_signals = []
        replayed_sector_signals = []
        
        print(f"[REPLAY BACKTEST] Starting walk-forward from index {start_index} to {end_index}...")
        
        for idx_day in range(start_index, end_index):
            signal_date = trading_days[idx_day]
            signal_date_norm = pd.to_datetime(signal_date).normalize()
            
            # Sliced index df
            index_df_sliced = pd.DataFrame()
            if benchmark_name in prices_by_symbol:
                index_df_sliced = prices_by_symbol[benchmark_name].loc[:signal_date]
                # Capitalize Close column
                index_df_sliced = index_df_sliced.rename(columns={'close': 'Close'})
                
            trading_state = historical_states.get(signal_date_norm, "active")
            
            # Run stock analyzers
            day_stock_results = []
            for sym in clean_symbols:
                if sym not in prices_by_symbol:
                    continue
                stock_full_df = prices_by_symbol[sym]
                # Slice strictly <= signal_date
                stock_df_sliced = stock_full_df.loc[:signal_date]
                if len(stock_df_sliced) < 20:
                    continue
                
                # Format to Capitalized columns for analyze_stock
                stock_df_formatted = stock_df_sliced.rename(columns={
                    'open': 'Open',
                    'high': 'High',
                    'low': 'Low',
                    'close': 'Close',
                    'volume': 'Volume'
                })
                
                sym_ax = f"{sym}.AX"
                # Fetch pre-loaded sentiment using sym
                s_val = historical_sentiment.get((signal_date_norm, sym), 0.0)
                
                # Reconstruct news_freshness decay by looking back to find when this sentiment value first started
                news_freshness = 1.0
                if s_val != 0.0:
                    age_days = 0
                    check_date = signal_date_norm - pd.Timedelta(days=1)
                    while age_days < 5:
                        prev_val = historical_sentiment.get((check_date, sym))
                        if prev_val is not None and abs(prev_val - s_val) < 0.01:
                            age_days += 1
                            check_date -= pd.Timedelta(days=1)
                        else:
                            break
                    news_freshness = max(0.0, 1.0 - age_days / 3.0)
                
                sentiment_data = {sym_ax: {
                    "sentiment_value": s_val, 
                    "sentiment_source": "news", 
                    "news_freshness": news_freshness
                }}
                
                # Fetch sector sentiment
                waneye_sector_sent = {}
                for sec_name, sec_syms in SECTORS.items():
                    if sym_ax in sec_syms:
                        waneye_sector_sent[sec_name] = historical_sector_sentiment.get((signal_date_norm, sec_name), 0.0)
                
                res = analyze_stock(
                    symbol=sym_ax,
                    df=stock_df_formatted,
                    index_df=index_df_sliced,
                    sentiment_data=sentiment_data,
                    waneye_sector_sent=waneye_sector_sent,
                    trading_state=trading_state
                )
                if res:
                    day_stock_results.append(res)
                    if res["zone"] in ["momentum", "accumulation", "watch"]:
                        # Keep a copy with date field
                        res_copy = res.copy()
                        res_copy["date"] = signal_date
                        replayed_stock_signals.append(res_copy)
            
            # Run sector analyzers
            for sector_name, sector_syms in SECTORS.items():
                waneye_sent = historical_sector_sentiment.get((signal_date_norm, sector_name), 0.0)
                waneye_sector_sent = {sector_name: waneye_sent}
                
                sec_res = calc_sector_stats(
                    sector_name=sector_name,
                    symbols=sector_syms,
                    all_results=day_stock_results,
                    macro_data=None, # Macro data can be mocked/omitted in replay calculations
                    waneye_sector_sent=waneye_sector_sent,
                    trading_state=trading_state
                )
                if sec_res:
                    sec_res["date"] = signal_date
                    replayed_sector_signals.append(sec_res)

        # 6. Align outputs & calculate future holding returns
        if not replayed_stock_signals:
            print("[REPLAY BACKTEST] No signals were replayed. Aborting.")
            write_empty_replay("No replayed signals triggered", algo_version)
            return
            
        df = pd.DataFrame(replayed_stock_signals)
        df_sector = pd.DataFrame(replayed_sector_signals)
        if not df_sector.empty and 'name' in df_sector.columns:
            df_sector = df_sector.rename(columns={'name': 'sector_name'})
        
        # Vectorized returns calculation (exact copy of audit logic)
        benchmark_aord = price_df[price_df['symbol'] == '^AORD'].copy()
        if benchmark_aord.empty:
            benchmark_aord = price_df[price_df['symbol'] == 'XFJ'].copy()
        if benchmark_aord.empty:
            dates_sorted = sorted(df['date'].unique())
            benchmark_aord = pd.DataFrame(index=pd.to_datetime(dates_sorted))
            benchmark_aord['close'] = 1.0
            benchmark_aord['open'] = 1.0
            
        benchmark_aord.index = pd.DatetimeIndex(pd.to_datetime(benchmark_aord['date'] if 'date' in benchmark_aord.columns else benchmark_aord.index)).tz_localize(None).normalize()
        if 'open' not in benchmark_aord.columns:
            benchmark_aord['open'] = benchmark_aord['close']
        benchmark_aord = benchmark_aord[['close', 'open']].rename(columns={'close': 'benchmark_price', 'open': 'benchmark_open'}).sort_index()
        benchmark_aord = benchmark_aord[~benchmark_aord.index.duplicated(keep='first')]

        price_close_df = price_df[['date', 'symbol', 'close']].copy().drop_duplicates(subset=['date', 'symbol'])
        price_open_df = price_df[['date', 'symbol', 'open']].copy().drop_duplicates(subset=['date', 'symbol'])
        
        close_pivot = price_close_df.pivot(index='date', columns='symbol', values='close')
        open_pivot = price_open_df.pivot(index='date', columns='symbol', values='open')
        
        full_dates = benchmark_aord.index.union(close_pivot.index).sort_values()
        benchmark_aord = benchmark_aord.reindex(full_dates).ffill()
        close_pivot = close_pivot.reindex(full_dates).ffill()
        open_pivot = open_pivot.reindex(full_dates)
        open_pivot = open_pivot.fillna(close_pivot)
        
        ret_1d_mat = (close_pivot.shift(-1) - close_pivot) / close_pivot * 100
        ret_3d_mat = (close_pivot.shift(-3) - close_pivot) / close_pivot * 100
        ret_5d_mat = (close_pivot.shift(-5) - close_pivot) / close_pivot * 100
        ret_10d_mat = (close_pivot.shift(-10) - close_pivot) / close_pivot * 100
        
        if open_pivot.empty:
            open_pivot = close_pivot
            
        ret_1d_exec_mat = (close_pivot.shift(-1) - open_pivot.shift(-1)) / open_pivot.shift(-1) * 100
        ret_3d_exec_mat = (close_pivot.shift(-3) - open_pivot.shift(-1)) / open_pivot.shift(-1) * 100
        ret_5d_exec_mat = (close_pivot.shift(-5) - open_pivot.shift(-1)) / open_pivot.shift(-1) * 100
        ret_10d_exec_mat = (close_pivot.shift(-10) - open_pivot.shift(-1)) / open_pivot.shift(-1) * 100
        
        aligned_metrics = pd.concat([
            close_pivot.stack().rename('aligned_price'),
            ret_1d_mat.stack().rename('ret_1d'),
            ret_3d_mat.stack().rename('ret_3d'),
            ret_5d_mat.stack().rename('ret_5d'),
            ret_10d_mat.stack().rename('ret_10d'),
            ret_1d_exec_mat.stack().rename('ret_1d_executable'),
            ret_3d_exec_mat.stack().rename('ret_3d_executable'),
            ret_5d_exec_mat.stack().rename('ret_5d_executable'),
            ret_10d_exec_mat.stack().rename('ret_10d_executable')
        ], axis=1).reset_index()
        
        aligned_metrics.columns = [
            'date', 'symbol', 'aligned_price',
            'ret_1d', 'ret_3d', 'ret_5d', 'ret_10d',
            'ret_1d_executable', 'ret_3d_executable', 'ret_5d_executable', 'ret_10d_executable'
        ]
        
        df['date'] = pd.to_datetime(df['date']).dt.tz_localize(None).dt.normalize()
        df_merged = pd.merge(df, aligned_metrics, on=['date', 'symbol'], how='inner')
        
        # Benchmark returns
        bench_cols = {}
        for bench_sym in unique_benchmarks:
            clean_bench = bench_sym.replace(".AX", "")
            bench_df = price_df[price_df['symbol'] == clean_bench].copy()
            if bench_df.empty:
                bench_df = benchmark_aord.copy()
            else:
                bench_df.index = pd.DatetimeIndex(pd.to_datetime(bench_df['date'])).tz_localize(None).normalize()
                if 'open' not in bench_df.columns:
                    bench_df['open'] = bench_df['close']
                bench_df = bench_df[['close', 'open']].rename(columns={'close': 'close_price', 'open': 'open_price'}).sort_index()
                bench_df = bench_df[~bench_df.index.duplicated(keep='first')]
                
            bench_df = bench_df.reindex(full_dates).ffill()
            close_b = bench_df['close_price'] if 'close_price' in bench_df.columns else bench_df['benchmark_price']
            open_b = bench_df['open_price'] if 'open_price' in bench_df.columns else bench_df['benchmark_open']
            
            # Fill missing open with close if any
            open_b = open_b.fillna(close_b)
            
            bench_cols[clean_bench] = pd.DataFrame({
                'bench_ret_1d': (close_b.shift(-1) - close_b) / close_b * 100,
                'bench_ret_3d': (close_b.shift(-3) - close_b) / close_b * 100,
                'bench_ret_5d': (close_b.shift(-5) - close_b) / close_b * 100,
                'bench_ret_10d': (close_b.shift(-10) - close_b) / close_b * 100,
                'bench_ret_1d_executable': (close_b.shift(-1) - open_b.shift(-1)) / open_b.shift(-1) * 100,
                'bench_ret_3d_executable': (close_b.shift(-3) - open_b.shift(-1)) / open_b.shift(-1) * 100,
                'bench_ret_5d_executable': (close_b.shift(-5) - open_b.shift(-1)) / open_b.shift(-1) * 100,
                'bench_ret_10d_executable': (close_b.shift(-10) - open_b.shift(-1)) / open_b.shift(-1) * 100
            })
            
        bench_combined_rows = []
        for bench_sym, b_df in bench_cols.items():
            b_df = b_df.reset_index().rename(columns={'index': 'date'})
            b_df['benchmark_symbol'] = bench_sym
            bench_combined_rows.append(b_df)
            
        bench_combined = pd.concat(bench_combined_rows, ignore_index=True)
        
        symbol_to_bench = {}
        symbol_to_sector = {}
        for sec_name, symbols in SECTORS.items():
            bench_ticker = SECTOR_META.get(sec_name, {}).get("benchmark", "^AORD").replace(".AX", "")
            for sym in symbols:
                clean_s = sym.replace(".AX", "")
                symbol_to_bench[clean_s] = bench_ticker
                symbol_to_sector[clean_s] = sec_name
                
        df_merged['benchmark_symbol'] = df_merged['symbol'].map(symbol_to_bench).fillna("^AORD")
        df_merged['sector_name'] = df_merged['symbol'].map(symbol_to_sector)
        df_merged = pd.merge(df_merged, bench_combined, on=['date', 'benchmark_symbol'], how='left')
        
        # Join broad market index benchmark returns (^AORD)
        market_df = bench_cols.get('^AORD')
        if market_df is not None:
            market_df = market_df.reset_index().rename(columns={'index': 'date'})
            market_df['date'] = pd.to_datetime(market_df['date']).dt.tz_localize(None).dt.normalize()
            market_df = market_df.rename(columns={c: c.replace('bench_ret_', 'market_ret_') for c in market_df.columns if c != 'date'})
            df_merged = pd.merge(df_merged, market_df, on='date', how='left')
        
        # Map heat_score from sector to stock (strategy replay needs this for portfolio composite ranking)
        if 'heat_score' in df_sector.columns:
            heat_scores = df_sector[['date', 'sector_name', 'heat_score']].rename(columns={'heat_score': 'sector_heat_score'})
            heat_scores['date'] = pd.to_datetime(heat_scores['date']).dt.tz_localize(None).dt.normalize()
            df_merged = pd.merge(df_merged, heat_scores, on=['date', 'sector_name'], how='left')
            if 'heat_score' in df_merged.columns:
                df_merged['heat_score'] = df_merged['heat_score'].fillna(df_merged['sector_heat_score']).fillna(50)
            else:
                df_merged['heat_score'] = df_merged['sector_heat_score'].fillna(50)
            df_merged = df_merged.drop(columns=['sector_heat_score'])
        else:
            if 'heat_score' not in df_merged.columns:
                df_merged['heat_score'] = 50
        
        for p in ['1d', '3d', '5d', '10d']:
            df_merged['alpha_' + p] = df_merged['ret_' + p] - df_merged['bench_ret_' + p]
            df_merged['alpha_' + p + '_executable'] = df_merged['ret_' + p + '_executable'] - df_merged['bench_ret_' + p + '_executable']
            
        sector_daily_returns = df_merged.groupby(['date', 'sector_name'])[[
            'ret_1d', 'ret_3d', 'ret_5d', 'ret_10d',
            'ret_1d_executable', 'ret_3d_executable', 'ret_5d_executable', 'ret_10d_executable',
            'alpha_1d', 'alpha_3d', 'alpha_5d', 'alpha_10d',
            'alpha_1d_executable', 'alpha_3d_executable', 'alpha_5d_executable', 'alpha_10d_executable'
        ]].mean().reset_index()
        
        df_sector['date'] = pd.to_datetime(df_sector['date']).dt.tz_localize(None).dt.normalize()
        
        df_sector_subset = pd.merge(
            df_sector.drop(columns=['ret_1d', 'ret_3d', 'ret_5d', 'ret_10d', 'ret_1d_executable', 'ret_3d_executable', 'ret_5d_executable', 'ret_10d_executable'], errors='ignore'),
            sector_daily_returns, on=['date', 'sector_name'], how='inner'
        )
        
        sector_to_bench = {sec_name: meta.get("benchmark", "^AORD").replace(".AX", "") for sec_name, meta in SECTOR_META.items()}
        df_sector_subset['benchmark_symbol'] = df_sector_subset['sector_name'].map(sector_to_bench).fillna("^AORD")
        df_sector_subset = pd.merge(df_sector_subset, bench_combined, on=['date', 'benchmark_symbol'], how='left')

        for p in ['1d', '3d', '5d', '10d']:
            df_sector_subset['alpha_' + p] = df_sector_subset['ret_' + p] - df_sector_subset['bench_ret_' + p]
            df_sector_subset['alpha_' + p + '_executable'] = df_sector_subset['ret_' + p + '_executable'] - df_sector_subset['bench_ret_' + p + '_executable']

        # -------------------------------------------------------------
        # Sector Alpha Aggregation - Broad (All Component Stocks)
        # -------------------------------------------------------------
        rets_df_broad = aligned_metrics.copy()
        rets_df_broad['sector_name'] = rets_df_broad['symbol'].map(symbol_to_sector)
        rets_df_broad = rets_df_broad.dropna(subset=['sector_name'])
        
        df_sector_broad_rets = rets_df_broad.groupby(['date', 'sector_name']).agg(
            ret_1d=('ret_1d', 'mean'),
            ret_1d_executable=('ret_1d_executable', 'mean'),
            ret_3d=('ret_3d', 'mean'),
            ret_3d_executable=('ret_3d_executable', 'mean'),
            ret_5d=('ret_5d', 'mean'),
            ret_5d_executable=('ret_5d_executable', 'mean'),
            ret_10d=('ret_10d', 'mean'),
            ret_10d_executable=('ret_10d_executable', 'mean')
        ).reset_index()

        df_sector_broad = pd.merge(
            df_sector.drop(columns=['ret_1d', 'ret_3d', 'ret_5d', 'ret_10d', 'ret_1d_executable', 'ret_3d_executable', 'ret_5d_executable', 'ret_10d_executable'], errors='ignore'),
            df_sector_broad_rets, on=['date', 'sector_name'], how='inner'
        )
        df_sector_broad['benchmark_symbol'] = df_sector_broad['sector_name'].map(sector_to_bench).fillna("^AORD")
        df_sector_broad = pd.merge(df_sector_broad, bench_combined, on=['date', 'benchmark_symbol'], how='left')

        for p in ['1d', '3d', '5d', '10d']:
            df_sector_broad['alpha_' + p] = df_sector_broad['ret_' + p] - df_sector_broad['bench_ret_' + p]
            df_sector_broad['alpha_' + p + '_executable'] = df_sector_broad['ret_' + p + '_executable'] - df_sector_broad['bench_ret_' + p + '_executable']

        # Filter replayed signals (apply standard is_trigger_signal check)
        def is_trigger_signal(sig):
            if not sig:
                return False
            base_triggers = ['主升浪 ▶', '主升浪(超买) ▶', 'V型反转 ⚡', '潜伏区 ◉', '消息共振 ◉', '主升浪 (轻仓)', '潜伏区 (轻仓)', '形态突破(利空降级)', '底部放量(利空降级)']
            return any(base in sig for base in base_triggers)

        MIN_SAMPLE_SIZE = cfg["min_sample_size"]
        max_date = df_merged['date'].max()
        
        if len(trading_days) >= 11:
            max_replay_signal_date = pd.to_datetime(trading_days[-11]).tz_localize(None).normalize()
        else:
            max_replay_signal_date = pd.to_datetime(trading_days[-1]).tz_localize(None).normalize()

        cutoff_tier = "6mo"
        cutoff_date = max_date - pd.Timedelta(days=180)
        signals_df = df_merged[df_merged['signal'].apply(is_trigger_signal) & (df_merged['date'] >= cutoff_date)].copy()
        matured_signals_df = signals_df[signals_df['date'] <= max_replay_signal_date].copy()
        
        if len(matured_signals_df) < MIN_SAMPLE_SIZE:
            cutoff_tier = "12mo"
            cutoff_date = max_date - pd.Timedelta(days=360)
            signals_df = df_merged[df_merged['signal'].apply(is_trigger_signal) & (df_merged['date'] >= cutoff_date)].copy()
            matured_signals_df = signals_df[signals_df['date'] <= max_replay_signal_date].copy()
            
        if len(matured_signals_df) < MIN_SAMPLE_SIZE:
            cutoff_tier = "all"
            signals_df = df_merged[df_merged['signal'].apply(is_trigger_signal)].copy()
            matured_signals_df = signals_df[signals_df['date'] <= max_replay_signal_date].copy()

        print(f"[REPLAY BACKTEST] Selected data cutoff tier: {cutoff_tier} (Cutoff date: {cutoff_date if cutoff_tier != 'all' else 'None'}, Sample size: {len(matured_signals_df)})")
        pending_signals_df = signals_df[signals_df['date'] > max_replay_signal_date].copy()
            
        double_cost = cfg["transaction_cost_pct"] * 2
        
        def get_confidence(size):
            return "high" if size >= 100 else ("medium" if size >= 50 else "low")
            
        periods_config = [
            ('1d', 'ret_1d', 'bench_ret_1d', 'alpha_1d'),
            ('3d', 'ret_3d', 'bench_ret_3d', 'alpha_3d'),
            ('5d', 'ret_5d', 'bench_ret_5d', 'alpha_5d'),
            ('10d', 'ret_10d', 'bench_ret_10d', 'alpha_10d')
        ]
        
        overall_stats = {}
        zone_stats = {"momentum": {}, "accumulation": {}, "watch": {}}
        liquidity_stats = {"normal": {}, "low": {}}
        historical_logs = []
        status_flag = "success"
        
        if len(matured_signals_df) < MIN_SAMPLE_SIZE:
            status_flag = "insufficient_data"
            overall_stats = {p[0]: {"win_rate": 0.0, "avg_return": 0.0, "avg_benchmark_return": 0.0, "avg_alpha": 0.0, "sample_size": 0, "confidence": "low"} for p in periods_config}
            zone_stats = {z: {p[0]: {"win_rate": 0.0, "avg_return": 0.0, "avg_benchmark_return": 0.0, "avg_alpha": 0.0, "sample_size": 0, "confidence": "low"} for p in periods_config} for z in zone_stats}
            liquidity_stats = {l: {p[0]: {"win_rate": 0.0, "avg_return": 0.0, "avg_benchmark_return": 0.0, "avg_alpha": 0.0, "sample_size": 0, "confidence": "low"} for p in periods_config} for l in liquidity_stats}
        else:
            # Overall Stats
            for name, col, b_col, a_col in periods_config:
                valid_rows = matured_signals_df[matured_signals_df[col].notna()]
                col_exec = col + "_executable"
                a_col_exec = a_col + "_executable"
                
                if not valid_rows.empty:
                    valid_theo = valid_rows[col].dropna()
                    valid_exec = valid_rows[col_exec].dropna()
                    win_rate_theo = (sum(valid_theo - double_cost > 0) / len(valid_theo)) * 100 if len(valid_theo) > 0 else 0.0
                    win_rate_exec = (sum(valid_exec - double_cost > 0) / len(valid_exec)) * 100 if len(valid_exec) > 0 else 0.0
                    
                    overall_stats[name] = {
                        "win_rate": round(float(win_rate_theo), 2),
                        "win_rate_executable": round(float(win_rate_exec), 2),
                        
                        "avg_return": round(float(valid_rows[col].mean() - double_cost), 2),
                        "avg_return_gross": round(float(valid_rows[col].mean()), 2),
                        "avg_return_net": round(float(valid_rows[col].mean() - double_cost), 2),
                        
                        "avg_return_executable": round(float(valid_rows[col_exec].mean() - double_cost), 2),
                        "avg_return_executable_gross": round(float(valid_rows[col_exec].mean()), 2),
                        "avg_return_executable_net": round(float(valid_rows[col_exec].mean() - double_cost), 2),
                        
                        "avg_benchmark_return": round(float(valid_rows[b_col].mean()), 2),
                        
                        "avg_alpha": round(float(valid_rows[a_col].mean() - double_cost), 2),
                        "avg_alpha_gross": round(float(valid_rows[a_col].mean()), 2),
                        "avg_alpha_net": round(float(valid_rows[a_col].mean() - double_cost), 2),
                        
                        "avg_alpha_executable": round(float(valid_rows[a_col_exec].mean() - double_cost), 2),
                        "avg_alpha_executable_gross": round(float(valid_rows[a_col_exec].mean()), 2),
                        "avg_alpha_executable_net": round(float(valid_rows[a_col_exec].mean() - double_cost), 2),
                        
                        "sample_size": len(valid_rows),
                        "confidence": get_confidence(len(valid_rows))
                      }
                else:
                    overall_stats[name] = {"win_rate": 0.0, "win_rate_executable": 0.0, "avg_return": 0.0, "avg_return_executable": 0.0, "avg_benchmark_return": 0.0, "avg_alpha": 0.0, "sample_size": 0, "confidence": "low"}
 
            # Zone Stats
            for zone in ['momentum', 'accumulation', 'watch']:
                zone_df = matured_signals_df[matured_signals_df['zone'] == zone]
                zone_stats[zone] = {}
                for name, col, b_col, a_col in periods_config:
                    valid_z = zone_df[zone_df[col].notna()]
                    col_exec = col + "_executable"
                    a_col_exec = a_col + "_executable"
                    
                    if not valid_z.empty:
                        valid_theo = valid_z[col].dropna()
                        valid_exec = valid_z[col_exec].dropna()
                        win_rate_theo = (sum(valid_theo - double_cost > 0) / len(valid_theo)) * 100 if len(valid_theo) > 0 else 0.0
                        win_rate_exec = (sum(valid_exec - double_cost > 0) / len(valid_exec)) * 100 if len(valid_exec) > 0 else 0.0
                        
                        zone_stats[zone][name] = {
                            "win_rate": round(float(win_rate_theo), 2),
                            "win_rate_executable": round(float(win_rate_exec), 2),
                            
                            "avg_return": round(float(valid_z[col].mean() - double_cost), 2),
                            "avg_return_gross": round(float(valid_z[col].mean()), 2),
                            "avg_return_net": round(float(valid_z[col].mean() - double_cost), 2),
                            
                            "avg_return_executable": round(float(valid_z[col_exec].mean() - double_cost), 2),
                            "avg_return_executable_gross": round(float(valid_z[col_exec].mean()), 2),
                            "avg_return_executable_net": round(float(valid_z[col_exec].mean() - double_cost), 2),
                            
                            "avg_benchmark_return": round(float(valid_z[b_col].mean()), 2),
                            
                            "avg_alpha": round(float(valid_z[a_col].mean() - double_cost), 2),
                            "avg_alpha_gross": round(float(valid_z[a_col].mean()), 2),
                            "avg_alpha_net": round(float(valid_z[a_col].mean() - double_cost), 2),
                            
                            "avg_alpha_executable": round(float(valid_z[a_col_exec].mean() - double_cost), 2),
                            "avg_alpha_executable_gross": round(float(valid_z[a_col_exec].mean()), 2),
                            "avg_alpha_executable_net": round(float(valid_z[a_col_exec].mean() - double_cost), 2),
                            
                            "sample_size": len(valid_z),
                            "confidence": get_confidence(len(valid_z))
                        }
                    else:
                        zone_stats[zone][name] = {"win_rate": 0.0, "win_rate_executable": 0.0, "avg_return": 0.0, "avg_return_executable": 0.0, "avg_benchmark_return": 0.0, "avg_alpha": 0.0, "sample_size": 0, "confidence": "low"}
 
            # Liquidity Stats
            for liq_key, contains_low in [("low", True), ("normal", False)]:
                if contains_low:
                    liq_df = matured_signals_df[matured_signals_df['signal'].str.contains("低流动性", na=False)]
                else:
                    liq_df = matured_signals_df[~matured_signals_df['signal'].str.contains("低流动性", na=False)]
                    
                for name, col, b_col, a_col in periods_config:
                    valid_l = liq_df[liq_df[col].notna()]
                    col_exec = col + "_executable"
                    a_col_exec = a_col + "_executable"
                    
                    if not valid_l.empty:
                        valid_theo = valid_l[col].dropna()
                        valid_exec = valid_l[col_exec].dropna()
                        win_rate_theo = (sum(valid_theo - double_cost > 0) / len(valid_theo)) * 100 if len(valid_theo) > 0 else 0.0
                        win_rate_exec = (sum(valid_exec - double_cost > 0) / len(valid_exec)) * 100 if len(valid_exec) > 0 else 0.0
                        
                        liquidity_stats[liq_key][name] = {
                            "win_rate": round(float(win_rate_theo), 2),
                            "win_rate_executable": round(float(win_rate_exec), 2),
                            
                            "avg_return": round(float(valid_l[col].mean() - double_cost), 2),
                            "avg_return_gross": round(float(valid_l[col].mean()), 2),
                            "avg_return_net": round(float(valid_l[col].mean() - double_cost), 2),
                            
                            "avg_return_executable": round(float(valid_l[col_exec].mean() - double_cost), 2),
                            "avg_return_executable_gross": round(float(valid_l[col_exec].mean()), 2),
                            "avg_return_executable_net": round(float(valid_l[col_exec].mean() - double_cost), 2),
                            
                            "avg_benchmark_return": round(float(valid_l[b_col].mean()), 2),
                            
                            "avg_alpha": round(float(valid_l[a_col].mean() - double_cost), 2),
                            "avg_alpha_gross": round(float(valid_l[a_col].mean()), 2),
                            "avg_alpha_net": round(float(valid_l[a_col].mean() - double_cost), 2),
                            
                            "avg_alpha_executable": round(float(valid_l[a_col_exec].mean() - double_cost), 2),
                            "avg_alpha_executable_gross": round(float(valid_l[a_col_exec].mean()), 2),
                            "avg_alpha_executable_net": round(float(valid_l[a_col_exec].mean() - double_cost), 2),
                            
                            "sample_size": len(valid_l),
                            "confidence": get_confidence(len(valid_l))
                        }
                    else:
                        liquidity_stats[liq_key][name] = {"win_rate": 0.0, "win_rate_executable": 0.0, "avg_return": 0.0, "avg_return_executable": 0.0, "avg_benchmark_return": 0.0, "avg_alpha": 0.0, "sample_size": 0, "confidence": "low"}

        # Logs list
        if 'date' in signals_df.columns:
            log_df = signals_df.sort_values('date', ascending=False)
        elif signals_df.index.name == 'date':
            log_df = signals_df.sort_index(ascending=False)
        else:
            log_df = signals_df

        for _, row in log_df.iterrows():
            historical_logs.append({
                "date": row['date'].strftime("%Y-%m-%d"),
                "symbol": row['symbol'],
                "signal": row['signal'],
                "zone": row['zone'],
                "price": float(row['price']),
                "vol_ratio": float(row['vol_ratio']) if pd.notna(row.get('vol_ratio')) else 1.0,
                "rs_ratio_5d": float(row['rs_ratio_5d']) if pd.notna(row.get('rs_ratio_5d')) else 1.0,
                "heat_score": int(row['heat_score']) if pd.notna(row.get('heat_score')) else 50,
                
                "ret_1d": None if pd.isna(row['ret_1d']) else round(float(row['ret_1d']), 2),
                "ret_1d_executable": None if pd.isna(row['ret_1d_executable']) else round(float(row['ret_1d_executable']), 2),
                "bench_ret_1d": None if pd.isna(row['bench_ret_1d']) else round(float(row['bench_ret_1d']), 2),
                "bench_ret_1d_executable": None if pd.isna(row.get('bench_ret_1d_executable')) else round(float(row['bench_ret_1d_executable']), 2),
                "alpha_1d": None if pd.isna(row['alpha_1d']) else round(float(row['alpha_1d']), 2),
                "alpha_1d_executable": None if pd.isna(row['alpha_1d_executable']) else round(float(row['alpha_1d_executable']), 2),
                "market_ret_1d": None if pd.isna(row.get('market_ret_1d')) else round(float(row['market_ret_1d']), 2),
                "market_ret_1d_executable": None if pd.isna(row.get('market_ret_1d_executable')) else round(float(row['market_ret_1d_executable']), 2),
                
                "ret_3d": None if pd.isna(row['ret_3d']) else round(float(row['ret_3d']), 2),
                "ret_3d_executable": None if pd.isna(row['ret_3d_executable']) else round(float(row['ret_3d_executable']), 2),
                "bench_ret_3d": None if pd.isna(row['bench_ret_3d']) else round(float(row['bench_ret_3d']), 2),
                "bench_ret_3d_executable": None if pd.isna(row.get('bench_ret_3d_executable')) else round(float(row['bench_ret_3d_executable']), 2),
                "alpha_3d": None if pd.isna(row['alpha_3d']) else round(float(row['alpha_3d']), 2),
                "alpha_3d_executable": None if pd.isna(row['alpha_3d_executable']) else round(float(row['alpha_3d_executable']), 2),
                "market_ret_3d": None if pd.isna(row.get('market_ret_3d')) else round(float(row['market_ret_3d']), 2),
                "market_ret_3d_executable": None if pd.isna(row.get('market_ret_3d_executable')) else round(float(row['market_ret_3d_executable']), 2),
                
                "ret_5d": None if pd.isna(row['ret_5d']) else round(float(row['ret_5d']), 2),
                "ret_5d_executable": None if pd.isna(row['ret_5d_executable']) else round(float(row['ret_5d_executable']), 2),
                "bench_ret_5d": None if pd.isna(row['bench_ret_5d']) else round(float(row['bench_ret_5d']), 2),
                "bench_ret_5d_executable": None if pd.isna(row.get('bench_ret_5d_executable')) else round(float(row['bench_ret_5d_executable']), 2),
                "alpha_5d": None if pd.isna(row['alpha_5d']) else round(float(row['alpha_5d']), 2),
                "alpha_5d_executable": None if pd.isna(row['alpha_5d_executable']) else round(float(row['alpha_5d_executable']), 2),
                "market_ret_5d": None if pd.isna(row.get('market_ret_5d')) else round(float(row['market_ret_5d']), 2),
                "market_ret_5d_executable": None if pd.isna(row.get('market_ret_5d_executable')) else round(float(row['market_ret_5d_executable']), 2),
                
                "ret_10d": None if pd.isna(row['ret_10d']) else round(float(row['ret_10d']), 2),
                "ret_10d_executable": None if pd.isna(row['ret_10d_executable']) else round(float(row['ret_10d_executable']), 2),
                "bench_ret_10d": None if pd.isna(row['bench_ret_10d']) else round(float(row['bench_ret_10d']), 2),
                "bench_ret_10d_executable": None if pd.isna(row.get('bench_ret_10d_executable')) else round(float(row['bench_ret_10d_executable']), 2),
                "alpha_10d": None if pd.isna(row['alpha_10d']) else round(float(row['alpha_10d']), 2),
                "alpha_10d_executable": None if pd.isna(row['alpha_10d_executable']) else round(float(row['alpha_10d_executable']), 2),
                "market_ret_10d": None if pd.isna(row.get('market_ret_10d')) else round(float(row['market_ret_10d']), 2),
                "market_ret_10d_executable": None if pd.isna(row.get('market_ret_10d_executable')) else round(float(row['market_ret_10d_executable']), 2)
            })

        # Run Portfolio Simulator using matured signals
        portfolio_stats, portfolio_curves, portfolio_logs = run_portfolio_backtest(matured_signals_df, close_pivot, open_pivot, periods_config, double_cost, cfg.get("top_n_portfolio", 5))

        # Sector Performance
        trigger_sectors = ['🔥 热点爆发', '📡 资金潜入', '📈 温和上涨']
        cutoff_sec_date = max_date - pd.Timedelta(days=180)
        
        subset_signals_df = df_sector_subset[df_sector_subset['signal'].isin(trigger_sectors) & (df_sector_subset['date'] >= cutoff_sec_date)].copy()
        broad_signals_df = df_sector_broad[df_sector_broad['signal'].isin(trigger_sectors) & (df_sector_broad['date'] >= cutoff_sec_date)].copy()
        
        matured_subset_signals_df = subset_signals_df[subset_signals_df['date'] <= max_replay_signal_date].copy()
        matured_broad_signals_df = broad_signals_df[broad_signals_df['date'] <= max_replay_signal_date].copy()

        if len(matured_subset_signals_df) < MIN_SAMPLE_SIZE:
            subset_signals_df = df_sector_subset[df_sector_subset['signal'].isin(trigger_sectors)].copy()
            broad_signals_df = df_sector_broad[df_sector_broad['signal'].isin(trigger_sectors)].copy()
            matured_subset_signals_df = subset_signals_df[subset_signals_df['date'] <= max_replay_signal_date].copy()
            matured_broad_signals_df = broad_signals_df[broad_signals_df['date'] <= max_replay_signal_date].copy()

        # Sector Stats
        sector_overall = {}
        sector_logs = []
        for name, col, b_col, a_col in periods_config:
            col_exec = col + "_executable"
            a_col_exec = a_col + "_executable"
            
            # --- Subset Return Stats ---
            valid_sec_sub = matured_subset_signals_df[matured_subset_signals_df[col].notna()]
            stat_sub = {
                "win_rate": 0.0, "win_rate_executable": 0.0,
                "avg_return": 0.0, "avg_return_executable": 0.0,
                "avg_benchmark_return": 0.0,
                "avg_alpha": 0.0, "avg_alpha_executable": 0.0,
                "sample_size": 0
            }
            if not valid_sec_sub.empty:
                valid_theo = valid_sec_sub[col].dropna()
                valid_exec = valid_sec_sub[col_exec].dropna()
                win_rate_theo = (sum(valid_theo - double_cost > 0) / len(valid_theo)) * 100 if len(valid_theo) > 0 else 0.0
                win_rate_exec = (sum(valid_exec - double_cost > 0) / len(valid_exec)) * 100 if len(valid_exec) > 0 else 0.0
                
                stat_sub.update({
                    "win_rate": round(float(win_rate_theo), 2),
                    "win_rate_executable": round(float(win_rate_exec), 2),
                    "avg_return": round(float(valid_sec_sub[col].mean() - double_cost), 2),
                    "avg_return_gross": round(float(valid_sec_sub[col].mean()), 2),
                    "avg_return_net": round(float(valid_sec_sub[col].mean() - double_cost), 2),
                    "avg_return_executable": round(float(valid_sec_sub[col_exec].mean() - double_cost), 2),
                    "avg_return_executable_gross": round(float(valid_sec_sub[col_exec].mean()), 2),
                    "avg_return_executable_net": round(float(valid_sec_sub[col_exec].mean() - double_cost), 2),
                    "avg_benchmark_return": round(float(valid_sec_sub[b_col].mean()), 2),
                    "avg_alpha": round(float(valid_sec_sub[a_col].mean() - double_cost), 2),
                    "avg_alpha_gross": round(float(valid_sec_sub[a_col].mean()), 2),
                    "avg_alpha_net": round(float(valid_sec_sub[a_col].mean() - double_cost), 2),
                    "avg_alpha_executable": round(float(valid_sec_sub[a_col_exec].mean() - double_cost), 2),
                    "avg_alpha_executable_gross": round(float(valid_sec_sub[a_col_exec].mean()), 2),
                    "avg_alpha_executable_net": round(float(valid_sec_sub[a_col_exec].mean() - double_cost), 2),
                    "sample_size": len(valid_sec_sub)
                })

            # --- Broad Return Stats ---
            valid_sec_broad = matured_broad_signals_df[matured_broad_signals_df[col].notna()]
            stat_broad = {
                "win_rate": 0.0, "win_rate_executable": 0.0,
                "avg_return": 0.0, "avg_return_executable": 0.0,
                "avg_benchmark_return": 0.0,
                "avg_alpha": 0.0, "avg_alpha_executable": 0.0,
                "sample_size": 0
            }
            if not valid_sec_broad.empty:
                valid_theo = valid_sec_broad[col].dropna()
                valid_exec = valid_sec_broad[col_exec].dropna()
                win_rate_theo = (sum(valid_theo - double_cost > 0) / len(valid_theo)) * 100 if len(valid_theo) > 0 else 0.0
                win_rate_exec = (sum(valid_exec - double_cost > 0) / len(valid_exec)) * 100 if len(valid_exec) > 0 else 0.0
                
                stat_broad.update({
                    "win_rate": round(float(win_rate_theo), 2),
                    "win_rate_executable": round(float(win_rate_exec), 2),
                    "avg_return": round(float(valid_sec_broad[col].mean() - double_cost), 2),
                    "avg_return_gross": round(float(valid_sec_broad[col].mean()), 2),
                    "avg_return_net": round(float(valid_sec_broad[col].mean() - double_cost), 2),
                    "avg_return_executable": round(float(valid_sec_broad[col_exec].mean() - double_cost), 2),
                    "avg_return_executable_gross": round(float(valid_sec_broad[col_exec].mean()), 2),
                    "avg_return_executable_net": round(float(valid_sec_broad[col_exec].mean() - double_cost), 2),
                    "avg_benchmark_return": round(float(valid_sec_broad[b_col].mean()), 2),
                    "avg_alpha": round(float(valid_sec_broad[a_col].mean() - double_cost), 2),
                    "avg_alpha_gross": round(float(valid_sec_broad[a_col].mean()), 2),
                    "avg_alpha_net": round(float(valid_sec_broad[a_col].mean() - double_cost), 2),
                    "avg_alpha_executable": round(float(valid_sec_broad[a_col_exec].mean() - double_cost), 2),
                    "avg_alpha_executable_gross": round(float(valid_sec_broad[a_col_exec].mean()), 2),
                    "avg_alpha_executable_net": round(float(valid_sec_broad[a_col_exec].mean() - double_cost), 2),
                    "sample_size": len(valid_sec_broad)
                })

            sector_overall[name] = {
                "broad_return_stats": stat_broad,
                "subset_return_stats": stat_sub
            }

        if 'date' in subset_signals_df.columns:
            sec_log_df = subset_signals_df.sort_values('date', ascending=False)
        elif subset_signals_df.index.name == 'date':
            sec_log_df = subset_signals_df.sort_index(ascending=False)
        else:
            sec_log_df = subset_signals_df

        for _, row in sec_log_df.iterrows():
            sector_logs.append({
                "date": row['date'].strftime("%Y-%m-%d"),
                "sector": row['sector_name'],
                    "signal": row['signal'],
                    "zone": row['zone'],
                    "avg_chg": float(row['avg_chg']),
                    
                    "ret_1d": None if pd.isna(row['ret_1d']) else round(float(row['ret_1d']), 2),
                    "ret_1d_executable": None if pd.isna(row['ret_1d_executable']) else round(float(row['ret_1d_executable']), 2),
                    "bench_ret_1d": None if pd.isna(row['bench_ret_1d']) else round(float(row['bench_ret_1d']), 2),
                    "bench_ret_1d_executable": None if pd.isna(row.get('bench_ret_1d_executable')) else round(float(row['bench_ret_1d_executable']), 2),
                    "alpha_1d": None if pd.isna(row['alpha_1d']) else round(float(row['alpha_1d']), 2),
                    "alpha_1d_executable": None if pd.isna(row['alpha_1d_executable']) else round(float(row['alpha_1d_executable']), 2),
                    
                    "ret_3d": None if pd.isna(row['ret_3d']) else round(float(row['ret_3d']), 2),
                    "ret_3d_executable": None if pd.isna(row['ret_3d_executable']) else round(float(row['ret_3d_executable']), 2),
                    "bench_ret_3d": None if pd.isna(row['bench_ret_3d']) else round(float(row['bench_ret_3d']), 2),
                    "bench_ret_3d_executable": None if pd.isna(row.get('bench_ret_3d_executable')) else round(float(row['bench_ret_3d_executable']), 2),
                    "alpha_3d": None if pd.isna(row['alpha_3d']) else round(float(row['alpha_3d']), 2),
                    "alpha_3d_executable": None if pd.isna(row['alpha_3d_executable']) else round(float(row['alpha_3d_executable']), 2),
                    
                    "ret_5d": None if pd.isna(row['ret_5d']) else round(float(row['ret_5d']), 2),
                    "ret_5d_executable": None if pd.isna(row['ret_5d_executable']) else round(float(row['ret_5d_executable']), 2),
                    "bench_ret_5d": None if pd.isna(row['bench_ret_5d']) else round(float(row['bench_ret_5d']), 2),
                    "bench_ret_5d_executable": None if pd.isna(row.get('bench_ret_5d_executable')) else round(float(row['bench_ret_5d_executable']), 2),
                    "alpha_5d": None if pd.isna(row['alpha_5d']) else round(float(row['alpha_5d']), 2),
                    "alpha_5d_executable": None if pd.isna(row['alpha_5d_executable']) else round(float(row['alpha_5d_executable']), 2),
                    
                    "ret_10d": None if pd.isna(row['ret_10d']) else round(float(row['ret_10d']), 2),
                    "ret_10d_executable": None if pd.isna(row['ret_10d_executable']) else round(float(row['ret_10d_executable']), 2),
                    "bench_ret_10d": None if pd.isna(row['bench_ret_10d']) else round(float(row['bench_ret_10d']), 2),
                    "bench_ret_10d_executable": None if pd.isna(row.get('bench_ret_10d_executable')) else round(float(row['bench_ret_10d_executable']), 2),
                    "alpha_10d": None if pd.isna(row['alpha_10d']) else round(float(row['alpha_10d']), 2),
                    "alpha_10d_executable": None if pd.isna(row['alpha_10d_executable']) else round(float(row['alpha_10d_executable']), 2)
                })

        # Build output structure
        output = {
            "algo_version": algo_version,
            "total_signals": len(signals_df),
            "matured_signals": len(matured_signals_df),
            "pending_signals": len(pending_signals_df),
            "cutoff_tier": cutoff_tier,
            "last_updated": pd.Timestamp.now().isoformat(),
            "overall": overall_stats,
            "by_zone": zone_stats,
            "by_liquidity": liquidity_stats,
            "portfolio_stats": portfolio_stats,
            "portfolio_equity_curves": portfolio_curves,
            "portfolio_logs": portfolio_logs,
            "logs": historical_logs,
            "sector_overall": sector_overall,
            "sector_logs": sector_logs,
            "status": status_flag
        }

        os.makedirs("public", exist_ok=True)
        version_filename = f"public/backtest_replay_{algo_version}.json"
        with open(version_filename, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        # Default fallback/current version
        if algo_version == ALGO_VERSION:
            with open("public/backtest_replay.json", "w", encoding="utf-8") as f:
                json.dump(output, f, ensure_ascii=False, indent=2)

        print(f"[REPLAY BACKTEST] Successfully generated {version_filename}")

    except Exception as e:
        print(f"[REPLAY BACKTEST] Error running backtester for {algo_version}: {e}")
        import traceback
        tb = traceback.format_exc()
        write_empty_replay(f"Error: {e}\n{tb}", algo_version)
    finally:
        if conn:
            conn.close()

def write_empty_replay(msg, algo_version=None):
    """Outputs an empty structure in case of failure or lack of data."""
    if algo_version is None:
        algo_version = ALGO_VERSION
    output = {
        "algo_version": algo_version,
        "status": "pending",
        "message": msg,
        "total_signals": 0,
        "overall": {},
        "by_zone": {},
        "portfolio_stats": {},
        "portfolio_equity_curves": {},
        "portfolio_logs": [],
        "logs": [],
        "sector_overall": {},
        "sector_logs": []
    }
    os.makedirs("public", exist_ok=True)
    with open(f"public/backtest_replay_{algo_version}.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    if algo_version == ALGO_VERSION:
        with open("public/backtest_replay.json", "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

def run_all_replay_backtests():
    """Finds all distinct algorithm versions in the database and runs backtests for each."""
    db_url = os.environ.get("DATABASE_URL")
    versions = [ALGO_VERSION]
    
    if db_url:
        try:
            conn = psycopg2.connect(db_url)
            cur = conn.cursor()
            cur.execute("SELECT DISTINCT algo_version FROM stock_signals WHERE algo_version IS NOT NULL;")
            db_versions = [r[0] for r in cur.fetchall()]
            cur.close()
            conn.close()
            
            for v in db_versions:
                if v not in versions:
                    versions.append(v)
        except Exception as e:
            print(f"[REPLAY BACKTEST] Failed to fetch database versions: {e}")
            
    # Scan public/ directory for other generated versions
    import glob
    for fpath in glob.glob("public/backtest_replay_*.json"):
        vname = os.path.basename(fpath).replace("backtest_replay_", "").replace(".json", "")
        if vname and vname != "versions" and vname not in versions:
            versions.append(vname)
            
    print(f"[REPLAY BACKTEST] Found {len(versions)} versions to replay: {versions}")
    
    for v in versions:
        print(f"\n--- Running replay backtest for version: {v} ---")
        run_replay_backtest(algo_version=v)
        
    # Compile details based on production deployment commit dates
    import datetime
    VERSION_DEPLOYMENT_DATES = {
        "v1.2.0-19aa7e71": {"start_date": "2026-06-19", "end_date": "2026-07-01"},
        "v1.2.0-4fea7cba": {"start_date": "2026-07-01", "end_date": "2026-07-10"},
    }
    
    details = {}
    current_date_str = datetime.date.today().strftime("%Y-%m-%d")
    for v in versions:
        if v in VERSION_DEPLOYMENT_DATES:
            details[v] = VERSION_DEPLOYMENT_DATES[v]
        elif v == ALGO_VERSION:
            details[v] = {"start_date": "2026-07-10", "end_date": current_date_str}
        else:
            details[v] = {"start_date": "2026-07-10", "end_date": current_date_str}
                
    # Write the registry file
    registry = {
        "latest": ALGO_VERSION,
        "versions": sorted(versions, reverse=True),
        "details": details
    }
    os.makedirs("public", exist_ok=True)
    with open("public/backtest_replay_versions.json", "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    run_all_replay_backtests()
