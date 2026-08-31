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
            null
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
            null
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
            null
    }
];

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
        available: isUsable(wallet.provider)
    }));

export const availableWallets = () =>
    detectWallets().filter(({ available }) => available);

export const findWallet = (id) =>
    detectWallets().find((wallet) => wallet.id === id) || null;
