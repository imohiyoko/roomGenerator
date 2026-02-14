import { API } from '../lib/api';
import { syncAssetColors, forkAsset } from './assetService';
import { normalizeAsset } from '../lib/utils';

const DEFAULT_COLORS = { room: '#fdfcdc', furniture: '#8fbc8f', fixture: '#cccccc' };

/**
 * Loads project data, global assets, and palette, and performs normalization.
 * @param {string} projectId
 * @returns {Promise<{
 *   globalAssets: Array,
 *   colorPalette: Array,
 *   defaultColors: Object,
 *   localAssets: Array,
 *   instances: Array
 * }>}
 */
export const loadProjectService = async (projectId) => {
    const [projectData, globalAssetsData, paletteData] = await Promise.all([
        API.getProjectData(projectId),
        API.getAssets(),
        API.getPalette()
    ]);

    // Normalize global assets to use entities
    const globalAssets = (globalAssetsData || []).map(a => {
        const normalized = normalizeAsset(a);
        return { ...normalized, source: 'global' };
    });

    const colorPalette = paletteData?.colors || [];
    const defaultColors = paletteData?.defaults || DEFAULT_COLORS;

    // Normalize loaded local assets
    let loadedAssets = (projectData?.assets || []).map(normalizeAsset);
    let instances = projectData?.instances || [];

    // Logic: Fork Global Assets if Project Empty
    if (loadedAssets.length === 0) {
        loadedAssets = globalAssets.map(ga => forkAsset(ga, defaultColors));
    } else {
        // Sync existing local assets
        loadedAssets = syncAssetColors(loadedAssets, defaultColors);
    }

    return {
        globalAssets,
        colorPalette,
        defaultColors,
        localAssets: loadedAssets,
        instances
    };
};
