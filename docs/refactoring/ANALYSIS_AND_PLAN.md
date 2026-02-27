# Room Generator Refactoring Analysis & Plan

This document serves as a comprehensive analysis of the "Room Generator" (Asset Editor & Room Layout) system, outlining the current architecture, data flow, key functions, and a roadmap for refactoring. It is intended for contributors to understand the system's "overall shape" and how to extend it.

## 1. System Overview

The "Room Generator" is a dual-mode editor within the application:
1.  **Design Mode**: For creating and editing individual assets (furniture, rooms, fixtures) using primitive shapes (polygons, ellipses, rectangles).
2.  **Layout Mode**: For arranging these assets into a floor plan.

The system is built with **React** (Frontend), **Zustand** (State Management), and **Wails (Go)** (Backend/File System).

## 2. Architecture Map

### 2.1 URL Structure & Routing
The application uses `HashRouter` for navigation.

| URL Pattern | Component | Description |
|---|---|---|
| `/` | `Home.jsx` | Landing page listing projects. |
| `/library` | `Library.jsx` | Global asset library management. |
| `/project/:id` | `Editor.jsx` | **The Core Editor**. Handles both Design and Layout modes. |
| `/settings` | `Settings.jsx` | Global application settings. |

### 2.2 Component Hierarchy (Editor)
*   **`Editor.jsx`**: Main container. Manages sidebar visibility, mode switching, and keyboard shortcuts.
    *   **`Header.jsx`**: Top bar with project title and Undo/Redo controls.
    *   **`UnifiedSidebar.jsx`**: Left panel.
        *   Lists local project assets (Blueprints).
        *   Lists placed instances (in Layout Mode).
        *   Allows dragging assets onto the canvas.
    *   **Canvas Area**:
        *   **`Ruler.jsx`**: Visual guides.
        *   **`DesignCanvas.jsx`** (in Design Mode):
            *   **`DesignCanvasRender`**: Pure component for rendering SVG elements.
            *   Handles `onPointerDown`, `onPointerMove`, `onPointerUp` for shape manipulation.
        *   **`LayoutCanvas.jsx`** (in Layout Mode):
            *   Handles placement and movement of instances.
    *   **Properties Panel** (Right Sidebar):
        *   **`DesignProperties.jsx`**: Detailed editor for shape properties (geometry, color, points) when in Design Mode.
        *   **`LayoutProperties.jsx`**: Editor for instance properties (position, rotation) when in Layout Mode.

### 2.3 State Management (Zustand)
Located in `frontend/src/store/`.

*   **`projectSlice.js`**: The single source of truth for project data.
    *   `localAssets`: Array of `Asset` objects (definitions).
    *   `instances`: Array of `Instance` objects (placed items).
    *   `viewState`: Canvas viewport `{x, y, scale}`.
    *   `mode`: 'design' or 'layout'.
    *   `designTargetId`: ID of the asset currently being edited.
    *   `selectedShapeIndices`: Array of indices for selected shapes in Design Mode.
    *   `selectedIds`: Array of IDs for selected instances in Layout Mode.

**Data Flow Pattern:**
1.  **Read**: Components read directly from the store via hooks (e.g., `useStore(state => state.localAssets)`).
2.  **Write**: Components dispatch actions (e.g., `setLocalAssets`).
3.  **Persistence**: `useAutoSave` hook in `Editor.jsx` detects store changes and calls `API.SaveProjectData` (Go).

## 3. Data Models

### 3.1 Asset (Blueprint)
Defined in `models.go` (Go) and mirrored in Frontend.
```json
{
  "id": "a_123",
  "name": "Sofa",
  "type": "furniture",
  "w": 200, "h": 100,
  "entities": [
    { "type": "rect", "x": 0, "y": 0, "w": 200, "h": 100, "color": "#..." }
  ]
}
```

### 3.2 Instance (Placed Object)
```json
{
  "id": "i_456",
  "assetId": "a_123",
  "x": 100, "y": 200,
  "rotation": 90,
  "locked": false
}
```

## 4. Key Functions & Logic Inventory

### 4.1 Design Logic (`frontend/src/components/DesignCanvas.logic.js`)
Contains pure functions for interaction logic.

| Function | Purpose |
|---|---|
| `initiatePanning` | Starts canvas pan operation. |
| `initiateDraggingShape` | Starts moving selected shape(s). |
| `initiateResizing` | Starts resizing a shape (width/height/both). |
| `processDraggingPoint` | Updates vertex positions for polygons. |
| `processDraggingHandle` | Updates Bezier control points. |

### 4.2 Geometry Utilities (`frontend/src/lib/utils.js`)
Shared math helpers.

| Function | Purpose |
|---|---|
| `toSvgY(y)` | Converts Cartesian Y (Up+) to SVG Y (Down+). |
| `toCartesianY(y)` | Inverse of above. |
| `calculateAssetBounds` | Computes AABB for a group of entities. Critical for normalizing assets. |
| `generateSvgPath` | Generates path data for polygons/beziers. |

### 4.3 Backend API (`app.go`)
| Function | Purpose |
|---|---|
| `GetProjectData(id)` | Loads project JSON. Handles migration (Shapes -> Entities). |
| `SaveProjectData(id, data)` | Saves project JSON. Validates structure. |
| `ImportGlobalAssets` | Merges external library data. |

## 5. Refactoring Roadmap

To improve maintainability and developer experience, the following refactoring steps are proposed:

### Phase 1: Logic Extraction (Consistency)
- **Goal**: Unify the interaction patterns between `DesignCanvas` and `LayoutCanvas`.
- **Task**: Extract dragging/panning logic from `LayoutCanvas.jsx` into a new `LayoutCanvas.logic.js` file, mirroring the structure of `DesignCanvas.logic.js`.

### Phase 2: Component Decomposition
- **Goal**: Reduce the size of Property panels (currently >500 lines).
- **Task**: Split `DesignProperties.jsx` into:
    - `PropertySection.jsx` (Wrapper)
    - `ShapeGeometryEditor.jsx` (Width/Height/X/Y)
    - `PointEditor.jsx` (Vertex list)
    - `StyleEditor.jsx` (Color)

### Phase 3: Geometry Unification
- **Goal**: Centralize coordinate transformations.
- **Task**: Ensure all components use `toSvgY` / `toCartesianY` from `utils.js` instead of inline calculations.

## 6. Contributor Workflow

### Adding a New Feature
1.  **Identify Scope**: Does it affect the *Blueprint* (Design Mode) or the *Arrangement* (Layout Mode)?
2.  **Update Model**: If needed, update `models.go` and `models.js` (if exists).
3.  **Update Logic**:
    - For Design interactions: Edit `DesignCanvas.logic.js`.
    - For Layout interactions: Edit `LayoutCanvas.jsx` (or `logic.js` after refactor).
4.  **Update UI**: Edit the corresponding `Properties` panel.
5.  **Verify**: Run the app (`wails dev`) and check `app.log` for backend errors.

### Testing
- **Backend**: Run `go test ./...` in the root.
- **Frontend**: Currently manual verification. Ensure `console.log` is clean.
