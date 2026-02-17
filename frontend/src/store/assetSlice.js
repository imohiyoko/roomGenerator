import { API } from '../lib/api';
import { syncAssetColors } from '../domain/assetService';

export const createAssetSlice = (set, get) => ({
    localAssets: [],
    globalAssets: [],
    colorPalette: [],
    defaultColors: {},
    categoryLabels: {},

    setLocalAssets: (updater) => set((state) => ({ localAssets: typeof updater === 'function' ? updater(state.localAssets) : updater })),
    setGlobalAssets: (updater) => set((state) => ({ globalAssets: typeof updater === 'function' ? updater(state.globalAssets) : updater })),

    setColorPalette: (colors) => set({ colorPalette: colors }),
    setDefaultColors: (defaults) => set({ defaultColors: defaults }),
    setCategoryLabels: (labels) => set({ categoryLabels: labels }),

    updateDefaultColor: (type, color) => {
        const state = get();
        const newGlobalDefaults = { ...(state.globalDefaultColors || {}), [type]: color };
        API.savePalette({ colors: state.colorPalette, defaults: newGlobalDefaults, labels: state.categoryLabels });

        const effectiveDefaults = { ...newGlobalDefaults, ...(state.projectDefaultColors || {}) };
        set({
            globalDefaultColors: newGlobalDefaults,
            defaultColors: effectiveDefaults,
            localAssets: syncAssetColors(state.localAssets, effectiveDefaults),
            globalAssets: syncAssetColors(state.globalAssets, newGlobalDefaults)
        });
    },

    addToPalette: (color) => {
        const state = get();
        if (!state.colorPalette.includes(color)) {
            const newPalette = [...state.colorPalette, color];
            set({ colorPalette: newPalette });
            API.savePalette({ colors: newPalette, defaults: state.globalDefaultColors || {}, labels: state.categoryLabels });
        }
    },

    removeFromPalette: (index) => {
        const state = get();
        const newPalette = state.colorPalette.filter((_, i) => i !== index);
        set({ colorPalette: newPalette });
        API.savePalette({ colors: newPalette, defaults: state.globalDefaultColors || {}, labels: state.categoryLabels });
    },

    addCategory: (key, label, color) => {
        const state = get();
        const newGlobalDefaults = { ...(state.globalDefaultColors || {}), [key]: color };
        const newLabels = { ...state.categoryLabels, [key]: label };

        const effectiveDefaults = { ...newGlobalDefaults, ...(state.projectDefaultColors || {}) };
        set({ globalDefaultColors: newGlobalDefaults, defaultColors: effectiveDefaults, categoryLabels: newLabels });
        API.savePalette({ colors: state.colorPalette, defaults: newGlobalDefaults, labels: newLabels });
    },

    removeCategory: (key) => {
        const state = get();
        const newGlobalDefaults = { ...(state.globalDefaultColors || {}) };
        delete newGlobalDefaults[key];
        const newLabels = { ...state.categoryLabels };
        delete newLabels[key];

        // Also remove from project overrides if present
        const newProjectDefaults = { ...(state.projectDefaultColors || {}) };
        delete newProjectDefaults[key];

        const effectiveDefaults = { ...newGlobalDefaults, ...newProjectDefaults };
        set({ globalDefaultColors: newGlobalDefaults, projectDefaultColors: newProjectDefaults, defaultColors: effectiveDefaults, categoryLabels: newLabels });
        API.savePalette({ colors: state.colorPalette, defaults: newGlobalDefaults, labels: newLabels });
    },

    updateCategoryLabel: (key, label) => {
        const state = get();
        const newLabels = { ...state.categoryLabels, [key]: label };
        set({ categoryLabels: newLabels });
        API.savePalette({ colors: state.colorPalette, defaults: state.globalDefaultColors || {}, labels: newLabels });
    },
});
