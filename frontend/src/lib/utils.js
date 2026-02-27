import { BASE_SCALE } from './constants.js';
import {
    toMM, fromMM,
    toSvgY, toCartesianY,
    toSvgRotation, toCartesianRotation,
    toSvgAngle, toCartesianAngle,
    createRectPath, createTrianglePath,
    generateSvgPath, generateEllipsePath,
    getRotatedAABB, calculateAssetBounds,
    rotatePoint
} from '../domain/geometry.js';

// Re-export geometry functions for backward compatibility
export {
    toMM, fromMM,
    toSvgY, toCartesianY,
    toSvgRotation, toCartesianRotation,
    toSvgAngle, toCartesianAngle,
    createRectPath, createTrianglePath,
    generateSvgPath, generateEllipsePath,
    getRotatedAABB, calculateAssetBounds,
    rotatePoint
};

export const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    return JSON.parse(JSON.stringify(obj));
};

export const normalizeAsset = (asset) => {
    if (!asset) return null;
    let entities = asset.entities || asset.shapes || []; // Fallback to shapes for migration
    if (entities.length === 0) {
        if (asset.shape === 'rect' || !asset.shape) {
            entities.push({ type: 'polygon', points: createRectPath(asset.w || 60, asset.h || 60), color: asset.color, layer: 'default' });
        } else if (asset.shape === 'polygon' && asset.points) {
            const pts = asset.points.map(p => ({ x: p.x, y: p.y, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false }));
            entities.push({ type: 'polygon', points: pts, color: asset.color, layer: 'default' });
        } else if (asset.shape === 'circle') {
            entities.push({ type: 'circle', x: 0, y: 0, w: asset.w || 60, h: asset.h || 60, color: asset.color, layer: 'default' });
        }
    }
    // Remove old 'shapes' if moving to entities, but for now just ensure entities is populated
    // We return 'entities' property.
    return { ...asset, entities, shapes: undefined, w: asset.w || 60, h: asset.h || 60 };
};

export const getClientPos = (e, viewState, svgRect) => {
    const cx = e.clientX - svgRect.left;
    const cy = e.clientY - svgRect.top;
    const x = (cx - viewState.x) / viewState.scale / BASE_SCALE;
    const ySvg = (cy - viewState.y) / viewState.scale / BASE_SCALE;
    // Convert SVG Y to Cartesian Y
    const y = toCartesianY(ySvg);
    return { x, y };
};
