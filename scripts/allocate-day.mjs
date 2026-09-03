/**
 * Work out what a day owes, and write it down.
 *
 * This is the step that turns verified scores into a merkle tree and a root.
 * It touches no chain: publishing is a separate step on purpose, so the
 * arithmetic can be inspected, argued with and re-run before anything is
 * created on chain or any tokens move.
 *
 *   node scripts/allocate-day.mjs 2026-09-02 --mint <address> [--commit]
 *
 * Without --commit it prints what it would do and writes nothing. Running it
 * twice for the same day is refused rather than silently republished: a second
 * root for a day already paid would strand every proof handed out under the
 * first.
 */
import { readFileSync } from 'fs';

const here = new URL('.', import.meta.url);
const env = Object.fromEntries(
    readFileSync(new URL('../.env.development.local', here), 'utf8')
        .split('\n')
        .filter((line) => line.includes('='))
        .map((line) => {
            const at = line.indexOf('=');
            return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, '')];
        })
);
Object.assign(process.env, env);

const { db } = await import('../api/_lib/db.mjs');
const { base58Decode } = await import('../api/_lib/crypto.mjs');
const { allocateDay, dayOfSchedule, DAILY_CEILING } = await import(
    '../src/economics/index.js'
);
const { treeForAwards } = await import('../src/economics/merkle.js');

const args = process.argv.slice(2);
const day = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const flag = (name) => {
    const at = args.indexOf(`--${name}`);
    return at === -1 ? null : args[at + 1];
};
const commit = args.includes('--commit');
const mint = flag('mint');
const decimals = Number(flag('decimals') || 9);

if (!day) {
    console.error('usage: allocate-day.mjs YYYY-MM-DD --mint <address> [--commit]');
    process.exit(1);
}
if (!mint || !base58Decode(mint)) {
    console.error('a --mint address is required');
    process.exit(1);
}

const sql = db();

const [already] = await sql`select day from distributions where day = ${day}`;
if (already) {
    console.error(
        `${day} has already been allocated. A second root would strand every ` +
            'proof issued under the first.'
    );
    process.exit(1);
}

/**
 * A player's day is the sum of the runs they had scored, not their best.
 * Three terms are the allowance, and using all three should be worth more than
 * using one — log compression means it is worth only a little more, which is
 * the intent rather than an accident.
 */
const rows = await sql`
    select address, sum(score)::bigint as score, count(*)::int as runs
    from sessions
    where rejected = false
      and score is not null
      and (started_at at time zone 'utc')::date = ${day}
    group by address
    order by score desc
`;

if (!rows.length) {
    console.log(`No scored runs on ${day}. Nothing to allocate.`);
    process.exit(0);
}

const scheduleStart = process.env.SCHEDULE_START;
const scheduleDay = scheduleStart
    ? dayOfSchedule(scheduleStart, new Date(`${day}T12:00:00Z`))
    : 1;

// Holder tiers are not sampled yet, so everybody is allocated at the base tier.
// Passing a real balance here is the only change that turns tiers on.
const entries = rows.map((row) => ({
    address: row.address,
    score: Number(row.score),
    balance: 0
}));

const allocation = allocateDay(entries, scheduleDay);

const tree = treeForAwards(
    allocation.awards.map((award) => ({
        ...award,
        claimant: Buffer.from(base58Decode(award.address))
    })),
    decimals
);

const scale = 10 ** decimals;
const ceilingUnits = BigInt(Math.floor(allocation.ceiling * scale));
const awardedUnits = BigInt(tree.total);
const burnedUnits = ceilingUnits - awardedUnits;

const show = (units) =>
    (Number(units) / scale).toLocaleString('en-US', {
        maximumFractionDigits: 4
    });

console.log(`\nDay ${day} — schedule day ${scheduleDay}`);
console.log(`  players with scored runs : ${rows.length}`);
console.log(`  runs counted             : ${rows.reduce((n, r) => n + r.runs, 0)}`);
console.log(`  ceiling                  : ${show(ceilingUnits)} BRRR`);
console.log(`  awarded                  : ${show(awardedUnits)} BRRR`);
console.log(`  to burn                   : ${show(burnedUnits)} BRRR`);
console.log(`  leaves                   : ${tree.claims.length}`);
console.log(`  root                     : ${tree.root.toString('hex')}`);

if (burnedUnits < 0n) {
    console.error(
        '\nAwarded more than the ceiling. That is a bug in allocation, not a ' +
            'rounding artefact — refusing to record it.'
    );
    process.exit(1);
}

console.log('\ntop of the day:');
tree.claims.slice(0, 5).forEach((claim) => {
    const entry = entries.find((e) => e.address === claim.address);
    console.log(
        `  ${claim.address.slice(0, 8)}…  ${show(BigInt(claim.amountUnlocked)).padStart(12)} BRRR   (score ${entry.score.toLocaleString('en-US')})`
    );
});

if (!commit) {
    console.log('\nDry run. Pass --commit to record this allocation.');
    process.exit(0);
}

// The distributor address is filled in by the publish step; the version is
// fixed here so the PDA it derives is decided by this record, not by whatever
// the publisher happens to pass later.
const version = 0;

await sql`
    insert into distributions (
        day, schedule_day, root, mint, distributor, version,
        total_awarded, ceiling, burned, node_count
    ) values (
        ${day}, ${scheduleDay}, ${tree.root}, ${mint}, ${''}, ${version},
        ${awardedUnits.toString()}, ${ceilingUnits.toString()},
        ${burnedUnits.toString()}, ${tree.claims.length}
    )
`;

for (const claim of tree.claims) {
    const entry = entries.find((e) => e.address === claim.address);
    await sql`
        insert into distribution_awards (day, address, leaf_index, amount, score)
        values (${day}, ${claim.address}, ${claim.index},
                ${claim.amountUnlocked.toString()}, ${entry.score})
    `;
}

console.log(`\nRecorded ${tree.claims.length} awards for ${day}.`);
console.log('Next: publish it on chain with scripts/publish-day.mjs');
