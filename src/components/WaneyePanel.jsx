import React, { useState } from 'react';
import { getT, translateDynamic } from '../utils/translations';

export default function WaneyePanel({ waneye, lang }) {
  const t = getT(lang);
  // selectedFilter format: null or { impact: 'low'|'medium'|'high', likelihood: 'low'|'medium'|'high' }
  const [selectedFilter, setSelectedFilter] = useState(null);

  if (!waneye) return null;

  // Filter risks based on the 3x3 cell selection
  const visibleRisks = selectedFilter !== null
    ? waneye.risks.filter(risk => 
        risk.impact.toLowerCase() === selectedFilter.impact && 
        risk.likelihood.toLowerCase() === selectedFilter.likelihood
      )
    : waneye.risks;

  // Helper to count risks in each cell
  const getRiskCount = (impact, likelihood) => {
    return waneye.risks.filter(risk => 
      risk.impact.toLowerCase() === impact && 
      risk.likelihood.toLowerCase() === likelihood
    ).length;
  };

  // Cell key definitions
  const matrixCells = [
    { impact: 'high',   likelihood: 'low' }, { impact: 'high',   likelihood: 'medium' }, { impact: 'high',   likelihood: 'high' },
    { impact: 'medium', likelihood: 'low' }, { impact: 'medium', likelihood: 'medium' }, { impact: 'medium', likelihood: 'high' },
    { impact: 'low',    likelihood: 'low' }, { impact: 'low',    likelihood: 'medium' }, { impact: 'low',    likelihood: 'high' }
  ];

  return (
    <section className="module">
      <div className="section-header">
        <div className="section-icon" style={{ background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>📰</div>
        <div>
          <div className="section-title">{t('waneyeTitle')}</div>
          <div className="section-desc">{t('waneyeDesc')}</div>
        </div>
      </div>

      <div className="waneye-grid">
        {/* Core Highlights */}
        {waneye.highlights && waneye.highlights.length > 0 && (
          <div className="waneye-card highlights-card">
            <h3 className="waneye-section-title">
              <span className="title-icon">🌟</span> {t('highlightsList')}
            </h3>
            <ul className="waneye-highlights-list">
              {waneye.highlights.map((item, idx) => (
                <li key={idx} className="waneye-highlight-item">
                  <div className="highlight-bullet"></div>
                  <div className="highlight-text">{translateDynamic(item, lang)}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Live Headlines */}
        {waneye.headlines && waneye.headlines.length > 0 && (
          <div className="waneye-card headlines-card">
            <h3 className="waneye-section-title">
              <span className="title-icon">⚡</span> {t('headlinesList')}
            </h3>
            <div className="waneye-headlines-scroll">
              {waneye.headlines.map((headline, idx) => (
                <div key={idx} className="waneye-headline-item">
                  <span className="headline-number">{idx + 1}</span>
                  {headline.url && headline.url !== '#' ? (
                    <a href={headline.url} target="_blank" rel="noopener noreferrer" className="headline-link">
                      {translateDynamic(headline.title, lang)}
                    </a>
                  ) : (
                    <span className="headline-text-only">{translateDynamic(headline.title, lang)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Risks and Recommendations Grid */}
      <div className="waneye-grid-details" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Risks Section with 2D Heat Map Matrix */}
        {waneye.risks && waneye.risks.length > 0 && (
          <div className="waneye-card risks-detail-card">
            <h3 className="waneye-section-title">
              <span className="title-icon">⚠️</span> {t('risksSectionTitle')}
            </h3>
            
            {/* Split layout: Matrix on Left, details on Right */}
            <div className="waneye-split-layout">
              
              {/* Left Column: 2D Risk Matrix Grid (Scaled Down) */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                alignItems: 'center',
                width: '180px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: '0.2rem' }}>
                  <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-2)' }}>
                    📊 {lang === 'zh' ? '风向映射' : 'Risk Map'}
                  </div>
                  {selectedFilter !== null && (
                    <button
                      onClick={() => setSelectedFilter(null)}
                      style={{
                        background: 'rgba(99,179,237,0.1)',
                        border: '1px solid rgba(99,179,237,0.3)',
                        borderRadius: '3px',
                        color: 'var(--cyan)',
                        fontSize: '0.55rem',
                        padding: '0.1rem 0.35rem',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      {lang === 'zh' ? '重置' : 'Reset'}
                    </button>
                  )}
                </div>
                
                {/* 3x3 Coordinate Matrix Wrapper (Scaled Down to 120px) */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '120px',
                  aspectRatio: '1',
                  display: 'flex',
                  flexDirection: 'column',
                  marginTop: '0.25rem'
                }}>
                  {/* Y-Axis Label (Impact) */}
                  <div style={{
                    position: 'absolute',
                    left: '-20px',
                    top: '50%',
                    transform: 'rotate(-90deg) translate(50%, 0)',
                    transformOrigin: 'left center',
                    fontSize: '0.5rem',
                    fontWeight: 700,
                    color: 'var(--text-3)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap'
                  }}>
                    {lang === 'zh' ? '影响' : 'Impact'}
                  </div>

                  {/* 3x3 Grid Map */}
                  <div style={{
                    flex: 1,
                    display: 'grid',
                    gridTemplateRows: 'repeat(3, 1fr)',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    borderLeft: '2px solid var(--text-3)',
                    borderBottom: '2px solid var(--text-3)',
                    position: 'relative',
                    background: 'var(--bg-card-subtle, rgba(0,0,0,0.05))',
                    gap: '1px' // Grid gaps to see cells clearly
                  }}>
                    {/* Render Nine Clickable Category Cells */}
                    {matrixCells.map((cell, idx) => {
                      const count = getRiskCount(cell.impact, cell.likelihood);
                      const isSelected = selectedFilter && selectedFilter.impact === cell.impact && selectedFilter.likelihood === cell.likelihood;
                      
                      // Soft heat color gradients
                      let cellColor = 'transparent';
                      if (cell.impact === 'high') {
                        cellColor = cell.likelihood === 'high' ? 'rgba(255, 92, 114, 0.22)' : (cell.likelihood === 'medium' ? 'rgba(255, 92, 114, 0.12)' : 'rgba(255, 92, 114, 0.05)');
                      } else if (cell.impact === 'medium') {
                        cellColor = cell.likelihood === 'high' ? 'rgba(255, 92, 114, 0.12)' : (cell.likelihood === 'medium' ? 'rgba(249, 115, 22, 0.12)' : 'rgba(249, 115, 22, 0.05)');
                      } else {
                        cellColor = cell.likelihood === 'high' ? 'rgba(249, 115, 22, 0.12)' : (cell.likelihood === 'medium' ? 'rgba(249, 115, 22, 0.05)' : 'rgba(99, 179, 237, 0.08)');
                      }

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (count > 0) {
                              setSelectedFilter(isSelected ? null : { impact: cell.impact, likelihood: cell.likelihood });
                            }
                          }}
                          style={{
                            background: isSelected ? 'var(--cyan-soft, rgba(99, 179, 237, 0.15))' : cellColor,
                            border: isSelected ? '1px solid var(--cyan)' : 'none',
                            cursor: count > 0 ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            position: 'relative'
                          }}
                          title={`${lang === 'zh' ? '影响' : 'Impact'}: ${cell.impact.toUpperCase()}, ${lang === 'zh' ? '概率' : 'Likelihood'}: ${cell.likelihood.toUpperCase()} (${count} ${lang === 'zh' ? '个风险' : 'risks'})`}
                        >
                          {/* Display count if > 0 */}
                          {count > 0 && (
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              background: isSelected ? 'var(--cyan)' : (cell.impact === 'high' ? 'var(--red)' : (cell.impact === 'medium' ? 'var(--orange)' : 'var(--cyan)')),
                              color: '#000',
                              width: '14px',
                              height: '14px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                            }}>
                              {count}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* X-Axis Label */}
                  <div style={{
                    textAlign: 'center',
                    fontSize: '0.5rem',
                    fontWeight: 700,
                    color: 'var(--text-3)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    marginTop: '0.35rem'
                  }}>
                    {lang === 'zh' ? '概率' : 'Likelihood'}
                  </div>
                </div>

                <span style={{ fontSize: '0.52rem', color: 'var(--text-3)', textAlign: 'center' }}>
                  {lang === 'zh' ? '💡 点击网格统计过滤右侧' : '💡 Click grid cell to filter'}
                </span>
              </div>

              {/* Right Column: Flat wrapping detail list (No height constraints, easy reading) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
                gap: '1rem',
                width: '100%'
              }}>
                {visibleRisks.map((risk, idx) => {
                  // Find original index in full list for numbering
                  const originalIdx = waneye.risks.findIndex(r => r.title === risk.title && r.mitigation === risk.mitigation);
                  const color = risk.impact.toLowerCase() === 'high' ? 'var(--red)' : (risk.impact.toLowerCase() === 'medium' ? 'var(--orange)' : 'var(--cyan)');
                  return (
                    <div
                      key={originalIdx}
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border)',
                        borderLeft: `3px solid ${color}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.85rem 1rem',
                        transition: 'all 0.3s ease',
                        animation: 'fadeIn 0.2s ease-out'
                      }}
                    >
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginBottom: '0.5rem', width: '100%' }}>
                        <span style={{
                          width: '18px', height: '18px', borderRadius: '50%',
                          background: 'rgba(255,255,255,0.05)', display: 'inline-flex',
                          alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem',
                          fontWeight: 700, color: 'var(--text-2)', border: '1px solid var(--border)'
                        }}>{originalIdx + 1}</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-1)', marginRight: 'auto' }}>{translateDynamic(risk.title, lang)}</span>
                        
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <span style={{
                            fontSize: '0.62rem', padding: '0.1rem 0.3rem', borderRadius: '4px',
                            background: risk.impact.toLowerCase() === 'high' ? 'rgba(255, 92, 114, 0.12)' : 'rgba(249, 115, 22, 0.12)',
                            color: risk.impact.toLowerCase() === 'high' ? 'var(--red)' : 'var(--orange)',
                            fontWeight: 600
                          }}>
                            {t('impactLabel')}: {translateDynamic(risk.impact, lang)}
                          </span>
                          <span style={{
                            fontSize: '0.62rem', padding: '0.1rem 0.3rem', borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-2)',
                            border: '1px solid var(--border)',
                            fontWeight: 600
                          }}>
                            {t('likelihoodLabel')}: {translateDynamic(risk.likelihood, lang)}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-2)', lineHeight: 1.4 }}>
                        <strong style={{ color: 'var(--cyan)' }}>{t('mitigationLabel')}:</strong> {translateDynamic(risk.mitigation, lang)}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        )}

        <div className="waneye-recs-subgrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1.5rem' }}>
          {/* Opportunities */}
          {waneye.opportunities && waneye.opportunities.length > 0 && (
            <div className="waneye-card opportunities-card" style={{ borderLeft: '3px solid var(--green)' }}>
              <h3 className="waneye-section-title" style={{ borderBottomColor: 'rgba(34, 217, 138, 0.15)' }}>
                <span className="title-icon">📈</span> {t('oppsSectionTitle')}
              </h3>
              <div className="waneye-recommendations-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {waneye.opportunities.map((item, idx) => (
                  <div key={idx} className="rec-detail-item opp-border" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.02)', paddingBottom: '0.6rem' }}>
                    <div className="rec-detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span className="rec-detail-title" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)' }}>{translateDynamic(item.title, lang)}</span>
                      {item.timeframe && (
                        <span className="rec-detail-timeframe" style={{ fontSize: '0.65rem', padding: '0.05rem 0.3rem', borderRadius: '4px', background: 'rgba(34, 217, 138, 0.1)', color: 'var(--green)' }}>{translateDynamic(item.timeframe, lang)}</span>
                      )}
                    </div>
                    <p className="rec-detail-desc" style={{ fontSize: '0.76rem', color: 'var(--text-2)', lineHeight: 1.4 }}>{translateDynamic(item.description, lang)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Defensive */}
          {waneye.defensive && waneye.defensive.length > 0 && (
            <div className="waneye-card defensive-card" style={{ borderLeft: '3px solid var(--cyan)' }}>
              <h3 className="waneye-section-title" style={{ borderBottomColor: 'rgba(99, 179, 237, 0.15)' }}>
                <span className="title-icon">🛡️</span> {t('defSectionTitle')}
              </h3>
              <div className="waneye-recommendations-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {waneye.defensive.map((item, idx) => (
                  <div key={idx} className="rec-detail-item def-border" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.02)', paddingBottom: '0.6rem' }}>
                    <div className="rec-detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span className="rec-detail-title" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)' }}>{translateDynamic(item.title, lang)}</span>
                      {item.timeframe && (
                        <span className="rec-detail-timeframe" style={{ fontSize: '0.65rem', padding: '0.05rem 0.3rem', borderRadius: '4px', background: 'rgba(99, 179, 237, 0.1)', color: 'var(--cyan)' }}>{translateDynamic(item.timeframe, lang)}</span>
                      )}
                    </div>
                    <p className="rec-detail-desc" style={{ fontSize: '0.76rem', color: 'var(--text-2)', lineHeight: 1.4 }}>{translateDynamic(item.description, lang)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
