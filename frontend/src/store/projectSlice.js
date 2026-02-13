import { API } from '../lib/api';
import { syncAssetColors, forkAsset } from '../domain/assetService';

const DEFAULT_COLORS = { room: '#fdfcdc', furniture: '#8fbc8f', fixture: '#cccccc' };

export const createProjectSlice = (set, get) => ({
    projects: [],
    currentProjectId: null,

    setProjects: (updater) => set((state) => ({ projects: typeof updater === 'function' ? updater(state.projects) : updater })),
    setCurrentProjectId: (id) => set({ currentProjectId: id }),

    loadProject: async (projectId) => {
        if (!projectId) {
            set({ currentProjectId: null });
            return;
        }

        set({ currentProjectId: projectId });

        const [projectData, globalAssetsData, paletteData] = await Promise.all([
            API.getProjectData(projectId),
            API.getAssets(),
            API.getPalette()
        ]);

        const globalAssets = (globalAssetsData || []).map(a => ({ ...a, source: 'global' }));
        const colorPalette = paletteData?.colors || [];
        const defaultColors = paletteData?.defaults || DEFAULT_COLORS;

        let loadedAssets = projectData?.assets || [];
        let instances = projectData?.instances || [];

        // Logic: Fork Global Assets if Project Empty
        if (loadedAssets.length === 0) {
            loadedAssets = globalAssets.map(ga => forkAsset(ga, defaultColors));
        } else {
            // Sync existing local assets
            loadedAssets = syncAssetColors(loadedAssets, defaultColors);
        }

        set({
            globalAssets,
            colorPalette,
            defaultColors,
            localAssets: loadedAssets,
            instances,
            selectedIds: [],
            designTargetId: null,
            selectedShapeIndices: [],
            selectedPointIndex: null,
            viewState: { x: 50, y: 50, scale: 1 }
        });

        get().temporal?.clear();
    },

    saveProjectData: async () => {
        const state = get();
        if (!state.currentProjectId) return;
        await API.saveProjectData(state.currentProjectId, {
            assets: state.localAssets,
            instances: state.instances
        });
    }
});
