import React from 'react';
import { getT } from '../utils/translations';

export default function Header({ updatedAt, lang, setLang, activeTab, setActiveTab, hasBacktestData, theme, setTheme, selectedVersion, onVersionChange, versionsData = { latest: '', versions: [], details: {} } }) {
  const t = getT(lang);

  const handleSaveHtml = () => {
    let styles = '';
    for (const sheet of document.styleSheets) {
      try {
        const node = sheet.ownerNode;
        if (!node) continue;

        // Only extract styles from our application tags (link/style) to prevent 
        // third-party browser extension styles (e.g. Dark Reader) from polluting the export.
        const tagName = node.tagName;
        let isAppStyle = false;
        if (tagName === 'LINK') {
          const href = node.getAttribute('href') || '';
          isAppStyle = href.startsWith('/') || href.startsWith(window.location.origin);
        } else if (tagName === 'STYLE') {
          const id = node.getAttribute('id') || '';
          const className = node.className || '';
          // Vite dev mode injected style tag check
          const isViteStyle = node.hasAttribute('data-vite-dev-id');
          // Avoid known extensions (e.g. DarkReader, password managers)
          const isExtension = id.startsWith('chrome-') || id.includes('extension') || className.includes('darkreader');
          isAppStyle = isViteStyle || !isExtension;
        }

        if (!isAppStyle) continue;

        if (sheet.cssRules) {
          for (const rule of sheet.cssRules) {
            styles += rule.cssText + '\n';
          }
        }
      } catch (e) {
        console.warn('Could not read cssRules from stylesheet', sheet, e);
      }
    }

    const rootEl = document.getElementById('root');
    const rootHtml = rootEl ? rootEl.innerHTML : '';

    const htmlContent = `<!DOCTYPE html>
<html lang="${lang}" data-theme="${theme}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${document.title}</title>
    <style>
      ${styles}
    </style>
  </head>
  <body>
    <div id="root">
      ${rootHtml}
    </div>
  </body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const dateStr = new Date().toISOString().slice(0, 10);
    const tabName = activeTab === 'terminal' ? 'Live_Terminal' : activeTab === 'live_analyzer' ? 'Live_Analyzer' : 'Backtest_Panel';
    link.download = `ASX_Screener_${tabName}_${dateStr}.html`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <header className="header">
      <div className="logo" style={{ flexShrink: 0 }}>
        <div className="logo-icon">⚡</div>
        <div style={{ whiteSpace: 'nowrap' }}>
          <h1 className="logo-text" id="header-logo-title" style={{ fontSize: lang === 'zh' ? '1.2rem' : '1.05rem' }}>{t('title')}</h1>
          <div className="logo-sub" style={{ fontSize: lang === 'zh' ? '0.7rem' : '0.65rem' }}>{t('sub')}</div>
        </div>
      </div>

      {/* Tab Selector Navigation */}
      <div className="tab-navigation" style={{ display: 'flex', gap: '0.5rem', marginLeft: '2rem', marginRight: 'auto' }}>
        <button 
          id="tab-btn-terminal"
          className={`tab-btn ${activeTab === 'terminal' ? 'active' : ''}`}
          onClick={() => setActiveTab('terminal')}
          style={{
            background: activeTab === 'terminal' ? 'rgba(99, 179, 237, 0.15)' : 'transparent',
            border: '1px solid',
            borderColor: activeTab === 'terminal' ? 'var(--cyan)' : 'transparent',
            color: activeTab === 'terminal' ? 'var(--cyan)' : 'var(--text-2)',
            padding: '0.4rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
        >
          ⚡ {t('viewTerminal')}
        </button>
        <button 
          id="tab-btn-backtest"
          className={`tab-btn ${activeTab === 'backtest' ? 'active' : ''}`}
          onClick={() => setActiveTab('backtest')}
          style={{
            background: activeTab === 'backtest' ? 'rgba(99, 179, 237, 0.15)' : 'transparent',
            border: '1px solid',
            borderColor: activeTab === 'backtest' ? 'var(--cyan)' : 'transparent',
            color: activeTab === 'backtest' ? 'var(--cyan)' : 'var(--text-2)',
            padding: '0.4rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
            transition: 'all 0.2s',
            opacity: hasBacktestData ? 1 : 0.6
          }}
          title={!hasBacktestData ? t('noBacktestData') : ''}
        >
          📊 {t('viewBacktest')}
        </button>
        <button 
          id="tab-btn-live-analyzer"
          className={`tab-btn ${activeTab === 'live_analyzer' ? 'active' : ''}`}
          onClick={() => setActiveTab('live_analyzer')}
          style={{
            background: activeTab === 'live_analyzer' ? 'rgba(99, 179, 237, 0.15)' : 'transparent',
            border: '1px solid',
            borderColor: activeTab === 'live_analyzer' ? 'var(--cyan)' : 'transparent',
            color: activeTab === 'live_analyzer' ? 'var(--cyan)' : 'var(--text-2)',
            padding: '0.4rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
            transition: 'all 0.2s'
          }}
        >
          📡 {t('viewLiveAnalyzer')}
        </button>
      </div>

      <div className="header-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button 
          id="save-html-btn"
          className="lang-toggle-btn"
          onClick={handleSaveHtml}
          style={{ marginRight: '0.1rem' }}
          title={t('saveHtmlTooltip')}
        >
          <span>💾</span> {t('saveHtml')}
        </button>
        <button 
          id="theme-toggle-btn"
          className="lang-toggle-btn" 
          onClick={() => setTheme(th => th === 'dark' ? 'light' : 'dark')}
          style={{ marginRight: '0.1rem' }}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? t('themeLight') : t('themeDark')}
        </button>
        {versionsData && versionsData.versions && versionsData.versions.length > 0 && (
          <div className="version-selector-container" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginRight: '0.1rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600 }}>
              {lang === 'zh' ? '策略版本:' : 'Strategy:'}
            </span>
            <select
              value={selectedVersion}
              onChange={(e) => onVersionChange(e.target.value)}
              style={{
                background: 'var(--bg-card, #1e2022)',
                border: '1px solid var(--border, #2d3139)',
                color: 'var(--text-1)',
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                outline: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--mono, monospace)',
                maxWidth: '140px'
              }}
            >
              {versionsData.versions.map(v => {
                const details = versionsData.details && versionsData.details[v];
                const dateRange = details ? ` [${details.start_date} ~ ${details.end_date}]` : '';
                const isLatest = v === versionsData.latest;
                const label = `${v}${isLatest ? ` (${lang === 'zh' ? '当前最新' : 'Latest'})` : ''}${dateRange}`;
                return (
                  <option key={v} value={v}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
        )}
        <button 
          id="lang-toggle-btn"
          className="lang-toggle-btn" 
          onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
        >
          <span className="lang-toggle-icon">🌐</span>
          {t('langName')}
        </button>
        <div className="live-badge">
          <div className="live-dot" />
          {t('eodBadge')}
        </div>
        {updatedAt && (
          <div className="updated-at">
            {t('updateAt')} {new Date(updatedAt).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour12: false })}
          </div>
        )}
      </div>
    </header>
  );
}
