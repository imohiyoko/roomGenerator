# RoomGenerator Architecture Analysis & Refactoring Plan

This document provides a comprehensive overview of the `roomGenerator` codebase, detailing the current architecture, data flow, and proposed refactoring strategy. It serves as a guide for contributors to understand how different parts of the system interact.

## 1. System Overview (URLs & Components)

The application is structured around specific routes that map to high-level page components.

### URL Structure

| URL Path | Page Component | Description |
| :--- | :--- | :--- |
| `/` | `Home` | Project list, create new project. |
| `/library` | `Library` | Global asset library management. |
| `/project/:id` | `Editor` | Main workspace for designing assets and laying out rooms. |
| `/settings` | `Settings` | Application settings (theme, defaults). |

### Component Hierarchy (Editor Page)

- **`Editor`** (`src/pages/Editor.jsx`) - Main container. Handles key bindings & auto-save.
  - **`UnifiedSidebar`** (`src/components/UnifiedSidebar.jsx`) - Tool selection & asset list.
  - **`DesignCanvas`** (`src/components/DesignCanvas.jsx`) - **(Focus Area)** The vector editor for creating furniture/shapes.
    - `DesignCanvasRender` - Pure functional component for rendering SVG.
  - **`LayoutCanvas`** (`src/components/LayoutCanvas.jsx`) - The room layout editor (placing instances).
  - **`DesignProperties`** (`src/components/DesignProperties.jsx`) - Right-hand panel for editing selected shape properties.
  - **`LayoutProperties`** (`src/components/LayoutProperties.jsx`) - Right-hand panel for editing selected instance properties.

---

## 2. Function Inventory (DesignCanvas Logic)

The core interaction logic for the `DesignCanvas` is extracted into `src/components/DesignCanvas.logic.js`. These functions handle the "Drag & Drop" state machine.

### Interaction Initiators (`initiate*`)
These functions are called on `onPointerDown`. They calculate the initial state and return a `dragRef` object.

| Function | Trigger | Description |
| :--- | :--- | :--- |
| `initiatePanning` | Middle Mouse / Space+Drag | Starts canvas panning (viewState translation). |
| `initiateMarquee` | Left Click on Empty Space | Starts a box selection (Marquee). Clears selection if no modifier key. |
| `initiateResizing` | Drag on Resize Handle | Starts resizing a shape. Supports 'width', 'height', or 'both'. |
| `initiateDraggingHandle` | Drag on Control Point (Polygon) | Starts moving a specific bezier handle of a polygon point. |
| `initiateDraggingAngle` | Drag on Angle Handle (Arc/Pie) | Starts changing the start/end angle of an arc/sector. |
| `initiateDraggingRotation` | Drag on Rotation Handle | Starts rotating the shape around its center. |
| `initiateDraggingRadius` | Drag on Radius Handle | Starts changing the `rx` or `ry` of an ellipse/circle. |
| `initiateDraggingPoint` | Drag on Vertex (Polygon) | Starts moving a specific vertex of a polygon. |
| `initiateDraggingShape` | Drag on Shape Body | Starts moving the entire shape(s). Handles multiple selection. |

### Interaction Processors (`process*`)
These functions are called on `onPointerMove`. They take the current pointer event and `dragRef` state, and return updated data (usually a new list of entities).

| Function | Input | Output | Description |
| :--- | :--- | :--- | :--- |
| `processPanning` | `viewState` | `viewState` | Updates the canvas offset (pan). |
| `processMarquee` | `dragRef` | `selectedIndices` | Calculates which shapes are inside the marquee box. |
| `processResizing` | `dragRef`, `Asset` | `Entities[]` | Calculates new width/height based on mouse delta. |
| `processDraggingShape` | `dragRef`, `Asset` | `Entities[]` | Moves selected shapes. Handles snapping. |
| `processDraggingPoint` | `dragRef`, `Asset` | `Entities[]` | Moves a single vertex. Updates bounding box if needed. |
| `processDraggingHandle` | `dragRef`, `Asset` | `Entities[]` | Moves a bezier handle (control point). |
| `processDraggingAngle` | `dragRef`, `Asset` | `Entities[]` | Updates start/end angles based on mouse angle relative to center. |
| `processDraggingRotation` | `dragRef`, `Asset` | `Entities[]` | Updates rotation based on mouse angle delta. |
| `processDraggingRadius` | `dragRef`, `Asset` | `Entities[]` | Updates radius (`rx`/`ry`) based on distance from center. |

---

## 3. Data Flow & Persistence

The application uses a **Local State -> Global Store -> Backend File** architecture.

### 1. Local Interaction (60fps)
- **Component:** `DesignCanvas`
- **State:** `localAsset` (React `useState`)
- **Flow:**
  1. User drags a shape.
  2. `handleMove` calls `processDraggingShape`.
  3. `setLocalAsset` is called with new entity positions.
  4. React re-renders `DesignCanvasRender` immediately.
  - *Note:* This bypasses the global store for performance during the drag.

### 2. Commit to Store (On Release)
- **Component:** `DesignCanvas`
- **State:** `projectSlice` (Zustand)
- **Flow:**
  1. User releases mouse (`onPointerUp`).
  2. `handleUp` calculates the final Bounding Box (`calculateAssetBounds`).
  3. `setLocalAssets` (Zustand action) is called with the final asset data.
  4. The global store is updated, notifying other components (e.g., `DesignProperties`).

### 3. Persistence (Auto-Save)
- **Component:** `Editor` (via `useAutoSave` hook)
- **State:** `projectSlice` -> Go Backend
- **Flow:**
  1. `useAutoSave` subscribes to changes in `projectSlice`.
  2. Debounces updates (e.g., 500ms).
  3. Calls `API.saveProjectData(projectId, data)`.
  4. **Go Backend:**
     - Receives JSON data.
     - Marshals into `ProjectData` struct.
     - Writes to `data/project_<id>.json`.

---

## 4. Refactoring Plan

Based on the analysis, the following refactoring steps are proposed to improve code quality and maintainability.

### Phase 1: Separation of Concerns (DesignCanvas)
The `DesignCanvas.jsx` component currently handles:
1. Event listening & dispatching.
2. State management (`localAsset` syncing).
3. Rendering logic (SVG generation).

**Goal:** Extract event handling into a custom hook.
- **Create:** `src/hooks/useCanvasInteraction.js`
- **Move:** `handleDown`, `handleMove`, `handleUp`, `dragRef` logic.
- **Benefit:** `DesignCanvas.jsx` becomes a cleaner view component.

### Phase 2: Logic Consolidation
- **Problem:** "Entities" vs "Shapes" terminology is mixed.
- **Action:** Standardize on `Entity` / `entities` everywhere in the frontend.
- **Action:** Move geometry helpers (e.g., `calculateAssetBounds`, `getRotatedAABB`) to a dedicated `geometryService.js` domain file, removing them from generic `utils.js`.

### Phase 3: Type Definitions (JSDoc)
- Add comprehensive JSDoc types for `Entity`, `Asset`, and `DragState` to help IDEs and contributors understand the data structures.

### Phase 4: Testing
- Add unit tests for `DesignCanvas.logic.js` (now `geometryService.js`) to verify math calculations (rotation, resizing) without needing a browser environment.

