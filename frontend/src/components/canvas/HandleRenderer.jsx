import React from 'react';
import { BASE_SCALE } from '../../lib/constants.js';
import { toSvgY, toSvgRotation, getRotatedAABB } from '../../lib/utils.js';

/**
 * 選択されたシェイプの操作ハンドル（リサイズ、回転、頂点、削除ボタン等）を描画します。
 */
export const HandleRenderer = ({ shape, index, selectedPointIndex, onDown, onDeleteShape }) => {
    // 削除ボタンを描画するヘルパー
    const renderDeleteButton = (x, y) => (
        <g transform={`translate(${x}, ${y})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(e, index)}>
            <circle r="8" fill="red" />
            <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" />
            <line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
        </g>
    );

    // 回転に関する共通計算
    const rot = shape.rotation ? toSvgRotation(shape.rotation) : 0;
    let cx_svg = 0, cy_svg = 0;
    if (shape.type === 'ellipse' || shape.type === 'circle' || shape.type === 'arc') {
        cx_svg = (shape.cx !== undefined ? shape.cx : (shape.x + shape.w / 2)) * BASE_SCALE;
        cy_svg = toSvgY(shape.cy !== undefined ? shape.cy : (shape.y + shape.h / 2)) * BASE_SCALE;
    } else {
        cx_svg = ((shape.x || 0) + (shape.w || 0) / 2) * BASE_SCALE;
        cy_svg = toSvgY((shape.y || 0) + (shape.h || 0) / 2) * BASE_SCALE;
    }
    const rotateTransform = rot ? `rotate(${rot} ${cx_svg} ${cy_svg})` : '';

    return (
        <g>
            {/* 楕円のハンドル */}
            {shape.type === 'ellipse' && (() => {
                const cx = (shape.cx || 0) * BASE_SCALE;
                const cy = toSvgY(shape.cy || 0) * BASE_SCALE;
                const rxs = (shape.rx || 50) * BASE_SCALE;
                const rys = (shape.ry || 50) * BASE_SCALE;

                const startRad = toSvgRotation(shape.startAngle || 0) * Math.PI / 180;
                const endRad = toSvgRotation(shape.endAngle || 360) * Math.PI / 180;

                const sx = cx + rxs * Math.cos(startRad);
                const sy = cy + rys * Math.sin(startRad);
                const ex = cx + rxs * Math.cos(endRad);
                const ey = cy + rys * Math.sin(endRad);

                const rotHandleY = cy - rys - 20;

                const bounds = getRotatedAABB(shape);

                return (
                    <>
                        <g transform={rotateTransform}>
                            <circle cx={cx} cy={cy} r="6" fill="red" stroke="white" strokeWidth="2" className="cursor-move" onPointerDown={(e) => onDown(e, index)} />
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
                        {/* 削除ボタン */}
                        {bounds && renderDeleteButton(bounds.maxX * BASE_SCALE + 10, toSvgY(bounds.maxY) * BASE_SCALE - 10)}
                    </>
                );
            })()}

            {/* ポリゴンのハンドル */}
            {shape.type === 'polygon' && (() => {
                const maxX = Math.max(...shape.points.map(p => p.x));
                const maxY = Math.max(...shape.points.map(p => p.y));

                return (
                    <>
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
                                        <line
                                            x1={p.x * BASE_SCALE}
                                            y1={toSvgY(p.y) * BASE_SCALE}
                                            x2={h.x * BASE_SCALE}
                                            y2={toSvgY(h.y) * BASE_SCALE}
                                            stroke="orange"
                                            strokeWidth="1"
                                            strokeDasharray="3,2"
                                        />
                                        <rect
                                            x={h.x * BASE_SCALE - 4}
                                            y={toSvgY(h.y) * BASE_SCALE - 4}
                                            width="8"
                                            height="8"
                                            fill="orange"
                                            stroke="darkorange"
                                            strokeWidth="1"
                                            className="cursor-move"
                                            onPointerDown={(e) => onDown(e, index, pid, null, hid)}
                                        />
                                    </React.Fragment>
                                ))}
                            </React.Fragment>
                        ))}
                        {/* 削除ボタン */}
                        {renderDeleteButton(maxX * BASE_SCALE + 10, toSvgY(maxY) * BASE_SCALE - 10)}
                    </>
                );
            })()}

            {/* 矩形・円のリサイズハンドル */}
            {(shape.type === 'circle' || shape.type === 'rect') && (() => {
                return (
                    <g>
                        {/* Corner Resize Both */}
                        <rect
                            x={(shape.x + shape.w) * BASE_SCALE - 5}
                            y={toSvgY(shape.y + shape.h) * BASE_SCALE - 5}
                            width="10"
                            height="10"
                            fill="yellow"
                            stroke="blue"
                            strokeWidth="2"
                            className="cursor-nwse-resize"
                            onPointerDown={(e) => onDown(e, index, null, 'both')}
                        />
                        {/* Width Resize */}
                        <rect
                            x={(shape.x + shape.w) * BASE_SCALE - 5}
                            y={toSvgY(shape.y + shape.h / 2) * BASE_SCALE - 5}
                            width="10"
                            height="10"
                            fill="lightblue"
                            stroke="blue"
                            strokeWidth="2"
                            className="cursor-ew-resize"
                            onPointerDown={(e) => onDown(e, index, null, 'horizontal')}
                        />
                        {/* Height Resize */}
                        <rect
                            x={(shape.x + shape.w / 2) * BASE_SCALE - 5}
                            y={toSvgY(shape.y + shape.h) * BASE_SCALE - 5}
                            width="10"
                            height="10"
                            fill="lightgreen"
                            stroke="blue"
                            strokeWidth="2"
                            className="cursor-ns-resize"
                            onPointerDown={(e) => onDown(e, index, null, 'vertical')}
                        />
                        {/* 削除ボタン */}
                        {renderDeleteButton((shape.x + shape.w) * BASE_SCALE + 10, toSvgY(shape.y + shape.h) * BASE_SCALE - 10)}
                    </g>
                );
            })()}
        </g>
    );
};
