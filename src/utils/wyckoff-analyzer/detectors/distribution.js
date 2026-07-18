import { getFallbackPivotResistance } from '../core/indicators';

export function detectDistribution(ctx, i, dateStr, dayInfo) {
  const {
    close, open, low, high, curAtr,
    volRatio,
  } = dayInfo;


  // Event UTAD: Distribution upthrust above trResistance
  if (i > 30) {
    const pricePos = (close - ctx.yearLow) / ctx.yearRange;
    if (pricePos > 0.35) {
      // Prefer TR resistance established by BC/AR events; fall back to maximum pivot high (or rolling max if no pivot)
      const activeResistance = ctx.trResistance !== null
        ? ctx.trResistance
        : getFallbackPivotResistance(i, ctx.allPivots.pivotHighs, Math.max(...ctx.dfHighs.slice(i - 30, i)));

      // UTAD: price briefly breaks above TR resistance but closes back below it
      const brokeResistance = high > activeResistance;
      const penetrationDepth = activeResistance > 0 ? (high - activeResistance) / activeResistance : 0;
      const maxPenetration = 0.03 * (1.5 - ctx.sensFactor); // max 3% above resistance (scaled by sensitivity)
      const rejectedQuickly = close < activeResistance && penetrationDepth < maxPenetration;
      const isTrueUTAD = brokeResistance && rejectedQuickly && close < open
        && volRatio > 1.8 // Require high volume to confirm institutional distribution
        && (high - open) > 1.5 * (open - close); // Upper shadow must be at least 1.5x the body size

      if (isTrueUTAD) {
        // In a strong uptrend, minor rejections are normal and not UTAD.
        const isStrongUptrend = ctx.ma20[i] > ctx.ma60[i] && ctx.ma60[i] > ctx.ma120[i];
        if (!isStrongUptrend || volRatio > 2.2 || (open - close) > 0.02 * close) {
          ctx.events.push({
            index: i,
            event: 'UTAD',
            label_zh: '上轨假突破 (UTAD)',
            label_en: 'Upthrust (UT/UTAD)',
            date: dateStr,
            price: high,
            confidence: Math.min(0.95, 0.75 + (1 - penetrationDepth / maxPenetration) * 0.15)
          });
          ctx.resistanceLevels.push({ price: high, strength: 4, index: i });
          ctx.lastUTAD = { index: i, price: high, date: dateStr };
          ctx.lastUTADInvalidated = false;
        }
      }
    }
  }

  // Event UTAD_Failure / JAC
  if (ctx.lastUTAD && !ctx.lastUTADInvalidated && i - ctx.lastUTAD.index <= 20) {
    if (close > ctx.lastUTAD.price) {
      ctx.events.push({
        index: i,
        event: 'UTAD_Failure',
        label_zh: '空头踩踏突破 (JAC/UTAD-F)',
        label_en: 'UTAD Failure Breakout (JAC)',
        date: dateStr,
        price: close,
        confidence: 0.85
      });
      ctx.lastUTADInvalidated = true; // prevent duplicate triggering
    }
  }

  // Event J: Backup to Resistance (BU / 无量回踩确认)
  if (i > 25 && i - ctx.lastBUIndex >= 8) {
    const activeResistance = ctx.trResistance !== null
      ? ctx.trResistance
      : getFallbackPivotResistance(i, ctx.allPivots.pivotHighs, Math.max(...ctx.dfHighs.slice(i - 30, i)));

    if (activeResistance > 0) {
      // Check if price broke out above resistance in the last 15 days
      const brokeOutRecently = ctx.dfCloses.slice(i - 15, i).some(c => c > activeResistance);

      if (brokeOutRecently) {
        // Is price currently pulling back close to resistance? (within 1.5 * ATR)
        const isNearResistance = Math.abs(close - activeResistance) <= 1.5 * curAtr;
        // Is the daily low holding above activeResistance - 1.0 * ATR? (no deep breakdown)
        const lowHoldsAboveLine = low >= activeResistance - 1.0 * curAtr;
        // Is volume low? (less than 85% of 20d average)
        const isLowVolume = volRatio < 0.85;
        // Did price stabilize? (阳线 or close did not drop significantly)
        const priceStabilized = close >= open || close > ctx.dfCloses[i - 1] - 0.3 * curAtr;

        if (isNearResistance && lowHoldsAboveLine && isLowVolume && priceStabilized) {
          ctx.events.push({
            index: i,
            event: 'BU',
            label_zh: '无量回踩确认 (BU)',
            label_en: 'Backup to Resistance (BU)',
            date: dateStr,
            price: close,
            confidence: 0.80
          });
          ctx.lastBUIndex = i;
        }
      }
    }
  }
}
