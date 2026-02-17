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
            // Recompute effective defaultColors when undo/redo restores projectDefaultColors
            handleSet: (handleSet) => (state) => {
                handleSet(state);
                if (state.projectDefaultColors !== undefined) {
                    const current = useStore.getState();
                    const globalDefaults = current.globalDefaultColors || {};
                    const defaultColors = { ...globalDefaults, ...(state.projectDefaultColors || {}) };
                    useStore.setState({ defaultColors });
                }
            },
        }
    )
);
