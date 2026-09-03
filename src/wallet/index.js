/**
 * Wallet sign-in.
 *
 * Signing in uses only `connect` and `signMessage`, and never approves a
 * transaction. Claiming is the single exception, and the transaction it sends
 * is built in `src/claim` where its one instruction can be read: it moves
 * tokens to the player and nothing else. This module never sees a seed phrase,
 * and never asks for standing permission over a wallet.
 */
export {
    WALLETS,
    detectWallets,
    availableWallets,
    findWallet,
    isUsable,
    isMobile,
    browseLinkFor,
} from './providers.js';
export {
    SIGN_IN_STATEMENT,
    NONCE_TTL_SECONDS,
    buildSignInMessage,
    parseSignInMessage,
    messageProblems,
} from './siws.js';
export {
    ERRORS,
    connect,
    signIn,
    disconnect,
    signAndSendMessage,
    shortAddress,
    toBase64,
    utf8Bytes,
} from './connect.js';
