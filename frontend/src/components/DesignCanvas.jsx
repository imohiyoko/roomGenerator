import React, { useState, useRef, useEffect } from 'react';
import { BASE_SCALE, SNAP_UNIT } from '../lib/constants';
import { createRectPath, toSvgY, deepClone, calculateAssetBounds, getRotatedAABB } from '../lib/utils';
import { useStore } from '../store';
import { GridRenderer } from './canvas/GridRenderer';
import { ShapeRenderer } from './canvas/ShapeRenderer';
import { HandleRenderer } from './canvas/HandleRenderer';
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
            case 'ns-resize': cursorStyle = 'ns-resize'; break;
            case 'nwse-resize': cursorStyle = 'nwse-resize'; break;
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
                    <GridRenderer asset={asset} />

                    {asset && entities.map((shape, i) => {
                        const isSelected = selectedShapeIndices.includes(i);
                        return (
                            <g key={i}>
                                <ShapeRenderer
                                    shape={shape}
                                    index={i}
                                    isSelected={isSelected}
                                    assetColor={asset.color}
                                    onDown={onDown}
                                />
                                {isSelected && (
                                    <HandleRenderer
                                        shape={shape}
                                        index={i}
                                        selectedPointIndex={selectedPointIndex}
                                        onDown={onDown}
                                        onDeleteShape={onDeleteShape}
                                    />
                                )}
                            </g>
                        );
                    })}
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
 */
export const DesignCanvas = () => {
    const viewState = useStore(state => state.viewState);
    const setViewState = useStore(state => state.setViewState);
    const localAssets = useStore(state => state.localAssets);
    const setLocalAssets = useStore(state => state.setLocalAssets);
    const globalAssets = useStore(state => state.globalAssets);
    const designTargetId = useStore(state => state.designTargetId);

    const selectedShapeIndices = useStore(state => state.selectedShapeIndices);
    const setSelectedShapeIndices = useStore(state => state.setSelectedShapeIndices);
    const selectedPointIndex = useStore(state => state.selectedPointIndex);
    const setSelectedPointIndex = useStore(state => state.setSelectedPointIndex);

    const [localAsset, setLocalAsset] = useState(null);
    const dragRef = useRef({ mode: 'idle' });
    const [cursorMode, setCursorMode] = useState('idle');
    const svgRef = useRef(null);
    const [marquee, setMarquee] = useState(null);

    const assets = [...localAssets, ...globalAssets];
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

    const updateLocalAssetState = (updates) => {
        const newAsset = { ...localAssetRef.current, ...updates };
        setLocalAsset(newAsset);
        localAssetRef.current = newAsset;
        return newAsset;
    };

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
        if ((pointIndex === 'rx' || pointIndex === 'ry' || pointIndex === 'rxy') && shapeIndex !== null && currentEntities[shapeIndex]) {
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
            dragRef.current = initiateDraggingShape(e, shapeIndex, localAsset, selectedShapeIndices, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode);
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

        if (dragRef.current.mode !== 'idle' && dragRef.current.mode !== 'marquee' && dragRef.current.mode !== 'panning') {
            const currentAsset = localAssetRef.current;
            const entities = currentAsset.entities || [];
            const bounds = calculateAssetBounds(entities);

            let updates = {};
            if (bounds) {
                if (currentAsset.w !== bounds.w || currentAsset.h !== bounds.h || currentAsset.boundX !== bounds.boundX || currentAsset.boundY !== bounds.boundY) {
                    updates = bounds;
                }
            }

            const newAsset = updateLocalAssetState(updates);
            setLocalAssets(prev => prev.map(a => a.id === designTargetId ? newAsset : a));
        }
        dragRef.current = { mode: 'idle' };
    };

    /**
     * Deletes a shape at the specified index.
     * Updates asset bounds and clears selection.
     * @param {number} index - Index of the shape to delete.
     */
    const handleDeleteShape = (e, index) => {
        e.stopPropagation();
        if (!confirm('このシェイプを削除しますか？')) {
            dragRef.current = { mode: 'idle' };
            setCursorMode('idle');
            return;
        }
        const newEntities = localAsset.entities.filter((_, i) => i !== index);

        // Calculate new bounds after deletion
        const bounds = calculateAssetBounds(newEntities);
        const updates = {
            entities: newEntities,
            isDefaultShape: false,
            ...(bounds || {})
        };

        const newAsset = updateLocalAssetState(updates);
        setLocalAssets(prev => prev.map(a => a.id === designTargetId ? newAsset : a));
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
