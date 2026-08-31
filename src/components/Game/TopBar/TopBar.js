import React from 'react';
import { shape, bool, func, number } from 'prop-types';
import classNames from 'classnames';
import { isMobile } from 'react-device-detect';
import sizeMe from 'react-sizeme';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { Navbar } from 'react-bootstrap';
import {
    faVolumeUp,
    faVolumeXmark,
    faQuestionCircle,
    faTimesCircle
} from '@fortawesome/free-solid-svg-icons';
import { closeSession } from '../../../state/modules/game';
import {
    END_RESIGNED,
    SESSION_SECONDS,
    isSessionOver
} from '../../../game-core';
import { toggleVolume } from '../../../state/modules/preferences';
import { renderModal } from '../../../state/modules/modal';
import Logo from '../../Logo';
import MoneyTicker from './MoneyTicker';
import NavbarButton from './NavbarButton';
import Help from '../Help';
import EndGameWarning from '../EndGameWarning';
import styles from './TopBar.module.scss';

const clock = (seconds) => {
    const mins = Math.floor(seconds / 60);
    return `${mins}:${(seconds % 60).toString().padStart(2, '0')}`;
};

const TopBar = ({
    size: { width: browserWidth },
    mute,
    time,
    over,
    handleVolume,
    handleEndGame,
    handleRenderModal
}) => {
    const remaining = Math.max(0, SESSION_SECONDS - time);
    const runningOut = remaining <= 60;

    const handleHelpModal = () =>
        handleRenderModal({
            render: closeModal => <Help handleCloseModal={closeModal} />,
            size: 'lg'
        });

    const handleEndGameModal = () =>
        handleRenderModal({
            render: closeModal => (
                <EndGameWarning
                    handleCloseModal={closeModal}
                    handleEndGame={handleEndGame}
                />
            )
        });

    return (
        <header>
            <Navbar
                variant="dark"
                bg="primary"
                fixed="top"
                expand="md"
                className={classNames(styles.root)}
            >
                <Navbar.Brand>
                    <Logo
                        height="40px"
                        fill="#FFF"
                        transparent
                        symbol={browserWidth < 768}
                        className="mr-auto"
                    />
                </Navbar.Brand>
                <MoneyTicker />
                {!over && (
                <span
                    aria-label="Time remaining in this term"
                    title="Time remaining in this term"
                    className={classNames(
                        styles.clock,
                        'ml-3',
                        runningOut ? 'text-warning' : 'text-white-50'
                    )}
                >
                    {clock(remaining)}
                </span>
                )}
                <Navbar.Toggle
                    aria-controls="top-bar"
                    className={classNames(styles.toggle, 'border-white')}
                />
                <Navbar.Collapse
                    id="top-bar"
                    className={classNames(
                        'flex-grow-0',
                        'ml-auto',
                        'text-center',
                        'text-md-right'
                    )}
                >
                    {!isMobile && (
                        <NavbarButton
                            label={mute ? 'Enable sound' : 'Mute sound'}
                            icon={mute ? faVolumeXmark : faVolumeUp}
                            onClick={handleVolume}
                        />
                    )}
                    <NavbarButton
                        label="Help"
                        icon={faQuestionCircle}
                        className="mx-2"
                        onClick={handleHelpModal}
                    />
                    {!over && (
                        <NavbarButton
                            label="Resign"
                            icon={faTimesCircle}
                            onClick={handleEndGameModal}
                        />
                    )}
                </Navbar.Collapse>
            </Navbar>
        </header>
    );
};

TopBar.propTypes = {
    size: shape({}).isRequired,
    mute: bool.isRequired,
    time: number.isRequired,
    over: bool.isRequired,
    handleVolume: func.isRequired,
    handleEndGame: func.isRequired,
    handleRenderModal: func.isRequired
};

const mapStateToProps = ({ preferences: { mute }, game }) => ({
    mute,
    time: game.time,
    over: isSessionOver(game)
});

const mapDispatchToProps = {
    handleVolume: toggleVolume,
    // Resigning closes the session so the summary can show a final score,
    // rather than wiping the run outright.
    handleEndGame: () => closeSession(END_RESIGNED),
    handleRenderModal: renderModal
};

export default compose(
    sizeMe({ monitorWidth: true }),
    connect(
        mapStateToProps,
        mapDispatchToProps
    )
)(TopBar);
