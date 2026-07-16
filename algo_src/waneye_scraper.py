import re
import urllib.request
from bs4 import BeautifulSoup

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
    抓取 waneye.com 中文版全球宏观舆情与头条新闻
    """
    url = "https://www.waneye.com/cn/"
    data = {
        "score": 50,
        "sentiment": "中性",
        "highlights": [],
        "headlines": [],
        "risks": [],
        "opportunities": [],
        "defensive": []
    }
    
    print("  Fetching macro intelligence from Waneye.com/cn/...")
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=12) as response:
            html = response.read().decode('utf-8')
            
        soup = BeautifulSoup(html, "html.parser")

        # 1. 抓取市场综合得分 Market Score
        score_widget = soup.find(class_="briefing-score-widget")
        if score_widget:
            score_text = score_widget.find(class_="text-6xl")
            if score_text:
                try:
                    data["score"] = int(score_text.get_text(strip=True))
                except ValueError:
                    pass
            # 找到包含情绪类别的 pill
            pill = score_widget.find(class_=lambda x: x and "bg-" in x)
            if pill:
                data["sentiment"] = pill.get_text(strip=True)
            if not data["sentiment"]:
                if data["score"] >= 65:
                    data["sentiment"] = "偏多"
                elif data["score"] >= 45:
                    data["sentiment"] = "中性"
                else:
                    data["sentiment"] = "偏空"
                
        # 2. 抓取 Executive Summary 亮点
        exec_summary = soup.find(id="exec-summary")
        if exec_summary:
            for li in exec_summary.find_all("li"):
                data["highlights"].append(li.get_text(strip=True))
                
        # 3. 抓取 Headlines Panel 的新闻
        panel = soup.find(attrs={"x-ref": "headlinesPanel"})
        if panel:
            for a in panel.find_all("a"):
                text = a.get_text(" ", strip=True)
                href = a.get("href", "")
                
                # 清理开头的数字
                text_clean = re.sub(r'^\d+\s*', '', text)
                data["headlines"].append({
                    "title": text_clean.strip(),
                    "url": href
                })

        # 4. 抓取 Risk Assessment 风险影响与规避
        risk_section = soup.find(id="risk-assessment")
        if risk_section:
            for row in risk_section.find_all(class_=lambda x: x and "risk-row" in x):
                badge = row.find(class_="risk-badge")
                impact = badge.get_text(strip=True) if badge else ""
                
                like = row.find(class_="risk-likelihood")
                likelihood = like.get_text(strip=True) if like else ""
                
                title_elem = row.find(["h3", "h4"])
                title = title_elem.get_text(strip=True) if title_elem else "未知风险"
                
                mitigation = ""
                text_content = row.get_text(" ", strip=True)
                # 支持中文 "对策" 或 "Mitigation:"
                if "对策" in text_content or "mitigation:" in text_content.lower():
                    parts = re.split(r'对策[：:]|Mitigation:', text_content, flags=re.IGNORECASE)
                    mitigation = parts[-1].split("来源")[0].split("Sources:")[0].strip()
                    
                data["risks"].append({
                    "title": title,
                    "impact": impact,
                    "likelihood": likelihood,
                    "mitigation": mitigation
                })

        # 5. 抓取 Strategic Recommendations (投资机会与防御策略)
        rec_section = soup.find(id="recommendations")
        if rec_section:
            # Opportunities
            for card in rec_section.find_all(class_=lambda x: x and "rec-opportunity" in x):
                title = card.find(["h3", "h4"])
                title_text = title.get_text(strip=True) if title else ""
                timeframe_elem = card.find(class_="timeframe-badge")
                timeframe = timeframe_elem.get_text(strip=True) if timeframe_elem else ""
                
                desc_text = card.get_text(" ", strip=True)
                desc_text = desc_text.replace(title_text, "").replace(timeframe, "").strip()
                desc_text = " ".join(desc_text.split()).split("来源")[0].split("Sources:")[0].strip()
                
                data["opportunities"].append({
                    "title": title_text,
                    "timeframe": timeframe,
                    "description": desc_text
                })
                
            # Defensive
            for card in rec_section.find_all(class_=lambda x: x and "rec-defensive" in x):
                title = card.find(["h3", "h4"])
                title_text = title.get_text(strip=True) if title else ""
                timeframe_elem = card.find(class_="timeframe-badge")
                timeframe = timeframe_elem.get_text(strip=True) if timeframe_elem else ""
                
                desc_text = card.get_text(" ", strip=True)
                desc_text = desc_text.replace(title_text, "").replace(timeframe, "").strip()
                desc_text = " ".join(desc_text.split()).split("来源")[0].split("Sources:")[0].strip()
                
                data["defensive"].append({
                    "title": title_text,
                    "timeframe": timeframe,
                    "description": desc_text
                })

        print(f"  ✓ Waneye fetched successfully (Score: {data['score']}, Headlines: {len(data['headlines'])}, Risks: {len(data['risks'])})")
    except Exception as e:
        print(f"  ⚠️ Fetching waneye.com/cn/ failed: {e}")
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
