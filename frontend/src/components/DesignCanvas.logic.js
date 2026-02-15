import { deepClone, toSvgY, toCartesianY, toCartesianRotation } from '../lib/utils';
import { BASE_SCALE, SNAP_UNIT } from '../lib/constants';

/**
 * パニング操作を開始します。
 * @param {PointerEvent} e - イベントオブジェクト
 * @param {Object} viewState - 現在のビュー状態
 * @param {Function} setCursorMode - カーソルモード設定関数
 * @returns {Object} 新しいドラッグ状態
 */
export const initiatePanning = (e, viewState, setCursorMode) => {
    setCursorMode('panning');
    return { mode: 'panning', sx: e.clientX, sy: e.clientY, vx: viewState.x, vy: viewState.y };
};

/**
 * 矩形選択（Marquee）を開始します。
 * @param {PointerEvent} e - イベントオブジェクト
 * @param {Function} setMarquee - Marquee状態設定関数
 * @param {Function} setSelectedShapeIndices - 選択インデックス設定関数
 * @param {Array} selectedShapeIndices - 現在の選択インデックス
 * @returns {Object} 新しいドラッグ状態
 */
export const initiateMarquee = (e, setMarquee, setSelectedShapeIndices, selectedShapeIndices) => {
    setMarquee({ sx: e.clientX, sy: e.clientY, ex: e.clientX, ey: e.clientY });
    if (!e.ctrlKey && !e.metaKey) setSelectedShapeIndices([]);
    return {
        mode: 'marquee',
        sx: e.clientX,
        sy: e.clientY,
        prevSelectedIndices: e.ctrlKey || e.metaKey ? [...selectedShapeIndices] : []
    };
};

/**
 * リサイズ操作を開始します。
 * @param {PointerEvent} e - イベントオブジェクト
 * @param {number} shapeIndex - 対象シェイプのインデックス
 * @param {Object} currentAsset - 現在のアセットデータ
 * @param {string} resizeMode - リサイズモード ('both', 'width', 'height')
 * @param {Function} setSelectedShapeIndices - 選択インデックス設定関数
 * @param {Function} setSelectedPointIndex - 選択ポイントインデックス設定関数
 * @param {Function} setCursorMode - カーソルモード設定関数
 * @returns {Object} 新しいドラッグ状態
 */
export const initiateResizing = (e, shapeIndex, currentAsset, resizeMode, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode) => {
    e.stopPropagation();
    setSelectedShapeIndices([shapeIndex]);
    setSelectedPointIndex(null);
    const shape = currentAsset.entities[shapeIndex];
    setCursorMode('resizing');
    return {
        mode: 'resizing',
        sx: e.clientX,
        sy: e.clientY,
        shapeW: shape.w,
        shapeH: shape.h,
        shapeX: shape.x || 0,
        shapeY: shape.y || 0,
        resizeMode
    };
};

/**
 * ハンドル操作（多角形など）を開始します。
 * @param {PointerEvent} e - イベントオブジェクト
 * @param {number} shapeIndex - 対象シェイプのインデックス
 * @param {number} pointIndex - 対象ポイントのインデックス
 * @param {number} handleIndex - 対象ハンドルのインデックス
 * @param {Object} currentAsset - 現在のアセットデータ
 * @param {Function} setSelectedShapeIndices - 選択インデックス設定関数
 * @param {Function} setSelectedPointIndex - 選択ポイントインデックス設定関数
 * @param {Function} setCursorMode - カーソルモード設定関数
 * @returns {Object} 新しいドラッグ状態
 */
export const initiateDraggingHandle = (e, shapeIndex, pointIndex, handleIndex, currentAsset, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode) => {
    e.stopPropagation();
    setSelectedShapeIndices([shapeIndex]);
    setSelectedPointIndex(pointIndex);
    const shape = currentAsset.entities[shapeIndex];
    const handle = shape.points[pointIndex].handles[handleIndex];
    setCursorMode('draggingHandle');
    return {
        mode: 'draggingHandle',
        sx: e.clientX,
        sy: e.clientY,
        handleX: handle.x,
        handleY: handle.y,
        handleIndex
    };
};

