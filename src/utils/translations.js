export const TRANSLATIONS = {
  zh: {
    title: "A股短线专家终端",
    sub: "板块热度 · 突破雷达 · AI异动点评",
    loading: "正在加载市场分析数据…",
    errorTitle: "未找到数据，请先运行 Python 分析引擎：",
    macroTitle: "全球宏观",
    yieldTrend: "10年期美债收益率变动 (5天)",
    audTrend: "澳元兑美元变动 (5天)",
    heatmapTitle: "板块热力追踪",
    heatmapDesc: "动态展现各大板块的资金流动与热度评分，直观看到资金热点",
    avgChg: "平均涨幅",
    volRatioAvg: "量比均值",
    heatScore: "热度评分",
    upCount: "涨",
    downCount: "跌",
    stocksUnit: "只",
    radarTitle: "起飞雷达 (Take-off Radar)",
    radarDesc: "最终筛选出的买入优选个股清单。仅展示完全通过了所有技术、成交量与新闻舆情过滤门槛的股票。",
    momentumZone: "突破确认区",
    momentumBadge: "主升浪",
    accumZone: "资金建仓观察",
    accumBadge: "潜伏区",
    emptyMomentum: "当前无主升浪信号",
    emptyMomentumSub: "等待量价共振确认",
    emptyAccum: "当前无潜伏信号",
    emptyAccumSub: "市场暂处蛰伏期",
    resonancePos: "🟢 舆情共振",
    resonanceNeg: "🔴 舆情预警",
    resonanceNeutral: "⚪ 舆情中性",
    resonancePosDesc: "舆情共振：消息面显著偏多（情绪得分 > 0.15），与技术形态多头排列/突破共振，短线爆发动能极强。",
    resonanceNegDesc: "舆情预警：最新消息面偏向利空（情绪得分 < -0.15），追高需警惕获利回吐或资金分化，系统已对相关信号进行降级/拦截提示。",
    resonanceNeutralDesc: "舆情中性：消息面处于中性/平衡区间（-0.15 至 0.15 之间），观望资金动向与下一个新闻催化剂。",
    volRatio: "量比",
    sentiment: "舆情",
    breakout: "突破",
    insightsTitle: "AI 多空双向智能诊断 (AI Bull & Bear Diagnostic Hub)",
    insightsDesc: "全市场多头/空头异动股票及起飞/空头雷达推荐个股的智能点评与诊断，实时透视多空博弈及降级拦截个股。",
    emptyInsights: "暂无明显多空异动信号，市场处于平静期",
    trendTitle: "板块历史走势",
    trendDesc: "各大板块最近 30 个交易日的成交额加权归一化收益对比，包含大盘基准",
    updateAt: "更新于",
    eodBadge: "盘后数据",
    langName: "English",
    
    lineageTitle: "数据可信度",
    lineageReal: "真实数据",
    lineageDegraded: "数据降级",
    lineageMock: "全仿真模式",
    valveTitle: "信号下发阀门",
    valveActive: "正常运行",
    valveHalted: "信号已熔断",
    waneyeTitle: "全球舆情中心",
    waneyeDesc: "实时抓取全球金融情报终端的最新舆情数据与头条新闻",
    waneyeScore: "全球市场舆情分",
    waneyeSentiment: "市场舆情态度",
    headlinesList: "实时金融资讯头条",
    highlightsList: "全球宏观核心摘要",
    warningsTitle: "系统运行诊断与警告",
    waneyeSentimentPos: "多头共振",
    waneyeSentimentNeg: "空头警惕",
    waneyeSentimentNeu: "中性观望",
    
    tradingStateTitle: "风控交易状态",
    stateActive: "正常交易",
    stateLowRisk: "低警示避险",
    stateMediumRisk: "中警示冻结",
    stateHalted: "高风险警示",
    
    risksSectionTitle: "全球风险监测与规避评估",
    oppsSectionTitle: "战术配置机会",
    defSectionTitle: "防御与风险规避",
    impactLabel: "影响级别",
    likelihoodLabel: "发生概率",
    mitigationLabel: "规避方案",
    timeframeLabel: "投资周期",

    // Backtest translations
    backtestTitle: "AI 信号回测看板",
    backtestSub: "基于 PostgreSQL 历史实盘数据深度检验量化指标的收益表现与胜率",
    totalSignalsLabel: "总生成信号数",
    overallWinRateLabel: "综合胜率",
    avgReturnLabel: "平均持仓收益",
    holdingDays: "天持仓",
    radarAccuracy: "起飞雷达精准度分析",
    historicalLogsTitle: "量化信号历史评测日志",
    viewTerminal: "实时终端",
    viewBacktest: "回测看板",
    viewLiveAnalyzer: "实时探针",
    liveAnalyzerTitle: "实时量化多维度诊断探针 (Live Analyzer)",
    liveAnalyzerDesc: "输入任意股票代码（例如 600519.SS，002594.SZ 或 300750.SZ），结合大盘表现、板块热度与技术指标进行秒级量化扫描。",
    noBacktestData: "暂无回测数据，请先配置并运行本地回测引擎。",
    themeLight: "☀️ 明亮",
    themeDark: "🌙 暗黑",
    saveHtml: "保存为 HTML",
    saveHtmlTooltip: "将当前页面另存为静态 HTML 文件，便于离线查看或分享",
    footerMainSite: "访问我们的主网站：",

    // Wyckoff Translations
    wyckoffMethod: "Wyckoff 量价分析",
    classicMethod: "经典量化扫描",
    wyckoffMacdMethod: "Wyckoff + MACD 复合策略",
    analysisMethodLabel: "量化分析方法论",
    wyckoffPhase: "Wyckoff 阶段判定",
    wyckoffEvents: "检测到的 Wyckoff 事件",
    effortVsResult: "量价关系分析",
    wyckoffAccum: "吸筹阶段 (Accumulation)",
    wyckoffMarkup: "上涨阶段 (Markup)",
    wyckoffDist: "派发阶段 (Distribution)",
    wyckoffMarkdown: "下跌阶段 (Markdown)",
    wyckoffSensitivity: "量价背离灵敏度",
    wyckoffSensitivityDesc: "调高灵敏度会放宽成交量与振幅阈值，更容易触发事件，但也可能增加噪音。",
    wyckoffConfidence: "置信度",
    wyckoffSupport: "关键支撑位",
    wyckoffResistance: "关键阻力位",
    wyckoffClimaxTitle: "高潮与反弹测试",
    wyckoffExplanation: "Wyckoff 方法论与评分逻辑说明",


    // Bear Radar 空头预警系统
    bearRadarTitle: "空头预警雷达 (Bear Radar)",
    bearRadarDesc: "实时检测潜在下跌风险个股。可与起飞雷达信号进行交叉検验，尉得小心冲突信号。",
    distributionZone: "派发区（主跌浪）",
    distributionBadge: "主跌浪",
    distributionLiteZone: "疑似出货区",
    distributionLiteBadge: "疑似出货",
    emptyDistribution: "当前无主跌浪信号",
    emptyDistributionSub: "市场战法尚未呆现明显崩盘形态",
    emptyDistributionLite: "当前无疑似出货信号",
    emptyDistributionLiteSub: "岚未发现高位放量下跌异动",
    conflictSignal: "⚔️ 冲突信号",
    conflictSignalDesc: "该股同时出现在起飞雷达（多头）和空头预警（空头），信号冲突，建议谨慎操作。",
    bearRSI: "RSI",
    bearWinRateLabel: "空方胜率",
    bearWinRateDesc: "信号发出后股价实际下跌（即空头预测正确）的比例",

    // Attribution Analysis
    attrTabLabel: "信号归因",
    attrTitle: "信号收益拆解",
    attrSubtitle: "正交拆解单笔信号收益来源，评估选股与行业配置能力",
    attrMarketBeta: "行业基准 Beta",
    attrSectorRotation: "配置超额",
    attrStockAlpha: "选股 Alpha",
    attrTimingPremium: "择时溢价",
    attrResidual: "数据质量",
    attrResidualOk: "✅ 数据完整",
    attrResidualWarn: "⚠️ 存在缺失",
    attrIR: "信息比率 IR",
    attrSkillStrong: "🟢 实力驱动",
    attrSkillMedium: "🟡 数据不足",
    attrSkillWeak: "🔴 信号偏弱",
    attrSkillNegative: "🔴 负超额收益",
    attrSkillInsufficient: "⚪ 样本不足 (n<30)",
    attrByDate: "按日期",
    attrBySector: "按行业",
    attrByStock: "按个股",
    attrContrib: "累计贡献",
    attrPeriodSelector: "信号评估周期",
    attrMethodNote: "方法论说明（信号收益分解）",
    attrMethodBody: "行业基准Beta = 所属板块指数收益；配置超额 = 行业信号均值 - 板块指数；选股Alpha = 个股 - 行业信号均值。IR = avg(α)/std(α) 用于评估超额平稳度。由于同日相关性和持仓重叠，IR与t值仅供指示性参考。",
    attrNoData: "暂无成熟信号，请切换至历史重放 (Replay) 模式",
    attrCumChart: "累计分解收益曲线",
    attrDrilldown: "信号收益明细拆解",
    attrTotal: "个股总收益",
    attrN: "信号数",
    attrTimingByZone: "择时溢价（按信号区间）"
  },
  en: {
    title: "CN Share Trader Expert Terminal",
    sub: "Sector Heat · Radar · AI Insights",
    loading: "Loading market analysis data...",
    errorTitle: "No data found. Please run Python analysis engine first:",
    macroTitle: "GLOBAL MACRO",
    yieldTrend: "10Y US Yield Change (5d)",
    audTrend: "AUD/USD Forex Change (5d)",
    heatmapTitle: "Market Heatmap",
    heatmapDesc: "Real-time fund flows and heat scores across key ASX sectors. Spot 'where the capital attacks'.",
    avgChg: "Avg Change",
    volRatioAvg: "Avg Vol Ratio",
    heatScore: "Heat Score",
    upCount: "Up",
    downCount: "Down",
    stocksUnit: "stocks",
    radarTitle: "Take-off Radar",
    radarDesc: "Final curated buy recommendations. Displays only stocks that successfully passed all technical, volume, and sentiment filters.",
    momentumZone: "Breakout Confirmation",
    momentumBadge: "Momentum",
    accumZone: "Capital Accumulation",
    accumBadge: "Accumulation",
    emptyMomentum: "No momentum signal detected",
    emptyMomentumSub: "Waiting for price-volume resonance",
    emptyAccum: "No accumulation signal detected",
    emptyAccumSub: "Market in incubation phase",
    resonancePos: "🟢 Sentiment Resonance",
    resonanceNeg: "🔴 Sentiment Warning",
    resonanceNeutral: "⚪ Sentiment Stable",
    resonancePosDesc: "Sentiment Resonance: Highly positive news sentiment (score > 0.15) aligned with bullish/breakout price-volume technical patterns, indicating strong short-term upward momentum.",
    resonanceNegDesc: "Sentiment Warning: Bearish news sentiment (score < -0.15). Caution advised against potential profit-taking; system has downgraded/halted relevant signals to prevent chasing highs.",
    resonanceNeutralDesc: "Sentiment Stable: Neutral or balanced news sentiment (-0.15 to 0.15). Waiting for a clearer volume breakout or key catalyst.",
    volRatio: "Vol Ratio",
    sentiment: "Sent",
    breakout: "Breakout",
    insightsTitle: "AI Bull & Bear Diagnostic Hub",
    insightsDesc: "Real-time AI diagnostic center for active bull/bear trends, radar recommendations, and risk control assessment of downgraded anomalies.",
    emptyInsights: "No significant diagnostic signals today. Market is quiet.",
    trendTitle: "Trend Tracker",
    trendDesc: "30-day normalized index of sector performance using turnover-weighting against ^AORD benchmark.",
    updateAt: "Updated at",
    eodBadge: "EOD Data",
    langName: "中文",
    
    lineageTitle: "Data Lineage",
    lineageReal: "Real yfinance Data",
    lineageDegraded: "Degraded Data",
    lineageMock: "Simulation Mode (Mock)",
    valveTitle: "Signal Valve",
    valveActive: "Signals Active (On)",
    valveHalted: "Signals Halted (Off)",
    waneyeTitle: "Waneye News Hub",
    waneyeDesc: "Live headlines and macro sentiment scores scraped from Waneye.com global financial intelligence.",
    waneyeScore: "Global Market Score",
    waneyeSentiment: "Global Sentiment",
    headlinesList: "Live Financial Headlines",
    highlightsList: "Global Macro Highlights",
    warningsTitle: "System Diagnostics & Alerts",
    waneyeSentimentPos: "Positive",
    waneyeSentimentNeg: "Negative",
    waneyeSentimentNeu: "Neutral",
    
    tradingStateTitle: "Risk Control State",
    stateActive: "Normal (ACTIVE)",
    stateLowRisk: "Low Warning (LOW RISK)",
    stateMediumRisk: "Med Frozen (MED RISK)",
    stateHalted: "High Warning (HIGH RISK)",
    
    risksSectionTitle: "Global Financial Risks & Assessment",
    oppsSectionTitle: "Tactical Opportunities",
    defSectionTitle: "Defensive Strategies",
    impactLabel: "Impact",
    likelihoodLabel: "Likelihood",
    mitigationLabel: "Mitigation",
    timeframeLabel: "Timeframe",

    // Backtest translations
    backtestTitle: "AI Signal Backtesting Terminal",
    backtestSub: "Verifying quantitative signal performance, win rates, and average returns from database.",
    totalSignalsLabel: "Total Signals",
    overallWinRateLabel: "Overall Win Rate",
    avgReturnLabel: "Avg Return",
    holdingDays: "d Hold",
    radarAccuracy: "Take-off Radar Accuracy Metrics",
    historicalLogsTitle: "Historical Quantitative Signals Log",
    viewTerminal: "Live Terminal",
    viewBacktest: "Backtest Panel",
    viewLiveAnalyzer: "Live Analyzer",
    liveAnalyzerTitle: "Real-time Quant Diagnostic Probe (Live Analyzer)",
    liveAnalyzerDesc: "Enter any A-share stock code (e.g. 600519.SS, 002594.SZ, or 300750.SZ) to run live multi-dimensional analysis with index and sector constraints in seconds。",
    noBacktestData: "No backtest data found. Please run the backtesting engine first.",
    themeLight: "☀️ Light",
    themeDark: "🌙 Dark",
    saveHtml: "Save as HTML",
    saveHtmlTooltip: "Save the current page as a static HTML file for offline viewing or sharing",
    footerMainSite: "Visit our main site: ",

    // Wyckoff Translations
    wyckoffMethod: "Wyckoff Price-Volume",
    classicMethod: "Classic Quant Scan",
    wyckoffMacdMethod: "Wyckoff + MACD Strategy",
    analysisMethodLabel: "Analysis Methodology",
    wyckoffPhase: "Wyckoff Phase",
    wyckoffEvents: "Detected Wyckoff Events",
    effortVsResult: "Effort vs Result",
    wyckoffAccum: "Accumulation",
    wyckoffMarkup: "Markup",
    wyckoffDist: "Distribution",
    wyckoffMarkdown: "Markdown",
    wyckoffSensitivity: "Divergence Sensitivity",
    wyckoffSensitivityDesc: "Increasing sensitivity lowers the volume and spread thresholds, making it easier to trigger events but potentially introducing noise.",
    wyckoffConfidence: "Confidence",
    wyckoffSupport: "Support Level",
    wyckoffResistance: "Resistance Level",
    wyckoffClimaxTitle: "Climax & Test Analysis",
    wyckoffExplanation: "Wyckoff Methodology & Logic Explanation",


    // Bear Radar
    bearRadarTitle: "Bear Radar",
    bearRadarDesc: "Real-time detection of potential bearish stocks. Cross-validate against Take-off Radar to spot conflicting signals.",
    distributionZone: "Distribution Zone (Sell-Off)",
    distributionBadge: "Distribution",
    distributionLiteZone: "Suspected Distribution",
    distributionLiteBadge: "Suspect Dist",
    emptyDistribution: "No distribution signal detected",
    emptyDistributionSub: "No confirmed bearish breakdown pattern",
    emptyDistributionLite: "No suspected distribution detected",
    emptyDistributionLiteSub: "No high-RSI reversal or sharp decline found",
    conflictSignal: "⚔️ Conflict",
    conflictSignalDesc: "This stock appears in both Take-off Radar (bullish) and Bear Radar (bearish). Signals conflict — exercise caution.",
    bearRSI: "RSI",
    bearWinRateLabel: "Bear Win Rate",
    bearWinRateDesc: "% of bear signals where price actually fell (correct bearish prediction)",

    // Attribution Analysis
    attrTabLabel: "Signal Attribution",
    attrTitle: "Signal Decomposition",
    attrSubtitle: "Decompose signal returns to assess selection & sector capability",
    attrMarketBeta: "Sector Beta",
    attrSectorRotation: "Allocation Excess",
    attrStockAlpha: "Selection Alpha",
    attrTimingPremium: "Timing Premium",
    attrResidual: "Data Coverage",
    attrResidualOk: "✅ Complete",
    attrResidualWarn: "⚠️ Incomplete",
    attrIR: "Info Ratio IR",
    attrSkillStrong: "🟢 Skill-Driven",
    attrSkillMedium: "🟡 Needs More Data",
    attrSkillWeak: "🔴 Weak Signal",
    attrSkillNegative: "🔴 Negative Alpha",
    attrSkillInsufficient: "⚪ n < 30 (Insufficient)",
    attrByDate: "By Date",
    attrBySector: "By Sector",
    attrByStock: "By Stock",
    attrContrib: "Cumulative Contribution",
    attrPeriodSelector: "Signal Hold Period",
    attrMethodNote: "Methodology (Signal Decomposition)",
    attrMethodBody: "Sector Beta = benchmark sector index; Allocation Excess = sector average - index; Selection Alpha = stock return - sector average. IR = avg(α)/std(α). Due to cross-sectional correlation and overlaps, IR & t-statistic are indicative metrics rather than strict IID tests.",
    attrNoData: "No matured signals. Switch to Replay mode for historical analysis.",
    attrCumChart: "Decomposed Cumulative Returns",
    attrDrilldown: "Signal Returns Breakdown",
    attrTotal: "Stock Total Return",
    attrN: "Signals",
    attrTimingByZone: "Timing Premium by Zone"
  }
};

