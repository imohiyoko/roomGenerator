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
                instances: state.instances
            }),
            limit: 50, // Limit history stack size
            equality: (a, b) => JSON.stringify(a) === JSON.stringify(b), // Simple deep equality check
        }
    )
);
