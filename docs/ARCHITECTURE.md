# Architecture & System Overview

This document provides a comprehensive map of the Room Generator application, detailing its structure, functions, data flow, and workflows.

## 1. Technology Stack

- **Backend**: Go (1.21+) using [Wails](https://wails.io/)
- **Frontend**: React, Vite, Tailwind CSS
- **State Management**: Zustand (with slices and Zundo for undo/redo)
- **Routing**: React Router (HashRouter)
- **Icons**: React Icons (Lucide, Fa, Md, etc.)

## 2. Directory Structure

The application follows a standard Wails project structure with a clear separation between the Go backend and React frontend.

```
.
├── app.go                  # [Backend] Main application logic & API methods
├── main.go                 # [Backend] Wails entry point & configuration
├── data/                   # [Data] Local JSON storage (generated at runtime)
├── docs/                   # [Documentation] Project documentation
└── frontend/               # [Frontend] React Application
    ├── src/
    │   ├── App.jsx         # [Router] Main routing definition
    │   ├── main.jsx        # [Entry] React entry point
    │   ├── components/     # [UI] Reusable UI components (Canvas, Panels, etc.)
    │   ├── domain/         # [Logic] Pure business logic (Asset operations)
    │   ├── hooks/          # [Logic] Custom React hooks (useAutoSave, etc.)
    │   ├── lib/            # [Utils] API wrappers, math helpers
    │   ├── pages/          # [Views] Top-level page components
    │   └── store/          # [State] Global state management (Zustand)
```

## 3. Backend API (Wails)

The Go backend (`app.go`) exposes the following methods to the frontend via `window.go.main.App`. These are wrapped in `frontend/src/lib/api.js`.

| Function Name | Input | Output | Description |
| :--- | :--- | :--- | :--- |
| **Project Management** | | | |
| `GetProjects` | `()` | `[]Project` | Returns a list of all projects (metadata). |
| `CreateProject` | `(name string)` | `Project` | Creates a new project and initializes its data file. |
| `DeleteProject` | `(id string)` | `error` | Deletes a project from the index and removes its data file. |
| `UpdateProjectName` | `(id, name)` | `error` | Renames an existing project. |
| **Project Content** | | | |
| `GetProjectData` | `(id string)` | `ProjectData` | Loads assets and instances for a specific project. |
| `SaveProjectData` | `(id, data)` | `error` | Saves the current state of a project (auto-saved). |
| **Global Library** | | | |
| `GetAssets` | `()` | `[]Asset` | Loads the global asset library. |
| `SaveAssets` | `(assets)` | `error` | Saves changes to the global asset library. |
| **Configuration** | | | |
| `GetPalette` | `()` | `PaletteData` | Loads the global color palette and defaults. |
| `SavePalette` | `(palette)` | `error` | Saves the color palette configuration. |

## 4. Frontend Architecture

### Routing (URLs)

The application uses `HashRouter`.

| URL Path | Component | Description |
| :--- | :--- | :--- |
| `/` | `pages/Home.jsx` | Dashboard. List existing projects or create a new one. |
| `/library` | `pages/Library.jsx` | Global Asset Editor. Manage reusable shapes and colors. |
| `/project/:id` | `pages/Editor.jsx` | Main Workspace. Contains Layout and Design modes. |

### State Management (Zustand)

The global store is composed of several slices located in `frontend/src/store/`:

*   **`projectSlice`**: Manages the list of projects and current project metadata.
*   **`assetSlice`**: Manages global and local (project-specific) assets.
*   **`instanceSlice`**: Manages placed instances (furniture, rooms) on the layout.
*   **`uiSlice`**: Manages UI state (current mode, selection, zoom level).
*   **`historySlice` (Zundo)**: Handles Undo/Redo functionality.

### React Hooks Pattern

We encourage moving complex logic out of components into custom hooks.
- `useAutoSave`: Handles debounced saving of project data.
- `useKeyboardControls`: Handles global keyboard shortcuts (WASD, Undo/Redo).

## 5. Data Flow

### Storage Format
All data is stored in the `data/` directory relative to the executable as JSON files.

*   `projects_index.json`: List of project metadata.
*   `global_assets.json`: Shared library of assets.
*   `palette.json`: Color configurations.
*   `project_<id>.json`: Specific project data (Local Assets + Instances).

### Flow Example: Saving a Project
1.  **User Action**: User moves a piece of furniture in `LayoutCanvas`.
2.  **State Update**: `instanceSlice` updates the `x, y` coordinates in the Zustand store.
3.  **Auto-Save Trigger**: `hooks/useAutoSave.js` has a `useEffect` watching `instances` and `localAssets`.
4.  **Debounce**: After a short delay (e.g., 1000ms), the effect fires.
5.  **API Call**: `API.saveProjectData(id, { assets, instances })` is called via `frontend/src/lib/api.js`.
6.  **Backend**: `app.go` receives the data and writes it to `data/project_<id>.json`.

## 6. Key Workflows

### Project Creation
1.  User clicks "Create New Project" on Home.
2.  Frontend calls `API.createProject(name)`.
3.  Backend creates a new ID, adds to `projects_index.json`, creates empty `project_<id>.json`.
4.  Frontend navigates to `/project/<new_id>`.

### Asset Forking (Isolation)
1.  When opening a project, if `localAssets` is empty, the frontend copies `globalAssets` into `localAssets`.
2.  This ensures that modifying a shape in a specific project does **not** affect the global library or other projects.
3.  Logic location: `frontend/src/domain/assetService.js` (called from `store/projectSlice.js`).

### Geometric Editing (Design Mode)
1.  User enters Design Mode for an asset.
2.  Modifying a vertex updates the `entities` array in the asset.
3.  The `boundX`, `boundY`, `w`, `h` are recalculated using `calculateAssetBounds`.
4.  The asset is flagged as `isDefaultShape: false` to prevent auto-coloring updates.
