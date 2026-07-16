import time
import pandas as pd
import akshare as ak
import yfinance as yf
from waneye_scraper import FINANCIAL_POLARITY, calculate_sentiment_score

def to_yahoo_ticker(symbol):
    # Sector indices are not reliably carried by Yahoo Finance; map them to CSI 300 (000300.SS) as proxy
    if symbol in ["sh000300", "000300"]:
        return "000300.SS"
    if symbol in ["sh000001", "000001"]:
        return "000001.SS"
    if symbol.startswith("sh000") or symbol.startswith("sz399"):
        return "000300.SS"
        
    if symbol.startswith("sh") and len(symbol) == 8:
        return f"{symbol[2:]}.SS"
    elif symbol.startswith("sz") and len(symbol) == 8:
        return f"{symbol[2:]}.SZ"
    # Stock codes
    if symbol.startswith("6") or symbol.startswith("9"):
        return f"{symbol}.SS"
    elif symbol.startswith("0") or symbol.startswith("3"):
        return f"{symbol}.SZ"
    return symbol

def fetch_ticker(symbol, period="3mo"):
    """Fetch index or stock history using yfinance"""
    try:
        yf_sym = to_yahoo_ticker(symbol)
        df = yf.download(yf_sym, period=period, progress=False)
        if not df.empty:
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            df = df.reset_index()
            df = df.rename(columns={
                "Date": "Date",
                "Open": "Open",
                "High": "High",
                "Low": "Low",
                "Close": "Close",
                "Volume": "Volume"
            })
            df["Date"] = pd.to_datetime(df["Date"])
            df.set_index("Date", inplace=True)
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
            
    sentiment_val = 0.0
    if scores:
        sentiment_val = round(sum(scores) / len(scores), 2)
    
    avg_freshness = 1.0
    if freshness_list:
        avg_freshness = round(sum(freshness_list) / len(freshness_list), 2)
        
    return sentiment_val, avg_freshness
def fetch_ticker_news_sentiment(symbol):
    """个股新闻抓取非常容易被东财封禁且速度慢，默认采用板块舆情融合"""
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
        # 使用美债十年期收益率作为全球流动性风向标 proxy
        df_bond = yf.download("^TNX", period="10d", progress=False)
        if not df_bond.empty:
            if isinstance(df_bond.columns, pd.MultiIndex):
                df_bond.columns = df_bond.columns.get_level_values(0)
            df_bond = df_bond.reset_index()
            closes = df_bond["Close"].tolist()
            if len(closes) >= 5:
                yield_change = float(closes[-1] - closes[-5])
                macro_data["yield_trend"] = round(yield_change, 3)
            
        # 美元兑人民币汇率 (USD/CNY)
        df_fx = yf.download("CNY=X", period="10d", progress=False)
        if not df_fx.empty:
            if isinstance(df_fx.columns, pd.MultiIndex):
                df_fx.columns = df_fx.columns.get_level_values(0)
            df_fx = df_fx.reset_index()
            closes = df_fx["Close"].tolist()
            if len(closes) >= 5:
                fx_change = float(closes[-1] - closes[-5])
                macro_data["aud_trend"] = round(fx_change, 4)
                
        # 总结描述
        if macro_data["yield_trend"] > 0.1:
            macro_data["summary"] = "十年期国债收益率走强，流动性边际收紧，对成长股及科技板块估值形成一定压制。"
        elif macro_data["yield_trend"] < -0.1:
            macro_data["summary"] = "十年期国债收益率显著下行，无风险利率走低，高分红资产估值迎来修复。"
        else:
            macro_data["summary"] = "宏观十年期收益率与人民币汇率宽幅震荡，宏观面流动性对A股市场整体影响中性。"
    except Exception:
        pass
    return macro_data
