import newsUpdate, { idFor } from './newsUpdate';

/**
 * The reason this needed dedup: an entry with no fixed `time` matches on every
 * tick, so before this it would have been appended once a second forever. That
 * is why every tweet had to be pinned to an exact second, which crammed the
 * whole feed into the first three minutes of an hour-long term.
 */
const game = (over) => ({
    player: { name: { first: 'Jerome', last: 'Powell' } },
    time: 0,
    totalPrinted: 0,
    ...over,
});

const timed = () => [{ text: 'on the clock', time: 5 }];
const milestone = () => [
    { text: 'a million', atLeast: { totalPrinted: 1_000_000 } },
];

describe('choosing the next piece of news', () => {
    it('fires a timed entry on its second', () => {
        expect(newsUpdate(timed, game({ time: 5 }), [])).toHaveLength(1);
        expect(newsUpdate(timed, game({ time: 4 }), [])).toHaveLength(0);
    });

    it('fires a milestone entry once the threshold is passed', () => {
        expect(
            newsUpdate(milestone, game({ totalPrinted: 999_999 }), [])
        ).toHaveLength(0);
        expect(
            newsUpdate(milestone, game({ totalPrinted: 1_000_000 }), [])
        ).toHaveLength(1);
    });

    it('does not repeat a milestone on every tick that follows', () => {
        const published = newsUpdate(
            milestone,
            game({ totalPrinted: 5_000_000 }),
            []
        );
        expect(published).toHaveLength(1);

        // The condition is still true a second later, and for the rest of the
        // run. Without dedup this is where the spam started.
        const next = newsUpdate(
            milestone,
            game({ totalPrinted: 6_000_000, time: 1 }),
            published
        );
        expect(next).toHaveLength(0);
    });

    it('stamps a milestone with the time it actually happened', () => {
        const [item] = newsUpdate(
            milestone,
            game({ totalPrinted: 1_000_000, time: 412 }),
            []
        );
        expect(item.time).toBe(412);
    });

    it('gives the same text the same id, so dedup holds across a reload', () => {
        expect(idFor('a million')).toBe(idFor('a million'));
        expect(idFor('a million')).not.toBe(idFor('a billion'));
    });

    it('moves on to the next unsaid entry rather than stalling', () => {
        const both = () => [
            { text: 'first', atLeast: { totalPrinted: 100 } },
            { text: 'second', atLeast: { totalPrinted: 100 } },
        ];
        const said = newsUpdate(both, game({ totalPrinted: 100 }), []);
        expect(said[0].text).toBe('first');

        const next = newsUpdate(both, game({ totalPrinted: 100 }), said);
        expect(next[0].text).toBe('second');
    });
});
