import { createRecorder } from '../../game-core/recorder';
import { START_GAME, END_GAME } from '../../game-core';

/**
 * Captures the replay log for the session being played.
 *
 * The log lives here rather than in the store because it is evidence about a
 * session, not part of its state: putting it in the reducer would make the core
 * impure and would persist a growing array to localStorage for no reason.
 *
 * An action is stamped with the tick it happened on, which is the game clock
 * *before* the reducer runs — the same instant the verifier applies it when
 * replaying.
 */
let recorder = null;

export const currentRecorder = () => recorder;

export const currentLog = () => (recorder ? recorder.toLog(Date.now()) : null);

export const resetRecorder = () => {
    recorder = null;
};

/**
 * Did the reducer actually accept this? An accepted print raises the lifetime
 * total; an accepted purchase raises the print rate. A rejected one — too
 * expensive, not unlocked, session already closed — changes neither.
 *
 * Comparing values rather than object identity because redux-persist wraps the
 * reducer and does not preserve references.
 */
const wasAccepted = (before, after) =>
    after.totalPrinted > before.totalPrinted || after.printRate > before.printRate;

const recording = (store) => (next) => (action) => {
    if (action.type === START_GAME) {
        const result = next(action);
        // The session id is assigned by the reducer, so read it afterwards.
        recorder = createRecorder({
            sessionId: store.getState().game.id,
            startedAt: Date.now()
        });
        return result;
    }

    if (action.type === END_GAME) {
        recorder = null;
        return next(action);
    }

    if (!recorder) return next(action);

    const before = store.getState().game;
    const result = next(action);
    const after = store.getState().game;

    // The recorder itself ignores anything that is not a print or a purchase,
    // so ticks fall away here without needing to be named.
    if (after.time === before.time && wasAccepted(before, after)) {
        recorder.record(action, before.time);
    }

    return result;
};

export default recording;
