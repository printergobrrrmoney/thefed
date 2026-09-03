import commatizeNumber from './commatizeNumber';

/**
 * Money, at a width a phone can hold.
 *
 * The economy is exponential and the screen is not, so a full figure stops
 * fitting long before the game stops growing — at a Tech Company's rate an hour
 * is comfortably past a quadrillion. Below a million the whole number still
 * fits and is the more satisfying thing to watch, so it is left alone; above
 * that it is abbreviated.
 *
 * Three decimals rather than two, because the last digit is what shows the
 * printer is running. Two would sit still for minutes at a time.
 */
const SCALES = [
    { at: 1e33, suffix: 'Dc' },
    { at: 1e30, suffix: 'No' },
    { at: 1e27, suffix: 'Oc' },
    { at: 1e24, suffix: 'Sp' },
    { at: 1e21, suffix: 'Sx' },
    { at: 1e18, suffix: 'Qi' },
    { at: 1e15, suffix: 'Qa' },
    { at: 1e12, suffix: 'T' },
    { at: 1e9, suffix: 'B' },
    { at: 1e6, suffix: 'M' },
];

/** Past this there are no names anyone recognises, so digits stop helping. */
export const BEYOND_NAMES = 1e36;

/** Where full figures give way to abbreviations. */
export const ABBREVIATE_ABOVE = 1e6;

export const abbreviateMoney = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return '$0.00';

    const sign = number < 0 ? '-' : '';
    const size = Math.abs(number);

    if (size < ABBREVIATE_ABOVE) {
        const [whole, cents] = size.toFixed(2).split('.');
        return `${sign}$${commatizeNumber(whole)}.${cents}`;
    }

    // Beyond the named scales, digits stop conveying anything and the string
    // starts growing again, so switch to exponent form instead.
    if (size >= BEYOND_NAMES) return `${sign}$${size.toExponential(3)}`;

    const scale = SCALES.find(({ at }) => size >= at);
    return `${sign}$${(size / scale.at).toFixed(3)}${scale.suffix}`;
};

export default abbreviateMoney;
