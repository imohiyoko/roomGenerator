# System Map & Architecture

This document provides a comprehensive overview of the **roomGenerator** system architecture, data flow, and key components. It is intended to help contributors understand how the application works.

## 1. High-Level Architecture

The application is a desktop app built with **Wails** (Go + React).

*   **Backend (Go)**: Handles file system operations (saving/loading projects, assets), business logic for defaults.
*   **Frontend (React + Vite)**: Handles the UI, state management (Zustand), and canvas interactions.
*   **Bridge (Wails Runtime)**: Connects the two via `window.go` bindings.

## 2. Backend API (Go)

Located in `app.go` (and `models.go`, `defaults.go` after refactoring).

### Key Structures
*   **App**: Main application struct, holds context and configuration.
*   **Project**: Metadata for a project (ID, Name, UpdatedAt).
*   **ProjectData**: Content of a project (LocalAssets, Instances).

### Exposed Methods (Wails Bindings)
These methods are callable from the frontend via `window.go.main.App.<MethodName>`.

*   `GetProjects()`: Returns a list of available projects.
*   `CreateProject(name string)`: Creates a new project file and entry.
*   `GetProjectData(id string)`: Loads the JSON data for a specific project.
*   `SaveProjectData(id string, data interface{})`: Saves project JSON.
*   `DeleteProject(id string)`: Removes a project and its file.
*   `GetAssets()`: Returns the global asset library.
*   `GetPalette()`: Returns the color palette.

## 3. Frontend Architecture

### Routing (`App.jsx`)
*   `/`: **Home** - Project list and creation.
*   `/project/:id`: **Editor** - The main workspace (Design + Layout).
*   `/library`: **Library Manager** (Future/Current feature for managing global assets).

### State Management (Zustand)
Located in `frontend/src/store/`. The store is split into slices:

*   **`projectSlice.js`**: Manages project metadata, loading/saving, and normalizing data.
*   **`assetSlice.js`**: Manages the *Asset Editor* state (DesignCanvas).
*   **`instanceSlice.js`**: Manages the *Layout Editor* state (LayoutCanvas, placing instances).
*   **`uiSlice.js`**: Manages UI state (active tab, modals, zoom levels).

**Undo/Redo**: Handled by `zundo` middleware, tracking `localAssets` and `instances`.

### Key Workflows & Data Flow

#### 1. Loading a Project
1.  **User** clicks a project on Home screen.
2.  **Frontend** calls `API.getProjectData(id)`.
3.  **Backend** reads `data/project_<id>.json`.
4.  **Frontend** receives JSON.
5.  **Normalization**:
    *   If project is empty, **Global Assets** are forked (copied) into `LocalAssets`.
    *   Assets are normalized (e.g., ensuring `entities` array exists).
    *   Colors are synced with the current Palette defaults if `isDefaultShape` is true.
6.  **Store Update**: `localAssets` and `instances` are set in Zustand.

#### 2. Creating an Asset (Design Mode)
1.  **User** draws a shape in `DesignCanvas`.
2.  **Interaction**: `useCanvasInteraction` hook handles mouse events.
3.  **Commit**: On `pointerUp`, the new shape is added to the `Asset` in the Store.
4.  **Auto-Save**: `useAutoSave` hook detects store changes and calls `API.saveProjectData`.

#### 3. Placing an Instance (Layout Mode)
1.  **User** drags an asset from the sidebar to `LayoutCanvas`.
2.  **Drop**: A new `Instance` object is created referencing the `assetId`.
3.  **Store Update**: `instances` array is updated.
4.  **Rendering**: `LayoutCanvas` renders the instance using the referenced Asset's geometry.

## 4. File Structure

```
.
├── app.go              # Main Backend Logic & API
├── main.go             # Wails Entry Point
├── wails.json          # Wails Configuration
├── frontend/
│   ├── src/
│   │   ├── components/ # React Components (UI)
│   │   ├── domain/     # Business Logic (Asset/Project Service)
│   │   ├── lib/        # Utilities (Math, API wrapper)
│   │   ├── store/      # State Management (Zustand)
│   │   ├── App.jsx     # Routing
│   │   └── main.jsx    # Entry Point
│   └── wailsjs/        # Generated JS bindings
└── data/               # (Generated) User data storage
```

## 5. Data Models (JSON)

### Project Data
```json
{
  "assets": [ ... ],   // Array of Asset objects
  "instances": [ ... ] // Array of Instance objects
}
```

### Asset Object
```json
{
  "id": "a-123",
  "name": "Room 1",
  "type": "room",
  "w": 300,
  "h": 300,
  "entities": [ ... ] // Drawing primitives (rect, polygon)
}
```
