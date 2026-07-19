import { EVENT_META } from '../core/eventMeta';

/**
 * Detects Automatic Rally (AR) after a Selling Climax (SC) and
 * Automatic Reaction (AR_Reaction) after a Buying Climax (BC).
 *
 * ## Look-ahead bias design
 * AR is detected by scanning a window of bars after the SC and finding the
 * highest point. This requires looking at future bars relative to the SC bar,
 * which is a form of look-ahead. To handle this correctly, two index fields
 * are emitted on each event:
 *
 *   `index`          – The historical bar where the AR high/low occurred.
 *                      Use this for CHART ANNOTATIONS so the marker appears
 *                      at the actual price extreme.
 *
 *   `confirmedIndex` – The bar when the detection window closed and the AR
 *                      event became fully knowable (no future data needed).
 *                      Use this for BACKTESTING entry/exit logic to avoid
 *                      introducing look-ahead bias into strategy evaluation.
 *
 * In LIVE / real-time usage (isEndOfData = true), `index` and `confirmedIndex`
 * converge to the same bar because the window closes at the current bar, so
 * the AR is only emitted when the latest bar IS the window end.
 */
export function detectAutomatic(ctx, i) {

  // Event C: Automatic Rally (AR)
  if (ctx.lastSC && !ctx.events.find(e => e.event === 'AR' && e.index > ctx.lastSC.index)) {
    const arWindowEnd = Math.min(ctx.lastSC.index + 8, ctx.N - 1);
    const isEndOfData = (i === ctx.N - 1);
    const isWindowComplete = (i === arWindowEnd);

    if ((isWindowComplete || isEndOfData) && i - ctx.lastSC.index >= 3) {
      const actualEnd = Math.min(ctx.lastSC.index + 8, ctx.N - 1);
      const windowHighs = ctx.dfHighs.slice(ctx.lastSC.index + 1, actualEnd + 1);
      const arHigh = Math.max(...windowHighs);
      const arHighLocalIdx = windowHighs.indexOf(arHigh);
      const arIdx = ctx.lastSC.index + 1 + arHighLocalIdx;
      const arDateStr = new Date(ctx.df[arIdx].timestamp * 1000).toISOString().split('T')[0];

      if (arHigh > ctx.lastSC.price) {
        ctx.events.push({
          // `index` = the historical bar where the AR price high occurred (for chart annotation).
          // `confirmedIndex` = the bar when the window closed and this event became knowable
          //   (use this for backtesting entry timing to avoid look-ahead bias).
          index: arIdx,
          confirmedIndex: i,
          event: 'AR',
          ...EVENT_META.AR,
          date: arDateStr,
          price: arHigh,
          confidence: 0.75
        });
        ctx.resistanceLevels.push({ price: arHigh, strength: 2, index: arIdx });
        // AR high establishes/refines TR top for accumulation
        if (!ctx.trResistance || arHigh > ctx.trResistance) {
          ctx.trResistance = arHigh;
        }
      }
    }
  }

  // Event C2: Automatic Reaction (AR_Reaction)
  if (ctx.lastBC && !ctx.events.find(e => e.event === 'AR_Reaction' && e.index > ctx.lastBC.index)) {
    const arWindowEnd = Math.min(ctx.lastBC.index + 8, ctx.N - 1);
    const isEndOfData = (i === ctx.N - 1);
    const isWindowComplete = (i === arWindowEnd);

    if ((isWindowComplete || isEndOfData) && i - ctx.lastBC.index >= 3) {
      const actualEnd = Math.min(ctx.lastBC.index + 8, ctx.N - 1);
      const windowLows = ctx.dfLows.slice(ctx.lastBC.index + 1, actualEnd + 1);
      const arLow = Math.min(...windowLows);
      const arLowLocalIdx = windowLows.indexOf(arLow);
      const arIdx = ctx.lastBC.index + 1 + arLowLocalIdx;
      const arDateStr = new Date(ctx.df[arIdx].timestamp * 1000).toISOString().split('T')[0];

      if (arLow < ctx.lastBC.price) {
        ctx.events.push({
          // `index` = the historical bar where the AR price low occurred (for chart annotation).
          // `confirmedIndex` = the bar when the window closed and this event became knowable
          //   (use this for backtesting entry timing to avoid look-ahead bias).
          index: arIdx,
          confirmedIndex: i,
          event: 'AR_Reaction',
          ...EVENT_META.AR_Reaction,
          date: arDateStr,
          price: arLow,
          confidence: 0.75
        });
        ctx.supportLevels.push({ price: arLow, strength: 2, index: arIdx });
        // AR low establishes/refines TR bottom for distribution
        if (!ctx.trSupport || arLow < ctx.trSupport) {
          ctx.trSupport = arLow;
        }
      }
    }
  }
}
