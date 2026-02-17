# Architecture Overview

This document provides a high-level overview of the `roomGenerator` architecture. For more detailed information on specific subsystems, please refer to the linked documents.

## 1. System Components

The application is built using:
- **Frontend:** React (Vite)
- **Backend:** Go (Wails)
- **State Management:** Zustand
- **Routing:** React Router (HashRouter)

## 2. URL Structure & Routing

The application uses `HashRouter` for navigation.
See [ROUTING.md](./ROUTING.md) for details.

| Route | Component | Description |
|---|---|---|
| `/` | `Home.jsx` | The landing page displaying the list of projects. |
| `/library` | `Library.jsx` | A global library for managing reusable assets. |
| `/project/:id` | `Editor.jsx` | The main editor interface. |

## 3. State Management (Zustand)

Global state is managed using **Zustand** in `frontend/src/store/`.
See [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) for details on slices and undo/redo logic.

### Key State Objects
- **`projects`**: List of all available projects.
- **`localAssets`**: Assets specific to the current project.
- **`instances`**: Placed instances on the Layout Canvas.
- **`viewState`**: Canvas viewport state.

### Persistence
Changes to the project state trigger an auto-save mechanism via `useAutoSave`, calling the Go backend.

## 4. Data Flow

1.  **Initialization:** `App.jsx` loads initial data from Go.
2.  **Project Load:** `Editor.jsx` fetches project-specific data.
3.  **User Interaction:** Components update the Zustand store.
4.  **Saving:** `useAutoSave` calls `App.SaveProjectData` (Go), which writes to JSON files in `data/`.

## 5. Key Components

### `Editor.jsx`
The main orchestration component. Manages:
- **Sidebar (`UnifiedSidebar`)**
- **Canvas Area:** Switches between `LayoutCanvas` and `DesignCanvas`.
- **Properties Panel:** Switches between `LayoutProperties` and `DesignProperties`.

### `DesignCanvas.jsx`
Handles creation/modification of assets (shapes).
See [DESIGN_CANVAS_LOGIC.md](./DESIGN_CANVAS_LOGIC.md) for interaction details.

### `LayoutCanvas.jsx`
Handles placement of assets into a floor plan (instances).

## 6. Backend (Go)
Located in `app.go`. Acts as a bridge to the file system.
- **`data/` Directory:** Stores JSON data.
- **Migration:** Handles legacy data format updates (e.g., `shapes` -> `entities`).
