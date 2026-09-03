import React, { useState, useCallback } from 'react';
import { string, bool, func, object } from 'prop-types';
import { connect } from 'react-redux';
import Helmet from 'react-helmet';
import { Button, ButtonGroup, Form, Alert } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faWallet,
    faShieldAlt,
    faExternalLinkAlt,
} from '@fortawesome/free-solid-svg-icons';
import {
    availableWallets,
    detectWallets,
    shortAddress,
    isMobile,
} from '../../wallet';
import { connectAndSignIn } from '../../state/modules/wallet';
import Rewards from '../Rewards';
import ClaimDay from './ClaimDay';
import commatize from '../../commatizeNumber';

/**
 * The claim page.
 *
 * It exists before there is anything to claim, and that is the point. The
 * moment a token gets attention, pages appear that look like this one and ask
 * for a transaction approval. The defence is a real page, live early, linked
 * from everywhere we control, that states plainly what it will never ask for.
 *
 * So the page is honest about being empty: it shows what a wallet has earned in
 * points, and refuses to print a token figure beside it while the distributor
 * does not exist.
 */
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** The last week of days, newest first. Older days stay claimable by URL. */
const recentDays = () =>
    Array.from({ length: 7 }, (unused, back) => {
        const when = new Date();
        when.setUTCDate(when.getUTCDate() - back - 1);
        return when.toISOString().slice(0, 10);
    });

