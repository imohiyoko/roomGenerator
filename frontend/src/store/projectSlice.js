import { API } from '../lib/api';
import { syncAssetColors } from '../domain/assetService';
import { loadProjectData, DEFAULT_COLORS } from '../domain/projectService';

export const createProjectSlice = (set, get) => ({
    projects: [],
    currentProjectId: null,
    viewState: { x: 50, y: 600, scale: 1 },

    setProjects: (updater) => set((state) => ({ projects: typeof updater === 'function' ? updater(state.projects) : updater })),
    setCurrentProjectId: (id) => set({ currentProjectId: id }),

    loadProject: async (projectId) => {
        if (!projectId) {
            set({ currentProjectId: null });
            return;
        }

        set({ currentProjectId: projectId });

        const newState = await loadProjectData(projectId, API);

        if (newState) {
            set(newState);
            get().temporal?.clear();
        }
    },

    saveProjectData: async () => {
        const state = get();
        if (!state.currentProjectId) return;
        await API.saveProjectData(state.currentProjectId, {
            assets: state.localAssets,
            instances: state.instances,
            defaultColors: state.projectDefaultColors
        });
    },

    updateProjectDefaultColor: (categoryKey, newColor) => {
        const state = get();
        const projectDefaultColors = { ...(state.projectDefaultColors || {}), [categoryKey]: newColor };
        // globalDefaultColors might be undefined if not loaded yet, but usually is loaded.
        // Fallback to DEFAULT_COLORS just in case.
        const baseColors = state.globalDefaultColors || DEFAULT_COLORS;
        const defaultColors = { ...baseColors, ...projectDefaultColors };

        const newLocalAssets = syncAssetColors(state.localAssets || [], defaultColors);

        set({
            projectDefaultColors,
            defaultColors,
            localAssets: newLocalAssets
        });
    },

    resetProjectDefaultColors: () => {
        const state = get();
        const projectDefaultColors = {};
        const baseColors = state.globalDefaultColors || DEFAULT_COLORS;
        const defaultColors = { ...baseColors };

        const newLocalAssets = syncAssetColors(state.localAssets || [], defaultColors);

        set({
            projectDefaultColors,
            defaultColors,
            localAssets: newLocalAssets
        });
    }
});
