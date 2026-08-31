import * as wallet from '../../wallet';

/**
 * Connected wallet state.
 *
 * Connecting is *not* signing in. It only means the player picked a wallet and
 * it told us an address — nothing has been proved to any server. Authentication
 * is the signature step, which needs a server-issued nonce and arrives with the
 * API. Until then this is identity for display, and no score is attributed to
 * it.
 */
const CONNECTING = 'thefed/wallet/CONNECTING';
const CONNECTED = 'thefed/wallet/CONNECTED';
const FAILED = 'thefed/wallet/FAILED';
const DISCONNECTED = 'thefed/wallet/DISCONNECTED';

const initialState = {
    walletId: null,
    address: null,
    connecting: false,
    error: null
};

export default (state = initialState, action = {}) => {
    switch (action.type) {
        case CONNECTING:
            return { ...state, connecting: true, error: null };
        case CONNECTED:
            return {
                walletId: action.walletId,
                address: action.address,
                connecting: false,
                error: null
            };
        case FAILED:
            return { ...initialState, error: action.error };
        case DISCONNECTED:
            return initialState;
        default:
            return state;
    }
};

const messages = {
    [wallet.ERRORS.NOT_FOUND]: 'That wallet is not installed.',
    [wallet.ERRORS.REJECTED]: 'Connection cancelled.',
    [wallet.ERRORS.NO_ACCOUNT]: 'That wallet has no account to connect.',
    [wallet.ERRORS.SIGN_FAILED]: 'The wallet could not sign.'
};

export const connectWallet = (walletId) => async (dispatch) => {
    dispatch({ type: CONNECTING });
    try {
        const { address } = await wallet.connect(walletId);
        dispatch({ type: CONNECTED, walletId, address });
    } catch (error) {
        dispatch({
            type: FAILED,
            error: messages[error.code] || 'Could not connect to that wallet.'
        });
    }
};

export const disconnectWallet = () => async (dispatch, getState) => {
    const { walletId } = getState().wallet;
    if (walletId) await wallet.disconnect(walletId);
    dispatch({ type: DISCONNECTED });
};

export const isConnected = ({ wallet: w }) => !!w.address;
