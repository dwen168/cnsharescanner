# Algorithm Data Recovery Tool

This directory contains utility scripts for restoring historical market daily run feeds and regenerating backtest files from database payloads.

## Files

- **`restore_tool.py`**: A universal command-line utility that merges database payload JSONs with historical algorithm configurations and regenerates their respective backtest audit and replay files.

## How It Works

When a run is executed, the database table `market_snapshots` stores the raw payload containing all sector and stock signal results. However, to save database storage, the central configuration mapping (`strategy_config`) and metadata header variables are omitted from the payload field.

The `restore_tool.py` script:
1. **Reconstructs the original `data_[version].json` file** by loading the raw snapshot payload and merging it back with the corresponding `strategy_config` parameters for that version.
2. **Automatically determines the configuration mapping** at four priority levels:
   - **Active Config**: Uses the current active configuration if the versions match.
   - **Known Fallbacks**: Uses hardcoded configurations for legacy versions (like `v1.2.0-19aa7e71`).
   - **Git Commit Checkout**: If a database connection is available, queries the database table `algo_config_versions` for the `git_commit_sha` associated with the target version, then checks out and loads `algo_src/strategy_config.py` from that commit history!
   - **Fallback**: Fallback to active configuration with a warning.
3. **Regenerates the backtest files** (`backtest_audit_[version].json` and `backtest_replay_[version].json`) by patching the strategy parameters in-memory and running the backtest modules on real historical prices.

---

## Usage

Save the raw JSON payload downloaded from the database (e.g. to `public/tmp.json`), and run the script from the **project root directory**:

```bash
python3 restore_algo_src/restore_tool.py --payload <path_to_payload> --version <version_code>
```

### Options

* **`--payload`**: Path to the database payload JSON file. Defaults to `public/tmp.json`.
* **`--version`**: (Required) The target algorithm version code (e.g. `v1.2.0-19aa7e71`).
* **`--output`**: Path where the restored data feed JSON will be written. Defaults to `public/data_[version].json`.

### Example

To restore the real production data and regenerate backtest logs for version `v1.2.0-19aa7e71` using the payload saved at `public/tmp.json`:

```bash
python3 restore_algo_src/restore_tool.py --payload public/tmp.json --version v1.2.0-19aa7e71
```
