import { getRollingMean, getRollingStd, getATR, getRSI, findPivotLevels, clusterLevels, getFallbackPivotResistance, getMACD, detectMACDDivergences, computeRecencyWeight } from './core/indicators';
import { WyckoffContext } from './core/context';
import { detectClimax } from './detectors/climax';
import { detectAutomatic } from './detectors/automatic';
import { detectTests } from './detectors/tests';
import { detectAccumulation } from './detectors/accumulation';
import { detectStrength } from './detectors/strength';
import { detectWeakness } from './detectors/weakness';
import { detectDistribution } from './detectors/distribution';
import { computeSubphase } from './phase/subphase';

// ─────────────────────────────────────────────────────────────────────────────
// Private helper functions extracted from analyzeWyckoff for testability
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cleans raw stockChart data into a flat df[] array, filtering out null/undefined bars.
 * Returns { df, error } — error is set if there are not enough clean rows.
 */
function buildDataFrame(stockChart, minRequiredDays) {
  if (!stockChart || !stockChart.timestamp || stockChart.timestamp.length < minRequiredDays) {
    return { df: null, error: `Insufficient data points (Need at least ${minRequiredDays} days)` };
  }

  const timestamps = stockChart.timestamp;
  const closes  = stockChart.indicators.quote[0].close;
  const volumes = stockChart.indicators.quote[0].volume;
  const highs   = stockChart.indicators.quote[0].high;
  const lows    = stockChart.indicators.quote[0].low;
  const opens   = stockChart.indicators.quote[0].open;

  const df = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (
      closes[i]  !== null && closes[i]  !== undefined &&
      volumes[i] !== null && volumes[i] !== undefined &&
      highs[i]   !== null && highs[i]   !== undefined &&
      lows[i]    !== null && lows[i]    !== undefined
    ) {
      df.push({
        timestamp: timestamps[i],
        Close:  closes[i],
        High:   highs[i],
        Low:    lows[i],
        Open:   opens[i] || closes[i],
        Volume: volumes[i]
      });
    }
  }

  if (df.length < minRequiredDays) {
    return { df: null, error: `Insufficient clean data points (Need at least ${minRequiredDays} days)` };
  }
  return { df, error: null };
}

/**
 * Computes all technical indicators needed by the Wyckoff analysis.
 * Returns a flat object with all computed arrays.
 */
function computeIndicators(df) {
  const N          = df.length;
  const dfCloses   = df.map(x => x.Close);
  const dfHighs    = df.map(x => x.High);
  const dfLows     = df.map(x => x.Low);
  const dfVolumes  = df.map(x => x.Volume);

  const ma5    = getRollingMean(dfCloses, 5);
  const ma10   = getRollingMean(dfCloses, 10);
  const ma20   = getRollingMean(dfCloses, 20);
  const ma60   = N >= 60  ? getRollingMean(dfCloses, 60)  : getRollingMean(dfCloses, 20);
  const ma120  = N >= 120 ? getRollingMean(dfCloses, 120) : ma60;

  const atr      = getATR(dfHighs, dfLows, dfCloses, 14);
  const rsi      = getRSI(dfCloses, 14);
  const avgVol20 = getRollingMean(dfVolumes, 20);

  // Bollinger Bands & Squeeze
  const rollingStd   = getRollingStd(dfCloses, 20, ma20);
  const bbUpper      = new Array(N).fill(null);
  const bbLower      = new Array(N).fill(null);
  const bbBandwidth  = new Array(N).fill(null);
  const isSqueezeArr = new Array(N).fill(false);

  for (let i = 0; i < N; i++) {
    if (rollingStd[i] !== null && ma20[i] !== null) {
      bbUpper[i]     = ma20[i] + 2 * rollingStd[i];
      bbLower[i]     = ma20[i] - 2 * rollingStd[i];
      bbBandwidth[i] = ma20[i] > 0 ? (bbUpper[i] - bbLower[i]) / ma20[i] : 0;
    }
  }
  for (let i = 20; i < N; i++) {
    if (bbBandwidth[i] === null) continue;
    let minBw = Infinity;
    const lookback = Math.min(60, i);
    for (let j = i - lookback; j < i; j++) {
      if (bbBandwidth[j] !== null && bbBandwidth[j] < minBw) minBw = bbBandwidth[j];
    }
    if (minBw !== Infinity) isSqueezeArr[i] = bbBandwidth[i] <= minBw * 1.05;
  }

  // Trailing 1-year range
  const yearlyLookback = Math.min(252, N);
  const yearHigh  = Math.max(...dfHighs.slice(-yearlyLookback));
  const yearLow   = Math.min(...dfLows.slice(-yearlyLookback));
  const yearRange = yearHigh - yearLow || 1;

  const allPivots = findPivotLevels(dfHighs, dfLows, 5);

  return {
    N, dfCloses, dfHighs, dfLows, dfVolumes,
    ma5, ma10, ma20, ma60, ma120,
    atr, rsi, avgVol20,
    bbUpper, bbLower, bbBandwidth, isSqueezeArr,
    yearHigh, yearLow, yearRange,
    allPivots
  };
}

/**
 * Clusters and scores support & resistance candidates.
 * Returns { finalSupport, finalResistance }.
 */
function computeSupportResistance(ctx, ind) {
  const { N, dfCloses, dfHighs, dfLows, atr, allPivots } = ind;
  const currentPriceVal = dfCloses[N - 1];

  const validSupports    = ctx.supportLevels.filter(s =>
    Math.abs(s.price - currentPriceVal) / currentPriceVal <= 0.20 && (N - s.index) <= 150
  );
  const validResistances = ctx.resistanceLevels.filter(r =>
    Math.abs(r.price - currentPriceVal) / currentPriceVal <= 0.20 && (N - r.index) <= 150
  );

  const clusteredPivotLows  = clusterLevels(allPivots.pivotLows,  atr, N - 1);
  const clusteredPivotHighs = clusterLevels(allPivots.pivotHighs, atr, N - 1);

  const allSupportCandidates = [...validSupports];
  clusteredPivotLows.forEach(cp => {
    if (!allSupportCandidates.some(s => Math.abs(s.price - cp.price) / cp.price < 0.015)) {
      allSupportCandidates.push({ price: cp.price, strength: cp.strength, index: cp.index });
    }
  });

  const allResistanceCandidates = [...validResistances];
  clusteredPivotHighs.forEach(cp => {
    if (!allResistanceCandidates.some(r => Math.abs(r.price - cp.price) / cp.price < 0.015)) {
      allResistanceCandidates.push({ price: cp.price, strength: cp.strength, index: cp.index });
    }
  });

  let finalSupport, finalResistance;

  if (allSupportCandidates.length > 0) {
    const scored = allSupportCandidates.map(s => {
      const age = N - s.index;
      return { ...s, score: s.strength * computeRecencyWeight(age) };
    });
    scored.sort((a, b) => b.score - a.score);
    finalSupport = parseFloat(scored[0].price.toFixed(2));
  } else {
    finalSupport = parseFloat(Math.min(...dfLows.slice(-60)).toFixed(2));
  }

  if (allResistanceCandidates.length > 0) {
    const scored = allResistanceCandidates.map(r => {
      const age = N - r.index;
      return { ...r, score: r.strength * computeRecencyWeight(age) };
    });
    scored.sort((a, b) => b.score - a.score);
    finalResistance = parseFloat(scored[0].price.toFixed(2));
  } else {
    finalResistance = parseFloat(Math.max(...dfHighs.slice(-60)).toFixed(2));
  }

  const latestAtr = atr[N - 1] || (dfCloses[N - 1] * 0.02);
  if (finalSupport >= finalResistance) {
    finalSupport = parseFloat((finalResistance - 2 * latestAtr).toFixed(2));
  }

  return { finalSupport, finalResistance };
}

