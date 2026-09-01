import * as api from '../../api/client';
import { currentLog, attachServerSession } from '../middleware/recording';

/**
 * Sending a finished session to be scored.
 *
 * The score shown during play is the browser's arithmetic and counts for
 * nothing. What matters is what comes back from here, which is the server's
 * own replay of the same log.
 */
const SUBMITTING = 'thefed/submission/SUBMITTING';
const SCORED = 'thefed/submission/SCORED';
const REJECTED = 'thefed/submission/REJECTED';
const FAILED = 'thefed/submission/FAILED';
const RESET = 'thefed/submission/RESET';
const SESSION_OPENED = 'thefed/submission/SESSION_OPENED';
const SESSION_RESTORED = 'thefed/submission/SESSION_RESTORED';

const initialState = {
    sessionId: null,
    submitting: false,
    score: null,
    best: null,
    problems: null,
    error: null
};

export default (state = initialState, action = {}) => {
    switch (action.type) {
        case SESSION_OPENED:
            return { ...initialState, sessionId: action.sessionId };
        case SESSION_RESTORED:
            return { ...initialState, sessionId: action.sessionId };
        case SUBMITTING:
            return { ...state, submitting: true, error: null, problems: null };
        case SCORED:
            return {
                ...state,
                submitting: false,
                score: action.score,
                best: action.best
            };
        case REJECTED:
            return { ...state, submitting: false, problems: action.problems };
        case FAILED:
            return { ...state, submitting: false, error: action.error };
        case RESET:
            return initialState;
        default:
            return state;
    }
};

const messages = {
    'daily-limit-reached': 'That is all your terms for today.',
    unauthorized: 'Sign in to have your score counted.',
    'already-submitted': 'This session was already scored.',
    'unknown-session': 'The server does not know this session.'
};

/**
 * Open a server-side session. Its start time is set there, so a log cannot
 * later claim to have run longer than real time allows.
 */
export const openSession = () => async (dispatch) => {
    try {
        const session = await api.startSession();
        attachServerSession(session.sessionId);
        dispatch({ type: SESSION_OPENED, sessionId: session.sessionId });
        return session;
    } catch (error) {
        dispatch({
            type: FAILED,
            error: messages[error.code] || 'Could not start a scored session.'
        });
        return null;
    }
};

export const submitSession = () => async (dispatch, getState) => {
    const { sessionId } = getState().submission;
    const log = currentLog();
    if (!sessionId || !log) return null;

    dispatch({ type: SUBMITTING });
    try {
        const result = await api.submitSession({ sessionId, log });
        dispatch({ type: SCORED, score: result.score, best: result.best });
        return result;
    } catch (error) {
        if (error.status === 422) {
            dispatch({ type: REJECTED, problems: error.details.problems || [] });
        } else {
            dispatch({
                type: FAILED,
                error: messages[error.code] || 'Could not submit this session.'
            });
        }
        return null;
    }
};

export const resetSubmission = () => ({ type: RESET });

/**
 * Reattach a session that was already open before a reload, so the run can
 * still be submitted rather than costing the player a day's allowance for
 * nothing.
 */
export const restoreSession = (sessionId) => ({
    type: SESSION_RESTORED,
    sessionId
});
