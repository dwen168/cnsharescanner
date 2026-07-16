import React from 'react';
import { getT } from '../utils/translations';

export default function StrategyConfigPanel({ version, config, lang }) {
  const t = getT(lang);

  // Fallback default configurations if config is not yet loaded from JSON
  const defaultConfigMap = {
    'v1.2.0-4fea7cba': {
      accum_spike_threshold: { default: 1.1, low_risk: 1.3 },
      vol_percentile_threshold: { default: 0.70, low_risk: 0.75 },
      rs_threshold: { default: 1.01, low_risk: 1.03 },
      ma_bullish: 'MA5 > MA10 > MA20 & Close > MA5 & Close > MA60',
      atr_method: 'Standard Average True Range (14d)',
      normalization: 'Normalized by Sector Size (Ratio)',
      baseline: 'Aligned next-day Open to Close'
    },
    'v1.2.0-19aa7e71': {
      accum_spike_threshold: { default: 0.8, low_risk: 1.0 },
      vol_percentile_threshold: { default: 0.70, low_risk: 0.75 },
      rs_threshold: { default: 1.01, low_risk: 1.03 },
      ma_bullish: 'MA5 > MA10 > MA20 & Close > MA5 (No MA60 constraint)',
      atr_method: 'Rolling Max-Min Range (Donchian Width)',
      normalization: 'Absolute Counts (Favors larger sectors)',
      baseline: 'Mismatched (Stock Open vs Benchmark Close)'
    }
  };

  const activeConfig = config || defaultConfigMap[version] || defaultConfigMap['v1.2.0-4fea7cba'];
  const isLegacy = version === 'v1.2.0-19aa7e71';

  return (
    <div className="module" style={{
      background: 'linear-gradient(135deg, rgba(99, 179, 237, 0.03) 0%, rgba(0, 0, 0, 0) 100%)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '1.2rem',
      marginBottom: '1.5rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div>
          <span style={{
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: isLegacy ? 'var(--text-3)' : 'var(--green)',
            background: isLegacy ? 'rgba(255, 255, 255, 0.05)' : 'rgba(46, 204, 113, 0.1)',
            padding: '2px 8px',
            borderRadius: '10px',
            fontWeight: 700,
            marginRight: '0.6rem'
          }}>
            {isLegacy ? (lang === 'zh' ? '历史版本' : 'Legacy Config') : (lang === 'zh' ? '当前激活配置' : 'Active Config')}
          </span>
          <strong style={{ fontSize: '0.9rem', color: 'var(--text-1)' }}>
            Algorithm Spec: {version}
          </strong>
        </div>
        <div style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>
          {lang === 'zh' ? '※ 参数更改自动更新配置指纹以供选择' : '※ Parameter adjustments automatically update fingerprint for selection'}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginTop: '1rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
        paddingTop: '1rem'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
            {lang === 'zh' ? '均线多头形态' : 'Bullish MA Rule'}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-1)', fontWeight: 500 }}>
            {isLegacy ? 'MA5 > MA10 > MA20 & Close > MA5' : 'MA5 > MA10 > MA20 & Close > MA5 & Close > MA60'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
            {lang === 'zh' ? 'ATR 波动率计算' : 'ATR Volatility'}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-1)', fontWeight: 500 }}>
            {isLegacy ? '14d Rolling Max-Min (High-Low)' : 'Standard True Range average (14d)'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
            {lang === 'zh' ? '潜伏区吸筹量比阀值' : 'Accumulation Vol Ratio'}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-1)', fontWeight: 500 }}>
            Default: {activeConfig.accum_spike_threshold?.default ?? '1.1'} / Low Risk: {activeConfig.accum_spike_threshold?.low_risk ?? '1.3'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
            {lang === 'zh' ? '板块评分计数归一化' : 'Sector Size Normalization'}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-1)', fontWeight: 500 }}>
            {isLegacy ? 'Absolute counts (Favors size)' : 'Constituent Ratio (Fair comparisons)'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
            {lang === 'zh' ? '可执行收益 Benchmark 基准' : 'Executable Alpha Baseline'}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-1)', fontWeight: 500 }}>
            {isLegacy ? 'Close-to-Close (Mismatched)' : 'Next Open-to-Close (Aligned)'}
          </span>
        </div>
      </div>
    </div>
  );
}
