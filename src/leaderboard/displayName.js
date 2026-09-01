/**
 * Display name rules.
 *
 * A public leaderboard is a free advertising channel pointed at exactly the
 * audience phishers want, so the dangerous input here is not rudeness — it is a
 * URL, or a name impersonating something official. Both are checked, and names
 * are rendered as plain text, never as links.
 *
 * Shared by the browser and the server: the browser uses it to give immediate
 * feedback, the server uses it because the browser's opinion does not count.
 */
export const MIN_LENGTH = 2;
export const MAX_LENGTH = 20;

export const REASONS = {
    TOO_SHORT: 'too-short',
    TOO_LONG: 'too-long',
    CHARACTERS: 'unsupported-characters',
    LINK: 'looks-like-a-link',
    IMPERSONATION: 'reserved-word'
};

export const MESSAGES = {
    [REASONS.TOO_SHORT]: `At least ${MIN_LENGTH} characters.`,
    [REASONS.TOO_LONG]: `At most ${MAX_LENGTH} characters.`,
    [REASONS.CHARACTERS]: 'Letters, numbers, spaces, hyphens and underscores only.',
    [REASONS.LINK]: 'Names cannot contain web addresses.',
    [REASONS.IMPERSONATION]: 'That name is reserved.'
};

/**
 * Deliberately a strict allow-list rather than a block-list of bad characters.
 * It also rules out homoglyph attacks — a Cyrillic "а" cannot pass, so nobody
 * can impersonate an existing player with a lookalike name.
 */
const ALLOWED = /^[A-Za-z0-9 _-]+$/;

const LINKISH = /(https?:|www\.|\.com|\.io|\.xyz|\.money|\.net|\.org|\.app|\.co\b)/i;

/** Names that would let someone pose as the project or its staff. */
const RESERVED = [
    'brrr',
    'admin',
    'administrator',
    'moderator',
    'mod',
    'official',
    'support',
    'team',
    'staff',
    'system',
    'thefed',
    'the fed',
    'printergobrrr',
    'null',
    'undefined'
];

export const normalise = (value) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

export const nameProblem = (value) => {
    const name = normalise(value);

    if (name.length < MIN_LENGTH) return REASONS.TOO_SHORT;
    if (name.length > MAX_LENGTH) return REASONS.TOO_LONG;
    if (LINKISH.test(name)) return REASONS.LINK;
    if (!ALLOWED.test(name)) return REASONS.CHARACTERS;

    const flattened = name.toLowerCase().replace(/[\s_-]/g, '');
    if (RESERVED.some((word) => flattened === word.replace(/\s/g, ''))) {
        return REASONS.IMPERSONATION;
    }

    return null;
};

export const isValidName = (value) => nameProblem(value) === null;