/**
 * 角度変更操作（円弧など）を開始します。
 * @param {PointerEvent} e - イベントオブジェクト
 * @param {number} shapeIndex - 対象シェイプのインデックス
 * @param {string} pointIndex - プロパティ名 ('startAngle', 'endAngle')
 * @param {Object} currentAsset - 現在のアセットデータ
 * @param {Object} viewState - ビュー状態
 * @param {Object} rect - SVG要素のBoundingClientRect
 * @param {Function} setSelectedShapeIndices - 選択インデックス設定関数
 * @param {Function} setCursorMode - カーソルモード設定関数
 * @returns {Object} 新しいドラッグ状態
 */
export const initiateDraggingAngle = (e, shapeIndex, pointIndex, currentAsset, viewState, rect, setSelectedShapeIndices, setCursorMode) => {
    e.stopPropagation();
    setSelectedShapeIndices([shapeIndex]);
    const shape = currentAsset.entities[shapeIndex];
    const cx_svg = (shape.cx !== undefined ? shape.cx : 0) * BASE_SCALE;
    const cy_svg = toSvgY(shape.cy !== undefined ? shape.cy : 0) * BASE_SCALE;

    // Screen coords calculation
    const screenCx = cx_svg * viewState.scale + viewState.x + rect.left;
    const screenCy = cy_svg * viewState.scale + viewState.y + rect.top;

    setCursorMode('draggingAngle');
    return {
        mode: 'draggingAngle',
        targetProp: pointIndex,
        cx: screenCx,
        cy: screenCy
    };
};

/**
 * 回転操作を開始します。
 * @param {PointerEvent} e - イベントオブジェクト
 * @param {number} shapeIndex - 対象シェイプのインデックス
 * @param {Object} currentAsset - 現在のアセットデータ
 * @param {Object} viewState - ビュー状態
 * @param {Object} rect - SVG要素のBoundingClientRect
 * @param {Function} setSelectedShapeIndices - 選択インデックス設定関数
 * @param {Function} setCursorMode - カーソルモード設定関数
 * @returns {Object} 新しいドラッグ状態
 */
export const initiateDraggingRotation = (e, shapeIndex, currentAsset, viewState, rect, setSelectedShapeIndices, setCursorMode) => {
    e.stopPropagation();
    setSelectedShapeIndices([shapeIndex]);
    const shape = currentAsset.entities[shapeIndex];

    let cx_cart = 0, cy_cart = 0;
    if (shape.type === 'ellipse' || shape.type === 'circle' || shape.type === 'arc') {
        cx_cart = shape.cx || 0; cy_cart = shape.cy || 0;
    } else {
        cx_cart = (shape.x || 0) + (shape.w || 0) / 2;
        cy_cart = (shape.y || 0) + (shape.h || 0) / 2;
    }

    const cx_svg = cx_cart * BASE_SCALE;
    const cy_svg = toSvgY(cy_cart) * BASE_SCALE;

    const screenCx = cx_svg * viewState.scale + viewState.x + rect.left;
    const screenCy = cy_svg * viewState.scale + viewState.y + rect.top;

    const mx = e.clientX;
    const my = e.clientY;
    const startAngle = Math.atan2(my - screenCy, mx - screenCx) * 180 / Math.PI;

    setCursorMode('draggingRotation');
    return {
        mode: 'draggingRotation',
        cx: screenCx,
        cy: screenCy,
        initialRotation: shape.rotation || 0,
        startAngle
    };
};

/**
 * 半径変更操作を開始します。
 * @param {PointerEvent} e - イベントオブジェクト
 * @param {number} shapeIndex - 対象シェイプのインデックス
 * @param {string} pointIndex - プロパティ名 ('rx', 'ry')
 * @param {Object} currentAsset - 現在のアセットデータ
 * @param {Function} setSelectedShapeIndices - 選択インデックス設定関数
 * @param {Function} setCursorMode - カーソルモード設定関数
 * @returns {Object} 新しいドラッグ状態
 */
export const initiateDraggingRadius = (e, shapeIndex, pointIndex, currentAsset, setSelectedShapeIndices, setCursorMode) => {
    e.stopPropagation();
    setSelectedShapeIndices([shapeIndex]);
    const shape = currentAsset.entities[shapeIndex];
    setCursorMode('ew-resize');
    return {
        mode: 'draggingRadius',
        targetProp: pointIndex,
        sx: e.clientX,
        sy: e.clientY,
        initialVal: shape[pointIndex] || 50
    };
};

