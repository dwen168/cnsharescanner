import json
import os
import time
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv()

# =========================================================
# 清除沙盒环境中可能阻断外网的局部代理环境变量，确保直连拉取真实数据
# =========================================================
for key in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY"]:
    if key in os.environ:
        os.environ.pop(key)

# =========================================================
# 手动控制阀门：如果设为 True，强制禁止交易信号下发
# =========================================================
MANUAL_HALT_SIGNALS = False

# Import modular components
from waneye_scraper import fetch_waneye_data, analyze_waneye_sentiment, match_text_to_sectors
from macro_fetcher import fetch_macro_indicators, fetch_ticker, fetch_ticker_news_sentiment
from stock_analyzer import analyze_stock
from sector_analyzer import calc_sector_stats, build_sector_trends
from threat_assessor import assess_threats
from mock_generator import generate_mock_data
from db_writer import write_to_db, write_daily_prices_to_db
from signal_audit_backtest import run_audit_backtest
from strategy_replay_backtest import run_replay_backtest
from strategy_config import ALGO_VERSION, STRATEGY_CONFIG, SECTORS, ALL_SYMBOLS

def main():
    print("=" * 55)
    print("  ASX 龙头股短线专家引擎 — 开始分析 (模块重构版)")
    print("=" * 55)

    warnings_list = []
    use_mock = False
    stock_dfs = {}

    # 1. 抓取 Waneye 全球宏观与舆情数据 (做为行业舆情指标支撑)
    print("\n[1/7] 正在抓取 Waneye.com 全球金融情绪与头条...")
    waneye_data = fetch_waneye_data()
    waneye_sector_sent = {}
    if waneye_data and waneye_data["headlines"]:
        waneye_sector_sent = analyze_waneye_sentiment(waneye_data["headlines"])
    else:
        warnings_list.append("无法连接到 Waneye.com 获取实时全球舆情，已使用备用本地策略")
        waneye_data = {
            "score": 50,
            "sentiment": "Neutral",
            "highlights": [],
            "headlines": [],
            "risks": [],
            "opportunities": [],
            "defensive": []
        }

    # 2. 拉取宏观数据面
    print("\n[2/7] 正在拉取宏观利率与大宗汇率环境指标...")
    macro_data = fetch_macro_indicators()
    print(f"  ✓ 宏观监测结果: {macro_data['summary']}")

    # 3. 下载大盘指数基准
    print("\n[3/7] 正在拉取大盘基准 (sh000300)...")
    index_df = fetch_ticker("sh000300", period="3mo")
    if index_df is None or index_df.empty:
        print("  ⚠️ 无法获取 sh000300，尝试拉取 sh000001...")
        warnings_list.append("大盘基准 sh000300 抓取失败，降级至 sh000001 基准")
        index_df = fetch_ticker("sh000001", period="3mo")
        
    if index_df is not None and not index_df.empty and len(index_df) >= STRATEGY_CONFIG['stock_analyzer']['min_data_len_initial']:
        print(f"  ✓ 大盘基准下载成功 (数据天数: {len(index_df)})")
    else:
        print("  ⚠️ 无法获取足够的大盘基准数据，将继续使用降级数据运行")
        warnings_list.append("大盘数据不足，部分大盘相对指标将被略过")

    # 3. Assess global threats and check risk/control states
    threat_info = assess_threats(waneye_data, manual_halt=MANUAL_HALT_SIGNALS)
    trading_state = threat_info["trading_state"]
    warnings_list.extend(threat_info["warnings"])
    sector_risk_penalties = threat_info["modifiers"]["penalties"]
    sector_opportunity_boosts = threat_info["modifiers"]["opportunity_boosts"]
    sector_defensive_boosts = threat_info["modifiers"]["defensive_boosts"]
    sector_matched_risks = threat_info["details"]["risks"]
    sector_matched_opportunities = threat_info["details"]["opportunities"]
    sector_matched_defensive = threat_info["details"]["defensive"]
    
    halt_signals = False

    # 4. 如果不需要 mock，则拉取真实新闻与个股数据
    if not use_mock:
        print("\n[4/7] 正在抓取个股突发消息与财经舆情...")
        sentiment_data = {}
        for i, symbol in enumerate(ALL_SYMBOLS):
            if i > 0 and i % 10 == 0:
                time.sleep(2)  # 速率限制：每 10 只股票暂停 2 秒，避免被 yfinance 封禁
            sentiment_data[symbol] = fetch_ticker_news_sentiment(symbol)

        print(f"\n[5/7] 正在拉取股票历史数据并分析 {len(ALL_SYMBOLS)} 只龙头股...")
        all_results = []
        stock_dfs = {}
        failed_count = 0
        
        for i, symbol in enumerate(ALL_SYMBOLS):
            if i > 0 and i % 10 == 0:
                time.sleep(2)  # 速率限制
            df = fetch_ticker(symbol, period="3mo")
            if df is not None and not df.empty and len(df) >= STRATEGY_CONFIG['stock_analyzer']['min_data_len_initial']:
                stock_dfs[symbol] = df
                r = analyze_stock(symbol, df, index_df, sentiment_data, waneye_sector_sent, trading_state=trading_state)
                if r:
                    all_results.append(r)
                else:
                    failed_count += 1
            else:
                failed_count += 1

        if index_df is not None and not index_df.empty:
            stock_dfs["sh000300"] = index_df

        if failed_count > 0:
            warnings_list.append(f"个股拉取出现部分缺失，失败数: {failed_count}/{len(ALL_SYMBOLS)}，系统在降级数据源下运行")
            
        if len(all_results) < 5:
            if not waneye_data.get("headlines") or (macro_data.get("yield_trend") == 0.0 and macro_data.get("aud_trend") == 0.0):
                print("  ⚠️ 有效拉取个股数量过少且外围基础数据缺失，切换为 Mock 降级模式以确保 UI 完整性")
                warnings_list.append("核心真实数据全面获取失败，已自动转为仿真数据运行")
                use_mock = True
            else:
                print("  ⚠️ 有效拉取个股数量过少，但将保留外围真实数据继续运行 (重度降级模式)")
                warnings_list.append("个股数据拉取极少，但保留真实宏观/情绪数据运行")

    # 5. 决定数据血缘 Data Lineage (分离风控状态)
    if use_mock:
        data_lineage = "mock"
        sector_results, all_results, trends, mock_macro, mock_waneye = generate_mock_data(warnings_list, trading_state=trading_state)
        # 仅当真实数据缺失时，才用 Mock 数据覆盖
        if not waneye_data.get("headlines"):
            waneye_data = mock_waneye
        if macro_data.get("yield_trend") == 0.0 and macro_data.get("aud_trend") == 0.0:
            macro_data = mock_macro
    else:
        if failed_count > 0:
            data_lineage = "degraded"
        else:
            data_lineage = "real"

        # 板块聚合
        print("\n[6/7] 正在聚合板块热力数据 (引入宏观与 Waneye 舆情分)...")
        sector_results = []
        for sector_name, symbols in SECTORS.items():
            penalty = sector_risk_penalties.get(sector_name, 0)
            opt_boost = sector_opportunity_boosts.get(sector_name, 0)
            def_boost = sector_defensive_boosts.get(sector_name, 0)
            s = calc_sector_stats(
                sector_name, symbols, all_results, macro_data, waneye_sector_sent, trading_state=trading_state,
                risk_penalty=penalty, opportunity_boost=opt_boost, defensive_boost=def_boost,
                matched_risks=sector_matched_risks.get(sector_name, []),
                matched_opportunities=sector_matched_opportunities.get(sector_name, []),
                matched_defensive=sector_matched_defensive.get(sector_name, [])
            )
            if s:
                sector_results.append(s)

        # 计算 30 天历史趋势走势
        print("\n[7/7] 正在计算 30 天历史趋势走势...")
        trends, aligned_dates = build_sector_trends(index_df, stock_dfs)

        # Inject heat_score into all_results for database and API consistency
        sector_heat_map = {s["name"]: s["heat_score"] for s in sector_results}
        symbol_to_sector = {}
        for sec_name, syms in SECTORS.items():
            for sym in syms:
                symbol_to_sector[sym] = sec_name
        for stock in all_results:
            sec = symbol_to_sector.get(stock["symbol"], "Unknown")
            stock["heat_score"] = sector_heat_map.get(sec, 50)

    # 排序
    # 先按板块类型排序 (industry 在前，theme 在后)，再按热度评分降序排列
    sector_results.sort(key=lambda x: (0 if x.get("type", "industry") == "industry" else 1, -x["heat_score"]))
    zone_order = {"momentum": 0, "accumulation": 1, "watch": 2, "neutral": 3}
    all_results.sort(key=lambda x: (zone_order.get(x["zone"], 9), -x["vol_ratio"]))

    # 输出 JSON
    print("\n正在输出数据文件...")
    output = {
        "algo_version":  ALGO_VERSION,
        "strategy_config": STRATEGY_CONFIG,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_lineage": data_lineage,
        "trading_state": trading_state,
        "risk_level":    trading_state,
        "warnings":     warnings_list,
        "halt_signals": halt_signals,
        "waneye":       waneye_data,
        "macro":        macro_data,
        "sectors":      sector_results,
        "stocks":       all_results,
        "trends":       trends,
        "radar": {
            "momentum":    [s for s in all_results if s["zone"] == "momentum"],
            "accumulation": [s for s in all_results if s["zone"] == "accumulation"],
        },
        "bear_radar": {
            "distribution":      [s for s in all_results if s.get("bear_zone") == "distribution"],
            "distribution_lite": [s for s in all_results if s.get("bear_zone") == "distribution_lite"],
        }
    }

    os.makedirs("public", exist_ok=True)
    with open("public/data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    with open(f"public/data_{ALGO_VERSION}.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # 8. 同步写入 PostgreSQL 数据库
    latest_trading_date = aligned_dates[-1] if ('aligned_dates' in locals() and aligned_dates) else None
    
    if not use_mock:
        write_to_db(output, ALGO_VERSION, run_date=latest_trading_date)

    if not use_mock and stock_dfs:
        write_daily_prices_to_db(stock_dfs)

    # 9. 执行回测与重放计算 (仅在真实数据模式下执行)
    if not use_mock:
        run_audit_backtest(ALGO_VERSION)
        run_replay_backtest(ALGO_VERSION)

    print(f"\n✅ 分析完成！数据已写入 public/data.json")
    print(f"   数据血缘: {data_lineage.upper()}")
    print(f"   风控状态: {trading_state.upper()}")
    print(f"   警告信息: {len(warnings_list)} 条")
    print(f"   交易信号阀门下发: {'拦截中 (HALTED)' if halt_signals else '正常下发 (ACTIVE)'}")
    print(f"   主升浪个股: {len(output['radar']['momentum'])}")
    print(f"   潜伏区个股: {len(output['radar']['accumulation'])}")
    print(f"   主跌浪个股: {len(output['bear_radar']['distribution'])}")
    print(f"   疑似出货个股: {len(output['bear_radar']['distribution_lite'])}")
    print("=" * 55)

if __name__ == "__main__":
    main()
