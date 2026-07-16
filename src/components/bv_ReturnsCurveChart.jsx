import React from 'react';

export default function BvReturnsCurveChart({
  activeTab,
  lang,
  portfolioPeriod,
  periods,
  computedStats,
  computedSectorStats,
  backtestData
}) {
  const chartWidth = 600;
  const chartHeight = 220;
  const chartPadding = { top: 20, right: 30, bottom: 30, left: 50 };

  const getPortfolioMinMax = (curveList) => {
    if (!curveList || curveList.length === 0) return { min: 90, max: 110 };
    const allVals = curveList.flatMap(item => [
      item.equity_theoretical || 100.0,
      item.equity_executable || 100.0,
      item.equity_benchmark || 100.0
    ]);
    const min = Math.min(...allVals, 98.0) - 2.0;
    const max = Math.max(...allVals, 102.0) + 2.0;
    return { min, max };
  };

  const getChartPoints = (dataDict) => {
    if (!dataDict) return '';
    const vals = periods.map(p => dataDict[p]?.avg_return || 0.0);
    const minVal = Math.min(...vals, 0.0) - 1.0;
    const maxVal = Math.max(...vals, 0.0) + 1.0;
    const range = maxVal - minVal || 1.0;

    return vals.map((val, idx) => {
      const x = chartPadding.left + (idx / (periods.length - 1)) * (chartWidth - chartPadding.left - chartPadding.right);
      const y = chartPadding.top + (1 - (val - minVal) / range) * (chartHeight - chartPadding.top - chartPadding.bottom);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  };

  return (
    <div className="module" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <div className="section-icon">📊</div>
        <div>
          <div className="section-title">
            {activeTab === 'portfolio' 
              ? (lang === 'zh' ? '等权组合复利净值走势曲线' : 'Portfolio Compounded Equity Curve') 
              : (lang === 'zh' ? '平均持仓收益曲线' : 'Average Holding Period Returns')}
          </div>
        </div>
      </div>
      
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {activeTab === 'portfolio' ? (
          (() => {
            const curveList = backtestData.portfolio_equity_curves?.[portfolioPeriod] || [];
            const { min, max } = getPortfolioMinMax(curveList);
            const range = max - min;
            
            const getCoords = (key) => {
              if (!curveList || curveList.length === 0) return '';
              return curveList.map((item, idx) => {
                const val = item[key] || 100.0;
                const x = chartPadding.left + (idx / (curveList.length - 1)) * (chartWidth - chartPadding.left - chartPadding.right);
                const y = chartPadding.top + (1 - (val - min) / range) * (chartHeight - chartPadding.top - chartPadding.bottom);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              }).join(' ');
            };

            return (
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 'auto', background: 'var(--chart-bg)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                {(() => {
                  const labelsCount = 4;
                  const gridlines = [];
                  for (let i = 0; i <= labelsCount; i++) {
                    const val = min + (i / labelsCount) * range;
                    const y = chartPadding.top + (1 - (val - min) / range) * (chartHeight - chartPadding.top - chartPadding.bottom);
                    gridlines.push(
                      <g key={i}>
                        <line 
                          x1={chartPadding.left} 
                          y1={y} 
                          x2={chartWidth - chartPadding.right} 
                          y2={y} 
                          stroke="var(--chart-grid)" 
                          strokeDasharray="3,3" 
                        />
                        <text 
                          x={chartPadding.left - 8} 
                          y={y + 3} 
                          fill="var(--text-3)" 
                          fontSize="8" 
                          textAnchor="end" 
                          fontFamily="var(--mono)"
                        >
                          {val.toFixed(1)}
                        </text>
                      </g>
                    );
                  }
                  return gridlines;
                })()}
                
                <line x1={chartPadding.left} y1={chartPadding.top} x2={chartPadding.left} y2={chartHeight - chartPadding.bottom} stroke="var(--border)" />
                <line x1={chartPadding.left} y1={chartHeight - chartPadding.bottom} x2={chartWidth - chartPadding.right} y2={chartHeight - chartPadding.bottom} stroke="var(--border)" />

                {curveList.length > 0 && (
                  <>
                    <polyline
                      fill="none"
                      stroke="var(--green)"
                      strokeWidth="1.5"
                      strokeDasharray="3,3"
                      points={getCoords('equity_theoretical')}
                    />
                    <polyline
                      fill="none"
                      stroke="var(--cyan)"
                      strokeWidth="2.5"
                      points={getCoords('equity_executable')}
                      style={{ filter: 'drop-shadow(0 0 4px rgba(2, 239, 239, 0.3))' }}
                    />
                    <polyline
                      fill="none"
                      stroke="var(--gold)"
                      strokeWidth="1.5"
                      points={getCoords('equity_benchmark')}
                    />
                  </>
                )}

                {(() => {
                  if (curveList.length === 0) return null;
                  const labelsCount = 4;
                  const step = Math.max(1, Math.floor(curveList.length / labelsCount));
                  const labels = [];
                  for (let i = 0; i < curveList.length; i += step) {
                    const item = curveList[i];
                    const x = chartPadding.left + (i / (curveList.length - 1)) * (chartWidth - chartPadding.left - chartPadding.right);
                    labels.push(
                      <text 
                        key={i} 
                        x={x} 
                        y={chartHeight - 10} 
                        fill="var(--text-3)" 
                        fontSize="8" 
                        textAnchor="middle" 
                        fontFamily="var(--mono)"
                      >
                        {item.date.substring(5)}
                      </text>
                    );
                  }
                  const lastIdx = curveList.length - 1;
                  if (lastIdx % step !== 0) {
                    const item = curveList[lastIdx];
                    const x = chartPadding.left + (chartWidth - chartPadding.left - chartPadding.right);
                    labels.push(
                      <text 
                        key={lastIdx} 
                        x={x} 
                        y={chartHeight - 10} 
                        fill="var(--text-3)" 
                        fontSize="8" 
                        textAnchor="middle" 
                        fontFamily="var(--mono)"
                      >
                        {item.date.substring(5)}
                      </text>
                    );
                  }
                  return labels;
                })()}
              </svg>
            );
          })()
        ) : (
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 'auto', background: 'var(--chart-bg)', borderRadius: '4px', border: '1px solid var(--border)' }}>
            <line x1={chartPadding.left} y1={chartHeight / 2} x2={chartWidth - chartPadding.right} y2={chartHeight / 2} stroke="var(--chart-grid)" strokeDasharray="3,3" />
            <line x1={chartPadding.left} y1={chartPadding.top} x2={chartPadding.left} y2={chartHeight - chartPadding.bottom} stroke="var(--border)" />
            <line x1={chartPadding.left} y1={chartHeight - chartPadding.bottom} x2={chartWidth - chartPadding.right} y2={chartHeight - chartPadding.bottom} stroke="var(--border)" />

            {activeTab === 'stock' ? (
              <>
                {computedStats.by_zone['momentum'] && (
                  <polyline
                    fill="none"
                    stroke="var(--green)"
                    strokeWidth="3"
                    points={getChartPoints(computedStats.by_zone['momentum'])}
                    style={{ filter: 'drop-shadow(0 0 5px rgba(34, 217, 138, 0.4))' }}
                  />
                )}
                {computedStats.by_zone['accumulation'] && (
                  <polyline
                    fill="none"
                    stroke="var(--gold)"
                    strokeWidth="3"
                    points={getChartPoints(computedStats.by_zone['accumulation'])}
                    style={{ filter: 'drop-shadow(0 0 5px rgba(246, 201, 14, 0.4))' }}
                  />
                )}
              </>
            ) : (
              <polyline
                fill="none"
                stroke="var(--cyan)"
                strokeWidth="3"
                points={getChartPoints(computedSectorStats.overall)}
                style={{ filter: 'drop-shadow(0 0 5px rgba(2, 239, 239, 0.4))' }}
              />
            )}

            {periods.map((p, idx) => {
              const x = chartPadding.left + (idx / (periods.length - 1)) * (chartWidth - chartPadding.left - chartPadding.right);
              return (
                <g key={p}>
                  <text x={x} y={chartHeight - 10} fill="var(--text-3)" fontSize="10" textAnchor="middle" fontFamily="var(--mono)">{p.toUpperCase()}</text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
      
      <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.75rem', fontSize: '0.75rem' }}>
        {activeTab === 'portfolio' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: 'var(--cyan)', borderRadius: '50%' }} />
              <span style={{ color: 'var(--text-2)' }}>{lang === 'zh' ? '组合可执行净值' : 'Portfolio Executable Net'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', border: '1px dashed var(--green)', backgroundColor: 'transparent', borderRadius: '50%' }} />
              <span style={{ color: 'var(--text-2)' }}>{lang === 'zh' ? '组合理论净值' : 'Portfolio Theoretical Net'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: 'var(--gold)', borderRadius: '50%' }} />
              <span style={{ color: 'var(--text-2)' }}>{lang === 'zh' ? '行业基准指数' : 'Sector Benchmark Index'}</span>
            </div>
          </>
        ) : activeTab === 'stock' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: 'var(--green)', borderRadius: '50%' }} />
              <span style={{ color: 'var(--text-2)' }}>{lang === 'zh' ? '确认主升浪区间' : 'Momentum Zone'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: 'var(--gold)', borderRadius: '50%' }} />
              <span style={{ color: 'var(--text-2)' }}>{lang === 'zh' ? '资金建仓区间' : 'Accumulation Zone'}</span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: 'var(--cyan)', borderRadius: '50%' }} />
            <span style={{ color: 'var(--text-2)' }}>{lang === 'zh' ? '筛选板块综合平均收益' : 'Selected Sector Avg Return'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
