import { createStore, applyMiddleware } from 'redux';
import { combineReducers } from 'redux';
import recording, {
    currentLog,
    currentRecorder,
    resetRecorder,
    restoreRecorder,
    attachServerSession,
    STORAGE_KEY
} from './recording';
import game, { setPlayer, endGame } from '../modules/game';
import {
    printMoney,
    purchaseProduct,
    incrementTimer,
    isSessionOver,
    ITEMS
} from '../../game-core';
import { verifyLog } from '../../game-core/verify';

// The real game module dispatches a router push on start; a plain reducer with
// the same actions is enough to exercise the middleware.
const makeStore = () =>
    createStore(combineReducers({ game }), applyMiddleware(recording));

// The news feed reads the player's name each tick, so the real flow always
// sets a player before starting. Mirror that.
const start = (store) => {
    store.dispatch(setPlayer({ name: { first: 'Jay', last: 'Powell' } }));
    store.dispatch({ type: 'thefed/game/START_GAME' });
};

beforeEach(() => {
    resetRecorder();
    localStorage.clear();
});

/** A reload loses module state but not storage; this simulates only the first. */
const resetRecorderMemoryOnly = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    resetRecorder();
    if (saved !== null) localStorage.setItem(STORAGE_KEY, saved);
};

describe('recording', () => {
    it('does nothing before a session starts', () => {
        const store = makeStore();
        store.dispatch(printMoney(1));
        expect(currentRecorder()).toBeNull();
    });

    it('starts a recorder when a session starts', () => {
        const store = makeStore();
        start(store);
        expect(currentRecorder()).not.toBeNull();
        expect(currentLog().actions).toEqual([]);
    });

    it('records prints against the tick they happened on', () => {
        const store = makeStore();
        start(store);

        store.dispatch(printMoney(1));
        store.dispatch(incrementTimer());
        store.dispatch(printMoney(1));

        expect(currentLog().actions).toEqual([[0, 'p'], [1, 'p']]);
    });

    it('records an accepted purchase', () => {
        const store = makeStore();
        start(store);

        for (let i = 0; i < ITEMS[0].price; i += 1)
            store.dispatch(printMoney(1));
        store.dispatch(purchaseProduct('Rubber Stamp'));

        const actions = currentLog().actions;
        expect(actions[actions.length - 1]).toEqual([0, 'b', 'Rubber Stamp']);
    });

    it('does not record a purchase the player could not afford', () => {
        const store = makeStore();
        start(store);

        store.dispatch(printMoney(1));
        store.dispatch(purchaseProduct('Rubber Stamp')); // costs more than a single click

        expect(currentLog().actions).toEqual([[0, 'p']]);
    });

    it('does not record a rejected purchase even after an accepted action on the same tick', () => {
        const store = makeStore();
        start(store);

        // A print sets lastActionAt to this tick; a rejected purchase directly
        // afterwards must still not be recorded.
        store.dispatch(printMoney(1));
        store.dispatch(purchaseProduct('Tech Company'));

        expect(currentLog().actions).toEqual([[0, 'p']]);
    });

    it('does not record ticks', () => {
        const store = makeStore();
        start(store);
        for (let i = 0; i < 20; i += 1) store.dispatch(incrementTimer());
        expect(currentLog().actions).toEqual([]);
    });

    it('forgets the log when the game ends', () => {
        const store = makeStore();
        start(store);
        store.dispatch(printMoney(1));
        store.dispatch(endGame());
        expect(currentRecorder()).toBeNull();
        expect(currentLog()).toBeNull();
    });

    it('produces a log the verifier scores the same as the live game', () => {
        const store = makeStore();
        start(store);

        for (let i = 0; i < ITEMS[0].price; i += 1) {
            store.dispatch(printMoney(1));
            if ((i + 1) % 10 === 0) store.dispatch(incrementTimer());
        }
        store.dispatch(purchaseProduct('Rubber Stamp'));
        for (let i = 0; i < 20; i += 1) store.dispatch(incrementTimer());
        store.dispatch(printMoney(1));

        // The verifier plays a session out to its natural end, so idle earnings
        // after the last action count. Run the live game to the same point
        // before comparing, otherwise this compares two different moments.
        const log = currentLog();
        while (!isSessionOver(store.getState().game)) {
            store.dispatch(incrementTimer());
        }

        const live = store.getState().game;
        const replayed = verifyLog(log);

        expect(replayed.ok).toBe(true);
        expect(replayed.score).toBe(live.totalPrinted);
        expect(replayed.state.printRate).toBe(live.printRate);
        expect(replayed.endedReason).toBe(live.endedReason);
    });
});

