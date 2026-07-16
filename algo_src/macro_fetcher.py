import time
import yfinance as yf
from waneye_scraper import FINANCIAL_POLARITY, calculate_sentiment_score

def fetch_ticker(symbol, period="3mo"):
    """单只股票下载，稳定性最佳"""
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period)
        return df
    except Exception as e:
        print(f"  Download error {symbol}: {e}")
        return None

def analyze_news_sentiment(news_list):
    """通过文本极性词袋计算平均新闻情绪面得分 (-1.0 至 +1.0) 以及新鲜度"""
    if not news_list:
        return None, None
    
    scores = []
    current_time = int(time.time())
    freshness_list = []
    
    for item in news_list:
        title = item.get("title", "")
        sentiment_score = calculate_sentiment_score(title)
        if sentiment_score is not None:
            scores.append(sentiment_score)
            
        pub_time = item.get("providerPublishTime")
        if pub_time:
            age_in_seconds = max(0, current_time - pub_time)
            # Decays to 0 over 3 days (259200 seconds)
            item_freshness = max(0.0, 1.0 - age_in_seconds / (3 * 24 * 3600))
        else:
            item_freshness = 1.0
        freshness_list.append(item_freshness)
            
    # Calculate average sentiment (if news list exists, default to 0.0 unless matching polarity scores)
    sentiment_val = 0.0
    if scores:
        sentiment_val = round(sum(scores) / len(scores), 2)
    
    # Calculate average freshness
    avg_freshness = 1.0
    if freshness_list:
        avg_freshness = round(sum(freshness_list) / len(freshness_list), 2)
        
    return sentiment_val, avg_freshness

def fetch_ticker_news_sentiment(symbol):
    """获取个股最新新闻并计算情绪分以及元数据"""
    try:
        ticker = yf.Ticker(symbol)
        news = ticker.news
        if news:
            sentiment, freshness = analyze_news_sentiment(news)
            latest_headline = news[0].get("title", "")
            # 仅当获取到非空新闻标题时，才采信个股新闻舆情
            if latest_headline.strip():
                return {
                    "sentiment_value": sentiment,
                    "sentiment_source": "news" if sentiment is not None else None,
                    "news_freshness": freshness,
                    "latest_headline": latest_headline
                }
    except Exception:
        pass
    return {
        "sentiment_value": None,
        "sentiment_source": None,
        "news_freshness": None,
        "latest_headline": ""
    }

def fetch_macro_indicators():
    """拉取大宗汇率与国债利率，用于计算板块宏观环境乘数"""
    macro_data = {
        "yield_trend": 0.0, 
        "aud_trend": 0.0,   
        "summary": "大盘宏观面平静"
    }
    try:
        # 10年美债收益率 ^TNX 作为宏观估值锚
        bond = yf.Ticker("^TNX")
        bond_df = bond.history(period="5d")
        if bond_df is not None and len(bond_df) >= 2:
            yield_change = float(bond_df["Close"].iloc[-1] - bond_df["Close"].iloc[0])
            macro_data["yield_trend"] = round(yield_change, 3)
            
        # 澳元兑美元 AUDUSD=X
        aud = yf.Ticker("AUDUSD=X")
        aud_df = aud.history(period="5d")
        if aud_df is not None and len(aud_df) >= 2:
            aud_change = float((aud_df["Close"].iloc[-1] - aud_df["Close"].iloc[0]) / aud_df["Close"].iloc[0]) * 100
            macro_data["aud_trend"] = round(aud_change, 2)
            
        # 总结描述
        if macro_data["yield_trend"] > 0.15:
            macro_data["summary"] = "美债收益率持续攀升，估值端对高成长科技与医疗板块形成明显压制。"
        elif macro_data["yield_trend"] < -0.15:
            macro_data["summary"] = "收益率大幅下行，分红派息板块及高成长科技股迎来流动性估值修复。"
        elif macro_data["aud_trend"] > 1.2:
            macro_data["summary"] = "澳元汇率走强，大宗商品及矿业板块资金吸引力显著上升。"
        elif macro_data["aud_trend"] < -1.2:
            macro_data["summary"] = "澳元汇率走弱，利好出口及跨国资源龙头企业汇兑收益。"
        else:
            macro_data["summary"] = "国债收益率与澳元汇率宽幅震荡，宏观面流动性对大盘影响均衡。"
    except Exception:
        pass
    return macro_data
