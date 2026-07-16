import React from 'react';

export default function BvFilterPanel({
  activeTab,
  lang,
  filterTicker,
  setFilterTicker,
  filterSector,
  setFilterSector,
  filterDate,
  setFilterDate,
  filterStartDate,
  setFilterStartDate,
  filterEndDate,
  setFilterEndDate,
  returnType,
  setReturnType,
  selectedVersion,
  onVersionChange,
  versionsData,
  defaultStartDateStr,
  maxDateStr,
  earliestDateStr,
  uniqueSymbols,
  uniqueSectors,
  datesSorted,
  formatSectorName,
  onlyRadar,
  setOnlyRadar,
  signalType,
  setSignalType
}) {
  return (
    <div className="filter-panel" style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '1rem',
      padding: '1rem 1.25rem',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      alignItems: 'center'
    }}>
      {/* Ticker Input (Only Stock Tab) */}
      {activeTab === 'stock' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-2)', fontWeight: 600 }}>
            {lang === 'zh' ? '输入/选择股票代码' : 'Stock Symbol'}
          </label>
          <input 
            type="text" 
            placeholder="e.g. CBA" 
            value={filterTicker} 
            onChange={(e) => setFilterTicker(e.target.value)} 
            list="ticker-list"
            style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '0.4rem 0.6rem',
              color: 'var(--text-1)',
              fontSize: '0.8rem',
              fontFamily: 'var(--mono)',
              width: '150px'
            }}
          />
          <datalist id="ticker-list">
            {uniqueSymbols.map(sym => <option key={sym} value={sym} />)}
          </datalist>
        </div>
      )}

      {/* Sector Selection (Sector and Attribution Tabs) */}
      {(activeTab === 'sector' || activeTab === 'attribution') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-2)', fontWeight: 600 }}>
            {lang === 'zh' ? '选择板块' : 'Select Sector'}
          </label>
          <select 
            value={filterSector} 
            onChange={(e) => setFilterSector(e.target.value)}
            style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '0.4rem 0.6rem',
              color: 'var(--text-1)',
              fontSize: '0.8rem',
              width: '180px',
              cursor: 'pointer'
            }}
          >
            <option value="">{lang === 'zh' ? '全部板块' : 'All Sectors'}</option>
            {uniqueSectors.map(sec => (
              <option key={sec} value={sec}>
                {formatSectorName(sec, lang)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Specific Date Filter */}
      <div 
        style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
        title={activeTab === 'portfolio' 
          ? (lang === 'zh' ? '等权组合回测采用连续复利序列计算，不支持指定单一信号日期进行过滤筛选。' : 'Portfolio backtest uses continuous series; filtering by a single signal date is disabled.')
          : (lang === 'zh' ? '筛选出特定某一天触发的信号事件进行分析（仅保留该日信号，重新计算相关图表指标）。' : 'Filters signal events triggered on a specific date for targeted analysis.')}
      >
        <label style={{ fontSize: '0.72rem', color: (filterDate || activeTab === 'portfolio') ? 'var(--text-3)' : 'var(--text-2)', fontWeight: 600 }}>
          {lang === 'zh' ? '信号出现日期' : 'Signal Date'}
        </label>
        <input 
          type="date" 
          value={filterDate} 
          onChange={(e) => setFilterDate(e.target.value)} 
          disabled={activeTab === 'portfolio'}
          min={earliestDateStr}
          max={maxDateStr}
          list="signal-date-list"
          style={{
            background: activeTab === 'portfolio' ? 'var(--bg-card-subtle)' : 'var(--bg-hover)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '0.4rem 0.6rem',
            color: activeTab === 'portfolio' ? 'var(--text-3)' : 'var(--text-1)',
            fontSize: '0.8rem',
            fontFamily: 'var(--mono)',
            width: '150px',
            opacity: activeTab === 'portfolio' ? 0.5 : 1,
            cursor: activeTab === 'portfolio' ? 'not-allowed' : 'auto'
          }}
        />
        <datalist id="signal-date-list">
          {datesSorted.map(d => <option key={d} value={d} />)}
        </datalist>
      </div>

      {/* Start Date */}
      <div 
        style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
        title={activeTab === 'portfolio'
          ? (lang === 'zh' 
              ? `组合回测采用预计算复利序列，不支持日期范围筛选。受限于前置指标（MA60等）60日预热期和数据库历史深度限制，数据最早追溯至 ${earliestDateStr}。` 
              : `Portfolio backtest uses pre-calculated sequences; date range selection is disabled. Starts from ${earliestDateStr} due to 60-day warm-up window.`)
          : (lang === 'zh' 
              ? `控制回测的起始日期。过滤并重新计算选定日期区间内的信号总数、平均胜率、收益率、收益走势曲线及历史日志明细（本批次数据最远追溯至 ${earliestDateStr}）。` 
              : `Controls the start date of the backtest. Filters and recalculates sample sizes, average win rates, returns, equity curves, and logs within this range (dataset starts from ${earliestDateStr}).`)}
      >
        <label style={{ fontSize: '0.72rem', color: (filterDate || activeTab === 'portfolio') ? 'var(--text-3)' : 'var(--text-2)', fontWeight: 600 }}>
          {lang === 'zh' ? '开始日期' : 'Start Date'}
        </label>
        <input 
          type="date" 
          value={filterStartDate} 
          onChange={(e) => setFilterStartDate(e.target.value)} 
          disabled={!!filterDate || activeTab === 'portfolio'}
          min={earliestDateStr}
          max={maxDateStr}
          style={{
            background: (filterDate || activeTab === 'portfolio') ? 'var(--bg-card-subtle)' : 'var(--bg-hover)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '0.4rem 0.6rem',
            color: (filterDate || activeTab === 'portfolio') ? 'var(--text-3)' : 'var(--text-1)',
            fontSize: '0.8rem',
            fontFamily: 'var(--mono)',
            opacity: (filterDate || activeTab === 'portfolio') ? 0.5 : 1,
            cursor: (filterDate || activeTab === 'portfolio') ? 'not-allowed' : 'auto'
          }}
        />
      </div>

      {/* End Date */}
      <div 
        style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
        title={activeTab === 'portfolio'
          ? (lang === 'zh' 
              ? `组合回测采用预计算复利序列，不支持日期范围筛选。受限于前置指标（MA60等）60日预热期和数据库历史深度限制，数据最早追溯至 ${earliestDateStr}。` 
              : `Portfolio backtest uses pre-calculated sequences; date range selection is disabled. Starts from ${earliestDateStr} due to 60-day warm-up window.`)
          : (lang === 'zh' 
              ? '控制回测的结束日期。过滤并重新计算选定日期区间内的信号总数、平均胜率、收益率、收益走势曲线及历史日志明细。' 
              : 'Controls the end date of the backtest. Filters and recalculates sample sizes, average win rates, returns, equity curves, and logs within this range.')}
      >
        <label style={{ fontSize: '0.72rem', color: (filterDate || activeTab === 'portfolio') ? 'var(--text-3)' : 'var(--text-2)', fontWeight: 600 }}>
          {lang === 'zh' ? '结束日期' : 'End Date'}
        </label>
        <input 
          type="date" 
          value={filterEndDate} 
          onChange={(e) => setFilterEndDate(e.target.value)} 
          disabled={!!filterDate || activeTab === 'portfolio'}
          min={earliestDateStr}
          max={maxDateStr}
          style={{
            background: (filterDate || activeTab === 'portfolio') ? 'var(--bg-card-subtle)' : 'var(--bg-hover)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '0.4rem 0.6rem',
            color: (filterDate || activeTab === 'portfolio') ? 'var(--text-3)' : 'var(--text-1)',
            fontSize: '0.8rem',
            fontFamily: 'var(--mono)',
            opacity: (filterDate || activeTab === 'portfolio') ? 0.5 : 1,
            cursor: (filterDate || activeTab === 'portfolio') ? 'not-allowed' : 'auto'
          }}
        />
      </div>

      {/* Return Type Toggle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <label 
          title={lang === 'zh' ? '可执行收益：以次日开盘价买入计算的真实交割收益；理论收益：以当日收盘价买入计算的理论收益。' : 'Executable: real returns bought at next day open; Theoretical: theoretical returns bought at signal day close.'}
          style={{ fontSize: '0.72rem', color: 'var(--text-2)', fontWeight: 600, cursor: 'help' }}
        >
          {lang === 'zh' ? '收益计算口径 ⓘ' : 'Return Model ⓘ'}
        </label>
        <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setReturnType('executable')}
            title={lang === 'zh' ? '以次日开盘价买入计算的真实交割收益（符合实盘买入逻辑，剔除高开/低开买入偏差）' : 'Actual returns bought at next day open price (Real execution logic)'}
            style={{
              background: returnType === 'executable' ? 'var(--cyan)' : 'transparent',
              color: returnType === 'executable' ? 'black' : 'var(--text-2)',
              border: 'none',
              padding: '0.35rem 0.6rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '3px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {lang === 'zh' ? '可执行收益' : 'Executable'}
          </button>
          <button
            onClick={() => setReturnType('theoretical')}
            title={lang === 'zh' ? '以信号发出当日的收盘价买入计算的理论收益' : 'Theoretical returns bought at signal day close price'}
            style={{
              background: returnType === 'theoretical' ? 'var(--cyan)' : 'transparent',
              color: returnType === 'theoretical' ? 'black' : 'var(--text-2)',
              border: 'none',
              padding: '0.35rem 0.6rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '3px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {lang === 'zh' ? '理论收益' : 'Theoretical'}
          </button>
        </div>
      </div>

      {/* Version Selector */}
      {versionsData && versionsData.versions && versionsData.versions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-2)', fontWeight: 600 }}>
            {lang === 'zh' ? '回测参数版本' : 'Strategy Version'}
          </label>
          <select
            value={selectedVersion}
            onChange={(e) => onVersionChange(e.target.value)}
            style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '0.4rem 0.6rem',
              color: 'var(--text-1)',
              fontSize: '0.8rem',
              fontFamily: 'var(--mono)',
              width: '180px',
              cursor: 'pointer'
            }}
          >
            {versionsData.versions.map(v => {
              const details = versionsData.details && versionsData.details[v];
              const dateRange = details ? ` [${details.start_date} ~ ${details.end_date}]` : '';
              const isLatest = v === versionsData.latest;
              const label = `${v}${isLatest ? ` (${lang === 'zh' ? '当前最新' : 'Latest'})` : ''}${dateRange}`;
              return (
                <option key={v} value={v} style={{ background: 'var(--bg-card)', color: 'var(--text-1)' }}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Signal Type Toggle (Only Stock Tab) */}
      {activeTab === 'stock' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-2)', fontWeight: 600 }}>
            {lang === 'zh' ? '信号类型' : 'Signal Type'}
          </label>
          <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '4px', border: '1px solid var(--border)' }}>
            {[
              { key: 'all',  labelZh: '全部',      labelEn: 'All',  color: 'var(--cyan)' },
              { key: 'bull', labelZh: '📈 多头',   labelEn: '📈 Bull', color: 'var(--green)' },
              { key: 'bear', labelZh: '📉 空头',   labelEn: '📉 Bear', color: 'var(--red, #e74c3c)' },
            ].map(({ key, labelZh, labelEn, color }) => (
              <button
                key={key}
                onClick={() => setSignalType(key)}
                style={{
                  background: signalType === key ? color : 'transparent',
                  color: signalType === key ? (key === 'all' ? 'black' : 'white') : 'var(--text-2)',
                  border: 'none',
                  padding: '0.35rem 0.55rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  borderRadius: '3px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {lang === 'zh' ? labelZh : labelEn}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Radar Only Filter (Only Stock Tab) */}
      {activeTab === 'stock' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--text-2)', fontWeight: 600 }}>
            {lang === 'zh' ? '信号过滤' : 'Signal Scope'}
          </label>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'var(--bg-hover)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '0.4rem 0.6rem',
            color: 'var(--text-1)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            height: '34px',
            boxSizing: 'border-box'
          }}>
            <input
              type="checkbox"
              checked={onlyRadar}
              onChange={(e) => setOnlyRadar(e.target.checked)}
              style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: 'var(--cyan)' }}
            />
            <span>{lang === 'zh' ? '只看起飞雷达信号' : 'Radar Signals Only'}</span>
          </label>
        </div>
      )}

      {/* Reset button */}
      <button 
        onClick={() => {
          setFilterTicker('');
          setFilterSector('');
          setFilterDate('');
          setFilterStartDate(defaultStartDateStr);
          setFilterEndDate(maxDateStr);
          if (setOnlyRadar) setOnlyRadar(false);
          if (setSignalType) setSignalType('all');
        }}
        disabled={activeTab === 'portfolio'}
        style={{
          alignSelf: 'flex-end',
          background: activeTab === 'portfolio' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
          border: '1px solid var(--border)',
          color: activeTab === 'portfolio' ? 'var(--text-3)' : 'var(--text-1)',
          padding: '0.45rem 1rem',
          borderRadius: '4px',
          cursor: activeTab === 'portfolio' ? 'not-allowed' : 'pointer',
          fontSize: '0.8rem',
          transition: 'background 0.2s',
          opacity: activeTab === 'portfolio' ? 0.5 : 1
        }}
        onMouseEnter={(e) => { if (activeTab !== 'portfolio') e.target.style.background = 'rgba(255,255,255,0.1)' }}
        onMouseLeave={(e) => { if (activeTab !== 'portfolio') e.target.style.background = 'rgba(255,255,255,0.05)' }}
      >
        {lang === 'zh' ? '重置' : 'Reset'}
      </button>

      {/* 60-day Limit Notice */}
      {activeTab === 'portfolio' ? (
        <div style={{
          fontSize: '0.72rem',
          color: 'var(--orange)',
          borderLeft: '2px solid var(--orange)',
          paddingLeft: '0.5rem',
          marginLeft: 'auto',
          maxWidth: '320px',
          lineHeight: 1.4
        }}>
          {lang === 'zh' 
            ? `⚠️ 组合回测采用预计算复利序列，暂不支持自定义日期筛选。受限于前置指标 60 日计算预热和数据库历史深度限制，数据最早追溯至 ${earliestDateStr}。` 
            : `⚠️ Portfolio backtest uses pre-calculated sequences; date filters are disabled. Retrospective limit starts from ${earliestDateStr} due to 60-day warm-up window.`}
        </div>
      ) : (
        <div style={{
          fontSize: '0.72rem',
          color: 'var(--text-3)',
          borderLeft: '2px solid var(--border)',
          paddingLeft: '0.5rem',
          marginLeft: 'auto',
          maxWidth: '320px',
          lineHeight: 1.4
        }}>
          {lang === 'zh' 
            ? `💡 提示：受限于前置指标（MA60等） 60 日计算预热及数据库历史深度限制，本批次原始数据范围最早追溯至 ${earliestDateStr}。` 
            : `💡 Note: Due to 60 trading days indicator (MA60) warm-up deduction and database limits, the raw backtest dataset starts from ${earliestDateStr}.`}
        </div>
      )}
    </div>
  );
}