describe('surviving a reload', () => {
    it('writes the log to storage as it goes', () => {
        const store = makeStore();
        start(store);
        store.dispatch(printMoney(1));

        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        expect(saved.actions).toEqual([[0, 'p']]);
        expect(saved.sessionId).toBeDefined();
    });

    it('restores the log a previous page load left behind', () => {
        const store = makeStore();
        start(store);
        store.dispatch(printMoney(1));
        store.dispatch(incrementTimer());
        store.dispatch(printMoney(1));
        const before = currentLog();

        // A reload: module state is gone, storage is not.
        resetRecorderMemoryOnly();
        expect(currentRecorder()).toBeNull();

        const saved = restoreRecorder();
        expect(saved.sessionId).toBe(before.sessionId);
        expect(currentLog().actions).toEqual(before.actions);
    });

    it('keeps recording into the restored log', () => {
        const store = makeStore();
        start(store);
        store.dispatch(printMoney(1));

        resetRecorderMemoryOnly();
        restoreRecorder();

        // The rehydrated game carries on from where it was.
        const resumed = makeStore();
        resumed.dispatch(setPlayer({ name: { first: 'Jay', last: 'Powell' } }));
        resumed.dispatch(printMoney(1));

        expect(currentLog().actions).toEqual([[0, 'p'], [0, 'p']]);
    });

    it('forgets the log when the game ends', () => {
        const store = makeStore();
        start(store);
        store.dispatch(printMoney(1));
        store.dispatch(endGame());

        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(restoreRecorder()).toBeNull();
    });

    it('starting a new session replaces the stored log', () => {
        const store = makeStore();
        start(store);
        store.dispatch(printMoney(1));
        const first = JSON.parse(localStorage.getItem(STORAGE_KEY)).sessionId;

        start(store);
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        expect(saved.sessionId).not.toBe(first);
        expect(saved.actions).toEqual([]);
    });

    it('survives storage being unavailable', () => {
        const real = window.localStorage;
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            get() {
                throw new Error('blocked');
            }
        });

        const store = makeStore();
        expect(() => {
            start(store);
            store.dispatch(printMoney(1));
        }).not.toThrow();
        expect(currentLog().actions).toEqual([[0, 'p']]);

        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            value: real
        });
    });
});

describe('the server session id', () => {
    it('is stored alongside the log once the scored session opens', () => {
        const store = makeStore();
        start(store);
        attachServerSession('server-side-uuid');

        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        expect(saved.serverSessionId).toBe('server-side-uuid');
        // The game's own id is a different thing and must not be confused for it.
        expect(saved.sessionId).not.toBe('server-side-uuid');
    });

    it('comes back on restore, so the run can still be submitted', () => {
        const store = makeStore();
        start(store);
        attachServerSession('server-side-uuid');
        store.dispatch(printMoney(1));

        resetRecorderMemoryOnly();
        expect(restoreRecorder().serverSessionId).toBe('server-side-uuid');
    });

    it('is absent for an unscored run', () => {
        const store = makeStore();
        start(store);
        store.dispatch(printMoney(1));

        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        expect(saved.serverSessionId).toBeNull();
    });

    it('does not carry over into the next session', () => {
        const store = makeStore();
        start(store);
        attachServerSession('first');
        start(store);

        expect(
            JSON.parse(localStorage.getItem(STORAGE_KEY)).serverSessionId
        ).toBeNull();
    });
});
