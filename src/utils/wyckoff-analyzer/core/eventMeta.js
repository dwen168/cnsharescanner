/**
 * EVENT_META — 全局 Wyckoff 事件元数据字典
 *
 * 所有事件的双语标签统一在此维护，检测器只负责 push 事件类型和数值。
 * 如需做真正的 i18n，替换此处即可，无需逐文件搜索。
 */
export const EVENT_META = {
  // ── 吸筹侧 ─────────────────────────────────────────────────────────────────
  PS:          { label_zh: '初步支撑 (PS)',         label_en: 'Preliminary Support (PS)' },
  SC:          { label_zh: '卖出高潮 (SC)',         label_en: 'Selling Climax (SC)' },
  AR:          { label_zh: '自动反弹 (AR)',         label_en: 'Automatic Rally (AR)' },
  ST:          { label_zh: '二次测试 (ST)',         label_en: 'Secondary Test (ST)' },
  Spring:      { label_zh: '弹簧效应 (Spring)',     label_en: 'Spring / Shakeout' },
  Spring_Test:  { label_zh: '弹簧测试 (Test)',           label_en: 'Spring Test (No Supply)' },
  Pre_LPS_Test: { label_zh: '支撑预测试 (Pre-LPS)',       label_en: 'Pre-LPS Support Test (Phase C)' },
  LPS:          { label_zh: '支撑最后点 (LPS)',            label_en: 'Last Point of Support (LPS)' },
  SOS:         { label_zh: '强势信号 (SOS)',        label_en: 'Sign of Strength (SOS)' },

  // ── 派发侧 ─────────────────────────────────────────────────────────────────
  PSY:         { label_zh: '初步阻力 (PSY)',        label_en: 'Preliminary Supply (PSY)' },
  BC:          { label_zh: '买入高潮 (BC)',         label_en: 'Buying Climax (BC)' },
  AR_Reaction: { label_zh: '自动回落 (AR)',         label_en: 'Automatic Reaction (AR)' },
  ST_Dist:     { label_zh: '二次测试 (ST)',         label_en: 'Secondary Test (ST)' },
  UTAD:        { label_zh: '上轨假突破 (UTAD)',     label_en: 'Upthrust (UT/UTAD)' },
  UTAD_Failure:{ label_zh: '空头踩踏突破 (JAC/UTAD-F)', label_en: 'UTAD Failure Breakout (JAC)' },
  BU:          { label_zh: '无量回踩确认 (BU)',     label_en: 'Backup to Resistance (BU)' },
  SOW:         { label_zh: '弱势信号 (SOW)',        label_en: 'Sign of Weakness (SOW)' },
  LPSY:        { label_zh: '供应最后点 (LPSY)',     label_en: 'Last Point of Supply (LPSY)' },

  // ── 形态 ───────────────────────────────────────────────────────────────────
  Shakeout:    { label_zh: '洗盘反转 (Shakeout)',   label_en: 'Shakeout Recovery (False Breakdown)' },
  Flag:        { label_zh: '黄金旗形突破 (Flag)',   label_en: 'Bull Flag Breakout (Flag)' },
};
