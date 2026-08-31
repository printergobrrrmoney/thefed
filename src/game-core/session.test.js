import { createInitialState, reducer, applyLog } from './reducer';
import {
    incrementTimer,
    printMoney,
    purchaseProduct,
    closeSession
} from './actions';
import {
    SESSION_SECONDS,
    IDLE_SECONDS,
    END_DURATION,
    END_IDLE,
    END_RESIGNED,
    isSessionOver,
    secondsRemaining
} from './session';

const ticks = (n) => new Array(n).fill(incrementTimer());
const clicks = (n) => new Array(n).fill(printMoney(1));

// Keep acting so the idle timeout never fires while testing the duration cap.
// The cadence is derived from IDLE_SECONDS so retuning the limits cannot
// silently turn these into idle-timeout tests.
const busyTicks = (n) => {
    const every = Math.max(1, Math.floor(IDLE_SECONDS / 2));
    const log = [];
    for (let i = 0; i < n; i += 1) {
        log.push(incrementTimer());
        if (i % every === 0) log.push(printMoney(1));
    }
    return log;
};

describe('duration cap', () => {
    it('runs right up to the cap', () => {
        const state = applyLog(busyTicks(SESSION_SECONDS - 1));
        expect(isSessionOver(state)).toBe(false);
        expect(secondsRemaining(state)).toBe(1);
    });

    it('closes exactly at the cap', () => {
        const state = applyLog(busyTicks(SESSION_SECONDS));
        expect(isSessionOver(state)).toBe(true);
        expect(state.endedReason).toBe(END_DURATION);
        expect(state.endedAt).toBe(SESSION_SECONDS);
    });

    it('cannot be run past the cap', () => {
        const atCap = applyLog(busyTicks(SESSION_SECONDS));
        const padded = applyLog(busyTicks(600), atCap);
        expect(padded.time).toBe(SESSION_SECONDS);
        expect(padded.totalPrinted).toBe(atCap.totalPrinted);
    });
});

describe('idle timeout', () => {
    it('survives right up to the limit', () => {
        const state = applyLog(ticks(IDLE_SECONDS - 1));
        expect(isSessionOver(state)).toBe(false);
    });

    it('closes once nothing has happened for the limit', () => {
        const state = applyLog(ticks(IDLE_SECONDS));
        expect(isSessionOver(state)).toBe(true);
        expect(state.endedReason).toBe(END_IDLE);
    });

    it('is reset by printing', () => {
        const almost = applyLog(ticks(IDLE_SECONDS - 1));
        const acted = reducer(almost, printMoney(1));
        const later = applyLog(ticks(IDLE_SECONDS - 1), acted);
        expect(isSessionOver(later)).toBe(false);
    });

    it('is reset by a purchase', () => {
        const funded = applyLog(clicks(9));
        const bought = reducer(funded, purchaseProduct('Rubber Stamp'));
        expect(bought.lastActionAt).toBe(bought.time);

        const later = applyLog(ticks(IDLE_SECONDS - 1), bought);
        expect(isSessionOver(later)).toBe(false);
    });

    it('is not reset by a purchase that was rejected', () => {
        const broke = applyLog(ticks(10));
        const rejected = reducer(broke, purchaseProduct('Tech Company'));
        expect(rejected.lastActionAt).toBe(0);
    });
});

describe('a closed session accepts nothing further', () => {
    const closed = reducer(applyLog(clicks(20)), closeSession(END_RESIGNED));

    it('records why it closed', () => {
        expect(closed.endedReason).toBe(END_RESIGNED);
        expect(closed.endedAt).toBe(closed.time);
    });

    it('ignores further printing', () => {
        expect(reducer(closed, printMoney(1000))).toBe(closed);
    });

    it('ignores further ticks', () => {
        expect(applyLog(ticks(50), closed)).toBe(closed);
    });

    it('ignores further purchases', () => {
        const rich = { ...closed, money: 1000000 };
        expect(reducer(rich, purchaseProduct('Rubber Stamp'))).toBe(rich);
    });

    it('preserves the final score for the summary', () => {
        expect(closed.totalPrinted).toBe(20);
    });
});

describe('replay integrity', () => {
    it('gives a padded log the same score as an honest one', () => {
        const honest = busyTicks(SESSION_SECONDS);
        const padded = [...honest, ...clicks(5000), ...busyTicks(5000)];
        expect(applyLog(padded).totalPrinted).toBe(
            applyLog(honest).totalPrinted
        );
    });

    it('still ends deterministically for an identical log', () => {
        const log = [...clicks(30), ...ticks(IDLE_SECONDS)];
        expect(applyLog(log)).toEqual(applyLog(log));
    });
});
