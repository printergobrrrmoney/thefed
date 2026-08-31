import { createInitialState, reducer, applyLog } from './reducer';
import { incrementTimer, printMoney, purchaseProduct } from './actions';
import { ITEMS } from './items';

const RUBBER_STAMP = ITEMS[0];

const clicks = (n) => new Array(n).fill(printMoney(1));
const ticks = (n) => new Array(n).fill(incrementTimer());

describe('score', () => {
    it('counts printed money towards the lifetime total', () => {
        const state = applyLog(clicks(5));
        expect(state.money).toBe(5);
        expect(state.totalPrinted).toBe(5);
    });

    it('does not reduce the lifetime total when money is spent', () => {
        const before = applyLog(clicks(RUBBER_STAMP.price));
        const after = reducer(before, purchaseProduct(RUBBER_STAMP.name));

        expect(after.money).toBe(0);
        expect(after.totalPrinted).toBe(RUBBER_STAMP.price);
    });

    it('never decreases across a long mixed run', () => {
        const log = [
            ...clicks(40),
            purchaseProduct(RUBBER_STAMP.name),
            ...ticks(30),
            purchaseProduct('Accountant'),
            ...ticks(30),
            ...clicks(10)
        ];

        let state = createInitialState();
        let previous = state.totalPrinted;

        log.forEach((action) => {
            state = reducer(state, action);
            expect(state.totalPrinted).toBeGreaterThanOrEqual(previous);
            previous = state.totalPrinted;
        });
    });

    it('is a plain value, not a getter aliased to the balance', () => {
        const state = applyLog(clicks(3));
        const descriptor = Object.getOwnPropertyDescriptor(
            state,
            'totalPrinted'
        );
        expect(descriptor.get).toBeUndefined();
        expect(typeof descriptor.value).toBe('number');
    });
});

describe('determinism', () => {
    it('produces an identical result for an identical log', () => {
        const log = [
            ...clicks(40),
            purchaseProduct(RUBBER_STAMP.name),
            ...ticks(120),
            purchaseProduct('Accountant')
        ];
        expect(applyLog(log)).toEqual(applyLog(log));
    });

    it('reaches the same state whether replayed at once or stepwise', () => {
        const log = [...clicks(50), purchaseProduct(RUBBER_STAMP.name), ...ticks(60)];
        const atOnce = applyLog(log);
        const stepwise = log.reduce((acc, action) => reducer(acc, action), createInitialState());
        expect(stepwise).toEqual(atOnce);
    });
});

describe('purchase guards', () => {
    it('ignores a purchase the player cannot afford', () => {
        const before = applyLog(clicks(1));
        const after = reducer(before, purchaseProduct(RUBBER_STAMP.name));
        expect(after).toBe(before);
    });

    it('ignores a purchase of an item that has not been revealed', () => {
        const rich = { ...createInitialState(), money: Number.MAX_SAFE_INTEGER };
        const after = reducer(rich, purchaseProduct('Tech Company'));
        expect(after).toBe(rich);
    });

    it('ignores a purchase of an unknown item', () => {
        const rich = { ...createInitialState(), money: 1000 };
        expect(reducer(rich, purchaseProduct('Helicopter Drop'))).toBe(rich);
    });

    it('raises the price and print rate when a purchase succeeds', () => {
        const before = applyLog(clicks(RUBBER_STAMP.price));
        const after = reducer(before, purchaseProduct(RUBBER_STAMP.name));
        const item = after.store[0];

        expect(item.count).toBe(1);
        expect(item.price).toBe(Math.round(RUBBER_STAMP.price * 1.15));
        expect(after.printRate).toBe(RUBBER_STAMP.rate);
    });

    it('reveals the next item along', () => {
        const hidden = createInitialState();
        const propagandaIdx = hidden.store.findIndex(
            ({ name }) => name === 'Propaganda Campaign'
        );
        expect(hidden.store[propagandaIdx].reveal).toBe(false);

        const rich = { ...hidden, money: 10000000 };
        const after = reducer(rich, purchaseProduct('Black Op'));
        expect(after.store[propagandaIdx].reveal).toBe(true);
    });
});

describe('purity', () => {
    it('does not mutate the state it is given', () => {
        const before = applyLog(clicks(RUBBER_STAMP.price));
        const snapshot = JSON.parse(JSON.stringify(before));

        reducer(before, purchaseProduct(RUBBER_STAMP.name));
        reducer(before, incrementTimer());
        reducer(before, printMoney(1));

        expect(before).toEqual(snapshot);
    });

    it('gives each run its own store', () => {
        const a = createInitialState();
        const b = createInitialState();
        expect(a.store[0]).not.toBe(b.store[0]);
    });

    it('carries unknown item fields through a purchase', () => {
        const decorated = {
            ...createInitialState(),
            money: 100,
            store: createInitialState().store.map((item) => ({
                ...item,
                image: `${item.name}.png`
            }))
        };
        const after = reducer(decorated, purchaseProduct(RUBBER_STAMP.name));
        expect(after.store[0].image).toBe('Rubber Stamp.png');
    });
});

describe('ticks', () => {
    it('earns the print rate each tick and advances the clock', () => {
        const bought = reducer(
            applyLog(clicks(RUBBER_STAMP.price)),
            purchaseProduct(RUBBER_STAMP.name)
        );
        const after = applyLog(ticks(10), bought);

        expect(after.time).toBe(10);
        expect(after.money).toBe(RUBBER_STAMP.rate * 10);
        expect(after.totalPrinted).toBe(
            RUBBER_STAMP.price + RUBBER_STAMP.rate * 10
        );
    });
});