/**
 * Effort-vs-Result analysis over the last ~10 bars.
 * Returns an EVR status object.
 */
function computeEVR(dfCloses, dfVolumes, avgVol20, atr, finalSupport, finalResistance, N) {
  let evrStatus    = 'neutral';
  let evrLabelZh   = '量价均衡';
  let evrLabelEn   = 'Effort-Result Balanced';
  let evrDetailZh  = '最近量价关系表现平稳，符合市场常态。';
  let evrDetailEn  = 'Recent price actions match volume changes, indicating market equilibrium.';

  const evrLookback = Math.min(10, N - 1);

  // Split volume into up-day (close > open) and down-day (close < open) buckets.
  // This lets us distinguish "high volume on down-days near support" (institutional absorption)
  // from "high volume on up-days near resistance" (institutional distribution / stalling effort).
  let upDayHighVolCount   = 0;  // up-close bar with volume above average
  let downDayHighVolCount = 0;  // down-close bar with volume above average
  let risingVolCount      = 0;  // any bar with volume above average
  let flatPriceCount      = 0;  // high-vol bar where price barely moved (effort≠result)

  for (let j = N - evrLookback; j < N; j++) {
    const prevC     = dfCloses[j - 1];
    const curC      = dfCloses[j];
    const curOpen   = dfCloses[j - 1]; // open not directly available; use prior close as proxy
    const curV      = dfVolumes[j];
    const curAvgV   = avgVol20[j] || curV;
    const curDayAtr = atr[j] || (curC * 0.02);

    const volAboveAvg        = curV > curAvgV * 1.1;
    const priceConsolidation = Math.abs(curC - prevC) < curDayAtr * 0.3;
    const isUpDay            = curC > prevC;

    if (volAboveAvg) {
      risingVolCount++;
      if (priceConsolidation) flatPriceCount++;
      if (isUpDay)  upDayHighVolCount++;
      else          downDayHighVolCount++;
    }
  }

  if (risingVolCount >= 3) {
    const currentPrice       = dfCloses[N - 1];
    const distFromSupport    = finalSupport    > 0 ? (currentPrice - finalSupport)    / finalSupport    : 0;
    const distFromResistance = currentPrice    > 0 ? (finalResistance - currentPrice) / currentPrice    : 0;
    const nearSupport        = distFromSupport    < distFromResistance;

    if (flatPriceCount >= 2) {
      // High volume but price barely moved → classic "effort without result"
      if (nearSupport && downDayHighVolCount >= upDayHighVolCount) {
        // Down-day volume dominant near support = buyers absorbing supply (bullish)
        evrStatus   = 'bullish_divergence';
        evrLabelZh  = '有量无跌 (底部吸筹)';
        evrLabelEn  = 'Effort without Fall (Accumulation)';
        evrDetailZh = '最近下跌日成交量显著放大但价格拒绝下跌，显示买盘在支撑位附近积极吸收卖压。';
        evrDetailEn = 'Down-day volume spiked while price held support — institutional absorption of supply.';
      } else if (!nearSupport && upDayHighVolCount >= downDayHighVolCount) {
        // Up-day volume dominant near resistance but price stalls = distribution (bearish)
        evrStatus   = 'bearish_divergence';
        evrLabelZh  = '放量滞涨 (高位派发)';
        evrLabelEn  = 'Effort without Rise (Distribution)';
        evrDetailZh = '最近上涨日成交量显著放大但价格拒绝上涨，显示高位存在强烈的机构抛压（货源派发）。';
        evrDetailEn = 'Up-day volume spiked but price failed to advance — institutional selling near resistance.';
      } else if (nearSupport) {
        // Mixed near support — general absorption signal
        evrStatus   = 'bullish_divergence';
        evrLabelZh  = '有量无跌 (底部吸筹)';
        evrLabelEn  = 'Effort without Fall (Accumulation)';
        evrDetailZh = '最近成交量显著放大但价格拒绝下跌，显示买盘在支撑位附近积极吸收卖压。';
        evrDetailEn = 'Volume increased significantly while price held support, indicating institutional absorption.';
      } else {
        evrStatus   = 'bearish_divergence';
        evrLabelZh  = '放量滞涨 (高位派发)';
        evrLabelEn  = 'Effort without Rise (Distribution)';
        evrDetailZh = '最近成交量显著放大但价格拒绝上涨，显示高位存在强烈的机构抛压（货源派发）。';
        evrDetailEn = 'Volume spiked but price failed to gain ground, indicating strong supply or institutional selling.';
      }
    }
  }

  // Neutral fallback: check low-volume price moves (no demand / no supply)
  // These only apply if the high-volume analysis above did not set a status.
  if (evrStatus === 'neutral') {
    if (dfCloses[N - 1] > dfCloses[N - 5] && avgVol20[N - 1] < avgVol20[N - 5] * 0.8) {
      evrStatus   = 'bearish_divergence_no_demand';
      evrLabelZh  = '无量上涨 (多头力竭)';
      evrLabelEn  = 'No Volume Rally (Lack of Demand)';
      evrDetailZh = '价格虽有反弹，但成交量持续缩减，说明买盘意愿薄弱，属于缺乏买方需求的虚假上涨。';
      evrDetailEn = 'Price drifted upward on declining volume, showing lack of demand and buying exhaustion.';
    } else if (dfCloses[N - 1] < dfCloses[N - 5] && avgVol20[N - 1] < avgVol20[N - 5] * 0.8) {
      evrStatus   = 'bullish_consolidation_no_supply';
      evrLabelZh  = '无量回调 (抛压枯竭)';
      evrLabelEn  = 'Low Volume Pullback (No Supply)';
      evrDetailZh = '近期股价小幅回调但成交量大幅萎缩，表明市场浮动筹码较少，卖方抛压基本枯竭。';
      evrDetailEn = 'Price pulled back on light volume, demonstrating lack of supply and dry selling pressure.';
    }
  }


  return { evrStatus, evrLabelZh, evrLabelEn, evrDetailZh, evrDetailEn };
}

