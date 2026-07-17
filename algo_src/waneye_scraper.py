import re
import urllib.request

# =========================================================
# 金融情感极性词库 (中文版)
# =========================================================
FINANCIAL_POLARITY = {
    # 极正面关键词 (权重 0.7-1.0)
    "历史新高": 1.0, "创历史新高": 1.0, "突破": 1.0, "暴涨": 0.8, "飙升": 0.8,
    "利润翻倍": 1.0, "利润大增": 0.9, "超预期": 0.8, "超出预期": 0.8,
    "上调指引": 0.9, "买入": 0.5, "牛市": 0.8, "收购": 0.6,
    "回购": 0.7, "增发": 0.5, "分红增加": 0.7, "派息增加": 0.7,
    "强劲需求": 0.7, "重大合同": 0.7, "战略合作": 0.6,
    # 正面关键词 (权重 0.3-0.5)
    "上涨": 0.4, "上升": 0.4, "反弹": 0.5, "增长": 0.4, "扩张": 0.4,
    "复苏": 0.4, "利好": 0.5, "乐观": 0.5,
    # 负面关键词 (权重 -0.3 至 -0.6)
    "下跌": -0.4, "下滑": -0.4, "回落": -0.4, "减少": -0.4,
    "警告": -0.5, "风险": -0.4, "收缩": -0.5, "走弱": -0.4,
    "担忧": -0.4, "承压": -0.3, "放缓": -0.4, "延迟": -0.4,
    "不及预期": -0.5, "低于预期": -0.5, "利空": -0.5,
    # 极负面关键词 (权重 -0.7 至 -1.0)
    "亏损": -0.8, "暴跌": -0.8, "大跌": -0.7, "下调": -0.8,
    "崩盘": -1.0, "诉讼": -0.6, "欺诈": -0.9, "立案调查": -0.7,
    "调查": -0.5, "破产": -1.0, "违约": -0.9, "停牌": -0.8,
    "闪崩": -0.8, "抛售": -0.7
}

# =========================================================
# Waneye.com 中文舆情抓取与板块映射关键字
# =========================================================
SECTOR_KEYWORDS = {
    "金融银行 Banking": [
        '美联储', '降息', '加息', '通胀', '国债', '收益率', '央行', '人行',
        '贷款', '信贷', '银行', '利率', '净息差', '不良率'
    ],
    "证券券商 Brokerage": [
        '券商', '证券', '成交额', '股市', 'a股', '印花税', '开户', '佣金'
    ],
    "有色金属 Mining": [
        '铜', '铝', '镍', '铁矿石', '黄金', '有色金属', '矿业', '资源', '大宗商品', '钢'
    ],
    "新能源汽车 EV/Lithium": [
        '新能源汽车', '锂电池', '固态电池', '锂矿', '钴', '电动汽车', '特斯拉', '比亚迪', '宁德时代'
    ],
    "光伏能源 Solar/Energy": [
        '光伏', '太阳能', '风能', '硅片', '硅料', '清洁能源', '电力', '煤炭', '石油', '天然气'
    ],
    "半导体芯片 Semiconductors": [
        '芯片', '半导体', '光刻机', '集成电路', '晶圆', '中芯国际', '英伟达', '台积电'
    ],
    "AI/软件 AI & Tech": [
        '人工智能', 'ai', '大模型', '软件', '金山办公', '科大讯飞', '云计算', '光模块', '算力'
    ],
    "医疗健康 Healthcare": [
        '医药', '医疗', '生物医药', '创新药', '疫苗', '医院', 'fda', '临床试验', '片仔癀'
    ],
    "白酒消费 Consumer": [
        '白酒', '茅台', '消费', '零售', '食品', '饮料', '超市', '电商', '餐饮'
    ],
    "军工国防 Defense": [
        '军工', '国防', '航天', '航空', '沈飞', '西飞', '武器', '装备', '地缘政治'
    ]
}

def match_text_to_sectors(text):
    """根据中文内容里的关键字进行模糊匹配，返回匹配板块和置信度"""
    if not text:
        return []
    text_lower = text.lower()
    
    AMBIGUOUS_CONSTRAINTS = {
        "ai": {
            "_default": ["人工智能", "大模型", "算力", "芯片", "软件", "英伟达", "科技"]
        },
        "银行": {
            "_default": ["降息", "加息", "降准", "贷款", "信贷", "不良率", "息差", "招行", "工行"]
        }
    }
    
    matched = []
    
    for sector_name, keywords in SECTOR_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                if kw in AMBIGUOUS_CONSTRAINTS:
                    constraints = AMBIGUOUS_CONSTRAINTS[kw].get("_default", [])
                    if constraints:
                        has_context = any(c in text_lower for c in constraints)
                        confidence = "high" if has_context else "low"
                    else:
                        confidence = "low"
                else:
                    confidence = "high"
                
                matched.append({
                    "sector": sector_name,
                    "confidence": confidence,
                    "keyword": kw
                })
                
    sector_matches = {}
    for m in matched:
        sec = m["sector"]
        conf = m["confidence"]
        if sec not in sector_matches or (sector_matches[sec] == "low" and conf == "high"):
            sector_matches[sec] = conf
            
    return [{"sector": sec, "confidence": conf} for sec, conf in sector_matches.items()]

