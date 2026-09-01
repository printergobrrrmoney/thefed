/**
 * What is happening out there.
 *
 *   node scripts/watch.mjs          last 24 hours
 *   node scripts/watch.mjs 7        last 7 days
 *   node scripts/watch.mjs 1 logs   also dump rejected logs for inspection
 *
 * The point of running the game with worthless points is to find out how it
 * gets broken, which requires being able to see. Rejections are already stored
 * against every session; this reads them back.
 */
import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const env = Object.fromEntries(
    readFileSync(new URL('../.env.development.local', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => l.includes('='))
        .map((l) => {
            const i = l.indexOf('=');
            return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
        })
);

const sql = neon(env.DATABASE_URL);
const days = Number(process.argv[2]) || 1;
const showLogs = process.argv.includes('logs');
const since = `${days} days`;

const heading = (text) => console.log(`\n${text}\n${'-'.repeat(text.length)}`);
const money = (n) => `$${Number(n).toLocaleString('en-US')}`;

const [totals] = await sql`
    select
        count(*)::int                                        as sessions,
        count(*) filter (where submitted_at is not null)::int as submitted,
        count(*) filter (where rejected)::int                 as rejected,
        count(distinct address)::int                          as players
    from sessions
    where started_at > now() - ${since}::interval
`;

heading(`Last ${days} day${days === 1 ? '' : 's'}`);
console.log(`players        ${totals.players}`);
console.log(`sessions       ${totals.sessions}`);
console.log(`submitted      ${totals.submitted}`);
console.log(
    `abandoned      ${totals.sessions - totals.submitted}` +
        '   (started but never submitted — a refresh loses the log)'
);
console.log(`rejected       ${totals.rejected}`);

const reasons = await sql`
    select unnest(problems) as problem, count(*)::int as n
    from sessions
    where started_at > now() - ${since}::interval and rejected
    group by problem order by n desc
`;

heading('Why runs were rejected');
if (!reasons.length) console.log('nothing rejected');
reasons.forEach((r) => console.log(`${String(r.n).padStart(5)}  ${r.problem}`));

const endings = await sql`
    select coalesce(ended_reason, 'not submitted') as ending, count(*)::int as n
    from sessions
    where started_at > now() - ${since}::interval
    group by ending order by n desc
`;

heading('How runs ended');
endings.forEach((r) => console.log(`${String(r.n).padStart(5)}  ${r.ending}`));

const top = await sql`
    select s.address, p.display_name, max(s.score) as score, count(*)::int as runs
    from sessions s join players p on p.address = s.address
    where s.rejected = false and s.score is not null
      and s.started_at > now() - ${since}::interval
    group by s.address, p.display_name
    order by score desc limit 10
`;

heading('Top verified scores');
if (!top.length) console.log('no verified runs yet');
top.forEach((r, i) =>
    console.log(
        `${String(i + 1).padStart(3)}. ${money(r.score).padEnd(18)} ` +
            `${(r.display_name || 'anonymous').padEnd(24)} ` +
            `${r.address.slice(0, 6)}…${r.address.slice(-4)}  ${r.runs} run(s)`
    )
);

/**
 * Wallets funded or behaving alike are what a farm looks like. This is a crude
 * first pass — several addresses appearing within a few seconds of each other
 * is worth a look, not proof of anything.
 */
const bursts = await sql`
    select date_trunc('minute', created_at) as minute, count(*)::int as n
    from players
    where created_at > now() - ${since}::interval
    group by minute having count(*) > 3
    order by n desc limit 10
`;

heading('Minutes with more than three new wallets');
if (!bursts.length) console.log('none — nothing that looks like a burst');
bursts.forEach((r) =>
    console.log(`${String(r.n).padStart(5)}  ${r.minute.toISOString()}`)
);

const suspicious = await sql`
    select address, score, ticks, ended_reason, started_at
    from sessions
    where rejected = false and score is not null
      and started_at > now() - ${since}::interval
      and ticks > 0
    order by (score::numeric / greatest(ticks, 1)) desc
    limit 5
`;

heading('Highest earnings per second (verified)');
if (!suspicious.length) console.log('nothing to show');
suspicious.forEach((r) =>
    console.log(
        `${money(Math.round(r.score / Math.max(r.ticks, 1))).padEnd(16)}/s  ` +
            `${money(r.score).padEnd(18)} over ${r.ticks}s  ` +
            `${r.address.slice(0, 6)}…  ${r.ended_reason}`
    )
);

if (showLogs) {
    const rejects = await sql`
        select id, address, problems, log
        from sessions
        where rejected and started_at > now() - ${since}::interval
        order by started_at desc limit 5
    `;
    heading('Recent rejected logs');
    rejects.forEach((r) => {
        console.log(`\n${r.id}  ${r.address.slice(0, 8)}…  ${r.problems}`);
        console.log(JSON.stringify(r.log).slice(0, 400));
    });
}

console.log();
