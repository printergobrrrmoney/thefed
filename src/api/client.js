/**
 * Talking to the game's own API.
 *
 * The session token is held in memory rather than localStorage: it is only
 * needed for as long as a tab is open, and not persisting it means a shared or
 * borrowed machine does not leave a signed-in wallet behind.
 */
let token = null;

export const setToken = (value) => {
    token = value;
};

export const getToken = () => token;

export const clearToken = () => {
    token = null;
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
            ...(token ? { Authorization: `Bearer ${token}` } : {})
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
