// Helper to calculate rolling average
export function getRollingMean(arr, period) {
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
export function getRollingStd(arr, period, means) {
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
export function getATR(highs, lows, closes, period = 14) {
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
export function getRSI(prices, period = 14) {
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
export function findPivotLevels(highs, lows, n = 5) {
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
export function clusterLevels(levels, atr, currentIdx) {
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
export function getFallbackPivotResistance(currentIdx, pivotHighs, defaultVal) {
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

// EMA Helper for MACD calculation
export function getEMA(arr, period) {
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
export function getMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
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
export function detectMACDDivergences(closes, macdLine) {
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
