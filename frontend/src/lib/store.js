import { create } from 'zustand';
import { temporal } from 'zundo';
import { API } from './api';
import { deepClone } from './utils';
import { BASE_SCALE } from './constants';

const DEFAULT_COLORS = { room: '#fdfcdc', furniture: '#8fbc8f', fixture: '#cccccc' };

export const useStore = create(
    temporal(
        (set, get) => ({
            // --- State Slices ---
            projects: [],
            currentProjectId: null,
            view: 'home', // 'home', 'project', 'library'
            mode: 'layout', // 'layout', 'design'
            viewState: { x: 50, y: 50, scale: 1 },
            localAssets: [],
            globalAssets: [],
            instances: [],
            selectedIds: [],
            designTargetId: null,
            // Design Mode Selection
            selectedShapeIndices: [],
            selectedPointIndex: null,

            colorPalette: [],
            defaultColors: DEFAULT_COLORS,
            // Clipboard (in-memory)
            copiedInstances: [],

            // --- Actions ---

            // Project Management
            setProjects: (updater) => set((state) => ({ projects: typeof updater === 'function' ? updater(state.projects) : updater })),
            setCurrentProjectId: (id) => set({ currentProjectId: id }),
            setView: (view) => set({ view }),
            setMode: (mode) => set({ mode }),
            setViewState: (updater) => set((state) => ({ viewState: typeof updater === 'function' ? updater(state.viewState) : updater })),

            // Asset Management
            setLocalAssets: (updater) => set((state) => ({ localAssets: typeof updater === 'function' ? updater(state.localAssets) : updater })),
            setGlobalAssets: (updater) => set((state) => ({ globalAssets: typeof updater === 'function' ? updater(state.globalAssets) : updater })),

            // Instance Management
            setInstances: (updater) => set((state) => ({ instances: typeof updater === 'function' ? updater(state.instances) : updater })),

            // Selection
            setSelectedIds: (updater) => set((state) => ({ selectedIds: typeof updater === 'function' ? updater(state.selectedIds) : updater })),
            setDesignTargetId: (id) => set({ designTargetId: id }),
            setSelectedShapeIndices: (updater) => set((state) => ({ selectedShapeIndices: typeof updater === 'function' ? updater(state.selectedShapeIndices) : updater })),
            setSelectedPointIndex: (index) => set({ selectedPointIndex: index }),

            // Palette & Defaults
            setColorPalette: (colors) => set({ colorPalette: colors }),
            setDefaultColors: (defaults) => set({ defaultColors: defaults }),

            // --- Business Logic Actions ---

            // Load Project Data
            loadProject: async (projectId) => {
                if (!projectId) {
                    set({ view: 'home', currentProjectId: null });
                    return;
                }

                // Set view first to show loading state if needed
                set({ view: 'project', currentProjectId: projectId });

                // Parallel fetch
                const [projectData, globalAssetsData, paletteData] = await Promise.all([
                    API.getProjectData(projectId),
                    API.getAssets(),
                    API.getPalette()
                ]);

                // Global Assets Setup
                const globalAssets = (globalAssetsData || []).map(a => ({ ...a, source: 'global' }));

                // Palette Setup
                const colorPalette = paletteData?.colors || [];
                const defaultColors = paletteData?.defaults || DEFAULT_COLORS;

                // Local Assets & Instances Setup
                let loadedAssets = projectData?.assets || [];
                let instances = projectData?.instances || [];

                // Logic: Fork Global Assets if Project Empty
                if (loadedAssets.length === 0) {
                    loadedAssets = globalAssets.map(ga => {
                        const clone = deepClone(ga);
                        clone.id = `a-fork-${ga.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                        delete clone.source;
                        if (ga.isDefaultShape) clone.isDefaultShape = true;

                        // Sync color to defaults
                        if (clone.isDefaultShape && defaultColors[clone.type]) {
                            const color = defaultColors[clone.type];
                            clone.color = color;
                            clone.shapes = (clone.shapes || []).map(s => ({...s, color}));
                        }
                        return clone;
                    });
                } else {
                    // Sync existing local assets if default color changed
                     loadedAssets = loadedAssets.map(a => {
                        if (a.isDefaultShape && defaultColors[a.type] && a.color !== defaultColors[a.type]) {
                            const color = defaultColors[a.type];
                            const updated = { ...a, color: color };
                            updated.shapes = (a.shapes || []).map(s => ({ ...s, color: color }));
                            return updated;
                        }
                        return a;
                    });
                }

                // Batch update state
                set({
                    globalAssets,
                    colorPalette,
                    defaultColors,
                    localAssets: loadedAssets,
                    instances,
                    // Reset selection/view state on load
                    selectedIds: [],
                    designTargetId: null,
                    selectedShapeIndices: [],
                    selectedPointIndex: null,
                    viewState: { x: 50, y: 50, scale: 1 }
                });

                // Clear history stack after fresh load so user can't undo initial load
                get().temporal?.clear();
            },

            // Add Instance (Logic from App.jsx handleAddInstance)
            addInstance: (assetId) => {
                const state = get();
                const now = Date.now();

                // Find asset in local or global
                let asset = [...state.localAssets, ...state.globalAssets].find(a => a.id === assetId);
                let targetAssetId = assetId;
                let newLocalAssets = [...state.localAssets];

                // Auto-fork if global
                if (asset && asset.source === 'global') {
                    const newLocalId = `a-fork-${now}-${Math.floor(Math.random() * 1000)}`;
                    const newLocalAsset = deepClone(asset);
                    newLocalAsset.id = newLocalId;
                    newLocalAsset.name = asset.name;
                    delete newLocalAsset.source;

                    if (asset.isDefaultShape) newLocalAsset.isDefaultShape = true;

                    if (newLocalAsset.isDefaultShape && state.defaultColors[newLocalAsset.type]) {
                        const color = state.defaultColors[newLocalAsset.type];
                        newLocalAsset.color = color;
                        newLocalAsset.shapes = (newLocalAsset.shapes || []).map(s => ({...s, color}));
                    }

                    newLocalAssets.push(newLocalAsset);
                    targetAssetId = newLocalId;
                    asset = newLocalAsset;
                }

                const newInst = {
                    id: `i-${now}-${Math.floor(Math.random() * 1000)}`,
                    assetId: targetAssetId,
                    x: (400 - state.viewState.x) / state.viewState.scale / BASE_SCALE,
                    y: (300 - state.viewState.y) / state.viewState.scale / BASE_SCALE,
                    rotation: 0,
                    locked: false,
                    type: asset ? asset.type : 'unknown'
                };

                set({
                    localAssets: newLocalAssets,
                    instances: [...state.instances, newInst],
                    selectedIds: [newInst.id]
                });
            },

            // Add Text
            addText: () => {
                const state = get();
                const now = Date.now();
                const newInst = {
                    id: `t-${now}-${Math.floor(Math.random() * 1000)}`,
                    type: 'text',
                    text: 'テキスト',
                    fontSize: 24,
                    color: '#333333',
                    x: (400 - state.viewState.x) / state.viewState.scale / BASE_SCALE,
                    y: (300 - state.viewState.y) / state.viewState.scale / BASE_SCALE,
                    rotation: 0,
                    locked: false
                };
                set({
                    instances: [...state.instances, newInst],
                    selectedIds: [newInst.id]
                });
            },

            // Update Default Color
            updateDefaultColor: (type, color) => {
                const state = get();
                const newDefaults = { ...state.defaultColors, [type]: color };

                // Update palette API
                API.savePalette({ colors: state.colorPalette, defaults: newDefaults });

                // Update isDefaultShape assets
                const updateAssets = (assets) => assets.map(a => {
                    if (a.isDefaultShape && a.type === type) {
                        const newShapes = (a.shapes || []).map(s => ({ ...s, color: color }));
                        return { ...a, color: color, shapes: newShapes };
                    }
                    return a;
                });

                set({
                    defaultColors: newDefaults,
                    localAssets: updateAssets(state.localAssets),
                    globalAssets: updateAssets(state.globalAssets)
                });
            },

            // Add to Palette
            addToPalette: (color) => {
                const state = get();
                if (!state.colorPalette.includes(color)) {
                    const newPalette = [...state.colorPalette, color];
                    set({ colorPalette: newPalette });
                    API.savePalette({ colors: newPalette, defaults: state.defaultColors });
                }
            },

            // Remove from Palette
            removeFromPalette: (index) => {
                const state = get();
                const newPalette = state.colorPalette.filter((_, i) => i !== index);
                set({ colorPalette: newPalette });
                API.savePalette({ colors: newPalette, defaults: state.defaultColors });
            },

            // Save Project Data (Auto-save helper)
            saveProjectData: async () => {
                const state = get();
                if (!state.currentProjectId) return;
                await API.saveProjectData(state.currentProjectId, {
                    assets: state.localAssets,
                    instances: state.instances
                });
            }
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
