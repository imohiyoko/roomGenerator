import React, { useState, useRef, useEffect } from 'react';
import { BASE_SCALE, SNAP_UNIT } from '../lib/constants';
import { generateSvgPath, generateEllipsePath, createRectPath, toSvgY, toCartesianY, toSvgRotation, toCartesianRotation, deepClone, getRotatedAABB } from '../lib/utils';
import { useStore } from '../store';

// Render Component
const DesignCanvasRender = ({ viewState, asset, entities, selectedShapeIndices, selectedPointIndex, onDown, onMove, onUp, onDeleteShape, svgRef, marquee, cursorMode }) => {
    // Apply cursor style
    useEffect(() => {
        if (!svgRef.current) return;
        let cursorStyle = 'default';
        switch (cursorMode) {
            case 'draggingShape': cursorStyle = 'move'; break;
            case 'draggingHandle':
            case 'draggingPoint': cursorStyle = 'crosshair'; break;
            case 'draggingAngle':
            case 'draggingRotation': cursorStyle = 'alias'; break;
            case 'resizing': cursorStyle = 'nwse-resize'; break;
            case 'ew-resize': cursorStyle = 'ew-resize'; break;
            case 'panning': cursorStyle = 'grabbing'; break;
            default: cursorStyle = 'default'; break;
        }
        svgRef.current.style.cursor = cursorStyle;
    }, [cursorMode, svgRef]);

    const scale = viewState.scale * BASE_SCALE;

    return (
        <div className="w-full h-full absolute top-0 left-0 overflow-auto canvas-scroll pt-5 pl-5"
            onPointerDown={e => onDown(e, null)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            ref={svgRef}
        >
            <svg width="3000" height="3000" style={{ minWidth: '3000px', minHeight: '3000px' }}>
                <g transform={`translate(${viewState.x}, ${viewState.y}) scale(${viewState.scale})`}>
                    <line x1="-5000" y1="0" x2="5000" y2="0" stroke="#ccc" strokeWidth="2" />
                    <line x1="0" y1="-5000" x2="0" y2="5000" stroke="#ccc" strokeWidth="2" />
                    <circle cx="0" cy="0" r="5" fill="red" opacity="0.5" />
                    {asset && (() => {
                        // Asset Bounding Box (Cartesian to SVG)
                        // Cartesian: boundX, boundY (Bottom-Left), w, h.
                        // SVG Rect: x=boundX, y=-(boundY+h), w, h
                        const bx = (asset.boundX || 0) * BASE_SCALE;
                        const by = toSvgY((asset.boundY || 0) + asset.h) * BASE_SCALE;
                        return (
                            <g>
                                <rect x={bx} y={by} width={asset.w * BASE_SCALE} height={asset.h * BASE_SCALE} fill="none" stroke="blue" strokeWidth="1" strokeDasharray="4 2" opacity="0.3" pointerEvents="none" />

                                {entities.map((s, i) => {
                                    const isSelected = selectedShapeIndices.includes(i);
                                    const style = { fill: s.color || asset.color, stroke: isSelected ? "#3b82f6" : "#999", strokeWidth: isSelected ? 2 : 1, cursor: 'move' };

                                    // Rotation logic (Cartesian CCW -> SVG CW)
                                    const rot = s.rotation ? toSvgRotation(s.rotation) : 0;

                                    // Rotation Center logic
                                    // For Ellipse: center is cx, cy.
                                    // For Rect/Polygon: center is usually center of bounds, but logic uses s.x/y or cx/cy.
                                    // Helper to get center in SVG coords
                                    let cx_svg = 0, cy_svg = 0;
                                    if (s.type === 'ellipse' || s.type === 'circle' || s.type === 'arc') {
                                        cx_svg = (s.cx !== undefined ? s.cx : (s.x + s.w/2)) * BASE_SCALE;
                                        cy_svg = toSvgY(s.cy !== undefined ? s.cy : (s.y + s.h/2)) * BASE_SCALE;
                                    } else {
                                        cx_svg = ((s.x || 0) + (s.w || 0) / 2) * BASE_SCALE;
                                        cy_svg = toSvgY((s.y || 0) + (s.h || 0) / 2) * BASE_SCALE;
                                    }

                                    const rotateTransform = rot ? `rotate(${rot} ${cx_svg} ${cy_svg})` : '';

                                    return (
                                        <g key={i} onPointerDown={(e) => onDown(e, i)}>
                                            {s.type === 'circle'
                                                ? <ellipse cx={(s.x + s.w / 2) * BASE_SCALE} cy={toSvgY(s.y + s.h / 2) * BASE_SCALE} rx={s.w * BASE_SCALE / 2} ry={s.h * BASE_SCALE / 2} {...style} />
                                                : s.type === 'ellipse'
                                                    ? <path d={generateEllipsePath(s)} transform={rotateTransform} {...style} />
                                                    : <path d={generateSvgPath(s.points)} {...style} />
                                            }
                                            {/* Ellipse Handles */}
                                            {isSelected && s.type === 'ellipse' && (() => {
                                                const cx = (s.cx || 0) * BASE_SCALE;
                                                const cy = toSvgY(s.cy || 0) * BASE_SCALE;
                                                const rxs = (s.rx || 50) * BASE_SCALE;
                                                const rys = (s.ry || 50) * BASE_SCALE;

                                                // Handle Positions in SVG Space (Visual)
                                                // Rotation is applied to the GROUP, so we draw handles in LOCAL unrotated SVG space relative to center?
                                                // generateEllipsePath generates path. rotateTransform rotates it around center.
                                                // So if we put handles inside <g transform={rotateTransform}>, they should align.

                                                // SVG Angles for handle placement:
                                                // StartAngle (Cartesian) -> -StartAngle (SVG).
                                                // 0 is East.

                                                const startRad = toSvgRotation(s.startAngle || 0) * Math.PI / 180;
                                                const endRad = toSvgRotation(s.endAngle || 360) * Math.PI / 180;

                                                const sx = cx + rxs * Math.cos(startRad);
                                                const sy = cy + rys * Math.sin(startRad);
                                                const ex = cx + rxs * Math.cos(endRad);
                                                const ey = cy + rys * Math.sin(endRad);

                                                const rotHandleY = cy - rys - 20; // Visual handle above top

                                                return (
                                                    <g transform={rotateTransform}>
                                                        <circle cx={cx} cy={cy} r="6" fill="red" stroke="white" strokeWidth="2" className="cursor-move" />
                                                        {/* Width Handle (Right) */}
                                                        <rect x={cx + rxs - 4} y={cy - 4} width="8" height="8" fill="orange" stroke="white" strokeWidth="1" className="cursor-ew-resize" onPointerDown={(e) => onDown(e, i, 'rx')} />
                                                        {/* Height Handle (Bottom in SVG, Top in Cartesian? ry is radius so direction symmetric) */}
                                                        <rect x={cx - 4} y={cy + rys - 4} width="8" height="8" fill="orange" stroke="white" strokeWidth="1" className="cursor-ns-resize" onPointerDown={(e) => onDown(e, i, 'ry')} />

                                                        {/* Corner Handle */}
                                                        <rect x={cx + rxs - 4} y={cy + rys - 4} width="8" height="8" fill="yellow" stroke="orange" strokeWidth="1" className="cursor-nwse-resize" onPointerDown={(e) => onDown(e, i, 'rxy')} />

                                                        {/* Rotation Handle */}
                                                        <line x1={cx} y1={cy - rys} x2={cx} y2={rotHandleY} stroke="cyan" strokeWidth="1" strokeDasharray="3,2" />
                                                        <circle cx={cx} cy={rotHandleY} r="5" fill="cyan" stroke="white" strokeWidth="1" className="cursor-pointer" onPointerDown={(e) => onDown(e, i, 'rotation')} />

                                                        {/* Angle Handles */}
                                                        <line x1={cx} y1={cy} x2={sx * 0.6 + cx * 0.4} y2={sy * 0.6 + cy * 0.4} stroke="green" strokeWidth="1" strokeDasharray="3,2" />
                                                        <line x1={cx} y1={cy} x2={ex * 0.6 + cx * 0.4} y2={ey * 0.6 + cy * 0.4} stroke="purple" strokeWidth="1" strokeDasharray="3,2" />
                                                        <circle cx={sx * 0.6 + cx * 0.4} cy={sy * 0.6 + cy * 0.4} r="5" fill="green" stroke="white" strokeWidth="1" className="cursor-pointer" onPointerDown={(e) => onDown(e, i, 'startAngle')} />
                                                        <circle cx={ex * 0.6 + cx * 0.4} cy={ey * 0.6 + cy * 0.4} r="5" fill="purple" stroke="white" strokeWidth="1" className="cursor-pointer" onPointerDown={(e) => onDown(e, i, 'endAngle')} />
                                                    </g>
                                                );
                                            })()}
                                            {/* Polygon Points */}
                                            {isSelected && s.type === 'polygon' && s.points.map((p, pid) => (
                                                <React.Fragment key={pid}>
                                                    <circle cx={p.x * BASE_SCALE} cy={toSvgY(p.y) * BASE_SCALE} r="5" fill={selectedPointIndex === pid ? "red" : "white"} stroke="blue" strokeWidth="2" className="cursor-crosshair" onPointerDown={(e) => onDown(e, i, pid)} />
                                                    {p.handles && p.handles.map((h, hid) => (
                                                        <React.Fragment key={`h-${pid}-${hid}`}>
                                                            <line x1={p.x * BASE_SCALE} y1={toSvgY(p.y) * BASE_SCALE} x2={h.x * BASE_SCALE} y2={toSvgY(h.y) * BASE_SCALE} stroke="orange" strokeWidth="1" strokeDasharray="3,2" />
                                                            <rect x={h.x * BASE_SCALE - 4} y={toSvgY(h.y) * BASE_SCALE - 4} width="8" height="8" fill="orange" stroke="darkorange" strokeWidth="1" className="cursor-move" onPointerDown={(e) => onDown(e, i, pid, null, hid)} />
                                                        </React.Fragment>
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                            {/* Rect/Polygon Bounds Delete Button */}
                                            {isSelected && s.type === 'polygon' && (() => {
                                                const maxX = Math.max(...s.points.map(p => p.x));
                                                const minY = Math.min(...s.points.map(p => p.y)); // Cartesian Min Y
                                                // SVG Max Y corresponds to Cartesian Min Y (Bottom)
                                                // SVG Min Y corresponds to Cartesian Max Y (Top)
                                                // Where to put the delete button? Top-Right?
                                                // Top-Right Cartesian: MaxX, MaxY.
                                                // Top-Right SVG: MaxX, toSvgY(MaxY).
                                                const maxY = Math.max(...s.points.map(p => p.y));

                                                return (
                                                    <g transform={`translate(${maxX * BASE_SCALE + 10}, ${toSvgY(maxY) * BASE_SCALE - 10})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(i)}>
                                                        <circle r="8" fill="red" />
                                                        <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" /><line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
                                                    </g>
                                                );
                                            })()}
                                            {/* Rect Resizers */}
                                            {isSelected && (s.type === 'circle' || s.type === 'rect') && (
                                                <g>
                                                    {/* Rect Corners in SVG Space */}
                                                    {/* Top-Right: x+w, y+h (Cartesian) -> x+w, -(y+h) (SVG) */}
                                                    {/* Bottom-Right: x+w, y (Cartesian) -> x+w, -y (SVG) */}
                                                    {/* Bottom-Center: x+w/2, y -> ... */}

                                                    {/* Note: s.y is Bottom-Left Y in Cartesian */}

                                                    {/* Resize Both (Bottom-Right visual?) */}
                                                    {/* Usually Resizer is at Bottom-Right in SVG logic (Max X, Max Y). */}
                                                    {/* In Cartesian, Bottom-Right is (x+w, y). SVG: (x+w, -y). */}

                                                    {/* Resize Width (Right Center) */}

                                                    {/* Resize Height (Top Center? or Bottom Center?) */}

                                                    {/* Let's place handles at visual corners */}
                                                    {/* Top-Right Visual: Cartesian (x+w, y+h). SVG (x+w, -(y+h)) */}

                                                    <rect x={(s.x + s.w) * BASE_SCALE - 5} y={toSvgY(s.y + s.h) * BASE_SCALE - 5} width="10" height="10" fill="yellow" stroke="blue" strokeWidth="2" className="cursor-nwse-resize" onPointerDown={(e) => onDown(e, i, null, 'both')} />

                                                    {/* Width (Right) */}
                                                    <rect x={(s.x + s.w) * BASE_SCALE - 5} y={toSvgY(s.y + s.h / 2) * BASE_SCALE - 5} width="10" height="10" fill="lightblue" stroke="blue" strokeWidth="2" className="cursor-ew-resize" onPointerDown={(e) => onDown(e, i, null, 'horizontal')} />

                                                    {/* Height (Top) - In Cartesian, Top is y+h */}
                                                    <rect x={(s.x + s.w / 2) * BASE_SCALE - 5} y={toSvgY(s.y + s.h) * BASE_SCALE - 5} width="10" height="10" fill="lightgreen" stroke="blue" strokeWidth="2" className="cursor-ns-resize" onPointerDown={(e) => onDown(e, i, null, 'vertical')} />

                                                    {/* Delete Button (Top-Right + offset) */}
                                                    <g transform={`translate(${(s.x + s.w) * BASE_SCALE + 10}, ${toSvgY(s.y + s.h) * BASE_SCALE - 10})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(i)}>
                                                        <circle r="8" fill="red" />
                                                        <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" /><line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
                                                    </g>
                                                </g>
                                            )}
                                        </g>
                                    );
                                })}
                            </g>
                        );
                    })()}
                </g>
            </svg>
            {marquee && (
                <div style={{ position: 'fixed', left: Math.min(marquee.sx, marquee.ex), top: Math.min(marquee.sy, marquee.ey), width: Math.abs(marquee.ex - marquee.sx), height: Math.abs(marquee.ey - marquee.sy), border: '2px dashed #3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', pointerEvents: 'none', zIndex: 9999 }} />
            )}
        </div>
    );
};

export const DesignCanvas = ({ viewState, setViewState, assets, designTargetId, setLocalAssets, setGlobalAssets }) => {
    const selectedShapeIndices = useStore(state => state.selectedShapeIndices);
    const setSelectedShapeIndices = useStore(state => state.setSelectedShapeIndices);
    const selectedPointIndex = useStore(state => state.selectedPointIndex);
    const setSelectedPointIndex = useStore(state => state.setSelectedPointIndex);

    const [localAsset, setLocalAsset] = useState(null);
    const dragRef = useRef({ mode: 'idle' });
    const [cursorMode, setCursorMode] = useState('idle');
    const svgRef = useRef(null);
    const [marquee, setMarquee] = useState(null);

    const assetFromStore = assets.find(a => a.id === designTargetId);
    const localAssetRef = useRef(null);
    useEffect(() => {
        localAssetRef.current = localAsset;
    }, [localAsset]);

    useEffect(() => {
        if (assetFromStore && dragRef.current.mode === 'idle') {
             // Handle entities/shapes structure
             const normalized = deepClone(assetFromStore);
             if (!normalized.entities && normalized.shapes) {
                 normalized.entities = normalized.shapes;
                 delete normalized.shapes;
             }
             setLocalAsset(normalized);
        }
    }, [assetFromStore]);

    if (!localAsset) return null;

    const updateLocalEntities = (newEntities) => {
        // Calculate bounds with rotation
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasEntities = newEntities.length > 0;

        if (hasEntities) {
            newEntities.forEach(s => {
                const bounds = getRotatedAABB(s);
                if (bounds.minX < minX) minX = bounds.minX;
                if (bounds.maxX > maxX) maxX = bounds.maxX;
                if (bounds.minY < minY) minY = bounds.minY;
                if (bounds.maxY > maxY) maxY = bounds.maxY;
            });
        }

        const updated = { ...localAsset, entities: newEntities, isDefaultShape: false };
        if (hasEntities && minX !== Infinity) {
            updated.boundX = Math.round(minX);
            updated.boundY = Math.round(minY);
            updated.w = Math.round(maxX - minX);
            updated.h = Math.round(maxY - minY);
        }
        setLocalAsset(updated);
    };

    const handleDown = (e, shapeIndex = null, pointIndex = null, resizeMode = null, handleIndex = null) => {
        if (svgRef.current && e.pointerId) svgRef.current.setPointerCapture(e.pointerId);
        const rect = svgRef.current.getBoundingClientRect();

        if (e.button === 1) {
            dragRef.current = { mode: 'panning', sx: e.clientX, sy: e.clientY, vx: viewState.x, vy: viewState.y };
            setCursorMode('panning');
            return;
        }

        if (shapeIndex === null && e.button === 0) {
            setMarquee({ sx: e.clientX, sy: e.clientY, ex: e.clientX, ey: e.clientY });
            if (!e.ctrlKey && !e.metaKey) setSelectedShapeIndices([]);
            dragRef.current = { mode: 'marquee', sx: e.clientX, sy: e.clientY, prevSelectedIndices: e.ctrlKey || e.metaKey ? [...selectedShapeIndices] : [] };
            return;
        }

        const currentEntities = localAsset.entities || [];

        if (resizeMode && shapeIndex !== null && currentEntities[shapeIndex]) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            setSelectedPointIndex(null);
            const shape = currentEntities[shapeIndex];
            dragRef.current = { mode: 'resizing', sx: e.clientX, sy: e.clientY, shapeW: shape.w, shapeH: shape.h, shapeX: shape.x || 0, shapeY: shape.y || 0, resizeMode };
            setCursorMode('resizing');
            return;
        }

        if (handleIndex !== null && pointIndex !== null && shapeIndex !== null && currentEntities[shapeIndex]) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            setSelectedPointIndex(pointIndex);
            const shape = currentEntities[shapeIndex];
            const handle = shape.points[pointIndex].handles[handleIndex];
            dragRef.current = { mode: 'draggingHandle', sx: e.clientX, sy: e.clientY, handleX: handle.x, handleY: handle.y, handleIndex };
            setCursorMode('draggingHandle');
            return;
        }

        if ((pointIndex === 'startAngle' || pointIndex === 'endAngle') && shapeIndex !== null && currentEntities[shapeIndex]) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            // For angle calculation, we need center in SVG screen coords
            const shape = currentEntities[shapeIndex];
            const cx_svg = (shape.cx !== undefined ? shape.cx : 0) * BASE_SCALE;
            const cy_svg = toSvgY(shape.cy !== undefined ? shape.cy : 0) * BASE_SCALE;
            // Screen coords
            const screenCx = cx_svg * viewState.scale + viewState.x + rect.left;
            const screenCy = cy_svg * viewState.scale + viewState.y + rect.top;

            dragRef.current = { mode: 'draggingAngle', targetProp: pointIndex, cx: screenCx, cy: screenCy };
            setCursorMode('draggingAngle');
            return;
        }

        if (pointIndex === 'rotation' && shapeIndex !== null && currentEntities[shapeIndex]) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            const shape = currentEntities[shapeIndex];

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

            dragRef.current = { mode: 'draggingRotation', cx: screenCx, cy: screenCy, initialRotation: shape.rotation || 0, startAngle: 0 };
            const mx = e.clientX; const my = e.clientY;
            // Angle in SVG space (CW)
            // Screen Y increases Down (SVG standard)
            dragRef.current.startAngle = Math.atan2(my - dragRef.current.cy, mx - dragRef.current.cx) * 180 / Math.PI;
            setCursorMode('draggingRotation');
            return;
        }

        if ((pointIndex === 'rx' || pointIndex === 'ry') && shapeIndex !== null && currentEntities[shapeIndex]) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            const shape = currentEntities[shapeIndex];
            dragRef.current = { mode: 'draggingRadius', targetProp: pointIndex, sx: e.clientX, sy: e.clientY, initialVal: shape[pointIndex] || 50 };
            setCursorMode('ew-resize');
            return;
        }

        if (pointIndex !== null && shapeIndex !== null && currentEntities[shapeIndex]) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            setSelectedPointIndex(pointIndex);
            const shape = currentEntities[shapeIndex];
            const pt = shape.points[pointIndex];
            dragRef.current = { mode: 'draggingPoint', sx: e.clientX, sy: e.clientY, pointX: pt.x, pointY: pt.y };
            setCursorMode('draggingPoint');
            return;
        }

        if (shapeIndex !== null) {
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
            if (newSelectedIndices.length === 0) return;
            const initialShapes = newSelectedIndices.map(i => ({ index: i, data: deepClone(currentEntities[i]) }));
            const anchorIndex = newSelectedIndices[0];
            const anchorShape = currentEntities[anchorIndex];
            const anchorX = anchorShape.x !== undefined ? anchorShape.x : (anchorShape.cx !== undefined ? anchorShape.cx : 0);
            const anchorY = anchorShape.y !== undefined ? anchorShape.y : (anchorShape.cy !== undefined ? anchorShape.cy : 0);
            dragRef.current = { mode: 'draggingShape', sx: e.clientX, sy: e.clientY, initialShapes: initialShapes, anchorX, anchorY };
            setCursorMode('draggingShape');
            return;
        }
        setSelectedShapeIndices([]);
        setSelectedPointIndex(null);
    };

    const handleMove = (e) => {
        const mode = dragRef.current.mode;
        if (mode === 'idle') return;
        e.preventDefault();

        const currentAsset = localAsset;
        const scale = viewState.scale * BASE_SCALE;

        if (mode === 'panning') {
            const dx = e.clientX - dragRef.current.sx;
            const dy = e.clientY - dragRef.current.sy;
            setViewState(p => ({ ...p, x: dragRef.current.vx + dx, y: dragRef.current.vy + dy }));
        } else if (mode === 'marquee') {
            setMarquee(prev => prev ? { ...prev, ex: e.clientX, ey: e.clientY } : null);
            if (svgRef.current) {
                const rect = svgRef.current.getBoundingClientRect();
                const toWorld = (screenX, screenY) => {
                     const svgX = (screenX - rect.left - viewState.x) / scale;
                     const svgY = (screenY - rect.top - viewState.y) / scale;
                     return { x: svgX, y: toCartesianY(svgY) }; // Convert to Cartesian
                };
                const p1 = toWorld(dragRef.current.sx, dragRef.current.sy);
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
                const initialSelected = dragRef.current.prevSelectedIndices || [];
                setSelectedShapeIndices([...new Set([...initialSelected, ...inBoxIndices])]);
            }
        } else if (mode === 'resizing' && selectedShapeIndices.length > 0) {
            const dx = (e.clientX - dragRef.current.sx) / scale;
            const dy_svg = (e.clientY - dragRef.current.sy) / scale;
            const dy = toCartesianY(dy_svg); // Flip Y delta

            const newEntities = deepClone(currentAsset.entities);
            const targetIdx = selectedShapeIndices[0];
            const targetShape = newEntities[targetIdx];
            const resizeMode = dragRef.current.resizeMode;

            // Cartesian Resize Logic
            if (resizeMode === 'both') {
                let newW = dragRef.current.shapeW + dx;
                let newH = dragRef.current.shapeH + dy;
                if (!e.shiftKey) {
                    newW = Math.round(newW / SNAP_UNIT) * SNAP_UNIT;
                    newH = Math.round(newH / SNAP_UNIT) * SNAP_UNIT;
                }
                newEntities[targetIdx] = { ...targetShape, w: Math.max(10, newW), h: Math.max(10, newH) };
            } else if (resizeMode === 'width') {
                let newW = dragRef.current.shapeW + dx;
                if (!e.shiftKey) newW = Math.round(newW / SNAP_UNIT) * SNAP_UNIT;
                newEntities[targetIdx] = { ...targetShape, w: Math.max(10, newW) };
            } else if (resizeMode === 'height') {
                let newH = dragRef.current.shapeH + dy;
                if (!e.shiftKey) newH = Math.round(newH / SNAP_UNIT) * SNAP_UNIT;
                newEntities[targetIdx] = { ...targetShape, h: Math.max(10, newH) };
            }
            updateLocalEntities(newEntities);
        } else if (mode === 'draggingShape') {
            const rawDx = (e.clientX - dragRef.current.sx) / scale;
            const rawDySvg = (e.clientY - dragRef.current.sy) / scale;
            const rawDy = toCartesianY(rawDySvg); // Flip

            let moveX = rawDx; let moveY = rawDy;
            if (currentAsset.snap && !e.shiftKey) {
                const anchorX = dragRef.current.anchorX || 0;
                const anchorY = dragRef.current.anchorY || 0;
                const targetX = anchorX + rawDx;
                const targetY = anchorY + rawDy;
                const snappedX = Math.round(targetX / SNAP_UNIT) * SNAP_UNIT;
                const snappedY = Math.round(targetY / SNAP_UNIT) * SNAP_UNIT;
                moveX = snappedX - anchorX;
                moveY = snappedY - anchorY;
            }

            const newEntities = deepClone(currentAsset.entities);
            const initialShapes = dragRef.current.initialShapes || [];
            initialShapes.forEach(({ index, data }) => {
                let updatedShape = { ...newEntities[index] };
                if (data.x !== undefined) updatedShape.x = (data.x || 0) + moveX;
                if (data.y !== undefined) updatedShape.y = (data.y || 0) + moveY;
                if (data.cx !== undefined) updatedShape.cx = (data.cx || 0) + moveX;
                if (data.cy !== undefined) updatedShape.cy = (data.cy || 0) + moveY;
                if (data.points) updatedShape.points = data.points.map(p => ({ ...p, x: p.x + moveX, y: p.y + moveY }));
                newEntities[index] = updatedShape;
            });
            updateLocalEntities(newEntities);
        } else if (mode === 'draggingPoint' && selectedShapeIndices.length > 0 && selectedPointIndex !== null) {
            const dx = (e.clientX - dragRef.current.sx) / scale;
            const dy_svg = (e.clientY - dragRef.current.sy) / scale;
            const dy = toCartesianY(dy_svg);

            const newEntities = deepClone(currentAsset.entities);
            const targetIdx = selectedShapeIndices[0];
            const pts = [...newEntities[targetIdx].points];
            let nx = dragRef.current.pointX + dx;
            let ny = dragRef.current.pointY + dy;
            if (!e.shiftKey) {
                nx = Math.round(nx / SNAP_UNIT) * SNAP_UNIT;
                ny = Math.round(ny / SNAP_UNIT) * SNAP_UNIT;
            }
            pts[selectedPointIndex] = { ...pts[selectedPointIndex], x: nx, y: ny };
            newEntities[targetIdx].points = pts;
            // Update Bounds for Polygon
            if (newEntities[targetIdx].type === 'polygon') {
                const xs = pts.map(p => p.x); const ys = pts.map(p => p.y);
                newEntities[targetIdx].x = Math.min(...xs);
                newEntities[targetIdx].y = Math.min(...ys);
                newEntities[targetIdx].w = Math.max(...xs) - newEntities[targetIdx].x;
                newEntities[targetIdx].h = Math.max(...ys) - newEntities[targetIdx].y;
            }
            updateLocalEntities(newEntities);
        } else if (mode === 'draggingHandle' && selectedShapeIndices.length > 0 && selectedPointIndex !== null) {
            const dx = (e.clientX - dragRef.current.sx) / scale;
            const dy_svg = (e.clientY - dragRef.current.sy) / scale;
            const dy = toCartesianY(dy_svg);

            const newEntities = deepClone(currentAsset.entities);
            const targetIdx = selectedShapeIndices[0];
            const pts = [...newEntities[targetIdx].points];
            const pt = { ...pts[selectedPointIndex] };
            const handles = [...pt.handles];
            handles[dragRef.current.handleIndex] = { x: dragRef.current.handleX + dx, y: dragRef.current.handleY + dy };
            pt.handles = handles; pts[selectedPointIndex] = pt; newEntities[targetIdx].points = pts;
            updateLocalEntities(newEntities);
        } else if (mode === 'draggingAngle' && selectedShapeIndices.length > 0) {
            const targetIdx = selectedShapeIndices[0];
            // Angle in SVG space (CW)
            const angleSvg = Math.atan2(e.clientY - dragRef.current.cy, e.clientX - dragRef.current.cx) * 180 / Math.PI;
            // Convert to Cartesian (CCW)
            const angleCart = toCartesianRotation(angleSvg);

            const deg = (angleCart + 360) % 360;
            const snapped = e.shiftKey ? deg : Math.round(deg / 15) * 15;

            const newEntities = deepClone(currentAsset.entities);
            newEntities[targetIdx][dragRef.current.targetProp] = snapped;
            updateLocalEntities(newEntities);
        } else if (mode === 'draggingRotation' && selectedShapeIndices.length > 0) {
            const targetIdx = selectedShapeIndices[0];
            const currentAngleSvg = Math.atan2(e.clientY - dragRef.current.cy, e.clientX - dragRef.current.cx) * 180 / Math.PI;
            const deltaSvg = currentAngleSvg - dragRef.current.startAngle;
            // Rotation is CCW in Cartesian
            const deltaCart = toCartesianRotation(deltaSvg);

            let newRot = (dragRef.current.initialRotation + deltaCart + 360) % 360;
            if (!e.shiftKey) newRot = Math.round(newRot / 15) * 15;

            const newEntities = deepClone(currentAsset.entities);
            newEntities[targetIdx].rotation = newRot;
            updateLocalEntities(newEntities);
        } else if (mode === 'draggingRadius' && selectedShapeIndices.length > 0) {
            const targetIdx = selectedShapeIndices[0];
            const dx = (e.clientX - dragRef.current.sx) / scale;
            // Radius is scalar, just use dx for rx? or magnitude?
            // Usually dragging handle changes magnitude.
            // Simplified: just use dx for now as in original code.

            let newVal = dragRef.current.initialVal + dx;
            if (!e.shiftKey) newVal = Math.round(newVal / SNAP_UNIT) * SNAP_UNIT;
            newVal = Math.max(1, newVal);
            const newEntities = deepClone(currentAsset.entities);
            newEntities[targetIdx][dragRef.current.targetProp] = newVal;
            updateLocalEntities(newEntities);
        }
    };

    const handleUp = () => {
        setMarquee(null);
        setCursorMode('idle');

        let finalAsset = { ...localAssetRef.current };

        if (dragRef.current.mode !== 'idle' && dragRef.current.mode !== 'marquee' && dragRef.current.mode !== 'panning') {
             const entities = finalAsset.entities || [];
             let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
             let hasEntities = entities.length > 0;

             if (hasEntities) {
                 entities.forEach(s => {
                     const bounds = getRotatedAABB(s);
                     if (bounds.minX < minX) minX = bounds.minX;
                     if (bounds.maxX > maxX) maxX = bounds.maxX;
                     if (bounds.minY < minY) minY = bounds.minY;
                     if (bounds.maxY > maxY) maxY = bounds.maxY;
                 });
             }

            if (hasEntities && minX !== Infinity) {
                const w = Math.round(maxX - minX); const h = Math.round(maxY - minY);
                const bx = Math.round(minX); const by = Math.round(minY);
                if (finalAsset.w !== w || finalAsset.h !== h || finalAsset.boundX !== bx || finalAsset.boundY !== by) {
                    finalAsset = { ...finalAsset, boundX: bx, boundY: by, w, h };
                }
            }
            setLocalAssets(prev => prev.map(a => a.id === designTargetId ? finalAsset : a));
        }
        dragRef.current = { mode: 'idle' };
    };

    const handleDeleteShape = (index) => {
        if (!confirm('このシェイプを削除しますか？')) return;
        const newEntities = localAsset.entities.filter((_, i) => i !== index);
        const updated = { ...localAsset, entities: newEntities, isDefaultShape: false };
        setLocalAsset(updated);
        setLocalAssets(prev => prev.map(a => a.id === designTargetId ? updated : a));
        setSelectedShapeIndices([]);
    };

    const entities = (localAsset && localAsset.entities && localAsset.entities.length > 0)
        ? localAsset.entities
        : (localAsset ? [{
            type: localAsset.shape || 'rect',
            w: localAsset.w,
            h: localAsset.h,
            x: 0,
            y: 0,
            color: localAsset.color,
            points: localAsset.points || createRectPath(localAsset.w, localAsset.h)
          }] : []);

    return <DesignCanvasRender
        viewState={viewState}
        asset={localAsset}
        entities={entities}
        selectedShapeIndices={selectedShapeIndices}
        selectedPointIndex={selectedPointIndex}
        onDown={handleDown}
        onMove={handleMove}
        onUp={handleUp}
        onDeleteShape={handleDeleteShape}
        svgRef={svgRef}
        marquee={marquee}
        cursorMode={cursorMode}
    />;
};
