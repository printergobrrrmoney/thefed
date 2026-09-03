-- Published distributions.
--
-- One row per day, plus the awards that day paid. Together these are the record
-- a player can be shown when they ask why they got what they got, and the
-- record anyone can check a published root against.
--
-- The awards are stored rather than the proofs. A proof is derivable from the
-- full set of leaves in order, so keeping the leaves means every proof we serve
-- is rebuilt from the same data the root was built from. Storing proofs instead
-- would let them drift from the root they are supposed to prove.

create table if not exists distributions (
    -- The day being paid for, in UTC. One distribution per day, ever.
    day             date primary key,
    -- Which day of the release schedule this was, which fixes the multiplier.
    schedule_day    integer not null,
    -- The 32-byte merkle root, exactly as the on-chain distributor stores it.
    root            bytea not null,
    mint            text not null,
    -- Distributor PDA, and the version that derives it alongside the mint.
    distributor     text not null,
    version         bigint not null,
    -- All amounts are base units, never display units.
    total_awarded   bigint not null,
    ceiling         bigint not null,
    burned          bigint not null,
    node_count      integer not null,
    -- Signatures, so every on-chain step can be looked up. Null until done.
    created_tx      text,
    funded_tx       text,
    burned_tx       text,
    published_at    timestamptz not null default now()
);

create table if not exists distribution_awards (
    day         date not null references distributions (day) on delete cascade,
    address     text not null,
    -- Position in the tree. The proof depends on it, so it is part of the record.
    leaf_index  integer not null,
    amount      bigint not null,
    -- What earned it. Kept so a disputed award can be explained, not just asserted.
    score       bigint not null,
    claimed_at  timestamptz,
    claim_tx    text,
    primary key (day, address)
);

create index if not exists distribution_awards_address_idx
    on distribution_awards (address);

create unique index if not exists distribution_awards_leaf_idx
    on distribution_awards (day, leaf_index);
