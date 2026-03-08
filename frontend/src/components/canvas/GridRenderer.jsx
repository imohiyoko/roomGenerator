import React from 'react';

const GridRenderer = ({ scale }) => {
    // The grid is currently rendered as lines crossing 0,0 and a center red dot in DesignCanvasRender.
    return (
        <g>
            <line x1="-5000" y1="0" x2="5000" y2="0" stroke="#ccc" strokeWidth="2" />
            <line x1="0" y1="-5000" x2="0" y2="5000" stroke="#ccc" strokeWidth="2" />
            <circle cx="0" cy="0" r="5" fill="red" opacity="0.5" />
        </g>
    );
};

export default GridRenderer;
