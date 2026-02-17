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
        const newDefaults = { ...state.defaultColors, [type]: color };
        API.savePalette({ colors: state.colorPalette, defaults: newDefaults, labels: state.categoryLabels });

        set({
            defaultColors: newDefaults,
            localAssets: syncAssetColors(state.localAssets, newDefaults),
            globalAssets: syncAssetColors(state.globalAssets, newDefaults)
        });
    },

    addToPalette: (color) => {
        const state = get();
        if (!state.colorPalette.includes(color)) {
            const newPalette = [...state.colorPalette, color];
            set({ colorPalette: newPalette });
            API.savePalette({ colors: newPalette, defaults: state.defaultColors, labels: state.categoryLabels });
        }
    },

    removeFromPalette: (index) => {
        const state = get();
        const newPalette = state.colorPalette.filter((_, i) => i !== index);
        set({ colorPalette: newPalette });
        API.savePalette({ colors: newPalette, defaults: state.defaultColors, labels: state.categoryLabels });
    },

    addCategory: (key, label, color) => {
        const state = get();
        const newDefaults = { ...state.defaultColors, [key]: color };
        const newLabels = { ...state.categoryLabels, [key]: label };

        set({ defaultColors: newDefaults, categoryLabels: newLabels });
        API.savePalette({ colors: state.colorPalette, defaults: newDefaults, labels: newLabels });
    },

    removeCategory: (key) => {
        const state = get();
        const newDefaults = { ...state.defaultColors };
        delete newDefaults[key];
        const newLabels = { ...state.categoryLabels };
        delete newLabels[key];

        set({ defaultColors: newDefaults, categoryLabels: newLabels });
        API.savePalette({ colors: state.colorPalette, defaults: newDefaults, labels: newLabels });
    },

    updateCategoryLabel: (key, label) => {
        const state = get();
        const newLabels = { ...state.categoryLabels, [key]: label };
        set({ categoryLabels: newLabels });
        API.savePalette({ colors: state.colorPalette, defaults: state.defaultColors, labels: newLabels });
    },
});
