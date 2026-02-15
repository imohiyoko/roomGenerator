# Refactor AABB Calculation Logic

## Status
Proposed

## Context
AABB synchronization is inconsistent. While `DesignCanvas.jsx` now correctly recalculates bounds after drag/delete, `DesignProperties.jsx` modifies entities in multiple places (add, delete, update props) without recalculating the asset's overall bounds. This leads to discrepancies where the visual AABB lags behind the actual entity data.

The current implementation has `calculateAssetBounds` called sporadically.

## Decision
We will centralize the asset update logic. Instead of manually updating `entities` and then remembering to call `calculateAssetBounds` in every component, we will create a dedicated helper function (or store action) that handles both.

### Refactoring Plan
1.  **Create `updateAssetEntities` Helper**:
    - Location: `frontend/src/domain/assetService.js` (or similar).
    - Functionality: Accepts the current asset and the new list of entities.
    - Logic:
        1. Updates `entities`.
        2. Recalculates `w`, `h`, `boundX`, `boundY` using `calculateAssetBounds`.
        3. Sets `isDefaultShape: false`.
        4. Returns the new asset object.

2.  **Apply Helper in `DesignCanvas.jsx`**:
    - Replace the manual update logic in `handleUp` and `handleDeleteShape` with this helper.

3.  **Apply Helper in `DesignProperties.jsx`**:
    - Replace all `setLocalAssets` calls that modify `entities` (add, delete, update prop) with this helper.
    - This ensures that *every* entity change triggers an AABB update.

## Consequences
- **Positive**: Guaranteed consistency. Any entity change anywhere in the app will update the AABB.
- **Positive**: Reduces code duplication.
- **Negative**: Slight overhead of recalculating bounds on every property change (e.g., typing in a width input), but this is negligible for the expected number of entities.
