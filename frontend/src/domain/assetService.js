import { deepClone } from '../lib/utils';
import { BASE_SCALE } from '../lib/constants';

// --- Logic from store.js ---

// Fork a global asset to a local one
export const forkAsset = (asset, defaultColors) => {
    const now = Date.now();
    const newLocalId = `a-fork-${now}-${Math.floor(Math.random() * 1000)}`;
    const newLocalAsset = deepClone(asset);
    newLocalAsset.id = newLocalId;
    newLocalAsset.name = asset.name;
    delete newLocalAsset.source;

    // Default shape logic
    if (asset.isDefaultShape) newLocalAsset.isDefaultShape = true;

    // Sync color
    if (newLocalAsset.isDefaultShape && defaultColors[newLocalAsset.type]) {
        const color = defaultColors[newLocalAsset.type];
        newLocalAsset.color = color;
        newLocalAsset.shapes = (newLocalAsset.shapes || []).map(s => ({...s, color}));
    }

    return newLocalAsset;
};

// Sync multiple assets with default colors
export const syncAssetColors = (assets, defaultColors) => {
    return assets.map(a => {
        if (a.isDefaultShape && defaultColors[a.type] && a.color !== defaultColors[a.type]) {
            const color = defaultColors[a.type];
            const updated = { ...a, color: color };
            updated.shapes = (a.shapes || []).map(s => ({ ...s, color: color }));
            return updated;
        }
        return a;
    });
};

// Create a new instance
export const createInstance = (asset, viewState) => {
    const now = Date.now();
    return {
        id: `i-${now}-${Math.floor(Math.random() * 1000)}`,
        assetId: asset.id,
        x: (400 - viewState.x) / viewState.scale / BASE_SCALE,
        y: (300 - viewState.y) / viewState.scale / BASE_SCALE,
        rotation: 0,
        locked: false,
        type: asset.type || 'unknown'
    };
};

// Create a new text instance
export const createTextInstance = (viewState) => {
    const now = Date.now();
    return {
        id: `t-${now}-${Math.floor(Math.random() * 1000)}`,
        type: 'text',
        text: 'テキスト',
        fontSize: 24,
        color: '#333333',
        x: (400 - viewState.x) / viewState.scale / BASE_SCALE,
        y: (300 - viewState.y) / viewState.scale / BASE_SCALE,
        rotation: 0,
        locked: false
    };
};
