import { BASE_SCALE } from './constants.js';

export const toMM = (val) => Math.round(val * 10);
export const fromMM = (val) => val / 10;

// Coordinate System Conversion (Cartesian Y-Up <-> SVG Y-Down)
// SVG Origin is Top-Left (Y increases Down). Cartesian Origin is Bottom-Left (Y increases Up).
// For rendering, we map Cartesian Y to SVG Y by flipping the sign.
// Note: This assumes a relative transformation or centering is applied elsewhere (e.g. viewState translation).
export const toSvgY = (y) => -y;
export const toCartesianY = (y) => -y;
export const toSvgRotation = (deg) => -deg;
export const toCartesianRotation = (deg) => -deg;
export const toSvgAngle = (deg) => -deg;
export const toCartesianAngle = (deg) => -deg;

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

    // Angles: In Cartesian, angle increases CCW. In SVG (with Y-down), angle increases CW.
    // To match visual appearance: angle_svg = -angle_cartesian.
    // However, we also need to account for the fact that 0 degrees is East in both.
    // Let's use standard math with flipped Y.
    // x = cx + rx * cos(theta)
    // y_cart = cy + ry * sin(theta)
    // y_svg = -y_cart = -cy - ry * sin(theta) = cys - rys * sin(theta)
    // In SVG path 'A' command, the coordinate system is local.
    // Ideally we just calculate start/end points in SVG space.

    // Start/End angles in Cartesian (CCW from East)
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    // Calculate start/end points in Cartesian, then convert to SVG
    // x = cx + rx * cos(theta) (rotated by rotation)
    // y = cy + ry * sin(theta) (rotated by rotation)

    // Simplified approach: Calculate points in local unrotated space, then rotate, then translate, then flip Y.
    // But SVG path 'A' command handles rotation.
    // The rotation parameter in 'A' command is X-axis rotation.
    // If we flip Y, the rotation direction effectively flips.
    // SVG Rotation is CW. Cartesian Rotation is CCW.
    // So svg_rotation = -cartesian_rotation.

    // Calculate points in SVG Space directly
    // P_svg = (cx, -cy) + (rx * cos(-theta), ry * sin(-theta))  <-- Wait, ry is radius, always positive.
    // y_svg = -y_cart = - (cy + ry * sin(theta)) = -cy - ry * sin(theta).
    // This is equivalent to Center(cx, -cy) + Radius(rx, ry) at Angle(-theta).
    // So we use -startAngle and -endAngle.

    const svgStartAngle = -startAngle;
    const svgEndAngle = -endAngle;

    // Normalize angles for arc calculation
    // Note: SVG arcs go from start to end.
    // If we go from -0 to -360 (CW), that's the same as 0 to 360 (CW in SVG).
    // Cartesian 0 -> 90 (CCW) becomes SVG 0 -> -90 (CCW visually, or 360->270).

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
    // In SVG, large-arc-flag is 1 if angle > 180.
    const largeArc = angleDiff > 180 ? 1 : 0;

    // Sweep flag
    // Cartesian: Start -> End is CCW.
    // SVG Angles: -Start -> -End.
    // Example: Start=0, End=90. SVG: 0 -> -90. Delta = -90.
    // This is a "negative" sweep in standard math, but SVG sweep-flag=0 is CCW (negative angle direction), sweep-flag=1 is CW.
    // Wait: SVG 'A' command: sweep-flag=1 means "positive-angle direction" (Clockwise in SVG Y-down).
    // We want to draw from Start(0) to End(90 Cartesian).
    // In SVG coords: (r, 0) to (0, -r).
    // To go from (r,0) to (0,-r) via the "top-right" quadrant, we are moving CCW in screen space.
    // In SVG (Y-down), moving (1,0) -> (0,-1) is...
    // (1,0) is Right. (0,-1) is Up.
    // Right -> Up is CCW (Counter-Clockwise).
    // In SVG standard, angles increase CW (Right -> Down).
    // So we are moving in the *negative* angle direction.
    // So sweep-flag should be 0.

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

// Helper to rotate a point (px, py) around (cx, cy) by angle (degrees)
const rotatePoint = (px, py, cx, cy, angle) => {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = px - cx;
    const dy = py - cy;
    return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos
    };
};

