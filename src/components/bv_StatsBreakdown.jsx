import React, { useState } from 'react';
import { formatSectorName } from '../utils/translations';

export default function BvStatsBreakdown({
  activeTab,
  lang,
  t,
  periods,
  computedStats,
  computedSectorStats,
  uniqueSectors,
  backtestData,
  portfolioPeriod,
  setPortfolioPeriod,
  returnType,
  attributionResult = null,
  attributionPeriod = '5d',
  setAttributionPeriod = () => {},
}) {
  const [drillMode, setDrillMode] = useState('sector'); // 'date' | 'sector' | 'stock'
  const [methodOpen, setMethodOpen] = useState(false);
  const getReturnClass = (val) => {
    if (val === null || val === undefined) return '';
    return val > 0 ? 'pos' : (val < 0 ? 'neg' : '');
  };

  const formatReturn = (val) => {
    if (val === null || val === undefined) return '-';
    return `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;
  };

  return (
    <div className="module" style={{ height: '100%' }}>
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <div className="section-icon">
          {activeTab === 'stock' ? '📈' : activeTab === 'sector' ? '📂' : activeTab === 'portfolio' ? '💼' : '🔬'}
        </div>
        <div>
          <div className="section-title">
            {activeTab === 'stock' && t('radarAccuracy')}
            {activeTab === 'sector' && (lang === 'zh' ? '核心板块回测胜率' : 'Sector Core Win Rates')}
            {activeTab === 'portfolio' && (lang === 'zh' ? '组合业绩详情' : 'Portfolio Metrics Details')}
            {activeTab === 'attribution' && t('attrDrilldown')}
          </div>
        </div>
      </div>

      {/* ─── Attribution Drilldown Table ──────────────────────────────────── */}
      {activeTab === 'attribution' && (() => {
        if (!attributionResult) {
          return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '0.85rem' }}>
              ⚪ {t('attrNoData')}
            </div>
          );
        }

        // Select data source based on drill mode
        const rows = drillMode === 'date' ? attributionResult.byDate
          : drillMode === 'sector' ? attributionResult.bySector
          : attributionResult.byStock;

        // Summary row from all trades
        const s = attributionResult.summary;

        const fmtR = (v) => {
          if (v === null || v === undefined) return '-';
          const c = v > 0 ? '#22d98a' : v < 0 ? '#ef4444' : 'var(--text-2)';
          return <span style={{ color: c, fontFamily: 'var(--mono)', fontWeight: 700 }}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>;
        };

        const drillBtns = [
          { key: 'sector', label: t('attrBySector') },
          { key: 'date',   label: t('attrByDate') },
          { key: 'stock',  label: t('attrByStock') },
        ];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Drill-mode selector */}
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px', border: '1px solid var(--border)', width: 'fit-content' }}>
              {drillBtns.map(btn => (
                <button key={btn.key} onClick={() => setDrillMode(btn.key)} style={{
                  background: drillMode === btn.key ? 'rgb(139,92,246)' : 'transparent',
                  color: drillMode === btn.key ? 'white' : 'var(--text-2)',
                  border: 'none', padding: '0.2rem 0.65rem',
                  fontSize: '0.7rem', fontWeight: 700, borderRadius: '3px',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="custom-scrollbar" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '320px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'var(--mono)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-3)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {drillMode === 'date' ? (lang === 'zh' ? '日期' : 'Date')
                        : drillMode === 'sector' ? (lang === 'zh' ? '行业' : 'Sector')
                        : (lang === 'zh' ? '个股' : 'Stock')}
                    </th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: 'var(--cyan)', fontWeight: 700 }}>{t('attrMarketBeta')}</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: 'var(--gold)', fontWeight: 700 }}>{t('attrSectorRotation')}</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: 'rgb(167,139,250)', fontWeight: 700 }}>{t('attrStockAlpha')}</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: 'var(--text-2)', fontWeight: 700 }}>{t('attrTotal')}</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', color: 'var(--text-3)', fontWeight: 700 }}>n</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.key} style={{
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                    }}>
                      <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-1)', fontWeight: 600, whiteSpace: 'nowrap', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {drillMode === 'sector' ? formatSectorName(row.label, lang) : row.label}
                      </td>
                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>{fmtR(row.marketBeta)}</td>
                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>{fmtR(row.sectorRotation)}</td>
                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>{fmtR(row.stockAlpha)}</td>
                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>{fmtR(row.total)}</td>
                      <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', color: 'var(--text-3)' }}>{row.n}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '1px solid rgba(255,255,255,0.12)', background: 'rgba(139,92,246,0.06)' }}>
                    <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-2)', fontWeight: 700 }}>{lang === 'zh' ? '均值' : 'Avg'}</td>
                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>{fmtR(s.marketBeta)}</td>
                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>{fmtR(s.sectorRotation)}</td>
                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>{fmtR(s.stockAlpha)}</td>
                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>{fmtR(s.avgTotal)}</td>
                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--text-3)' }}>{s.n}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Timing Premium by Zone */}
            {attributionResult.zoneStats && Object.keys(attributionResult.zoneStats).length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.75rem 1rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-2)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('attrTimingByZone')}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                  {Object.entries(attributionResult.zoneStats).map(([zone, zd]) => (
                    <div key={zone} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', textTransform: 'capitalize', marginBottom: '0.2rem' }}>{zone} (n={zd.n})</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: '0.82rem', fontWeight: 700 }}>
                        {fmtR(zd.timingPremium)}
                      </div>
                      <div style={{ fontSize: '0.58rem', color: 'var(--text-3)' }}>{lang === 'zh' ? 'vs 全局' : 'vs global'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Methodology Note (collapsible) */}
            <div style={{ border: '1px solid rgba(139,92,246,0.2)', borderRadius: '6px', overflow: 'hidden' }}>
              <button
                onClick={() => setMethodOpen(v => !v)}
                style={{
                  width: '100%', textAlign: 'left', background: 'rgba(139,92,246,0.04)',
                  border: 'none', padding: '0.5rem 0.75rem', cursor: 'pointer',
                  color: 'rgb(167,139,250)', fontSize: '0.72rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <span>ℹ️ {t('attrMethodNote')}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.65rem' }}>{methodOpen ? '▲' : '▼'}</span>
              </button>
              {methodOpen && (
                <div style={{ padding: '0.65rem 0.85rem', fontSize: '0.68rem', color: 'var(--text-3)', lineHeight: 1.6, background: 'rgba(0,0,0,0.15)' }}>
                  <div style={{ marginBottom: '0.5rem', fontWeight: 700, color: 'var(--text-1)' }}>
                    {t('attrMethodBody')}
                  </div>
                  {drillMode === 'stock' && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: '0.25rem' }}>
                        {lang === 'zh' ? '💡 如何通过个股拆解区分「实力」与「运气」？' : '💡 How to identify "Skill" vs "Luck" from stock breakdown?'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div>
                          <strong>{lang === 'zh' ? '🟢 实力创造超额（个股 Alpha 驱动）' : '🟢 Skill-driven Outperformance (Stock Alpha)'}:</strong>
                          <br />
                          {lang === 'zh' 
                            ? '即使大盘下跌（市场Beta为负），但由于选股表现亮眼，个股 Alpha 录得大额正数，拉动总收益跑赢。这证明策略的选股实力。'
                            : 'Even when the market falls (negative Beta), Stock Alpha shows a large positive value, lifting total returns. This proves stock selection capability.'}
                        </div>
                        <div>
                          <strong>{lang === 'zh' ? '🔴 躺赢随波逐流（市场/行业 Beta 驱动）' : '🔴 Luck-driven Ride-along (Market/Sector Beta)'}:</strong>
                          <br />
                          {lang === 'zh'
                            ? '个股 Alpha 接近 0 或为负值，但由于大盘暴涨（市场Beta为大正数）或行业普涨（行业轮动为正），导致总收益为正。这主要由市场红利驱动，属运气成分。'
                            : 'Stock Alpha is near 0 or negative, but total return is positive due to index rally (large Beta) or sector tailwinds. This is driven by market trends (luck).'}
                        </div>
                      </div>
                    </div>
                  )}
                  {drillMode === 'sector' && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--gold)', marginBottom: '0.25rem' }}>
                        {lang === 'zh' ? '💡 行业轮动指标说明' : '💡 Sector Rotation Metric Explained'}
                      </div>
                      <div>
                        {lang === 'zh'
                          ? '行业轮动值衡量策略在热点板块切换时的配置效果。若该值显著为正，代表策略擅长在资金流入时准确配资到强势行业，避开低迷行业。'
                          : 'Sector Rotation measures allocation efficiency across hot sectors. A positive value shows the strategy successfully rotates capital into strong sectors and avoids sluggish ones.'}
                      </div>
                    </div>
                  )}
                  {drillMode === 'date' && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--cyan)', marginBottom: '0.25rem' }}>
                        {lang === 'zh' ? '💡 每日归因指标说明' : '💡 Daily Attribution Metric Explained'}
                      </div>
                      <div>
                        {lang === 'zh'
                          ? '按每日时间序列聚合的归因，能清晰反应不同时期的市场主导因素。例如，在大跌日若阿尔法依然稳健，说明策略具有出色的抗风险和选股防御性。'
                          : 'Daily aggregated attribution reflects market drivers across different macro regimes. If Alpha remains steady during market sell-offs, it demonstrates strong defensive stock selection.'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}


      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {activeTab === 'stock' && !computedStats.isBear && (
          <>
            {/* Momentum confirmation */}
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--green)', fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid rgba(34, 217, 138, 0.15)', paddingBottom: '0.3rem' }}>
                🚀 {t('momentumZone')}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                {periods.map(p => {
                  const data = computedStats.by_zone['momentum']?.[p] || { win_rate: 0, avg_return: 0 };
                  return (
                    <div key={p}>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-2)', textTransform: 'uppercase' }}>{p}</div>
                      <div className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0.15rem 0' }}>{data.win_rate}%</div>
                      <div className={`font-mono ${getReturnClass(data.avg_return)}`} style={{ fontSize: '0.7rem' }}>{formatReturn(data.avg_return)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Capital Accumulation */}
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--gold)', fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid rgba(246, 201, 14, 0.15)', paddingBottom: '0.3rem' }}>
                ◉ {t('accumZone')}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                {periods.map(p => {
                  const data = computedStats.by_zone['accumulation']?.[p] || { win_rate: 0, avg_return: 0 };
                  return (
                    <div key={p}>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-2)', textTransform: 'uppercase' }}>{p}</div>
                      <div className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0.15rem 0' }}>{data.win_rate}%</div>
                      <div className={`font-mono ${getReturnClass(data.avg_return)}`} style={{ fontSize: '0.7rem' }}>{formatReturn(data.avg_return)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Bear Mode Zone Breakdown */}
        {activeTab === 'stock' && computedStats.isBear && (
          <>
            {/* Distribution Zone */}
            <div style={{ background: 'rgba(231,76,60,0.03)', border: '1px solid rgba(231,76,60,0.15)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--red, #e74c3c)', fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid rgba(231,76,60,0.2)', paddingBottom: '0.3rem' }}>
                ⚠️ {t('distributionZone')}
                <span style={{ fontSize: '0.68rem', fontWeight: 400, marginLeft: '0.5rem', color: 'var(--text-3)' }}>
                  {lang === 'zh' ? '（空方胜率：股价实际下跌=胜）' : '(Bear Win Rate: price fell = correct)'}
                </span>
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                {periods.map(p => {
                  const data = computedStats.by_zone['distribution']?.[p] || { win_rate: 0, avg_return: 0, sample_size: 0 };
                  return (
                    <div key={p}>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-2)', textTransform: 'uppercase' }}>{p}</div>
                      <div className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0.15rem 0', color: data.win_rate >= 50 ? 'var(--red, #e74c3c)' : 'var(--text-1)' }}>{data.win_rate}%</div>
                      <div className={`font-mono ${getReturnClass(data.avg_return)}`} style={{ fontSize: '0.7rem' }}>{formatReturn(data.avg_return)}</div>
                      <div style={{ fontSize: '0.58rem', color: 'var(--text-3)' }}>n={data.sample_size}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Distribution Lite Zone */}
            <div style={{ background: 'rgba(230,126,34,0.03)', border: '1px solid rgba(230,126,34,0.15)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--orange, #e67e22)', fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid rgba(230,126,34,0.2)', paddingBottom: '0.3rem' }}>
                🔶 {t('distributionLiteZone')}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                {periods.map(p => {
                  const data = computedStats.by_zone['distribution_lite']?.[p] || { win_rate: 0, avg_return: 0, sample_size: 0 };
                  return (
                    <div key={p}>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-2)', textTransform: 'uppercase' }}>{p}</div>
                      <div className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0.15rem 0', color: data.win_rate >= 50 ? 'var(--orange, #e67e22)' : 'var(--text-1)' }}>{data.win_rate}%</div>
                      <div className={`font-mono ${getReturnClass(data.avg_return)}`} style={{ fontSize: '0.7rem' }}>{formatReturn(data.avg_return)}</div>
                      <div style={{ fontSize: '0.58rem', color: 'var(--text-3)' }}>n={data.sample_size}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {activeTab === 'sector' && (
          // Sector core list breakdown
          <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {uniqueSectors.map(sec => {
              const secOverall = computedSectorStats.by_sector[sec];
              const d_10d = secOverall?.['10d'] || { win_rate: 0, avg_return: 0 };
              const d_5d = secOverall?.['5d'] || { win_rate: 0, avg_return: 0 };
              
              return (
                <div key={sec} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.6rem 0.8rem', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-1)' }}>{formatSectorName(sec, lang)}</div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', fontFamily: 'var(--mono)' }}>
                    <div>
                      <span style={{ color: 'var(--text-3)', marginRight: '0.25rem' }}>5D WR:</span>
                      <span style={{ fontWeight: 700, color: d_5d.win_rate >= 50 ? 'var(--green)' : 'var(--text-2)' }}>{d_5d.win_rate}%</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-3)', marginRight: '0.25rem' }}>10D Ret:</span>
                      <span className={getReturnClass(d_10d.avg_return)} style={{ fontWeight: 700 }}>{formatReturn(d_10d.avg_return)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--cyan)' }}>
                {lang === 'zh' ? '持仓周期选择:' : 'Holding Period:'}
              </label>
              <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                {periods.map(p => (
                  <button
                    key={p}
                    onClick={() => setPortfolioPeriod(p)}
                    style={{
                      background: portfolioPeriod === p ? 'var(--cyan)' : 'transparent',
                      color: portfolioPeriod === p ? 'black' : 'var(--text-2)',
                      border: 'none',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Show detailed metrics */}
            {(() => {
              const pStats = backtestData.portfolio_stats?.[portfolioPeriod] || {};
              const isExec = returnType === 'executable';
              
              const winRateVal = isExec ? pStats.win_rate_executable : pStats.win_rate;
              const avgRetVal = isExec ? pStats.avg_return_executable : pStats.avg_return;
              const avgAlphaVal = isExec ? pStats.avg_alpha_executable : pStats.avg_alpha;
              const maxDdVal = isExec ? pStats.max_drawdown_executable : pStats.max_drawdown;
              
              const avgRetGross = isExec ? pStats.avg_return_executable_gross : pStats.avg_return_gross;
              const avgAlphaGross = isExec ? pStats.avg_alpha_executable_gross : pStats.avg_alpha_gross;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.6rem 0.8rem', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{lang === 'zh' ? '等权组合胜率' : 'Portfolio Win Rate'}</span>
                    <span className="font-mono" style={{ fontWeight: 700, color: (winRateVal || 0) >= 50 ? 'var(--green)' : 'var(--text-1)', fontSize: '0.85rem' }}>{(winRateVal || 0).toFixed(2)}%</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.6rem 0.8rem', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{lang === 'zh' ? '平均净收益 (已扣费)' : 'Avg Net Return'}</span>
                    <span className={`font-mono ${getReturnClass(avgRetVal)}`} style={{ fontWeight: 700, fontSize: '0.85rem' }}>{formatReturn(avgRetVal)}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.6rem 0.8rem', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{lang === 'zh' ? '平均毛收益' : 'Avg Gross Return'}</span>
                    <span className={`font-mono ${getReturnClass(avgRetGross)}`} style={{ fontWeight: 700, fontSize: '0.85rem' }}>{formatReturn(avgRetGross)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.6rem 0.8rem', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{lang === 'zh' ? '平均行业 Alpha (已扣费)' : 'Avg Sector Alpha'}</span>
                    <span className={`font-mono ${getReturnClass(avgAlphaVal)}`} style={{ fontWeight: 700, fontSize: '0.85rem' }}>{formatReturn(avgAlphaVal)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.6rem 0.8rem', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>{lang === 'zh' ? '组合最大回撤' : 'Portfolio Max Drawdown'}</span>
                    <span className="font-mono" style={{ fontWeight: 700, color: 'var(--red)', fontSize: '0.85rem' }}>{(maxDdVal || 0).toFixed(2)}%</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
