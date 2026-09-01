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
import styles from './Leaderboard.module.scss';

const nameErrors = {
    'name-taken': 'Someone already has that name.',
    'no-verified-session': 'Finish a scored run first.'
};

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
            setError(nameErrors[code] || 'That name was not accepted.');
            return;
        }
        setError(null);
        setEditing(false);
        load();
    };

    return (
        <div className={classNames(styles.root, className)}>
            <h3 className={styles.heading}>Board of Governors</h3>

            {failed && <p className={styles.empty}>Standings unavailable.</p>}

            {!failed && entries && entries.length === 0 && (
                <p className={styles.empty}>
                    No verified runs yet. Be the first.
                </p>
            )}

            {!failed && entries && entries.length > 0 && (
                <Table size="sm" className={styles.table}>
                    <tbody>
                        {entries.map((entry) => (
                            <tr
                                key={entry.address}
                                className={
                                    entry.address === address
                                        ? styles.you
                                        : undefined
                                }
                            >
                                <td className={styles.rank}>{entry.rank}</td>
                                {/* Plain text, never a link: a name is player
                                    input on a public page. */}
                                <td className={styles.name}>
                                    {entry.displayName ||
                                        shortAddress(entry.address)}
                                </td>
                                <td className={styles.amount}>
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
                    className={styles.rename}
                    onClick={() => {
                        setDraft(displayName || '');
                        setEditing(true);
                    }}
                >
                    {displayName ? 'Change your name' : 'Choose a name'}
                </Button>
            )}

            {signedIn && editing && (
                <Form onSubmit={save} className={styles.form}>
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

            {error && <p className={styles.error}>{error}</p>}
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
