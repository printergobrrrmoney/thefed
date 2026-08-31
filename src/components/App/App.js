import React from 'react';
import Loadable from 'react-loadable';
import Helmet from 'react-helmet';
import { Switch, Route } from 'react-router-dom';
import loading from '../Loading';
import Modal from '../Modal';
import 'typeface-vt323';
import './App.scss';

const title = process.env.REACT_APP_TITLE;

const Start = Loadable({
    loader: () => import('../Start'),
    loading
});

const Game = Loadable({
    loader: () => import('../Game'),
    loading
});

const NotFound = Loadable({
    loader: () => import('../NotFound'),
    loading
});

const App = () => (
    <>
        <Helmet defaultTitle={title} titleTemplate={`${title} » %s`} />
        <Switch>
            <Route path="/" exact component={Game} />
            <Route path="/apply" exact component={Start} />
            <Route component={NotFound} />
        </Switch>
        <Modal />
    </>
);

export default App;