/**
 * 頂点移動操作を開始します。
 * @param {PointerEvent} e - イベントオブジェクト
 * @param {number} shapeIndex - 対象シェイプのインデックス
 * @param {number} pointIndex - 対象ポイントのインデックス
 * @param {Object} currentAsset - 現在のアセットデータ
 * @param {Function} setSelectedShapeIndices - 選択インデックス設定関数
 * @param {Function} setSelectedPointIndex - 選択ポイントインデックス設定関数
 * @param {Function} setCursorMode - カーソルモード設定関数
 * @returns {Object} 新しいドラッグ状態
 */
export const initiateDraggingPoint = (e, shapeIndex, pointIndex, currentAsset, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode) => {
    e.stopPropagation();
    setSelectedShapeIndices([shapeIndex]);
    setSelectedPointIndex(pointIndex);
    const shape = currentAsset.entities[shapeIndex];
    const pt = shape.points[pointIndex];
    setCursorMode('draggingPoint');
    return {
        mode: 'draggingPoint',
        sx: e.clientX,
        sy: e.clientY,
        pointX: pt.x,
        pointY: pt.y
    };
};

/**
 * シェイプ移動操作を開始します。
 * @param {PointerEvent} e - イベントオブジェクト
 * @param {number} shapeIndex - 対象シェイプのインデックス
 * @param {Object} currentAsset - 現在のアセットデータ
 * @param {Array} selectedShapeIndices - 現在の選択インデックス
 * @param {Function} setSelectedShapeIndices - 選択インデックス設定関数
 * @param {Function} setCursorMode - カーソルモード設定関数
 * @returns {Object} 新しいドラッグ状態
 */
export const initiateDraggingShape = (e, shapeIndex, currentAsset, selectedShapeIndices, setSelectedShapeIndices, setCursorMode) => {
    e.stopPropagation();
    let newSelectedIndices = [...selectedShapeIndices];
    if (e.ctrlKey || e.metaKey) {
        if (newSelectedIndices.includes(shapeIndex)) newSelectedIndices = newSelectedIndices.filter(i => i !== shapeIndex);
        else newSelectedIndices.push(shapeIndex);
        setSelectedShapeIndices(newSelectedIndices);
    } else {
        if (!newSelectedIndices.includes(shapeIndex)) {
            newSelectedIndices = [shapeIndex];
            setSelectedShapeIndices(newSelectedIndices);
        }
    }

    if (newSelectedIndices.length === 0) return { mode: 'idle' };

    const initialShapes = newSelectedIndices.map(i => ({ index: i, data: deepClone(currentAsset.entities[i]) }));
    const anchorIndex = newSelectedIndices[0];
    const anchorShape = currentAsset.entities[anchorIndex];
    const anchorX = anchorShape.x !== undefined ? anchorShape.x : (anchorShape.cx !== undefined ? anchorShape.cx : 0);
    const anchorY = anchorShape.y !== undefined ? anchorShape.y : (anchorShape.cy !== undefined ? anchorShape.cy : 0);

    setCursorMode('draggingShape');
    return {
        mode: 'draggingShape',
        sx: e.clientX,
        sy: e.clientY,
        initialShapes: initialShapes,
        anchorX,
        anchorY
    };
};

/**
 * パニング中の処理
 * @param {PointerEvent} e
 * @param {Object} dragRefState
 * @param {Function} setViewState
 */
export const processPanning = (e, dragRefState, setViewState) => {
    const dx = e.clientX - dragRefState.sx;
    const dy = e.clientY - dragRefState.sy;
    setViewState(p => ({ ...p, x: dragRefState.vx + dx, y: dragRefState.vy + dy }));
};

/**
 * 矩形選択中の処理
 * @param {PointerEvent} e
 * @param {Object} dragRefState
 * @param {Function} setMarquee
 * @param {Object} svgRef
 * @param {Object} viewState
 * @param {Object} currentAsset
 * @param {Function} setSelectedShapeIndices
 */
