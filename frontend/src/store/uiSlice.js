export const createUISlice = (set, get) => ({
    mode: 'layout',
    viewState: { x: 50, y: 50, scale: 1 },
    selectedIds: [],
    designTargetId: null,
    selectedShapeIndices: [],
    selectedPointIndex: null,
    copiedInstances: [],

    setMode: (mode) => set({ mode }),
    setViewState: (updater) => set((state) => ({ viewState: typeof updater === 'function' ? updater(state.viewState) : updater })),
    setSelectedIds: (updater) => set((state) => ({ selectedIds: typeof updater === 'function' ? updater(state.selectedIds) : updater })),
    setDesignTargetId: (id) => set({ designTargetId: id }),
    setSelectedShapeIndices: (updater) => set((state) => ({ selectedShapeIndices: typeof updater === 'function' ? updater(state.selectedShapeIndices) : updater })),
    setSelectedPointIndex: (index) => set({ selectedPointIndex: index }),
});
