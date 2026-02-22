# Room Generator (DesignCanvas) Analysis and Refactoring Plan

## 1. System Overview

### 1.1 Scope
The "Room Generator" refers to the Asset Design mode where users create and edit individual furniture/assets. It is distinct from the Layout mode (Room composition).

### 1.2 URLs and Routing
- **Route:** `/project/:id` (handled by `Editor.jsx`)
- **Parameters:** `:id` - The Project ID.
- **Context:** Upon navigation, the `Editor` component mounts `DesignCanvas` (for asset editing) or `LayoutCanvas` (for room layout) based on user selection, but `DesignCanvas` is the primary focus here.

### 1.3 Component Hierarchy
- `App.jsx` (Router)
  - `Editor.jsx` (Page)
    - `UnifiedSidebar.jsx` (Sidebar)
      - `DesignProperties.jsx` (Properties Panel)
    - `DesignCanvas.jsx` (Main Canvas)
      - `DesignCanvasRender` (Internal Component - Monolithic Renderer)
        - `SVG` Element
          - `GridRenderer` (Implicit)
          - `ShapeRenderer` (Implicit - Paths/Rects/Ellipses)
          - `HandleRenderer` (Implicit - Resize/Rotate/Drag Handles)
          - `MarqueeRenderer` (Implicit - Selection Box)

### 1.4 State Management (Zustand)
- **Store:** `frontend/src/store/projectSlice.js`
- **Key State Variables:**
  - `localAssets`: Array of all assets in the project.
  - `designTargetId`: ID of the currently edited asset.
  - `viewState`: `{ x, y, scale }` for canvas panning/zooming.
  - `selectedShapeIndices`: Array of selected shape indices within the asset.
  - `selectedPointIndex`: Index of selected vertex (for polygons).

---

## 2. Data Flow

### 2.1 Initialization (Load)
1. **API Call:** `loadProject(id)` fetches project JSON.
2. **Store Update:** `setLocalAssets` populates the store.
3. **Canvas Sync:** `DesignCanvas` uses a `useEffect` to watch `designTargetId`.
   - When changed, it finds the target asset in `localAssets`.
   - It deep-clones the asset into a local React state `localAsset` (and `localAssetRef`) for performance.
   - Normalizes data (ensures `entities` array exists).

### 2.2 Interaction (Edit Loop)
1. **PointerDown:** `handleDown` determines the action (Select, Drag, Resize, Rotate) and sets `dragRef.current` with initial state (start coordinates, initial shape data).
2. **PointerMove:** `handleMove` calculates deltas using `process*` functions from `DesignCanvas.logic.js`.
   - Updates `localAsset` (React state) immediately -> Triggers re-render of `DesignCanvasRender`.
   - **Performance:** Does *not* update the global Zustand store on every move.
3. **PointerUp:** `handleUp` finalizes the action.
   - Calculates new bounds (`calculateAssetBounds`).
   - Syncs the final `localAsset` state back to the global Zustand store (`setLocalAssets`).
   - This triggers a save to the backend (`saveProjectData`).

### 2.3 Persistence (Save)
- **Trigger:** `setLocalAssets` (via `saveProjectData` in `projectSlice`).
- **Backend:** `App.SaveProjectData` (Go/Wails).
- **Storage:** JSON file on disk.

---

## 3. Function Inventory

### 3.1 `DesignCanvas.jsx` (Main Component)
- `handleDown(e)`: Dispatches to `initiate*` functions based on click target (shape, handle, empty space).
- `handleMove(e)`: Dispatches to `process*` functions based on `dragRef.mode`.
- `handleUp(e)`: Commits changes to the global store.
- `updateLocalAssetState(updates)`: Helper to update local state and ref simultaneously.
- `handleDeleteShape(index)`: Removes a shape and updates bounds.

### 3.2 `DesignCanvas.logic.js` (Pure Logic)
**Initiators (Return initial drag state):**
- `initiatePanning`: Panning the canvas.
- `initiateMarquee`: Box selection.
- `initiateResizing`: Resizing a shape (width/height/both).
- `initiateDraggingHandle`: Moving a specific handle (polygon vertex handle).
- `initiateDraggingAngle`: Changing start/end angles (arcs).
- `initiateDraggingRotation`: Rotating a shape.
- `initiateDraggingRadius`: Changing ellipse radii (`rx`, `ry`).
- `initiateDraggingPoint`: Moving a polygon vertex.
- `initiateDraggingShape`: Moving the entire shape body.

**Processors (Return updated entity list):**
- `processPanning`: Updates `viewState`.
- `processMarquee`: Updates selection indices based on intersection.
- `processResizing`: Calculates new dimensions.
- `processDraggingShape`: Calculates new position (with snapping).
- `processDraggingPoint`: Updates vertex coordinates.
- `processDraggingHandle`: Updates handle coordinates.
- `processDraggingAngle`: Updates angle values.
- `processDraggingRotation`: Updates rotation value.
- `processDraggingRadius`: Updates radius values.

### 3.3 `utils.js` (Helpers)
- `calculateAssetBounds`: Re-calculates the bounding box (`boundX`, `boundY`, `w`, `h`) of an asset based on its entities.
- `getRotatedAABB`: Calculates the AABB of a single rotated shape.
- `toSvgY` / `toCartesianY`: Converts between SVG (Y-down) and Cartesian (Y-up) coordinates.

---

## 4. Refactoring Strategy

### 4.1 Problem Statement
- **Monolithic Render:** `DesignCanvasRender` is too large and mixes logic for different shape types, handles, and UI controls.
- **Complex Event Handlers:** `handleDown` and `handleMove` are long switch statements.
- **Prop Drilling:** Passing `viewState`, `onDown`, `cursorMode` through multiple layers if we split components.

### 4.2 Proposed Changes

#### Phase 1: Component Decomposition
Create `frontend/src/components/canvas/` and split `DesignCanvasRender`:
1. **`ShapeRenderer.jsx`**:
   - Accepts a single entity and renders it (Path, Ellipse, Rect).
   - Handles visual styling (selection highlight).
2. **`HandleRenderer.jsx`**:
   - Renders control handles (Resize, Rotate, Radius) for the selected shape.
   - Isolates the logic for "where to draw the handle" vs "what it does".
3. **`GridRenderer.jsx`**:
   - Renders the background grid and axis lines.
4. **`MarqueeOverlay.jsx`**:
   - Renders the selection box.

#### Phase 2: Logic Extraction (Hooks)
Extract the interaction logic from `DesignCanvas.jsx` into a custom hook:
- **`useCanvasInteraction.js`**:
  - Manages `dragRef`, `cursorMode`, `marquee` state.
  - Exposes `handleDown`, `handleMove`, `handleUp`.
  - Takes `localAsset`, `setLocalAsset`, `viewState` as inputs.
  - Returns `cursorMode`, `marquee`, and event handlers.

#### Phase 3: Terminology Unification
- Ensure "Entity" is used consistently instead of "Shape" in code (e.g., `entities` array vs `shapes` array).
- (Already mostly done, but needs verification in `DesignProperties`).

---

## 5. Next Steps for Contributors
1. **Review this Analysis**: Confirm understanding of the data flow.
2. **Refactor Phase 1**: Break down `DesignCanvasRender`.
3. **Refactor Phase 2**: Implement `useCanvasInteraction`.
4. **Update Tests**: Ensure interactions still work (requires manual verification or E2E tests).
