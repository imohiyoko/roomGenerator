# RoomGenerator Architecture Analysis & Refactoring Plan

This document provides a comprehensive overview of the `roomGenerator` codebase, detailing the current architecture, data flow, and proposed refactoring strategy. It serves as a guide for contributors to understand how different parts of the system interact.

## 1. System Overview

`roomGenerator` is a desktop application built with **Wails** (Go backend + React frontend).

- **Backend (Go):** Handles file system operations (loading/saving projects, assets, settings), data modeling, and migration logic.
- **Frontend (React/Vite):** Provides the user interface for designing assets (furniture/shapes) and laying out rooms. State is managed via **Zustand**.

### Core Technologies
- **Backend:** Go, Wails v2
- **Frontend:** React, Vite, Zustand, React Router DOM
- **Data Format:** JSON (stored in `./data/`)

---

## 2. Backend Architecture

The backend logic resides mainly in `app.go` and data structures in `models.go`.

### Key Files
- `main.go`: Application entry point. Configures Wails options.
- `app.go`: Defines the `App` struct and methods exposed to the frontend.
- `models.go`: Defines Go structs (`Project`, `Asset`, `Entity`, `Instance`, etc.) mirroring the JSON data structure.

### API Methods (Exposed to Frontend)
These methods are callable from the frontend via `window.go.main.App.<MethodName>`.

| Method | Description |
| :--- | :--- |
| `GetProjects()` | Returns a list of projects from `projects_index.json`. |
| `CreateProject(name)` | Creates a new project and initializes its data file. |
| `GetProjectData(id)` | Loads detailed project data (assets, instances) from `project_<id>.json`. **Includes migration logic.** |
| `SaveProjectData(id, data)` | Saves project data to disk. Validates structure before saving. |
| `GetAssets()` | Loads global assets (furniture library) from `global_assets.json`. |
| `SaveAssets(assets)` | Saves global assets. |
| `GetSettings() / SaveSettings()` | Manages application settings (`settings.json`). |
| `ImportProject / ExportProject` | Handles JSON import/export of projects. |

### Data Models (`models.go`)
- **Project**: Metadata (ID, Name, UpdatedAt).
- **ProjectData**: The root object for a project file (`LocalAssets`, `Instances`).
- **Asset**: A reusable object (e.g., "Chair", "Room Shape"). Contains a list of `Entity` objects.
- **Entity**: A geometric shape (Polygon, Circle, Text) or grouping within an Asset. **Note:** Historically called "shapes", now standardized to "entities".
- **Instance**: A placement of an Asset in the layout view (includes Position `X, Y`, `Rotation`).

### Data Storage
Data is stored in the `./data/` directory (created on startup if missing).
- `projects_index.json`: List of all projects.
- `project_<id>.json`: Data for a specific project.
- `global_assets.json`: Shared library of assets.
- `settings.json`: User preferences.

---

## 3. Frontend Architecture

The frontend is a Single Page Application (SPA) structured around **Pages** and **Stores**.

### Directory Structure
- `src/App.jsx`: Main router configuration.
- `src/pages/`: Top-level views.
- `src/components/`: Reusable UI components.
- `src/domain/`: Pure business logic and helper functions.
- `src/store/`: State management (Zustand).
- `src/lib/`: Utilities and API wrappers.

### Routes (`App.jsx`)
| Route | Page Component | Description |
| :--- | :--- | :--- |
| `/` | `Home` | Project list and creation. |
| `/library` | `Library` | Global asset editor/manager. |
| `/project/:id` | `Editor` | Main workspace for editing a specific project. |
| `/settings` | `Settings` | Application settings. |

### Key Components
- **DesignCanvas (`components/DesignCanvas.jsx`)**:
    - The editor for *Assets*. Users draw lines, rects, and shapes here.
    - Handles complex interactions: Panning, Zooming, Node Editing.
    - Logic partially extracted to `DesignCanvas.logic.js`.
- **LayoutCanvas (`components/LayoutCanvas.jsx`)**:
    - The editor for *Rooms*. Users place *Instances* of assets here.
    - Handles drag-and-drop of assets from the sidebar.
- **UnifiedSidebar (`components/UnifiedSidebar.jsx`)**:
    - Left-hand panel for tool selection and asset browsing.
- **DesignProperties / LayoutProperties**:
    - Right-hand panels for editing properties of selected items.

### State Management (`src/store/`)
Using **Zustand** with a slice pattern.
- `projectSlice.js`: Manages the currently loaded project data (`localAssets`, `instances`).
- `assetSlice.js`: Manages global assets.
- `uiSlice.js`: Manages UI state (selection, active tool, modal visibility).
- `settingsSlice.js`: Manages app settings.

---

## 4. Data Flow & Workflows

### Project Loading
1. **User** clicks a project in `Home`.
2. **Frontend** navigates to `/project/:id`.
3. `Editor` component mounts and calls `API.getProjectData(id)`.
4. **Backend** (`App.GetProjectData`) reads `project_<id>.json`.
    - *Migration:* If data uses legacy `shapes` key, it maps it to `entities`.
5. **Frontend** receives normalized data and populates `useStore`.

### Asset Creation (Design Mode)
1. **User** selects a tool (e.g., Rectangle) in `UnifiedSidebar`.
2. **User** drags on `DesignCanvas`.
3. `DesignCanvas` handles pointer events, calculating coordinates.
4. **State Update:** `useStore.setState` is called to add a new `Entity` to the current `Asset`.
    - `updateAssetEntities` helper in `domain/assetService.js` calculates the new Bounding Box.
5. **Auto-Save:** `useAutoSave` hook detects state change and calls `API.saveProjectData`.

### Instance Placement (Layout Mode)
1. **User** drags an Asset from `UnifiedSidebar` onto `LayoutCanvas`.
2. `LayoutCanvas` calculates drop position (converting screen coords to room coords).
3. **State Update:** A new `Instance` is added to `projectSlice`.
4. **Rendering:** `LayoutCanvas` renders the `Asset` at the `Instance`'s coordinates.

---

## 5. Refactoring Plan

The goal is to improve maintainability, type safety, and logical separation.

### Phase 1: Logic Extraction & Domain Cleanup
- **Target:** `DesignCanvas.jsx` and `DesignCanvas.logic.js`.
- **Action:** Extract pure geometric calculations (snapping, resize math, rotation) into `src/domain/geometryService.js` or similar.
- **Goal:** Make React components focused purely on rendering and event handling.

### Phase 2: Standardization of Terminology
- **Issue:** The codebase mixes "Shapes" (legacy) and "Entities" (new).
- **Action:** Ensure frontend code consistently uses `entities`. The backend already handles migration, but frontend internal logic should be consistent.
- **Refactor:** Rename `shapes` to `entities` in any remaining frontend utility functions or prop names.

### Phase 3: Type Safety & Documentation
- **Action:** Add JSDoc to all functions in `src/domain/` and `src/lib/`.
- **Action:** Define "Shape" of state objects in `store/` documentation.
- **Benefit:** Better IDE support and easier onboarding for new contributors.

### Phase 4: Testing Strategy
- **Current State:** Low test coverage.
- **Plan:**
    - Unit tests for `src/domain/` logic (using Vitest/Jest).
    - E2E tests for critical flows (Project Creation, Asset Save) using Playwright.

## 6. Contribution Guide
*To be added: Specific instructions for running tests and linting after refactoring.*
