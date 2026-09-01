import {
    POOL,
    DAILY_CEILING,
    BASE_DAILY_CAP,
    LIFETIME_WALLET_CAP,
    earlyMultiplier,
    tierFor,
    dailyCapFor,
    pointsFor,
    playersToExhaust,
    allocateDay,
    dayOfSchedule
} from './index';

describe('the schedule', () => {
    it('spends the pool over exactly a year', () => {
        expect(DAILY_CEILING * 365).toBeCloseTo(POOL, 6);
    });

    it('reserves 30% of supply', () => {
        expect(POOL).toBe(300_000_000);
    });

    it('caps any one wallet at a thousandth of the pool for life', () => {
        expect(LIFETIME_WALLET_CAP).toBe(300_000);
    });
});

describe('the early multiplier', () => {
    it('starts near 3x and decays towards 1x', () => {
        expect(earlyMultiplier(1)).toBeCloseTo(3, 2);
        expect(earlyMultiplier(46)).toBeCloseTo(2, 2);
        expect(earlyMultiplier(91)).toBeCloseTo(1.5, 2);
        expect(earlyMultiplier(365)).toBeLessThan(1.02);
    });

    it('never drops below 1x', () => {
        expect(earlyMultiplier(10_000)).toBeGreaterThanOrEqual(1);
    });

    it('cannot be banked by registering early', () => {
        // It reads the day of the run, not when a wallet first appeared.
        expect(earlyMultiplier(200)).toBeLessThan(earlyMultiplier(2));
    });
});

describe('holder tiers', () => {
    it('picks the highest tier a balance qualifies for', () => {
        expect(tierFor(0).name).toBe('Base');
        expect(tierFor(4_999).name).toBe('Base');
        expect(tierFor(5_000).name).toBe('Holder');
        expect(tierFor(1_000_000).name).toBe('Chair');
    });

    it('scales the daily cap', () => {
        const day = 91; // 1.5x early
        expect(dailyCapFor(day, 0)).toBeCloseTo(BASE_DAILY_CAP * 1.5, 4);
        expect(dailyCapFor(day, 500_000)).toBeCloseTo(
            BASE_DAILY_CAP * 1.5 * 2.5,
            4
        );
    });
});

describe('allocating a day', () => {
    const entry = (address, score, balance = 0) => ({ address, score, balance });

    it('burns the whole ceiling when nobody played', () => {
        const result = allocateDay([], 100);
        expect(result.paid).toBe(0);
        expect(result.burned).toBeCloseTo(DAILY_CEILING, 6);
    });

    it('never pays a wallet more than its cap', () => {
        // One player cannot take the day, however well they did.
        const result = allocateDay([entry('solo', 1e15)], 100);
        expect(result.awards[0].amount).toBeCloseTo(dailyCapFor(100, 0), 6);
        expect(result.burned).toBeGreaterThan(0);
    });

    it('burns what a thin day does not earn', () => {
        const result = allocateDay(
            [entry('a', 1e6), entry('b', 1e6)],
            100
        );
        expect(result.paid + result.burned).toBeCloseTo(DAILY_CEILING, 6);
        expect(result.burned).toBeGreaterThan(result.paid);
    });

    it('never pays out more than the ceiling', () => {
        const many = Array.from({ length: 5_000 }, (_, i) =>
            entry(`w${i}`, 1e9)
        );
        const result = allocateDay(many, 200);
        expect(result.paid).toBeLessThanOrEqual(DAILY_CEILING + 1e-6);
    });

    it('gives a farm of empty wallets only the base rate', () => {
        const farm = Array.from({ length: 50 }, (_, i) => entry(`f${i}`, 1e6));
        const result = allocateDay(farm, 1);
        const take = result.awards.reduce((sum, a) => sum + a.amount, 0);
        // Day one, capped: a fraction of the day rather than most of it.
        expect(take / DAILY_CEILING).toBeLessThan(0.12);
    });

    it('separates players by score once the day is competitive', () => {
        // Enough players that the pro-rata share falls below the cap, which is
        // the only condition under which score decides anything.
        const crowd = Array.from({ length: 3_000 }, (_, i) => entry(`w${i}`, 1e6));
        const result = allocateDay(
            [...crowd, entry('big', 1e15), entry('small', 10)],
            200
        );
        const big = result.awards.find((a) => a.address === 'big');
        const small = result.awards.find((a) => a.address === 'small');
        expect(big.amount).toBeGreaterThan(small.amount);
    });

    it('pays everyone their cap when the day is quiet, whatever they scored', () => {
        // A property of the design rather than an accident: below the turnout
        // that exhausts the ceiling, showing up earns the cap and the score
        // only decides the leaderboard. Most of the day is burned.
        const result = allocateDay([entry('big', 1e15), entry('small', 10)], 200);
        const [a, b] = result.awards;
        expect(a.amount).toBeCloseTo(b.amount, 6);
        expect(a.amount).toBeCloseTo(dailyCapFor(200, 0), 6);
        expect(result.burned / DAILY_CEILING).toBeGreaterThan(0.99);
    });
});

describe('helpers', () => {
    it('compresses exponential scores', () => {
        expect(pointsFor(1e15)).toBeCloseTo(15, 3);
        expect(pointsFor(1e6)).toBeCloseTo(6, 3);
        expect(pointsFor(0)).toBe(0);
    });

    it('says how many players a day needs to avoid burning', () => {
        expect(playersToExhaust(1)).toBeGreaterThan(0);
        expect(playersToExhaust(365)).toBeGreaterThan(playersToExhaust(1));
    });

    it('counts the first day as day one', () => {
        expect(
            dayOfSchedule('2026-09-01', new Date('2026-09-01T12:00:00Z'))
        ).toBe(1);
        expect(
            dayOfSchedule('2026-09-01', new Date('2026-09-11T12:00:00Z'))
        ).toBe(11);
    });
});
