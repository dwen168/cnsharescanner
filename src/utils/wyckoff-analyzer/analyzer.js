import { getRollingMean, getRollingStd, getATR, getRSI, findPivotLevels, clusterLevels, getFallbackPivotResistance, getMACD, detectMACDDivergences } from './core/indicators';
import { WyckoffContext } from './core/context';
import { detectClimax } from './detectors/climax';
import { detectAutomatic } from './detectors/automatic';
import { detectTests } from './detectors/tests';
import { detectAccumulation } from './detectors/accumulation';
import { detectStrength } from './detectors/strength';
import { detectWeakness } from './detectors/weakness';
import { detectDistribution } from './detectors/distribution';
import { computeSubphase } from './phase/subphase';

/**
 * Analyzes the price and volume data using Richard Wyckoff's methodology.
 */
export function analyzeWyckoff(symbol, stockChart, indexChart = null, sensitivity = 0.3) {
  try {
    const minRequiredDays = 40;
    if (!stockChart || !stockChart.timestamp || stockChart.timestamp.length < minRequiredDays) {
      return { error: `Insufficient data points (Need at least ${minRequiredDays} days)` };
    }

    const timestamps = stockChart.timestamp;
    const closes = stockChart.indicators.quote[0].close;
    const volumes = stockChart.indicators.quote[0].volume;
    const highs = stockChart.indicators.quote[0].high;
    const lows = stockChart.indicators.quote[0].low;
    const opens = stockChart.indicators.quote[0].open;

    // 1. Clean null values
    const df = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (
        closes[i] !== null && closes[i] !== undefined &&
        volumes[i] !== null && volumes[i] !== undefined &&
        highs[i] !== null && highs[i] !== undefined &&
        lows[i] !== null && lows[i] !== undefined
      ) {
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

    const N = df.length;
    if (N < minRequiredDays) {
      return { error: `Insufficient clean data points (Need at least ${minRequiredDays} days)` };
    }

    const dfCloses = df.map(x => x.Close);
    const dfHighs = df.map(x => x.High);
    const dfLows = df.map(x => x.Low);
    const dfVolumes = df.map(x => x.Volume);

    // 2. Technical overlays
    const ma20 = getRollingMean(dfCloses, 20);
    const ma60 = N >= 60 ? getRollingMean(dfCloses, 60) : getRollingMean(dfCloses, 20);
    const ma120 = N >= 120 ? getRollingMean(dfCloses, 120) : ma60;

    const atr = getATR(dfHighs, dfLows, dfCloses, 14);
    const rsi = getRSI(dfCloses, 14);
    const avgVol20 = getRollingMean(dfVolumes, 20);

    // Bollinger Bands & Squeeze calculation
    const rollingStd = getRollingStd(dfCloses, 20, ma20);
    const bbUpper = new Array(N).fill(null);
    const bbLower = new Array(N).fill(null);
    const bbBandwidth = new Array(N).fill(null);
    const isSqueezeArr = new Array(N).fill(false);

    for (let i = 0; i < N; i++) {
      if (rollingStd[i] !== null && ma20[i] !== null) {
        bbUpper[i] = ma20[i] + 2 * rollingStd[i];
        bbLower[i] = ma20[i] - 2 * rollingStd[i];
        bbBandwidth[i] = ma20[i] > 0 ? (bbUpper[i] - bbLower[i]) / ma20[i] : 0;
      }
    }

    for (let i = 20; i < N; i++) {
      if (bbBandwidth[i] === null) continue;
      let minBw = Infinity;
      const lookback = Math.min(60, i);
      for (let j = i - lookback; j < i; j++) {
        if (bbBandwidth[j] !== null && bbBandwidth[j] < minBw) {
          minBw = bbBandwidth[j];
        }
      }
      if (minBw !== Infinity) {
        isSqueezeArr[i] = bbBandwidth[i] <= minBw * 1.05;
      }
    }

    // Trailing 1-year price position for structural check
    const yearlyLookback = Math.min(252, N);
    const yearlyHighs = dfHighs.slice(-yearlyLookback);
    const yearlyLows = dfLows.slice(-yearlyLookback);
    const yearHigh = Math.max(...yearlyHighs);
    const yearLow = Math.min(...yearlyLows);
    const yearRange = yearHigh - yearLow || 1;

    // Pre-compute MA5 and MA10
    const ma5 = getRollingMean(dfCloses, 5);
    const ma10 = getRollingMean(dfCloses, 10);

    // Pre-compute price pivots
    const allPivots = findPivotLevels(dfHighs, dfLows, 5);

    // Build context
    const ctx = new WyckoffContext(df, sensitivity, {
      ma20, ma60, ma120, ma5, ma10, atr, rsi, avgVol20,
      isSqueezeArr, bbUpper, bbLower, bbBandwidth, allPivots,
      yearLow, yearHigh, yearRange
    });

    // 3. Scan for Wyckoff events across history day-by-day
    for (let i = 20; i < N; i++) {
      const dateStr = new Date(df[i].timestamp * 1000).toISOString().split('T')[0];
      const close = dfCloses[i];
      const open = df[i].Open;
      const high = dfHighs[i];
      const low = dfLows[i];
      const volume = dfVolumes[i];
      const curAtr = atr[i] || (close * 0.02);
      const curAvgVol = avgVol20[i] || volume;
      const volRatio = volume / curAvgVol;
      const dailySpread = high - low;

      // Directions
      const isDownDay = close < dfCloses[i - 1];
      const isUpDay = close > dfCloses[i - 1];

      // Volume threshold for climax and breakouts
      const climaxVolThresh = 2.0 * ctx.sensFactor;
      const standardVolThresh = 1.2 * ctx.sensFactor;
      const breakoutVolThresh = 1.4 * ctx.sensFactor;

      // Tail ratios
      const lowerTailRatio = dailySpread > 0 ? (close - low) / dailySpread : 0;
      const upperTailRatio = dailySpread > 0 ? (high - close) / dailySpread : 0;

      // Position
      const climaxPricePos = (close - yearLow) / yearRange;

      const dayInfo = {
        close, open, high, low, volume, curAtr, volRatio, dailySpread,
        isDownDay, isUpDay, climaxVolThresh, standardVolThresh, breakoutVolThresh,
        lowerTailRatio, upperTailRatio, climaxPricePos
      };

      // Call modular detectors
      detectClimax(ctx, i, dateStr, dayInfo);
      detectAutomatic(ctx, i);
      detectTests(ctx, i, dateStr, dayInfo);
      detectAccumulation(ctx, i, dateStr, dayInfo);
      detectStrength(ctx, i, dateStr, dayInfo);
      detectWeakness(ctx, i, dateStr, dayInfo);
      detectDistribution(ctx, i, dateStr, dayInfo);
    }

    // Compute Wyckoff Sub-Phase Labeling
    const { wyckoffSubphase, wyckoffSubphaseLabel_zh, wyckoffSubphaseLabel_en } = computeSubphase(ctx.events, N);

    // Calculate final Support & Resistance lines
    let finalSupport = null;
    let finalResistance = null;
    const currentPriceVal = dfCloses[N - 1];

    // Soft filter: Keep support and resistance levels that are within 20% distance of current price (Fix 5)
    const validSupports = ctx.supportLevels.filter(s => Math.abs(s.price - currentPriceVal) / currentPriceVal <= 0.20 && (N - s.index) <= 150);
    const validResistances = ctx.resistanceLevels.filter(r => Math.abs(r.price - currentPriceVal) / currentPriceVal <= 0.20 && (N - r.index) <= 150);

    const clusteredPivotLows = clusterLevels(allPivots.pivotLows, atr, N - 1);
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

    if (allSupportCandidates.length > 0) {
      const scoredSupports = allSupportCandidates.map(s => {
        const age = N - s.index;
        const recencyWeight = age <= 40 ? 1.0 : Math.max(0.3, 1.0 - (age - 40) / 200);
        return { ...s, score: s.strength * recencyWeight };
      });
      scoredSupports.sort((a, b) => b.score - a.score);
      finalSupport = parseFloat(scoredSupports[0].price.toFixed(2));
    } else {
      finalSupport = parseFloat(Math.min(...dfLows.slice(-60)).toFixed(2));
    }

    if (allResistanceCandidates.length > 0) {
      const scoredResistances = allResistanceCandidates.map(r => {
        const age = N - r.index;
        const recencyWeight = age <= 40 ? 1.0 : Math.max(0.3, 1.0 - (age - 40) / 200);
        return { ...r, score: r.strength * recencyWeight };
      });
      scoredResistances.sort((a, b) => b.score - a.score);
      finalResistance = parseFloat(scoredResistances[0].price.toFixed(2));
    } else {
      finalResistance = parseFloat(Math.max(...dfHighs.slice(-60)).toFixed(2));
    }

    const latestAtr = atr[N - 1] || (dfCloses[N - 1] * 0.02);
    if (finalSupport >= finalResistance) {
      finalSupport = parseFloat((finalResistance - 2 * latestAtr).toFixed(2));
    }

    // Effort vs Result (EVR) analysis
    let evrStatus = 'neutral';
    let evrLabelZh = '量价均衡';
    let evrLabelEn = 'Effort-Result Balanced';
    let evrDetailZh = '最近量价关系表现平稳，符合市场常态。';
    let evrDetailEn = 'Recent price actions match volume changes, indicating market equilibrium.';

    const evrLookback = Math.min(10, N - 1);
    let risingVolCount = 0;
    let flatPriceCount = 0;

    for (let j = N - evrLookback; j < N; j++) {
      const prevC = dfCloses[j - 1];
      const curC = dfCloses[j];
      const curV = dfVolumes[j];
      const curAvgV = avgVol20[j] || curV;
      const curDayAtr = atr[j] || (curC * 0.02);

      const volAboveAvg = curV > curAvgV * 1.1;
      const priceMove = Math.abs(curC - prevC);
      const priceConsolidation = priceMove < curDayAtr * 0.3;

      if (volAboveAvg) {
        risingVolCount++;
        if (priceConsolidation) {
          flatPriceCount++;
        }
      }
    }

    if (risingVolCount >= 3 && flatPriceCount >= 2) {
      const currentPrice = dfCloses[N - 1];
      const distFromSupport = finalSupport > 0 ? (currentPrice - finalSupport) / finalSupport : 0;
      const distFromResistance = currentPrice > 0 ? (finalResistance - currentPrice) / currentPrice : 0;

      if (distFromSupport < distFromResistance) {
        evrStatus = 'bullish_divergence';
        evrLabelZh = '有量无跌 (底部吸筹)';
        evrLabelEn = 'Effort without Fall (Accumulation)';
        evrDetailZh = '最近成交量显著放大但价格拒绝下跌，显示买盘在支撑位附近积极吸收卖压。';
        evrDetailEn = 'Volume increased significantly while price held support, indicating institutional absorption.';
      } else {
        evrStatus = 'bearish_divergence';
        evrLabelZh = '放量滞涨 (高位派发)';
        evrLabelEn = 'Effort without Rise (Distribution)';
        evrDetailZh = '最近成交量显著放大但价格拒绝上涨，显示高位存在强烈的机构抛压（货源派发）。';
        evrDetailEn = 'Volume spiked but price failed to gain ground, indicating strong supply or institutional selling.';
      }
    } else if (dfCloses[N - 1] > dfCloses[N - 5] && avgVol20[N - 1] < avgVol20[N - 5] * 0.8) {
      evrStatus = 'bearish_divergence_no_demand';
      evrLabelZh = '无量上涨 (多头力竭)';
      evrLabelEn = 'No Volume Rally (Lack of Demand)';
      evrDetailZh = '价格虽有反弹，但成交量持续缩减，说明买盘意愿薄弱，属于缺乏买方需求的虚假上涨。';
      evrDetailEn = 'Price drifted upward on declining volume, showing lack of demand and buying exhaustion.';
    } else if (dfCloses[N - 1] < dfCloses[N - 5] && avgVol20[N - 1] < avgVol20[N - 5] * 0.8) {
      evrStatus = 'bullish_consolidation_no_supply';
      evrLabelZh = '无量回调 (抛压枯竭)';
      evrLabelEn = 'Low Volume Pullback (No Supply)';
      evrDetailZh = '近期股价小幅回调但成交量大幅萎缩，表明市场浮动筹码较少，卖方抛压基本枯竭。';
      evrDetailEn = 'Price pulled back on light volume, demonstrating lack of supply and dry selling pressure.';
    }

    // Phase Classification
    let phase = 'neutral';
    let confidence = 0.5;

    const currentPrice = dfCloses[N - 1];
    const currentMA20 = ma20[N - 1];
    const currentMA60 = ma60[N - 1];
    const currentMA120 = ma120[N - 1];

    const recentEvents = ctx.events.filter(e => e.index >= N - 40);
    const hasRecentSOS = recentEvents.some(e => e.event === 'SOS');
    const hasRecentSOW = recentEvents.some(e => e.event === 'SOW');
    const hasRecentSpring = recentEvents.some(e => e.event === 'Spring' || e.event === 'Shakeout');
    const hasRecentUTAD = recentEvents.some(e => e.event === 'UTAD');
    const hasRecentSC = recentEvents.some(e => e.event === 'SC');
    const hasRecentBC = recentEvents.some(e => e.event === 'BC');

    const ma120Ref = N >= 160 ? ma120[N - 40] : (N >= 130 ? ma120[N - 10] : null);
    let ma120Slope = 0;
    if (currentMA120 !== null && ma120Ref !== null && ma120Ref > 0) {
      ma120Slope = (currentMA120 - ma120Ref) / ma120Ref;
    }

    const currentPricePosition = (currentPrice - yearLow) / yearRange;
    let hasFailedSOWRecovery = false;
    let sowFailPrice = 0;
    const recentSowEvent = ctx.events.slice().reverse().find(e => e.event === 'SOW' && e.index >= N - 5);
    if (recentSowEvent) {
      const sowIdx = recentSowEvent.index;
      const sowHigh = dfHighs[sowIdx];
      const sowLow = dfLows[sowIdx];
      const reclaimThreshold = sowLow + (sowHigh - sowLow) * 0.5;
      if (currentPrice < reclaimThreshold) {
        hasFailedSOWRecovery = true;
        sowFailPrice = reclaimThreshold;
      }
    }

    const isDepressedRange = currentPricePosition < 0.40;
    const isElevatedRange = currentPricePosition > 0.60;

    const recentBreakout = ctx.events.slice().reverse().find(e => ['SOS', 'UTAD_Failure', 'Flag'].includes(e.event) && e.index >= N - 20);
    const hasConfirmedBreakout = recentBreakout && finalResistance && currentPrice > finalResistance * 0.95 && !hasFailedSOWRecovery;

    const isUptrend = currentMA60 !== null && currentMA120 !== null &&
      currentMA60 > currentMA120 && currentPrice > currentMA60 && ma120Slope > -0.002;
    const isDowntrend = currentMA60 !== null && currentMA120 !== null &&
      currentMA60 < currentMA120 && currentPrice < currentMA60 && ma120Slope < 0.002;

    const latestAtrForPhase = atr[N - 1] || (currentPrice * 0.02);
    const hasFreshSOW = ctx.events.some(e => e.event === 'SOW' && e.index >= N - 3);
    const isRealtimeBreakdown = hasFreshSOW &&
      finalSupport !== null &&
      currentPrice < finalSupport - 0.5 * latestAtrForPhase &&
      currentPricePosition >= 0.40;

    if ((isUptrend || hasConfirmedBreakout) && !hasFailedSOWRecovery) {
      phase = 'markup';
      confidence = hasConfirmedBreakout ? 0.8 : 0.7;
      if (hasRecentSOS) confidence += 0.15;
      if (evrStatus === 'bullish_consolidation_no_supply') confidence += 0.15;
    } else if (isDowntrend || hasFailedSOWRecovery || isRealtimeBreakdown) {
      phase = 'markdown';
      confidence = 0.75;
      if (hasRecentSOW) confidence += 0.15;
      if (evrStatus === 'bearish_divergence_no_demand') confidence += 0.15;
    } else {
      const distFromSupport = (currentPrice - finalSupport) / finalSupport;
      const distFromResistance = (finalResistance - currentPrice) / currentPrice;

      if (hasRecentSpring || hasRecentSC || (distFromSupport < 0.08 && ma120Slope <= 0)) {
        phase = 'accumulation';
        confidence = 0.65;
        if (hasRecentSpring) confidence += 0.15;
        if (evrStatus === 'bullish_divergence') confidence += 0.1;
      } else if (hasRecentUTAD || hasRecentBC || distFromResistance < 0.08) {
        const hasDistributionEvidence = hasRecentUTAD || hasRecentBC || evrStatus === 'bearish_divergence';
        const hasBearishContext = ma120Slope < 0.002 || hasRecentSOW || evrStatus === 'bearish_divergence';
        if (isElevatedRange && hasDistributionEvidence && hasBearishContext) {
          phase = 'distribution';
          confidence = 0.65;
          if (hasRecentUTAD) confidence += 0.15;
          if (evrStatus === 'bearish_divergence') confidence += 0.1;
        } else if (isDepressedRange || distFromSupport < distFromResistance) {
          phase = 'accumulation';
          confidence = 0.58;
          if (evrStatus === 'bullish_divergence') confidence += 0.1;
        } else {
          phase = 'neutral';
          confidence = 0.5;
        }
      } else {
        if (ma120Slope >= 0.002) {
          phase = 'accumulation';
          confidence = 0.6;
        } else if (ma120Slope <= -0.003) {
          if (isElevatedRange) {
            phase = 'distribution';
            confidence = 0.6;
          } else {
            phase = 'accumulation';
            confidence = 0.5;
          }
        } else {
          if (isDepressedRange || currentPrice < currentMA60) {
            phase = 'accumulation';
            confidence = 0.52;
          } else if (isElevatedRange && (hasRecentBC || hasRecentUTAD || evrStatus === 'bearish_divergence')) {
            phase = 'distribution';
            confidence = 0.52;
          } else {
            phase = 'neutral';
            confidence = 0.5;
          }
        }
      }
    }

    confidence = parseFloat(Math.min(0.98, Math.max(0.3, confidence)).toFixed(2));

    // Volatility adjust confidence
    let wasSqueezedRecently = false;
    for (let k = N - 6; k < N - 1; k++) {
      if (k >= 0 && isSqueezeArr[k]) {
        wasSqueezedRecently = true;
        break;
      }
    }

    const latestClose = dfCloses[N - 1];
    const latestUpper = bbUpper[N - 1];
    const latestLower = bbLower[N - 1];
    const latestSqueeze = isSqueezeArr[N - 1];

    let isSqueezeBreakout = false;
    let squeezeBreakoutDir = null;
    if (wasSqueezedRecently && latestUpper !== null && latestLower !== null) {
      if (latestClose > latestUpper) {
        isSqueezeBreakout = true;
        squeezeBreakoutDir = 'up';
      } else if (latestClose < latestLower) {
        isSqueezeBreakout = true;
        squeezeBreakoutDir = 'down';
      }
    }

    if (phase === 'accumulation' && latestSqueeze) {
      confidence += 0.05;
    }
    if (isSqueezeBreakout && squeezeBreakoutDir === 'up' && (phase === 'markup' || phase === 'accumulation')) {
      confidence += 0.10;
    }
    if (isSqueezeBreakout && squeezeBreakoutDir === 'down' && phase === 'markdown') {
      confidence += 0.10;
    }
    confidence = parseFloat(Math.min(0.98, Math.max(0.3, confidence)).toFixed(2));

    const phaseLabels = {
      accumulation: { zh: '吸筹阶段 (Accumulation)', en: 'Accumulation Phase' },
      markup: { zh: '上涨阶段 (Markup)', en: 'Markup Phase' },
      distribution: { zh: '派发阶段 (Distribution)', en: 'Distribution Phase' },
      markdown: { zh: '下跌阶段 (Markdown)', en: 'Markdown Phase' },
      neutral: { zh: '横盘震荡 (Consolidation)', en: 'Consolidation Phase' }
    };

    // Generate Commentary Insights
    let insightZh = '';
    let insightEn = '';
    const cleanSym = symbol.replace('.AX', '');

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
        insightZh += ` 虽有弱势反弹，但成交量极度低迷，属于买盘力量缺失的“无需求上涨”，后市继续看跌，切勿抄底。`;
        insightEn += ` Recent minor rebounds lack buying enthusiasm (no demand). Expect further declines; do not catch falling knives.`;
      } else {
        insightZh += ` 均线压力沉重，建议空仓避险，直到形成明显的底部吸筹区间。`;
        insightEn += ` Heavy resistance from moving averages suggests staying out until a new accumulation base is built.`;
      }
    } else {
      insightZh = `⚖️ ${cleanSym} 当前 Wyckoff 阶段信号混合。价格尚未形成明确的吸筹突破、派发确认或趋势延续结构，建议等待放量突破阻力或跌破支撑后再确认方向。`;
      insightEn = `⚖️ ${cleanSym} has mixed Wyckoff evidence. Price has not confirmed accumulation breakout, distribution, or a sustained trend yet. Wait for a volume-backed break above resistance or below support.`;
    }

    const chartAnnotations = ctx.events.map(e => ({
      index: e.index,
      event: e.event,
      label_zh: e.label_zh,
      label_en: e.label_en,
      price: e.price,
      date: e.date
    }));

    // Compute ATR trailing stop (Chandelier Exit)
    const atrTrailingStops = new Array(N).fill(null);
    let currentStop = null;
    const stopLookback = 22;
    const stopMultiplier = 3.0;
    for (let i = 0; i < N; i++) {
      if (atr[i] === null || atr[i] === undefined || isNaN(atr[i])) {
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
      const candidate = highestHigh - stopMultiplier * atr[i];
      if (currentStop === null) {
        currentStop = candidate;
      } else {
        if (dfCloses[i] < currentStop) {
          currentStop = candidate;
        } else {
          currentStop = Math.max(currentStop, candidate);
        }
      }
      atrTrailingStops[i] = parseFloat(currentStop.toFixed(2));
    }

    // Build history
    const fullHistory = df.map((day, idx) => {
      const matchedEvents = ctx.events.filter(e => e.index === idx);

      return {
        date: new Date(day.timestamp * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        close: day.Close,
        high: day.High,
        low: day.Low,
        open: day.Open,
        volume: day.Volume,
        ma5: ma5[idx],
        ma10: ma10[idx],
        ma20: ma20[idx],
        ma60: ma60[idx],
        bb_upper: bbUpper[idx] !== null ? parseFloat(bbUpper[idx].toFixed(2)) : null,
        bb_lower: bbLower[idx] !== null ? parseFloat(bbLower[idx].toFixed(2)) : null,
        atr_trailing_stop: atrTrailingStops[idx],
        events: matchedEvents.map(e => e.event)
      };
    });

    // Volatility parameters
    let atrPctSum = 0;
    let validCount = 0;
    for (let i = 0; i < N; i++) {
      if (atr[i] !== null && dfCloses[i] > 0) {
        atrPctSum += (atr[i] / dfCloses[i]) * 100;
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
      type: 'wyckoff',
      symbol: symbol.replace('.AX', ''),
      volatility_metrics: {
        avg_atr_pct: avgAtrPct,
        volatility_type: volType,
        rec_trailing_stop: recTrailingStop,
        rec_breakeven: recBreakeven
      },
      price: parseFloat(dfCloses[N - 1].toFixed(2)),
      chg_pct: parseFloat((((dfCloses[N - 1] - dfCloses[N - 2]) / dfCloses[N - 2]) * 100).toFixed(2)),
      volume: `${(dfVolumes[N - 1] / 1e6).toFixed(2)}M`,
      vol_ratio: parseFloat((dfVolumes[N - 1] / (avgVol20[N - 1] || 1)).toFixed(2)),
      rsi: rsi[N - 1] !== null ? parseFloat(rsi[N - 1].toFixed(1)) : null,
      support_level: finalSupport,
      resistance_level: finalResistance,
      phase: phase,
      phase_confidence: confidence,
      phase_label_zh: phaseLabels[phase].zh,
      phase_label_en: phaseLabels[phase].en,
      detected_events: ctx.events.slice(-20),
      bb_squeeze: {
        is_squeeze: latestSqueeze,
        is_breakout: isSqueezeBreakout,
        breakout_dir: squeezeBreakoutDir,
        bandwidth: bbBandwidth[N - 1] !== null ? parseFloat(bbBandwidth[N - 1].toFixed(4)) : null,
        upper: latestUpper !== null ? parseFloat(latestUpper.toFixed(2)) : null,
        lower: latestLower !== null ? parseFloat(latestLower.toFixed(2)) : null,
        middle: ma20[N - 1] !== null ? parseFloat(ma20[N - 1].toFixed(2)) : null
      },
      all_detected_events: ctx.events,
      wyckoff_subphase: wyckoffSubphase,
      wyckoff_subphase_label_zh: wyckoffSubphaseLabel_zh,
      wyckoff_subphase_label_en: wyckoffSubphaseLabel_en,
      effort_vs_result: {
        status: evrStatus,
        label_zh: evrLabelZh,
        label_en: evrLabelEn,
        detail_zh: evrDetailZh,
        detail_en: evrDetailEn
      },
      wyckoff_insight_zh: insightZh,
      wyckoff_insight_en: insightEn,
      chart_annotations: chartAnnotations,
      data_quality: {
        status: N < 60 ? 'warning' : 'good',
        message_zh: N < 60 ? '历史数据不足 60 天。MA60 指标已降级为 MA20，部分趋势判断可能不够准确。' : null,
        message_en: N < 60 ? 'Less than 60 days of historical data available. MA60 has degraded to MA20; trend diagnosis might be less accurate.' : null
      },
      chart_history: fullHistory
    };

  } catch (err) {
    console.error('Wyckoff Analysis Error:', err);
    return { error: `Wyckoff analysis failed: ${err.message}` };
  }
}

/**
 * Wyckoff + MACD Combined Strategy Analyzer
 */
export function analyzeWyckoffMacd(symbol, stockChart, indexChart = null, sensitivity = 0.3) {
  try {
    const result = analyzeWyckoff(symbol, stockChart, indexChart, sensitivity);
    if (result.error) return result;

    const closes = result.chart_history.map(x => x.close);
    const N = closes.length;
    const { macdLine, signalLine, hist } = getMACD(closes);
    const { bullishDivergence, bearishDivergence } = detectMACDDivergences(closes, macdLine);

    // Latest MACD metrics
    const latestMacd = macdLine[N - 1];
    const latestSignal = signalLine[N - 1];
    const latestHist = hist[N - 1];

    // Crossover signals in the last 10 days
    let recentBullishCross = false;
    let recentBearishCross = false;
    let recentZeroCrossUp = false;
    let recentZeroCrossDown = false;

    const lookback = Math.min(10, N - 2);
    for (let i = N - 1; i >= N - lookback; i--) {
      const prevM = macdLine[i - 1];
      const curM = macdLine[i];
      const prevS = signalLine[i - 1];
      const curS = signalLine[i];

      if (prevM !== null && curM !== null && prevS !== null && curS !== null) {
        if (prevM <= prevS && curM > curS) recentBullishCross = true;
        if (prevM >= prevS && curM < curS) recentBearishCross = true;
        if (prevM <= 0 && curM > 0) recentZeroCrossUp = true;
        if (prevM >= 0 && curM < 0) recentZeroCrossDown = true;
      }
    }

    // Adjust confidence and generate insights
    let macdInsightZh = '';
    let macdInsightEn = '';
    let confidence = result.phase_confidence;

    if (result.phase === 'accumulation' || result.phase === 'markup') {
      if (recentBullishCross) {
        confidence += 0.08;
        macdInsightZh += '（结合 MACD 金叉看涨确认）';
        macdInsightEn += ' (Confirmed by MACD Bullish Crossover)';
      }
      if (bullishDivergence) {
        confidence += 0.12;
        macdInsightZh += '（发现 MACD 底背离，筑底买盘强劲）';
        macdInsightEn += ' (Bullish MACD Divergence detected)';
      }
    } else if (result.phase === 'distribution' || result.phase === 'markdown') {
      if (recentBearishCross) {
        confidence += 0.08;
        macdInsightZh += '（结合 MACD 死叉看跌确认）';
        macdInsightEn += ' (Confirmed by MACD Bearish Crossover)';
      }
      if (bearishDivergence) {
        confidence += 0.12;
        macdInsightZh += '（发现 MACD 顶背离，警惕趋势反转）';
        macdInsightEn += ' (Bearish MACD Divergence detected)';
      }
    }

    confidence = parseFloat(Math.min(0.98, Math.max(0.3, confidence)).toFixed(2));

    const chartHistoryWithMacd = result.chart_history.map((day, idx) => ({
      ...day,
      macd: macdLine[idx] !== null ? parseFloat(macdLine[idx].toFixed(4)) : null,
      signal: signalLine[idx] !== null ? parseFloat(signalLine[idx].toFixed(4)) : null,
      hist: hist[idx] !== null ? parseFloat(hist[idx].toFixed(4)) : null
    }));

    return {
      ...result,
      type: 'wyckoff_macd',
      phase_confidence: confidence,
      wyckoff_insight_zh: result.wyckoff_insight_zh + macdInsightZh,
      wyckoff_insight_en: result.wyckoff_insight_en + macdInsightEn,
      chart_history: chartHistoryWithMacd,
      macd: {
        latest_macd: latestMacd !== null ? parseFloat(latestMacd.toFixed(4)) : null,
        latest_signal: latestSignal !== null ? parseFloat(latestSignal.toFixed(4)) : null,
        latest_hist: latestHist !== null ? parseFloat(latestHist.toFixed(4)) : null,
        bullish_divergence: bullishDivergence,
        bearish_divergence: bearishDivergence,
        recent_bullish_cross: recentBullishCross,
        recent_bearish_cross: recentBearishCross,
        recent_zero_cross_up: recentZeroCrossUp,
        recent_zero_cross_down: recentZeroCrossDown
      }
    };
  } catch (err) {
    console.error('Wyckoff MACD Analysis Error:', err);
    return { error: `Wyckoff MACD analysis failed: ${err.message}` };
  }
}
