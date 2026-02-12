import { forkAsset, createInstance, createTextInstance } from '../domain/assetService';

export const createInstanceSlice = (set, get) => ({
    instances: [],

    setInstances: (updater) => set((state) => ({ instances: typeof updater === 'function' ? updater(state.instances) : updater })),

    addInstance: (assetId) => {
        const state = get();

        let asset = [...state.localAssets, ...state.globalAssets].find(a => a.id === assetId);
        let targetAssetId = assetId;
        let newLocalAssets = [...state.localAssets];

        if (asset && asset.source === 'global') {
            const newLocalAsset = forkAsset(asset, state.defaultColors);
            newLocalAssets.push(newLocalAsset);
            targetAssetId = newLocalAsset.id;
            asset = newLocalAsset;
        }

        const newInst = createInstance(asset, state.viewState);

        set({
            localAssets: newLocalAssets,
            instances: [...state.instances, newInst],
            selectedIds: [newInst.id]
        });
    },

    addText: () => {
        const state = get();
        const newInst = createTextInstance(state.viewState);
        set({
            instances: [...state.instances, newInst],
            selectedIds: [newInst.id]
        });
    }
});
