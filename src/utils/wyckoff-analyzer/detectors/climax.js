import { EVENT_META } from '../core/eventMeta';

export function detectClimax(ctx, i, dateStr, dayInfo) {
  const {
    close, open, high, low,
    curAtr, volRatio, dailySpread,
    isDownDay, isUpDay,
    climaxVolThresh, standardVolThresh,
    lowerTailRatio, upperTailRatio, climaxPricePos
  } = dayInfo;

  // Expire stale SC/BC anchors
  if (ctx.lastSC && i - ctx.lastSC.index > ctx.CLIMAX_EXPIRY_BARS) {
    ctx.lastSC = null;
    ctx.trSupport = null;
  }
  if (ctx.lastBC && i - ctx.lastBC.index > ctx.CLIMAX_EXPIRY_BARS) {
    ctx.lastBC = null;
    ctx.trResistance = null;
  }

  // Event PS: Preliminary Support
  if (
    i - ctx.lastPSIndex >= ctx.PS_PSY_COOLDOWN &&
    !ctx.lastSC &&
    climaxPricePos < 0.50 &&
    ctx.ma20[i] !== null && ctx.ma60[i] !== null && ctx.ma20[i] < ctx.ma60[i] &&
    volRatio > 1.5 * ctx.sensFactor && volRatio < climaxVolThresh * 1.1 &&
    dailySpread > 1.0 * curAtr &&
    lowerTailRatio > 0.35 &&
    close < ctx.ma20[i]
  ) {
    ctx.events.push({
      index: i,
      event: 'PS',
      ...EVENT_META.PS,
      date: dateStr,
      price: low,
      confidence: Math.min(0.80, 0.50 + (volRatio / climaxVolThresh) * 0.15 + lowerTailRatio * 0.10)
    });
    ctx.lastPSIndex = i;
    ctx.supportLevels.push({ price: low, strength: 1.5, index: i });
  }

  // Event A: Selling Climax (SC)
  const isClassicSC = (
    isDownDay &&
    volRatio > climaxVolThresh &&
    dailySpread > 1.5 * ctx.sensFactor * curAtr &&
    lowerTailRatio > 0.4 &&
    close < ctx.ma20[i] &&
    climaxPricePos < 0.50
  );
  const isNoTailSC = (
    isDownDay &&
    volRatio > climaxVolThresh * 1.3 &&
    dailySpread > 2.0 * ctx.sensFactor * curAtr &&
    lowerTailRatio <= 0.4 &&
    close < ctx.ma20[i] &&
    climaxPricePos < 0.45
  );

  if (isClassicSC || isNoTailSC) {
    ctx.events.push({
      index: i,
      event: 'SC',
      ...EVENT_META.SC,
      date: dateStr,
      price: low,
      confidence: isClassicSC
        ? Math.min(0.95, 0.5 + (volRatio / 5) * 0.3 + lowerTailRatio * 0.15)
        : Math.min(0.82, 0.55 + (volRatio / climaxVolThresh) * 0.15)
    });
    ctx.lastSC = { index: i, price: low, date: dateStr };
    ctx.supportLevels.push({ price: low, strength: 3, index: i });
    ctx.trSupport = low;
  }

  // SC Fallback: Post-SOW bottom recognition
  const recentSOWForSC = ctx.events.slice().reverse().find(e =>
    e.event === 'SOW' && i - e.index <= 120 && i - e.index >= 3
  );
  if (
    !ctx.lastSC &&
    recentSOWForSC &&
    climaxPricePos < 0.30 &&
    close > open &&
    volRatio > standardVolThresh &&
    low <= Math.min(...ctx.dfLows.slice(Math.max(0, i - 20), i))
  ) {
    ctx.events.push({
      index: i,
      event: 'SC',
      ...EVENT_META.SC,
      date: dateStr,
      price: low,
      confidence: 0.65
    });
    ctx.lastSC = { index: i, price: low, date: dateStr };
    ctx.supportLevels.push({ price: low, strength: 2.5, index: i });
    ctx.trSupport = low;
  }

  // Event PSY: Preliminary Supply
  // NOTE: intentionally an independent `if` (not `else if`) so BC can fire
  // independently on the same bar if both conditions are met. Mirrors the
  // symmetry with the PS / SC pair above.
  if (
    i - ctx.lastPSYIndex >= ctx.PS_PSY_COOLDOWN &&
    !ctx.lastBC &&
    climaxPricePos > 0.50 &&
    ctx.ma20[i] !== null && ctx.ma60[i] !== null && ctx.ma20[i] > ctx.ma60[i] &&
    volRatio > 1.5 * ctx.sensFactor && volRatio < climaxVolThresh * 1.1 &&
    dailySpread > 1.0 * curAtr &&
    upperTailRatio > 0.35 &&
    close > ctx.ma20[i]
  ) {
    ctx.events.push({
      index: i,
      event: 'PSY',
      ...EVENT_META.PSY,
      date: dateStr,
      price: high,
      confidence: Math.min(0.80, 0.50 + (volRatio / climaxVolThresh) * 0.15 + upperTailRatio * 0.10)
    });
    ctx.lastPSYIndex = i;
    ctx.resistanceLevels.push({ price: high, strength: 1.5, index: i });
  }

  // Event B: Buying Climax (BC)
  // NOTE: intentionally an independent `if` (not `else if` after PSY) so BC
  // is never silently suppressed when volRatio sits in the overlap zone
  // [climaxVolThresh, climaxVolThresh * 1.1] where PSY can also fire.
  if (
    isUpDay &&
    volRatio > climaxVolThresh &&
    dailySpread > 1.5 * ctx.sensFactor * curAtr &&
    upperTailRatio > 0.4 &&
    close > ctx.ma20[i] &&
    climaxPricePos > 0.50
  ) {
    ctx.events.push({
      index: i,
      event: 'BC',
      ...EVENT_META.BC,
      date: dateStr,
      price: high,
      confidence: Math.min(0.95, 0.5 + (volRatio / 5) * 0.3 + upperTailRatio * 0.15)
    });
    ctx.lastBC = { index: i, price: high, date: dateStr };
    ctx.resistanceLevels.push({ price: high, strength: 3, index: i });
    ctx.trResistance = high;
  }
}