def fetch_waneye_data():
    """
    抓取 waneye.com 中文版全球宏观舆情与头条新闻 (通过 API 替代抓网页)
    """
    import subprocess
    import json

    data = {
        "score": 50,
        "sentiment": "中性",
        "highlights": [],
        "headlines": [],
        "risks": [],
        "opportunities": [],
        "defensive": []
    }
    
    print("  Fetching macro intelligence from Waneye API...")
    try:
        # 1. 获取分析指标 (analysis.json)
        res_analysis = subprocess.run(
            ['curl', '-s', '-L', '-A', 'Mozilla/5.0', 'https://www.waneye.com/api/v1/cn/analysis.json'],
            capture_output=True, text=True, timeout=12
        )
        if res_analysis.returncode == 0 and res_analysis.stdout:
            analysis_data = json.loads(res_analysis.stdout)
            analysis = analysis_data.get("analysis", {})
            
            # 综合得分与情绪
            exec_summary = analysis.get("executive_summary", {})
            data["score"] = exec_summary.get("market_sentiment_score", 50)
            
            raw_sent = exec_summary.get("overall_sentiment", "neutral").lower()
            if "positive" in raw_sent:
                data["sentiment"] = "偏多"
            elif "negative" in raw_sent:
                data["sentiment"] = "偏空"
            else:
                data["sentiment"] = "中性"
                
            # 亮点总结
            data["highlights"] = exec_summary.get("key_highlights", [])
            
            # 风险评估
            for risk in analysis.get("risk_assessment", []):
                data["risks"].append({
                    "title": risk.get("risk_factor", "未知风险"),
                    "impact": risk.get("impact", "Medium"),
                    "likelihood": risk.get("likelihood", "Medium"),
                    "mitigation": risk.get("mitigation", "")
                })
                
            # 投资建议
            strat = analysis.get("strategic_recommendations", {})
            for opp in strat.get("opportunities", []):
                data["opportunities"].append({
                    "title": opp.get("recommendation", ""),
                    "timeframe": opp.get("timeframe", ""),
                    "description": opp.get("rationale", "")
                })
            for def_move in strat.get("defensive_moves", []):
                data["defensive"].append({
                    "title": def_move.get("recommendation", ""),
                    "timeframe": def_move.get("timeframe", ""),
                    "description": def_move.get("rationale", "")
                })
                
        # 2. 获取实时头条新闻 (headlines.json)
        res_headlines = subprocess.run(
            ['curl', '-s', '-L', '-A', 'Mozilla/5.0', 'https://www.waneye.com/api/v1/cn/headlines.json'],
            capture_output=True, text=True, timeout=12
        )
        if res_headlines.returncode == 0 and res_headlines.stdout:
            hl_data = json.loads(res_headlines.stdout)
            for hl in hl_data.get("headlines", []):
                data["headlines"].append({
                    "title": hl.get("headline", ""),
                    "url": hl.get("url", "")
                })

        print(f"  ✓ Waneye fetched successfully via API (Score: {data['score']}, Headlines: {len(data['headlines'])}, Risks: {len(data['risks'])})")
    except Exception as e:
        print(f"  ⚠️ Fetching waneye API failed: {e}")
    return data

def calculate_sentiment_score(title_text):
    """通过中文极性词计算平均新闻情绪得分 (-1.0 至 +1.0)"""
    if not title_text:
        return 0.0
    title_lower = title_text.lower()
    
    sorted_phrases = sorted(FINANCIAL_POLARITY.keys(), key=len, reverse=True)
    spans = []
    score = 0.0
    matches = 0
    
    NEGATION_WORDS = ['不', '没', '无', '非', '未', '不及', '没有', '不要', '未达']
    
    for phrase in sorted_phrases:
        start = 0
        while True:
            idx = title_lower.find(phrase, start)
            if idx == -1:
                break
            
            overlap = False
            for s_start, s_end in spans:
                if not (idx + len(phrase) <= s_start or idx >= s_end):
                    overlap = True
                    break
            
            if not overlap:
                spans.append((idx, idx + len(phrase)))
                
                # 检查前面4个字符内是否有否定词
                preceding_text = title_lower[max(0, idx-4):idx].strip()
                
                negated = False
                for neg in NEGATION_WORDS:
                    if neg in preceding_text:
                        negated = True
                        break
                
                val = FINANCIAL_POLARITY[phrase]
                if negated:
                    val = -val
                
                score += val
                matches += 1
            
            start = idx + 1
            
    return score / matches if matches > 0 else None

def analyze_waneye_sentiment(headlines):
    """根据 scraped Headlines 匹配分类并计算各板块平均舆情情绪分"""
    sector_sentiment_lists = {s: [] for s in SECTOR_KEYWORDS}
    
    for h in headlines:
        title = h["title"]
        sentiment_score = calculate_sentiment_score(title)
        if sentiment_score is None:
            sentiment_score = 0.0
        
        matches_sectors = match_text_to_sectors(title)
        for m in matches_sectors:
            if m["confidence"] == "high":
                sector_sentiment_lists[m["sector"]].append(sentiment_score)
                
    aggregated_sentiment = {}
    for sector_name, scores in sector_sentiment_lists.items():
        if scores:
            aggregated_sentiment[sector_name] = round(sum(scores) / len(scores), 2)
        else:
            aggregated_sentiment[sector_name] = 0.0
            
    return aggregated_sentiment