export const Standing = ({ data }) => {
    if (!data.found) {
        return (
            <p className="claim-empty">
                No runs recorded for{' '}
                <strong>{shortAddress(data.address)}</strong>. Play a term with
                this wallet connected and it will appear here.
            </p>
        );
    }

    return (
        <div className="claim-standing">
            <p className="claim-who">
                <strong>
                    {data.displayName || shortAddress(data.address)}
                </strong>
                <span>{shortAddress(data.address)}</span>
            </p>

            <dl className="claim-facts">
                <div>
                    <dt>Best run</dt>
                    <dd>{commatize(data.bestScore)}</dd>
                </div>
                <div>
                    <dt>Scored runs</dt>
                    <dd>{commatize(data.scoredSessions)}</dd>
                </div>
                <div>
                    <dt>Claimable now</dt>
                    <dd>{commatize(data.claimable)}</dd>
                </div>
            </dl>

            {data.days.length > 0 && (
                <div className="claim-days-wrap">
                    <table className="claim-days">
                        <thead>
                            <tr>
                                <th>Day</th>
                                <th className="num">Runs</th>
                                <th className="num">Best</th>
                                <th className="num">Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.days.map((row) => (
                                <tr key={row.day}>
                                    <td>{String(row.day).slice(0, 10)}</td>
                                    <td className="num">{row.runs}</td>
                                    <td className="num">
                                        {commatize(row.best)}
                                    </td>
                                    <td className="num">
                                        {row.points.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="claim-fine">{data.note}</p>
        </div>
    );
};

Standing.propTypes = {
    // eslint-disable-next-line react/forbid-prop-types
    data: object.isRequired,
};

export const Claim = ({
    address,
    signedIn,
    connecting,
    signingIn,
    handleConnect,
}) => {
    const [wallets, setWallets] = useState(null);
    const [typed, setTyped] = useState('');
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const look = useCallback((who) => {
        if (!ADDRESS.test(who)) {
            setError('That does not look like a Solana address.');
            return;
        }
        setBusy(true);
        setError(null);
        setData(null);
        fetch(`/api/player/standing?address=${encodeURIComponent(who)}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then(setData)
            .catch(() => setError('Could not reach the server. Try again.'))
            .then(() => setBusy(false));
    }, []);

    const connectingNow = connecting || signingIn;
    // A phone has no injected provider, so offer to reopen this page inside
    // the wallet rather than telling someone to install what they already have.
    const mobile = isMobile();

    return (
        <div className="claim">
            <Helmet title="Claim" />

            <header className="claim-head">
                <h1>Claim $BRRR</h1>
                <p className="claim-lead">
                    Rewards are earned by playing{' '}
                    <a href="https://game.printergobrrr.money">The Fed</a> with
                    a wallet connected. When distribution opens, this is where
                    you collect them.
                </p>
            </header>

            <Alert variant="warning" className="claim-status">
                <strong>Distribution has not started.</strong> There is nothing
                to claim yet and nobody has been paid. Runs you record now still
                count when it opens.
            </Alert>

            <section className="claim-safety">
                <h2>
                    <FontAwesomeIcon icon={faShieldAlt} className="mr-2" />
                    How to know this page is real
                </h2>
                <ul>
                    <li>
                        The only claim page is{' '}
                        <strong>claim.printergobrrr.money</strong>. Check the
                        address bar every time.
                    </li>
                    <li>
                        <strong>
                            Signing in never approves a transaction.
                        </strong>{' '}
                        It is a message signature: it moves nothing and costs
                        nothing.
                    </li>
                    <li>
                        <strong>
                            Claiming is the one transaction we will ever ask you
                            to approve, and it only ever moves tokens to you.
                        </strong>{' '}
                        We will never ask you to approve anything that sends
                        tokens away from your wallet, or that grants us standing
                        permission over it. If a page calling itself The Fed
                        asks for either, it is not us.
                    </li>
                    <li>
                        We will never ask for a seed phrase or a private key. No
                        real site ever does.
                    </li>
                    <li>
                        You never have to connect at all — paste an address
                        below and read it without signing anything.
                    </li>
                </ul>
            </section>

            <section className="claim-check">
                <h2>Check a wallet</h2>

                <Form
                    onSubmit={(event) => {
                        event.preventDefault();
                        look(typed.trim());
                    }}
                >
                    <Form.Group controlId="claim-address">
                        <Form.Label className="sr-only">
                            Solana address
                        </Form.Label>
                        <div className="claim-row">
                            <Form.Control
                                type="text"
                                value={typed}
                                spellCheck={false}
                                autoComplete="off"
                                placeholder="Paste a Solana address"
                                onChange={(event) =>
                                    setTyped(event.target.value)
                                }
                            />
                            <Button type="submit" disabled={busy || !typed}>
                                {busy ? 'Checking…' : 'Check'}
                            </Button>
                        </div>
                    </Form.Group>
                </Form>

                {signedIn && address ? (
                    <p className="claim-connected">
                        Connected as <strong>{shortAddress(address)}</strong>
                        <Button
                            variant="link"
                            size="sm"
                            onClick={() => {
                                setTyped(address);
                                look(address);
                            }}
                        >
                            Check this wallet
                        </Button>
                    </p>
                ) : (
                    <div className="claim-connect">
                        {!wallets && (
                            <Button
                                variant="outline-primary"
                                size="sm"
                                disabled={connectingNow}
                                onClick={() => {
                                    const found = availableWallets();
                                    setWallets(
                                        found.length ? found : detectWallets()
                                    );
                                }}
                            >
                                <FontAwesomeIcon
                                    icon={faWallet}
                                    className="mr-2"
                                />
                                {connectingNow
                                    ? 'Connecting…'
                                    : 'Or connect a wallet'}
                            </Button>
                        )}

                        {wallets && (
                            <ButtonGroup size="sm">
                                {wallets
                                    .map((wallet) => {
                                        if (wallet.available) {
                                            return (
                                                <Button
                                                    key={wallet.id}
                                                    variant="outline-primary"
                                                    disabled={connectingNow}
                                                    onClick={() =>
                                                        handleConnect(wallet.id)
                                                    }
                                                >
                                                    {wallet.name}
                                                </Button>
                                            );
                                        }
                                        if (mobile) {
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
                                    .filter(Boolean)}
                            </ButtonGroup>
                        )}
                    </div>
                )}

                {signedIn && address && (
                    <div className="claim-days-section">
                        <h2>Your days</h2>
                        {recentDays().map((day) => (
                            <ClaimDay key={day} day={day} />
                        ))}
                    </div>
                )}

                {error && <p className="claim-error">{error}</p>}
                {data && <Standing data={data} />}
            </section>

            <Rewards className="claim-rewards" />

            <footer className="claim-foot">
                <a href="https://game.printergobrrr.money">
                    Play The Fed <FontAwesomeIcon icon={faExternalLinkAlt} />
                </a>
                <a
                    href="https://github.com/printergobrrrmoney/thefed"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Read the source <FontAwesomeIcon icon={faExternalLinkAlt} />
                </a>
                <a href="https://printergobrrr.money">printergobrrr.money</a>
            </footer>
        </div>
    );
};

Claim.propTypes = {
    address: string,
    signedIn: bool.isRequired,
    connecting: bool.isRequired,
    signingIn: bool.isRequired,
    handleConnect: func.isRequired,
};

Claim.defaultProps = {
    address: null,
};

const mapStateToProps = ({ wallet }) => ({
    address: wallet.address,
    signedIn: wallet.signedIn,
    connecting: wallet.connecting,
    signingIn: wallet.signingIn,
});

export default connect(mapStateToProps, { handleConnect: connectAndSignIn })(
    Claim
);
