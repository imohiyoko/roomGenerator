import { useState, useRef, useEffect } from 'react';
import { deepClone, calculateAssetBounds } from '../lib/utils';
import {
    initiatePanning, initiateMarquee, initiateResizing, initiateDraggingHandle,
    initiateDraggingAngle, initiateDraggingRotation, initiateDraggingRadius,
    initiateDraggingPoint, initiateDraggingShape,
    processPanning, processMarquee, processResizing, processDraggingShape,
    processDraggingPoint, processDraggingHandle, processDraggingAngle,
    processDraggingRotation, processDraggingRadius
} from '../components/DesignCanvas.logic';

export const useCanvasInteraction = ({
    viewState, setViewState,
    designTargetId,
    assetFromStore,
    selectedShapeIndices, setSelectedShapeIndices,
    selectedPointIndex, setSelectedPointIndex,
    setLocalAssets
}) => {
    const [localAsset, setLocalAsset] = useState(null);
    const dragRef = useRef({ mode: 'idle' });
    const [cursorMode, setCursorMode] = useState('idle');
    const svgRef = useRef(null);
    const [marquee, setMarquee] = useState(null);

    const localAssetRef = useRef(null);
    useEffect(() => {
        localAssetRef.current = localAsset;
    }, [localAsset]);

    useEffect(() => {
        if (assetFromStore && dragRef.current.mode === 'idle') {
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

    const handleDown = (e, shapeIndex = null, pointIndex = null, resizeMode = null, handleIndex = null) => {
        if (svgRef.current && e.pointerId) svgRef.current.setPointerCapture(e.pointerId);
        const rect = svgRef.current.getBoundingClientRect();

        if (e.button === 1) {
            dragRef.current = initiatePanning(e, viewState, setCursorMode);
            return;
        }

        if (shapeIndex === null && e.button === 0) {
            dragRef.current = initiateMarquee(e, setMarquee, setSelectedShapeIndices, selectedShapeIndices);
            return;
        }

        const currentEntities = localAsset.entities || [];

        if (resizeMode && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateResizing(e, shapeIndex, localAsset, resizeMode, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode);
            return;
        }

        if (handleIndex !== null && pointIndex !== null && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingHandle(e, shapeIndex, pointIndex, handleIndex, localAsset, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode);
            return;
        }

        if ((pointIndex === 'startAngle' || pointIndex === 'endAngle') && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingAngle(e, shapeIndex, pointIndex, localAsset, viewState, rect, setSelectedShapeIndices, setCursorMode);
            return;
        }

        if (pointIndex === 'rotation' && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingRotation(e, shapeIndex, localAsset, viewState, rect, setSelectedShapeIndices, setCursorMode);
            return;
        }

        if ((pointIndex === 'rx' || pointIndex === 'ry' || pointIndex === 'rxy') && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingRadius(e, shapeIndex, pointIndex, localAsset, setSelectedShapeIndices, setCursorMode);
            return;
        }

        if (pointIndex !== null && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingPoint(e, shapeIndex, pointIndex, localAsset, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode);
            return;
        }

        if (shapeIndex !== null) {
            dragRef.current = initiateDraggingShape(e, shapeIndex, localAsset, selectedShapeIndices, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode);
            return;
        }

        setSelectedShapeIndices([]);
        setSelectedPointIndex(null);
    };

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

    const handleDeleteShape = (e, index) => {
        e.stopPropagation();
        if (!confirm('このシェイプを削除しますか？')) {
            dragRef.current = { mode: 'idle' };
            setCursorMode('idle');
            return;
        }

        const newEntities = localAsset.entities.filter((_, i) => i !== index);
        const bounds = calculateAssetBounds(newEntities);

        let updates = { entities: newEntities, isDefaultShape: false };
        if (bounds) {
            updates = { ...updates, ...bounds };
        } else {
            // Provide default if empty
            updates = { ...updates, w: 100, h: 100, boundX: 0, boundY: 0 };
        }

        const newAsset = updateLocalAssetState(updates);
        setLocalAssets(prev => prev.map(a => a.id === designTargetId ? newAsset : a));
        setSelectedShapeIndices([]);
        setSelectedPointIndex(null);
    };

    return {
        localAsset,
        cursorMode,
        svgRef,
        marquee,
        handleDown,
        handleMove,
        handleUp,
        handleDeleteShape
    };
};
