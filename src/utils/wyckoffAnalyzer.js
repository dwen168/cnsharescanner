/**
 * Wyckoff Methodology Stock Analyzer
 * Analyzes stock price and volume history to determine the Wyckoff phase and identify key events.
 */

// Helper to calculate rolling average
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

// Helper to calculate rolling standard deviation
function getRollingStd(arr, period, means) {
  const std = new Array(arr.length).fill(null);
  for (let i = period - 1; i < arr.length; i++) {
    const mean = means[i];
    if (mean === null || mean === undefined) continue;
    let sumSq = 0;
    for (let j = 0; j < period; j++) {
      sumSq += Math.pow(arr[i - j] - mean, 2);
    }
    std[i] = Math.sqrt(sumSq / period);
  }
  return std;
}


// Helper to calculate rolling ATR
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

// Helper to calculate RSI (Wilder's Exponential Smoothing)
function getRSI(prices, period = 14) {
  const rsi = new Array(prices.length).fill(null);
  if (prices.length < period + 1) return rsi;

  const deltas = [];
  for (let i = 1; i < prices.length; i++) {
    deltas.push(prices[i] - prices[i - 1]);
  }

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

// Helper to find local pivot highs and lows (peaks and troughs)
function findPivotLevels(highs, lows, n = 5) {
  const pivotHighs = [];
  const pivotLows = [];
  const len = highs.length;
  const adjustedN = Math.max(2, Math.min(n, Math.floor(len / 4)));
  
  for (let i = adjustedN; i < len - adjustedN; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = -adjustedN; j <= adjustedN; j++) {
      if (j === 0) continue;
      if (highs[i + j] > highs[i]) isHigh = false;
      if (highs[i + j] === highs[i] && j > 0) isHigh = false;

      if (lows[i + j] < lows[i]) isLow = false;
      if (lows[i + j] === lows[i] && j > 0) isLow = false;
    }
    if (isHigh) {
      pivotHighs.push({ price: highs[i], index: i, strength: 1 });
    }
    if (isLow) {
      pivotLows.push({ price: lows[i], index: i, strength: 1 });
    }
  }
  return { pivotHighs, pivotLows };
}

// Helper to cluster price levels that are within 0.5 * ATR of each other
function clusterLevels(levels, atr, currentIdx) {
  if (levels.length === 0) return [];
  const sorted = [...levels].sort((a, b) => a.price - b.price);
  const clusters = [];
  let currentCluster = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const currentAtr = atr[curr.index] || atr[currentIdx] || (curr.price * 0.02);
    const threshold = 0.5 * currentAtr;
    
    if (curr.price - prev.price <= threshold) {
      currentCluster.push(curr);
    } else {
      clusters.push(currentCluster);
      currentCluster = [curr];
    }
  }
  clusters.push(currentCluster);

  return clusters.map(cluster => {
    const avgPrice = cluster.reduce((sum, item) => sum + item.price, 0) / cluster.length;
    const count = cluster.length;
    const maxIdx = Math.max(...cluster.map(item => item.index));
    const age = currentIdx - maxIdx;
    const recencyWeight = age <= 40 ? 1.0 : Math.max(0.3, 1.0 - (age - 40) / 200);
    
    let baseStrength = 0.8;
    if (count === 2) baseStrength = 1.5;
    else if (count >= 3) baseStrength = 2.5;

    return {
      price: avgPrice,
      strength: baseStrength,
      score: baseStrength * recencyWeight,
      index: maxIdx
    };
  });
}

// Helper to find the maximum pivot high in the range [currentIdx - 60, currentIdx - 5]
function getFallbackPivotResistance(currentIdx, pivotHighs, defaultVal) {
  let bestPrice = -Infinity;
  const startIdx = Math.max(0, currentIdx - 60);
  const endIdx = currentIdx - 5;
  for (let j = 0; j < pivotHighs.length; j++) {
    const p = pivotHighs[j];
    if (p.index >= startIdx && p.index <= endIdx) {
      if (p.price > bestPrice) {
        bestPrice = p.price;
      }
    }
  }
  return bestPrice !== -Infinity ? bestPrice : defaultVal;
}

