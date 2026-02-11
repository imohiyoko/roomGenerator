import React, { useState, useRef } from 'react';
import { BASE_SCALE, SNAP_UNIT } from '../lib/constants';
import { generateSvgPath, generateEllipsePath, createRectPath } from '../lib/utils';
import { RenderAssetShapes } from './SharedRender';

const DesignCanvasRender = ({ viewState, asset, shapes, selectedShapeIndices, selectedPointIndex, onDown, onMove, onUp, onDeleteShape, svgRef, marquee }) => (
    <div className="w-full h-full absolute top-0 left-0 overflow-auto canvas-scroll pt-5 pl-5"
        onPointerDown={e => onDown(e, null)}
        onPointerMove={onMove}
        onPointerUp={onUp}
        ref={svgRef}
    >
        <svg width="3000" height="3000" style={{ minWidth: '3000px', minHeight: '3000px' }}>
            <g transform={`translate(${viewState.x}, ${viewState.y}) scale(${viewState.scale})`}>
                <line x1="-5000" y1="0" x2="5000" y2="0" stroke="#ccc" strokeWidth="2" />
                <line x1="0" y1="-5000" x2="0" y2="5000" stroke="#ccc" strokeWidth="2" />
                <circle cx="0" cy="0" r="5" fill="red" opacity="0.5" />
                {asset && (
                    <g>
                        <rect x="0" y="0" width={asset.w * BASE_SCALE} height={asset.h * BASE_SCALE} fill="none" stroke="blue" strokeWidth="1" strokeDasharray="4 2" opacity="0.3" pointerEvents="none" />
                        {shapes.map((s, i) => {
                            const isSelected = selectedShapeIndices.includes(i);
                            const style = { fill: s.color || asset.color, stroke: isSelected ? "#3b82f6" : "#999", strokeWidth: isSelected ? 2 : 1, cursor: 'move' };
                            const rot = s.rotation || 0;
                            const rotateTransform = rot && s.type === 'ellipse' ? `rotate(${rot} ${(s.cx || 0) * BASE_SCALE} ${(s.cy || 0) * BASE_SCALE})` : '';
                            return (
                                <g key={i} onPointerDown={(e) => onDown(e, i)}>
                                    {s.type === 'circle'
                                        ? <ellipse cx={(s.x + s.w / 2) * BASE_SCALE} cy={(s.y + s.h / 2) * BASE_SCALE} rx={s.w * BASE_SCALE / 2} ry={s.h * BASE_SCALE / 2} {...style} />
                                        : s.type === 'ellipse'
                                            ? <path d={generateEllipsePath(s)} transform={rotateTransform} {...style} />
                                            : <path d={generateSvgPath(s.points)} {...style} />
                                    }
                                    {/* 編集ハンドル (個別表示) */}
                                    {isSelected && s.type === 'ellipse' && (() => {
                                        const cx = (s.cx || 0) * BASE_SCALE;
                                        const cy = (s.cy || 0) * BASE_SCALE;
                                        const rxs = (s.rx || 50) * BASE_SCALE;
                                        const rys = (s.ry || 50) * BASE_SCALE;
                                        const startAngle = s.startAngle || 0;
                                        const endAngle = s.endAngle || 360;
                                        const startRad = startAngle * Math.PI / 180;
                                        const endRad = endAngle * Math.PI / 180;
                                        const sx = cx + rxs * Math.cos(startRad);
                                        const sy = cy + rys * Math.sin(startRad);
                                        const ex = cx + rxs * Math.cos(endRad);
                                        const ey = cy + rys * Math.sin(endRad);
                                        // 回転ハンドル位置（上部）
                                        const rotHandleY = cy - rys - 20;
                                        return (
                                            <g transform={rotateTransform}>
                                                {/* 中心点 */}
                                                <circle cx={cx} cy={cy} r="6" fill="red" stroke="white" strokeWidth="2" className="cursor-move" />
                                                {/* 横半径ハンドル（右）- 点線なし */}
                                                <rect x={cx + rxs - 4} y={cy - 4} width="8" height="8" fill="orange" stroke="white" strokeWidth="1" className="cursor-ew-resize" onPointerDown={(e) => onDown(e, i, 'rx')} />
                                                {/* 縦半径ハンドル（下）- 点線なし */}
                                                <rect x={cx - 4} y={cy + rys - 4} width="8" height="8" fill="orange" stroke="white" strokeWidth="1" className="cursor-ns-resize" onPointerDown={(e) => onDown(e, i, 'ry')} />
                                                {/* 比率維持ハンドル（右下） */}
                                                <rect x={cx + rxs - 4} y={cy + rys - 4} width="8" height="8" fill="yellow" stroke="orange" strokeWidth="1" className="cursor-nwse-resize" onPointerDown={(e) => onDown(e, i, 'rxy')} />
                                                {/* 回転ハンドル */}
                                                <line x1={cx} y1={cy - rys} x2={cx} y2={rotHandleY} stroke="cyan" strokeWidth="1" strokeDasharray="3,2" />
                                                <circle cx={cx} cy={rotHandleY} r="5" fill="cyan" stroke="white" strokeWidth="1" className="cursor-pointer" onPointerDown={(e) => onDown(e, i, 'rotation')} />
                                                {/* 角度ハンドル（60%の位置に配置して分離） */}
                                                <line x1={cx} y1={cy} x2={sx * 0.6 + cx * 0.4} y2={sy * 0.6 + cy * 0.4} stroke="green" strokeWidth="1" strokeDasharray="3,2" />
                                                <line x1={cx} y1={cy} x2={ex * 0.6 + cx * 0.4} y2={ey * 0.6 + cy * 0.4} stroke="purple" strokeWidth="1" strokeDasharray="3,2" />
                                                <circle cx={sx * 0.6 + cx * 0.4} cy={sy * 0.6 + cy * 0.4} r="5" fill="green" stroke="white" strokeWidth="1" className="cursor-pointer" onPointerDown={(e) => onDown(e, i, 'startAngle')} />
                                                <circle cx={ex * 0.6 + cx * 0.4} cy={ey * 0.6 + cy * 0.4} r="5" fill="purple" stroke="white" strokeWidth="1" className="cursor-pointer" onPointerDown={(e) => onDown(e, i, 'endAngle')} />
                                            </g>
                                        );
                                    })()}
                                    {isSelected && s.type === 'polygon' && s.points.map((p, pid) => (
                                        <React.Fragment key={pid}>
                                            {/* 頂点 */}
                                            <circle cx={p.x * BASE_SCALE} cy={p.y * BASE_SCALE} r="5" fill={selectedPointIndex === pid ? "red" : "white"} stroke="blue" strokeWidth="2" className="cursor-crosshair" onPointerDown={(e) => onDown(e, i, pid)} />
                                            {/* 制御点 */}
                                            {p.handles && p.handles.map((h, hid) => (
                                                <React.Fragment key={`h-${pid}-${hid}`}>
                                                    <line x1={p.x * BASE_SCALE} y1={p.y * BASE_SCALE} x2={h.x * BASE_SCALE} y2={h.y * BASE_SCALE} stroke="orange" strokeWidth="1" strokeDasharray="3,2" />
                                                    <rect x={h.x * BASE_SCALE - 4} y={h.y * BASE_SCALE - 4} width="8" height="8" fill="orange" stroke="darkorange" strokeWidth="1" className="cursor-move" onPointerDown={(e) => onDown(e, i, pid, null, hid)} />
                                                </React.Fragment>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                    {isSelected && s.type === 'polygon' && (() => {
                                        const maxX = Math.max(...s.points.map(p => p.x));
                                        const minY = Math.min(...s.points.map(p => p.y));
                                        return (
                                            <g transform={`translate(${maxX * BASE_SCALE + 10}, ${minY * BASE_SCALE - 10})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(i)}>
                                                <circle r="8" fill="red" />
                                                <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" /><line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
                                            </g>
                                        );
                                    })()}
                                    {isSelected && (s.type === 'circle' || s.type === 'rect') && (
                                        <g>
                                            <rect x={(s.x + s.w - 5 / BASE_SCALE) * BASE_SCALE} y={(s.y + s.h - 5 / BASE_SCALE) * BASE_SCALE} width="10" height="10" fill="yellow" stroke="blue" strokeWidth="2" className="cursor-nwse-resize" onPointerDown={(e) => onDown(e, i, null, 'both')} />
                                            <rect x={(s.x + s.w - 5 / BASE_SCALE) * BASE_SCALE} y={(s.y + s.h / 2 - 5 / BASE_SCALE) * BASE_SCALE} width="10" height="10" fill="lightblue" stroke="blue" strokeWidth="2" className="cursor-ew-resize" onPointerDown={(e) => onDown(e, i, null, 'horizontal')} />
                                            <rect x={(s.x + s.w / 2 - 5 / BASE_SCALE) * BASE_SCALE} y={(s.y + s.h - 5 / BASE_SCALE) * BASE_SCALE} width="10" height="10" fill="lightgreen" stroke="blue" strokeWidth="2" className="cursor-ns-resize" onPointerDown={(e) => onDown(e, i, null, 'vertical')} />
                                            <g transform={`translate(${(s.x + s.w) * BASE_SCALE + 10}, ${s.y * BASE_SCALE - 10})`} className="cursor-pointer" onPointerDown={(e) => onDeleteShape(i)}>
                                                <circle r="8" fill="red" />
                                                <line x1="-4" y1="-4" x2="4" y2="4" stroke="white" strokeWidth="2" /><line x1="4" y1="-4" x2="-4" y2="4" stroke="white" strokeWidth="2" />
                                            </g>
                                        </g>
                                    )}
                                    {/* 寸法表示 (選択時のみ) */}
                                    {isSelected && (() => {
                                        const fontSize = 12;
                                        const textFill = "blue";
                                        const strokeColor = "blue";
                                        const strokeWidth = 1;
                                        const offset = 15;

                                        if (s.type === 'circle' && (s.w || s.h)) {
                                            // Radius
                                            const cx = (s.x + s.w / 2) * BASE_SCALE;
                                            const cy = (s.y + s.h / 2) * BASE_SCALE;
                                            const r = (s.w / 2); // 単位なし
                                            return (
                                                <g pointerEvents="none">
                                                    <line x1={cx} y1={cy} x2={cx + s.w * BASE_SCALE / 2} y2={cy} stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="2,2" />
                                                    <text x={cx + s.w * BASE_SCALE / 4} y={cy - 5} fill={textFill} fontSize={fontSize} textAnchor="middle">r: {Math.round(r)}</text>
                                                </g>
                                            );
                                        } else if (s.type === 'ellipse' && (s.rx || s.ry)) {
                                            // Radii
                                            const cx = (s.cx || 0) * BASE_SCALE;
                                            const cy = (s.cy || 0) * BASE_SCALE;
                                            const rx = s.rx || 50;
                                            const ry = s.ry || 50;
                                            return (
                                                <g pointerEvents="none" transform={rotateTransform}>
                                                    {/* Rx */}
                                                    <line x1={cx} y1={cy} x2={cx + rx * BASE_SCALE} y2={cy} stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="2,2" />
                                                    <text x={cx + rx * BASE_SCALE / 2} y={cy - 5} fill={textFill} fontSize={fontSize} textAnchor="middle">rx: {Math.round(rx)}</text>
                                                    {/* Ry */}
                                                    <line x1={cx} y1={cy} x2={cx} y2={cy + ry * BASE_SCALE} stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="2,2" />
                                                    <text x={cx + 5} y={cy + ry * BASE_SCALE / 2} fill={textFill} fontSize={fontSize} textAnchor="start" dominantBaseline="middle">ry: {Math.round(ry)}</text>
                                                </g>
                                            );
                                        } else if (s.type === 'polygon' && s.points) {
                                            // Segment lengths
                                            return (
                                                <g pointerEvents="none">
                                                    {s.points.map((p, idx) => {
                                                        const nextP = s.points[(idx + 1) % s.points.length];
                                                        const mx = ((p.x + nextP.x) / 2) * BASE_SCALE;
                                                        const my = ((p.y + nextP.y) / 2) * BASE_SCALE;
                                                        const dist = Math.sqrt(Math.pow(nextP.x - p.x, 2) + Math.pow(nextP.y - p.y, 2));
                                                        return (
                                                            <text key={idx} x={mx} y={my} fill={textFill} fontSize={fontSize} textAnchor="middle" dominantBaseline="middle" stroke="white" strokeWidth="3" paintOrder="stroke">{Math.round(dist)}</text>
                                                        );
                                                    })}
                                                </g>
                                            );
                                        } else {
                                            // Rect / Image (Width / Height)
                                            const x = (s.x || 0) * BASE_SCALE;
                                            const y = (s.y || 0) * BASE_SCALE;
                                            const w = (s.w || 0);
                                            const h = (s.h || 0);
                                            return (
                                                <g pointerEvents="none">
                                                    {/* Width (Top) */}
                                                    <line x1={x} y1={y - offset} x2={x + w * BASE_SCALE} y2={y - offset} stroke={strokeColor} strokeWidth={strokeWidth} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                                                    <text x={x + w * BASE_SCALE / 2} y={y - offset - 5} fill={textFill} fontSize={fontSize} textAnchor="middle">{Math.round(w)}</text>
                                                    {/* Height (Left) */}
                                                    <line x1={x - offset} y1={y} x2={x - offset} y2={y + h * BASE_SCALE} stroke={strokeColor} strokeWidth={strokeWidth} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                                                    <text x={x - offset - 5} y={y + h * BASE_SCALE / 2} fill={textFill} fontSize={fontSize} textAnchor="end" dominantBaseline="middle">{Math.round(h)}</text>
                                                </g>
                                            );
                                        }
                                    })()}
                                </g>
                            );
                        })}
                    </g>
                )}
            </g>
        </svg>
        {/* マーキー選択矩形 */}
        {marquee && (
            <div
                style={{
                    position: 'fixed',
                    left: Math.min(marquee.sx, marquee.ex),
                    top: Math.min(marquee.sy, marquee.ey),
                    width: Math.abs(marquee.ex - marquee.sx),
                    height: Math.abs(marquee.ey - marquee.sy),
                    border: '2px dashed #3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    pointerEvents: 'none',
                    zIndex: 9999
                }}
            />
        )}
    </div>
);

export const DesignCanvas = ({ viewState, setViewState, assets, designTargetId, setLocalAssets, selectedShapeIndices, setSelectedShapeIndices, selectedPointIndex, setSelectedPointIndex }) => {
    const dragRef = useRef({ mode: 'idle' });
    const [cursorMode, setCursorMode] = useState('idle');
    const svgRef = useRef(null);
    const [marquee, setMarquee] = useState(null); // マーキー選択用
    const asset = assets.find(a => a.id === designTargetId);

    const handleDown = (e, shapeIndex = null, pointIndex = null, resizeMode = null, handleIndex = null) => {
        if (svgRef.current && e.pointerId) svgRef.current.setPointerCapture(e.pointerId);
        const rect = svgRef.current.getBoundingClientRect();

        // キャンバス全体の移動（中ボタンのみ - 背景パンはWASD/矢印キーで）
        if (e.button === 1) {
            dragRef.current = { mode: 'panning', sx: e.clientX, sy: e.clientY, vx: viewState.x, vy: viewState.y };
            setCursorMode('panning');
            return;
        }

        // 背景左クリック時はマーキー選択開始
        if (shapeIndex === null && e.button === 0) {
            setMarquee({ sx: e.clientX, sy: e.clientY, ex: e.clientX, ey: e.clientY });
            if (!e.ctrlKey && !e.metaKey) {
                setSelectedShapeIndices([]); // Ctrlなしなら選択解除
            }
            dragRef.current = {
                mode: 'marquee',
                sx: e.clientX, sy: e.clientY,
                prevSelectedIndices: e.ctrlKey || e.metaKey ? [...selectedShapeIndices] : []
            };
            return;
        }

        // リサイズハンドルドラッグ
        if (resizeMode && shapeIndex !== null) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            setSelectedPointIndex(null);
            const shape = asset.shapes[shapeIndex];
            dragRef.current = {
                mode: 'resizing',
                sx: e.clientX, sy: e.clientY,
                shapeW: shape.w, shapeH: shape.h,
                shapeX: shape.x || 0, shapeY: shape.y || 0,
                resizeMode
            };
            setCursorMode('resizing');
            return;
        }

        // 制御点（ハンドル）ドラッグ
        if (handleIndex !== null && pointIndex !== null && shapeIndex !== null) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            setSelectedPointIndex(pointIndex);
            const shape = asset.shapes[shapeIndex];
            const handle = shape.points[pointIndex].handles[handleIndex];
            dragRef.current = { mode: 'draggingHandle', sx: e.clientX, sy: e.clientY, handleX: handle.x, handleY: handle.y, handleIndex };
            setCursorMode('draggingHandle');
            return;
        }

        // 角度ハンドルドラッグ（円弧用）
        if ((pointIndex === 'startAngle' || pointIndex === 'endAngle') && shapeIndex !== null) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            const shape = asset.shapes[shapeIndex];
            const rect = svgRef.current.getBoundingClientRect();
            dragRef.current = {
                mode: 'draggingAngle',
                targetProp: pointIndex,
                cx: (shape.cx || 0) * viewState.scale * BASE_SCALE + viewState.x + rect.left,
                cy: (shape.cy || 0) * viewState.scale * BASE_SCALE + viewState.y + rect.top
            };
            setCursorMode('draggingAngle');
            return;
        }

        // 回転ハンドルドラッグ
        if (pointIndex === 'rotation' && shapeIndex !== null) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            const shape = asset.shapes[shapeIndex];
            const rect = svgRef.current.getBoundingClientRect();
            // シェイプ中心（または回転中心）を計算
            let cx = (shape.x || 0) + (shape.w || 0) / 2;
            let cy = (shape.y || 0) + (shape.h || 0) / 2;
            if (shape.type === 'ellipse' || shape.type === 'arc') {
                cx = shape.cx || 0;
                cy = shape.cy || 0;
            } else if (shape.type === 'polygon') {
                // ポリゴンの中心計算は簡易的にバウンディングボックス中心
                // (本来は重心などが良いが、既存実装に合わせるならそのまま)
            }

            dragRef.current = {
                mode: 'draggingRotation',
                cx: cx * viewState.scale * BASE_SCALE + viewState.x + rect.left,
                cy: cy * viewState.scale * BASE_SCALE + viewState.y + rect.top,
                initialRotation: shape.rotation || 0,
                startAngle: 0 // moveで計算
            };
            // moveでの計算用にstartAngleが必要だが、ここでは一旦マウス位置との角度を保持
            const mx = e.clientX;
            const my = e.clientY;
            dragRef.current.startAngle = Math.atan2(my - dragRef.current.cy, mx - dragRef.current.cx) * 180 / Math.PI;

            setCursorMode('draggingRotation');
            return;
        }

        // 半径ハンドルドラッグ（円・円弧）
        if ((pointIndex === 'rx' || pointIndex === 'ry') && shapeIndex !== null) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            const shape = asset.shapes[shapeIndex];
            dragRef.current = {
                mode: 'draggingRadius',
                targetProp: pointIndex,
                sx: e.clientX, sy: e.clientY,
                initialVal: shape[pointIndex] || 50
            };
            setCursorMode('ew-resize'); // 簡易
            return;
        }

        // 頂点ドラッグ
        if (pointIndex !== null && shapeIndex !== null) {
            e.stopPropagation();
            setSelectedShapeIndices([shapeIndex]);
            setSelectedPointIndex(pointIndex);
            const shape = asset.shapes[shapeIndex];
            const pt = shape.points[pointIndex];
            dragRef.current = { mode: 'draggingPoint', sx: e.clientX, sy: e.clientY, pointX: pt.x, pointY: pt.y };
            setCursorMode('draggingPoint');
            return;
        }

        // シェイプドラッグ（移動）
        if (shapeIndex !== null) {
            e.stopPropagation();

            let newSelectedIndices = [...selectedShapeIndices];
            if (e.ctrlKey || e.metaKey) {
                // トグル選択
                if (newSelectedIndices.includes(shapeIndex)) {
                    newSelectedIndices = newSelectedIndices.filter(i => i !== shapeIndex);
                } else {
                    newSelectedIndices.push(shapeIndex);
                }
                setSelectedShapeIndices(newSelectedIndices);
            } else {
                // 単一選択または既存選択の維持
                if (!newSelectedIndices.includes(shapeIndex)) {
                    newSelectedIndices = [shapeIndex];
                    setSelectedShapeIndices(newSelectedIndices);
                }
            }

            // 選択されているシェイプがなければ終了（トグルで全部消えた場合など）
            if (newSelectedIndices.length === 0) return;

            // 選択中の全シェイプの初期位置を保存
            const initialShapes = newSelectedIndices.map(i => ({
                index: i,
                // deep copy
                data: JSON.parse(JSON.stringify(asset.shapes[i]))
            }));

            const anchorIndex = newSelectedIndices[0];
            const anchorShape = asset.shapes[anchorIndex];
            const anchorX = anchorShape.x !== undefined ? anchorShape.x : (anchorShape.cx !== undefined ? anchorShape.cx : 0);
            const anchorY = anchorShape.y !== undefined ? anchorShape.y : (anchorShape.cy !== undefined ? anchorShape.cy : 0);

            dragRef.current = {
                mode: 'draggingShape',
                sx: e.clientX, sy: e.clientY,
                initialShapes: initialShapes,
                anchorX, anchorY
            };
            setCursorMode('draggingShape');
            return;
        }

        // 選択解除
        setSelectedShapeIndices([]);
        setSelectedPointIndex(null);
    };

    const handleMove = (e) => {
        const mode = dragRef.current.mode;
        if (mode === 'idle') return;
        e.preventDefault();

        if (mode === 'panning') {
            const dx = e.clientX - dragRef.current.sx;
            const dy = e.clientY - dragRef.current.sy;
            setViewState(p => ({ ...p, x: dragRef.current.vx + dx, y: dragRef.current.vy + dy }));
        } else if (mode === 'marquee') {
            // マーキー矩形更新
            setMarquee(prev => prev ? { ...prev, ex: e.clientX, ey: e.clientY } : null);

            // マーキー選択処理
            if (svgRef.current) {
                const rect = svgRef.current.getBoundingClientRect();
                const scale = viewState.scale * BASE_SCALE;
                const toWorld = (screenX, screenY) => ({
                    x: (screenX - rect.left - viewState.x) / scale,
                    y: (screenY - rect.top - viewState.y) / scale
                });

                const p1 = toWorld(dragRef.current.sx, dragRef.current.sy);
                const p2 = toWorld(e.clientX, e.clientY);
                const minX = Math.min(p1.x, p2.x);
                const maxX = Math.max(p1.x, p2.x);
                const minY = Math.min(p1.y, p2.y);
                const maxY = Math.max(p1.y, p2.y);

                const inBoxIndices = asset.shapes.map((s, i) => {
                    // バウンディングボックスで判定
                    const sx = s.x || 0;
                    const sy = s.y || 0;
                    const sw = s.w || 0;
                    const sh = s.h || 0;
                    // シェイプの中心または範囲が交差するか？ここでは中心判定
                    let cx, cy;
                    if (s.type === 'polygon' && s.points) {
                        const xs = s.points.map(p => p.x);
                        const ys = s.points.map(p => p.y);
                        const minPx = Math.min(...xs);
                        const maxPx = Math.max(...xs);
                        const minPy = Math.min(...ys);
                        const maxPy = Math.max(...ys);
                        cx = minPx + (maxPx - minPx) / 2;
                        cy = minPy + (maxPy - minPy) / 2;
                    } else if (s.type === 'ellipse' || s.type === 'arc' || s.type === 'circle') {
                        cx = s.cx !== undefined ? s.cx : (s.x + s.w / 2);
                        cy = s.cy !== undefined ? s.cy : (s.y + s.h / 2);
                    } else {
                        cx = (s.x || 0) + (s.w || 0) / 2;
                        cy = (s.y || 0) + (s.h || 0) / 2;
                    }
                    return (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) ? i : -1;
                }).filter(i => i !== -1);

                // Ctrl押してる場合は追加選択
                const initialSelected = dragRef.current.prevSelectedIndices || [];
                const newIndices = [...new Set([...initialSelected, ...inBoxIndices])];
                setSelectedShapeIndices(newIndices);
            }
        } else if (mode === 'resizing' && selectedShapeIndices.length > 0) {
            const dx = (e.clientX - dragRef.current.sx) / viewState.scale / BASE_SCALE;
            const dy = (e.clientY - dragRef.current.sy) / viewState.scale / BASE_SCALE;
            const newShapes = [...asset.shapes];
            const targetIdx = selectedShapeIndices[0]; // Resizeは単一
            const targetShape = newShapes[targetIdx];
            const resizeMode = dragRef.current.resizeMode;

            if (resizeMode === 'both') {
                const aspect = dragRef.current.shapeW / dragRef.current.shapeH;
                let newW = dragRef.current.shapeW + dx;
                let newH = dragRef.current.shapeH + dy;
                if (!e.shiftKey) {
                    newW = Math.round(newW / SNAP_UNIT) * SNAP_UNIT;
                    newH = Math.round(newH / SNAP_UNIT) * SNAP_UNIT;
                }
                newW = Math.max(10, newW);
                newH = Math.max(10, newH);
                newShapes[targetIdx] = { ...targetShape, w: newW, h: newH };
            } else if (resizeMode === 'width') {
                let newW = dragRef.current.shapeW + dx;
                if (!e.shiftKey) newW = Math.round(newW / SNAP_UNIT) * SNAP_UNIT;
                newW = Math.max(10, newW);
                newShapes[targetIdx] = { ...targetShape, w: newW };
            } else if (resizeMode === 'height') {
                let newH = dragRef.current.shapeH + dy;
                if (!e.shiftKey) newH = Math.round(newH / SNAP_UNIT) * SNAP_UNIT;
                newH = Math.max(10, newH);
                newShapes[targetIdx] = { ...targetShape, h: newH };
            }
            setLocalAssets(prev => prev.map(a => a.id === designTargetId ? { ...a, shapes: newShapes } : a));
        } else if (mode === 'draggingShape') {
            const rawDx = (e.clientX - dragRef.current.sx) / viewState.scale / BASE_SCALE;
            const rawDy = (e.clientY - dragRef.current.sy) / viewState.scale / BASE_SCALE;

            let moveX = rawDx;
            let moveY = rawDy;

            // スナップ計算
            if (asset.snap && !e.shiftKey) {
                const anchorX = dragRef.current.anchorX || 0;
                const anchorY = dragRef.current.anchorY || 0;
                const targetX = anchorX + rawDx;
                const targetY = anchorY + rawDy;
                const snappedX = Math.round(targetX / SNAP_UNIT) * SNAP_UNIT;
                const snappedY = Math.round(targetY / SNAP_UNIT) * SNAP_UNIT;
                moveX = snappedX - anchorX;
                moveY = snappedY - anchorY;
            }

            const newShapes = [...asset.shapes];
            const initialShapes = dragRef.current.initialShapes || [];

            initialShapes.forEach(({ index, data }) => {
                let updatedShape = { ...newShapes[index] };

                // 座標移動
                if (data.x !== undefined) updatedShape.x = (data.x || 0) + moveX;
                if (data.y !== undefined) updatedShape.y = (data.y || 0) + moveY;
                if (data.cx !== undefined) updatedShape.cx = (data.cx || 0) + moveX;
                if (data.cy !== undefined) updatedShape.cy = (data.cy || 0) + moveY;

                // Points移動
                if (data.points) {
                    updatedShape.points = data.points.map(p => ({ ...p, x: p.x + moveX, y: p.y + moveY }));
                }

                newShapes[index] = updatedShape;
            });

            setLocalAssets(prev => prev.map(a => a.id === designTargetId ? { ...a, shapes: newShapes } : a));

        } else if (mode === 'draggingPoint' && selectedShapeIndices.length > 0 && selectedPointIndex !== null) {
            const dx = (e.clientX - dragRef.current.sx) / viewState.scale / BASE_SCALE;
            const dy = (e.clientY - dragRef.current.sy) / viewState.scale / BASE_SCALE;
            const newShapes = [...asset.shapes];
            const targetIdx = selectedShapeIndices[0];

            const pts = [...newShapes[targetIdx].points];
            let nx = dragRef.current.pointX + dx;
            let ny = dragRef.current.pointY + dy;
            if (!e.shiftKey) {
                nx = Math.round(nx / SNAP_UNIT) * SNAP_UNIT;
                ny = Math.round(ny / SNAP_UNIT) * SNAP_UNIT;
            }

            pts[selectedPointIndex] = { ...pts[selectedPointIndex], x: nx, y: ny };
            newShapes[targetIdx].points = pts;

            // x, y, w, h の再計算 (Polygon用)
            if (newShapes[targetIdx].type === 'polygon') {
                const xs = pts.map(p => p.x);
                const ys = pts.map(p => p.y);
                newShapes[targetIdx].x = Math.min(...xs);
                newShapes[targetIdx].y = Math.min(...ys);
                newShapes[targetIdx].w = Math.max(...xs) - newShapes[targetIdx].x;
                newShapes[targetIdx].h = Math.max(...ys) - newShapes[targetIdx].y;
            }

            setLocalAssets(prev => prev.map(a => a.id === designTargetId ? { ...a, shapes: newShapes } : a));

        } else if (mode === 'draggingHandle' && selectedShapeIndices.length > 0 && selectedPointIndex !== null) {
            const dx = (e.clientX - dragRef.current.sx) / viewState.scale / BASE_SCALE;
            const dy = (e.clientY - dragRef.current.sy) / viewState.scale / BASE_SCALE;
            const newShapes = [...asset.shapes];
            const targetIdx = selectedShapeIndices[0];

            const pts = [...newShapes[targetIdx].points];
            const pt = { ...pts[selectedPointIndex] };
            const handles = [...pt.handles];
            const hIndex = dragRef.current.handleIndex;

            handles[hIndex] = {
                x: dragRef.current.handleX + dx,
                y: dragRef.current.handleY + dy
            };
            pt.handles = handles;
            pts[selectedPointIndex] = pt;
            newShapes[targetIdx].points = pts;

            setLocalAssets(prev => prev.map(a => a.id === designTargetId ? { ...a, shapes: newShapes } : a));

        } else if (mode === 'draggingAngle' && selectedShapeIndices.length > 0) {
            const targetIdx = selectedShapeIndices[0];
            const rect = svgRef.current.getBoundingClientRect();
            const cx = dragRef.current.cx; // screen coord
            const cy = dragRef.current.cy;
            const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
            const deg = (angle + 360) % 360; // 0-360

            const newShapes = [...asset.shapes];
            // 15度スナップ (Shiftを押していない時)
            const snapped = e.shiftKey ? deg : Math.round(deg / 15) * 15;
            newShapes[targetIdx][dragRef.current.targetProp] = snapped;
            setLocalAssets(prev => prev.map(a => a.id === designTargetId ? { ...a, shapes: newShapes } : a));

        } else if (mode === 'draggingRotation' && selectedShapeIndices.length > 0) {
            const targetIdx = selectedShapeIndices[0];
            const cx = dragRef.current.cx;
            const cy = dragRef.current.cy;
            const currentAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
            const delta = currentAngle - dragRef.current.startAngle;
            let newRot = (dragRef.current.initialRotation + delta + 360) % 360;

            // 15度スナップ (Shiftを押していない時)
            if (!e.shiftKey) {
                newRot = Math.round(newRot / 15) * 15;
            }

            const newShapes = [...asset.shapes];
            newShapes[targetIdx].rotation = newRot;
            setLocalAssets(prev => prev.map(a => a.id === designTargetId ? { ...a, shapes: newShapes } : a));

        } else if (mode === 'draggingRadius' && selectedShapeIndices.length > 0) {
            const targetIdx = selectedShapeIndices[0];
            const newShapes = [...asset.shapes];
            const scale = viewState.scale * BASE_SCALE;

            const dx = (e.clientX - dragRef.current.sx) / scale;
            let newVal = dragRef.current.initialVal + dx;
            if (!e.shiftKey) {
                newVal = Math.round(newVal / SNAP_UNIT) * SNAP_UNIT;
            }
            newVal = Math.max(1, newVal);

            newShapes[targetIdx][dragRef.current.targetProp] = newVal;
            setLocalAssets(prev => prev.map(a => a.id === designTargetId ? { ...a, shapes: newShapes } : a));
        }
    };

    const handleUp = () => {
        setMarquee(null);
        setCursorMode('idle');
        dragRef.current = { mode: 'idle' };
    };

    const handleDeleteShape = (index) => {
        if (!confirm('このシェイプを削除しますか？')) return;
        const newShapes = asset.shapes.filter((_, i) => i !== index);
        setLocalAssets(prev => prev.map(a => a.id === designTargetId ? { ...a, shapes: newShapes } : a));
        setSelectedShapeIndices([]);
    };

    const shapes = (asset && asset.shapes && asset.shapes.length > 0)
        ? asset.shapes
        : (asset ? [{ type: asset.shape || 'rect', w: asset.w, h: asset.h, x: 0, y: 0, color: asset.color, points: asset.points || createRectPath(asset.w, asset.h) }] : []);

    return <DesignCanvasRender viewState={viewState} asset={asset} shapes={shapes} selectedShapeIndices={selectedShapeIndices} selectedPointIndex={selectedPointIndex} onDown={handleDown} onMove={handleMove} onUp={handleUp} onDeleteShape={handleDeleteShape} svgRef={svgRef} marquee={marquee} />;
};