/**
 * Wyckoff phase classification.
 * Returns { phase, confidence }.
 */
function classifyPhase(ctx, ind, evr, finalSupport, finalResistance) {
  const { N, dfCloses, dfHighs, dfLows, ma60, ma120, isSqueezeArr, bbUpper, bbLower, atr } = ind;
  const { evrStatus } = evr;

  const currentPrice   = dfCloses[N - 1];
  const currentMA20    = ind.ma20[N - 1];
  const currentMA60    = ma60[N - 1];
  const currentMA120   = ma120[N - 1];

  const recentEvents    = ctx.events.filter(e => e.index >= N - 40);
  const hasRecentSOS    = recentEvents.some(e => e.event === 'SOS');
  const hasRecentSOW    = recentEvents.some(e => e.event === 'SOW');
  const hasRecentSpring = recentEvents.some(e => e.event === 'Spring' || e.event === 'Shakeout');
  const hasRecentUTAD   = recentEvents.some(e => e.event === 'UTAD');
  const hasRecentSC     = recentEvents.some(e => e.event === 'SC');
  const hasRecentBC     = recentEvents.some(e => e.event === 'BC');

  const ma120Ref = N >= 160 ? ma120[N - 40] : (N >= 130 ? ma120[N - 10] : null);
  let ma120Slope = 0;
  if (currentMA120 !== null && ma120Ref !== null && ma120Ref > 0) {
    ma120Slope = (currentMA120 - ma120Ref) / ma120Ref;
  }

  const currentPricePosition = (currentPrice - ind.yearLow) / ind.yearRange;

  let hasFailedSOWRecovery = false;
  let sowFailPrice = 0;
  const recentSowEvent = ctx.events.slice().reverse().find(e => e.event === 'SOW' && e.index >= N - 5);
  if (recentSowEvent) {
    const sowIdx          = recentSowEvent.index;
    const sowHigh         = dfHighs[sowIdx];
    const sowLow          = dfLows[sowIdx];
    const reclaimThreshold = sowLow + (sowHigh - sowLow) * 0.5;
    if (currentPrice < reclaimThreshold) {
      hasFailedSOWRecovery = true;
      sowFailPrice         = reclaimThreshold;
    }
  }

  const isDepressedRange = currentPricePosition < 0.40;
  const isElevatedRange  = currentPricePosition > 0.60;
  const recentBreakout      = ctx.events.slice().reverse().find(e =>
    ['SOS', 'UTAD_Failure', 'Flag'].includes(e.event) && e.index >= N - 20
  );
  const hasConfirmedBreakout = recentBreakout &&
    finalResistance && currentPrice > finalResistance * 0.95 && !hasFailedSOWRecovery;

  const isUptrend   = currentMA60 !== null && currentMA120 !== null &&
    currentMA60 > currentMA120 && currentPrice > currentMA60 && ma120Slope > -0.002;
  const isDowntrend = currentMA60 !== null && currentMA120 !== null &&
    currentMA60 < currentMA120 && currentPrice < currentMA60 && ma120Slope < 0.002;

  const latestAtrForPhase = atr[N - 1] || (currentPrice * 0.02);
  const hasFreshSOW       = ctx.events.some(e => e.event === 'SOW' && e.index >= N - 3);
  const isRealtimeBreakdown = hasFreshSOW &&
    finalSupport !== null &&
    currentPrice < finalSupport - 0.5 * latestAtrForPhase &&
    currentPricePosition >= 0.40;

  // ── Probabilistic scoring ────────────────────────────────────────────────
  // Each signal contributes additive weight to one or more phase buckets.
  // All existing signal conditions are preserved; they now vote with weights
  // rather than exclusively owning the classification.
  const scores = {
    accumulation: 0,
    markup:       0,
    distribution: 0,
    markdown:     0,
    neutral:      0.05   // small base to avoid zero-probability
  };

  // 1. Trend signals (strong priors)
  if (isUptrend)                scores.markup       += 0.40;
  if (isDowntrend)              scores.markdown     += 0.40;
  if (hasConfirmedBreakout)     scores.markup       += 0.20;
  if (hasFailedSOWRecovery)     scores.markdown     += 0.25;
  if (isRealtimeBreakdown)      scores.markdown     += 0.20;

  // 2. Wyckoff event signals
  if (hasRecentSOS)             scores.markup       += 0.20;
  if (hasRecentSOW)             scores.markdown     += 0.20;
  if (hasRecentSpring)          scores.accumulation += 0.30;
  if (hasRecentUTAD)            scores.distribution += 0.30;
  if (hasRecentSC)              scores.accumulation += 0.12;
  if (hasRecentBC)              scores.distribution += 0.12;

  // 3. EVR (Effort vs Result) signals
  if (evrStatus === 'bullish_divergence')              scores.accumulation += 0.15;
  if (evrStatus === 'bearish_divergence')              scores.distribution += 0.15;
  if (evrStatus === 'bullish_consolidation_no_supply') scores.markup       += 0.15;
  if (evrStatus === 'bearish_divergence_no_demand')    scores.markdown     += 0.15;

  // 4. Price position signals
  if (isDepressedRange)         scores.accumulation += 0.10;
  if (isElevatedRange)          scores.distribution += 0.10;

  // 5. MA slope signals
  if (ma120Slope >= 0.002) {
    scores.accumulation += 0.08;
    scores.markup       += 0.04;
  } else if (ma120Slope <= -0.003) {
    if (isElevatedRange) scores.distribution += 0.10;
    else                 scores.markdown     += 0.05;
  }

  // 6. Distance-to-S/R signals (fine-grained, lower weight)
  if (finalSupport !== null && finalSupport > 0 && finalResistance !== null && finalResistance > 0) {
    const distFromSupport    = (currentPrice - finalSupport)    / finalSupport;
    const distFromResistance = (finalResistance - currentPrice) / currentPrice;
    if (distFromSupport < 0.08 && ma120Slope <= 0)      scores.accumulation += 0.08;
    if (distFromResistance < 0.08 && isElevatedRange)   scores.distribution += 0.08;
    if (isDepressedRange && distFromSupport < distFromResistance) scores.accumulation += 0.05;
  }

  // 7. Squeeze detection & scoring ──────────────────────────────────────────
  let wasSqueezedRecently = false;
  for (let k = N - 6; k < N - 1; k++) {
    if (k >= 0 && isSqueezeArr[k]) { wasSqueezedRecently = true; break; }
  }
  const latestClose   = dfCloses[N - 1];
  const latestUpper   = bbUpper[N - 1];
  const latestLower   = bbLower[N - 1];
  const latestSqueeze = isSqueezeArr[N - 1];
  let isSqueezeBreakout  = false;
  let squeezeBreakoutDir = null;
  if (wasSqueezedRecently && latestUpper !== null && latestLower !== null) {
    if (latestClose > latestUpper)      { isSqueezeBreakout = true; squeezeBreakoutDir = 'up'; }
    else if (latestClose < latestLower) { isSqueezeBreakout = true; squeezeBreakoutDir = 'down'; }
  }

  if (latestSqueeze)                                              scores.accumulation += 0.05;
  if (isSqueezeBreakout && squeezeBreakoutDir === 'up')          { scores.markup += 0.10; scores.accumulation += 0.04; }
  if (isSqueezeBreakout && squeezeBreakoutDir === 'down')        scores.markdown += 0.10;


  // ── Normalize to probability distribution ───────────────────────────────
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const phaseProbabilities = {};
  for (const [ph, score] of Object.entries(scores)) {
    phaseProbabilities[ph] = parseFloat((score / total).toFixed(4));
  }

  // ── Shannon entropy (base-2, max ≈ 2.32 for 5 phases) ───────────────────
  let entropy = 0;
  for (const p of Object.values(phaseProbabilities)) {
    if (p > 0) entropy -= p * Math.log2(p);
  }
  entropy = parseFloat(entropy.toFixed(3));

  // ── Dominant phase & confidence ──────────────────────────────────────────
  const dominantPhase = Object.entries(phaseProbabilities)
    .sort((a, b) => b[1] - a[1])[0][0];

  const confidence = parseFloat(
    Math.min(0.98, Math.max(0.3, phaseProbabilities[dominantPhase])).toFixed(2)
  );

  return {
    // ── Probabilistic output (new) ──────────────────────────────────────────
    phase_probabilities: phaseProbabilities,
    dominant_phase:      dominantPhase,
    entropy,
    is_uncertain:        entropy > 1.5,

    // ── Backward-compatible fields ───────────────────────────────────────────
    phase:      dominantPhase,   // alias of dominant_phase
    confidence,                  // equals dominant phase probability
    latestSqueeze, isSqueezeBreakout, squeezeBreakoutDir,
    hasFailedSOWRecovery, sowFailPrice
  };
}

