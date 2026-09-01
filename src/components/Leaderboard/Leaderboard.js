import React, { useEffect, useState } from 'react';
import { string, bool, number, func } from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { Table, Form, Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCircleCheck,
    faCircleExclamation
} from '@fortawesome/free-solid-svg-icons';
import { fetchLeaderboard } from '../../api/client';
import { shortAddress } from '../../wallet';
import { chooseDisplayName } from '../../state/modules/wallet';
import {
    nameProblem,
    MESSAGES,
    MAX_LENGTH
} from '../../leaderboard/displayName';
import commatize from '../../commatizeNumber';

export const Leaderboard = ({
    className,
    compact,
    address,
    displayName,
    signedIn,
    best,
    handleChooseName
}) => {
    const [entries, setEntries] = useState(null);
    const [failed, setFailed] = useState(false);
    const [draft, setDraft] = useState('');
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(false);

    const limit = compact ? 5 : 10;

    const load = () =>
        fetchLeaderboard(limit)
            .then((data) => setEntries(data.entries))
            .catch(() => setFailed(true));

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayName, best]);

    const save = async (event) => {
        event.preventDefault();
        const problem = nameProblem(draft);
        if (problem) {
            setError(MESSAGES[problem]);
            return;
        }
        const code = await handleChooseName(draft);
        if (code) {
            setError('That name was not accepted.');
            return;
        }
        setError(null);
        setEditing(false);
        load();
    };

    // An unscored player's own run sits in the standings where it would rank,
    // so they can see both what they got and what it is missing. Without this,
    // playing without a wallet leaves nothing behind at all, which reads as the
    // game having lost the run.
    const showGhost = !signedIn && best > 0;
    const rows = (entries || []).map((entry) => ({ ...entry, verified: true }));
    if (showGhost) {
        rows.push({
            address: 'local',
            displayName: 'Your run',
            score: best,
            verified: false
        });
    }
    rows.sort((a, b) => b.score - a.score);

    return (
        <div className={classNames('leaderboard', className)}>
            <h3 className="leaderboard-heading">Board of Governors</h3>

            {failed && (
                <p className="leaderboard-empty">Standings unavailable.</p>
            )}

            {!failed && entries && rows.length === 0 && (
                <p className="leaderboard-empty">
                    No verified runs yet. Be the first.
                </p>
            )}

            {!failed && rows.length > 0 && (
                <Table size="sm" className="leaderboard-table">
                    <tbody>
                        {rows.slice(0, limit).map((entry, index) => (
                            <tr
                                key={entry.address}
                                className={classNames(
                                    entry.address === address &&
                                        'leaderboard-you',
                                    !entry.verified && 'leaderboard-ghost'
                                )}
                            >
                                <td className="leaderboard-rank">{index + 1}</td>
                                {/* Plain text and always beside the address:
                                    names are not unique, so the address is what
                                    actually identifies a player. */}
                                <td className="leaderboard-name">
                                    <FontAwesomeIcon
                                        icon={
                                            entry.verified
                                                ? faCircleCheck
                                                : faCircleExclamation
                                        }
                                        className={classNames(
                                            'mr-1',
                                            entry.verified
                                                ? 'leaderboard-verified'
                                                : 'leaderboard-unsaved'
                                        )}
                                        title={
                                            entry.verified
                                                ? 'Verified by the server'
                                                : 'Not saved — no wallet connected'
                                        }
                                    />
                                    {entry.displayName || 'Anonymous'}
                                    <span className="leaderboard-addr">
                                        {entry.verified
                                            ? shortAddress(entry.address)
                                            : 'this browser only'}
                                    </span>
                                </td>
                                <td className="leaderboard-amount">
                                    ${commatize(entry.score)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}

            {showGhost && (
                <p className="leaderboard-empty">
                    Connect a wallet before your next run to put it on the board
                    for good.
                </p>
            )}

            {signedIn && !editing && !compact && (
                <Button
                    variant="link"
                    size="sm"
                    className="leaderboard-rename"
                    onClick={() => {
                        setDraft(displayName || '');
                        setEditing(true);
                    }}
                >
                    {displayName ? 'Change your name' : 'Name yourself'}
                </Button>
            )}

            {signedIn && editing && (
                <Form onSubmit={save} className="leaderboard-form">
                    <Form.Control
                        size="sm"
                        value={draft}
                        maxLength={MAX_LENGTH}
                        placeholder="Your name on the board"
                        onChange={(event) => {
                            setDraft(event.target.value);
                            setError(null);
                        }}
                    />
                    <Button size="sm" type="submit" variant="primary">
                        Save
                    </Button>
                    <Button
                        size="sm"
                        variant="link"
                        onClick={() => {
                            setEditing(false);
                            setError(null);
                        }}
                    >
                        Cancel
                    </Button>
                </Form>
            )}

            {error && <p className="leaderboard-error">{error}</p>}
        </div>
    );
};

Leaderboard.propTypes = {
    className: string,
    compact: bool,
    address: string,
    displayName: string,
    signedIn: bool.isRequired,
    best: number.isRequired,
    handleChooseName: func.isRequired
};

Leaderboard.defaultProps = {
    className: undefined,
    compact: false,
    address: null,
    displayName: null
};

const mapStateToProps = ({ wallet, personalBest }) => ({
    address: wallet.address,
    displayName: wallet.displayName,
    signedIn: wallet.signedIn,
    best: personalBest.score
});

const mapDispatchToProps = {
    handleChooseName: chooseDisplayName
};

export default connect(mapStateToProps, mapDispatchToProps)(Leaderboard);
