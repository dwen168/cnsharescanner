import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from strategy_config import SECTORS, ALL_SYMBOLS

def generate_offline_backtest_data(algo_version):
    """Generates realistic mock signals and price paths for offline backtest runs."""
    print("  [BACKTEST] Running in Offline Mock Simulation Mode...")
    
    # 1. Build canonical date sequence
    end_date = datetime.now()
    dates = []
    curr = end_date - timedelta(days=180)
    while curr <= end_date:
        if curr.weekday() < 5:
            dates.append(curr.strftime("%Y-%m-%d"))
        curr += timedelta(days=1)
        
    # 2. Build mock price dataframe for symbols and benchmarks
    clean_symbols = [s.replace(".AX", "") for s in ALL_SYMBOLS]
    benchmarks = ["sh000947", "sz399975", "sh000934", "sz399976", "sh000928", "sh000935", "sh000933", "sh000932", "sz399959", "sh000300"]
    all_tickers = clean_symbols + benchmarks
    
    np.random.seed(42)  # Fixed seed for stable offline stats
    price_rows = []
    
    for t in all_tickers:
        price = 100.0 if t in benchmarks else np.random.uniform(5.0, 150.0)
        volatility = 0.015 if "Lithium" in t or "Tech" in t or t in ["sh000935"] else 0.008
        drift = 0.0003 if t in ["sh000935", "sh000947"] else 0.0001
        
        for date_str in dates:
            ret = np.random.normal(drift, volatility)
            gap = np.random.normal(0, 0.002)
            open_price = price * (1 + gap)
            close_price = price * (1 + ret)
            volume = int(np.random.uniform(50000, 5000000))
            
            price_rows.append({
                "date": pd.to_datetime(date_str),
                "symbol": t,
                "open": round(open_price, 2),
                "close": round(close_price, 2),
                "volume": volume
            })
            price = close_price
            
    price_df = pd.DataFrame(price_rows)
    
    # 3. Build mock signals
    signal_rows = []
    trigger_signals = ['主升浪 ▶', '潜伏区 ◉', 'V型反转 ⚡']
    zones = ['momentum', 'accumulation', 'momentum']
    
    for date_str in dates[10:-15]:
        if np.random.uniform(0, 1) > 0.82:
            num_signals = np.random.randint(1, 4)
            chosen_symbols = np.random.choice(clean_symbols, num_signals, replace=False)
            for sym in chosen_symbols:
                idx = np.random.randint(0, len(trigger_signals))
                sig = trigger_signals[idx]
                zone = zones[idx]
                
                matching_price = price_df[(price_df['date'] == pd.to_datetime(date_str)) & (price_df['symbol'] == sym)]
                price_val = matching_price['close'].values[0] if not matching_price.empty else 50.0
                
                signal_rows.append({
                    "date": pd.to_datetime(date_str),
                    "symbol": sym,
                    "price": price_val,
                    "signal": sig,
                    "zone": zone
                })
                
    signals_df = pd.DataFrame(signal_rows)
    
    # 4. Build mock sector signals
    sector_rows = []
    sector_signals = ['🔥 热点爆发', '📡 资金潜入', '📈 温和上涨', '❄️ 冷淡']
    sector_zones = ['hot', 'warming', 'mild', 'cold']
    
    for date_str in dates:
        for sector_name in SECTORS.keys():
            idx = np.random.randint(0, len(sector_signals))
            sig = sector_signals[idx]
            zone = sector_zones[idx]
            
            sector_rows.append({
                "date": pd.to_datetime(date_str),
                "sector_name": sector_name,
                "avg_chg": round(np.random.uniform(-1.0, 1.5), 2),
                "signal": sig,
                "zone": zone
            })
            
    sector_signals_df = pd.DataFrame(sector_rows)
    
    return signals_df, sector_signals_df, price_df
