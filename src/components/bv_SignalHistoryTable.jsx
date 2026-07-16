import React, { useState, useMemo, useEffect } from 'react';
import { SIGNAL_MAP, formatSectorName } from '../utils/translations';

export default function BvSignalHistoryTable({
  activeTab,
  lang,
  t,
  filteredLogs,
  filteredSectorLogs,
  backtestData,
  portfolioPeriod,
  returnType
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });

  useEffect(() => {
    setSortConfig({ key: null, direction: 'desc' });
  }, [activeTab]);

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      const defaultDescKeys = ['price', 'avg_chg', 'composite_score', '1d', '3d', '5d', '10d', 'ret'];
      const isDescDefault = defaultDescKeys.some(k => key.includes(k));
      return { key, direction: isDescDefault ? 'desc' : 'asc' };
    });
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <span style={{ opacity: 0.3, marginLeft: '4px', fontSize: '0.75rem' }}>↕</span>;
    }
    return <span style={{ color: 'var(--cyan)', marginLeft: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
  };

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

  const sortedStockLogs = useMemo(() => {
    if (!sortConfig.key) return filteredLogs;
    return [...filteredLogs].sort((a, b) => {
      let aVal, bVal;
      if (['1d', '3d', '5d', '10d'].includes(sortConfig.key)) {
        aVal = getLogReturnVal(a, sortConfig.key);
        bVal = getLogReturnVal(b, sortConfig.key);
      } else {
        aVal = a[sortConfig.key];
        bVal = b[sortConfig.key];
      }
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredLogs, sortConfig, returnType]);

  const sortedSectorLogs = useMemo(() => {
    if (!sortConfig.key) return filteredSectorLogs;
    return [...filteredSectorLogs].sort((a, b) => {
      let aVal, bVal;
      if (['1d', '3d', '5d', '10d'].includes(sortConfig.key)) {
        aVal = getLogReturnVal(a, sortConfig.key);
        bVal = getLogReturnVal(b, sortConfig.key);
      } else if (sortConfig.key === 'sector') {
        aVal = formatSectorName(a.sector, lang);
        bVal = formatSectorName(b.sector, lang);
      } else {
        aVal = a[sortConfig.key];
        bVal = b[sortConfig.key];
      }
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredSectorLogs, sortConfig, returnType, lang]);

  const flatPortfolioLogs = useMemo(() => {
    const logs = backtestData.portfolio_logs || [];
    const list = [];
    logs.forEach(day => {
      (day.selections || []).forEach(sel => {
        list.push({ date: day.date, ...sel });
      });
    });
    if (!sortConfig.key) return { isSorted: false, rawLogs: logs, flatList: list };

    const retKey = returnType === 'executable' ? `ret_${portfolioPeriod}_executable` : `ret_${portfolioPeriod}`;
    const sorted = [...list].sort((a, b) => {
      let aVal, bVal;
      if (sortConfig.key === 'ret') {
        aVal = a[retKey];
        bVal = b[retKey];
      } else {
        aVal = a[sortConfig.key];
        bVal = b[sortConfig.key];
      }
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return { isSorted: true, rawLogs: logs, flatList: sorted };
  }, [backtestData.portfolio_logs, sortConfig, returnType, portfolioPeriod]);

  return (
    <div className="module">
      <div className="section-header" style={{ marginBottom: '1.2rem' }}>
        <div className="section-icon">📋</div>
        <div>
          <div className="section-title">
            {activeTab === 'stock' && t('historicalLogsTitle')}
            {activeTab === 'sector' && (lang === 'zh' ? '板块历史推荐日志' : 'Sector History Logs')}
            {activeTab === 'portfolio' && (lang === 'zh' ? '组合调仓历史明细 (每日 Top 5)' : 'Portfolio Rebalancing Logs (Daily Top 5)')}
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {activeTab === 'stock' && (
          <table className="backtest-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-2)' }}>
                <th onClick={() => handleSort('date')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none' }}>{lang === 'zh' ? '日期' : 'Date'}{renderSortIcon('date')}</th>
                <th onClick={() => handleSort('symbol')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none' }}>{lang === 'zh' ? '代码' : 'Ticker'}{renderSortIcon('symbol')}</th>
                <th onClick={() => handleSort('signal')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none' }}>{lang === 'zh' ? '发出信号' : 'Signal'}{renderSortIcon('signal')}</th>
                <th onClick={() => handleSort('price')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none' }}>{lang === 'zh' ? '触发价' : 'Trigger Price'}{renderSortIcon('price')}</th>
                <th onClick={() => handleSort('1d')} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>1D Hold{renderSortIcon('1d')}</th>
                <th onClick={() => handleSort('3d')} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>3D Hold{renderSortIcon('3d')}</th>
                <th onClick={() => handleSort('5d')} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>5D Hold{renderSortIcon('5d')}</th>
                <th onClick={() => handleSort('10d')} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>10D Hold{renderSortIcon('10d')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedStockLogs.slice(0, 100).map((log, idx) => {
                const s_signal = SIGNAL_MAP[lang]?.[log.signal] || log.signal;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.02)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                    <td className="font-mono" style={{ padding: '0.75rem 1rem', color: 'var(--text-2)' }}>{log.date}</td>
                    <td className="font-mono" style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--cyan)' }}>{log.symbol}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className={`zone-badge ${log.signal.includes('主升浪') ? 'momentum' : 'accumulation'}`} style={{ padding: '0.1rem 0.35rem', fontSize: '0.68rem', borderRadius: '3px' }}>
                        {s_signal}
                      </span>
                    </td>
                    <td className="font-mono" style={{ padding: '0.75rem 1rem' }}>${log.price.toFixed(2)}</td>
                    <td className={`font-mono ${getReturnClass(getLogReturnVal(log, '1d'))}`} style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                      {formatReturn(getLogReturnVal(log, '1d'))}
                    </td>
                    <td className={`font-mono ${getReturnClass(getLogReturnVal(log, '3d'))}`} style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                      {formatReturn(getLogReturnVal(log, '3d'))}
                    </td>
                    <td className={`font-mono ${getReturnClass(getLogReturnVal(log, '5d'))}`} style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                      {formatReturn(getLogReturnVal(log, '5d'))}
                    </td>
                    <td className={`font-mono ${getReturnClass(getLogReturnVal(log, '10d'))}`} style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                      {formatReturn(getLogReturnVal(log, '10d'))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeTab === 'sector' && (
          <table className="backtest-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-2)' }}>
                <th onClick={() => handleSort('date')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none' }}>{lang === 'zh' ? '日期' : 'Date'}{renderSortIcon('date')}</th>
                <th onClick={() => handleSort('sector')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none' }}>{lang === 'zh' ? '板块名称' : 'Sector Name'}{renderSortIcon('sector')}</th>
                <th onClick={() => handleSort('signal')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none' }}>{lang === 'zh' ? '板块信号' : 'Sector Signal'}{renderSortIcon('signal')}</th>
                <th onClick={() => handleSort('avg_chg')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none' }}>{lang === 'zh' ? '当日均涨幅' : 'Day Avg Return'}{renderSortIcon('avg_chg')}</th>
                <th onClick={() => handleSort('1d')} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>1D Hold{renderSortIcon('1d')}</th>
                <th onClick={() => handleSort('3d')} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>3D Hold{renderSortIcon('3d')}</th>
                <th onClick={() => handleSort('5d')} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>5D Hold{renderSortIcon('5d')}</th>
                <th onClick={() => handleSort('10d')} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>10D Hold{renderSortIcon('10d')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedSectorLogs.slice(0, 100).map((log, idx) => {
                const s_signal = SIGNAL_MAP[lang]?.[log.signal] || log.signal;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.02)', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                    <td className="font-mono" style={{ padding: '0.75rem 1rem', color: 'var(--text-2)' }}>{log.date}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--cyan)' }}>{formatSectorName(log.sector, lang)}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className={`zone-badge ${log.zone === 'hot' ? 'momentum' : 'accumulation'}`} style={{ padding: '0.1rem 0.35rem', fontSize: '0.68rem', borderRadius: '3px' }}>
                        {s_signal}
                      </span>
                    </td>
                    <td className={`font-mono ${getReturnClass(log.avg_chg)}`} style={{ padding: '0.75rem 1rem' }}>{formatReturn(log.avg_chg)}</td>
                    <td className={`font-mono ${getReturnClass(getLogReturnVal(log, '1d'))}`} style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                      {formatReturn(getLogReturnVal(log, '1d'))}
                    </td>
                    <td className={`font-mono ${getReturnClass(getLogReturnVal(log, '3d'))}`} style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                      {formatReturn(getLogReturnVal(log, '3d'))}
                    </td>
                    <td className={`font-mono ${getReturnClass(getLogReturnVal(log, '5d'))}`} style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                      {formatReturn(getLogReturnVal(log, '5d'))}
                    </td>
                    <td className={`font-mono ${getReturnClass(getLogReturnVal(log, '10d'))}`} style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                      {formatReturn(getLogReturnVal(log, '10d'))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeTab === 'portfolio' && (
          <table className="backtest-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-2)' }}>
                <th onClick={() => handleSort('date')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none' }}>{lang === 'zh' ? '交易日期' : 'Date'}{renderSortIcon('date')}</th>
                <th onClick={() => handleSort('symbol')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none' }}>{lang === 'zh' ? '股票代码' : 'Ticker'}{renderSortIcon('symbol')}</th>
                <th onClick={() => handleSort('signal')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none' }}>{lang === 'zh' ? '推荐信号' : 'Signal'}{renderSortIcon('signal')}</th>
                <th onClick={() => handleSort('composite_score')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none' }}>{lang === 'zh' ? '综合评分' : 'Composite Score'}{renderSortIcon('composite_score')}</th>
                <th onClick={() => handleSort('price')} style={{ padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none' }}>{lang === 'zh' ? '调仓触发价' : 'Trigger Price'}{renderSortIcon('price')}</th>
                <th onClick={() => handleSort('ret')} style={{ padding: '0.75rem 1rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>{portfolioPeriod.toUpperCase()} {lang === 'zh' ? '持仓收益' : 'Return'}{renderSortIcon('ret')}</th>
              </tr>
            </thead>
            <tbody>
              {!flatPortfolioLogs.isSorted ? (
                flatPortfolioLogs.rawLogs.slice(0, 50).flatMap((dayLog, dayIdx) => {
                  return (dayLog.selections || []).map((sel, selIdx) => {
                    const s_signal = SIGNAL_MAP[lang]?.[sel.signal] || sel.signal;
                    const retKey = returnType === 'executable' ? `ret_${portfolioPeriod}_executable` : `ret_${portfolioPeriod}`;
                    const retVal = sel[retKey];
                    
                    return (
                      <tr 
                        key={`${dayLog.date}-${sel.symbol}`} 
                        style={{ 
                          borderBottom: selIdx === dayLog.selections.length - 1 ? '2px solid var(--border)' : '1px solid rgba(255, 255, 255, 0.02)',
                          background: dayIdx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' 
                        }}
                      >
                        {selIdx === 0 ? (
                          <td 
                            className="font-mono" 
                            rowSpan={dayLog.selections.length} 
                            style={{ 
                              padding: '0.75rem 1rem', 
                              color: 'var(--text-1)', 
                              fontWeight: 700, 
                              verticalAlign: 'top',
                              borderRight: '1px solid rgba(255,255,255,0.05)' 
                            }}
                          >
                            {dayLog.date}
                          </td>
                        ) : null}
                        <td className="font-mono" style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--cyan)' }}>{sel.symbol}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span className={`zone-badge ${sel.signal.includes('主升浪') ? 'momentum' : 'accumulation'}`} style={{ padding: '0.1rem 0.35rem', fontSize: '0.68rem', borderRadius: '3px' }}>
                            {s_signal}
                          </span>
                        </td>
                        <td className="font-mono" style={{ padding: '0.75rem 1rem', color: 'var(--gold)', fontWeight: 600 }}>{sel.composite_score.toFixed(1)}</td>
                        <td className="font-mono" style={{ padding: '0.75rem 1rem' }}>${sel.price.toFixed(2)}</td>
                        <td className={`font-mono ${getReturnClass(retVal)}`} style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                          {formatReturn(retVal)}
                        </td>
                      </tr>
                    );
                  });
                })
              ) : (
                flatPortfolioLogs.flatList.slice(0, 100).map((sel, idx) => {
                  const s_signal = SIGNAL_MAP[lang]?.[sel.signal] || sel.signal;
                  const retKey = returnType === 'executable' ? `ret_${portfolioPeriod}_executable` : `ret_${portfolioPeriod}`;
                  const retVal = sel[retKey];
                  return (
                    <tr 
                      key={`${sel.date}-${sel.symbol}-${idx}`} 
                      style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
                        background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' 
                      }}
                    >
                      <td className="font-mono" style={{ padding: '0.75rem 1rem', color: 'var(--text-2)' }}>{sel.date}</td>
                      <td className="font-mono" style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--cyan)' }}>{sel.symbol}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className={`zone-badge ${sel.signal.includes('主升浪') ? 'momentum' : 'accumulation'}`} style={{ padding: '0.1rem 0.35rem', fontSize: '0.68rem', borderRadius: '3px' }}>
                          {s_signal}
                        </span>
                      </td>
                      <td className="font-mono" style={{ padding: '0.75rem 1rem', color: 'var(--gold)', fontWeight: 600 }}>{sel.composite_score.toFixed(1)}</td>
                      <td className="font-mono" style={{ padding: '0.75rem 1rem' }}>${sel.price.toFixed(2)}</td>
                      <td className={`font-mono ${getReturnClass(retVal)}`} style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                        {formatReturn(retVal)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* Truncation warnings */}
        {activeTab === 'stock' && filteredLogs.length > 100 && (
          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-3)', fontSize: '0.75rem' }}>
            {lang === 'zh' 
              ? `已截断显示，上方仅展示最新的 100 条信号（当前共筛选出 ${filteredLogs.length} 条记录）` 
              : `Showing latest 100 signals (Filtered ${filteredLogs.length} records total)`
            }
          </div>
        )}

        {activeTab === 'sector' && filteredSectorLogs.length > 100 && (
          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-3)', fontSize: '0.75rem' }}>
            {lang === 'zh' 
              ? `已截断显示，上方仅展示最新的 100 条信号（当前共筛选出 ${filteredSectorLogs.length} 条记录）` 
              : `Showing latest 100 signals (Filtered ${filteredSectorLogs.length} records total)`
            }
          </div>
        )}

        {activeTab === 'portfolio' && (backtestData.portfolio_logs || []).length > 50 && (
          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-3)', fontSize: '0.75rem' }}>
            {lang === 'zh' 
              ? `已截断显示，上方仅展示最新的 50 个交易日（当前共 ${(backtestData.portfolio_logs || []).length} 个交易日）` 
              : `Showing latest 50 days (Total ${(backtestData.portfolio_logs || []).length} portfolio days)`
            }
          </div>
        )}
      </div>
    </div>
  );
}