export const SIGNAL_MAP = {
  zh: {
    "主升浪 ▶": "主升浪 ▶",
    "主升浪(超买) ▶": "主升浪(超买⚠) ▶",
    "V型反转 ⚡": "V型反转 ⚡",
    "潜伏区 ◉": "潜伏区 ◉",
    "多头排列": "多头排列",
    "观望": "观望",
    "形态突破(利空降级)": "形态突破(利空降级)",
    "底部放量(利空降级)": "底部放量(利空降级)",
    "🚨 资金流出": "🚨 资金流出",
    "🔥 热点爆发": "🔥 热点爆发",
    "📡 资金潜入": "📡 资金潜入",
    "📈 温和上涨": "📈 温和上涨",
    "🔶 跑输大盘": "🔶 跑输大盘",
    "❄️ 冷淡": "❄️ 冷淡",
    "信号已拦截": "⚠️ 信号已拦截",
    "主升浪 (轻仓)": "主升浪 (轻仓) ▷",
    "潜伏区 (轻仓)": "潜伏区 (轻仓) ○",
    "冻结新增 (风控)": "冻结新增 (风控) ⏸",
    "减仓避险": "减仓避险 ⬇",
    "主升浪 ▶ (低流动性)": "主升浪 (低流动性) ▷",
    "潜伏区 ◉ (低流动性)": "潜伏区 (低流动性) ○",
    "主升浪 (轻仓) (低流动性)": "主升浪 (轻仓)(低流动性) ▷",
    "潜伏区 (轻仓) (低流动性)": "潜伏区 (轻仓)(低流动性) ○",
    "V型反转 ⚡ (低流动性)": "V型反转 (低流动性) ⚡",
    "消息共振 ◉ (低流动性)": "消息共振 (低流动性) ○",
    "消息共振 ◉": "消息共振 ◉",
    // Bear signals
    "主跌浪 ↓": "主跌浪 ↓",
    "主跌浪(待确认) ↓": "主跌浪(待确认) ↓",
    "疑似出货区 ↓": "疑似出货区 ↓",
    "死亡交叉 ✗": "死亡交叉 ✗",
    "利空共振 ↓": "利空共振 ↓"
  },
  en: {
    "主升浪 ▶": "Momentum ▶",
    "主升浪(超买) ▶": "Momentum (Overbought⚠) ▶",
    "V型反转 ⚡": "V-Reversal ⚡",
    "潜伏区 ◉": "Accumulation ◉",
    "多头排列": "Bullish",
    "观望": "Neutral",
    "形态突破(利空降级)": "Breakout (Downgraded)",
    "底部放量(利空降级)": "Accumulation (Downgraded)",
    "🚨 资金流出": "🚨 Outflow",
    "🔥 热点爆发": "🔥 Hot Spot",
    "📡 资金潜入": "📡 Warming Up",
    "📈 温和上涨": "📈 Mild Rise",
    "🔶 跑输大盘": "🔶 Lagging",
    "❄️ 冷淡": "❄️ Cold",
    "信号已拦截": "⚠️ Halted",
    "主升浪 (轻仓)": "Momentum (Light) ▷",
    "潜伏区 (轻仓)": "Accumulation (Light) ○",
    "冻结新增 (风控)": "Frozen (Risk Control) ⏸",
    "减仓避险": "De-risk / Reduce ⬇",
    "主升浪 ▶ (低流动性)": "Momentum (Low Liq) ▶",
    "潜伏区 ◉ (低流动性)": "Accumulation (Low Liq) ◉",
    "主升浪 (轻仓) (低流动性)": "Momentum (Light)(Low Liq) ▷",
    "潜伏区 (轻仓) (低流动性)": "Accumulation (Light)(Low Liq) ○",
    "V型反转 ⚡ (低流动性)": "V-Reversal (Low Liq) ⚡",
    "消息共振 ◉ (低流动性)": "Resonance (Low Liq) ◉",
    "消息共振 ◉": "News Resonance ◉",
    // Bear signals
    "主跌浪 ↓": "Distribution ↓",
    "主跌浪(待确认) ↓": "Distribution (Unconfirmed) ↓",
    "疑似出货区 ↓": "Suspected Distribution ↓",
    "死亡交叉 ✗": "Death Cross ✗",
    "利空共振 ↓": "Bearish Resonance ↓"
  }
};

