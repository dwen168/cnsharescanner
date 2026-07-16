/**
 * attributionAnalyzer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Signal Return Decomposition Engine
 *
 * Decomposes each trade's return into:
 *   R_i = β_mkt + δ_sector + α_stock + residual
 *
 * Where:
 *   β_mkt       = bench_ret_Nd                   (Market Beta — index contribution)
 *   sector_ret  = sector_logs ret_Nd for (date, sector)
 *   δ_sector    = sector_ret - bench_ret_Nd       (Sector Rotation — sector vs market)
 *   α_stock     = ret_Nd - sector_ret             (Stock Alpha — stock vs sector)
 *   residual    = ret_Nd - (β_mkt+δ_sector+α_stock) → ≈ 0 when sector data available
 *
 * Timing Premium (standalone metric, not additive):
 *   δ_timing[zone] = avg_alpha[zone] - global_avg_alpha
 *
 * Information Ratio:
 *   IR = avg(alpha_executable) / std(alpha_executable)
 *   t_stat = IR × sqrt(n)
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function round4(v) {
  return Math.round((v + Number.EPSILON) * 10000) / 10000;
}

function round2(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * computeAttribution
 *
 * @param {Object} params
 * @param {Array}  params.logs        - Filtered stock signal logs from backtest
 * @param {Array}  params.sectorLogs  - Sector signal logs from backtest
 * @param {Object} params.sectorMap   - { symbol → sectorName } from data.json
 * @param {string} params.period      - '1d' | '3d' | '5d' | '10d'
 * @param {string} params.returnType  - 'executable' | 'theoretical'
 *
 * @returns {Object|null} AttributionResult or null if insufficient data
 */
