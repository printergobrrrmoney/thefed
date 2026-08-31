import React from 'react';
import { number, string, func } from 'prop-types';
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
                <p className={classNames(styles.score, 'mb-3')}>
                    ${commatize(totalPrinted)}
                </p>
                <p className="text-muted mb-4">
                    Time in office: {duration(endedAt)}
                </p>

                {canPlayAgain ? (
                    <Button
                        size="lg"
                        variant="primary"
                        onClick={handleStartGame}
                    >
                        Serve another term
                    </Button>
                ) : (
                    <p className="mb-3">
                        That is all {MAX_SESSIONS_PER_DAY} terms for today. The
                        Board reconvenes tomorrow.
                    </p>
                )}

                {canPlayAgain && (
                    <p className={classNames(styles.remaining, 'mt-3', 'mb-0')}>
                        {remaining} of {MAX_SESSIONS_PER_DAY} terms left today
                    </p>
                )}

                <Button
                    variant="link"
                    className={classNames(styles.leave, 'mt-2')}
                    onClick={handleEndGame}
                >
                    Leave the Fed
                </Button>
            </Card>
        </Container>
    );
};

SessionSummary.propTypes = {
    totalPrinted: number.isRequired,
    endedAt: number.isRequired,
    endedReason: string,
    remaining: number.isRequired,
    handleStartGame: func.isRequired,
    handleEndGame: func.isRequired
};

SessionSummary.defaultProps = {
    endedReason: END_RESIGNED
};

const mapStateToProps = (state) => ({
    totalPrinted: state.game.totalPrinted,
    endedAt: state.game.endedAt,
    endedReason: state.game.endedReason,
    remaining: sessionsRemaining(state)
});

const mapDispatchToProps = {
    handleStartGame: startGame,
    handleEndGame: endGame
};

export default connect(mapStateToProps, mapDispatchToProps)(SessionSummary);
