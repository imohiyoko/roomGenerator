# Room Generator Refactoring Analysis

## 1. Introduction

This document provides a detailed analysis of the "Room Generator" (Design Canvas) subsystem to facilitate refactoring and guide future contributors. The goal is to improve code maintainability by decoupling complex rendering logic and clarifying data flow.

## 2. System Overview

### 2.1 URL Structure & Routing
The application uses `HashRouter` for navigation. The primary route for editing is:

*   **URL:** `/project/:id`
*   **Component:** `frontend/src/pages/Editor.jsx`
*   **Description:** Loads the project with the given ID.

### 2.2 Component Hierarchy
The "Room Generator" functionality is encapsulated within the `DesignCanvas` component, which is conditionally rendered by `Editor.jsx` when `mode === 'design'`.

```
Editor.jsx (Page)
├── UnifiedSidebar (Left Panel: Asset List)
├── DesignCanvas (Center: SVG Canvas)
│   └── DesignCanvasRender (Internal Component: Renders SVG elements)
└── DesignProperties (Right Panel: Property Editor)
```

### 2.3 Data Flow & Persistence

Data flows between the Backend (File System) and Frontend (React State) as follows:

1.  **Load:**
    *   `Editor.jsx` mounts -> calls `loadProject(id)` (Zustand Action).
    *   `loadProject` calls `API.getProjectData(id)`.
    *   Backend (`app.go`) reads `data/project_{id}.json`, migrates legacy data, and returns `ProjectData`.
    *   Store updates `localAssets` (Array of Assets/Rooms).

2.  **Edit (Interaction Loop):**
    *   User drags/resizes a shape in `DesignCanvas`.
    *   **During Interaction:** `onPointerMove` updates a local React state (`localAsset`) inside `DesignCanvas` for high-performance rendering (60fps). It does *not* update the global store.
    *   **Commit:** `onPointerUp` triggers `updateLocalAssetState`, which commits the final state to the global Zustand store (`setLocalAssets`).

3.  **Save:**
    *   `useAutoSave` hook detects changes in the store.
    *   Calls `API.saveProjectData`.
    *   Backend (`app.go`) saves the data to `data/project_{id}.json`.

## 3. Function Inventory

### 3.1 `frontend/src/components/DesignCanvas.jsx`

*   **`DesignCanvas` (Main Component)**
    *   Manages local state (`localAsset`, `cursorMode`, `marquee`).
    *   Sets up event listeners (`handleDown`, `handleMove`, `handleUp`).
    *   Integrates with `DesignCanvas.logic.js`.
*   **`DesignCanvasRender` (Render Component)**
    *   **Current Responsibility:** Renders the SVG, including grid, background, all shapes (Rect, Polygon, Ellipse), selection handles, resize handles, and rotation handles.
    *   **Issue:** This component is monolithic and mixes presentation logic for different shape types.
*   **`handleDown(e, shapeIndex, pointIndex, ...)`**
    *   Delegates to `initiate*` functions in logic file.
*   **`handleMove(e)`**
    *   Delegates to `process*` functions in logic file.
*   **`handleUp()`**
    *   Finalizes the drag operation and updates the global store.

### 3.2 `frontend/src/components/DesignCanvas.logic.js`

This file contains pure functions for handling interaction state transitions.

| Operation | Initiate Function | Process Function | Description |
| :--- | :--- | :--- | :--- |
| **Panning** | `initiatePanning` | `processPanning` | Pans the viewport using the middle mouse button. |
| **Marquee** | `initiateMarquee` | `processMarquee` | Selects multiple shapes by dragging a rectangle. |
| **Resize** | `initiateResizing` | `processResizing` | Resizes a shape (Rect/Ellipse) via edge handles. |
| **Move Shape** | `initiateDraggingShape` | `processDraggingShape` | Moves selected shape(s). Handles snapping. |
| **Move Point** | `initiateDraggingPoint` | `processDraggingPoint` | Moves a vertex of a Polygon. |
| **Move Handle** | `initiateDraggingHandle` | `processDraggingHandle` | Moves a bezier control point (for curves). |
| **Rotate** | `initiateDraggingRotation` | `processDraggingRotation` | Rotates a shape via the rotation handle. |
| **Adjust Angle** | `initiateDraggingAngle` | `processDraggingAngle` | Adjusts start/end angles for Arcs. |
| **Adjust Radius** | `initiateDraggingRadius` | `processDraggingRadius` | Adjusts radius for Ellipses. |

## 4. Refactoring Strategy

The primary goal is to decompose `DesignCanvasRender` to improve readability and extensibility.

### 4.1 Proposed Component Structure

```
DesignCanvas
├── CanvasGrid (New)
│   └── Renders infinite grid and axis lines.
├── CanvasShape (New)
│   └── Renders individual shapes (Rect, Polygon, Ellipse) based on `type`.
│   └── Handles geometric transforms (SVG rotation).
├── CanvasSelection (New)
│   └── Renders selection UI *on top* of shapes.
│   └── Resize handles, Rotation handles, Vertex handles.
│   └── Marquee overlay.
└── DesignCanvasRender (Simplified)
    └── Composes the above components.
```

### 4.2 Implementation Steps

1.  **Extract `CanvasGrid`**: Move grid line rendering to a separate component.
2.  **Extract `CanvasShape`**: Create a component that takes an `entity` prop and renders the appropriate SVG element (`<path>`, `<ellipse>`, etc.).
3.  **Extract `CanvasSelection`**: Move the logic for rendering handles (currently inside the map loop in `DesignCanvasRender`) to a dedicated component that overlays the asset.

### 4.3 Workflow for Contributors

**To Add a New Shape Type:**
1.  **Model:** Update `models.go` (if new data fields are needed).
2.  **Logic:** Update `DesignCanvas.logic.js` if custom interaction handles are needed.
3.  **Render:** Add the new type case to `CanvasShape` (frontend).
4.  **Properties:** Add property controls to `DesignProperties.jsx`.

**To Fix a Rendering Bug:**
1.  Identify if it's a logic bug (wrong coordinates in `DesignCanvas.logic.js`) or a display bug.
2.  If display, check `CanvasShape` (or `DesignCanvasRender` before refactoring).
