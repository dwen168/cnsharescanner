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
        "turnover_tier2_limit": 2000000.0,  # AUD 2M
        "turnover_tier3_limit": 500000.0,   # AUD 500K
    },
    "backtest_engine": {
        "min_sample_size": 30,
        "transaction_cost_pct": 0.2,
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
# ASX 板块分组配置 (包含龙头个股与热门行业赛道)
# =========================================================
SECTORS = {
    "金融银行 Banking": [
        "CBA.AX", "NAB.AX", "WBC.AX", "ANZ.AX", "MQG.AX",
        "BEN.AX", "BOQ.AX", "SUN.AX"
    ],
    "矿业资源 Mining": [
        "BHP.AX", "RIO.AX", "FMG.AX", "S32.AX", "MIN.AX",
        "SFR.AX", "29M.AX"
    ],
    "黄金 Gold": [
        "NST.AX", "EVN.AX", "NEM.AX", "GMD.AX",
        "RRL.AX"
    ],
    "新能源/锂矿 Lithium": [
        "PLS.AX", "LTR.AX", "IGO.AX", "LYC.AX", "WC8.AX",
        "CXO.AX"
    ],
    "铀矿 Uranium": [
        "BOE.AX", "PDN.AX", "LOT.AX", "BMN.AX",
        "PEN.AX", "DYL.AX"
    ],
    "科技/软件 Technology": [
        "XRO.AX", "WTC.AX", "TLX.AX", "AD8.AX", "APX.AX",
        "TNE.AX", "DDR.AX"
    ],
    "AI基建 AI Infra": [
        "NXT.AX", "MP1.AX", "ALC.AX",
        "BRN.AX"
    ],
    "医疗健康 Healthcare": [
        "CSL.AX", "RMD.AX", "COH.AX", "SHL.AX",
        "FPH.AX", "ANN.AX", "SIG.AX", "MSB.AX", "PNV.AX"
    ],
    "消费/零售 Consumer": [
        "WES.AX", "WOW.AX", "COL.AX", "JBH.AX",
        "MTS.AX", "TWE.AX", "SUL.AX"
    ],
    "地产/基建 Real Estate": [
        "GMG.AX", "SCG.AX", "SGP.AX", "GPT.AX",
        "CHC.AX", "DXS.AX", "VCX.AX"
    ],
    "能源 Energy": [
        "WDS.AX", "STO.AX", "BPT.AX", "WHC.AX",
        "YAL.AX", "NHC.AX", "ORG.AX"
    ],
    "旅游博彩 Travel": [
        "FLT.AX", "ALL.AX", "TAH.AX", "WEB.AX",
        "QAN.AX"
    ],
}

SECTOR_META = {
    "金融银行 Banking":     {"type": "industry", "benchmark": "^AXFJ"},
    "矿业资源 Mining":      {"type": "industry", "benchmark": "^AXMJ"},
    "黄金 Gold":            {"type": "industry", "benchmark": "^AXGD"},
    "新能源/锂矿 Lithium":  {"type": "industry", "benchmark": "^AXMJ"},
    "铀矿 Uranium":         {"type": "industry", "benchmark": "^AORD"},
    "科技/软件 Technology":  {"type": "industry", "benchmark": "^AXTX"},
    "AI基建 AI Infra":      {"type": "theme", "benchmark": "^AXTX"},
    "医疗健康 Healthcare":   {"type": "industry", "benchmark": "^AXHJ"},
    "消费/零售 Consumer":    {"type": "industry", "benchmark": "^AXSJ"},
    "地产/基建 Real Estate": {"type": "industry", "benchmark": "^AXPJ"},
    "能源 Energy":          {"type": "industry", "benchmark": "^AXEJ"},
    "旅游博彩 Travel":      {"type": "industry", "benchmark": "^AORD"},
}

ALL_SYMBOLS = list({s for stocks in SECTORS.values() for s in stocks})
