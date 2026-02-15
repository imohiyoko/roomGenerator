# Fix AABB Synchronization in Design Mode

## Status
Proposed

## Context
A bug was reported where the Axis-Aligned Bounding Box (AABB) in Design Mode does not update correctly when:
1. Moving or resizing multiple selected entities (nodes).
2. Deleting an entity.

The AABB is critical for visualizing the asset's overall dimensions and coordinate origin. The current implementation relies on `handleUp` (pointer release) to recalculate bounds, but it appears to be using stale state or is missing the recalculation logic entirely (in the case of deletion).

## Decision
We will synchronize the AABB update at the **end of the interaction** (Drag End, Delete) rather than in real-time during the drag. This approach (Case A) was chosen to minimize performance overhead, especially when handling complex assets with many entities.

### Specific Changes
1.  **Deletion**: Modify `handleDeleteShape` to explicitly call `calculateAssetBounds` with the remaining entities and update the asset's bounds (`w`, `h`, `boundX`, `boundY`) before committing the change to the store.
2.  **Interaction (Drag/Resize)**: Modify the `DesignCanvas` component to track the latest entities state synchronously using a React `ref`. This ensures that `handleUp` always calculates bounds based on the most recent positions, eliminating issues caused by React's asynchronous state updates and render cycles.

## Consequences
- **Positive**: The visual bounding box will accurately reflect the asset's content after any modification.
- **Positive**: Performance impact is negligible as calculation only happens once per interaction.
- **Negative**: The bounding box will not visually follow the shapes *during* the drag (it will snap to the new position on release), but this is an accepted trade-off.