export const WANEYE_TRANSLATIONS = {
  "Fed holds rates steady under new Chair Warsh, but hawkish signals roil markets.": "美联储在新任主席沃什的领导下维持利率不变，但鹰派信号使市场剧烈震荡。",
  "Oil prices tumble 4% to three-month lows on hopes of Hormuz reopening.": "由于霍尔木兹海峡有望重新开放，油价大跌4%至三个月低点。",
  "SpaceX shares fall for first time since debut; retail frenzy continues.": "SpaceX 股价自上市以来首次下跌；零售散户狂热仍在继续。",
  
  "ASML CEO Sees Musk’s Terafab as Test for Supply Lines": "阿斯麦 (ASML) 首席执行官认为马斯克的 Terafab 是对供应链的考验",
  "JP Morgan extends DCM dominance; Goldman and Morgan Stanley climb rankings": "摩根大通扩大在债券资本市场的领先地位；高盛和摩根士丹利排名上升",
  "Interest rates expected to be held by Bank of England": "预计英国央行将维持利率不变",
  "Fmr. Fed Vice Chair Blinder on FOMC Decision, Inflation": "前美联储副主席布林德谈美联储公开市场委员会决议与通胀",
  "Hyperscaler’s Multiyear Commitment with Western Digital (WDC) Highlights Robust Demand": "超大型数据中心与西部数据 (WDC) 的数年期承诺凸显强劲需求",

  "Hawkish Fed Policy Error": "美联储鹰派政策失误",
  "High": "高",
  "Medium": "中",
  "Low": "低",
  "Diversify into short-duration bonds, defensive sectors (utilities, healthcare), and cash.": "分散投资至短期债券、防御型板块（公用事业、医疗健康）和现金。",
  "Oil Supply Disruption / Geopolitical Escalation": "石油供应中断 / 地缘政治冲突升级",
  "Hedge with energy sector exposure and commodities.": "通过配置能源板块和大宗商品进行对冲。",

  "Buy Micron Technology (MU) on AI memory demand": "因人工智能内存需求买入美光科技 (MU)",
  "medium-term": "中期",
  "long-term": "长期",
  "longlong-term": "超长期",
  "Explosive demand for high-bandwidth memory driven by AI infrastructure buildout. MU": "人工智能基础设施建设推动了对高带宽内存的爆发性需求。美光科技 (MU)",

  "Increase cash allocation and short-duration Treasuries": "增加现金配置和短期国债",
  "short-term": "短期",
  "Hawkish Fed and potential rate hike by October warrant caution. SHY BIL": "美联储的鹰派立场以及10月前潜在的加息促使保持谨慎。SHY BIL",

  "Xero subscribers exceed estimate in European expansion": "Xero 欧洲扩张订阅用户数超预期",
  "WiseTech Global logistics revenue surges on US demand": "科创全球 (WiseTech) 物流收入受美国需求拉动激增",
  "Audinate reports surging export demand for daily breakout": "Audinate 报告其 Dante 音频系统的出口需求激增",
  "Audinate reports surging export demand for Dante audio systems": "Audinate 报告其 Dante 音频系统的出口需求激增",
  "Appen secures major cloud model tuning contract": "Appen 获得重大云模型微调合同",
  "CBA reports record half-year profit, announces share buyback": "联邦银行 (CBA) 报告创纪录的半年度利润并宣布股票回购",
  "NAB upgraded to buy at Macquarie on strong net interest margin": "由于强劲的净息差，国民银行 (NAB) 被麦格理评级上调至买入",
  "Westpac earnings slide as mortgage war drags margins": "由于房贷战拉低利润率，西太平洋银行 (Westpac) 净利润下滑",
  "ANZ partnership with international payment firm approved": "澳新银行 (ANZ) 与国际支付公司的合作关系获得批准",
  "Macquarie group profit slips 10%, raises dividend slightly": "麦格理集团利润下降 10%，小幅提高股息",
  "BHP copper production guidance raised on AI grid expansion": "得益于人工智能电网扩张，必和必拓 (BHP) 上调铜产量指引",
  "Rio Tinto to acquire Lithium project in Western Australia": "力拓 (Rio Tinto) 将在西澳大利亚收购锂项目",
  "Fortescue green iron pilot project achieves breakthrough": "福特斯库 (Fortescue) 绿色铁示范项目取得突破",
  "South32 logs first-half loss on commodity price decline": "由于大宗商品价格下跌，南32 (South32) 录得半年度亏损",
  "Mineral Resources debt concerns rise, downgraded at S&P": "矿业资源 (Mineral Resources) 债务担忧加剧，评级被标普下调",
  "Pilbara Minerals cash flow hit by low spodumene price": "受低锂辉石价格打击，皮尔巴拉矿业 (Pilbara Minerals) 现金流受损",
  "Liontown Resources lithium project delayed due to weather": "由于天气原因，狮子镇资源 (Liontown Resources) 锂项目被推迟",
  "IGO nickel asset writedown leads to full-year net loss": "IGO 镍资产减值导致全年净亏损",
  "Lynas rare earths production recovers, faces low price headwind": "莱纳斯 (Lynas) 稀土产量有所恢复，但面临低价逆风",
  "CSL Behring plasma collection returns to pre-COVID levels": "CSL 贝林血浆采集恢复至疫情前水平",
  "ResMed shares gain as sleep apnea demand stays strong": "由于睡眠呼吸暂停设备需求保持强劲，瑞思迈 (ResMed) 股价上涨",
  "Cochlear earnings beat estimates, upgrades full year guidance": "科利耳 (Cochlear) 收益超预期，并上调全年业绩指引",
  "Sonic Healthcare profit slips on lower clinical fees": "由于临床费用下降，索尼克医疗 (Sonic Healthcare) 利润小幅下滑",
  "Wesfarmers retail sales grow 4%, Bunnings offset inflation": "西农集团 (Wesfarmers) 零售销售额增长 4%，Bunnings 抵消了通胀影响",
  "Woolworths profit margin slips as supply chain cost rises": "由于供应链成本上升，伍尔沃斯 (Woolworths) 利润率有所下滑",
  "Coles sales rise on grocery value push, margin holds flat": "因食品杂货促销拉动销售，科尔斯 (Coles) 销售额上升且利润率持平",
  "JB Hi-Fi sales beat estimates, consumer spending stays resilient": "JB Hi-Fi 销售额超预期，消费者支出保持韧性",
  "Goodman Group logistics property demand hits record high": "嘉民集团 (Goodman Group) 物流地产需求创历史新高",
  "Scentre group mall traffic recovers, leases upgraded": "Scentre 集团商场客流量恢复，租金上调",
  "Stockland residential sales slow down on high rates": "由于高利率，斯托克兰 (Stockland) 住宅销售放缓",
  "GPT Group office occupancy concerns remain, slips 2%": "GPT 集团写字楼入驻率担忧仍在，小幅下跌 2%",
  "Woodside energy logs higher gas output, profit beats estimate": "伍德赛德能源 (Woodside Energy) 录得更高的天然气产量，利润超预期",
  "Santos gas project gets key environmental approval": "桑托斯 (Santos) 天然气项目获得关键环保批准",
  "Beach Energy drill results miss targets in Cooper basin": "海滩能源 (Beach Energy) 在库珀盆地的钻探结果未达预期",
  "Whitehaven coal upgraded on thermal coal price recovery": "受益于动力煤价格复苏，白天堂煤业 (Whitehaven Coal) 评级上调",
  "No recent news catalyst found": "未发现近期新闻催化剂"
};

