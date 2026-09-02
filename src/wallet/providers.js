/**
 * Wallet detection, without a wallet library.
 *
 * The usual choice here is @solana/wallet-adapter, which pulls in
 * @solana/web3.js. That library ships syntax this toolchain cannot parse, but
 * more importantly it is not needed: signing in requires only `connect` and
 * `signMessage`, both of which injected wallets expose directly. Transactions
 * and RPC — the reason web3.js exists — are things this site deliberately never
 * does.
 *
 * Keeping it dependency-free also means the code that touches a wallet is short
 * enough for a sceptical player to read in full, which is rather the point.
 */

export const WALLETS = [
    {
        id: 'phantom',
        name: 'Phantom',
        url: 'https://phantom.app',
        // Phantom namespaces itself, and also sets window.solana
        find: () =>
            (typeof window !== 'undefined' &&
                window.phantom &&
                window.phantom.solana) ||
            (typeof window !== 'undefined' &&
                window.solana &&
                window.solana.isPhantom &&
                window.solana) ||
            null,
    },
    {
        id: 'solflare',
        name: 'Solflare',
        url: 'https://solflare.com',
        find: () =>
            (typeof window !== 'undefined' && window.solflare) ||
            (typeof window !== 'undefined' &&
                window.solana &&
                window.solana.isSolflare &&
                window.solana) ||
            null,
    },
    {
        id: 'backpack',
        name: 'Backpack',
        url: 'https://backpack.app',
        find: () =>
            (typeof window !== 'undefined' &&
                window.backpack &&
                window.backpack.solana) ||
            (typeof window !== 'undefined' &&
                window.solana &&
                window.solana.isBackpack &&
                window.solana) ||
            null,
    },
];

/**
 * Mobile browsers never get an injected provider. Wallet apps inject only
 * inside their own in-app browser, and there is no extension to do it in
 * mobile Safari or Chrome, so detection legitimately finds nothing even when
 * every wallet is installed. Telling that person to install Phantom is both
 * wrong and faintly insulting; the useful offer is to reopen the page inside
 * the wallet, where a provider does exist.
 */
export const isMobile = () => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/Android|iPhone|iPod/i.test(ua)) return true;
    // iPadOS reports itself as a Mac; only the touch points give it away.
    return /iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
};

/**
 * Universal links that reopen a page inside the wallet's own browser, taken
 * from each wallet's deeplink documentation. Backpack publishes no equivalent,
 * so it is absent here rather than guessed at -- a deeplink that silently fails
 * is worse than no button.
 */
const BROWSE_LINKS = {
    phantom: (url, ref) =>
        `https://phantom.app/ul/browse/${encodeURIComponent(
            url
        )}?ref=${encodeURIComponent(ref)}`,
    solflare: (url, ref) =>
        `https://solflare.com/ul/v1/browse/${encodeURIComponent(
            url
        )}?ref=${encodeURIComponent(ref)}`,
};

export const browseLinkFor = (id, url, ref) => {
    const build = BROWSE_LINKS[id];
    if (!build || typeof window === 'undefined') return null;
    return build(url || window.location.href, ref || window.location.origin);
};

/** A provider is only usable if it can do both halves of signing in. */
export const isUsable = (provider) =>
    !!provider &&
    typeof provider.connect === 'function' &&
    typeof provider.signMessage === 'function';

export const detectWallets = () =>
    WALLETS.map((wallet) => ({
        ...wallet,
        provider: wallet.find(),
    })).map((wallet) => ({
        ...wallet,
        available: isUsable(wallet.provider),
        // Only meaningful on mobile, where there is nothing to inject.
        browseLink: browseLinkFor(wallet.id),
    }));

export const availableWallets = () =>
    detectWallets().filter(({ available }) => available);

export const findWallet = (id) =>
    detectWallets().find((wallet) => wallet.id === id) || null;
