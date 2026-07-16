import React from 'react';
import { getT, translateSummary } from '../utils/translations';

export default function MacroPanel({ macro, lang }) {
  if (!macro) return null;
  const t = getT(lang);
  
  const isYieldUp = macro.yield_trend > 0;
  const isAudUp = macro.aud_trend > 0;

  return (
    <div className="macro-panel">
      <div className="macro-header">
        <span className="macro-tag">{t('macroTitle')}</span>
        <span className="macro-desc">{translateSummary(macro.summary, lang)}</span>
      </div>
      <div className="macro-stats">
        <div className="macro-stat-item">
          <span className="macro-label">{t('yieldTrend')}</span>
          <span className={`macro-val ${isYieldUp ? 'pos' : 'neg'}`}>
            {isYieldUp ? '▲' : '▼'} {Math.abs(macro.yield_trend).toFixed(2)}%
          </span>
        </div>
        <div className="macro-stat-item">
          <span className="macro-label">{t('audTrend')}</span>
          <span className={`macro-val ${isAudUp ? 'pos' : 'neg'}`}>
            {isAudUp ? '▲' : '▼'} {Math.abs(macro.aud_trend).toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}
