import re
import urllib.request
from bs4 import BeautifulSoup

# =========================================================
# 金融情感极性词库 (扩充版 80+ 词，包含多词短语优先匹配)
# =========================================================
FINANCIAL_POLARITY = {
    # 极正面关键词 (权重 0.7-1.0)
    "record high": 1.0, "all-time high": 1.0, "breakthrough": 1.0, "surge": 0.8,
    "profit jumps": 1.0, "earnings beat": 0.9, "beat estimate": 0.8, "beat expectations": 0.8,
    "exceeds estimate": 0.8, "guidance raised": 0.9, "upgrades guidance": 0.9,
    "upgrade": 0.7, "outperform": 0.7, "exceeds": 0.8,
    "buy": 0.5, "bullish": 0.8, "soars": 0.8, "acquisition": 0.6,
    "share buyback": 0.7, "dividend increase": 0.7, "raises dividend": 0.7,
    "margin expansion": 0.7, "strong demand": 0.7, "robust demand": 0.7,
    "record profit": 1.0, "record revenue": 0.9, "beats forecast": 0.8,
    "new contract": 0.6, "major contract": 0.7, "strategic partnership": 0.6,
    "accelerates": 0.5, "doubles": 0.6, "triples": 0.7, "skyrocket": 0.9,
    # 正面关键词 (权重 0.3-0.5)
    "rise": 0.4, "rises": 0.4, "rally": 0.5, "rallies": 0.5, "rebound": 0.5,
    "grow": 0.4, "growth": 0.3, "expand": 0.4, "boost": 0.5, "gain": 0.3,
    "recover": 0.4, "recovery": 0.4, "partnership": 0.5, "positive": 0.5,
    "demand": 0.3, "upside": 0.4, "strength": 0.3, "innovation": 0.3,
    "breakout": 0.5, "outpace": 0.4, "momentum": 0.3,
    "rate cut": 0.5, "rate cuts": 0.5,
    # 负面关键词 (权重 -0.3 至 -0.6)
    "fall": -0.4, "falls": -0.4, "drop": -0.4, "drops": -0.4,
    "cut": -0.5, "cuts": -0.5, "warn": -0.5, "warning": -0.5,
    "price cut": -0.4,
    "risk": -0.4, "sink": -0.6, "sinks": -0.6, "shrink": -0.5,
    "weak": -0.4, "weakness": -0.4, "concern": -0.4, "slip": -0.3, "slips": -0.3,
    "decline": -0.4, "declines": -0.4, "pressure": -0.3, "headwind": -0.4,
    "delay": -0.4, "delays": -0.4, "disappoints": -0.5, "miss": -0.5,
    "margin compression": -0.6, "supply chain disruption": -0.6,
    # 极负面关键词 (权重 -0.7 至 -1.0)
    "loss": -0.8, "losses": -0.8, "slashed": -0.9, "downgrade": -0.8,
    "miss estimate": -0.8, "misses estimate": -0.8, "guidance cut": -0.9,
    "underperform": -0.8, "bearish": -0.8, "collapse": -1.0, "crash": -1.0,
    "probe": -0.7, "lawsuit": -0.6, "fraud": -0.9, "investigation": -0.7,
    "recall": -0.6, "default": -0.9, "bankruptcy": -1.0, "suspension": -0.8,
    "writedown": -0.7, "impairment": -0.7, "plunge": -0.8, "plunges": -0.8,
    "tumble": -0.7, "tumbles": -0.7, "sell-off": -0.7,
}

