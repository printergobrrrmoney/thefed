import React from 'react';
import { shape, string, func, number } from 'prop-types';
import { connect } from 'react-redux';
import { Button } from 'react-bootstrap';
import { startGame } from '../../../state/modules/game';
import {
    sessionsRemaining,
    MAX_SESSIONS_PER_DAY
} from '../../../state/modules/sessions';
import { ReactComponent as Signature } from './trump-signature.svg';

const Welcome = ({ name, remaining, handleStartGame }) => (
    <>
        <p className="lead">Welcome, Chairman {name.last}!</p>
        <hr />
        <p className="text-left">
            Dear {name.first} Fed,
            <br />
            <br />
            After an extensive and lengthly review of your credentials and
            background, I would like to extend to you a nomination to become the{' '}
            <b>new, big league</b> Chair of the Board of Governors of the
            Federal Reserve System! Normally the Senate is supposed to confirm
            you, but Mitch and I have been having some personal beef lately, so
            we&apos;ll call it good. Contratulations, and good luck!
            <br />
            <br />
            Sincerely,
            <br />
            President Donald J. Trump
            <br />
            <Signature height="90px" />
        </p>
        {remaining > 0 ? (
            <>
                <Button
                    size="lg"
                    variant="primary"
                    onClick={handleStartGame}
                    className="mt-3"
                >
                    I accept
                </Button>
                <p className="text-muted mt-3 mb-0" style={{ fontSize: '0.8rem' }}>
                    {remaining} of {MAX_SESSIONS_PER_DAY} terms left today
                </p>
            </>
        ) : (
            <p className="mt-3 mb-0">
                You have served all {MAX_SESSIONS_PER_DAY} terms today. The
                Board reconvenes tomorrow.
            </p>
        )}
    </>
);

Welcome.propTypes = {
    remaining: number.isRequired,
    name: shape({
        first: string.isRequired,
        last: string.isRequired
    }),
    handleStartGame: func.isRequired
};

Welcome.defaultProps = {
    name: {
        first: 'Cheater',
        last: 'Cheater'
    }
};

const mapStateToProps = (state) => ({
    name: state.game.player.name,
    remaining: sessionsRemaining(state)
});

const mapDispatchToProps = {
    handleStartGame: startGame
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Welcome);
