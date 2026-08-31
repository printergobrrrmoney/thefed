/**
 * Canonical store economy.
 *
 * Deliberately free of images or any other presentation concern: this table is
 * replayed server-side to verify scores, so it must be loadable outside a
 * bundler. The app decorates these with artwork at render time.
 */
export const ITEMS = [
    { name: 'Rubber Stamp', rate: 2, price: 9, count: 0, reveal: true },
    { name: 'Accountant', rate: 7, price: 32, count: 0, reveal: true },
    { name: 'Money Press', rate: 213, price: 920, count: 0, reveal: true },
    { name: 'Bribe', rate: 1190, price: 5000, count: 0, reveal: true },
    { name: 'Mint', rate: 20975, price: 86000, count: 0, reveal: true },
    { name: 'Espionage', rate: 98750, price: 395000, count: 0, reveal: true },
    { name: 'Black Op', rate: 733333, price: 2860000, count: 0, reveal: true },
    {
        name: 'Propaganda Campaign',
        rate: 20815789,
        price: 79100000,
        count: 0,
        reveal: false
    },
    {
        name: 'Insurance Fraud',
        rate: 246216216,
        price: 911000000,
        count: 0,
        reveal: false
    },
    {
        name: 'Russian Oligarch',
        rate: 2722222222,
        price: 9800000000,
        count: 0,
        reveal: false
    },
    {
        name: 'Invade North Korea',
        rate: 4714285714,
        price: 16500000000,
        count: 0,
        reveal: false
    },
    {
        name: 'Invade Cuba',
        rate: 25588235294,
        price: 87000000000,
        count: 0,
        reveal: false
    },
    {
        name: 'Commercial Bank',
        rate: 112727272727,
        price: 372000000000,
        count: 0,
        reveal: false
    },
    {
        name: 'Invade Iran',
        rate: 137187500000,
        price: 439000000000,
        count: 0,
        reveal: false
    },
    {
        name: 'Tech Company',
        rate: 321000000000,
        price: 963000000000,
        count: 0,
        reveal: false
    }
];

/** Each purchase raises that item's price by this factor. */
export const PRICE_GROWTH = 1.15;

export default ITEMS;
