from strategy_config import STRATEGY_CONFIG, SECTORS, SECTOR_META

def calc_sector_stats(sector_name, symbols, all_results, macro_data=None, waneye_sector_sent=None, trading_state="active", risk_penalty=0, opportunity_boost=0, defensive_boost=0, matched_risks=None, matched_opportunities=None, matched_defensive=None):
    """计算板块整体指标"""
    stocks_in_sector = [r for r in all_results if r["symbol"] in symbols]

    if not stocks_in_sector:
        return None

    up_count   = sum(1 for s in stocks_in_sector if s["chg_pct"] > 0)
    down_count = len(stocks_in_sector) - up_count
    
    # 板块总成交额加权
    total_turnover = sum(s["turnover"] for s in stocks_in_sector)
    
    if total_turnover > 0:
        avg_chg   = sum(s["chg_pct"] * (s["turnover"] / total_turnover) for s in stocks_in_sector)
        avg_vol_r = sum(s["vol_ratio"] * (s["turnover"] / total_turnover) for s in stocks_in_sector)
        avg_rs    = sum(s["rs_ratio_5d"] * (s["turnover"] / total_turnover) for s in stocks_in_sector)
    else:
        avg_chg   = sum(s["chg_pct"] for s in stocks_in_sector) / len(stocks_in_sector)
        avg_vol_r = sum(s["vol_ratio"] for s in stocks_in_sector) / len(stocks_in_sector)
        avg_rs    = sum(s["rs_ratio_5d"] for s in stocks_in_sector) / len(stocks_in_sector)
 
    # 1.3 动态数据新鲜度调权融合算法
    sector_sent = 0.0
    if waneye_sector_sent and sector_name in waneye_sector_sent:
        sector_sent = waneye_sector_sent[sector_name]
        
    news_stocks = [s for s in stocks_in_sector if s.get("sentiment_source") == "news" and s.get("sentiment_value") is not None]
    if news_stocks:
        total_news_turnover = sum(s["turnover"] for s in news_stocks)
        if total_news_turnover > 0:
            stock_sent = sum(s["sentiment_value"] * (s["turnover"] / total_news_turnover) for s in news_stocks)
            w1 = sum((s.get("news_freshness") or 0.0) * (s["turnover"] / total_news_turnover) for s in news_stocks)
        else:
            stock_sent = sum(s["sentiment_value"] for s in news_stocks) / len(news_stocks)
            w1 = sum(s.get("news_freshness") or 0.0 for s in news_stocks) / len(news_stocks)
            
        w_stock = 0.6 * w1
        w_sector = 0.4 + 0.6 * (1.0 - w1)
        avg_sent = w_stock * stock_sent + w_sector * sector_sent
    else:
        avg_sent = sector_sent
 
    momentum_count = sum(1 for s in stocks_in_sector if s["zone"] == "momentum")
    accum_count    = sum(1 for s in stocks_in_sector if s["zone"] == "accumulation")
    
    total_stocks = len(stocks_in_sector)
    momentum_ratio = momentum_count / total_stocks if total_stocks > 0 else 0.0
    accum_ratio    = accum_count / total_stocks if total_stocks > 0 else 0.0
 
    cfg = STRATEGY_CONFIG["stock_analyzer"]
    # ---- 宏观敏感乘数调节 (Macro Multiplier) ----
    macro_bonus = 0.0
    if macro_data:
        y_trend = macro_data.get("yield_trend", 0.0)
        aud_trend = macro_data.get("aud_trend", 0.0)
        
        if "Tech" in sector_name or "Semiconductors" in sector_name:
            macro_bonus += y_trend * cfg["macro_bonus_tech_grow_multiplier"]
        elif "Banking" in sector_name or "Brokerage" in sector_name:
            macro_bonus += y_trend * cfg["macro_bonus_banking_multiplier"]
        elif "Mining" in sector_name or "Lithium" in sector_name or "Energy" in sector_name:
            macro_bonus += aud_trend * cfg["macro_bonus_resource_multiplier"]
        elif "Healthcare" in sector_name:
            macro_bonus += y_trend * cfg["macro_bonus_healthcare_multiplier"]
        elif "Consumer" in sector_name:
            macro_bonus += y_trend * cfg["macro_bonus_consumer_multiplier"]  # 消费受利率上升压制需求

    # 新闻舆情分调节
    sent_bonus = avg_sent * cfg["sent_bonus_multiplier"]

    # 板块整体热度评分 (0-100) — 融入Waneye风险惩罚、战术机会调节
    # 限制基础技术面总得分上限为 70 点，保留 30 点空间给宏观、舆情及事件修正，防止强行情截断
    base_tech_score = avg_chg * 6 + avg_vol_r * 15 + (momentum_ratio * 80) + (accum_ratio * 50)
    rs_bonus = (avg_rs - 1.0) * 30
    base_and_rs_capped = min(cfg["base_tech_rs_cap"], max(0.0, base_tech_score + rs_bonus))
    
    # 4.1 防御建议 defensive_boost 不加入 heat_score 算法
    heat_score = min(100, max(0, int(base_and_rs_capped + macro_bonus + sent_bonus - risk_penalty + opportunity_boost)))

    # 板块信号判定
    # 判定基础状态
    is_outflow = avg_chg < 0 and (avg_rs < 0.97 or avg_chg < -1.5) and (avg_chg < -0.5 or avg_sent < -0.2)
    is_hot = momentum_count >= 2 or (avg_chg > 2 and avg_vol_r > 1.2)
    is_warming = (accum_count >= 1 and avg_rs > 1.01) or (avg_vol_r > 1.1 and avg_rs > 1.03)
    
    if is_outflow:
        sector_signal = "🚨 资金流出"
        sector_zone   = "outflow"
    elif is_hot:
        if avg_sent < -0.25:
            sector_signal = "📡 资金潜入(舆情降级)"
            sector_zone   = "warming"
        else:
            sector_signal = "🔥 热点爆发"
            sector_zone   = "hot"
    elif is_warming:
        if avg_sent < -0.25:
            sector_signal = "📈 温和上涨(舆情降级)"
            sector_zone   = "mild"
        else:
            sector_signal = "📡 资金潜入"
            sector_zone   = "warming"
    elif avg_chg > 0 and avg_rs >= 0.97:
        sector_signal = "📈 温和上涨"
        sector_zone   = "mild"
    elif avg_chg > 0:
        sector_signal = "🔶 跑输大盘"
        sector_zone   = "lagging"
    else:
        sector_signal = "❄️ 冷淡"
        sector_zone   = "cold"

    heat_breakdown = {
        "tech_score": round(float(base_tech_score), 1),
        "rs_bonus": round(float(rs_bonus), 1),
        "macro_bonus": round(float(macro_bonus), 1),
        "sent_bonus": round(float(sent_bonus), 1),
        "risk_penalty": round(float(risk_penalty), 1),
        "opportunity_boost": round(float(opportunity_boost), 1),
    }

    return {
        "name":          sector_name,
        "type":          SECTOR_META.get(sector_name, {}).get("type", "industry"),
        "up_count":      up_count,
        "down_count":    down_count,
        "avg_chg":       round(avg_chg, 2),
        "avg_vol_ratio": round(avg_vol_r, 2),
        "avg_rs_5d":     round(avg_rs, 3),
        "avg_sentiment": round(avg_sent, 2),
        "heat_score":    heat_score,
        "heat_breakdown": heat_breakdown,
        "signal":        sector_signal,
        "zone":          sector_zone,
        "stocks":        stocks_in_sector,
        "matched_risks": matched_risks or [],
        "matched_opportunities": matched_opportunities or [],
        "matched_defensive": matched_defensive or [],
    }

