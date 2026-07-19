/**
 * @param {Array} events      - All detected Wyckoff events
 * @param {number} N          - Total number of bars in the dataset
 * @param {Array}  dfCloses   - Array of closing prices (length N), for sustained-breakout check
 * @param {number|null} trResistance - Current TR resistance level (null if unknown)
 * @param {number|null} trSupport    - Current TR support level (null if unknown)
 */
export function computeSubphase(events, N, dfCloses = null, trResistance = null, trSupport = null) {
  let wyckoffSubphase = null;
  let wyckoffSubphaseLabel_zh = null;
  let wyckoffSubphaseLabel_en = null;

  const sortedEvents = [...events].sort((a, b) => a.index - b.index);

  // Find the most recent climax anchor (SC or BC) -- start of the current TR
  let trStartIdx = -1;
  let trType = null; // 'accumulation' or 'distribution'
  for (let e = sortedEvents.length - 1; e >= 0; e--) {
    const ev = sortedEvents[e];
    if (ev.event === 'SC' || ev.event === 'PS') {
      trStartIdx = ev.index;
      trType = 'accumulation';
      break;
    }
    if (ev.event === 'BC' || ev.event === 'PSY') {
      trStartIdx = ev.index;
      trType = 'distribution';
      break;
    }
  }

  // No climax found or climax is too old (> 200 bars) -- no sub-phase
  if (trStartIdx < 0 || N - 1 - trStartIdx > 200) {
    return {
      wyckoffSubphase,
      wyckoffSubphaseLabel_zh,
      wyckoffSubphaseLabel_en
    };
  }

  const trEvents = sortedEvents.filter(e => e.index >= trStartIdx);

  if (trType === 'accumulation') {
    let phase = 'A'; // start at A (we have at least SC/PS)

    const hasAR           = trEvents.some(e => e.event === 'AR');
    const hasST           = trEvents.some(e => e.event === 'ST');
    const hasSpring       = trEvents.some(e => e.event === 'Spring' || e.event === 'Shakeout');
    const hasSpringTest   = trEvents.some(e => e.event === 'Spring_Test');
    const hasPreLPSTest   = trEvents.some(e => e.event === 'Pre_LPS_Test');
    const hasLPS          = trEvents.some(e => e.event === 'LPS');
    const hasSOS          = trEvents.some(e => e.event === 'SOS');
    const hasBU           = trEvents.some(e => e.event === 'BU');

    // Phase A complete (SC + AR established): transition to B
    if (hasAR || hasST) phase = 'B';
    // Phase C: Spring or Shakeout (the key test of support)
    if (hasSpring) phase = 'C';
    // Phase D: Trend emerging.
    //   - Spring_Test alone can push to D (the Spring held on no-supply test)
    //   - LPS alone pushes to D — a true LPS already requires a prior SOS in this TR
    //     (see accumulation.js), so this is always a Phase D scenario
    //   - SOS alone pushes to D (breakout bar itself)
    //   - Pre_LPS_Test does NOT push to D — it only confirms Phase C is still intact;
    //     the market has not yet demonstrated it can exit the TR above resistance
    if (hasSpringTest || hasLPS || hasSOS) phase = 'D';

    // Phase E: Price has left the TR above resistance.
    // Classic path: BU (backup to resistance) confirmed after SOS.
    // Alternative path: SOS occurred and price has since stayed above resistance
    //   for 3+ consecutive bars — stock never gave a BU pullback, just kept rallying.
    let isPhaseE = false;
    if (hasBU && hasSOS) {
      const lastSOS = trEvents.filter(e => e.event === 'SOS').pop();
      const lastBU  = trEvents.filter(e => e.event === 'BU').pop();
      if (lastSOS && lastBU && lastBU.index > lastSOS.index) isPhaseE = true;
    }
    if (!isPhaseE && hasSOS && trResistance !== null && dfCloses !== null) {
      // Alternative: SOS followed by price sustaining above TR resistance (no BU pullback)
      const lastSOS = trEvents.filter(e => e.event === 'SOS').pop();
      if (lastSOS) {
        const startCheckIdx = lastSOS.index + 1;
        const barsAbove = [];
        for (let k = startCheckIdx; k < N; k++) {
          if (dfCloses[k] !== undefined && dfCloses[k] > trResistance) barsAbove.push(k);
        }
        // Require 3+ bars above resistance after SOS (not necessarily consecutive)
        if (barsAbove.length >= 3) isPhaseE = true;
      }
    }
    if (isPhaseE) phase = 'E';

    wyckoffSubphase = phase;
    const phaseNamesZh = {
      A: 'A阶段（止跌）',
      B: 'B阶段（蓄势）',
      C: 'C阶段（测试）',
      D: 'D阶段（趋势浮现）',
      E: 'E阶段（突破离开）'
    };
    const phaseNamesEn = {
      A: 'Phase A (Stopping)',
      B: 'Phase B (Building Cause)',
      C: 'Phase C (Test)',
      D: 'Phase D (Trend Emerging)',
      E: 'Phase E (Markup Begins)'
    };
    wyckoffSubphaseLabel_zh = '吸筹 ' + phaseNamesZh[phase];
    wyckoffSubphaseLabel_en = 'Accumulation ' + phaseNamesEn[phase];

  } else { // distribution
    let phase = 'A';

    const hasAR_Reaction = trEvents.some(e => e.event === 'AR_Reaction');
    const hasST_Dist = trEvents.some(e => e.event === 'ST_Dist');
    const hasUTAD = trEvents.some(e => e.event === 'UTAD');
    const hasSOW = trEvents.some(e => e.event === 'SOW');
    const hasLPSY = trEvents.some(e => e.event === 'LPSY');

    if (hasAR_Reaction || hasST_Dist) phase = 'B';
    if (hasUTAD) phase = 'C';
    if (hasSOW || hasLPSY) phase = 'D';

    // Phase E (distribution): LPSY after SOW = markdown confirmed.
    // Alternative: SOW + price sustained below TR support for 3+ bars (no LPSY rally back).
    let isPhaseE = false;
    if (hasLPSY && hasSOW) {
      const lastSOW  = trEvents.filter(e => e.event === 'SOW').pop();
      const lastLPSY = trEvents.filter(e => e.event === 'LPSY').pop();
      if (lastSOW && lastLPSY && lastLPSY.index > lastSOW.index) isPhaseE = true;
    }
    if (!isPhaseE && hasSOW && trSupport !== null && dfCloses !== null) {
      // Alternative: SOW followed by price sustained below TR support (no LPSY bounce)
      const lastSOW = trEvents.filter(e => e.event === 'SOW').pop();
      if (lastSOW) {
        const startCheckIdx = lastSOW.index + 1;
        let barsBelowCount = 0;
        for (let k = startCheckIdx; k < N; k++) {
          if (dfCloses[k] !== undefined && dfCloses[k] < trSupport) barsBelowCount++;
        }
        if (barsBelowCount >= 3) isPhaseE = true;
      }
    }
    if (isPhaseE) phase = 'E';

    wyckoffSubphase = phase;
    const phaseNamesZh = {
      A: 'A阶段（止涨）',
      B: 'B阶段（蓄势派发）',
      C: 'C阶段（假突破）',
      D: 'D阶段（弱势浮现）',
      E: 'E阶段（跌破离开）'
    };
    const phaseNamesEn = {
      A: 'Phase A (Stopping)',
      B: 'Phase B (Building Cause)',
      C: 'Phase C (Upthrust)',
      D: 'Phase D (Weakness)',
      E: 'Phase E (Markdown Begins)'
    };
    wyckoffSubphaseLabel_zh = '派发 ' + phaseNamesZh[phase];
    wyckoffSubphaseLabel_en = 'Distribution ' + phaseNamesEn[phase];
  }

  return {
    wyckoffSubphase,
    wyckoffSubphaseLabel_zh,
    wyckoffSubphaseLabel_en
  };
}

