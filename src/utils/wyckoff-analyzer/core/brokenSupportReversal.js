/**
 * Returns true when a single bar performs a "broken-support reversal":
 *   - Intraday low pierces below the reference support
 *   - Close recovers back above the reference support
 *   - Close is above open (up-close body, buyer won)
 *
 * Used by both Spring (accumulation.js) and Shakeout (weakness.js) to avoid
 * duplicating the same core predicate in two places.
 *
 * @param {number} low        - Bar's intraday low
 * @param {number} close      - Bar's close price
 * @param {number} open       - Bar's open price
 * @param {number} supportRef - The support level being tested
 * @returns {boolean}
 */
export function isBrokenSupportReversal(low, close, open, supportRef) {
  return low < supportRef && close > supportRef && close > open;
}
