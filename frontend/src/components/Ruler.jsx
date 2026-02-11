import React, { useEffect, useState } from 'react';
import { BASE_SCALE } from '../lib/constants';

export const Ruler = ({ viewState }) => {
    const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

    useEffect(() => {
        const handleResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const step = 100;
    const offsetX = viewState.x;
    const offsetY = viewState.y;
    const scale = viewState.scale * BASE_SCALE;

    // Visible range in logical coordinates
    // We add a buffer to ensure ticks are drawn just outside the visible area for smooth panning
    const buffer = step;
    const startX = Math.floor((-offsetX - buffer) / scale / step) * step;
    const endX = Math.ceil((size.w - offsetX + buffer) / scale / step) * step;
    const startY = Math.floor((-offsetY - buffer) / scale / step) * step;
    const endY = Math.ceil((size.h - offsetY + buffer) / scale / step) * step;

    const xTicks = [];
    for (let i = startX; i <= endX; i += step) {
        const x = offsetX + i * scale;
        // Avoid drawing over the top-left corner intersection (20x20)
        if (x > 20) xTicks.push(<g key={`x${i}`}><line x1={x} y1={0} x2={x} y2={15} stroke="#888" strokeWidth="1" /><text x={x + 2} y={12} fontSize="10" fill="#555">{i}</text></g>);
    }

    const yTicks = [];
    for (let i = startY; i <= endY; i += step) {
        const y = offsetY + i * scale;
        // Avoid drawing over the top-left corner intersection (20x20)
        if (y > 20) yTicks.push(<g key={`y${i}`}><line x1={0} y1={y} x2={15} y2={y} stroke="#888" strokeWidth="1" /><text x={2} y={y + 10} fontSize="10" fill="#555">{i}</text></g>);
    }

    return (
        <div className="absolute inset-0 pointer-events-none z-0">
            <svg width="100%" height="20" className="absolute top-0 left-0 bg-white/90 border-b z-10">{xTicks}</svg>
            <svg width="20" height="100%" className="absolute top-0 left-0 bg-white/90 border-r z-10">{yTicks}</svg>
        </div>
    );
};
