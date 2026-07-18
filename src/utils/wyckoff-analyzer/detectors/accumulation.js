export function detectAccumulation(ctx, i, dateStr, dayInfo) {
  const {
    close, open, low, high, curAtr,
    volRatio, lowerTailRatio, climaxPricePos
  } = dayInfo;

  // Event Spring: Accumulation test below trSupport
  // Requirement: same-day breakout-and-recovery (low < activeSupport && close > activeSupport && close > open)
  if (i > 30 && ctx.trSupport !== null) {
    const pricePos = (close - ctx.yearLow) / ctx.yearRange;
    if (pricePos < 0.65) {
      const activeSupport = ctx.trSupport;
      const maxPenetration = 0.03 * (1.5 - ctx.sensFactor); // max 3% below support (scaled by sensitivity)

      const isTrueSpring = low < activeSupport && close > activeSupport && close > open;

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
                label_zh: '弹簧效应 (Spring)',
                label_en: 'Spring / Shakeout',
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

  // Event LPS: Last Point of Support
  if (i > 30 && i - ctx.lastLPSIndex >= ctx.LPS_COOLDOWN) {
    const recentSpring = ctx.events.slice().reverse().find(e =>
      (e.event === 'Spring' || e.event === 'Shakeout') && i - e.index <= 60 && i - e.index >= 3
    );
    if (recentSpring && ctx.trSupport !== null) {
      const springLow = recentSpring.price; // spring's marked price (lowestLow)
      const higherLow = low > springLow;   // current bar's low is above Spring low
      const isLowVolume = volRatio < 0.85;  // volume drying up = no supply
      const isBuyerPresent = close >= open || lowerTailRatio > 0.40; // up close or recovery from low
      const isNotInTopRange = climaxPricePos < 0.65; // accumulation range only
      const noRecentLPS = !ctx.events.some(e => e.event === 'LPS' && i - e.index <= ctx.LPS_COOLDOWN);
      const isPullback = close < Math.max(...ctx.dfHighs.slice(Math.max(0, i - 5), i));

      if (higherLow && isLowVolume && isBuyerPresent && isNotInTopRange && noRecentLPS && isPullback) {
        ctx.events.push({
          index: i,
          event: 'LPS',
          label_zh: '支撑最后点 (LPS)',
          label_en: 'Last Point of Support (LPS)',
          date: dateStr,
          price: low,
          confidence: Math.min(0.85, 0.68 + (isLowVolume ? 0.10 : 0) + (isBuyerPresent ? 0.07 : 0))
        });
        ctx.lastLPSIndex = i;
        ctx.supportLevels.push({ price: low, strength: 2.5, index: i });
      }
    }
  }
}
