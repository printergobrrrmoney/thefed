/**
 * The Fed — game core.
 *
 * A pure, presentation-free model of the game's economy, shared by the React
 * app and (later) the server-side replay verifier. Both must run the exact same
 * rules, so nothing in this folder may import React, the router, styles or
 * artwork.
 *
 * CORE_VERSION is recorded against every session. Changing any rule — a price,
 * a rate, the growth factor — means previously recorded logs no longer replay
 * to the same score, so bump it whenever the economy changes.
 */
export { CORE_VERSION } from './version';

export { ITEMS, PRICE_GROWTH } from './items';
export {
    SET_PLAYER,
    START_GAME,
    END_GAME,
    INCREMENT_TIMER,
    PRINT_MONEY,
    PURCHASE_PRODUCT,
    CLOSE_SESSION,
    ECONOMIC_ACTIONS,
    isEconomicAction,
    incrementTimer,
    printMoney,
    purchaseProduct,
    closeSession
} from './actions';
export { createInitialState, reducer, applyLog } from './reducer';
export {
    SESSION_SECONDS,
    IDLE_SECONDS,
    END_DURATION,
    END_IDLE,
    END_RESIGNED,
    END_REASONS,
    isSessionOver,
    secondsRemaining,
    idleSecondsRemaining
} from './session';
export {
    verifyLog,
    REJECTIONS,
    ACTION_PRINT,
    ACTION_BUY,
    MAX_ACTIONS,
    MAX_ACTIONS_PER_TICK,
    CLOCK_DRIFT_SECONDS
} from './verify';
export { createRecorder } from './recorder';
