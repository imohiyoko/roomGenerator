import { API } from '../lib/api';
import { loadProjectService } from '../domain/projectService';

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

        const data = await loadProjectService(projectId);

        set({
            ...data,
            selectedIds: [],
            designTargetId: null,
            selectedShapeIndices: [],
            selectedPointIndex: null,
            viewState: { x: 50, y: 600, scale: 1 }
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
