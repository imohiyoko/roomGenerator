# Room Generator Refactoring Analysis & Plan

This document serves as a comprehensive guide for contributors working on the "Room Generator" (Design Canvas) system. It outlines the current architecture, data flow, key functions, and the planned refactoring strategy.

## 1. System Overview

### URL Structure & Routing
The application uses `HashRouter` for client-side routing (`frontend/src/App.jsx`).

| URL Pattern | Component | Description |
|---|---|---|
| `/` | `frontend/src/pages/Home.jsx` | Landing page listing all projects. |
| `/library` | `frontend/src/pages/Library.jsx` | Global asset library management. |
| `/project/:id` | `frontend/src/pages/Editor.jsx` | Main editor interface. |
| `/settings` | `frontend/src/pages/Settings.jsx` | Global application settings. |

### Component Hierarchy (Editor)
The `Editor.jsx` component orchestrates the workspace based on the current mode (Design vs. Layout).

- **`Editor`**
    - **`UnifiedSidebar`**: Tool selection.
    - **`DesignCanvas`** (in Design Mode):
        - Renders `DesignCanvasRender`.
        - Handles Asset creation/editing (Shapes, Polygons).
    - **`LayoutCanvas`** (in Layout Mode):
        - Handles Room layout (Placing Instances).
    - **`DesignProperties`** / **`LayoutProperties`**: Right-side panel for property editing.

### State Management (Zustand)
Located in `frontend/src/store/`.

- **`projectSlice.js`**: Manages project metadata and view state (`projects`, `currentProjectId`, `viewState`, `projectDefaultColors`).
- **`assetSlice.js`**: Manages asset data (`localAssets`, `globalAssets`, `colorPalette`, `defaultColors`, `categoryLabels`).
- **`uiSlice.js`**: Manages UI state (`mode`, `selectedIds`, `designTargetId`, `selectedShapeIndices`, `selectedPointIndex`, sidebar layout).
- **`instanceSlice.js`**: Manages placed objects in the layout (`instances`).
- **`settingsSlice.js`**: Manages app-level settings (`autoSaveInterval`, etc.).
- **`temporal` (zundo)**: Middleware for Undo/Redo. Tracks `localAssets`, `instances`, `projectDefaultColors` with a 50-entry history limit.

### Backend Interface (Go)
Located in `app.go`. Exposed via `window.go.main.App`. Frontend wrapper: `frontend/src/lib/api.js`.

Key methods:

| Method | Description |
|---|---|
| `GetProjectData(id)` | Returns `ProjectData`. Handles legacy JSON migration. |
| `SaveProjectData(id, data)` | Validates and saves project data to JSON. |
| `GetAssets()` / `SaveAssets(assets)` | Manages global asset library. |
| `GetProjects()` / `CreateProject(name)` / `DeleteProject(id)` | Project CRUD. |
| `UpdateProjectName(id, name)` | Renames a project. |
| `GetPalette()` / `SavePalette(palette)` | Color palette persistence. |
| `GetSettings()` / `SaveSettings(settings)` | App-level settings (grid, snap, zoom, autoSave). |
| `ExportProject(id)` / `ImportProject(name, json)` | Project import/export as JSON. |
| `ExportGlobalAssets()` / `ImportGlobalAssets(json, mergeMode)` | Global asset import/export. |

---

## 2. Design Canvas Logic (Room Generator)

The `DesignCanvas` is the core component for creating assets. It handles complex interactions like dragging, resizing, and vertex editing.

*   **Primary Component:** `frontend/src/components/DesignCanvas.jsx`
*   **Logic Module:** `frontend/src/components/DesignCanvas.logic.js`

### Data Flow

1.  **User Action:** Mouse Down/Move/Up on Canvas.
2.  **Event Handling:** `DesignCanvas.jsx` captures events (e.g., `onPointerMove`).
3.  **Logic Execution:** Events are delegated to pure functions in `DesignCanvas.logic.js` (e.g., `processDraggingShape`).
4.  **State Calculation:** Logic functions return a **new copy** of the modified entities.
5.  **State Update:** `DesignCanvas.jsx` calls `updateLocalEntities`, which updates the React state (`localAsset`) for smooth rendering.
6.  **Commit:** On `onPointerUp`, the changes are committed to the global Zustand store (`projectSlice`), triggering `useAutoSave`.

### Function Inventory (`DesignCanvas.logic.js`)

The logic file currently mixes **Interaction State** (cursor modes, drag start points) with **Geometric Calculations** (coordinate transformation, snapping).

