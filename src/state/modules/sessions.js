/**
 * How many sessions a player has started today.
 *
 * This is deliberately app-level rather than part of the game core: it spans
 * sessions, and it depends on the calendar, which the core must not.
 *
 * It is also, for now, only a pacing mechanism. It lives in localStorage, so a
 * determined player can reset it — that is expected. The authoritative daily
 * limit arrives with wallets and the server in phase 3; this exists so the
 * game's rhythm can be designed and felt while nothing is at stake.
 */
export const MAX_SESSIONS_PER_DAY = 3;

const RECORD_SESSION = 'thefed/sessions/RECORD_SESSION';

export const today = () => new Date().toISOString().slice(0, 10);

const initialState = {
    day: null,
    count: 0
};

export default (state = initialState, action = {}) => {
    switch (action.type) {
        case RECORD_SESSION:
            return state.day === action.day
                ? { day: action.day, count: state.count + 1 }
                : { day: action.day, count: 1 };
        default:
            return state;
    }
};

export const recordSession = () => ({ type: RECORD_SESSION, day: today() });

// Read against the current date rather than trusting the stored count, so a
// tally left over from yesterday reads as zero without needing to be cleared.
export const sessionsUsedToday = ({ sessions }) =>
    sessions.day === today() ? sessions.count : 0;

export const sessionsRemaining = (state) =>
    Math.max(0, MAX_SESSIONS_PER_DAY - sessionsUsedToday(state));
