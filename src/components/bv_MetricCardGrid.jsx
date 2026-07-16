import React from 'react';

export default function BvMetricCardGrid({
  activeTab,
  lang,
  t,
  computedStats,
  computedSectorStats,
  backtestData,
  periods,
  returnType,
  attributionResult = null,
  attributionPeriod = '5d',
  setAttributionPeriod = () => {},
}) {
  const [selectedCard, setSelectedCard] = React.useState(null);

  React.useEffect(() => {
    setSelectedCard(null);
  }, [activeTab, attributionPeriod]);

  const getReturnClass = (val) => {
    if (val === null || val === undefined) return '';
    return val > 0 ? 'pos' : (val < 0 ? 'neg' : '');
  };

  const formatReturn = (val) => {
    if (val === null || val === undefined) return '-';
    return `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;
  };

  const getConfidenceBadge = (size) => {
    const conf = size >= 100 ? 'high' : (size >= 50 ? 'medium' : 'low');
    const color = conf === 'high' ? 'var(--green)' : (conf === 'medium' ? 'var(--gold)' : 'var(--orange)');
    const label = lang === 'zh' 
      ? { high: '高置信度', medium: '中置信度', low: '低置信度' }[conf] 
      : { high: 'High Conf', medium: 'Med Conf', low: 'Low Conf' }[conf];
    return (
      <span style={{ 
        fontSize: '0.58rem', 
        padding: '0.05rem 0.25rem', 
        borderRadius: '3px', 
        background: 'rgba(255,255,255,0.03)', 
        border: `1px solid ${color}`, 
        color: color, 
        marginLeft: '0.4rem',
        fontWeight: 600,
        textTransform: 'none'
      }}>
        {label}
      </span>
    );
  };

  // ── Attribution overview cards ──────────────────────────────────────────
  if (activeTab === 'attribution') {
    const s = attributionResult?.summary;
    const zs = attributionResult?.zoneStats || {};

    const skillVerdictLabel = !s ? '' : {
      skill:          t('attrSkillStrong'),
      mixed:          t('attrSkillMedium'),
      luck:           t('attrSkillWeak'),
      negative:       t('attrSkillNegative'),
      insufficient:   t('attrSkillInsufficient'),
    }[s.skillVerdict] || '';

    const skillColor = !s ? 'var(--text-3)' : {
      skill:        'var(--green)',
      mixed:        'var(--gold)',
      luck:         'var(--orange)',
      negative:     'var(--red)',
      insufficient: 'var(--text-3)',
    }[s.skillVerdict] || 'var(--text-3)';

    // Best timing zone
    let bestZone = null, bestPremium = -Infinity;
    Object.entries(zs).forEach(([zone, zData]) => {
      if (zData.timingPremium > bestPremium) {
        bestPremium = zData.timingPremium;
        bestZone = zone;
      }
    });

    const attrCards = [
      {
        key: 'marketBeta',
        label: t('attrMarketBeta'),
        icon: '🌐',
        color: 'var(--cyan)',
        value: s ? formatReturn(s.marketBeta) : '-',
        pct: s ? `${s.marketBetaPct > 0 ? '+' : ''}${s.marketBetaPct}%` : '-',
        sub: lang === 'zh' ? '大盘驱动（被动涨跌）' : 'Index-driven (passive)',
        tooltip: lang === 'zh' 
          ? '【大盘驱动收益】代表大盘指数（基准）涨跌对策略的被动贡献。如果该项占大头，说明策略赚的是市场整体上涨红利，属于顺风运气。' 
          : '[Market Beta] Passive index contribution. A high value means returns are driven by market-wide gains (passive ride-along / market luck).',
      },
      {
        key: 'sectorRotation',
        label: t('attrSectorRotation'),
        icon: '🏭',
        color: 'var(--gold)',
        value: s ? formatReturn(s.sectorRotation) : '-',
        pct: s ? `${s.sectorRotationPct > 0 ? '+' : ''}${s.sectorRotationPct}%` : '-',
        sub: lang === 'zh' ? '选对行业的贡献' : 'Sector selection skill',
        tooltip: lang === 'zh' 
          ? '【行业选择超额】策略所配置板块跑赢大盘的平均超额收益。为正数时，代表策略在强弱板块的战术轮动上具备判断力（选对热点行业）。' 
          : '[Sector Rotation] Active excess return of chosen sectors over market index. Positive values show successful sector allocation capability.',
      },
      {
        key: 'stockAlpha',
        label: t('attrStockAlpha'),
        icon: '🎯',
        color: s && s.stockAlpha >= 0 ? 'var(--green)' : 'var(--red)',
        value: s ? formatReturn(s.stockAlpha) : '-',
        pct: s ? `${s.stockAlphaPct > 0 ? '+' : ''}${s.stockAlphaPct}%` : '-',
        sub: lang === 'zh' ? '选股超额收益' : 'Stock selection alpha',
        tooltip: lang === 'zh' 
          ? '【选股纯超额】所选个股跑赢其同行业指数平均表现的贡献。是判定策略选股“纯实力”最关键的指标，正数代表具备真正的挖牛股能力。' 
          : '[Stock Alpha] Performance of chosen stocks over their industry sector benchmark. The single most critical measure of pure selection skill.',
      },
      {
        key: 'timing',
        label: t('attrTimingPremium'),
        icon: '⏱',
        color: 'rgb(167, 139, 250)',
        value: bestZone ? formatReturn(bestPremium) : '-',
        pct: bestZone ? (lang === 'zh' ? `最优: ${bestZone}` : `Best: ${bestZone}`) : '-',
        sub: lang === 'zh' ? '最优区间 vs 全局均值' : 'Best zone vs global avg',
        tooltip: lang === 'zh' 
          ? '【入场择时溢价】对比不同触发区间（如主升浪、资金建仓）所获得的平均超额差异。展示最佳区间的时机选择优势，正数代表时机选择出色。' 
          : '[Timing Premium] Dynamic active return premium based on signal trigger zones. High values indicate excellent entry timing skill.',
      },
      {
        key: 'residual',
        label: t('attrResidual'),
        icon: '⚖️',
        color: (() => {
          const hasSectorCount = attributionResult?.perTrade?.filter(t => t.hasSectorData).length ?? 0;
          const coverageRate = attributionResult?.perTrade?.length > 0 ? (hasSectorCount / attributionResult.perTrade.length) * 100 : 0;
          return coverageRate >= 95 ? 'var(--green)' : (coverageRate >= 80 ? 'var(--gold)' : 'var(--orange)');
        })(),
        value: (() => {
          const hasSectorCount = attributionResult?.perTrade?.filter(t => t.hasSectorData).length ?? 0;
          const coverageRate = attributionResult?.perTrade?.length > 0 ? (hasSectorCount / attributionResult.perTrade.length) * 100 : 0;
          return `${coverageRate.toFixed(1)}%`;
        })(),
        pct: (() => {
          const hasSectorCount = attributionResult?.perTrade?.filter(t => t.hasSectorData).length ?? 0;
          const coverageRate = attributionResult?.perTrade?.length > 0 ? (hasSectorCount / attributionResult.perTrade.length) * 100 : 0;
          return coverageRate >= 95 ? t('attrResidualOk') : t('attrResidualWarn');
        })(),
        sub: lang === 'zh' ? '板块基准映射率' : 'Sector benchmark mapping',
        tooltip: lang === 'zh' 
          ? '【数据覆盖率】成功映射到对应行业指数（如金融/矿业指数）的信号比例。高覆盖率确保分解分析代表性强、数据无缺失。' 
          : '[Data Coverage] % of signals successfully mapped to their sector benchmark index. High coverage ensures representative analysis.',
      },
      {
        key: 'ir',
        label: t('attrIR'),
        icon: '📊',
        color: skillColor,
        value: s ? s.ir.toFixed(3) : '-',
        pct: skillVerdictLabel,
        tooltip: lang === 'zh' 
          ? '【信息比率 IR】用于衡量超额收益的平稳度。值越高代表超额收益获取越稳定。由于同日信号相关性及持仓周期的重叠效应，t值与置信度仅作指示性参考，不代表严格的独立同分布假设。' 
          : '[Info Ratio IR] Measures excess return consistency. Due to cross-sectional correlations and holding overlaps, the t-statistic and verdict serve as indicative guidelines rather than strict IID tests.',
        sub: s ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.2rem' }}>
            <div style={{ color: 'var(--text-2)', lineHeight: 1.35 }}>
              {(() => {
                if (s.skillVerdict === 'skill') {
                  return lang === 'zh'
                    ? '🏆 高平稳度：收益分布较均匀，表现为可复制的选股/配置超额能力。'
                    : '🏆 High stability: Steady return distribution, showing reproducible selection/sector excess.';
                } else if (s.skillVerdict === 'mixed') {
                  return lang === 'zh'
                    ? '⚖️ 中等平稳度：超额收益稳定性尚可，建议积累更多交易以作进一步评估。'
                    : '⚖️ Medium stability: Moderate return consistency, requires more observations.';
                } else if (s.skillVerdict === 'luck') {
                  return lang === 'zh'
                    ? '🎰 波动较大：收益分布不均，超额利润可能由少数几次大涨驱动。'
                    : '🎰 High volatility: Uneven return distribution, profits may be driven by specific events.';
                } else if (s.skillVerdict === 'negative') {
                  return lang === 'zh'
                    ? '📉 负超额：策略表现落后于对应板块基准。'
                    : '📉 Underperforming: Failed to deliver positive active returns over benchmarks.';
                } else {
                  return lang === 'zh'
                    ? '⚪ 子样本交易数少于 30 笔：由于应用了条件筛选，小样本量的统计确定性受限，分析结果仅供参考。'
                    : '⚪ Signals count < 30: Due to active filters, statistical confidence of this subset is limited. For reference only.';
                }
              })()}
            </div>
            <div style={{ fontSize: '0.58rem', color: skillColor, fontFamily: 'var(--mono)', marginTop: '0.1rem', opacity: 0.85 }}>
              {lang === 'zh' ? `指示性参考: t值 ${s.tStat.toFixed(2)}, n=${s.n}` : `Indicative Ref: t-stat ${s.tStat.toFixed(2)}, n=${s.n}`}
            </div>
          </div>
        ) : '-',
      },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Period Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 600 }}>
            {t('attrPeriodSelector')}:
          </span>
          <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px', border: '1px solid var(--border)' }}>
            {['1d', '3d', '5d', '10d'].map(p => (
              <button
                key={p}
                onClick={() => setAttributionPeriod(p)}
                style={{
                  background: attributionPeriod === p ? 'rgb(139,92,246)' : 'transparent',
                  color: attributionPeriod === p ? 'white' : 'var(--text-2)',
                  border: 'none',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  borderRadius: '3px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontFamily: 'var(--mono)',
                }}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
          {attributionResult && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
              n = {attributionResult.n} {lang === 'zh' ? '条信号' : 'signals'}
            </span>
          )}
        </div>

        {/* Cards Grid */}
        {!attributionResult ? (
          <div style={{ 
            padding: '2rem', textAlign: 'center', color: 'var(--text-3)',
            background: 'rgba(139,92,246,0.04)', border: '1px dashed rgba(139,92,246,0.3)',
            borderRadius: 'var(--radius-md)', fontSize: '0.85rem'
          }}>
            ⚪ {t('attrNoData')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {attrCards.map(card => (
                <div 
                  key={card.key} 
                  className="metric-card" 
                  title={card.tooltip} 
                  onClick={() => setSelectedCard(prev => prev === card.key ? null : card.key)}
                  style={{
                    background: 'var(--bg-card)',
                    border: selectedCard === card.key ? '1px solid rgb(139, 92, 246)' : '1px solid var(--border)',
                    boxShadow: selectedCard === card.key ? '0 0 12px rgba(139, 92, 246, 0.3)' : 'none',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.1rem 1.25rem',
                    borderLeft: `4px solid ${card.color}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '1rem' }}>{card.icon}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {card.label}
                      </span>
                    </div>
                    {selectedCard === card.key && (
                      <span style={{ fontSize: '0.58rem', color: 'rgb(167, 139, 250)', fontWeight: 'bold' }}>
                        {lang === 'zh' ? '已选' : 'SELECTED'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <span className={`font-mono ${card.key !== 'ir' && card.key !== 'residual' ? getReturnClass(attributionResult.summary[card.key]) : ''}`}
                      style={{ fontSize: '1.5rem', fontWeight: 800, color: card.key === 'ir' || card.key === 'timing' || card.key === 'residual' ? card.color : undefined }}>
                      {card.value}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: card.color, fontWeight: 600, fontFamily: 'var(--mono)' }}>
                      {card.pct}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '0.3rem' }}>
                    {card.key === 'ir' ? (lang === 'zh' ? '点击查看确定性评估' : 'Click to inspect certainty') : card.sub}
                  </div>
                </div>
              ))}
            </div>

            {/* Click-to-explain Detail Board */}
            {selectedCard && (() => {
              const card = attrCards.find(c => c.key === selectedCard);
              if (!card) return null;

              const explanations = {
                marketBeta: {
                  title: lang === 'zh' ? '🌐 市场 Beta (Market Beta) ── 大盘红利贡献' : '🌐 Market Beta ── Passive Index Gains',
                  body: lang === 'zh' ? (
                    <div>
                      <p><strong>核心定义</strong>：大盘指数涨跌在持仓期内产生的被动收益。例如买入 WES 期间大盘涨了 2%，这 2% 就是市场 Beta 给我们带来的红利。</p>
                      <p><strong>如何看数</strong>：大字 <strong>{card.value}</strong> 代表每一笔交易中大盘送给我们的平均收益；小字 <strong>{card.pct}</strong> 代表这个贡献在策略“市场+行业+个股”归因绝对值总和中的权重比例。</p>
                      <p><strong>实力 vs 运气</strong>：大盘涨跌是整个市场普照的 Beta 阳光，属于<strong>随波逐流的运气</strong>而非策略选股本领。如果该占比过高，说明策略在牛市极度吃航，但在熊市里可能会受到同等程度的大盘大跌冲击。</p>
                    </div>
                  ) : (
                    <div>
                      <p><strong>Core Definition</strong>: Passive returns generated by broad market index movements. If index rose 2% during your hold, this 2% is Market Beta.</p>
                      <p><strong>Interpretation</strong>: Main number (<strong>{card.value}</strong>) is average return contribution; small number (<strong>{card.pct}</strong>) is the contribution weight among market+sector+alpha components.</p>
                      <p><strong>Skill vs Luck</strong>: Market growth is a general macro wave (market luck). High beta dependency indicates strategy relies heavily on general bull markets to generate profits.</p>
                    </div>
                  )
                },
                sectorRotation: {
                  title: lang === 'zh' ? '🏭 行业轮动 (Sector Rotation) ── 行业选择超额' : '🏭 Sector Rotation ── Sector Allocation Skill',
                  body: lang === 'zh' ? (
                    <div>
                      <p><strong>核心定义</strong>：策略所挑选出的行业指数跑赢大盘的平均超额收益。例如配置了能源板块，而能源板块涨幅比大盘高出 3%，这就是行业轮动贡献。</p>
                      <p><strong>如何看数</strong>：大字 <strong>{card.value}</strong> 代表通过选对板块平均获取的超额收益；小字 <strong>{card.pct}</strong> 代表行业配置在总推动力中的比重。</p>
                      <p><strong>实力 vs 运气</strong>：这是策略在“行业轮动与战术选板块”上的<strong>配置实力</strong>。为正数且高，说明策略擅长在资金流入热点时准确捕获强势板块，避开低迷行业。</p>
                    </div>
                  ) : (
                    <div>
                      <p><strong>Core Definition</strong>: Outperformance of your chosen sector index over the broad market. If Energy beat the market index by 3%, that 3% is the rotation contribution.</p>
                      <p><strong>Interpretation</strong>: Main number (<strong>{card.value}</strong>) is active return from sector picks; small number (<strong>{card.pct}</strong>) is the contribution weight.</p>
                      <p><strong>Skill vs Luck</strong>: Measures sector rotation proficiency. A high positive sector rotation shows active capital allocation skill (riding strong sectors and avoiding cold ones).</p>
                    </div>
                  )
                },
                stockAlpha: {
                  title: lang === 'zh' ? '🎯 个股 Alpha (Stock Alpha) ── 选股纯实力超额' : '🎯 Stock Alpha ── Pure Selection Skill',
                  body: lang === 'zh' ? (
                    <div>
                      <p><strong>核心定义</strong>：**策略组合**中选出的具体个股跑赢其自身行业指数平均表现的净超额贡献。例如**组合**买入 STO，而 STO 的涨幅比整个能源板块均值高出 5%，这就是个股选股 Alpha。</p>
                      <p><strong>如何看数</strong>：
                        {s && s.stockAlpha >= 0 ? (
                          <span>大字 <strong>{card.value}</strong> 代表组合通过精选个股捕获的<strong>正向纯超额收益</strong>（跑赢行业）；小字 <strong>{card.pct}</strong> 代表个股超额在组合总推动力中的<strong>正向贡献比重</strong>。</span>
                        ) : (
                          <span>大字 <strong>{card.value}</strong> 代表组合因选股表现不佳导致的<strong>负向超额拖累</strong>（跑输行业）；小字 <strong>{card.pct}</strong> 代表该项拖累在组合总拉动力中的<strong>负向比重</strong>。</span>
                        )}
                      </p>
                      <p><strong>实力 vs 运气</strong>：这是判定量化选股<strong>纯实力</strong>的终极指标。如果个股 Alpha 显著为正，证明策略有能力在同一个板块中筛选出领涨的龙头股，避开拖后腿的烂股，属于具有技术壁垒的“纯阿尔法”实力。</p>
                    </div>
                  ) : (
                    <div>
                      <p><strong>Core Definition</strong>: Performance of selected stocks over their sector index. If STO beat the Energy sector index by 5%, that 5% is pure stock alpha.</p>
                      <p><strong>Interpretation</strong>: Main number (<strong>{card.value}</strong>) is average return from stock picking; small number (<strong>{card.pct}</strong>) is the contribution weight.</p>
                      <p><strong>Skill vs Luck</strong>: The ultimate indicator of stock selection skill. A positive Alpha proves the strategy can isolate industry leaders and dump laggards within the same sector.</p>
                    </div>
                  )
                },
                timing: {
                  title: lang === 'zh' ? '⏱ 择时溢价 (Timing Premium) ── 入场时机优势' : '⏱ Timing Premium ── Entry Timing Skill',
                  body: lang === 'zh' ? (
                    <div>
                      <p><strong>核心定义</strong>：将策略按信号触发区间（如主升浪区 vs 资金建仓区）分类后，各区间平均超额收益与策略全局平均超额的差异。</p>
                      <p><strong>如何看数</strong>：大字 <strong>{card.value}</strong> 代表最优区间所带来的额外入场溢价；小字 <strong>{card.pct}</strong> 展示了效果最好的触发信号区间名称。</p>
                      <p><strong>实力 vs 运气</strong>：反映了算法在 **入场点位与时机选择** 上的实力。如果各区间的溢价区分显著，说明策略信号分类逻辑具有良好的择时预判实力。</p>
                    </div>
                  ) : (
                    <div>
                      <p><strong>Core Definition</strong>: Active return premium of specific signal trigger zones (e.g. Momentum vs Accumulation) over the global strategy average.</p>
                      <p><strong>Interpretation</strong>: Main number (<strong>{card.value}</strong>) is the entry premium of the best zone; small text (<strong>{card.pct}</strong>) shows the name of the best performing zone.</p>
                      <p><strong>Skill vs Luck</strong>: Measures entry point timing capability. Significant timing differences prove the signal triggers are highly synchronized with trend cycles.</p>
                    </div>
                  )
                },
                residual: {
                  title: lang === 'zh' ? '⚖️ 数据质量 (Data Coverage) ── 板块基准映射验证' : '⚖️ Data Coverage ── Sector Benchmark Mapping',
                  body: lang === 'zh' ? (
                    <div>
                      <p><strong>核心定义</strong>：成功关联并映射到对应板块基准指数（如金融、矿业、医疗等行业指数）的个股信号所占比例。</p>
                      <p><strong>如何看数</strong>：大字 <strong>{card.value}</strong> 为数据覆盖完整率。若达到 95% 以上，说明绝大部分信号均有行业基准作为对照，分解结果极具代表性。</p>
                      <p><strong>意义</strong>：代表分析样本的完整度。如果有太多股票被归入 'Unknown' 板块（无对应基准），则个股 Alpha 易受干扰。极高的覆盖率是确保收益分解科学有效的前提。</p>
                    </div>
                  ) : (
                    <div>
                      <p><strong>Core Definition</strong>: Percentage of stock signals successfully mapped to a specific sector benchmark index.</p>
                      <p><strong>Interpretation</strong>: Main number (<strong>{card.value}</strong>) shows the completeness of data. A rate &gt;= 95% represents high data integrity and reliability.</p>
                      <p><strong>Meaning</strong>: Ensures representative decomposition. When signals fail to map to a sector index, they default to comparing against themselves, inflating Selection Alpha. High coverage ensures scientific validity.</p>
                    </div>
                  )
                },
                ir: {
                  title: lang === 'zh' ? '📊 信息比率 IR (Information Ratio) ── 稳定性指示参考' : '📊 Info Ratio IR ── Return Stability & Consistency Metric',
                  body: lang === 'zh' ? (
                    <div>
                      <p><strong>核心定义</strong>：平均超额收益除以超额收益的日波动度（即风险调整后的平稳度）。</p>
                      <p><strong>如何看数</strong>：大字 <strong>{card.value}</strong> 为信息比率数值；右侧为平稳度评估标签。</p>
                      <p><strong>统计局限性提示</strong>：IR 值越高，说明策略获取超额收益的波动越小，表现越稳定。在学术上，当交易笔数 n &gt;= 30 且 IR &gt;= 0.5（对应 t值 &gt;= 2.0），表明超额收益具备平稳性。但请注意，由于同一天触发的信号之间存在相关性，且多日持有期存在重叠，标准 t 检验条件并不严格成立，该指标应作为**平稳度指示性参考**，而非绝对运气排除证明。</p>
                    </div>
                  ) : (
                    <div>
                      <p><strong>Core Definition</strong>: Active return divided by daily active volatility (measures return smoothness adjusted for tracking risk).</p>
                      <p><strong>Interpretation</strong>: Main number (<strong>{card.value}</strong>) is the IR value; small badge is the stability verdict.</p>
                      <p><strong>Statistical Disclaimer</strong>: Higher IR means more stable active outperformance. Statistically, an IR &gt;= 0.5 with n &gt;= 30 (t-stat &gt;= 2.0) indicates strong return consistency. However, because same-day signals are correlated and multi-day holds overlap, standard IID assumptions are violated. Treat this as an **indicative stability metric** rather than a strict statistical proof.</p>
                    </div>
                  )
                }
              };

              const exp = explanations[selectedCard];
              return (
                <div style={{
                  background: 'rgba(139, 92, 246, 0.04)',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem 1.5rem',
                  marginTop: '0.5rem',
                  fontSize: '0.78rem',
                  lineHeight: 1.6,
                  color: 'var(--text-2)',
                  position: 'relative',
                  animation: 'fadeIn 0.2s ease-out'
                }}>
                  <button
                    onClick={() => setSelectedCard(null)}
                    style={{
                      position: 'absolute', right: '12px', top: '12px',
                      background: 'transparent', border: 'none', color: 'var(--text-3)',
                      cursor: 'pointer', fontSize: '1rem', padding: '4px',
                      transition: 'color 0.15s'
                    }}
                    onMouseEnter={(e) => e.target.style.color = 'var(--text-1)'}
                    onMouseLeave={(e) => e.target.style.color = 'var(--text-3)'}
                  >
                    ✕
                  </button>
                  <h4 style={{ margin: '0 0 0.75rem 0', color: card.color, fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
                    {exp.title}
                  </h4>
                  <div className="custom-scrollbar" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {exp.body}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  // ── Standard (non-attribution) cards ───────────────────────────────────────
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
      
      {/* Card: Total signals / Portfolio Days */}
      <div className="metric-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', borderLeft: '4px solid var(--border)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          {activeTab === 'portfolio' 
            ? (lang === 'zh' ? '组合调仓天数' : 'Portfolio Days') 
            : t('totalSignalsLabel')}
        </div>
        <div className="font-mono" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-1)' }}>
          {activeTab === 'stock' && computedStats.total}
          {activeTab === 'sector' && computedSectorStats.total}
          {activeTab === 'portfolio' && (backtestData.portfolio_logs?.length || 0)}
        </div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: '0.35rem' }}>
          {activeTab === 'portfolio' 
            ? (lang === 'zh' ? '有触发信号的调仓交易日' : 'Trading days with alerts') 
            : 'Filtered signal events'}
        </div>
      </div>

      {/* Cards for periods */}
      {periods.map(p => {
        let stats = { win_rate: 0, avg_return: 0, sample_size: 0, max_drawdown: 0 };
        if (activeTab === 'stock') {
          stats = computedStats.overall[p] || stats;
        } else if (activeTab === 'sector') {
          stats = computedSectorStats.overall[p] || stats;
        } else if (activeTab === 'portfolio') {
          const pStats = backtestData.portfolio_stats?.[p] || {};
          const isExec = returnType === 'executable';
          stats = {
            win_rate: isExec ? pStats.win_rate_executable : pStats.win_rate,
            avg_return: isExec ? pStats.avg_return_executable : pStats.avg_return,
            sample_size: pStats.sample_size || 0,
            max_drawdown: isExec ? pStats.max_drawdown_executable : pStats.max_drawdown
          };
        }

        return (
          <div key={p} className="metric-card" style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border)', 
            borderRadius: 'var(--radius-md)', 
            padding: '1.25rem', 
            borderLeft: `4px solid ${stats.avg_return >= 0 ? 'var(--green)' : 'var(--red)'}` 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--cyan)' }}>{p.toUpperCase()} {t('holdingDays')}</span>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>N={stats.sample_size}</span>
                {stats.sample_size > 0 && getConfidenceBadge(stats.sample_size)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span className="font-mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-1)' }}>{stats.win_rate}%</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>Win</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.3rem', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-2)' }}>{t('avgReturnLabel')}:</span>
              <span className={`font-mono ${getReturnClass(stats.avg_return)}`} style={{ fontWeight: 700 }}>
                {formatReturn(stats.avg_return)}
              </span>
            </div>
            {activeTab === 'portfolio' && stats.max_drawdown !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '最大回撤' : 'Max DD'}:</span>
                <span className="font-mono" style={{ fontWeight: 600, color: 'var(--red)' }}>
                  {stats.max_drawdown.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

