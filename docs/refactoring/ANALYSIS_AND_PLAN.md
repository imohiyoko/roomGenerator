# Refactoring Analysis and Plan: Room Generator (Design Mode)

## 1. System Overview

The "Room Generator" functionality is implemented within the Design Mode of the application. It allows users to create and edit 2D assets using basic shapes.

### URL & Routing
- **Route**: `/project/:id`
- **Component**: `frontend/src/pages/Editor.jsx`
- **Mode Switching**: The editor switches between `DesignCanvas` (Asset Editing) and `LayoutCanvas` (Room Layout).

### Component Hierarchy (Refactored)
- **`Editor`**: Main container.
  - **`DesignCanvas`**: Main drawing area.
    - **Hook**: `useDesignCanvasInteraction` (Handles events, drag logic).
    - **Render**: `DesignCanvasRender` (Composes sub-components).
      - `GridRenderer`: Background grid.
      - `AssetBoundsRenderer`: Asset boundary box.
      - `ShapeRenderer`: Individual shapes (Rect, Ellipse, Polygon).
      - `HandleRenderer`: Interactive handles (Resize, Rotate).
  - **`DesignProperties`**: Sidebar for editing properties.
    - **Service**: `designProperties.service.js` (Handles logic for property updates).

### Data Flow
1.  **Loading**: `Editor` fetches project data via `GetProjectData`.
2.  **Editing (Canvas)**:
    - User interacts -> `useDesignCanvasInteraction` updates `localAsset` state for smooth drag.
    - On `pointerUp` -> syncs to Zustand store.
3.  **Editing (Properties)**:
    - User inputs -> `DesignProperties` calls `designProperties.service.js` functions -> updates Zustand store.
4.  **Saving**: `useAutoSave` monitors store and calls `SaveProject`.

## 2. Developer Guide

### Logic Separation
- **Interaction Logic**: Moved to `frontend/src/hooks/useDesignCanvasInteraction.js`. This hook manages the state machine for dragging, resizing, and marquee selection. It returns event handlers (`onDown`, `onMove`, `onUp`) used by the canvas.
- **Property Logic**: Moved to `frontend/src/domain/designProperties.service.js`. This service contains pure functions for updating asset properties (e.g., `updateEntity`, `bulkResize`).

### Component Structure
The monolithic `DesignCanvasRender` has been split into:
- **`GridRenderer.jsx`**: Renders the grid and axes.
- **`AssetBoundsRenderer.jsx`**: Renders the dashed boundary of the asset.
- **`ShapeRenderer.jsx`**: Renders the SVG path/shape for an entity. It includes `HandleRenderer` when selected.
- **`HandleRenderer.jsx`**: Renders the interactive handles (resize, rotate, vertex editing) based on the entity type.

### Adding New Features
- **New Shape Type**:
  1.  Update `ShapeRenderer.jsx` to render the new SVG element.
  2.  Update `HandleRenderer.jsx` if it needs custom handles.
  3.  Update `designProperties.service.js` if it has unique properties.
- **New Interaction Mode**:
  1.  Update `DesignCanvas.logic.js` (initiate/process functions).
  2.  Update `useDesignCanvasInteraction.js` to handle the new mode.

## 3. Completed Refactoring (2024-05-24)
- Extracted property logic to `designProperties.service.js`.
- Extracted interaction logic to `useDesignCanvasInteraction.js`.
- Split `DesignCanvasRender` into sub-components in `frontend/src/components/canvas/`.
- Updated `DesignProperties.jsx` and `DesignCanvas.jsx` to use the new structure.