export const getT = (lang) => (key) => TRANSLATIONS[lang]?.[key] || key;

export const translateDynamic = (text, lang) => {
  if (lang !== 'zh' || !text) return text;
  return WANEYE_TRANSLATIONS[text] || text;
};

export const formatSectorName = (name, lang) => {
  if (!name) return "";
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return lang === 'zh' ? parts[0] : parts.slice(1).join(' ');
  }
  return name;
};

export const translateSummary = (summary, lang) => {
  if (lang === 'zh') return summary;
  const map = {
    "美债收益率持续攀升，估值端对高成长科技与医疗板块形成明显压制。": "US yields climbing; valuation pressure on growth tech and healthcare sectors.",
    "收益率大幅下行，分红派息板块及高成长科技股迎来流动性估值修复。": "Yields declining; valuation recovery for high-dividend and growth tech sectors.",
    "澳元汇率走强，大宗商品及矿业板块资金吸引力显著上升。": "AUD strengthening; commodity and mining sectors attract capital.",
    "澳元汇率走弱，利好出口及跨国资源龙头企业汇兑收益。": "AUD weakening; export and resources giants benefit from FX gains.",
    "国债收益率与澳元汇率宽幅震荡，宏观面流动性对大盘影响均衡。": "Yields and AUD trading in range; balanced macroeconomic impact on market.",
    "澳洲10年期国债收益率微降，同时澳元表现强势，利好大宗商品及估值端科技成长板块。": "AU 10Y yields slip while AUD remains strong, positive for commodities and growth tech.",
    "大盘宏观面平静": "Macroeconomic environment remains calm."
  };
  return map[summary] || summary;
};

