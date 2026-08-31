/**
 * Session limits.
 *
 * These live in the core rather than the UI on purpose. The core is what the
 * server replays, so a limit expressed here is enforced by verification for
 * free — a log that keeps printing past the cap simply does not produce those
 * earnings when replayed, whatever the client claims happened.
 *
 * Times are in game ticks, and a tick is one second.
 */
export const SESSION_SECONDS = 60 * 60;
export const IDLE_SECONDS = 5 * 60;

export const END_DURATION = 'duration';
export const END_IDLE = 'idle';
export const END_RESIGNED = 'resigned';

export const END_REASONS = {
    [END_DURATION]: {
        title: 'Term complete',
        detail: 'Your hour at the helm is up. The Board thanks you.'
    },
    [END_IDLE]: {
        title: 'Removed for absence',
        detail: 'The presses sat idle too long and the Board lost patience.'
    },
    [END_RESIGNED]: {
        title: 'Resigned',
        detail: 'You stepped down as Chair.'
    }
};

export const isSessionOver = (state) => state.endedAt !== null;

export const secondsRemaining = (state) =>
    Math.max(0, SESSION_SECONDS - state.time);

export const idleSecondsRemaining = (state) =>
    Math.max(0, IDLE_SECONDS - (state.time - state.lastActionAt));
