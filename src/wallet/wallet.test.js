import { detectWallets, availableWallets, isUsable } from './providers';
import {
    buildSignInMessage,
    parseSignInMessage,
    messageProblems,
    SIGN_IN_STATEMENT
} from './siws';
import {
    connect,
    signIn,
    disconnect,
    shortAddress,
    utf8Bytes,
    ERRORS
} from './connect';

const ADDRESS = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

const fakeProvider = (overrides = {}) => ({
    connect: jest
        .fn()
        .mockResolvedValue({ publicKey: { toString: () => ADDRESS } }),
    signMessage: jest.fn().mockResolvedValue({
        signature: new Uint8Array([1, 2, 3, 4])
    }),
    disconnect: jest.fn().mockResolvedValue(undefined),
    ...overrides
});

afterEach(() => {
    delete window.phantom;
    delete window.solana;
    delete window.solflare;
    delete window.backpack;
});

describe('detection', () => {
    it('finds nothing when no wallet is installed', () => {
        expect(availableWallets()).toEqual([]);
    });

    it('finds Phantom on its own namespace', () => {
        window.phantom = { solana: fakeProvider() };
        expect(availableWallets().map((w) => w.id)).toEqual(['phantom']);
    });

    it('finds Solflare', () => {
        window.solflare = fakeProvider();
        expect(availableWallets().map((w) => w.id)).toEqual(['solflare']);
    });

    it('does not claim a provider that cannot sign messages', () => {
        window.phantom = { solana: { connect: () => {} } };
        expect(availableWallets()).toEqual([]);
    });

    it('still lists unavailable wallets so they can be offered as installs', () => {
        const all = detectWallets();
        expect(all).toHaveLength(3);
        expect(all.every((w) => w.available === false)).toBe(true);
        expect(all.every((w) => typeof w.url === 'string')).toBe(true);
    });

    it('rejects a provider missing signMessage', () => {
        expect(isUsable({ connect: () => {} })).toBe(false);
        expect(isUsable(null)).toBe(false);
    });
});

describe('the sign-in message', () => {
    const fields = {
        domain: 'game.printergobrrr.money',
        address: ADDRESS,
        nonce: 'abc123',
        issuedAt: '2026-08-31T12:00:00.000Z',
        expiresAt: '2026-08-31T12:05:00.000Z'
    };
    const at = (iso) => Date.parse(iso);

    it('says plainly that it is not a transaction', () => {
        expect(buildSignInMessage(fields)).toContain('moves no funds');
        expect(SIGN_IN_STATEMENT).toMatch(/not a transaction/);
    });

    it('round-trips through the parser', () => {
        const parsed = parseSignInMessage(buildSignInMessage(fields));
        expect(parsed.domain).toBe(fields.domain);
        expect(parsed.address).toBe(fields.address);
        expect(parsed.nonce).toBe(fields.nonce);
        expect(parsed.expiresAt).toBe(fields.expiresAt);
    });

    it('accepts a message that matches what was issued', () => {
        expect(
            messageProblems(buildSignInMessage(fields), {
                domain: fields.domain,
                address: fields.address,
                nonce: fields.nonce,
                now: at('2026-08-31T12:01:00.000Z')
            })
        ).toEqual([]);
    });

    it('rejects a signature over another site’s message', () => {
        const elsewhere = buildSignInMessage({
            ...fields,
            domain: 'evil.example'
        });
        expect(
            messageProblems(elsewhere, {
                domain: fields.domain,
                address: fields.address,
                nonce: fields.nonce,
                now: at('2026-08-31T12:01:00.000Z')
            })
        ).toContain('wrong-domain');
    });

    it('rejects a replayed nonce', () => {
        expect(
            messageProblems(buildSignInMessage(fields), {
                domain: fields.domain,
                address: fields.address,
                nonce: 'a-different-nonce',
                now: at('2026-08-31T12:01:00.000Z')
            })
        ).toContain('wrong-nonce');
    });

    it('rejects a message signed for a different wallet', () => {
        expect(
            messageProblems(buildSignInMessage(fields), {
                domain: fields.domain,
                address: 'SomeOtherAddress1111111111111111111111111111',
                nonce: fields.nonce,
                now: at('2026-08-31T12:01:00.000Z')
            })
        ).toContain('wrong-address');
    });

    it('rejects an expired message', () => {
        expect(
            messageProblems(buildSignInMessage(fields), {
                domain: fields.domain,
                address: fields.address,
                nonce: fields.nonce,
                now: at('2026-08-31T12:06:00.000Z')
            })
        ).toContain('expired');
    });

    it('rejects junk', () => {
        expect(messageProblems('hello', {})).toEqual(['unparseable-message']);
        expect(parseSignInMessage(null)).toBeNull();
    });
});

