# System Map

This document provides a comprehensive map of the `roomGenerator` system, detailing the URL structure, component hierarchy, state management, and key functions.

## 1. URL Structure & Routing
The application uses `HashRouter` for client-side routing.

| URL Pattern | Component | Description |
|---|---|---|
| `/` | `frontend/src/pages/Home.jsx` | Landing page listing all projects. |
| `/library` | `frontend/src/pages/Library.jsx` | Global asset library management. |
| `/project/:id` | `frontend/src/pages/Editor.jsx` | Main editor interface for a specific project. |
| `/settings` | `frontend/src/pages/Settings.jsx` | Global application settings (colors, defaults). |

## 2. Component Hierarchy (Key Components)
The UI is composed of several major functional blocks.

- **`App.jsx`**: Root component handling routing and initial global data fetching (Projects, Assets, Palette).
- **`Editor.jsx`**: The central workspace. Orchestrates:
    - **`UnifiedSidebar.jsx`**: Left panel for selecting assets/tools.
    - **`DesignCanvas.jsx`**: Canvas for editing individual assets (shapes, polygons).
    - **`LayoutCanvas.jsx`**: Canvas for placing instances (rooms, furniture) into a floor plan.
    - **`DesignProperties.jsx`**: Right panel for editing properties of selected shapes in Design Mode.
    - **`LayoutProperties.jsx`**: Right panel for editing properties of selected instances in Layout Mode.
    - **`Ruler.jsx`**: Visual guides for the canvas.

## 3. State Management (Zustand)
Located in `frontend/src/store/`.

- **`projectSlice.js`**: Manages the core data model.
    - `projects`: List of available projects.
    - `localAssets`: Assets specific to the current project (Blueprints).
    - `instances`: Placed objects in the layout (References to Assets).
    - `viewState`: Canvas viewport (pan/zoom).
- **`uiSlice.js`** (if applicable/separate): Manages UI state like sidebar width, collapse state.
- **`temporal`**: Middleware for Undo/Redo functionality on specific slices.

## 4. Data Flow

### Loading a Project
1.  User navigates to `/project/:id`.
2.  `Editor.jsx` mounts and calls `loadProject(id)` action from `projectSlice`.
3.  `loadProject` calls `API.getProjectData(id)` (Go Backend).
4.  Backend reads `data/project_{id}.json`.
5.  Frontend normalizes data (e.g., converting legacy `shapes` to `entities`).
6.  Zustand Store is updated with `localAssets`, `instances`, and settings.

### Saving a Project
1.  User modifies the canvas (e.g., moves a room).
2.  Zustand Store updates immediately.
3.  `useAutoSave` hook detects changes.
4.  `useAutoSave` calls `saveProjectData()` action.
5.  Action sends current `localAssets` and `instances` to `API.saveProjectData(id)`.
6.  Backend writes to `data/project_{id}.json`.

## 5. Key Functions & Domain Logic
Core business logic located in `frontend/src/domain/` or `frontend/src/lib/`.

- **`calculateAssetBounds(entities)`** (`src/lib/utils.js`):
    - Calculates the Axis-Aligned Bounding Box (AABB) for a group of entities.
    - Critical for determining the center and size of assets.

- **`updateAssetEntities(asset, entities)`** (`src/domain/assetService.js`):
    - Central helper to update an asset's entities.
    - Automatically recalculates bounds (`w`, `h`, `boundX`, `boundY`) to ensure consistency.

- **`normalizeAsset(asset)`** (`src/lib/utils.js`):
    - Migrates legacy data formats (e.g., renaming `shapes` array to `entities`) to ensure compatibility.

- **`forkAsset(asset, defaultColors)`** (`src/domain/assetService.js`):
    - Creates a deep copy of a global asset for local modification within a project.
    - Assigns a new unique ID and applies default project colors.

## 6. Backend Interface (Go)
Located in `app.go`.

- **`GetProjectData(id string)`**: Returns `ProjectData` struct. Handles legacy JSON migration.
- **`SaveProjectData(id string, data interface{})`**: Validates and saves project data to JSON.
- **`ImportProject(name, json)` / `ExportProject(id)`**: Handles full project import/export.
