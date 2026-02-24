# Room Generator (DesignCanvas) Architecture

## 1. Overview
The "Room Generator" (implemented as `DesignCanvas`) is the core editor for creating and modifying assets (rooms, furniture) within the application. It allows users to draw shapes (rectangles, ellipses, polygons), manipulate them (move, resize, rotate), and edit their properties.

## 2. System Map

### URL & Routing
- **Route**: `/project/:id`
- **Container Component**: `frontend/src/pages/Editor.jsx`
- **Key Children**:
  - `frontend/src/components/DesignCanvas.jsx` (The main drawing area)
  - `frontend/src/components/DesignProperties.jsx` (The property editor sidebar)

### Component Hierarchy
```
Editor
├── Header
├── UnifiedSidebar (Left)
├── DesignCanvas (Center - The "Room Generator")
│   ├── GridRenderer (Background Grid)
│   ├── ShapeRenderer (Entities: Rect, Ellipse, Polygon)
│   └── HandleRenderer (Selection Handles & Controls)
└── DesignProperties (Right - Property Inspector)
```

## 3. Data Flow

### State Management
1.  **Global Store (Zustand)**: `frontend/src/store/projectSlice.js`
    -   `localAssets`: Array of assets currently in the project.
    -   `designTargetId`: ID of the asset currently being edited.
2.  **Local State (React)**: `DesignCanvas.jsx` & `useCanvasInteraction`
    -   `localAsset`: A copy of the currently selected asset. This is used for high-frequency updates (dragging/resizing) to avoid re-rendering the entire app store on every mouse move.
    -   `cursorMode`: Tracks the current interaction state (e.g., 'draggingShape', 'resizing').

### Data Lifecycle
1.  **Load**: When `designTargetId` changes, `DesignCanvas` finds the asset in `localAssets` (Store) and sets it to `localAsset` (Local State).
2.  **Edit**: User interactions (drag/resize) update `localAsset` via `handleMove` (inside `useCanvasInteraction`). This triggers a re-render of the canvas only.
3.  **Commit**: On `handleUp` (mouse release), the modified `localAsset` is committed back to the global `localAssets` store.
4.  **Save**: The `AutoSave` hook or manual save triggers `SaveProject` in the Go backend (`app.go`), which serializes the store data to JSON.

## 4. Source Code Structure

### `frontend/src/components/DesignCanvas.jsx`
The main container. It delegates:
-   **Interaction Logic**: To `frontend/src/hooks/useCanvasInteraction.js`.
-   **Rendering**: To sub-components in `frontend/src/components/canvas/`.

### `frontend/src/hooks/useCanvasInteraction.js`
Contains the logic for:
-   `handleDown`, `handleMove`, `handleUp`: Event routing.
-   `dragRef`: Mutable ref for tracking drag start positions.
-   `cursorMode`: State for changing the cursor.
-   **Dependencies**: Uses `initiate...` and `process...` functions from `DesignCanvas.logic.js` for math/state calculations.

### `frontend/src/components/DesignCanvas.logic.js`
Pure functions for calculating state updates.
-   **initiate...**: Called on `pointerDown`. Returns initial drag state.
-   **process...**: Called on `pointerMove`. Returns updated entity data.

### `frontend/src/components/canvas/`
-   **GridRenderer.jsx**: Renders the infinite grid and origin lines.
-   **ShapeRenderer.jsx**: Renders the actual asset entities (Rect, Ellipse, Polygon) and the asset bounding box.
-   **HandleRenderer.jsx**: Renders selection handles, resize controls, and rotation tools for the selected shape(s).

## 5. Development Workflow

### Adding a New Tool
1.  **Logic**: Add `initiateNewTool` and `processNewTool` in `DesignCanvas.logic.js`.
2.  **Interaction**: Update `handleDown` and `handleMove` in `useCanvasInteraction.js` to handle the new mode.
3.  **Rendering**: Update `HandleRenderer.jsx` or `ShapeRenderer.jsx` if visual feedback is needed.

### Modifying Rendering
-   Edit the specific renderer component in `frontend/src/components/canvas/`.
-   `ShapeRenderer` handles the "content".
-   `HandleRenderer` handles the "UI controls" (on top of content).
