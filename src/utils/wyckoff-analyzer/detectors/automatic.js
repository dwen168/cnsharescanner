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
          index: arIdx,
          event: 'AR',
          label_zh: '自动反弹 (AR)',
          label_en: 'Automatic Rally (AR)',
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
          index: arIdx,
          event: 'AR_Reaction',
          label_zh: '自动回落 (AR)',
          label_en: 'Automatic Reaction (AR)',
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
