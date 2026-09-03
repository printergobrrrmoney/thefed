import uuid from 'uuid/v3';

const atLeast = (a, b) => a >= b;
const lessThan = (a, b) => a < b;

export const idFor = (text) =>
    `news-${uuid(text, process.env.REACT_APP_UUID_V3_NAMESPACE)}`;

/**
 * Picks the next piece of news, if there is one.
 *
 * Entries used to need an exact `time`, because nothing stopped one firing
 * again on the following tick — which pushed every tweet into a fixed opening
 * window and left the rest of the term silent. Skipping what has already been
 * published means an entry can key off the state instead, and fire whenever a
 * player actually gets there. A run that takes twenty minutes to reach a
 * billion hears about it at twenty minutes.
 */
const newsUpdate = (updates, game, published) => {
    const { player, time } = game;
    const alreadySaid = new Set((published || []).map(({ id }) => id));

    const attributeFilter = (attributes, filter) =>
        attributes
            ? Object.keys(attributes).reduce(
                  (acc, attribute) =>
                      acc && filter(game[attribute], attributes[attribute]),
                  true
              )
            : true;

    const update = updates(player).find(
        ({
            text,
            time: updateTime,
            atLeast: atLeastAttributes,
            lessThan: lessThanAttributes,
        }) =>
            !alreadySaid.has(idFor(text)) &&
            (updateTime ? time === updateTime : true) &&
            attributeFilter(atLeastAttributes, atLeast) &&
            attributeFilter(lessThanAttributes, lessThan)
    );

    return update
        ? [
              {
                  id: idFor(update.text),
                  text: update.text,
                  time: update.time === undefined ? time : update.time,
              },
          ]
        : [];
};

export default newsUpdate;
