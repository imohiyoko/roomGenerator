import { BASE_SCALE } from './constants.js';
import {
    toSvgY, toCartesianY, toSvgRotation, toCartesianRotation,
    toSvgAngle, toCartesianAngle, rotatePoint,
    getRotatedAABB, calculateAssetBounds
} from '../domain/geometry.js';

// Re-export geometry functions for backward compatibility
export {
    toSvgY, toCartesianY, toSvgRotation, toCartesianRotation,
    toSvgAngle, toCartesianAngle,
    rotatePoint,
    getRotatedAABB, calculateAssetBounds
};

export const toMM = (val) => Math.round(val * 10);
export const fromMM = (val) => val / 10;

export const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    return JSON.parse(JSON.stringify(obj));
};

export const createRectPath = (w, h, x = 0, y = 0) => [
    { x: x, y: y, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },
    { x: x + w, y: y, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },
    { x: x + w, y: y + h, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },
    { x: x, y: y + h, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },
];

export const createTrianglePath = (w, h, x = 0, y = 0) => [
    { x: x + w / 2, y: y + h, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false }, // Top vertex
    { x: x + w, y: y, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },     // Bottom Right
    { x: x, y: y, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },         // Bottom Left
];

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

// SVG Path Generation with Cartesian -> SVG Coordinate Conversion
// Handles flipping Y axis
export const generateSvgPath = (points) => {
    if (!points || points.length === 0) return "";

    const tx = (x) => x * BASE_SCALE;
    const ty = (y) => toSvgY(y) * BASE_SCALE;

    let d = `M ${tx(points[0].x)} ${ty(points[0].y)}`;
    for (let i = 0; i < points.length; i++) {
        const curr = points[i];
        const next = points[(i + 1) % points.length];
        const handles = curr.handles || [];

        if (handles.length === 0) {
            if (curr.isCurve || next.isCurve) {
                // Legacy curve support
                const cp1x = tx(curr.x + (curr.h2?.x || 0));
                const cp1y = ty(curr.y + (curr.h2?.y || 0));
                const cp2x = tx(next.x + (next.h1?.x || 0));
                const cp2y = ty(next.y + (next.h1?.y || 0));
                d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${tx(next.x)} ${ty(next.y)}`;
            } else {
                d += ` L ${tx(next.x)} ${ty(next.y)}`;
            }
        } else if (handles.length === 1) {
            const h = handles[0];
            d += ` Q ${tx(h.x)} ${ty(h.y)}, ${tx(next.x)} ${ty(next.y)}`;
        } else if (handles.length === 2) {
            const h1 = handles[0];
            const h2 = handles[1];
            d += ` C ${tx(h1.x)} ${ty(h1.y)}, ${tx(h2.x)} ${ty(h2.y)}, ${tx(next.x)} ${ty(next.y)}`;
        } else {
            const step = 1 / handles.length;
            let lastX = curr.x, lastY = curr.y;
            for (let j = 0; j < handles.length; j++) {
                const h = handles[j];
                const t = (j + 1) * step;
                const endX = curr.x + (next.x - curr.x) * t;
                const endY = curr.y + (next.y - curr.y) * t;
                d += ` Q ${tx(h.x)} ${ty(h.y)}, ${tx(endX)} ${ty(endY)}`;
                lastX = endX; lastY = endY;
            }
            if (Math.abs(lastX - next.x) > 0.01 || Math.abs(lastY - next.y) > 0.01) {
                d += ` L ${tx(next.x)} ${ty(next.y)}`;
            }
        }
    }
    d += " Z";
    return d;
};

// Generate Ellipse/Arc Path with Cartesian -> SVG Conversion
export const generateEllipsePath = (shape) => {
    // Cartesian inputs
    const { cx = 0, cy = 0, rx = 50, ry = 50, startAngle = 0, endAngle = 360, arcMode = 'sector', rotation = 0 } = shape;

    // Convert to SVG coordinates
    const cxs = cx * BASE_SCALE;
    const cys = toSvgY(cy) * BASE_SCALE;
    const rxs = rx * BASE_SCALE;
    const rys = ry * BASE_SCALE;

    // Start/End angles in Cartesian (CCW from East)
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    // Calculate points in SVG Space directly
    // P_svg = (cx, -cy) + (rx * cos(-theta), ry * sin(-theta))
    // y_svg = -y_cart = - (cy + ry * sin(theta)) = -cy - ry * sin(theta).

    const svgStartAngle = -startAngle;
    const svgEndAngle = -endAngle;

    const startRadSvg = (svgStartAngle * Math.PI) / 180;
    const endRadSvg = (svgEndAngle * Math.PI) / 180;

    const x1 = cxs + rxs * Math.cos(startRadSvg);
    const y1 = cys + rys * Math.sin(startRadSvg);
    const x2 = cxs + rxs * Math.cos(endRadSvg);
    const y2 = cys + rys * Math.sin(endRadSvg);

    // Full ellipse check
    const angleDiff = Math.abs(endAngle - startAngle); // Absolute difference in degrees
    if (angleDiff >= 360) {
        return `M ${cxs - rxs} ${cys} A ${rxs} ${rys} 0 1 1 ${cxs + rxs} ${cys} A ${rxs} ${rys} 0 1 1 ${cxs - rxs} ${cys}`;
    }

    // Large arc flag
    const largeArc = angleDiff > 180 ? 1 : 0;
    const sweepFlag = 0; // CCW for Cartesian positive angle direction

    if (arcMode === 'sector') {
        return `M ${cxs} ${cys} L ${x1} ${y1} A ${rxs} ${rys} 0 ${largeArc} ${sweepFlag} ${x2} ${y2} Z`;
    } else {
        return `M ${x1} ${y1} A ${rxs} ${rys} 0 ${largeArc} ${sweepFlag} ${x2} ${y2} Z`;
    }
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
