# Contributing to Room Generator

Thank you for your interest in contributing! This guide will help you set up your development environment and understand the workflow.

## 1. Prerequisites

Before you begin, ensure you have the following installed:

*   **Go** (v1.21 or later) - [Download](https://go.dev/dl/)
*   **Node.js** (v18 or later) - [Download](https://nodejs.org/)
*   **Wails** - The framework used for this app.
    ```bash
    go install github.com/wailsapp/wails/v2/cmd/wails@latest
    ```

## 2. Development Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd roomGenerator
    ```

2.  **Install Frontend Dependencies:**
    ```bash
    cd frontend
    npm install
    cd ..
    ```

3.  **Run Development Server:**
    This command builds the backend and starts the frontend dev server with hot reload.
    ```bash
    wails dev
    ```
    The application window should open automatically.

## 3. Project Architecture

Please refer to **[docs/SYSTEM_MAP.md](docs/SYSTEM_MAP.md)** for a comprehensive map of the system, including backend API, data models, frontend routing, and key workflows.

*   **Backend**: `app.go` (API), `models.go` (Data Structures), `defaults.go` (Initial Data).
*   **Frontend**: `src/store/` (State), `src/domain/` (Business Logic), `src/components/` (UI).

## 4. Code Style & Patterns

### State Management
We use **Zustand** for global state.
*   State slices are located in `frontend/src/store/`.
*   Complex logic (e.g., project loading, data normalization) should be extracted to **Domain Services** in `frontend/src/domain/` (e.g., `projectService.js`), keeping the store clean.

### React Components
*   **Functional Components**: Use standard functional components.
*   **Custom Hooks**: Extract complex logic (e.g., keyboard handling, auto-save, event listeners) into custom hooks in `frontend/src/hooks/`.
*   **Selectors**: Use granular Zustand selectors to minimize re-renders.
    ```javascript
    // Good
    const mode = useStore(state => state.mode);

    // Avoid (causes re-renders on any store change)
    const { mode } = useStore(state => state);
    ```

### Backend (Go)
*   The main API logic resides in `app.go`.
*   Data structures are defined in `models.go`.
*   Default asset generation logic is in `defaults.go`.
*   If you modify `app.go` or other Go files, `wails dev` will automatically rebuild the application.
*   New public methods on the `App` struct are automatically exposed to the frontend runtime.

## 5. Adding a New Feature

1.  **Backend**: If data persistence is needed, add a method to `App` struct in `app.go`.
2.  **Frontend API**: Update `frontend/src/lib/api.js` to wrap the new Wails method.
3.  **Store**: Add necessary state and actions to the appropriate slice in `frontend/src/store/`.
4.  **UI**: Create components in `frontend/src/components/` and use them in pages.

## 6. Troubleshooting

*   **"wails: command not found"**: Ensure your Go bin directory is in your PATH.
*   **Frontend changes not showing**: `wails dev` usually handles HMR, but if you change `wails.json` or build configurations, restart the command.