export const getRotatedAABB = (shape) => {
    if (!shape) return null;

    // Handle Ellipse / Circle / Arc / Sector
    if (shape.type === 'ellipse' || shape.type === 'circle' || shape.type === 'arc') {
        const cx = shape.cx !== undefined ? shape.cx : (shape.x + shape.w / 2);
        const cy = shape.cy !== undefined ? shape.cy : (shape.y + shape.h / 2);
        const rx = shape.rx !== undefined ? shape.rx : (shape.w / 2);
        const ry = shape.ry !== undefined ? shape.ry : (shape.h / 2);
        const rotation = shape.rotation || 0;
        const startAngle = shape.startAngle !== undefined ? shape.startAngle : 0;
        const endAngle = shape.endAngle !== undefined ? shape.endAngle : 360;
        const isSector = shape.arcMode === 'sector' || (shape.type === 'circle' && shape.arcMode !== 'chord');

        const rotRad = (rotation * Math.PI) / 180;
        const cosRot = Math.cos(rotRad);
        const sinRot = Math.sin(rotRad);

        const getPoint = (tDeg) => {
            const tRad = (tDeg * Math.PI) / 180;
            const x0 = rx * Math.cos(tRad);
            const y0 = ry * Math.sin(tRad);
            const xRot = x0 * cosRot - y0 * sinRot;
            const yRot = x0 * sinRot + y0 * cosRot;
            return { x: cx + xRot, y: cy + yRot };
        };

        let pointsToCheck = [];

        pointsToCheck.push(getPoint(startAngle));
        pointsToCheck.push(getPoint(endAngle));

        if (isSector) {
             pointsToCheck.push({ x: cx, y: cy });
        }

        const calcExtremaAngles = (isX) => {
            let t = [];
            if (isX) {
                if (Math.abs(cosRot) < 1e-9) {
                     t.push(90, 270);
                } else {
                    const val = -(ry * sinRot) / (rx * cosRot);
                    const angle1 = Math.atan(val) * 180 / Math.PI;
                    t.push(angle1, angle1 + 180);
                }
            } else {
                if (Math.abs(sinRot) < 1e-9) {
                    t.push(90, 270);
                } else {
                    const val = (ry * cosRot) / (rx * sinRot);
                    const angle1 = Math.atan(val) * 180 / Math.PI;
                    t.push(angle1, angle1 + 180);
                }
            }
            return t.map(a => (a + 360) % 360);
        };

        const xExtrema = calcExtremaAngles(true);
        const yExtrema = calcExtremaAngles(false);
        const allExtrema = [...xExtrema, ...yExtrema];

        let start = startAngle;
        let end = endAngle;

        const isAngleInArc = (angle) => {
             const a = (angle % 360 + 360) % 360;
             const s = (start % 360 + 360) % 360;
             const e = (end % 360 + 360) % 360;
             if (s <= e) {
                 return a >= s && a <= e;
             } else {
                 return a >= s || a <= e;
             }
        };

        const sweep = Math.abs(end - start);
        if (sweep >= 360) {
            allExtrema.forEach(t => pointsToCheck.push(getPoint(t)));
        } else {
            allExtrema.forEach(t => {
                if (isAngleInArc(t)) {
                    pointsToCheck.push(getPoint(t));
                }
            });
        }

        if (pointsToCheck.length === 0) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        pointsToCheck.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });

        return { minX, minY, maxX, maxY };
    }

    if (shape.points && shape.points.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        shape.points.forEach(p => {
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        });
        const cx = minX + (maxX - minX) / 2;
        const cy = minY + (maxY - minY) / 2;

        const rotation = shape.rotation || 0;

        let rPoints = [];
        if (rotation === 0) {
            rPoints = shape.points;
        } else {
            rPoints = shape.points.map(p => rotatePoint(p.x, p.y, cx, cy, rotation));
        }

        let rMinX = Infinity, rMinY = Infinity, rMaxX = -Infinity, rMaxY = -Infinity;
        rPoints.forEach(p => {
            if (p.x < rMinX) rMinX = p.x; if (p.x > rMaxX) rMaxX = p.x;
            if (p.y < rMinY) rMinY = p.y; if (p.y > rMaxY) rMaxY = p.y;
        });
        return { minX: rMinX, minY: rMinY, maxX: rMaxX, maxY: rMaxY };
    }

    if (shape.x !== undefined && shape.w !== undefined) {
        const cx = shape.x + shape.w / 2;
        const cy = shape.y + shape.h / 2;
        const rotation = shape.rotation || 0;
        const pts = [
            { x: shape.x, y: shape.y },
            { x: shape.x + shape.w, y: shape.y },
            { x: shape.x + shape.w, y: shape.y + shape.h },
            { x: shape.x, y: shape.y + shape.h }
        ];
        const rPoints = pts.map(p => rotatePoint(p.x, p.y, cx, cy, rotation));
        let rMinX = Infinity, rMinY = Infinity, rMaxX = -Infinity, rMaxY = -Infinity;
        rPoints.forEach(p => {
            if (p.x < rMinX) rMinX = p.x; if (p.x > rMaxX) rMaxX = p.x;
            if (p.y < rMinY) rMinY = p.y; if (p.y > rMaxY) rMaxY = p.y;
        });
        return { minX: rMinX, minY: rMinY, maxX: rMaxX, maxY: rMaxY };
    }

    return null;
};

export const calculateAssetBounds = (entities) => {
    if (!entities || entities.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasValid = false;

    entities.forEach(s => {
        const box = getRotatedAABB(s);
        if (box) {
            hasValid = true;
            if (box.minX < minX) minX = box.minX;
            if (box.maxX > maxX) maxX = box.maxX;
            if (box.minY < minY) minY = box.minY;
            if (box.maxY > maxY) maxY = box.maxY;
        }
    });

    if (hasValid && minX !== Infinity) {
        return {
            boundX: Math.round(minX),
            boundY: Math.round(minY),
            w: Math.round(maxX - minX),
            h: Math.round(maxY - minY)
        };
    }
    return null;
};
