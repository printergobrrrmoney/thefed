import React, { useState } from 'react';
import { string, bool, func } from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { Button, ButtonGroup } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWallet, faCheck } from '@fortawesome/free-solid-svg-icons';
import {
    availableWallets,
    detectWallets,
    shortAddress,
    isMobile,
} from '../../../wallet';
import { connectAndSignIn } from '../../../state/modules/wallet';
import styles from './WalletSection.module.scss';

/**
 * Connecting sits inside the application because that is where a player is
 * already telling us who they are, and because a wallet attached before the
 * first run is the only way every run gets scored — connecting halfway through
 * one is too late for that run.
 *
 * It is optional on purpose. The game is meant to be worth playing on its own;
 * a wallet gate at the front door would cost the people it is supposed to
 * attract.
 */
export const WalletSection = ({
    address,
    signedIn,
    connecting,
    signingIn,
    error,
    handleConnect,
}) => {
    const [wallets, setWallets] = useState(null);
    const busy = connecting || signingIn;
    // A phone never has an injected provider, so "not detected" there means
    // "open this page in the wallet", not "you do not have one".
    const mobile = isMobile();

    if (signedIn && address) {
        return (
            <div className={classNames(styles.root, styles.done)}>
                <FontAwesomeIcon icon={faCheck} className="mr-2" />
                Verified as <strong>{shortAddress(address)}</strong> — your runs
                will earn $BRRR.
            </div>
        );
    }

    const choices = wallets
        ? wallets
              .map((wallet) => {
                  if (wallet.available) {
                      return (
                          <Button
                              key={wallet.id}
                              variant="outline-primary"
                              disabled={busy}
                              onClick={() => handleConnect(wallet.id)}
                          >
                              {wallet.name}
                          </Button>
                      );
                  }

                  if (mobile) {
                      // Without a published deeplink there is no honest button
                      // to draw, so that wallet is simply not offered here.
                      return wallet.browseLink ? (
                          <Button
                              key={wallet.id}
                              variant="outline-primary"
                              href={wallet.browseLink}
                          >
                              Open in {wallet.name}
                          </Button>
                      ) : null;
                  }

                  return (
                      <Button
                          key={wallet.id}
                          variant="outline-secondary"
                          href={wallet.url}
                          target="_blank"
                          rel="noopener noreferrer"
                      >
                          Install {wallet.name}
                      </Button>
                  );
              })
              .filter(Boolean)
        : [];

    return (
        <div className={styles.root}>
            <p className={styles.lead}>
                Connect a wallet to earn <strong>$BRRR</strong> for your runs.
            </p>

            {!wallets && (
                <Button
                    variant="outline-primary"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                        const found = availableWallets();
                        setWallets(found.length ? found : detectWallets());
                    }}
                >
                    <FontAwesomeIcon icon={faWallet} className="mr-2" />
                    {busy ? 'Connecting…' : 'Connect wallet'}
                </Button>
            )}

            {wallets && choices.length > 0 && (
                <ButtonGroup size="sm" className={styles.choices}>
                    {choices}
                </ButtonGroup>
            )}

            {wallets && choices.length === 0 && (
                <p className={styles.note}>No wallet found on this device.</p>
            )}

            {wallets && mobile && choices.length > 0 && (
                <p className={styles.note}>
                    Your phone’s browser can’t see wallet apps directly. These
                    reopen this page inside the wallet, where it can.
                </p>
            )}

            <p className={styles.note}>
                You can play without one — you just won’t earn any $BRRR.
                Signing in never approves a transaction.
            </p>

            {error && <p className={styles.error}>{error}</p>}
        </div>
    );
};

WalletSection.propTypes = {
    address: string,
    signedIn: bool.isRequired,
    connecting: bool.isRequired,
    signingIn: bool.isRequired,
    error: string,
    handleConnect: func.isRequired,
};

WalletSection.defaultProps = {
    address: null,
    error: null,
};

const mapStateToProps = ({ wallet }) => ({
    address: wallet.address,
    signedIn: wallet.signedIn,
    connecting: wallet.connecting,
    signingIn: wallet.signingIn,
    error: wallet.error,
});

export default connect(mapStateToProps, { handleConnect: connectAndSignIn })(
    WalletSection
);
