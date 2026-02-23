import { useState, useRef, useEffect } from 'react';
import { calculateAssetBounds } from '../lib/utils';
import {
    initiatePanning, initiateMarquee, initiateResizing, initiateDraggingHandle,
    initiateDraggingAngle, initiateDraggingRotation, initiateDraggingRadius,
    initiateDraggingPoint, initiateDraggingShape,
    processPanning, processMarquee, processResizing, processDraggingShape,
    processDraggingPoint, processDraggingHandle, processDraggingAngle,
    processDraggingRotation, processDraggingRadius
} from '../components/DesignCanvas.logic';

export const useDesignCanvasInteraction = ({
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
}) => {
    const dragRef = useRef({ mode: 'idle' });
    const [cursorMode, setCursorMode] = useState('idle');
    const svgRef = useRef(null);
    const [marquee, setMarquee] = useState(null);
    const localAssetRef = useRef(null);

    useEffect(() => {
        localAssetRef.current = localAsset;
    }, [localAsset]);

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
    }, [cursorMode]);

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

        const currentAsset = localAssetRef.current;
        const currentEntities = currentAsset.entities || [];

        // Resizing
        if (resizeMode && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateResizing(e, shapeIndex, currentAsset, resizeMode, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode);
            return;
        }

        // Handle Dragging
        if (handleIndex !== null && pointIndex !== null && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingHandle(e, shapeIndex, pointIndex, handleIndex, currentAsset, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode);
            return;
        }

        // Angle Dragging
        if ((pointIndex === 'startAngle' || pointIndex === 'endAngle') && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingAngle(e, shapeIndex, pointIndex, currentAsset, viewState, rect, setSelectedShapeIndices, setCursorMode);
            return;
        }

        // Rotation Dragging
        if (pointIndex === 'rotation' && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingRotation(e, shapeIndex, currentAsset, viewState, rect, setSelectedShapeIndices, setCursorMode);
            return;
        }

        // Radius Dragging
        if ((pointIndex === 'rx' || pointIndex === 'ry' || pointIndex === 'rxy') && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingRadius(e, shapeIndex, pointIndex, currentAsset, setSelectedShapeIndices, setCursorMode);
            return;
        }

        // Point Dragging
        if (pointIndex !== null && shapeIndex !== null && currentEntities[shapeIndex]) {
            dragRef.current = initiateDraggingPoint(e, shapeIndex, pointIndex, currentAsset, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode);
            return;
        }

        // Shape Dragging
        if (shapeIndex !== null) {
            dragRef.current = initiateDraggingShape(e, shapeIndex, currentAsset, selectedShapeIndices, setSelectedShapeIndices, setSelectedPointIndex, setCursorMode);
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

        const currentAsset = localAssetRef.current;

        if (mode === 'marquee') {
            processMarquee(e, dragRef.current, setMarquee, svgRef, viewState, currentAsset, setSelectedShapeIndices);
            return;
        }

        let newEntities = null;

        if (mode === 'resizing' && selectedShapeIndices.length > 0) {
            newEntities = processResizing(e, dragRef.current, currentAsset, viewState, selectedShapeIndices);
        } else if (mode === 'draggingShape') {
            newEntities = processDraggingShape(e, dragRef.current, currentAsset, viewState);
        } else if (mode === 'draggingPoint' && selectedShapeIndices.length > 0 && selectedPointIndex !== null) {
            newEntities = processDraggingPoint(e, dragRef.current, currentAsset, viewState, selectedShapeIndices, selectedPointIndex);
        } else if (mode === 'draggingHandle' && selectedShapeIndices.length > 0 && selectedPointIndex !== null) {
            newEntities = processDraggingHandle(e, dragRef.current, currentAsset, viewState, selectedShapeIndices, selectedPointIndex);
        } else if (mode === 'draggingAngle' && selectedShapeIndices.length > 0) {
            newEntities = processDraggingAngle(e, dragRef.current, currentAsset, selectedShapeIndices);
        } else if (mode === 'draggingRotation' && selectedShapeIndices.length > 0) {
            newEntities = processDraggingRotation(e, dragRef.current, currentAsset, selectedShapeIndices);
        } else if (mode === 'draggingRadius' && selectedShapeIndices.length > 0) {
            newEntities = processDraggingRadius(e, dragRef.current, currentAsset, viewState, selectedShapeIndices);
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
        const currentAsset = localAssetRef.current;
        const newEntities = (currentAsset.entities || []).filter((_, i) => i !== index);

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

    return {
        svgRef,
        cursorMode,
        marquee,
        handleDown,
        handleMove,
        handleUp,
        handleDeleteShape
    };
};
