import uuid from 'uuid/v4';
import { push } from 'connected-react-router';
import { recordSession } from './sessions';
import ciaUpdate from './news/ciaUpdate';
import trumpTweet from './news/trumpTweet';
import {
    createInitialState as createCoreState,
    reducer as coreReducer,
    isEconomicAction,
    SET_PLAYER,
    START_GAME,
    END_GAME,
    INCREMENT_TIMER
} from '../../game-core';

import rubberStamp from '../../storeImages/rubber-stamp.jpg';
import accountant from '../../storeImages/accountant.png';
import moneyPress from '../../storeImages/money-press.jpg';
import bribe from '../../storeImages/bribe.jpg';
import mint from '../../storeImages/mint.jpg';
import espionage from '../../storeImages/espionage.jpg';
import blackOp from '../../storeImages/black-op.jpg';
import propaganda from '../../storeImages/propaganda.jpg';
import insuranceFraud from '../../storeImages/insurance-fraud.jpg';
import oligarch from '../../storeImages/oligarch.jpg';
import northKorea from '../../storeImages/north-korea.png';
import cuba from '../../storeImages/cuba.png';
import jpm from '../../storeImages/jpm.png';
import iran from '../../storeImages/iran.gif';
import apple from '../../storeImages/apple.png';

// Artwork lives here, not in the core: the core is replayed on a server that
// has no bundler and no need for pictures.
const images = {
    'Rubber Stamp': rubberStamp,
    Accountant: accountant,
    'Money Press': moneyPress,
    Bribe: bribe,
    Mint: mint,
    Espionage: espionage,
    'Black Op': blackOp,
    'Propaganda Campaign': propaganda,
    'Insurance Fraud': insuranceFraud,
    'Russian Oligarch': oligarch,
    'Invade North Korea': northKorea,
    'Invade Cuba': cuba,
    'Commercial Bank': jpm,
    'Invade Iran': iran,
    'Tech Company': apple
};

const withImages = (store) =>
    store.map((item) => ({ ...item, image: images[item.name] }));

const createInitialState = () => {
    const core = createCoreState();
    return {
        ...core,
        store: withImages(core.store),
        active: false,
        player: {},
        news: {
            cia: [],
            trump: []
        }
    };
};

const initialState = createInitialState();

const newsReducer = (state, key, newsFunc) => ({
    [key]: [...state.news[key], ...newsFunc(state)]
});

export default (state = initialState, action = {}) => {
    if (isEconomicAction(action.type)) {
        const next = coreReducer(state, action);

        // News is flavour, not economy, so it is applied here rather than
        // inside the core. It reads the state the tick just produced.
        return action.type === INCREMENT_TIMER
            ? {
                  ...next,
                  news: {
                      ...next.news,
                      ...newsReducer(next, 'cia', ciaUpdate),
                      ...newsReducer(next, 'trump', trumpTweet)
                  }
              }
            : next;
    }

    switch (action.type) {
        case SET_PLAYER:
            return {
                ...state,
                player: {
                    ...state.player,
                    ...action.player
                }
            };
        case START_GAME:
            // Every session starts from a clean slate. Only the player's
            // application survives, since they filled it in once.
            return {
                ...createInitialState(),
                player: state.player,
                id: uuid(),
                active: true
            };
        case END_GAME:
            return createInitialState();
        default:
            return state;
    }
};

// Action Creators
export const setPlayer = (player) => ({
    type: SET_PLAYER,
    player
});

export const startGame = () => (dispatch) => {
    dispatch(recordSession());
    dispatch({ type: START_GAME });
    dispatch(push('/'));
};

export const endGame = () => ({ type: END_GAME });

export {
    incrementTimer,
    printMoney,
    purchaseProduct,
    closeSession
} from '../../game-core';
