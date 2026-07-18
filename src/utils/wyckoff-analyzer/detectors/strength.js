export function detectStrength(ctx, i, dateStr, dayInfo) {
  const {
    close, open, low, curAtr,
    volRatio, lowerTailRatio, climaxPricePos,
    climaxVolThresh, breakoutVolThresh
  } = dayInfo;

  // Event G: SOS
  if (i > 25 && i - ctx.lastSOSIndex >= ctx.SOS_SOW_COOLDOWN) {
    const recentHigh5 = Math.max(...ctx.dfHighs.slice(Math.max(0, i - 5), i));
    const recentLow5 = Math.min(...ctx.dfLows.slice(Math.max(0, i - 5), i));
    const recentDropPct = recentHigh5 > 0 ? (recentHigh5 - recentLow5) / recentHigh5 : 0;
    const sosLookback = recentDropPct > 0.07 ? 10 : 20; // shrink to 10 if sharp drop in last 5 days
    const prevHighs = ctx.dfHighs.slice(Math.max(0, i - sosLookback), i);
    const localResistance = Math.max(...prevHighs);
    // Bearish context: MAs in clear bearish alignment AND price hasn't recovered above MA20
    // Exception: override if close is already back above MA20 (early recovery),
    // or if the volume is climactic (force of buying overrides MA alignment)
    const closeAboveMA20 = ctx.ma20[i] !== null && close > ctx.ma20[i];
    const isClimaticRally = volRatio > climaxVolThresh; // 2x+ volume = institutional buying
    // Exception for depressed-range reversal: if price is in the bottom 35% of yearly range
    // AND there is a recent SC or SOW anchor in the last 120 bars, allow SOS even in bearish MA context.
    const isDepressedReversal = climaxPricePos < 0.35 &&
      ctx.events.some(e => (e.event === 'SC' || e.event === 'SOW') && i - e.index <= 120);
    const isBearishContext = ctx.ma20[i] !== null && ctx.ma60[i] !== null &&
      ctx.ma20[i] < ctx.ma60[i] && close < ctx.ma20[i] &&
      !closeAboveMA20 && !isClimaticRally && !isDepressedReversal;

    if (close > localResistance && volRatio > breakoutVolThresh && close > open && !isBearishContext) {
      const sosConf = sosLookback === 10 ? 0.72 : (isDepressedReversal ? 0.68 : 0.80);
      ctx.events.push({
        index: i,
        event: 'SOS',
        label_zh: '强势信号 (SOS)',
        label_en: 'Sign of Strength (SOS)',
        date: dateStr,
        price: close,
        confidence: sosConf
      });
      ctx.lastSOSIndex = i;
    }
  }



  // Event K: Golden Flag Breakout (Flag / 黄金旗形突破)
  if (i > 30 && i - ctx.lastFlagIndex >= 8) {
    // We look for a tight consolidation window of size k (where k is between 3 and 8 bars)
    for (let k = 3; k <= 8; k++) {
      if (i - k - 10 < 0) continue;

      const consolidationHigh = Math.max(...ctx.dfHighs.slice(i - k, i));
      const consolidationLow = Math.min(...ctx.dfLows.slice(i - k, i));
      const consolidationRangePct = (consolidationHigh - consolidationLow) / consolidationLow;

      // Consolidation must be tight (either less than 7% or within 2.2 * ATR)
      const isConsolidationTight = consolidationRangePct < 0.07 || (consolidationHigh - consolidationLow) <= 2.2 * curAtr;

      // Consolidation average volume must be dry (less than 85% of 20d average volume)
      const windowVols = ctx.dfVolumes.slice(i - k, i);
      const consolidationAvgVol = windowVols.reduce((sum, v) => sum + v, 0) / k;
      const prevAvgVol = ctx.avgVol20[i - 1] || 1;
      const isConsolidationLowVol = (consolidationAvgVol / prevAvgVol) < 0.85;

      if (isConsolidationTight && isConsolidationLowVol) {
        // Check for flagpole surge before the consolidation
        const flagpoleBase = ctx.dfLows.slice(i - k - 10, i - k).reduce((min, l) => Math.min(min, l), Infinity);
        const flagpoleRise = (consolidationHigh - flagpoleBase) / flagpoleBase;

        // Flagpole must represent a rise of at least 8%, or we had a recent SOS/JAC event in the last 15 days
        const hasRecentBreakout = ctx.events.some(e => ['SOS', 'UTAD_Failure', 'JAC'].includes(e.event) && (i - e.index <= 15 && i - e.index >= k));
        const hasFlagpole = flagpoleRise > 0.08 || hasRecentBreakout;

        if (hasFlagpole) {
          // Current day i must break out above the consolidation high and occur in a structural Markup phase context
          const isMarkupContext = ctx.ma20[i] !== null && ctx.ma60[i] !== null && ctx.ma120[i] !== null &&
            ctx.ma20[i] > ctx.ma60[i] && ctx.ma60[i] > ctx.ma120[i] && close > ctx.ma20[i];
          const isBreakoutDay = close > consolidationHigh && volRatio > 1.2 && close > open && close > ctx.dfCloses[i - 1] && isMarkupContext;
          if (isBreakoutDay) {
            ctx.events.push({
              index: i,
              event: 'Flag',
              label_zh: '黄金旗形突破 (Flag)',
              label_en: 'Bull Flag Breakout (Flag)',
              date: dateStr,
              price: close,
              confidence: 0.82
            });
            ctx.lastFlagIndex = i;
            break; // stop scanning other windows for this index
          }
        }
      }
    }
  }
}
