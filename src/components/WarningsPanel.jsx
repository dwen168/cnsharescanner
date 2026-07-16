import React from 'react';
import { getT, translateWarning } from '../utils/translations';

export default function WarningsPanel({ warnings, lang }) {
  const t = getT(lang);
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="warnings-panel">
      <div className="warnings-header">
        <span className="warning-icon">⚠️</span>
        <span className="warning-title">{t('warningsTitle')}</span>
      </div>
      <ul className="warnings-list">
        {warnings.map((warn, i) => (
          <li key={i} className="warning-item">
            <span className="warning-dot"></span> {translateWarning(warn, lang)}
          </li>
        ))}
      </ul>
    </div>
  );
}
