export function detectTests(ctx, i, dateStr, dayInfo) {
  const {
    close, low, high, curAtr,
    volRatio, dailySpread,
  } = dayInfo;

  // Event D: Secondary Test (ST)
  if (ctx.lastSC && i > ctx.lastSC.index + 5 && i <= ctx.lastSC.index + 30) {
    const isNearScLow = close <= ctx.lastSC.price + 1.5 * curAtr && low >= ctx.lastSC.price - 0.5 * curAtr;
    const isLowVol = volRatio < 1.0 * (2 - ctx.sensFactor);
    const noPriorST = !ctx.events.some(e => e.event === 'ST' && e.index > ctx.lastSC.index && e.index < i);
    if (isNearScLow && isLowVol && noPriorST) {
      ctx.events.push({
        index: i,
        event: 'ST',
        label_zh: '二次测试 (ST)',
        label_en: 'Secondary Test (ST)',
        date: dateStr,
        price: low,
        confidence: 0.7
      });
      // ST refines TR support — use the higher of ST low vs SC low as stronger support
      if (ctx.trSupport !== null && low >= ctx.trSupport) {
        ctx.trSupport = low;
      }
    }
  }

  if (ctx.lastBC && i > ctx.lastBC.index + 5 && i <= ctx.lastBC.index + 30) {
    const isNearBcHigh = close >= ctx.lastBC.price - 1.5 * curAtr && high <= ctx.lastBC.price + 0.5 * curAtr;
    const isLowVol = volRatio < 1.0 * (2 - ctx.sensFactor);
    const noPriorST = !ctx.events.some(e => e.event === 'ST_Dist' && e.index > ctx.lastBC.index && e.index < i);
    if (isNearBcHigh && isLowVol && noPriorST) {
      ctx.events.push({
        index: i,
        event: 'ST_Dist',
        label_zh: '二次测试 (ST)',
        label_en: 'Secondary Test (ST)',
        date: dateStr,
        price: high,
        confidence: 0.7
      });
      // ST refines TR resistance — use the lower of ST high vs BC high
      if (ctx.trResistance !== null && high <= ctx.trResistance) {
        ctx.trResistance = high;
      }
    }
  }

  // Event Spring_Test: Low-volume test after Spring / Shakeout
  if (i > 30 && ctx.lastSpringEventIndex > 0) {
    const barsSinceSpring = i - ctx.lastSpringEventIndex;
    if (barsSinceSpring >= 3 && barsSinceSpring <= 15) {
      const springEvent = ctx.events.slice().reverse().find(e =>
        (e.event === 'Spring' || e.event === 'Shakeout') && e.index === ctx.lastSpringEventIndex
      );
      if (springEvent) {
        const springLow = springEvent.price;
        const isNearSpringLow = low <= springLow + 1.5 * curAtr;
        const isVeryLowVolume = volRatio < 0.70; // "no supply" test
        const recoversIntraday = dailySpread > 0
          ? (close - low) / dailySpread >= 0.40  // closes in upper 40% of day range
          : false;
        const noRecentSpringTest = !ctx.events.some(e => e.event === 'Spring_Test' && i - e.index <= 5);
        const priceStillAboveSpringLow = close > springLow - 0.5 * curAtr; // hasn't broken down below Spring

        if (isNearSpringLow && isVeryLowVolume && recoversIntraday && noRecentSpringTest && priceStillAboveSpringLow) {
          ctx.events.push({
            index: i,
            event: 'Spring_Test',
            label_zh: '弹簧测试 (Test)',
            label_en: 'Spring Test (No Supply)',
            date: dateStr,
            price: low,
            confidence: Math.min(0.88, 0.72 + (0.70 - volRatio) * 0.5 + recoversIntraday * 0.06)
          });
          // Successful Spring_Test refines TR support upward to the test low
          if (ctx.trSupport !== null && low > ctx.trSupport) {
            ctx.trSupport = low;
          }
        }
      }
    }
  }
}
