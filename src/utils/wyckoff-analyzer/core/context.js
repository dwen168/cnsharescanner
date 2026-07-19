export class WyckoffContext {
  constructor(df, sensitivity, indicators) {
    this.df = df;
    this.N = df.length;
    this.sensitivity = sensitivity;

    // Unpack indicators
    this.ma20 = indicators.ma20;
    this.ma60 = indicators.ma60;
    this.ma120 = indicators.ma120;
    this.ma5 = indicators.ma5;
    this.ma10 = indicators.ma10;
    this.atr = indicators.atr;
    this.rsi = indicators.rsi;
    this.avgVol20 = indicators.avgVol20;
    this.isSqueezeArr = indicators.isSqueezeArr;
    this.bbUpper = indicators.bbUpper;
    this.bbLower = indicators.bbLower;
    this.bbBandwidth = indicators.bbBandwidth;
    this.allPivots = indicators.allPivots;
    this.yearLow = indicators.yearLow;
    this.yearHigh = indicators.yearHigh;
    this.yearRange = indicators.yearRange;

    // Map properties
    this.dfCloses = df.map(x => x.Close);
    this.dfHighs = df.map(x => x.High);
    this.dfLows = df.map(x => x.Low);
    this.dfVolumes = df.map(x => x.Volume);

    // Running multipliers
    // sensFactor is intentionally *inversely* proportional to `sensitivity`.
    // Higher sensitivity (e.g. 0.5) → lower sensFactor (e.g. 1.0) → lower thresholds → more signals detected.
    // Lower sensitivity (e.g. 0.1) → higher sensFactor (e.g. 1.4) → stricter thresholds → fewer signals.
    // The parameter is named `sensitivity` for user-facing clarity ("how sensitive should detection be"),
    // but internally acts as a permissiveness factor. Do NOT rename without updating all callers.
    this.sensFactor = 1.5 - sensitivity;


    // Detected events and support/resistance levels
    this.events = [];
    this.supportLevels = [];
    this.resistanceLevels = [];

    // Boundaries
    this.trSupport = null;
    this.trResistance = null;

    // Climax anchors
    this.lastSC = null;
    this.lastBC = null;

    // Cooldown trackers
    this.lastSOSIndex = -Infinity;
    this.lastSOWIndex = -Infinity;
    this.lastUTAD = null;
    this.lastUTADInvalidated = false;
    this.lastBUIndex = -Infinity;
    this.lastFlagIndex = -Infinity;
    this.lastPSIndex = -Infinity;
    this.lastPSYIndex = -Infinity;
    this.lastSpringEventIndex = -Infinity;
    this.lastSOWForLPSY = null;
    this.lastLPSYIndex = -Infinity;
    this.lastLPSIndex = -Infinity;

    // Cooldown settings
    this.CLIMAX_EXPIRY_BARS = 60;
    this.SOS_SOW_COOLDOWN = 5;
    this.PS_PSY_COOLDOWN = 10;
    this.LPSY_COOLDOWN = 10;
    this.LPS_COOLDOWN = 10;
  }
}
