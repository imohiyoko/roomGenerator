import React, { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { API } from './lib/api';
import { useStore } from './store';

import Home from './pages/Home';
import Library from './pages/Library';
import Editor from './pages/Editor';
import Settings from './pages/Settings';

const App = () => {
    // --- Store Selectors ---
    const setProjects = useStore(state => state.setProjects);
    const setGlobalAssets = useStore(state => state.setGlobalAssets);
    const setColorPalette = useStore(state => state.setColorPalette);
    const setDefaultColors = useStore(state => state.setDefaultColors);
    const setCategoryLabels = useStore(state => state.setCategoryLabels);
    const setAllSettings = useStore(state => state.setAllSettings);

    // --- Effects ---

    // Initial Load
    useEffect(() => {
        API.getProjects().then(setProjects);
        API.getAssets().then(assets => setGlobalAssets((assets || []).map(a => ({ ...a, source: 'global' }))));
        API.getPalette().then(data => {
            if (data?.colors) setColorPalette(data.colors);
            if (data?.defaults) setDefaultColors(data.defaults);
            if (data?.labels) setCategoryLabels(data.labels);
        });
        API.getSettings().then(settings => {
            if (settings) setAllSettings(settings);
        });
    }, []);

    return (
        <HashRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/library" element={<Library />} />
                <Route path="/project/:id" element={<Editor />} />
                <Route path="/settings" element={<Settings />} />
            </Routes>
        </HashRouter>
    );
};

export default App;
