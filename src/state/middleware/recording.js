import { createRecorder } from '../../game-core/recorder';
import { START_GAME, END_GAME } from '../../game-core';

/**
 * Captures the replay log for the session being played.
 *
 * The log lives here rather than in the store because it is evidence about a
 * session, not part of its state: putting it in the reducer would make the core
 * impure and would persist a growing array through redux-persist for no reason.
 *
 * It is written to storage after every action so a reload does not lose the
 * run. Nothing is protected by keeping it in memory — the server replays the
 * log, so a player who edits it only changes what the rules will award them.
 * Losing it, on the other hand, costs an honest player their session and a day's
 * allowance, which the server has already counted.
 *
 * An action is stamped with the tick it happened on, which is the game clock
 * *before* the reducer runs — the same instant the verifier applies it when
 * replaying.
 */
export const STORAGE_KEY = 'thefed:log';

let recorder = null;

/**
 * The server's id for this session, which is not the same as the game's own.
 * The game assigns itself a uuid the moment a run starts; the server assigns
 * its own when the scored session opens, a request later. Submission needs the
 * server's, so it is stored alongside the log — otherwise a reload restores the
 * run and then submits it against an id the server has never heard of.
 */
let serverSessionId = null;

export const currentRecorder = () => recorder;

export const currentLog = () => (recorder ? recorder.toLog(Date.now()) : null);

const storage = () => {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null;
    } catch (error) {
        // Private browsing and blocked storage both throw on access.
        return null;
    }
};

const save = () => {
    const store = storage();
    if (!store || !recorder) return;
    try {
        store.setItem(
            STORAGE_KEY,
            JSON.stringify({
                sessionId: recorder.sessionId,
                serverSessionId,
                startedAt: recorder.startedAt,
                actions: recorder.toLog(Date.now()).actions
            })
        );
    } catch (error) {
        // A full quota should not end the run; the log simply stops surviving
        // a reload from here on.
    }
};

const forget = () => {
    recorder = null;
    serverSessionId = null;
    const store = storage();
    if (!store) return;
    try {
        store.removeItem(STORAGE_KEY);
    } catch (error) {
        // Nothing useful to do.
    }
};

export const resetRecorder = forget;

/** Reads back a log left by a previous page load, if there is one. */
export const readStoredLog = () => {
    const store = storage();
    if (!store) return null;
    try {
        const raw = store.getItem(STORAGE_KEY);
        if (!raw) return null;
        const saved = JSON.parse(raw);
        return saved && Array.isArray(saved.actions) ? saved : null;
    } catch (error) {
        return null;
    }
};

export const restoreRecorder = () => {
    const saved = readStoredLog();
    if (!saved) return null;
    recorder = createRecorder(saved);
    serverSessionId = saved.serverSessionId || null;
    return saved;
};

/** Called once the scored session exists, so a reload can still submit it. */
export const attachServerSession = (id) => {
    serverSessionId = id;
    save();
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
        serverSessionId = null;
        save();
        return result;
    }

    if (action.type === END_GAME) {
        forget();
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
        save();
    }

    return result;
};

export default recording;
