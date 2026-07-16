import React, { useState, useMemo } from 'react';
import { getT, translateInsight, STOCK_NAME_MAP } from '../utils/translations';

export default function AiInsights({ stocks, lang }) {
  const t = getT(lang);
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all' | 'momentum' | 'accumulation' | 'distribution' | 'distribution_lite' | 'watch'

  // 1. 提取所有有信号的个股 (多空异动)
  const allNotables = useMemo(() => {
    return stocks.filter(s => s.zone !== 'neutral' || (s.bear_zone && s.bear_zone !== 'neutral'));
  }, [stocks]);

  // 2. 统计各个分类数量
  const stats = useMemo(() => {
    const counts = {
      momentum: 0,
      accumulation: 0,
      distribution: 0,
      distribution_lite: 0,
      watch: 0
    };

    allNotables.forEach(s => {
      if (s.zone === 'momentum') counts.momentum++;
      else if (s.zone === 'accumulation') counts.accumulation++;
      else if (s.bear_zone === 'distribution') counts.distribution++;
      else if (s.bear_zone === 'distribution_lite') counts.distribution_lite++;
      else if (s.zone === 'watch') counts.watch++;
    });

    const total = counts.momentum + counts.accumulation + counts.distribution + counts.distribution_lite + counts.watch;
    
    // 计算多空比率 (多头: momentum + accumulation; 空头: distribution + distribution_lite)
    const bulls = counts.momentum + counts.accumulation;
    const bears = counts.distribution + counts.distribution_lite;
    const bullRatio = total > 0 ? Math.round((bulls / (bulls + bears || 1)) * 100) : 50;

    return { ...counts, total, bullRatio };
  }, [allNotables]);

  // 3. 根据所选分类过滤列表
  const filteredNotables = useMemo(() => {
    let result = allNotables;
    if (selectedFilter !== 'all') {
      result = allNotables.filter(s => {
        if (selectedFilter === 'momentum') return s.zone === 'momentum';
        if (selectedFilter === 'accumulation') return s.zone === 'accumulation';
        if (selectedFilter === 'distribution') return s.bear_zone === 'distribution';
        if (selectedFilter === 'distribution_lite') return s.bear_zone === 'distribution_lite';
        if (selectedFilter === 'watch') return s.zone === 'watch';
        return true;
      });
    }
    return result.slice(0, 10);
  }, [allNotables, selectedFilter]);

  // 4. 计算 SVG 环形弧度偏移量
  // 环周长 C = 2 * PI * r = 2 * 3.14159 * 40 = 251.2
  const ringCircumference = 251.2;
  const categories = [
    { key: 'momentum',          count: stats.momentum,          color: '#22d98a', nameZh: '主升突破', nameEn: 'Momentum' },
    { key: 'accumulation',      count: stats.accumulation,      color: '#f6c90e', nameZh: '主力建仓', nameEn: 'Accumulation' },
    { key: 'distribution',      count: stats.distribution,      color: '#ff5c72', nameZh: '主跌避险', nameEn: 'Decline' },
    { key: 'distribution_lite',  count: stats.distribution_lite,  color: '#f97316', nameZh: '疑似出货', nameEn: 'Suspect Dist' },
    { key: 'watch',             count: stats.watch,             color: '#63b3ed', nameZh: '警示观望', nameEn: 'Watch' }
  ];

  // 计算每个分类对应的环段 SVG stroke-dasharray 和 stroke-dashoffset
  let accumulatedPercent = 0;
  const ringSegments = categories.map(cat => {
    const percent = stats.total > 0 ? (cat.count / stats.total) : 0;
    const strokeLength = percent * ringCircumference;
    const strokeOffset = ringCircumference - strokeLength + (accumulatedPercent * ringCircumference);
    accumulatedPercent -= percent; // 顺时针偏置
    return {
      ...cat,
      percent,
      strokeLength,
      strokeOffset
    };
  });

  return (
    <section className="module" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
      {/* ── 标题 ── */}
      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <div className="section-icon icon-ai">🤖</div>
        <div>
          <div className="section-title">{t('insightsTitle')}</div>
          <div className="section-desc">{t('insightsDesc')}</div>
        </div>
      </div>

      {/* ── 炫酷仪表盘网格排版 ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gap: '2rem',
        alignItems: 'start'
      }} className="ai-insights-grid">
        
        {/* 左侧：多空态势环型图 (Donut Chart Dashboard) */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.2rem',
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-2)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {lang === 'zh' ? '今日异动多空构成' : 'Active Signal Mix'}
          </span>

          {/* Donut Ring Chart Wrapper */}
          <div style={{ position: 'relative', width: '130px', height: '130px' }}>
            <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
              {/* 底环阴影 */}
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
              
              {/* 动态着色环段 */}
              {ringSegments.map(segment => {
                if (segment.count === 0) return null;
                const isSelected = selectedFilter === segment.key;
                const isAnySelected = selectedFilter !== 'all';
                return (
                  <circle
                    key={segment.key}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={segment.color}
                    strokeWidth={isSelected ? '9' : '6'}
                    strokeDasharray={`${segment.strokeLength} ${ringCircumference - segment.strokeLength}`}
                    strokeDashoffset={segment.strokeOffset}
                    strokeLinecap="round"
                    onClick={() => setSelectedFilter(selectedFilter === segment.key ? 'all' : segment.key)}
                    style={{
                      cursor: 'pointer',
                      transition: 'stroke-width 0.3s, filter 0.3s, opacity 0.3s',
                      filter: isSelected ? `drop-shadow(0 0 4px ${segment.color})` : undefined,
                      opacity: isAnySelected && !isSelected ? 0.35 : 1
                    }}
                    title={`${segment.nameZh}: ${segment.count} (${Math.round(segment.percent * 100)}%)`}
                  />
                );
              })}
            </svg>

            {/* 圆环核心数据读数 */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
            }}>
              <span className="font-mono" style={{
                fontSize: '1.2rem',
                fontWeight: 800,
                color: stats.bullRatio >= 60 ? 'var(--green)' : (stats.bullRatio <= 40 ? 'var(--red)' : 'var(--gold)'),
                textShadow: stats.bullRatio >= 60 ? '0 0 8px rgba(34, 217, 138, 0.4)' : (stats.bullRatio <= 40 ? '0 0 8px rgba(255, 92, 114, 0.4)' : '0 0 8px rgba(246, 201, 14, 0.4)')
              }}>{stats.bullRatio}%</span>
              <span style={{ fontSize: '0.58rem', color: 'var(--text-2)', fontWeight: 600, textTransform: 'uppercase', marginTop: '-2px' }}>
                {stats.bullRatio >= 60 ? (lang === 'zh' ? '多头占优' : 'Bull Lead') : (stats.bullRatio <= 40 ? (lang === 'zh' ? '空头占优' : 'Bear Lead') : (lang === 'zh' ? '多空均衡' : 'Balanced'))}
              </span>
            </div>
          </div>

          {/* 交互说明提示标签 */}
          {selectedFilter !== 'all' ? (
            <button
              onClick={() => setSelectedFilter('all')}
              style={{
                background: 'rgba(99,179,237,0.1)',
                border: '1px solid rgba(99,179,237,0.3)',
                borderRadius: '6px',
                color: 'var(--cyan)',
                fontSize: '0.68rem',
                padding: '0.25rem 0.55rem',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              🔄 {lang === 'zh' ? '重置过滤' : 'Reset Filter'}
            </button>
          ) : (
            <span style={{ fontSize: '0.62rem', color: 'var(--text-3)' }}>
              {lang === 'zh' ? '💡 点击环形扇区过滤下方列表' : '💡 Click slice to filter the list'}
            </span>
          )}

          {/* 交互 Legend 标签组 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '100%', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.85rem' }}>
            {categories.map(cat => {
              if (cat.count === 0) return null;
              const isSelected = selectedFilter === cat.key;
              const isAnySelected = selectedFilter !== 'all';
              return (
                <div
                  key={cat.key}
                  onClick={() => setSelectedFilter(selectedFilter === cat.key ? 'all' : cat.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.35rem 0.5rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: isSelected ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                    transition: 'all 0.2s',
                    opacity: isAnySelected && !isSelected ? 0.4 : 1
                  }}
                  onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                  onMouseLeave={e => { if(!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cat.color, boxShadow: `0 0 6px ${cat.color}` }} />
                    <span style={{ fontSize: '0.72rem', color: isSelected ? 'var(--text-1)' : 'var(--text-2)', fontWeight: isSelected ? 700 : 500 }}>
                      {lang === 'zh' ? cat.nameZh : cat.nameEn}
                    </span>
                  </div>
                  <span className="font-mono" style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: isSelected ? 'var(--text-1)' : 'var(--text-3)',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '1px 5px',
                    borderRadius: '4px'
                  }}>{cat.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧：过滤后的 AI 点评卡片列表 */}
        <div className="insights-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', width: '100%', minHeight: '300px' }}>
          {filteredNotables.length === 0 ? (
            <div className="empty-state" style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '4rem 2rem' }}>
              {t('emptyInsights')}
            </div>
          ) : (
            filteredNotables.map(stock => {
              const ticker = stock.symbol.split('.')[0];
              const stockName = STOCK_NAME_MAP[ticker] || '';
              const displaySymbol = stockName ? `${stock.symbol} (${stockName})` : stock.symbol;

              const tvUrl = ticker.startsWith('6') || ticker.startsWith('9')
                ? `https://www.tradingview.com/symbols/SSE-${ticker}/`
                : `https://www.tradingview.com/symbols/SZSE-${ticker}/`;
              
              let cardClass = 'neutral';
              if (stock.zone === 'momentum') {
                cardClass = 'momentum';
              } else if (stock.zone === 'accumulation') {
                cardClass = 'accumulation';
              } else if (stock.bear_zone === 'distribution') {
                cardClass = 'distribution-card';
              } else if (stock.bear_zone === 'distribution_lite') {
                cardClass = 'distribution-lite-card';
              } else if (stock.zone === 'watch') {
                cardClass = 'watch';
              }

              return (
                <div
                  key={stock.symbol}
                  className={`insight-card ${cardClass}`}
                  style={{
                    animation: 'fadeIn 0.25s ease-out',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                >
                  <a 
                    href={tvUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ textDecoration: 'none' }}
                    title={lang === 'zh' ? '在 TradingView 中查看交互式 K 线图' : 'View interactive chart on TradingView'}
                  >
                    <div className="insight-sym" style={{ borderBottom: '1px dashed var(--cyan)', cursor: 'pointer', display: 'inline-flex', alignItems: 'baseline' }}>
                      {displaySymbol}
                      <span style={{ fontSize: '0.6rem', color: 'var(--cyan)', marginLeft: '2px', opacity: 0.8 }}>↗</span>
                    </div>
                  </a>
                  <div className="insight-text">
                    {translateInsight(stock.ai_insight, lang)}
                    <span style={{ display: 'block', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                      ¥{stock.price} · {stock.chg_pct >= 0 ? '+' : ''}{stock.chg_pct.toFixed(1)}% · {t('volRatio')} {stock.vol_ratio}x · {stock.volume}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
