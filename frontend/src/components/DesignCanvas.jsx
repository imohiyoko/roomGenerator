import React, { useState, useRef, useEffect } from 'react';
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
                        {/* アセット全体のバウンディングボックス（点線）- 常に現在のシェイプに合わせて再計算されたサイズを表示 */}
                        <rect x={asset.boundX * BASE_SCALE || 0} y={asset.boundY * BASE_SCALE || 0} width={asset.w * BASE_SCALE} height={asset.h * BASE_SCALE} fill="none" stroke="blue" strokeWidth="1" strokeDasharray="4 2" opacity="0.3" pointerEvents="none" />

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

    // アセットのバウンディングボックス自動計算・更新
    useEffect(() => {
        if (!asset || !asset.shapes || asset.shapes.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasPoints = false;

        asset.shapes.forEach(s => {
            if (s.points) {
                hasPoints = true;
                s.points.forEach(p => {
                    if (p.x < minX) minX = p.x;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.y > maxY) maxY = p.y;
                });
            } else if (s.type === 'ellipse' || s.type === 'arc' || s.type === 'circle') {
                hasPoints = true;
                const cx = s.cx !== undefined ? s.cx : (s.x + s.w / 2);
                const cy = s.cy !== undefined ? s.cy : (s.y + s.h / 2);
                const rx = s.rx !== undefined ? s.rx : (s.w / 2);
                const ry = s.ry !== undefined ? s.ry : (s.h / 2);
                if (cx - rx < minX) minX = cx - rx;
                if (cx + rx > maxX) maxX = cx + rx;
                if (cy - ry < minY) minY = cy - ry;
                if (cy + ry > maxY) maxY = cy + ry;
            } else {
                hasPoints = true;
                const x = s.x || 0;
                const y = s.y || 0;
                const w = s.w || 0;
                const h = s.h || 0;
                if (x < minX) minX = x;
                if (x + w > maxX) maxX = x + w;
                if (y < minY) minY = y;
                if (y + h > maxY) maxY = y + h;
            }
        });

        if (hasPoints && minX !== Infinity) {
            const w = Math.round(maxX - minX);
            const h = Math.round(maxY - minY);
            const bx = Math.round(minX);
            const by = Math.round(minY);

            // 変更がある場合のみ更新 (無限ループ防止)
            if (asset.w !== w || asset.h !== h || asset.boundX !== bx || asset.boundY !== by) {
                // setTimeoutで更新を遅延させないとレンダリングサイクルと競合する可能性あり
                // ただし、頻繁な更新は重くなるので、drag中は更新しないほうが良いかもしれない
                // ここではシンプルに更新するが、パフォーマンス問題が出る場合はdragRef.current.mode === 'idle'のチェックを入れる
                if (dragRef.current.mode === 'idle') {
                     setLocalAssets(prev => prev.map(a => a.id === designTargetId ? { ...a, boundX: bx, boundY: by, w, h } : a));
                }
            }
        }
    }, [asset, designTargetId, setLocalAssets]); // asset全体に依存するとループする恐れがあるが、asset.shapesのみに依存させたい

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

    const handleUp = () => {
        setMarquee(null);
        setCursorMode('idle');
        dragRef.current = { mode: 'idle' };

        // ドラッグ終了時に確実にアセットサイズを更新する
        if (asset && asset.shapes) {
            const shapes = asset.shapes;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let hasPoints = false;

            shapes.forEach(s => {
                if (s.points) {
                    hasPoints = true;
                    s.points.forEach(p => {
                        if (p.x < minX) minX = p.x;
                        if (p.x > maxX) maxX = p.x;
                        if (p.y < minY) minY = p.y;
                        if (p.y > maxY) maxY = p.y;
                    });
                } else if (s.type === 'ellipse' || s.type === 'arc' || s.type === 'circle') {
                    hasPoints = true;
                    const cx = s.cx !== undefined ? s.cx : (s.x + s.w / 2);
                    const cy = s.cy !== undefined ? s.cy : (s.y + s.h / 2);
                    const rx = s.rx !== undefined ? s.rx : (s.w / 2);
                    const ry = s.ry !== undefined ? s.ry : (s.h / 2);
                    if (cx - rx < minX) minX = cx - rx;
                    if (cx + rx > maxX) maxX = cx + rx;
                    if (cy - ry < minY) minY = cy - ry;
                    if (cy + ry > maxY) maxY = cy + ry;
                } else {
                    hasPoints = true;
                    const x = s.x || 0;
                    const y = s.y || 0;
                    const w = s.w || 0;
                    const h = s.h || 0;
                    if (x < minX) minX = x;
                    if (x + w > maxX) maxX = x + w;
                    if (y < minY) minY = y;
                    if (y + h > maxY) maxY = y + h;
                }
            });

            if (hasPoints && minX !== Infinity) {
                const w = Math.round(maxX - minX);
                const h = Math.round(maxY - minY);
                const bx = Math.round(minX);
                const by = Math.round(minY);
                if (asset.w !== w || asset.h !== h || asset.boundX !== bx || asset.boundY !== by) {
                    setLocalAssets(prev => prev.map(a => a.id === designTargetId ? { ...a, boundX: bx, boundY: by, w, h } : a));
                }
            }
        }
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
