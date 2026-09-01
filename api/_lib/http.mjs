/** Small helpers so each handler reads as its own logic, not plumbing. */

export const json = (res, status, body) => {
    res.status(status).setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(body));
};

export const badRequest = (res, error, extra = {}) =>
    json(res, 400, { error, ...extra });

export const unauthorized = (res, error = 'unauthorized') =>
    json(res, 401, { error });

export const methodNotAllowed = (res, allowed) => {
    res.setHeader('Allow', allowed.join(', '));
    return json(res, 405, { error: 'method-not-allowed' });
};

/** Vercel parses JSON bodies, but be tolerant of a raw string. */
export const readBody = (req) => {
    if (!req.body) return {};
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch (error) {
            return {};
        }
    }
    return req.body;
};

export const domainOf = (req) =>
    process.env.PUBLIC_DOMAIN ||
    (req.headers && req.headers.host) ||
    'game.printergobrrr.money';
