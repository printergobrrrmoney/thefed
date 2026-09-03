import { abbreviateMoney, ABBREVIATE_ABOVE } from './abbreviateMoney';

describe('money that has to fit on a phone', () => {
    it('leaves small amounts alone, cents and all', () => {
        expect(abbreviateMoney(0)).toBe('$0.00');
        expect(abbreviateMoney(1)).toBe('$1.00');
        expect(abbreviateMoney(202.09)).toBe('$202.09');
        expect(abbreviateMoney(1234.5)).toBe('$1,234.50');
        expect(abbreviateMoney(999999.99)).toBe('$999,999.99');
    });

    it('abbreviates from a million up', () => {
        expect(abbreviateMoney(ABBREVIATE_ABOVE)).toBe('$1.000M');
        expect(abbreviateMoney(14148388242.73)).toBe('$14.148B');
        expect(abbreviateMoney(18696401451505.02)).toBe('$18.696T');
        expect(abbreviateMoney(1.5e15)).toBe('$1.500Qa');
        // 9.99e20 is just under a sextillion, so it is 999 quintillion.
        expect(abbreviateMoney(9.99e20)).toBe('$999.000Qi');
        expect(abbreviateMoney(1e21)).toBe('$1.000Sx');
    });

    it('never gets long enough to run off a narrow screen', () => {
        // The real failure was a figure wider than the viewport, so the
        // property that matters is length, not any single formatting choice.
        const growing = Array.from({ length: 40 }, (unused, i) => 10 ** i);
        growing.forEach((value) => {
            expect(abbreviateMoney(value).length).toBeLessThanOrEqual(14);
        });
    });

    it('keeps a digit moving so the printer looks alive', () => {
        // A rate that would be invisible at two decimals must still show.
        expect(abbreviateMoney(14148388242)).not.toBe(
            abbreviateMoney(14148388242 + 1_000_000)
        );
    });

    it('falls back to exponent form rather than inventing units', () => {
        expect(abbreviateMoney(1e36)).toMatch(/e\+36/);
    });

    it('survives nonsense without rendering NaN at people', () => {
        expect(abbreviateMoney(undefined)).toBe('$0.00');
        expect(abbreviateMoney(NaN)).toBe('$0.00');
        expect(abbreviateMoney(Infinity)).toBe('$0.00');
    });

    it('handles negatives, which a fine or a clawback could produce', () => {
        expect(abbreviateMoney(-500)).toBe('-$500.00');
        expect(abbreviateMoney(-2.5e9)).toBe('-$2.500B');
    });
});
