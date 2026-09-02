import React, { useState } from 'react';
import { func, node, bool } from 'prop-types';
import { connect } from 'react-redux';
import { Row, Col, Form, Button } from 'react-bootstrap';
import { setPlayer } from '../../../state/modules/game';
import { chooseDisplayName } from '../../../state/modules/wallet';
import {
    nameProblem,
    MESSAGES,
    MAX_LENGTH,
} from '../../../leaderboard/displayName';
import WalletSection from './WalletSection';

const FormGroup = (props) => <Form.Group className="text-left" {...props} />;

const FormRow = ({ leftCol: LeftCol, rightCol: RightCol }) => (
    <Row>
        <Col className="pr-2">{LeftCol}</Col>
        <Col className="pl-2">{RightCol}</Col>
    </Row>
);

FormRow.propTypes = {
    leftCol: node.isRequired,
    rightCol: node.isRequired,
};

const Application = ({
    signedIn,
    handleSetPlayer,
    handleChooseName,
    handleNext,
}) => {
    const [name, setName] = useState({ first: '', last: '' });
    const [nameError, setNameError] = useState(null);
    const handleChange = ({ target: { id, value } }) => {
        setName({ ...name, [id.slice(0, -4)]: value });
        setNameError(null);
    };

    // The name on the application is the name on the leaderboard, so it has to
    // pass the same rules — but only for players who will actually appear on
    // it. Someone playing unscored can call themselves anything.
    const boardName = `${name.first} ${name.last}`.trim();

    const handleSubmit = async (event) => {
        if (event) event.preventDefault();

        if (signedIn) {
            const problem = nameProblem(boardName);
            if (problem) {
                setNameError(MESSAGES[problem]);
                return;
            }
            const code = await handleChooseName(boardName);
            if (code) {
                setNameError('That name was not accepted for the leaderboard.');
                return;
            }
        }

        handleSetPlayer({ name });
        handleNext();
    };

    return (
        <>
            <p className="lead">Federal Reserve Chair Application</p>
            <hr />
            <Form onSubmit={handleSubmit}>
                <WalletSection />
                <FormGroup>
                    <Form.Label htmlFor="firstName">Name</Form.Label>
                    <FormRow
                        leftCol={
                            <Form.Control
                                value={name.first}
                                onChange={handleChange}
                                id="firstName"
                                type="text"
                                size="lg"
                                placeholder="First"
                                aria-label="Player first name"
                                maxLength={MAX_LENGTH}
                                required
                            />
                        }
                        rightCol={
                            <Form.Control
                                value={name.last}
                                onChange={handleChange}
                                id="lastName"
                                type="text"
                                size="lg"
                                placeholder="Last"
                                aria-label="Player last name"
                                maxLength={MAX_LENGTH}
                                required
                            />
                        }
                    />
                    {signedIn && (
                        <Form.Text
                            className={nameError ? 'text-danger' : 'text-muted'}
                        >
                            {nameError ||
                                'This is the name that appears on the leaderboard.'}
                        </Form.Text>
                    )}
                </FormGroup>
                <Button
                    size="lg"
                    type="submit"
                    variant="primary"
                    className="mt-3"
                >
                    Apply
                </Button>
            </Form>
        </>
    );
};

Application.propTypes = {
    signedIn: bool.isRequired,
    handleChooseName: func.isRequired,
    handleSetPlayer: func.isRequired,
    handleNext: func.isRequired,
};

const mapStateToProps = ({ wallet }) => ({
    signedIn: wallet.signedIn,
});

const mapDispatchToProps = {
    handleSetPlayer: setPlayer,
    handleChooseName: chooseDisplayName,
};

export default connect(mapStateToProps, mapDispatchToProps)(Application);
