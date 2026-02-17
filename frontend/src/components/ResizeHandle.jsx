import React, { useRef, useState } from 'react';

export const ResizeHandle = ({ onResize, vertical = false, side = 'right' }) => {
    const [isDragging, setIsDragging] = useState(false);
    const startRef = useRef(0);

    const handlePointerDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        startRef.current = vertical ? e.clientY : e.clientX;

        document.body.style.cursor = vertical ? 'row-resize' : 'col-resize';
        document.body.style.userSelect = 'none';

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    };

    const handlePointerMove = (e) => {
        const current = vertical ? e.clientY : e.clientX;
        const delta = current - startRef.current;
        startRef.current = current;
        onResize(delta);
    };

    const handlePointerUp = () => {
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
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
