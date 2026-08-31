import { ITEMS, PRICE_GROWTH } from './items';
import {
    CLOSE_SESSION,
    END_GAME,
    INCREMENT_TIMER,
    PRINT_MONEY,
    PURCHASE_PRODUCT
} from './actions';
import {
    SESSION_SECONDS,
    IDLE_SECONDS,
    END_DURATION,
    END_IDLE,
    END_RESIGNED,
    isSessionOver
} from './session';

/**
 * The economic state of a run. `money` is spendable and falls when you buy;
 * `totalPrinted` is the lifetime total and only ever rises. `totalPrinted` is
 * the score rewards are paid against, so it must never depend on what a player
 * has spent.
 *
 * `lastActionAt` and `endedAt` make the session's own limits part of the
 * replayable state, so the verifier applies them without extra bookkeeping.
 */
export const createInitialState = () => ({
    money: 0,
    totalPrinted: 0,
    printMoneyDenomination: 1,
    printRate: 0,
    time: 0,
    lastActionAt: 0,
    endedAt: null,
    endedReason: null,
    store: ITEMS.map((item) => ({ ...item }))
});

const earn = (state, amount) => ({
    ...state,
    money: state.money + amount,
    totalPrinted: state.totalPrinted + amount
});

const close = (state, reason) => ({
    ...state,
    endedAt: state.time,
    endedReason: reason
});

/** A tick can be the thing that ends the session, so limits are checked after it. */
const closeIfExpired = (state) => {
    if (state.time >= SESSION_SECONDS) return close(state, END_DURATION);
    if (state.time - state.lastActionAt >= IDLE_SECONDS) {
        return close(state, END_IDLE);
    }
    return state;
};

const purchase = (state, productName) => {
    const product = state.store.find(({ name }) => name === productName);

    // The store UI disables unaffordable and unrevealed items, but a replayed
    // log is not the UI. Without these guards a forged log buys the whole store
    // at a negative balance.
    if (!product || !product.reveal || state.money < product.price) {
        return state;
    }

    return {
        ...state,
        money: state.money - product.price,
        printRate: state.printRate + product.rate,
        lastActionAt: state.time,
        store: state.store.map((item, idx, all) => ({
            ...item,
            ...(item.name === productName && {
                price: Math.round(item.price * PRICE_GROWTH),
                count: item.count + 1
            }),
            // Buying an item reveals the next one along.
            ...(idx > 0 && all[idx - 1].name === productName && { reveal: true })
        }))
    };
};

/**
 * Pure economic reducer. Given the same state and action it always returns the
 * same result, which is what lets the server recompute a score from an input
 * log. Fields it does not know about (the app adds `image` to store items) are
 * carried through untouched.
 */
export const reducer = (state = createInitialState(), action = {}) => {
    // Once a session is closed nothing can add to it. This is what stops a log
    // from being padded with extra actions after the cap was reached.
    if (isSessionOver(state) && action.type !== END_GAME) {
        return state;
    }

    switch (action.type) {
        case INCREMENT_TIMER:
            return closeIfExpired({
                ...earn(state, state.printRate),
                time: state.time + 1
            });
        case PRINT_MONEY:
            return {
                ...earn(state, state.printMoneyDenomination * action.amount),
                lastActionAt: state.time
            };
        case PURCHASE_PRODUCT:
            return purchase(state, action.productName);
        case CLOSE_SESSION:
            return close(state, action.reason || END_RESIGNED);
        case END_GAME:
            return createInitialState();
        default:
            return state;
    }
};

/**
 * Replay an ordered action log. This is the function the verifier will call:
 * the score it returns is the only one that counts.
 */
export const applyLog = (log, state = createInitialState()) =>
    log.reduce(reducer, state);

export default reducer;