/**
 * Generates bilingual commentary for the detected phase.
 */
function generateCommentary(phase, symbol, evr, phaseResult, ctx) {
  const { evrStatus } = evr;
  const { hasFailedSOWRecovery, sowFailPrice } = phaseResult;
  const hasRecentSpring = ctx.events.some(e =>
    (e.event === 'Spring' || e.event === 'Shakeout') && ctx.N - e.index <= 40
  );
  const hasRecentUTAD = ctx.events.some(e => e.event === 'UTAD' && ctx.N - e.index <= 40);
  const ma120Ref = ctx.N >= 160 ? ctx.ma120[ctx.N - 40] : (ctx.N >= 130 ? ctx.ma120[ctx.N - 10] : null);
  const currentMA120 = ctx.ma120[ctx.N - 1];
  let ma120Slope = 0;
  if (currentMA120 !== null && ma120Ref !== null && ma120Ref > 0) {
    ma120Slope = (currentMA120 - ma120Ref) / ma120Ref;
  }

  const cleanSym = symbol.replace('.AX', '');
  let insightZh = '';
  let insightEn = '';

  if (phase === 'accumulation') {
    const isReaccum = ma120Slope >= 0.002;
    if (isReaccum) {
      insightZh = `🔮 ${cleanSym} 当前处于 Wyckoff 再吸筹阶段（上涨中继）。价格在整体上升通道中进行洗盘整理，主力资金正在重新吸筹积蓄动能，属于健康的上涨中继形态。`;
      insightEn = `🔮 ${cleanSym} is currently in the Wyckoff Re-accumulation phase. The stock is consolidating within a larger markup channel as institutions absorb floating supply before the next wave.`;
    } else {
      insightZh = `🔮 ${cleanSym} 当前处于 Wyckoff 吸筹阶段。价格处于底部交易区间，且前期已测得卖方高潮(SC)支撑，目前筹码正在由散户流向主力机构。`;
      insightEn = `🔮 ${cleanSym} is currently in the Wyckoff Accumulation phase. Price is consolidating near the bottom, absorbing floating supply following a Selling Climax.`;
    }
    if (hasRecentSpring) {
      insightZh += ` 近期检测到了关键的【弹簧效应 (Spring)】假突破，代表主力进行了最后一轮恐慌性洗盘，是极佳的低位吸筹确认信号。`;
      insightEn += ` A recent [Spring / Shakeout] event was detected, indicating a final wash-out of weak holders and a strong buy signal.`;
    } else if (evrStatus === 'bullish_divergence') {
      insightZh += ` 盘口显示明显的量价背离（有量无跌），表明买盘在当前位置支撑力度极强，突破在即。`;
      insightEn += ` Volume-price divergence shows heavy institutional buying absorbing all available sell orders near the support.`;
    } else {
      insightZh += ` 二次测试(ST)期间成交量萎缩，说明抛压逐渐枯竭，建议关注后期放量冲出区间的机会。`;
      insightEn += ` Shrinking volume during tests confirms that selling pressure is drying up. Watch for a breakout on expanding volume.`;
    }
  } else if (phase === 'markup') {
    insightZh = `🚀 ${cleanSym} 处于 Wyckoff 上涨阶段（主升浪）。价格已放量突破筑底阻力位，形成上升通道，均线多头排列清晰。`;
    insightEn = `🚀 ${cleanSym} is in the Wyckoff Markup phase. Price has successfully broken out of its accumulation range, forming a strong upward channel.`;
    if (evrStatus === 'bullish_consolidation_no_supply') {
      insightZh += ` 最近的回调伴随着成交量大幅缩减，说明没有主力出货迹象，属于健康的缩量洗盘，回调是逢低布局机会。`;
      insightEn += ` Recent pullbacks are on light volume, demonstrating lack of supply and representing healthy buy-the-dips opportunities.`;
    } else {
      insightZh += ` 量价配合良好，多头趋势维持，持有并等待涨势放缓或派发信号。`;
      insightEn += ` Price and volume cooperate well. The uptrend remains solid; hold and watch for signs of buying exhaustion.`;
    }
  } else if (phase === 'distribution') {
    insightZh = `⚠️ ${cleanSym} 当前处于 Wyckoff 派发阶段。价格在高位宽幅震荡，主力资金正在悄然派发筹码，风险正在急剧积聚。`;
    insightEn = `⚠️ ${cleanSym} is in the Wyckoff Distribution phase. Large institutions are transferring shares to retail hands near the top, leading to high downside risk.`;
    if (hasRecentUTAD) {
      insightZh += ` 检测到关键的【上轨假突破 (UTAD)】，主力拉高诱多后迅速砸盘收回，是典型的派发确认信号，强烈建议规避。`;
      insightEn += ` A critical [Upthrust After Distribution (UTAD)] has been identified, where price briefly broke resistance to trap breakout buyers before falling back. A strong sell sign.`;
    } else if (evrStatus === 'bearish_divergence') {
      insightZh += ` 盘口显现放量滞涨背离，主力出货意愿明显，表明上涨动能已耗尽。`;
      insightEn += ` Volume-price analysis shows massive effort without results (high volume but flat price), suggesting strong distribution by large sellers.`;
    } else {
      insightZh += ` 震荡波幅加剧，一旦放量跌破支撑位，将转入主跌通道。`;
      insightEn += ` Heightened volatility indicates instability. A breakdown below the trading range support will trigger a markdown phase.`;
    }
  } else if (phase === 'markdown') {
    insightZh = `🔴 ${cleanSym} 处于 Wyckoff 下跌阶段。趋势空头排列，价格不断创出新低，反弹均伴随量能萎缩（无需求上涨）。`;
    insightEn = `🔴 ${cleanSym} is in the Wyckoff Markdown phase. Price is in a structural downtrend, breaking below key supports with shallow, low-volume rallies.`;
    if (hasFailedSOWRecovery) {
      insightZh += ` ⚠️ 警告：近期检测到放量破位 (SOW)，且随后数个交易日内价格均无力收复该大阴线波幅的一半 (阻力位约 $${sowFailPrice.toFixed(2)})。这确认了破位洗盘转为了【真实的趋势破位/主跌启动】，风险极高！`;
      insightEn += ` ⚠️ WARNING: A recent Sign of Weakness (SOW) breakdown occurred, and price failed to reclaim even 50% of the breakdown bar range (resistance at $${sowFailPrice.toFixed(2)}). This confirms a true structural breakdown rather than a shakeout.`;
    } else if (evrStatus === 'bearish_divergence_no_demand') {
      insightZh += ` 虽有弱势反弹，但成交量极度低迷，属于买盘力量缺失的"无需求上涨"，后市继续看跌，切勿抄底。`;
      insightEn += ` Recent minor rebounds lack buying enthusiasm (no demand). Expect further declines; do not catch falling knives.`;
    } else {
      insightZh += ` 均线压力沉重，建议空仓避险，直到形成明显的底部吸筹区间。`;
      insightEn += ` Heavy resistance from moving averages suggests staying out until a new accumulation base is built.`;
    }
  } else {
    insightZh = `⚖️ ${cleanSym} 当前 Wyckoff 阶段信号混合。价格尚未形成明确的吸筹突破、派发确认或趋势延续结构，建议等待放量突破阻力或跌破支撑后再确认方向。`;
    insightEn = `⚖️ ${cleanSym} has mixed Wyckoff evidence. Price has not confirmed accumulation breakout, distribution, or a sustained trend yet. Wait for a volume-backed break above resistance or below support.`;
  }

  return { insightZh, insightEn };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyzes the price and volume data using Richard Wyckoff's methodology.
 */
export function analyzeWyckoff(symbol, stockChart, indexChart = null, sensitivity = 0.3) {
  const minRequiredDays = 40;

  // ── Input validation (distinguish data error from code bug) ──────────────
  try {
    const { df, error: dfError } = buildDataFrame(stockChart, minRequiredDays);
    if (dfError) {
      console.warn('[Wyckoff] Input data error:', dfError, { symbol });
      return { error: dfError };
    }

    // ── Compute indicators ─────────────────────────────────────────────────
    const ind = computeIndicators(df);
    const { N, dfCloses, dfHighs, dfLows, dfVolumes, atr, avgVol20, rsi,
            ma5, ma10, ma20, ma60, ma120, bbUpper, bbLower, bbBandwidth,
            isSqueezeArr, yearLow, yearHigh, yearRange, allPivots } = ind;

    // ── Build context ──────────────────────────────────────────────────────
    const ctx = new WyckoffContext(df, sensitivity, {
      ma20, ma60, ma120, ma5, ma10, atr, rsi, avgVol20,
      isSqueezeArr, bbUpper, bbLower, bbBandwidth, allPivots,
      yearLow, yearHigh, yearRange
    });

    // ── Adaptive CLIMAX_EXPIRY_BARS ─────────────────────────────────────────
    // High-volatility stocks (ATR% > 3.5%) form structures faster and need a
    // shorter expiry window; low-vol stocks get a longer window.
    // We estimate avgAtrPct from the last 40 bars (cheap, no full loop needed).
    {
      const lookbackStart = Math.max(0, N - 40);
      let atrSum = 0, atrCount = 0;
      for (let k = lookbackStart; k < N; k++) {
        if (atr[k] !== null && atr[k] !== undefined && dfCloses[k] > 0) {
          atrSum += (atr[k] / dfCloses[k]) * 100;
          atrCount++;
        }
      }
      const quickAvgAtrPct = atrCount > 0 ? atrSum / atrCount : 2.5;
      // Clamp to [40, 90] to avoid extremes
      ctx.CLIMAX_EXPIRY_BARS = quickAvgAtrPct > 3.5 ? 40 : quickAvgAtrPct < 1.8 ? 90 : 60;
    }

    // ── Scan for Wyckoff events across history day-by-day ─────────────────
    //
    // DETECTOR ORDER CONTRACT — do NOT reorder without reviewing dependencies:
    //   1. detectClimax      — sets ctx.trSupport / ctx.trResistance on the same bar.
    //   2. detectAutomatic   — reads ctx.lastSC / ctx.lastBC (set by climax).
    //   3. detectTests       — reads ctx.lastSC / ctx.lastBC / ctx.lastSpringEventIndex.
    //   4. detectAccumulation— reads ctx.trSupport (may be freshly written by climax today).
    //   5. detectStrength    — reads ctx.trSupport; writes ctx.lastSOSIndex.
    //   6. detectWeakness    — reads ctx.trSupport; writes ctx.lastSOWIndex.
    //   7. detectDistribution— reads ctx.trResistance (may be freshly written by climax today).
    //
    // Same-day read-after-write is intentional: the climax bar IS the anchor bar.
    // If you ever want to delay anchor effects by 1 bar, move step 1 to a
    // separate pre-pass before the main loop.
    for (let i = 20; i < N; i++) {
      const dateStr  = new Date(df[i].timestamp * 1000).toISOString().split('T')[0];
      const close    = dfCloses[i];
      const open     = df[i].Open;
      const high     = dfHighs[i];
      const low      = dfLows[i];
      const volume   = dfVolumes[i];
      const curAtr   = atr[i] || (close * 0.02);
      const curAvgVol = avgVol20[i] || volume;
      const volRatio  = volume / curAvgVol;
      const dailySpread = high - low;

      const isDownDay = close < dfCloses[i - 1];
      const isUpDay   = close > dfCloses[i - 1];

      const climaxVolThresh   = 2.0 * ctx.sensFactor;
      const standardVolThresh = 1.2 * ctx.sensFactor;
      const breakoutVolThresh = 1.4 * ctx.sensFactor;

      const lowerTailRatio  = dailySpread > 0 ? (close - low)  / dailySpread : 0;
      const upperTailRatio  = dailySpread > 0 ? (high - close) / dailySpread : 0;
      const climaxPricePos  = (close - yearLow) / yearRange;

      const dayInfo = {
        close, open, high, low, volume, curAtr, volRatio, dailySpread,
        isDownDay, isUpDay, climaxVolThresh, standardVolThresh, breakoutVolThresh,
        lowerTailRatio, upperTailRatio, climaxPricePos
      };

      detectClimax(ctx, i, dateStr, dayInfo);       // step 1 — sets anchors
      detectAutomatic(ctx, i);                       // step 2
      detectTests(ctx, i, dateStr, dayInfo);         // step 3
      detectAccumulation(ctx, i, dateStr, dayInfo);  // step 4
      detectStrength(ctx, i, dateStr, dayInfo);      // step 5
      detectWeakness(ctx, i, dateStr, dayInfo);      // step 6
      detectDistribution(ctx, i, dateStr, dayInfo);  // step 7
    }

    // ── Support & Resistance ───────────────────────────────────────────────
    // (computed before subphase so Phase E sustained-breakout check can use finalResistance)
    const { finalSupport, finalResistance } = computeSupportResistance(ctx, ind);

    // ── Sub-phase ──────────────────────────────────────────────────────────
    const { wyckoffSubphase, wyckoffSubphaseLabel_zh, wyckoffSubphaseLabel_en } =
      computeSubphase(ctx.events, N, dfCloses, finalResistance, finalSupport);

    // ── EVR ────────────────────────────────────────────────────────────────
    const evr = computeEVR(dfCloses, dfVolumes, avgVol20, atr, finalSupport, finalResistance, N);

    // ── Phase classification ───────────────────────────────────────────────
    const phaseResult = classifyPhase(ctx, ind, evr, finalSupport, finalResistance);
    const { phase, confidence, latestSqueeze, isSqueezeBreakout, squeezeBreakoutDir } = phaseResult;


    // ── Commentary ─────────────────────────────────────────────────────────
    const { insightZh, insightEn } = generateCommentary(phase, symbol, evr, phaseResult, ctx);

    // ── ATR Trailing Stop (Chandelier Exit) ────────────────────────────────
    const atrTrailingStops = new Array(N).fill(null);
    let currentStop = null;
    const stopLookback   = 22;
    const stopMultiplier = 3.0;
    for (let i = 0; i < N; i++) {
      if (atr[i] === null || atr[i] === undefined || isNaN(atr[i])) {
        atrTrailingStops[i] = null;
        continue;
      }
      const startIdx = Math.max(0, i - stopLookback + 1);
      let highestHigh = dfHighs[startIdx];
      for (let j = startIdx + 1; j <= i; j++) {
        if (dfHighs[j] > highestHigh) highestHigh = dfHighs[j];
      }
      const candidate = highestHigh - stopMultiplier * atr[i];
      if (currentStop === null) {
        currentStop = candidate;
      } else {
        currentStop = dfCloses[i] < currentStop
          ? candidate
          : Math.max(currentStop, candidate);
      }
      atrTrailingStops[i] = parseFloat(currentStop.toFixed(2));
    }

    // ── Full history ───────────────────────────────────────────────────────
    const fullHistory = df.map((day, idx) => {
      const matchedEvents = ctx.events.filter(e => e.index === idx);
      return {
        date:    new Date(day.timestamp * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        close:   day.Close,
        high:    day.High,
        low:     day.Low,
        open:    day.Open,
        volume:  day.Volume,
        ma5:     ma5[idx],
        ma10:    ma10[idx],
        ma20:    ma20[idx],
        ma60:    ma60[idx],
        bb_upper:          bbUpper[idx]   !== null ? parseFloat(bbUpper[idx].toFixed(2))   : null,
        bb_lower:          bbLower[idx]   !== null ? parseFloat(bbLower[idx].toFixed(2))   : null,
        atr_trailing_stop: atrTrailingStops[idx],
        events:  matchedEvents.map(e => e.event)
      };
    });

    // ── Volatility metrics ─────────────────────────────────────────────────
    let atrPctSum  = 0;
    let validCount = 0;
    for (let i = 0; i < N; i++) {
      if (atr[i] !== null && dfCloses[i] > 0) {
        atrPctSum += (atr[i] / dfCloses[i]) * 100;
        validCount++;
      }
    }
    const avgAtrPct = validCount > 0 ? parseFloat((atrPctSum / validCount).toFixed(2)) : 2.5;

    let volType = 'moderate', recTrailingStop = 15, recBreakeven = 30;
    if (avgAtrPct < 1.8) { volType = 'low';  recTrailingStop = 10; recBreakeven = 20; }
    else if (avgAtrPct > 3.5) { volType = 'high'; recTrailingStop = 20; recBreakeven = 40; }

    const phaseLabels = {
      accumulation: { zh: '吸筹阶段 (Accumulation)', en: 'Accumulation Phase' },
      markup:       { zh: '上涨阶段 (Markup)',        en: 'Markup Phase' },
      distribution: { zh: '派发阶段 (Distribution)', en: 'Distribution Phase' },
      markdown:     { zh: '下跌阶段 (Markdown)',      en: 'Markdown Phase' },
      neutral:      { zh: '横盘震荡 (Consolidation)', en: 'Consolidation Phase' }
    };

    const chartAnnotations = ctx.events.map(e => ({
      index:    e.index,
      event:    e.event,
      label_zh: e.label_zh,
      label_en: e.label_en,
      price:    e.price,
      date:     e.date
    }));

    const latestUpper = bbUpper[N - 1];
    const latestLower = bbLower[N - 1];

    // ── Basic run metrics (useful for monitoring signal health) ────────────
    const eventTypeCounts = {};
    ctx.events.forEach(e => { eventTypeCounts[e.event] = (eventTypeCounts[e.event] || 0) + 1; });
    console.debug('[Wyckoff]', symbol, '| phase:', phase, '| events:', eventTypeCounts, '| bars:', N);

    return {
      type:   'wyckoff',
      symbol: symbol.replace('.AX', ''),
      volatility_metrics: { avg_atr_pct: avgAtrPct, volatility_type: volType, rec_trailing_stop: recTrailingStop, rec_breakeven: recBreakeven },
      price:    parseFloat(dfCloses[N - 1].toFixed(2)),
      chg_pct:  parseFloat((((dfCloses[N - 1] - dfCloses[N - 2]) / dfCloses[N - 2]) * 100).toFixed(2)),
      volume:   `${(dfVolumes[N - 1] / 1e6).toFixed(2)}M`,
      vol_ratio: parseFloat((dfVolumes[N - 1] / (avgVol20[N - 1] || 1)).toFixed(2)),
      rsi:       rsi[N - 1] !== null ? parseFloat(rsi[N - 1].toFixed(1)) : null,
      support_level:    finalSupport,
      resistance_level: finalResistance,
      phase,
      phase_confidence:    confidence,
      phase_probabilities: phaseResult.phase_probabilities,
      phase_entropy:       phaseResult.entropy,
      phase_is_uncertain:  phaseResult.is_uncertain,
      phase_label_zh:    phaseLabels[phase].zh,
      phase_label_en:    phaseLabels[phase].en,
      detected_events:   ctx.events.slice(-20),
      bb_squeeze: {
        is_squeeze:    latestSqueeze,
        is_breakout:   isSqueezeBreakout,
        breakout_dir:  squeezeBreakoutDir,
        bandwidth:     bbBandwidth[N - 1] !== null ? parseFloat(bbBandwidth[N - 1].toFixed(4)) : null,
        upper:         latestUpper !== null ? parseFloat(latestUpper.toFixed(2)) : null,
        lower:         latestLower !== null ? parseFloat(latestLower.toFixed(2)) : null,
        middle:        ma20[N - 1]  !== null ? parseFloat(ma20[N - 1].toFixed(2))  : null
      },
      all_detected_events:     ctx.events,
      wyckoff_subphase:        wyckoffSubphase,
      wyckoff_subphase_label_zh: wyckoffSubphaseLabel_zh,
      wyckoff_subphase_label_en: wyckoffSubphaseLabel_en,
      effort_vs_result: {
        status:    evr.evrStatus,
        label_zh:  evr.evrLabelZh,
        label_en:  evr.evrLabelEn,
        detail_zh: evr.evrDetailZh,
        detail_en: evr.evrDetailEn
      },
      wyckoff_insight_zh: insightZh,
      wyckoff_insight_en: insightEn,
      chart_annotations:  chartAnnotations,
      data_quality: {
        status:     N < 60 ? 'warning' : 'good',
        message_zh: N < 60 ? '历史数据不足 60 天。MA60 指标已降级为 MA20，部分趋势判断可能不够准确。' : null,
        message_en: N < 60 ? 'Less than 60 days of historical data available. MA60 has degraded to MA20; trend diagnosis might be less accurate.' : null
      },
      chart_history: fullHistory
    };

  } catch (err) {
    // Distinguish likely code bugs from input data issues.
    // Input errors usually manifest as TypeError/RangeError on missing fields.
    const isInputError = err instanceof TypeError || err instanceof RangeError;
    const category     = isInputError ? 'input_error' : 'analysis_error';
    console.error(`[Wyckoff] ${category}:`, err.message, { symbol, sensitivity });
    return { error: `Wyckoff analysis failed: ${err.message}` };
  }
}

/**
 * Wyckoff + MACD Combined Strategy Analyzer
 */
export function analyzeWyckoffMacd(symbol, stockChart, indexChart = null, sensitivity = 0.3, sector = null, sectorData = null) {
  try {
    const result = analyzeWyckoff(symbol, stockChart, indexChart, sensitivity);
    if (result.error) return result;

    const closes = result.chart_history.map(x => x.close);
    const N = closes.length;
    const { macdLine, signalLine, hist } = getMACD(closes);
    const { bullishDivergence, bearishDivergence } = detectMACDDivergences(closes, macdLine);

    const latestMacd   = macdLine[N - 1];
    const latestSignal = signalLine[N - 1];
    const latestHist   = hist[N - 1];

    let recentBullishCross   = false;
    let recentBearishCross   = false;
    let recentZeroCrossUp    = false;
    let recentZeroCrossDown  = false;

    const lookback = Math.min(10, N - 2);
    for (let i = N - 1; i >= N - lookback; i--) {
      const prevM = macdLine[i - 1];
      const curM  = macdLine[i];
      const prevS = signalLine[i - 1];
      const curS  = signalLine[i];
      if (prevM !== null && curM !== null && prevS !== null && curS !== null) {
        if (prevM <= prevS && curM > curS)  recentBullishCross  = true;
        if (prevM >= prevS && curM < curS)  recentBearishCross  = true;
        if (prevM <= 0     && curM > 0)     recentZeroCrossUp   = true;
        if (prevM >= 0     && curM < 0)     recentZeroCrossDown = true;
      }
    }

    let macdInsightZh = '';
    let macdInsightEn = '';
    let confidence    = result.phase_confidence;

    // ── Temporal alignment weight ─────────────────────────────────────────────
    // MACD and Wyckoff signals are only meaningful together when they are
    // temporally aligned. If the key Wyckoff event happened 20+ bars ago, a
    // MACD crossover today may be a separate, unrelated move — so we decay
    // the confidence adjustment proportionally.
    // Weight = 1.0 (same day) → 0.3 (≥ 20 bars apart), linear decay.
    const allEvents = result.all_detected_events || [];
    const recentKeyEvent = allEvents.slice().reverse().find(e =>
      ['SOS', 'Spring', 'Shakeout', 'LPS', 'SC', 'SOW', 'UTAD', 'LPSY', 'BC'].includes(e.event)
    );
    const barsSinceWyckoff = recentKeyEvent ? (N - 1 - recentKeyEvent.index) : 40;
    // Decay from 1.0 at 0 bars to 0.3 at 20+ bars
    const temporalWeight = parseFloat(Math.max(0.3, 1.0 - barsSinceWyckoff / 28.57).toFixed(3));
    const isAligned = temporalWeight >= 0.7; // qualitative: within ~8 bars

    if (result.phase === 'accumulation' || result.phase === 'markup') {
      if (recentBullishCross) {
        confidence    += 0.08 * temporalWeight;
        macdInsightZh += isAligned ? '结合 MACD 金叉看涨确认' : 'MACD 金叉（与 Wyckoff 事件相距较远，权重已衰减）';
        macdInsightEn += isAligned ? 'confirmed by MACD Bullish Crossover' : 'MACD Bullish Crossover (signal decayed — distant from latest Wyckoff event)';
      }
      if (bullishDivergence) {
        confidence    += 0.12 * temporalWeight;
        if (macdInsightZh) macdInsightZh += '且';
        if (macdInsightEn) macdInsightEn += ' and ';
        macdInsightZh += isAligned ? '发现 MACD 底背离，筑底买盘强劲' : 'MACD 底背离（信号权重已衰减）';
        macdInsightEn += isAligned ? 'Bullish MACD Divergence detected' : 'Bullish MACD Divergence (decayed weight)';
      }
    } else if (result.phase === 'distribution' || result.phase === 'markdown') {
      if (recentBearishCross) {
        confidence    += 0.08 * temporalWeight;
        macdInsightZh += isAligned ? '结合 MACD 死叉看跌确认' : 'MACD 死叉（与 Wyckoff 事件相距较远，权重已衰减）';
        macdInsightEn += isAligned ? 'confirmed by MACD Bearish Crossover' : 'MACD Bearish Crossover (signal decayed — distant from latest Wyckoff event)';
      }
      if (bearishDivergence) {
        confidence    += 0.12 * temporalWeight;
        if (macdInsightZh) macdInsightZh += '且';
        if (macdInsightEn) macdInsightEn += ' and ';
        macdInsightZh += isAligned ? '发现 MACD 顶背离，警惕趋势反转' : 'MACD 顶背离（信号权重已衰减）';
        macdInsightEn += isAligned ? 'Bearish MACD Divergence detected' : 'Bearish MACD Divergence (decayed weight)';
      }
    }

    if (!macdInsightZh && latestMacd !== null && latestSignal !== null) {
      if (latestMacd > latestSignal) {
        if (latestMacd > 0) {
          macdInsightZh = '当前 MACD 指标处于零轴上方多头区间（DIF > DEA），中短期多头动能仍占主导';
          macdInsightEn = 'currently, MACD is in the bullish zone above the zero line (DIF > DEA), indicating prevailing upward momentum';
        } else {
          macdInsightZh = '当前 MACD 指标在零轴下方低位多头排列（DIF > DEA），动能指标呈现筑底反弹迹象';
          macdInsightEn = 'currently, MACD has formed a bullish alignment below the zero line (DIF > DEA), showing bottoming out and recovery momentum';
        }
      } else {
        if (latestMacd > 0) {
          macdInsightZh = '当前 MACD 指标在高位出现空头排列（DIF < DEA），多头动能有所减弱，警惕高位震荡回调风险';
          macdInsightEn = 'currently, MACD is in a bearish alignment at high levels (DIF < DEA), indicating weakening bullish strength, warning of consolidation risks';
        } else {
          macdInsightZh = '当前 MACD 指标处于零轴下方空头区间（DIF < DEA），空头动能占据主导，趋势仍偏弱';
          macdInsightEn = 'currently, MACD is in the bearish zone below the zero line (DIF < DEA), showing prevailing downward strength and weak trend';
        }
      }
    }

    if (macdInsightZh) {
      macdInsightZh = `。${macdInsightZh}`;
      macdInsightEn = `. ${macdInsightEn}`;
    }

    confidence = parseFloat(Math.min(0.98, Math.max(0.3, confidence)).toFixed(2));

    // Sector synergy insight
    let sectorInsightZh = '';
    let sectorInsightEn = '';
    if (sector && sectorData) {
      const heat = typeof sectorData.heat_score    === 'number' ? sectorData.heat_score    : 50;
      const chg  = typeof sectorData.avg_chg_pct   === 'number' ? sectorData.avg_chg_pct   : 0;

      let heatZh = '', heatEn = '';
      if (heat > 65) {
        heatZh = `此外，该股所属板块【${sector}】近期资金流入显著（热度分高达 ${heat.toFixed(1)}），具备强烈的板块共振和主力资金抱团效应。`;
        heatEn = ` Additionally, the related sector [${sector}] has significant capital inflows with a high heat score of ${heat.toFixed(1)}, showing strong sector synergy and institutional aggregation.`;
      } else if (heat < 40) {
        heatZh = `但注意该股所属板块【${sector}】近期资金关注度较低（热度分仅 ${heat.toFixed(1)}），缺乏板块板块共鸣，操作上更偏个股独立行情。`;
        heatEn = ` However, the related sector [${sector}] has low capital attention (heat score ${heat.toFixed(1)}), lacking sector synergy, and is trading more on idiosyncratic dynamics.`;
      } else {
        heatZh = `该股所属板块【${sector}】目前资金流向平稳（热度分 ${heat.toFixed(1)}），个股建议更侧重自身量价区间的突破方向。`;
        heatEn = ` The related sector [${sector}] currently has relatively stable funds (heat score ${heat.toFixed(1)}), and the stock should focus on its own volume-price breakouts.`;
      }

      let chgZh = '', chgEn = '';
      if (chg > 0.5) {
        chgZh = `板块今日强势上涨 ${chg.toFixed(2)}%，多头情绪共振发酵。`;
        chgEn = ` The sector rose strongly today by ${chg.toFixed(2)}%, amplifying bullish momentum.`;
      } else if (chg < -0.5) {
        chgZh = `板块今日回调较深（${chg.toFixed(2)}%），需防范行业整体系统性调整压力。`;
        chgEn = ` The sector corrected significantly today (${chg.toFixed(2)}%), prompting caution on industry-wide pullbacks.`;
      }

      sectorInsightZh = ` ${heatZh}${chgZh}`;
      sectorInsightEn = ` ${heatEn}${chgEn}`;
    }

    const chartHistoryWithMacd = result.chart_history.map((day, idx) => ({
      ...day,
      macd:   macdLine[idx]   !== null ? parseFloat(macdLine[idx].toFixed(4))   : null,
      signal: signalLine[idx] !== null ? parseFloat(signalLine[idx].toFixed(4)) : null,
      hist:   hist[idx]       !== null ? parseFloat(hist[idx].toFixed(4))       : null
    }));

    return {
      ...result,
      type:              'wyckoff_macd',
      phase_confidence:  confidence,
      wyckoff_insight_zh: result.wyckoff_insight_zh + macdInsightZh + sectorInsightZh,
      wyckoff_insight_en: result.wyckoff_insight_en + macdInsightEn + sectorInsightEn,
      chart_history:     chartHistoryWithMacd,
      macd: {
        latest_macd:         latestMacd   !== null ? parseFloat(latestMacd.toFixed(4))   : null,
        latest_signal:       latestSignal !== null ? parseFloat(latestSignal.toFixed(4)) : null,
        latest_hist:         latestHist   !== null ? parseFloat(latestHist.toFixed(4))   : null,
        bullish_divergence:  bullishDivergence,
        bearish_divergence:  bearishDivergence,
        recent_bullish_cross:  recentBullishCross,
        recent_bearish_cross:  recentBearishCross,
        recent_zero_cross_up:  recentZeroCrossUp,
        recent_zero_cross_down: recentZeroCrossDown
      }
    };
  } catch (err) {
    console.error('[Wyckoff MACD] analysis_error:', err.message, { symbol, sensitivity });
    return { error: `Wyckoff MACD analysis failed: ${err.message}` };
  }
}
