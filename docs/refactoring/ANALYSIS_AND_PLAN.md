# Room Generator Refactoring Analysis & Plan

This document provides a comprehensive overview of the `roomGenerator` system, including the current architecture, data flow, and a specific refactoring strategy for the Design Canvas logic.

## 1. System Overview

### URL Structure & Routing
The application uses `HashRouter` for client-side routing (`src/App.jsx`).

| URL Pattern | Component | Description |
|---|---|---|
| `/` | `frontend/src/pages/Home.jsx` | Landing page listing all projects. |
| `/library` | `frontend/src/pages/Library.jsx` | Global asset library management. |
| `/project/:id` | `frontend/src/pages/Editor.jsx` | Main editor interface for a specific project. |
| `/settings` | `frontend/src/pages/Settings.jsx` | Global application settings (colors, defaults). |

### Component Hierarchy (Key Components)
The UI is composed of several major functional blocks.

- **`App.jsx`**: Root component handling routing and initial global data fetching.
- **`Editor.jsx`**: The central workspace. Orchestrates:
    - **`UnifiedSidebar.jsx`**: Left panel for selecting assets/tools.
    - **`DesignCanvas.jsx`**: Canvas for editing individual assets (shapes, polygons).
    - **`LayoutCanvas.jsx`**: Canvas for placing instances (rooms, furniture) into a floor plan.
    - **`DesignProperties.jsx`**: Right panel for editing properties of selected shapes in Design Mode.
    - **`LayoutProperties.jsx`**: Right panel for editing properties of selected instances in Layout Mode.

### State Management (Zustand)
Located in `frontend/src/store/`.

- **`projectSlice.js`**: Manages the core data model.
    - `localAssets`: Assets specific to the current project (Blueprints).
    - `instances`: Placed objects in the layout (References to Assets).
- **`uiSlice.js`**: Manages UI state like sidebar width.
- **`temporal`**: Middleware for Undo/Redo functionality.

### Backend Interface (Go)
Located in `app.go`. Exposed via `window.go.main.App`.

- **`GetProjectData(id)`**: Returns `ProjectData`. Handles legacy JSON migration.
- **`SaveProjectData(id, data)`**: Validates and saves project data to JSON.
- **`GetAssets()` / `SaveAssets()`**: Manages global asset library.

---

## 2. Deep Dive: Room Generator (Design Canvas)

The core "Room Generator" functionality resides in the **Design Mode** of the Editor, where users create and modify shape-based assets.

*   **Primary Component:** `frontend/src/components/DesignCanvas.jsx`
*   **Business Logic:** `frontend/src/components/DesignCanvas.logic.js`

### Data Flow

1.  **User Action:** Mouse Down/Move/Up on `DesignCanvas`.
2.  **Event Handling:** `DesignCanvas.jsx` captures events.
3.  **Logic Execution:** Events are delegated to pure functions in `DesignCanvas.logic.js` (e.g., `initiateDraggingShape`, `processDraggingShape`).
4.  **State Calculation:** Logic functions return *modified copies* of asset entities.
5.  **State Update:** `DesignCanvas.jsx` calls `updateLocalEntities` -> `setLocalAssets` (Zustand Store).
6.  **Persistence:** `useAutoSave` hook detects store changes and syncs with Backend via `App.SaveProjectData`.

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

### Layer 1: Interaction Handlers (`src/interaction/`)
Responsible for interpreting user input (Mouse/Keyboard) into "Intent".
*   *Example:* `DragHandler` detects a drag and emits a `Move` intent with delta `(dx, dy)`.

### Layer 2: Geometry Domain (`src/domain/geometry/`)
Pure mathematical functions. No React state, no UI logic.
*   *Example:* `snappedPoint(pt, grid)`, `rotatePoint(pt, center, angle)`, `newBounds(rect, delta)`.
*   *Action:* Extract logic from `process*` functions into these pure helpers.

### Layer 3: Command Pattern (`src/commands/`)
Encapsulates state changes to support Undo/Redo and cleaner updates.
*   *Example:* `MoveShapeCommand`, `ResizeShapeCommand`.

## 5. Proposed Workflow for Contributors

1.  **Understand the Map:** Read this document and `docs/SYSTEM_MAP.md` to see where `DesignCanvas` fits.
2.  **Isolate the Logic:** If adding a feature (e.g., "Scale Tool"), write the math in `src/domain/geometry/` first, covered by unit tests.
3.  **Connect the UI:** Add the interaction handler in `DesignCanvas.jsx` (or a new hook) that calls the geometry function.
4.  **Update State:** Use the centralized `updateAssetEntities` helper to commit changes to the Store.

## 6. Execution Steps (Immediate)

1.  **Extract Geometry Logic:** Move math-heavy code from `DesignCanvas.logic.js` to `frontend/src/domain/geometry.js`.
2.  **Simplify `dragRef`:** Define a consistent shape for the drag state or use a state machine.
3.  **Group Functions:** Organize `initiate` and `process` pairs into objects or classes (e.g., `ShapeMover`, `PointMover`).

This plan will make the "Room Generator" easier to extend and less prone to regression bugs.
