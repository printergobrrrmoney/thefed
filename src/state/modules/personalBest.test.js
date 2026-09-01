import personalBest, {
    recordPersonalBest,
    clearPersonalBest
} from './personalBest';

describe('personal best', () => {
    it('starts at nothing', () => {
        expect(personalBest(undefined, {})).toEqual({ score: 0, at: null });
    });

    it('records a first run', () => {
        const state = personalBest(undefined, recordPersonalBest(120));
        expect(state.score).toBe(120);
        expect(state.at).toBeTruthy();
    });

    it('keeps the better of two runs', () => {
        let state = personalBest(undefined, recordPersonalBest(500));
        state = personalBest(state, recordPersonalBest(100));
        expect(state.score).toBe(500);
    });

    it('takes a new high score', () => {
        let state = personalBest(undefined, recordPersonalBest(100));
        state = personalBest(state, recordPersonalBest(900));
        expect(state.score).toBe(900);
    });

    it('ignores a scoreless run', () => {
        const state = personalBest(undefined, recordPersonalBest(0));
        expect(state.score).toBe(0);
    });

    it('can be cleared', () => {
        let state = personalBest(undefined, recordPersonalBest(400));
        state = personalBest(state, clearPersonalBest());
        expect(state.score).toBe(0);
    });
});
