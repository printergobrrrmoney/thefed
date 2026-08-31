<h1 align="center">The Fed</h1>

<p align="center">
    A simple game about central banking, for <a href="https://printergobrrr.money">$BRRR</a>
    <br />
    <a href="https://game.printergobrrr.money">game.printergobrrr.money</a>
</p>

---

Play as Chair of the Federal Reserve and print money as fast as you can. Buy
printers, watch the news react, try to last the hour.

## Why this repo is public

Scores from this game are intended to decide token rewards. That only works if
you can check the rules yourself rather than taking our word for them. So the
parts that decide what a score is worth are all here, in one place, and small
enough to read in a sitting.

| What | Where |
| --- | --- |
| The economy — items, prices, rates | [`src/game-core/items.js`](src/game-core/items.js) |
| The rules — what every action does | [`src/game-core/reducer.js`](src/game-core/reducer.js) |
| Session limits and the idle timeout | [`src/game-core/session.js`](src/game-core/session.js) |
| The verifier — how a score is recomputed | [`src/game-core/verify.js`](src/game-core/verify.js) |
| What the client is allowed to report | [`src/game-core/recorder.js`](src/game-core/recorder.js) |

Nothing in `src/game-core` imports React, the router, styles or artwork. It is a
pure function of its inputs, which is what allows the same code to run in your
browser and on the server that checks your score.

## How scoring actually works

The client never reports a score. It reports an ordered log of what you did, and
the server replays that log through the same rules to work out what it was
worth.

Two things are deliberately absent from the log:

- **What an action was worth.** An entry records that you clicked, not how much
  it printed. The amount is taken from replayed state, so a modified client
  cannot claim a click printed a billion.
- **Time.** Ticks are not recorded. The verifier generates them, so a log cannot
  invent time it never sat through.

Anything the rules would reject — buying what you cannot afford, buying an item
you have not unlocked, acting after the session closed — is a no-op on replay,
exactly as it is in the live game. A dishonest log does not error. It just
scores badly.

The tests are mostly attacks. `src/game-core/verify.test.js` is the interesting
one.

```bash
npm install
npm test -- --testPathPattern game-core
```

## Session limits

| Limit | Value |
| --- | --- |
| Session length | 60 minutes |
| Idle timeout | 5 minutes without printing or buying |
| Sessions per day | 3 |

The first two live in the core, so replay enforces them automatically. The daily
cap currently lives in the browser and is pacing, not security — the
authoritative version arrives with wallet sign-in.

## Running it

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

| Script | Does |
| --- | --- |
| `npm start` | Development server |
| `npm run build` | Production build |
| `npm test` | Tests |

On modern Node the production build needs `NODE_OPTIONS=--openssl-legacy-provider`,
because the toolchain predates OpenSSL 3.

## Status

The scoring core and verifier are done and tested. Wallet sign-in, the server
that stores logs, and the leaderboard are next. No tokens are distributed yet,
and nothing here should be read as a promise that any will be.

## Credits

Forked from
[memetic-institute/The-Fed](https://github.com/memetic-institute/The-Fed) by the
Institute for Memetic Research & Development, and substantially rewritten since.
MIT licensed — see [LICENSE](LICENSE), whose original copyright is retained.