# =========================================================
# Waneye.com 舆情抓取与板块映射关键字
# =========================================================
SECTOR_KEYWORDS = {
    "金融银行 Banking": [
        'fed', 'fomc', 'inflation', 'yield', 'rate', 'bond', 'central bank',
        'debt', 'finance', 'banking', 'bank', 'interest', 'reserve bank', 'rba',
        'rate-hike', 'loans', 'credit', 'apra', 'mortgage', 'housing loan',
        'net interest margin'
    ],
    "矿业资源 Mining": [
        'copper', 'nickel', 'iron', 'mining', 'commodity', 'steel',
        'metals', 'drilling', 'bhp', 'rio', 'fortescue', 'pilbara',
        'alumina', 'zinc', 'ore'
    ],
    "黄金 Gold": [
        'gold', 'bullion', 'gold price', 'gold miner', 'precious metals',
        'safe haven', 'gold etf', 'gold reserve'
    ],
    "新能源/锂矿 Lithium": [
        'lithium', 'rare earth', 'spodumene', 'cobalt', 'battery',
        'ev', 'tesla', 'clean energy', 'electric vehicle'
    ],
    "铀矿 Uranium": [
        'uranium', 'nuclear', 'nuclear power', 'reactor', 'yellowcake',
        'enrichment', 'nuclear energy', 'small modular reactor', 'smr'
    ],
    "科技/软件 Technology": [
        'ai', 'nvidia', 'tech', 'software', 'chip', 'asml', 'microsoft',
        'saas', 'cybersecurity', 'telecom', 'computer', 'apple',
        'google', 'meta', 'amazon', 'cloud', 'semiconductor', 'grok', 'xai'
    ],
    "AI基建 AI Infra": [
        'data center', 'data centre', 'ai infrastructure', 'cloud computing',
        'hyperscaler', 'gpu', 'hpc', 'high performance computing',
        'edge computing', 'colocation'
    ],
    "医疗健康 Healthcare": [
        'fda', 'moderna', 'cancer', 'drug', 'healthcare', 'obesity', 'pharma',
        'clinical', 'medical', 'biotech', 'hospital', 'clinical trial',
        'therapeutic', 'vaccine'
    ],
    "消费/零售 Consumer": [
        'retail', 'consumer', 'sales', 'spending', 'shop', 'grocery',
        'supermarket', 'fast food', 'delivery', 'brands', 'restaurant',
        'pizza', 'ecommerce'
    ],
    "地产/基建 Real Estate": [
        'property', 'office', 'residential', 'housing', 'realty', 'infrastructure',
        'mall', 'leases', 'construction', 'reit', 'logistics property'
    ],
    "能源 Energy": [
        'oil', 'crude', 'energy', 'gas', 'coal', 'drilling', 'fuel', 'petroleum',
        'hormuz', 'lng', 'woodside', 'santos', 'hydrogen', 'pipeline'
    ],
    "旅游博彩 Travel": [
        'tourism', 'travel', 'airline', 'airport', 'hotel', 'casino',
        'gaming', 'vacation', 'booking', 'flight', 'passenger'
    ],
}

