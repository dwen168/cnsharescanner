// Helper EMA calculator for built-in MACD fallback
function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  const ema = new Array(prices.length).fill(null);
  if (prices.length === 0) return ema;

  let firstIdx = -1;
  for (let i = 0; i < prices.length; i++) {
    if (prices[i] !== null && prices[i] !== undefined && !isNaN(prices[i])) {
      firstIdx = i;
      break;
    }
  }

  if (firstIdx === -1) return ema;

  ema[firstIdx] = prices[firstIdx];
  for (let i = firstIdx + 1; i < prices.length; i++) {
    if (prices[i] === null || prices[i] === undefined || isNaN(prices[i])) {
      ema[i] = ema[i - 1];
    } else {
      ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
    }
  }
  return ema;
}

// Built-in MACD fallback check
function checkMacdDeadCrossFallback(closes) {
  if (!closes || closes.length < 26) return false;
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);

  const macdLine = new Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] !== null && ema26[i] !== null) {
      macdLine[i] = ema12[i] - ema26[i];
    }
  }

  const firstValidIdx = macdLine.findIndex(x => x !== null);
  if (firstValidIdx === -1) return false;

  const validMacd = macdLine.slice(firstValidIdx);
  const validSignal = calculateEMA(validMacd, 9);

  const signalLine = new Array(closes.length).fill(null);
  for (let i = 0; i < validSignal.length; i++) {
    signalLine[firstValidIdx + i] = validSignal[i];
  }

  const N = closes.length;
  const latestMacd = macdLine[N - 1];
  const latestSignal = signalLine[N - 1];

  if (latestMacd !== null && latestSignal !== null) {
    return latestMacd < latestSignal;
  }
  return false;
}

// Helper to calculate the latest ATR
function getLatestATR(highs, lows, closes, period = 14) {
  if (!highs || highs.length < period || !closes || closes.length < period) return null;
  const N = highs.length;
  const tr = new Array(N).fill(0);
  tr[0] = highs[0] - lows[0];
  for (let i = 1; i < N; i++) {
    const tr1 = highs[i] - lows[i];
    const tr2 = Math.abs(highs[i] - closes[i - 1]);
    const tr3 = Math.abs(lows[i] - closes[i - 1]);
    tr[i] = Math.max(tr1, tr2, tr3);
  }

  let sum = 0;
  for (let i = N - period; i < N; i++) {
    sum += tr[i];
  }
  return sum / period;
}

