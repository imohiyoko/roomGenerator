# Client-Side Routing

The application uses **React Router (HashRouter)** for navigation. This replaces the previous state-based view switching mechanism.

## Routes

| Path | Component | Description |
| :--- | :--- | :--- |
| `/` | `pages/Home.jsx` | The landing page. Displays a list of existing projects and allows creating new ones. |
| `/library` | `pages/Library.jsx` | The global asset library manager. Allows editing shared assets and the color palette. |
| `/project/:id` | `pages/Editor.jsx` | The main editor interface for a specific project. |

## Navigation Flow

1. **Startup**: The app loads at `/`. `App.jsx` initializes global data (projects list, global assets).
2. **Open Project**: Clicking a project card navigates to `/project/<projectId>`.
   - The `Editor` component reads the ID from the URL parameters (`useParams`).
   - It triggers `loadProject(id)` action to fetch specific project data.
3. **Library**: Clicking "Library" navigates to `/library`.
4. **Back**: Both Library and Editor pages have a "Back" button that navigates to `/`.

## Design Decisions

- **HashRouter**: Used instead of `BrowserRouter` because the application runs in a Wails environment (serving local files), where standard history API routing might conflict with the file system protocol or require server-side configuration.
- **URL as Source of Truth**: The current project ID is derived from the URL, ensuring that the UI state is always in sync with the navigation.
