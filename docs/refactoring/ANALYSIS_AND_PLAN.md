# Room Generator Refactoring Analysis & Plan

This document serves as a comprehensive guide for contributors working on the "Room Generator" (Design Canvas) system. It outlines the current architecture, data flow, key functions, and the planned refactoring strategy.

## 1. System Overview

### URL Structure & Routing
The application uses `HashRouter` for client-side routing.

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

- **`projectSlice.js`**: Core data model.
    - `localAssets`: Array of Asset objects (Blueprints).
    - `instances`: Array of Instance objects (Placed in Layout).
- **`temporal`**: Middleware for Undo/Redo.

### Backend Interface (Go)
Located in `app.go`.

- **`SaveProjectData(id, data)`**: Saves `localAssets` and `instances` to JSON.
- **`GetProjectData(id)`**: Loads project data.

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

| Function Pair | Responsibility | Effects |
| :--- | :--- | :--- |
| `initiate/processPanning` | Pans the view (translates viewState). | Updates `viewState.x/y`. |
| `initiate/processMarquee` | Draws a selection box. | Updates `selectedShapeIndices`. |
| `initiate/processDraggingShape` | Moves selected shapes. | Updates `x`, `y`, `cx`, `cy`, or `points`. |
| `initiate/processResizing` | Resizes shapes (rect/circle). | Updates `w`, `h`. |
| `initiate/processDraggingPoint` | Moves a polygon vertex. | Updates specific point in `points` array. |
| `initiate/processDraggingHandle` | Moves a Bezier control point. | Updates `handles` of a point. |
| `initiate/processDraggingAngle` | Changes Arc start/end angles. | Updates `startAngle`, `endAngle`. |
| `initiate/processDraggingRotation` | Rotates a shape. | Updates `rotation`. |
| `initiate/processDraggingRadius` | Changes Ellipse radii. | Updates `rx`, `ry`. |

### Coordinate Systems

Contributors must understand the three coordinate systems used:

1.  **Screen Coordinates (`clientX`, `clientY`)**
    - Origin: Top-Left of the browser window.
    - Unit: Pixels.
    - Used by: DOM Events (`onPointerMove`).

2.  **SVG Coordinates (`viewBox`)**
    - Origin: Top-Left of the canvas (usually).
    - Y-Axis: Increases **DOWN**.
    - Unit: Virtual Units (scaled by `viewState.scale`).
    - Used by: Rendering logic (`<path d="...">`).

3.  **Cartesian Coordinates (Logical)**
    - Origin: User-defined (usually Center or Bottom-Left logic).
    - Y-Axis: Increases **UP** (Standard Math).
    - Used by: Storage, Geometry Calculations.
    - **Conversion:** `y_cartesian = -y_svg`.

---

## 3. Refactoring Plan

To improve maintainability and testability, we are refactoring the codebase as follows:

### Phase 1: Extract Geometry Domain (Complete)
Move pure mathematical functions from `frontend/src/lib/utils.js` and inline logic in `DesignCanvas.logic.js` to a dedicated domain layer: **`frontend/src/domain/geometry.js`**.

**Functions to move:**
- `toSvgY`, `toCartesianY` (Coordinate Conversion)
- `toSvgRotation`, `toCartesianRotation`
- `rotatePoint`, `getRotatedAABB` (Geometry)
- `snapValue` (New helper for grid snapping)

### Phase 2: Refactor Interaction Logic
Update `DesignCanvas.logic.js` to import from `domain/geometry.js`. This separates the *interaction intent* (dragging) from the *mathematical execution* (calculating new coordinates).

### Phase 3: Update Components
Ensure `DesignCanvas.jsx` and other consumers import geometry helpers from the new domain location.

---

## 4. Contributor Guidelines

1.  **Add Logic to Domain:** When adding a new geometric operation (e.g., "Scale from Center"), implement it as a pure function in `frontend/src/domain/geometry.js` first.
2.  **Use Helpers:** Always use `toSvgY` / `toCartesianY` for coordinate conversions. Do not manually multiply by -1.
3.  **Preserve Data:** Logic functions in `DesignCanvas.logic.js` must **never mutate** the input asset. Always return a deep clone or a new object.
