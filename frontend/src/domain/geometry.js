// Pure geometry functions for the Room Generator

// Coordinate System Conversion (Cartesian Y-Up <-> SVG Y-Down)
// SVG Origin is Top-Left (Y increases Down). Cartesian Origin is Bottom-Left (Y increases Up).
export const toSvgY = (y) => -y;
export const toCartesianY = (y) => -y;
export const toSvgRotation = (deg) => -deg;
export const toCartesianRotation = (deg) => -deg;
export const toSvgAngle = (deg) => -deg;
export const toCartesianAngle = (deg) => -deg;

/**
 * Rotates a point around a center.
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} angle - Rotation angle in degrees
 * @returns {{x: number, y: number}} Rotated point
 */
export const rotatePoint = (px, py, cx, cy, angle) => {
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

/**
 * Snaps a value to the nearest grid unit.
 * @param {number} value - The value to snap
 * @param {number} snapUnit - The grid unit size
 * @returns {number} Snapped value
 */
export const snapValue = (value, snapUnit = 10) => {
    return Math.round(value / snapUnit) * snapUnit;
};

/**
 * Calculates the Axis-Aligned Bounding Box (AABB) of a rotated shape.
 * @param {Object} shape - The entity/shape object
 * @returns {Object|null} { minX, minY, maxX, maxY } or null
 */
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
            allExtrema.forEach(t => { pointsToCheck.push(getPoint(t)); });
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

/**
 * Calculates the bounding box of a collection of entities.
 * @param {Array} entities - List of entities
 * @returns {Object|null} Bound object { boundX, boundY, w, h }
 */
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
