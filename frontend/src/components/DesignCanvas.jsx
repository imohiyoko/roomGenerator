import React, { useState, useRef, useEffect } from 'react';
import { BASE_SCALE, SNAP_UNIT } from '../lib/constants';
import { createRectPath, toSvgY, deepClone, calculateAssetBounds } from '../lib/utils';
import { useStore } from '../store';
import { GridRenderer } from './canvas/GridRenderer';
import { ShapeRenderer } from './canvas/ShapeRenderer';
import { HandleRenderer } from './canvas/HandleRenderer';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction';

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
    const svgRef = useRef(null);

    const assets = [...localAssets, ...globalAssets];
    const assetFromStore = assets.find(a => a.id === designTargetId);

    const localAssetRef = useRef(null);
    useEffect(() => {
        localAssetRef.current = localAsset;
    }, [localAsset]);

    const {
        dragRef,
        cursorMode,
        marquee,
        handleDown,
        handleMove,
        handleUp,
        handleDeleteShape
    } = useCanvasInteraction({
        viewState,
        setViewState,
        localAsset,
        localAssetRef,
        updateLocalEntities: (newEntities) => {
            const updated = { ...localAsset, entities: newEntities, isDefaultShape: false };
            setLocalAsset(updated);
            localAssetRef.current = updated;
        },
        updateLocalAssetState: (updates) => {
            const newAsset = { ...localAssetRef.current, ...updates };
            setLocalAsset(newAsset);
            localAssetRef.current = newAsset;
            return newAsset;
        },
        selectedShapeIndices,
        setSelectedShapeIndices,
        selectedPointIndex,
        setSelectedPointIndex,
        svgRef,
        setLocalAssets,
        designTargetId
    });

    useEffect(() => {
        if (assetFromStore && (!dragRef || !dragRef.current || dragRef.current.mode === 'idle')) {
             // Handle entities/shapes structure
             const normalized = deepClone(assetFromStore);
             if (!normalized.entities && normalized.shapes) {
                 normalized.entities = normalized.shapes;
                 delete normalized.shapes;
             }
             setLocalAsset(normalized);
        }
    }, [assetFromStore, dragRef]);

    if (!localAsset) return null;

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
