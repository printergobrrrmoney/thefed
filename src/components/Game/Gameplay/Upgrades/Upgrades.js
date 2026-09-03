import React from 'react';
import { number, arrayOf, shape, string, func } from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { ListGroup, Media } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faCheck } from '@fortawesome/free-solid-svg-icons';
import {
    UPGRADES,
    isUnlocked,
    gainFor,
    denominationFor,
    TARGET_CLICK,
} from '../../../../game-core';
import { purchaseUpgrade } from '../../../../state/modules/game';
import { abbreviateMoney } from '../../../../abbreviateMoney';
import Card from '../Card';
import styles from './Upgrades.module.scss';

/**
 * The only screen in the game asking a player to choose rather than to buy the
 * biggest thing they can afford.
 *
 * Each row states what it would actually add, because a name and a price do not
 * settle anything: "Automatic Stamper, $900" means nothing next to another Tech
 * Company until you can see one is +40/sec and the other +321B/sec. The whole
 * point of upgrades is the comparison, so the comparison has to be on screen.
 */
const effectOf = (upgrade, store, owned) => {
    if (upgrade.target === TARGET_CLICK) {
        const now = denominationFor(owned);
        const then = denominationFor([...owned, upgrade.id]);
        return `Every press ${abbreviateMoney(now)} → ${abbreviateMoney(then)}`;
    }

    const item = store.find(({ name }) => name === upgrade.target);
    const gain = gainFor(upgrade, store, owned);
    return `Doubles your ${item ? item.count : 0} ${
        upgrade.target
    }s · +${abbreviateMoney(gain)}/sec`;
};

export const Upgrades = ({ money, store, owned, handlePurchase }) => {
    const offered = UPGRADES.filter(
        (upgrade) =>
            owned.indexOf(upgrade.id) === -1 && isUnlocked(upgrade, store)
    );
    const bought = UPGRADES.filter((upgrade) => owned.indexOf(upgrade.id) >= 0);

    if (!offered.length && !bought.length) return null;

    return (
        <Card className={styles.root}>
            <h2 className={classNames('m-2', 'd-flex', 'align-items-center')}>
                <FontAwesomeIcon icon={faArrowUp} fixedWidth className="mr-2" />
                UPGRADES
            </h2>

            {offered.map((upgrade) => {
                const affordable = money >= upgrade.price;
                const effect = effectOf(upgrade, store, owned);
                return (
                    <ListGroup key={upgrade.id} variant="flush">
                        <ListGroup.Item
                            action
                            disabled={!affordable}
                            aria-label={`${
                                upgrade.name
                            }. ${effect}. Costs ${abbreviateMoney(
                                upgrade.price
                            )}`}
                            className={classNames(
                                styles.row,
                                'd-flex',
                                'align-items-center',
                                'justify-content-between'
                            )}
                            onClick={() =>
                                affordable && handlePurchase(upgrade.id)
                            }
                        >
                            <Media.Body className="mr-2">
                                <div className={styles.name}>
                                    {upgrade.name}
                                </div>
                                <div className={styles.effect}>{effect}</div>
                                <div className={styles.description}>
                                    {upgrade.description}
                                </div>
                            </Media.Body>
                            <span className={styles.price}>
                                {abbreviateMoney(upgrade.price)}
                            </span>
                        </ListGroup.Item>
                    </ListGroup>
                );
            })}

            {bought.map((upgrade) => (
                <ListGroup key={upgrade.id} variant="flush">
                    <ListGroup.Item
                        className={classNames(
                            styles.row,
                            styles.owned,
                            'd-flex',
                            'align-items-center',
                            'justify-content-between'
                        )}
                    >
                        <Media.Body className="mr-2">
                            <div className={styles.name}>{upgrade.name}</div>
                            <div className={styles.description}>
                                {upgrade.description}
                            </div>
                        </Media.Body>
                        <FontAwesomeIcon icon={faCheck} />
                    </ListGroup.Item>
                </ListGroup>
            ))}
        </Card>
    );
};

Upgrades.propTypes = {
    money: number.isRequired,
    store: arrayOf(shape({})).isRequired,
    owned: arrayOf(string).isRequired,
    handlePurchase: func.isRequired,
};

const mapStateToProps = ({ game: { money, store, upgrades } }) => ({
    money,
    store,
    owned: upgrades || [],
});

export default connect(mapStateToProps, {
    handlePurchase: purchaseUpgrade,
})(Upgrades);
