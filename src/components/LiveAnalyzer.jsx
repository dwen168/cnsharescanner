import React, { useState, useEffect, useDeferredValue } from 'react';
import { getT, translateInsight, STOCK_NAME_MAP } from '../utils/translations';
import { analyzeStockJS, calculateSentimentScore } from '../utils/stockAnalyzer';
import { analyzeWyckoff, analyzeWyckoffMacd } from '../utils/wyckoffAnalyzer';
import { analyzeRiskControl } from '../utils/riskControlAnalyzer';

export default function LiveAnalyzer({ globalData, lang, theme }) {
  const t = getT(lang);
  
  const getSectorComment = (symbolCode, language) => {
    if (!globalData || !globalData.sectors || !symbolCode) return '';
    const cleanCode = symbolCode.split('.')[0].trim();
    const sector = globalData.sectors.find(sec => 
      sec.stocks && sec.stocks.some(s => s.symbol === cleanCode)
    );
    if (!sector) return '';

    const heatScore = sector.heat_score !== undefined ? sector.heat_score : '--';
    const signal = sector.signal || (language === 'zh' ? '未知' : 'Unknown');
    const avgChg = sector.avg_chg !== undefined ? sector.avg_chg : '--';
    const avgVolRatio = sector.avg_vol_ratio !== undefined ? sector.avg_vol_ratio : '--';

    if (language === 'zh') {
      return `\n\n【板块诊断】该股属于「${sector.name}」板块。当前板块整体热度评分为 ${heatScore}，主力资金信号呈「${signal}」，板块日均涨跌幅为 ${avgChg}%，日均量比为 ${avgVolRatio}。在宏观舆情中，该板块受关注度较${heatScore >= 60 ? '高' : '温和'}。`;
    } else {
      return `\n\n[Sector Diagnosis] This stock belongs to the "${sector.name}" sector. The overall sector heat score is ${heatScore}, with main capital flow signaling "${signal}". Average change is ${avgChg}%, and average volume ratio is ${avgVolRatio}.`;
    }
  };

  const [symbol, setSymbol] = useState('600519.SS');
  const [sectorName, setSectorName] = useState('Auto');
  const [manualSentiment, setManualSentiment] = useState(0.0);
  const [customHeadline, setCustomHeadline] = useState('');
  const [analysisMethod, setAnalysisMethod] = useState('wyckoff_macd'); // Only keep wyckoff_macd method
  const [sensitivity, setSensitivity] = useState(0.3); // 0.1 to 1.0 (default 0.3 is conservative)
  const [chartZoomRange, setChartZoomRange] = useState('30d'); // '30d' | '90d' | '180d' | 'all'
  const [activeOverlays, setActiveOverlays] = useState({
    ma: true,
    sr: true,
    bb: false,
    atr_stop: true
  });
  const [hoveredIndex, setHoveredIndex] = useState(null); // null or index of hovered data point
  
  // Risk Control States
  const [costBasis, setCostBasis] = useState('');
  const [maxDrawdownPct, setMaxDrawdownPct] = useState(15);
  const [breakevenTriggerPct, setBreakevenTriggerPct] = useState(30);
  const [useAdaptiveVolatility, setUseAdaptiveVolatility] = useState(false);
  const [showBuySignals, setShowBuySignals] = useState(true);
  const [showSellSignals, setShowSellSignals] = useState(true);
  const [showStructuralEvents, setShowStructuralEvents] = useState(true);

  // Deferred values to optimize performance during typing and sliding
  const deferredSentiment = useDeferredValue(manualSentiment);
  const deferredHeadline = useDeferredValue(customHeadline);
  const deferredSensitivity = useDeferredValue(sensitivity);
  const deferredCostBasis = useDeferredValue(costBasis);
  const deferredMaxDrawdownPct = useDeferredValue(maxDrawdownPct);
  const deferredBreakevenTriggerPct = useDeferredValue(breakevenTriggerPct);
  const deferredUseAdaptiveVolatility = useDeferredValue(useAdaptiveVolatility);

  
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Cached chart states for instant local recalculation
  const [cachedStockChart, setCachedStockChart] = useState(null);
  const [cachedIndexChart, setCachedIndexChart] = useState(null);
  const [currentCleanSymbol, setCurrentCleanSymbol] = useState('');

  // Popular tickers for quick-click
  const quickTickers = [
    { code: '600519.SS', name: '贵州茅台' },
    { code: '002594.SZ', name: '比亚迪' },
    { code: '300750.SZ', name: '宁德时代' },
    { code: '600036.SS', name: '招商银行' },
    { code: '002230.SZ', name: '科大讯飞' },
    { code: '000001.SZ', name: '平安银行' }
  ];

  // Watchlist State loaded from localStorage
  const [watchlist, setWatchlist] = useState(() => {
    const saved = localStorage.getItem('asx_watchlist');
    return saved ? JSON.parse(saved) : ['600519.SS', '002594.SZ', '300750.SZ', '600036.SS'];
  });

  // Persist watchlist to localStorage
  useEffect(() => {
    localStorage.setItem('asx_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  const addToWatchlist = () => {
    const cleanSym = symbol.trim().toUpperCase();
    if (!cleanSym) return;
    if (!watchlist.includes(cleanSym)) {
      setWatchlist(prev => [...prev, cleanSym]);
    }
  };

  const removeFromWatchlist = (code) => {
    setWatchlist(prev => prev.filter(c => c !== code));
  };

  const handleWatchlistClick = (code) => {
    setSymbol(code);
    handleAnalyze(code);
  };

  // List of available sectors from the global market data
  const sectorsList = globalData?.sectors && Array.isArray(globalData.sectors)
    ? globalData.sectors.map(sec => sec.name)
    : [];

  const handleQuickClick = (code) => {
    setSymbol(code);
    handleAnalyze(code);
  };

  // Instant local recalculation whenever inputs change
  useEffect(() => {
    if (!cachedStockChart) return;
    
    try {
      let analysis;
      if (analysisMethod === 'wyckoff') {
        analysis = analyzeWyckoff(
          currentCleanSymbol,
          cachedStockChart,
          cachedIndexChart,
          deferredSensitivity
        );
      } else if (analysisMethod === 'wyckoff_macd') {
        analysis = analyzeWyckoffMacd(
          currentCleanSymbol,
          cachedStockChart,
          cachedIndexChart,
          deferredSensitivity
        );
      } else {
        // Determine sector
        let matchedSector = sectorName;
        if (matchedSector === 'Auto') {
          matchedSector = 'Generic';
          if (globalData?.sectors && Array.isArray(globalData.sectors)) {
            for (const secData of globalData.sectors) {
              const cleanSym = currentCleanSymbol.replace('.AX', '');
              const constituents = secData.stocks || secData.constituents || [];
              if (constituents.some(c => c.symbol === cleanSym || c.symbol === currentCleanSymbol)) {
                matchedSector = secData.name;
                break;
              }
            }
          }
        }

        // Calculate sentiment
        const finalSentiment = parseFloat(deferredSentiment);
        const tradingState = globalData?.macro?.trading_state || "active";
        
        analysis = analyzeStockJS(
          currentCleanSymbol,
          cachedStockChart,
          cachedIndexChart,
          tradingState,
          finalSentiment,
          deferredHeadline || (lang === 'zh' ? '实时诊断自选股' : 'Live diagnosed custom stock')
        );

        // Attach sector data
        analysis.sector = matchedSector;
        analysis.sectorData = globalData?.sectors && Array.isArray(globalData.sectors)
          ? globalData.sectors.find(sec => sec.name === matchedSector) || null
          : null;
      }

      if (analysis.error) {
        setError(analysis.error);
        setResult(null);
        return;
      }

      // Calculate risk control status if cost basis is supplied
      if (deferredCostBasis && parseFloat(deferredCostBasis) > 0) {
        const quoteObj = cachedStockChart.indicators.quote[0];
        const cleanHighs = (quoteObj.high || []).filter(h => h !== null && h !== undefined);
        const cleanLows = (quoteObj.low || []).filter(l => l !== null && l !== undefined);
        const cleanCloses = (quoteObj.close || []).filter(c => c !== null && c !== undefined);
        const currentPriceVal = analysis.price || (quoteObj.close || []).filter(c => c !== null).pop();

        if (currentPriceVal) {
          // If analysis has macd, check DIF < DEA. If not, pass null so riskControlAnalyzer calculates it.
          const isMacdDeadCross = (analysis.macd && typeof analysis.macd.latest_macd === 'number')
            ? (analysis.macd.latest_macd < analysis.macd.latest_signal) 
            : null;

          // Map Wyckoff phase or classic trading_state (Step 2)
          let phase = 'neutral';
          let supportPrice = 0;
          let resistancePrice = 0;

          if (analysis.type === 'wyckoff' || analysis.type === 'wyckoff_macd') {
            phase = analysis.phase || 'neutral';
            supportPrice = analysis.support_level || 0;
            resistancePrice = analysis.resistance_level || 0;
          } else if (analysis.type === 'classic') {
            const state = (analysis.trading_state || '').toLowerCase();
            if (analysis.bear_zone === 'distribution' || analysis.bear_zone === 'distribution_lite') {
              phase = 'distribution';
            } else if (state === 'bearish' || analysis.bear_zone) {
              phase = 'markdown';
            } else if (state === 'sideways') {
              phase = 'accumulation';
            } else if (state === 'bullish' || state === 'breakout') {
              phase = 'markup';
            }
            // Calculate 20-day S/R fallback for classic analysis
            if (cleanLows.length > 0) {
              supportPrice = Math.min(...cleanLows.slice(-20));
            }
            if (cleanHighs.length > 0) {
              resistancePrice = Math.max(...cleanHighs.slice(-20));
            }
          }

          analysis.riskControl = analyzeRiskControl(
            currentPriceVal,
            cleanHighs,
            cleanLows,
            cleanCloses,
            parseFloat(deferredCostBasis),
            {
              maxDrawdownPct: parseFloat(deferredMaxDrawdownPct),
              breakevenTriggerPct: parseFloat(deferredBreakevenTriggerPct),
              isMacdDeadCross: isMacdDeadCross,
              phase: phase,
              supportPrice: supportPrice,
              resistancePrice: resistancePrice,
              useAdaptiveVolatility: deferredUseAdaptiveVolatility
            }
          );
        }
      }

      setResult(analysis);
      setError(null);
    } catch (err) {
      setError(err.message);
      setResult(null);
    }
  }, [cachedStockChart, cachedIndexChart, deferredSentiment, deferredHeadline, sectorName, lang, analysisMethod, deferredSensitivity, deferredCostBasis, deferredMaxDrawdownPct, deferredBreakevenTriggerPct, deferredUseAdaptiveVolatility]);

  const handleAnalyze = async (targetSymbol = symbol) => {
    let cleanSymbol = targetSymbol.trim().toUpperCase();
    if (!cleanSymbol) return;

    // Auto-formatting helpers (A-shares, Hong Kong, and ASX)
    // 1. ASX Auto-append .AX if it is a 3-letter word and doesn't contain a dot
    if (cleanSymbol.length === 3 && /^[A-Z]{3}$/.test(cleanSymbol)) {
      cleanSymbol = cleanSymbol + '.AX';
      setSymbol(cleanSymbol);
    }
    // 2. A-shares & Hong Kong Smart Auto-complete (if typing pure numbers)
    else if (/^\d+$/.test(cleanSymbol)) {
      if (cleanSymbol.length === 6) {
        if (cleanSymbol.startsWith('6')) {
          cleanSymbol = cleanSymbol + '.SS'; // Shanghai A-share
        } else if (cleanSymbol.startsWith('0') || cleanSymbol.startsWith('3')) {
          cleanSymbol = cleanSymbol + '.SZ'; // Shenzhen A-share
        }
      } else if (cleanSymbol.length <= 5) {
        // Hong Kong Stock: Yahoo Finance strictly uses a 4-digit code (e.g. 0700.HK, 0005.HK)
        // We trim/pad to exactly 4 digits
        const numPart = parseInt(cleanSymbol, 10).toString().padStart(4, '0');
        cleanSymbol = numPart + '.HK';
      }
      setSymbol(cleanSymbol);
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const fetchWithTimeout = async (url, options = {}, timeout = 6000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
      } catch (e) {
        clearTimeout(id);
        throw e;
      }
    };

    try {
      const fetchYahooChart = async (sym, per = '3mo', inter = '1d') => {
        // 1. Try local proxy first
        try {
          const response = await fetchWithTimeout(`/api/yahoo?symbol=${encodeURIComponent(sym)}&period=${per}&interval=${inter}`);
          if (response.ok) {
            const data = await response.json();
            if (data?.chart?.result?.[0]) return data.chart.result[0];
          }
        } catch (e) {
          console.warn(`Local proxy fetch failed for ${sym}, trying corsproxy.io...`, e);
        }

        // 2. Fallback to corsproxy.io directly in browser
        try {
          const targetUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${per}&interval=${inter}`;
          const corsUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
          const response = await fetchWithTimeout(corsUrl);
          if (response.ok) {
            const data = await response.json();
            if (data?.chart?.result?.[0]) return data.chart.result[0];
          }
        } catch (e) {
          console.warn(`corsproxy.io fetch failed for ${sym}, trying allorigins...`, e);
        }

        // 3. Fallback to api.allorigins.win
        try {
          const targetUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${per}&interval=${inter}`;
          const corsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
          const response = await fetchWithTimeout(corsUrl);
          if (response.ok) {
            const wrapData = await response.json();
            const data = JSON.parse(wrapData.contents);
            if (data?.chart?.result?.[0]) return data.chart.result[0];
          }
        } catch (e) {
          console.error(`allorigins fetch failed for ${sym}:`, e);
        }

        throw new Error(lang === 'zh' ? '无法获取数据。本地代理与公网跨域通道均失效，请检查您的网络连接。' : 'Failed to fetch data. Both local proxy and public CORS proxies failed. Please check your network connection.');
      };

      // Step 1: Fetch stock chart data with smart retry for ASX codes (e.g. ETPMAG -> ETPMAG.AX)
      setLoadingStep(lang === 'zh' ? '正在连接 Yahoo Finance 实时数据源...' : 'Connecting to Yahoo Finance live data...');
      let chartResult;
      try {
        chartResult = await fetchYahooChart(cleanSymbol, '1y', '1d');
      } catch (err) {
        if (!cleanSymbol.includes('.') && /^[A-Z]{3,6}$/.test(cleanSymbol)) {
          console.log(`Fetch failed for ${cleanSymbol}, retrying with .AX suffix...`);
          try {
            const retrySymbol = cleanSymbol + '.AX';
            chartResult = await fetchYahooChart(retrySymbol, '1y', '1d');
            cleanSymbol = retrySymbol;
            setSymbol(retrySymbol);
          } catch (retryErr) {
            throw err; // throw original error if retry also fails
          }
        } else {
          throw err;
        }
      }

      // Step 2: Fetch index ^AORD or ^AXJO for Relative Strength calculation
      setLoadingStep(lang === 'zh' ? '正在获取大盘对照基准 (^AORD)...' : 'Fetching market index benchmark (^AORD)...');
      let indexChartResult = null;
      try {
        indexChartResult = await fetchYahooChart('^AORD', '1y', '1d');
      } catch (idxErr) {
        console.warn("Failed fetching index data, falling back to local snapshot", idxErr);
      }

      // Update cached state to trigger useEffect calculation
      setCurrentCleanSymbol(cleanSymbol);
      setCachedIndexChart(indexChartResult);
      setCachedStockChart(chartResult);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Color mappings
  const getZoneBadge = (zone, signal) => {
    if (zone === 'momentum') return { bg: 'var(--orange-bg, rgba(255,159,67,0.15))', color: 'var(--orange, #ff9f43)', text: signal };
    if (zone === 'accumulation') return { bg: 'var(--green-bg, rgba(46,204,113,0.15))', color: 'var(--green, #2ecc71)', text: signal };
    if (zone === 'watch') return { bg: 'var(--blue-bg, rgba(52,152,219,0.15))', color: 'var(--blue, #3498db)', text: signal };
    return { bg: 'var(--bg-hover)', color: 'var(--text-3)', text: signal || '观望' };
  };

  const getBearBadge = (bearSignal, bearZone) => {
    if (!bearSignal) return null;
    if (bearZone === 'distribution') return { bg: 'var(--red-bg, rgba(231,76,60,0.15))', color: 'var(--red, #e74c3c)', text: bearSignal };
    return { bg: 'var(--yellow-bg, rgba(241,196,15,0.15))', color: 'var(--yellow, #f1c40f)', text: bearSignal };
  };

  const renderWyckoffChart = (resultData) => {
    let chartData = resultData.chart_history;
    if (!chartData || chartData.length === 0) return null;

    // Dynamic zoom slicing
    if (chartZoomRange === '30d') {
      chartData = chartData.slice(-30);
    } else if (chartZoomRange === '90d') {
      chartData = chartData.slice(-90);
    } else if (chartZoomRange === '180d') {
      chartData = chartData.slice(-180);
    }
    
    const highs = chartData.map(d => d.high);
    const lows = chartData.map(d => d.low);
    const pricesToBound = [...highs, ...lows];

    const zoomCount = chartZoomRange === '30d' ? 30 : chartZoomRange === '90d' ? 90 : chartZoomRange === '180d' ? 180 : resultData.chart_history.length;
    const startIndex = Math.max(0, resultData.chart_history.length - zoomCount);

    if (resultData.all_detected_events && Array.isArray(resultData.all_detected_events)) {
      resultData.all_detected_events.forEach(evt => {
        if (evt.index >= startIndex && evt.price !== null && evt.price !== undefined) {
          pricesToBound.push(evt.price);
        }
      });
    }

    const minPrice = Math.min(...pricesToBound) * 0.97;
    const maxPrice = Math.max(...pricesToBound) * 1.03;
    const priceDiff = maxPrice - minPrice || 1;

    const showMacd = resultData.type === 'wyckoff_macd';
    const width = 600;
    const height = showMacd ? 290 : 200;
    const paddingLeft = 35;
    const paddingRight = 10;
    const paddingTop = 25; // leave room for labels
    const paddingBottom = 20;

    const priceChartHeight = showMacd ? 180 : 200;

    const getX = (index) => paddingLeft + (index / (chartData.length - 1)) * (width - paddingLeft - paddingRight);
    const getY = (price) => {
      if (price === null || price === undefined) return null;
      return paddingTop + ((maxPrice - price) / priceDiff) * (priceChartHeight - paddingTop - paddingBottom);
    };

    const buildPath = (key) => {
      let dStr = '';
      let first = true;
      for (let i = 0; i < chartData.length; i++) {
        const yVal = getY(chartData[i][key]);
        if (yVal !== null) {
          const xVal = getX(i);
          dStr += `${first ? 'M' : 'L'} ${xVal} ${yVal} `;
          first = false;
        }
      }
      return dStr;
    };

    const closePath = buildPath('close');
    const ma20Path = buildPath('ma20');
    const ma60Path = buildPath('ma60');
    const bbUpperPath = buildPath('bb_upper');
    const bbLowerPath = buildPath('bb_lower');
    const atrStopPath = buildPath('atr_trailing_stop');

    let bbAreaPath = '';
    if (activeOverlays.bb) {
      let upperPoints = [];
      let lowerPoints = [];
      for (let i = 0; i < chartData.length; i++) {
        const x = getX(i);
        const yUpper = getY(chartData[i].bb_upper);
        const yLower = getY(chartData[i].bb_lower);
        if (yUpper !== null && yLower !== null) {
          upperPoints.push(`${x},${yUpper}`);
          lowerPoints.unshift(`${x},${yLower}`);
        }
      }
      if (upperPoints.length > 0) {
        bbAreaPath = `M ${upperPoints.join(' L ')} L ${lowerPoints.join(' L ')} Z`;
      }
    }

    // Support / Resistance Y-coordinates
    const supportY = getY(resultData.support_level);
    const resistanceY = getY(resultData.resistance_level);

    const isSupportVisible = supportY !== null && supportY >= paddingTop && supportY <= (priceChartHeight - paddingBottom);
    const isResistanceVisible = resistanceY !== null && resistanceY >= paddingTop && resistanceY <= (priceChartHeight - paddingBottom);

    return (
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', background: 'var(--chart-bg)', borderRadius: '6px' }}>
          {/* Grid Y lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const p = minPrice + ratio * (maxPrice - minPrice);
            const y = getY(p);
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="var(--chart-grid)"
                  strokeDasharray="3,3"
                  strokeWidth="0.5"
                />
                <text
                  x={paddingLeft - 5}
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--text-3)"
                  fontSize="7"
                >
                  ${p.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Support and Resistance Horizontal lines */}
          {activeOverlays.sr && isSupportVisible && (
            <line
              x1={paddingLeft}
              y1={supportY}
              x2={width - paddingRight}
              y2={supportY}
              stroke="var(--green, #2ecc71)"
              strokeDasharray="5,3"
              strokeWidth="1.2"
              title="Support Line"
            />
          )}
          {activeOverlays.sr && isResistanceVisible && (
            <line
              x1={paddingLeft}
              y1={resistanceY}
              x2={width - paddingRight}
              y2={resistanceY}
              stroke="var(--red, #e74c3c)"
              strokeDasharray="5,3"
              strokeWidth="1.2"
              title="Resistance Line"
            />
          )}

          {/* Support / Resistance Labels */}
          {activeOverlays.sr && isSupportVisible && (
            <text x={width - paddingRight - 5} y={supportY - 4} textAnchor="end" fill="var(--green, #2ecc71)" fontSize="7" fontWeight="bold">
              Sup: ${resultData.support_level}
            </text>
          )}
          {activeOverlays.sr && isResistanceVisible && (
            <text x={width - paddingRight - 5} y={resistanceY + 10} textAnchor="end" fill="var(--red, #e74c3c)" fontSize="7" fontWeight="bold">
              Res: ${resultData.resistance_level}
            </text>
          )}

          {/* Smart Risk Control Level Lines & Labels */}
          {resultData.riskControl && parseFloat(costBasis) > 0 && (() => {
            const rc = resultData.riskControl;
            const costY = getY(parseFloat(costBasis));
            const slY = getY(rc.stopLossPrice);
            const tsY = getY(rc.trailingStopPrice);
            const beY = getY(rc.breakevenPrice);

            const isCostVisible = costY !== null && costY >= paddingTop && costY <= (priceChartHeight - paddingBottom);
            const isSlVisible = slY !== null && slY >= paddingTop && slY <= (priceChartHeight - paddingBottom);
            const isTsVisible = tsY !== null && tsY >= paddingTop && tsY <= (priceChartHeight - paddingBottom);
            const isBeVisible = beY !== null && beY >= paddingTop && beY <= (priceChartHeight - paddingBottom) && rc.isBreakevenActive;

            return (
              <g>
                {/* Cost Basis Line (Blue) */}
                {isCostVisible && (
                  <g>
                    <line
                      x1={paddingLeft}
                      y1={costY}
                      x2={width - paddingRight}
                      y2={costY}
                      stroke="rgba(52, 152, 219, 0.55)"
                      strokeDasharray="3,3"
                      strokeWidth="1.0"
                    />
                    <text x={paddingLeft + 5} y={costY - 4} fill="rgba(52, 152, 219, 0.85)" fontSize="6.5" fontWeight="bold">
                      {lang === 'zh' ? `成本: $${parseFloat(costBasis).toFixed(2)}` : `Cost: $${parseFloat(costBasis).toFixed(2)}`}
                    </text>
                  </g>
                )}
                {/* Stop Loss Line (Red) */}
                {isSlVisible && (
                  <g>
                    <line
                      x1={paddingLeft}
                      y1={slY}
                      x2={width - paddingRight}
                      y2={slY}
                      stroke="rgba(231, 76, 60, 0.55)"
                      strokeDasharray="3,3"
                      strokeWidth="1.0"
                    />
                    <text x={paddingLeft + 5} y={slY - 4} fill="rgba(231, 76, 60, 0.85)" fontSize="6.5" fontWeight="bold">
                      {lang === 'zh' ? `止损: $${rc.stopLossPrice.toFixed(2)}` : `Stop Loss: $${rc.stopLossPrice.toFixed(2)}`}
                    </text>
                  </g>
                )}
                {/* Trailing Stop Line (Yellow/Orange) */}
                {isTsVisible && (
                  <g>
                    <line
                      x1={paddingLeft}
                      y1={tsY}
                      x2={width - paddingRight}
                      y2={tsY}
                      stroke="rgba(243, 156, 18, 0.55)"
                      strokeDasharray="3,3"
                      strokeWidth="1.0"
                    />
                    <text x={paddingLeft + 5} y={tsY - 4} fill="rgba(243, 156, 18, 0.85)" fontSize="6.5" fontWeight="bold">
                      {lang === 'zh' ? `移动止盈: $${rc.trailingStopPrice.toFixed(2)}` : `Trailing Stop: $${rc.trailingStopPrice.toFixed(2)}`}
                    </text>
                  </g>
                )}
                {/* Breakeven protection Line (Green, if active) */}
                {isBeVisible && (
                  <g>
                    <line
                      x1={paddingLeft}
                      y1={beY}
                      x2={width - paddingRight}
                      y2={beY}
                      stroke="rgba(46, 204, 113, 0.55)"
                      strokeDasharray="3,3"
                      strokeWidth="1.0"
                    />
                    <text x={paddingLeft + 5} y={beY - 4} fill="rgba(46, 204, 113, 0.85)" fontSize="6.5" fontWeight="bold">
                      {lang === 'zh' ? `保本: $${rc.breakevenPrice.toFixed(2)} 🔒` : `Breakeven: $${rc.breakevenPrice.toFixed(2)} 🔒`}
                    </text>
                  </g>
                )}
              </g>
            );
          })()}

          {/* Volume Overlay (drawn in background) */}
          {(() => {
            const maxVol = Math.max(...chartData.map(d => d.volume)) || 1;
            const maxVolHeight = 25; // max volume height 25px
            const volScale = maxVolHeight / maxVol;
            const barWidth = Math.max(1, (width - paddingLeft - paddingRight) / chartData.length - 1.5);
            
            return chartData.map((d, i) => {
              const x = getX(i);
              const barHeight = d.volume * volScale;
              const yPos = priceChartHeight - paddingBottom - barHeight;
              const isBull = d.close >= d.open;
              const volColor = isBull ? 'rgba(46, 204, 113, 0.12)' : 'rgba(231, 76, 60, 0.12)';
              
              return (
                <rect
                  key={`vol-overlay-rect-${i}`}
                  x={x - barWidth / 2}
                  y={yPos}
                  width={barWidth}
                  height={barHeight}
                  fill={volColor}
                  pointerEvents="none"
                />
              );
            });
          })()}

          {/* Bollinger Bands Shaded Area */}
          {activeOverlays.bb && bbAreaPath && (
            <path
              d={bbAreaPath}
              fill="rgba(155, 89, 182, 0.05)"
              stroke="none"
              pointerEvents="none"
            />
          )}

          {/* Bollinger Bands Upper/Lower Lines */}
          {activeOverlays.bb && bbUpperPath && (
            <path
              d={bbUpperPath}
              fill="none"
              stroke="rgba(155, 89, 182, 0.35)"
              strokeWidth="0.8"
              strokeDasharray="3,3"
              pointerEvents="none"
            />
          )}
          {activeOverlays.bb && bbLowerPath && (
            <path
              d={bbLowerPath}
              fill="none"
              stroke="rgba(155, 89, 182, 0.35)"
              strokeWidth="0.8"
              strokeDasharray="3,3"
              pointerEvents="none"
            />
          )}

          {/* Candlesticks (K-Line) */}
          {(() => {
            const candleWidth = Math.max(1.8, (width - paddingLeft - paddingRight) / chartData.length - 2);
            
            return chartData.map((d, i) => {
              const x = getX(i);
              const yOpen = getY(d.open);
              const yClose = getY(d.close);
              const yHigh = getY(d.high);
              const yLow = getY(d.low);
              
              const isBull = d.close >= d.open;
              const color = isBull ? 'var(--green, #2ecc71)' : 'var(--red, #e74c3c)';
              const topBody = Math.min(yOpen, yClose);
              const botBody = Math.max(yOpen, yClose);
              const bodyHeight = Math.max(1, botBody - topBody);
              
              return (
                <g key={`candle-g-${i}`}>
                  {/* Shadow Line (Wicks) */}
                  <line
                    x1={x}
                    y1={yHigh}
                    x2={x}
                    y2={yLow}
                    stroke={color}
                    strokeWidth="1.2"
                  />
                  {/* Candle Body */}
                  <rect
                    x={x - candleWidth / 2}
                    y={topBody}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={color}
                    stroke={color}
                    strokeWidth="0.5"
                  />
                </g>
              );
            });
          })()}

          {/* Moving Averages overlaid on top of candlesticks */}
          {activeOverlays.ma && ma60Path && <path d={ma60Path} fill="none" stroke="#9b59b6" strokeWidth="1.2" strokeDasharray="2,2" />}
          {activeOverlays.ma && ma20Path && <path d={ma20Path} fill="none" stroke="#e74c3c" strokeWidth="1.2" />}

          {/* ATR Trailing Stop Line */}
          {activeOverlays.atr_stop && atrStopPath && (
            <path
              d={atrStopPath}
              fill="none"
              stroke="var(--orange, #f39c12)"
              strokeWidth="1.2"
              strokeDasharray="4,2"
              pointerEvents="none"
            />
          )}

          {/* ATR Trailing Stop Label at the rightmost end */}
          {activeOverlays.atr_stop && chartData.length > 0 && (() => {
            const latestDay = chartData[chartData.length - 1];
            if (latestDay && latestDay.atr_trailing_stop) {
              const yVal = getY(latestDay.atr_trailing_stop);
              if (yVal !== null && yVal >= paddingTop && yVal <= (priceChartHeight - paddingBottom)) {
                return (
                  <text
                    x={width - paddingRight - 5}
                    y={yVal - 4}
                    textAnchor="end"
                    fill="var(--orange, #f39c12)"
                    fontSize="7"
                    fontWeight="bold"
                  >
                    ATR Stop: ${latestDay.atr_trailing_stop}
                  </text>
                );
              }
            }
            return null;
          })()}

          {/* Event Annotations on Chart */}
          {chartData.map((d, i) => {
            if (!d.events || d.events.length === 0) return null;
            const x = getX(i);
            const y = getY(d.close);
            
            return d.events.map((evt, eIdx) => {
              const isBuy = ['Spring', 'Spring_Test', 'LPS', 'SOS', 'BU', 'Flag', 'UTAD_Failure', 'PS'].includes(evt);
              const isSell = ['UTAD', 'SOW', 'PSY', 'LPSY'].includes(evt);
              const isStructural = ['SC', 'BC', 'AR', 'AR_Reaction', 'ST', 'ST_Dist'].includes(evt);

              if (isBuy && !showBuySignals) return null;
              if (isSell && !showSellSignals) return null;
              if (isStructural && !showStructuralEvents) return null;

              const isBull = isBuy || evt === 'SC' || evt === 'AR' || evt === 'ST';
              const labelY = isBull ? y + 14 : y - 14;
              
              let markerColor = 'var(--text-3)';
              let displayText = evt;
              
              if (isBuy) {
                markerColor = 'var(--green, #2ecc71)';
                displayText = lang === 'zh' ? `买: ${evt}` : `B: ${evt}`;
              } else if (isSell) {
                markerColor = 'var(--red, #e74c3c)';
                displayText = lang === 'zh' ? `卖: ${evt}` : `S: ${evt}`;
              } else if (evt === 'SC' || evt === 'AR' || evt === 'ST') {
                markerColor = '#3498db'; // blue for accumulation
              } else if (evt === 'BC' || evt === 'AR_Reaction' || evt === 'ST_Dist') {
                markerColor = '#9b59b6'; // purple for distribution
              }

              const boxWidth = displayText.length * 4.2 + 6;
              
              return (
                <g key={`${i}-${eIdx}`}>
                  {/* Line connector */}
                  <line
                    x1={x}
                    y1={y}
                    x2={x}
                    y2={labelY}
                    stroke={markerColor}
                    strokeWidth="0.8"
                    strokeDasharray="1,1"
                  />
                  {/* Circle dot on path */}
                  <circle cx={x} cy={y} r="3" fill={markerColor} stroke="#fff" strokeWidth="0.5" />
                  {/* Text label */}
                  <rect
                    x={x - boxWidth / 2}
                    y={isBull ? labelY : labelY - 8}
                    width={boxWidth}
                    height="8"
                    rx="2"
                    fill={markerColor}
                  />
                  <text
                    x={x}
                    y={isBull ? labelY + 6 : labelY - 2}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="6"
                    fontWeight="bold"
                  >
                    {displayText}
                  </text>
                </g>
              );
            });
          })}

          {/* Date X labels (first, middle, last) */}
          {[0, Math.floor(chartData.length / 2), chartData.length - 1].map((idx) => {
            const d = chartData[idx];
            if (!d) return null;
            return (
              <text
                key={idx}
                x={getX(idx)}
                y={height - 5}
                textAnchor="middle"
                fill="var(--text-3)"
                fontSize="7"
              >
                {d.date}
              </text>
            );
          })}

          {/* Hover Guide Line */}
          {hoveredIndex !== null && chartData[hoveredIndex] && (
            <line
              x1={getX(hoveredIndex)}
              y1={paddingTop}
              x2={getX(hoveredIndex)}
              y2={height - paddingBottom}
              stroke="rgba(255, 255, 255, 0.25)"
              strokeDasharray="3,3"
              strokeWidth="1"
              pointerEvents="none"
            />
          )}

          {/* Hover Node Circle */}
          {hoveredIndex !== null && chartData[hoveredIndex] && (
            <circle
              cx={getX(hoveredIndex)}
              cy={getY(chartData[hoveredIndex].close)}
              r="5"
              fill="var(--cyan, #63b3ed)"
              stroke="#fff"
              strokeWidth="1.5"
              pointerEvents="none"
            />
          )}

          {/* Invisible Hover Rectangles */}
          {chartData.map((d, i) => {
            const colWidth = (width - paddingLeft - paddingRight) / chartData.length;
            const xPos = getX(i) - colWidth / 2;
            return (
              <rect
                key={`hover-trigger-${i}`}
                x={xPos}
                y={paddingTop}
                width={colWidth}
                height={height - paddingTop - paddingBottom}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: 'crosshair' }}
              />
            );
          })}

          {/* MACD Subplot */}
          {showMacd && (() => {
            const macdVals = chartData.map(d => d.macd).filter(v => v !== null && v !== undefined);
            const signalVals = chartData.map(d => d.signal).filter(v => v !== null && v !== undefined);
            const histVals = chartData.map(d => d.hist).filter(v => v !== null && v !== undefined);
            
            const allMacdVals = [...macdVals, ...signalVals, ...histVals];
            const maxMacdAbs = allMacdVals.length > 0 ? Math.max(...allMacdVals.map(Math.abs)) : 1;
            
            // MACD area: Y from 210 to 270, center zero line is Y = 240
            const macdCenterY = 240;
            const macdMaxHeight = 25; // max amplitude of 25px
            const macdScale = macdMaxHeight / (maxMacdAbs || 1);

            // Path generator for MACD Line / Signal Line
            const buildSubPath = (key) => {
              let dStr = '';
              let first = true;
              for (let i = 0; i < chartData.length; i++) {
                const val = chartData[i][key];
                if (val !== null && val !== undefined) {
                  const xVal = getX(i);
                  const yVal = macdCenterY - val * macdScale;
                  dStr += `${first ? 'M' : 'L'} ${xVal} ${yVal} `;
                  first = false;
                }
              }
              return dStr;
            };

            const macdPath = buildSubPath('macd');
            const signalPath = buildSubPath('signal');
            const barWidth = Math.max(1.2, (width - paddingLeft - paddingRight) / chartData.length - 1.5);

            return (
              <g>
                {/* Y Axis line / divider */}
                <line
                  x1={paddingLeft}
                  y1={195}
                  x2={width - paddingRight}
                  y2={195}
                  stroke="var(--chart-grid)"
                  strokeWidth="0.8"
                />

                {/* Sub-chart Title */}
                <text x={paddingLeft} y={206} fill="var(--text-2)" fontSize="7" fontWeight="bold">
                  MACD (12, 26, 9)
                </text>

                {/* Zero Center Line */}
                <line
                  x1={paddingLeft}
                  y1={macdCenterY}
                  x2={width - paddingRight}
                  y2={macdCenterY}
                  stroke="var(--chart-grid)"
                  strokeDasharray="2,2"
                  strokeWidth="0.6"
                />

                {/* Histogram Bars */}
                {chartData.map((d, i) => {
                  if (d.hist === null || d.hist === undefined) return null;
                  const x = getX(i);
                  const yVal = macdCenterY - d.hist * macdScale;
                  const isBullHist = d.hist >= 0;
                  
                  return (
                    <rect
                      key={`macd-hist-rect-${i}`}
                      x={x - barWidth / 2}
                      y={isBullHist ? yVal : macdCenterY}
                      width={barWidth}
                      height={Math.max(0.5, Math.abs(d.hist * macdScale))}
                      fill={isBullHist ? 'rgba(46, 204, 113, 0.7)' : 'rgba(231, 76, 60, 0.7)'}
                    />
                  );
                })}

                {/* MACD Line */}
                {macdPath && (
                  <path
                    d={macdPath}
                    fill="none"
                    stroke="var(--cyan, #63b3ed)"
                    strokeWidth="1.2"
                  />
                )}

                {/* Signal Line */}
                {signalPath && (
                  <path
                    d={signalPath}
                    fill="none"
                    stroke="var(--orange, #ff9f43)"
                    strokeWidth="1.2"
                  />
                )}

                {/* Label values at max and min and zero */}
                <text x={paddingLeft - 5} y={macdCenterY + 3} textAnchor="end" fill="var(--text-3)" fontSize="6">
                  0.00
                </text>
                <text x={paddingLeft - 5} y={macdCenterY - macdMaxHeight + 3} textAnchor="end" fill="var(--text-3)" fontSize="6">
                  +{maxMacdAbs.toFixed(2)}
                </text>
                <text x={paddingLeft - 5} y={macdCenterY + macdMaxHeight + 3} textAnchor="end" fill="var(--text-3)" fontSize="6">
                  -{maxMacdAbs.toFixed(2)}
                </text>
              </g>
            );
          })()}
        </svg>

        {/* Tooltip Overlay */}
        {hoveredIndex !== null && chartData[hoveredIndex] && (() => {
          const item = chartData[hoveredIndex];
          const leftPercent = (getX(hoveredIndex) / width) * 100;
          const isRightSide = leftPercent >= 60;
          return (
            <div style={{
              position: 'absolute',
              top: '30px',
              left: isRightSide ? `calc(${leftPercent}% - 160px)` : `calc(${leftPercent}% + 10px)`,
              background: theme === 'dark' ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '0.6rem 0.8rem',
              fontSize: '0.75rem',
              color: 'var(--text-1)',
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              minWidth: '140px',
              transition: 'left 0.05s ease-out, top 0.05s ease-out'
            }}>
              <div style={{ fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '3px', color: 'var(--text-2)', fontSize: '0.72rem' }}>
                📅 {item.date}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '价格:' : 'Price:'}</span>
                <strong style={{ color: 'var(--cyan)' }}>¥{item.close.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '成交量:' : 'Vol:'}</span>
                <strong>{(item.volume / 1e6).toFixed(2)}M</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <span style={{ color: 'var(--text-3)' }}>MA20:</span>
                <span style={{ color: 'var(--red)' }}>¥{item.ma20?.toFixed(2)}</span>
              </div>
              {activeOverlays.atr_stop && item.atr_trailing_stop && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <span style={{ color: 'var(--text-3)' }}>ATR Stop:</span>
                  <strong style={{ color: 'var(--orange, #f39c12)' }}>¥{item.atr_trailing_stop}</strong>
                </div>
              )}
              
              {item.events && item.events.length > 0 && (
                <div style={{
                  marginTop: '3px',
                  paddingTop: '3px',
                  borderTop: '1px dashed var(--border)',
                  color: 'var(--orange, #ff9f43)',
                  fontWeight: 'bold',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  <span>🚨</span>
                  <span>{lang === 'zh' ? '量价事件:' : 'Event:'} {item.events.join(', ')}</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Legend */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0.8rem',
          marginTop: '0.5rem',
          fontSize: '0.7rem'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--text-1)' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '8px', border: '1px solid var(--text-2)', backgroundColor: 'var(--green, #2ecc71)', borderRadius: '1px' }} />
            {lang === 'zh' ? 'K线' : 'Candles'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#e74c3c' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '2px', backgroundColor: '#e74c3c' }} />
            MA20
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#9b59b6' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '2px', strokeDasharray: '2,2', backgroundColor: '#9b59b6' }} />
            MA60
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--green, #2ecc71)' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '1px', borderTop: '1px dashed var(--green, #2ecc71)' }} />
            {lang === 'zh' ? '支撑位' : 'Support'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--red, #e74c3c)' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '1px', borderTop: '1px dashed var(--red, #e74c3c)' }} />
            {lang === 'zh' ? '阻力位' : 'Resistance'}
          </span>
          {activeOverlays.atr_stop && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--orange, #f39c12)' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '2px', strokeDasharray: '4,2', backgroundColor: 'var(--orange, #f39c12)' }} />
              {lang === 'zh' ? 'ATR止盈线' : 'ATR Stop Line'}
            </span>
          )}
          {showMacd && (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--cyan, #63b3ed)' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '2px', backgroundColor: 'var(--cyan, #63b3ed)' }} />
                MACD
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--orange, #ff9f43)' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '2px', backgroundColor: 'var(--orange, #ff9f43)' }} />
                Signal
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--green, #2ecc71)' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '4px', backgroundColor: 'rgba(46, 204, 113, 0.7)' }} />
                {lang === 'zh' ? '能量柱(多头)' : 'Hist (Bull)'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--red, #e74c3c)' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '4px', backgroundColor: 'rgba(231, 76, 60, 0.7)' }} />
                {lang === 'zh' ? '能量柱(空头)' : 'Hist (Bear)'}
              </span>
            </>
          )}
        </div>
      </div>
    );
  };

  const isWyckoffReady = result && (result.type === 'wyckoff' || result.type === 'wyckoff_macd');
  const isClassicReady = result && result.type === 'classic';

  return (
    <div className="live-analyzer-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <section className="module">
        <div className="section-header">
          <div className="section-icon">📡</div>
          <div>
            <div className="section-title">{t('liveAnalyzerTitle')}</div>
            <div className="section-desc">{t('liveAnalyzerDesc')}</div>
          </div>
        </div>

        {/* Disclaimer Banner */}
        <div style={{
          background: 'rgba(52, 152, 219, 0.08)',
          border: '1px solid rgba(52, 152, 219, 0.25)',
          borderRadius: 'var(--radius, 8px)',
          padding: '0.8rem 1rem',
          marginTop: '1rem',
          fontSize: '0.8rem',
          lineHeight: '1.5',
          color: 'var(--text-2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem'
        }}>
          <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
          <span>
            {lang === 'zh' ? (
              <>
                <strong>声明：</strong>本功能仅提供基于技术形态与简易量价因子的快速扫描 (Quick Scan)。如需对个股进行全方位深度基本面、资金筹码及机构评级量化分析，请前往我们的主力分析终端：
                <a href="https://quantbot.wendao51.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan, #63b3ed)', marginLeft: '4px', textDecoration: 'underline', fontWeight: 600 }}>
                  quantbot.wendao51.com
                </a>
              </>
            ) : (
              <>
                <strong>Disclaimer:</strong> This feature only provides a quick scan based on technical patterns and simple price-volume factors. For comprehensive multi-dimensional stock analysis, please visit our main terminal:
                <a href="https://quantbot.wendao51.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan, #63b3ed)', marginLeft: '4px', textDecoration: 'underline', fontWeight: 600 }}>
                  quantbot.wendao51.com
                </a>
              </>
            )}
          </span>
        </div>
        {/* Main Grid: Left Panel (Inputs) vs Right Panel (Results) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '360px 1fr',
          gap: '1.5rem',
          alignItems: 'start',
          marginTop: '1.2rem'
        }} className="analyzer-grid">
          
          {/* LEFT PANEL: Inputs Card */}
          <div className="analyzer-left-panel" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            position: 'sticky',
            top: '5.5rem'
          }}>
            {/* Input Form Panel */}
            <div className="analyzer-form-card" style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius, 8px)',
          padding: '1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginTop: '1rem'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            alignItems: 'start'
          }}>
            {/* Symbol Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 500 }}>
                  {lang === 'zh' ? '股票代码 (Ticker)' : 'Stock Symbol'}
                </label>
                <span
                  onClick={addToWatchlist}
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--cyan)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'underline'
                  }}
                  title={lang === 'zh' ? '将当前代码加入自选清单' : 'Add current code to watchlist'}
                >
                  {lang === 'zh' ? '+ 加入自选' : '+ Watchlist'}
                </span>
              </div>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="e.g. 600519.SS or 002594.SZ"
                style={{
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '0.55rem 0.8rem',
                  color: 'var(--text-1)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  textTransform: 'uppercase',
                  height: '38px',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: '0.2rem', lineHeight: '1.3' }}>
                {lang === 'zh' ? (
                  <>
                    💡 支持智能补全：输入纯数字可自动识别（60xxxx 补 <strong>.SS</strong>，00xxxx/30xxxx 补 <strong>.SZ</strong>，港股补 <strong>.HK</strong>）
                  </>
                ) : (
                  <>
                    💡 Smart Suffix: Pure numbers auto-complete (e.g. 60xxxx to <strong>.SS</strong>, 00xxxx to <strong>.SZ</strong>, HK stocks to <strong>.HK</strong>)
                  </>
                )}
              </span>
            </div>

            {/* Sector Choice */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 500 }}>
                {lang === 'zh' ? '关联板块 (Sector Constraint)' : 'Related Sector'}
              </label>
              <select
                value={sectorName}
                onChange={(e) => setSectorName(e.target.value)}
                style={{
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '0.55rem 0.8rem',
                  color: 'var(--text-1)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  height: '38px',
                  boxSizing: 'border-box'
                }}
              >
                <option value="Auto">{lang === 'zh' ? '自动匹配 / 通用' : 'Auto Detect / Generic'}</option>
                {sectorsList.map(sec => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </select>
            </div>

            {/* Sentiment Override Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', height: '17px', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-2)' }}>{lang === 'zh' ? '模拟舆情得分' : 'Simulated Sentiment'}</span>
                <span style={{
                  color: manualSentiment > 0.15 ? 'var(--green)' : manualSentiment < -0.15 ? 'var(--red)' : 'var(--text-3)',
                  fontWeight: 600
                }}>
                  {manualSentiment > 0 ? '+' : ''}{manualSentiment}
                </span>
              </div>
              <div style={{ height: '38px', display: 'flex', alignItems: 'center' }}>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={manualSentiment}
                  onChange={(e) => setManualSentiment(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: 'var(--cyan)',
                    cursor: 'pointer'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Analysis Methodology - Wyckoff MACD (No Switcher, Sensitivity Only) */}
          <div style={{
            borderTop: '1px dashed var(--border)',
            paddingTop: '0.8rem',
            marginTop: '0.2rem'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>
                  {t('wyckoffSensitivity')}: <strong style={{ color: 'var(--cyan)' }}>{Math.round(sensitivity * 100)}%</strong>
                </span>
                <span style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>
                  {sensitivity <= 0.35 ? (lang === 'zh' ? '保守策略 (默认)' : 'Conservative (Default)') :
                   sensitivity <= 0.7 ? (lang === 'zh' ? '中性策略' : 'Moderate') :
                   (lang === 'zh' ? '激进策略' : 'Aggressive')}
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={sensitivity}
                onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: 'var(--cyan)',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>

          {/* News Headline Simulation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 500 }}>
              {lang === 'zh' ? '模拟新闻标题 (可选 - 自动根据标题极性计算得分)' : 'Simulated News Headline (Optional - auto calculates sentiment)'}
            </label>
            <input
              type="text"
              value={customHeadline}
              onChange={(e) => {
                const val = e.target.value;
                setCustomHeadline(val);
                if (val.trim() !== "") {
                  const score = calculateSentimentScore(val);
                  setManualSentiment(score);
                } else {
                  setManualSentiment(0.0);
                }
              }}
              placeholder="e.g. record high profit beats forecast, or downgrade warnings on weak demand"
              style={{
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '0.55rem 0.8rem',
                color: 'var(--text-1)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Risk Control Settings Panel */}
          <div style={{
            background: 'rgba(52, 152, 219, 0.04)',
            border: '1px dashed var(--border)',
            borderRadius: '6px',
            padding: '0.8rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            marginTop: '0.2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)' }}>
              <span>🛡️</span> {lang === 'zh' ? '算法风控设置 (激活买卖点评)' : 'Risk Control Rules (Activates Sell Signals)'}
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-2)', width: '70px', flexShrink: 0 }}>
                {lang === 'zh' ? '持仓成本:' : 'Cost Basis:'}
              </label>
              <input
                type="number"
                value={costBasis}
                onChange={(e) => setCostBasis(e.target.value)}
                placeholder={lang === 'zh' ? '输入您的成本价' : 'e.g. 6.00'}
                step="0.01"
                min="0"
                style={{
                  flex: 1,
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  padding: '0.35rem 0.6rem',
                  color: 'var(--text-1)',
                  fontSize: '0.78rem',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ fontStyle: 'italic', fontSize: '0.68rem', color: 'var(--text-3)', paddingLeft: '75px', marginTop: '-0.3rem', lineHeight: '1.3' }}>
              {lang === 'zh' 
                ? '* 输入持股成本价后，即刻激活右侧的智能买卖风控看板。' 
                : '* Input cost basis to instantly activate the smart buy/sell risk board on the right.'}
            </div>

            {costBasis && parseFloat(costBasis) > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.2rem' }}>
                {result?.volatility_metrics && (
                  <div style={{
                    background: 'rgba(52, 152, 219, 0.08)',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    fontSize: '0.72rem',
                    color: 'var(--text-2)',
                    lineHeight: '1.4',
                    border: '1px solid rgba(52, 152, 219, 0.15)'
                  }}>
                    💡 {lang === 'zh' ? '个股特征：' : 'Stock Type: '}
                    <strong>
                      {result.volatility_metrics.volatility_type === 'low' && (lang === 'zh' ? '低波动蓝筹股' : 'Low Volatility Blue-chip')}
                      {result.volatility_metrics.volatility_type === 'moderate' && (lang === 'zh' ? '中波动成长股' : 'Moderate Volatility Growth')}
                      {result.volatility_metrics.volatility_type === 'high' && (lang === 'zh' ? '高波动题材股' : 'High Volatility Speculative')}
                    </strong>
                    （{lang === 'zh' ? '日均波幅' : 'Daily ATR'} {result.volatility_metrics.avg_atr_pct}%）。
                    <br />
                    {lang === 'zh' ? '智能推荐：移动止盈 ' : 'Recommends: Trailing Stop '}<strong>{result.volatility_metrics.rec_trailing_stop}%</strong>，
                    {lang === 'zh' ? '保本 ' : 'Breakeven '}<strong>{result.volatility_metrics.rec_breakeven}%</strong>。
                    <span
                      onClick={() => {
                        setMaxDrawdownPct(result.volatility_metrics.rec_trailing_stop);
                        setBreakevenTriggerPct(result.volatility_metrics.rec_breakeven);
                      }}
                      style={{
                        color: 'var(--cyan)',
                        marginLeft: '0.4rem',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      {lang === 'zh' ? '[点击套用]' : '[Apply]'}
                    </span>
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(52, 152, 219, 0.06)',
                  border: '1px solid rgba(52, 152, 219, 0.15)',
                  borderRadius: '4px',
                  padding: '0.4rem 0.5rem',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  marginTop: '0.2rem'
                }} onClick={() => setUseAdaptiveVolatility(prev => !prev)}>
                  <input
                    type="checkbox"
                    checked={useAdaptiveVolatility}
                    onChange={() => {}} // handled by click container
                    style={{ accentColor: 'var(--cyan)', cursor: 'pointer' }}
                  />
                  <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>
                    {lang === 'zh' ? '开启自适应波动率 (ATR) 风控' : 'Enable Adaptive Volatility (ATR) Stop'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', opacity: useAdaptiveVolatility ? 0.75 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-2)' }}>
                      {lang === 'zh' ? '移动止盈回撤阀值:' : 'Trailing Stop:'} <strong style={{ color: 'var(--cyan)' }}>
                        {useAdaptiveVolatility && result?.riskControl?.activeMaxDrawdownPct
                          ? `${result.riskControl.activeMaxDrawdownPct.toFixed(1)}% (ATR自适应)`
                          : `${maxDrawdownPct}%`}
                      </strong>
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={maxDrawdownPct}
                    disabled={useAdaptiveVolatility}
                    onChange={(e) => setMaxDrawdownPct(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--cyan)', cursor: useAdaptiveVolatility ? 'not-allowed' : 'pointer' }}
                  />
                  <div style={{ fontStyle: 'italic', fontSize: '0.68rem', color: 'var(--text-3)', lineHeight: '1.3', marginTop: '0.1rem' }}>
                    {lang === 'zh' 
                      ? (useAdaptiveVolatility ? '已激活 ATR 自适应移动止盈保护（3.0 * ATR 回撤）。' : '股价从入场后的最高点跌落达此比例时清仓，用于防止高位利润回吐。')
                      : (useAdaptiveVolatility ? 'ATR Adaptive Trailing Stop active (3.0 * ATR drawdown).' : 'Exit position if price falls this % from its peak after entry to protect profits.')}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', opacity: useAdaptiveVolatility ? 0.75 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-2)' }}>
                      {lang === 'zh' ? '保本激活收益门槛:' : 'Breakeven Trigger:'} <strong style={{ color: 'var(--cyan)' }}>
                        {useAdaptiveVolatility && result?.riskControl?.activeBreakevenTriggerPct
                          ? `${result.riskControl.activeBreakevenTriggerPct.toFixed(1)}% (ATR自适应)`
                          : `${breakevenTriggerPct}%`}
                      </strong>
                    </span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="50"
                    step="5"
                    value={breakevenTriggerPct}
                    disabled={useAdaptiveVolatility}
                    onChange={(e) => setBreakevenTriggerPct(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--cyan)', cursor: useAdaptiveVolatility ? 'not-allowed' : 'pointer' }}
                  />
                  <div style={{ fontStyle: 'italic', fontSize: '0.68rem', color: 'var(--text-3)', lineHeight: '1.3', marginTop: '0.1rem' }}>
                    {lang === 'zh' 
                      ? (useAdaptiveVolatility ? '已激活 ATR 自适应保本锁触发门槛（4.0 * ATR 浮盈，保本位为 1.0 * ATR）。' : '浮盈达此门槛启动保本保护，若回落至成本价*1.05即锁定出局，确保稳赚不赔。')
                      : (useAdaptiveVolatility ? 'ATR Adaptive Breakeven Trigger active (4.0 * ATR profit, exit at 1.0 * ATR).' : 'Activate protection once profit hits this %. Exit at cost*1.05 if price recedes.')}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick recommendations chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{lang === 'zh' ? '热门搜索:' : 'Quick Picks:'}</span>
            {quickTickers.map(t => (
              <button
                key={t.code}
                onClick={() => handleQuickClick(t.code)}
                style={{
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '0.75rem',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.borderColor = 'var(--text-3)'}
                onMouseOut={(e) => e.target.style.borderColor = 'var(--border)'}
              >
                {t.code} ({t.name})
              </button>
            ))}
          </div>

          {/* Watchlist chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px dashed var(--border)', paddingTop: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ⭐ {lang === 'zh' ? '自选清单:' : 'Watchlist:'}
            </span>
            {watchlist.length === 0 ? (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontStyle: 'italic' }}>
                {lang === 'zh' ? '暂无自选，请输入代码并点击“+ 加入自选”' : 'Empty, type code and click "+ Watchlist"'}
              </span>
            ) : (
              watchlist.map(code => (
                <div
                  key={code}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: 'rgba(99, 179, 237, 0.08)',
                    border: '1px solid rgba(99, 179, 237, 0.3)',
                    borderRadius: '12px',
                    padding: '2px 8px',
                    gap: '4px',
                    fontSize: '0.75rem'
                  }}
                >
                  <span
                    onClick={() => handleWatchlistClick(code)}
                    style={{
                      color: 'var(--cyan, #63b3ed)',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {STOCK_NAME_MAP[code.split('.')[0]] ? `${code} (${STOCK_NAME_MAP[code.split('.')[0]]})` : code}
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWatchlist(code);
                    }}
                    style={{
                      color: 'var(--text-3)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      paddingLeft: '2px',
                      userSelect: 'none'
                    }}
                    title={lang === 'zh' ? '删除' : 'Remove'}
                  >
                    ×
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Action Trigger */}
          <button
            onClick={() => handleAnalyze()}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, var(--cyan) 0%, #2980b9 100%)',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.92rem',
              padding: '0.7rem',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(52, 152, 219, 0.2)',
              transition: 'opacity 0.2s',
              marginTop: '0.5rem'
            }}
            onMouseOver={(e) => e.target.style.opacity = 0.9}
            onMouseOut={(e) => e.target.style.opacity = 1}
          >
            {loading ? (lang === 'zh' ? '正在执行量化扫描...' : 'Running Diagnostics...') : (lang === 'zh' ? '🚀 接入实时数据并诊断' : '🚀 Run Quant Diagnostics')}
          </button>
        </div>
      </div>

      {/* RIGHT PANEL: Outputs */}
      <div className="analyzer-right-panel" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        minWidth: 0
      }}>
        {/* Loading Spinner */}
        {loading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem',
            gap: '1rem'
          }}>
            <div className="spinner" style={{
              width: '40px',
              height: '40px',
              border: '4px solid var(--border)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <div style={{ color: 'var(--text-2)', fontSize: '0.88rem', fontWeight: 500 }}>
              {loadingStep}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{
            background: 'rgba(231, 76, 60, 0.1)',
            border: '1px solid var(--red)',
            borderRadius: '6px',
            color: 'var(--red)',
            padding: '1rem',
            marginTop: '1rem',
            fontSize: '0.85rem',
            lineHeight: 1.5
          }}>
            <strong>⚠️ {lang === 'zh' ? '诊断出错' : 'Diagnostic Error'}:</strong> {error}
          </div>
        )}

        {/* Data Quality Warning */}
        {result?.data_quality?.status === 'warning' && (
          <div style={{
            background: 'rgba(230, 126, 34, 0.1)',
            border: '1px solid var(--orange)',
            borderRadius: '6px',
            color: 'var(--orange)',
            padding: '0.8rem 1rem',
            marginTop: '1rem',
            fontSize: '0.82rem',
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>⚠️ <strong>{lang === 'zh' ? '数据提示' : 'Data Alert'}:</strong> {lang === 'zh' ? result.data_quality.message_zh : result.data_quality.message_en}</span>
          </div>
        )}

        {/* Diagnostic Report Panel */}
        {result && (
          <div className="diagnostic-report" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {isWyckoffReady ? (
              <>
                {/* Header Status Bar */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-hover)',
                  padding: '0.8rem 1.2rem',
                  borderRadius: '6px',
                  borderLeft: `4px solid ${
                    result.phase === 'accumulation' ? 'var(--green, #2ecc71)' :
                    result.phase === 'markup' ? 'var(--blue, #3498db)' :
                    result.phase === 'distribution' ? 'var(--red, #e74c3c)' :
                    result.phase === 'markdown' ? 'var(--yellow, #f1c40f)' :
                    'var(--text-3)'
                  }`
                }}>
                  <div>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-1)', marginRight: '0.5rem' }}>
                      {result.symbol} {STOCK_NAME_MAP[result.symbol.split('.')[0]] ? `(${STOCK_NAME_MAP[result.symbol.split('.')[0]]})` : ''}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
                      Wyckoff Analysis
                    </span>
                  </div>
                  <div>
                    <span style={{
                      background: 
                        result.phase === 'accumulation' ? 'rgba(46,204,113,0.15)' :
                        result.phase === 'markup' ? 'rgba(52,152,219,0.15)' :
                        result.phase === 'distribution' ? 'rgba(231,76,60,0.15)' :
                        result.phase === 'markdown' ? 'rgba(241,196,15,0.15)' :
                        'rgba(155, 89, 182, 0.15)',
                      color:
                        result.phase === 'accumulation' ? 'var(--green, #2ecc71)' :
                        result.phase === 'markup' ? 'var(--blue, #3498db)' :
                        result.phase === 'distribution' ? 'var(--red, #e74c3c)' :
                        result.phase === 'markdown' ? 'var(--yellow, #f1c40f)' :
                        '#9b59b6',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 700
                    }}>
                      {lang === 'zh' ? result.phase_label_zh : result.phase_label_en}
                    </span>
                    {result.wyckoff_subphase && (
                      <span style={{
                        background: 'rgba(100, 181, 246, 0.12)',
                        color: 'var(--cyan, #64b5f6)',
                        border: '1px solid rgba(100, 181, 246, 0.35)',
                        padding: '3px 9px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        marginLeft: '6px',
                        letterSpacing: '0.03em'
                      }}>
                        {lang === 'zh' ? result.wyckoff_subphase_label_zh : result.wyckoff_subphase_label_en}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bearish/Top Divergence Alarm */}
                {((result.macd && result.macd.bearish_divergence) || result.effort_vs_result?.status === 'bearish_divergence') && (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(231, 76, 60, 0.12) 0%, rgba(192, 57, 43, 0.12) 100%)',
                    border: '1px solid rgba(231, 76, 60, 0.4)',
                    borderRadius: '8px',
                    color: 'var(--red, #e74c3c)',
                    padding: '0.8rem 1.2rem',
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontWeight: 'bold',
                    boxShadow: '0 0 10px rgba(231, 76, 60, 0.1)'
                  }}>
                    <span style={{ fontSize: '1.1rem' }}>🚨</span>
                    <div>
                      <strong>{lang === 'zh' ? '【核心警报：顶背离检测】' : '[ALARM: Bearish Divergence]'}</strong>{' '}
                      {lang === 'zh'
                        ? '检测到价格与动能指标顶背离！上涨力量衰竭，主力高位派发嫌疑增加，防范高位崩盘及重挫风险，建议逐步止盈或分批减仓。'
                        : 'Price and momentum top divergence detected! Upward buying pressure is exhausted; institutional distribution risk is extremely high. Gradually lock in profits or reduce exposure.'}
                    </div>
                  </div>
                )}

                {/* Card 0: Algorithmic Risk Control Diagnostics */}
                {result.riskControl && (
                  <div style={{
                    background: result.riskControl.action === 'EXIT_ALL'
                      ? 'linear-gradient(135deg, rgba(231, 76, 60, 0.1) 0%, rgba(192, 57, 43, 0.1) 100%)'
                      : result.riskControl.action === 'REDUCE_50'
                      ? 'linear-gradient(135deg, rgba(243, 156, 18, 0.1) 0%, rgba(211, 84, 0, 0.1) 100%)'
                      : 'linear-gradient(135deg, rgba(46, 204, 113, 0.08) 0%, rgba(39, 174, 96, 0.08) 100%)',
                    border: `1px solid ${
                      result.riskControl.action === 'EXIT_ALL' ? 'rgba(231, 76, 60, 0.3)' :
                      result.riskControl.action === 'REDUCE_50' ? 'rgba(243, 156, 18, 0.3)' :
                      'rgba(46, 204, 113, 0.3)'
                    }`,
                    borderRadius: '8px',
                    padding: '1.2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.8rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        color: result.riskControl.action === 'EXIT_ALL' ? 'var(--red, #e74c3c)' :
                               result.riskControl.action === 'REDUCE_50' ? 'var(--yellow, #f39c12)' :
                               'var(--green, #2ecc71)',
                        fontSize: '0.92rem',
                        fontWeight: 700
                      }}>
                        <span>🛡️</span> {lang === 'zh' ? '算法风控智能诊断' : 'Algorithmic Risk Diagnostics'}
                      </h4>
                      <div style={{
                        background: result.riskControl.action === 'EXIT_ALL' ? 'var(--red, #e74c3c)' :
                                    result.riskControl.action === 'REDUCE_50' ? 'var(--yellow, #f39c12)' :
                                    'var(--green, #2ecc71)',
                        color: '#fff',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 700
                      }}>
                        {result.riskControl.action === 'EXIT_ALL' && (lang === 'zh' ? '🚨 建议清仓离场' : '🚨 EXIT ALL')}
                        {result.riskControl.action === 'REDUCE_50' && (lang === 'zh' ? '⚠️ 建议减仓 50%' : '⚠️ REDUCE 50%')}
                        {result.riskControl.action === 'HOLD' && (lang === 'zh' ? '✅ 建议继续持有' : '✅ HOLD POSITION')}
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '0.6rem',
                      background: 'var(--bg-hover)',
                      padding: '0.8rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem'
                    }}>
                      <div>
                        <div style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '持仓成本' : 'Cost Basis'}</div>
                        <strong style={{ color: 'var(--text-1)', fontSize: '0.9rem' }}>¥{parseFloat(costBasis).toFixed(2)}</strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '当前盈亏' : 'Return'}</div>
                        <strong style={{
                          color: result.riskControl.currentProfitPct >= 0 ? 'var(--green, #2ecc71)' : 'var(--red, #e74c3c)',
                          fontSize: '0.9rem'
                        }}>
                          {result.riskControl.currentProfitPct >= 0 ? '+' : ''}{result.riskControl.currentProfitPct.toFixed(2)}%
                        </strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '入场后最高点' : 'Peak Price'}</div>
                        <strong style={{ color: 'var(--text-1)', fontSize: '0.9rem' }}>¥{result.riskControl.peakPrice.toFixed(2)}</strong>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '自最高点回撤' : 'Drawdown'}</div>
                        <strong style={{
                          color: result.riskControl.drawdownFromPeak >= maxDrawdownPct ? 'var(--red, #e74c3c)' : 'var(--text-1)',
                          fontSize: '0.9rem'
                        }}>
                          {result.riskControl.drawdownFromPeak.toFixed(2)}%
                        </strong>
                      </div>
                    </div>

                    {/* Wind control status details */}
                    <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '硬止损线 (10%):' : 'Hard Stop-Loss (10%):'}</span>
                        <span style={{ color: 'var(--red, #e74c3c)', fontWeight: 600 }}>¥{result.riskControl.stopLossPrice.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? `移动止盈触发价 (回撤 ${maxDrawdownPct}%):` : `Trailing Stop Trigger (${maxDrawdownPct}%):`}</span>
                        <span style={{ color: 'var(--yellow, #f39c12)', fontWeight: 600 }}>¥{result.riskControl.trailingStopPrice.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? `保本激活目标价 (+${breakevenTriggerPct}%):` : `Breakeven Target (+${breakevenTriggerPct}%):`}</span>
                        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>¥{result.riskControl.breakevenTriggerPrice.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '保本平仓保护线 (成本*1.05):' : 'Breakeven Exit Line (Cost*1.05):'}</span>
                        <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>¥{result.riskControl.breakevenPrice.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '保本激活状态:' : 'Breakeven Status:'}</span>
                        <span style={{
                          color: result.riskControl.isBreakevenActive ? 'var(--green, #2ecc71)' : 'var(--text-3)',
                          fontWeight: 600
                        }}>
                          {result.riskControl.isBreakevenActive
                            ? (lang === 'zh' ? '🔒 已激活保本保护' : '🔒 Active')
                            : (lang === 'zh' ? '🔓 未激活 (浮盈未达标)' : '🔓 Inactive')}
                        </span>
                      </div>
                    </div>

                    {/* Action Reasons */}
                    {result.riskControl.reasons_zh.length > 0 && (
                      <div style={{
                        background: 'rgba(0,0,0,0.1)',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '4px',
                        fontSize: '0.78rem',
                        lineHeight: '1.5',
                        color: 'var(--text-2)'
                      }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-1)', marginBottom: '0.2rem' }}>
                          {lang === 'zh' ? '信号触发依据:' : 'Triggers Hit:'}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                          {(lang === 'zh' ? result.riskControl.reasons_zh : result.riskControl.reasons_en).map((reason, idx) => (
                            <li key={idx} style={{ color: 'var(--text-2)' }}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Trapped Recovery Assistant Sub-card (Step 3) */}
                    {result.riskControl.isTrapped && result.riskControl.trappedDiagnostic && (
                      <div style={{
                        background: 'rgba(243, 156, 18, 0.06)',
                        border: '1px solid rgba(243, 156, 18, 0.2)',
                        borderRadius: '6px',
                        padding: '0.8rem',
                        marginTop: '0.4rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem'
                      }}>
                        <div style={{
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          color: 'var(--yellow, #f39c12)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}>
                          <span>💡</span> {lang === 'zh' ? '专属诊断：套牢盘主动防御与解套策略' : 'Trapped Position Recovery Strategy'}
                        </div>
                        <div style={{
                          fontSize: '0.76rem',
                          color: 'var(--text-2)',
                          lineHeight: '1.4'
                        }}>
                          {lang === 'zh' ? result.riskControl.trappedDiagnostic.advice_zh : result.riskControl.trappedDiagnostic.advice_en}
                        </div>
                        <div style={{
                          background: 'var(--bg-hover)',
                          padding: '0.4rem 0.6rem',
                          borderRadius: '4px',
                          fontSize: '0.74rem',
                          color: 'var(--cyan)',
                          fontWeight: 600,
                          marginTop: '0.2rem'
                        }}>
                          📌 {lang === 'zh' ? '执行区间建议：' : 'Execution Range: '}
                          <span style={{ color: 'var(--text-1)' }}>
                            {lang === 'zh' ? result.riskControl.trappedDiagnostic.range_zh : result.riskControl.trappedDiagnostic.range_en}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Card 1: AI Wyckoff Insights */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(142, 68, 173, 0.08) 0%, rgba(52, 152, 219, 0.08) 100%)',
                  border: '1px solid rgba(142, 68, 173, 0.2)',
                  borderRadius: '8px',
                  padding: '1.2rem',
                }}>
                  <h4 style={{ margin: '0 0 0.6rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--purple, #a855f7)', fontSize: '0.92rem' }}>
                    <span>🔮</span> {lang === 'zh' ? 'AI Wyckoff 智能诊断点评' : 'AI Wyckoff Technical Analysis'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.84rem', lineHeight: '1.6', color: 'var(--text-1)', whiteSpace: 'pre-wrap' }}>
                    {lang === 'zh' 
                      ? result.wyckoff_insight_zh + getSectorComment(result.symbol, 'zh') 
                      : result.wyckoff_insight_en + getSectorComment(result.symbol, 'en')}
                  </p>
                </div>

                {/* Two Column Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1rem'
                }}>
                  {/* Card 2: Phase Visualizer */}
                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}>
                    <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '0.85rem', color: 'var(--text-2)', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
                      ⚙️ {lang === 'zh' ? 'Wyckoff 阶段状态指标' : 'Wyckoff Phase Metrics'}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-3)' }}>{t('wyckoffConfidence')}</span>
                        <strong style={{ color: 'var(--cyan)' }}>{Math.round(result.phase_confidence * 100)}%</strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '波动率状态' : 'Volatility State'}</span>
                        {result.bb_squeeze ? (
                          <span style={{
                            background: result.bb_squeeze.is_squeeze ? 'rgba(155, 89, 182, 0.15)' :
                                        result.bb_squeeze.is_breakout ? 'rgba(46, 204, 113, 0.15)' : 'var(--bg-hover)',
                            color: result.bb_squeeze.is_squeeze ? '#9b59b6' :
                                   result.bb_squeeze.is_breakout ? 'var(--green)' : 'var(--text-2)',
                            border: `1px solid ${
                              result.bb_squeeze.is_squeeze ? 'rgba(155, 89, 182, 0.3)' :
                              result.bb_squeeze.is_breakout ? 'rgba(46, 204, 113, 0.3)' : 'var(--border)'
                            }`,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 600
                          }}>
                            {result.bb_squeeze.is_squeeze ? (lang === 'zh' ? '🟣 波动凝聚 (Squeeze)' : '🟣 Squeeze') :
                             result.bb_squeeze.is_breakout ? (lang === 'zh' ? '🚀 突破释放 (Breakout)' : '🚀 Breakout') :
                             (lang === 'zh' ? '正常 (Normal)' : 'Normal')}
                          </span>
                        ) : (
                          <strong style={{ color: 'var(--text-3)' }}>-</strong>
                        )}
                      </div>
                      
                      {/* Phase bar visualizer */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem' }}>
                        <span style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>{lang === 'zh' ? '生命周期位置:' : 'Market Cycle Position:'}</span>
                        <div style={{
                          display: 'flex',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          height: '10px',
                          background: 'var(--border)'
                        }}>
                          <div title="Accumulation" style={{ flex: 1, background: result.phase === 'accumulation' ? 'var(--green, #2ecc71)' : (result.phase === 'neutral' ? 'rgba(155, 89, 182, 0.45)' : 'rgba(46,204,113,0.2)') }} />
                          <div title="Markup" style={{ flex: 1, background: result.phase === 'markup' ? 'var(--blue, #3498db)' : 'rgba(52,152,219,0.2)' }} />
                          <div title="Distribution" style={{ flex: 1, background: result.phase === 'distribution' ? 'var(--red, #e74c3c)' : (result.phase === 'neutral' ? 'rgba(155, 89, 182, 0.45)' : 'rgba(231,76,60,0.2)') }} />
                          <div title="Markdown" style={{ flex: 1, background: result.phase === 'markdown' ? 'var(--yellow, #f1c40f)' : 'rgba(241,196,15,0.2)' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-3)', marginTop: '0.1rem' }}>
                          <span>{lang === 'zh' ? '吸筹' : 'Accum'}</span>
                          <span>{lang === 'zh' ? '拉升' : 'Markup'}</span>
                          <span>{lang === 'zh' ? '派发' : 'Dist'}</span>
                          <span>{lang === 'zh' ? '砸盘' : 'Markdown'}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', marginTop: '0.2rem' }}>
                        <span style={{ color: 'var(--text-3)' }}>{t('wyckoffSupport')}</span>
                        <strong style={{ color: 'var(--green)' }}>${result.support_level}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-3)' }}>{t('wyckoffResistance')}</span>
                        <strong style={{ color: 'var(--red)' }}>${result.resistance_level}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Effort vs Result Analyzer */}
                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '1rem'
                  }}>
                    <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '0.85rem', color: 'var(--text-2)', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
                      ⚖️ {t('effortVsResult')}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '量价背离状态' : 'Divergence Status'}</span>
                        <span style={{
                          background: result.effort_vs_result.status.includes('bullish') ? 'rgba(46,204,113,0.15)' :
                                      result.effort_vs_result.status.includes('bearish') ? 'rgba(231,76,60,0.15)' :
                                      'var(--bg-hover)',
                          color: result.effort_vs_result.status.includes('bullish') ? 'var(--green)' :
                                 result.effort_vs_result.status.includes('bearish') ? 'var(--red)' :
                                 'var(--text-2)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.75rem'
                        }}>
                          {lang === 'zh' ? result.effort_vs_result.label_zh : result.effort_vs_result.label_en}
                        </span>
                      </div>
                      <p style={{
                        margin: '0.4rem 0 0 0',
                        fontSize: '0.78rem',
                        lineHeight: '1.5',
                        color: 'var(--text-2)',
                        background: 'var(--bg-hover)',
                        padding: '0.6rem',
                        borderRadius: '6px',
                        borderLeft: `3px solid ${result.effort_vs_result.status.includes('bullish') ? 'var(--green)' : result.effort_vs_result.status.includes('bearish') ? 'var(--red)' : 'var(--border)'}`
                      }}>
                        {lang === 'zh' ? result.effort_vs_result.detail_zh : result.effort_vs_result.detail_en}
                      </p>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-3)' }}>RSI(14)</span>
                        <strong style={{ color: result.rsi > 70 ? 'var(--orange)' : result.rsi < 30 ? 'var(--green)' : 'var(--text-1)' }}>{result.rsi}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '最新量比' : 'Volume Ratio'}</span>
                        <strong style={{ color: result.vol_ratio > 1.5 ? 'var(--orange)' : 'var(--text-1)' }}>{result.vol_ratio}x</strong>
                      </div>
                    </div>
                  </div>

                  {/* Card: MACD Indicators Status (Only for wyckoff_macd) */}
                  {result.type === 'wyckoff_macd' && result.macd && (
                    <div style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}>
                      <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '0.85rem', color: 'var(--text-2)', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
                        📊 {lang === 'zh' ? 'MACD 指标状态' : 'MACD Indicator Status'}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-3)' }}>MACD Line</span>
                          <strong style={{ color: 'var(--cyan, #63b3ed)' }}>{result.macd.latest_macd?.toFixed(4)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-3)' }}>Signal Line</span>
                          <strong style={{ color: 'var(--orange, #ff9f43)' }}>{result.macd.latest_signal?.toFixed(4)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-3)' }}>Histogram</span>
                          <strong style={{ color: result.macd.latest_hist >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {result.macd.latest_hist > 0 ? '+' : ''}{result.macd.latest_hist?.toFixed(4)}
                          </strong>
                        </div>
                        
                        <div style={{
                          borderTop: '1px solid var(--border)',
                          paddingTop: '0.6rem',
                          marginTop: '0.2rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem'
                        }}>
                          <span style={{ color: 'var(--text-3)', fontSize: '0.72rem', fontWeight: 500 }}>
                            {lang === 'zh' ? '检测到的动能信号:' : 'Detected Momentum Signals:'}
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', minHeight: '20px' }}>
                            {(() => {
                              const badges = [];
                              const m = result.macd;
                              if (m.bullish_divergence) {
                                badges.push({ text: lang === 'zh' ? '底背离' : 'Bull Divergence', color: 'var(--green)', bg: 'rgba(46,204,113,0.15)', border: 'rgba(46,204,113,0.3)' });
                              }
                              if (m.bearish_divergence) {
                                badges.push({ text: lang === 'zh' ? '顶背离' : 'Bear Divergence', color: 'var(--red)', bg: 'rgba(231,76,60,0.15)', border: 'rgba(231,76,60,0.3)' });
                              }
                              if (m.recent_bullish_cross) {
                                badges.push({ text: lang === 'zh' ? '金叉 (5日内)' : 'Golden Cross (5d)', color: 'var(--green)', bg: 'rgba(46,204,113,0.15)', border: 'rgba(46,204,113,0.3)' });
                              }
                              if (m.recent_bearish_cross) {
                                badges.push({ text: lang === 'zh' ? '死叉 (5日内)' : 'Dead Cross (5d)', color: 'var(--red)', bg: 'rgba(231,76,60,0.15)', border: 'rgba(231,76,60,0.3)' });
                              }
                              if (m.recent_zero_cross_up) {
                                badges.push({ text: lang === 'zh' ? '向上突破零轴' : 'Zero Cross Up', color: 'var(--green)', bg: 'rgba(46,204,113,0.15)', border: 'rgba(46,204,113,0.3)' });
                              }
                              if (m.recent_zero_cross_down) {
                                badges.push({ text: lang === 'zh' ? '跌破零轴' : 'Zero Cross Down', color: 'var(--red)', bg: 'rgba(231,76,60,0.15)', border: 'rgba(231,76,60,0.3)' });
                              }
                              
                              if (badges.length === 0) {
                                return (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontStyle: 'italic' }}>
                                    {lang === 'zh' ? '近期无明显交叉或背离' : 'No active crossovers or divergences'}
                                  </span>
                                );
                              }
                              
                              return badges.map((b, idx) => (
                                <span key={idx} style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  background: b.bg,
                                  color: b.color,
                                  border: `1px solid ${b.border}`,
                                  padding: '2px 6px',
                                  borderRadius: '4px'
                                }}>
                                  {b.text}
                                </span>
                              ));
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Row 2: Detected Wyckoff Events (Card 4) & SVG Candlestick Chart (Card 5) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '400px 1fr',
                  gap: '1rem',
                  marginTop: '1rem',
                  alignItems: 'stretch'
                }} className="events-chart-grid">
                  {/* Card 4: Timeline of Wyckoff Events */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  boxSizing: 'border-box'
                }}>
                  <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.85rem', color: 'var(--text-2)', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📋 {t('wyckoffEvents')}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 'normal' }}>
                      {lang === 'zh' ? '百分比表示事件置信度' : 'Percentage shows Event Confidence'}
                    </span>
                  </h4>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontStyle: 'italic', marginBottom: '0.8rem', lineHeight: '1.4' }}>
                    {lang === 'zh' 
                      ? '💡 置信度根据事件当天的成交量放大倍数 (Volume Ratio) 与影线回缩比例 (Tail Ratio) 综合计算得出，数值越高代表形态越典型。'
                      : '💡 Confidence score is calculated dynamically based on the day\'s Volume Ratio and price Tail Ratio. Higher values indicate more standard setups.'}
                  </div>
                  
                  {result.detected_events && result.detected_events.length > 0 ? (
                    <div style={{
                      flex: 1,
                      height: 0,
                      overflowY: 'auto',
                      paddingRight: '0.5rem',
                      marginTop: '0.6rem'
                    }}>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.8rem',
                        position: 'relative',
                        paddingLeft: '1.2rem'
                      }}>
                        {/* Vertical line connector */}
                      <div style={{
                        position: 'absolute',
                        left: '4px',
                        top: '5px',
                        bottom: '5px',
                        width: '2px',
                        background: 'var(--border)'
                      }} />

                      {(() => {
                        const zoomCount = chartZoomRange === '30d' ? 30 : chartZoomRange === '90d' ? 90 : chartZoomRange === '180d' ? 180 : result.chart_history.length;
                        const startIndex = Math.max(0, result.chart_history.length - zoomCount);

                        return result.detected_events.map((e, idx) => {
                          const isBullEvent = ['SC', 'AR', 'ST', 'Spring', 'Spring_Test', 'LPS', 'SOS', 'BU', 'UTAD_Failure', 'Flag', 'PS'].includes(e.event);
                          const isOffChart = e.index < startIndex;
                          return (
                            <div key={idx} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              position: 'relative'
                            }}>
                              {/* Dot indicator */}
                              <div style={{
                                position: 'absolute',
                                left: '-1.2rem',
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                background: isBullEvent ? 'var(--green, #2ecc71)' : 'var(--red, #e74c3c)',
                                border: '2px solid var(--bg-card)',
                                transform: 'translateX(-3px)'
                              }} />

                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {lang === 'zh' ? e.label_zh : e.label_en}
                                  {isOffChart && (
                                    <span style={{
                                      fontSize: '0.62rem',
                                      background: 'rgba(230, 126, 34, 0.1)',
                                      border: '1px solid rgba(230, 126, 34, 0.3)',
                                      color: 'var(--orange)',
                                      padding: '1px 4px',
                                      borderRadius: '3px',
                                      fontWeight: 'normal'
                                    }}>
                                      {lang === 'zh' ? '图表外' : 'Off-chart'}
                                    </span>
                                  )}
                                </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
                                {lang === 'zh' ? '价格:' : 'Price:'} ${e.price}
                                <span style={{ marginLeft: '8px', color: 'var(--orange)', fontSize: '0.68rem', opacity: 0.9 }}>
                                  {e.event === 'SC' && (lang === 'zh' ? '（卖出高潮：恐慌盘砸盘，探底标志）' : ' (Panic selling climax, potential bottom)')}
                                  {e.event === 'BC' && (lang === 'zh' ? '（买入高潮：追高狂热，见顶标志）' : ' (Buying climax, potential top)')}
                                  {e.event === 'AR' && (lang === 'zh' ? '（自动反弹：空头回补与自然反弹）' : ' (Automatic rally, short-covering bounce)')}
                                  {e.event === 'AR_Reaction' && (lang === 'zh' ? '（自动回落：自然回调整固）' : ' (Automatic reaction, consolidation)')}
                                  {e.event === 'ST' && (lang === 'zh' ? '（二次测试：测试底部支撑坚固度）' : ' (Secondary test of bottom support)')}
                                  {e.event === 'ST_Dist' && (lang === 'zh' ? '（二次测试：测试高位派发意愿）' : ' (Secondary test of top supply)')}
                                  {e.event === 'Spring' && (lang === 'zh' ? '（弹簧洗盘：假摔扫损吸筹，买入信号）' : ' (Shakeout/Spring below support, buy signal)')}
                                  {e.event === 'UTAD' && (lang === 'zh' ? '（上轨假突破：诱多砸回，出货信号）' : ' (Upthrust after distribution, sell signal)')}
                                  {e.event === 'SOS' && (lang === 'zh' ? '（强势信号：放量冲破阻力位）' : ' (Sign of strength, high-volume breakout)')}
                                  {e.event === 'SOW' && (lang === 'zh' ? '（弱势信号：放量砸破支撑位）' : ' (Sign of weakness, high-volume breakdown)')}
                                  {e.event === 'BU' && (lang === 'zh' ? '（无量回踩：突破阻力转支撑确认，买入信号）' : ' (No-volume backup, confirms breakout support flip, buy signal)')}
                                  {e.event === 'UTAD_Failure' && (lang === 'zh' ? '（空头踩踏突破：假突破高点被收复，触发空头踩踏）' : ' (UTAD failure breakout, triggers short squeeze, strong buy)')}
                                  {e.event === 'Flag' && (lang === 'zh' ? '（黄金旗形突破：主升浪中继悬停整理突破，买入信号）' : ' (Bull flag breakout, trend continuation buy signal)')}
                                  {e.event === 'PS' && (lang === 'zh' ? '（初步支撑：聪明钱开始承接抛盘，下跌末期信号）' : ' (Preliminary Support: smart money absorbing supply, early bottom signal)')}
                                  {e.event === 'PSY' && (lang === 'zh' ? '（初步阻力：聪明钱开始派发，上涨末期信号）' : ' (Preliminary Supply: smart money distributing, early top signal)')}
                                  {e.event === 'Spring_Test' && (lang === 'zh' ? '（弹簧测试：极低量回踩弹簧低点，无供应确认，买入信号）' : ' (Spring Test: low-volume retest of Spring low, no supply confirmation, buy signal)')}
                                  {e.event === 'LPS' && (lang === 'zh' ? '（支撑最后点：弹簧后更高低点，量能萎缩，吸筹完成信号）' : ' (Last Point of Support: higher low after Spring on low volume, accumulation complete)')}
                                  {e.event === 'LPSY' && (lang === 'zh' ? '（供应最后点：SOW后弱势反弹，量能萎缩，派发完成信号）' : ' (Last Point of Supply: weak rally after SOW on low volume, distribution complete)')}
                                </span>
                              </span>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '4px' }}>
                                {e.date}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--cyan)' }}>
                                {Math.round(e.confidence * 100)}%
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                    </div>
                  </div>
                  ) : (
                    <div style={{ color: 'var(--text-3)', fontSize: '0.78rem', textAlign: 'center', padding: '1rem', fontStyle: 'italic' }}>
                      {lang === 'zh' ? '在此周期内暂无检测到的关键量价事件，当前处于均衡期。' : 'No key volume-price events detected in this period.'}
                    </div>
                  )}
                </div>

                {/* Card 5: SVG Candlestick Chart with Support/Resistance */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '1.2rem 1.2rem 0.8rem 1.2rem',
                  height: '100%',
                  boxSizing: 'border-box'
                }}>
                  <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '0.85rem', color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span>📊 {lang === 'zh' ? '个股走势与 Wyckoff 关键事件标注' : 'Stock Close & Wyckoff Event Annotations'}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 'normal' }}>
                      {lang === 'zh' ? '横向虚线代表支撑/阻力估算' : 'Horizontal lines represent Support/Resistance estimates'}
                    </span>
                  </h4>

                  {/* Zoom range buttons */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 500 }}>
                      {lang === 'zh' ? '图表缩放 (Zoom):' : 'Chart Zoom:'}
                    </span>
                    <div style={{
                      display: 'flex',
                      background: 'var(--bg-hover)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '2px'
                    }}>
                      {[
                        { key: '30d', label: lang === 'zh' ? '30天' : '30D' },
                        { key: '90d', label: lang === 'zh' ? '90天' : '90D' },
                        { key: '180d', label: lang === 'zh' ? '180天' : '180D' },
                        { key: 'all', label: lang === 'zh' ? '全部 (1年)' : 'ALL (1Y)' }
                      ].map(range => (
                        <button
                          key={range.key}
                          onClick={() => setChartZoomRange(range.key)}
                          style={{
                            background: chartZoomRange === range.key ? 'var(--cyan)' : 'transparent',
                            color: chartZoomRange === range.key ? '#fff' : 'var(--text-2)',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '3px 10px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {range.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 500 }}>
                        {lang === 'zh' ? '指标叠加 (Overlays):' : 'Overlays:'}
                      </span>
                      <div style={{
                        display: 'flex',
                        background: 'var(--bg-hover)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '2px',
                        gap: '2px'
                      }}>
                        <button
                          onClick={() => setActiveOverlays(prev => ({ ...prev, ma: !prev.ma }))}
                          style={{
                            background: activeOverlays.ma ? 'var(--cyan)' : 'transparent',
                            color: activeOverlays.ma ? '#fff' : 'var(--text-2)',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          MA
                        </button>
                        <button
                          onClick={() => setActiveOverlays(prev => ({ ...prev, sr: !prev.sr }))}
                          style={{
                            background: activeOverlays.sr ? 'var(--cyan)' : 'transparent',
                            color: activeOverlays.sr ? '#fff' : 'var(--text-2)',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          S/R
                        </button>
                        <button
                          onClick={() => setActiveOverlays(prev => ({ ...prev, bb: !prev.bb }))}
                          style={{
                            background: activeOverlays.bb ? 'var(--cyan)' : 'transparent',
                            color: activeOverlays.bb ? '#fff' : 'var(--text-2)',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {lang === 'zh' ? '布林带' : 'BB'}
                        </button>
                        <button
                          onClick={() => setActiveOverlays(prev => ({ ...prev, atr_stop: !prev.atr_stop }))}
                          style={{
                            background: activeOverlays.atr_stop ? 'var(--cyan)' : 'transparent',
                            color: activeOverlays.atr_stop ? '#fff' : 'var(--text-2)',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {lang === 'zh' ? 'ATR止盈' : 'ATR Stop'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Event Filters & Legend */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-hover)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '0.5rem 0.8rem',
                    marginBottom: '0.6rem',
                    gap: '0.6rem',
                    fontSize: '0.74rem'
                  }}>
                    {/* Filters checkboxes */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>
                        {lang === 'zh' ? '事件筛选:' : 'Filters:'}
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showBuySignals}
                          onChange={(e) => setShowBuySignals(e.target.checked)}
                          style={{ accentColor: 'var(--green, #2ecc71)', cursor: 'pointer' }}
                        />
                        <span style={{ color: 'var(--green, #2ecc71)', fontWeight: 600 }}>
                          {lang === 'zh' ? '买入信号' : 'Buy Signals'}
                        </span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showSellSignals}
                          onChange={(e) => setShowSellSignals(e.target.checked)}
                          style={{ accentColor: 'var(--red, #e74c3c)', cursor: 'pointer' }}
                        />
                        <span style={{ color: 'var(--red, #e74c3c)', fontWeight: 600 }}>
                          {lang === 'zh' ? '卖出信号' : 'Sell Signals'}
                        </span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showStructuralEvents}
                          onChange={(e) => setShowStructuralEvents(e.target.checked)}
                          style={{ accentColor: '#3498db', cursor: 'pointer' }}
                        />
                        <span style={{ color: 'var(--text-2)' }}>
                          {lang === 'zh' ? '结构指标' : 'Structure'}
                        </span>
                      </label>
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>
                        {lang === 'zh' ? '图例:' : 'Legend:'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--text-2)' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green, #2ecc71)' }}></span>
                        <span>{lang === 'zh' ? '买点' : 'Buy'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--text-2)' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--red, #e74c3c)' }}></span>
                        <span>{lang === 'zh' ? '卖点' : 'Sell'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--text-2)' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#3498db' }}></span>
                        <span>{lang === 'zh' ? '吸筹' : 'Accum.'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--text-2)' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#9b59b6' }}></span>
                        <span>{lang === 'zh' ? '派发' : 'Dist.'}</span>
                      </div>
                      
                      {/* Risk Line Legends (only visible if cost basis is entered) */}
                      {parseFloat(costBasis) > 0 && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'rgba(52, 152, 219, 0.85)', marginLeft: '0.2rem' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '0px', borderTop: '1px dashed rgba(52, 152, 219, 0.85)' }}></span>
                            <span>{lang === 'zh' ? '成本' : 'Cost'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'rgba(231, 76, 60, 0.85)' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '0px', borderTop: '1px dashed rgba(231, 76, 60, 0.85)' }}></span>
                            <span>{lang === 'zh' ? '止损' : 'Stop'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'rgba(243, 156, 18, 0.85)' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '0px', borderTop: '1px dashed rgba(243, 156, 18, 0.85)' }}></span>
                            <span>{lang === 'zh' ? '止盈' : 'Trailing'}</span>
                          </div>
                          {result?.riskControl?.isBreakevenActive && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'rgba(46, 204, 113, 0.85)' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '0px', borderTop: '1px dashed rgba(46, 204, 113, 0.85)' }}></span>
                              <span>{lang === 'zh' ? '保本🔒' : 'Breakeven🔒'}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {renderWyckoffChart(result)}
                </div>
              </div>

                {/* Explanation Card */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '1.2rem',
                  fontSize: '0.8rem',
                  lineHeight: '1.6',
                  color: 'var(--text-2)'
                }}>
                  <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '0.88rem', color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    🧮 {t('wyckoffExplanation')}
                  </h4>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '1.2rem'
                  }}>
                    <div>
                      <h5 style={{ margin: '0 0 0.4rem 0', color: 'var(--cyan)', fontSize: '0.82rem' }}>
                        📈 {lang === 'zh' ? 'Wyckoff 四阶段法则' : 'The Four Market Phases'}
                      </h5>
                      <ul style={{ paddingLeft: '1.1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <li>
                          <strong>{lang === 'zh' ? '吸筹阶段 (Accumulation)' : 'Accumulation'}:</strong>{' '}
                          {lang === 'zh' ? '主力资金在价格底部区域悄然建仓，筹码被锁定，常伴随SC与Spring洗盘。' : 'Smart money buys and locks up float at structural price bottoms, marked by SC and Spring.'}
                        </li>
                        <li>
                          <strong>{lang === 'zh' ? '上涨阶段 (Markup)' : 'Markup'}:</strong>{' '}
                          {lang === 'zh' ? '突破阻力位后，供不应求，进入清晰的拉升趋势，均线系统呈现多头排列。' : 'Demand outstrips supply after resistance breakouts, driving a clean structural uptrend.'}
                        </li>
                        <li>
                          <strong>{lang === 'zh' ? '派发阶段 (Distribution)' : 'Distribution'}:</strong>{' '}
                          {lang === 'zh' ? '主力高位兑现利润，货源转手至大众散户，常伴随BC与UTAD假突破。' : 'Institutions sell and distribute shares to retail buyers at tops, marked by BC and UTAD.'}
                        </li>
                        <li>
                          <strong>{lang === 'zh' ? '下跌阶段 (Markdown)' : 'Markdown'}:</strong>{' '}
                          {lang === 'zh' ? '高位支撑破裂，供大于求，价格进入砸盘通道，反弹无力（无需求）。' : 'Support cracks, leading to supply-driven markdown trends with very weak buying demand.'}
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h5 style={{ margin: '0 0 0.4rem 0', color: 'var(--cyan)', fontSize: '0.82rem' }}>
                        ⚖️ {lang === 'zh' ? '量价三法则与背离' : 'Three Laws & EVR'}
                      </h5>
                      <ul style={{ paddingLeft: '1.1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <li>
                          <strong>{lang === 'zh' ? '供求法则 (Supply & Demand)' : 'Supply and Demand'}:</strong>{' '}
                          {lang === 'zh' ? '供小于求价格上涨，供大于求价格下跌。' : 'Demand exceeds supply, price rises; supply exceeds demand, price falls.'}
                        </li>
                        <li>
                          <strong>{lang === 'zh' ? '因果法则 (Cause & Effect)' : 'Cause and Effect'}:</strong>{' '}
                          {lang === 'zh' ? '吸筹期/派发期的宽幅与横盘震荡时间（因）决定了后市突破的波幅大小（果）。' : 'The size of consolidation causes determines the magnitude of subsequent trend effects.'}
                        </li>
                        <li>
                          <strong>{lang === 'zh' ? '努力与结果 (Effort vs Result)' : 'Effort vs Result'}:</strong>{' '}
                          {lang === 'zh' ? '成交量是“努力”，价格波幅是“结果”。成交量巨大但价格滞涨或止跌均属强烈的转折背离。' : 'Volume represents effort, price spread represents result. Divergence indicates imminent trend reversal.'}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            ) : isClassicReady ? (
              <>
                {/* Header Status Bar */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-hover)',
                  padding: '0.8rem 1.2rem',
                  borderRadius: '6px',
                  borderLeft: `4px solid ${getZoneBadge(result.zone).color}`
                }}>
                  <div>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-1)', marginRight: '0.5rem' }}>
                      {result.symbol} {STOCK_NAME_MAP[result.symbol.split('.')[0]] ? `(${STOCK_NAME_MAP[result.symbol.split('.')[0]]})` : ''}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
                      {result.sector && `[${result.sector}]`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {/* Bull signal */}
                    <span style={{
                      background: getZoneBadge(result.zone).bg,
                      color: getZoneBadge(result.zone).color,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      {getZoneBadge(result.zone, result.signal).text}
                    </span>
                    {/* Bear signal if any */}
                    {result.bear_signal && (
                      <span style={{
                        background: getBearBadge(result.bear_signal, result.bear_zone).bg,
                        color: getBearBadge(result.bear_signal, result.bear_zone).color,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        {result.bear_signal}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bearish/Top Divergence Alarm */}
                {((result.macd && result.macd.bearish_divergence) || result.effort_vs_result?.status === 'bearish_divergence') && (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(231, 76, 60, 0.12) 0%, rgba(192, 57, 43, 0.12) 100%)',
                    border: '1px solid rgba(231, 76, 60, 0.4)',
                    borderRadius: '8px',
                    color: 'var(--red, #e74c3c)',
                    padding: '0.8rem 1.2rem',
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontWeight: 'bold',
                    boxShadow: '0 0 10px rgba(231, 76, 60, 0.1)'
                  }}>
                    <span style={{ fontSize: '1.1rem' }}>🚨</span>
                    <div>
                      <strong>{lang === 'zh' ? '【核心警报：顶背离检测】' : '[ALARM: Bearish Divergence]'}</strong>{' '}
                      {lang === 'zh'
                        ? '检测到价格与动能指标顶背离！上涨力量衰竭，主力高位派发嫌疑增加，防范高位崩盘及重挫风险，建议逐步止盈或分批减仓。'
                        : 'Price and momentum top divergence detected! Upward buying pressure is exhausted; institutional distribution risk is extremely high. Gradually lock in profits or reduce exposure.'}
                    </div>
                  </div>
                )}

                {/* AI Insights Card */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.08) 0%, rgba(142, 68, 173, 0.08) 100%)',
                  border: '1px solid rgba(52, 152, 219, 0.2)',
                  borderRadius: '8px',
                  padding: '1.2rem',
                }}>
                  <h4 style={{ margin: '0 0 0.6rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--cyan)', fontSize: '0.92rem' }}>
                    <span>🤖</span> {lang === 'zh' ? 'AI 异动分析点评' : 'AI Technical Analysis Comment'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.84rem', lineHeight: '1.6', color: 'var(--text-1)' }}>
                    {translateInsight(result.ai_insight, lang)}
                  </p>
                </div>

                {/* Layout Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '1rem'
                }}>
                  {/* Technical Indicators */}
                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '1rem'
                  }}>
                    <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '0.85rem', color: 'var(--text-2)', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
                      📈 {lang === 'zh' ? '关键指标数据' : 'Key Technical Metrics'}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '最新收盘价' : 'Latest Close'}</span>
                        <strong style={{ color: 'var(--text-1)' }}>¥{result.price}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '日涨跌幅' : 'Daily Change'}</span>
                        <strong style={{ color: result.chg_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {result.chg_pct >= 0 ? '+' : ''}{result.chg_pct}%
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '5日涨幅' : '5-Day Return'}</span>
                        <strong style={{ color: result.chg_5d >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {result.chg_5d >= 0 ? '+' : ''}{result.chg_5d}%
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '量比 (Volume Ratio)' : 'Volume Ratio'}</span>
                        <strong style={{ color: result.vol_ratio > 1.5 ? 'var(--orange)' : 'var(--text-1)' }}>
                          {result.vol_ratio}x
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '相对强度 (RS Ratio 5d)' : 'RS Ratio (5d)'}</span>
                        <strong style={{ color: result.rs_ratio_5d > 1.0 ? 'var(--green)' : 'var(--text-3)' }}>
                          {result.rs_ratio_5d}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-3)' }}>RSI(14)</span>
                        <strong style={{ color: result.rsi > 70 ? 'var(--orange)' : result.rsi < 30 ? 'var(--green)' : 'var(--text-1)' }}>
                          {result.rsi}
                        </strong>
                      </div>
                      {result.liquidity_tag && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '流动性警告' : 'Liquidity Status'}</span>
                          <strong style={{ color: 'var(--red)' }}>{result.liquidity_tag}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sector Synergy Card */}
                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '1rem'
                  }}>
                    <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '0.85rem', color: 'var(--text-2)', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
                      🛡️ {lang === 'zh' ? '板块与风控协同诊断' : 'Sector & Risk Constraints'}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '匹配板块' : 'Matched Sector'}</span>
                        <strong style={{ color: 'var(--text-1)' }}>{result.sector}</strong>
                      </div>
                      
                      {result.sectorData ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '板块今日均幅' : 'Sector Avg Change'}</span>
                            <strong style={{ color: result.sectorData.avg_chg_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                              {result.sectorData.avg_chg_pct >= 0 ? '+' : ''}{result.sectorData.avg_chg_pct?.toFixed(2)}%
                            </strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '板块资金热度' : 'Sector Capital Heat'}</span>
                            <strong style={{ color: 'var(--orange)' }}>
                              {result.sectorData.heat_score?.toFixed(1)} / 100
                            </strong>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontStyle: 'italic', margin: '0.2rem 0' }}>
                          {lang === 'zh' ? '暂未下载到此行业昨日的资金流数据' : 'Yesterday\'s fund flow stats for this sector are not cached'}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.2rem' }}>
                        <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '系统风控状态' : 'Global Threat Level'}</span>
                        <strong style={{
                          color: globalData?.macro?.trading_state === 'low_risk' ? 'var(--yellow)' :
                                 globalData?.macro?.trading_state?.includes('risk') ? 'var(--red)' : 'var(--green)'
                        }}>
                          {globalData?.macro?.trading_state?.toUpperCase() || 'ACTIVE'}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-3)' }}>{lang === 'zh' ? '信号过滤阀门' : 'Signal Valve Status'}</span>
                        <span style={{ color: 'var(--green)' }}>{lang === 'zh' ? '正常运行' : 'Running'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score Calculation Logic Explanation */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '1.2rem',
                  fontSize: '0.8rem',
                  lineHeight: '1.6',
                  color: 'var(--text-2)'
                }}>
                  <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '0.88rem', color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    🧮 {lang === 'zh' ? '量化计算与评分逻辑说明' : 'Quant Calculation & Score Methodology'}
                  </h4>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '1.2rem'
                  }}>
                    <div>
                      <h5 style={{ margin: '0 0 0.4rem 0', color: 'var(--cyan)', fontSize: '0.82rem' }}>
                        📈 {lang === 'zh' ? '技术指标与信号触发' : 'Technical Metrics & Signals'}
                      </h5>
                      <ul style={{ paddingLeft: '1.1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <li>
                          <strong>{lang === 'zh' ? '量比 (Volume Ratio)' : 'Volume Ratio'}:</strong>{' '}
                          {lang === 'zh' 
                            ? '今日成交量 / 过去20日平均成交量(不含今天)。> 1.1-1.3 代表资金异动明显。'
                            : 'Today\'s Volume / 20-Day Avg Volume (excluding today). Ratios > 1.1-1.3 highlight abnormal capital flows.'}
                        </li>
                        <li>
                          <strong>{lang === 'zh' ? '相对强度 (RS Ratio)' : 'Relative Strength (RS)'}:</strong>{' '}
                          {lang === 'zh'
                            ? '(1 + 个股5日涨幅) / (1 + 大盘指数5日涨幅)。> 1.01 (风控期 1.03) 表示跑赢大盘。'
                            : '(1 + Stock 5d return) / (1 + Index 5d return). Ratios > 1.01 (1.03 in low-risk state) outperform the index (^AORD).'}
                        </li>
                        <li>
                          <strong>{lang === 'zh' ? '主升浪 (Momentum)' : 'Breakout Momentum'}:</strong>{' '}
                          {lang === 'zh'
                            ? '收盘价创21日新高，且均线多头排列 (MA5 > 10 > 20) 且有放量突破和强相对强度。'
                            : 'Close price breaks 21-day high, with bullish MA alignment (MA5 > 10 > 20) accompanied by volume spikes and strong RS.'}
                        </li>
                        <li>
                          <strong>{lang === 'zh' ? '潜伏区 (Accumulation)' : 'Accumulation Zone'}:</strong>{' '}
                          {lang === 'zh'
                            ? '价格近期低于MA20但高于60日底部支持线，且近5日有企稳抬高并伴随资金流入。'
                            : 'Price is recently below MA20 but stays above the 60-day floor, showing rising lows and volume inflows.'}
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h5 style={{ margin: '0 0 0.4rem 0', color: 'var(--cyan)', fontSize: '0.82rem' }}>
                        🛡️ {lang === 'zh' ? '板块评分与风控系统' : 'Sector Scores & Risk Controls'}
                      </h5>
                      <ul style={{ paddingLeft: '1.1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <li>
                          <strong>{lang === 'zh' ? '板块热度分 (Sector Heat)' : 'Sector Heat Score'}:</strong>{' '}
                          {lang === 'zh'
                            ? '技术面基础分 + 相对大盘奖惩 + 宏观加成 + 新闻舆情分数 - 全球地缘政治及恐慌指数惩罚项。'
                            : 'Calculated as: Technical Base + RS Modifier + Macro Bonus + News Sentiment Bonus - Global Risk/Threat Penalties.'}
                        </li>
                        <li>
                          <strong>{lang === 'zh' ? '利空降级 (Signal Downgrade)' : 'Signal Downgrade'}:</strong>{' '}
                          {lang === 'zh'
                            ? '当个股或所属板块新闻舆情得分 < -0.15 且利空消息较新鲜时，强技术买入信号会自动降级为“观望”。'
                            : 'When stock or sector news sentiment drops below -0.15 with fresh negative alerts, buying signals are downgraded to "Watch".'}
                        </li>
                        <li>
                          <strong>{lang === 'zh' ? '风控轻仓 (Risk Light-position)' : 'Risk Light-position'}:</strong>{' '}
                          {lang === 'zh'
                            ? '系统根据全球恐慌得分 (Waneye Score < 30) 或地缘政治威胁，提高买入阈值并标记“轻仓”建议。'
                            : 'Depending on global panic indexes (Waneye Score < 30) or geopolitical threats, buy thresholds rise and trigger "Light-position" tags.'}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Mini SVG K-Line and MAs Chart */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '1.2rem 1.2rem 0.8rem 1.2rem'
                }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                    📊 {lang === 'zh' ? '个股 30日 收盘走势与多周期均线系统' : 'Stock 30-Day Close & MA System'}
                  </h4>

                  {result.chart_history && result.chart_history.length > 0 ? (
                    (() => {
                      const chartData = result.chart_history;
                      const closes = chartData.map(d => d.close);
                      const minPrice = Math.min(...closes) * 0.98;
                      const maxPrice = Math.max(...closes) * 1.02;
                      const priceDiff = maxPrice - minPrice || 1;

                      const width = 600;
                      const height = 180;
                      const paddingLeft = 35;
                      const paddingRight = 10;
                      const paddingTop = 10;
                      const paddingBottom = 20;

                      const getX = (index) => paddingLeft + (index / (chartData.length - 1)) * (width - paddingLeft - paddingRight);
                      const getY = (price) => {
                        if (price === null || price === undefined) return null;
                        return paddingTop + ((maxPrice - price) / priceDiff) * (height - paddingTop - paddingBottom);
                      };

                      // Build SVG paths
                      const buildPath = (key, dataPoints) => {
                        let dStr = '';
                        let first = true;
                        for (let i = 0; i < dataPoints.length; i++) {
                          const yVal = getY(dataPoints[i][key]);
                          if (yVal !== null) {
                            const xVal = getX(i);
                            dStr += `${first ? 'M' : 'L'} ${xVal} ${yVal} `;
                            first = false;
                          }
                        }
                        return dStr;
                      };

                      const closePath = buildPath('close', chartData);
                      const ma5Path = buildPath('ma5', chartData);
                      const ma10Path = buildPath('ma10', chartData);
                      const ma20Path = buildPath('ma20', chartData);
                      const ma60Path = buildPath('ma60', chartData);
                      const atrStopPath = buildPath('atr_trailing_stop', chartData);

                      return (
                        <div>
                          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', background: 'var(--chart-bg)', borderRadius: '6px' }}>
                            {/* Grid Y lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                              const p = minPrice + ratio * (maxPrice - minPrice);
                              const y = getY(p);
                              return (
                                <g key={idx}>
                                  <line
                                    x1={paddingLeft}
                                    y1={y}
                                    x2={width - paddingRight}
                                    y2={y}
                                    stroke="var(--chart-grid)"
                                    strokeDasharray="3,3"
                                    strokeWidth="0.5"
                                  />
                                  <text
                                    x={paddingLeft - 5}
                                    y={y + 3}
                                    textAnchor="end"
                                    fill="var(--text-3)"
                                    fontSize="7"
                                  >
                                    ${p.toFixed(2)}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Chart paths */}
                            {ma60Path && <path d={ma60Path} fill="none" stroke="#9b59b6" strokeWidth="1" strokeDasharray="2,2" title="MA60" />}
                            {ma20Path && <path d={ma20Path} fill="none" stroke="#e74c3c" strokeWidth="1" title="MA20" />}
                            {ma10Path && <path d={ma10Path} fill="none" stroke="#3498db" strokeWidth="1" title="MA10" />}
                            {ma5Path && <path d={ma5Path} fill="none" stroke="#f1c40f" strokeWidth="1" title="MA5" />}
                            {closePath && <path d={closePath} fill="none" stroke="var(--text-1, #fff)" strokeWidth="1.8" title="Close" />}

                            {/* ATR Trailing Stop Line */}
                            {activeOverlays.atr_stop && atrStopPath && (
                              <path
                                d={atrStopPath}
                                fill="none"
                                stroke="var(--orange, #f39c12)"
                                strokeWidth="1.2"
                                strokeDasharray="4,2"
                                title="ATR Stop"
                              />
                            )}

                            {/* ATR Trailing Stop Label at the rightmost end */}
                            {activeOverlays.atr_stop && chartData.length > 0 && (() => {
                              const latestDay = chartData[chartData.length - 1];
                              if (latestDay && latestDay.atr_trailing_stop) {
                                const yVal = getY(latestDay.atr_trailing_stop);
                                if (yVal !== null && yVal >= paddingTop && yVal <= (height - paddingBottom)) {
                                  return (
                                    <text
                                      x={width - paddingRight - 5}
                                      y={yVal - 4}
                                      textAnchor="end"
                                      fill="var(--orange, #f39c12)"
                                      fontSize="7"
                                      fontWeight="bold"
                                    >
                                      ATR Stop: ${latestDay.atr_trailing_stop}
                                    </text>
                                  );
                                }
                              }
                              return null;
                            })()}

                            {/* Date X labels (first, middle, last) */}
                            {[0, Math.floor(chartData.length / 2), chartData.length - 1].map((idx) => {
                              const d = chartData[idx];
                              if (!d) return null;
                              return (
                                <text
                                  key={idx}
                                  x={getX(idx)}
                                  y={height - 5}
                                  textAnchor="middle"
                                  fill="var(--text-3)"
                                  fontSize="7"
                                >
                                  {d.date}
                                </text>
                              );
                            })}
                          </svg>

                          {/* Legend */}
                          <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                            gap: '0.8rem',
                            marginTop: '0.5rem',
                            fontSize: '0.7rem'
                          }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--text-1)' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '2px', backgroundColor: 'var(--text-1)' }} />
                              {lang === 'zh' ? '收盘价' : 'Close'}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#f1c40f' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '2px', backgroundColor: '#f1c40f' }} />
                              MA5
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#3498db' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '2px', backgroundColor: '#3498db' }} />
                              MA10
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#e74c3c' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '2px', backgroundColor: '#e74c3c' }} />
                              MA20
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#9b59b6' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '2px', strokeDasharray: '2,2', backgroundColor: '#9b59b6' }} />
                              MA60
                            </span>
                            {activeOverlays.atr_stop && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--orange, #f39c12)' }}>
                                <span style={{ display: 'inline-block', width: '8px', height: '2px', strokeDasharray: '4,2', backgroundColor: 'var(--orange, #f39c12)' }} />
                                {lang === 'zh' ? 'ATR止盈线' : 'ATR Stop Line'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ color: 'var(--text-3)', fontSize: '0.78rem', textAlign: 'center', padding: '1rem' }}>
                      {lang === 'zh' ? '暂无走势图数据' : 'No chart trend data available'}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Loading spinner while switching */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem',
                gap: '1rem',
                width: '100%'
              }}>
                <div className="spinner" style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid var(--border)',
                  borderTopColor: 'var(--accent)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <div style={{ color: 'var(--text-2)', fontSize: '0.88rem', fontWeight: 500 }}>
                  {lang === 'zh' ? '正在切换量化分析模块...' : 'Switching analysis models...'}
                </div>
              </div>
            )}
          </div>
        )}
        </div> {/* Close right panel */}
      </div> {/* Close grid container */}
      </section>
    </div>
  );
}
