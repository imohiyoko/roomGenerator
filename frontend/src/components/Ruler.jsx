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

    // Buffer for off-screen rendering
    const buffer = step;

    // X-Axis (Standard: Right is +)
    // ScreenX = OffsetX + LogicalX * Scale
    // LogicalX = (ScreenX - OffsetX) / Scale
    const startX = Math.floor((-offsetX - buffer) / scale / step) * step;
    const endX = Math.ceil((size.w - offsetX + buffer) / scale / step) * step;

    const xTicks = [];
    for (let i = startX; i <= endX; i += step) {
        const x = offsetX + i * scale;
        if (x > 20) xTicks.push(
            <g key={`x${i}`}>
                <line x1={x} y1={0} x2={x} y2={15} stroke="#888" strokeWidth="1" />
                <text x={x + 2} y={12} fontSize="10" fill="#555">{i}</text>
            </g>
        );
    }

    // Y-Axis (Cartesian: Up is +)
    // ScreenY (SVG) increases Down.
    // Origin is at OffsetY.
    // ScreenY = OffsetY - CartesianY * Scale
    // CartesianY = (OffsetY - ScreenY) / Scale

    // We iterate over ScreenY space to generate ticks that align with the grid?
    // Or we iterate over logical values and project them to screen.
    // Let's iterate logical Cartesian values.

    // Range of ScreenY: -Buffer to Size.H + Buffer.
    // MinScreenY -> MaxCartesianY
    // MaxScreenY -> MinCartesianY

    const minScreenY = -buffer;
    const maxScreenY = size.h + buffer;

    const maxCartY = Math.ceil((offsetY - minScreenY) / scale / step) * step;
    const minCartY = Math.floor((offsetY - maxScreenY) / scale / step) * step;

    const yTicks = [];
    for (let i = minCartY; i <= maxCartY; i += step) {
        const y = offsetY - i * scale; // Cartesian Y-up maps to Screen Y (Offset - Value*Scale)
        if (y > 20) yTicks.push(
            <g key={`y${i}`}>
                <line x1={0} y1={y} x2={15} y2={y} stroke="#888" strokeWidth="1" />
                <text x={2} y={y + 10} fontSize="10" fill="#555">{i}</text>
            </g>
        );
    }

    return (
        <div className="absolute inset-0 pointer-events-none z-0">
            <svg width="100%" height="20" className="absolute top-0 left-0 bg-white/90 border-b z-10">{xTicks}</svg>
            <svg width="20" height="100%" className="absolute top-0 left-0 bg-white/90 border-r z-10">{yTicks}</svg>
        </div>
    );
};
