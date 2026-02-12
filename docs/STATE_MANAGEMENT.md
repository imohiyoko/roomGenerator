# State Management

The Room Generator frontend uses **Zustand** for state management, with **Zundo** middleware for undo/redo capabilities.

## Store Structure (`frontend/src/store/index.js`)

The global store is composed of multiple slices, each responsible for a specific domain of the application state.

### Slices

1. **`projectSlice.js`**
   - `projects`: List of all available projects.
   - `currentProjectId`: ID of the currently loaded project.
   - **Actions**: `loadProject` (fetches data, handles forking logic), `saveProjectData` (persists changes).

2. **`assetSlice.js`**
   - `localAssets`: Project-specific asset definitions (shapes, colors, dimensions).
   - `globalAssets`: Shared library assets.
   - `colorPalette`: Global color palette.
   - `defaultColors`: Default colors for asset types.
   - **Actions**: `updateDefaultColor` (syncs colors), `addToPalette`.

3. **`uiSlice.js`**
   - `mode`: Editor sub-mode (`'layout' | 'design'`).
   - `viewState`: `{ x, y, scale }` for canvas pan and zoom.
   - `selectedIds`: IDs of selected instances.
   - `designTargetId`: ID of the asset being edited in Design Mode.
   - `selectedShapeIndices`: Selected vertices/shapes.

4. **`instanceSlice.js`**
   - `instances`: Placed instances on the layout canvas.
   - **Actions**: `addInstance` (creates instance, forks asset if needed), `addText`.

## Business Logic (`frontend/src/domain/assetService.js`)

Complex logic has been extracted from the store into a dedicated service module.

### Asset Forking (`forkAsset`)
- When a user adds a global asset to a project, or when a new project is created, global assets are "forked".
- This creates a deep copy of the asset with a new unique ID and removes the `source: 'global'` flag.
- Ensures that modifications within a project do not affect the shared library.

### Color Synchronization (`syncAssetColors`)
- When loading a project or changing a default color, this logic updates all assets marked with `isDefaultShape: true`.
- It ensures that assets using the default theme colors stay in sync with the global palette unless manually overridden.

## Undo/Redo

Implemented using the `zundo` middleware.

- **Tracked State**:
  - `localAssets`: Shape modifications.
  - `instances`: Position, rotation, addition/removal.
- **Ignored State**:
  - `mode`, `viewState` (pan/zoom), selection.
- **Limit**: History stack is capped at 50 entries.
- **Temporal Store**: Accessed via `useStore.temporal` (wrapped in a hook for reactivity in components).
