import React from 'react';
import { BASE_SCALE } from '../../lib/constants';
import { toSvgY, toSvgRotation, getRotatedAABB } from '../../lib/utils';

export const HandleRenderer = ({ entities, selectedShapeIndices, selectedPointIndex, onDown, onDeleteShape }) => {
    return (
        <g>
            {entities.map((s, i) => {
                if (!selectedShapeIndices.includes(i)) return null;

                const isSelected = true; // By definition here

                // Rotation logic (Cartesian CCW -> SVG CW)
                const rot = s.rotation ? toSvgRotation(s.rotation) : 0;

                // Rotation Center logic
                let cx_svg = 0, cy_svg = 0;
                if (s.type === 'ellipse' || s.type === 'circle' || s.type === 'arc') {
                    cx_svg = (s.cx !== undefined ? s.cx : (s.x + s.w/2)) * BASE_SCALE;
                    cy_svg = toSvgY(s.cy !== undefined ? s.cy : (s.y + s.h/2)) * BASE_SCALE;
                } else {
                    cx_svg = ((s.x || 0) + (s.w || 0) / 2) * BASE_SCALE;
                    cy_svg = toSvgY((s.y || 0) + (s.h || 0) / 2) * BASE_SCALE;
                }

                const rotateTransform = rot ? `rotate(${rot} ${cx_svg} ${cy_svg})` : '';

                return (
                    <g key={i}>
                        {/* Ellipse Handles */}
                        {s.type === 'ellipse' && (() => {
                            const cx = (s.cx || 0) * BASE_SCALE;
                            const cy = toSvgY(s.cy || 0) * BASE_SCALE;
                            const rxs = (s.rx || 50) * BASE_SCALE;
                            const rys = (s.ry || 50) * BASE_SCALE;

                            const startRad = toSvgRotation(s.startAngle || 0) * Math.PI / 180;
                            const endRad = toSvgRotation(s.endAngle || 360) * Math.PI / 180;

                            const sx = cx + rxs * Math.cos(startRad);
                            const sy = cy + rys * Math.sin(startRad);
                            const ex = cx + rxs * Math.cos(endRad);
                            const ey = cy + rys * Math.sin(endRad);

                            const rotHandleY = cy - rys - 20; // Visual handle above top

                            return (
                                <g transform={rotateTransform}>
                                    <circle cx={cx} cy={cy} r="6" fill="red" stroke="white" strokeWidth="2" className="cursor-move" />
                                    {/* Width Handle (Right) */}
                                    <rect x={cx + rxs - 4} y={cy - 4} width="8" height="8" fill="orange" stroke="white" strokeWidth="1" className="cursor-ew-resize" onPointerDown={(e) => onDown(e, i, 'rx')} />
                                    {/* Height Handle (Bottom in SVG) */}
                                    <rect x={cx - 4} y={cy + rys - 4} width="8" height="8" fill="orange" stroke="white" strokeWidth="1" className="cursor-ns-resize" onPointerDown={(e) => onDown(e, i, 'ry')} />

                                    {/* Corner Handle */}
                                    <rect x={cx + rxs - 4} y={cy + rys - 4} width="8" height="8" fill="yellow" stroke="orange" strokeWidth="1" className="cursor-nwse-resize" onPointerDown={(e) => onDown(e, i, 'rxy')} />

                                    {/* Rotation Handle */}
                                    <line x1={cx} y1={cy - rys} x2={cx} y2={rotHandleY} stroke="cyan" strokeWidth="1" strokeDasharray="3,2" />
                                    <circle cx={cx} cy={rotHandleY} r="5" fill="cyan" stroke="white" strokeWidth="1" className="cursor-pointer" onPointerDown={(e) => onDown(e, i, 'rotation')} />

                                    {/* Angle Handles */}
                                    <line x1={cx} y1={cy} x2={sx * 0.6 + cx * 0.4} y2={sy * 0.6 + cy * 0.4} stroke="green" strokeWidth="1" strokeDasharray="3,2" />
                                    <line x1={cx} y1={cy} x2={ex * 0.6 + cx * 0.4} y2={ey * 0.6 + cy * 0.4} stroke="purple" strokeWidth="1" strokeDasharray="3,2" />
                                    <circle cx={sx * 0.6 + cx * 0.4} cy={sy * 0.6 + cy * 0.4} r="5" fill="green" stroke="white" strokeWidth="1" className="cursor-pointer" onPointerDown={(e) => onDown(e, i, 'startAngle')} />
                                    <circle cx={ex * 0.6 + cx * 0.4} cy={ey * 0.6 + cy * 0.4} r="5" fill="purple" stroke="white" strokeWidth="1" className="cursor-pointer" onPointerDown={(e) => onDown(e, i, 'endAngle')} />
                                </g>
                            );
                        })()}
                        {/* Ellipse Delete Button */}
                        {s.type === 'ellipse' && (() => {
                            const bounds = getRotatedAABB(s);
                            if (!bounds) return null;
                            const { maxX, maxY } = bounds;
                            return (
                                <g transform={`translate(${maxX * BASE_SCALE + 10}, ${toSvgY(maxY) * BASE_SCALE - 10})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(e, i)}>
                                    <circle r="8" fill="red" />
                                    <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" /><line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
                                </g>
                            );
                        })()}
                        {/* Polygon Points */}
                        {s.type === 'polygon' && s.points.map((p, pid) => (
                            <React.Fragment key={pid}>
                                <circle cx={p.x * BASE_SCALE} cy={toSvgY(p.y) * BASE_SCALE} r="5" fill={selectedPointIndex === pid ? "red" : "white"} stroke="blue" strokeWidth="2" className="cursor-crosshair" onPointerDown={(e) => onDown(e, i, pid)} />
                                {p.handles && p.handles.map((h, hid) => (
                                    <React.Fragment key={`h-${pid}-${hid}`}>
                                        <line x1={p.x * BASE_SCALE} y1={toSvgY(p.y) * BASE_SCALE} x2={h.x * BASE_SCALE} y2={toSvgY(h.y) * BASE_SCALE} stroke="orange" strokeWidth="1" strokeDasharray="3,2" />
                                        <rect x={h.x * BASE_SCALE - 4} y={toSvgY(h.y) * BASE_SCALE - 4} width="8" height="8" fill="orange" stroke="darkorange" strokeWidth="1" className="cursor-move" onPointerDown={(e) => onDown(e, i, pid, null, hid)} />
                                    </React.Fragment>
                                ))}
                            </React.Fragment>
                        ))}
                        {/* Rect/Polygon Bounds Delete Button */}
                        {s.type === 'polygon' && (() => {
                            const maxX = Math.max(...s.points.map(p => p.x));
                            const maxY = Math.max(...s.points.map(p => p.y));
                            return (
                                <g transform={`translate(${maxX * BASE_SCALE + 10}, ${toSvgY(maxY) * BASE_SCALE - 10})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(e, i)}>
                                    <circle r="8" fill="red" />
                                    <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" /><line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
                                </g>
                            );
                        })()}
                        {/* Rect Resizers */}
                        {(s.type === 'circle' || s.type === 'rect') && (
                            <g>
                                <rect x={(s.x + s.w) * BASE_SCALE - 5} y={toSvgY(s.y + s.h) * BASE_SCALE - 5} width="10" height="10" fill="yellow" stroke="blue" strokeWidth="2" className="cursor-nwse-resize" onPointerDown={(e) => onDown(e, i, null, 'both')} />
                                <rect x={(s.x + s.w) * BASE_SCALE - 5} y={toSvgY(s.y + s.h / 2) * BASE_SCALE - 5} width="10" height="10" fill="lightblue" stroke="blue" strokeWidth="2" className="cursor-ew-resize" onPointerDown={(e) => onDown(e, i, null, 'horizontal')} />
                                <rect x={(s.x + s.w / 2) * BASE_SCALE - 5} y={toSvgY(s.y + s.h) * BASE_SCALE - 5} width="10" height="10" fill="lightgreen" stroke="blue" strokeWidth="2" className="cursor-ns-resize" onPointerDown={(e) => onDown(e, i, null, 'vertical')} />
                                <g transform={`translate(${(s.x + s.w) * BASE_SCALE + 10}, ${toSvgY(s.y + s.h) * BASE_SCALE - 10})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(e, i)}>
                                    <circle r="8" fill="red" />
                                    <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" /><line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
                                </g>
                            </g>
                        )}
                    </g>
                );
            })}
        </g>
    );
};