export const processMarquee = (e, dragRefState, setMarquee, svgRef, viewState, currentAsset, setSelectedShapeIndices) => {
    setMarquee(prev => prev ? { ...prev, ex: e.clientX, ey: e.clientY } : null);
    if (svgRef.current) {
        const scale = viewState.scale * BASE_SCALE;
        const rect = svgRef.current.getBoundingClientRect();
        const toWorld = (screenX, screenY) => {
             const svgX = (screenX - rect.left - viewState.x) / scale;
             const svgY = (screenY - rect.top - viewState.y) / scale;
             return { x: svgX, y: toCartesianY(svgY) };
        };
        const p1 = toWorld(dragRefState.sx, dragRefState.sy);
        const p2 = toWorld(e.clientX, e.clientY);
        const minX = Math.min(p1.x, p2.x); const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y); const maxY = Math.max(p1.y, p2.y);

        const inBoxIndices = (currentAsset.entities || []).map((s, i) => {
            let cx, cy;
            if (s.type === 'polygon' && s.points) {
                const xs = s.points.map(p => p.x); const ys = s.points.map(p => p.y);
                cx = Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) / 2;
                cy = Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) / 2;
            } else if (s.type === 'ellipse' || s.type === 'arc' || s.type === 'circle') {
                cx = s.cx !== undefined ? s.cx : (s.x + s.w / 2);
                cy = s.cy !== undefined ? s.cy : (s.y + s.h / 2);
            } else {
                cx = (s.x || 0) + (s.w || 0) / 2;
                cy = (s.y || 0) + (s.h || 0) / 2;
            }
            return (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) ? i : -1;
        }).filter(i => i !== -1);
        const initialSelected = dragRefState.prevSelectedIndices || [];
        setSelectedShapeIndices([...new Set([...initialSelected, ...inBoxIndices])]);
    }
};

/**
 * リサイズ中の処理
 * @returns {Array} 更新されたエンティティ配列
 */
export const processResizing = (e, dragRefState, currentAsset, viewState, selectedShapeIndices) => {
    const scale = viewState.scale * BASE_SCALE;
    const dx = (e.clientX - dragRefState.sx) / scale;
    const dy_svg = (e.clientY - dragRefState.sy) / scale;
    const dy = toCartesianY(dy_svg);

    const newEntities = deepClone(currentAsset.entities);
    const targetIdx = selectedShapeIndices[0];
    const targetShape = newEntities[targetIdx];
    const resizeMode = dragRefState.resizeMode;

    if (resizeMode === 'both') {
        let newW = dragRefState.shapeW + dx;
        let newH = dragRefState.shapeH + dy;
        if (!e.shiftKey) {
            newW = Math.round(newW / SNAP_UNIT) * SNAP_UNIT;
            newH = Math.round(newH / SNAP_UNIT) * SNAP_UNIT;
        }
        newEntities[targetIdx] = { ...targetShape, w: Math.max(10, newW), h: Math.max(10, newH) };
    } else if (resizeMode === 'width' || resizeMode === 'horizontal') {
        let newW = dragRefState.shapeW + dx;
        if (!e.shiftKey) newW = Math.round(newW / SNAP_UNIT) * SNAP_UNIT;
        newEntities[targetIdx] = { ...targetShape, w: Math.max(10, newW) };
    } else if (resizeMode === 'height' || resizeMode === 'vertical') {
        let newH = dragRefState.shapeH + dy;
        if (!e.shiftKey) newH = Math.round(newH / SNAP_UNIT) * SNAP_UNIT;
        newEntities[targetIdx] = { ...targetShape, h: Math.max(10, newH) };
    }

    return newEntities;
};

export const processDraggingShape = (e, dragRefState, currentAsset, viewState) => {
    const scale = viewState.scale * BASE_SCALE;
    const rawDx = (e.clientX - dragRefState.sx) / scale;
    const rawDySvg = (e.clientY - dragRefState.sy) / scale;
    const rawDy = toCartesianY(rawDySvg);

    let moveX = rawDx; let moveY = rawDy;
    if (currentAsset.snap && !e.shiftKey) {
        const anchorX = dragRefState.anchorX || 0;
        const anchorY = dragRefState.anchorY || 0;
        const targetX = anchorX + rawDx;
        const targetY = anchorY + rawDy;
        const snappedX = Math.round(targetX / SNAP_UNIT) * SNAP_UNIT;
        const snappedY = Math.round(targetY / SNAP_UNIT) * SNAP_UNIT;
        moveX = snappedX - anchorX;
        moveY = snappedY - anchorY;
    }

    const newEntities = deepClone(currentAsset.entities);
    const initialShapes = dragRefState.initialShapes || [];
    initialShapes.forEach(({ index, data }) => {
        let updatedShape = { ...newEntities[index] };
        if (data.x !== undefined) updatedShape.x = (data.x || 0) + moveX;
        if (data.y !== undefined) updatedShape.y = (data.y || 0) + moveY;
        if (data.cx !== undefined) updatedShape.cx = (data.cx || 0) + moveX;
        if (data.cy !== undefined) updatedShape.cy = (data.cy || 0) + moveY;
        if (data.points) updatedShape.points = data.points.map(p => ({ ...p, x: p.x + moveX, y: p.y + moveY }));
        newEntities[index] = updatedShape;
    });
    return newEntities;
};