/**
 * Analyzes the price and volume data using Richard Wyckoff's methodology.
 * @param {string} symbol - Stock symbol
 * @param {object} stockChart - Yahoo Finance Chart result
 * @param {object} indexChart - Yahoo Finance Chart result for ^AORD or ^AXJO
 * @param {number} sensitivity - User sensitivity slider value (0.1 to 1.0, default 0.3 is conservative)
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

    // Trailing 1-year (252 trading days) price position for structural check
    const yearlyLookback = Math.min(252, N);
    const yearlyHighs = dfHighs.slice(-yearlyLookback);
    const yearlyLows = dfLows.slice(-yearlyLookback);
    const yearHigh = Math.max(...yearlyHighs);
    const yearLow = Math.min(...yearlyLows);
    const yearRange = yearHigh - yearLow || 1;

    // Sensitivity-based modifiers
    // sensitivity range: 0.1 (extremely conservative/strict) to 1.0 (extremely aggressive/easy to trigger)
    // Default is 0.3 (conservative)
    // We scale volume & spread multiplier thresholds based on sensitivity.
    // Higher sensitivity = smaller multipliers (triggers events more easily).
    const sensFactor = 1.5 - sensitivity; // 0.3 -> 1.2, 0.8 -> 0.7, 0.1 -> 1.4

    // Pre-compute MA5 and MA10 once (Fix #10: avoid O(N²) in chart_history)
    const ma5 = getRollingMean(dfCloses, 5);
    const ma10 = getRollingMean(dfCloses, 10);

    // Pre-compute price pivots for the entire dataset (Step 1)
    const allPivots = findPivotLevels(dfHighs, dfLows, 5);

    // 3. Scan for Wyckoff events across history
    const events = [];
    
    // Support and Resistance tracking
    let supportLevels = [];
    let resistanceLevels = [];

    // Trading Range (TR) boundaries built from structural events
    // These are updated as SC/BC/AR/ST events are detected
    let trSupport = null;  // TR bottom: set by SC low, refined by ST
    let trResistance = null; // TR top: set by BC high or AR high

    // Temporary storage for climax anchors to verify Secondary Tests (ST)
    let lastSC = null; // { index, price, date }
    let lastBC = null; // { index, price, date }

    // SOS/SOW cooldown tracking (Fix #5: dedup)
    let lastSOSIndex = -Infinity;
    let lastSOWIndex = -Infinity;
    const SOS_SOW_COOLDOWN = 5; // minimum bars between SOS/SOW signals

    // UTAD / BU tracking variables
    let lastUTAD = null;
    let lastUTADInvalidated = false;
    let lastBUIndex = -Infinity;
    let lastFlagIndex = -Infinity;

    // Expiry distance for SC/BC anchors (Fix #12)
    const CLIMAX_EXPIRY_BARS = 60;

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
      
      // Determine daily move direction
      const isDownDay = close < dfCloses[i - 1];
      const isUpDay = close > dfCloses[i - 1];

      // Volume threshold for climax and breakouts
      const climaxVolThresh = 2.0 * sensFactor;
      const standardVolThresh = 1.2 * sensFactor;
      const breakoutVolThresh = 1.4 * sensFactor;

      // Fix #12: Expire stale SC/BC anchors
      if (lastSC && i - lastSC.index > CLIMAX_EXPIRY_BARS) lastSC = null;
      if (lastBC && i - lastBC.index > CLIMAX_EXPIRY_BARS) lastBC = null;

      // Tail ratio calculations for SC/BC detection (must be before the if-else chain)
      const lowerTailRatio = dailySpread > 0 ? (close - low) / dailySpread : 0;
      const upperTailRatio = dailySpread > 0 ? (high - close) / dailySpread : 0;

      // Price position in yearly range for structural validation
      const climaxPricePos = (close - yearLow) / yearRange;

      // Event A: Selling Climax (SC)
      // SC must occur in the lower half of the yearly range (pricePos < 0.50)
      // A "selling climax" at the top of a range is nonsensical per Wyckoff theory
      if (
        isDownDay &&
        volRatio > climaxVolThresh &&
        dailySpread > 1.5 * sensFactor * curAtr &&
        lowerTailRatio > 0.4 && // close must recover at least 40% off the low
        close < ma20[i] &&
        climaxPricePos < 0.50   // must be in the lower half of the range
      ) {
        events.push({
          index: i,
          event: 'SC',
          label_zh: '卖出高潮 (SC)',
          label_en: 'Selling Climax (SC)',
          date: dateStr,
          price: low,
          confidence: Math.min(0.95, 0.5 + (volRatio / 5) * 0.3 + lowerTailRatio * 0.15)
        });
        lastSC = { index: i, price: low, date: dateStr };
        supportLevels.push({ price: low, strength: 3, index: i });
        trSupport = low; // Establish TR bottom
      }

      // Event B: Buying Climax (BC)
      // BC must occur in the upper half of the yearly range (pricePos > 0.50)
      // A "buying climax" at the bottom of a range is nonsensical per Wyckoff theory
      else if (
        isUpDay &&
        volRatio > climaxVolThresh &&
        dailySpread > 1.5 * sensFactor * curAtr &&
        upperTailRatio > 0.4 && // close must be rejected at least 40% from the high
        close > ma20[i] &&
        climaxPricePos > 0.50   // must be in the upper half of the range
      ) {
        events.push({
          index: i,
          event: 'BC',
          label_zh: '买入高潮 (BC)',
          label_en: 'Buying Climax (BC)',
          date: dateStr,
          price: high,
          confidence: Math.min(0.95, 0.5 + (volRatio / 5) * 0.3 + upperTailRatio * 0.15)
        });
        lastBC = { index: i, price: high, date: dateStr };
        resistanceLevels.push({ price: high, strength: 3, index: i });
        trResistance = high; // Establish TR top
      }

      // Event C: Automatic Rally (AR) / Automatic Reaction (AR)
      // Fix #6: Use retrospective confirmation — mark AR at the end of the window
      // by looking back to find the peak/trough, instead of trying to mark on the fly
      // Fix: Use range check instead of exact i===index+8 so AR is detected
      // even when SC/BC occurs near the data end (last 8 bars)
      if (lastSC && !events.find(e => e.event === 'AR' && e.index > lastSC.index)) {
        const arWindowEnd = Math.min(lastSC.index + 8, N - 1);
        const minBarsNeeded = 3; // need at least 3 bars after SC to identify AR
        if (i === arWindowEnd && arWindowEnd >= lastSC.index + minBarsNeeded) {
          const windowHighs = dfHighs.slice(lastSC.index + 1, arWindowEnd + 1);
          const arHigh = Math.max(...windowHighs);
          const arHighLocalIdx = windowHighs.indexOf(arHigh);
          const arIdx = lastSC.index + 1 + arHighLocalIdx;
          const arDateStr = new Date(df[arIdx].timestamp * 1000).toISOString().split('T')[0];
          
          if (arHigh > lastSC.price) {
            events.push({
              index: arIdx,
              event: 'AR',
              label_zh: '自动反弹 (AR)',
              label_en: 'Automatic Rally (AR)',
              date: arDateStr,
              price: arHigh,
              confidence: 0.75
            });
            resistanceLevels.push({ price: arHigh, strength: 2, index: arIdx });
            // AR high establishes/refines TR top for accumulation
            if (!trResistance || arHigh > trResistance) {
              trResistance = arHigh;
            }
          }
        }
      }
      
      if (lastBC && !events.find(e => e.event === 'AR_Reaction' && e.index > lastBC.index)) {
        const arWindowEnd = Math.min(lastBC.index + 8, N - 1);
        const minBarsNeeded = 3;
        if (i === arWindowEnd && arWindowEnd >= lastBC.index + minBarsNeeded) {
          const windowLows = dfLows.slice(lastBC.index + 1, arWindowEnd + 1);
          const arLow = Math.min(...windowLows);
          const arLowLocalIdx = windowLows.indexOf(arLow);
          const arIdx = lastBC.index + 1 + arLowLocalIdx;
          const arDateStr = new Date(df[arIdx].timestamp * 1000).toISOString().split('T')[0];
          
          if (arLow < lastBC.price) {
            events.push({
              index: arIdx,
              event: 'AR_Reaction',
              label_zh: '自动回落 (AR)',
              label_en: 'Automatic Reaction (AR)',
              date: arDateStr,
              price: arLow,
              confidence: 0.75
            });
            supportLevels.push({ price: arLow, strength: 2, index: arIdx });
            // AR low establishes/refines TR bottom for distribution
            if (!trSupport || arLow < trSupport) {
              trSupport = arLow;
            }
          }
        }
      }

      // Event D: Secondary Test (ST)
      // ATR-based tolerance alignment with README (close < trSupport + 1.5 * ATR)
      if (lastSC && i > lastSC.index + 5 && i <= lastSC.index + 30) {
        const isNearScLow = close <= lastSC.price + 1.5 * curAtr && low >= lastSC.price - 0.5 * curAtr;
        const isLowVol = volRatio < 1.0 * (2 - sensFactor);
        const noPriorST = !events.some(e => e.event === 'ST' && e.index > lastSC.index && e.index < i);
        if (isNearScLow && isLowVol && noPriorST) {
          events.push({
            index: i,
            event: 'ST',
            label_zh: '二次测试 (ST)',
            label_en: 'Secondary Test (ST)',
            date: dateStr,
            price: low,
            confidence: 0.7
          });
          // ST refines TR support — use the higher of ST low vs SC low as stronger support
          if (trSupport !== null && low >= trSupport) {
            trSupport = low; // Higher low on ST = stronger support confirmation
          }
        }
      }
      
      if (lastBC && i > lastBC.index + 5 && i <= lastBC.index + 30) {
        const isNearBcHigh = close >= lastBC.price - 1.5 * curAtr && high <= lastBC.price + 0.5 * curAtr;
        const isLowVol = volRatio < 1.0 * (2 - sensFactor);
        const noPriorST = !events.some(e => e.event === 'ST_Dist' && e.index > lastBC.index && e.index < i);
        if (isNearBcHigh && isLowVol && noPriorST) {
          events.push({
            index: i,
            event: 'ST_Dist',
            label_zh: '二次测试 (ST)',
            label_en: 'Secondary Test (ST)',
            date: dateStr,
            price: high,
            confidence: 0.7
          });
          // ST refines TR resistance — use the lower of ST high vs BC high
          if (trResistance !== null && high <= trResistance) {
            trResistance = high;
          }
        }
      }

      // STRUCTURAL CHECK: Spring is an accumulation event — price must be in a DEPRESSED range.
      // Use absolute price position in full data range (immune to MA convergence).
      // A stock in the top 65% of its range should not generate Springs.
      // Fix: Spring requires prior SC or established TR support (trSupport !== null)
      // to ensure we are in an accumulation context, not a random dip.
      if (i > 30 && trSupport !== null) {
        const pricePos = (close - yearLow) / yearRange;
        if (pricePos < 0.65) {
          const activeSupport = trSupport;
          const maxPenetration = 0.03 * (1.5 - sensFactor); // max 3% below support (scaled by sensitivity)
          
          if (close > activeSupport && close > open && volRatio > 0.8) {
            let foundBreakout = false;
            let lowestLow = close;
            
            for (let look = 0; look <= 2; look++) {
              const checkIdx = i - look;
              if (checkIdx < 0) continue;
              const checkLow = dfLows[checkIdx];
              if (checkLow < activeSupport) {
                foundBreakout = true;
                if (checkLow < lowestLow) {
                  lowestLow = checkLow;
                }
              }
            }
            
            if (foundBreakout) {
              const penetrationDepth = activeSupport > 0 ? (activeSupport - lowestLow) / activeSupport : 0;
              if (penetrationDepth < maxPenetration) {
                const isNotMarkdown = ma20[i] > ma60[i] || close > ma20[i];
                if (isNotMarkdown) {
                  const alreadySpring = events.some(e => e.event === 'Spring' && (i - e.index <= 5));
                  if (!alreadySpring) {
                    events.push({
                      index: i,
                      event: 'Spring',
                      label_zh: '弹簧效应 (Spring)',
                      label_en: 'Spring / Shakeout',
                      date: dateStr,
                      price: lowestLow,
                      confidence: Math.min(0.95, 0.75 + (1 - penetrationDepth / maxPenetration) * 0.15)
                    });
                    supportLevels.push({ price: lowestLow, strength: 4, index: i });
                  }
                }
              }
            }
          }
        }
      }

      // STRUCTURAL CHECK: UTAD is a distribution event — price must be in an ELEVATED range.
      // Use absolute price position in full data range (immune to MA convergence).
      // A stock in the bottom 35% of its range should NEVER get UTAD.
      if (i > 30) {
        const pricePos = (close - yearLow) / yearRange;
        if (pricePos > 0.35) {
          // Prefer TR resistance established by BC/AR events; fall back to maximum pivot high (or rolling max if no pivot)
          const activeResistance = trResistance !== null
            ? trResistance
            : getFallbackPivotResistance(i, allPivots.pivotHighs, Math.max(...dfHighs.slice(i - 30, i)));
          
          // UTAD: price briefly breaks above TR resistance but closes back below it
          const brokeResistance = high > activeResistance;
          const penetrationDepth = activeResistance > 0 ? (high - activeResistance) / activeResistance : 0;
          const maxPenetration = 0.03 * (1.5 - sensFactor); // max 3% above resistance (scaled by sensitivity)
          const rejectedQuickly = close < activeResistance && penetrationDepth < maxPenetration;
          if (brokeResistance && rejectedQuickly && close < open) {
            // In a strong uptrend, minor rejections are normal and not UTAD.
            const isStrongUptrend = ma20[i] > ma60[i] && ma60[i] > ma120[i];
            if (!isStrongUptrend || volRatio > 1.3 || (open - close) > 0.02 * close) {
              events.push({
                index: i,
                event: 'UTAD',
                label_zh: '上轨假突破 (UTAD)',
                label_en: 'Upthrust (UT/UTAD)',
                date: dateStr,
                price: high,
                confidence: Math.min(0.95, 0.75 + (1 - penetrationDepth / maxPenetration) * 0.15)
              });
              resistanceLevels.push({ price: high, strength: 4, index: i });
              lastUTAD = { index: i, price: high, date: dateStr };
              lastUTADInvalidated = false;
            }
          }
        }
      }

      // Event G: SOS
      // Fix #5: Add cooldown dedup + phase-appropriateness check
      // SOS should only fire in accumulation-like conditions, not during clear distribution
      if (i > 25 && i - lastSOSIndex >= SOS_SOW_COOLDOWN) {
        const prevHighs = dfHighs.slice(i - 20, i);
        const localResistance = Math.max(...prevHighs);
        // Phase-appropriateness: SOS should NOT fire when MAs show clear bearish alignment
        const isBearishContext = ma20[i] !== null && ma60[i] !== null && ma20[i] < ma60[i] && close < ma20[i];
        if (close > localResistance && volRatio > breakoutVolThresh && close > open && !isBearishContext) {
          events.push({
            index: i,
            event: 'SOS',
            label_zh: '强势信号 (SOS)',
            label_en: 'Sign of Strength (SOS)',
            date: dateStr,
            price: close,
            confidence: 0.8
          });
          lastSOSIndex = i;
        }
      }

      // Event H: SOW
      // Fix #5: Add cooldown dedup + phase-appropriateness check
      // SOW should only fire in distribution-like conditions, not during clear accumulation
      if (i > 25 && i - lastSOWIndex >= SOS_SOW_COOLDOWN) {
        const prevLows = dfLows.slice(i - 20, i);
        const localSupport = Math.min(...prevLows);
        // Phase-appropriateness: SOW should NOT fire when MAs show clear bullish alignment
        const isBullishContext = ma20[i] !== null && ma60[i] !== null && ma20[i] > ma60[i] && close > ma20[i];
        if (close < localSupport && volRatio > breakoutVolThresh && close < open && !isBullishContext) {
          events.push({
            index: i,
            event: 'SOW',
            label_zh: '弱势信号 (SOW)',
            label_en: 'Sign of Weakness (SOW)',
            date: dateStr,
            price: close,
            confidence: 0.8
          });
          lastSOWIndex = i;
        }
      }

      // Event I: UTAD Failure Breakout (JAC / UTAD Invalidation / 空头踩踏)
      if (lastUTAD && !lastUTADInvalidated && i - lastUTAD.index <= 20) {
        if (close > lastUTAD.price) {
          events.push({
            index: i,
            event: 'UTAD_Failure',
            label_zh: '空头踩踏突破 (JAC/UTAD-F)',
            label_en: 'UTAD Failure Breakout (JAC)',
            date: dateStr,
            price: close,
            confidence: 0.85
          });
          lastUTADInvalidated = true; // prevent duplicate triggering
        }
      }

      // Event J: Backup to Resistance (BU / 无量回踩确认)
      if (i > 25 && i - lastBUIndex >= 8) {
        const activeResistance = trResistance !== null
          ? trResistance
          : getFallbackPivotResistance(i, allPivots.pivotHighs, Math.max(...dfHighs.slice(i - 30, i)));
        
        if (activeResistance > 0) {
          // Check if price broke out above resistance in the last 15 days
          const brokeOutRecently = dfCloses.slice(i - 15, i).some(c => c > activeResistance);
          
          if (brokeOutRecently) {
            // Is price currently pulling back close to resistance? (within 1.5 * ATR)
            const isNearResistance = Math.abs(close - activeResistance) <= 1.5 * curAtr;
            // Is the daily low holding above activeResistance - 1.0 * ATR? (no deep breakdown)
            const lowHoldsAboveLine = low >= activeResistance - 1.0 * curAtr;
            // Is volume low? (less than 85% of 20d average)
            const isLowVolume = volRatio < 0.85;
            // Did price stabilize? (阳线 or close did not drop significantly)
            const priceStabilized = close >= open || close > dfCloses[i - 1] - 0.3 * curAtr;

            if (isNearResistance && lowHoldsAboveLine && isLowVolume && priceStabilized) {
              events.push({
                index: i,
                event: 'BU',
                label_zh: '无量回踩确认 (BU)',
                label_en: 'Backup to Resistance (BU)',
                date: dateStr,
                price: close,
                confidence: 0.80
              });
              lastBUIndex = i;
            }
          }
        }
      }

      // Event K: Golden Flag Breakout (Flag / 黄金旗形突破)
      if (i > 30 && i - lastFlagIndex >= 8) {
        // We look for a tight consolidation window of size k (where k is between 3 and 8 bars)
        for (let k = 3; k <= 8; k++) {
          if (i - k - 10 < 0) continue;
          
          const consolidationHigh = Math.max(...dfHighs.slice(i - k, i));
          const consolidationLow = Math.min(...dfLows.slice(i - k, i));
          const consolidationRangePct = (consolidationHigh - consolidationLow) / consolidationLow;
          
          // Consolidation must be tight (either less than 7% or within 2.2 * ATR)
          const isConsolidationTight = consolidationRangePct < 0.07 || (consolidationHigh - consolidationLow) <= 2.2 * curAtr;
          
          // Consolidation average volume must be dry (less than 85% of 20d average volume)
          const windowVols = dfVolumes.slice(i - k, i);
          const consolidationAvgVol = windowVols.reduce((sum, v) => sum + v, 0) / k;
          const prevAvgVol = avgVol20[i - 1] || 1;
          const isConsolidationLowVol = (consolidationAvgVol / prevAvgVol) < 0.85;
          
          if (isConsolidationTight && isConsolidationLowVol) {
            // Check for flagpole surge before the consolidation
            const flagpoleBase = dfLows.slice(i - k - 10, i - k).reduce((min, l) => Math.min(min, l), Infinity);
            const flagpoleRise = (consolidationHigh - flagpoleBase) / flagpoleBase;
            
            // Flagpole must represent a rise of at least 8%, or we had a recent SOS/JAC event in the last 15 days
            const hasRecentBreakout = events.some(e => ['SOS', 'UTAD_Failure', 'JAC'].includes(e.event) && (i - e.index <= 15 && i - e.index >= k));
            const hasFlagpole = flagpoleRise > 0.08 || hasRecentBreakout;
            
            if (hasFlagpole) {
              // Current day i must break out above the consolidation high and occur in a structural Markup phase context
              const isMarkupContext = ma20[i] !== null && ma60[i] !== null && ma120[i] !== null &&
                                      ma20[i] > ma60[i] && ma60[i] > ma120[i] && close > ma20[i];
              const isBreakoutDay = close > consolidationHigh && volRatio > 1.2 && close > open && close > dfCloses[i - 1] && isMarkupContext;
              if (isBreakoutDay) {
                events.push({
                  index: i,
                  event: 'Flag',
                  label_zh: '黄金旗形突破 (Flag)',
                  label_en: 'Bull Flag Breakout (Flag)',
                  date: dateStr,
                  price: close,
                  confidence: 0.82
                });
                lastFlagIndex = i;
                break; // stop scanning other windows for this index
              }
            }
          }
        }
      }
    }

    // 4. Calculate final Support & Resistance lines (Step 4 & 6)
    let finalSupport = null;
    let finalResistance = null;

    const currentPriceVal = dfCloses[N - 1];

    // Filter Wyckoff event candidates (increased lookback window to 150 bars)
    const validSupports = supportLevels.filter(s => s.price <= currentPriceVal * 1.01 && (N - s.index) <= 150);
    const validResistances = resistanceLevels.filter(r => r.price >= currentPriceVal * 0.99 && (N - r.index) <= 150);

    // Cluster pivot highs and lows (up to the current index N - 1)
    const clusteredPivotLows = clusterLevels(allPivots.pivotLows, atr, N - 1);
    const clusteredPivotHighs = clusterLevels(allPivots.pivotHighs, atr, N - 1);

    // Merge candidates
    const allSupportCandidates = [...validSupports];
    clusteredPivotLows.forEach(cp => {
      // Avoid duplicate or too close levels
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

    // Score candidates with recency weighting
    if (allSupportCandidates.length > 0) {
      const scoredSupports = allSupportCandidates.map(s => {
        const age = N - s.index;
        const recencyWeight = age <= 40 ? 1.0 : Math.max(0.3, 1.0 - (age - 40) / 200);
        return { ...s, score: s.strength * recencyWeight };
      });
      scoredSupports.sort((a, b) => b.score - a.score);
      finalSupport = parseFloat(scoredSupports[0].price.toFixed(2));
    } else {
      // Absolute fallback if everything is empty: use the 60-day minimum price
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
      // Absolute fallback if everything is empty: use the 60-day maximum price
      finalResistance = parseFloat(Math.max(...dfHighs.slice(-60)).toFixed(2));
    }

    // Fix #7: Use ATR-based minimum gap instead of hardcoded 10%
    const latestAtr = atr[N - 1] || (dfCloses[N - 1] * 0.02);
    if (finalSupport >= finalResistance) {
      finalSupport = parseFloat((finalResistance - 2 * latestAtr).toFixed(2));
    }

    // 5. Effort vs Result (EVR) analysis for the latest 10 days
    let evrStatus = 'neutral';
    let evrLabelZh = '量价均衡';
    let evrLabelEn = 'Effort-Result Balanced';
    let evrDetailZh = '最近量价关系表现平稳，符合市场常态。';
    let evrDetailEn = 'Recent price actions match volume changes, indicating market equilibrium.';

    // Fix #8: EVR analysis — use ATR-relative spread instead of fixed 0.5% threshold
    const evrLookback = Math.min(10, N - 1);
    let risingVolCount = 0;
    let flatPriceCount = 0;
    let highEffortLowResultCount = 0; // volume up but price spread is small relative to ATR

    for (let j = N - evrLookback; j < N; j++) {
      const prevC = dfCloses[j - 1];
      const curC = dfCloses[j];
      const curV = dfVolumes[j];
      const curAvgV = avgVol20[j] || curV;
      const curDayAtr = atr[j] || (curC * 0.02);
      
      const volAboveAvg = curV > curAvgV * 1.1;
      // Use ATR-relative price movement instead of fixed percentage
      const priceMove = Math.abs(curC - prevC);
      const priceConsolidation = priceMove < curDayAtr * 0.3; // moved less than 30% of ATR
      
      if (volAboveAvg) {
        risingVolCount++;
        if (priceConsolidation) {
          flatPriceCount++;
          highEffortLowResultCount++;
        }
      }
    }

    if (risingVolCount >= 3 && flatPriceCount >= 2) {
      const currentPrice = dfCloses[N - 1];
      const distFromSupport = (currentPrice - finalSupport) / finalSupport;
      const distFromResistance = (finalResistance - currentPrice) / currentPrice;

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

    // 6. Phase Classification
    let phase = 'neutral';
    let confidence = 0.5;

    const currentPrice = dfCloses[N - 1];
    const currentMA20 = ma20[N - 1];
    const currentMA60 = ma60[N - 1];
    const currentMA120 = ma120[N - 1];

    const recentEvents = events.filter(e => e.index >= N - 40);
    const hasRecentSOS = recentEvents.some(e => e.event === 'SOS');
    const hasRecentSOW = recentEvents.some(e => e.event === 'SOW');
    const hasRecentSpring = recentEvents.some(e => e.event === 'Spring');
    const hasRecentUTAD = recentEvents.some(e => e.event === 'UTAD');
    const hasRecentSC = recentEvents.some(e => e.event === 'SC');
    const hasRecentBC = recentEvents.some(e => e.event === 'BC');

    // Fix #9: Normalize MA120 slope as percentage change, guard against NaN/null
    const ma120Ref = N >= 160 ? ma120[N - 40] : (N >= 130 ? ma120[N - 10] : null);
    let ma120Slope = 0;
        if (currentMA120 !== null && ma120Ref !== null && ma120Ref > 0) {
      ma120Slope = (currentMA120 - ma120Ref) / ma120Ref; // normalized percentage
    }

    const currentPricePosition = (currentPrice - yearLow) / yearRange;
    // Check for SOW failure to recover (Fix SOW lag/breakout confirmation)
    // If a SOW occurred in the last 5 days, and price failed to reclaim 50% of that SOW drop day's high-low range,
    // it signals a true breakdown rather than a temporary shakeout.
    let hasFailedSOWRecovery = false;
    let sowFailPrice = 0;
    const recentSowEvent = events.slice().reverse().find(e => e.event === 'SOW' && e.index >= N - 5);
    if (recentSowEvent) {
      const sowIdx = recentSowEvent.index;
      const sowHigh = dfHighs[sowIdx];
      const sowLow = dfLows[sowIdx];
      const reclaimThreshold = sowLow + (sowHigh - sowLow) * 0.5; // 50% reclaim
      if (currentPrice < reclaimThreshold) {
        hasFailedSOWRecovery = true;
        sowFailPrice = reclaimThreshold;
      }
    }

    const isDepressedRange = currentPricePosition < 0.40;
    const isElevatedRange = currentPricePosition > 0.60;

    // A broader check for markup (uptrend) and markdown (downtrend)
    // Check if we have a recent confirmed breakout event (SOS, UTAD_Failure, or Flag) in the last 20 days
    const recentBreakout = events.slice().reverse().find(e => ['SOS', 'UTAD_Failure', 'Flag'].includes(e.event) && e.index >= N - 20);
    const hasConfirmedBreakout = recentBreakout && finalResistance && currentPrice > finalResistance * 0.95 && !hasFailedSOWRecovery;

    const isUptrend = currentMA60 !== null && currentMA120 !== null && 
      currentMA60 > currentMA120 && currentPrice > currentMA60 && ma120Slope > -0.002;
    const isDowntrend = currentMA60 !== null && currentMA120 !== null &&
      currentMA60 < currentMA120 && currentPrice < currentMA60 && ma120Slope < 0.002;

    if ((isUptrend || hasConfirmedBreakout) && !hasFailedSOWRecovery) {
      phase = 'markup';
      confidence = hasConfirmedBreakout ? 0.8 : 0.7;
      if (hasRecentSOS) confidence += 0.15;
      if (evrStatus === 'bullish_consolidation_no_supply') confidence += 0.15;
    } else if (isDowntrend || hasFailedSOWRecovery) {
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
        // Cross-validate: distribution requires elevated price position plus bearish evidence.
        // Local resistance can sit near the bottom after a selloff, so proximity to resistance
        // alone should not create a Distribution warning.
        const hasDistributionEvidence = hasRecentUTAD || hasRecentBC || evrStatus === 'bearish_divergence';
        const hasBearishContext = ma120Slope < 0.002 || hasRecentSOW || evrStatus === 'bearish_divergence';
        if (isElevatedRange && hasDistributionEvidence && hasBearishContext) {
          phase = 'distribution';
          confidence = 0.65;
          if (hasRecentUTAD) confidence += 0.15;
          if (evrStatus === 'bearish_divergence') confidence += 0.1;
        } else if (isDepressedRange || distFromSupport < distFromResistance) {
          // Bottom or lower-half range: treat as accumulation/base-building, even if price
          // is pressing into a nearby local resistance.
          phase = 'accumulation';
          confidence = 0.58;
          if (evrStatus === 'bullish_divergence') confidence += 0.1;
        } else {
          phase = 'neutral';
          confidence = 0.5;
        }
      } else {
        // If the long-term trend (MA120) is clearly rising, it is Re-accumulation
        if (ma120Slope >= 0.002) {
          phase = 'accumulation';
          confidence = 0.6;
        // Re-distribution: falling MA120 + price in upper range = redistribution
        // But if price is at the bottom, falling MA120 means markdown/accumulation, NOT redistribution
        } else if (ma120Slope <= -0.003) {
          if (isElevatedRange) {
            phase = 'distribution';
            confidence = 0.6;
          } else {
            // Price is at the bottom with falling MA120 = late markdown / early accumulation
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

    // 7. Generate Wyckoff Insight Commentary
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

    const chartAnnotations = events.map(e => ({
      index: e.index,
      event: e.event,
      label_zh: e.label_zh,
      label_en: e.label_en,
      price: e.price,
      date: e.date
    }));

    // Compute ATR trailing stop values (Chandelier Exit) chronologically
    const atrTrailingStops = new Array(N).fill(null);
    let currentStop = null;
    const lookback = 22; // Chandelier Exit standard lookback
    const stopMultiplier = 3.0;
    for (let i = 0; i < N; i++) {
      if (atr[i] === null || atr[i] === undefined || isNaN(atr[i])) {
        atrTrailingStops[i] = null;
        continue;
      }
      const startIdx = Math.max(0, i - lookback + 1);
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
          // Reset stop since price closed below it (stop triggered)
          currentStop = candidate;
        } else {
          // Trailing stop can only move up
          currentStop = Math.max(currentStop, candidate);
        }
      }
      atrTrailingStops[i] = parseFloat(currentStop.toFixed(2));
    }

    // Fix #10: Use pre-computed ma5/ma10 instead of recalculating per row (was O(N²))
    const fullHistory = df.map((day, idx) => {
      const matchedEvents = events.filter(e => e.index === idx);
      
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

    // Calculate average ATR percentage over history (Step 1)
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
      detected_events: events.slice(-10), // return last 10 events for timeline
      bb_squeeze: {
        is_squeeze: latestSqueeze,
        is_breakout: isSqueezeBreakout,
        breakout_dir: squeezeBreakoutDir,
        bandwidth: bbBandwidth[N - 1] !== null ? parseFloat(bbBandwidth[N - 1].toFixed(4)) : null,
        upper: latestUpper !== null ? parseFloat(latestUpper.toFixed(2)) : null,
        lower: latestLower !== null ? parseFloat(latestLower.toFixed(2)) : null,
        middle: ma20[N - 1] !== null ? parseFloat(ma20[N - 1].toFixed(2)) : null
      },
      all_detected_events: events,
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

// EMA Helper for MACD calculation
function getEMA(arr, period) {
  const ema = new Array(arr.length).fill(null);
  if (arr.length < period) return ema;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += arr[i];
  }
  let prevEma = sum / period;
  ema[period - 1] = prevEma;

  const k = 2 / (period + 1);
  for (let i = period; i < arr.length; i++) {
    const curEma = arr[i] * k + prevEma * (1 - k);
    ema[i] = curEma;
    prevEma = curEma;
  }
  return ema;
}

// MACD Helper: Computes MACD line, Signal line, and Histogram
function getMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEma = getEMA(closes, fastPeriod);
  const slowEma = getEMA(closes, slowPeriod);

  const macdLine = new Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    if (fastEma[i] !== null && slowEma[i] !== null) {
      macdLine[i] = fastEma[i] - slowEma[i];
    }
  }

  const firstValidIndex = macdLine.findIndex(x => x !== null);
  const signalLine = new Array(closes.length).fill(null);
  const hist = new Array(closes.length).fill(null);

  if (firstValidIndex !== -1) {
    const validMacd = macdLine.slice(firstValidIndex);
    const validSignal = getEMA(validMacd, signalPeriod);

    for (let i = 0; i < validSignal.length; i++) {
      const targetIdx = firstValidIndex + i;
      signalLine[targetIdx] = validSignal[i];
      if (macdLine[targetIdx] !== null && signalLine[targetIdx] !== null) {
        hist[targetIdx] = macdLine[targetIdx] - signalLine[targetIdx];
      }
    }
  }

  return { macdLine, signalLine, hist };
}

// Helper to detect MACD vs Price divergences over the last 40 days
function detectMACDDivergences(closes, macdLine) {
  const N = closes.length;
  let bullishDivergence = false;
  let bearishDivergence = false;

  const isLocalMin = (i) => closes[i] < closes[i - 1] && closes[i] < closes[i + 1];
  const isLocalMax = (i) => closes[i] > closes[i - 1] && closes[i] > closes[i + 1];

  const localMins = [];
  const localMaxs = [];

  const startIdx = Math.max(1, N - 40);
  const endIdx = N - 2;

  for (let i = startIdx; i <= endIdx; i++) {
    if (isLocalMin(i) && macdLine[i] !== null && macdLine[i] !== undefined) {
      localMins.push({ index: i, price: closes[i], macd: macdLine[i] });
    }
    if (isLocalMax(i) && macdLine[i] !== null && macdLine[i] !== undefined) {
      localMaxs.push({ index: i, price: closes[i], macd: macdLine[i] });
    }
  }

  // Check bullish divergence (lower price low, higher MACD low)
  if (localMins.length >= 2) {
    const m1 = localMins[localMins.length - 2];
    const m2 = localMins[localMins.length - 1];
    if (m2.price < m1.price && m2.macd > m1.macd && (m2.index - m1.index) >= 4) {
      bullishDivergence = true;
    }
  }

  // Check bearish divergence (higher price high, lower MACD high)
  if (localMaxs.length >= 2) {
    const h1 = localMaxs[localMaxs.length - 2];
    const h2 = localMaxs[localMaxs.length - 1];
    if (h2.price > h1.price && h2.macd < h1.macd && (h2.index - h1.index) >= 4) {
      bearishDivergence = true;
    }
  }

  return { bullishDivergence, bearishDivergence };
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

    // Crossovers in the last 5 days
    let recentBullishCross = false;
    let recentBearishCross = false;
    let recentZeroCrossUp = false;
    let recentZeroCrossDown = false;

    const checkLen = Math.min(5, N - 1);
    for (let i = N - checkLen; i < N; i++) {
      if (macdLine[i] !== null && signalLine[i] !== null && macdLine[i - 1] !== null && signalLine[i - 1] !== null) {
        if (macdLine[i] > signalLine[i] && macdLine[i - 1] <= signalLine[i - 1]) {
          recentBullishCross = true;
        }
        if (macdLine[i] < signalLine[i] && macdLine[i - 1] >= signalLine[i - 1]) {
          recentBearishCross = true;
        }
      }
      if (macdLine[i] !== null && macdLine[i - 1] !== null) {
        if (macdLine[i] > 0 && macdLine[i - 1] <= 0) {
          recentZeroCrossUp = true;
        }
        if (macdLine[i] < 0 && macdLine[i - 1] >= 0) {
          recentZeroCrossDown = true;
        }
      }
    }

    const latestMacd = macdLine[N - 1];
    const latestSignal = signalLine[N - 1];
    const latestHist = hist[N - 1];

    let phase = result.phase;
    let confidence = result.phase_confidence;
    let macdInsightZh = "";
    let macdInsightEn = "";

    const latestVolRatio = result.vol_ratio;
    const isHighVolume = latestVolRatio > 1.3;
    const isBullishMacd = latestMacd > latestSignal;

    if (phase === 'accumulation') {
      if (isBullishMacd || bullishDivergence) {
        confidence += 0.15;
        const volTextZh = isHighVolume ? "放量" : "温和";
        const volTextEn = isHighVolume ? "high-volume" : "moderate-volume";
        const typeTextZh = recentBullishCross ? `形成${volTextZh}金叉` : "处于金叉多头维持状态";
        const typeTextEn = recentBullishCross ? `formed a ${volTextEn} golden cross` : "remains in a sustained bullish golden cross state";

        // Fix: When both divergence AND golden cross coexist, mention both signals
        if (bullishDivergence && isBullishMacd) {
          macdInsightZh = `\n\n📊 【MACD 辅助确认】：双重底部信号共振！检测到 MACD 底背离 + ${typeTextZh}。在 Wyckoff 吸筹/筑底期，两者同时出现意味着卖压彻底衰竭、买盘力量强势介入，是极高置信度的底部确认，突破概率显著提升。`;
          macdInsightEn = `\n\n📊 [MACD Confirmation]: DUAL bullish signal resonance! A MACD bullish divergence AND ${typeTextEn} were detected simultaneously. In the Wyckoff Accumulation phase, this combination strongly confirms selling exhaustion and buyer control, significantly increasing breakout probability.`;
        } else if (bullishDivergence) {
          macdInsightZh = `\n\n📊 【MACD 辅助确认】：检测到 MACD 底背离（价格创新低但MACD未创新低）。在 Wyckoff 吸筹/筑底期，底背离显示卖压衰竭且多头动能正在积蓄，与底部支撑形成共振，增大筑底成功概率。`;
          macdInsightEn = `\n\n📊 [MACD Confirmation]: A MACD bullish divergence was detected (price made lower low but MACD did not). In the Wyckoff Accumulation phase, this signals seller exhaustion and building buyer momentum, resonating with the support base.`;
        } else {
          macdInsightZh = `\n\n📊 【MACD 辅助确认】：检测到 MACD ${typeTextZh}。在 Wyckoff 吸筹/筑底期，MACD 金叉显示卖压衰竭且短期买盘力量占优，这与底部支撑形成多头共振，增大了筑底成功及向上突破的概率。`;
          macdInsightEn = `\n\n📊 [MACD Confirmation]: MACD ${typeTextEn}. In the Wyckoff Accumulation phase, this signals exhaustion of selling pressure and emerging buyers, providing bullish resonance with the support floor and increasing the breakout probability.`;
        }
      } else {
        confidence -= 0.08;
        const aboveZero = latestMacd > 0;
        macdInsightZh = `\n\n📊 【MACD 辅助确认】：MACD 双线目前处于死叉状态（DIF < DEA），运行于零轴${aboveZero ? '上方（多头区域，但动能减弱）' : '下方（空头区域）'}，表明短期空头动能仍占主导，筑底区间仍需震荡整理，耐心等待金叉信号。`;
        macdInsightEn = `\n\n📊 [MACD Confirmation]: MACD lines are currently in a bearish dead-cross (DIF < DEA), trading ${aboveZero ? 'above the zero line but losing bullish momentum' : 'below the zero line in bearish territory'}, indicating short-term downward momentum still dominates. The accumulation range requires further consolidation.`;
      }
    } else if (phase === 'markup') {
      if (recentBearishCross || !isBullishMacd) {
        confidence -= 0.12;
        macdInsightZh = `\n\n📊 【MACD 辅助确认】：警告：MACD 刚刚或已处于死叉空头状态（DIF < DEA）。虽然处于上涨拉升主升浪中，但死叉状态警示短期面临获利盘回吐或上升斜率放缓，建议防范震荡回调，关注支撑位支撑力度。`;
        macdInsightEn = `\n\n📊 [MACD Confirmation]: WARNING: MACD has recently crossed or is currently in a bearish dead-cross state (DIF < DEA). Although the stock remains in a structural markup trend, the dead-cross alerts to short-term profit-taking or consolidation. Manage risk and watch key support levels.`;
      } else if (isBullishMacd && latestMacd > 0) {
        confidence += 0.10;
        macdInsightZh = `\n\n📊 【MACD 辅助确认】：MACD 运行于零轴上方且维持金叉多头排列（DIF > DEA），直观确认了拉升趋势（主升浪）中的强劲上涨动能，趋势延续性良好。`;
        macdInsightEn = `\n\n📊 [MACD Confirmation]: MACD remains above the zero axis with a sustained bullish golden cross (DIF > DEA), confirming robust upward momentum in the Markup phase and supporting trend continuation.`;
      } else if (isBullishMacd && latestMacd <= 0) {
        // Fix: golden cross but still below zero — early stage of markup recovery from oversold
        confidence += 0.05;
        macdInsightZh = `\n\n📊 【MACD 辅助确认】：MACD 刚形成金叉（DIF > DEA），但 DIF 仍运行于零轴下方，说明主升浪处于从超跌区域复苏的早期阶段，多头力量正在积聚但尚未完全占主导，等待 DIF 站上零轴后确认趋势延续。`;
        macdInsightEn = `\n\n📊 [MACD Confirmation]: MACD has formed a golden cross (DIF > DEA), but DIF remains below the zero line, indicating an early-stage recovery from oversold levels. Bullish momentum is building but not yet dominant. Wait for DIF to cross above zero to confirm the markup continuation.`;
      } else {
        // isBullishMacd=false, but no recentBearishCross either — momentum flat
        macdInsightZh = `\n\n📊 【MACD 辅助确认】：MACD 动能表现持平，红绿柱处于收缩状态，多空双方在当前位置力量较为均衡，关注成交量是否重新放大配合拉升。`;
        macdInsightEn = `\n\n📊 [MACD Confirmation]: MACD momentum is flat with contracting histogram bars, reflecting a temporary balance of power within the markup trend. Watch for volume expansion to trigger the next leg.`;
      }
    } else if (phase === 'distribution') {
      // Fix: Separate bearishDivergence from dead-cross to avoid text mismatch when golden cross + divergence coexist
      if (bearishDivergence && !isBullishMacd) {
        // Strongest bearish signal: both dead-cross AND top divergence
        confidence += 0.18;
        macdInsightZh = `\n\n📊 【MACD 辅助确认】：双重顶部信号共振！检测到 MACD 顶背离 + 死叉空头状态。在 Wyckoff 高位派发区，两者同时出现强烈印证了买方力量彻底衰竭、主力出货意志坚定，下行风险极高。`;
        macdInsightEn = `\n\n📊 [MACD Confirmation]: DUAL bearish signal resonance! A MACD bearish divergence AND dead-cross state were detected simultaneously. In the Wyckoff Distribution phase, this strongly confirms buying exhaustion and aggressive institutional supply dumping. Downside risk is extreme.`;
      } else if (bearishDivergence) {
        // Bearish divergence exists but MACD still in golden cross — early distribution warning
        confidence += 0.10;
        macdInsightZh = `\n\n📊 【MACD 辅助确认】：检测到 MACD 顶背离（价格创新高但MACD未创新高），这是高位多头衰竭的早期警告。尽管 MACD 仍维持金叉，顶背离暗示上涨动能已在衰减，宜谨慎对待高位追涨，逐步锁定利润。`;
        macdInsightEn = `\n\n📊 [MACD Confirmation]: A MACD bearish divergence was detected (price made higher high but MACD did not), an early warning of buying exhaustion at highs. Although MACD remains in a golden cross, the divergence signals weakening upward momentum. Reduce exposure gradually.`;
      } else if (!isBullishMacd) {
        // Pure dead-cross without divergence
        confidence += 0.12;
        macdInsightZh = `\n\n📊 【MACD 辅助确认】：MACD 处于死叉空头状态（DIF < DEA）。在 Wyckoff 高位派发区，死叉印证了买方力量的极度匮乏与多头衰竭，主力出货迹象十分明确，强烈建议防范下行风险。`;
        macdInsightEn = `\n\n📊 [MACD Confirmation]: MACD is in a bearish dead-cross state (DIF < DEA). In the Wyckoff Distribution phase, this confirms buying exhaustion and institutional supply dumping. Downside risk is extremely high; capital preservation is strongly advised.`;
      } else {
        // Golden cross, no divergence — mildest distribution warning
        confidence -= 0.05;
        macdInsightZh = `\n\n📊 【MACD 辅助确认】：MACD 双线虽维持金叉多头状态，但高位筹码松动且红柱呈收缩趋势，表明上攻动能正在衰减，宜分批减仓，切勿盲目追高。`;
        macdInsightEn = `\n\n📊 [MACD Confirmation]: Although MACD lines remain in a golden cross, contracting bullish histogram bars at high levels indicate weakening upward momentum. Reduce exposure on strength and do not chase.`;
      }
    } else if (phase === 'markdown') {
      if (bullishDivergence) {
        confidence -= 0.10;
        macdInsightZh = `\n\n📊 【MACD 辅助确认】：警示：价格仍在破位下行，但 MACD 已出现底背离（超跌）。说明空头抛压在边际递减，可密切关注后续是否出现放量卖出高潮(SC)或二次测试(ST)以确认筑底。`;
        macdInsightEn = `\n\n📊 [MACD Confirmation]: NOTE: Price is still sliding, but a MACD bullish divergence has formed at oversold levels. This suggests selling pressure is diminishing at the margin.`;
      } else if (isBullishMacd) {
        confidence -= 0.03; // Slightly reduce downward confidence due to temporary bounce
        macdInsightZh = `\n\n📊 【MACD 辅助确认】：MACD 在零轴下方超跌区域形成金叉（DIF > DEA），表明价格在连续下跌后短期有反弹修正的诉求。但由于大趋势处于 Wyckoff 破位下行主干，此金叉大概率仅为技术性反弹，谨慎追高。`;
        macdInsightEn = `\n\n📊 [MACD Confirmation]: MACD formed a golden cross (DIF > DEA) in oversold territory below the zero line, reflecting a short-term need for a technical rebound. However, since the primary trend is a structural markdown, exercise caution as this is likely temporary.`;
      } else {
        confidence += 0.10;
        macdInsightZh = `\n\n📊 【MACD 辅助确认】：MACD 运行于零轴下方极弱空头区间（DIF < DEA），且处于空头死叉发散状态，主跌浪空头动能仍在充分释放，无任何企稳迹象，切勿盲目抄底。`;
        macdInsightEn = `\n\n📊 [MACD Confirmation]: MACD is trading deeply below the zero line in a bearish dead-cross state (DIF < DEA) with expanding bearish alignment. Downward momentum is in full force; do not attempt to catch falling knives.`;
      }
    } else {
      if (isBullishMacd) {
        if (recentBullishCross) {
          macdInsightZh = `\n\n📊 【MACD 辅助确认】：MACD 刚刚在低位形成金叉，多头动能有所抬头，有助于价格向上突破震荡区间上轨。`;
          macdInsightEn = `\n\n📊 [MACD Confirmation]: MACD has just formed a low-level golden cross, indicating rising bullish momentum which may assist in a breakout above the consolidation range resistance.`;
        } else {
          macdInsightZh = `\n\n📊 【MACD 辅助确认】：MACD 处于金叉多头维持状态（DIF > DEA），表明区间内的短期反弹动能较强，关注是否能带量挑战区间上轨。`;
          macdInsightEn = `\n\n📊 [MACD Confirmation]: MACD remains in a bullish golden cross state (DIF > DEA), showing strong short-term upward momentum within the range. Watch for a test of the range resistance.`;
        }
      } else {
        if (recentBearishCross) {
          macdInsightZh = `\n\n📊 【MACD 辅助确认】：MACD 刚刚在高位形成死叉，短期动能转空，警惕震荡区间下轨支撑受测试。`;
          macdInsightEn = `\n\n📊 [MACD Confirmation]: MACD has just formed an upper-level dead-cross. Short-term momentum is shifting to the downside; watch for a retest of the range support.`;
        } else {
          const macdDiff = Math.abs(latestMacd - latestSignal);
          const maxMacdVal = Math.max(...macdLine.filter(x => x !== null).map(Math.abs)) || 1;
          const isPassivated = (macdDiff / maxMacdVal) < 0.03;

          if (isPassivated) {
            macdInsightZh = `\n\n📊 【MACD 辅助确认】：MACD 双线粘合，指标处于钝化状态，说明市场正在进行无趋势的蓄势整理，静待方向突破。`;
            macdInsightEn = `\n\n📊 [MACD Confirmation]: MACD lines are flat and entangled, reflecting pure range-bound consolidation. Wait for a decisive price breakout to establish direction.`;
          } else {
            macdInsightZh = `\n\n📊 【MACD 辅助确认】：MACD 处于死叉空头维持状态（DIF < DEA），短期整理动能偏弱，震荡筑底中需防范价格向区间下轨回落。`;
            macdInsightEn = `\n\n📊 [MACD Confirmation]: MACD remains in a bearish dead-cross state (DIF < DEA), reflecting weak short-term momentum. Price may drift toward the lower boundary of the range.`;
          }
        }
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



