/**
 * Talking to the game's own API.
 *
 * The session token lives in sessionStorage, not localStorage. That is
 * deliberate on both counts: it survives a reload, so refreshing mid-run does
 * not silently cost a player their session, but it dies with the tab, so a
 * shared or borrowed machine is not left signed in.
 *
 * Trusting storage for this is safe. The token is HMAC-signed and checked by
 * the server on every request, so an edited one simply fails.
 */
export const TOKEN_KEY = 'thefed:token';

let token = null;

const storage = () => {
    try {
        return typeof window !== 'undefined' ? window.sessionStorage : null;
    } catch (error) {
        // Private browsing and blocked storage both throw on access.
        return null;
    }
};

export const setToken = (value) => {
    token = value;
    const store = storage();
    if (!store) return;
    try {
        if (value) store.setItem(TOKEN_KEY, value);
        else store.removeItem(TOKEN_KEY);
    } catch (error) {
        // Without storage the token simply will not survive a reload.
    }
};

export const getToken = () => {
    if (token) return token;
    const store = storage();
    if (!store) return null;
    try {
        token = store.getItem(TOKEN_KEY);
    } catch (error) {
        token = null;
    }
    return token;
};

export const clearToken = () => {
    setToken(null);
    const store = storage();
    if (!store) return;
    try {
        store.removeItem('thefed:session');
    } catch (error) {
        // Nothing useful to do.
    }
};

export class ApiError extends Error {
    constructor(status, body) {
        super((body && body.error) || `Request failed (${status})`);
        this.status = status;
        this.code = (body && body.error) || 'request-failed';
        this.details = body || {};
    }
}

const request = async (path, { method = 'GET', body } = {}) => {
    const response = await fetch(`/api${path}`, {
        method,
        headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    });

    let payload = null;
    try {
        payload = await response.json();
    } catch (error) {
        payload = null;
    }

    if (!response.ok) throw new ApiError(response.status, payload);
    return payload;
};

export const requestNonce = (address) =>
    request('/auth/nonce', { method: 'POST', body: { address } });

export const verifySignature = ({ address, message, signature }) =>
    request('/auth/verify', {
        method: 'POST',
        body: { address, message, signature }
    });

export const startSession = () => request('/session/start', { method: 'POST' });

export const submitSession = ({ sessionId, log }) =>
    request('/session/submit', { method: 'POST', body: { sessionId, log } });

export const fetchLeaderboard = (limit = 25) =>
    request(`/leaderboard?limit=${limit}`);

export const setDisplayName = (displayName) =>
    request('/player/name', { method: 'POST', body: { displayName } });

/**
 * Just enough about a signed-in player to rebuild the UI after a reload — the
 * wallet used, the address, the chosen name. Nothing here is trusted: the token
 * stored alongside it is what the server actually checks.
 */
const SESSION_KEY = 'thefed:session';

export const rememberSession = (patch) => {
    const store = storage();
    if (!store) return;
    try {
        const current = rememberedSession() || {};
        store.setItem(SESSION_KEY, JSON.stringify({ ...current, ...patch }));
    } catch (error) {
        // Without storage the player simply signs in again after a reload.
    }
};

export const rememberedSession = () => {
    const store = storage();
    if (!store) return null;
    try {
        const raw = store.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
};
