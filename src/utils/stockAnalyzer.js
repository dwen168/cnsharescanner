// Quantitative Stock Analyzer implemented in JavaScript
// Replicates the analysis logic of algo_src/stock_analyzer.py

export const FINANCIAL_POLARITY = {
  // Very positive (weight 0.7 to 1.0)
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
  // Positive (weight 0.3 to 0.5)
  "rise": 0.4, "rises": 0.4, "rally": 0.5, "rallies": 0.5, "rebound": 0.5,
  "grow": 0.4, "growth": 0.3, "expand": 0.4, "boost": 0.5, "gain": 0.3,
  "recover": 0.4, "recovery": 0.4, "partnership": 0.5, "positive": 0.5,
  "demand": 0.3, "upside": 0.4, "strength": 0.3, "innovation": 0.3,
  "breakout": 0.5, "outpace": 0.4, "momentum": 0.3,
  "rate cut": 0.5, "rate cuts": 0.5,
  // Negative (weight -0.3 to -0.6)
  "fall": -0.4, "falls": -0.4, "drop": -0.4, "drops": -0.4,
  "cut": -0.5, "cuts": -0.5, "warn": -0.5, "warning": -0.5,
  "price cut": -0.4,
  "risk": -0.4, "sink": -0.6, "sinks": -0.6, "shrink": -0.5,
  "weak": -0.4, "weakness": -0.4, "concern": -0.4, "slip": -0.3, "slips": -0.3,
  "decline": -0.4, "declines": -0.4, "pressure": -0.3, "headwind": -0.4,
  "delay": -0.4, "delays": -0.4, "disappoints": -0.5, "miss": -0.5,
  "margin compression": -0.6, "supply chain disruption": -0.6,
  // Very negative (weight -0.7 to -1.0)
  "loss": -0.8, "losses": -0.8, "slashed": -0.9, "downgrade": -0.8,
  "miss estimate": -0.8, "misses estimate": -0.8, "guidance cut": -0.9,
  "underperform": -0.8, "bearish": -0.8, "collapse": -1.0, "crash": -1.0,
  "probe": -0.7, "lawsuit": -0.6, "fraud": -0.9, "investigation": -0.7,
  "recall": -0.6, "default": -0.9, "bankruptcy": -1.0, "suspension": -0.8,
  "writedown": -0.7, "impairment": -0.7, "plunge": -0.8, "plunges": -0.8,
  "tumble": -0.7, "tumbles": -0.7, "sell-off": -0.7,
};

export function calculateSentimentScore(titleText) {
  if (!titleText) return 0.0;
  const titleLower = titleText.toLowerCase();
  
  const sortedPhrases = Object.keys(FINANCIAL_POLARITY).sort((a, b) => b.length - a.length);
  const spans = [];
  let score = 0.0;
  let matches = 0;
  
  const NEGATION_WORDS = ['not', 'no', 'never', 'unlikely', 'fails to', 'without'];
  
  for (const phrase of sortedPhrases) {
    let start = 0;
    while (true) {
      const idx = titleLower.indexOf(phrase, start);
      if (idx === -1) break;
      
      let overlap = false;
      for (const [s_start, s_end] of spans) {
        if (!(idx + phrase.length <= s_start || idx >= s_end)) {
          overlap = true;
          break;
        }
      }
      
      if (!overlap) {
        spans.push([idx, idx + phrase.length]);
        
        const precedingText = titleLower.substring(0, idx).trim();
        // Regex word extraction
        const words = precedingText.match(/\b\w+\b/g) || [];
        const last3Words = words.slice(-3);
        
        let negated = false;
        for (const neg of NEGATION_WORDS) {
          if (last3Words.includes(neg)) {
            negated = true;
            break;
          }
          if (neg.includes(' ')) {
            if (precedingText.endsWith(neg) || precedingText.includes(neg + ' ')) {
              negated = true;
              break;
            }
          }
        }
        
        let val = FINANCIAL_POLARITY[phrase];
        if (negated) {
          val = -val;
        }
        
        score += val;
        matches += 1;
      }
      
      start = idx + 1;
    }
  }
  
  if (matches === 0) return 0.0;
  return parseFloat((score / matches).toFixed(2));
}