export const translateInsight = (text, lang) => {
  if (lang === 'zh' || !text) return text;
  let en = text;
  en = en.replace(/鉴于当前系统触发交易阀门拦截或全真数据失效，/g, "Due to system signal valve halting or data lineage fallback, ");
  en = en.replace(/的交易信号已被自动拦截锁定，请保持观望。/g, " trading signals have been automatically locked and halted. Stay neutral.");
  en = en.replace(/技术面突破，成交量放大至/g, "technical breakout, volume expanded to ");
  en = en.replace(/倍/g, "x");
  en = en.replace(/量价与消息面产生多头共振，短线爆发动能极强。/g, "price-volume and news sentiment in resonance, strong short-term momentum.");
  en = en.replace(/底部异常放量。/g, "abnormal volume spike at bottom.");
  en = en.replace(/疑似主力资金借利好配合悄然建仓，突破拐点临近。/g, "suspected institutional accumulation, breakout point approaching.");
  en = en.replace(/虽符合多头或突破形态，但最新消息面偏向利空/g, "shows bullish/breakout pattern, but latest news is bearish");
  en = en.replace(/（([\d.-]+)分）/g, " ($1 pts)");
  en = en.replace(/\(([\d.-]+)分\)/g, " ($1 pts)");
  en = en.replace(/可能遭遇获利回吐，雷达已自动降级预警。/g, "risk of profit-taking, downgraded by radar.");
  en = en.replace(/均线多头排列维持/g, "bullish MA alignment maintained");
  en = en.replace(/相对大盘强度为/g, "relative strength vs index is");
  en = en.replace(/消息面情绪得分/g, "News sentiment score");
  en = en.replace(/持平偏多，等待资金信号/g, "neutral-bullish, waiting for capital signal");
  en = en.replace(/今日下跌/g, "down today");
  en = en.replace(/，量价变离，暂时观望为主。/g, ", volume divergence, neutral stance recommended.");
  en = en.replace(/，量价背离，暂时观望为主。/g, ", volume divergence, neutral stance recommended.");
  en = en.replace(/当前无明显异动信号，持续跟踪中。/g, "no significant anomalies, tracking closely.");
  en = en.replace(/大幅跑赢大盘/g, "significantly outperforming index");
  en = en.replace(/走势强于大盘/g, "stronger than index");
  en = en.replace(/消息面偏向多头（关注焦点：/g, "bullish news sentiment (focus: ");
  en = en.replace(/消息面伴有利空忧虑（关注焦点：/g, "bearish news concerns (focus: ");
  en = en.replace(/最新动态：/g, "latest news: ");
  en = en.replace(/’），/g, "'), ");
  en = en.replace(/'），/g, "'), ");
  en = en.replace(/低风险提示：建议轻仓/g, "Low Risk: Light position advised");
  en = en.replace(/RSI\((\d+)\)进入超买区间，追高需谨慎。/g, "RSI($1) overbought zone, chasing highs is risky.");
  en = en.replace(/RSI\((\d+)\)进入超卖区间，反弹概率较大。/g, "RSI($1) oversold zone, bounce probability is high.");

  // Add missing patterns for "处于多头排列，且消息面显著偏多" and resonance patterns
  en = en.replace(/处于多头排列，且消息面显著偏多/g, "in bullish alignment with significantly positive news sentiment");
  en = en.replace(/与技术形态形成共振，建议逢低布局。/g, "resonating with technical pattern, accumulate on dips recommended.");

  // Bearish & Warning Patterns
  en = en.replace(/触发主跌浪预警，当前处于派发区/g, "triggered main decline warning, currently in distribution zone");
  en = en.replace(/触发空头预警信号/g, "triggered bearish warning signal");
  en = en.replace(/均线系统空头排列维持，今日跌幅达/g, "bearish MA alignment maintained, today down ");
  en = en.replace(/技术形态转弱，跌破支持位或处于疑似出货期，追高风险极高/g, "technical pattern weakening, broke support neckline or suspected distribution, extremely high risk chasing highs");
  en = en.replace(/走势显著弱于大盘，/g, "significantly underperforming index, ");
  en = en.replace(/，建议规避风险。/g, ", risk aversion recommended. ");

  // Clean up any remaining full-width Chinese punctuation for the English translation
  en = en.replace(/，/g, ", ");
  en = en.replace(/。/g, ". ");
  en = en.replace(/：/g, ": ");
  en = en.replace(/（/g, " (");
  en = en.replace(/）/g, ") ");

  return en.trim();
};

