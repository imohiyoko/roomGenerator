import React, { useState, useRef, useEffect } from 'react';
import { BASE_SCALE, SNAP_UNIT } from '../lib/constants';
import { generateSvgPath, generateEllipsePath, createRectPath, toSvgY, toCartesianY, toSvgRotation, toCartesianRotation, deepClone, calculateAssetBounds } from '../lib/utils';
import { useStore } from '../store';
import {
    initiatePanning, initiateMarquee, initiateResizing, initiateDraggingHandle,
    initiateDraggingAngle, initiateDraggingRotation, initiateDraggingRadius,
    initiateDraggingPoint, initiateDraggingShape,
    processPanning, processMarquee, processResizing, processDraggingShape,
    processDraggingPoint, processDraggingHandle, processDraggingAngle,
    processDraggingRotation, processDraggingRadius
} from './DesignCanvas.logic';

/**
 * Render component for the Design Canvas.
 * Handles the visual representation of assets, shapes, handles, and interactions.
 *
 * @param {Object} props - The component props.
 * @param {Object} props.viewState - Current view state (x, y, scale).
 * @param {Object} props.asset - The asset being designed.
 * @param {Array} props.entities - List of shapes/entities in the asset.
 * @param {Array<number>} props.selectedShapeIndices - Indices of selected shapes.
 * @param {number|null} props.selectedPointIndex - Index of the selected point (vertex).
 * @param {Function} props.onDown - Pointer down handler.
 * @param {Function} props.onMove - Pointer move handler.
 * @param {Function} props.onUp - Pointer up handler.
 * @param {Function} props.onDeleteShape - Handler for deleting a shape.
 * @param {React.RefObject} props.svgRef - Ref to the SVG element.
 * @param {Object|null} props.marquee - Marquee selection state.
 * @param {string} props.cursorMode - Current cursor mode.
 * @returns {JSX.Element} The rendered SVG canvas.
 */
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