export const STRATEGY_CONFIG = {
  min_data_len_initial: 25,
  min_data_len_aligned: 20,
  rsi_period: 14,
  rsi_overbought_threshold: 75,
  rsi_fallback_value: 50.0,
  breakout_lookback_days: 21,
  
  atr_period: 14,
  atr_pct_threshold: 2.0,
  momentum_ma_conditions_min: 2,
  
  vol_percentile_threshold: {
    default: 0.70,
    low_risk: 0.75
  },
  accum_spike_threshold: {
    default: 1.1,
    low_risk: 1.3
  },
  rs_threshold: {
    default: 1.01,
    low_risk: 1.03
  },
  
  low_60d_floor_multiplier: 1.05,
  recent_days_count: 5,
  up_days_min: 2,
  
  v_reversal_chg_pct_min: 3.0,
  v_reversal_chg_5d_max: -5.0,
  v_reversal_vol_ratio_min: 2.0,
  
  sentiment_bad_threshold: -0.15,
  sentiment_good_threshold: 0.25,
  freshness_bad_threshold: 0.3,
  freshness_good_threshold: 0.4,
  
  turnover_tier2_limit: 2000000.0, // AUD 2M
  turnover_tier3_limit: 500000.0,  // AUD 500K
};

/**
 * Calculates rolling average of an array.
 */
function getRollingMean(arr, period) {
  const result = new Array(arr.length).fill(null);
  for (let i = period - 1; i < arr.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += arr[i - j];
    }
    result[i] = sum / period;
  }
  return result;
}

/**
 * Calculates RSI using Wilder's Exponential Smoothing (matches TradingView / Bloomberg)
 * First window uses SMA to seed, then applies exponential smoothing:
 *   avgGain[i] = (avgGain[i-1] * (period-1) + currentGain) / period
 */
