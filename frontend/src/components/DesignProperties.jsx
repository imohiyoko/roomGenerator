import React from 'react';
import { Icon, Icons } from './Icon';
import { ColorPicker } from './ColorPicker';
import { NumberInput } from './NumberInput';
import { fromMM, toMM, createRectPath, createTrianglePath, deepClone } from '../lib/utils';
import { useStore } from '../store';

export const DesignProperties = ({ assets, designTargetId, setLocalAssets, setGlobalAssets, setDesignTargetId, palette, onAddToPalette, defaultColors }) => {
    // Select state from store
    const selectedShapeIndices = useStore(state => state.selectedShapeIndices);
    const setSelectedShapeIndices = useStore(state => state.setSelectedShapeIndices);
    const selectedPointIndex = useStore(state => state.selectedPointIndex);
    const setSelectedPointIndex = useStore(state => state.setSelectedPointIndex);

    const asset = assets.find(a => a.id === designTargetId);

    // 未選択時
    if (!asset) {
        return (
            <div className="h-full flex flex-col text-gray-500 text-xs items-center justify-center p-4">
                <Icon p={Icons.Pen} size={48} className="text-orange-200 mb-2" />
                <p>左のリストから編集する<br />アセットを選択してください</p>
            </div>
        );
    }

    const isMultiSelect = selectedShapeIndices.length > 1;
    const targetIndex = selectedShapeIndices.length === 1 ? selectedShapeIndices[0] : null;
    const selectedShape = (asset.shapes && targetIndex !== null) ? asset.shapes[targetIndex] : null;
    const selectedPoint = (selectedShape && selectedShape.points && selectedPointIndex !== null) ? selectedShape.points[selectedPointIndex] : null;

    const updateRoot = (k, v) => {
        if (asset.source === 'global') return;
        setLocalAssets(p => p.map(a => {
            if (a.id !== designTargetId) return a;
            let updates = { [k]: v };

            // 種類変更時にデフォルト形状なら色も更新
            if (k === 'type' && a.isDefaultShape && defaultColors && defaultColors[v]) {
                const newColor = defaultColors[v];
                updates.color = newColor;
                updates.shapes = (a.shapes || []).map(s => ({ ...s, color: newColor }));
            }
            // 色を手動変更したらデフォルト形状フラグを下ろす
            if (k === 'color') {
                updates.isDefaultShape = false;
            }
            return { ...a, ...updates };
        }));
    };

    // 単一選択用更新関数
    const updateShape = (k, v) => {
        if (asset.source === 'global' || targetIndex === null) return;
        const currentShapes = asset.shapes || [];
        const newShapes = currentShapes.map((s, i) => i === targetIndex ? { ...s, [k]: v } : s);
        // 形状変更時はデフォルト形状フラグを下ろす
        setLocalAssets(p => p.map(a => a.id === designTargetId ? { ...a, shapes: newShapes, isDefaultShape: false } : a));
    };
    const updatePoint = (k, v) => {
        if (asset.source === 'global' || targetIndex === null || selectedPointIndex === null) return;
        const newShapes = [...asset.shapes];
        const newPts = [...newShapes[targetIndex].points];
        const newPt = { ...newPts[selectedPointIndex], [k]: v };
        newPts[selectedPointIndex] = newPt;
        newShapes[targetIndex].points = newPts;
        setLocalAssets(p => p.map(a => a.id === designTargetId ? { ...a, shapes: newShapes, isDefaultShape: false } : a));
    };

    // 一括操作用関数
    const bulkUpdate = (updater) => {
        const newShapes = asset.shapes.map((s, i) => {
            if (selectedShapeIndices.includes(i)) {
                return updater(s);
            }
            return s;
        });
        setLocalAssets(prev => prev.map(a => a.id === designTargetId ? { ...a, shapes: newShapes, isDefaultShape: false } : a));
    };

    const bulkMove = (dx, dy) => {
        bulkUpdate(s => {
            let ns = { ...s, x: (s.x || 0) + dx, y: (s.y || 0) + dy };
            if (s.cx !== undefined) ns.cx = (s.cx || 0) + dx;
            if (s.cy !== undefined) ns.cy = (s.cy || 0) + dy;
            if (s.points) ns.points = s.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
            return ns;
        });
    };

    const bulkDelete = () => {
        if (!confirm(`${selectedShapeIndices.length}個のシェイプを削除しますか？`)) return;
        const newShapes = asset.shapes.filter((_, i) => !selectedShapeIndices.includes(i));
        setLocalAssets(prev => prev.map(a => a.id === designTargetId ? { ...a, shapes: newShapes, isDefaultShape: false } : a));
        setSelectedShapeIndices([]);
    };

    const bulkColor = (color) => {
        bulkUpdate(s => ({ ...s, color }));
    };

    const bulkResize = (scalePercent) => {
        const scale = scalePercent / 100;
        if (scale <= 0) return;

        // 1. グループのバウンディングボックス（左上）を計算
        let groupMinX = Infinity;
        let groupMinY = Infinity;

        selectedShapeIndices.forEach(index => {
            const s = asset.shapes[index];
            if (!s) return;
            if (s.points) {
                s.points.forEach(p => {
                    if (p.x < groupMinX) groupMinX = p.x;
                    if (p.y < groupMinY) groupMinY = p.y;
                });
            } else if (s.type === 'ellipse' || s.type === 'arc' || s.type === 'circle') {
                const cx = s.cx !== undefined ? s.cx : (s.x + s.w / 2);
                const cy = s.cy !== undefined ? s.cy : (s.y + s.h / 2);
                const rx = s.rx !== undefined ? s.rx : (s.w / 2);
                const ry = s.ry !== undefined ? s.ry : (s.h / 2);
                if (cx - rx < groupMinX) groupMinX = cx - rx;
                if (cy - ry < groupMinY) groupMinY = cy - ry;
            } else {
                const x = s.x || 0;
                const y = s.y || 0;
                if (x < groupMinX) groupMinX = x;
                if (y < groupMinY) groupMinY = y;
            }
        });

        if (groupMinX === Infinity || groupMinY === Infinity) return;

        // 2. 左上基準でスケーリング
        bulkUpdate(s => {
            let ns = { ...s };

            if (s.points) {
                ns.points = s.points.map(p => ({
                    ...p,
                    x: Math.round(groupMinX + (p.x - groupMinX) * scale),
                    y: Math.round(groupMinY + (p.y - groupMinY) * scale)
                }));
                // width/height再計算 (Polygon用)
                const xs = ns.points.map(p => p.x);
                const ys = ns.points.map(p => p.y);
                ns.w = Math.max(...xs) - Math.min(...xs);
                ns.h = Math.max(...ys) - Math.min(...ys);
                // x, y も更新する場合があるが、pointsメインなら再計算不要かもしれないが一応更新
                ns.x = Math.min(...xs);
                ns.y = Math.min(...ys);

            } else if (s.type === 'ellipse' || s.type === 'arc' || s.type === 'circle') {
                const cx = s.cx !== undefined ? s.cx : (s.x + s.w / 2);
                const cy = s.cy !== undefined ? s.cy : (s.y + s.h / 2);
                const rx = s.rx !== undefined ? s.rx : (s.w / 2);
                const ry = s.ry !== undefined ? s.ry : (s.h / 2);

                const newCx = groupMinX + (cx - groupMinX) * scale;
                const newCy = groupMinY + (cy - groupMinY) * scale;
                const newRx = rx * scale;
                const newRy = ry * scale;

                if (s.cx !== undefined) ns.cx = Math.round(newCx);
                if (s.cy !== undefined) ns.cy = Math.round(newCy);
                if (s.rx !== undefined) ns.rx = Math.round(newRx);
                if (s.ry !== undefined) ns.ry = Math.round(newRy);
                // x, y, w, h も更新
                ns.x = Math.round(newCx - newRx);
                ns.y = Math.round(newCy - newRy);
                ns.w = Math.round(newRx * 2);
                ns.h = Math.round(newRy * 2);

            } else {
                // Rect / Image / Text etc
                // position
                const x = s.x || 0;
                const y = s.y || 0;
                const newX = groupMinX + (x - groupMinX) * scale;
                const newY = groupMinY + (y - groupMinY) * scale;

                ns.x = Math.round(newX);
                ns.y = Math.round(newY);
                if (s.w) ns.w = Math.round(s.w * scale);
                if (s.h) ns.h = Math.round(s.h * scale);
            }

            return ns;
        });
    };

    const fork = () => {
        const newId = `a-fork-${Date.now()}`;
        const newA = deepClone(asset);
        newA.id = newId;
        newA.name = asset.name + ' (コピー)';
        delete newA.source;
        // デフォルト形状フラグを維持
        if (asset.isDefaultShape) newA.isDefaultShape = true;
        setLocalAssets(prev => [...prev, newA]);
        if (setDesignTargetId) setDesignTargetId(newId);
    };
    const publish = () => { if (!confirm('共通ライブラリに追加しますか？')) return; setGlobalAssets(prev => [...prev, { ...asset, id: `a-pub-${Date.now()}`, source: undefined }]); alert('追加しました'); };

    // 全体を(0,0)に寄せる
    const normalizePosition = () => {
        if (asset.source === 'global') return;
        const shapes = asset.shapes || [];
        if (shapes.length === 0) return;
        let minX = Infinity, minY = Infinity;
        shapes.forEach(s => {
            if (s.points) {
                s.points.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); });
            } else {
                minX = Math.min(minX, s.x || 0); minY = Math.min(minY, s.y || 0);
            }
        });
        if (minX === Infinity || (minX === 0 && minY === 0)) return;
        const newShapes = shapes.map(s => {
            if (s.points) return { ...s, points: s.points.map(p => ({ ...p, x: p.x - minX, y: p.y - minY })) };
            return { ...s, x: (s.x || 0) - minX, y: (s.y || 0) - minY };
        });
        let maxX = 0, maxY = 0;
        newShapes.forEach(s => {
            if (s.points) s.points.forEach(p => { maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
            else { maxX = Math.max(maxX, (s.x || 0) + s.w); maxY = Math.max(maxY, (s.y || 0) + s.h); }
        });
        setLocalAssets(prev => prev.map(a => a.id === designTargetId ? { ...a, shapes: newShapes, w: maxX, h: maxY, isDefaultShape: false } : a));
    };

    if (asset.source === 'global') return (
        <div className="p-4 bg-blue-50 h-full flex flex-col items-center justify-center text-center">
            <Icon p={Icons.Lock} size={32} className="text-blue-300 mb-2" />
            <div className="text-sm font-bold text-blue-800 mb-1">{asset.name}</div>
            <div className="text-xs text-blue-600 mb-4">共通パーツは編集できません</div>
            <button onClick={fork} className="bg-blue-600 text-white text-xs px-4 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2"><Icon p={Icons.Copy} size={14} /> コピーして編集</button>
        </div>
    );

    return (
        <div className="h-full flex flex-col">
            <div className="sidebar-header">
                <span>形状プロパティ</span>
                <button onClick={normalizePosition} className="text-[10px] bg-orange-50 text-orange-600 px-2 py-1 rounded border border-orange-200 hover:bg-orange-100">
                    0,0に揃える
                </button>
            </div>

            <div className="p-3 overflow-y-auto flex-1 space-y-4">
                {/* Basic Info */}
                <div className="bg-orange-50 border border-orange-100 rounded p-2">
                    <div className="prop-row">
                        <label className="prop-label">名称</label>
                        <input value={asset.name} onChange={e => updateRoot('name', e.target.value)} className="prop-input font-bold text-left" />
                    </div>
                    <div className="prop-row">
                        <label className="prop-label">種類</label>
                        <select value={asset.type} onChange={e => updateRoot('type', e.target.value)} className="prop-input text-xs">
                            <option value="room">部屋・床</option>
                            <option value="fixture">設備・建具</option>
                            <option value="furniture">家具</option>
                        </select>
                    </div>
                    <div className="pt-2">
                        <label className="prop-label block mb-1">全体色</label>
                        <ColorPicker value={asset.color} onChange={c => updateRoot('color', c)} palette={palette} onAddToPalette={onAddToPalette} />
                    </div>
                </div>

                {/* Shape / Point Editor */}
                {isMultiSelect ? (
                    <div className="bg-purple-50 border border-purple-100 rounded p-3 space-y-3">
                        <div className="font-bold text-sm text-purple-800">{selectedShapeIndices.length} 個のシェイプを選択中</div>
                        <div className="text-[10px] text-purple-500">一括操作</div>

                        {/* 一括移動 */}
                        <div className="prop-row">
                            <label className="prop-label">移動 (mm)</label>
                            <div className="flex gap-1">
                                <button onClick={() => bulkMove(-100, 0)} className="px-2 py-1 bg-white rounded border hover:bg-gray-50">←</button>
                                <button onClick={() => bulkMove(0, -100)} className="px-2 py-1 bg-white rounded border hover:bg-gray-50">↑</button>
                                <button onClick={() => bulkMove(0, 100)} className="px-2 py-1 bg-white rounded border hover:bg-gray-50">↓</button>
                                <button onClick={() => bulkMove(100, 0)} className="px-2 py-1 bg-white rounded border hover:bg-gray-50">→</button>
                            </div>
                        </div>

                        {/* 一括リサイズ */}
                        <div className="prop-row">
                            <label className="prop-label">拡大縮小</label>
                            <div className="flex gap-1">
                                <button onClick={() => bulkResize(90)} className="px-2 py-1 bg-white rounded border hover:bg-gray-50 text-xs">90%</button>
                                <button onClick={() => bulkResize(110)} className="px-2 py-1 bg-white rounded border hover:bg-gray-50 text-xs">110%</button>
                            </div>
                        </div>

                        {/* 一括色変更 */}
                        <div>
                            <label className="prop-label block mb-1">一括色変更</label>
                            <ColorPicker value={asset.color} onChange={bulkColor} palette={palette} onAddToPalette={onAddToPalette} />
                        </div>

                        {/* 一括削除 */}
                        <button onClick={bulkDelete} className="w-full py-2 bg-red-500 text-white rounded text-xs hover:bg-red-600 shadow-sm mt-2">
                            選択したシェイプを削除
                        </button>
                        <button
                            onClick={() => setSelectedShapeIndices([])}
                            className="w-full py-1 bg-gray-200 text-gray-600 rounded text-xs hover:bg-gray-300 mt-1"
                        >
                            選択解除
                        </button>
                    </div>
                ) : selectedPoint ? (
                    <div className="bg-white p-2 rounded border-2 border-red-300">
                        <div className="text-xs font-bold text-red-600 mb-2">選択頂点 (mm)</div>
                        <div className="prop-row">
                            <label className="prop-label">X</label>
                            <NumberInput value={toMM(selectedPoint.x)} onChange={e => updatePoint('x', fromMM(Number(e.target.value)))} className="prop-input" />
                        </div>
                        <div className="prop-row">
                            <label className="prop-label">Y</label>
                            <NumberInput value={toMM(selectedPoint.y)} onChange={e => updatePoint('y', fromMM(Number(e.target.value)))} className="prop-input" />
                        </div>
                        <div className="mt-2 pt-2 border-t">
                            <button onClick={() => {
                                if (selectedShape.points.length <= 3) { alert('最低3点必要です'); return; }
                                const newPts = selectedShape.points.filter((_, i) => i !== selectedPointIndex);
                                const newShapes = [...asset.shapes];
                                newShapes[targetIndex].points = newPts;
                                setLocalAssets(p => p.map(a => a.id === designTargetId ? { ...a, shapes: newShapes, isDefaultShape: false } : a));
                                setSelectedPointIndex(null);
                            }} className="w-full py-1.5 text-xs bg-red-50 border border-red-200 text-red-600 rounded hover:bg-red-100 font-bold">この頂点を削除</button>
                        </div>
                    </div>
                ) : selectedShape ? (
                    <div className="bg-white p-2 rounded border-2 border-blue-300">
                        <div className="text-xs font-bold text-blue-600 mb-2">選択パーツ (mm)</div>
                        {selectedShape.type !== 'polygon' && selectedShape.type !== 'ellipse' && (
                            <>
                                <div className="prop-row"><label className="prop-label">幅</label><NumberInput value={toMM(selectedShape.w)} onChange={e => updateShape('w', fromMM(Number(e.target.value)))} className="prop-input" /></div>
                                <div className="prop-row"><label className="prop-label">奥</label><NumberInput value={toMM(selectedShape.h)} onChange={e => updateShape('h', fromMM(Number(e.target.value)))} className="prop-input" /></div>
                                <div className="prop-row"><label className="prop-label">X</label><NumberInput value={toMM(selectedShape.x || 0)} onChange={e => updateShape('x', fromMM(Number(e.target.value)))} className="prop-input" /></div>
                                <div className="prop-row"><label className="prop-label">Y</label><NumberInput value={toMM(selectedShape.y || 0)} onChange={e => updateShape('y', fromMM(Number(e.target.value)))} className="prop-input" /></div>
                            </>
                        )}
                        <div className="pt-2">
                            <label className="prop-label block mb-1">色</label>
                            <ColorPicker value={selectedShape.color || asset.color} onChange={c => updateShape('color', c)} palette={palette} onAddToPalette={onAddToPalette} />
                        </div>

                        {/* 楕円プロパティ */}
                        {selectedShape.type === 'ellipse' && (
                            <div className="mt-3 border-t pt-2">
                                <div className="text-[10px] font-bold text-green-600 mb-2">楕円プロパティ</div>
                                <div className="prop-row"><label className="prop-label">中心X</label><NumberInput value={toMM(selectedShape.cx || 0)} onChange={e => updateShape('cx', fromMM(Number(e.target.value)))} className="prop-input" /></div>
                                <div className="prop-row"><label className="prop-label">中心Y</label><NumberInput value={toMM(selectedShape.cy || 0)} onChange={e => updateShape('cy', fromMM(Number(e.target.value)))} className="prop-input" /></div>
                                <div className="prop-row"><label className="prop-label">横半径</label><NumberInput value={toMM(selectedShape.rx || 50)} onChange={e => updateShape('rx', fromMM(Number(e.target.value)))} className="prop-input" /></div>
                                <div className="prop-row"><label className="prop-label">縦半径</label><NumberInput value={toMM(selectedShape.ry || 50)} onChange={e => updateShape('ry', fromMM(Number(e.target.value)))} className="prop-input" /></div>
                                <div className="prop-row"><label className="prop-label">回転°</label><NumberInput value={selectedShape.rotation || 0} onChange={e => updateShape('rotation', Number(e.target.value))} className="prop-input" /></div>
                                <div className="prop-row"><label className="prop-label">開始角°</label><NumberInput value={selectedShape.startAngle || 0} onChange={e => updateShape('startAngle', Number(e.target.value))} className="prop-input" /></div>
                                <div className="prop-row"><label className="prop-label">終了角°</label><NumberInput value={selectedShape.endAngle || 360} onChange={e => updateShape('endAngle', Number(e.target.value))} className="prop-input" /></div>
                                <div className="prop-row items-center">
                                    <label className="prop-label">形状</label>
                                    <select value={selectedShape.arcMode || 'sector'} onChange={e => updateShape('arcMode', e.target.value)} className="prop-input text-xs">
                                        <option value="sector">扇形</option>
                                        <option value="chord">弓形</option>
                                    </select>
                                </div>
                            </div>
                        )}
                        {selectedShape.type === 'polygon' && selectedShape.points && (
                            <div className="mt-3 border-t pt-2">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-bold text-purple-600">頂点編集 ({selectedShape.points.length}点)</span>
                                </div>
                                <div className="space-y-0 max-h-48 overflow-y-auto scrollbar-thin">
                                    {selectedShape.points.map((pt, idx) => (
                                        <React.Fragment key={idx}>
                                            {/* 頂点行 */}
                                            <div className={`border rounded p-1.5 ${selectedPointIndex === idx ? 'bg-purple-50 border-purple-300' : 'hover:bg-gray-50'}`}>
                                                <div className="flex items-center gap-1">
                                                    <span onClick={() => setSelectedPointIndex(idx)} className="w-5 h-5 flex items-center justify-center font-bold text-purple-400 bg-purple-100 rounded cursor-pointer text-[10px]">{idx}</span>
                                                    <NumberInput value={toMM(pt.x)} onChange={e => {
                                                        const newPts = [...selectedShape.points];
                                                        newPts[idx] = { ...newPts[idx], x: fromMM(Number(e.target.value)) };
                                                        const newShapes = [...asset.shapes];
                                                        newShapes[targetIndex].points = newPts;
                                                        setLocalAssets(p => p.map(a => a.id === designTargetId ? { ...a, shapes: newShapes, isDefaultShape: false } : a));
                                                    }} className="flex-1 text-[10px] p-0.5 border rounded w-12 text-center" placeholder="X" />
                                                    <NumberInput value={toMM(pt.y)} onChange={e => {
                                                        const newPts = [...selectedShape.points];
                                                        newPts[idx] = { ...newPts[idx], y: fromMM(Number(e.target.value)) };
                                                        const newShapes = [...asset.shapes];
                                                        newShapes[targetIndex].points = newPts;
                                                        setLocalAssets(p => p.map(a => a.id === designTargetId ? { ...a, shapes: newShapes, isDefaultShape: false } : a));
                                                    }} className="flex-1 text-[10px] p-0.5 border rounded w-12 text-center" placeholder="Y" />
                                                    <button onClick={() => {
                                                        if (selectedShape.points.length <= 3) { alert('最低3点必要です'); return; }
                                                        const newPts = selectedShape.points.filter((_, i) => i !== idx);
                                                        const newShapes = [...asset.shapes];
                                                        newShapes[targetIndex].points = newPts;
                                                        setLocalAssets(p => p.map(a => a.id === designTargetId ? { ...a, shapes: newShapes, isDefaultShape: false } : a));
                                                        if (selectedPointIndex === idx) setSelectedPointIndex(null);
                                                    }} className="text-[10px] text-red-400 hover:text-red-600 p-0.5" title="削除">×</button>
                                                </div>
                                            </div>
                                            {/* 頂点間の操作ボタン */}
                                            <div className="flex flex-col items-center py-1 gap-0.5 bg-gray-50 rounded my-0.5">
                                                <div className="text-[8px] text-gray-400">辺 {idx}→{(idx + 1) % selectedShape.points.length}</div>
                                                <div className="flex gap-1">
                                                    <button onClick={() => {
                                                        const nextIdx = (idx + 1) % selectedShape.points.length;
                                                        const nextPt = selectedShape.points[nextIdx];
                                                        const newPt = { x: (pt.x + nextPt.x) / 2, y: (pt.y + nextPt.y) / 2, handles: [] };
                                                        const newPts = [...selectedShape.points.slice(0, idx + 1), newPt, ...selectedShape.points.slice(idx + 1)];
                                                        const newShapes = [...asset.shapes];
                                                        newShapes[targetIndex].points = newPts;
                                                        setLocalAssets(p => p.map(a => a.id === designTargetId ? { ...a, shapes: newShapes, isDefaultShape: false } : a));
                                                    }} className="text-[9px] text-green-600 hover:bg-green-100 px-1.5 py-0.5 rounded border border-green-300" title="頂点を追加">
                                                        +頂点
                                                    </button>
                                                    {(!pt.handles || pt.handles.length < 2) && (
                                                        <button onClick={() => {
                                                            const newPts = [...selectedShape.points];
                                                            const handles = newPts[idx].handles || [];
                                                            const nextIdx = (idx + 1) % selectedShape.points.length;
                                                            const nextPt = selectedShape.points[nextIdx];
                                                            // 新しい制御点を辺の中間に追加
                                                            const t = (handles.length + 1) / 3; // 1つ目は1/3、2つ目は2/3の位置
                                                            const midX = pt.x + (nextPt.x - pt.x) * t;
                                                            const midY = pt.y + (nextPt.y - pt.y) * t - 15;
                                                            newPts[idx] = { ...newPts[idx], handles: [...handles, { x: midX, y: midY }] };
                                                            const newShapes = [...asset.shapes];
                                                            newShapes[targetIndex].points = newPts;
                                                            setLocalAssets(p => p.map(a => a.id === designTargetId ? { ...a, shapes: newShapes, isDefaultShape: false } : a));
                                                        }} className="text-[9px] text-blue-600 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-300" title="曲線制御点を追加">
                                                            +曲線{pt.handles?.length === 1 ? '2' : ''}
                                                        </button>
                                                    )}
                                                    {(pt.handles?.length > 0) && (
                                                        <button onClick={() => {
                                                            const newPts = [...selectedShape.points];
                                                            const handles = [...(newPts[idx].handles || [])];
                                                            handles.pop(); // 最後の制御点を削除
                                                            newPts[idx] = { ...newPts[idx], handles };
                                                            const newShapes = [...asset.shapes];
                                                            newShapes[targetIndex].points = newPts;
                                                            setLocalAssets(p => p.map(a => a.id === designTargetId ? { ...a, shapes: newShapes, isDefaultShape: false } : a));
                                                        }} className="text-[9px] text-red-500 hover:bg-red-100 px-1 py-0.5 rounded border border-red-300" title="制御点を削除">
                                                            -{pt.handles.length}曲
                                                        </button>
                                                    )}
                                                </div>
                                                {/* 制御点座標入力 */}
                                                {pt.handles && pt.handles.length > 0 && (
                                                    <div className="mt-1 space-y-0.5">
                                                        {pt.handles.map((h, hid) => (
                                                            <div key={hid} className="flex items-center gap-1 bg-orange-50 rounded px-1 py-0.5">
                                                                <span className="text-[8px] text-orange-500 font-bold w-4">C{hid + 1}</span>
                                                                <NumberInput value={toMM(h.x)} onChange={e => {
                                                                    const newPts = [...selectedShape.points];
                                                                    const handles = [...newPts[idx].handles];
                                                                    handles[hid] = { ...handles[hid], x: fromMM(Number(e.target.value)) };
                                                                    newPts[idx] = { ...newPts[idx], handles };
                                                                    const newShapes = [...asset.shapes];
                                                                    newShapes[targetIndex].points = newPts;
                                                                    setLocalAssets(p => p.map(a => a.id === designTargetId ? { ...a, shapes: newShapes, isDefaultShape: false } : a));
                                                                }} className="flex-1 text-[9px] p-0.5 border rounded w-10 text-center" placeholder="X" />
                                                                <NumberInput value={toMM(h.y)} onChange={e => {
                                                                    const newPts = [...selectedShape.points];
                                                                    const handles = [...newPts[idx].handles];
                                                                    handles[hid] = { ...handles[hid], y: fromMM(Number(e.target.value)) };
                                                                    newPts[idx] = { ...newPts[idx], handles };
                                                                    const newShapes = [...asset.shapes];
                                                                    newShapes[targetIndex].points = newPts;
                                                                    setLocalAssets(p => p.map(a => a.id === designTargetId ? { ...a, shapes: newShapes, isDefaultShape: false } : a));
                                                                }} className="flex-1 text-[9px] p-0.5 border rounded w-10 text-center" placeholder="Y" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-xs text-gray-400 p-2 text-center border rounded border-dashed">キャンバス上のパーツをクリックして編集<br />背景左ドラッグで範囲選択<br />Ctrl+クリックで複数選択</div>
                )}

                {/* Structure List */}
                <div className="mt-4 border-t pt-2">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-gray-500">構成要素</label>
                        <div className="flex gap-1">
                            <button onClick={() => setLocalAssets(p => p.map(a => a.id === designTargetId ? { ...a, shapes: [...(a.shapes || []), { type: 'polygon', points: createRectPath(40, 40, 0, 0), color: asset.color }], isDefaultShape: false } : a))} className="px-1.5 py-0.5 bg-gray-100 rounded hover:bg-gray-200 text-[10px]">□</button>
                            <button onClick={() => setLocalAssets(p => p.map(a => a.id === designTargetId ? { ...a, shapes: [...(a.shapes || []), { type: 'polygon', points: createTrianglePath(40, 40, 0, 0), color: asset.color }], isDefaultShape: false } : a))} className="px-1.5 py-0.5 bg-gray-100 rounded hover:bg-gray-200 text-[10px]">▽</button>
                            <button onClick={() => setLocalAssets(p => p.map(a => a.id === designTargetId ? { ...a, shapes: [...(a.shapes || []), { type: 'ellipse', cx: 30, cy: 30, rx: 30, ry: 30, startAngle: 0, endAngle: 360, arcMode: 'sector', color: asset.color }], isDefaultShape: false } : a))} className="px-1.5 py-0.5 bg-green-100 rounded hover:bg-green-200 text-[10px]" title="楕円/扇形">◔</button>
                        </div>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
                        {(asset.shapes || []).map((s, i) => (
                            <div key={i}
                                onClick={(e) => {
                                    if (e.ctrlKey || e.metaKey) {
                                        // トグル
                                        if (selectedShapeIndices.includes(i)) setSelectedShapeIndices(prev => prev.filter(idx => idx !== i));
                                        else setSelectedShapeIndices(prev => [...prev, i]);
                                    } else {
                                        setSelectedShapeIndices([i]);
                                    }
                                    setSelectedPointIndex(null);
                                }}
                                className={`flex justify-between items-center text-xs p-1 rounded border cursor-pointer ${selectedShapeIndices.includes(i) ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}
                            >
                                <span className="font-bold text-gray-500">#{i + 1} {s.type}</span>
                                <button onClick={(e) => { e.stopPropagation(); if (!confirm('削除？')) return; const newShapes = asset.shapes.filter((_, idx) => idx !== i); setLocalAssets(p => p.map(a => a.id === designTargetId ? { ...a, shapes: newShapes, isDefaultShape: false } : a)); setSelectedShapeIndices(p => p.filter(idx => idx !== i)); }} className="text-red-400 hover:text-red-600 px-1">×</button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-4 border-t space-y-2">
                    <button onClick={fork} className="btn-action bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100">
                        <Icon p={Icons.Copy} size={14} /> コピーして保存
                    </button>
                    <button onClick={publish} className="btn-action bg-white border border-blue-200 text-blue-600 hover:bg-blue-50">
                        <Icon p={Icons.Globe} size={14} /> 共通ライブラリに登録
                    </button>
                </div>
            </div>
        </div>
    );
};
