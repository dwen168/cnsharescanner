import React, { useState, useEffect } from 'react';
import { getT } from './utils/translations';
import Header from './components/Header';
import LineageStatusBar from './components/LineageStatusBar';
import WarningsPanel from './components/WarningsPanel';
import MacroPanel from './components/MacroPanel';
import SectorHeatmap from './components/SectorHeatmap';
import SectorTrendChart from './components/SectorTrendChart';
import TakeoffRadar from './components/TakeoffRadar';
import BearRadar from './components/BearRadar';
import WaneyePanel from './components/WaneyePanel';
import AiInsights from './components/AiInsights';
import BacktestView from './components/BacktestView';
import StrategyConfigPanel from './components/StrategyConfigPanel';
import LiveAnalyzer from './components/LiveAnalyzer';

export default function App() {
  const [data, setData]             = useState(null);
  const [backtestMode, setBacktestMode] = useState('audit'); // 'audit' | 'replay'
  const [auditData, setAuditData]   = useState(null);
  const [replayData, setReplayData] = useState(null);
  const [auditVersions, setAuditVersions] = useState({ latest: '', versions: [] });
  const [replayVersions, setReplayVersions] = useState({ latest: '', versions: [] });
  const [selectedAuditVersion, setSelectedAuditVersion] = useState('');
  const [selectedReplayVersion, setSelectedReplayVersion] = useState('');
  const [selectedStrategyVersion, setSelectedStrategyVersion] = useState('');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [lang, setLang]             = useState('zh');
  const [activeTab, setActiveTab]   = useState('terminal');
  const [theme, setTheme]           = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.title = lang === 'zh'
      ? 'A股短线专家 - 龙头股追踪终端'
      : 'CN Share Trader Expert - Leading Stock Terminal';
  }, [lang]);

  useEffect(() => {
    // 1. Fetch live market analysis data
    fetch('/data.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(json => { 
        setData(json); 
        if (json.algo_version) {
          setSelectedStrategyVersion(json.algo_version);
        }
        setLoading(false); 
      })
      .catch(err => { 
        setError(err.message); 
        setLoading(false); 
      });

    // 2. Fetch Audit version list & default data
    fetch('/backtest_audit_versions.json')
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(json => {
        // Fallback to legacy path if audit specific doesn't exist yet
        if (json) return json;
        return fetch('/backtest_versions.json').then(r => r.ok ? r.json() : null).catch(() => null);
      })
      .then(json => {
        if (json) {
          setAuditVersions(json);
          setSelectedAuditVersion(json.latest);
          setSelectedStrategyVersion(json.latest);
          
          const defaultFile = json.latest ? `/backtest_audit_${json.latest}.json` : '/backtest_audit.json';
          fetch(defaultFile)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
            .then(dataJson => {
              if (dataJson) return dataJson;
              return fetch('/backtest.json').then(r => r.ok ? r.json() : null).catch(() => null);
            })
            .then(dataJson => {
              if (dataJson) setAuditData(dataJson);
            });
        }
      })
      .catch(() => {});

    // 3. Fetch Replay version list & default data
    fetch('/backtest_replay_versions.json')
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(json => {
        if (json) {
          setReplayVersions(json);
          setSelectedReplayVersion(json.latest);
          
          const defaultFile = json.latest ? `/backtest_replay_${json.latest}.json` : '/backtest_replay.json';
          fetch(defaultFile)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
            .then(dataJson => {
              if (dataJson) setReplayData(dataJson);
            });
        }
      })
      .catch(() => {});
  }, []);

  const handleStrategyVersionChange = (version) => {
    setSelectedStrategyVersion(version);
    setSelectedAuditVersion(version);
    setSelectedReplayVersion(version);
    
    // Sync the backtest data immediately as well
    if (backtestMode === 'audit') {
      const isLatest = version === auditVersions.latest;
      const filename = isLatest ? '/backtest_audit.json' : `/backtest_audit_${version}.json`;
      fetch(filename)
        .then(r => r.ok ? r.json() : null)
        .then(json => { if (json) setAuditData(json); });
    } else {
      const isLatest = version === replayVersions.latest;
      const filename = isLatest ? '/backtest_replay.json' : `/backtest_replay_${version}.json`;
      fetch(filename)
        .then(r => r.ok ? r.json() : null)
        .then(json => { if (json) setReplayData(json); });
    }

    // Load versioned terminal data
    const isLatest = version === auditVersions.latest;
    const terminalFile = isLatest ? '/data.json' : `/data_${version}.json`;
    fetch(terminalFile)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(json => {
        setData(json);
      })
      .catch(err => {
        console.warn(`Failed to load terminal data for ${version}, falling back to legacy fallback/main data`, err);
        fetch('/data.json')
          .then(r => r.json())
          .then(json => setData(json));
      });
  };

  const loadBacktestVersion = (version) => {
    if (backtestMode === 'audit') {
      setSelectedAuditVersion(version);
      const isLatest = version === auditVersions.latest;
      const filename = isLatest ? '/backtest_audit.json' : `/backtest_audit_${version}.json`;
      fetch(filename)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
        .then(json => {
          if (json) return json;
          if (isLatest) return fetch('/backtest.json').then(r => r.ok ? r.json() : null).catch(() => null);
          return null;
        })
        .then(json => {
          if (json) setAuditData(json);
        });
    } else {
      setSelectedReplayVersion(version);
      const isLatest = version === replayVersions.latest;
      const filename = isLatest ? '/backtest_replay.json' : `/backtest_replay_${version}.json`;
      fetch(filename)
        .then(r => r.ok ? r.json() : null)
        .then(json => {
          if (json) setReplayData(json);
        })
        .catch(() => {});
    }
  };

  const t = getT(lang);

  if (loading) {
    return (
      <div className="app">
        <Header 
          lang={lang} 
          setLang={setLang} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          hasBacktestData={!!auditData || !!replayData} 
          theme={theme} 
          setTheme={setTheme}
          selectedVersion={selectedStrategyVersion}
          onVersionChange={handleStrategyVersionChange}
          versionsData={auditVersions}
        />
        <div className="loading-screen">
          <div className="spinner" />
          <div className="loading-text">{t('loading')}</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="app">
        <Header 
          lang={lang} 
          setLang={setLang} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          hasBacktestData={!!auditData || !!replayData} 
          theme={theme} 
          setTheme={setTheme}
          selectedVersion={selectedStrategyVersion}
          onVersionChange={handleStrategyVersionChange}
          versionsData={auditVersions}
        />
        <div className="loading-screen">
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <div className="loading-text">
            {t('errorTitle')}<br />
            <code style={{ color: 'var(--green)', fontFamily: 'var(--mono)', marginTop: '0.5rem', display: 'block' }}>
              python analysis_engine.py
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${activeTab === 'live_analyzer' ? 'full-width' : ''}`}>
      <Header 
        updatedAt={data.generated_at} 
        lang={lang} 
        setLang={setLang} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        hasBacktestData={!!auditData || !!replayData}
        theme={theme}
        setTheme={setTheme}
        selectedVersion={selectedStrategyVersion}
        onVersionChange={handleStrategyVersionChange}
        versionsData={auditVersions}
      />
      
      {activeTab === 'terminal' && (
        <>
          {/* 0. Strategy Configuration Parameters Panel */}
          <StrategyConfigPanel 
            version={selectedStrategyVersion} 
            config={data.strategy_config} 
            lang={lang} 
          />

          {/* 1. Data Lineage Status Bar */}
          <LineageStatusBar 
            lineage={data.data_lineage ?? 'real'} 
            tradingState={data.trading_state ?? (data.halt_signals ? 'halted' : 'active')} 
            waneye={data.waneye} 
            lang={lang} 
          />

          {/* 2. Warning Diagnostics Panel */}
          <WarningsPanel warnings={data.warnings ?? []} lang={lang} />
          
          {/* 3. Global Macro Factors */}
          <MacroPanel macro={data.macro} lang={lang} />
          
          {/* 4. Sector Heatmap grid */}
          <SectorHeatmap sectors={data.sectors ?? []} lang={lang} />
          
          {/* 5. Sector Performance Trends */}
          <SectorTrendChart trends={data.trends} lang={lang} />
          
          {/* 6. Take-off Radar alerts */}
          <TakeoffRadar 
            radar={data.radar ?? {}} 
            lang={lang} 
            tradingState={data.trading_state ?? (data.halt_signals ? 'halted' : 'active')} 
          />

          {/* 6b. Bear Radar — 空头预警雷达 */}
          <BearRadar
            bearRadar={data.bear_radar ?? {}}
            radar={data.radar ?? {}}
            lang={lang}
          />

          {/* 7. Waneye Headlines and Highlights center */}
          <WaneyePanel waneye={data.waneye} lang={lang} />

          {/* 8. AI Analysis Insights list */}
          <AiInsights stocks={data.stocks ?? []} lang={lang} />
        </>
      )}

      {activeTab === 'backtest' && (
        <BacktestView 
          backtestData={backtestMode === 'audit' ? auditData : replayData} 
          lang={lang} 
          versionsData={backtestMode === 'audit' ? auditVersions : replayVersions}
          selectedVersion={backtestMode === 'audit' ? selectedAuditVersion : selectedReplayVersion}
          onVersionChange={loadBacktestVersion}
          backtestMode={backtestMode}
          onModeChange={setBacktestMode}
          mainData={data}
        />
      )}

      {activeTab === 'live_analyzer' && (
        <LiveAnalyzer 
          globalData={data} 
          lang={lang} 
          theme={theme}
        />
      )}
      <footer className="footer" id="footer-section">
        {t('footerMainSite')}
        <a 
          href="https://wendao51.com" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="footer-link"
          id="footer-main-link"
        >
          wendao51.com
        </a>
      </footer>
    </div>
  );
}
