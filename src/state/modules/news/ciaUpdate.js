import newsUpdate from './newsUpdate';

const updates = ({ name: { last: lastName } }) => [
    {
        text: `Welcome to the deep state, Chairman ${lastName}. We need you to start a propaganda campaign to assist our international monetary "adjustment" plans.`,
    },
];

const ciaUpdate = (game, published) => newsUpdate(updates, game, published);

export default ciaUpdate;
