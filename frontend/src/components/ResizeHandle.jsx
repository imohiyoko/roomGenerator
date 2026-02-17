import React, { useEffect, useRef, useState } from 'react';

export const ResizeHandle = ({ onResize, vertical = false, side = 'right' }) => {
    const [isDragging, setIsDragging] = useState(false);
    const startRef = useRef(0);
    const onResizeRef = useRef(onResize);
    const verticalRef = useRef(vertical);
    const moveRef = useRef(null);
    const upRef = useRef(null);

    // Keep refs in sync with latest props
    useEffect(() => {
        onResizeRef.current = onResize;
        verticalRef.current = vertical;
    });

    // Cleanup on unmount — remove any lingering listeners
    useEffect(() => {
        return () => {
            if (moveRef.current) window.removeEventListener('pointermove', moveRef.current);
            if (upRef.current) window.removeEventListener('pointerup', upRef.current);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, []);

    const handlePointerDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        startRef.current = verticalRef.current ? e.clientY : e.clientX;

        document.body.style.cursor = verticalRef.current ? 'row-resize' : 'col-resize';
        document.body.style.userSelect = 'none';

        const onMove = (ev) => {
            const current = verticalRef.current ? ev.clientY : ev.clientX;
            const delta = current - startRef.current;
            startRef.current = current;
            onResizeRef.current(delta);
        };

        const onUp = () => {
            setIsDragging(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            moveRef.current = null;
            upRef.current = null;
        };

        moveRef.current = onMove;
        upRef.current = onUp;

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    };

    return (
        <div
            onPointerDown={handlePointerDown}
            className={`absolute z-50 hover:bg-blue-400 transition-colors
                ${isDragging ? 'bg-blue-500' : 'bg-transparent'}
                ${vertical
                    ? 'h-1 w-full left-0 cursor-row-resize'
                    : 'w-1 h-full top-0 cursor-col-resize'}
                ${side === 'left' ? '-left-0.5' : side === 'right' ? '-right-0.5' : ''}
                ${side === 'top' ? '-top-0.5' : side === 'bottom' ? '-bottom-0.5' : ''}
            `}
        />
    );
};
