/**
 * Wallet sign-in.
 *
 * This site performs exactly two wallet operations: `connect` and
 * `signMessage`. It never builds, requests or sends a transaction, and it never
 * sees a seed phrase. Anything claiming to be The Fed that asks you to approve
 * a transaction is not this site.
 */
export { WALLETS, detectWallets, availableWallets, findWallet, isUsable } from './providers.js';
export {
    SIGN_IN_STATEMENT,
    NONCE_TTL_SECONDS,
    buildSignInMessage,
    parseSignInMessage,
    messageProblems
} from './siws.js';
export { ERRORS, connect, signIn, disconnect, shortAddress, toBase64, utf8Bytes } from './connect.js';
