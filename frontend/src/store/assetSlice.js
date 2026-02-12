import { API } from '../lib/api';
import { syncAssetColors } from '../domain/assetService';

export const createAssetSlice = (set, get) => ({
    localAssets: [],
    globalAssets: [],
    colorPalette: [],
    defaultColors: {},

    setLocalAssets: (updater) => set((state) => ({ localAssets: typeof updater === 'function' ? updater(state.localAssets) : updater })),
    setGlobalAssets: (updater) => set((state) => ({ globalAssets: typeof updater === 'function' ? updater(state.globalAssets) : updater })),

    setColorPalette: (colors) => set({ colorPalette: colors }),
    setDefaultColors: (defaults) => set({ defaultColors: defaults }),

    updateDefaultColor: (type, color) => {
        const state = get();
        const newDefaults = { ...state.defaultColors, [type]: color };
        API.savePalette({ colors: state.colorPalette, defaults: newDefaults });

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
            API.savePalette({ colors: newPalette, defaults: state.defaultColors });
        }
    },

    removeFromPalette: (index) => {
        const state = get();
        const newPalette = state.colorPalette.filter((_, i) => i !== index);
        set({ colorPalette: newPalette });
        API.savePalette({ colors: newPalette, defaults: state.defaultColors });
    },
});
