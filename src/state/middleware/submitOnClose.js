import { isSessionOver, hasLapsed, closeSession, END_ABANDONED } from '../../game-core';
import { submitSession, restoreSession } from '../modules/submission';
import { restoreSignIn } from '../modules/wallet';
import { restoreRecorder } from './recording';

/**
 * Submit a scored session the moment it closes.
 *
 * A session can end without anyone clicking anything — the duration cap and the
 * idle timeout both close it from inside a tick — so watching the transition is
 * the only way to catch every ending.
 *
 * Kept separate from the recording middleware to avoid an import cycle: the
 * submission module reads the recorded log, so the recorder must not depend on
 * it in turn.
 */
const submitOnClose = (store) => (next) => (action) => {
    // A reload leaves the game state rehydrated but the log and the server
    // session forgotten. Put both back, so a refresh mid-run costs nothing.
    if (action.type === 'persist/REHYDRATE' && action.key === 'game') {
        const result = next(action);
        // Sign-in first: without the token the restored session cannot be
        // submitted, and restoring the log alone would still lose the run.
        store.dispatch(restoreSignIn());
        const saved = restoreRecorder();

        // A term left running for hours is not still in progress. Close it
        // before anything else, so what gets submitted is the run as it
        // actually was rather than one that appears to still be going.
        if (
            saved &&
            !isSessionOver(store.getState().game) &&
            hasLapsed(saved.startedAt)
        ) {
            store.dispatch(closeSession(END_ABANDONED));
        }

        if (saved && saved.serverSessionId) {
            store.dispatch(restoreSession(saved.serverSessionId));
            // If it ended while the page was away, it still needs submitting.
            if (isSessionOver(store.getState().game)) {
                store.dispatch(submitSession());
            }
        }
        return result;
    }

    const before = store.getState().game;
    const result = next(action);
    const after = store.getState().game;

    const justClosed = !isSessionOver(before) && isSessionOver(after);
    if (justClosed && store.getState().submission.sessionId) {
        store.dispatch(submitSession());
    }

    return result;
};

export default submitOnClose;
