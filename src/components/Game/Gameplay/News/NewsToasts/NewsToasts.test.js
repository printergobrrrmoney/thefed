import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { act } from 'react-dom/test-utils';
import { NewsToasts, LIFETIME_MS, VISIBLE } from './NewsToasts';

/**
 * The fiddly parts here are which items count as new and when they go away,
 * neither of which is visible from reading the component. A refresh mid-run
 * rehydrates the whole news history at once, and replaying forty tweets over
 * the game would be worse than showing none.
 */
const tweet = (n) => ({ id: `t${n}`, text: `tweet ${n}`, time: n });

let container;

beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
});

afterEach(() => {
    unmountComponentAtNode(container);
    container.remove();
    jest.useRealTimers();
});

const show = (props) =>
    act(() => {
        render(<NewsToasts tweets={[]} updates={[]} {...props} />, container);
    });

const texts = () =>
    [...container.querySelectorAll('button')].map((b) =>
        b.textContent.replace(/\s+/g, ' ').trim()
    );

describe('news on a small screen', () => {
    it('shows nothing for news that was already there', () => {
        // A run restored after a refresh arrives with its whole history.
        show({ tweets: [tweet(1), tweet(2), tweet(3)] });
        expect(texts()).toHaveLength(0);
    });

    it('shows a tweet that arrives while playing', () => {
        show({ tweets: [tweet(1)] });
        show({ tweets: [tweet(1), tweet(2)] });

        expect(texts()).toHaveLength(1);
        expect(texts()[0]).toContain('tweet 2');
        expect(texts()[0]).toContain('Donald J. Trump');
    });

    it('takes it away again on its own', () => {
        show({ tweets: [tweet(1)] });
        show({ tweets: [tweet(1), tweet(2)] });
        expect(texts()).toHaveLength(1);

        act(() => {
            jest.advanceTimersByTime(LIFETIME_MS + 50);
        });
        expect(texts()).toHaveLength(0);
    });

    it('keeps only the most recent few when several land at once', () => {
        show({ tweets: [tweet(1)] });
        show({
            tweets: [tweet(1), tweet(2), tweet(3), tweet(4), tweet(5)]
        });

        expect(texts()).toHaveLength(VISIBLE);
        expect(texts()[texts().length - 1]).toContain('tweet 5');
    });

    it('does not cancel a pending dismissal when more news arrives', () => {
        // The bug this guards: clearing timers in the effect cleanup meant a
        // toast already on screen never went away once a second one landed.
        show({ tweets: [tweet(1)] });
        show({ tweets: [tweet(1), tweet(2)] });

        act(() => {
            jest.advanceTimersByTime(LIFETIME_MS / 2);
        });
        show({ tweets: [tweet(1), tweet(2), tweet(3)] });

        act(() => {
            jest.advanceTimersByTime(LIFETIME_MS / 2 + 50);
        });
        // The first has timed out even though the second arrived mid-life.
        expect(texts().join(' ')).not.toContain('tweet 2');
    });

    it('dismisses when tapped', () => {
        show({ tweets: [tweet(1)] });
        show({ tweets: [tweet(1), tweet(2)] });

        act(() => {
            container
                .querySelector('button')
                .dispatchEvent(
                    new MouseEvent('click', { bubbles: true, cancelable: true })
                );
        });
        expect(texts()).toHaveLength(0);
    });

    it('keeps the wire classified until the campaign is revealed', () => {
        const update = { id: 'c1', text: 'deep state' };

        show({ tweets: [], updates: [], ciaRevealed: false });
        show({ tweets: [], updates: [update], ciaRevealed: false });
        expect(texts()).toHaveLength(0);

        show({ tweets: [], updates: [update], ciaRevealed: true });
        expect(texts()[0]).toContain('CIA NEWS WIRE');
    });
});