export const translateWarning = (warn, lang) => {
  if (lang === 'zh' || !warn) return warn;
  
  const exactMap = {
    "无法连接到 Waneye.com 获取实时全球舆情，已使用备用本地策略": "Unable to connect to Waneye.com for real-time global sentiment; backup local policy is used.",
    "大盘基准 sh000300 抓取失败，降级至 sh000001 基准": "Market benchmark sh000300 failed to pull; degraded to sh000001 benchmark.",
    "大盘数据不足，强制切换至全仿真 Mock 模式": "Insufficient market data; forced switch to simulation (Mock) mode.",
    "手动控制阀门打开，已强制开启高风险预警": "Manual control valve open; high-risk warning forced active.",
    "有效拉取个股少于5只，已自动转为仿真数据运行": "Fewer than 5 stocks successfully pulled; automatically switched to simulation (Mock) data.",
    "有效拉取个股数量过少，切换为 Mock 降级模式以确保 UI 完整性": "Too few valid stocks pulled; switched to Mock degraded mode to ensure UI integrity.",
    "仿真模式警告：已自动补全缺失数据，当前显示为离线生成测试数据": "Simulation warning: Missing data auto-filled, displaying offline mock test data."
  };
  
  if (exactMap[warn]) return exactMap[warn];
  
  let res = warn;
  res = res.replace(/全局市场极度恐慌 \(Waneye 得分 (\d+) < 30\)，触发系统高风险避险机制/g, "Extreme global panic (Waneye score $1 < 30); triggering high-risk hedging mechanism.");
  res = res.replace(/全球宏观\/地缘政治威胁极高 \(威胁指数 ([\d.]+)\s*>= 10.0\)，系统已进入高风险防御状态/g, "High global/geopolitical threat (threat index $1 >= 10.0); system in defensive mode.");
  res = res.replace(/检测到中度市场风险 \(Waneye 得分 (\d+), 威胁指数 ([\d.]+)\)，系统冻结新增仓，并下发减仓避险提示/g, "Medium risk detected (Waneye score $1, threat $2); frozen new positions, advising de-risking.");
  res = res.replace(/检测到轻度市场风险 \(Waneye 得分 (\d+), 威胁指数 ([\d.]+)\)，系统提高信号触发阈值并建议轻仓操作/g, "Low risk detected (Waneye score $1, threat $2); increased signal threshold and advising light positions.");
  res = res.replace(/个股拉取出现部分缺失，失败数: (\d+)\/(\d+)，系统在降级数据源下运行/g, "Partial stock pull failures ($1/$2); system running under degraded data sources.");
  
  return res;
};

