/* global BigInt */
import React, { useState, useEffect, useCallback } from 'react';
import { string, func } from 'prop-types';
import { connect } from 'react-redux';
import { Button, Alert, Spinner } from 'react-bootstrap';
import { signAndSendMessage } from '../../wallet';
import { buildClaimMessage } from '../../claim/instruction';
import commatize from '../../commatizeNumber';

/**
 * Claiming one day.
 *
 * The transaction is assembled here rather than fetched ready-made. The API
 * supplies the proof and the addresses; this decides that the transaction
 * contains one instruction and that the instruction is a claim. A compromised
 * API can therefore hand over a wrong address — which the program rejects, since
 * it checks the vault, the claim status seeds and the destination itself — but
 * it cannot add a second instruction beside the claim.
 */
const DECIMALS = 9;

const display = (baseUnits) => {
    const whole = BigInt(baseUnits) / BigInt(10 ** DECIMALS);
    const fraction = BigInt(baseUnits) % BigInt(10 ** DECIMALS);
    const decimals = fraction.toString().padStart(DECIMALS, '0').slice(0, 2);
    return `${commatize(whole.toString())}.${decimals}`;
};

export const ClaimDay = ({ address, walletId, day, onClaimed }) => {
    const [state, setState] = useState({ status: 'loading' });
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const [signature, setSignature] = useState(null);

    useEffect(() => {
        let live = true;
        setState({ status: 'loading' });
        fetch(
            `/api/claim/proof?address=${encodeURIComponent(
                address
            )}&day=${encodeURIComponent(day)}`
        )
            .then((r) => r.json())
            .then((data) => live && setState({ status: 'ready', data }))
            .catch(() => live && setState({ status: 'failed' }));
        return () => {
            live = false;
        };
    }, [address, day]);

    const claim = useCallback(async () => {
        setSending(true);
        setError(null);
        try {
            const { claimable } = state.data;

            // The blockhash has to be fresh, and it is the one thing here that
            // has to come from a node rather than from us.
            const context = await fetch(
                `/api/claim/context?address=${encodeURIComponent(
                    address
                )}&day=${encodeURIComponent(day)}`
            ).then((r) => r.json());
            if (context.error) throw new Error(context.error);

            const { encoded } = buildClaimMessage({
                claimant: address,
                distributor: claimable.distributor,
                claimStatus: context.claimStatus,
                vault: context.vault,
                destination: context.destination,
                amountUnlocked: claimable.amountUnlocked,
                amountLocked: claimable.amountLocked,
                proof: claimable.proof,
                recentBlockhash: context.recentBlockhash,
                createDestination: context.createDestination || null,
            });

            const sent = await signAndSendMessage(walletId, encoded);
            setSignature(sent);
            if (onClaimed) onClaimed(sent);
        } catch (problem) {
            // A rejection in the wallet is a decision, not a failure.
            const message = String(problem.message || problem);
            setError(
                /reject|denied|cancel/i.test(message)
                    ? 'You declined the transaction. Nothing was sent.'
                    : message
            );
        } finally {
            setSending(false);
        }
    }, [address, day, state, walletId, onClaimed]);

    if (state.status === 'loading') {
        return (
            <p className="claim-fine">
                <Spinner animation="border" size="sm" className="mr-2" />
                Checking {day}…
            </p>
        );
    }

    if (state.status === 'failed') {
        return <p className="claim-error">Could not reach the server.</p>;
    }

    const { data } = state;

    if (!data.published) {
        return (
            <p className="claim-fine">
                Nothing has been published for {day} yet.
            </p>
        );
    }

    if (!data.claimable) {
        return (
            <p className="claim-fine">
                {day}: this wallet earned nothing that day.
            </p>
        );
    }

    if (signature || data.claimedAt) {
        return (
            <Alert variant="success" className="claim-status">
                <strong>{display(data.claimable.amountUnlocked)} $BRRR</strong>{' '}
                claimed for {day}.
                {signature && (
                    <div className="claim-fine mt-1">
                        Transaction {signature.slice(0, 16)}…
                    </div>
                )}
            </Alert>
        );
    }

    return (
        <div className="claim-standing">
            <p className="claim-who">
                <strong>{display(data.claimable.amountUnlocked)} $BRRR</strong>
                <span>earned on {day}</span>
            </p>
            <Button onClick={claim} disabled={sending}>
                {sending ? 'Waiting for your wallet…' : 'Claim'}
            </Button>
            <p className="claim-fine mt-2">
                Your wallet will show one instruction, sending these tokens to
                you. Nothing leaves your wallet but the network fee.
            </p>
            {error && <p className="claim-error">{error}</p>}
        </div>
    );
};

ClaimDay.propTypes = {
    address: string.isRequired,
    walletId: string.isRequired,
    day: string.isRequired,
    onClaimed: func,
};

ClaimDay.defaultProps = {
    onClaimed: undefined,
};

const mapStateToProps = ({ wallet }) => ({
    address: wallet.address,
    walletId: wallet.walletId,
});

export default connect(mapStateToProps)(ClaimDay);
