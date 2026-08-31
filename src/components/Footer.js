import React from 'react';
import { node, shape, string, arrayOf } from 'prop-types';
import styled, { css } from 'styled-components';
import { Container as BSContainer } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faShareAlt,
    faChartLine,
    faMoneyBillWave,
} from '@fortawesome/free-solid-svg-icons';
import { faXTwitter } from '@fortawesome/free-brands-svg-icons';

const white = '#FFF';
const black = '#000';
const grey = '#AAA';
const brandColor = '#498200';

const flexCenter = css`
    display: flex;
    align-items: center;
    justify-content: center;
`;

const Container = styled(BSContainer)`
    font-size: 0.75rem;
    color: ${grey};
    background: ${white};
    border-top: 1px solid #eee;
    ${flexCenter}
    z-index: 5;
    position: relative;

    @media only screen and (max-width: 925px) {
        flex-direction: column;
    }
`;

const Item = styled.div`
    ${flexCenter}
    flex: 1;
    width: 100%;
    height: 100%;
    text-align: center;
`;

const Link = styled.a`
    ${flexCenter}
    color: ${black};
    font-weight: bold;
    text-align: center;
    min-height: 38px;
    padding: 0.75em 1em;
    height: 100%;
    width: 100%;

    &:hover,&:focus {
        background: ${({ color }) => color};
        color: ${white};
        text-decoration: none;
    }

    &:active {
        opacity: 0.5;
    }
`;

const linkHoverContents = css`
    ${Link}:hover &,
    ${Link}:focus & {
        color: ${white};
        cursor: pointer;
    }
`;

const Icon = styled(FontAwesomeIcon)`
    color: ${({ color }) => color};
    transition: transform 0.2s ease;
    ${({ sibling }) =>
        sibling &&
        css`
            margin-right: 0.25em;
        `}

    ${linkHoverContents}
`;

const ExternalLink = ({ children, icon, color, ...props }) => (
    <Link target="_blank" rel="noopener noreferrer" color={color} {...props}>
        {icon && (
            <Icon
                icon={icon}
                color={color}
                sibling={children}
                size="lg"
                fixedWidth
            />
        )}
        {children}
    </Link>
);
ExternalLink.propTypes = {
    children: node,
    icon: shape({}),
    color: string,
};
ExternalLink.defaultProps = {
    children: undefined,
    icon: undefined,
    color: black,
};

const SocialLink = styled(ExternalLink)`
    display: inline-block;
`;

const xUrl = 'https://x.com';
const twitterIntent = ({ url, handle, text, hashtags }) =>
    encodeURI(
        `${xUrl}/intent/tweet?url=${url}&via=${handle}&text=${text}&hashtags=${hashtags.map(
            (hashtag) => `#${hashtag}`
        )}`
    );

const Footer = ({ homepage, tweet, items, ...props }) => {
    const footerItems = [
        {
            children: '$BRRR',
            href: homepage,
            icon: faMoneyBillWave,
            color: brandColor,
        },
        ...items,
    ];

    return (
        <Container as="footer" role="contentinfo" fixed="bottom" {...props}>
            {footerItems.map((item) => (
                <Item key={item.href || 'SocialLinks'}>
                    {Array.isArray(item) ? (
                        item.map((link) => (
                            <SocialLink key={link.href} {...link} />
                        ))
                    ) : (
                        <ExternalLink
                            {...{
                                ...item,
                                ...(item.isTwitterIntent
                                    ? { href: twitterIntent(tweet) }
                                    : {}),
                            }}
                        />
                    )}
                </Item>
            ))}
        </Container>
    );
};

Footer.propTypes = {
    homepage: string,
    tweet: shape({
        url: string,
        text: string,
        hashtags: arrayOf(string),
    }),
    items: arrayOf(
        shape({
            children: node,
            title: string,
            href: string,
            icon: shape({}),
            color: string,
            className: string,
        })
    ),
};

const homepage = 'https://printergobrrr.money';
const chartUrl =
    'https://dexscreener.com/solana/6wdxyu21jeqzsqwg85dxyhczdvysxxupnsut1etqmoon';

const tweet = {
    url: 'https://game.printergobrrr.money',
    text:
        'Play as Jerome Powell and see if you can print faster at the @federalreserve:',
    handle: 'moneyprintergo',
    hashtags: ['BRRR'],
};

const items = [
    {
        children: 'Buy $BRRR',
        href: chartUrl,
        icon: faChartLine,
        color: '#700fdd',
    },
    {
        children: 'Share',
        className: 'share-twitter',
        href: twitterIntent(tweet),
        icon: faShareAlt,
        color: black,
        isTwitterIntent: true,
    },
    [
        {
            title: 'X',
            href: `${xUrl}/${tweet.handle}`,
            icon: faXTwitter,
            color: black,
        },
    ],
];

Footer.defaultProps = {
    homepage,
    tweet,
    items,
};

export default Footer;
