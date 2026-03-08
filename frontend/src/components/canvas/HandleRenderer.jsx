import React from 'react';
import { BASE_SCALE } from '../../lib/constants';
import { toSvgY, toSvgRotation } from '../../lib/utils';

const HandleRenderer = ({ s, index, selectedPointIndex, onDown, onDeleteShape }) => {
    const rot = s.rotation ? toSvgRotation(s.rotation) : 0;

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
        <g>
            {s.type === 'polygon' && (
                <g transform={rotateTransform}>
                    {s.points.map((p, pIndex) => (
                        <g key={pIndex}>
                            <circle cx={p.x * BASE_SCALE} cy={toSvgY(p.y) * BASE_SCALE} r="5" fill={selectedPointIndex === pIndex ? "red" : "white"} stroke="blue" strokeWidth="2" className="cursor-crosshair" onPointerDown={(e) => onDown(e, index, pIndex)} />
                            {p.isCurve && selectedPointIndex === pIndex && (
                                <>
                                    <line x1={p.x * BASE_SCALE} y1={toSvgY(p.y) * BASE_SCALE} x2={(p.x + p.h1.x) * BASE_SCALE} y2={toSvgY(p.y + p.h1.y) * BASE_SCALE} stroke="blue" strokeWidth="1" strokeDasharray="2 2" />
                                    <circle cx={(p.x + p.h1.x) * BASE_SCALE} cy={toSvgY(p.y + p.h1.y) * BASE_SCALE} r="4" fill="yellow" stroke="black" strokeWidth="1" className="cursor-crosshair" onPointerDown={(e) => onDown(e, index, pIndex, null, 'h1')} />
                                    <line x1={p.x * BASE_SCALE} y1={toSvgY(p.y) * BASE_SCALE} x2={(p.x + p.h2.x) * BASE_SCALE} y2={toSvgY(p.y + p.h2.y) * BASE_SCALE} stroke="blue" strokeWidth="1" strokeDasharray="2 2" />
                                    <circle cx={(p.x + p.h2.x) * BASE_SCALE} cy={toSvgY(p.y + p.h2.y) * BASE_SCALE} r="4" fill="yellow" stroke="black" strokeWidth="1" className="cursor-crosshair" onPointerDown={(e) => onDown(e, index, pIndex, null, 'h2')} />
                                </>
                            )}
                        </g>
                    ))}
                    {/* Delete Polygon Shape Button - Fixed Position */}
                    {s.points && s.points.length > 0 && (() => {
                        let maxX = -Infinity, maxY = -Infinity;
                        s.points.forEach(p => { if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; });
                        return (
                            <g transform={`translate(${maxX * BASE_SCALE + 15}, ${toSvgY(maxY) * BASE_SCALE - 15})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(e, index)}>
                                <circle r="8" fill="red" />
                                <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" /><line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
                            </g>
                        );
                    })()}
                </g>
            )}
            {s.type === 'ellipse' && (
                <g transform={rotateTransform}>
                    <circle cx={cx_svg} cy={cy_svg} r="6" fill="red" stroke="white" strokeWidth="2" className="cursor-move" />
                    {(() => {
                        const rxs = (s.rx || 50) * BASE_SCALE;
                        const rys = (s.ry || 50) * BASE_SCALE;
                        const startRad = toSvgRotation(s.startAngle !== undefined ? s.startAngle : 0) * Math.PI / 180;
                        const endRad = toSvgRotation(s.endAngle !== undefined ? s.endAngle : 360) * Math.PI / 180;
                        const sx = cx_svg + rxs * Math.cos(startRad);
                        const sy = cy_svg + rys * Math.sin(startRad);
                        const ex = cx_svg + rxs * Math.cos(endRad);
                        const ey = cy_svg + rys * Math.sin(endRad);
                        const rotHandleY = cy_svg - rys - 20;
                        return (
                            <>
                                {/* Resize Handles */}
                                <rect x={cx_svg + rxs - 5} y={cy_svg - 5} width="10" height="10" fill="white" stroke="blue" strokeWidth="2" className="cursor-ew-resize" onPointerDown={(e) => onDown(e, index, 'rx')} />
                                <rect x={cx_svg - 5} y={cy_svg - rys - 5} width="10" height="10" fill="white" stroke="blue" strokeWidth="2" className="cursor-ns-resize" onPointerDown={(e) => onDown(e, index, 'ry')} />
                                <rect x={cx_svg + rxs * Math.cos(Math.PI/4) - 5} y={cy_svg - rys * Math.sin(Math.PI/4) - 5} width="10" height="10" fill="white" stroke="blue" strokeWidth="2" className="cursor-nwse-resize" onPointerDown={(e) => onDown(e, index, 'rxy')} />

                                {/* Angle/Arc Handles */}
                                <circle cx={sx} cy={sy} r="6" fill="green" stroke="white" strokeWidth="2" className="cursor-alias" onPointerDown={(e) => onDown(e, index, 'startAngle')} />
                                <circle cx={ex} cy={ey} r="6" fill="orange" stroke="white" strokeWidth="2" className="cursor-alias" onPointerDown={(e) => onDown(e, index, 'endAngle')} />

                                {/* Rotation Handle */}
                                <line x1={cx_svg} y1={cy_svg - rys} x2={cx_svg} y2={rotHandleY} stroke="black" strokeDasharray="2,2" />
                                <circle cx={cx_svg} cy={rotHandleY} r="6" fill="purple" stroke="white" strokeWidth="2" className="cursor-alias" onPointerDown={(e) => onDown(e, index, 'rotation')} />

                                {/* Delete Button */}
                                <g transform={`translate(${cx_svg + rxs + 15}, ${cy_svg - rys - 15})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(e, index)}>
                                    <circle r="8" fill="red" />
                                    <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" /><line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
                                </g>
                            </>
                        );
                    })()}
                </g>
            )}
            {s.type === 'circle' && (
                <g>
                    <rect x={(s.x + s.w) * BASE_SCALE - 5} y={toSvgY(s.y + s.h) * BASE_SCALE - 5} width="10" height="10" fill="white" stroke="blue" strokeWidth="2" className="cursor-nwse-resize" onPointerDown={(e) => onDown(e, index, null, 'both')} />
                    <rect x={(s.x + s.w) * BASE_SCALE - 5} y={toSvgY(s.y + s.h / 2) * BASE_SCALE - 5} width="10" height="10" fill="lightblue" stroke="blue" strokeWidth="2" className="cursor-ew-resize" onPointerDown={(e) => onDown(e, index, null, 'horizontal')} />
                    <rect x={(s.x + s.w / 2) * BASE_SCALE - 5} y={toSvgY(s.y + s.h) * BASE_SCALE - 5} width="10" height="10" fill="lightgreen" stroke="blue" strokeWidth="2" className="cursor-ns-resize" onPointerDown={(e) => onDown(e, index, null, 'vertical')} />

                    {/* Delete Button */}
                    <g transform={`translate(${(s.x + s.w) * BASE_SCALE + 10}, ${toSvgY(s.y + s.h) * BASE_SCALE - 10})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(e, index)}>
                        <circle r="8" fill="red" />
                        <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" /><line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
                    </g>
                </g>
            )}
            {s.type === 'rect' && (
                 <g>
                    <rect x={(s.x + s.w) * BASE_SCALE - 5} y={toSvgY(s.y) * BASE_SCALE - 5} width="10" height="10" fill="white" stroke="blue" strokeWidth="2" className="cursor-nwse-resize" onPointerDown={(e) => onDown(e, index, null, 'both')} />

                    {/* Delete Button */}
                    <g transform={`translate(${(s.x + s.w) * BASE_SCALE + 10}, ${toSvgY(s.y) * BASE_SCALE - 10})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(e, index)}>
                        <circle r="8" fill="red" />
                        <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" /><line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
                    </g>
                </g>
            )}
        </g>
    );
};

export default HandleRenderer;
