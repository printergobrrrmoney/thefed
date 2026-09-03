import { ITEMS } from './items.js';

/**
 * Upgrades: the first decision in the game worth thinking about.
 *
 * Until now every item was strictly better value per dollar than the one below
 * it — payback ran from 4.5 seconds at the Rubber Stamp down to 3.0 at the Tech
 * Company — so the best move was always "buy the most expensive thing you can
 * afford" and there was nothing to weigh. Cost growth of 1.15 then punishes
 * going deep on any one item, which leaves a player spreading thin by default.
 *
 * An upgrade multiplies everything you already own of one item, so it rewards
 * exactly the depth the price curve discourages. That is the trade: another
 * Tech Company, or double the forty Rubber Stamps you already have.
 *
 * Like every other economic rule in here this table is replayed server-side, so
 * it must stay free of presentation and must not change without a version bump.
 */

/** What an upgrade can multiply. */
export const TARGET_CLICK = 'click';

/**
 * How many of an item you must own before its upgrade is offered.
 *
 * Set at the crossover. Below about fourteen the next unit of the same item is
 * still better value than doubling what you have, so unlocking earlier would
 * put a button on screen that is never the right thing to press. From here on
 * it tilts the other way, and keeps tilting as you go deeper.
 */
export const UNLOCK_AT = 15;

/** Upgrade price as a multiple of the item's starting price. */
export const PRICE_MULTIPLE = 100;

const NAMES = {
    'Rubber Stamp': ['Automatic Stamper', 'Every stamp lands twice as hard.'],
    Accountant: ['Creative Accounting', 'The books balance faster than ever.'],
    'Money Press': ['Double-Sided Plates', 'Both sides of the sheet, at once.'],
    Bribe: ['Preferred Rates', 'Bulk discount on public officials.'],
    Mint: ['Night Shift', 'The Mint no longer closes.'],
    Espionage: [
        'Deniable Assets',
        'Twice the operations, none of the records.',
    ],
    'Black Op': ['Off-Books Funding', 'No line item, no limit.'],
    'Propaganda Campaign': [
        'Message Discipline',
        'The same lie, twice as loudly.',
    ],
    'Insurance Fraud': ['Act of God Clause', 'Everything is covered. Twice.'],
    'Russian Oligarch': ['Yacht Financing', 'Their money works harder now.'],
    'Invade North Korea': ['Extended Mandate', 'Nobody voted on this.'],
    'Invade Cuba': ['Regime Change Bonus', 'Double the liberation.'],
    'Commercial Bank': ['Fractional Reserve', 'Lend the same dollar twice.'],
    'Invade Iran': ['Strategic Reserve', 'Twice the oil, half the questions.'],
    'Tech Company': ['Series B', 'Growth at any cost, doubled.'],
};

/** One upgrade per item, unlocked by owning enough of it to be worth doubling. */
const forItems = ITEMS.map((item) => {
    const [name, description] = NAMES[item.name] || [
        `${item.name} Upgrade`,
        `${item.name}s produce twice as much.`,
    ];
    return {
        id: `x-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name,
        description,
        target: item.name,
        multiplier: 2,
        price: item.price * PRICE_MULTIPLE,
        requires: { name: item.name, count: UNLOCK_AT },
    };
});

/**
 * Clicking stops mattering early, which makes the opening the least interesting
 * part of a run. These keep a thumb worth using for a little longer.
 */
const forClicks = [
    {
        id: 'x-click-ink',
        name: 'Better Ink',
        description: 'Every press of the button is worth five dollars.',
        target: TARGET_CLICK,
        multiplier: 5,
        price: 1000,
        requires: null,
    },
    {
        id: 'x-click-press',
        name: 'Industrial Press',
        description: 'Five times again on every press.',
        target: TARGET_CLICK,
        multiplier: 5,
        price: 250000,
        requires: null,
    },
];

export const UPGRADES = [...forClicks, ...forItems];

export const findUpgrade = (id) =>
    UPGRADES.find((upgrade) => upgrade.id === id) || null;

/**
 * Whether an upgrade is offered yet. Unlocking on ownership is what makes the
 * choice a real one: you cannot buy the multiplier before you have something
 * worth multiplying.
 */
export const isUnlocked = (upgrade, store) => {
    if (!upgrade.requires) return true;
    const item = store.find(({ name }) => name === upgrade.requires.name);
    return Boolean(item) && item.count >= upgrade.requires.count;
};

/** Combined multiplier applying to one item, from every upgrade owned. */
export const multiplierFor = (target, owned = []) =>
    owned.reduce((total, id) => {
        const upgrade = findUpgrade(id);
        return upgrade && upgrade.target === target
            ? total * upgrade.multiplier
            : total;
    }, 1);

/**
 * Print rate, derived rather than accumulated.
 *
 * It used to be a running total added to on each purchase, which cannot express
 * an upgrade: an item bought after the multiplier would have missed it. Deriving
 * it from what is owned makes the order of purchases irrelevant, which is also
 * one less thing for a forged log to exploit.
 */
export const rateFor = (store, owned = []) =>
    store.reduce(
        (total, item) =>
            total + item.count * item.rate * multiplierFor(item.name, owned),
        0
    );

/** Value of a single press, after click upgrades. */
export const denominationFor = (owned = []) =>
    multiplierFor(TARGET_CLICK, owned);

export default UPGRADES;
