import { createInitialState, reducer } from './reducer';
import { printMoney, purchaseProduct, purchaseUpgrade } from './actions';
import {
    UPGRADES,
    findUpgrade,
    isUnlocked,
    multiplierFor,
    rateFor,
    denominationFor,
    UNLOCK_AT,
    TARGET_CLICK,
} from './upgrades';
import { verifyLog, ACTION_PRINT, ACTION_BUY, ACTION_UPGRADE } from './verify';
import { CORE_VERSION } from './version';

const play = (state, actions) => actions.reduce(reducer, state);

/** Enough money to shop with, without buying anything to get it. */
const withMoney = (amount, state = createInitialState()) => ({
    ...state,
    money: amount,
});

const buy = (state, name, times) =>
    play(
        state,
        Array.from({ length: times }, () => purchaseProduct(name))
    );

describe('the upgrade table', () => {
    it('gives every id exactly once', () => {
        const ids = UPGRADES.map((u) => u.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('offers one upgrade per item, plus the click ones', () => {
        const clicks = UPGRADES.filter((u) => u.target === TARGET_CLICK);
        expect(clicks.length).toBeGreaterThan(0);
        expect(UPGRADES.length).toBe(clicks.length + 15);
    });

    it('never prices an upgrade at nothing', () => {
        UPGRADES.forEach((u) => expect(u.price).toBeGreaterThan(0));
    });
});

describe('the rate, now derived rather than accumulated', () => {
    it('is unchanged when nothing is upgraded', () => {
        const state = buy(withMoney(1_000_000), 'Rubber Stamp', 5);
        // Five stamps at 2/sec.
        expect(state.printRate).toBe(10);
        expect(rateFor(state.store, [])).toBe(10);
    });

    it('multiplies what is already owned', () => {
        let state = buy(withMoney(10_000_000), 'Rubber Stamp', UNLOCK_AT);
        expect(state.printRate).toBe(UNLOCK_AT * 2);

        state = reducer(state, purchaseUpgrade('x-rubber-stamp'));
        expect(state.printRate).toBe(UNLOCK_AT * 2 * 2);
    });

    it('also multiplies what is bought afterwards', () => {
        // This is the case an accumulated rate could not express: a stamp
        // bought after the upgrade would have missed the multiplier entirely.
        let state = buy(withMoney(10_000_000), 'Rubber Stamp', UNLOCK_AT);
        state = reducer(state, purchaseUpgrade('x-rubber-stamp'));
        const before = state.printRate;

        state = reducer(state, purchaseProduct('Rubber Stamp'));
        expect(state.printRate).toBe(before + 2 * 2);
    });

    it('leaves other items alone', () => {
        let state = buy(withMoney(100_000_000), 'Rubber Stamp', UNLOCK_AT);
        state = buy(state, 'Accountant', 2);
        const accountants = 2 * 7;

        state = reducer(state, purchaseUpgrade('x-rubber-stamp'));
        expect(state.printRate).toBe(UNLOCK_AT * 2 * 2 + accountants);
    });
});

describe('buying an upgrade', () => {
    const afford = () => buy(withMoney(10_000_000), 'Rubber Stamp', UNLOCK_AT);

    it('costs what it says', () => {
        const state = afford();
        const { price } = findUpgrade('x-rubber-stamp');
        const after = reducer(state, purchaseUpgrade('x-rubber-stamp'));

        expect(after.money).toBe(state.money - price);
        expect(after.upgrades).toEqual(['x-rubber-stamp']);
    });

    it('cannot be bought twice', () => {
        let state = reducer(afford(), purchaseUpgrade('x-rubber-stamp'));
        const { money } = state;

        state = reducer(state, purchaseUpgrade('x-rubber-stamp'));
        expect(state.money).toBe(money);
        expect(state.upgrades).toEqual(['x-rubber-stamp']);
    });

    it('is refused without the money', () => {
        const poor = buy(withMoney(200), 'Rubber Stamp', UNLOCK_AT);
        const after = reducer(poor, purchaseUpgrade('x-rubber-stamp'));
        expect(after).toBe(poor);
    });

    it('is refused before enough of the item is owned', () => {
        const shallow = buy(
            withMoney(10_000_000),
            'Rubber Stamp',
            UNLOCK_AT - 1
        );
        const after = reducer(shallow, purchaseUpgrade('x-rubber-stamp'));
        expect(after).toBe(shallow);
        expect(isUnlocked(findUpgrade('x-rubber-stamp'), shallow.store)).toBe(
            false
        );
    });

    it('ignores an upgrade that does not exist', () => {
        const state = withMoney(10_000_000);
        expect(reducer(state, purchaseUpgrade('x-not-real'))).toBe(state);
    });
});

describe('clicking', () => {
    it('pays the denomination once, not squared', () => {
        // The trap: the button used to pass the denomination as the amount and
        // the reducer multiplied by it again, so a x5 upgrade paid 25 a click.
        let state = withMoney(2_000);
        state = reducer(state, purchaseUpgrade('x-click-ink'));
        expect(state.printMoneyDenomination).toBe(5);

        const before = state.totalPrinted;
        state = reducer(state, printMoney());
        expect(state.totalPrinted - before).toBe(5);
    });

    it('stacks click upgrades', () => {
        let state = withMoney(1_000_000);
        state = reducer(state, purchaseUpgrade('x-click-ink'));
        state = reducer(state, purchaseUpgrade('x-click-press'));
        expect(denominationFor(state.upgrades)).toBe(25);

        const before = state.totalPrinted;
        state = reducer(state, printMoney());
        expect(state.totalPrinted - before).toBe(25);
    });
});

describe('replay', () => {
    const log = (actions) => ({
        coreVersion: CORE_VERSION,
        sessionId: 's',
        startedAt: 0,
        submittedAt: 600_000,
        actions,
    });

    it('reaches the same score through the verifier', () => {
        // Print enough to afford ink, buy it, then print again.
        const presses = Array.from({ length: 200 }, (unused, i) => [
            i,
            ACTION_PRINT,
        ]);
        const result = verifyLog(
            log([...presses, [200, ACTION_UPGRADE, 'x-click-ink']])
        );

        expect(result.problems).toEqual([]);
        expect(result.state.upgrades).toEqual([]);
        // 200 presses at $1 is not the 1000 the upgrade costs, so it is refused
        // and the score is exactly the presses.
        expect(result.score).toBe(200);
    });

    it('refuses a log naming an upgrade with a non-string payload', () => {
        const result = verifyLog(log([[0, ACTION_UPGRADE, 42]]));
        expect(result.problems.length).toBeGreaterThan(0);
    });

    it('still refuses an unknown action kind', () => {
        const result = verifyLog(log([[0, 'z']]));
        expect(result.problems.length).toBeGreaterThan(0);
    });

    it('cannot be forged into an unaffordable upgrade', () => {
        const result = verifyLog(
            log([
                [0, ACTION_UPGRADE, 'x-tech-company'],
                [1, ACTION_PRINT],
            ])
        );
        expect(result.state.upgrades).toEqual([]);
        expect(result.score).toBe(1);
    });

    it('replays a real purchase and upgrade together', () => {
        const actions = [];
        // Click up the money for ten stamps and the upgrade.
        for (let i = 0; i < 2000; i += 1) actions.push([0, ACTION_PRINT]);
        // Rate limiting allows a bounded number per tick, so spread them.
        const spread = actions.map((entry, i) => [
            Math.floor(i / 10),
            entry[1],
        ]);
        for (let i = 0; i < UNLOCK_AT; i += 1) {
            spread.push([300 + i, ACTION_BUY, 'Rubber Stamp']);
        }
        spread.push([400, ACTION_UPGRADE, 'x-rubber-stamp']);

        const result = verifyLog(log(spread));
        expect(result.problems).toEqual([]);
        expect(result.state.store[0].count).toBe(UNLOCK_AT);
        expect(result.state.upgrades).toEqual(['x-rubber-stamp']);
        expect(result.state.printRate).toBe(UNLOCK_AT * 2 * 2);
    });
});

describe('multiplierFor', () => {
    it('is one when nothing applies', () => {
        expect(multiplierFor('Rubber Stamp', [])).toBe(1);
        expect(multiplierFor('Rubber Stamp', ['x-click-ink'])).toBe(1);
    });

    it('compounds upgrades on the same target', () => {
        expect(
            multiplierFor(TARGET_CLICK, ['x-click-ink', 'x-click-press'])
        ).toBe(25);
    });
});
