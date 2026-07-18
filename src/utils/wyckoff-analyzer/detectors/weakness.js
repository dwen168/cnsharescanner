export function detectWeakness(ctx, i, dateStr, dayInfo) {
  const {
    close, open, low, high, curAtr,
    volRatio, upperTailRatio, climaxPricePos,
    standardVolThresh, breakoutVolThresh
  } = dayInfo;

  // Event H: SOW (Sign of Weakness)
  if (i > 25 && i - ctx.lastSOWIndex >= ctx.SOS_SOW_COOLDOWN) {
    // Phase-appropriateness: SOW should NOT fire when MAs show clear bullish alignment
    const isBullishContext = ctx.ma20[i] !== null && ctx.ma60[i] !== null &&
      ctx.ma20[i] > ctx.ma60[i] && close > ctx.ma20[i];

    // --- Trigger A: Impulsive structural breakdown ---
    let structuralSupport = null;
    if (ctx.trSupport !== null) {
      structuralSupport = ctx.trSupport;
    } else {
      // Find the lowest pivot low in the last 40 bars as a structural reference
      let pivotMin = Infinity;
      for (let p = 0; p < ctx.allPivots.pivotLows.length; p++) {
        const pl = ctx.allPivots.pivotLows[p];
        if (pl.index >= i - 40 && pl.index < i && pl.price < pivotMin) {
          pivotMin = pl.price;
        }
      }
      structuralSupport = pivotMin !== Infinity ? pivotMin : Math.min(...ctx.dfLows.slice(Math.max(0, i - 30), i));
    }

    const isImpulsiveBreakdown = close < structuralSupport &&
      volRatio > breakoutVolThresh &&
      close < open &&
      !isBullishContext;

    // --- Trigger B: Persistent / grinding weakness ---
    const isBearishMAAlignment = ctx.ma20[i] !== null && ctx.ma60[i] !== null && ctx.ma20[i] < ctx.ma60[i];
    const isDepressedPricePos = climaxPricePos < 0.45; // bottom 45% of yearly range
    const hasRecentAccumEvent = ctx.events.some(e =>
      (e.event === 'SC' || e.event === 'Spring' || e.event === 'Shakeout') && i - e.index <= 60
    );

    let closesBelowMA60 = 0;
    for (let k = i - 1; k >= Math.max(0, i - 7); k--) {
      if (ctx.ma60[k] !== null && ctx.dfCloses[k] < ctx.ma60[k]) closesBelowMA60++;
    }
    const isInSustainedDowntrend = closesBelowMA60 >= 5;

    const isPersistentWeakness = isBearishMAAlignment &&
      close < (ctx.ma60[i] || close) &&
      close < open &&
      volRatio > standardVolThresh * 0.85 &&
      !isBullishContext &&
      !isDepressedPricePos &&
      !hasRecentAccumEvent &&
      isInSustainedDowntrend;

    // --- Trigger C: TR Range Quiet Breakdown ---
    let wasAboveSupportRecently = false;
    if (structuralSupport !== null) {
      let aboveCount = 0;
      for (let k = 1; k <= 5; k++) {
        const ki = i - k;
        if (ki >= 0 && ctx.dfCloses[ki] > structuralSupport) aboveCount++;
      }
      wasAboveSupportRecently = aboveCount >= 3;
    }
    const isTRBreakdown = structuralSupport !== null &&
      close < structuralSupport &&
      close < open &&
      wasAboveSupportRecently &&
      !isInSustainedDowntrend &&
      !isDepressedPricePos &&
      !hasRecentAccumEvent &&
      !isBullishContext;

    if (isImpulsiveBreakdown || isPersistentWeakness || isTRBreakdown) {
      const sowConf = isImpulsiveBreakdown ? 0.85 : isTRBreakdown ? 0.78 : 0.70;
      ctx.events.push({
        index: i,
        event: 'SOW',
        label_zh: '弱势信号 (SOW)',
        label_en: 'Sign of Weakness (SOW)',
        date: dateStr,
        price: close,
        confidence: sowConf
      });
      ctx.lastSOWIndex = i;
      ctx.lastSOWForLPSY = { index: i, price: close };
    }
  }

  // Event H2: Shakeout
  if (i > 30) {
    const noRecentShakeout = !ctx.events.some(e => e.event === 'Shakeout' && i - e.index <= 10);
    const noRecentConfirmedSOW = !ctx.events.some(e => e.event === 'SOW' && i - e.index <= 3);
    if (noRecentShakeout && noRecentConfirmedSOW) {
      const priorHighs = ctx.dfHighs.slice(Math.max(0, i - 15), i);
      const priorLows = ctx.dfLows.slice(Math.max(0, i - 15), i);
      const priorRange = Math.max(...priorHighs) - Math.min(...priorLows);
      const isConsolidating = priorRange < 3.0 * curAtr;

      const shakeoutRef = ctx.trSupport !== null
        ? ctx.trSupport
        : Math.min(...ctx.dfLows.slice(Math.max(0, i - 20), i));

      const isTrueShakeout = low < shakeoutRef && close > shakeoutRef && close > open;
      const isStrongRecovery = volRatio > standardVolThresh;
      const recoveryPct = low > 0 ? (close - low) / low : 0;
      const isMeaningfulRecovery = recoveryPct > 0.015;
      if (isConsolidating && isTrueShakeout && isStrongRecovery && isMeaningfulRecovery) {
        ctx.events.push({
          index: i,
          event: 'Shakeout',
          label_zh: '洗盘反转 (Shakeout)',
          label_en: 'Shakeout Recovery (False Breakdown)',
          date: dateStr,
          price: close,
          confidence: Math.min(0.90, 0.72 + recoveryPct * 5)
        });
        ctx.supportLevels.push({ price: low, strength: 3, index: i });
        if (!ctx.trSupport || low < ctx.trSupport) ctx.trSupport = low;
        ctx.lastSpringEventIndex = i; // Shakeout acts like a Spring — enable Spring_Test
      }
    }
  }

  // Event LPSY: Last Point of Supply
  if (i > 30 && i - ctx.lastLPSYIndex >= ctx.LPSY_COOLDOWN && ctx.lastSOWForLPSY !== null) {
    const barsSinceSOW = i - ctx.lastSOWForLPSY.index;
    if (barsSinceSOW >= 3 && barsSinceSOW <= 60) {
      const lpsyRef = ctx.trSupport !== null
        ? ctx.trSupport
        : (ctx.trResistance !== null
          ? ctx.trResistance
          : ctx.lastSOWForLPSY.price);
      
      const rallyOccurred = ctx.dfCloses.slice(Math.max(0, i - 8), i).some(c => c > ctx.lastSOWForLPSY.price);
      const isNearBrokenSupport = close >= lpsyRef - 2.0 * curAtr && close <= lpsyRef + 0.5 * curAtr;
      const isRejected = upperTailRatio > 0.30 || close < open;
      const isLowVolOnRally = volRatio < 0.90;
      const doesNotBreakAbove = close < lpsyRef + 0.5 * curAtr;
      const isClearlyBullish = ctx.ma20[i] !== null && ctx.ma60[i] !== null &&
        ctx.ma20[i] > ctx.ma60[i] && close > ctx.ma20[i];

      if (rallyOccurred && isNearBrokenSupport && isRejected && isLowVolOnRally && doesNotBreakAbove && !isClearlyBullish) {
        ctx.events.push({
          index: i,
          event: 'LPSY',
          label_zh: '供应最后点 (LPSY)',
          label_en: 'Last Point of Supply (LPSY)',
          date: dateStr,
          price: high,
          confidence: Math.min(0.85, 0.63 + (isRejected ? 0.08 : 0) + (isLowVolOnRally ? 0.09 : 0) + (climaxPricePos < 0.40 ? 0.05 : 0))
        });
        ctx.lastLPSYIndex = i;
        ctx.resistanceLevels.push({ price: high, strength: 2.5, index: i });
      }
    }
  }
}
