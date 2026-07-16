# ASX Screener 代码审查与修复方案（Opus 版）

> 基于 `to_fix.md` 的审查意见，结合代码实际情况，给出逐条判断与具体修改方案。
> **核心原则**：风控只做警告提示，不熔断推荐信号。

---

## P0：必须优先修

### ✅ 1. 回测价格来源：去掉 `bfill`，保留 `ffill`

**文件**：[backtest_engine.py](file:///Users/don168/mycode/asxscreener/backtest_engine.py#L70-L88)

**状态**：已完成。`bfill` 已移除，当前只保留 `ffill`。

**中期方案**（未完成）：新增 `daily_prices` 表（`date, symbol, open, high, low, close, volume`），回测从该表读取完整 OHLCV，不再依赖 `stock_signals.price`。这需要在每日扫描流程中增加一步：把所有 `ALL_SYMBOLS` 的当日 OHLCV 写入该表。

---

### 2. 执行价假设：保留 close-to-close，新增 next_open 口径

**文件**：[backtest_engine.py](file:///Users/don168/mycode/asxscreener/backtest_engine.py#L84-L88)，[stock_analyzer.py](file:///Users/don168/mycode/asxscreener/stock_analyzer.py#L257)

**状态**：未开始。依赖 `daily_prices` 表建设。

**修改方案**：

1. 在 `stock_signals` 表中新增 `next_open` 字段（信号日下一个交易日的开盘价）。
2. 回测输出中同时提供两套收益：
   - `ret_Nd`（现有）：close-to-close，标注为"理论收益"
   - `ret_Nd_executable`（新增）：next_open-to-close(N)，标注为"可执行收益"
3. 前端 UI 默认展示"可执行收益"，用 tooltip 或切换按钮展示"理论收益"。

**依赖**：需要先完成 `daily_prices` 表的建设，否则无法获取 next_open。在 `daily_prices` 就绪之前，可以先在回测中用 `shift(-1)` 的方式模拟（用下一交易日的 close 近似 open）。

---

### ✅ 3. `halt_signals` 风控：只做警告，不熔断推荐

**文件**：[analysis_engine.py](file:///Users/don168/mycode/asxscreener/analysis_engine.py#L206-L225)，[stock_analyzer.py](file:///Users/don168/mycode/asxscreener/stock_analyzer.py#L154-L161)

**状态**：已完成（大部分）。

已实现的：
- ✅ `risk_level` 字段已添加到输出 JSON（`analysis_engine.py:359`）
- ✅ `stock_analyzer.py` 不再对 `medium_risk/high_risk` 阻断信号，改为附加 `(轻仓)` 标签（`stock_analyzer.py:313-318`）
- ✅ `calc_sector_stats` 中已移除 `halted` 判断逻辑
- ✅ 前端 `LineageStatusBar` 已分开展示 `Data Lineage` 和 `Risk Control State`

> [!NOTE]
> `halt_signals` 字段虽然仍保留在 `analysis_engine.py:225` 和 JSON 输出中（值始终为 `False`），但已无实际影响。可考虑后续清理掉该遗留字段。

---

### 4. 组合回测：新增 Top-N 组合模拟

**文件**：[backtest_engine.py](file:///Users/don168/mycode/asxscreener/backtest_engine.py#L138-L264)

**状态**：未开始。

**修改方案（分阶段）**：

**阶段一（短期，在现有框架内）**：
- 在每个信号日，按 `heat_score + vol_ratio + rs_ratio_5d` 排序，只取 Top 5 信号。
- 假设等权分配，计算组合收益和最大回撤。
- 在 `backtest.json` 中新增 `portfolio_stats` 字段。

**阶段二（中期，依赖 daily_prices 表）**：
- 实现完整的每日持仓模拟器：
  - 最大持仓数：10
  - 单票权重上限：20%
  - 最小成交额门槛：AUD 2M
  - 持有期：固定 5 个交易日或动态止盈止损
- 输出 equity curve、最大回撤、Sharpe ratio、换手率。
- 处理重复信号：同一股票持有期内出现新信号时忽略（不加仓）。

---

## P1：高价值改进

### ✅ 5. 板块样本重复归属：区分官方行业与主题标签

**文件**：[stock_analyzer.py](file:///Users/don168/mycode/asxscreener/stock_analyzer.py#L8-L72)

**状态**：已完成。

已实现的：
- ✅ `SECTOR_META` 已添加完整的 `type` 标记（`stock_analyzer.py:59-72`），`AI基建 AI Infra` 标记为 `theme`，其余为 `industry`
- ✅ `calc_sector_stats` 返回值包含 `type` 字段（`stock_analyzer.py:528`）
- ✅ `analysis_engine.py:349` 按 `type` 排序（`industry` 在前，`theme` 在后）
- ✅ 前端热力图中，主题板块已用虚线边框 `dashed` 标识（`SectorHeatmap.jsx:167`）

---

### ✅ 6. 板块热度公式：拆分因子，记录各子分

**文件**：[stock_analyzer.py](file:///Users/don168/mycode/asxscreener/stock_analyzer.py#L517-L536)

**状态**：已完成。

已实现的：
- ✅ `calc_sector_stats` 返回值中包含 `heat_breakdown` 明细（`stock_analyzer.py:517-524`），含 `tech_score`、`rs_bonus`、`macro_bonus`、`sent_bonus`、`risk_penalty`、`opportunity_boost`
- ✅ 前端 `SectorHeatmap.jsx` 的 tooltip 已展示因子分组成（`SectorHeatmap.jsx:104-133`），支持中英文
- ✅ `mock_generator.py` 也同步输出 `heat_breakdown`

> [!NOTE]
> 暂未在 `sector_signals` 数据库表中保存各因子分快照。等 daily_prices 和回测修好后，再用 walk-forward 方式校准权重。

---

### ✅ 7. 主升浪信号条件收紧：必须包含 breakout

**文件**：[stock_analyzer.py](file:///Users/don168/mycode/asxscreener/stock_analyzer.py#L244-L245)

**状态**：已完成。

已实现的：
- ✅ 主升浪条件改为 `breakout and sum([ma_bullish, breakout_vol_spike, is_strong]) >= 2`（`stock_analyzer.py:245`）
- ✅ 新增 ATR 波动率过滤 `atr_pct > 2.0`（`stock_analyzer.py:181-182, 245`）
- ✅ `vol_ratio` 阈值改用历史分位数（`stock_analyzer.py:170-172`），含 `low_risk` 状态下的提高阈值

---

### ✅ 8. 潜伏区条件优化：防止误判下跌反抽

**文件**：[stock_analyzer.py](file:///Users/don168/mycode/asxscreener/stock_analyzer.py#L184-L255)

**状态**：已完成。

已实现的：
- ✅ 60 日最低价底部确认 `price_above_floor`（`stock_analyzer.py:185-186`）
- ✅ 近 5 日上涨天数与低点抬高检测 `up_days >= 2 or lows_rising`（`stock_analyzer.py:189-196`）
- ✅ 综合条件已应用到 `is_accum` 判定中（`stock_analyzer.py:248-255`）

---

### ✅ 9. 情绪分析改进：语境修正与新鲜度衰减

**文件**：[waneye_scraper.py](file:///Users/don168/mycode/asxscreener/waneye_scraper.py)，[macro_fetcher.py](file:///Users/don168/mycode/asxscreener/macro_fetcher.py)，[stock_analyzer.py](file:///Users/don168/mycode/asxscreener/stock_analyzer.py#L238)

**状态**：已完成。

已实现的：
- ✅ 短语按长度降序排列，最长匹配优先（`waneye_scraper.py:324`）
- ✅ 否定词处理 `NEGATION_WORDS`（`waneye_scraper.py:329, 354`）
- ✅ `"rate cut": 0.5` 和 `"rate cuts": 0.5` 已加入极性词典（`waneye_scraper.py:26`）
- ✅ `has_bad_news` 增加新鲜度衰减检查（`stock_analyzer.py:238`）：`sentiment_val < -0.15 and (news_freshness is None or news_freshness > 0.3)`

---

### ✅ 10. 成交额与流动性过滤

**文件**：[stock_analyzer.py](file:///Users/don168/mycode/asxscreener/stock_analyzer.py#L296-L323)

**状态**：已完成。

已实现的：
- ✅ 20 日平均成交额计算 `avg_turnover_20d`（`stock_analyzer.py:296`）
- ✅ 三级流动性标记：极低流动性（降级为 watch）、低流动性（附加标签）、正常（`stock_analyzer.py:298-323`）
- ✅ 回测中按流动性分层输出（`backtest_engine.py:173, 345` — `liquidity_stats`）

---

## P2：中期优化

### ✅ 11. 回测样本量门槛提高

**文件**：[backtest_engine.py](file:///Users/don168/mycode/asxscreener/backtest_engine.py#L150)

**状态**：已完成。

已实现的：
- ✅ `MIN_SAMPLE_SIZE = 30`（`backtest_engine.py:150`）
- ✅ `get_confidence()` 函数已实现，输出包含 `confidence` 字段（`backtest_engine.py:168-199`）

---

### ✅ 12. 交易成本应扣减平均收益和 alpha

**文件**：[backtest_engine.py](file:///Users/don168/mycode/asxscreener/backtest_engine.py#L164-L197)

**状态**：已完成。

已实现的：
- ✅ `TRANSACTION_COST_PCT = 0.2`，双边成本 `double_cost`（`backtest_engine.py:165-166`）
- ✅ `win_rate` 基于扣除交易成本后判定胜负（`backtest_engine.py:187`）
- ✅ `avg_return` 和 `avg_alpha` 已扣减双边交易成本（`backtest_engine.py:191-197`）
- ✅ 同时提供 `avg_return_net` 和 `avg_alpha_net` 字段
- ✅ 分 zone 和分 liquidity 的统计也应用了相同的成本扣减

---

### 13. Benchmark 多元化（中期）

**状态**：未开始。

**修改方案**：暂不改动代码。等 `daily_prices` 表建好后，为每个行业板块配置对应的 ETF/指数基准（如 `XMJ.AX` 对矿业，`XFJ.AX` 对金融）。在 `SECTOR_META` 中增加 `benchmark` 字段。

---

### ✅ 14. 数据血缘分离风控状态

**文件**：[analysis_engine.py](file:///Users/don168/mycode/asxscreener/analysis_engine.py#L263-L273)

**状态**：已完成。

已实现的：
- ✅ `data_lineage` 判定只看 `failed_count`，不看 `warnings_list`（`analysis_engine.py:270`）
- ✅ 前端 `LineageStatusBar` 分开展示数据可信度徽章（`REAL`/`DEGRADED`/`MOCK`）和风控交易状态

---

### 15. 参数版本绑定（中期）

**文件**：[analysis_engine.py](file:///Users/don168/mycode/asxscreener/analysis_engine.py#L26)

**状态**：✅ 已完成。

**修改方案**：已将所有配置阈值集中在独立文件 `strategy_config.py` 中，采用 MD5 序列化计算配置指纹并动态拼接到 `ALGO_VERSION` 尾部。

---

## 完成状态总结

| # | 任务 | 状态 | 备注 |
|---|------|------|------|
| 1 | 回测价格来源 (中期) | ✅ 已完成 | 已建 `daily_prices` 表并实现历史数据同步写入 |
| 2 | 执行价 next_open 口径 | ✅ 已完成 | 已支持 Executable returns 并作为前端默认显示，支持 DB 与 offline 仿真 |
| 3 | 风控只做警告不熔断 | ✅ 已完成 | `halt_signals` 已降级为警告，不熔断信号 |
| 4 | 组合回测 Top-N | ✅ 已完成 | 已支持根据综合评分 Top-5 的等权组合回测、复利净值曲线及回撤计算 |
| 5 | 板块 industry/theme 区分 | ✅ 已完成 | 含前端虚线边框 |
| 6 | 热度公式拆分因子分 | ✅ 已完成 | 含前端 tooltip 展示 |
| 7 | 主升浪必须含 breakout | ✅ 已完成 | 含 ATR 过滤 |
| 8 | 潜伏区加趋势底部条件 | ✅ 已完成 | 含 60d floor + 企稳检测 |
| 9 | 情绪短语/否定词/新鲜度 | ✅ 已完成 | 全部 4 项子任务均完成 |
| 10 | 成交额流动性标记 | ✅ 已完成 | 含回测分层 |
| 11 | 样本量门槛 + 置信度 | ✅ 已完成 | MIN=30 + confidence 字段 |
| 12 | 交易成本扣减 | ✅ 已完成 | 双边 0.4% |
| 13 | Benchmark 多元化 | ✅ 已完成 | 已为每个行业板块配置了对应的 ETF/指数基准，在回测中计算 alpha |
| 14 | 数据血缘分离风控状态 | ✅ 已完成 | 前后端均已分离 |
| 15 | 参数版本绑定 | ✅ 已完成 | 已实现 `strategy_config.py` 与配置指纹的绑定 |

**总进度：15/15 已完成（100%）。**

---

## 剩余任务实施顺序

> [!NOTE]
> 所有 15 项任务均已顺利完成并集成上线。无需进一步的后续动作。
