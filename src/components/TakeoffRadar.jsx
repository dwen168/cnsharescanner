import React, { useState } from 'react';
import { getT, SIGNAL_MAP } from '../utils/translations';

export default function TakeoffRadar({ radar, lang, tradingState }) {
  const [isOpen, setIsOpen] = useState(false);
  const t = getT(lang);

  return (
    <section className="module">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div className="section-icon icon-radar">📡</div>
          <div>
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {t('radarTitle')}
              <button 
                onClick={() => setIsOpen(true)}
                className="help-button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  padding: '2px 4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.7,
                  transition: 'opacity 0.2s',
                }}
                title={lang === 'zh' ? '查看信号说明' : 'View Signal Glossary'}
              >
                ❓
              </button>
            </div>
            <div className="section-desc">{t('radarDesc')}</div>
          </div>
        </div>
      </div>

      {isOpen && (
        <div 
          className="modal-overlay" 
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card, #1e2022)',
              border: '1px solid var(--border, #2d3139)',
              borderRadius: 'var(--radius-lg, 12px)',
              width: '90%',
              maxWidth: '650px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '1.5rem',
              color: 'var(--text-1)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-1)', fontWeight: 600 }}>
                {lang === 'zh' ? '📊 量化信号 & 状态区域定义' : '📊 Quant Signals & Zone Definitions'}
              </h3>
              <button 
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                }}
              >
                ✕
              </button>
            </div>
            
            <div className="glossary-content" style={{ fontSize: '0.82rem', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {lang === 'zh' ? (
                <>
                  <div>
                    <h4 style={{ color: 'var(--orange, #ff9f43)', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                      🚀 1. Momentum 状态区 (主升/快速爆发区)
                    </h4>
                    <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-2)' }}>该区域代表股票短线爆发动能极强，主要有以下推荐信号：</p>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <li><strong>主升浪 ▶</strong>：技术面向上突破颈线，且成交量与强度共振，同时无负面新闻且未超买。</li>
                      <li><strong>主升浪(超买) ▶</strong>：符合主升浪形态，但 RSI 超过了 75，提示警惕追高风险。</li>
                      <li><strong>V型反转 ⚡</strong>：前期深跌（5天跌幅超过 5%）后，今日突然倍量大涨并收复 20日均线（MA20），且无负面新闻。</li>
                      <li><strong>主升浪 (轻仓)</strong>：在市场处于低/中/高风险防守状态时，主升浪推荐信号会降级带上“轻仓”警示。</li>
                      <li><strong>主升浪 ▶ (低流动性)</strong>：触发主升浪，但 20日平均日成交额处于 [500K, 2M] AUD 之间，提示注意流动性摩擦。</li>
                    </ul>
                  </div>

                  <div>
                    <h4 style={{ color: 'var(--gold, #f1c40f)', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                      📡 2. Accumulation 状态区 (低位主力建仓/潜伏区)
                    </h4>
                    <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-2)' }}>该区域代表个股在低位有资金介入迹象，正在企稳筑底：</p>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <li><strong>潜伏区 ◉</strong>：股票近期曾跌破过 MA20，今日放量上涨并跑赢大盘，价格高于 60日低点 floor 上方，且底部呈现抬高或连涨企稳，且无负面消息。</li>
                      <li><strong>消息共振 ◉</strong>：技术上呈现多头排列，且最新个股财经舆情显著偏多（NLP得分 &gt; 0.25 且足够新鲜），形成“消息+技术”多头共振。</li>
                      <li><strong>潜伏区 (轻仓)</strong>：在防守/低风险市场状态下，潜伏区推荐信号会降级带上“轻仓”提示。</li>
                      <li><strong>潜伏区 ◉ (低流动性)</strong>：符合潜伏区逻辑但处于低流动性范围内的股票。</li>
                    </ul>
                  </div>

                  <div>
                    <h4 style={{ color: 'var(--text-3, #a0a0a0)', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                      ⚠️ 3. Watch 状态区 (观望/警惕区)
                    </h4>
                    <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-2)' }}>该区域代表技术形态较好，但因为基本面噪音或流动性缺失被雷达降级防守：</p>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <li><strong>形态突破(利空降级)</strong>：虽然技术上符合 momentum 突破，但最新个股消息偏利空，被降级在此。</li>
                      <li><strong>底部放量(利空降级)</strong>：虽然符合 accumulation 底部放量建仓，但个股有偏空负面消息。</li>
                      <li><strong>多头排列</strong>：仅满足均线多头排列（MA5 &gt; MA10 &gt; MA20）且价格在五日线之上，但量能或大盘相对强度尚未达标，等待资金异动信号。</li>
                      <li><strong>观望</strong>：如果股票 20日平均日成交额低于 500K AUD（极低流动性），即使技术形态触发了主升浪或潜伏区，也会被强行拦截并降级显示为观望。</li>
                    </ul>
                  </div>

                  <div>
                    <h4 style={{ color: 'var(--text-3, #a0a0a0)', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                      🔵 4. Neutral 状态区 (普通区)
                    </h4>
                    <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-2)' }}><strong>观望</strong>：没有明显的量价异动或均线多头信号，系统列为普通持续跟踪。</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h4 style={{ color: 'var(--orange, #ff9f43)', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                      🚀 1. Momentum Zone (Breakout / Rapid Rally)
                    </h4>
                    <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-2)' }}>Indicates strong short-term upward momentum. Key signals include:</p>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <li><strong>Momentum Breakout ▶</strong>: Price breakout above 21-day high, volume spike, strong RS ratio, and bullish MAs with no negative news.</li>
                      <li><strong>Momentum (Overbought) ▶</strong>: Bullish breakout pattern, but RSI &gt; 75 (warning against chasing highs).</li>
                      <li><strong>V-Reversal ⚡</strong>: Sharp bounce (&gt;3%) after a deep sell-off (5-day return &lt; -5%), on high volume, recovering the MA20.</li>
                      <li><strong>Momentum (Light Position)</strong>: Recommended with light position warning due to low/medium/high risk market conditions.</li>
                      <li><strong>Momentum (Low Liquidity)</strong>: Breakout confirmed but 20-day average turnover is between [500K, 2M] AUD.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 style={{ color: 'var(--gold, #f1c40f)', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                      📡 2. Accumulation Zone (Bottom Support / Setup)
                    </h4>
                    <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-2)' }}>Indicates early institutional buying and price stabilization at bottoms:</p>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <li><strong>Accumulation Zone ◉</strong>: Price stabilized above 60-day low floor, volume spike from below MA20, positive daily close, and strong RS ratio.</li>
                      <li><strong>News Resonance ◉</strong>: Bullish moving averages accompanied by highly positive news sentiment (NLP score &gt; 0.25).</li>
                      <li><strong>Accumulation (Light Position)</strong>: Recommended with light position caution under defensive risk states.</li>
                      <li><strong>Accumulation (Low Liquidity)</strong>: Bottom buying signals detected, but with low market liquidity.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 style={{ color: 'var(--text-3, #a0a0a0)', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                      ⚠️ 3. Watch Zone (Alerts & Caution)
                    </h4>
                    <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-2)' }}>Strong technical setup, but downgraded due to fundamental risks or poor liquidity:</p>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <li><strong>Breakout (Sentiment Downgrade)</strong>: Met momentum criteria, but news sentiment is bearish.</li>
                      <li><strong>Bottom Vol Spike (Sentiment Downgrade)</strong>: Met accumulation criteria, but has negative news.</li>
                      <li><strong>Bullish Alignment</strong>: Bullish moving averages (MA5 &gt; MA10 &gt; MA20) but lacks volume spike or relative strength.</li>
                      <li><strong>Watch</strong>: If 20-day average turnover is &lt; 500K AUD, signals are downgraded to 'Watch' for capital protection.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 style={{ color: 'var(--text-3, #a0a0a0)', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                      🔵 4. Neutral Zone (No Signal)
                    </h4>
                    <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-2)' }}><strong>Watch</strong>: No significant price-volume breakout or moving average alignment. Under normal tracking.</p>
                  </div>
                </>
              )}
            </div>
            
            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button 
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'var(--green, #2ecc71)',
                  border: 'none',
                  color: '#fff',
                  padding: '0.5rem 1.2rem',
                  borderRadius: 'var(--radius-sm, 4px)',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                {lang === 'zh' ? '我知道了' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="radar-rules-info" style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.75rem 1rem',
        marginBottom: '1.2rem',
        fontSize: '0.75rem',
        color: 'var(--text-2)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: 'var(--orange)', fontWeight: 700, marginRight: '0.3rem' }}>
              {lang === 'zh' ? '▶ 主升浪条件:' : '▶ Momentum Criteria:'}
            </span>
            <span>
              {lang === 'zh' 
                ? '价格创20日新高 + 今日放量(量比>1.0) + 均线呈多头排列 + 相对强度偏强' 
                : '20-day High Breakout + Volume Spike (>1.0x) + Bullish MAs + Strong RS'}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--gold)', fontWeight: 700, marginRight: '0.3rem' }}>
              {lang === 'zh' ? '◉ 潜伏区条件:' : '◉ Accumulation Criteria:'}
            </span>
            <span>
              {lang === 'zh' 
                ? '今日收正 + 从20日均线下方放量突破(量比>0.8) + 相对强度偏强' 
                : 'Positive Close + Bottom Volume Spike (>0.8x from below MA20) + Strong RS'}
            </span>
          </div>
        </div>
        <div style={{ color: 'var(--text-3)', fontSize: '0.7rem' }}>
          {lang === 'zh' ? '※ 雷达专注于当日放量突破筛选，非近期累计波段涨幅。' : '※ Radar filters for daily breakout spikes, not historical cumulative gains.'}
        </div>
      </div>

      <div className="radar-grid">
        {/* 主升浪区 */}
        <div className="radar-zone">
          <div className="radar-zone-header">
            <span className="zone-badge momentum">{t('momentumBadge')}</span>
            <span className="radar-zone-title">{t('momentumZone')}</span>
            <span className="radar-zone-sub">{(radar.momentum ?? []).length} {t('stocksUnit')}</span>
          </div>
          <div className="radar-list">
            {(radar.momentum ?? []).length === 0 ? (
              <div className="empty-state">{t('emptyMomentum')}<br /><span style={{fontSize:'0.72rem'}}>{t('emptyMomentumSub')}</span></div>
            ) : (
              radar.momentum.map(stock => <RadarRow key={stock.symbol} stock={stock} lang={lang} />)
            )}
          </div>
        </div>

        {/* 潜伏区 */}
        <div className="radar-zone">
          <div className="radar-zone-header">
            <span className="zone-badge accumulation">{t('accumBadge')}</span>
            <span className="radar-zone-title">{t('accumZone')}</span>
            <span className="radar-zone-sub">{(radar.accumulation ?? []).length} {t('stocksUnit')}</span>
          </div>
          <div className="radar-list">
            {(radar.accumulation ?? []).length === 0 ? (
              <div className="empty-state">{t('emptyAccum')}<br /><span style={{fontSize:'0.72rem'}}>{t('emptyAccumSub')}</span></div>
            ) : (
              radar.accumulation.map(stock => <RadarRow key={stock.symbol} stock={stock} lang={lang} />)
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function RadarRow({ stock, lang }) {
  const t = getT(lang);
  let resonanceBadge = null;
  if (stock.news_sentiment > 0.15) {
    resonanceBadge = <span className="radar-res-badge pos" title={t('resonancePosDesc')}>{t('resonancePos')}</span>;
  } else if (stock.news_sentiment < -0.15) {
    resonanceBadge = <span className="radar-res-badge neg" title={t('resonanceNegDesc')}>{t('resonanceNeg')}</span>;
  } else {
    resonanceBadge = <span className="radar-res-badge neutral" title={t('resonanceNeutralDesc')}>{t('resonanceNeutral')}</span>;
  }

  const translatedSignal = SIGNAL_MAP[lang]?.[stock.signal] || stock.signal;

  const ticker = stock.symbol.split('.')[0];
  const tvUrl = `https://www.tradingview.com/symbols/ASX-${ticker}/`;

  return (
    <div className="radar-row">
      <div>
        <a 
          href={tvUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'baseline' }}
          title={lang === 'zh' ? '在 TradingView 中查看交互式 K 线图' : 'View interactive chart on TradingView'}
        >
          <div className="radar-symbol" style={{ borderBottom: '1px dashed var(--cyan)', cursor: 'pointer' }}>
            {stock.symbol}
          </div>
          <span style={{ fontSize: '0.62rem', color: 'var(--cyan)', marginLeft: '2px', opacity: 0.8 }}>↗</span>
        </a>
        {resonanceBadge}
      </div>
      <div>
        <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-1)' }}>{translatedSignal}</div>
        <div className="radar-signal-text">{t('volRatio')} {stock.vol_ratio}x · {t('sentiment')}: {stock.news_sentiment > 0 ? '+' : ''}{stock.news_sentiment} · {t('breakout')}: {stock.breakout ? '✓' : '✗'}</div>
      </div>
      <div className="radar-right">
        <div className={`radar-chg ${stock.chg_pct >= 0 ? 'pos' : 'neg'}`}>
          {stock.chg_pct >= 0 ? '+' : ''}{stock.chg_pct.toFixed(1)}%
        </div>
        <div className="radar-vol">5d {stock.chg_5d >= 0 ? '+' : ''}{stock.chg_5d.toFixed(1)}%</div>
      </div>
    </div>
  );
}
