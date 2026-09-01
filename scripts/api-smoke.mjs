/**
 * End-to-end check of the API against a real database.
 *
 * Calls the handlers directly rather than over HTTP, so it needs no server —
 * run it with a .env.development.local present:
 *
 *   node scripts/api-smoke.mjs
 *
 * It signs with real ed25519 keys, so the signature paths are genuinely
 * exercised rather than mocked. It writes rows; point it at a scratch database
 * if that matters.
 */
import { readFileSync } from 'fs';
import { generateKeyPairSync, sign } from 'crypto';

const env = Object.fromEntries(readFileSync(new URL('../.env.development.local', import.meta.url),'utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i), l.slice(i+1).replace(/^"|"$/g,'')];}));
Object.assign(process.env, env);
process.env.PUBLIC_DOMAIN = 'game.printergobrrr.money';

const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const b58 = (buf) => { let n=BigInt('0x'+buf.toString('hex')); let o=''; while(n>0n){o=B58[Number(n%58n)]+o;n/=58n;} for(const b of buf){if(b===0)o='1'+o;else break;} return o; };

const call = async (handler, { method='POST', body, headers={}, query={} } = {}) => {
  let status=0, payload=null;
  const res = { status(s){status=s; return this;}, setHeader(){return this;}, send(b){payload=JSON.parse(b);} };
  await handler({ method, body, headers, query }, res);
  return { status, body: payload };
};

const nonce   = (await import('../api/auth/nonce.mjs')).default;
const verify  = (await import('../api/auth/verify.mjs')).default;
const start   = (await import('../api/session/start.mjs')).default;
const submit  = (await import('../api/session/submit.mjs')).default;
const board   = (await import('../api/leaderboard.mjs')).default;
const { buildSignInMessage } = await import('../src/wallet/siws.js');
const { CORE_VERSION } = await import('../src/game-core/index.js');

const ok=[], bad=[];
const check=(name,cond)=> (cond?ok:bad).push(name);

// --- a player signs in ---
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const address = b58(publicKey.export({format:'der',type:'spki'}).subarray(-32));

const n1 = await call(nonce, { body: { address } });
check('nonce issued', n1.status===200 && !!n1.body.nonce);

const message = buildSignInMessage({ domain:'game.printergobrrr.money', address, nonce:n1.body.nonce, issuedAt:n1.body.issuedAt, expiresAt:n1.body.expiresAt });
const signature = sign(null, Buffer.from(message,'utf8'), privateKey).toString('base64');

const v1 = await call(verify, { body: { address, message, signature } });
check('signature accepted', v1.status===200 && !!v1.body.token);
const token = v1.body.token;
const auth = { authorization: `Bearer ${token}` };

// --- replay of the same nonce is refused ---
const v2 = await call(verify, { body: { address, message, signature } });
check('nonce cannot be replayed', v2.status===401);

// --- a forged signature is refused ---
const n2 = await call(nonce, { body: { address } });
const msg2 = buildSignInMessage({ domain:'game.printergobrrr.money', address, nonce:n2.body.nonce, issuedAt:n2.body.issuedAt, expiresAt:n2.body.expiresAt });
const other = generateKeyPairSync('ed25519');
const forged = sign(null, Buffer.from(msg2,'utf8'), other.privateKey).toString('base64');
const v3 = await call(verify, { body: { address, message: msg2, signature: forged } });
check('forged signature refused', v3.status===401 && v3.body.error==='bad-signature');

// --- no token, no session ---
const s0 = await call(start, {});
check('unauthenticated start refused', s0.status===401);

// --- play a session ---
const s1 = await call(start, { headers: auth });
check('session started', s1.status===200 && !!s1.body.sessionId);

// Stay inside the clock-drift allowance: a session opened moments ago cannot
// honestly contain actions from a minute into the future.
const actions = Array.from({length:20},(_,i)=>[i,'p']);
const sub = await call(submit, { headers: auth, body: { sessionId: s1.body.sessionId, log: { coreVersion: CORE_VERSION, actions } } });
check('log accepted', sub.status===200 && sub.body.accepted===true);
check('server computed the score, not the client', sub.body.score===20);

// --- a log claiming more time than really elapsed is refused ---
const sFast = await call(start, { headers: auth });
const impossible = await call(submit, { headers: auth, body: { sessionId: sFast.body.sessionId, log: { coreVersion: CORE_VERSION, actions: Array.from({length:600},(_,i)=>[i,'p']) } } });
check('log outrunning the wall clock refused', impossible.status===422 && impossible.body.problems.includes('shorter-than-wall-clock'));

// --- cannot submit twice ---
const dup = await call(submit, { headers: auth, body: { sessionId: s1.body.sessionId, log: { coreVersion: CORE_VERSION, actions } } });
check('double submit refused', dup.status===400 && dup.body.error==='already-submitted');

// --- a client claiming a huge score gets what the rules allow ---
const s2 = await call(start, { headers: auth });
const cheat = await call(submit, { headers: auth, body: { sessionId: s2.body.sessionId, score: 999999999, log: { coreVersion: CORE_VERSION, score: 999999999, actions: [[0,'p',1000000000]] } } });
check('inflated amount ignored', cheat.status===200 && cheat.body.score===1);

// --- another wallet cannot submit to someone else's session ---
// Uses its own wallets so the daily cap on the main one does not interfere.
const signInAs = async () => {
  const kp = generateKeyPairSync('ed25519');
  const addr = b58(kp.publicKey.export({format:'der',type:'spki'}).subarray(-32));
  const n = await call(nonce, { body: { address: addr } });
  const m = buildSignInMessage({ domain:'game.printergobrrr.money', address:addr, nonce:n.body.nonce, issuedAt:n.body.issuedAt, expiresAt:n.body.expiresAt });
  const sg = sign(null, Buffer.from(m,'utf8'), kp.privateKey).toString('base64');
  const v = await call(verify, { body: { address: addr, message: m, signature: sg } });
  return { addr, headers: { authorization: `Bearer ${v.body.token}` } };
};

const victim = await signInAs();
const thief  = await signInAs();
const victimSession = await call(start, { headers: victim.headers });
const steal = await call(submit, { headers: thief.headers, body: { sessionId: victimSession.body.sessionId, log: { coreVersion: CORE_VERSION, actions } } });
check('cannot submit to another wallet session', steal.status===401 && steal.body.error==='not-your-session');

// --- daily cap ---
const s4 = await call(start, { headers: auth });
check('fourth session refused by daily cap', s4.status===429 && s4.body.error==='daily-limit-reached');

// --- leaderboard ---
const lb = await call(board, { method:'GET', query:{limit:5} });
check('leaderboard returns verified scores', lb.status===200 && lb.body.entries.some(e=>e.address===address));

console.log('PASS:', ok.length); ok.forEach(n=>console.log('  +', n));
if (bad.length) { console.log('FAIL:', bad.length); bad.forEach(n=>console.log('  -', n)); process.exit(1); }
