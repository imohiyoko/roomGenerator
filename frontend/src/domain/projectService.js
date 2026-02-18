import { syncAssetColors, forkAsset } from './assetService.js';
import { normalizeAsset } from '../lib/utils.js';

export const DEFAULT_COLORS = { room: '#fdfcdc', furniture: '#8fbc8f', fixture: '#cccccc' };

/**
 * Loads and normalizes project data, global assets, and palette settings.
 * @param {string} projectId - The ID of the project to load.
 * @param {Object} api - The API interface (must have getProjectData, getAssets, getPalette).
 * @returns {Promise<Object>} - The normalized project state.
 */
export const loadProjectData = async (projectId, api) => {
    if (!projectId) {
        return null;
    }

    const [projectData, globalAssetsData, paletteData] = await Promise.all([
        api.getProjectData(projectId),
        api.getAssets(),
        api.getPalette()
    ]);

    // Normalize global assets to use entities
    const globalAssets = (globalAssetsData || []).map(a => {
        const normalized = normalizeAsset(a); // Helper from utils
        return { ...normalized, source: 'global' };
    });

    const colorPalette = paletteData?.colors || [];
    const globalDefaultColors = paletteData?.defaults || DEFAULT_COLORS;
    const categoryLabels = paletteData?.labels || {};
    const projectDefaultColors = projectData?.defaultColors || {};

    // Merge defaults: Project specific overrides global
    const defaultColors = { ...globalDefaultColors, ...projectDefaultColors };

    // Normalize loaded local assets
    let loadedAssets = (projectData?.assets || []).map(normalizeAsset);
    let instances = projectData?.instances || [];

    // Logic: Fork Global Assets if Project Empty
    if (loadedAssets.length === 0) {
        loadedAssets = globalAssets.map(ga => forkAsset(ga, defaultColors));
    } else {
        // Sync existing local assets
        // Note: syncAssetColors also handles basic normalization if missed
        loadedAssets = syncAssetColors(loadedAssets, defaultColors);
    }

    return {
        currentProjectId: projectId,
        globalAssets,
        colorPalette,
        globalDefaultColors,
        projectDefaultColors,
        defaultColors,
        categoryLabels,
        localAssets: loadedAssets,
        instances,
        // Reset selection state
        selectedIds: [],
        designTargetId: null,
        selectedShapeIndices: [],
        selectedPointIndex: null,
        // Reset ViewState
        viewState: { x: 50, y: 600, scale: 1 }
    };
};
