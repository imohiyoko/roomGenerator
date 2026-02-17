export const createSettingsSlice = (set, get) => ({
    gridSize: 20,
    snapInterval: 10,
    initialZoom: 1.0,
    autoSaveInterval: 30000,

    setGridSize: (size) => set({ gridSize: size }),
    setSnapInterval: (interval) => set({ snapInterval: interval }),
    setInitialZoom: (zoom) => set({ initialZoom: zoom }),
    setAutoSaveInterval: (interval) => set({ autoSaveInterval: interval }),

    setAllSettings: (settings) => set((state) => ({
        ...state,
        ...settings
    })),
});
