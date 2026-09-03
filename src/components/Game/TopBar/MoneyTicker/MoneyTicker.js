import React from 'react';
import { number } from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import CountUp from 'react-countup';
import { abbreviateMoney } from '../../../../abbreviateMoney';
import styles from './MoneyTicker.module.scss';

/**
 * The running total.
 *
 * It used to be absolutely positioned and centred on the whole bar, which took
 * it out of the flow and let it paint straight over the term clock as soon as
 * the figure grew wide enough — which on a phone is within a couple of minutes.
 * It now sits in the flow and shares the bar, so it cannot cover anything.
 */
const MoneyTicker = ({ money, printRate }) => (
    <div
        className={classNames(
            styles.root,
            'flex-grow-1',
            'mx-2',
            'text-center',
            'text-white'
        )}
        aria-label={abbreviateMoney(money)}
        tabIndex={0} // eslint-disable-line jsx-a11y/no-noninteractive-tabindex
    >
        <CountUp
            start={money}
            end={money + printRate}
            delay={0}
            duration={1}
            decimals={2}
            useEasing={false}
            formattingFn={abbreviateMoney}
        >
            {({ countUpRef }) => (
                <span ref={countUpRef} className={styles.amount} />
            )}
        </CountUp>
    </div>
);

MoneyTicker.propTypes = {
    money: number.isRequired,
    printRate: number.isRequired,
};

const mapStateToProps = ({ game: { money, printRate } }) => ({
    money,
    printRate,
});

export default connect(mapStateToProps)(MoneyTicker);
