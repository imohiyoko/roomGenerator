import { BASE_SCALE } from './constants';

export const toMM = (val) => Math.round(val * 10);
export const fromMM = (val) => val / 10;

export const createRectPath = (w, h, x = 0, y = 0) => [
    { x: x, y: y, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },
    { x: x + w, y: y, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },
    { x: x + w, y: y + h, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },
    { x: x, y: y + h, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },
];

export const createTrianglePath = (w, h, x = 0, y = 0) => [
    { x: x + w / 2, y: y, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },
    { x: x + w, y: y + h, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },
    { x: x, y: y + h, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },
];

export const normalizeAsset = (asset) => {
    if (!asset) return null;
    let shapes = asset.shapes || [];
    if (shapes.length === 0) {
        if (asset.shape === 'rect' || !asset.shape) {
            shapes.push({ type: 'polygon', points: createRectPath(asset.w || 60, asset.h || 60), color: asset.color });
        } else if (asset.shape === 'polygon' && asset.points) {
            const pts = asset.points.map(p => ({ x: p.x, y: p.y, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false }));
            shapes.push({ type: 'polygon', points: pts, color: asset.color });
        } else if (asset.shape === 'circle') {
            shapes.push({ type: 'circle', x: 0, y: 0, w: asset.w || 60, h: asset.h || 60, color: asset.color });
        }
    }
    return { ...asset, shapes, w: asset.w || 60, h: asset.h || 60 };
};

// 新しいパス生成：handles配列対応
// handles: [] = 直線, handles: [{x,y}] = 二次ベジェ, handles: [{x,y},{x,y}] = 三次ベジェ, それ以上 = 連続曲線
export const generateSvgPath = (points) => {
    if (!points || points.length === 0) return "";
    let d = `M ${points[0].x * BASE_SCALE} ${points[0].y * BASE_SCALE}`;
    for (let i = 0; i < points.length; i++) {
        const curr = points[i];
        const next = points[(i + 1) % points.length];
        const handles = curr.handles || [];

        if (handles.length === 0) {
            // 旧形式との互換: isCurve/h1/h2がある場合
            if (curr.isCurve || next.isCurve) {
                const cp1x = (curr.x + (curr.h2?.x || 0)) * BASE_SCALE;
                const cp1y = (curr.y + (curr.h2?.y || 0)) * BASE_SCALE;
                const cp2x = (next.x + (next.h1?.x || 0)) * BASE_SCALE;
                const cp2y = (next.y + (next.h1?.y || 0)) * BASE_SCALE;
                d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x * BASE_SCALE} ${next.y * BASE_SCALE}`;
            } else {
                d += ` L ${next.x * BASE_SCALE} ${next.y * BASE_SCALE}`;
            }
        } else if (handles.length === 1) {
            // 二次ベジェ曲線 (Q)
            const h = handles[0];
            d += ` Q ${h.x * BASE_SCALE} ${h.y * BASE_SCALE}, ${next.x * BASE_SCALE} ${next.y * BASE_SCALE}`;
        } else if (handles.length === 2) {
            // 三次ベジェ曲線 (C)
            const h1 = handles[0];
            const h2 = handles[1];
            d += ` C ${h1.x * BASE_SCALE} ${h1.y * BASE_SCALE}, ${h2.x * BASE_SCALE} ${h2.y * BASE_SCALE}, ${next.x * BASE_SCALE} ${next.y * BASE_SCALE}`;
        } else {
            // 複数のハンドル: 連続曲線として描画
            const step = 1 / handles.length;
            let lastX = curr.x, lastY = curr.y;
            for (let j = 0; j < handles.length; j++) {
                const h = handles[j];
                const t = (j + 1) * step;
                const endX = curr.x + (next.x - curr.x) * t;
                const endY = curr.y + (next.y - curr.y) * t;
                d += ` Q ${h.x * BASE_SCALE} ${h.y * BASE_SCALE}, ${endX * BASE_SCALE} ${endY * BASE_SCALE}`;
                lastX = endX; lastY = endY;
            }
            // 最後の点へ直線
            if (Math.abs(lastX - next.x) > 0.01 || Math.abs(lastY - next.y) > 0.01) {
                d += ` L ${next.x * BASE_SCALE} ${next.y * BASE_SCALE}`;
            }
        }
    }
    d += " Z";
    return d;
};

// 統一楕円SVGパス生成（楕円・扇形・弓形対応）
export const generateEllipsePath = (shape) => {
    const { cx = 0, cy = 0, rx = 50, ry = 50, startAngle = 0, endAngle = 360, arcMode = 'sector', rotation = 0 } = shape;
    const rxs = rx * BASE_SCALE;
    const rys = ry * BASE_SCALE;
    const cxs = cx * BASE_SCALE;
    const cys = cy * BASE_SCALE;

    // 完全な楕円の場合
    const angleDiff = ((endAngle - startAngle + 360) % 360) || 360;
    if (angleDiff >= 360) {
        // 完全な楕円は2つの円弧で描画
        return `M ${cxs - rxs} ${cys} A ${rxs} ${rys} 0 1 1 ${cxs + rxs} ${cys} A ${rxs} ${rys} 0 1 1 ${cxs - rxs} ${cys}`;
    }

    // 部分円弧の場合
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    // 楕円上の始点・終点
    const x1 = cxs + rxs * Math.cos(startRad);
    const y1 = cys + rys * Math.sin(startRad);
    const x2 = cxs + rxs * Math.cos(endRad);
    const y2 = cys + rys * Math.sin(endRad);

    const largeArc = angleDiff > 180 ? 1 : 0;
    const sweepFlag = 1;

    if (arcMode === 'sector') {
        // 扇形: 中心→始点→円弧→終点→中心
        return `M ${cxs} ${cys} L ${x1} ${y1} A ${rxs} ${rys} 0 ${largeArc} ${sweepFlag} ${x2} ${y2} Z`;
    } else {
        // 弓形(chord): 始点→円弧→終点→始点
        return `M ${x1} ${y1} A ${rxs} ${rys} 0 ${largeArc} ${sweepFlag} ${x2} ${y2} Z`;
    }
};

export const getClientPos = (e, viewState, svgRect) => {
    const cx = e.clientX - svgRect.left;
    const cy = e.clientY - svgRect.top;
    const x = (cx - viewState.x) / viewState.scale / BASE_SCALE;
    const y = (cy - viewState.y) / viewState.scale / BASE_SCALE;
    return { x, y };
};
