/**
 * Bump whenever any economic rule changes — a price, a rate, the growth
 * factor, a session limit. Logs recorded under an older version no longer
 * replay to the same score, so the verifier refuses them rather than paying
 * out a number it cannot reproduce.
 *
 * Kept in its own module so the verifier can read it without importing the
 * package index, which would be a cycle.
 */
export const CORE_VERSION = 2;

export default CORE_VERSION;
