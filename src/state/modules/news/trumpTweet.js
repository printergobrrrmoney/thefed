import newsUpdate from './newsUpdate';

const tweets = ({ name: { first: firstName, last: lastName } }) => [
    {
        text: 'Thank you Kanye, very cool!',
        time: 1,
    },
    {
        text: `I'd like to welcome ${firstName} ${lastName} as the new Fed Chair. I know they'll do absolutely tremendous and make our country proud!`,
        time: 3,
    },
    {
        text: `I really wish Fed Chairman ${lastName} would pick up the pace on growing our economy. We need to see BIG LEAGUE money printing FAST!`,
        time: 10,
    },
    {
        text: "The haters and losers say it's impossible to see the U.S. dollar inflate as bigly as the Venezuelan bolívar. I say THINK BIGGER and PRINT BABY PRINT!",
        time: 30,
    },
    {
        text: `I hope ${firstName} over at the Fed understands monetary policy as well as I do—get smart!`,
        time: 60,
    },
    {
        text: `If anyone is looking for a Fed Chair, I would strongly suggest that you don't retain the services of ${firstName} ${lastName}!`,
        time: 70,
        lessThan: {
            totalPrinted: 10000,
        },
    },
    {
        text: 'Stop ruining my perfect economy! The Fed needs to DROP interest rates to get out the spending!',
        time: 90,
    },
    {
        text: 'I once saw a "YouTube" video on "quantitative easing". Seems simple. Don\'t know why we aren\'t doing more of it!',
        time: 120,
    },
    {
        text: `The dems will try to tell you we can't "inflate the economy"! With ${firstName} printing so much money at The Fed and giving it to the American people, I think they need to think bigger and MAGA!`,
        time: 150,
    },
    {
        text: `${firstName} ${lastName} is doing a great job, I am very proud of them. Their predecessor, Little Jerome, didn’t have the mental capacity needed. He was dumb as a dog and I couldn’t get rid of him fast enough. He was lazy as hell. Now it is a whole new ballgame, great spirit at The Fed! `,
        time: 180,
    },
    // Everything above fires on a fixed second, which put the entire feed in
    // the first three minutes of an hour-long term and left the rest silent.
    // These key off what has actually been printed instead, so they arrive
    // when a player gets there -- and a slower run still hears all of them.
    {
        text: `A MILLION dollars printed under ${lastName}. Not bad. I have made more before breakfast, but not bad!`,
        atLeast: { totalPrinted: 1000000 },
    },
    {
        text: 'A BILLION dollars! The fake news won’t report this. Tremendous work at the Fed!',
        atLeast: { totalPrinted: 1000000000 },
    },
    {
        text: `A TRILLION. ${firstName} is printing so much money, people are saying they have never seen anything like it. Very unfair to Venezuela!`,
        atLeast: { totalPrinted: 1000000000000 },
    },
    {
        text: 'A QUADRILLION dollars. Economists are baffled. I am not baffled. I knew this would happen. I called it!',
        atLeast: { totalPrinted: 1000000000000000 },
    },
    {
        text: `A QUINTILLION! ${lastName} has printed more money than there are grains of sand. Nobel Prize? We will see!`,
        atLeast: { totalPrinted: 1000000000000000000 },
    },
    {
        text: 'The dollar is now worth so little that the penny has been discontinued out of respect. GREAT job everybody!',
        atLeast: { totalPrinted: 1e21 },
    },
    {
        text: `Numbers this big do not even have names anymore. ${firstName} just calls them “lots”. Very presidential!`,
        atLeast: { totalPrinted: 1e24 },
    },
    {
        text: 'I am told we have printed more dollars than there are atoms in a small country. Which country? They would not say. SAD!',
        atLeast: { totalPrinted: 1e27 },
    },
    {
        text: `Still going. ${lastName} will not stop. Somebody should check on ${firstName}, honestly. Tremendous though!`,
        atLeast: { totalPrinted: 1e30 },
    },
];

const trumpTweet = (game, published) => newsUpdate(tweets, game, published);

export default trumpTweet;
