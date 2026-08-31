import React, { useState } from 'react';
import { string, bool, func, arrayOf, shape } from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { Dropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWallet } from '@fortawesome/free-solid-svg-icons';
import { availableWallets, detectWallets, shortAddress } from '../../../../wallet';
import {
    connectWallet,
    disconnectWallet
} from '../../../../state/modules/wallet';
import styles from './ConnectWallet.module.scss';

export const ConnectWallet = ({
    address,
    connecting,
    error,
    handleConnect,
    handleDisconnect
}) => {
    // Read once per open: wallets inject on load, and re-detecting on every
    // render would churn for no benefit.
    const [wallets, setWallets] = useState([]);
    const refresh = () => {
        const found = availableWallets();
        setWallets(found.length ? found : detectWallets());
    };

    if (address) {
        return (
            <Dropdown alignRight className={styles.root}>
                <Dropdown.Toggle
                    variant="outline-light"
                    size="sm"
                    id="wallet-menu"
                    className={styles.button}
                >
                    <FontAwesomeIcon icon={faWallet} className="mr-2" />
                    {shortAddress(address)}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                    <Dropdown.Header className={styles.full}>
                        {address}
                    </Dropdown.Header>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={handleDisconnect}>
                        Disconnect
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>
        );
    }

    return (
        <Dropdown alignRight className={styles.root} onToggle={refresh}>
            <Dropdown.Toggle
                variant="outline-light"
                size="sm"
                id="wallet-connect"
                disabled={connecting}
                className={styles.button}
            >
                <FontAwesomeIcon icon={faWallet} className="mr-2" />
                {connecting ? 'Connecting…' : 'Connect wallet'}
            </Dropdown.Toggle>
            <Dropdown.Menu>
                <Dropdown.Header className={styles.note}>
                    Signing in never approves a transaction.
                </Dropdown.Header>
                <Dropdown.Divider />
                {wallets.map((w) =>
                    w.available ? (
                        <Dropdown.Item
                            key={w.id}
                            onClick={() => handleConnect(w.id)}
                        >
                            {w.name}
                        </Dropdown.Item>
                    ) : (
                        <Dropdown.Item
                            key={w.id}
                            href={w.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.install}
                        >
                            Install {w.name}
                        </Dropdown.Item>
                    )
                )}
                {error && (
                    <>
                        <Dropdown.Divider />
                        <Dropdown.Header
                            className={classNames(styles.note, 'text-danger')}
                        >
                            {error}
                        </Dropdown.Header>
                    </>
                )}
            </Dropdown.Menu>
        </Dropdown>
    );
};

ConnectWallet.propTypes = {
    address: string,
    connecting: bool.isRequired,
    error: string,
    handleConnect: func.isRequired,
    handleDisconnect: func.isRequired,
    wallets: arrayOf(shape({}))
};

ConnectWallet.defaultProps = {
    address: null,
    error: null,
    wallets: undefined
};

const mapStateToProps = ({ wallet: { address, connecting, error } }) => ({
    address,
    connecting,
    error
});

const mapDispatchToProps = {
    handleConnect: connectWallet,
    handleDisconnect: disconnectWallet
};

export default connect(mapStateToProps, mapDispatchToProps)(ConnectWallet);
