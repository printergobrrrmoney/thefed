import React from 'react';
import { number, arrayOf, shape, string, func } from 'prop-types';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { ListGroup, Media } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faCheck } from '@fortawesome/free-solid-svg-icons';
import { UPGRADES, isUnlocked } from '../../../../game-core';
import { purchaseUpgrade } from '../../../../state/modules/game';
import abbreviateMoney from '../../../../abbreviateMoney';
import Card from '../Card';
import styles from './Upgrades.module.scss';

/**
 * The only screen in the game asking a player to choose rather than to buy the
 * biggest thing they can afford.
 *
 * Nothing is listed until it is owned deeply enough to be worth doubling, which
 * is the whole point: an upgrade you cannot use yet is noise, and one offered
 * too early is a button that is never the right press. Once shown it stays,
 * because the choice it poses — go wider, or double what you have — is the
 * decision worth sitting with.
 */
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
                return (
                    <ListGroup key={upgrade.id} variant="flush">
                        <ListGroup.Item
                            action
                            disabled={!affordable}
                            aria-label={`${upgrade.name} — ${upgrade.description}`}
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
