import React, { useState, useEffect, useRef } from 'react';
import { getT, SIGNAL_MAP, formatSectorName, translateDynamic, STOCK_NAME_MAP } from '../utils/translations';

export default function SectorHeatmap({ sectors, lang }) {
  const [selectedSector, setSelectedSector] = useState(null);
  const t = getT(lang);

  // Default to selecting the first sector to populate the Bloomberg-style panel on load
  const activeSector = selectedSector || sectors[0];

  const leftRef = useRef(null);
  const sidebarRef = useRef(null);
  const [leftHeight, setLeftHeight] = useState(null);
  const [isSideBySide, setIsSideBySide] = useState(true);

  useEffect(() => {
    if (!leftRef.current) return;
    
    const checkLayout = () => {
      if (leftRef.current) {
        const leftRect = leftRef.current.getBoundingClientRect();
        setLeftHeight(leftRect.height);
        
        if (sidebarRef.current) {
          const sidebarRect = sidebarRef.current.getBoundingClientRect();
          // If the difference in top coordinates is minimal, they are side-by-side
          setIsSideBySide(Math.abs(leftRect.top - sidebarRect.top) < 25);
        } else {
          setIsSideBySide(true);
        }
      }
    };

    const observer = new ResizeObserver(() => {
      checkLayout();
    });
    
    observer.observe(leftRef.current);
    if (sidebarRef.current) {
      observer.observe(sidebarRef.current);
    }
    
    window.addEventListener('resize', checkLayout);
    checkLayout();
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', checkLayout);
    };
  }, [activeSector]);

  return (
    <section className="module">
      <div className="section-header">
        <div className="section-icon icon-heatmap">🔥</div>
        <div>
          <div className="section-title">{t('heatmapTitle')}</div>
          <div className="section-desc">{t('heatmapDesc')}</div>
        </div>
      </div>

      <div className="heatmap-container" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* Left side: Heatmap cards grid */}
        <div className="heatmap-main" style={{ flex: '3 1 600px', minWidth: '320px' }}>
          <div ref={leftRef} className="heatmap-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {sectors.map(sector => (
              <SectorCard 
                key={sector.name} 
                sector={sector} 
                lang={lang} 
                isSelected={activeSector && activeSector.name === sector.name}
                onClick={() => setSelectedSector(sector)}
              />
            ))}
          </div>
        </div>

        {/* Right side: Bloomberg-style analysis detail panel */}
        {activeSector && (
          <div 
            ref={sidebarRef} 
            className="heatmap-sidebar" 
            style={{ 
              flex: '1 1 350px', 
              minWidth: '320px', 
              display: 'flex', 
              flexDirection: 'column',
              maxHeight: isSideBySide && leftHeight ? `${leftHeight}px` : 'none'
            }}
          >
            <SectorDetailPanel 
              sector={activeSector} 
              lang={lang} 
              onClose={() => setSelectedSector(null)} 
              maxHeight={isSideBySide && leftHeight ? leftHeight : null}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function getHeatTooltip(sector, lang) {
  if (!sector.heat_breakdown) return `Heat Score: ${sector.heat_score}`;
  const hb = sector.heat_breakdown;
  const tech = hb.tech_score !== undefined ? hb.tech_score : 0;
  const rs = hb.rs_bonus !== undefined ? hb.rs_bonus : 0;
  const macro = hb.macro_bonus !== undefined ? hb.macro_bonus : 0;
  const sent = hb.sent_bonus !== undefined ? hb.sent_bonus : 0;
  const risk = hb.risk_penalty !== undefined ? hb.risk_penalty : 0;
  const opp = hb.opportunity_boost !== undefined ? hb.opportunity_boost : 0;
  
  if (lang === 'zh') {
    return `热度分析 (总评分: ${sector.heat_score})\n` +
           `-------------------------\n` +
           `• 技术形态基础分: ${tech}\n` +
           `• 相对大盘强弱奖惩: ${rs >= 0 ? '+' : ''}${rs}\n` +
           `• 宏观环境乘数调节: ${macro >= 0 ? '+' : ''}${macro}\n` +
           `• 板块新闻舆情调节: ${sent >= 0 ? '+' : ''}${sent}\n` +
           `• Waneye 全球风险惩罚: -${risk}\n` +
           `• 战术事件机会激励: +${opp}`;
  } else {
    return `Heat Analysis (Total: ${sector.heat_score})\n` +
           `-------------------------\n` +
           `• Technical Base Score: ${tech}\n` +
           `• Relative Strength (RS): ${rs >= 0 ? '+' : ''}${rs}\n` +
           `• Macro Multipliers: ${macro >= 0 ? '+' : ''}${macro}\n` +
           `• News & Sentiment: ${sent >= 0 ? '+' : ''}${sent}\n` +
           `• Global Risk Penalties: -${risk}\n` +
           `• Tactical Opportunities: +${opp}`;
  }
}

function SectorCard({ sector, lang, isSelected, onClick }) {
  const t = getT(lang);
  
  let sentIcon = t('resonanceNeutral');
  let sentClass = "neutral";
  let sentTitle = t('resonanceNeutralDesc');
  if (sector.avg_sentiment > 0.15) {
    sentIcon = t('resonancePos');
    sentClass = "pos";
    sentTitle = t('resonancePosDesc');
  } else if (sector.avg_sentiment < -0.15) {
    sentIcon = t('resonanceNeg');
    sentClass = "neg";
    sentTitle = t('resonanceNegDesc');
  }

  const translatedSignal = SIGNAL_MAP[lang]?.[sector.signal] || sector.signal;

  // Count catalysts to show a count pill instead of full lists
  const riskCount = sector.matched_risks?.length || 0;
  const oppCount = sector.matched_opportunities?.length || 0;
  const defCount = sector.matched_defensive?.length || 0;
  const totalCatalysts = riskCount + oppCount + defCount;

  const catalystTooltip = lang === 'zh'
    ? `匹配的催化剂总数: ${totalCatalysts}\n-------------------------\n• 风险因素: ${riskCount}\n• 战术机会: ${oppCount}\n• 防御策略: ${defCount}`
    : `Total Matched Catalysts: ${totalCatalysts}\n-------------------------\n• Risks: ${riskCount}\n• Opportunities: ${oppCount}\n• Defensive: ${defCount}`;

  return (
    <div 
      className={`sector-card ${sector.zone} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      title={getHeatTooltip(sector, lang)}
      style={{ 
        cursor: 'pointer', 
        borderColor: isSelected ? 'var(--cyan)' : 'var(--border)', 
        borderStyle: sector.type === 'theme' ? 'dashed' : 'solid',
        boxShadow: isSelected ? '0 0 15px rgba(99, 179, 237, 0.25)' : '',
        transform: isSelected ? 'translateY(-2px)' : 'none'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="sector-name" style={{ marginRight: '0.4rem' }}>{formatSectorName(sector.name, lang)}</div>
        {totalCatalysts > 0 && (
          <span style={{ 
            fontSize: '0.62rem', 
            padding: '0.05rem 0.3rem', 
            borderRadius: '10px', 
            background: riskCount > 0 ? 'rgba(249, 115, 22, 0.15)' : 'rgba(34, 217, 138, 0.15)',
            color: riskCount > 0 ? 'var(--orange)' : 'var(--green)',
            fontWeight: 700,
            border: '1px solid var(--border-subtle)',
            flexShrink: 0
          }} title={catalystTooltip}>
            {totalCatalysts}
          </span>
        )}
      </div>

      <div className="sector-card-sub">
        <span className={`sector-signal ${sector.zone}`}>{translatedSignal}</span>
        <span className={`sector-sent-badge ${sentClass}`} title={sentTitle}>{sentIcon}</span>
      </div>

      <div className="sector-heat-bar">
        <div
          className={`sector-heat-fill ${sector.zone}`}
          style={{ width: `${sector.heat_score}%` }}
        />
      </div>

      <div className="sector-stats">
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', marginBottom: '0.15rem' }}>{t('avgChg')}</div>
          <div className={`stat-val ${sector.avg_chg >= 0 ? 'pos' : 'neg'}`}>
            {sector.avg_chg >= 0 ? '+' : ''}{sector.avg_chg.toFixed(1)}%
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', marginBottom: '0.15rem' }}>{t('volRatioAvg')}</div>
          <div className="stat-val" style={{ color: sector.avg_vol_ratio >= 1.5 ? 'var(--gold)' : 'var(--text-1)' }}>
            {sector.avg_vol_ratio.toFixed(2)}x
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', marginBottom: '0.15rem' }}>{t('heatScore')}</div>
          <div className="stat-val" style={{ color: 'var(--text-1)' }}>{sector.heat_score}</div>
        </div>
      </div>

      <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--text-2)', display: 'flex', gap: '0.5rem' }}>
        <span style={{ color: 'var(--green)' }}>{t('upCount')} {sector.up_count}</span>
        <span style={{ color: 'var(--red)' }}>{t('downCount')} {sector.down_count}</span>
        <span>/ {sector.up_count + sector.down_count} {t('stocksUnit')}</span>
      </div>
    </div>
  );
}

function SectorDetailPanel({ sector, lang, onClose, maxHeight }) {
  const t = getT(lang);
  const translatedSignal = SIGNAL_MAP[lang]?.[sector.signal] || sector.signal;
  
  return (
    <div className="sector-detail-panel" style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '1.25rem',
      position: 'relative',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      height: '100%',
      minHeight: '500px',
      maxHeight: maxHeight ? `${maxHeight}px` : 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      borderLeft: '4px solid var(--cyan)',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
            {formatSectorName(sector.name, lang)}
          </h3>
          <span className={`sector-signal ${sector.zone}`} style={{ fontSize: '0.75rem', marginTop: '0.2rem', display: 'inline-block', marginBottom: 0 }}>
            {translatedSignal}
          </span>
        </div>
        <button 
          onClick={onClose}
          style={{
            background: 'var(--bg-hover)',
            border: 'none',
            color: 'var(--text-2)',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem'
          }}
          title={lang === 'zh' ? '关闭' : 'Close'}
        >
          ✕
        </button>
      </div>

      {/* Progress Score */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-2)', marginBottom: '0.35rem' }}>
          <span>{t('heatScore')}</span>
          <span className="font-mono" style={{ fontWeight: 700, color: 'var(--text-1)' }}>{sector.heat_score}/100</span>
        </div>
        <div className="sector-heat-bar" style={{ marginBottom: 0 }}>
          <div
            className={`sector-heat-fill ${sector.zone}`}
            style={{ width: `${sector.heat_score}%` }}
          />
        </div>
      </div>

      {/* Detailed Sector Metrics */}
      <div className="sector-detail-stats" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.5rem',
        background: 'var(--bg-card-subtle)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.5rem',
        textAlign: 'center'
      }}>
        <div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-2)', marginBottom: '0.15rem' }}>{t('avgChg')}</div>
          <div className={`stat-val ${sector.avg_chg >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: '0.8rem' }}>
            {sector.avg_chg >= 0 ? '+' : ''}{sector.avg_chg.toFixed(2)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-2)', marginBottom: '0.15rem' }}>{t('volRatioAvg')}</div>
          <div className="stat-val" style={{ fontSize: '0.8rem', color: 'var(--text-1)' }}>
            {sector.avg_vol_ratio.toFixed(2)}x
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-2)', marginBottom: '0.15rem' }}>5D RS</div>
          <div className="stat-val" style={{ fontSize: '0.8rem', color: sector.avg_rs_5d >= 1.0 ? 'var(--green)' : 'var(--text-2)' }}>
            {sector.avg_rs_5d.toFixed(3)}
          </div>
        </div>
      </div>

      {/* Matched Risks & Strategic Recommendations */}
      <div className="sector-detail-recs custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingRight: '0.3rem' }}>
        
        {/* Risks */}
        {sector.matched_risks && sector.matched_risks.length > 0 && (
          <div>
            <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--orange)', borderBottom: '1px solid rgba(249, 115, 22, 0.15)', paddingBottom: '0.2rem', marginBottom: '0.4rem' }}>
              ⚠️ {t('risksSectionTitle')}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {sector.matched_risks.map((risk, idx) => (
                <div key={idx} style={{ background: 'rgba(249, 115, 22, 0.03)', border: '1px solid rgba(249, 115, 22, 0.08)', borderRadius: '4px', padding: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-1)' }}>{translateDynamic(risk.title, lang)}</span>
                    <span className="risk-detail-badge" style={{ fontSize: '0.55rem', padding: '0.05rem 0.2rem', borderRadius: '3px', background: 'rgba(249, 115, 22, 0.12)', color: 'var(--orange)' }}>
                      {translateDynamic(risk.impact, lang)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-2)', lineHeight: 1.3 }}>
                    <strong style={{ color: 'var(--cyan)' }}>{t('mitigationLabel')}:</strong> {translateDynamic(risk.mitigation, lang)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opportunities */}
        {sector.matched_opportunities && sector.matched_opportunities.length > 0 && (
          <div>
            <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--green)', borderBottom: '1px solid rgba(34, 217, 138, 0.15)', paddingBottom: '0.2rem', marginBottom: '0.4rem' }}>
              📈 {t('oppsSectionTitle')}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {sector.matched_opportunities.map((opp, idx) => (
                <div key={idx} style={{ background: 'rgba(34, 217, 138, 0.03)', border: '1px solid rgba(34, 217, 138, 0.08)', borderRadius: '4px', padding: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-1)' }}>{translateDynamic(opp.title, lang)}</span>
                    {opp.timeframe && (
                      <span style={{ fontSize: '0.55rem', padding: '0.05rem 0.2rem', borderRadius: '3px', background: 'rgba(34, 217, 138, 0.08)', color: 'var(--green)' }}>{translateDynamic(opp.timeframe, lang)}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-2)', lineHeight: 1.3 }}>
                    {translateDynamic(opp.description, lang)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Defensive */}
        {sector.matched_defensive && sector.matched_defensive.length > 0 && (
          <div>
            <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--cyan)', borderBottom: '1px solid rgba(99, 179, 237, 0.15)', paddingBottom: '0.2rem', marginBottom: '0.4rem' }}>
              🛡️ {t('defSectionTitle')}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {sector.matched_defensive.map((def, idx) => (
                <div key={idx} style={{ background: 'rgba(99, 179, 237, 0.03)', border: '1px solid rgba(99, 179, 237, 0.08)', borderRadius: '4px', padding: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-1)' }}>{translateDynamic(def.title, lang)}</span>
                    {def.timeframe && (
                      <span style={{ fontSize: '0.55rem', padding: '0.05rem 0.2rem', borderRadius: '3px', background: 'rgba(99, 179, 237, 0.08)', color: 'var(--cyan)' }}>{translateDynamic(def.timeframe, lang)}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-2)', lineHeight: 1.3 }}>
                    {translateDynamic(def.description, lang)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Constituent Stocks */}
        {sector.stocks && sector.stocks.length > 0 && (
          <div>
            <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-1)', borderBottom: '1px solid var(--border)', paddingBottom: '0.2rem', marginBottom: '0.4rem' }}>
              📋 {lang === 'zh' ? '成分股详情' : 'Constituents'}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {sector.stocks.map((stock, idx) => {
                const s_signal = SIGNAL_MAP[lang]?.[stock.signal] || stock.signal;
                return (
                  <div key={idx} style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '80px 60px 70px 1fr', 
                    gap: '0.5rem', 
                    alignItems: 'center', 
                    fontSize: '0.7rem', 
                    padding: '0.25rem 0.4rem', 
                    background: 'var(--bg-row-subtle)', 
                    borderBottom: '1px solid var(--border-row-subtle)' 
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="font-mono" style={{ fontWeight: 600, color: 'var(--cyan)' }}>{stock.symbol}</span>
                      <span style={{ fontSize: '0.58rem', color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {STOCK_NAME_MAP[stock.symbol] || ''}
                      </span>
                    </div>
                    <span style={{ color: 'var(--text-2)', textAlign: 'right' }}>¥{stock.price}</span>
                    <span className={`font-mono ${stock.chg_pct >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 600, textAlign: 'right' }}>
                      {stock.chg_pct >= 0 ? '+' : ''}{stock.chg_pct}%
                    </span>
                    <span style={{ 
                      fontSize: '0.6rem',
                      padding: '0.02rem 0.2rem', 
                      borderRadius: '3px', 
                      background: stock.zone === 'momentum' ? 'var(--green-soft)' : (stock.zone === 'accumulation' ? 'var(--gold-soft)' : 'var(--bg-hover)'),
                      color: stock.zone === 'momentum' ? 'var(--green)' : (stock.zone === 'accumulation' ? 'var(--gold)' : 'var(--text-2)'),
                      justifySelf: 'end',
                      whiteSpace: 'nowrap'
                    }}>
                      {s_signal}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