def calculate_trends(dates, sector_histories, benchmark_history):
    """计算归一化的历史趋势数据 (以第一天为 100)"""
    trends = {
        "dates": dates,
        "series": []
    }
    
    if len(benchmark_history) > 0:
        base_val = benchmark_history[0]
        bench_data = [round((val / base_val) * 100.0, 2) for val in benchmark_history]
        trends["series"].append({
            "name": "ASX All Ordinaries",
            "data": bench_data,
            "is_benchmark": True
        })
        
    for name, history in sector_histories.items():
        if len(history) > 0:
            base_val = history[0]
            sec_data = [round((val / base_val) * 100.0, 2) for val in history]
            trends["series"].append({
                "name": name,
                "data": sec_data,
                "is_benchmark": False
            })
            
    return trends

def build_sector_trends(index_df, stock_dfs):
    """根据大盘基准与个股历史数据，计算30天加权归一化板块趋势数据"""
    index_df = index_df.sort_index()
    aligned_dates_dt = index_df.index[-30:]
    aligned_dates = [d.strftime("%Y-%m-%d") for d in aligned_dates_dt]
    benchmark_history = index_df.loc[aligned_dates_dt, "Close"].tolist()
    
    sector_histories = {}
    for sector_name, symbols in SECTORS.items():
        constituent_dfs = {sym: stock_dfs[sym] for sym in symbols if sym in stock_dfs}
        if not constituent_dfs:
            continue
            
        stock_avg_turnovers = {}
        for sym, df in constituent_dfs.items():
            turnovers = []
            for date_dt in aligned_dates_dt:
                if date_dt in df.index:
                    turnovers.append(df.loc[date_dt, "Close"] * df.loc[date_dt, "Volume"])
            if turnovers:
                stock_avg_turnovers[sym] = sum(turnovers) / len(turnovers)
        
        total_avg_turnover = sum(stock_avg_turnovers.values())
        stock_weights = {}
        if total_avg_turnover > 0:
            for sym, avg_to in stock_avg_turnovers.items():
                stock_weights[sym] = avg_to / total_avg_turnover
        else:
            for sym in stock_avg_turnovers:
                stock_weights[sym] = 1.0 / len(stock_avg_turnovers)
        
        stock_base_prices = {}
        for sym, df in constituent_dfs.items():
            for date_dt in aligned_dates_dt:
                if date_dt in df.index:
                    stock_base_prices[sym] = df.loc[date_dt, "Close"]
                    break
        
        sector_history_vals = []
        last_normalized = {sym: 100.0 for sym in constituent_dfs}
        for date_dt in aligned_dates_dt:
            day_weighted_val = 0.0
            for sym, df in constituent_dfs.items():
                weight = stock_weights.get(sym, 0.0)
                base_price = stock_base_prices.get(sym, 1.0)
                if date_dt in df.index and base_price > 0:
                    norm_val = (df.loc[date_dt, "Close"] / base_price) * 100.0
                    last_normalized[sym] = norm_val
                day_weighted_val += last_normalized[sym] * weight
            sector_history_vals.append(day_weighted_val)
        
        sector_histories[sector_name] = sector_history_vals
        
    return calculate_trends(aligned_dates, sector_histories, benchmark_history), aligned_dates
