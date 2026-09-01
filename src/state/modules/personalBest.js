/**
 * The best run this browser has played, whether or not anyone was signed in.
 *
 * Its job is to give an unscored run somewhere to go. Without it, playing
 * without a wallet produces nothing at all — you finish, and the game has
 * quietly forgotten you were ever there, which reads as a bug even though it
 * is the intended behaviour.
 *
 * It is local and unverified by definition, so it never mixes with the real
 * standings: the leaderboard shows it as your own unsaved run, marked as such.
 */
const RECORDED = 'thefed/personalBest/RECORDED';
const CLEARED = 'thefed/personalBest/CLEARED';

const initialState = {
    score: 0,
    at: null
};

export default (state = initialState, action = {}) => {
    switch (action.type) {
        case RECORDED:
            return action.score > state.score
                ? { score: action.score, at: action.at }
                : state;
        case CLEARED:
            return initialState;
        default:
            return state;
    }
};

export const recordPersonalBest = (score) => ({
    type: RECORDED,
    score,
    at: new Date().toISOString()
});

export const clearPersonalBest = () => ({ type: CLEARED });

export const personalBest = ({ personalBest: best }) => best.score;
