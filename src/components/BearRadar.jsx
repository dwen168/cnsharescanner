import React, { useState, useMemo } from 'react';
import { getT, SIGNAL_MAP, STOCK_NAME_MAP } from '../utils/translations';

export default function BearRadar({ bearRadar, radar, lang }) {
  const [isOpen, setIsOpen] = useState(false);
  const t = getT(lang);

  // 上涨信号股票 symbol 集合（用于检测冲突信号）
  const bullishSymbols = useMemo(() => {
    const momentum = (radar?.momentum ?? []).map(s => s.symbol);
    const accum    = (radar?.accumulation ?? []).map(s => s.symbol);
    return new Set([...momentum, ...accum]);
  }, [radar]);

  const distList     = bearRadar?.distribution      ?? [];
  const distLiteList = bearRadar?.distribution_lite ?? [];
  const totalBear    = distList.length + distLiteList.length;

  return (
    <section className="module">
      {/* ── 标题区 ── */}
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div className="section-icon" style={{
            background: 'linear-gradient(135deg, rgba(231,76,60,0.15), rgba(192,57,43,0.08))',
            border: '1px solid rgba(231,76,60,0.3)',
            borderRadius: '10px',
            padding: '0.5rem',
            fontSize: '1.2rem',
          }}>🐻</div>
          <div>
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: 'var(--red, #e74c3c)' }}>{t('bearRadarTitle')}</span>
              {totalBear > 0 && (
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700,
                  background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.4)',
                  color: 'var(--red, #e74c3c)', padding: '1px 6px', borderRadius: '10px'
                }}>{totalBear}</span>
              )}
              <button
                onClick={() => setIsOpen(true)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-3)',
                  cursor: 'pointer', fontSize: '0.85rem', padding: '2px 4px',
                  display: 'inline-flex', alignItems: 'center', opacity: 0.7, transition: 'opacity 0.2s'
                }}
                title={lang === 'zh' ? '查看空头信号说明' : 'View Bear Signal Glossary'}
              >❓</button>
            </div>
            <div className="section-desc">{t('bearRadarDesc')}</div>
          </div>
        </div>
      </div>

      {/* ── 信号说明弹窗 ── */}
      {isOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
          }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card, #1e2022)', border: '1px solid var(--border, #2d3139)',
              borderRadius: 'var(--radius-lg, 12px)', width: '90%', maxWidth: '650px',
              maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem',
              color: 'var(--text-1)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.4)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--red, #e74c3c)', fontWeight: 600 }}>
                {lang === 'zh' ? '🐻 空头预警信号 & 区域定义' : '🐻 Bear Radar Signal & Zone Definitions'}
              </h3>
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <div style={{ fontSize: '0.82rem', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {lang === 'zh' ? (
                <>
                  <div>
                    <h4 style={{ color: 'var(--red, #e74c3c)', margin: '0 0 0.4rem', fontWeight: 600 }}>⚠️ 1. Distribution Zone（派发区 / 主跌浪）</h4>
                    <p style={{ margin: '0 0 0.4rem', color: 'var(--text-2)' }}>均线系统已全面转熊，主力资金明显出逃：</p>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <li><strong>主跌浪 ↓</strong>：均线死叉（MA5&lt;MA10&lt;MA20）+ 放量下跌 + 跑输大盘 + 5日累计跌幅超 -3%，且伴随利空消息。</li>
                      <li><strong>主跌浪(待确认) ↓</strong>：同上技术条件，但尚无明确利空消息，需等待进一步确认。</li>
                    </ul>
                  </div>
                  <div>
                    <h4 style={{ color: 'var(--orange, #e67e22)', margin: '0 0 0.4rem', fontWeight: 600 }}>🔶 2. Distribution Lite（疑似出货区）</h4>
                    <p style={{ margin: '0 0 0.4rem', color: 'var(--text-2)' }}>暂未完全空头排列，但出现明显的高位出货迹象：</p>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <li><strong>疑似出货区 ↓</strong>：RSI &gt; 65（高位）且今日跌幅 &gt; -2%（高位回落），或5日跌幅超 -8%，同时量比放大。</li>
                      <li><strong>死亡交叉 ✗</strong>：均线完成死叉（MA5 穿越 MA10 向下）且价格跌破60日低点支撑。</li>
                      <li><strong>利空共振 ↓</strong>：技术面偏弱（Watch/Neutral 区），叠加负面新闻舆情（NLP &lt; -0.15）。</li>
                    </ul>
                  </div>
                  <div>
                    <h4 style={{ color: 'var(--cyan)', margin: '0 0 0.4rem', fontWeight: 600 }}>⚔️ 冲突信号说明</h4>
                    <p style={{ margin: 0, color: 'var(--text-2)' }}>若某股同时出现在起飞雷达（多头）和空头预警（空头），将显示 ⚔️ 冲突信号 标记。这代表技术面信号存在矛盾，通常发生在剧烈震荡期，建议优先观望，等待方向明确后再操作。</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h4 style={{ color: 'var(--red, #e74c3c)', margin: '0 0 0.4rem', fontWeight: 600 }}>⚠️ 1. Distribution Zone (Sell-Off / Main Decline)</h4>
                    <p style={{ margin: '0 0 0.4rem', color: 'var(--text-2)' }}>Full bearish MA alignment with clear institutional distribution:</p>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <li><strong>Distribution ↓</strong>: Death cross (MA5&lt;MA10&lt;MA20) + volume-on-decline + underperforms index + 5-day cumulative loss &gt; -3%, with negative news.</li>
                      <li><strong>Distribution (Unconfirmed) ↓</strong>: Same technical conditions but no clear negative catalyst yet. Awaiting confirmation.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 style={{ color: 'var(--orange, #e67e22)', margin: '0 0 0.4rem', fontWeight: 600 }}>🔶 2. Distribution Lite (Suspected Distribution)</h4>
                    <p style={{ margin: '0 0 0.4rem', color: 'var(--text-2)' }}>Not yet fully bearish, but showing high-end distribution warning signs:</p>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <li><strong>Suspected Distribution ↓</strong>: RSI &gt; 65 (elevated) + today &gt; -2% decline (high-level reversal), or 5-day drop &gt; -8% with volume spike.</li>
                      <li><strong>Death Cross ✗</strong>: MA death cross confirmed + price breaks below 60-day support low.</li>
                      <li><strong>Bearish Resonance ↓</strong>: Weak technical stance (Watch/Neutral zone) combined with negative news sentiment (NLP &lt; -0.15).</li>
                    </ul>
                  </div>
                  <div>
                    <h4 style={{ color: 'var(--cyan)', margin: '0 0 0.4rem', fontWeight: 600 }}>⚔️ Conflicting Signal Note</h4>
                    <p style={{ margin: 0, color: 'var(--text-2)' }}>If a stock appears in both Take-off Radar (bullish) and Bear Radar (bearish), a ⚔️ Conflict badge is shown. This indicates contradictory technical signals, typically during high volatility chop. Recommended: stand aside until direction is clear.</p>
                  </div>
                </>
              )}
            </div>

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'var(--red, #e74c3c)', border: 'none', color: '#fff',
                  padding: '0.5rem 1.2rem', borderRadius: 'var(--radius-sm, 4px)',
                  cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600
                }}
              >
                {lang === 'zh' ? '我知道了' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 条件说明栏 ── */}
      <div style={{
        background: 'rgba(231,76,60,0.04)',
        border: '1px solid rgba(231,76,60,0.2)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.75rem 1rem',
        marginBottom: '1.2rem',
        fontSize: '0.75rem',
        color: 'var(--text-2)',
        display: 'flex', flexWrap: 'wrap', gap: '1rem',
        justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: 'var(--red, #e74c3c)', fontWeight: 700, marginRight: '0.3rem' }}>
              {lang === 'zh' ? '↓ 主跌浪条件:' : '↓ Distribution Criteria:'}
            </span>
            <span>
              {lang === 'zh'
                ? '均线死叉(MA5<MA10<MA20) + 放量下跌(量比>1.0) + 跑输大盘 + 5日跌幅<-3%'
                : 'Death Cross (MA5<MA10<MA20) + Vol Decline (>1.0x) + Underperforms Index + 5d drop < -3%'}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--orange, #e67e22)', fontWeight: 700, marginRight: '0.3rem' }}>
              {lang === 'zh' ? '↓ 疑似出货条件:' : '↓ Suspect Dist Criteria:'}
            </span>
            <span>
              {lang === 'zh'
                ? 'RSI>65高位回落>-2% / 5日急跌>-8% + 放量'
                : 'RSI>65 Reversal >-2% / 5d sharp drop >-8% + Volume Spike'}
            </span>
          </div>
        </div>
        <div style={{ color: 'var(--text-3)', fontSize: '0.7rem' }}>
          {lang === 'zh'
            ? '⚔️ 同时出现在起飞雷达的股票将标记为"冲突信号"'
            : '⚔️ Stocks also in Take-off Radar are flagged as "Conflict"'}
        </div>
      </div>

      {/* ── 雷达区域网格 ── */}
      <div className="radar-grid">
        {/* Distribution Zone — 主跌浪 */}
        <div className="radar-zone" style={{ borderColor: 'rgba(231,76,60,0.25)' }}>
          <div className="radar-zone-header">
            <span className="zone-badge" style={{
              background: 'rgba(231,76,60,0.15)', color: '#e74c3c',
              border: '1px solid rgba(231,76,60,0.4)', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 700
            }}>{t('distributionBadge')}</span>
            <span className="radar-zone-title">{t('distributionZone')}</span>
            <span className="radar-zone-sub">{distList.length} {t('stocksUnit')}</span>
          </div>
          <div className="radar-list">
            {distList.length === 0 ? (
              <div className="empty-state" style={{ color: 'var(--text-3)' }}>
                {t('emptyDistribution')}<br />
                <span style={{ fontSize: '0.72rem' }}>{t('emptyDistributionSub')}</span>
              </div>
            ) : (
              distList.map(stock => (
                <BearRow
                  key={stock.symbol}
                  stock={stock}
                  lang={lang}
                  t={t}
                  isConflict={bullishSymbols.has(stock.symbol)}
                  zoneColor="#e74c3c"
                />
              ))
            )}
          </div>
        </div>

        {/* Distribution Lite Zone — 疑似出货 */}
        <div className="radar-zone" style={{ borderColor: 'rgba(230,126,34,0.25)' }}>
          <div className="radar-zone-header">
            <span className="zone-badge" style={{
              background: 'rgba(230,126,34,0.15)', color: '#e67e22',
              border: '1px solid rgba(230,126,34,0.4)', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 700
            }}>{t('distributionLiteBadge')}</span>
            <span className="radar-zone-title">{t('distributionLiteZone')}</span>
            <span className="radar-zone-sub">{distLiteList.length} {t('stocksUnit')}</span>
          </div>
          <div className="radar-list">
            {distLiteList.length === 0 ? (
              <div className="empty-state" style={{ color: 'var(--text-3)' }}>
                {t('emptyDistributionLite')}<br />
                <span style={{ fontSize: '0.72rem' }}>{t('emptyDistributionLiteSub')}</span>
              </div>
            ) : (
              distLiteList.map(stock => (
                <BearRow
                  key={stock.symbol}
                  stock={stock}
                  lang={lang}
                  t={t}
                  isConflict={bullishSymbols.has(stock.symbol)}
                  zoneColor="#e67e22"
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function BearRow({ stock, lang, t, isConflict, zoneColor }) {
  const translatedSignal = SIGNAL_MAP[lang]?.[stock.bear_signal] || stock.bear_signal || '—';

  const ticker = stock.symbol.split('.')[0];
  const stockName = STOCK_NAME_MAP[ticker] || '';
  const displaySymbol = stockName ? `${stock.symbol} (${stockName})` : stock.symbol;

  const tvUrl = ticker.startsWith('6') || ticker.startsWith('9')
    ? `https://www.tradingview.com/symbols/SSE-${ticker}/`
    : `https://www.tradingview.com/symbols/SZSE-${ticker}/`;

  // 舆情徽章
  let resonanceBadge = null;
  if (stock.news_sentiment > 0.15) {
    resonanceBadge = <span className="radar-res-badge pos" title={t('resonancePosDesc')}>{t('resonancePos')}</span>;
  } else if (stock.news_sentiment < -0.15) {
    resonanceBadge = <span className="radar-res-badge neg" title={t('resonanceNegDesc')}>{t('resonanceNeg')}</span>;
  } else {
    resonanceBadge = <span className="radar-res-badge neutral" title={t('resonanceNeutralDesc')}>{t('resonanceNeutral')}</span>;
  }

  return (
    <div className="radar-row" style={{
      borderLeft: `3px solid ${zoneColor}`,
      paddingLeft: '0.75rem',
      background: isConflict ? 'rgba(255,200,0,0.02)' : undefined,
    }}>
      {/* Column 1: Symbol & Badges */}
      <div>
        <a
          href={tvUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'baseline' }}
          title={lang === 'zh' ? '在 TradingView 中查看交互式 K 线图' : 'View interactive chart on TradingView'}
        >
          <div className="radar-symbol" style={{ borderBottom: `1px dashed ${zoneColor}`, cursor: 'pointer', color: zoneColor }}>
            {displaySymbol}
          </div>
          <span style={{ fontSize: '0.62rem', color: zoneColor, marginLeft: '2px', opacity: 0.8 }}>↗</span>
        </a>
        <div style={{ marginTop: '0.2rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
          {resonanceBadge}
          {isConflict && (
            <span
              title={t('conflictSignalDesc')}
              style={{
                fontSize: '0.55rem', fontWeight: 700,
                background: 'rgba(255,200,0,0.12)', border: '1px solid rgba(255,200,0,0.5)',
                color: '#f1c40f', padding: '1px 4px', borderRadius: '4px',
                cursor: 'help', whiteSpace: 'nowrap'
              }}
            >{t('conflictSignal')}</span>
          )}
        </div>
      </div>

      {/* Column 2: Signals & Stats */}
      <div>
        <div style={{ fontSize: '0.82rem', fontWeight: 500, color: zoneColor }}>
          {translatedSignal}
        </div>
        <div className="radar-signal-text" style={{ marginTop: '0.15rem' }}>
          {t('volRatio')} {stock.vol_ratio}x · {t('bearRSI')} {stock.rsi} · {t('sentiment')}: {stock.news_sentiment > 0 ? '+' : ''}{stock.news_sentiment}
        </div>
      </div>

      {/* Column 3: Change Rates */}
      <div className="radar-right">
        <div className={`radar-chg ${stock.chg_pct >= 0 ? 'pos' : 'neg'}`}>
          {stock.chg_pct >= 0 ? '+' : ''}{stock.chg_pct?.toFixed(1)}%
        </div>
        <div className="radar-vol">5d {stock.chg_5d >= 0 ? '+' : ''}{stock.chg_5d?.toFixed(1)}%</div>
      </div>
    </div>
  );
}