export function analyzeRiskControl(currentPrice, historyHighs, historyLows, historyClosesOrCostBasis, costBasisOrParams, paramsOrUndefined) {
  let historyCloses = [];
  let costBasis = 0;
  let params = {};

  // Handle signature overload for backward compatibility
  if (Array.isArray(historyClosesOrCostBasis)) {
    historyCloses = historyClosesOrCostBasis;
    costBasis = typeof costBasisOrParams === 'number' ? costBasisOrParams : parseFloat(costBasisOrParams) || 0;
    params = paramsOrUndefined || {};
  } else {
    // Backward compatibility: 4th arg is costBasis, 5th arg is params
    historyCloses = [];
    costBasis = typeof historyClosesOrCostBasis === 'number' ? historyClosesOrCostBasis : parseFloat(historyClosesOrCostBasis) || 0;
    params = costBasisOrParams || {};
  }

  const maxDrawdownPct = params.maxDrawdownPct || 15; // trailing stop threshold
  const breakevenTriggerPct = params.breakevenTriggerPct || 30; // breakeven trigger line
  
  // Calculate MACD dead cross dynamically if not provided by the caller
  let isMacdDeadCross = params.isMacdDeadCross;
  if (isMacdDeadCross === undefined || isMacdDeadCross === null) {
    isMacdDeadCross = checkMacdDeadCrossFallback(historyCloses);
  }

  // 1. Estimate Entry Index (Step 1)
  const len = historyHighs.length;
  let entryIdx = 0;
  const touchIndices = [];
  for (let i = 0; i < len; i++) {
    if (costBasis >= historyLows[i] && costBasis <= historyHighs[i]) {
      touchIndices.push(i);
    }
  }

  if (touchIndices.length > 0) {
    // Last touch/cross index of costBasis is assumed as the entry point
    entryIdx = touchIndices[touchIndices.length - 1];
  } else {
    // If cost basis was never touched, find the index closest to costBasis
    let minDiff = Infinity;
    let closestIdx = 0;
    
    // For high position trap, find the closest price using closes if available, else average high/low
    const maxHigh = Math.max(...historyHighs);
    const useCloseForDiff = historyCloses && historyCloses.length === len && costBasis > maxHigh;

    for (let i = 0; i < len; i++) {
      let cmpPrice;
      if (useCloseForDiff) {
        cmpPrice = historyCloses[i];
      } else {
        cmpPrice = (historyHighs[i] + historyLows[i]) / 2;
      }
      const diff = Math.abs(cmpPrice - costBasis);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    // If costBasis is lower than all lows, assume they bought before start of loaded history (entryIdx = 0)
    const minLow = Math.min(...historyLows);
    entryIdx = costBasis < minLow ? 0 : closestIdx;
  }

  // 2. Slicing from entryIdx to find peakPrice since entry
  const postEntryHighs = historyHighs.slice(entryIdx);
  const peakPrice = postEntryHighs.length > 0 ? Math.max(...postEntryHighs) : currentPrice;

  // 3. Calculate current profit/loss pct and drawdown from peak
  const currentProfitPct = ((currentPrice - costBasis) / costBasis) * 100;
  const drawdownFromPeak = ((peakPrice - currentPrice) / peakPrice) * 100;

  // 3. Define stop levels using adaptive volatility or fixed percentages
  const useAdaptiveVolatility = params.useAdaptiveVolatility || false;
  let latestAtr = 0;
  if (useAdaptiveVolatility) {
    const calculatedAtr = getLatestATR(historyHighs, historyLows, historyCloses, 14);
    latestAtr = calculatedAtr !== null ? calculatedAtr : (costBasis * 0.02);
  }

  let stopLossPrice, breakevenPrice, trailingStopPrice, breakevenTriggerPrice;
  let activeMaxDrawdownPct = maxDrawdownPct;
  let activeBreakevenTriggerPct = breakevenTriggerPct;

  if (useAdaptiveVolatility) {
    stopLossPrice = costBasis - 2.0 * latestAtr;
    breakevenPrice = costBasis + 1.0 * latestAtr;
    trailingStopPrice = peakPrice - 3.0 * latestAtr;
    breakevenTriggerPrice = costBasis + 4.0 * latestAtr;
    
    activeMaxDrawdownPct = (3.0 * latestAtr / peakPrice) * 100;
    activeBreakevenTriggerPct = (4.0 * latestAtr / costBasis) * 100;
  } else {
    stopLossPrice = costBasis * 0.90; // Default 10% hard stop loss
    breakevenPrice = costBasis * 1.05; // 5% profit lock line
    trailingStopPrice = peakPrice * (1 - maxDrawdownPct / 100); // Trailing stop target price
    breakevenTriggerPrice = costBasis * (1 + breakevenTriggerPct / 100); // Breakeven trigger target price
  }

  // Check if breakeven protection is activated
  const isBreakevenActive = useAdaptiveVolatility
    ? peakPrice >= breakevenTriggerPrice
    : (((peakPrice - costBasis) / costBasis) * 100) >= breakevenTriggerPct;

  let action = 'HOLD'; // HOLD | REDUCE_50 | EXIT_ALL
  let reasons_zh = [];
  let reasons_en = [];

  // Determine signals in order of severity
  if (currentPrice < stopLossPrice && currentPrice < costBasis) {
    action = 'EXIT_ALL';
    reasons_zh.push(`股价已跌破 ${useAdaptiveVolatility ? '自适应 ATR' : '10%'} 硬止损价位 ($${stopLossPrice.toFixed(2)})，触发初始止损离场。`);
    reasons_en.push(`Price fell below ${useAdaptiveVolatility ? 'adaptive ATR' : '10%'} initial stop loss ($${stopLossPrice.toFixed(2)}), triggering stop-loss exit.`);
  } else if (isBreakevenActive && currentPrice < breakevenPrice) {
    action = 'EXIT_ALL';
    reasons_zh.push(`股价曾触及 ${activeBreakevenTriggerPct.toFixed(1)}% 涨幅门槛激活自适应保本，现跌破保本位 $${breakevenPrice.toFixed(2)}，触发微利出局。`);
    reasons_en.push(`Profit once hit ${activeBreakevenTriggerPct.toFixed(1)}% (active breakeven lock), now fell below $${breakevenPrice.toFixed(2)}, triggering breakeven lock exit.`);
  } else if (currentPrice < trailingStopPrice) {
    action = 'EXIT_ALL';
    const currentDrawdown = ((peakPrice - currentPrice) / peakPrice) * 100;
    reasons_zh.push(`股价自最高点 $${peakPrice.toFixed(2)} 回落 ${currentDrawdown.toFixed(1)}%（超出设定的自适应波动率 ${activeMaxDrawdownPct.toFixed(1)}% 阀值），触发移动止盈。`);
    reasons_en.push(`Price fell ${currentDrawdown.toFixed(1)}% from peak $${peakPrice.toFixed(2)} (exceeded adaptive threshold of ${activeMaxDrawdownPct.toFixed(1)}%), triggering trailing stop exit.`);
  } else if (isMacdDeadCross && currentProfitPct > 15) {
    action = 'REDUCE_50';
    reasons_zh.push(`当前浮盈为 ${currentProfitPct.toFixed(1)}%，但日线 MACD 出现死叉，动能转弱，触发减仓 50% 锁定部分利润。`);
    reasons_en.push(`Current profit is ${currentProfitPct.toFixed(1)}% but daily MACD dead-cross occurred, triggering 50% profit-take.`);
  }

  // 3.5. Trend & Structure Rules (Markdown/Distribution check)
  const phase = params.phase || 'neutral';
  if (phase === 'markdown' && action !== 'EXIT_ALL') {
    action = 'EXIT_ALL';
    reasons_zh.push(`股价已确认进入 Wyckoff 下跌阶段（Markdown），趋势呈空头排列，建议清仓离场避险，避免${currentProfitPct > 0 ? '利润大幅回吐' : '亏损进一步扩大'}。`);
    reasons_en.push(`Price confirmed in Wyckoff Markdown (downtrend) phase with bearish MAs. Recommends exit all to avoid ${currentProfitPct > 0 ? 'profit clawback' : 'further losses'}.`);
  } else if (phase === 'distribution' && action === 'HOLD') {
    action = 'REDUCE_50';
    reasons_zh.push(`股价处于 Wyckoff 高位派发区（Distribution），主力资金出货迹象明确，面临下行风险，建议减仓 50% 锁定部分利润。`);
    reasons_en.push(`Price is inside Wyckoff Distribution zone with institutional selling. Recommends 50% profit-taking to guard against downside risk.`);
  }

  // 4. Trapped Diagnostic & Recovery Assistant (Step 1)
  const isTrapped = currentProfitPct <= -15;
  let trappedDiagnostic = null;

  if (isTrapped) {
    const supportPrice = params.supportPrice || 0;
    const resistancePrice = params.resistancePrice || 0;

    if (phase === 'markdown') {
      trappedDiagnostic = {
        action: 'SWITCH_OR_CUT',
        advice_zh: '🚨 当前处于主跌浪深套。均线呈空头排列，下行空间仍未出尽。工业级策略建议痛斩割肉，或将残余仓位换股至处于主升浪（Markup）的强势个股中，以高效率挽回损失。',
        advice_en: '🚨 Deeply trapped in a markdown trend. Heavy downward momentum remains. Strategy: cut loss or switch remnants to markup leaders.',
        range_zh: '无（建议尽快逢高离场，千万不要补仓）',
        range_en: 'None (avoid averaging down, exit on strength)'
      };
    } else if (phase === 'accumulation') {
      trappedDiagnostic = {
        action: 'HOLD_AND_SWING',
        advice_zh: `⚖️ 当前处于底部吸筹整理区，价格已临近历史强支撑线，不宜在底部盲目割肉。建议底仓卧倒，或者利用我们检测出的水平支撑与阻力区间进行“滚动做T”以拉低平均成本。`,
        advice_en: `⚖️ Consolidating in accumulation base. Avoid selling at the bottom. Strategy: hold base, or trade swings within range to lower average cost.`,
        range_zh: `建议做T区间：支撑位 $${supportPrice.toFixed(2)} 附近低吸，阻力位 $${resistancePrice.toFixed(2)} 附近高抛`,
        range_en: `Trading Range: Buy near support $${supportPrice.toFixed(2)}, Sell near resistance $${resistancePrice.toFixed(2)}`
      };
    } else if (phase === 'distribution') {
      trappedDiagnostic = {
        action: 'EXIT_ON_REBOUND',
        advice_zh: '⚠️ 当前处于高位派发危险区，主力出货迹象明确。虽已套牢但后续下跌空间极大，任何技术性反弹或回抽都是最后的安全离场机会，切勿补仓。',
        advice_en: '⚠️ Inside high-level distribution zone. Heavy selling by institutions. Strategy: reduce position on any technical rebound, do not average down.',
        range_zh: `建议离场区间：阻力位 $${resistancePrice.toFixed(2)} 附近`,
        range_en: `Target exit zone: near resistance $${resistancePrice.toFixed(2)}`
      };
    } else {
      // markup or other
      trappedDiagnostic = {
        action: 'HOLD_AND_ADD',
        advice_zh: `🚀 当前处于上涨趋势的回调或中继整理中，中长线趋势尚好。建议暂时耐心持有，等待股价在强支撑位站稳或日线 MACD 重新形成金叉时，在支撑位附近右侧分批补仓摊成本。`,
        advice_en: `🚀 Consolidated pull-back in markup trend. Long-term trend remains healthy. Strategy: hold and wait for support validation or MACD golden cross to add.`,
        range_zh: `建议补仓区间：强支撑位 $${supportPrice.toFixed(2)} 附近`,
        range_en: `Suggested buy zone: near support $${supportPrice.toFixed(2)}`
      };
    }
  }

  // 5. Override Action when Trapped in Accumulation or Markup/Other to avoid contradiction
  if (isTrapped && trappedDiagnostic) {
    if (trappedDiagnostic.action === 'HOLD_AND_SWING') {
      action = 'HOLD';
      reasons_zh = [`【套牢防守策略】虽然已跌破初始止损位，但因股价目前处于底部吸筹整理区，且临近强支撑线，在此位置割肉性价比极低。因此风控策略调整为“持股防守，滚动做T”。`];
      reasons_en = [`[Trapped Defense] Although initial stop-loss was broken, price is consolidating inside accumulation base near support. Cutting losses here is inefficient. Strategy adjusted to hold and swing.`];
    } else if (trappedDiagnostic.action === 'HOLD_AND_ADD') {
      action = 'HOLD';
      reasons_zh = [`【套牢防守策略】虽已深套，但个股处于上涨大趋势的中继回调中。建议持股防守，静待强支撑位企稳或日线MACD重新金叉后再逢低加仓。`];
      reasons_en = [`[Trapped Defense] Deeply trapped but stock is in a pull-back within markup trend. Strategy adjusted to hold and wait for support validation to add.`];
    }
  }

  return {
    currentProfitPct,
    peakPrice,
    drawdownFromPeak,
    isBreakevenActive,
    stopLossPrice,
    breakevenPrice,
    trailingStopPrice,
    breakevenTriggerPrice,
    isTrapped,
    trappedDiagnostic,
    action,
    reasons_zh,
    reasons_en,
    useAdaptiveVolatility,
    activeMaxDrawdownPct,
    activeBreakevenTriggerPct
  };
}
