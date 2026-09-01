-- The Fed — schema
--
-- Two things this stores that matter: the raw replay log of every accepted
-- session, and the score the server computed from it. Keeping the log means a
-- disputed payout can be re-run and the arithmetic shown, rather than asking
-- anyone to trust a number in a row.

create table if not exists players (
    address       text primary key,
    display_name  text,
    created_at    timestamptz not null default now(),
    last_seen_at  timestamptz not null default now()
);

-- Sign-in challenges. A nonce is single-use: claiming it is what stops a
-- signature captured elsewhere being replayed here.
create table if not exists auth_nonces (
    nonce       text primary key,
    address     text not null,
    issued_at   timestamptz not null default now(),
    expires_at  timestamptz not null,
    used_at     timestamptz
);

create index if not exists auth_nonces_expires_idx on auth_nonces (expires_at);

-- A play session, opened server-side so its start time is not the client's to
-- claim. `core_version` records which rules it ran under, because a log
-- recorded under older rules no longer replays to the same score.
create table if not exists sessions (
    id            uuid primary key,
    address       text not null references players (address) on delete cascade,
    core_version  integer not null,
    started_at    timestamptz not null default now(),
    submitted_at  timestamptz,
    -- The score the server computed. The client's opinion is not stored.
    score         bigint,
    ticks         integer,
    ended_reason  text,
    rejected      boolean not null default false,
    problems      text[] not null default '{}',
    -- The evidence. Kept so any score can be recomputed from scratch.
    log           jsonb
);

create index if not exists sessions_address_idx on sessions (address);
create index if not exists sessions_score_idx on sessions (score desc)
    where rejected = false;
create index if not exists sessions_started_idx on sessions (started_at);

-- Daily allowance, enforced here rather than in the browser where the player
-- can edit it. One row per player per day.
create table if not exists daily_sessions (
    address  text not null references players (address) on delete cascade,
    day      date not null,
    started  integer not null default 0,
    primary key (address, day)
);

-- Fixed-window rate limiting. A dedicated store would be faster, but this runs
-- at the scale of people clicking a button, and one fewer service is one fewer
-- thing to go wrong.
create table if not exists rate_limits (
    bucket        text not null,
    identity      text not null,
    window_start  timestamptz not null,
    hits          integer not null default 0,
    primary key (bucket, identity, window_start)
);

create index if not exists rate_limits_window_idx on rate_limits (window_start);
