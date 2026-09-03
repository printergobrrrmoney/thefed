import React, { useEffect, useRef, useState, useCallback } from 'react';
import { arrayOf, shape, string, number, bool } from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTwitter } from '@fortawesome/free-brands-svg-icons';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { ReactComponent as CIA } from '../cia.svg';
import styles from './NewsToasts.module.scss';

/**
 * News, where a phone can actually see it.
 *
 * The news column sits third in the stack on a narrow screen, below the printer
 * and below all fifteen store items, so a player on a phone has never seen a
 * single tweet — an entire feature only desktop was getting. These surface the
 * same items over the game for the few seconds after they arrive.
 *
 * They are anchored to the bottom on purpose. The print button sits in the
 * middle of the screen under the player's thumb, and anything that appears
 * there gets tapped through by someone mid-burst.
 *
 * Nothing here touches the reducer the server replays: news is app state and is
 * not scored, so this is presentation and cannot change what a run is worth.
 */
export const LIFETIME_MS = 7000;
export const VISIBLE = 2;

export const NewsToasts = ({ tweets, updates, ciaRevealed }) => {
    const seen = useRef(null);
    const timers = useRef([]);
    const [toasts, setToasts] = useState([]);

    const dismiss = useCallback(
        (id) => setToasts((current) => current.filter((t) => t.id !== id)),
        []
    );

    useEffect(() => () => timers.current.forEach(clearTimeout), []);

    const items = [
        ...tweets.map((t) => ({ ...t, source: 'trump' })),
        ...(ciaRevealed ? updates.map((u) => ({ ...u, source: 'cia' })) : []),
    ];
    const signature = items.map((i) => i.id).join('|');

    useEffect(() => {
        // Whatever exists on the first pass is history, not news — a run
        // restored after a refresh must not replay every tweet at once.
        if (seen.current === null) {
            seen.current = new Set(items.map((i) => i.id));
            return;
        }

        const fresh = items.filter((i) => !seen.current.has(i.id));
        if (!fresh.length) return;

        fresh.forEach((i) => seen.current.add(i.id));
        setToasts((current) => [...current, ...fresh].slice(-VISIBLE));

        // Timers are kept in a ref rather than cleaned up by this effect: the
        // effect re-runs whenever any news arrives, and clearing there would
        // cancel the pending dismissal of a toast that is still on screen.
        fresh.forEach((item) => {
            timers.current.push(
                setTimeout(() => dismiss(item.id), LIFETIME_MS)
            );
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature, dismiss]);

    if (!toasts.length) return null;

    return (
        <div
            className={classNames(styles.layer, 'd-md-none')}
            aria-live="polite"
            aria-relevant="additions"
        >
            {toasts.map((toast) => (
                <button
                    type="button"
                    key={toast.id}
                    className={styles.toast}
                    onClick={() => dismiss(toast.id)}
                    aria-label={`Dismiss: ${toast.text}`}
                >
                    <span className={styles.avatar}>
                        {toast.source === 'cia' ? (
                            <CIA height="24px" />
                        ) : (
                            <FontAwesomeIcon icon={faTwitter} />
                        )}
                    </span>
                    <span className={styles.body}>
                        <span className={styles.who}>
                            {toast.source === 'cia'
                                ? 'CIA NEWS WIRE'
                                : 'Donald J. Trump'}
                        </span>
                        <span className={styles.text}>{toast.text}</span>
                    </span>
                    <FontAwesomeIcon icon={faTimes} className={styles.close} />
                </button>
            ))}
        </div>
    );
};

NewsToasts.propTypes = {
    tweets: arrayOf(shape({ id: string, text: string, time: number })),
    updates: arrayOf(shape({ id: string, text: string })),
    ciaRevealed: bool,
};

NewsToasts.defaultProps = {
    tweets: [],
    updates: [],
    ciaRevealed: false,
};

const mapStateToProps = ({ game: { news, store } }) => ({
    tweets: news.trump,
    updates: news.cia,
    // Matches the column, which keeps the wire behind CLASSIFIED until the
    // Propaganda Campaign is revealed.
    ciaRevealed: Boolean(
        (store.find(({ name }) => name === 'Propaganda Campaign') || {}).reveal
    ),
});

export default connect(mapStateToProps)(NewsToasts);
