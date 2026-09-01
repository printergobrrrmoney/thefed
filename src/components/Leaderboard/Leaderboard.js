import React, { useEffect, useState } from 'react';
import { string, bool } from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { Table, Form, Button } from 'react-bootstrap';
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
    address,
    displayName,
    signedIn,
    handleChooseName
}) => {
    const [entries, setEntries] = useState(null);
    const [failed, setFailed] = useState(false);
    const [draft, setDraft] = useState('');
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(false);

    const load = () =>
        fetchLeaderboard(10)
            .then((data) => setEntries(data.entries))
            .catch(() => setFailed(true));

    useEffect(() => {
        load();
    }, [displayName]);

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

    return (
        <div className={classNames('leaderboard', className)}>
            <h3 className={'leaderboard-heading'}>Board of Governors</h3>

            {failed && <p className={'leaderboard-empty'}>Standings unavailable.</p>}

            {!failed && entries && entries.length === 0 && (
                <p className={'leaderboard-empty'}>
                    No verified runs yet. Be the first.
                </p>
            )}

            {!failed && entries && entries.length > 0 && (
                <Table size="sm" className={'leaderboard-table'}>
                    <tbody>
                        {entries.map((entry) => (
                            <tr
                                key={entry.address}
                                className={
                                    entry.address === address
                                        ? 'leaderboard-you'
                                        : undefined
                                }
                            >
                                <td className={'leaderboard-rank'}>{entry.rank}</td>
                                {/* Plain text and always beside the address:
                                    names are not unique, so the address is
                                    what actually identifies a player. */}
                                <td className={'leaderboard-name'}>
                                    {entry.displayName || 'Anonymous'}
                                    <span className={'leaderboard-addr'}>
                                        {shortAddress(entry.address)}
                                    </span>
                                </td>
                                <td className={'leaderboard-amount'}>
                                    ${commatize(entry.score)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}

            {signedIn && !editing && (
                <Button
                    variant="link"
                    size="sm"
                    className={'leaderboard-rename'}
                    onClick={() => {
                        setDraft(displayName || '');
                        setEditing(true);
                    }}
                >
                    {displayName ? 'Change your name' : 'Name yourself'}
                </Button>
            )}

            {signedIn && editing && (
                <Form onSubmit={save} className={'leaderboard-form'}>
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

            {error && <p className={'leaderboard-error'}>{error}</p>}
        </div>
    );
};

Leaderboard.propTypes = {
    className: string,
    address: string,
    displayName: string,
    signedIn: bool.isRequired,
    handleChooseName: Function
};

Leaderboard.defaultProps = {
    className: undefined,
    address: null,
    displayName: null
};

const mapStateToProps = ({ wallet }) => ({
    address: wallet.address,
    displayName: wallet.displayName,
    signedIn: wallet.signedIn
});

const mapDispatchToProps = {
    handleChooseName: chooseDisplayName
};

export default connect(mapStateToProps, mapDispatchToProps)(Leaderboard);
