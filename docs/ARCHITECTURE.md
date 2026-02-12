# Architecture Overview

This document describes the high-level architecture of the Room Generator application.

## Overview

Room Generator is a desktop application built using [Wails](https://wails.io/), which combines a Go backend for native OS interactions and a modern web frontend for the user interface.

- **Backend (Go)**: Handles file system operations (loading/saving JSON data), application lifecycle, and OS integration.
- **Frontend (React)**: Provides the interactive UI for designing room layouts and managing assets.

## Tech Stack

- **Backend**: Go (1.21+)
- **Frontend**:
  - React (with Vite)
  - React Router (Navigation)
  - Tailwind CSS (Styling)
  - Zustand (State Management with Slices)
  - Zundo (Undo/Redo Middleware)
  - React Icons
- **Communication**: Wails runtime bridge (`window.go.main.App`)

## Application Structure

### Backend (Go)
The Go backend (`app.go`) exposes methods to the frontend for data persistence. It manages a local `data/` directory where all application state is stored as JSON files.

**Key Responsibilities:**
- `GetProjects` / `CreateProject` / `DeleteProject`: Manage project metadata.
- `GetProjectData` / `SaveProjectData`: Load/Save specific project content (assets & instances).
- `GetAssets` / `SaveAssets`: Manage the global asset library.
- `GetPalette` / `SavePalette`: Manage global color palette and default colors.

### Frontend (React)
The frontend is a Single Page Application (SPA) utilizing `HashRouter` for navigation.

**Pages:**
1. **Home (`/`)**: Project list, create new project.
2. **Library (`/library`)**: Global asset management, color palette editor.
3. **Project Editor (`/project/:id`)**: The main workspace with two sub-modes:
   - **Layout Mode (`mode: 'layout'`)**: Placing instances of assets on the canvas.
   - **Design Mode (`mode: 'design'`)**: Editing the geometry and properties of individual assets.

## Data Flow

1. **Initialization**: On startup, `App.jsx` fetches the project list, global assets, and color palette from the backend.
2. **Project Load**: When navigating to `/project/:id`, the `Editor` component triggers `loadProject(id)`.
   - *Logic*: If a project has no local assets, global assets are automatically "forked" (copied) into the project. This logic resides in `frontend/src/store/projectSlice.js` and `frontend/src/domain/assetService.js`.
3. **Editing**: User interactions update the Zustand store slices (`uiSlice`, `instanceSlice`, etc.).
   - `instances`: Position, rotation, scale of placed items.
   - `localAssets`: Definitions of shapes (polygons, dimensions, colors).
4. **Persistence**:
   - **Auto-Save**: A debounced effect in `Editor.jsx` triggers `SaveProjectData` when `localAssets` or `instances` change.
   - **Global Assets**: Changes in the Library view are saved explicitly via `SaveAssets`.

## Directory Structure (Key Files)

```
.
├── app.go              # Go Backend Implementation
├── main.go             # Wails Entry Point
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Router Container
│   │   ├── pages/          # Page Components (Home, Library, Editor)
│   │   ├── store/          # Global State (Zustand Slices)
│   │   │   ├── index.js    # Store Configuration
│   │   │   ├── projectSlice.js
│   │   │   ├── assetSlice.js
│   │   │   └── ...
│   │   ├── domain/         # Business Logic (Asset Forking, Syncing)
│   │   │   └── assetService.js
│   │   ├── lib/
│   │   │   ├── api.js      # Wails Bindings Wrapper
│   │   │   └── utils.js    # Helpers
│   │   ├── components/     # UI Components
│   │   │   ├── DesignCanvas.jsx  # Asset Editor
│   │   │   ├── LayoutCanvas.jsx  # Room Layout Editor
│   │   │   └── ...
```
