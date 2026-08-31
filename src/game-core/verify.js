import { createInitialState, reducer } from './reducer';
import { incrementTimer, printMoney, purchaseProduct } from './actions';
import { SESSION_SECONDS, isSessionOver } from './session';
import { CORE_VERSION } from './version';

/**
 * Replay log format.
 *
 * An entry records *that* a player acted and *when*, never what it was worth.
 * The verifier builds the real action itself, so a log cannot claim a click
 * printed a million dollars — the amount is not the client's to supply. Ticks
 * are not recorded either: the verifier generates them, so a log cannot invent
 * time it did not sit through.
 *
 *   [tick, 'p']            a print click
 *   [tick, 'b', 'Mint']    a purchase
 */
export const ACTION_PRINT = 'p';
export const ACTION_BUY = 'b';

/** A full hour of frantic clicking, with room to spare. */
export const MAX_ACTIONS = 40000;

/** Above this in a single second, it is not a hand. */
export const MAX_ACTIONS_PER_TICK = 12;

/** Tolerance for the gap between session length and elapsed wall clock. */
export const CLOCK_DRIFT_SECONDS = 30;

export const REJECTIONS = {
    VERSION: 'core-version-mismatch',
    SHAPE: 'malformed-log',
    TOO_MANY: 'too-many-actions',
    TICK_RANGE: 'tick-out-of-range',
    TICK_ORDER: 'ticks-out-of-order',
    UNKNOWN_ACTION: 'unknown-action',
    RATE: 'inhuman-action-rate',
    TOO_FAST: 'shorter-than-wall-clock'
};

const isInt = (n) => typeof n === 'number' && Number.isInteger(n);

const structuralProblems = (log) => {
    const problems = [];

    if (log.coreVersion !== CORE_VERSION) problems.push(REJECTIONS.VERSION);
    if (!Array.isArray(log.actions)) {
        problems.push(REJECTIONS.SHAPE);
        return problems;
    }
    if (log.actions.length > MAX_ACTIONS) problems.push(REJECTIONS.TOO_MANY);

    let previousTick = -1;
    let runTick = -1;
    let runCount = 0;

    for (let i = 0; i < log.actions.length; i += 1) {
        const entry = log.actions[i];
        if (!Array.isArray(entry) || entry.length < 2) {
            problems.push(REJECTIONS.SHAPE);
            break;
        }

        const [tick, kind, payload] = entry;

        if (!isInt(tick) || tick < 0 || tick > SESSION_SECONDS) {
            problems.push(REJECTIONS.TICK_RANGE);
            break;
        }
        if (tick < previousTick) {
            problems.push(REJECTIONS.TICK_ORDER);
            break;
        }
        if (kind !== ACTION_PRINT && kind !== ACTION_BUY) {
            problems.push(REJECTIONS.UNKNOWN_ACTION);
            break;
        }
        if (kind === ACTION_BUY && typeof payload !== 'string') {
            problems.push(REJECTIONS.SHAPE);
            break;
        }

        if (tick === runTick) {
            runCount += 1;
            if (runCount > MAX_ACTIONS_PER_TICK) {
                problems.push(REJECTIONS.RATE);
                break;
            }
        } else {
            runTick = tick;
            runCount = 1;
        }

        previousTick = tick;
    }

    return problems;
};

/**
 * A session cannot have taken less real time than the ticks it claims. The
 * reverse is fine and expected — a player can pause, or close a tab — because
 * the duration cap already bounds the other end.
 */
const outranWallClock = ({ startedAt, submittedAt, actions }) => {
    if (!isInt(startedAt) || !isInt(submittedAt)) return false;
    if (!Array.isArray(actions) || actions.length === 0) return false;

    const lastTick = actions[actions.length - 1][0];
    if (!isInt(lastTick)) return false;

    const elapsed = (submittedAt - startedAt) / 1000;
    return lastTick > elapsed + CLOCK_DRIFT_SECONDS;
};

const applyEntry = (state, [, kind, payload]) =>
    kind === ACTION_PRINT
        ? // The amount comes from state, never from the log.
          reducer(state, printMoney(state.printMoneyDenomination))
        : reducer(state, purchaseProduct(payload));

/**
 * Replay a log and return the authoritative result. The score this produces is
 * the only one that counts; whatever the client displayed is irrelevant.
 *
 * Actions that the rules reject — an unaffordable purchase, anything after the
 * session closed — are simply no-ops, exactly as they are in the live game. A
 * dishonest log therefore does not error, it just scores badly.
 */
export const verifyLog = (log = {}) => {
    const problems = structuralProblems(log);
    if (outranWallClock(log)) problems.push(REJECTIONS.TOO_FAST);

    if (problems.length) {
        return { ok: false, score: 0, ticks: 0, problems, state: null };
    }

    const actions = log.actions;
    let state = createInitialState();
    let i = 0;

    while (!isSessionOver(state) && state.time <= SESSION_SECONDS) {
        while (i < actions.length && actions[i][0] === state.time) {
            state = applyEntry(state, actions[i]);
            i += 1;
        }
        if (isSessionOver(state)) break;
        state = reducer(state, incrementTimer());
    }

    return {
        ok: true,
        score: state.totalPrinted,
        ticks: state.endedAt === null ? state.time : state.endedAt,
        endedReason: state.endedReason,
        problems: [],
        state
    };
};

export default verifyLog;
