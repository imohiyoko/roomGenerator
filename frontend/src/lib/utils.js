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
    const rxs = Math.abs(rx * BASE_SCALE); // Absolute radius to prevent SVG errors
    const rys = Math.abs(ry * BASE_SCALE);

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



export const calculateAssetBounds = (asset) => {
    if (!asset || !asset.entities || asset.entities.length === 0) {
        return { boundX: 0, boundY: 0, w: asset.w || 0, h: asset.h || 0 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    asset.entities.forEach(entity => {
        const bounds = getRotatedAABB(entity);
        if (bounds.minX < minX) minX = bounds.minX;
        if (bounds.maxX > maxX) maxX = bounds.maxX;
        if (bounds.minY < minY) minY = bounds.minY;
        if (bounds.maxY > maxY) maxY = bounds.maxY;
    });

    if (minX === Infinity) return { boundX: 0, boundY: 0, w: asset.w, h: asset.h };
    return {
        boundX: Math.round(minX),
        boundY: Math.round(minY),
        w: Math.round(maxX - minX),
        h: Math.round(maxY - minY)
    };
};

// Override getRotatedAABB with Arc/Sector support
export const getRotatedAABB = (entity) => {
    const rotation = entity.rotation || 0;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Determine Center (Pivot)
    let cx, cy;
    if (entity.type === 'ellipse' || entity.type === 'circle' || entity.type === 'arc') {
        cx = entity.cx !== undefined ? entity.cx : ((entity.x || 0) + (entity.w || 0) / 2);
        cy = entity.cy !== undefined ? entity.cy : ((entity.y || 0) + (entity.h || 0) / 2);
    } else {
        cx = (entity.x || 0) + (entity.w || 0) / 2;
        cy = (entity.y || 0) + (entity.h || 0) / 2;
    }

    // Case 1: Ellipse / Circle / Arc / Sector
    if (entity.type === 'ellipse' || entity.type === 'circle' || entity.type === 'arc') {
        const rx = Math.abs(entity.rx !== undefined ? entity.rx : (entity.w / 2));
        const ry = Math.abs(entity.ry !== undefined ? entity.ry : (entity.h / 2));

        // Full Ellipse logic if no start/end angle or full circle
        const startAngle = entity.startAngle !== undefined ? entity.startAngle : 0;
        const endAngle = entity.endAngle !== undefined ? entity.endAngle : 360;
        const arcMode = entity.arcMode || 'sector';

        // Normalize angles to [0, 360) for checking
        let sDeg = startAngle % 360;
        if (sDeg < 0) sDeg += 360;
        let eDeg = endAngle % 360;
        if (eDeg < 0) eDeg += 360;

        if (Math.abs(endAngle - startAngle) >= 360) {
            // Full Ellipse Formula
            const halfW = Math.sqrt(Math.pow(rx * cos, 2) + Math.pow(ry * sin, 2));
            const halfH = Math.sqrt(Math.pow(rx * sin, 2) + Math.pow(ry * cos, 2));
            return {
                minX: cx - halfW, maxX: cx + halfW,
                minY: cy - halfH, maxY: cy + halfH,
                width: halfW * 2, height: halfH * 2
            };
        }

        // Partial Ellipse (Arc/Sector) Logic
        // We need to find extrema of x(t) and y(t) within [startRad, endRad].
        // x(t) = cx + rx cos(t) cos(rot) - ry sin(t) sin(rot)
        // y(t) = cy + rx cos(t) sin(rot) + ry sin(t) cos(rot)

        // Convert input angles to radians
        const sRad = (startAngle * Math.PI) / 180;
        const eRad = (endAngle * Math.PI) / 180;

        // Points to check: Start, End, Center (if sector), and local extrema.
        let points = [];

        // Start & End points
        const getPoint = (theta) => ({
            x: cx + rx * Math.cos(theta) * cos - ry * Math.sin(theta) * sin,
            y: cy + rx * Math.cos(theta) * sin + ry * Math.sin(theta) * cos
        });

        points.push(getPoint(sRad));
        points.push(getPoint(eRad));

        if (arcMode === 'sector') {
            points.push({ x: cx, y: cy });
        }

        // Find extrema parameter 't' in [0, 2PI)
        // Helper to check if angle 't' (radians) is effectively within [startAngle, endAngle] (degrees)
        // We normalize 't' to degrees [0, 360) and check against sDeg, eDeg.
        const inRange = (tRad) => {
            let tDeg = (tRad * 180 / Math.PI) % 360;
            if (tDeg < 0) tDeg += 360;

            // Check direction: start -> end (CCW)
            // If s < e: s <= t <= e
            // If s > e: s <= t or t <= e (wrapping)
            if (sDeg < eDeg) {
                return tDeg >= sDeg && tDeg <= eDeg;
            } else {
                return tDeg >= sDeg || tDeg <= eDeg;
            }
        };

        // Extrema for X
        // tan(t) = - (ry sin(rot)) / (rx cos(rot))
        const tanTx = - (ry * sin) / (rx * cos);
        const tx1 = Math.atan(tanTx);
        const tx2 = tx1 + Math.PI;

        if (inRange(tx1)) points.push(getPoint(tx1));
        if (inRange(tx2)) points.push(getPoint(tx2));

        // Extrema for Y
        // tan(t) = (ry cos(rot)) / (rx sin(rot))
        const tanTy = (ry * cos) / (rx * sin);
        const ty1 = Math.atan(tanTy);
        const ty2 = ty1 + Math.PI;

        if (inRange(ty1)) points.push(getPoint(ty1));
        if (inRange(ty2)) points.push(getPoint(ty2));

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        const minX = Math.min(...xs); const maxX = Math.max(...xs);
        const minY = Math.min(...ys); const maxY = Math.max(...ys);

        return {
            minX, maxX, minY, maxY,
            width: maxX - minX, height: maxY - minY
        };
    }

    // Case 2: Polygon / Rect (Vertex Rotation)
    let points = [];
    if (entity.type === 'polygon' && entity.points) {
        points = entity.points;
    } else {
        // Create 4 corner points for Rect
        const x = entity.x || 0; const y = entity.y || 0;
        const w = entity.w || 0; const h = entity.h || 0;
        points = [{x, y}, {x: x+w, y}, {x: x+w, y: y+h}, {x, y: y+h}];
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
        // Rotate point around cx, cy (Cartesian CCW)
        const dx = p.x - cx;
        const dy = p.y - cy;
        const rx = dx * cos - dy * sin + cx;
        const ry = dx * sin + dy * cos + cy;
        if (rx < minX) minX = rx; if (rx > maxX) maxX = rx;
        if (ry < minY) minY = ry; if (ry > maxY) maxY = ry;
    });

    return {
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX,
        height: maxY - minY
    };
};
