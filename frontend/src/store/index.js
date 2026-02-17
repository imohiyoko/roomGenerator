import { create } from 'zustand';
import { temporal } from 'zundo';
import { createProjectSlice } from './projectSlice';
import { createAssetSlice } from './assetSlice';
import { createUISlice } from './uiSlice';
import { createInstanceSlice } from './instanceSlice';

export const useStore = create(
    temporal(
        (...a) => ({
            ...createProjectSlice(...a),
            ...createAssetSlice(...a),
            ...createUISlice(...a),
            ...createInstanceSlice(...a),
        }),
        {
            // Zundo Configuration
            partialize: (state) => ({
                localAssets: state.localAssets,
                instances: state.instances,
                projectDefaultColors: state.projectDefaultColors,
            }),
            limit: 50, // Limit history stack size
            equality: (a, b) => JSON.stringify(a) === JSON.stringify(b), // Simple deep equality check
        }
    )
);

// Recompute effective defaultColors whenever projectDefaultColors changes
// (including after undo/redo, which bypasses zundo's handleSet).
useStore.subscribe((state, prevState) => {
    if (state.projectDefaultColors !== prevState.projectDefaultColors) {
        const globalDefaults = state.globalDefaultColors || {};
        const defaultColors = { ...globalDefaults, ...(state.projectDefaultColors || {}) };
        if (JSON.stringify(defaultColors) !== JSON.stringify(state.defaultColors)) {
            useStore.setState({ defaultColors });
        }
    }
});
