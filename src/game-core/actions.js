/**
 * Action types. The economic actions are the only ones the core reducer
 * handles, and the only ones that may appear in a replay log.
 */
export const SET_PLAYER = 'thefed/game/SET_PLAYER';
export const START_GAME = 'thefed/game/START_GAME';
export const END_GAME = 'thefed/game/END_GAME';
export const INCREMENT_TIMER = 'thefed/game/INCREMENT_TIMER';
export const PRINT_MONEY = 'thefed/game/PRINT_MONEY';
export const PURCHASE_PRODUCT = 'thefed/game/PURCHASE_PRODUCT';
export const PURCHASE_UPGRADE = 'thefed/game/PURCHASE_UPGRADE';
export const CLOSE_SESSION = 'thefed/game/CLOSE_SESSION';

/** Actions a replay log is allowed to contain. Anything else is rejected. */
export const ECONOMIC_ACTIONS = [
    INCREMENT_TIMER,
    PRINT_MONEY,
    PURCHASE_PRODUCT,
    PURCHASE_UPGRADE,
];

export const isEconomicAction = (type) => ECONOMIC_ACTIONS.indexOf(type) !== -1;

export const incrementTimer = () => ({ type: INCREMENT_TIMER });

/**
 * `amount` is how many presses, never what one is worth -- the value comes
 * from `printMoneyDenomination` inside the reducer. Passing the denomination
 * here would apply it twice, which is harmless while it is 1 and a silent
 * multiplier on every click the moment an upgrade changes it.
 */
export const printMoney = (amount = 1) => ({ type: PRINT_MONEY, amount });

export const purchaseProduct = (productName) => ({
    type: PURCHASE_PRODUCT,
    productName,
});

export const purchaseUpgrade = (upgradeId) => ({
    type: PURCHASE_UPGRADE,
    upgradeId,
});

/** Ends play but keeps the final state, so a summary can be shown. */
export const closeSession = (reason) => ({ type: CLOSE_SESSION, reason });
