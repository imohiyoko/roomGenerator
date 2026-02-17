# Contributing Guide

Welcome to the `roomGenerator` project! This document guides you through the project structure and how to contribute effectively.

## Project Structure

```
roomGenerator/
├── app.go              # Backend logic (Wails App struct)
├── main.go             # Entry point
├── models.go           # Go data structures (Project, Asset, Entity)
├── frontend/           # React Application
│   ├── src/
│   │   ├── components/ # Reusable UI components (Canvas, Sidebar)
│   │   ├── domain/     # Business logic (AssetService, etc.)
│   │   ├── hooks/      # Custom React hooks (useAutoSave)
│   │   ├── pages/      # Route pages (Home, Editor, Library)
│   │   ├── store/      # Zustand state management
│   │   └── lib/        # Utilities (math, constants)
│   └── wailsjs/        # Generated Wails bindings
└── data/               # Local data storage (JSON files) - *Ignored in Git*
```

## Development Workflow

1.  **Prerequisites:**
    - Go (1.18+)
    - Node.js (16+)
    - Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

2.  **Setup:**
    ```bash
    wails dev
    ```
    This command starts both the Go backend and the Vite frontend dev server.

3.  **Architecture:**
    Please refer to [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed overview of the system design.
    For a comprehensive map of functions, components, and URLs, see [SYSTEM_MAP.md](./SYSTEM_MAP.md).

## Key Concepts

- **Assets vs Instances:**
    - An **Asset** is a definition (e.g., a "Chair" with a specific shape and size).
    - An **Instance** is a placement of that Asset on the Layout Canvas (at specific X, Y coordinates).

- **Coordinate System:**
    - **Backend/Store:** Cartesian (Y-Up). `(0,0)` is bottom-left.
    - **SVG Rendering:** Screen Coordinates (Y-Down). `(0,0)` is top-left.
    - Utilities in `frontend/src/lib/utils.js` handle the conversion (e.g., `toSvgY`).

## Refactoring Guidelines

- **State Access:** Components should generally access the store directly using `useStore` hooks rather than relying on deep prop drilling.
- **Logic Separation:** Complex logic (math, geometry) should be placed in `src/lib/utils.js` or `src/domain/`.

## Submitting Changes

1.  Ensure your code builds (`npm run build` in `frontend/`).
2.  Follow the existing code style (Prettier/ESLint).
3.  Update documentation if you change architectural components.