| Function Name | Trigger | Responsibility | Side Effects / Returns |
| :--- | :--- | :--- | :--- |
| `initiatePanning` | Middle Click | Sets cursor to `grabbing`. Records start pos. | Returns `dragRef` state. |
| `initiateMarquee` | Left Click (Empty Space) | Starts selection box. Clears selection (unless Ctrl/Meta). | Returns `dragRef` state. |
| `initiateResizing` | Left Click (Resize Handle) | Prepares shape for resizing. | Returns initial dims (`shapeW`, `shapeH`). |
| `initiateDraggingHandle` | Left Click (Control Point) | Prepares bezier/polygon handle drag. | Returns handle index & pos. |
| `initiateDraggingAngle` | Left Click (Arc Handle) | Prepares start/end angle change. | Returns center point (`cx`, `cy`). |
| `initiateDraggingRotation` | Left Click (Rotate Handle) | Prepares rotation. Calculates start angle relative to center. | Returns initial rotation & start angle. |
| `initiateDraggingRadius` | Left Click (Radius Handle) | Prepares radius change (rx/ry). | Returns initial radius values. |
| `initiateDraggingPoint` | Left Click (Vertex) | Prepares vertex move. | Returns point index. |
| `initiateDraggingShape` | Left Click (Shape Body) | Prepares shape move. Handles multi-selection. | Returns snapshot of *all* selected shapes. |
| `processPanning` | Mouse Move | Calculates new view offset. | calls `setViewState`. |
| `processMarquee` | Mouse Move | Updates selection box. | calls `setSelectedShapeIndices`. |
| `processResizing` | Mouse Move | Calculates new width/height based on drag delta. | Returns **New Entities Array**. |
| `processDraggingShape` | Mouse Move | Calculates new position (with snapping). | Returns **New Entities Array**. |
| `processDraggingPoint` | Mouse Move | Updates vertex position. Recalculates Polygon Bounds. | Returns **New Entities Array**. |
| `processDraggingHandle` | Mouse Move | Updates bezier handle position. | Returns **New Entities Array**. |
| `processDraggingAngle` | Mouse Move | Calculates new angle based on mouse angle relative to center. | Returns **New Entities Array**. |
| `processDraggingRotation` | Mouse Move | Calculates rotation delta. | Returns **New Entities Array**. |
| `processDraggingRadius` | Mouse Move | Calculates new radius. Handles rotation projection. | Returns **New Entities Array**. |

## 3. Identified Issues (Code Smells)

1.  **Monolithic Logic File:** `DesignCanvas.logic.js` handles too many responsibilities (Selection, Transformation, Geometry).
2.  **Prop Drilling:** `DesignCanvas.jsx` passes many props (viewState, assets, callbacks) deep into the logic functions.
3.  **Coordinate Confusion:** Logic frequently converts between Screen, SVG, and Cartesian coordinates inline.
4.  **Implicit State:** The `dragRef` object structure changes based on the mode, making it hard to type-check or debug.

## 4. Refactoring Plan

We will refactor the "Room Generator" into three distinct layers:

### Layer 1: Interaction Handlers (`frontend/src/interaction/`)
Responsible for interpreting user input (Mouse/Keyboard) into "Intent".
*   *Example:* `DragHandler` detects a drag and emits a `Move` intent with delta `(dx, dy)`.

### Layer 2: Geometry Domain (`frontend/src/domain/geometry/`)
Pure mathematical functions. No React state, no UI logic. Note: `frontend/src/domain/` already exists for business logic (e.g., `AssetService`).
*   *Example:* `snappedPoint(pt, grid)`, `rotatePoint(pt, center, angle)`, `newBounds(rect, delta)`.
*   *Action:* Extract logic from `process*` functions into these pure helpers.

### Layer 3: Command Pattern (`frontend/src/commands/`)
Encapsulates state changes to support Undo/Redo and cleaner updates.
*   *Example:* `MoveShapeCommand`, `ResizeShapeCommand`.

## 5. Proposed Workflow for Contributors

1.  **Understand the Map:** Read this document and `docs/SYSTEM_MAP.md` to see where `DesignCanvas` fits.
2.  **Isolate the Logic:** If adding a feature (e.g., "Scale Tool"), write the math in `frontend/src/domain/geometry/` first, covered by unit tests.
3.  **Connect the UI:** Add the interaction handler in `DesignCanvas.jsx` (or a new hook) that calls the geometry function.
4.  **Update State:** Use the centralized `updateAssetEntities` helper to commit changes to the Store.

## 6. Execution Steps (Immediate)

1.  **Extract Geometry Logic:** Move math-heavy code from `DesignCanvas.logic.js` into modules under `frontend/src/domain/geometry/` (e.g., `points.js`, `transforms.js`, `bounds.js`).
2.  **Simplify `dragRef`:** Define a consistent shape for the drag state or use a state machine.
3.  **Group Functions:** Organize `initiate` and `process` pairs into objects or classes (e.g., `ShapeMover`, `PointMover`).

This plan will make the "Room Generator" easier to extend and less prone to regression bugs.
