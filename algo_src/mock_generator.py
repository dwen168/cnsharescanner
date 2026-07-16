import random
from datetime import datetime, timedelta
from strategy_config import SECTORS, SECTOR_META
from stock_analyzer import generate_ai_insight
from waneye_scraper import match_text_to_sectors

def generate_mock_data(warnings_list, trading_state="active"):
    """网络请求失败时的保底模拟数据生成器"""
    print("  ⚠️ 触发保底模拟数据生成器 (Mock Mode)...")
    
    macro_data = {
        "yield_trend": -0.18, 
        "aud_trend": 1.45,    
        "summary": "澳洲10年期国债收益率微降，同时澳元表现强势，利好大宗商品及估值端科技成长板块。"
    }

    # Mock Headlines from Waneye
    mock_waneye = {
        "score": 45,
        "sentiment": "Negative",
        "highlights": [
            "Fed holds rates steady under new Chair Warsh, but hawkish signals roil markets.",
            "Oil prices tumble 4% to three-month lows on hopes of Hormuz reopening.",
            "SpaceX shares fall for first time since debut; retail frenzy continues."
        ],
        "headlines": [
            {"title": "ASML CEO Sees Musk’s Terafab as Test for Supply Lines", "url": "#"},
            {"title": "JP Morgan extends DCM dominance; Goldman and Morgan Stanley climb rankings", "url": "#"},
            {"title": "Interest rates expected to be held by Bank of England", "url": "#"},
            {"title": "Fmr. Fed Vice Chair Blinder on FOMC Decision, Inflation", "url": "#"},
            {"title": "Hyperscaler’s Multiyear Commitment with Western Digital (WDC) Highlights Robust Demand", "url": "#"}
        ],
        "risks": [
            {
                "title": "Hawkish Fed Policy Error",
                "impact": "High",
                "likelihood": "Medium",
                "mitigation": "Diversify into short-duration bonds, defensive sectors (utilities, healthcare), and cash."
            },
            {
                "title": "Oil Supply Disruption / Geopolitical Escalation",
                "impact": "High",
                "likelihood": "Medium",
                "mitigation": "Hedge with energy sector exposure and commodities."
            }
        ],
        "opportunities": [
            {
                "title": "Buy Micron Technology (MU) on AI memory demand",
                "timeframe": "medium-term",
                "description": "Explosive demand for high-bandwidth memory driven by AI infrastructure buildout. MU"
            }
        ],
        "defensive": [
            {
                "title": "Increase cash allocation and short-duration Treasuries",
                "timeframe": "short-term",
                "description": "Hawkish Fed and potential rate hike by October warrant caution. SHY BIL"
            }
        ]
    }

    # Pre-calculate mock risk/opportunity/defensive mapping
    sector_risk_penalties = {s: 0 for s in SECTORS}
    sector_opportunity_boosts = {s: 0 for s in SECTORS}
    sector_defensive_boosts = {s: 0 for s in SECTORS}
    
    sector_matched_risks = {s: [] for s in SECTORS}
    sector_matched_opportunities = {s: [] for s in SECTORS}
    sector_matched_defensive = {s: [] for s in SECTORS}
    
    for r in mock_waneye.get("risks", []):
        impact = r.get("impact", "").strip().lower()
        title = r.get("title", "")
        mitigation = r.get("mitigation", "")
        
        # Simulating keyword match check with high/low confidence
        matched_sec = []
        matched_sec.extend(match_text_to_sectors(title))
        matched_sec.extend(match_text_to_sectors(mitigation))
        for s in SECTORS:
            s_clean = s.lower()
            if any(part in title.lower() or part in mitigation.lower() for part in s_clean.replace('/', ' ').split()):
                if not any(x["sector"] == s for x in matched_sec):
                    matched_sec.append({"sector": s, "confidence": "high"})
        
        sec_dict = {}
        for x in matched_sec:
            sec = x["sector"]
            conf = x["confidence"]
            if sec not in sec_dict or (sec_dict[sec] == "low" and conf == "high"):
                sec_dict[sec] = conf
        
        penalty = 15 if impact == "high" else (8 if impact == "medium" else 3)
        for s, conf in sec_dict.items():
            if conf == "high":
                sector_risk_penalties[s] += penalty
            
            r_with_conf = r.copy()
            r_with_conf["match_confidence"] = conf
            sector_matched_risks[s].append(r_with_conf)
            
    for o in mock_waneye.get("opportunities", []):
        title = o.get("title", "")
        desc = o.get("description", "")
        matched_sec = []
        matched_sec.extend(match_text_to_sectors(title))
        matched_sec.extend(match_text_to_sectors(desc))
        for s in SECTORS:
            s_clean = s.lower()
            if any(part in title.lower() or part in desc.lower() for part in s_clean.replace('/', ' ').split()):
                if not any(x["sector"] == s for x in matched_sec):
                    matched_sec.append({"sector": s, "confidence": "high"})
        
        sec_dict = {}
        for x in matched_sec:
            sec = x["sector"]
            conf = x["confidence"]
            if sec not in sec_dict or (sec_dict[sec] == "low" and conf == "high"):
                sec_dict[sec] = conf
        
        for s, conf in sec_dict.items():
            if conf == "high":
                sector_opportunity_boosts[s] += 10
            
            o_with_conf = o.copy()
            o_with_conf["match_confidence"] = conf
            sector_matched_opportunities[s].append(o_with_conf)
            
    for d in mock_waneye.get("defensive", []):
        title = d.get("title", "")
        desc = d.get("description", "")
        matched_sec = []
        matched_sec.extend(match_text_to_sectors(title))
        matched_sec.extend(match_text_to_sectors(desc))
        for s in SECTORS:
            s_clean = s.lower()
            if any(part in title.lower() or part in desc.lower() for part in s_clean.replace('/', ' ').split()):
                if not any(x["sector"] == s for x in matched_sec):
                    matched_sec.append({"sector": s, "confidence": "high"})
        
        sec_dict = {}
        for x in matched_sec:
            sec = x["sector"]
            conf = x["confidence"]
            if sec not in sec_dict or (sec_dict[sec] == "low" and conf == "high"):
                sec_dict[sec] = conf
        
        for s, conf in sec_dict.items():
            if conf == "high":
                sector_defensive_boosts[s] += 8
            
            d_with_conf = d.copy()
            d_with_conf["match_confidence"] = conf
            sector_matched_defensive[s].append(d_with_conf)

    mock_headlines = {
        "CBA": ("CBA reports record half-year profit, announces share buyback", 0.9),
        "NAB": ("NAB upgraded to buy at Macquarie on strong net interest margin", 0.6),
        "WBC": ("Westpac earnings slide as mortgage war drags margins", -0.4),
        "ANZ": ("ANZ partnership with international payment firm approved", 0.5),
        "MQG": ("Macquarie group profit slips 10%, raises dividend slightly", 0.1),
        "BHP": ("BHP copper production guidance raised on AI grid expansion", 0.8),
        "RIO": ("Rio Tinto to acquire Lithium project in Western Australia", 0.7),
        "FMG": ("Fortescue green iron pilot project achieves breakthrough", 0.9),
        "S32": ("South32 logs first-half loss on commodity price decline", -0.5),
        "MIN": ("Mineral Resources debt concerns rise, downgraded at S&P", -0.8),
        "XRO": ("Xero subscribers exceed estimate in European expansion", 0.8),
        "WTC": ("WiseTech Global logistics revenue surges on US demand", 0.8),
        "AD8": ("Audinate reports surging export demand for Dante audio systems", 0.7),
        "APX": ("Appen secures major cloud model tuning contract", 0.7),
        "PLS": ("Pilbara Minerals cash flow hit by low spodumene price", -0.5),
        "LTR": ("Liontown Resources lithium project delayed due to weather", -0.4),
        "IGO": ("IGO nickel asset writedown leads to full-year net loss", -0.8),
        "LYC": ("Lynas rare earths production recovers, faces low price headwind", -0.1),
        "CSL": ("CSL Behring plasma collection returns to pre-COVID levels", 0.5),
        "RMD": ("ResMed shares gain as sleep apnea demand stays strong", 0.4),
        "COH": ("Cochlear earnings beat estimates, upgrades full year guidance", 0.8),
        "SHL": ("Sonic Healthcare profit slips on lower clinical fees", -0.3),
        "WES": ("Wesfarmers retail sales grow 4%, Bunnings offset inflation", 0.4),
        "WOW": ("Woolworths profit margin slips as supply chain cost rises", -0.3),
        "COL": ("Coles sales rise on grocery value push, margin holds flat", 0.2),
        "JBH": ("JB Hi-Fi sales beat estimates, consumer spending stays resilient", 0.6),
        "GMG": ("Goodman Group logistics property demand hits record high", 0.9),
        "SCG": ("Scentre group mall traffic recovers, leases upgraded", 0.3),
        "SGP": ("Stockland residential sales slow down on high rates", -0.3),
        "GPT": ("GPT Group office occupancy concerns remain, slips 2%", -0.4),
        "WDS": ("Woodside energy logs higher gas output, profit beats estimate", 0.6),
        "STO": ("Santos gas project gets key environmental approval", 0.7),
        "BPT": ("Beach Energy drill results miss targets in Cooper basin", -0.5),
        "WHC": ("Whitehaven coal upgraded on thermal coal price recovery", 0.6),
        "NST": ("Northern Star resources reports record gold production at Kalgoorlie", 0.8),
        "EVN": ("Evolution Mining upgrades annual production target on gold price rally", 0.7),
        "NEM": ("Newmont shares gain as gold breaks all-time highs", 0.8),
        "BOE": ("Boss Energy completes first uranium drum shipment from Honeymoon", 0.9),
        "PDN": ("Paladin Energy ramps up production at Langer Heinrich mine", 0.7),
        "MP1": ("Megaport reports surging data center interconnection demand", 0.8),
        "ALC": ("Alcidion secures major software deployment across UK hospitals", 0.6),
        "FLT": ("Flight Centre travel bookings rebound faster than expected", 0.7),
        "QAN": ("Qantas announces international capacity boost and fleet upgrade", 0.6)
    }

    mock_sectors = []
    mock_stocks = []
    
    sector_defaults = {
        "金融银行 Banking":     ("hot", "🔥 热点爆发", 85, 1.25, 0.8),
        "矿业资源 Mining":      ("warming", "📡 资金潜入", 65, 1.15, 0.2),
        "黄金 Gold":            ("mild", "📈 温和上涨", 70, 1.10, 0.6),
        "新能源/锂矿 Lithium":  ("cold", "❄️ 冷淡", 15, 0.65, -1.8),
        "铀矿 Uranium":         ("warming", "📡 资金潜入", 62, 1.20, 0.7),
        "科技/软件 Technology":  ("mild", "📈 温和上涨", 78, 1.45, 1.5),
        "AI基建 AI Infra":      ("hot", "🔥 热点爆发", 88, 1.55, 1.8),
        "医疗健康 Healthcare":   ("lagging", "🔶 跑输大盘", 45, 0.95, 0.1),
        "消费/零售 Consumer":    ("mild", "📈 温和上涨", 58, 1.05, 0.4),
        "地产/基建 Real Estate": ("cold", "❄️ 冷淡", 30, 0.82, -0.3),
        "能源 Energy":          ("warming", "📡 资金潜入", 60, 1.30, 0.9),
        "旅游博彩 Travel":      ("watch", "多头排列", 50, 1.00, 0.3)
    }

    sector_meta = {}
    for name, stocks in SECTORS.items():
        defaults = sector_defaults.get(name, ("watch", "多头排列", 50, 1.00, 0.0))
        short_stocks = [s.replace(".AX", "") for s in stocks]
        sector_meta[name] = defaults + (short_stocks,)
    
    for name, (zone, signal, score, avg_vol, avg_chg, stocks) in sector_meta.items():
        sector_stocks = []
        for sym in stocks:
            chg = round(avg_chg + random.uniform(-1.5, 1.5), 2)
            chg_5d = round(chg * 3 + random.uniform(-2, 2), 2)
            vol_ratio = round(avg_vol + random.uniform(-0.3, 0.4), 2)
            price = round(random.uniform(5.0, 150.0), 2)
            
            headline, news_sentiment = mock_headlines.get(sym, ("No recent news catalyst found", 0.0))
            
            # Simulated indicators
            is_strong = chg_5d > 2.0
            ma_bullish = chg > -0.5
            breakout = vol_ratio > 1.25 and chg > 1.0
            volume_spike = vol_ratio > 1.2
            was_below_ma20 = chg_5d < 0
            has_bad_news = news_sentiment < -0.15
            
            s_zone = "neutral"
            s_signal = "观望"
            
            is_momentum = ma_bullish and breakout and volume_spike and is_strong
            is_accum = was_below_ma20 and volume_spike and chg > 0
            
            # 默认信号判定
            is_v_reversal = (
                chg > 3.0 and
                chg_5d < -5.0 and
                vol_ratio > 2.0
            )
            
            if is_v_reversal and not has_bad_news:
                s_signal = "V型反转 ⚡"
                s_zone = "momentum"
            elif is_momentum:
                if not has_bad_news:
                    s_signal = "主升浪 ▶"
                    s_zone = "momentum"
                else:
                    s_signal = "形态突破(利空降级)"
                    s_zone = "watch"
            elif is_accum:
                if not has_bad_news:
                    s_signal = "潜伏区 ◉"
                    s_zone = "accumulation"
                else:
                    s_signal = "底部放量(利空降级)"
                    s_zone = "watch"
            elif ma_bullish:
                if news_sentiment > 0.25:
                    s_signal = "消息共振 ◉"
                    s_zone = "accumulation"
                else:
                    s_signal = "多头排列"
                    s_zone = "watch"

            # 应用风险警告状态轻仓标记 (不熔断推荐)
            if trading_state in ("low_risk", "medium_risk", "high_risk"):
                if s_signal in ("主升浪 ▶", "主升浪(超买) ▶"):
                    s_signal = "主升浪 (轻仓)"
                elif s_signal == "潜伏区 ◉":
                    s_signal = "潜伏区 (轻仓)"

            ai_desc = generate_ai_insight(sym, chg, chg_5d, vol_ratio, s_zone, ma_bullish, breakout, 1.0 + chg_5d/100, news_sentiment, headline, trading_state)
                
            stock_data = {
                "symbol":           sym,
                "price":            price,
                "chg_pct":          chg,
                "chg_5d":           chg_5d,
                "volume":           f"{random.uniform(0.5, 8.0):.1f}M",
                "vol_ratio":        vol_ratio,
                "turnover":         price * random.uniform(50000, 5000000),
                "rs_ratio_5d":      round(1.0 + (chg_5d / 100.0), 3),
                "rs_ratio_20d":     round(1.0 + (chg_5d * 2 / 100.0), 3),
                "news_sentiment":   news_sentiment,
                "sentiment_value":  news_sentiment,
                "sentiment_source": "news" if news_sentiment != 0.0 else "fallback",
                "news_freshness":   0.9,
                "latest_headline":  headline,
                "signal":           s_signal,
                "zone":             s_zone,
                "ma_bullish":       ma_bullish,
                "breakout":         breakout,
                "ai_insight":       ai_desc
            }
            sector_stocks.append(stock_data)
            mock_stocks.append(stock_data)
            
        up_count = sum(1 for s in sector_stocks if s["chg_pct"] > 0)
        total_turnover = sum(s["turnover"] for s in sector_stocks)
        avg_sent = sum(s["news_sentiment"] * (s["turnover"] / total_turnover) for s in sector_stocks)

        macro_bonus = 0.0
        y_trend = macro_data["yield_trend"]
        aud_trend = macro_data["aud_trend"]
        
        if "Technology" in name or "Real Estate" in name or "AI Infra" in name:
            macro_bonus -= y_trend * 25
        elif "Banking" in name:
            macro_bonus += y_trend * 20
        elif "Mining" in name or "Lithium" in name or "Energy" in name or "Uranium" in name:
            macro_bonus += aud_trend * 10
        elif "Gold" in name:
            macro_bonus -= y_trend * 25
        elif "Travel" in name:
            macro_bonus += aud_trend * 5
        elif "Healthcare" in name:
            macro_bonus -= y_trend * 20
        elif "Consumer" in name:
            macro_bonus -= y_trend * 15
        sent_bonus = avg_sent * 15
        
        # Apply Waneye risk/rec modifiers
        penalty = sector_risk_penalties.get(name, 0)
        opt_boost = sector_opportunity_boosts.get(name, 0)
        # Note: defensive_boost no longer added to heat_score per task 4.1
        final_score = min(100, max(0, int(score + macro_bonus + sent_bonus - penalty + opt_boost)))

        mock_sectors.append({
            "name":                  name,
            "type":                  SECTOR_META.get(name, {}).get("type", "industry"),
            "up_count":              up_count,
            "down_count":            len(sector_stocks) - up_count,
            "avg_chg":               round(avg_chg, 2),
            "avg_vol_ratio":         round(avg_vol, 2),
            "avg_rs_5d":             round(1.0 + (avg_chg * 2 / 100), 3),
            "avg_sentiment":         round(avg_sent, 2),
            "heat_score":            final_score,
            "heat_breakdown": {
                "tech_score": round(float(score), 1),
                "rs_bonus": round(float((avg_chg * 2 / 100) * 30), 1),
                "macro_bonus": round(float(macro_bonus), 1),
                "sent_bonus": round(float(sent_bonus), 1),
                "risk_penalty": round(float(penalty), 1),
                "opportunity_boost": round(float(opt_boost), 1),
            },
            "signal":                signal,
            "zone":                  zone,
            "stocks":                sector_stocks,
            "matched_risks":         sector_matched_risks.get(name, []),
            "matched_opportunities": sector_matched_opportunities.get(name, []),
            "matched_defensive":     sector_matched_defensive.get(name, []),
        })
        
    dates = []
    today = datetime.now()
    current = today - timedelta(days=45)
    while len(dates) < 30:
        if current.weekday() < 5:
            dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
        
    trends = {
        "dates": dates,
        "series": []
    }
    
    market_vals = [100.0]
    for i in range(1, 30):
        daily_ret = random.uniform(-0.008, 0.01)
        market_vals.append(round(market_vals[-1] * (1.0 + daily_ret), 2))
    trends["series"].append({
        "name": "ASX All Ordinaries",
        "data": market_vals,
        "is_benchmark": True
    })
    
    for s_name, (zone, _, _, _, avg_chg, _) in sector_meta.items():
        s_vals = [100.0]
        bias = avg_chg / 100.0
        volatility = 0.012 if "Lithium" in s_name or "Technology" in s_name else 0.007
        
        for i in range(1, 30):
            m_ret = (market_vals[i] - market_vals[i-1]) / market_vals[i-1]
            daily_ret = m_ret + bias * 0.2 + random.uniform(-volatility, volatility)
            s_vals.append(round(s_vals[-1] * (1.0 + daily_ret), 2))
            
        trends["series"].append({
            "name": s_name,
            "data": s_vals,
            "is_benchmark": False
        })
        
    return mock_sectors, mock_stocks, trends, macro_data, mock_waneye