export const STOCK_NAME_MAP = {
  "600036": "招商银行", "601398": "工商银行", "601288": "农业银行", "601328": "交通银行", "601988": "中国银行", "000001": "平安银行", "600000": "浦发银行", "002142": "宁波银行", "601318": "中国平安",
  "300059": "东方财富", "600030": "中信证券", "601688": "华泰证券", "000776": "广发证券", "601211": "国泰君安", "600999": "招商证券",
  "601899": "紫金矿业", "603993": "洛阳钼业", "600362": "江西铜业", "601600": "中国铝业", "000878": "云南铜业", "600111": "北方稀土",
  "300750": "宁德时代", "002594": "比亚迪", "300014": "亿纬锂能", "002466": "天齐锂业", "002460": "赣锋锂业", "002074": "国轩高科", "000338": "潍柴动力",
  "601012": "隆基绿能", "600438": "通威股份", "300274": "阳光电源", "600900": "长江电力", "601088": "中国神华", "600011": "华能国际", "601857": "中国石油", "600028": "中国石化", "600938": "中国海油",
  "688981": "中芯国际", "002371": "北方华创", "603501": "韦尔股份", "603986": "兆易创新", "002049": "紫光国微", "688012": "中微公司", "000725": "京东方A",
  "002230": "科大讯飞", "688111": "金山办公", "300308": "中际旭创", "300502": "新易盛", "000977": "浪潮信息", "601138": "工业富联",
  "600276": "恒瑞医药", "300760": "迈瑞医疗", "300015": "爱尔眼科", "603259": "药明康德", "600436": "片仔癀", "000999": "华润三九",
  "600519": "贵州茅台", "000858": "五粮液", "000568": "泸州老窖", "600809": "山西汾酒", "002304": "洋河股份", "603288": "海天味业",
  "600760": "中航沈飞", "000768": "中航西飞", "600893": "航发动力", "002625": "光启技术", "600150": "中国船舶", "002179": "中航光电"
};
