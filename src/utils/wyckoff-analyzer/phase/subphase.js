export function computeSubphase(events, N) {
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

    const hasAR = trEvents.some(e => e.event === 'AR');
    const hasST = trEvents.some(e => e.event === 'ST');
    const hasSpring = trEvents.some(e => e.event === 'Spring' || e.event === 'Shakeout');
    const hasSpringTest = trEvents.some(e => e.event === 'Spring_Test');
    const hasLPS = trEvents.some(e => e.event === 'LPS');
    const hasSOS = trEvents.some(e => e.event === 'SOS');
    const hasBU = trEvents.some(e => e.event === 'BU');

    // Phase A complete (SC + AR established): transition to B
    if (hasAR || hasST) phase = 'B';
    // Phase C: Spring or Shakeout (the key test of support)
    if (hasSpring) phase = 'C';
    // Phase D: Successful test (Spring_Test, LPS) or early SOS
    if (hasSpringTest || hasLPS || hasSOS) phase = 'D';
    // Phase E: Price has left the TR above resistance (BU = post-breakout confirmation)
    // Phase E: Price has left the TR above resistance (BU = post-breakout confirmation)
    if (hasBU && hasSOS) {
      const lastSOS = trEvents.filter(e => e.event === 'SOS').pop();
      const lastBU = trEvents.filter(e => e.event === 'BU').pop();
      if (lastSOS && lastBU && lastBU.index > lastSOS.index) phase = 'E';
    }

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
    // Phase E: LPSY after SOW = markdown confirmed
    if (hasLPSY && hasSOW) {
      const lastSOW = trEvents.filter(e => e.event === 'SOW').pop();
      const lastLPSY = trEvents.filter(e => e.event === 'LPSY').pop();
      if (lastSOW && lastLPSY && lastLPSY.index > lastSOW.index) phase = 'E';
    }

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