export const processDraggingPoint = (e, dragRefState, currentAsset, viewState, selectedShapeIndices, selectedPointIndex) => {
    const scale = viewState.scale * BASE_SCALE;
    const dx = (e.clientX - dragRefState.sx) / scale;
    const dy_svg = (e.clientY - dragRefState.sy) / scale;
    const dy = toCartesianY(dy_svg);

    const newEntities = deepClone(currentAsset.entities);
    const targetIdx = selectedShapeIndices[0];
    const pts = [...newEntities[targetIdx].points];
    let nx = dragRefState.pointX + dx;
    let ny = dragRefState.pointY + dy;
    if (!e.shiftKey) {
        nx = Math.round(nx / SNAP_UNIT) * SNAP_UNIT;
        ny = Math.round(ny / SNAP_UNIT) * SNAP_UNIT;
    }
    pts[selectedPointIndex] = { ...pts[selectedPointIndex], x: nx, y: ny };
    newEntities[targetIdx].points = pts;

    if (newEntities[targetIdx].type === 'polygon') {
        const xs = pts.map(p => p.x); const ys = pts.map(p => p.y);
        newEntities[targetIdx].x = Math.min(...xs);
        newEntities[targetIdx].y = Math.min(...ys);
        newEntities[targetIdx].w = Math.max(...xs) - newEntities[targetIdx].x;
        newEntities[targetIdx].h = Math.max(...ys) - newEntities[targetIdx].y;
    }
    return newEntities;
};

export const processDraggingHandle = (e, dragRefState, currentAsset, viewState, selectedShapeIndices, selectedPointIndex) => {
    const scale = viewState.scale * BASE_SCALE;
    const dx = (e.clientX - dragRefState.sx) / scale;
    const dy_svg = (e.clientY - dragRefState.sy) / scale;
    const dy = toCartesianY(dy_svg);

    const newEntities = deepClone(currentAsset.entities);
    const targetIdx = selectedShapeIndices[0];
    const pts = [...newEntities[targetIdx].points];
    const pt = { ...pts[selectedPointIndex] };
    const handles = [...pt.handles];
    handles[dragRefState.handleIndex] = { x: dragRefState.handleX + dx, y: dragRefState.handleY + dy };
    pt.handles = handles; pts[selectedPointIndex] = pt; newEntities[targetIdx].points = pts;
    return newEntities;
};

export const processDraggingAngle = (e, dragRefState, currentAsset, selectedShapeIndices) => {
    const targetIdx = selectedShapeIndices[0];
    const angleSvg = Math.atan2(e.clientY - dragRefState.cy, e.clientX - dragRefState.cx) * 180 / Math.PI;
    const angleCart = toCartesianRotation(angleSvg);

    const deg = (angleCart + 360) % 360;
    const snapped = e.shiftKey ? deg : Math.round(deg / 15) * 15;

    const newEntities = deepClone(currentAsset.entities);
    newEntities[targetIdx][dragRefState.targetProp] = snapped;
    return newEntities;
};

export const processDraggingRotation = (e, dragRefState, currentAsset, selectedShapeIndices) => {
    const targetIdx = selectedShapeIndices[0];
    const currentAngleSvg = Math.atan2(e.clientY - dragRefState.cy, e.clientX - dragRefState.cx) * 180 / Math.PI;
    const deltaSvg = currentAngleSvg - dragRefState.startAngle;
    const deltaCart = toCartesianRotation(deltaSvg);

    let newRot = (dragRefState.initialRotation + deltaCart + 360) % 360;
    if (!e.shiftKey) newRot = Math.round(newRot / 15) * 15;

    const newEntities = deepClone(currentAsset.entities);
    newEntities[targetIdx].rotation = newRot;
    return newEntities;
};

export const processDraggingRadius = (e, dragRefState, currentAsset, viewState, selectedShapeIndices) => {
    const scale = viewState.scale * BASE_SCALE;
    const targetIdx = selectedShapeIndices[0];
    const dx = (e.clientX - dragRefState.sx) / scale;

    let newVal = dragRefState.initialVal + dx;
    if (!e.shiftKey) newVal = Math.round(newVal / SNAP_UNIT) * SNAP_UNIT;
    newVal = Math.max(1, newVal);
    const newEntities = deepClone(currentAsset.entities);
    newEntities[targetIdx][dragRefState.targetProp] = newVal;
    return newEntities;
};
