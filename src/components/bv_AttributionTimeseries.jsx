import React, { useState } from 'react';

/**
 * bv_AttributionTimeseries.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Sector Return Decomposition Bar Chart
 * 
 * Replaces the noisy daily return timeseries curves. Shows a grouped bar chart
 * comparing Sector Index Return, Sector Premium, and Stock Selection Alpha
 * side-by-side for each industry sector, with a diamond marker for total return.
 */
export default function BvAttributionTimeseries({ attributionResult, lang, t, period }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const W = 640;
  const H = 265;
  const PAD = { top: 35, right: 30, bottom: 50, left: 52 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  if (!attributionResult || !attributionResult.bySector || attributionResult.bySector.length === 0) {
    return (
      <div className="module" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-3)' }}>
        <div style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>📊</div>
        <div>{t('attrNoData') || (lang === 'zh' ? '暂无行业归因数据' : 'No sector attribution data available')}</div>
      </div>
    );
  }

  // Get sectors sorted by signal count, take top 6 to prevent overcrowding
  const allSectors = attributionResult.bySector;
  const sectors = allSectors.slice(0, 6);
  const numSectors = sectors.length;

  // Find min and max for scaling
  const allVals = sectors.flatMap(s => [
    s.marketBeta,
    s.sectorRotation,
    s.stockAlpha,
    s.total,
    0
  ]);
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const pad = Math.max(Math.abs(rawMax - rawMin) * 0.15, 0.5);
  const yMin = Math.min(rawMin, 0) - pad;
  const yMax = Math.max(rawMax, 0) + pad;
  const yRange = yMax - yMin || 1;

  const yOf = (v) => PAD.top + (1 - (v - yMin) / yRange) * plotH;
  const yZero = yOf(0);

  // Helper to format values
  const fmtV = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

  // Helper to translate sector names if available
  const getSectorLabel = (label) => {
    if (t && t(label) && t(label) !== label) return t(label);
    return label;
  };

  // Generate gridlines
  const gridCount = 5;
  const gridlines = [];
  for (let i = 0; i <= gridCount; i++) {
    const v = yMin + (i / gridCount) * yRange;
    const y = yOf(v);
    gridlines.push({ v, y });
  }

  const activeSector = hoveredIdx !== null ? sectors[hoveredIdx] : null;

  return (
    <div className="module" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Title block */}
      <div className="section-header" style={{ marginBottom: '0' }}>
        <div className="section-icon">📊</div>
        <div>
          <div className="section-title">
            {lang === 'zh' ? '行业收益归因诊断 (按入场板块拆解)' : 'Sector Return Decomposition (Attribution by Entry Sector)'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.15rem' }}>
            {lang === 'zh'
              ? `分析在每个行业触发的交易中：大盘行业波动 vs 板块共振配置 vs 纯个股选股 Alpha 的均值贡献`
              : `Mean attribution contributions (Sector Index vs Sector Premium vs Stock Alpha) for trade signals in each sector`}
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', background: 'var(--chart-bg)', borderRadius: '6px', border: '1px solid var(--border)' }}
        >
          {/* Gridlines */}
          {gridlines.map(({ v, y }, i) => (
            <g key={i}>
              <line
                x1={PAD.left} y1={y}
                x2={W - PAD.right} y2={y}
                stroke={Math.abs(v) < 0.001 ? "rgba(255,255,255,0.25)" : "var(--chart-grid)"}
                strokeDasharray={Math.abs(v) < 0.001 ? "" : "3,3"}
                strokeWidth={Math.abs(v) < 0.001 ? "1" : "0.8"}
              />
              <text
                x={PAD.left - 6} y={y + 3.5}
                fill="var(--text-3)" fontSize="8"
                textAnchor="end" fontFamily="var(--mono)"
              >
                {fmtV(v)}
              </text>
            </g>
          ))}

          {/* Axes */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="var(--border)" strokeWidth="1" />
          <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="var(--border)" strokeWidth="1" />

          {/* Vertical axis ticks */}
          {gridlines.map(({ y }) => (
            <line key={`tick-y-${y}`} x1={PAD.left - 3} y1={y} x2={PAD.left} y2={y} stroke="var(--border)" strokeWidth="1" />
          ))}

          {/* Draw Bar Groups */}
          {sectors.map((s, idx) => {
            const groupCenterX = PAD.left + (idx + 0.5) * (plotW / numSectors);
            const isHovered = hoveredIdx === idx;

            // X-coordinates for the 3 bars
            const barW = 12;
            const x1 = groupCenterX - 20; // Sector Index
            const x2 = groupCenterX - 6;  // Sector Premium
            const x3 = groupCenterX + 8;  // Stock Selection Alpha

            // Y-coordinates & Heights
            const y1 = yOf(Math.max(0, s.marketBeta));
            const h1 = Math.max(Math.abs(yOf(s.marketBeta) - yZero), 0.5);

            const y2 = yOf(Math.max(0, s.sectorRotation));
            const h2 = Math.max(Math.abs(yOf(s.sectorRotation) - yZero), 0.5);

            const y3 = yOf(Math.max(0, s.stockAlpha));
            const h3 = Math.max(Math.abs(yOf(s.stockAlpha) - yZero), 0.5);

            // Total return point
            const yTotal = yOf(s.total);

            return (
              <g
                key={s.key}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Invisible hover area backing */}
                <rect
                  x={groupCenterX - (plotW / numSectors) / 2 + 1}
                  y={PAD.top}
                  width={(plotW / numSectors) - 2}
                  height={plotH}
                  fill={isHovered ? "rgba(255, 255, 255, 0.03)" : "transparent"}
                  rx="4"
                  style={{ transition: 'fill 0.15s ease' }}
                />

                {/* Bar 1: Sector Index */}
                <rect
                  x={x1}
                  y={y1}
                  width={barW}
                  height={h1}
                  fill="var(--cyan)"
                  opacity={isHovered ? "1.0" : hoveredIdx !== null ? "0.4" : "0.85"}
                  rx="2"
                />

                {/* Bar 2: Sector Premium */}
                <rect
                  x={x2}
                  y={y2}
                  width={barW}
                  height={h2}
                  fill="var(--gold)"
                  opacity={isHovered ? "1.0" : hoveredIdx !== null ? "0.4" : "0.85"}
                  rx="2"
                />

                {/* Bar 3: Stock Selection Alpha */}
                <rect
                  x={x3}
                  y={y3}
                  width={barW}
                  height={h3}
                  fill="rgb(167, 139, 250)"
                  opacity={isHovered ? "1.0" : hoveredIdx !== null ? "0.4" : "0.85"}
                  rx="2"
                />

                {/* Total return marker (White Diamond) */}
                <polygon
                  points={`${groupCenterX},${yTotal - 5} ${groupCenterX + 5},${yTotal} ${groupCenterX},${yTotal + 5} ${groupCenterX - 5},${yTotal}`}
                  fill="#ffffff"
                  stroke="var(--bg-main)"
                  strokeWidth="1.2"
                  opacity={isHovered ? "1.0" : hoveredIdx !== null ? "0.4" : "0.9"}
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
                />

                {/* X-axis tick */}
                <line
                  x1={groupCenterX} y1={H - PAD.bottom}
                  x2={groupCenterX} y2={H - PAD.bottom + 4}
                  stroke="var(--border)"
                  strokeWidth="1"
                />

                {/* X-axis Sector Label */}
                <text
                  x={groupCenterX}
                  y={H - PAD.bottom + 14}
                  fill={isHovered ? "var(--purple-light)" : "var(--text-2)"}
                  fontSize="8.5"
                  fontWeight={isHovered ? "700" : "500"}
                  textAnchor="middle"
                >
                  {getSectorLabel(s.label)}
                </text>

                {/* Trade count text */}
                <text
                  x={groupCenterX}
                  y={H - PAD.bottom + 25}
                  fill="var(--text-3)"
                  fontSize="7.5"
                  textAnchor="middle"
                  fontFamily="var(--mono)"
                >
                  {`n=${s.n}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend Block */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', justifyContent: 'center', fontSize: '0.72rem', marginTop: '0.15rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <div style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: 'var(--cyan)', borderRadius: '2px' }} />
          <span style={{ color: 'var(--text-2)' }}>{lang === 'zh' ? '行业基准收益' : 'Sector Index Return'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <div style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: 'var(--gold)', borderRadius: '2px' }} />
          <span style={{ color: 'var(--text-2)' }}>{lang === 'zh' ? '板块超额溢价' : 'Sector Premium'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <div style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: 'rgb(167, 139, 250)', borderRadius: '2px' }} />
          <span style={{ color: 'var(--text-2)' }}>{lang === 'zh' ? '纯选股 Alpha' : 'Stock Selection Alpha'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <svg width="12" height="12" viewBox="0 0 10 10" style={{ display: 'inline-block' }}>
            <polygon points="5,1 9,5 5,9 1,5" fill="#ffffff" stroke="var(--border)" strokeWidth="0.8" />
          </svg>
          <span style={{ color: 'var(--text-2)' }}>{lang === 'zh' ? '个股平均总收益' : 'Stock Average Return'}</span>
        </div>
      </div>

      {/* Dynamic Detail Panel */}
      <div style={{
        fontSize: '0.72rem', color: 'var(--text-2)', lineHeight: 1.5,
        background: 'rgba(139,92,246,0.04)',
        border: '1px solid rgba(139,92,246,0.15)',
        borderRadius: '6px', padding: '0.65rem 0.85rem',
        minHeight: '48px', display: 'flex', alignItems: 'center'
      }}>
        {activeSector ? (
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.2rem', marginBottom: '0.2rem' }}>
              <span style={{ fontWeight: '700', color: 'var(--purple-light)' }}>
                🔍 {getSectorLabel(activeSector.label)} ({lang === 'zh' ? `共 ${activeSector.n} 笔信号` : `${activeSector.n} signals`})
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: '700' }}>
                {lang === 'zh' ? '平均总收益: ' : 'Average Total Return: '}
                <span style={{ color: activeSector.total >= 0 ? 'var(--green-light)' : 'var(--red-light)' }}>{fmtV(activeSector.total)}</span>
              </span>
            </div>
            <div style={{ display: 'flex', gap: '1rem', fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--text-3)', flexWrap: 'wrap' }}>
              <span>{lang === 'zh' ? '行业基准: ' : 'Sector Index: '}<span style={{ color: 'var(--cyan)' }}>{fmtV(activeSector.marketBeta)}</span></span>
              <span>{lang === 'zh' ? '板块溢价: ' : 'Sector Premium: '}<span style={{ color: 'var(--gold)' }}>{fmtV(activeSector.sectorRotation)}</span></span>
              <span>{lang === 'zh' ? '选股超额: ' : 'Selection Alpha: '}<span style={{ color: 'rgb(167, 139, 250)' }}>{fmtV(activeSector.stockAlpha)}</span></span>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-3)' }}>
            {lang === 'zh'
              ? '💡 提示：鼠标悬停在各板块柱状组上，可查看该板块详细的平均收益拆解诊断数据。'
              : '💡 Tip: Hover over any sector group to view the detailed diagnostic breakdown of average returns.'}
          </div>
        )}
      </div>
    </div>
  );
}