describe('connecting', () => {
    it('returns the address', async () => {
        window.phantom = { solana: fakeProvider() };
        await expect(connect('phantom')).resolves.toEqual({
            walletId: 'phantom',
            address: ADDRESS
        });
    });

    it('reads the key off the provider when connect does not return one', async () => {
        window.phantom = {
            solana: fakeProvider({
                connect: jest.fn().mockResolvedValue(undefined),
                publicKey: { toString: () => ADDRESS }
            })
        };
        await expect(connect('phantom')).resolves.toMatchObject({
            address: ADDRESS
        });
    });

    it('reports a missing wallet distinctly', async () => {
        await expect(connect('phantom')).rejects.toMatchObject({
            code: ERRORS.NOT_FOUND
        });
    });

    it('reports a user rejection distinctly from a failure', async () => {
        window.phantom = {
            solana: fakeProvider({
                connect: jest
                    .fn()
                    .mockRejectedValue({ code: 4001, message: 'User rejected' })
            })
        };
        await expect(connect('phantom')).rejects.toMatchObject({
            code: ERRORS.REJECTED
        });
    });
});

describe('signing in', () => {
    const args = {
        walletId: 'phantom',
        address: ADDRESS,
        nonce: 'abc123',
        issuedAt: '2026-08-31T12:00:00.000Z',
        expiresAt: '2026-08-31T12:05:00.000Z',
        domain: 'game.printergobrrr.money'
    };

    it('signs the message and base64-encodes the signature', async () => {
        const provider = fakeProvider();
        window.phantom = { solana: provider };

        const result = await signIn(args);

        expect(result.address).toBe(ADDRESS);
        expect(result.signature).toBe('AQIDBA=='); // [1,2,3,4]
        expect(result.message).toContain(args.nonce);
        expect(provider.signMessage).toHaveBeenCalledTimes(1);
    });

    it('signs the exact bytes of the message it returns', async () => {
        const provider = fakeProvider();
        window.phantom = { solana: provider };

        const result = await signIn(args);
        const [bytes] = provider.signMessage.mock.calls[0];
        expect(Array.from(bytes)).toEqual(Array.from(utf8Bytes(result.message)));
    });

    it('never asks the wallet for a transaction', async () => {
        const provider = fakeProvider({
            signTransaction: jest.fn(),
            signAllTransactions: jest.fn(),
            signAndSendTransaction: jest.fn(),
            request: jest.fn()
        });
        window.phantom = { solana: provider };

        await connect('phantom');
        await signIn(args);
        await disconnect('phantom');

        expect(provider.signTransaction).not.toHaveBeenCalled();
        expect(provider.signAllTransactions).not.toHaveBeenCalled();
        expect(provider.signAndSendTransaction).not.toHaveBeenCalled();
        expect(provider.request).not.toHaveBeenCalled();
    });

    it('surfaces a refused signature as a rejection', async () => {
        window.phantom = {
            solana: fakeProvider({
                signMessage: jest.fn().mockRejectedValue({ code: 4001 })
            })
        };
        await expect(signIn(args)).rejects.toMatchObject({
            code: ERRORS.REJECTED
        });
    });

    it('does not throw when a wallet refuses to disconnect', async () => {
        window.phantom = {
            solana: fakeProvider({
                disconnect: jest.fn().mockRejectedValue(new Error('nope'))
            })
        };
        await expect(disconnect('phantom')).resolves.toBeUndefined();
    });
});

describe('utf8Bytes', () => {
    it('encodes ascii one byte per character', () => {
        expect(Array.from(utf8Bytes('abc'))).toEqual([97, 98, 99]);
    });

    it('encodes a two-byte character', () => {
        expect(Array.from(utf8Bytes(String.fromCharCode(0xe9)))).toEqual([
            0xc3,
            0xa9
        ]);
    });

    it('encodes a three-byte character', () => {
        expect(Array.from(utf8Bytes(String.fromCharCode(0x20ac)))).toEqual([
            0xe2,
            0x82,
            0xac
        ]);
    });

    it('encodes a surrogate pair as four bytes', () => {
        const rocket = String.fromCharCode(0xd83d, 0xde80);
        expect(Array.from(utf8Bytes(rocket))).toEqual([0xf0, 0x9f, 0x9a, 0x80]);
    });

    it('encodes the ellipsis used in shortened addresses', () => {
        expect(Array.from(utf8Bytes(String.fromCharCode(0x2026)))).toEqual([
            0xe2,
            0x80,
            0xa6
        ]);
    });
});

describe('shortAddress', () => {
    it('keeps both ends', () => {
        expect(shortAddress(ADDRESS)).toBe(
            `7xKX${String.fromCharCode(0x2026)}gAsU`
        );
    });

    it('leaves short values alone', () => {
        expect(shortAddress('abc')).toBe('abc');
        expect(shortAddress(undefined)).toBe('');
    });
});
