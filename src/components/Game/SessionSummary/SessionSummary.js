import React from 'react';
import { number, string, func, bool, arrayOf } from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { Container, Card, Button } from 'react-bootstrap';
import { END_REASONS, END_RESIGNED } from '../../../game-core';
import { startGame, endGame } from '../../../state/modules/game';
import {
    sessionsRemaining,
    MAX_SESSIONS_PER_DAY
} from '../../../state/modules/sessions';
import commatize from '../../../commatizeNumber';
import Leaderboard from '../../Leaderboard';
import Rewards from '../../Rewards';
import styles from './SessionSummary.module.scss';

const duration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

export const SessionSummary = ({
    totalPrinted,
    endedAt,
    endedReason,
    remaining,
    verified,
    submitting,
    problems,
    signedIn,
    handleStartGame,
    handleEndGame
}) => {
    const reason = END_REASONS[endedReason] || END_REASONS[END_RESIGNED];
    const canPlayAgain = remaining > 0;

    return (
        <Container
            className={classNames(
                styles.root,
                'd-flex',
                'align-items-center',
                'justify-content-center',
                'h-100'
            )}
        >
            <Card body className={classNames(styles.card, 'text-center')}>
                <h2 className={classNames(styles.title, 'mb-1')}>
                    {reason.title}
                </h2>
                <p className="text-muted mb-4">{reason.detail}</p>

                <p className={classNames(styles.label, 'mb-0')}>
                    Total printed
                </p>
                <p className={classNames(styles.score, 'mb-1')}>
                    ${commatize(verified !== null ? verified : totalPrinted)}
                </p>
                <p className={classNames(styles.verdict, 'mb-3')}>
                    {submitting && 'Checking your run…'}
                    {!submitting && verified !== null && 'Verified by the server'}
                    {!submitting && problems && problems.length > 0 && (
                        <span className="text-danger">
                            Not counted: {problems.join(', ')}
                        </span>
                    )}
                    {!submitting &&
                        verified === null &&
                        !problems &&
                        !signedIn &&
                        'Sign in before playing to have a run counted'}
                </p>
                <p className="text-muted mb-4">
                    Time in office: {duration(endedAt)}
                </p>

                <Button size="lg" variant="primary" onClick={handleStartGame}>
                    Serve another term
                </Button>

                {/* Out of terms means the next run is not scored, not that the
                    game is over. There is always a way to keep playing. */}
                {signedIn && (
                    <p className={classNames(styles.remaining, 'mt-3', 'mb-0')}>
                        {canPlayAgain
                            ? `${remaining} of ${MAX_SESSIONS_PER_DAY} terms left today`
                            : `All ${MAX_SESSIONS_PER_DAY} terms served today — play on, but the next run will not be scored.`}
                    </p>
                )}

                <Button
                    variant="link"
                    className={classNames(styles.leave, 'mt-2')}
                    onClick={handleEndGame}
                >
                    Leave the Fed
                </Button>

                <Leaderboard className="mt-4" />
                <Rewards compact className="mt-4" />
            </Card>
        </Container>
    );
};

SessionSummary.propTypes = {
    totalPrinted: number.isRequired,
    verified: number,
    submitting: bool.isRequired,
    problems: arrayOf(string),
    signedIn: bool.isRequired,
    endedAt: number.isRequired,
    endedReason: string,
    remaining: number.isRequired,
    handleStartGame: func.isRequired,
    handleEndGame: func.isRequired
};

SessionSummary.defaultProps = {
    endedReason: END_RESIGNED,
    verified: null,
    problems: null
};

const mapStateToProps = (state) => ({
    totalPrinted: state.game.totalPrinted,
    endedAt: state.game.endedAt,
    endedReason: state.game.endedReason,
    remaining: sessionsRemaining(state),
    verified: state.submission.score,
    submitting: state.submission.submitting,
    problems: state.submission.problems,
    signedIn: state.wallet.signedIn
});

const mapDispatchToProps = {
    handleStartGame: startGame,
    handleEndGame: endGame
};

export default connect(mapStateToProps, mapDispatchToProps)(SessionSummary);
