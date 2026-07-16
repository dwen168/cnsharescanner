import React, { useState, useMemo, useEffect } from 'react';
import { getT, formatSectorName } from '../utils/translations';
import BvFilterPanel from './bv_FilterPanel';
import BvMetricCardGrid from './bv_MetricCardGrid';
import BvStatsBreakdown from './bv_StatsBreakdown';
import BvReturnsCurveChart from './bv_ReturnsCurveChart';
import BvSignalHistoryTable from './bv_SignalHistoryTable';
import BvAttributionTimeseries from './bv_AttributionTimeseries';
import { computeAttribution } from '../utils/attributionAnalyzer';

export default function BacktestView({ 
  backtestData, 
  lang, 
  versionsData = { latest: '', versions: [] }, 
  selectedVersion = '', 
  onVersionChange = () => {},
  backtestMode = 'audit',
  onModeChange = () => {},
  mainData = null
}) {
  const t = getT(lang);

  if (!backtestData || backtestData.status === 'pending') {
    return (
      <div className="loading-screen" style={{ minHeight: '60vh' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📊</div>
        <div className="loading-text" style={{ maxWidth: '400px', lineHeight: 1.5, textAlign: 'center' }}>
          {backtestData?.message || (lang === 'zh' ? '暂无当前模式的回测数据，请运行 analysis_engine.py 并在数据库中补充数据。' : 'No backtest data for this mode. Run analysis_engine.py to populate.')}
        </div>
      </div>
    );
  }

  const { logs, sector_logs } = backtestData;

  // Active Tab state: 'stock' | 'sector' | 'portfolio' | 'attribution'
  const [activeTab, setActiveTab] = useState('stock');
  const [returnType, setReturnType] = useState('executable');
  const [portfolioPeriod, setPortfolioPeriod] = useState('5d');
  const [signalType, setSignalType] = useState('all'); // 'all' | 'bull' | 'bear'
  const [attributionPeriod, setAttributionPeriod] = useState('5d');

  // --- Date Range Bounds & Initialization ---
  const datesSorted = useMemo(() => {
    const sLogs = logs || [];
    const secLogs = sector_logs || [];
    const allDates = [...sLogs.map(l => l.date), ...secLogs.map(l => l.date)];
    if (allDates.length === 0) return [];
    return [...new Set(allDates)].sort();
  }, [logs, sector_logs]);

  const maxDateStr = datesSorted[datesSorted.length - 1] || new Date().toISOString().split('T')[0];
  const earliestDateStr = datesSorted[0] || '2026-04-27';
  
  const defaultStartDateStr = earliestDateStr;

  // --- Common Filters State ---
  const [filterDate, setFilterDate] = useState('');
  const [filterStartDate, setFilterStartDate] = useState(defaultStartDateStr);
  const [filterEndDate, setFilterEndDate] = useState(maxDateStr);
  const [onlyRadar, setOnlyRadar] = useState(false);
  const [filterSector, setFilterSector] = useState('');

  // Build { symbol -> sectorName } from mainData.sectors (data.json)
  const sectorMap = useMemo(() => {
    const map = {};
    const sectors = (mainData && mainData.sectors) ? mainData.sectors : [];
    sectors.forEach(sec => {
      (sec.stocks || []).forEach(stk => {
        if (stk.symbol) map[stk.symbol] = sec.name;
      });
    });
    return map;
  }, [mainData]);

  // Synchronize state when backtestData changes (e.g., toggling between Audit and Replay modes, or version changes)
  useEffect(() => {
    setFilterStartDate(defaultStartDateStr);
    setFilterEndDate(maxDateStr);
    setFilterDate('');
    setOnlyRadar(false);
  }, [backtestData, defaultStartDateStr, maxDateStr]);

  // --- 1. Stock Specific States & Logic ---
  const [filterTicker, setFilterTicker] = useState('');
  
  const uniqueSymbols = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    return [...new Set(logs.map(l => l.symbol))].sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter(log => {
      const tickerMatch = !filterTicker || log.symbol.toUpperCase().includes(filterTicker.toUpperCase());
      const dateMatch = filterDate 
        ? log.date === filterDate
        : ((!filterStartDate || log.date >= filterStartDate) && (!filterEndDate || log.date <= filterEndDate));
      const radarMatch = !onlyRadar || log.zone === 'momentum' || log.zone === 'accumulation';
      // Signal type filter
      const bearZone = log.bear_zone || 'neutral';
      const signalTypeMatch =
        signalType === 'all'  ? true :
        signalType === 'bull' ? (log.zone === 'momentum' || log.zone === 'accumulation') :
        /* bear */              (bearZone === 'distribution' || bearZone === 'distribution_lite');

      // Sector filter (maps symbol to sector)
      const sectorName = sectorMap ? (sectorMap[log.symbol] || '') : '';
      const sectorMatch = !filterSector || sectorName.toLowerCase().includes(filterSector.toLowerCase());

      return tickerMatch && dateMatch && radarMatch && signalTypeMatch && sectorMatch;
    });
  }, [logs, filterTicker, filterDate, filterStartDate, filterEndDate, onlyRadar, signalType, filterSector, sectorMap]);

  const periods = ['1d', '3d', '5d', '10d'];

  const computedStats = useMemo(() => {
    const total = filteredLogs.length;
    const overall = {};
    const isExec = returnType === 'executable';
    const isBear = signalType === 'bear'; // bear mode: return < 0 = win
    
    periods.forEach(p => {
      const col = isExec ? `ret_${p}_executable` : `ret_${p}`;
      const valid = filteredLogs.filter(l => l[col] !== null && l[col] !== undefined);
      if (valid.length > 0) {
        const wins = isBear
          ? valid.filter(l => l[col] < 0).length   // bear: price fell = correct prediction
          : valid.filter(l => l[col] > 0).length;
        const win_rate = (wins / valid.length) * 100;
        const avg_return = valid.reduce((sum, l) => sum + l[col], 0) / valid.length;
        overall[p] = {
          win_rate: round(win_rate, 2),
          avg_return: round(avg_return, 2),
          sample_size: valid.length
        };
      } else {
        overall[p] = { win_rate: 0, avg_return: 0, sample_size: 0 };
      }
    });

    const by_zone = { momentum: {}, accumulation: {}, distribution: {}, distribution_lite: {} };
    ['momentum', 'accumulation', 'distribution', 'distribution_lite'].forEach(zone => {
      const isBearZone = zone === 'distribution' || zone === 'distribution_lite';
      const zoneLogs = zone === 'distribution' || zone === 'distribution_lite'
        ? filteredLogs.filter(l => (l.bear_zone || 'neutral') === zone)
        : filteredLogs.filter(l => l.zone === zone);
      periods.forEach(p => {
        const col = isExec ? `ret_${p}_executable` : `ret_${p}`;
        const valid = zoneLogs.filter(l => l[col] !== null && l[col] !== undefined);
        if (valid.length > 0) {
          const wins = isBearZone
            ? valid.filter(l => l[col] < 0).length
            : valid.filter(l => l[col] > 0).length;
          const win_rate = (wins / valid.length) * 100;
          const avg_return = valid.reduce((sum, l) => sum + l[col], 0) / valid.length;
          by_zone[zone][p] = {
            win_rate: round(win_rate, 2),
            avg_return: round(avg_return, 2),
            sample_size: valid.length
          };
        } else {
          by_zone[zone][p] = { win_rate: 0, avg_return: 0, sample_size: 0 };
        }
      });
    });

    return { total, overall, by_zone, isBear };
  }, [filteredLogs, returnType, signalType]);

  // --- Attribution Analysis ---
 
  // Compute signal return decomposition result for the selected period
  const attributionResult = useMemo(() => {
    if (!filteredLogs || filteredLogs.length === 0) return null;
    if (!backtestData || !backtestData.sector_logs) return null;
    try {
      return computeAttribution({
        logs: filteredLogs,
        sectorLogs: backtestData.sector_logs,
        sectorMap,
        period: attributionPeriod,
        returnType,
        isBear: signalType === 'bear',
      });
    } catch (e) {
      console.warn('Attribution computation error:', e);
      return null;
    }
  }, [filteredLogs, backtestData, sectorMap, attributionPeriod, returnType, signalType]);

  // --- 2. Sector Specific States & Logic ---

  const uniqueSectors = useMemo(() => {
    if (!sector_logs || sector_logs.length === 0) return [];
    return [...new Set(sector_logs.map(l => l.sector))].sort();
  }, [sector_logs]);

  const filteredSectorLogs = useMemo(() => {
    if (!sector_logs) return [];
    return sector_logs.filter(log => {
      const sectorMatch = !filterSector || log.sector.toLowerCase().includes(filterSector.toLowerCase());
      const dateMatch = filterDate 
        ? log.date === filterDate
        : ((!filterStartDate || log.date >= filterStartDate) && (!filterEndDate || log.date <= filterEndDate));
      return sectorMatch && dateMatch;
    });
  }, [sector_logs, filterSector, filterDate, filterStartDate, filterEndDate]);

  const computedSectorStats = useMemo(() => {
    const total = filteredSectorLogs.length;
    const overall = {};
    const isExec = returnType === 'executable';
    
    periods.forEach(p => {
      const col = isExec ? `ret_${p}_executable` : `ret_${p}`;
      const valid = filteredSectorLogs.filter(l => l[col] !== null && l[col] !== undefined);
      if (valid.length > 0) {
        const wins = valid.filter(l => l[col] > 0).length;
        const win_rate = (wins / valid.length) * 100;
        const avg_return = valid.reduce((sum, l) => sum + l[col], 0) / valid.length;
        overall[p] = {
          win_rate: round(win_rate, 2),
          avg_return: round(avg_return, 2),
          sample_size: valid.length
        };
      } else {
        overall[p] = { win_rate: 0, avg_return: 0, sample_size: 0 };
      }
    });

    // Breakdown by sector
    const by_sector = {};
    uniqueSectors.forEach(sec => {
      by_sector[sec] = {};
      const secLogs = filteredSectorLogs.filter(l => l.sector === sec);
      periods.forEach(p => {
        const col = isExec ? `ret_${p}_executable` : `ret_${p}`;
        const valid = secLogs.filter(l => l[col] !== null && l[col] !== undefined);
        if (valid.length > 0) {
          const wins = valid.filter(l => l[col] > 0).length;
          const win_rate = (wins / valid.length) * 100;
          const avg_return = valid.reduce((sum, l) => sum + l[col], 0) / valid.length;
          by_sector[sec][p] = {
            win_rate: round(win_rate, 2),
            avg_return: round(avg_return, 2),
            sample_size: valid.length
          };
        } else {
          by_sector[sec][p] = { win_rate: 0, avg_return: 0, sample_size: 0 };
        }
      });
    });

    return { total, overall, by_sector };
  }, [filteredSectorLogs, uniqueSectors, returnType]);


  // Helper utilities
  function round(value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
  }

  const getReturnClass = (val) => {
    if (val === null || val === undefined) return '';
    return val > 0 ? 'pos' : (val < 0 ? 'neg' : '');
  };

  const formatReturn = (val) => {
    if (val === null || val === undefined) return '-';
    return `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;
  };

  const getLogReturnVal = (log, period) => {
    const key = returnType === 'executable' ? `ret_${period}_executable` : `ret_${period}`;
    return log[key];
  };

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

  // SVG Chart rendering
  const chartWidth = 600;
  const chartHeight = 220;
  const chartPadding = { top: 20, right: 30, bottom: 30, left: 50 };

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
    <div className="backtest-view" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1.5rem 0' }}>
      
      {/* 1. Header description */}
      <div className="module" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--cyan)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📊</span> {t('backtestTitle')}
        </h2>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
          {backtestMode === 'audit'
            ? (lang === 'zh' ? '已上线信号审计：评估生产环境数据库中记录的真实信号在发出后 1D、3D、5D、10D 后的持股表现。' : 'Signal Audit: Evaluates actual production signals recorded in database over subsequent holding periods.')
            : (lang === 'zh' ? '策略历史重放：以最新策略量化规则为基础，对过去两年历史交易数据进行滑动窗口重跑，模拟如果当时使用该规则会产生的信号与收益表现。' : 'Strategy Replay: Steps through 2-year daily historical records and simulates triggers of the current strategy rules, strictly avoiding look-ahead bias.')
          }
        </p>
        
        {/* Launch Date & AI Sentiment Warning Note (Only for Replay Mode) */}
        {backtestMode === 'replay' && (
          <div style={{ 
            marginTop: '0.8rem', 
            fontSize: '0.78rem', 
            color: 'var(--gold)', 
            background: 'rgba(246, 201, 14, 0.04)', 
            border: '1px dashed rgba(246, 201, 14, 0.3)',
            padding: '0.6rem 0.85rem',
            borderRadius: '4px',
            lineHeight: 1.4
          }}>
            {lang === 'zh' 
              ? '💡 系统说明：本系统于 2026-06-19 正式上线。在此日期前的“策略历史重放”仅基于纯技术指标规则（如RSI、MA等）进行模拟分析；2026-06-19 及之后的信号回测才包含真实的 AI 新闻舆情综合打分。'
              : '💡 System Note: The system officially launched on 2026-06-19. "Strategy Replay" before this date is simulated purely based on technical indicators (e.g., RSI, MA); live AI news sentiment composite scores are only integrated starting from 2026-06-19.'
            }
          </div>
        )}
      </div>

      {/* Backtesting Mode Selector (Audit vs Replay) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
        <button
          onClick={() => onModeChange('audit')}
          style={{
            background: backtestMode === 'audit' ? 'rgba(0, 212, 255, 0.08)' : 'transparent',
            border: '1px solid',
            borderColor: backtestMode === 'audit' ? 'var(--cyan)' : 'var(--border)',
            color: backtestMode === 'audit' ? 'var(--cyan)' : 'var(--text-2)',
            padding: '0.6rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 700,
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            textAlign: 'left'
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>🎯</span>
          <div>
            <div style={{ fontSize: '0.88rem', color: backtestMode === 'audit' ? 'var(--cyan)' : 'var(--text-1)' }}>
              {lang === 'zh' ? '已上线信号审计 (Audit)' : 'Signal Audit'}
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: 400, opacity: 0.8, marginTop: '0.15rem' }}>
              {lang === 'zh' ? '评估线上已生成信号的真实收益' : 'Actual performance of historical live signals'}
            </div>
          </div>
        </button>

        <button
          onClick={() => onModeChange('replay')}
          style={{
            background: backtestMode === 'replay' ? 'rgba(0, 212, 255, 0.08)' : 'transparent',
            border: '1px solid',
            borderColor: backtestMode === 'replay' ? 'var(--cyan)' : 'var(--border)',
            color: backtestMode === 'replay' ? 'var(--cyan)' : 'var(--text-2)',
            padding: '0.6rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 700,
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            textAlign: 'left'
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>🔄</span>
          <div>
            <div style={{ fontSize: '0.88rem', color: backtestMode === 'replay' ? 'var(--cyan)' : 'var(--text-1)' }}>
              {lang === 'zh' ? '策略历史重放 (Replay)' : 'Strategy Replay'}
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: 400, opacity: 0.8, marginTop: '0.15rem' }}>
              {lang === 'zh' ? '使用新策略规则重跑 2 年历史数据' : 'Simulation of current rules over 2y price history'}
            </div>
          </div>
        </button>
      </div>

      {/* Tabs Selector */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        background: 'rgba(255,255,255,0.02)',
        padding: '0.25rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        width: 'fit-content',
        maxWidth: '100%'
      }}>
        <button 
          onClick={() => setActiveTab('stock')}
          title={lang === 'zh' ? '统计每个独立信号触发事件在未来持有 1D/3D/5D/10D 后的个股胜率与收益。用于评估“单一信号预测的准确度”。' : 'Stats for each independent stock signal trigger. Measures single-signal prediction accuracy.'}
          style={{
            background: activeTab === 'stock' ? 'var(--cyan)' : 'transparent',
            border: 'none',
            color: activeTab === 'stock' ? 'black' : 'var(--text-2)',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '0.45rem 1.2rem',
            borderRadius: 'var(--radius-sm)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <span>📈</span> {lang === 'zh' ? '个股信号回测' : 'Stock Backtest'}
        </button>
        <button 
          onClick={() => setActiveTab('sector')}
          title={lang === 'zh' ? '统计整个行业板块进入热点区间后的板块整体平均收益率。用于评估“行业板块轮动的强弱”。' : 'Stats for the entire sector average return after sector triggers a hot alert. Measures sector rotation strength.'}
          style={{
            background: activeTab === 'sector' ? 'var(--cyan)' : 'transparent',
            border: 'none',
            color: activeTab === 'sector' ? 'black' : 'var(--text-2)',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '0.45rem 1.2rem',
            borderRadius: 'var(--radius-sm)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <span>📂</span> {lang === 'zh' ? '板块信号回测' : 'Sector Backtest'}
        </button>
        <button 
          onClick={() => setActiveTab('portfolio')}
          title={lang === 'zh' ? '每日从触发信号的股票中按综合技术分优选 Top-5 股票，等资比例每日调仓，复利计算整体资产净值曲线（Equity Curve）。用于评估“实盘多股组合轮动的真实投资收益与回撤”。' : 'Picks Top-5 stocks by scores, allocates capital equally, rebalances daily, and plots the compounded portfolio net asset value (Equity Curve). Measures practical portfolio returns.'}
          style={{
            background: activeTab === 'portfolio' ? 'var(--cyan)' : 'transparent',
            border: 'none',
            color: activeTab === 'portfolio' ? 'black' : 'var(--text-2)',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '0.45rem 1.2rem',
            borderRadius: 'var(--radius-sm)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <span>💼</span> {lang === 'zh' ? '等权组合回测' : 'Portfolio Backtest'}
        </button>
        <button 
          onClick={() => setActiveTab('attribution')}
          title={lang === 'zh' ? '将信号收益正交拆解为行业基准 Beta、配置超额、选股 Alpha，评估选股与时机实力。' : 'Decompose signal returns into Sector Beta, Allocation Excess, and Selection Alpha.'}
          style={{
            background: activeTab === 'attribution' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
            border: activeTab === 'attribution' ? '1px solid rgba(139, 92, 246, 0.6)' : '1px solid transparent',
            color: activeTab === 'attribution' ? 'rgb(167, 139, 250)' : 'var(--text-2)',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '0.45rem 1.2rem',
            borderRadius: 'var(--radius-sm)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <span>🔬</span> {t('attrTabLabel')}
        </button>
      </div>

      {/* Tab description helper */}
      <div style={{ 
        fontSize: '0.8rem', 
        color: 'var(--text-2)', 
        background: 'rgba(255,255,255,0.01)', 
        borderLeft: '3px solid var(--cyan)', 
        padding: '0.75rem 1.25rem', 
        borderRadius: '4px',
        lineHeight: 1.6,
        border: '1px solid var(--border)',
        borderLeftColor: activeTab === 'attribution' ? 'rgb(139,92,246)' : 'var(--cyan)'
      }}>
        {activeTab === 'stock' && (
          lang === 'zh' 
            ? '💡 个股信号回测：统计每一个独立信号触发事件在未来 1D、3D、5D、10D 后的个股涨跌。该模式下 BHP 周一触发信号和 CBA 周二触发信号是各自独立计算的。用于评估「单一信号预测个股后续表现的准确度」。'
            : '💡 Stock Backtest: Stats for each independent stock signal trigger over future holding periods. Triggers for BHP on Monday and CBA on Tuesday are evaluated separately. Measures "single-signal prediction accuracy".'
        )}
        {activeTab === 'sector' && (
          lang === 'zh' 
            ? '💡 板块信号回测：当板块被诊断为「资金涌入/热点爆发」时，统计该板块内所有成分股的未来平均收益率。用于评估「行业板块轮动的强弱和防御效果」。'
            : '💡 Sector Backtest: Stats for the entire sector average return after sector triggers a hot alert. Measures "sector rotation strength".'
        )}
        {activeTab === 'portfolio' && (
          lang === 'zh' 
            ? '💡 等权组合回测：模拟一个真实的交易资金账户。如果某天触发了 10 只股票信号，策略会根据个股的技术面综合得分优选前 5 只（Top-5），等资金比例配资，进行每日滚动调仓，并以复利计算资产净值曲线（Equity Curve），扣除双边交易磨损。'
            : '💡 Portfolio Backtest: Simulates a real-money trading account. Picks Top-5 by scores, allocates equally, rebalances daily, compounds net asset value (Equity Curve), and deducts transaction costs.'
        )}
        {activeTab === 'attribution' && (
          lang === 'zh' 
            ? '🔬 信号收益分解：正交拆解单笔信号收益来源为「行业基准Beta + 配置超额 + 选股Alpha」。信息比率 IR = avg(α)/std(α) 评估超额稳定性。由于同日相关性和持仓重叠，IR与t值仅供指示性参考，建议使用 Replay 模式（样本量更大）。'
            : '🔬 Signal Return Decomposition: Decomposes each signal return into Sector Beta + Allocation Excess + Selection Alpha. IR = avg(α)/std(α) measures risk-adjusted return stability. Due to cross-sectional correlation and overlaps, IR & t-statistic serve as indicative metrics, switch to Replay mode for larger sample size.'
        )}
      </div>

      {/* 2. Dynamic Filter Panel */}
      <BvFilterPanel
        activeTab={activeTab}
        lang={lang}
        filterTicker={filterTicker}
        setFilterTicker={setFilterTicker}
        filterSector={filterSector}
        setFilterSector={setFilterSector}
        filterDate={filterDate}
        setFilterDate={setFilterDate}
        filterStartDate={filterStartDate}
        setFilterStartDate={setFilterStartDate}
        filterEndDate={filterEndDate}
        setFilterEndDate={setFilterEndDate}
        returnType={returnType}
        setReturnType={setReturnType}
        selectedVersion={selectedVersion}
        onVersionChange={onVersionChange}
        versionsData={versionsData}
        defaultStartDateStr={defaultStartDateStr}
        maxDateStr={maxDateStr}
        earliestDateStr={earliestDateStr}
        uniqueSymbols={uniqueSymbols}
        uniqueSectors={uniqueSectors}
        datesSorted={datesSorted}
        formatSectorName={formatSectorName}
        onlyRadar={onlyRadar}
        setOnlyRadar={setOnlyRadar}
        signalType={signalType}
        setSignalType={setSignalType}
      />

      {/* 3. Overall Stats Cards Grid */}
      <BvMetricCardGrid
        activeTab={activeTab}
        lang={lang}
        t={t}
        computedStats={computedStats}
        computedSectorStats={computedSectorStats}
        backtestData={backtestData}
        periods={periods}
        returnType={returnType}
        attributionResult={attributionResult}
        attributionPeriod={attributionPeriod}
        setAttributionPeriod={setAttributionPeriod}
      />

      {/* 4. Zone/Sector Breakdown Table & SVG Curves (hidden in attribution tab) */}
      {activeTab !== 'attribution' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
          <BvStatsBreakdown
            activeTab={activeTab}
            lang={lang}
            t={t}
            periods={periods}
            computedStats={computedStats}
            computedSectorStats={computedSectorStats}
            uniqueSectors={uniqueSectors}
            backtestData={backtestData}
            portfolioPeriod={portfolioPeriod}
            setPortfolioPeriod={setPortfolioPeriod}
            returnType={returnType}
            attributionResult={null}
            attributionPeriod={attributionPeriod}
            setAttributionPeriod={setAttributionPeriod}
          />
          <BvReturnsCurveChart
            activeTab={activeTab}
            lang={lang}
            portfolioPeriod={portfolioPeriod}
            periods={periods}
            computedStats={computedStats}
            computedSectorStats={computedSectorStats}
            backtestData={backtestData}
          />
        </div>
      )}

      {/* 4b. Attribution Timeseries Chart (full-width, shown only in attribution tab) */}
      {activeTab === 'attribution' && (
        <BvAttributionTimeseries
          attributionResult={attributionResult}
          lang={lang}
          t={t}
          period={attributionPeriod}
        />
      )}

      {/* 4c. Attribution Drilldown Table (shown only in attribution tab) */}
      {activeTab === 'attribution' && (
        <BvStatsBreakdown
          activeTab={activeTab}
          lang={lang}
          t={t}
          periods={periods}
          computedStats={computedStats}
          computedSectorStats={computedSectorStats}
          uniqueSectors={uniqueSectors}
          backtestData={backtestData}
          portfolioPeriod={portfolioPeriod}
          setPortfolioPeriod={setPortfolioPeriod}
          returnType={returnType}
          attributionResult={attributionResult}
          attributionPeriod={attributionPeriod}
          setAttributionPeriod={setAttributionPeriod}
        />
      )}

      {/* 5. Historical Signal Log Table */}
      {activeTab !== 'attribution' && (
        <BvSignalHistoryTable
          activeTab={activeTab}
          lang={lang}
          t={t}
          filteredLogs={filteredLogs}
          filteredSectorLogs={filteredSectorLogs}
          backtestData={backtestData}
          portfolioPeriod={portfolioPeriod}
          returnType={returnType}
        />
      )}
    </div>
  );
}
