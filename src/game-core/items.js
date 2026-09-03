/**
 * Canonical store economy.
 *
 * Deliberately free of images or any other presentation concern: this table is
 * replayed server-side to verify scores, so it must be loadable outside a
 * bundler. The app decorates these with artwork at render time.
 *
 * Two things are true of this ladder that were not true of the first one.
 *
 * Rates step by a consistent 3x. The original stepped by 3.5x, then 30x, then
 * 5.6x, then 17.6x, and later by as little as 1.2x, which produced a grindy
 * middle and then an ending where the last five items arrived within half a
 * minute of each other.
 *
 * Payback falls across the ladder rather than rising: thirty seconds at the
 * Rubber Stamp down to four at the Tech Company. The opening therefore asks for
 * real commitment -- a lot of clicking and a lot of small purchases before
 * anything compounds -- and the reward for getting through it is an economy
 * that increasingly runs itself. The first table had this backwards, paying
 * back fastest at the top, which is why the whole ladder could be cleared in
 * about five minutes and the remaining fifty-five had nothing in them.
 */
export const ITEMS = [
    { name: 'Rubber Stamp', rate: 1, price: 30, count: 0, reveal: true },
    { name: 'Accountant', rate: 3, price: 78, count: 0, reveal: true },
    { name: 'Money Press', rate: 9, price: 200, count: 0, reveal: true },
    { name: 'Bribe', rate: 27, price: 530, count: 0, reveal: true },
    { name: 'Mint', rate: 81, price: 1400, count: 0, reveal: true },
    {
        name: 'Espionage',
        rate: 240,
        price: 3500,
        count: 0,
        reveal: false,
    },
    {
        name: 'Black Op',
        rate: 730,
        price: 9200,
        count: 0,
        reveal: false,
    },
    {
        name: 'Propaganda Campaign',
        rate: 2200,
        price: 24000,
        count: 0,
        reveal: false,
    },
    {
        name: 'Insurance Fraud',
        rate: 6600,
        price: 63000,
        count: 0,
        reveal: false,
    },
    {
        name: 'Russian Oligarch',
        rate: 20000,
        price: 160000,
        count: 0,
        reveal: false,
    },
    {
        name: 'Invade North Korea',
        rate: 59000,
        price: 420000,
        count: 0,
        reveal: false,
    },
    {
        name: 'Invade Cuba',
        rate: 180000,
        price: 1100000,
        count: 0,
        reveal: false,
    },
    {
        name: 'Commercial Bank',
        rate: 530000,
        price: 2800000,
        count: 0,
        reveal: false,
    },
    {
        name: 'Invade Iran',
        rate: 1600000,
        price: 7400000,
        count: 0,
        reveal: false,
    },
    {
        name: 'Tech Company',
        rate: 4800000,
        price: 19000000,
        count: 0,
        reveal: false,
    },
];

/** Each additional unit of the same item costs this much more than the last. */
export const PRICE_GROWTH = 1.15;

export default ITEMS;
