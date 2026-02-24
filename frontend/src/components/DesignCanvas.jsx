import React, { useState, useRef, useEffect } from 'react';
import { createRectPath, deepClone } from '../lib/utils';
import { useStore } from '../store';
import { useCanvasInteraction } from '../hooks/useCanvasInteraction';
import { GridRenderer } from './canvas/GridRenderer';
import { ShapeRenderer } from './canvas/ShapeRenderer';
import { HandleRenderer } from './canvas/HandleRenderer';

/**
 * Main container for the Design Mode canvas.
 * Manages state, event handling, and delegates rendering to sub-components.
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

    useEffect(() => {
        if (assetFromStore) {
             const normalized = deepClone(assetFromStore);
             if (!normalized.entities && normalized.shapes) {
                 normalized.entities = normalized.shapes;
                 delete normalized.shapes;
             }
             setLocalAsset(normalized);
        }
    }, [assetFromStore]);

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

    const {
        handleDown,
        handleMove,
        handleUp,
        handleDeleteShape,
        cursorMode,
        marquee
    } = useCanvasInteraction({
        viewState,
        setViewState,
        localAsset,
        localAssetRef,
        updateLocalAssetState,
        updateLocalEntities,
        setLocalAssets,
        designTargetId,
        selectedShapeIndices,
        setSelectedShapeIndices,
        selectedPointIndex,
        setSelectedPointIndex,
        svgRef
    });

    // Apply cursor style based on interaction mode
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

    return (
        <div className="w-full h-full absolute top-0 left-0 overflow-auto canvas-scroll pt-5 pl-5"
            onPointerDown={e => handleDown(e, null)}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            ref={svgRef}
        >
            <svg width="3000" height="3000" style={{ minWidth: '3000px', minHeight: '3000px' }}>
                <g transform={`translate(${viewState.x}, ${viewState.y}) scale(${viewState.scale})`}>
                    <GridRenderer />
                    <ShapeRenderer
                        asset={localAsset}
                        entities={entities}
                        selectedShapeIndices={selectedShapeIndices}
                        onDown={handleDown}
                    />
                    <HandleRenderer
                        entities={entities}
                        selectedShapeIndices={selectedShapeIndices}
                        selectedPointIndex={selectedPointIndex}
                        onDown={handleDown}
                        onDeleteShape={handleDeleteShape}
                    />
                </g>
            </svg>
            {marquee && (
                <div style={{ position: 'fixed', left: Math.min(marquee.sx, marquee.ex), top: Math.min(marquee.sy, marquee.ey), width: Math.abs(marquee.ex - marquee.sx), height: Math.abs(marquee.ey - marquee.sy), border: '2px dashed #3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', pointerEvents: 'none', zIndex: 9999 }} />
            )}
        </div>
    );
};
