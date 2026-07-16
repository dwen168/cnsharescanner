import React, { useState } from 'react';
import { getT, formatSectorName } from '../utils/translations';

export default function SectorTrendChart({ trends, lang }) {
  if (!trends || !trends.dates || !trends.series) return null;

  const t = getT(lang);
  const { dates, series } = trends;
  const [activeSeries, setActiveSeries] = React.useState(() => {
    const keys = {};
    series.forEach(s => {
      keys[s.name] = true;
    });
    return keys;
  });

  const [hoverIndex, setHoverIndex] = useState(null);

  const toggleSeries = (name) => {
    setActiveSeries(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const width = 1000;
  const height = 340;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };

  const activeLines = series.filter(s => activeSeries[s.name]);
  let minY = 95;
  let maxY = 105;

  if (activeLines.length > 0) {
    const allValues = activeLines.flatMap(s => s.data);
    minY = Math.min(...allValues) - 1.0;
    maxY = Math.max(...allValues) + 1.0;
  }

  const getSvgPath = (data) => {
    return data.map((val, idx) => {
      const x = padding.left + (idx / (dates.length - 1)) * (width - padding.left - padding.right);
      const y = padding.top + (1 - (val - minY) / (maxY - minY)) * (height - padding.top - padding.bottom);
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  const getSeriesStyle = (s) => {
    if (s.is_benchmark) return { stroke: '#94a3b8', strokeDasharray: '5,5', strokeWidth: 2, glow: 'rgba(148, 163, 184, 0.2)' };
    
    const colors = [
      '#22d98a',
      '#f97316',
      '#63b3ed',
      '#f6c90e',
      '#a855f7',
      '#ec4899',
      '#3b82f6',
      '#14b8a6'
    ];
    
    let hash = 0;
    for (let i = 0; i < s.name.length; i++) {
      hash = s.name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = colors[Math.abs(hash) % colors.length];
    return { stroke: color, strokeDasharray: 'none', strokeWidth: 2.5, glow: color };
  };

  const gridCount = 5;
  const gridLines = Array.from({ length: gridCount }).map((_, i) => {
    const yVal = minY + (i / (gridCount - 1)) * (maxY - minY);
    const y = padding.top + (1 - (yVal - minY) / (maxY - minY)) * (height - padding.top - padding.bottom);
    return { y, label: `${yVal.toFixed(1)}%` };
  });

  const handleMouseMove = (e) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;
    const chartWidth = width - padding.left - padding.right;
    const ratio = (mouseX - padding.left) / chartWidth;
    let idx = Math.round(ratio * (dates.length - 1));
    idx = Math.max(0, Math.min(dates.length - 1, idx));
    setHoverIndex(idx);
  };

  const activeHoverData = hoverIndex !== null ? {
    date: dates[hoverIndex],
    items: series
      .filter(s => activeSeries[s.name])
      .map(s => ({
        name: s.name,
        val: s.data[hoverIndex],
        style: getSeriesStyle(s)
      }))
      .sort((a, b) => b.val - a.val)
  } : null;

  return (
    <section className="module">
      <div className="section-header">
        <div className="section-icon icon-heatmap" style={{ background: 'rgba(99, 179, 237, 0.12)', borderColor: 'rgba(99, 179, 237, 0.2)' }}>📈</div>
        <div>
          <div className="section-title">{t('trendTitle')}</div>
          <div className="section-desc">{t('trendDesc')}</div>
        </div>
      </div>

      <div className="trend-container">
        {/* Legends Toggles */}
        <div className="trend-legends">
          {series.map(s => {
            const style = getSeriesStyle(s);
            const active = activeSeries[s.name];
            return (
              <button
                key={s.name}
                className={`legend-btn ${active ? 'active' : ''}`}
                onClick={() => toggleSeries(s.name)}
                style={{
                  '--legend-color': style.stroke,
                  borderColor: active ? style.stroke : 'var(--border)'
                }}
              >
                <span className="legend-dot" style={{ backgroundColor: style.stroke }} />
                <span className="legend-name">{formatSectorName(s.name, lang)}</span>
              </button>
            );
          })}
        </div>

        <div className="trend-chart-wrapper">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="trend-svg"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverIndex(null)}
          >
            {/* Defs for gradients/shadows */}
            <defs>
              {series.map(s => {
                const style = getSeriesStyle(s);
                return (
                  <filter key={`glow-${s.name}`} id={`filter-glow-${s.name.replace(/\s+/g, '-')}`} x="-10%" y="-10%" width="120%" height="120%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                );
              })}
            </defs>

            {/* Grid Lines */}
            {gridLines.map((line, i) => (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={line.y}
                  x2={width - padding.right}
                  y2={line.y}
                  stroke="var(--border)"
                  strokeWidth="0.8"
                />
                <text
                  x={padding.left - 10}
                  y={line.y + 4}
                  fill="var(--text-2)"
                  fontSize="11"
                  textAnchor="end"
                  fontFamily="var(--mono)"
                >
                  {line.label}
                </text>
              </g>
            ))}

            {/* Dates (X Axis) */}
            {dates.map((date, idx) => {
              if (idx % 6 !== 0 && idx !== dates.length - 1) return null;
              const x = padding.left + (idx / (dates.length - 1)) * (width - padding.left - padding.right);
              return (
                <text
                  key={idx}
                  x={x}
                  y={height - 10}
                  fill="var(--text-2)"
                  fontSize="11"
                  textAnchor="middle"
                  fontFamily="var(--mono)"
                >
                  {date.substring(5)}
                </text>
              );
            })}

            {/* Draw Trend Lines */}
            {series.map(s => {
              if (!activeSeries[s.name]) return null;
              const style = getSeriesStyle(s);
              return (
                <path
                  key={s.name}
                  d={getSvgPath(s.data)}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth={style.strokeWidth}
                  strokeDasharray={style.strokeDasharray}
                  style={{ filter: s.is_benchmark ? 'none' : `url(#filter-glow-${s.name.replace(/\s+/g, '-')})` }}
                />
              );
            })}

            {/* Hover Crosshair */}
            {hoverIndex !== null && (
              <g>
                <line
                  x1={padding.left + (hoverIndex / (dates.length - 1)) * (width - padding.left - padding.right)}
                  y1={padding.top}
                  x2={padding.left + (hoverIndex / (dates.length - 1)) * (width - padding.left - padding.right)}
                  y2={height - padding.bottom}
                  stroke="rgba(99, 179, 237, 0.4)"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                />
                {/* Dots on line intersections */}
                {series.map(s => {
                  if (!activeSeries[s.name]) return null;
                  const style = getSeriesStyle(s);
                  const val = s.data[hoverIndex];
                  const x = padding.left + (hoverIndex / (dates.length - 1)) * (width - padding.left - padding.right);
                  const y = padding.top + (1 - (val - minY) / (maxY - minY)) * (height - padding.top - padding.bottom);
                  return (
                    <circle
                      key={s.name}
                      cx={x}
                      cy={y}
                      r="5"
                      fill="var(--bg)"
                      stroke={style.stroke}
                      strokeWidth="2.5"
                    />
                  );
                })}
              </g>
            )}
          </svg>

          {/* Tooltip Overlay */}
          {activeHoverData && (
            <div
              className="trend-tooltip"
              style={{
                left: `${(hoverIndex / (dates.length - 1)) * 80 + 10}%`
              }}
            >
              <div className="tooltip-date">{activeHoverData.date}</div>
              <div className="tooltip-items">
                {activeHoverData.items.map(item => (
                  <div key={item.name} className="tooltip-row">
                    <span className="tooltip-dot" style={{ backgroundColor: item.style.stroke }} />
                    <span className="tooltip-name">{formatSectorName(item.name, lang)}</span>
                    <span className="tooltip-val" style={{ color: item.val >= 100.0 ? 'var(--green)' : 'var(--red)' }}>
                      {item.val >= 100.0 ? '+' : ''}{(item.val - 100.0).toFixed(2)}%
                    </span>
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
