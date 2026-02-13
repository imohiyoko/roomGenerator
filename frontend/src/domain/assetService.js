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

    // Normalize: Ensure entities exist (renaming shapes -> entities)
    if (!newLocalAsset.entities && newLocalAsset.shapes) {
        newLocalAsset.entities = newLocalAsset.shapes;
        delete newLocalAsset.shapes;
    }

    // Default shape logic
    if (asset.isDefaultShape) newLocalAsset.isDefaultShape = true;

    // Sync color
    if (newLocalAsset.isDefaultShape && defaultColors[newLocalAsset.type]) {
        const color = defaultColors[newLocalAsset.type];
        newLocalAsset.color = color;
        newLocalAsset.entities = (newLocalAsset.entities || []).map(s => ({...s, color, layer: s.layer || '0'}));
    } else {
        // Ensure layer exists
        newLocalAsset.entities = (newLocalAsset.entities || []).map(s => ({...s, layer: s.layer || '0'}));
    }

    return newLocalAsset;
};

// Sync multiple assets with default colors
export const syncAssetColors = (assets, defaultColors) => {
    return assets.map(a => {
        // Migration/Normalization on the fly if needed
        let entities = a.entities;
        if (!entities && a.shapes) {
            entities = a.shapes;
        }

        if (a.isDefaultShape && defaultColors[a.type] && a.color !== defaultColors[a.type]) {
            const color = defaultColors[a.type];
            const updated = { ...a, color: color, entities: entities }; // Use entities
            delete updated.shapes; // Clean up old key

            updated.entities = (updated.entities || []).map(s => ({ ...s, color: color, layer: s.layer || '0' }));
            return updated;
        }

        // Even if not syncing color, ensure structure is correct
        if (!a.entities && a.shapes) {
            const updated = { ...a, entities: a.shapes };
            delete updated.shapes;
             updated.entities = (updated.entities || []).map(s => ({ ...s, layer: s.layer || '0' }));
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
        // Instances are placed in the "Room" coordinate space.
        // If we want the whole system to be Cartesian Y-Up, then instances should also store Y-up coordinates.
        // ViewState (Pan/Zoom) is a UI concept.
        // Typically mouse coords are screen coords.
        // (ScreenY - PanY) / Scale = WorldY_SVG (Y-down)
        // We want WorldY_Cartesian (Y-up) = -WorldY_SVG.
        // So y = - ((300 - viewState.y) / scale).
        // Wait, the original code: y: (300 - viewState.y) / ...
        // This placed the object at screen center (400, 300).
        // If viewState.y is translation, then (300 - vy) is the offset from origin.
        // Existing logic: (Screen - Translate) / Scale.
        // New logic: We want Cartesian Y.
        // Screen Y (300) -> SVG World Y -> Cartesian World Y.
        // SVG World Y = (300 - viewState.y) / viewState.scale.
        // Cartesian World Y = - SVG World Y.

        x: (400 - viewState.x) / viewState.scale / BASE_SCALE,
        y: -((300 - viewState.y) / viewState.scale / BASE_SCALE), // Flip Y for Cartesian
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
        y: -((300 - viewState.y) / viewState.scale / BASE_SCALE), // Flip Y
        rotation: 0,
        locked: false
    };
};
