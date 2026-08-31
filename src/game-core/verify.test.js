import {
    verifyLog,
    REJECTIONS,
    ACTION_PRINT,
    ACTION_BUY,
    MAX_ACTIONS_PER_TICK
} from './verify';
import { createRecorder } from './recorder';
import { CORE_VERSION } from './version';
import { SESSION_SECONDS, END_DURATION, END_IDLE } from './session';
import { printMoney, purchaseProduct } from './actions';

const log = (actions, extra = {}) => ({
    coreVersion: CORE_VERSION,
    sessionId: 's1',
    startedAt: 1_000_000,
    submittedAt: 1_000_000 + SESSION_SECONDS * 1000,
    actions,
    ...extra
});

/** One print per second for `n` seconds. */
const steadyClicks = (n) =>
    Array.from({ length: n }, (_, i) => [i, ACTION_PRINT]);

describe('an honest log', () => {
    it('scores what the player actually printed', () => {
        const result = verifyLog(log(steadyClicks(30)));
        expect(result.ok).toBe(true);
        expect(result.problems).toEqual([]);
        expect(result.score).toBe(30);
    });

    it('credits a purchase and the rate it buys', () => {
        const actions = [...steadyClicks(9), [9, ACTION_BUY, 'Rubber Stamp']];
        const result = verifyLog(log(actions));

        expect(result.ok).toBe(true);
        expect(result.state.store[0].count).toBe(1);
        // 9 printed, then the stamp earns 2/sec until the idle timeout closes it
        expect(result.score).toBeGreaterThan(9);
    });

    it('closes on the idle timeout when the player stops', () => {
        const result = verifyLog(log(steadyClicks(5)));
        expect(result.endedReason).toBe(END_IDLE);
    });

    it('closes on the duration cap for a full session', () => {
        const actions = Array.from(
            { length: SESSION_SECONDS },
            (_, i) => [i, ACTION_PRINT]
        );
        const result = verifyLog(log(actions));
        expect(result.endedReason).toBe(END_DURATION);
        expect(result.ticks).toBe(SESSION_SECONDS);
    });
});

describe('forged logs', () => {
    it('ignores an amount the client tried to supply', () => {
        // A tampered client sending a huge denomination still scores one.
        const sneaky = log([[0, ACTION_PRINT, 1_000_000_000]]);
        expect(verifyLog(sneaky).score).toBe(1);
    });

    it('cannot buy something it cannot afford', () => {
        const result = verifyLog(log([[0, ACTION_BUY, 'Tech Company']]));
        expect(result.ok).toBe(true);
        expect(result.score).toBe(0);
        expect(result.state.printRate).toBe(0);
    });

    it('cannot buy an item that was never revealed', () => {
        const rich = [...steadyClicks(200), [200, ACTION_BUY, 'Insurance Fraud']];
        const result = verifyLog(log(rich));
        expect(result.state.store.find((i) => i.name === 'Insurance Fraud').count).toBe(0);
    });

    it('cannot invent an item', () => {
        const result = verifyLog(log([[0, ACTION_BUY, 'Helicopter Drop']]));
        expect(result.score).toBe(0);
    });

    it('rejects ticks beyond the session cap', () => {
        const result = verifyLog(log([[SESSION_SECONDS + 1, ACTION_PRINT]]));
        expect(result.ok).toBe(false);
        expect(result.problems).toContain(REJECTIONS.TICK_RANGE);
    });

    it('rejects ticks that go backwards', () => {
        const result = verifyLog(
            log([[10, ACTION_PRINT], [4, ACTION_PRINT]])
        );
        expect(result.ok).toBe(false);
        expect(result.problems).toContain(REJECTIONS.TICK_ORDER);
    });

    it('rejects an inhuman click rate', () => {
        const spam = Array.from(
            { length: MAX_ACTIONS_PER_TICK + 5 },
            () => [3, ACTION_PRINT]
        );
        const result = verifyLog(log(spam));
        expect(result.ok).toBe(false);
        expect(result.problems).toContain(REJECTIONS.RATE);
    });

    it('rejects a session shorter in real time than it claims', () => {
        const result = verifyLog(
            log(steadyClicks(600), {
                startedAt: 1_000_000,
                submittedAt: 1_000_000 + 5_000 // 5 real seconds for 600 ticks
            })
        );
        expect(result.ok).toBe(false);
        expect(result.problems).toContain(REJECTIONS.TOO_FAST);
    });

    it('rejects a log recorded under different rules', () => {
        const result = verifyLog(
            log(steadyClicks(10), { coreVersion: CORE_VERSION - 1 })
        );
        expect(result.ok).toBe(false);
        expect(result.problems).toContain(REJECTIONS.VERSION);
    });

    it('rejects unknown action kinds', () => {
        const result = verifyLog(log([[0, 'mint-me-a-billion']]));
        expect(result.ok).toBe(false);
        expect(result.problems).toContain(REJECTIONS.UNKNOWN_ACTION);
    });

    it('rejects a malformed entry', () => {
        expect(verifyLog(log([[0]])).problems).toContain(REJECTIONS.SHAPE);
        expect(verifyLog(log(['nope'])).problems).toContain(REJECTIONS.SHAPE);
        expect(verifyLog({ coreVersion: CORE_VERSION }).problems).toContain(
            REJECTIONS.SHAPE
        );
    });

    it('gains nothing from actions appended after the session closed', () => {
        const honest = steadyClicks(30);
        const padded = [
            ...honest,
            ...Array.from({ length: 500 }, (_, i) => [
                Math.min(SESSION_SECONDS, 400 + i),
                ACTION_PRINT
            ])
        ];
        // The idle timeout closes the honest run long before tick 400.
        expect(verifyLog(log(padded)).score).toBe(verifyLog(log(honest)).score);
    });
});

describe('the recorder', () => {
    it('produces a log the verifier agrees with', () => {
        const recorder = createRecorder({
            sessionId: 's1',
            startedAt: 1_000_000
        });

        // Mirror a real run: nine clicks, then buy the stamp.
        for (let tick = 0; tick < 9; tick += 1) {
            recorder.record(printMoney(1), tick);
        }
        recorder.record(purchaseProduct('Rubber Stamp'), 9);

        const produced = recorder.toLog(1_000_000 + 60_000);
        const result = verifyLog(produced);

        expect(result.ok).toBe(true);
        expect(result.state.store[0].count).toBe(1);
        expect(recorder.length).toBe(10);
    });

    it('records no amount for a print', () => {
        const recorder = createRecorder({ sessionId: 's', startedAt: 0 });
        recorder.record(printMoney(999), 0);
        expect(recorder.toLog(1000).actions[0]).toEqual([0, ACTION_PRINT]);
    });

    it('ignores ticks and anything else it is handed', () => {
        const recorder = createRecorder({ sessionId: 's', startedAt: 0 });
        recorder.record({ type: 'thefed/game/INCREMENT_TIMER' }, 1);
        recorder.record({ type: 'some/other/ACTION' }, 2);
        expect(recorder.length).toBe(0);
    });

    it('stamps the log with the core version', () => {
        const recorder = createRecorder({ sessionId: 's', startedAt: 0 });
        expect(recorder.toLog(1).coreVersion).toBe(CORE_VERSION);
    });
});