function getRSI(prices, period = 14) {
  const rsi = new Array(prices.length).fill(null);
  if (prices.length < period + 1) return rsi;

  const deltas = [];
  for (let i = 1; i < prices.length; i++) {
    deltas.push(prices[i] - prices[i - 1]);
  }

  // Seed: SMA of first `period` deltas
  let avgGain = 0;
  let avgLoss = 0;
  for (let j = 0; j < period; j++) {
    const d = deltas[j];
    if (d > 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) {
    rsi[period] = 100;
  } else {
    const rs = avgGain / avgLoss;
    rsi[period] = 100 - (100 / (1 + rs));
  }

  // Wilder's exponential smoothing for subsequent bars
  for (let i = period + 1; i < prices.length; i++) {
    const d = deltas[i - 1];
    const currentGain = d > 0 ? d : 0;
    const currentLoss = d < 0 ? -d : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }
  return rsi;
}

/**
 * Calculates Average True Range (ATR)
 */
function getATR(highs, lows, closes, period = 14) {
  const tr = new Array(closes.length).fill(0);
  tr[0] = highs[0] - lows[0];
  for (let i = 1; i < closes.length; i++) {
    const tr1 = highs[i] - lows[i];
    const tr2 = Math.abs(highs[i] - closes[i - 1]);
    const tr3 = Math.abs(lows[i] - closes[i - 1]);
    tr[i] = Math.max(tr1, tr2, tr3);
  }
  return getRollingMean(tr, period);
}

/**
 * AI Insight Generator
 */
export function generateAiInsightJS({
  symbol,
  chg_pct,
  chg_5d,
  vol_ratio,
  zone,
  ma_bullish,
  breakout,
  rs_ratio_5d,
  sentiment_val,
  latest_headline,
  trading_state,
  rsi_val,
  bear_zone,
  bear_signal
}) {
  const is_low_risk = trading_state === "low_risk";
  const sym = symbol.replace(".AX", "");

  // RS description prefix (matches Python generate_ai_insight)
  let rs_desc = "";
  if (rs_ratio_5d > 1.05) {
    rs_desc = "大幅跑赢大盘，";
  } else if (rs_ratio_5d > 1.01) {
    rs_desc = "走势强于大盘，";
  } else if (rs_ratio_5d < 0.95) {
    rs_desc = "走势显著弱于大盘，";
  }

  // RSI description
  let rsi_desc = "";
  if (rsi_val > 75) {
    rsi_desc = `RSI(${rsi_val.toFixed(0)})进入超买区间，追高需谨慎。`;
  } else if (rsi_val < 30) {
    rsi_desc = `RSI(${rsi_val.toFixed(0)})进入超卖区间，反弹概率较大。`;
  }

  // News description
  let news_desc = "";
  if (latest_headline && latest_headline.trim()) {
    const sent_val = sentiment_val || 0.0;
    const hl = latest_headline.substring(0, 45);
    if (sent_val > 0.2) {
      news_desc = `消息面偏向多头（关注焦点：'${hl}...'），`;
    } else if (sent_val < -0.2) {
      news_desc = `消息面伴有利空忧虑（关注焦点：'${hl}...'），`;
    } else {
      news_desc = `最新动态：'${hl}...'，`;
    }
  }

  const low_risk_prefix = is_low_risk ? "⚠️ [低风险提示：建议轻仓] " : "";

  let text = "";
  // First check if there is a bearish warning signal to prevent contradiction (e.g. FMG in distribution)
  if (bear_zone && bear_zone !== "neutral") {
    if (bear_zone === "distribution") {
      text = `🔴 ${sym} 触发主跌浪预警，当前处于派发区（${bear_signal}）。${rs_desc}${news_desc}均线系统空头排列维持，今日跌幅达 ${Math.abs(chg_pct).toFixed(1)}%，量比 ${vol_ratio.toFixed(1)}，建议规避风险。${rsi_desc}`;
    } else {
      text = `⚠️ ${sym} 触发空头预警信号（${bear_signal}）。${rs_desc}${news_desc}技术形态转弱，跌破支持位或处于疑似出货期，追高风险极高。${rsi_desc}`;
    }
  } else if (zone === "momentum") {
    text = `${low_risk_prefix}🚀 ${sym} 技术面突破，成交量放大至 ${vol_ratio.toFixed(1)}倍。${rs_desc}${news_desc}量价与消息面产生多头共振，短线爆发动能极强。${rsi_desc}`;
  } else if (zone === "accumulation") {
    if (sentiment_val && sentiment_val > 0.25) {
      text = `${low_risk_prefix}📡 ${sym} 处于多头排列，且消息面显著偏多（${sentiment_val.toFixed(2)}分），与技术形态形成共振，建议逢低布局。${rsi_desc}`;
    } else {
      text = `${low_risk_prefix}📡 ${sym} 底部异常放量。${rs_desc}${news_desc}疑似主力资金借利好配合悄然建仓，突破拐点临近。${rsi_desc}`;
    }
  } else if (zone === "watch") {
    const sent_val = sentiment_val || 0.0;
    if (sent_val < -0.15) {
      text = `⚠️ ${sym} 虽符合多头或突破形态，但最新消息面偏向利空（${sent_val.toFixed(2)}分），可能遭遇获利回吐，雷达已自动降级预警。`;
    } else {
      text = `📊 ${sym} 均线多头排列维持，相对大盘强度为 ${rs_ratio_5d.toFixed(2)}。消息面情绪得分 ${sent_val.toFixed(1)}，持平偏多，等待资金信号。${rsi_desc}`;
    }
  } else {
    if (chg_pct < -2) {
      text = `⚠️ ${sym} 今日下跌 ${Math.abs(chg_pct).toFixed(1)}%，量价背离，暂时观望为主。${rsi_desc}`;
    } else {
      text = `🔵 ${sym} 当前无明显异动信号，持续跟踪中。`;
    }
  }

  return text;
}

/**
 * Performs complete technical and signal analysis on loaded stock price history
 * @param {string} symbol - Stock symbol
 * @param {object} stockChart - Yahoo Finance Chart result
 * @param {object} indexChart - Yahoo Finance Chart result for ^AORD or ^AXJO
 * @param {string} trading_state - 'active' | 'low_risk' | 'medium_risk' | 'halted'
 * @param {number} customSentiment - Optional news sentiment override
 * @param {string} customHeadline - Optional latest news headline
 */
export function analyzeStockJS(symbol, stockChart, indexChart = null, trading_state = "active", customSentiment = 0.0, customHeadline = "") {
  try {
    const cfg = STRATEGY_CONFIG;
    if (!stockChart || !stockChart.timestamp || stockChart.timestamp.length < cfg.min_data_len_initial) {
      return { error: `Insufficient data points (Need at least ${cfg.min_data_len_initial} days)` };
    }

    const timestamps = stockChart.timestamp;
    const closes = stockChart.indicators.quote[0].close;
    const volumes = stockChart.indicators.quote[0].volume;
    const highs = stockChart.indicators.quote[0].high;
    const lows = stockChart.indicators.quote[0].low;
    const opens = stockChart.indicators.quote[0].open;

    // Clean nulls
    const df = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] !== null && closes[i] !== undefined && volumes[i] !== null && volumes[i] !== undefined && highs[i] !== null && lows[i] !== null) {
        df.push({
          timestamp: timestamps[i],
          Close: closes[i],
          High: highs[i],
          Low: lows[i],
          Open: opens[i] || closes[i],
          Volume: volumes[i]
        });
      }
    }

    if (df.length < cfg.min_data_len_aligned) {
      return { error: `Insufficient clean data points (Need at least ${cfg.min_data_len_aligned} days)` };
    }

    const dfCloses = df.map(x => x.Close);
    const dfHighs = df.map(x => x.High);
    const dfLows = df.map(x => x.Low);
    const dfVolumes = df.map(x => x.Volume);

    // Calc MAs
    const ma5 = getRollingMean(dfCloses, 5);
    const ma10 = getRollingMean(dfCloses, 10);
    const ma20 = getRollingMean(dfCloses, 20);
    const ma60 = dfCloses.length >= 60 ? getRollingMean(dfCloses, 60) : ma20;

    // Calc RSI
    const rsi = getRSI(dfCloses, cfg.rsi_period);

    const N = df.length;
    const latest = df[N - 1];
    const prev = df[N - 2];
    const prev5 = N >= 6 ? df[N - 6] : df[0];
    const prev20 = N >= 21 ? df[N - 21] : df[0];

    const chg_pct = ((latest.Close - prev.Close) / prev.Close) * 100;
    const chg_5d = ((latest.Close - prev5.Close) / prev5.Close) * 100;
    const chg_20d = ((latest.Close - prev20.Close) / prev20.Close) * 100;

    // Relative strength vs Index
    let rs_ratio_5d = 1.0;
    let rs_ratio_20d = 1.0;
    
    if (indexChart && indexChart.timestamp && indexChart.timestamp.length >= 5) {
      const idxCloses = indexChart.indicators.quote[0].close.filter(x => x !== null);
      if (idxCloses.length >= 21) {
        const idxLatest = idxCloses[idxCloses.length - 1];
        const idxPrev5 = idxCloses[idxCloses.length - 6];
        const idxPrev20 = idxCloses[idxCloses.length - 21];

        const idx_chg_5d = ((idxLatest - idxPrev5) / idxPrev5) * 100;
        const idx_chg_20d = ((idxLatest - idxPrev20) / idxPrev20) * 100;

        rs_ratio_5d = (1 + chg_5d / 100) / (1 + idx_chg_5d / 100);
        rs_ratio_20d = (1 + chg_20d / 100) / (1 + idx_chg_20d / 100);
      }
    }

    // Volume ratio (compared to 20d average volume of previous days)
    let avg_vol_20 = 0;
    if (N >= 21) {
      let sum = 0;
      for (let i = N - 21; i < N - 1; i++) {
        sum += dfVolumes[i];
      }
      avg_vol_20 = sum / 20;
    } else {
      let sum = 0;
      for (let i = 0; i < N - 1; i++) {
        sum += dfVolumes[i];
      }
      avg_vol_20 = sum / (N - 1 || 1);
    }
    const vol_ratio = avg_vol_20 > 0 ? latest.Volume / avg_vol_20 : 0;
    const turnover = latest.Close * latest.Volume;

    // MA Bullish Alignment
    const latestMA5 = ma5[N - 1];
    const latestMA10 = ma10[N - 1];
    const latestMA20 = ma20[N - 1];
    const latestMA60 = ma60[N - 1];

    const ma_bullish = 
      latestMA5 > latestMA10 && 
      latestMA10 > latestMA20 && 
      latest.Close > latestMA5 && 
      latest.Close > latestMA60;

    // Breakout Neckline (20-day high before today)
    // Requires close to exceed the prior high by at least 0.5% to filter noise
    const lookback = Math.min(cfg.breakout_lookback_days, N - 1);
    let high_20 = latest.High;
    if (lookback >= 5) {
      let maxH = -Infinity;
      for (let i = N - lookback - 1; i < N - 1; i++) {
        if (dfHighs[i] > maxH) maxH = dfHighs[i];
      }
      high_20 = maxH;
    }
    const breakoutMargin = 0.005; // 0.5% minimum penetration above resistance
    const breakout = latest.Close > high_20 * (1 + breakoutMargin) && vol_ratio > 1.0;

    // Recently below MA20 (10-day window including yesterday)
    let recently_below_ma20 = false;
    const checkDays = Math.min(10, N - 1);
    for (let i = 1; i <= checkDays; i++) {
      const idx = N - i;
      if (ma20[idx] !== null && dfCloses[idx] < ma20[idx]) {
        recently_below_ma20 = true;
        break;
      }
    }

    // Vol Percentile — use average-rank method to match pandas rank(pct=True)
    let vol_percentile = 0.5;
    const volWindow = Math.min(61, N);
    if (volWindow >= 5) {
      const recentVols = dfVolumes.slice(N - volWindow);
      const sorted = [...recentVols].sort((a, b) => a - b);
      const v = latest.Volume;
      // Count values strictly below and equal to v, average for ties
      let below = 0;
      let equal = 0;
      for (const sv of sorted) {
        if (sv < v) below++;
        else if (sv === v) equal++;
      }
      vol_percentile = (below + (equal + 1) / 2) / sorted.length;
    }

    // Risk threshold configuration
    const state_key = trading_state === "low_risk" ? "low_risk" : "default";
    const vol_percentile_threshold = cfg.vol_percentile_threshold[state_key];
    const breakout_vol_spike = vol_percentile > vol_percentile_threshold;
    const accum_spike_threshold = cfg.accum_spike_threshold[state_key];
    const rs_threshold = cfg.rs_threshold[state_key];

    const accum_vol_spike = vol_ratio > accum_spike_threshold;
    const is_strong = rs_ratio_5d > rs_threshold;

    // ATR
    const atr_series = getATR(dfHighs, dfLows, dfCloses, cfg.atr_period);
    const latestATR = atr_series[N - 1];
    const atr_pct = latestATR ? (latestATR / latest.Close) * 100 : 3.0;

    // Accumulation floor
    const low60Window = Math.min(61, N);
    let low_60d = dfLows[N - 1];
    if (low60Window >= 5) {
      let minL = Infinity;
      for (let i = N - low60Window; i < N - 1; i++) {
        if (dfLows[i] < minL) minL = dfLows[i];
      }
      low_60d = minL;
    }
    const price_above_floor = latest.Close > low_60d * cfg.low_60d_floor_multiplier;

    // Up days / lows rising (past 5 days)
    let up_days = cfg.up_days_min;
    let lows_rising = true;
    if (N >= cfg.recent_days_count + 1) {
      let ups = 0;
      for (let i = N - cfg.recent_days_count; i < N; i++) {
        if (dfCloses[i] > dfCloses[i - 1]) ups++;
      }
      up_days = ups;
      lows_rising = latest.Low > dfLows[N - cfg.recent_days_count - 1];
    }

    // Bad news / good news filter
    const sentiment_val = customSentiment;
    const news_freshness = 1.0; // assume fresh if custom input
    const latest_headline = customHeadline;
    const has_bad_news = sentiment_val < cfg.sentiment_bad_threshold;
    const has_good_news = sentiment_val > cfg.sentiment_good_threshold;

    // Bear indicators
    const ma_bearish = 
      latestMA5 !== null && latestMA10 !== null && latestMA20 !== null &&
      latestMA5 < latestMA10 &&
      latestMA10 < latestMA20 &&
      latest.Close < latestMA5;

    const bear_vol_spike = vol_ratio > 1.0 && chg_pct < 0;
    const sharp_decline_5d = chg_5d < -8.0;
    const high_rsi_reversal = rsi[N - 1] > 65 && chg_pct < -2.0;

    const is_distribution = ma_bearish && bear_vol_spike && rs_ratio_5d < 1.0 && chg_5d < -3.0;
    const is_distribution_lite = (high_rsi_reversal || sharp_decline_5d) && bear_vol_spike && !is_distribution;

    let low_20 = latest.Low;
    if (N >= 21) {
      let minL = Infinity;
      for (let i = N - 21; i < N - 1; i++) {
        if (dfLows[i] < minL) minL = dfLows[i];
      }
      low_20 = minL;
    }
    const breakdown_below_support = latest.Close < low_20 && ma_bearish;

    // V Reversal
    const is_v_reversal = 
      chg_pct > cfg.v_reversal_chg_pct_min &&
      chg_5d < cfg.v_reversal_chg_5d_max &&
      vol_ratio > cfg.v_reversal_vol_ratio_min &&
      latest.Close > latestMA20;

    const is_momentum = 
      breakout && 
      (Number(ma_bullish) + Number(breakout_vol_spike) + Number(is_strong)) >= cfg.momentum_ma_conditions_min && 
      atr_pct > cfg.atr_pct_threshold;

    const is_accum = 
      recently_below_ma20 && 
      accum_vol_spike && 
      chg_pct > 0 && 
      rs_ratio_5d > rs_threshold && 
      price_above_floor && 
      (up_days >= cfg.up_days_min || lows_rising);

    const rsi_overbought = rsi[N - 1] > cfg.rsi_overbought_threshold;

    let signal = "观望";
    let zone = "watch";

    if (is_v_reversal && !has_bad_news) {
      signal = "V型反转 ⚡";
      zone = "momentum";
    } else if (is_momentum) {
      if (!has_bad_news) {
        signal = rsi_overbought ? "主升浪(超买) ▶" : "主升浪 ▶";
        zone = "momentum";
      } else {
        signal = "形态突破(利空降级)";
        zone = "watch";
      }
    } else if (is_accum) {
      if (!has_bad_news) {
        signal = "潜伏区 ◉";
        zone = "accumulation";
      } else {
        signal = "底部放量(利空降级)";
        zone = "watch";
      }
    } else if (ma_bullish) {
      if (has_good_news) {
        signal = "消息共振 ◉";
        zone = "accumulation";
      } else {
        signal = "多头排列";
        zone = "watch";
      }
    } else {
      zone = "neutral";
    }

    const was_technically_bullish = is_momentum || is_accum || is_v_reversal;
    const has_technical_weakness = chg_pct < 0 || chg_5d < 0 || latest.Close < latestMA20;

    // Bear signal allocation
    let bear_signal = null;
    let bear_zone = "neutral";

    if (is_distribution) {
      bear_signal = has_bad_news ? "主跌浪 ↓" : "主跌浪(待确认) ↓";
      bear_zone = "distribution";
    } else if (is_distribution_lite) {
      bear_signal = "疑似出货区 ↓";
      bear_zone = "distribution_lite";
    } else if (breakdown_below_support) {
      bear_signal = "死亡交叉 ✗";
      bear_zone = "distribution_lite";
    } else if (has_bad_news && has_technical_weakness && !was_technically_bullish && (zone === "watch" || zone === "neutral")) {
      bear_signal = "利空共振 ↓";
      bear_zone = "distribution_lite";
    }

    // Turnover / liquidity
    let avg_turnover_20d = turnover;
    if (N >= 20) {
      let sum = 0;
      for (let i = N - 20; i < N; i++) {
        sum += df[i].Close * df[i].Volume;
      }
      avg_turnover_20d = sum / 20;
    }
    const MIN_TURNOVER_TIER2 = cfg.turnover_tier2_limit;
    const MIN_TURNOVER_TIER3 = cfg.turnover_tier3_limit;

    let liquidity_tag = null;
    if (avg_turnover_20d < MIN_TURNOVER_TIER3) {
      liquidity_tag = "极低流动性";
    } else if (avg_turnover_20d < MIN_TURNOVER_TIER2) {
      liquidity_tag = "低流动性";
    }

    if (liquidity_tag === "极低流动性") {
      if (zone === "momentum" || zone === "accumulation") {
        zone = "watch";
        signal = "观望";
      }
    } else {
      if (["low_risk", "medium_risk", "high_risk"].includes(trading_state)) {
        if (signal === "主升浪 ▶" || signal === "主升浪(超买) ▶") {
          signal = "主升浪 (轻仓)";
        } else if (signal === "潜伏区 ◉") {
          signal = "潜伏区 (轻仓)";
        }
      }

      if (liquidity_tag === "低流动性") {
        if (zone === "momentum" || zone === "accumulation") {
          signal = signal + " (低流动性)";
        }
      }
    }

    const rsiVal = rsi[N - 1] || cfg.rsi_fallback_value;

    const ai_insight = generateAiInsightJS({
      symbol,
      chg_pct,
      chg_5d,
      vol_ratio,
      zone,
      ma_bullish,
      breakout,
      rs_ratio_5d,
      sentiment_val,
      latest_headline,
      trading_state,
      rsi_val: rsiVal,
      bear_zone,
      bear_signal
    });

    // Compute ATR trailing stop values (Chandelier Exit) chronologically
    const atrTrailingStops = new Array(N).fill(null);
    let currentStop = null;
    const stopLookback = 22; // Chandelier Exit standard lookback
    const stopMultiplier = 3.0;
    for (let i = 0; i < N; i++) {
      if (atr_series[i] === null || atr_series[i] === undefined || isNaN(atr_series[i])) {
        atrTrailingStops[i] = null;
        continue;
      }
      const startIdx = Math.max(0, i - stopLookback + 1);
      let highestHigh = dfHighs[startIdx];
      for (let j = startIdx + 1; j <= i; j++) {
        if (dfHighs[j] > highestHigh) {
          highestHigh = dfHighs[j];
        }
      }
      const candidate = highestHigh - stopMultiplier * atr_series[i];
      if (currentStop === null) {
        currentStop = candidate;
      } else {
        if (dfCloses[i] < currentStop) {
          // Reset stop since price closed below it (stop triggered)
          currentStop = candidate;
        } else {
          // Trailing stop can only move up
          currentStop = Math.max(currentStop, candidate);
        }
      }
      atrTrailingStops[i] = parseFloat(currentStop.toFixed(2));
    }

    // Structure history for chart drawing (last 30 days)
    const startIdx = Math.max(0, N - 30);
    const history30 = df.slice(-30).map((day, idx) => {
      const globalIdx = startIdx + idx;
      return {
        date: new Date(day.timestamp * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        close: day.Close,
        high: day.High,
        low: day.Low,
        open: day.Open,
        volume: day.Volume,
        ma5: ma5[globalIdx],
        ma10: ma10[globalIdx],
        ma20: ma20[globalIdx],
        ma60: ma60[globalIdx],
        atr_trailing_stop: atrTrailingStops[globalIdx]
      };
    });

    // Calculate average ATR percentage over history
    let atrPctSum = 0;
    let validCount = 0;
    for (let i = 0; i < N; i++) {
      if (atr_series[i] !== null && dfCloses[i] > 0) {
        atrPctSum += (atr_series[i] / dfCloses[i]) * 100;
        validCount++;
      }
    }
    const avgAtrPct = validCount > 0 ? parseFloat((atrPctSum / validCount).toFixed(2)) : 2.5;

    let volType = 'moderate';
    let recTrailingStop = 15;
    let recBreakeven = 30;

    if (avgAtrPct < 1.8) {
      volType = 'low';
      recTrailingStop = 10;
      recBreakeven = 20;
    } else if (avgAtrPct > 3.5) {
      volType = 'high';
      recTrailingStop = 20;
      recBreakeven = 40;
    }

    return {
      type: 'classic',
      symbol: symbol.replace(".AX", ""),
      volatility_metrics: {
        avg_atr_pct: avgAtrPct,
        volatility_type: volType,
        rec_trailing_stop: recTrailingStop,
        rec_breakeven: recBreakeven
      },
      price: parseFloat(latest.Close.toFixed(2)),
      chg_pct: parseFloat(chg_pct.toFixed(2)),
      chg_5d: parseFloat(chg_5d.toFixed(2)),
      volume: `${(latest.Volume / 1e6).toFixed(2)}M`,
      vol_ratio: parseFloat(vol_ratio.toFixed(2)),
      turnover: turnover,
      rs_ratio_5d: parseFloat(rs_ratio_5d.toFixed(3)),
      rs_ratio_20d: parseFloat(rs_ratio_20d.toFixed(3)),
      rsi: parseFloat(rsiVal.toFixed(1)),
      news_sentiment: parseFloat(sentiment_val.toFixed(2)),
      sentiment_value: parseFloat(sentiment_val.toFixed(2)),
      latest_headline: latest_headline,
      signal: signal,
      zone: zone,
      ma_bullish: ma_bullish,
      breakout: breakout,
      ai_insight: ai_insight,
      bear_signal: bear_signal,
      bear_zone: bear_zone,
      liquidity_tag: liquidity_tag,
      data_quality: {
        status: N < 60 ? 'warning' : 'good',
        message_zh: N < 60 ? '历史数据不足 60 天。MA60 指标已降级为 MA20，部分趋势判断可能不够准确。' : null,
        message_en: N < 60 ? 'Less than 60 days of historical data available. MA60 has degraded to MA20; trend diagnosis might be less accurate.' : null
      },
      chart_history: history30
    };
  } catch (err) {
    return { error: `Analysis failed: ${err.message}` };
  }
}
