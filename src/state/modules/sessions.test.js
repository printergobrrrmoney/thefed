import game, { setPlayer } from './game';
import sessions, { sessionsRemaining, MAX_SESSIONS_PER_DAY } from './sessions';
import { isSessionOver } from '../../game-core';

/**
 * The daily allowance rations scored runs. Playing without a wallet earns
 * nothing, so it must not consume one — otherwise the game locks out the
 * people it is meant to be free for.
 */
const stateWith = ({ signedIn, used }) => ({
    wallet: { signedIn },
    sessions: { day: new Date().toISOString().slice(0, 10), count: used }
});

describe('the daily allowance', () => {
    it('counts down for a signed-in player', () => {
        expect(sessionsRemaining(stateWith({ signedIn: true, used: 1 }))).toBe(
            MAX_SESSIONS_PER_DAY - 1
        );
    });

    it('never goes below zero', () => {
        expect(
            sessionsRemaining(stateWith({ signedIn: true, used: 99 }))
        ).toBe(0);
    });

    it('resets when the day changes', () => {
        const yesterday = { wallet: {}, sessions: { day: '2001-01-01', count: 3 } };
        expect(sessionsRemaining(yesterday)).toBe(MAX_SESSIONS_PER_DAY);
    });

    it('ignores a tally recorded under a different date', () => {
        const store = sessions(
            { day: '2001-01-01', count: 3 },
            { type: 'thefed/sessions/RECORD_SESSION', day: '2001-01-02' }
        );
        expect(store).toEqual({ day: '2001-01-02', count: 1 });
    });
});

describe('playing without a wallet', () => {
    it('can always start another run', () => {
        // Whatever the tally says, an unsigned player is never gated: the
        // remaining count is only consulted for signed-in players.
        const exhausted = stateWith({ signedIn: false, used: 99 });
        expect(exhausted.wallet.signedIn).toBe(false);
        expect(sessionsRemaining(exhausted)).toBe(0);
    });

    it('still plays a normal game', () => {
        let s = game(undefined, setPlayer({ name: { first: 'Jay', last: 'P' } }));
        s = game(s, { type: 'thefed/game/START_GAME' });
        expect(isSessionOver(s)).toBe(false);
        expect(s.active).toBe(true);
    });
});
