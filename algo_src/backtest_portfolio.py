import pandas as pd
import numpy as np

def run_portfolio_backtest(signals_df, close_pivot, open_pivot, periods, double_cost, top_n=5):
    """Simulates a Portfolio of Top-N signals on each date, equal-weighting allocation."""
    def is_trigger_signal(sig):
        if not sig:
            return False
        base_triggers = ['主升浪 ▶', '主升浪(超买) ▶', 'V型反转 ⚡', '潜伏区 ◉', '消息共振 ◉', '主升浪 (轻仓)', '潜伏区 (轻仓)']
        return any(base in sig for base in base_triggers)

    if signals_df.empty or 'signal' not in signals_df.columns:
        return {}, {}, []

    active_signals = signals_df[signals_df['signal'].apply(is_trigger_signal)].copy()
    if active_signals.empty:
        return {}, {}, []

    if 'heat_score' not in active_signals.columns:
        active_signals['heat_score'] = 50.0
    if 'vol_ratio' not in active_signals.columns:
        active_signals['vol_ratio'] = 1.0
    if 'rs_ratio_5d' not in active_signals.columns:
        active_signals['rs_ratio_5d'] = 1.0

    active_signals['composite_score'] = (
        (active_signals['heat_score'] / 100.0)
        + (active_signals['vol_ratio'] / 3.0)
        + (active_signals['rs_ratio_5d'] / 1.5)
    )

    portfolio_selections = {}
    portfolio_selections_df = {}
    grouped = active_signals.groupby('date')
    for date, group in grouped:
        top_group = group.sort_values(by='composite_score', ascending=False).head(top_n)
        portfolio_selections[date] = top_group['symbol'].tolist()
        portfolio_selections_df[date] = top_group

    portfolio_stats = {}
    portfolio_curves = {}

    signal_dates = sorted(portfolio_selections.keys())
    if not signal_dates:
        return {}, {}, []

    for period_str in ['1d', '3d', '5d', '10d']:
        n_days = int(period_str[:-1])
        date_returns_theoretical = []
        date_returns_executable = []
        date_bench_returns = []
        date_bench_returns_exec = []
        valid_dates = []

        for d in signal_dates:
            symbols = portfolio_selections[d]
            rets_theo = []
            rets_exec = []
            
            for sym in symbols:
                if d in close_pivot.index and sym in close_pivot.columns:
                    close_t = close_pivot.loc[d, sym]
                    try:
                        loc = close_pivot.index.get_loc(d)
                        if loc + n_days < len(close_pivot):
                            close_tn = close_pivot.iloc[loc + n_days][sym]
                            open_t1 = open_pivot.iloc[loc + 1][sym] if loc + 1 < len(close_pivot) else close_pivot.iloc[loc + 1][sym]
                            
                            if pd.notna(close_t) and pd.notna(close_tn) and close_t > 0:
                                rets_theo.append((close_tn - close_t) / close_t * 100)
                            if pd.notna(open_t1) and pd.notna(close_tn) and open_t1 > 0:
                                rets_exec.append((close_tn - open_t1) / open_t1 * 100)
                    except Exception:
                        pass
            
            if rets_theo and rets_exec:
                avg_theo = np.mean(rets_theo)
                avg_exec = np.mean(rets_exec)
                
                bench_rets = []
                bench_rets_exec = []
                for sym in symbols:
                    match = active_signals[(active_signals['date'] == d) & (active_signals['symbol'] == sym)]
                    if not match.empty:
                        if 'bench_ret_' + period_str in match.columns:
                            bench_val = match['bench_ret_' + period_str].values[0]
                            if pd.notna(bench_val):
                                bench_rets.append(bench_val)
                        if 'bench_ret_' + period_str + '_executable' in match.columns:
                            bench_val_exec = match['bench_ret_' + period_str + '_executable'].values[0]
                            if pd.notna(bench_val_exec):
                                bench_rets_exec.append(bench_val_exec)
                            
                avg_bench = np.mean(bench_rets) if bench_rets else 0.0
                avg_bench_exec = np.mean(bench_rets_exec) if bench_rets_exec else 0.0
                date_returns_theoretical.append(avg_theo)
                date_returns_executable.append(avg_exec)
                date_bench_returns.append(avg_bench)
                date_bench_returns_exec.append(avg_bench_exec)
                valid_dates.append(d)

        sample_size = len(valid_dates)
        if sample_size > 0:
            net_theo_rets = np.array(date_returns_theoretical) - double_cost
            win_rate_theo = (sum(net_theo_rets > 0) / sample_size) * 100
            avg_ret_theo = np.mean(net_theo_rets)
            avg_alpha_theo = np.mean(net_theo_rets - np.array(date_bench_returns))

            net_exec_rets = np.array(date_returns_executable) - double_cost
            win_rate_exec = (sum(net_exec_rets > 0) / sample_size) * 100
            avg_ret_exec = np.mean(net_exec_rets)
            avg_alpha_exec = np.mean(net_exec_rets - np.array(date_bench_returns_exec))

            eq_theo = 100.0
            eq_exec = 100.0
            eq_bench = 100.0
            curve_points = []
            
            drawdowns_theo = []
            drawdowns_exec = []
            max_eq_theo = 100.0
            max_eq_exec = 100.0

            first_date = valid_dates[0] - pd.Timedelta(days=1)
            curve_points.append({
                "date": first_date.strftime("%Y-%m-%d"),
                "equity_theoretical": round(eq_theo, 2),
                "equity_executable": round(eq_exec, 2),
                "equity_benchmark": round(eq_bench, 2)
            })

            for idx, d_val in enumerate(valid_dates):
                eq_theo *= (1 + net_theo_rets[idx] / 100.0)
                eq_exec *= (1 + net_exec_rets[idx] / 100.0)
                eq_bench *= (1 + date_bench_returns[idx] / 100.0)
                
                max_eq_theo = max(max_eq_theo, eq_theo)
                max_eq_exec = max(max_eq_exec, eq_exec)
                
                dd_theo = (eq_theo - max_eq_theo) / max_eq_theo * 100.0
                dd_exec = (eq_exec - max_eq_exec) / max_eq_exec * 100.0
                
                drawdowns_theo.append(dd_theo)
                drawdowns_exec.append(dd_exec)
                
                curve_points.append({
                    "date": d_val.strftime("%Y-%m-%d"),
                    "equity_theoretical": round(eq_theo, 2),
                    "equity_executable": round(eq_exec, 2),
                    "equity_benchmark": round(eq_bench, 2)
                })

            max_dd_theo = min(drawdowns_theo) if drawdowns_theo else 0.0
            max_dd_exec = min(drawdowns_exec) if drawdowns_exec else 0.0

            portfolio_stats[period_str] = {
                "win_rate": round(float(win_rate_theo), 2),
                "win_rate_executable": round(float(win_rate_exec), 2),
                
                "avg_return": round(float(avg_ret_theo), 2),
                "avg_return_gross": round(float(np.mean(date_returns_theoretical)), 2),
                "avg_return_net": round(float(avg_ret_theo), 2),
                
                "avg_return_executable": round(float(avg_ret_exec), 2),
                "avg_return_executable_gross": round(float(np.mean(date_returns_executable)), 2),
                "avg_return_executable_net": round(float(avg_ret_exec), 2),
                
                "avg_benchmark_return": round(float(np.mean(date_bench_returns)), 2),
                
                "avg_alpha": round(float(avg_alpha_theo), 2),
                "avg_alpha_gross": round(float(np.mean(date_returns_theoretical - np.array(date_bench_returns))), 2),
                "avg_alpha_net": round(float(avg_alpha_theo), 2),
                
                "avg_alpha_executable": round(float(avg_alpha_exec), 2),
                "avg_alpha_executable_gross": round(float(np.mean(date_returns_executable - np.array(date_bench_returns))), 2),
                "avg_alpha_executable_net": round(float(avg_alpha_exec), 2),
                
                "max_drawdown": round(float(max_dd_theo), 2),
                "max_drawdown_executable": round(float(max_dd_exec), 2),
                
                "sample_size": sample_size
            }
            portfolio_curves[period_str] = curve_points
        else:
            portfolio_stats[period_str] = {
                "win_rate": 0.0, "win_rate_executable": 0.0,
                "avg_return": 0.0, "avg_return_executable": 0.0,
                "avg_benchmark_return": 0.0,
                "avg_alpha": 0.0, "avg_alpha_executable": 0.0,
                "max_drawdown": 0.0, "max_drawdown_executable": 0.0,
                "sample_size": 0
            }
            portfolio_curves[period_str] = []

    # Compile portfolio selections logs for frontend transaction logs visualization
    portfolio_logs = []
    for d in sorted(portfolio_selections_df.keys(), reverse=True):
        date_str = d.strftime("%Y-%m-%d")
        top_df = portfolio_selections_df[d]
        selections_list = []
        for _, row in top_df.iterrows():
            sym = row['symbol']
            selections_list.append({
                "symbol": sym,
                "signal": row['signal'],
                "composite_score": round(float(row['composite_score']), 2),
                "price": float(row['price']) if pd.notna(row['price']) else 0.0,
                "ret_1d": None if pd.isna(row.get('ret_1d')) else round(float(row['ret_1d']), 2),
                "ret_1d_executable": None if pd.isna(row.get('ret_1d_executable')) else round(float(row['ret_1d_executable']), 2),
                "ret_3d": None if pd.isna(row.get('ret_3d')) else round(float(row['ret_3d']), 2),
                "ret_3d_executable": None if pd.isna(row.get('ret_3d_executable')) else round(float(row['ret_3d_executable']), 2),
                "ret_5d": None if pd.isna(row.get('ret_5d')) else round(float(row['ret_5d']), 2),
                "ret_5d_executable": None if pd.isna(row.get('ret_5d_executable')) else round(float(row['ret_5d_executable']), 2),
                "ret_10d": None if pd.isna(row.get('ret_10d')) else round(float(row['ret_10d']), 2),
                "ret_10d_executable": None if pd.isna(row.get('ret_10d_executable')) else round(float(row['ret_10d_executable']), 2),
            })
        portfolio_logs.append({
            "date": date_str,
            "selections": selections_list
        })

    return portfolio_stats, portfolio_curves, portfolio_logs
