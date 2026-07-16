import json
import os
import sys
import argparse
import subprocess
import tempfile
import importlib.util

# Add project root and algo_src paths to sys.path so we can import modules correctly
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../algo_src")))

# Hardcoded legacy configurations as a fallback
KNOWN_CONFIGS = {
    "v1.2.0-19aa7e71": {
        "stock_analyzer": {
            "min_data_len_initial": 25,
            "min_data_len_aligned": 20,
            "rsi_period": 14,
            "rsi_overbought_threshold": 75,
            "rsi_fallback_value": 50.0,
            "breakout_lookback_days": 21,
            "atr_period": 14,
            "atr_pct_threshold": 2.0,
            "momentum_ma_conditions_min": 2,
            "vol_percentile_threshold": {
                "default": 0.70,
                "low_risk": 0.75
            },
            "accum_spike_threshold": {
                "default": 0.8,
                "low_risk": 1.0
            },
            "rs_threshold": {
                "default": 1.01,
                "low_risk": 1.03
            },
            "low_60d_floor_multiplier": 1.05,
            "recent_days_count": 5,
            "up_days_min": 2,
            "v_reversal_chg_pct_min": 3.0,
            "v_reversal_chg_5d_max": -5.0,
            "v_reversal_vol_ratio_min": 2.0,
            "sentiment_bad_threshold": -0.15,
            "sentiment_good_threshold": 0.25,
            "freshness_bad_threshold": 0.3,
            "freshness_good_threshold": 0.4,
            "base_tech_rs_cap": 70.0,
            "sent_bonus_multiplier": 15.0,
            "macro_bonus_tech_grow_multiplier": -25.0,
            "macro_bonus_banking_multiplier": 20.0,
            "macro_bonus_resource_multiplier": 10.0,
            "macro_bonus_healthcare_multiplier": -20.0,
            "macro_bonus_consumer_multiplier": -15.0,
            "turnover_tier2_limit": 2000000.0,
            "turnover_tier3_limit": 500000.0,
        },
        "backtest_engine": {
            "min_sample_size": 30,
            "transaction_cost_pct": 0.2,
            "holding_periods": [1, 3, 5, 10],
            "top_n_portfolio": 5,
        }
    }
}

def get_git_commit_sha_from_db(version_code):
    """Queries DB to find the git commit SHA associated with the version code."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        return None
    try:
        import psycopg2
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute("SELECT git_commit_sha FROM algo_config_versions WHERE version_code = %s", (version_code,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row:
            return row[0]
    except Exception as e:
        print(f"  [DB Query Warning] Could not retrieve commit SHA from DB: {e}")
    return None

def load_config_from_git_commit(commit_sha):
    """Loads STRATEGY_CONFIG dynamically from a specific git commit of strategy_config.py."""
    content = None
    # Try the new folder path first, then fall back to root path for older commits
    for git_path in [f"algo_src/strategy_config.py", "strategy_config.py"]:
        try:
            cmd = ["git", "show", f"{commit_sha}:{git_path}"]
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
            content = result.stdout
            break
        except Exception:
            continue
            
    if not content:
        print(f"  [Git Loading Warning] Could not check out strategy_config.py from commit {commit_sha} at any expected path.")
        return None
        
    try:
        # Create a temporary file to load it as a module
        with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False, encoding="utf-8") as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name
            
        try:
            spec = importlib.util.spec_from_file_location("temp_strategy_config", temp_file_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            config = getattr(module, "STRATEGY_CONFIG", None)
            return config
        finally:
            os.remove(temp_file_path)
    except Exception as e:
        print(f"  [Git Loading Warning] Error parsing strategy_config.py from commit {commit_sha}: {e}")
    return None

def load_strategy_config(version_code):
    """Determines strategy configuration for the given version code."""
    # 1. Compare with current active version code
    try:
        import strategy_config
        if strategy_config.ALGO_VERSION == version_code:
            print(f"  Using active workspace configuration for {version_code}")
            return strategy_config.STRATEGY_CONFIG
    except Exception:
        pass
        
    # 2. Check hardcoded known configs
    if version_code in KNOWN_CONFIGS:
        print(f"  Using hardcoded fallback configuration for {version_code}")
        return KNOWN_CONFIGS[version_code]
        
    # 3. Retrieve from DB & Git history
    commit_sha = get_git_commit_sha_from_db(version_code)
    if commit_sha:
        print(f"  Found Git commit {commit_sha} in DB for {version_code}. Loading configuration...")
        config = load_config_from_git_commit(commit_sha)
        if config:
            return config
            
    # 4. Fallback to active config with warning
    print(f"  ⚠️ Warning: Could not find custom config for version {version_code}. Falling back to active config.")
    try:
        import strategy_config
        return strategy_config.STRATEGY_CONFIG
    except Exception as e:
        print(f"Error loading fallback strategy config: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Universal ASX Screener data recovery tool.")
    parser.add_argument("--payload", default="public/tmp.json", help="Path to database payload JSON file.")
    parser.add_argument("--version", required=True, help="Algorithm version code (e.g. v1.2.0-19aa7e71).")
    parser.add_argument("--output", help="Optional target output data path. Defaults to public/data_[version].json")
    args = parser.parse_args()
    
    # 1. Validate payload path
    if not os.path.exists(args.payload):
        print(f"Error: Payload file '{args.payload}' does not exist.")
        sys.exit(1)
        
    # 2. Load payload data
    with open(args.payload, "r", encoding="utf-8") as f:
        payload = json.load(f)
        
    # 3. Retrieve Strategy Config
    config = load_strategy_config(args.version)
    if not config:
        print("Error: Could not retrieve strategy configuration.")
        sys.exit(1)
        
    # 4. Reconstruct Data file
    output_path = args.output or f"public/data_{args.version}.json"
    print(f"\nStep 1: Reconstructing {output_path}...")
    restored_data = {
        "algo_version": args.version,
        "strategy_config": config
    }
    for k, v in payload.items():
        restored_data[k] = v
        
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(restored_data, f, ensure_ascii=False, indent=2)
    print(f"✅ Successfully wrote restored data to {output_path}")
    
    # 5. Run backtests
    print(f"\nStep 2: Attempting to run backtests for version {args.version}...")
    try:
        from signal_audit_backtest import run_audit_backtest
        from strategy_replay_backtest import run_replay_backtest
        
        # Patch STRATEGY_CONFIG & ALGO_VERSION in memory so backtest scripts run with the correct parameters
        import strategy_config
        original_config = strategy_config.STRATEGY_CONFIG
        original_version = strategy_config.ALGO_VERSION
        
        strategy_config.STRATEGY_CONFIG = config
        strategy_config.ALGO_VERSION = args.version
        
        print("Running Audit Backtest...")
        run_audit_backtest(args.version)
        
        print("Running Replay Backtest...")
        run_replay_backtest(args.version)
        
        # Restore configuration
        strategy_config.STRATEGY_CONFIG = original_config
        strategy_config.ALGO_VERSION = original_version
        
        print(f"✅ Successfully completed backtest regeneration for version {args.version}!")
        
    except Exception as e:
        print(f"\n⚠️ Database connection / run failed: {e}")
        print("This is normal in the sandboxed agent environment because of blocked network/database access.")
        print("Please run this script on your local machine terminal to regenerate the backtest logs:")
        print(f"  python3 restore_tool.py --payload {args.payload} --version {args.version}")

if __name__ == "__main__":
    main()
