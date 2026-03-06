import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { deepClone } from '../lib/utils';
import { calculateAssetBounds } from '../domain/geometry';
import {
    initiatePanning, initiateMarquee, initiateResizing, initiateDraggingHandle,
    initiateDraggingAngle, initiateDraggingRotation, initiateDraggingRadius,
    initiateDraggingPoint, initiateDraggingShape,
    processPanning, processMarquee, processResizing, processDraggingShape,
    processDraggingPoint, processDraggingHandle, processDraggingAngle,
    processDraggingRotation, processDraggingRadius
} from '../components/DesignCanvas.logic';

export const useCanvasInteraction = (svgRef) => {
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
    const [marquee, setMarquee] = useState(null);

    const assets = [...localAssets, ...globalAssets];
    const assetFromStore = assets.find(a => a.id === designTargetId);

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
        const updated = { ...localAssetRef.current, entities: newEntities, isDefaultShape: false };
        setLocalAsset(updated);
        localAssetRef.current = updated;
    };

    const handleDown = (e, shapeIndex = null, pointIndex = null, resizeMode = null, handleIndex = null) => {
        if (svgRef.current && e.pointerId) svgRef.current.setPointerCapture(e.pointerId);
        const rect = svgRef.current ? svgRef.current.getBoundingClientRect() : { left: 0, top: 0 };

        if (e.button === 1) {
            dragRef.current = initiatePanning(e, viewState, setCursorMode);
            return;
        }

        if (shapeIndex === null && e.button === 0) {
            dragRef.current = initiateMarquee(e, setMarquee, setSelectedShapeIndices, selectedShapeIndices);
            return;
        }

        const currentEntities = localAssetRef.current?.entities || [];

        if (resizeMode && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateResizing(e, shapeIndex, localAssetRef.current, resizeMode, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode);
            return;
        }

        if (handleIndex !== null && pointIndex !== null && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingHandle(e, shapeIndex, pointIndex, handleIndex, localAssetRef.current, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode);
            return;
        }

        if ((pointIndex === 'startAngle' || pointIndex === 'endAngle') && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingAngle(e, shapeIndex, pointIndex, localAssetRef.current, viewState, rect, setSelectedShapeIndices, setCursorMode);
            return;
        }

        if (pointIndex === 'rotation' && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingRotation(e, shapeIndex, localAssetRef.current, viewState, rect, setSelectedShapeIndices, setCursorMode);
            return;
        }

        if ((pointIndex === 'rx' || pointIndex === 'ry' || pointIndex === 'rxy') && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingRadius(e, shapeIndex, pointIndex, localAssetRef.current, setSelectedShapeIndices, setCursorMode);
            return;
        }

        if (pointIndex !== null && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingPoint(e, shapeIndex, pointIndex, localAssetRef.current, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode);
            return;
        }

        if (shapeIndex !== null) {
            dragRef.current = initiateDraggingShape(e, shapeIndex, localAssetRef.current, selectedShapeIndices, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode);
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
            processMarquee(e, dragRef.current, setMarquee, svgRef, viewState, localAssetRef.current, setSelectedShapeIndices);
            return;
        }

        let newEntities = null;

        if (mode === 'resizing' && selectedShapeIndices.length > 0) {
            newEntities = processResizing(e, dragRef.current, localAssetRef.current, viewState, selectedShapeIndices);
        } else if (mode === 'draggingShape') {
            newEntities = processDraggingShape(e, dragRef.current, localAssetRef.current, viewState);
        } else if (mode === 'draggingPoint' && selectedShapeIndices.length > 0 && selectedPointIndex !== null) {
            newEntities = processDraggingPoint(e, dragRef.current, localAssetRef.current, viewState, selectedShapeIndices, selectedPointIndex);
        } else if (mode === 'draggingHandle' && selectedShapeIndices.length > 0 && selectedPointIndex !== null) {
            newEntities = processDraggingHandle(e, dragRef.current, localAssetRef.current, viewState, selectedShapeIndices, selectedPointIndex);
        } else if (mode === 'draggingAngle' && selectedShapeIndices.length > 0) {
            newEntities = processDraggingAngle(e, dragRef.current, localAssetRef.current, selectedShapeIndices);
        } else if (mode === 'draggingRotation' && selectedShapeIndices.length > 0) {
            newEntities = processDraggingRotation(e, dragRef.current, localAssetRef.current, selectedShapeIndices);
        } else if (mode === 'draggingRadius' && selectedShapeIndices.length > 0) {
            newEntities = processDraggingRadius(e, dragRef.current, localAssetRef.current, viewState, selectedShapeIndices);
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

        const currentEntities = localAssetRef.current.entities || [];
        const newEntities = currentEntities.filter((_, i) => i !== index);

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

    return {
        localAsset,
        cursorMode,
        marquee,
        handleDown,
        handleMove,
        handleUp,
        handleDeleteShape,
        viewState,
        selectedShapeIndices,
        selectedPointIndex
    };
};
