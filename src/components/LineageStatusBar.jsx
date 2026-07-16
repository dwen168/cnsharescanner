import React from 'react';
import { getT } from '../utils/translations';

export default function LineageStatusBar({ lineage, tradingState, waneye, lang }) {
  const t = getT(lang);

  // Lineage configurations
  const lineageConf = {
    real: { text: t('lineageReal'), class: 'lineage-real', icon: '🟢' },
    degraded: { text: t('lineageDegraded'), class: 'lineage-degraded', icon: '🟡' },
    mock: { text: t('lineageMock'), class: 'lineage-mock', icon: '🔴' }
  };
  const currentLineage = lineageConf[lineage] || lineageConf['mock'];

  // Risk state configurations
  const stateConf = {
    active: { text: t('stateActive'), class: 'valve-active', icon: '⚡' },
    low_risk: { text: t('stateLowRisk'), class: 'valve-low-risk', icon: '⚠️' },
    medium_risk: { text: t('stateMediumRisk'), class: 'valve-med-risk', icon: '⏸' },
    halted: { text: t('stateHalted'), class: 'valve-halted', icon: '🛑' },
    high_risk: { text: t('stateHalted'), class: 'valve-halted', icon: '🛑' }
  };
  const currentRisk = stateConf[tradingState] || stateConf['halted'];

  // Sentiment maps
  const getSentText = (sentiment) => {
    const s = (sentiment || "").toLowerCase();
    if (s.includes('pos')) return t('waneyeSentimentPos');
    if (s.includes('neg')) return t('waneyeSentimentNeg');
    return t('waneyeSentimentNeu');
  };

  return (
    <div className="status-bar">
      <div className="status-item">
        <span className="status-label">{t('lineageTitle')}</span>
        <span className={`status-badge ${currentLineage.class}`}>
          <span className="badge-dot"></span>
          {currentLineage.icon} {currentLineage.text}
        </span>
      </div>

      <div className="status-item">
        <span className="status-label">{t('tradingStateTitle')}</span>
        <span className={`status-badge ${currentRisk.class}`}>
          <span className="badge-dot"></span>
          {currentRisk.icon} {currentRisk.text}
        </span>
      </div>

      {waneye && (
        <div className="status-item score-item">
          <span className="status-label">{t('waneyeScore')}</span>
          <span className="status-val font-mono">{waneye.score}/100</span>
          <span className={`sentiment-indicator ${waneye.score >= 50 ? 'pos' : 'neg'}`}>
            ({getSentText(waneye.sentiment)})
          </span>
        </div>
      )}
    </div>
  );
}
