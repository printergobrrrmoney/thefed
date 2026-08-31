import { createStore, applyMiddleware } from 'redux';
import { combineReducers } from 'redux';
import recording, { currentLog, currentRecorder, resetRecorder } from './recording';
import game, { setPlayer, endGame } from '../modules/game';
import { printMoney, purchaseProduct, incrementTimer } from '../../game-core';
import { verifyLog } from '../../game-core/verify';
import { isSessionOver } from '../../game-core';

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

beforeEach(() => resetRecorder());

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

        for (let i = 0; i < 9; i += 1) store.dispatch(printMoney(1));
        store.dispatch(purchaseProduct('Rubber Stamp'));

        const actions = currentLog().actions;
        expect(actions[actions.length - 1]).toEqual([0, 'b', 'Rubber Stamp']);
    });

    it('does not record a purchase the player could not afford', () => {
        const store = makeStore();
        start(store);

        store.dispatch(printMoney(1));
        store.dispatch(purchaseProduct('Rubber Stamp')); // costs 9

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

        for (let i = 0; i < 9; i += 1) store.dispatch(printMoney(1));
        store.dispatch(purchaseProduct('Rubber Stamp'));
        for (let i = 0; i < 30; i += 1) store.dispatch(incrementTimer());
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
