import React, { useState, useRef, useEffect } from 'react';
import { BASE_SCALE, SNAP_UNIT } from '../lib/constants';
import { generateSvgPath, generateEllipsePath, createRectPath } from '../lib/utils';
import { useStore } from '../lib/store';

// Render Component
const DesignCanvasRender = ({ viewState, asset, shapes, selectedShapeIndices, selectedPointIndex, onDown, onMove, onUp, onDeleteShape, svgRef, marquee, cursorMode }) => {
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
                    {asset && (
                        <g>
                            <rect x={asset.boundX * BASE_SCALE || 0} y={asset.boundY * BASE_SCALE || 0} width={asset.w * BASE_SCALE} height={asset.h * BASE_SCALE} fill="none" stroke="blue" strokeWidth="1" strokeDasharray="4 2" opacity="0.3" pointerEvents="none" />

                            {shapes.map((s, i) => {
                                const isSelected = selectedShapeIndices.includes(i);
                                const style = { fill: s.color || asset.color, stroke: isSelected ? "#3b82f6" : "#999", strokeWidth: isSelected ? 2 : 1, cursor: 'move' };
                                const rot = s.rotation || 0;
                                const rotateTransform = rot && s.type === 'ellipse' ? `rotate(${rot} ${(s.cx || 0) * BASE_SCALE} ${(s.cy || 0) * BASE_SCALE})` : '';
                                return (
                                    <g key={i} onPointerDown={(e) => onDown(e, i)}>
                                        {s.type === 'circle'
                                            ? <ellipse cx={(s.x + s.w / 2) * BASE_SCALE} cy={(s.y + s.h / 2) * BASE_SCALE} rx={s.w * BASE_SCALE / 2} ry={s.h * BASE_SCALE / 2} {...style} />
                                            : s.type === 'ellipse'
                                                ? <path d={generateEllipsePath(s)} transform={rotateTransform} {...style} />
                                                : <path d={generateSvgPath(s.points)} {...style} />
                                        }
                                        {isSelected && s.type === 'ellipse' && (() => {
                                            const cx = (s.cx || 0) * BASE_SCALE;
                                            const cy = (s.cy || 0) * BASE_SCALE;
                                            const rxs = (s.rx || 50) * BASE_SCALE;
                                            const rys = (s.ry || 50) * BASE_SCALE;
                                            const startAngle = s.startAngle || 0;
                                            const endAngle = s.endAngle || 360;
                                            const startRad = startAngle * Math.PI / 180;
                                            const endRad = endAngle * Math.PI / 180;
                                            const sx = cx + rxs * Math.cos(startRad);
                                            const sy = cy + rys * Math.sin(startRad);
                                            const ex = cx + rxs * Math.cos(endRad);
                                            const ey = cy + rys * Math.sin(endRad);
                                            const rotHandleY = cy - rys - 20;
                                            return (
                                                <g transform={rotateTransform}>
                                                    <circle cx={cx} cy={cy} r="6" fill="red" stroke="white" strokeWidth="2" className="cursor-move" />
                                                    <rect x={cx + rxs - 4} y={cy - 4} width="8" height="8" fill="orange" stroke="white" strokeWidth="1" className="cursor-ew-resize" onPointerDown={(e) => onDown(e, i, 'rx')} />
                                                    <rect x={cx - 4} y={cy + rys - 4} width="8" height="8" fill="orange" stroke="white" strokeWidth="1" className="cursor-ns-resize" onPointerDown={(e) => onDown(e, i, 'ry')} />
                                                    <rect x={cx + rxs - 4} y={cy + rys - 4} width="8" height="8" fill="yellow" stroke="orange" strokeWidth="1" className="cursor-nwse-resize" onPointerDown={(e) => onDown(e, i, 'rxy')} />
                                                    <line x1={cx} y1={cy - rys} x2={cx} y2={rotHandleY} stroke="cyan" strokeWidth="1" strokeDasharray="3,2" />
                                                    <circle cx={cx} cy={rotHandleY} r="5" fill="cyan" stroke="white" strokeWidth="1" className="cursor-pointer" onPointerDown={(e) => onDown(e, i, 'rotation')} />
                                                    <line x1={cx} y1={cy} x2={sx * 0.6 + cx * 0.4} y2={sy * 0.6 + cy * 0.4} stroke="green" strokeWidth="1" strokeDasharray="3,2" />
                                                    <line x1={cx} y1={cy} x2={ex * 0.6 + cx * 0.4} y2={ey * 0.6 + cy * 0.4} stroke="purple" strokeWidth="1" strokeDasharray="3,2" />
                                                    <circle cx={sx * 0.6 + cx * 0.4} cy={sy * 0.6 + cy * 0.4} r="5" fill="green" stroke="white" strokeWidth="1" className="cursor-pointer" onPointerDown={(e) => onDown(e, i, 'startAngle')} />
                                                    <circle cx={ex * 0.6 + cx * 0.4} cy={ey * 0.6 + cy * 0.4} r="5" fill="purple" stroke="white" strokeWidth="1" className="cursor-pointer" onPointerDown={(e) => onDown(e, i, 'endAngle')} />
                                                </g>
                                            );
                                        })()}
                                        {isSelected && s.type === 'polygon' && s.points.map((p, pid) => (
                                            <React.Fragment key={pid}>
                                                <circle cx={p.x * BASE_SCALE} cy={p.y * BASE_SCALE} r="5" fill={selectedPointIndex === pid ? "red" : "white"} stroke="blue" strokeWidth="2" className="cursor-crosshair" onPointerDown={(e) => onDown(e, i, pid)} />
                                                {p.handles && p.handles.map((h, hid) => (
                                                    <React.Fragment key={`h-${pid}-${hid}`}>
                                                        <line x1={p.x * BASE_SCALE} y1={p.y * BASE_SCALE} x2={h.x * BASE_SCALE} y2={h.y * BASE_SCALE} stroke="orange" strokeWidth="1" strokeDasharray="3,2" />
                                                        <rect x={h.x * BASE_SCALE - 4} y={h.y * BASE_SCALE - 4} width="8" height="8" fill="orange" stroke="darkorange" strokeWidth="1" className="cursor-move" onPointerDown={(e) => onDown(e, i, pid, null, hid)} />
                                                    </React.Fragment>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                        {isSelected && s.type === 'polygon' && (() => {
                                            const maxX = Math.max(...s.points.map(p => p.x));
                                            const minY = Math.min(...s.points.map(p => p.y));
                                            return (
                                                <g transform={`translate(${maxX * BASE_SCALE + 10}, ${minY * BASE_SCALE - 10})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(i)}>
                                                    <circle r="8" fill="red" />
                                                    <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" /><line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
                                                </g>
                                            );
                                        })()}
                                        {isSelected && (s.type === 'circle' || s.type === 'rect') && (
                                            <g>
                                                <rect x={(s.x + s.w - 5 / BASE_SCALE) * BASE_SCALE} y={(s.y + s.h - 5 / BASE_SCALE) * BASE_SCALE} width="10" height="10" fill="yellow" stroke="blue" strokeWidth="2" className="cursor-nwse-resize" onPointerDown={(e) => onDown(e, i, null, 'both')} />
                                                <rect x={(s.x + s.w - 5 / BASE_SCALE) * BASE_SCALE} y={(s.y + s.h / 2 - 5 / BASE_SCALE) * BASE_SCALE} width="10" height="10" fill="lightblue" stroke="blue" strokeWidth="2" className="cursor-ew-resize" onPointerDown={(e) => onDown(e, i, null, 'horizontal')} />
                                                <rect x={(s.x + s.w / 2 - 5 / BASE_SCALE) * BASE_SCALE} y={(s.y + s.h - 5 / BASE_SCALE) * BASE_SCALE} width="10" height="10" fill="lightgreen" stroke="blue" strokeWidth="2" className="cursor-ns-resize" onPointerDown={(e) => onDown(e, i, null, 'vertical')} />
                                                <g transform={`translate(${(s.x + s.w) * BASE_SCALE + 10}, ${s.y * BASE_SCALE - 10})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(i)}>
                                                    <circle r="8" fill="red" />
                                                    <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" /><line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
                                                </g>
                                            </g> // Fixed: Was missing closing </g>
                                        )}
                                        {/* Dimensions */}
                                        {isSelected && (() => {
                                            const fontSize = 12; const textFill = "blue"; const strokeColor = "blue"; const strokeWidth = 1; const offset = 15;
                                            if (s.type === 'circle' && (s.w || s.h)) {
                                                const cx = (s.x + s.w / 2) * BASE_SCALE; const cy = (s.y + s.h / 2) * BASE_SCALE; const r = (s.w / 2);
                                                return (<g pointerEvents="none"><line x1={cx} y1={cy} x2={cx + s.w * BASE_SCALE / 2} y2={cy} stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="2,2" /><text x={cx + s.w * BASE_SCALE / 4} y={cy - 5} fill={textFill} fontSize={fontSize} textAnchor="middle">r: {Math.round(r)}</text></g>);
                                            } else if (s.type === 'ellipse' && (s.rx || s.ry)) {
                                                const cx = (s.cx || 0) * BASE_SCALE; const cy = (s.cy || 0) * BASE_SCALE; const rx = s.rx || 50; const ry = s.ry || 50;
                                                return (<g pointerEvents="none" transform={rotateTransform}><line x1={cx} y1={cy} x2={cx + rx * BASE_SCALE} y2={cy} stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="2,2" /><text x={cx + rx * BASE_SCALE / 2} y={cy - 5} fill={textFill} fontSize={fontSize} textAnchor="middle">rx: {Math.round(rx)}</text><line x1={cx} y1={cy} x2={cx} y2={cy + ry * BASE_SCALE} stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="2,2" /><text x={cx + 5} y={cy + ry * BASE_SCALE / 2} fill={textFill} fontSize={fontSize} textAnchor="start" dominantBaseline="middle">ry: {Math.round(ry)}</text></g>);
                                            } else if (s.type === 'polygon' && s.points) {
                                                return (<g pointerEvents="none">{s.points.map((p, idx) => { const nextP = s.points[(idx + 1) % s.points.length]; const mx = ((p.x + nextP.x) / 2) * BASE_SCALE; const my = ((p.y + nextP.y) / 2) * BASE_SCALE; const dist = Math.sqrt(Math.pow(nextP.x - p.x, 2) + Math.pow(nextP.y - p.y, 2)); return (<text key={idx} x={mx} y={my} fill={textFill} fontSize={fontSize} textAnchor="middle" dominantBaseline="middle" stroke="white" strokeWidth="3" paintOrder="stroke">{Math.round(dist)}</text>); })}</g>);
                                            } else {
                                                const x = (s.x || 0) * BASE_SCALE; const y = (s.y || 0) * BASE_SCALE; const w = (s.w || 0); const h = (s.h || 0);
                                                return (<g pointerEvents="none"><line x1={x} y1={y - offset} x2={x + w * BASE_SCALE} y2={y - offset} stroke={strokeColor} strokeWidth={strokeWidth} markerEnd="url(#arrow)" markerStart="url(#arrow)" /><text x={x + w * BASE_SCALE / 2} y={y - offset - 5} fill={textFill} fontSize={fontSize} textAnchor="middle">{Math.round(w)}</text><line x1={x - offset} y1={y} x2={x - offset} y2={y + h * BASE_SCALE} stroke={strokeColor} strokeWidth={strokeWidth} markerEnd="url(#arrow)" markerStart="url(#arrow)" /><text x={x - offset - 5} y={y + h * BASE_SCALE / 2} fill={textFill} fontSize={fontSize} textAnchor="end" dominantBaseline="middle">{Math.round(h)}</text></g>);
                                            }
                                        })()}
                                    </g>
                                );
                            })}
                        </g>
                    )}
                </g>
            </svg>
            {marquee && (
                <div style={{ position: 'fixed', left: Math.min(marquee.sx, marquee.ex), top: Math.min(marquee.sy, marquee.ey), width: Math.abs(marquee.ex - marquee.sx), height: Math.abs(marquee.ey - marquee.sy), border: '2px dashed #3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', pointerEvents: 'none', zIndex: 9999 }} />
            )}
        </div>
    );
};

export const DesignCanvas = ({ viewState, setViewState, assets, designTargetId, setLocalAssets, setGlobalAssets }) => {
    // Select from store
    const selectedShapeIndices = useStore(state => state.selectedShapeIndices);
    const setSelectedShapeIndices = useStore(state => state.setSelectedShapeIndices);
    const selectedPointIndex = useStore(state => state.selectedPointIndex);
    const setSelectedPointIndex = useStore(state => state.setSelectedPointIndex);

    const [localAsset, setLocalAsset] = useState(null);
    const dragRef = useRef({ mode: 'idle' });
    const [cursorMode, setCursorMode] = useState('idle');
    const svgRef = useRef(null);
    const [marquee, setMarquee] = useState(null);

    // Sync from Store -> Local
    const assetFromStore = assets.find(a => a.id === designTargetId);

    // Use ref to keep track of latest local asset for event handlers (to solve stale closure issue)
    const localAssetRef = useRef(null);
    useEffect(() => {
        localAssetRef.current = localAsset;
    }, [localAsset]);

    useEffect(() => {
        if (assetFromStore && dragRef.current.mode === 'idle') {
             setLocalAsset(assetFromStore);
        }
    }, [assetFromStore]);

    if (!localAsset) return null;

    const updateLocalShapes = (newShapes) => {
        const updated = { ...localAsset, shapes: newShapes, isDefaultShape: false };
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

        // Safety check for shapes array
        const currentShapes = localAsset.shapes || [];

        if (resizeMode && shapeIndex !== null && currentShapes[shapeIndex]) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            setSelectedPointIndex(null);
            const shape = currentShapes[shapeIndex];
            dragRef.current = { mode: 'resizing', sx: e.clientX, sy: e.clientY, shapeW: shape.w, shapeH: shape.h, shapeX: shape.x || 0, shapeY: shape.y || 0, resizeMode };
            setCursorMode('resizing');
            return;
        }

        if (handleIndex !== null && pointIndex !== null && shapeIndex !== null && currentShapes[shapeIndex]) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            setSelectedPointIndex(pointIndex);
            const shape = currentShapes[shapeIndex];
            const handle = shape.points[pointIndex].handles[handleIndex];
            dragRef.current = { mode: 'draggingHandle', sx: e.clientX, sy: e.clientY, handleX: handle.x, handleY: handle.y, handleIndex };
            setCursorMode('draggingHandle');
            return;
        }

        if ((pointIndex === 'startAngle' || pointIndex === 'endAngle') && shapeIndex !== null && currentShapes[shapeIndex]) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            const shape = currentShapes[shapeIndex];
            dragRef.current = { mode: 'draggingAngle', targetProp: pointIndex, cx: (shape.cx || 0) * viewState.scale * BASE_SCALE + viewState.x + rect.left, cy: (shape.cy || 0) * viewState.scale * BASE_SCALE + viewState.y + rect.top };
            setCursorMode('draggingAngle');
            return;
        }

        if (pointIndex === 'rotation' && shapeIndex !== null && currentShapes[shapeIndex]) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            const shape = currentShapes[shapeIndex];
            let cx = (shape.x || 0) + (shape.w || 0) / 2;
            let cy = (shape.y || 0) + (shape.h || 0) / 2;
            if (shape.type === 'ellipse' || shape.type === 'arc') { cx = shape.cx || 0; cy = shape.cy || 0; }
            dragRef.current = { mode: 'draggingRotation', cx: cx * viewState.scale * BASE_SCALE + viewState.x + rect.left, cy: cy * viewState.scale * BASE_SCALE + viewState.y + rect.top, initialRotation: shape.rotation || 0, startAngle: 0 };
            const mx = e.clientX; const my = e.clientY;
            dragRef.current.startAngle = Math.atan2(my - dragRef.current.cy, mx - dragRef.current.cx) * 180 / Math.PI;
            setCursorMode('draggingRotation');
            return;
        }

        if ((pointIndex === 'rx' || pointIndex === 'ry') && shapeIndex !== null && currentShapes[shapeIndex]) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            const shape = currentShapes[shapeIndex];
            dragRef.current = { mode: 'draggingRadius', targetProp: pointIndex, sx: e.clientX, sy: e.clientY, initialVal: shape[pointIndex] || 50 };
            setCursorMode('ew-resize');
            return;
        }

        if (pointIndex !== null && shapeIndex !== null && currentShapes[shapeIndex]) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            setSelectedPointIndex(pointIndex);
            const shape = currentShapes[shapeIndex];
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
            const initialShapes = newSelectedIndices.map(i => ({ index: i, data: JSON.parse(JSON.stringify(currentShapes[i])) }));
            const anchorIndex = newSelectedIndices[0];
            const anchorShape = currentShapes[anchorIndex];
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

        // Use localAsset directly from state or ref?
        // Since handleMove updates state, we want to base calculation on LATEST state.
        // But drag deltas are usually based on INITIAL state + delta (dragRef).
        // For marquee selection we need current asset shapes.
        const currentAsset = localAsset; // This is from closure, but since this is a render-based handler it should be fresh enough or we use ref?
        // Actually drag operations use dragRef.current.initialShapes so they are safe from stale state regarding start position.
        // Marquee needs current shapes positions.

        if (mode === 'panning') {
            const dx = e.clientX - dragRef.current.sx;
            const dy = e.clientY - dragRef.current.sy;
            setViewState(p => ({ ...p, x: dragRef.current.vx + dx, y: dragRef.current.vy + dy }));
        } else if (mode === 'marquee') {
            setMarquee(prev => prev ? { ...prev, ex: e.clientX, ey: e.clientY } : null);
            if (svgRef.current) {
                const rect = svgRef.current.getBoundingClientRect();
                const scale = viewState.scale * BASE_SCALE;
                const toWorld = (screenX, screenY) => ({ x: (screenX - rect.left - viewState.x) / scale, y: (screenY - rect.top - viewState.y) / scale });
                const p1 = toWorld(dragRef.current.sx, dragRef.current.sy);
                const p2 = toWorld(e.clientX, e.clientY);
                const minX = Math.min(p1.x, p2.x); const maxX = Math.max(p1.x, p2.x);
                const minY = Math.min(p1.y, p2.y); const maxY = Math.max(p1.y, p2.y);
                const inBoxIndices = (currentAsset.shapes || []).map((s, i) => {
                    let cx, cy;
                    if (s.type === 'polygon' && s.points) {
                        const xs = s.points.map(p => p.x); const ys = s.points.map(p => p.y);
                        cx = Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) / 2; cy = Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) / 2;
                    } else if (s.type === 'ellipse' || s.type === 'arc' || s.type === 'circle') { cx = s.cx !== undefined ? s.cx : (s.x + s.w / 2); cy = s.cy !== undefined ? s.cy : (s.y + s.h / 2); }
                    else { cx = (s.x || 0) + (s.w || 0) / 2; cy = (s.y || 0) + (s.h || 0) / 2; }
                    return (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) ? i : -1;
                }).filter(i => i !== -1);
                const initialSelected = dragRef.current.prevSelectedIndices || [];
                setSelectedShapeIndices([...new Set([...initialSelected, ...inBoxIndices])]);
            }
        } else if (mode === 'resizing' && selectedShapeIndices.length > 0) {
            const dx = (e.clientX - dragRef.current.sx) / viewState.scale / BASE_SCALE;
            const dy = (e.clientY - dragRef.current.sy) / viewState.scale / BASE_SCALE;
            const newShapes = [...currentAsset.shapes];
            const targetIdx = selectedShapeIndices[0];
            const targetShape = newShapes[targetIdx];
            const resizeMode = dragRef.current.resizeMode;
            if (resizeMode === 'both') {
                let newW = dragRef.current.shapeW + dx; let newH = dragRef.current.shapeH + dy;
                if (!e.shiftKey) { newW = Math.round(newW / SNAP_UNIT) * SNAP_UNIT; newH = Math.round(newH / SNAP_UNIT) * SNAP_UNIT; }
                newShapes[targetIdx] = { ...targetShape, w: Math.max(10, newW), h: Math.max(10, newH) };
            } else if (resizeMode === 'width') {
                let newW = dragRef.current.shapeW + dx; if (!e.shiftKey) newW = Math.round(newW / SNAP_UNIT) * SNAP_UNIT;
                newShapes[targetIdx] = { ...targetShape, w: Math.max(10, newW) };
            } else if (resizeMode === 'height') {
                let newH = dragRef.current.shapeH + dy; if (!e.shiftKey) newH = Math.round(newH / SNAP_UNIT) * SNAP_UNIT;
                newShapes[targetIdx] = { ...targetShape, h: Math.max(10, newH) };
            }
            updateLocalShapes(newShapes);
        } else if (mode === 'draggingShape') {
            const rawDx = (e.clientX - dragRef.current.sx) / viewState.scale / BASE_SCALE;
            const rawDy = (e.clientY - dragRef.current.sy) / viewState.scale / BASE_SCALE;
            let moveX = rawDx; let moveY = rawDy;
            if (currentAsset.snap && !e.shiftKey) {
                const anchorX = dragRef.current.anchorX || 0; const anchorY = dragRef.current.anchorY || 0;
                const targetX = anchorX + rawDx; const targetY = anchorY + rawDy;
                const snappedX = Math.round(targetX / SNAP_UNIT) * SNAP_UNIT; const snappedY = Math.round(targetY / SNAP_UNIT) * SNAP_UNIT;
                moveX = snappedX - anchorX; moveY = snappedY - anchorY;
            }
            const newShapes = [...currentAsset.shapes];
            const initialShapes = dragRef.current.initialShapes || [];
            initialShapes.forEach(({ index, data }) => {
                let updatedShape = { ...newShapes[index] };
                if (data.x !== undefined) updatedShape.x = (data.x || 0) + moveX;
                if (data.y !== undefined) updatedShape.y = (data.y || 0) + moveY;
                if (data.cx !== undefined) updatedShape.cx = (data.cx || 0) + moveX;
                if (data.cy !== undefined) updatedShape.cy = (data.cy || 0) + moveY;
                if (data.points) updatedShape.points = data.points.map(p => ({ ...p, x: p.x + moveX, y: p.y + moveY }));
                newShapes[index] = updatedShape;
            });
            updateLocalShapes(newShapes);
        } else if (mode === 'draggingPoint' && selectedShapeIndices.length > 0 && selectedPointIndex !== null) {
            const dx = (e.clientX - dragRef.current.sx) / viewState.scale / BASE_SCALE;
            const dy = (e.clientY - dragRef.current.sy) / viewState.scale / BASE_SCALE;
            const newShapes = [...currentAsset.shapes];
            const targetIdx = selectedShapeIndices[0];
            const pts = [...newShapes[targetIdx].points];
            let nx = dragRef.current.pointX + dx; let ny = dragRef.current.pointY + dy;
            if (!e.shiftKey) { nx = Math.round(nx / SNAP_UNIT) * SNAP_UNIT; ny = Math.round(ny / SNAP_UNIT) * SNAP_UNIT; }
            pts[selectedPointIndex] = { ...pts[selectedPointIndex], x: nx, y: ny };
            newShapes[targetIdx].points = pts;
            if (newShapes[targetIdx].type === 'polygon') {
                const xs = pts.map(p => p.x); const ys = pts.map(p => p.y);
                newShapes[targetIdx].x = Math.min(...xs); newShapes[targetIdx].y = Math.min(...ys);
                newShapes[targetIdx].w = Math.max(...xs) - newShapes[targetIdx].x; newShapes[targetIdx].h = Math.max(...ys) - newShapes[targetIdx].y;
            }
            updateLocalShapes(newShapes);
        } else if (mode === 'draggingHandle' && selectedShapeIndices.length > 0 && selectedPointIndex !== null) {
            const dx = (e.clientX - dragRef.current.sx) / viewState.scale / BASE_SCALE;
            const dy = (e.clientY - dragRef.current.sy) / viewState.scale / BASE_SCALE;
            const newShapes = [...currentAsset.shapes];
            const targetIdx = selectedShapeIndices[0];
            const pts = [...newShapes[targetIdx].points];
            const pt = { ...pts[selectedPointIndex] };
            const handles = [...pt.handles];
            handles[dragRef.current.handleIndex] = { x: dragRef.current.handleX + dx, y: dragRef.current.handleY + dy };
            pt.handles = handles; pts[selectedPointIndex] = pt; newShapes[targetIdx].points = pts;
            updateLocalShapes(newShapes);
        } else if (mode === 'draggingAngle' && selectedShapeIndices.length > 0) {
            const targetIdx = selectedShapeIndices[0];
            const angle = Math.atan2(e.clientY - dragRef.current.cy, e.clientX - dragRef.current.cx) * 180 / Math.PI;
            const deg = (angle + 360) % 360;
            const snapped = e.shiftKey ? deg : Math.round(deg / 15) * 15;
            const newShapes = [...currentAsset.shapes];
            newShapes[targetIdx][dragRef.current.targetProp] = snapped;
            updateLocalShapes(newShapes);
        } else if (mode === 'draggingRotation' && selectedShapeIndices.length > 0) {
            const targetIdx = selectedShapeIndices[0];
            const currentAngle = Math.atan2(e.clientY - dragRef.current.cy, e.clientX - dragRef.current.cx) * 180 / Math.PI;
            const delta = currentAngle - dragRef.current.startAngle;
            let newRot = (dragRef.current.initialRotation + delta + 360) % 360;
            if (!e.shiftKey) newRot = Math.round(newRot / 15) * 15;
            const newShapes = [...currentAsset.shapes];
            newShapes[targetIdx].rotation = newRot;
            updateLocalShapes(newShapes);
        } else if (mode === 'draggingRadius' && selectedShapeIndices.length > 0) {
            const targetIdx = selectedShapeIndices[0];
            const scale = viewState.scale * BASE_SCALE;
            const dx = (e.clientX - dragRef.current.sx) / scale;
            let newVal = dragRef.current.initialVal + dx;
            if (!e.shiftKey) newVal = Math.round(newVal / SNAP_UNIT) * SNAP_UNIT;
            newVal = Math.max(1, newVal);
            const newShapes = [...currentAsset.shapes];
            newShapes[targetIdx][dragRef.current.targetProp] = newVal;
            updateLocalShapes(newShapes);
        }
    };

    const handleUp = () => {
        setMarquee(null);
        setCursorMode('idle');

        // COMMIT to STORE
        // Use localAssetRef to get the LATEST state including the last drag update
        let finalAsset = { ...localAssetRef.current };

        if (dragRef.current.mode !== 'idle' && dragRef.current.mode !== 'marquee' && dragRef.current.mode !== 'panning') {
             const shapes = finalAsset.shapes || [];
             let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
             let hasPoints = false;

             shapes.forEach(s => {
                if (s.points) {
                    hasPoints = true;
                    s.points.forEach(p => { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; });
                } else if (s.type === 'ellipse' || s.type === 'arc' || s.type === 'circle') {
                    hasPoints = true;
                    const cx = s.cx !== undefined ? s.cx : (s.x + s.w / 2); const cy = s.cy !== undefined ? s.cy : (s.y + s.h / 2);
                    const rx = s.rx !== undefined ? s.rx : (s.w / 2); const ry = s.ry !== undefined ? s.ry : (s.h / 2);
                    if (cx - rx < minX) minX = cx - rx; if (cx + rx > maxX) maxX = cx + rx; if (cy - ry < minY) minY = cy - ry; if (cy + ry > maxY) maxY = cy + ry;
                } else {
                    hasPoints = true;
                    const x = s.x || 0; const y = s.y || 0; const w = s.w || 0; const h = s.h || 0;
                    if (x < minX) minX = x; if (x + w > maxX) maxX = x + w; if (y < minY) minY = y; if (y + h > maxY) maxY = y + h;
                }
            });

            if (hasPoints && minX !== Infinity) {
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
        const newShapes = localAsset.shapes.filter((_, i) => i !== index);
        const updated = { ...localAsset, shapes: newShapes, isDefaultShape: false };
        setLocalAsset(updated);
        setLocalAssets(prev => prev.map(a => a.id === designTargetId ? updated : a));
        setSelectedShapeIndices([]);
    };

    // Safe shapes access
    const shapes = (localAsset && localAsset.shapes && localAsset.shapes.length > 0)
        ? localAsset.shapes
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
        shapes={shapes}
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