export function computeAttribution({ logs, sectorLogs, sectorMap, period, returnType, isBear }) {
  const isExec = returnType === 'executable';
  const retField = isExec ? `ret_${period}_executable` : `ret_${period}`;
  
  const firstLog = logs && logs[0] ? logs[0] : {};
  const hasExecBench = isExec && (`bench_ret_${period}_executable` in firstLog);
  const benchField = hasExecBench ? `bench_ret_${period}_executable` : `bench_ret_${period}`;
  const alphaField = isExec ? (`alpha_${period}_executable` in firstLog ? `alpha_${period}_executable` : `alpha_${period}`) : `alpha_${period}`;
  
  const hasMarketField = (`market_ret_${period}` in firstLog) || (`market_ret_${period}_executable` in firstLog);
  const marketField = hasMarketField 
    ? (isExec && (`market_ret_${period}_executable` in firstLog) ? `market_ret_${period}_executable` : `market_ret_${period}`)
    : benchField;
  
  const firstSectorLog = sectorLogs && sectorLogs[0] ? sectorLogs[0] : {};
  const hasExecSectorBench = isExec && (`bench_ret_${period}_executable` in firstSectorLog);
  const sectorRetField = isExec ? `ret_${period}_executable` : `ret_${period}`;
  const sectorBenchField = hasExecSectorBench ? `bench_ret_${period}_executable` : `bench_ret_${period}`;

  // Filter valid logs where the chosen return field is populated
  const validLogs = (logs || []).filter(
    l => l[retField] !== null && l[retField] !== undefined
  );

  if (validLogs.length === 0) return null;

  // ── Build sectorRetMap ────────────────────────────────────────────────────
  // Key: "YYYY-MM-DD|sector name" → sector return for that period
  const sectorRetMap = {};
  (sectorLogs || []).forEach(sl => {
    let sRet = sl[sectorRetField];
    let sBench = sl[sectorBenchField];
    if (sl.sector && sl.date && sRet !== null && sRet !== undefined) {
      if (isBear) {
        sRet = -sRet;
        sBench = sBench !== null && sBench !== undefined ? -sBench : -sRet;
      }
      const key = `${sl.date}|${sl.sector}`;
      sectorRetMap[key] = { ret: sRet, bench: sBench ?? sRet };
    }
  });

  // ── Per-trade attribution ─────────────────────────────────────────────────
  const perTrade = validLogs.map(log => {
    let ret       = log[retField];
    let benchRet  = log[benchField] ?? 0;
    let marketRet = log[marketField] ?? 0;
    let alphaVal  = (log[alphaField] !== undefined && log[alphaField] !== null)
      ? log[alphaField]
      : ret - benchRet;

    if (isBear) {
      ret = -ret;
      benchRet = -benchRet;
      marketRet = -marketRet;
      alphaVal = -alphaVal;
    }

    const sectorName = sectorMap ? (sectorMap[log.symbol] || null) : null;
    const sectorKey  = sectorName ? `${log.date}|${sectorName}` : null;
    const sectorEntry = sectorKey ? sectorRetMap[sectorKey] : null;

    // If sector data unavailable: fallback sector_ret = bench_ret (δ_sector = 0)
    const sectorRet = sectorEntry ? sectorEntry.ret : benchRet;
    const hasSectorData = !!sectorEntry;

    // true Brinson attribution
    const marketBeta = marketRet;
    const sectorRotation = benchRet - marketRet;
    const stockAlpha = ret - benchRet;
    // Residual should be ~0; exposed for debugging
    const residual          = ret - (marketBeta + sectorRotation + stockAlpha);

    return {
      // Original log fields
      date:     log.date,
      symbol:   log.symbol,
      zone:     log.zone,
      signal:   log.signal,
      heatScore: log.heat_score,
      ret,
      benchRet,
      alphaVal,
      // Attribution components
      sectorName: sectorName || 'Unknown',
      hasSectorData,
      marketBeta:     round4(marketBeta),
      sectorRotation: round4(sectorRotation),
      stockAlpha:     round4(stockAlpha),
      residual:       round4(residual),
    };
  });

  const n = perTrade.length;

  // ── Summary statistics ────────────────────────────────────────────────────
  const avgMarketBeta     = round4(mean(perTrade.map(t => t.marketBeta)));
  const avgSectorRotation = round4(mean(perTrade.map(t => t.sectorRotation)));
  const avgStockAlpha     = round4(mean(perTrade.map(t => t.stockAlpha)));
  const avgResidual       = round4(mean(perTrade.map(t => t.residual)));
  const avgTotal          = round4(mean(perTrade.map(t => t.ret)));

  const alphaValues = perTrade.map(t => t.alphaVal);
  const avgAlpha = mean(alphaValues);
  const stdAlpha = stdDev(alphaValues);
  const ir     = stdAlpha > 0 ? round4(avgAlpha / stdAlpha) : 0;
  const tStat  = round4(ir * Math.sqrt(n));

  // Skill verdict
  let skillVerdict;
  if (n < 30) {
    skillVerdict = 'insufficient'; // Not enough data
  } else if (ir >= 0.5) {
    skillVerdict = 'skill';         // 🟢 Skill-driven
  } else if (ir >= 0.3) {
    skillVerdict = 'mixed';         // 🟡 Needs more data
  } else if (ir > 0) {
    skillVerdict = 'luck';          // 🔴 Weak signal / luck
  } else {
    skillVerdict = 'negative';      // 🔴 Negative alpha
  }

  // Contribution % (relative to total net return)
  const pctOf = (v) => {
    if (Math.abs(avgTotal) < 0.001) return 0;
    return round2((v / avgTotal) * 100);
  };

  // ── Timing analysis (zone premium) ───────────────────────────────────────
  const ZONES = [...new Set(perTrade.map(t => t.zone).filter(Boolean))];
  const globalAvgAlpha = avgAlpha;
  const zoneStats = {};
  ZONES.forEach(zone => {
    const zoneTrades = perTrade.filter(t => t.zone === zone);
    if (zoneTrades.length > 0) {
      const zoneAvgAlpha = mean(zoneTrades.map(t => t.alphaVal));
      zoneStats[zone] = {
        n: zoneTrades.length,
        avgReturn:      round4(mean(zoneTrades.map(t => t.ret))),
        avgAlpha:       round4(zoneAvgAlpha),
        timingPremium:  round4(zoneAvgAlpha - globalAvgAlpha),
      };
    }
  });

  // ── Timeseries (by entry date, cumulated) ─────────────────────────────────
  // Groups trades by entry date → avg components per day → cumulative sum
  const dateGroups = {};
  perTrade.forEach(t => {
    if (!dateGroups[t.date]) {
      dateGroups[t.date] = { marketBeta: [], sectorRotation: [], stockAlpha: [], total: [] };
    }
    dateGroups[t.date].marketBeta.push(t.marketBeta);
    dateGroups[t.date].sectorRotation.push(t.sectorRotation);
    dateGroups[t.date].stockAlpha.push(t.stockAlpha);
    dateGroups[t.date].total.push(t.ret);
  });

  const sortedDates = Object.keys(dateGroups).sort();
  const is1D = period === '1d';
  let cumBeta = 0, cumSector = 0, cumAlpha = 0, cumTotal = 0;
  
  // Windows for rolling average on multi-period curves
  const windowBeta = [];
  const windowSector = [];
  const windowAlpha = [];
  const windowTotal = [];
  const windowSize = 10;

  const timeseries = sortedDates.map(date => {
    const g = dateGroups[date];
    const dayBeta   = mean(g.marketBeta);
    const daySector = mean(g.sectorRotation);
    const dayAlpha  = mean(g.stockAlpha);
    const dayTotal  = mean(g.total);
    
    if (is1D) {
      cumBeta   += dayBeta;
      cumSector += daySector;
      cumAlpha  += dayAlpha;
      cumTotal  += dayTotal;
    } else {
      windowBeta.push(dayBeta);
      windowSector.push(daySector);
      windowAlpha.push(dayAlpha);
      windowTotal.push(dayTotal);
      if (windowBeta.length > windowSize) {
        windowBeta.shift();
        windowSector.shift();
        windowAlpha.shift();
        windowTotal.shift();
      }
      cumBeta = mean(windowBeta);
      cumSector = mean(windowSector);
      cumAlpha = mean(windowAlpha);
      cumTotal = mean(windowTotal);
    }

    return {
      date,
      n:                  g.total.length,
      dayMarketBeta:      round4(dayBeta),
      daySectorRotation:  round4(daySector),
      dayStockAlpha:      round4(dayAlpha),
      dayTotal:           round4(dayTotal),
      cumMarketBeta:      round4(cumBeta),
      cumSectorRotation:  round4(cumSector),
      cumStockAlpha:      round4(cumAlpha),
      cumTotal:           round4(cumTotal),
    };
  });

  // ── Drill-down groupings ──────────────────────────────────────────────────
  const buildGroupRow = (key, label, trades) => ({
    key,
    label,
    n: trades.length,
    marketBeta:     round4(mean(trades.map(t => t.marketBeta))),
    sectorRotation: round4(mean(trades.map(t => t.sectorRotation))),
    stockAlpha:     round4(mean(trades.map(t => t.stockAlpha))),
    total:          round4(mean(trades.map(t => t.ret))),
  });

  // By date (most recent first)
  const byDate = sortedDates
    .map(date => buildGroupRow(date, date, perTrade.filter(t => t.date === date)))
    .reverse();

  // By sector
  const secGroups = {};
  perTrade.forEach(t => { (secGroups[t.sectorName] = secGroups[t.sectorName] || []).push(t); });
  const bySector = Object.entries(secGroups)
    .map(([sec, trades]) => buildGroupRow(sec, sec, trades))
    .sort((a, b) => b.n - a.n);

  // By stock
  const stockGroups = {};
  perTrade.forEach(t => { (stockGroups[t.symbol] = stockGroups[t.symbol] || []).push(t); });
  const byStock = Object.entries(stockGroups)
    .map(([sym, trades]) => buildGroupRow(sym, sym, trades))
    .sort((a, b) => b.n - a.n);

  // ── Final result ──────────────────────────────────────────────────────────
  return {
    period,
    returnType,
    n,
    summary: {
      n,
      avgTotal,
      marketBeta:      avgMarketBeta,
      sectorRotation:  avgSectorRotation,
      stockAlpha:      avgStockAlpha,
      residual:        avgResidual,
      // Contribution percentages
      marketBetaPct:      pctOf(avgMarketBeta),
      sectorRotationPct:  pctOf(avgSectorRotation),
      stockAlphaPct:      pctOf(avgStockAlpha),
      // IR & skill
      ir,
      tStat,
      skillVerdict,
      avgAlphaExec:     round4(avgAlpha),
      stdAlphaExec:     round4(stdAlpha),
    },
    zoneStats,
    timeseries,
    byDate,
    bySector,
    byStock,
    perTrade,
  };
}