/**
 * Main container for the Design Mode canvas.
 * Manages state, event handling, and delegates rendering to DesignCanvasRender.
 *
 * @param {Object} props - The component props.
 * @param {Object} props.viewState - Current view state (x, y, scale).
 * @param {Function} props.setViewState - Setter for view state.
 * @param {Array} props.assets - List of all available assets.
 * @param {string} props.designTargetId - ID of the asset currently being designed.
 * @param {Function} props.setLocalAssets - Setter for updating local assets.
 * @param {Function} props.setGlobalAssets - Setter for updating global assets (unused but passed).
 * @returns {JSX.Element|null} The DesignCanvas component.
 */
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
        const updated = { ...localAsset, entities: newEntities, isDefaultShape: false };
        setLocalAsset(updated);
        localAssetRef.current = updated;
    };

    /**
     * Handles pointer down events on the canvas.
     * Initiates dragging, resizing, panning, or marquee selection.
     */
    const handleDown = (e, shapeIndex = null, pointIndex = null, resizeMode = null, handleIndex = null) => {
        if (svgRef.current && e.pointerId) svgRef.current.setPointerCapture(e.pointerId);
        const rect = svgRef.current.getBoundingClientRect();

        // Panning
        if (e.button === 1) {
            dragRef.current = initiatePanning(e, viewState, setCursorMode);
            return;
        }

        // Marquee
        if (shapeIndex === null && e.button === 0) {
            dragRef.current = initiateMarquee(e, setMarquee, setSelectedShapeIndices, selectedShapeIndices);
            return;
        }

        const currentEntities = localAsset.entities || [];

        // Resizing
        if (resizeMode && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateResizing(e, shapeIndex, localAsset, resizeMode, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode);
            return;
        }

        // Handle Dragging
        if (handleIndex !== null && pointIndex !== null && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingHandle(e, shapeIndex, pointIndex, handleIndex, localAsset, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode);
            return;
        }

        // Angle Dragging
        if ((pointIndex === 'startAngle' || pointIndex === 'endAngle') && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingAngle(e, shapeIndex, pointIndex, localAsset, viewState, rect, setSelectedShapeIndices, setCursorMode);
            return;
        }

        // Rotation Dragging
        if (pointIndex === 'rotation' && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingRotation(e, shapeIndex, localAsset, viewState, rect, setSelectedShapeIndices, setCursorMode);
            return;
        }

        // Radius Dragging
        if ((pointIndex === 'rx' || pointIndex === 'ry') && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingRadius(e, shapeIndex, pointIndex, localAsset, setSelectedShapeIndices, setCursorMode);
            return;
        }

        // Point Dragging
        if (pointIndex !== null && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingPoint(e, shapeIndex, pointIndex, localAsset, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode);
            return;
        }

        // Shape Dragging
        if (shapeIndex !== null) {
            dragRef.current = initiateDraggingShape(e, shapeIndex, localAsset, selectedShapeIndices, setSelectedShapeIndices, setCursorMode);
            return;
        }

        setSelectedShapeIndices([]);
        setSelectedPointIndex(null);
    };

    /**
     * Handles pointer move events.
     * Processes ongoing drag/resize operations.
     */
    const handleMove = (e) => {
        const mode = dragRef.current.mode;
        if (mode === 'idle') return;
        e.preventDefault();

        if (mode === 'panning') {
            processPanning(e, dragRef.current, setViewState);
            return;
        }

        if (mode === 'marquee') {
            processMarquee(e, dragRef.current, setMarquee, svgRef, viewState, localAsset, setSelectedShapeIndices);
            return;
        }

        let newEntities = null;

        if (mode === 'resizing' && selectedShapeIndices.length > 0) {
            newEntities = processResizing(e, dragRef.current, localAsset, viewState, selectedShapeIndices);
        } else if (mode === 'draggingShape') {
            newEntities = processDraggingShape(e, dragRef.current, localAsset, viewState);
        } else if (mode === 'draggingPoint' && selectedShapeIndices.length > 0 && selectedPointIndex !== null) {
            newEntities = processDraggingPoint(e, dragRef.current, localAsset, viewState, selectedShapeIndices, selectedPointIndex);
        } else if (mode === 'draggingHandle' && selectedShapeIndices.length > 0 && selectedPointIndex !== null) {
            newEntities = processDraggingHandle(e, dragRef.current, localAsset, viewState, selectedShapeIndices, selectedPointIndex);
        } else if (mode === 'draggingAngle' && selectedShapeIndices.length > 0) {
            newEntities = processDraggingAngle(e, dragRef.current, localAsset, selectedShapeIndices);
        } else if (mode === 'draggingRotation' && selectedShapeIndices.length > 0) {
            newEntities = processDraggingRotation(e, dragRef.current, localAsset, selectedShapeIndices);
        } else if (mode === 'draggingRadius' && selectedShapeIndices.length > 0) {
            newEntities = processDraggingRadius(e, dragRef.current, localAsset, viewState, selectedShapeIndices);
        }

        if (newEntities) {
            updateLocalEntities(newEntities);
        }
    };

    /**
     * Handles pointer up events.
     * Finalizes drag operations and updates global state (undo history).
     */
    const handleUp = () => {
        setMarquee(null);
        setCursorMode('idle');

        let finalAsset = { ...localAssetRef.current };

        if (dragRef.current.mode !== 'idle' && dragRef.current.mode !== 'marquee' && dragRef.current.mode !== 'panning') {
            const entities = finalAsset.entities || [];
            const bounds = calculateAssetBounds(entities);
            if (bounds) {
                if (finalAsset.w !== bounds.w || finalAsset.h !== bounds.h || finalAsset.boundX !== bounds.boundX || finalAsset.boundY !== bounds.boundY) {
                    finalAsset = { ...finalAsset, ...bounds };
                }
            }
            setLocalAsset(finalAsset);
            localAssetRef.current = finalAsset;
            setLocalAssets(prev => prev.map(a => a.id === designTargetId ? finalAsset : a));
        }
        dragRef.current = { mode: 'idle' };
    };

    /**
     * Deletes a shape at the specified index.
     * Updates asset bounds and clears selection.
     * @param {number} index - Index of the shape to delete.
     */
    const handleDeleteShape = (index) => {
        if (!confirm('このシェイプを削除しますか？')) return;
        const newEntities = localAsset.entities.filter((_, i) => i !== index);

        // Calculate new bounds after deletion
        const bounds = calculateAssetBounds(newEntities);
        const updated = {
            ...localAsset,
            entities: newEntities,
            isDefaultShape: false,
            ...(bounds || {})
        };

        setLocalAsset(updated);
        localAssetRef.current = updated;
        setLocalAssets(prev => prev.map(a => a.id === designTargetId ? updated : a));
        setSelectedShapeIndices([]);
        setSelectedPointIndex(null);
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
