import json
import hashlib

# Centralized strategy configuration parameters
STRATEGY_CONFIG = {
    "stock_analyzer": {
        "min_data_len_initial": 25,
        "min_data_len_aligned": 20,
        "rsi_period": 14,
        "rsi_overbought_threshold": 75,
        "rsi_fallback_value": 50.0,
        "breakout_lookback_days": 21,
        
        # Volatility & Momentum thresholds
        "atr_period": 14,
        "atr_pct_threshold": 2.0,
        "momentum_ma_conditions_min": 2,  # sum([ma_bullish, breakout_vol_spike, is_strong]) >= 2
        
        # State-dependent thresholds (default vs low_risk)
        "vol_percentile_threshold": {
            "default": 0.70,
            "low_risk": 0.75
        },
        "accum_spike_threshold": {
            "default": 1.1,
            "low_risk": 1.3
        },
        "rs_threshold": {
            "default": 1.01,
            "low_risk": 1.03
        },
        
        # Trend and bottom confirmations
        "low_60d_floor_multiplier": 1.05,
        "recent_days_count": 5,
        "up_days_min": 2,
        
        # V-Reversal criteria
        "v_reversal_chg_pct_min": 3.0,
        "v_reversal_chg_5d_max": -5.0,
        "v_reversal_vol_ratio_min": 2.0,
        
        # Sentiment decay and bad news filters
        "sentiment_bad_threshold": -0.15,
        "sentiment_good_threshold": 0.25,
        "freshness_bad_threshold": 0.3,
        "freshness_good_threshold": 0.4,
        
        # Sector formula weights/caps
        "base_tech_rs_cap": 70.0,
        "sent_bonus_multiplier": 15.0,
        "macro_bonus_tech_grow_multiplier": -25.0,
        "macro_bonus_banking_multiplier": 20.0,
        "macro_bonus_resource_multiplier": 10.0,
        "macro_bonus_healthcare_multiplier": -20.0,
        "macro_bonus_consumer_multiplier": -15.0,
        "macro_bonus_travel_multiplier": 5.0,
        "macro_bonus_gold_multiplier": -10.0,
        
        # Turnover/Liquidity filter limits
        "turnover_tier2_limit": 50000000.0,  # 50M CNY
        "turnover_tier3_limit": 10000000.0,  # 10M CNY
    },
    "backtest_engine": {
        "min_sample_size": 30,
        "transaction_cost_pct": 0.1,
        "holding_periods": [1, 3, 5, 10],
        "top_n_portfolio": 5,
    }
}

def get_config_fingerprint():
    """Generates an 8-character MD5 hash fingerprint of the configuration dict."""
    config_str = json.dumps(STRATEGY_CONFIG, sort_keys=True)
    return hashlib.md5(config_str.encode('utf-8')).hexdigest()[:8]

BASE_ALGO_VERSION = "v1.2.0"
ALGO_VERSION = f"{BASE_ALGO_VERSION}-{get_config_fingerprint()}"

# =========================================================
# China A-Share Sectors & Symbols Configuration
# =========================================================
SECTORS = {
    "金融银行 Banking": [
        "600036", "601398", "601288", "601328", "601988",
        "000001", "600000", "002142", "601318"
    ],
    "证券券商 Brokerage": [
        "300059", "600030", "601688", "000776", "601211",
        "600999"
    ],
    "有色金属 Mining": [
        "601899", "603993", "600362", "601600", "000878",
        "600111"
    ],
    "新能源汽车 EV/Lithium": [
        "300750", "002594", "300014", "002466", "002460",
        "002074", "000338"
    ],
    "光伏能源 Solar/Energy": [
        "601012", "600438", "300274", "600900", "601088",
        "600011", "601857", "600028", "600938"
    ],
    "半导体芯片 Semiconductors": [
        "688981", "002371", "603501", "603986", "002049",
        "688012", "000725"
    ],
    "AI/软件 AI & Tech": [
        "002230", "688111", "300308", "300502", "000977",
        "601138"
    ],
    "医疗健康 Healthcare": [
        "600276", "300760", "300015", "603259", "600436",
        "000999"
    ],
    "白酒消费 Consumer": [
        "600519", "000858", "000568", "600809", "002304",
        "603288"
    ],
    "军工国防 Defense": [
        "600760", "000768", "600893", "002625", "600150",
        "002179"
    ]
}

SECTOR_META = {
    "金融银行 Banking":     {"type": "industry", "benchmark": "sh000947"},
    "证券券商 Brokerage":   {"type": "industry", "benchmark": "sz399975"},
    "有色金属 Mining":      {"type": "industry", "benchmark": "sh000934"},
    "新能源汽车 EV/Lithium":  {"type": "industry", "benchmark": "sz399976"},
    "光伏能源 Solar/Energy": {"type": "industry", "benchmark": "sh000928"},
    "半导体芯片 Semiconductors":  {"type": "industry", "benchmark": "sh000935"},
    "AI/软件 AI & Tech":     {"type": "theme", "benchmark": "sh000935"},
    "医疗健康 Healthcare":   {"type": "industry", "benchmark": "sh000933"},
    "白酒消费 Consumer":    {"type": "industry", "benchmark": "sh000932"},
    "军工国防 Defense":     {"type": "industry", "benchmark": "sz399959"},
}

ALL_SYMBOLS = list({s for stocks in SECTORS.values() for s in stocks})
