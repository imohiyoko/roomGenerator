import { calculateAssetBounds } from '../lib/utils.js';
import { updateAssetEntities } from './assetService.js';

/**
 * Updates root properties of an asset (name, type, color).
 * Handles default color synchronization for default shapes.
 */
export const updateRoot = (asset, key, value, defaultColors = null) => {
    let updates = { [key]: value };

    // Update color for default shapes when type changes
    if (key === 'type' && asset.isDefaultShape && defaultColors && defaultColors[value]) {
        const newColor = defaultColors[value];
        updates.color = newColor;
        updates.entities = (asset.entities || []).map(s => ({ ...s, color: newColor }));
    }

    // Unset default shape flag if color is manually changed
    if (key === 'color') {
        updates.isDefaultShape = false;
    }

    return { ...asset, ...updates };
};

/**
 * Updates a specific property of a single entity.
 */
export const updateEntity = (asset, entityIndex, key, value) => {
    const currentEntities = asset.entities || [];
    if (entityIndex < 0 || entityIndex >= currentEntities.length) return asset;

    const newEntities = currentEntities.map((s, i) =>
        i === entityIndex ? { ...s, [key]: value } : s
    );

    return updateAssetEntities(asset, newEntities);
};

/**
 * Updates a specific vertex or control point of an entity.
 */
export const updatePoint = (asset, entityIndex, pointIndex, key, value) => {
    const currentEntities = asset.entities || [];
    if (entityIndex < 0 || entityIndex >= currentEntities.length) return asset;

    const targetEntity = currentEntities[entityIndex];
    if (!targetEntity.points || pointIndex < 0 || pointIndex >= targetEntity.points.length) return asset;

    const newPts = [...targetEntity.points];
    // Handle nested handle updates if key implies it (logic usually handled in component, but basic key/val here)
    // If updating a handle coordinate (e.g. from UI input), the logic is complex.
    // Ideally this function handles direct point property updates (x, y).

    newPts[pointIndex] = { ...newPts[pointIndex], [key]: value };

    const newEntities = [...currentEntities];
    newEntities[entityIndex] = { ...targetEntity, points: newPts };

    return updateAssetEntities(asset, newEntities);
};

/**
 * Replaces the points array of an entity (e.g. after deletion or complex edit).
 */
export const updateEntityPoints = (asset, entityIndex, newPoints) => {
    const currentEntities = asset.entities || [];
    if (entityIndex < 0 || entityIndex >= currentEntities.length) return asset;

    const newEntities = [...currentEntities];
    newEntities[entityIndex] = { ...newEntities[entityIndex], points: newPoints };

    return updateAssetEntities(asset, newEntities);
};


/**
 * Bulk updates a set of entities using a transformation function.
 */
export const bulkUpdate = (asset, selectedIndices, updater) => {
    const newEntities = (asset.entities || []).map((s, i) => {
        if (selectedIndices.includes(i)) {
            return updater(s);
        }
        return s;
    });
    return updateAssetEntities(asset, newEntities);
};

/**
 * Moves selected entities by dx, dy.
 */
export const bulkMove = (asset, selectedIndices, dx, dy) => {
    return bulkUpdate(asset, selectedIndices, s => {
        let ns = { ...s, x: (s.x || 0) + dx, y: (s.y || 0) + dy };
        if (s.cx !== undefined) ns.cx = (s.cx || 0) + dx;
        if (s.cy !== undefined) ns.cy = (s.cy || 0) + dy;
        if (s.points) ns.points = s.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
        return ns;
    });
};

/**
 * Resizes selected entities relative to the selection group's top-left corner.
 */
