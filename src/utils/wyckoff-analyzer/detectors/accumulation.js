import { EVENT_META } from '../core/eventMeta';
import { isBrokenSupportReversal } from '../core/brokenSupportReversal';

export function detectAccumulation(ctx, i, dateStr, dayInfo) {
  const {
    close, open, low, high, curAtr,
    volRatio, lowerTailRatio, climaxPricePos
  } = dayInfo;

  // Event Spring: Accumulation test below trSupport (or fallback support)
  // Requirement: same-day breakout-and-recovery (low < activeSupport && close > activeSupport && close > open)
  // When trSupport is null (expired or not yet set), fall back to the nearest pivot low
  // or 20-bar rolling minimum so long-range accumulation structures still get coverage.
  if (i > 30) {
    const pricePos = (close - ctx.yearLow) / ctx.yearRange;
    if (pricePos < 0.65) {
      // Determine the best available support reference
      let activeSupport = ctx.trSupport;
      if (activeSupport === null) {
        // Fallback 1: nearest pivot low in the last 60 bars
        let bestPivot = null;
        for (let p = 0; p < ctx.allPivots.pivotLows.length; p++) {
          const pl = ctx.allPivots.pivotLows[p];
          if (pl.index >= i - 60 && pl.index < i) {
            if (bestPivot === null || pl.price < bestPivot) bestPivot = pl.price;
          }
        }
        // Fallback 2: 20-bar rolling minimum
        activeSupport = bestPivot !== null
          ? bestPivot
          : Math.min(...ctx.dfLows.slice(Math.max(0, i - 20), i));
      }

      // Bug 2 fix: ctx.sensFactor = 1.5 - sensitivity, so 0.03*(1.5-sensFactor) ≡ 0.03*sensitivity.
      // Use ctx.sensitivity directly to avoid an implicit algebraic round-trip.
      const maxPenetration = 0.03 * ctx.sensitivity;

      const isTrueSpring = isBrokenSupportReversal(low, close, open, activeSupport);

      if (isTrueSpring && volRatio > 0.8) {
        const penetrationDepth = activeSupport > 0 ? (activeSupport - low) / activeSupport : 0;
        if (penetrationDepth < maxPenetration) {
          const isNotMarkdown = ctx.ma20[i] > ctx.ma60[i] || close > ctx.ma20[i];
          if (isNotMarkdown) {
            const alreadySpring = ctx.events.some(e => e.event === 'Spring' && (i - e.index <= 5));
            if (!alreadySpring) {
              ctx.events.push({
                index: i,
                event: 'Spring',
                ...EVENT_META.Spring,
                date: dateStr,
                price: low,
                confidence: Math.min(0.95, 0.75 + (1 - penetrationDepth / maxPenetration) * 0.15)
              });
              ctx.supportLevels.push({ price: low, strength: 4, index: i });
              ctx.lastSpringEventIndex = i; // track for Spring_Test detection
            }
          }
        }
      }
    }
  }

  // ── Post-Spring support tests ──────────────────────────────────────────────
  //
  // After a Spring/Shakeout there are two semantically distinct situations:
  //
  //   1. SOS has NOT yet occurred → we are still in Phase C, just re-testing
  //      support to confirm the Spring held.  This is a "Pre-LPS Test".
  //      It does NOT advance the sub-phase to D.
  //
  //   2. SOS HAS occurred → the market has already shown it can break above
  //      the trading range.  A subsequent low-volume pullback that holds above
  //      the Spring low is the true "Last Point of Support" (LPS) — the
  //      classic Phase D re-entry setup.
  //
  // Shared conditions for both variants:
  //   - Price held above the Spring low (higher low)
  //   - Volume dried up (no supply)
  //   - Buyer present (up-close or intraday recovery)
  //   - Still within the accumulation price range
  //   - Is a pullback within the recent up-swing
  if (i > 30 && i - ctx.lastLPSIndex >= ctx.LPS_COOLDOWN) {
    const recentSpring = ctx.events.slice().reverse().find(e =>
      (e.event === 'Spring' || e.event === 'Shakeout') && i - e.index <= 60 && i - e.index >= 3
    );

    if (recentSpring && ctx.trSupport !== null) {
      // Determine the TR start index so we only look at SOS events within this
      // trading range (not a stale SOS from a previous cycle).
      const trStartIndex = recentSpring.index;

      const springLow       = recentSpring.price;
      const higherLow       = low > springLow;
      const isLowVolume     = volRatio < 0.85;
      const isBuyerPresent  = close >= open || lowerTailRatio > 0.40;
      const isNotInTopRange = climaxPricePos < 0.65;
      const noRecentLPS     = !ctx.events.some(e =>
        (e.event === 'LPS' || e.event === 'Pre_LPS_Test') && i - e.index <= ctx.LPS_COOLDOWN
      );
      const isPullback      = close < Math.max(...ctx.dfHighs.slice(Math.max(0, i - 5), i));

      const baseConditions = higherLow && isLowVolume && isBuyerPresent &&
                             isNotInTopRange && noRecentLPS && isPullback;

      if (baseConditions) {
        // Has a Sign of Strength already occurred within this trading range?
        const hasSOSInThisTR = ctx.events.some(e =>
          e.event === 'SOS' && e.index >= trStartIndex && e.index < i
        );

        if (hasSOSInThisTR) {
          // ── True LPS (Phase D): SOS already confirmed; this is a re-entry setup ──
          ctx.events.push({
            index: i,
            event: 'LPS',
            ...EVENT_META.LPS,
            date: dateStr,
            price: low,
            confidence: Math.min(0.85, 0.68 + (isLowVolume ? 0.10 : 0) + (isBuyerPresent ? 0.07 : 0))
          });
          ctx.lastLPSIndex = i;
          ctx.supportLevels.push({ price: low, strength: 2.5, index: i });
        } else {
          // ── Pre-LPS Test (Phase C): Spring held but no SOS yet; still testing ──
          // Deliberately NOT firing LPS so subphase.js cannot advance to Phase D
          // without genuine SOS confirmation.
          ctx.events.push({
            index: i,
            event: 'Pre_LPS_Test',
            ...EVENT_META.Pre_LPS_Test,
            date: dateStr,
            price: low,
            confidence: Math.min(0.72, 0.55 + (isLowVolume ? 0.10 : 0) + (isBuyerPresent ? 0.07 : 0))
          });
          ctx.lastLPSIndex = i; // use same cooldown tracker to avoid spam
          ctx.supportLevels.push({ price: low, strength: 1.5, index: i });
        }
      }
    }
  }
}
