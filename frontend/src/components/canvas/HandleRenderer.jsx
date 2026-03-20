import React from 'react';
import { BASE_SCALE } from '../../lib/constants';
import { toSvgY, getRotatedAABB, toSvgRotation } from '../../lib/utils';

/**
 * Renders selection handles, rotation handles, and delete buttons for a shape.
 */
export const HandleRenderer = ({
    shape,
    index,
    isSelected,
    selectedPointIndex,
    onDown,
    onDeleteShape,
    rotateTransform
}) => {
    if (!isSelected) return null;

    if (shape.type === 'ellipse') {
        const cx = (shape.cx || 0) * BASE_SCALE;
        const cy = toSvgY(shape.cy || 0) * BASE_SCALE;
        const rxs = (shape.rx || 50) * BASE_SCALE;
        const rys = (shape.ry || 50) * BASE_SCALE;

        const startRad = toSvgRotation(shape.startAngle !== undefined ? shape.startAngle : 0) * Math.PI / 180;
        const endRad = toSvgRotation(shape.endAngle !== undefined ? shape.endAngle : 360) * Math.PI / 180;

        const sx = cx + rxs * Math.cos(startRad);
        const sy = cy + rys * Math.sin(startRad);
        const ex = cx + rxs * Math.cos(endRad);
        const ey = cy + rys * Math.sin(endRad);

        const rotHandleY = cy - rys - 20;

        const bounds = getRotatedAABB(shape);
        const maxXY = bounds ? { x: bounds.maxX, y: bounds.maxY } : { x: 0, y: 0 };

        return (
            <React.Fragment>
                <g transform={rotateTransform}>
                    <circle cx={cx} cy={cy} r="6" fill="red" stroke="white" strokeWidth="2" className="cursor-move" />
                    {/* Width Handle */}
                    <rect x={cx + rxs - 4} y={cy - 4} width="8" height="8" fill="orange" stroke="white" strokeWidth="1" className="cursor-ew-resize" onPointerDown={(e) => onDown(e, index, 'rx')} />
                    {/* Height Handle */}
                    <rect x={cx - 4} y={cy + rys - 4} width="8" height="8" fill="orange" stroke="white" strokeWidth="1" className="cursor-ns-resize" onPointerDown={(e) => onDown(e, index, 'ry')} />
                    {/* Corner Handle */}
                    <rect x={cx + rxs - 4} y={cy + rys - 4} width="8" height="8" fill="yellow" stroke="orange" strokeWidth="1" className="cursor-nwse-resize" onPointerDown={(e) => onDown(e, index, 'rxy')} />

                    {/* Rotation Handle */}
                    <line x1={cx} y1={cy - rys} x2={cx} y2={rotHandleY} stroke="cyan" strokeWidth="1" strokeDasharray="3,2" />
                    <circle cx={cx} cy={rotHandleY} r="5" fill="cyan" stroke="white" strokeWidth="1" className="cursor-pointer" onPointerDown={(e) => onDown(e, index, 'rotation')} />

                    {/* Angle Handles */}
                    <line x1={cx} y1={cy} x2={sx * 0.6 + cx * 0.4} y2={sy * 0.6 + cy * 0.4} stroke="green" strokeWidth="1" strokeDasharray="3,2" />
                    <line x1={cx} y1={cy} x2={ex * 0.6 + cx * 0.4} y2={ey * 0.6 + cy * 0.4} stroke="purple" strokeWidth="1" strokeDasharray="3,2" />
                    <circle cx={sx * 0.6 + cx * 0.4} cy={sy * 0.6 + cy * 0.4} r="5" fill="green" stroke="white" strokeWidth="1" className="cursor-pointer" onPointerDown={(e) => onDown(e, index, 'startAngle')} />
                    <circle cx={ex * 0.6 + cx * 0.4} cy={ey * 0.6 + cy * 0.4} r="5" fill="purple" stroke="white" strokeWidth="1" className="cursor-pointer" onPointerDown={(e) => onDown(e, index, 'endAngle')} />
                </g>

                {bounds && (
                    <g transform={`translate(${maxXY.x * BASE_SCALE + 10}, ${toSvgY(maxXY.y) * BASE_SCALE - 10})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(e, index)}>
                        <circle r="8" fill="red" />
                        <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" />
                        <line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
                    </g>
                )}
            </React.Fragment>
        );
    }

    if (shape.type === 'polygon') {
        const maxX = Math.max(...shape.points.map(p => p.x));
        const maxY = Math.max(...shape.points.map(p => p.y));

        return (
            <React.Fragment>
                {/* Polygon Points */}
                {shape.points.map((p, pid) => (
                    <React.Fragment key={pid}>
                        <circle
                            cx={p.x * BASE_SCALE}
                            cy={toSvgY(p.y) * BASE_SCALE}
                            r="5"
                            fill={selectedPointIndex === pid ? "red" : "white"}
                            stroke="blue"
                            strokeWidth="2"
                            className="cursor-crosshair"
                            onPointerDown={(e) => onDown(e, index, pid)}
                        />
                        {p.handles && p.handles.map((h, hid) => (
                            <React.Fragment key={`h-${pid}-${hid}`}>
                                <line x1={p.x * BASE_SCALE} y1={toSvgY(p.y) * BASE_SCALE} x2={h.x * BASE_SCALE} y2={toSvgY(h.y) * BASE_SCALE} stroke="orange" strokeWidth="1" strokeDasharray="3,2" />
                                <rect x={h.x * BASE_SCALE - 4} y={toSvgY(h.y) * BASE_SCALE - 4} width="8" height="8" fill="orange" stroke="darkorange" strokeWidth="1" className="cursor-move" onPointerDown={(e) => onDown(e, index, pid, null, hid)} />
                            </React.Fragment>
                        ))}
                    </React.Fragment>
                ))}

                {/* Delete Button */}
                <g transform={`translate(${maxX * BASE_SCALE + 10}, ${toSvgY(maxY) * BASE_SCALE - 10})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(e, index)}>
                    <circle r="8" fill="red" />
                    <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" />
                    <line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
                </g>
            </React.Fragment>
        );
    }

    if (shape.type === 'circle' || shape.type === 'rect') {
        return (
            <g>
                {/* Resizers */}
                <rect x={(shape.x + shape.w) * BASE_SCALE - 5} y={toSvgY(shape.y + shape.h) * BASE_SCALE - 5} width="10" height="10" fill="yellow" stroke="blue" strokeWidth="2" className="cursor-nwse-resize" onPointerDown={(e) => onDown(e, index, null, 'both')} />
                <rect x={(shape.x + shape.w) * BASE_SCALE - 5} y={toSvgY(shape.y + shape.h / 2) * BASE_SCALE - 5} width="10" height="10" fill="lightblue" stroke="blue" strokeWidth="2" className="cursor-ew-resize" onPointerDown={(e) => onDown(e, index, null, 'horizontal')} />
                <rect x={(shape.x + shape.w / 2) * BASE_SCALE - 5} y={toSvgY(shape.y + shape.h) * BASE_SCALE - 5} width="10" height="10" fill="lightgreen" stroke="blue" strokeWidth="2" className="cursor-ns-resize" onPointerDown={(e) => onDown(e, index, null, 'vertical')} />

                {/* Delete Button */}
                <g transform={`translate(${(shape.x + shape.w) * BASE_SCALE + 10}, ${toSvgY(shape.y + shape.h) * BASE_SCALE - 10})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(e, index)}>
                    <circle r="8" fill="red" />
                    <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" />
                    <line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
                </g>
            </g>
        );
    }

    return null;
};
