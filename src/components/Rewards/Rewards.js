import React, { useEffect, useState } from 'react';
import { string, bool } from 'prop-types';
import classNames from 'classnames';
import { Table } from 'react-bootstrap';
import commatize from '../../commatizeNumber';

/**
 * What you can earn, stated in public.
 *
 * The numbers come from the endpoint, which computes them with the same module
 * the payout uses — so this page cannot quietly drift from the rules it is
 * describing. It is deliberately readable without signing in: a player should
 * be able to see the terms before deciding whether to bother.
 */
const round = (n) => commatize(Math.round(n));

export const Rewards = ({ className, compact }) => {
    const [data, setData] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        fetch('/api/economics')
            .then((r) => r.json())
            .then(setData)
            .catch(() => setFailed(true));
    }, []);

    if (failed) return null;
    if (!data) return null;

    return (
        <section className={classNames('rewards', className)}>
            <h3 className="rewards-heading">What you can earn</h3>

            {!data.live && <p className="rewards-note">{data.note}</p>}

            <dl className="rewards-facts">
                <div>
                    <dt>Reserved for players</dt>
                    <dd>
                        {Math.round(data.poolShare * 100)}% of supply
                        <span>{round(data.pool)} $BRRR</span>
                    </dd>
                </div>
                <div>
                    <dt>Released each day</dt>
                    <dd>
                        {round(data.dailyCeiling)}
                        <span>over {data.scheduleDays} days</span>
                    </dd>
                </div>
                <div>
                    <dt>Most one wallet can earn today</dt>
                    <dd>
                        {round(data.capToday)}
                        <span>
                            {round(data.capTodayTopTier)} at the top tier
                        </span>
                    </dd>
                </div>
                <div>
                    <dt>Burned so far</dt>
                    <dd>
                        {round(data.burnedToDate)}
                        <span>whatever a day does not pay out</span>
                    </dd>
                </div>
            </dl>

            {!compact && (
                <>
                    <p className="rewards-lead">
                        Each day releases a fixed amount — a{' '}
                        <strong>ceiling, not a quota</strong>. Every wallet is
                        capped, so a quiet day cannot be scooped up by whoever
                        brings the most wallets. Whatever nobody earns is{' '}
                        <strong>burned</strong>, permanently, on-chain, where
                        anyone can check it.
                    </p>

                    <p className="rewards-lead">
                        Playing earlier is worth more, on purpose. Today&apos;s
                        multiplier is{' '}
                        <strong>{data.earlyMultiplier.toFixed(2)}×</strong>,
                        falling towards 1× across the year. It is set by the day
                        you play, so it cannot be banked.
                    </p>

                    <div className="rewards-table-wrap">
                        <Table size="sm" className="rewards-table">
                            <thead>
                                <tr>
                                    <th>Hold</th>
                                    <th className="num">Multiplier</th>
                                    <th className="num">Your daily cap</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.tiers.map((tier) => (
                                    <tr key={tier.name}>
                                        <td>
                                            {tier.name}
                                            <span className="rewards-holds">
                                                {tier.holds
                                                    ? `${commatize(tier.holds)} $BRRR`
                                                    : 'nothing'}
                                            </span>
                                        </td>
                                        <td className="num">
                                            {tier.multiplier.toFixed(2)}×
                                        </td>
                                        <td className="num">
                                            {round(tier.capToday)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>

                    <p className="rewards-fine">
                        It would take about{' '}
                        <strong>{commatize(data.playersToExhaust)}</strong>{' '}
                        players in a day to earn the whole daily amount. Below
                        that, the rest is burned. No wallet may ever take more
                        than {round(data.lifetimeWalletCap)} in total.
                    </p>

                    <p className="rewards-fine">
                        Scores are recomputed on the server from a log of what
                        you did, so what your browser displays never decides
                        anything. The rules are in the open —{' '}
                        <a
                            href="https://github.com/printergobrrrmoney/thefed"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            read them
                        </a>
                        .
                    </p>
                </>
            )}
        </section>
    );
};

Rewards.propTypes = {
    className: string,
    compact: bool
};

Rewards.defaultProps = {
    className: undefined,
    compact: false
};

export default Rewards;
