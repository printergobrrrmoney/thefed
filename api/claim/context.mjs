import { PublicKey } from '@solana/web3.js';
import {
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { db } from '../_lib/db.mjs';
import { json, badRequest, methodNotAllowed } from '../_lib/http.mjs';
import { isValidAddress } from '../_lib/crypto.mjs';
import { distributionForDay } from '../_lib/distribution.mjs';

/**
 * The addresses and blockhash a claim needs, which the browser cannot work out
 * for itself.
 *
 * Deriving a program address needs an on-curve check, and a blockhash has to
 * come from a node. Both are supplied here — but none of it is trusted: the
 * distributor checks the vault against its own record, checks the claim status
 * against its seeds, and checks the destination's mint and owner. A wrong
 * address from here produces a refused transaction, not a lost token. What the
 * browser keeps for itself is deciding what the transaction contains.
 */
const RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const rpc = async (method, params) => {
    const response = await fetch(RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const body = await response.json();
    if (body.error) throw new Error(body.error.message || 'rpc failed');
    return body.result;
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Never cached: a stale blockhash is a transaction that cannot land.
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        return res.status(204).send('');
    }
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'OPTIONS']);

    const address = (req.query && req.query.address) || '';
    const day = (req.query && req.query.day) || '';
    if (!isValidAddress(address)) return badRequest(res, 'bad-address');
    if (!DAY.test(day)) return badRequest(res, 'bad-day');

    const sql = db();
    const distribution = await distributionForDay(sql, day);
    if (!distribution || !distribution.distributor) {
        return badRequest(res, 'not-published');
    }

    const claimant = new PublicKey(address);
    const distributor = new PublicKey(distribution.distributor);
    const mint = new PublicKey(distribution.mint);

    const [claimStatus] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('ClaimStatus'),
            claimant.toBuffer(),
            distributor.toBuffer()
        ],
        new PublicKey('mERKcfxMC5SqJn4Ld4BUris3WKZZ1ojjWJ3A3J5CKxv')
    );
    // The vault is the distributor's own associated account, off curve because
    // the distributor is itself a program address.
    const vault = getAssociatedTokenAddressSync(mint, distributor, true);
    const destination = getAssociatedTokenAddressSync(mint, claimant);

    let recentBlockhash;
    let exists;
    try {
        const [blockhash, account] = await Promise.all([
            rpc('getLatestBlockhash', [{ commitment: 'finalized' }]),
            rpc('getAccountInfo', [destination.toBase58(), { encoding: 'base64' }])
        ]);
        recentBlockhash = blockhash.value.blockhash;
        exists = Boolean(account && account.value);
    } catch (error) {
        return json(res, 502, { error: 'rpc-unavailable', detail: error.message });
    }

    return json(res, 200, {
        address,
        day,
        distributor: distributor.toBase58(),
        mint: mint.toBase58(),
        claimStatus: claimStatus.toBase58(),
        vault: vault.toBase58(),
        destination: destination.toBase58(),
        recentBlockhash,
        // Sent only when the token account is missing. Idempotent, so a race
        // between two tabs costs nothing.
        createDestination: exists
            ? null
            : {
                  programId: ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
                  keys: [
                      { address, isSigner: true, isWritable: true },
                      { address: destination.toBase58(), isSigner: false, isWritable: true },
                      { address, isSigner: false, isWritable: false },
                      { address: mint.toBase58(), isSigner: false, isWritable: false },
                      { address: '11111111111111111111111111111111', isSigner: false, isWritable: false },
                      { address: TOKEN_PROGRAM_ID.toBase58(), isSigner: false, isWritable: false }
                  ],
                  // 1 selects CreateIdempotent over Create.
                  data: [1]
              }
    });
}
