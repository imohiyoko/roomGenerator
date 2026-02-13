# File Structure

The application stores all user data in a local `data/` directory relative to the executable. All files are in JSON format.

## Global Configuration

### `data/global_assets.json`
Stores the library of shared assets that can be reused across projects.

**Structure:**
- Array of Asset Objects:
  - `id`: Unique identifier (string).
  - `name`: Display name.
  - `type`: Category (`room`, `furniture`, `fixture`).
  - `w`, `h`: Dimensions (integers).
  - `color`: Primary color (hex string).
  - `snap`: Snap-to-grid behavior (boolean).
  - `isDefaultShape`: Flag indicating if the asset uses the default color scheme.
  - `shapes`: Array of geometric shapes (polygons) that make up the asset.

### `data/palette.json`
Stores the global color palette and default color settings.

**Structure:**
- `colors`: Array of hex color strings (user-defined palette).
- `defaults`: Map of asset types to default hex colors.
  - keys: `room`, `furniture`, `fixture`.
  - values: hex color strings (e.g., `#fdfcdc`).

## Projects

### `data/projects_index.json`
Stores the metadata for all created projects.

**Structure:**
- Array of Project Objects:
  - `id`: Unique project ID (timestamp-based string).
  - `name`: Project name.
  - `updatedAt`: Last modification timestamp (RFC3339 string).

### `data/project_<id>.json`
Stores the content of a specific project.

**Structure:**
- `assets` (`localAssets`): Array of asset definitions specific to this project.
  - Similar structure to `global_assets.json`.
  - These assets are "forked" from the global library or created locally.
- `instances`: Array of placed items on the layout canvas.
  - `id`: Unique instance ID (string).
  - `assetId`: ID of the referenced asset in `localAssets`.
  - `x`, `y`: Position coordinates (relative to canvas origin).
  - `rotation`: Rotation in degrees.
  - `locked`: Locked state (boolean).
  - `type`: Asset type (for quick lookup).
