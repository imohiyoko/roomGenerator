import React, { useState, useEffect } from 'react';
import { createRectPath, deepClone } from '../lib/utils';
import { useStore } from '../store';
import { useDesignCanvasInteraction } from '../hooks/useDesignCanvasInteraction';
import { GridRenderer } from './canvas/GridRenderer';
import { AssetBoundsRenderer } from './canvas/AssetBoundsRenderer';
import { ShapeRenderer } from './canvas/ShapeRenderer';

/**
 * Render component for the Design Canvas.
 * Handles the visual representation of assets, shapes, handles, and interactions.
 */
const DesignCanvasRender = ({ viewState, asset, entities, selectedShapeIndices, selectedPointIndex, onDown, onMove, onUp, onDeleteShape, svgRef, marquee, cursorMode }) => {
    return (
        <div className="w-full h-full absolute top-0 left-0 overflow-auto canvas-scroll pt-5 pl-5"
            onPointerDown={e => onDown(e, null)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            ref={svgRef}
        >
            <svg width="3000" height="3000" style={{ minWidth: '3000px', minHeight: '3000px' }}>
                <g transform={`translate(${viewState.x}, ${viewState.y}) scale(${viewState.scale})`}>
                    <GridRenderer />
                    {asset && (
                        <g>
                            <AssetBoundsRenderer asset={asset} />
                            {entities.map((s, i) => (
                                <ShapeRenderer
                                    key={i}
                                    entity={s}
                                    index={i}
                                    isSelected={selectedShapeIndices.includes(i)}
                                    selectedPointIndex={selectedPointIndex}
                                    onDown={onDown}
                                    onDeleteShape={onDeleteShape}
                                    assetColor={asset.color}
                                />
                            ))}
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

    const assets = [...localAssets, ...globalAssets];
    const assetFromStore = assets.find(a => a.id === designTargetId);

    // Sync from store to local state when idle
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

    const {
        svgRef,
        cursorMode,
        marquee,
        handleDown,
        handleMove,
        handleUp,
        handleDeleteShape
    } = useDesignCanvasInteraction({
        viewState,
        setViewState,
        localAsset,
        setLocalAsset,
        selectedShapeIndices,
        setSelectedShapeIndices,
        selectedPointIndex,
        setSelectedPointIndex,
        designTargetId,
        setLocalAssets
    });

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
