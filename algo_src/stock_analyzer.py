import pandas as pd
import numpy as np
from macro_fetcher import fetch_ticker_news_sentiment
from strategy_config import STRATEGY_CONFIG, SECTORS

def analyze_stock(symbol, df, index_df=None, sentiment_data=None, waneye_sector_sent=None, trading_state="active"):
    """
    分析单只股票的技术面与新闻面，生成个股短线交易信号与多维度量化指标。
    
    主要分析步骤：
    1. 数据预处理与长度校验 (确保包含足够的历史交易日)。
    2. 计算多周期移动平均线 (MA5, MA10, MA20, MA60) 建立趋势背景。
    3. 计算 RSI(14) 相对强弱指标，用于识别超买与超卖状态。
    4. 计算单日涨跌幅、5日涨跌幅及20日涨跌幅。
    5. 对齐大盘基准数据，计算相对强度比率 (RS Ratio)。
    6. 计算成交量量比 (Volume Ratio) 以评估当前资金流入强度。
    7. 综合技术形态判定：主升浪突破、潜伏建仓期或V型反转。
    8. 融合个股新闻舆情与全球宏观舆情，实施利空信号降级，防范突发负面风险。
    """
    try:
        cfg = STRATEGY_CONFIG["stock_analyzer"]
        if df is None or df.empty or len(df) < cfg["min_data_len_initial"]:
            return None
        df = df.dropna(subset=['Close', 'Volume'])
        if len(df) < cfg["min_data_len_aligned"]:
            return None

        # 如果有大盘数据，做对齐处理
        if index_df is not None and not index_df.empty:
            df = pd.merge(df, index_df['Close'].rename('IndexClose'), left_index=True, right_index=True, how='inner')
            if len(df) < cfg["min_data_len_aligned"]:
                return None

        close = df["Close"]
        volume = df["Volume"]

        # ---- 均线系统 ----
        df = df.copy()
        df["MA5"]  = close.rolling(5).mean()
        df["MA10"] = close.rolling(10).mean()
        df["MA20"] = close.rolling(20).mean()
        df["MA60"] = close.rolling(60).mean() if len(df) >= 60 else np.nan

        # ---- RSI ----
        delta = close.diff()
        rsi_period = cfg["rsi_period"]
        gain = delta.where(delta > 0, 0.0).ewm(alpha=1/rsi_period, min_periods=rsi_period, adjust=False).mean()
        loss = (-delta.where(delta < 0, 0.0)).ewm(alpha=1/rsi_period, min_periods=rsi_period, adjust=False).mean()
        rs = gain / loss.replace(0, np.nan)
        df["RSI"] = 100 - (100 / (1 + rs))
        rsi_val = float(df["RSI"].iloc[-1]) if not pd.isna(df["RSI"].iloc[-1]) else cfg["rsi_fallback_value"]

        latest  = df.iloc[-1]
        prev    = df.iloc[-2]
        prev5   = df.iloc[-6] if len(df) >= 6 else df.iloc[0]
        prev20  = df.iloc[-21] if len(df) >= 21 else df.iloc[0]

        # ---- 涨跌幅 ----
        chg_pct = ((latest["Close"] - prev["Close"]) / prev["Close"]) * 100
        chg_5d  = ((latest["Close"] - prev5["Close"]) / prev5["Close"]) * 100
        chg_20d = ((latest["Close"] - prev20["Close"]) / prev20["Close"]) * 100

        # ---- 相对大盘强度 (RS Ratio) ----
        rs_ratio_5d = 1.0
        rs_ratio_20d = 1.0
        if "IndexClose" in df.columns:
            index_close = df["IndexClose"]
            index_latest = index_close.iloc[-1]
            index_prev5 = index_close.iloc[-6] if len(df) >= 6 else index_close.iloc[0]
            index_prev20 = index_close.iloc[-21] if len(df) >= 21 else index_close.iloc[0]

            idx_chg_5d = ((index_latest - index_prev5) / index_prev5) * 100
            idx_chg_20d = ((index_latest - index_prev20) / index_prev20) * 100

            rs_ratio_5d = (1 + chg_5d / 100) / (1 + idx_chg_5d / 100) if (1 + idx_chg_5d / 100) > 0 else 1.0
            rs_ratio_20d = (1 + chg_20d / 100) / (1 + idx_chg_20d / 100) if (1 + idx_chg_20d / 100) > 0 else 1.0

        # ---- 量能与成交额分析 ----
        avg_vol_20  = volume.rolling(20).mean().iloc[-2]
        vol_ratio   = min(float(latest["Volume"] / avg_vol_20) if avg_vol_20 > 0 else 0, 20.0)
        turnover    = float(latest["Close"] * latest["Volume"])

        # ---- 均线多头排列判断 ----
        ma_bullish = (
            latest["MA5"] > latest["MA10"] > latest["MA20"]
            and latest["Close"] > latest["MA5"]
            and latest["Close"] > latest["MA60"]
        )

        # ---- 突破颈线 (带数据长度保护) ----
        lookback = min(cfg["breakout_lookback_days"], len(df) - 1)
        high_20 = df["High"].iloc[-lookback-1:-1].max() if lookback >= 5 else latest["High"]
        breakout = latest["Close"] > high_20

        # ---- 近期跌破 MA20 检测 (10天窗口，替代单日判断) ----
        recently_below_ma20 = any(
            df.iloc[-i]["Close"] < df.iloc[-i]["MA20"]
            for i in range(2, min(11, len(df)))
            if not pd.isna(df.iloc[-i]["MA20"])
        )

        # ---- 3.2 低风险模式：提高信号阈值 ----
        vol_percentile = volume.iloc[-61:].rank(pct=True).iloc[-1] if len(volume) >= 61 else 0.5
        state_key = "low_risk" if trading_state == "low_risk" else "default"
        vol_percentile_threshold = cfg["vol_percentile_threshold"][state_key]
        breakout_vol_spike = vol_percentile > vol_percentile_threshold
        
        accum_spike_threshold = cfg["accum_spike_threshold"][state_key]
        rs_threshold = cfg["rs_threshold"][state_key]

        accum_vol_spike = vol_ratio > accum_spike_threshold
        is_strong = rs_ratio_5d > rs_threshold

        # ---- ATR 波动率过滤 ----
        atr_period = cfg["atr_period"]
        tr1 = df['High'] - df['Low']
        tr2 = (df['High'] - df['Close'].shift(1)).abs()
        tr3 = (df['Low'] - df['Close'].shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr_series = tr.rolling(window=atr_period).mean()
        atr_pct = (atr_series.iloc[-1] / latest['Close']) * 100 if len(df) >= atr_period else 3.0

        # ---- 潜伏区趋势底部确认条件 ----
        low_60d = df['Low'].iloc[-61:-1].min() if len(df) >= 61 else df['Low'].min()
        price_above_floor = latest['Close'] > low_60d * cfg["low_60d_floor_multiplier"]
        
        # 检查近 5 日是否有至少 2 天上涨且低点抬高
        recent_days = cfg["recent_days_count"]
        if len(df) >= (recent_days + 1):
            up_days = int((df['Close'].diff().iloc[-recent_days:] > 0).sum())
            lows_rising = bool(df['Low'].iloc[-1] > df['Low'].iloc[-recent_days])
        else:
            up_days = cfg["up_days_min"]
            lows_rising = True

        # ---- 情感值计算 (融合个股 yfinance 舆情和 Waneye 板块舆情) ----
        sentiment_val = None
        sentiment_source = None
        news_freshness = None
        latest_headline = ""

        if sentiment_data is not None:
            # We are in pre-fetch mode. If symbol is missing, use default fallback sentinel
            s_dict = sentiment_data.get(symbol, {})
            if isinstance(s_dict, dict):
                sentiment_val = s_dict.get("sentiment_value")
                sentiment_source = s_dict.get("sentiment_source")
                news_freshness = s_dict.get("news_freshness")
                latest_headline = s_dict.get("latest_headline", "")
            else:
                sentiment_val = s_dict
                sentiment_source = "news" if s_dict != 0.0 else None
                news_freshness = 1.0 if s_dict != 0.0 else None
        else:
            # Not in pre-fetch mode: fetch on demand
            s_dict = fetch_ticker_news_sentiment(symbol)
            sentiment_val = s_dict.get("sentiment_value")
            sentiment_source = s_dict.get("sentiment_source")
            news_freshness = s_dict.get("news_freshness")
            latest_headline = s_dict.get("latest_headline", "")

        # 融合机制：仅当 sentiment_val 为 None 时，才退回到板块情绪
        if sentiment_val is None:
            if waneye_sector_sent:
                sym_clean = symbol.replace(".AX", "")
                for sec_name, symbols in SECTORS.items():
                    clean_sector_symbols = [s.replace(".AX", "") for s in symbols]
                    if sym_clean in clean_sector_symbols:
                        sentiment_val = waneye_sector_sent.get(sec_name, 0.0)
                        sentiment_source = "sector"
                        news_freshness = 1.0
                        break
            if sentiment_val is None:
                sentiment_val = 0.0
                sentiment_source = "fallback"
                news_freshness = 0.0

        # 新增新鲜度衰减检测对于坏消息的限制
        has_bad_news = sentiment_val < cfg["sentiment_bad_threshold"] and (news_freshness is None or news_freshness > cfg["freshness_bad_threshold"])
        has_good_news = (sentiment_val is not None) and (sentiment_val > cfg["sentiment_good_threshold"]) and (news_freshness is not None) and (news_freshness > cfg["freshness_good_threshold"])
        
        signal = "观望"
        zone = "neutral"

        # ---- 空头预警信号计算 ----
        # 均线死叉（空头排列）
        ma_bearish = (
            not pd.isna(latest["MA5"]) and not pd.isna(latest["MA10"]) and not pd.isna(latest["MA20"])
            and latest["MA5"] < latest["MA10"]
            and latest["MA10"] < latest["MA20"]
            and latest["Close"] < latest["MA5"]
        )

        # 今日放量下跌（量比 > 1.0 且当日收跌）
        bear_vol_spike = vol_ratio > 1.0 and chg_pct < 0

        # 5日加速下跌
        sharp_decline_5d = chg_5d < -8.0

        # 高位回落：RSI > 65 且今日跌幅 > -2%（疑似高位获利了结）
        high_rsi_reversal = rsi_val > 65 and chg_pct < -2.0

        # 主跌浪核心条件：均线空排 + 放量下跌 + 跑输大盘 + 近5日累计亏损
        is_distribution = (
            ma_bearish
            and bear_vol_spike
            and rs_ratio_5d < 1.0
            and chg_5d < -3.0
        )

        # 疑似出货区（不要求完整均线空排，但有高位崩盘或加速下跌迹象）
        is_distribution_lite = (
            (high_rsi_reversal or sharp_decline_5d)
            and bear_vol_spike
            and not is_distribution
        )

        # 跌破20日低点（颈线失守）且均线死叉
        low_20 = df["Low"].iloc[-21:-1].min() if len(df) >= 21 else df["Low"].min()
        breakdown_below_support = latest["Close"] < low_20 and ma_bearish

        # 分配空头信号
        bear_signal = None
        bear_zone = "neutral"

        # 主升浪必须包含 breakout，且至少满足其余 3 个条件中的 2 个，并且满足 ATR 波动率过滤
        is_momentum = breakout and sum([ma_bullish, breakout_vol_spike, is_strong]) >= cfg["momentum_ma_conditions_min"] and atr_pct > cfg["atr_pct_threshold"]

        # 潜伏区 — 结合趋势底部确认条件与企稳迹象
        is_accum = (
            recently_below_ma20
            and accum_vol_spike
            and chg_pct > 0
            and rs_ratio_5d > rs_threshold
            and price_above_floor
            and (up_days >= cfg["up_days_min"] or lows_rising)
        )

        # V 型反转检测 — 前期深跌后突然放量大涨收复均线
        is_v_reversal = (
            chg_pct > cfg["v_reversal_chg_pct_min"] and
            chg_5d < cfg["v_reversal_chg_5d_max"] and
            vol_ratio > cfg["v_reversal_vol_ratio_min"] and
            latest["Close"] > latest["MA20"]
        )

        # RSI 超买警告
        rsi_overbought = rsi_val > cfg["rsi_overbought_threshold"]

        if is_v_reversal and not has_bad_news:
            if is_momentum:
                signal = "V型反转+突破 ⚡▶"
            else:
                signal = "V型反转 ⚡"
            zone = "momentum"
        elif is_momentum:
            if not has_bad_news:
                signal = "主升浪 ▶"
                zone = "momentum"
                if rsi_overbought:
                    signal = "主升浪(超买) ▶"
            else:
                signal = "形态突破(利空降级)"
                zone = "watch"
        elif is_accum:
            if not has_bad_news:
                signal = "潜伏区 ◉"
                zone = "accumulation"
            else:
                signal = "底部放量(利空降级)"
                zone = "watch"
        elif ma_bullish:
            if has_good_news:
                signal = "消息共振 ◉"
                zone = "accumulation"
            else:
                signal = "多头排列"
                zone = "watch"

        # ---- 空头信号分配 ----
        if is_distribution:
            if has_bad_news:
                bear_signal = "主跌浪 ↓"
            else:
                bear_signal = "主跌浪(待确认) ↓"
            bear_zone = "distribution"
        elif is_distribution_lite:
            bear_signal = "疑似出货区 ↓"
            bear_zone = "distribution_lite"
        elif breakdown_below_support:
            bear_signal = "死亡交叉 ✗"
            bear_zone = "distribution_lite"
        elif has_bad_news and zone in ("watch", "neutral"):
            bear_signal = "利空共振 ↓"
            bear_zone = "distribution_lite"

        # ---- 10. 成交额与流动性过滤 ----
        avg_turnover_20d = float((df["Close"] * df["Volume"]).rolling(20).mean().iloc[-1]) if len(df) >= 20 else turnover
        
        MIN_TURNOVER_TIER2 = cfg["turnover_tier2_limit"]
        MIN_TURNOVER_TIER3 = cfg["turnover_tier3_limit"]
        
        liquidity_tag = None
        if avg_turnover_20d < MIN_TURNOVER_TIER3:
            liquidity_tag = "极低流动性"
        elif avg_turnover_20d < MIN_TURNOVER_TIER2:
            liquidity_tag = "低流动性"

        # 信号降级与风险警告附加标记
        if liquidity_tag == "极低流动性":
            if zone in ("momentum", "accumulation"):
                zone = "watch"
                signal = "观望"
        else:
            # 应用低/中/高风险状态轻仓标记 (风控不熔断推荐)
            if trading_state in ("low_risk", "medium_risk", "high_risk"):
                if signal in ("主升浪 ▶", "主升浪(超买) ▶"):
                    signal = "主升浪 (轻仓)"
                elif signal == "潜伏区 ◉":
                    signal = "潜伏区 (轻仓)"
            
            # 附加低流动性标记
            if liquidity_tag == "低流动性":
                if zone in ("momentum", "accumulation"):
                    signal = signal + " (低流动性)"

        ai_insight = generate_ai_insight(symbol, chg_pct, chg_5d, vol_ratio, zone, ma_bullish, breakout, rs_ratio_5d, sentiment_val, latest_headline, trading_state, rsi_val)

        return {
            "symbol":           symbol.replace(".AX", ""),
            "price":            round(float(latest["Close"]), 2),
            "chg_pct":          round(chg_pct, 2),
            "chg_5d":           round(chg_5d, 2),
            "volume":           f"{float(latest['Volume'])/1e6:.1f}M",
            "vol_ratio":        round(vol_ratio, 2),
            "turnover":         turnover,
            "rs_ratio_5d":      round(rs_ratio_5d, 3),
            "rs_ratio_20d":     round(rs_ratio_20d, 3),
            "rsi":              round(rsi_val, 1),
            "news_sentiment":   round(sentiment_val, 2),
            "sentiment_value":  round(sentiment_val, 2),
            "sentiment_source": sentiment_source,
            "news_freshness":   news_freshness,
            "latest_headline":  latest_headline,
            "signal":           signal,
            "zone":             zone,
            "ma_bullish":       bool(ma_bullish),
            "breakout":         bool(breakout),
            "ai_insight":       ai_insight,
            # ---- 空头预警字段 ----
            "bear_signal":      bear_signal,
            "bear_zone":        bear_zone,
            "ma_bearish":       bool(ma_bearish),
        }
    except Exception as e:
        print(f"  Error analyzing {symbol}: {e}")
        return None

def generate_ai_insight(symbol, chg, chg_5d, vol_ratio, zone, ma_bullish, breakout, rs_ratio_5d, news_sentiment=0.0, latest_headline="", trading_state="active", rsi=50.0):
    """根据量化指标及消息面倾向生成规则式AI点评"""
    sym = symbol.replace(".AX", "")
    insights = []

    # 相对大盘表现前缀
    rs_desc = ""
    if rs_ratio_5d > 1.05:
        rs_desc = "大幅跑赢大盘，"
    elif rs_ratio_5d > 1.01:
        rs_desc = "走势强于大盘，"

    # RSI 描述
    rsi_desc = ""
    if rsi > 75:
        rsi_desc = f"RSI({rsi:.0f})进入超买区间，追高需谨慎。"
    elif rsi < 30:
        rsi_desc = f"RSI({rsi:.0f})进入超卖区间，反弹概率较大。"

    # 新闻面共振描述
    news_desc = ""
    if latest_headline:
        sent_val = news_sentiment or 0.0
        if sent_val > 0.2:
            news_desc = f"消息面偏向多头（关注焦点：'{latest_headline[:45]}...'），"
        elif sent_val < -0.2:
            news_desc = f"消息面伴有利空忧虑（关注焦点：'{latest_headline[:45]}...'），"
        else:
            news_desc = f"最新动态：'{latest_headline[:45]}...'，"

    low_risk_prefix = "⚠️ [低风险提示：建议轻仓] " if trading_state == "low_risk" else ""

    if zone == "momentum":
        insights.append(f"{low_risk_prefix}🚀 {sym} 技术面突破，成交量放大至 {vol_ratio:.1f}倍。{rs_desc}{news_desc}量价与消息面产生多头共振，短线爆发动能极强。{rsi_desc}")
    elif zone == "accumulation":
        if news_sentiment and news_sentiment > 0.25:
            insights.append(f"{low_risk_prefix}📡 {sym} 处于多头排列，且消息面显著偏多（{news_sentiment:.2f}分），与技术形态形成共振，建议逢低布局。{rsi_desc}")
        else:
            insights.append(f"{low_risk_prefix}📡 {sym} 底部异常放量。{rs_desc}{news_desc}疑似主力资金借利好配合悄然建仓，突破拐点临近。{rsi_desc}")
    elif zone == "watch":
        sent_val = news_sentiment or 0.0
        if sent_val < -0.15:
            insights.append(f"⚠️ {sym} 虽符合多头或突破形态，但最新消息面偏向利空（{sent_val}分），可能遭遇获利回吐，雷达已自动降级预警。")
        else:
            insights.append(f"📊 {sym} 均线多头排列维持，相对大盘强度为 {rs_ratio_5d:.2f}。消息面情绪得分 {sent_val:.1f}，持平偏多，等待资金信号。{rsi_desc}")
    else:
        if chg < -2:
            insights.append(f"⚠️ {sym} 今日下跌 {abs(chg):.1f}%，量价背离，暂时观望为主。{rsi_desc}")
        else:
            insights.append(f"🔵 {sym} 当前无明显异动信号，持续跟踪中。")

    return " ".join(insights)


