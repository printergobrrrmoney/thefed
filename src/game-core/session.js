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
export const END_ABANDONED = 'abandoned';

/**
 * Both limits above are counted in ticks, and ticks only advance while the page
 * is open — so closing the tab freezes a term rather than ending it. That is
 * fine for a refresh and wrong for walking away: a term left overnight would
 * still be running in the morning. This is the wall-clock backstop, checked on
 * load rather than in the reducer, which must stay a pure function of its
 * inputs and cannot read the clock.
 */
export const ABANDON_AFTER_SECONDS = SESSION_SECONDS + 30 * 60;

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
    },
    [END_ABANDONED]: {
        title: 'Term lapsed',
        detail: 'You left the building and the Board moved on without you.'
    }
};

export const isSessionOver = (state) => state.endedAt !== null;

/** Has a term been left running for longer than one could plausibly play it? */
export const hasLapsed = (startedAt, now = Date.now()) =>
    typeof startedAt === 'number' &&
    now - startedAt > ABANDON_AFTER_SECONDS * 1000;

export const secondsRemaining = (state) =>
    Math.max(0, SESSION_SECONDS - state.time);

export const idleSecondsRemaining = (state) =>
    Math.max(0, IDLE_SECONDS - (state.time - state.lastActionAt));
