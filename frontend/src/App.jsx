import React, { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { API } from './lib/api';
import { useStore } from './store';

import Home from './pages/Home';
import Library from './pages/Library';
import Editor from './pages/Editor';

const App = () => {
    // --- Store Selectors ---
    const setProjects = useStore(state => state.setProjects);
    const setGlobalAssets = useStore(state => state.setGlobalAssets);
    const setColorPalette = useStore(state => state.setColorPalette);

    // --- Effects ---

    // Initial Load
    useEffect(() => {
        API.getProjects().then(setProjects);
        API.getAssets().then(assets => setGlobalAssets((assets || []).map(a => ({ ...a, source: 'global' }))));
        API.getPalette().then(data => {
            if (data?.colors) setColorPalette(data.colors);
            if (data?.defaults) useStore.setState({ defaultColors: data.defaults });
        });
    }, []);

    return (
        <HashRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/library" element={<Library />} />
                <Route path="/project/:id" element={<Editor />} />
            </Routes>
        </HashRouter>
    );
};

export default App;
