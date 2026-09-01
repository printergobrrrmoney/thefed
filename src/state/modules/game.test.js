import game, { setPlayer } from './game';
import {
    closeSession,
    printMoney,
    incrementTimer,
    isSessionOver,
    END_RESIGNED,
    START_GAME,
    END_GAME
} from '../../game-core';

const started = () => {
    let s = game(undefined, setPlayer({ name: { first: 'Jay', last: 'Powell' } }));
    return game(s, { type: START_GAME });
};

describe('the app reducer delegates to the core', () => {
    it('closes a session when asked to resign', () => {
        const playing = game(started(), printMoney(1));
        const closed = game(playing, closeSession(END_RESIGNED));

        expect(isSessionOver(closed)).toBe(true);
        expect(closed.endedReason).toBe(END_RESIGNED);
    });

    it('stops earning once resigned', () => {
        const closed = game(game(started(), printMoney(1)), closeSession(END_RESIGNED));
        const after = game(game(closed, printMoney(1)), incrementTimer());

        expect(after.totalPrinted).toBe(closed.totalPrinted);
        expect(after.time).toBe(closed.time);
    });

    it('still records prints and keeps the artwork on store items', () => {
        const played = game(started(), printMoney(1));
        expect(played.totalPrinted).toBe(1);
        expect(played.store[0].image).toBeDefined();
    });

    it('resets on END_GAME', () => {
        const closed = game(game(started(), printMoney(5)), closeSession(END_RESIGNED));
        const reset = game(closed, { type: END_GAME });
        expect(reset.totalPrinted).toBe(0);
        expect(isSessionOver(reset)).toBe(false);
    });
});