export const bulkResize = (asset, selectedIndices, scalePercent) => {
    const scale = scalePercent / 100;
    if (scale <= 0) return asset;

    const entities = asset.entities || [];
    const selectedEntities = entities.filter((_, i) => selectedIndices.includes(i));
    const bounds = calculateAssetBounds(selectedEntities);
    if (!bounds) return asset;

    const groupMinX = bounds.boundX;
    const groupMinY = bounds.boundY;

    return bulkUpdate(asset, selectedIndices, s => {
        let ns = { ...s };

        if (s.points) {
            ns.points = s.points.map(p => ({
                ...p,
                x: Math.round(groupMinX + (p.x - groupMinX) * scale),
                y: Math.round(groupMinY + (p.y - groupMinY) * scale)
            }));
            const xs = ns.points.map(p => p.x);
            const ys = ns.points.map(p => p.y);
            ns.w = Math.max(...xs) - Math.min(...xs);
            ns.h = Math.max(...ys) - Math.min(...ys);
            ns.x = Math.min(...xs);
            ns.y = Math.min(...ys);

        } else if (s.type === 'ellipse' || s.type === 'arc' || s.type === 'circle') {
            const cx = s.cx !== undefined ? s.cx : (s.x + s.w / 2);
            const cy = s.cy !== undefined ? s.cy : (s.y + s.h / 2);
            const rx = s.rx !== undefined ? s.rx : (s.w / 2);
            const ry = s.ry !== undefined ? s.ry : (s.h / 2);

            const newCx = groupMinX + (cx - groupMinX) * scale;
            const newCy = groupMinY + (cy - groupMinY) * scale;
            const newRx = rx * scale;
            const newRy = ry * scale;

            if (s.cx !== undefined) ns.cx = Math.round(newCx);
            if (s.cy !== undefined) ns.cy = Math.round(newCy);
            if (s.rx !== undefined) ns.rx = Math.round(newRx);
            if (s.ry !== undefined) ns.ry = Math.round(newRy);
            ns.x = Math.round(newCx - newRx);
            ns.y = Math.round(newCy - newRy);
            ns.w = Math.round(newRx * 2);
            ns.h = Math.round(newRy * 2);

        } else {
            const x = s.x || 0;
            const y = s.y || 0;
            const newX = groupMinX + (x - groupMinX) * scale;
            const newY = groupMinY + (y - groupMinY) * scale;

            ns.x = Math.round(newX);
            ns.y = Math.round(newY);
            if (s.w) ns.w = Math.round(s.w * scale);
            if (s.h) ns.h = Math.round(s.h * scale);
        }

        return ns;
    });
};

/**
 * Updates color for selected entities.
 */
export const bulkColor = (asset, selectedIndices, color) => {
    return bulkUpdate(asset, selectedIndices, s => ({ ...s, color }));
};

/**
 * Deletes selected entities.
 */
export const bulkDelete = (asset, selectedIndices) => {
    const newEntities = (asset.entities || []).filter((_, i) => !selectedIndices.includes(i));
    return updateAssetEntities(asset, newEntities);
};

/**
 * Normalizes all entities to start at (0,0).
 */
export const normalizePosition = (asset) => {
    const entities = asset.entities || [];
    if (entities.length === 0) return asset;

    const bounds = calculateAssetBounds(entities);
    if (!bounds) return asset;

    const minX = bounds.boundX;
    const minY = bounds.boundY;

    if (minX === 0 && minY === 0) return asset;

    const newEntities = entities.map(s => {
        if (s.points) return { ...s, points: s.points.map(p => ({ ...p, x: p.x - minX, y: p.y - minY })) };
        let ns = { ...s };
        if (ns.x !== undefined) ns.x -= minX;
        if (ns.y !== undefined) ns.y -= minY;
        if (ns.cx !== undefined) ns.cx -= minX;
        if (ns.cy !== undefined) ns.cy -= minY;
        return ns;
    });

    return updateAssetEntities(asset, newEntities);
};

/**
 * Adds a new entity to the asset.
 */
export const addEntity = (asset, entity) => {
    const currentEntities = asset.entities || [];
    return updateAssetEntities(asset, [...currentEntities, entity]);
};

/**
 * Deletes a single entity by index.
 */
export const deleteEntity = (asset, index) => {
    const currentEntities = asset.entities || [];
    const newEntities = currentEntities.filter((_, i) => i !== index);
    return updateAssetEntities(asset, newEntities);
};