def match_text_to_sectors(text):
    """根据新闻、风险或建议内容里的关键字，做词边界匹配并引入歧义约束，返回匹配板块和置信度"""
    if not text:
        return []
    text_lower = text.lower()
    
    # 歧义词及其在特定板块下的共现约束词
    AMBIGUOUS_CONSTRAINTS = {
        "ai": {
            "_default": ["tech", "nvidia", "chip", "software", "intelligence", "model", "infrastructure", "computing", "development", "data center", "asml"]
        },
        "gas": {
            "_default": ["crude", "curde", "oil", "energy", "fuel", "petroleum", "lng", "supply", "pipeline", "price", "drilling", "hormuz"]
        },
        "rate": {
            "_default": ["policy", "inflation", "fed", "fomc", "central", "interest", "reserve", "yield", "bond", "hike", "cut", "deposit", "debt"]
        },
        "bank": {
            "_default": ["policy", "inflation", "central", "reserve", "interest", "loans", "credit", "deposit", "finance", "banking", "lending", "fed", "fomc"]
        },
        "travel": {
            "旅游博彩 Travel": ["airline", "airport", "tourism", "hotel", "flight", "booking", "passenger", "vacation", "holiday", "casino", "gaming"]
        },
        "drilling": {
            "能源 Energy": ["oil", "gas", "petroleum", "lng", "crude", "drilling"],
            "矿业资源 Mining": ["copper", "iron", "nickel", "metals", "gold", "uranium", "lithium", "ore", "exploration"]
        }
    }
    
    matched = []
    
    for sector_name, keywords in SECTOR_KEYWORDS.items():
        for kw in keywords:
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, text_lower):
                if kw in AMBIGUOUS_CONSTRAINTS:
                    constraints_dict = AMBIGUOUS_CONSTRAINTS[kw]
                    if sector_name in constraints_dict:
                        constraints = constraints_dict[sector_name]
                    elif "_default" in constraints_dict:
                        constraints = constraints_dict["_default"]
                    else:
                        constraints = []
                    
                    if constraints:
                        has_context = any(re.search(r'\b' + re.escape(c) + r'\b', text_lower) for c in constraints)
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
    抓取 waneye.com 全球宏观舆情与头条新闻
    """
    url = "https://www.waneye.com/"
    data = {
        "score": 50,
        "sentiment": "Neutral",
        "highlights": [],
        "headlines": [],
        "risks": [],
        "opportunities": [],
        "defensive": []
    }
    
    print("  Fetching macro intelligence from Waneye.com...")
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
            # 找到包含情绪类别的 pill (多级 fallback 选择器)
            pill = score_widget.find(class_=lambda x: x and "bg-" in x)
            if pill:
                data["sentiment"] = pill.get_text(strip=True)
            # Fallback: 如果 pill 选择器失效，根据分数推断情绪
            if not data["sentiment"]:
                if data["score"] >= 65:
                    data["sentiment"] = "Positive"
                elif data["score"] >= 45:
                    data["sentiment"] = "Neutral"
                else:
                    data["sentiment"] = "Negative"
                
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
                # 清理结尾的来源媒体名称
                text_clean = re.sub(
                    r'\s+(Bloomberg|Yahoo Finance|CNBC|Associated Press|'
                    r'The Wall Street Journal|GNews|MarketAux|Ars Technica|'
                    r'Associated Press News|Reuters|Financial Times|'
                    r'Business Insider|Investor\'s Business Daily|USA Today)$', 
                    '', text_clean
                )
                
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
                title = title_elem.get_text(strip=True) if title_elem else "Unknown Risk"
                
                mitigation = ""
                text_content = row.get_text(" ", strip=True)
                if "mitigation:" in text_content.lower():
                    parts = text_content.split("Mitigation:")
                    mitigation = parts[-1].split("Sources:")[0].strip()
                    
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
                desc_text = " ".join(desc_text.split()).split("Sources:")[0].strip()
                
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
                desc_text = " ".join(desc_text.split()).split("Sources:")[0].strip()
                
                data["defensive"].append({
                    "title": title_text,
                    "timeframe": timeframe,
                    "description": desc_text
                })

        print(f"  ✓ Waneye fetched successfully (Score: {data['score']}, Headlines: {len(data['headlines'])}, Risks: {len(data['risks'])})")
    except Exception as e:
        print(f"  ⚠️ Fetching waneye.com failed: {e}")
    return data

def calculate_sentiment_score(title_text):
    """通过文本极性词袋计算平均新闻情绪面得分 (-1.0 至 +1.0)，支持长短语优先与否定词处理"""
    if not title_text:
        return 0.0
    title_lower = title_text.lower()
    
    # Sort phrases by length desc to prioritize longer ones
    sorted_phrases = sorted(FINANCIAL_POLARITY.keys(), key=len, reverse=True)
    spans = []
    score = 0.0
    matches = 0
    
    NEGATION_WORDS = ['not', 'no', 'never', 'unlikely', 'fails to', 'without']
    
    for phrase in sorted_phrases:
        start = 0
        while True:
            idx = title_lower.find(phrase, start)
            if idx == -1:
                break
            
            # Check if this occurrence overlaps with any already matched (longer) phrase
            overlap = False
            for s_start, s_end in spans:
                if not (idx + len(phrase) <= s_start or idx >= s_end):
                    overlap = True
                    break
            
            if not overlap:
                spans.append((idx, idx + len(phrase)))
                
                # Check for negation words in the preceding context (up to 3 words)
                preceding_text = title_lower[:idx].strip()
                words = re.findall(r'\b\w+\b', preceding_text)
                last_3_words = words[-3:] if len(words) >= 3 else words
                
                negated = False
                for neg in NEGATION_WORDS:
                    if neg in last_3_words:
                        negated = True
                        break
                    if ' ' in neg:
                        if preceding_text.endswith(neg) or (neg + ' ') in preceding_text[-25:]:
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
    """
    根据 scraped Headlines 匹配分类并计算各板块平均舆情情绪分 (仅限高置信度映射)
    """
    sector_sentiment_lists = {s: [] for s in SECTOR_KEYWORDS}
    
    for h in headlines:
        title = h["title"]
        
        # 情绪极性评分 (使用包含长短语优先及否定词处理的引擎)
        sentiment_score = calculate_sentiment_score(title)
        if sentiment_score is None:
            sentiment_score = 0.0
        
        # 根据 match_text_to_sectors 获取匹配的板块，过滤低置信度匹配
        matches_sectors = match_text_to_sectors(title)
        for m in matches_sectors:
            if m["confidence"] == "high":
                sector_sentiment_lists[m["sector"]].append(sentiment_score)
                
    # 汇总计算各板块平均舆情分
    aggregated_sentiment = {}
    for sector_name, scores in sector_sentiment_lists.items():
        if scores:
            aggregated_sentiment[sector_name] = round(sum(scores) / len(scores), 2)
        else:
            aggregated_sentiment[sector_name] = 0.0
            
    return aggregated_sentiment
