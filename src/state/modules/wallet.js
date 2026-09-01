import * as wallet from '../../wallet';
import * as api from '../../api/client';

/**
 * Wallet connection and sign-in.
 *
 * Connecting and signing in are separate on purpose. Connecting only means the
 * player picked a wallet and it offered an address. Signing in proves control
 * of that address to the server, and only then does a score belong to anyone.
 */
const CONNECTING = 'thefed/wallet/CONNECTING';
const CONNECTED = 'thefed/wallet/CONNECTED';
const SIGNING_IN = 'thefed/wallet/SIGNING_IN';
const SIGNED_IN = 'thefed/wallet/SIGNED_IN';
const NAME_SET = 'thefed/wallet/NAME_SET';
const FAILED = 'thefed/wallet/FAILED';
const DISCONNECTED = 'thefed/wallet/DISCONNECTED';

const initialState = {
    walletId: null,
    address: null,
    displayName: null,
    signedIn: false,
    connecting: false,
    signingIn: false,
    error: null
};

export default (state = initialState, action = {}) => {
    switch (action.type) {
        case CONNECTING:
            return { ...state, connecting: true, error: null };
        case CONNECTED:
            return {
                ...state,
                walletId: action.walletId,
                address: action.address,
                connecting: false,
                error: null
            };
        case SIGNING_IN:
            return { ...state, signingIn: true, error: null };
        case SIGNED_IN:
            return {
                ...state,
                signedIn: true,
                signingIn: false,
                displayName: action.displayName || null,
                error: null
            };
        case NAME_SET:
            return { ...state, displayName: action.displayName };
        case FAILED:
            return {
                ...state,
                connecting: false,
                signingIn: false,
                error: action.error
            };
        case DISCONNECTED:
            return initialState;
        default:
            return state;
    }
};

const walletMessages = {
    [wallet.ERRORS.NOT_FOUND]: 'That wallet is not installed.',
    [wallet.ERRORS.REJECTED]: 'Cancelled in your wallet.',
    [wallet.ERRORS.NO_ACCOUNT]: 'That wallet has no account to connect.',
    [wallet.ERRORS.SIGN_FAILED]: 'The wallet could not sign.'
};

const apiMessages = {
    'invalid-address': 'That address was not accepted.',
    'no-pending-challenge': 'Sign-in expired. Try again.',
    'bad-message': 'The signed message did not match. Try again.',
    'bad-signature': 'That signature could not be verified.',
    'challenge-already-used': 'Sign-in expired. Try again.'
};

const describe = (error) =>
    walletMessages[error.code] ||
    apiMessages[error.code] ||
    'Something went wrong. Try again.';

export const connectWallet = (walletId) => async (dispatch) => {
    dispatch({ type: CONNECTING });
    try {
        const { address } = await wallet.connect(walletId);
        dispatch({ type: CONNECTED, walletId, address });
        return address;
    } catch (error) {
        dispatch({ type: FAILED, error: describe(error) });
        return null;
    }
};

/**
 * Prove control of the connected wallet: ask the server for a challenge, have
 * the wallet sign it, and exchange the signature for a session token.
 */
export const signIn = () => async (dispatch, getState) => {
    const { walletId, address } = getState().wallet;
    if (!address) return false;

    dispatch({ type: SIGNING_IN });
    try {
        const challenge = await api.requestNonce(address);
        const signed = await wallet.signIn({
            walletId,
            address,
            nonce: challenge.nonce,
            issuedAt: challenge.issuedAt,
            expiresAt: challenge.expiresAt,
            domain: challenge.domain
        });

        const session = await api.verifySignature({
            address,
            message: signed.message,
            signature: signed.signature
        });

        api.setToken(session.token);
        dispatch({ type: SIGNED_IN, displayName: session.displayName });
        return true;
    } catch (error) {
        dispatch({ type: FAILED, error: describe(error) });
        return false;
    }
};

/** Connect then sign in, so the player sees one action rather than two. */
export const connectAndSignIn = (walletId) => async (dispatch) => {
    const address = await dispatch(connectWallet(walletId));
    if (!address) return false;
    return dispatch(signIn());
};

export const chooseDisplayName = (displayName) => async (dispatch) => {
    try {
        const result = await api.setDisplayName(displayName);
        dispatch({ type: NAME_SET, displayName: result.displayName });
        return null;
    } catch (error) {
        return error.code || 'request-failed';
    }
};

export const disconnectWallet = () => async (dispatch, getState) => {
    const { walletId } = getState().wallet;
    if (walletId) await wallet.disconnect(walletId);
    api.clearToken();
    dispatch({ type: DISCONNECTED });
};

export const isSignedIn = ({ wallet: w }) => w.signedIn;
