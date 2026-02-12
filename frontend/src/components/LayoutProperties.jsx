import React from 'react';
import { Icon, Icons } from './Icon';
import { NumberInput } from './NumberInput';
import { fromMM, toMM } from '../lib/utils';

export const LayoutProperties = ({ instances, setInstances, selectedIds, assets, setSelectedIds, setMode, setDesignTargetId }) => {
    const item = instances.find(i => i.id === selectedIds[0]);

    // 未選択時は簡易リスト表示
    if (!item) {
        return (
            <div className="h-full flex flex-col text-gray-500 text-xs items-center justify-center p-4">
                <Icon p={Icons.Move} size={48} className="text-gray-200 mb-2" />
                <p>キャンバス上のアイテムを選択すると<br />詳細設定が表示されます</p>
                <div className="mt-8 w-full border-t pt-4">
                    <p className="font-bold text-gray-400 mb-2 text-left w-full">配置済み ({instances.length})</p>
                    <div className="space-y-1 max-h-60 overflow-y-auto w-full text-left">
                        {instances.map(inst => {
                            const a = assets.find(x => x.id === inst.assetId);
                            return (
                                <div key={inst.id} onClick={() => setSelectedIds([inst.id])} className="p-2 border rounded hover:bg-gray-50 cursor-pointer flex items-center justify-between">
                                    <span className="truncate">{a ? a.name : inst.text}</span>
                                    <span className="text-[10px] text-gray-300">{inst.id.slice(-4)}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        );
    }

    const update = (k, v) => setInstances(p => p.map(i => i.id === item.id ? { ...i, [k]: v } : i));

    // 全体を0,0に揃える機能（すべてのインスタンスをグループとして移動）
    const alignToOrigin = () => {
        if (instances.length === 0) return;
        const minX = Math.min(...instances.map(i => i.x));
        const minY = Math.min(...instances.map(i => i.y));
        if (minX === 0 && minY === 0) return;
        setInstances(prev => prev.map(i => ({
            ...i,
            x: i.x - minX,
            y: i.y - minY
        })));
    };

    const asset = assets.find(a => a.id === item.assetId);

    // 複数選択時の表示
    const multiSelected = selectedIds.length > 1;

    // 選択アイテムを0,0に揃える（複数選択対応）
    const alignSelectedToOrigin = () => {
        const targets = instances.filter(i => selectedIds.includes(i.id));
        if (targets.length === 0) return;
        const minX = Math.min(...targets.map(i => i.x));
        const minY = Math.min(...targets.map(i => i.y));
        if (minX === 0 && minY === 0) return;
        setInstances(prev => prev.map(i => {
            if (selectedIds.includes(i.id)) {
                return { ...i, x: i.x - minX, y: i.y - minY };
            }
            return i;
        }));
    };

    // 選択アイテムを一括削除
    const deleteSelected = () => {
        if (!confirm(`選択した ${selectedIds.length} 個のアイテムを削除しますか？`)) return;
        setInstances(prev => prev.filter(i => !selectedIds.includes(i.id)));
        setSelectedIds([]);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="sidebar-header">
                <span>{multiSelected ? `${selectedIds.length}個選択中` : '配置プロパティ'}</span>
                <button onClick={multiSelected ? alignSelectedToOrigin : alignToOrigin} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100">
                    0,0へ移動
                </button>
            </div>

            <div className="p-3 overflow-y-auto flex-1">
                {/* 複数選択時 */}
                {multiSelected ? (
                    <div className="space-y-4">
                        <div className="bg-purple-50 border border-purple-100 rounded p-3">
                            <div className="font-bold text-sm text-purple-800 mb-2">{selectedIds.length} 個のアイテムを選択中</div>
                            <div className="text-[10px] text-purple-500">Ctrl+クリックで選択を調整</div>
                        </div>
                        <div className="space-y-2">
                            <button
                                onClick={alignSelectedToOrigin}
                                className="btn-action bg-blue-500 text-white hover:bg-blue-600 shadow-sm"
                            >
                                <Icon p={Icons.Move} size={14} /> 選択を0,0へ揃える
                            </button>
                            <button
                                onClick={deleteSelected}
                                className="btn-action bg-red-500 text-white hover:bg-red-600 shadow-sm"
                            >
                                <Icon p={Icons.Trash} size={14} /> 選択を削除
                            </button>
                            <button
                                onClick={() => setSelectedIds([])}
                                className="btn-action bg-gray-100 text-gray-600 hover:bg-gray-200"
                            >
                                選択解除
                            </button>
                        </div>
                        <div className="border-t pt-3">
                            <div className="text-xs font-bold text-gray-400 mb-2">選択中のアイテム</div>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                {selectedIds.map(id => {
                                    const inst = instances.find(i => i.id === id);
                                    const a = inst ? assets.find(x => x.id === inst.assetId) : null;
                                    return (
                                        <div key={id} className="text-xs p-2 bg-gray-50 rounded flex items-center justify-between">
                                            <span className="truncate">{a?.name || inst?.text || 'テキスト'}</span>
                                            <button onClick={() => setSelectedIds(prev => prev.filter(x => x !== id))} className="text-gray-300 hover:text-red-500">×</button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Selected Item Info */}
                        <div className="bg-blue-50 border border-blue-100 rounded p-3 mb-4">
                            <div className="font-bold text-sm text-blue-800 mb-1">{item.type === 'text' ? 'テキスト' : asset?.name}</div>
                            <div className="text-[10px] text-blue-400 font-mono">{item.id}</div>
                        </div>

                        {/* Actions */}
                        {item.type !== 'text' && (
                            <button
                                onClick={() => {
                                    setDesignTargetId(item.assetId);
                                    setMode('design');
                                }}
                                className="btn-action bg-orange-500 text-white hover:bg-orange-600 mb-4 shadow-sm"
                            >
                                <Icon p={Icons.Pen} size={14} /> 形状を編集 (設計モード)
                            </button>
                        )}

                        {/* Coordinates */}
                        <div className="mb-4">
                            <div className="text-xs font-bold text-gray-400 mb-2 border-b pb-1">座標・回転</div>
                            <div className="prop-row">
                                <label className="prop-label">X (mm)</label>
                                <NumberInput value={toMM(item.x)} onChange={e => update('x', fromMM(Number(e.target.value)))} className="prop-input" />
                            </div>
                            <div className="prop-row">
                                <label className="prop-label">Y (mm)</label>
                                <NumberInput value={toMM(item.y)} onChange={e => update('y', fromMM(Number(e.target.value)))} className="prop-input" />
                            </div>
                            <div className="prop-row">
                                <label className="prop-label">回転 (°)</label>
                                <div className="flex-1 flex gap-2">
                                    <NumberInput value={item.rotation} onChange={e => update('rotation', Number(e.target.value))} className="prop-input" />
                                    <button onClick={() => update('rotation', (item.rotation + 90) % 360)} className="px-2 border rounded bg-gray-50 hover:bg-gray-100 text-xs">↻</button>
                                </div>
                            </div>
                        </div>

                        {/* Content (Text only) */}
                        {item.type === 'text' && (
                            <div className="mb-4">
                                <div className="text-xs font-bold text-gray-400 mb-2 border-b pb-1">テキスト設定</div>
                                <div className="mb-2">
                                    <label className="prop-label block text-left mb-1">内容</label>
                                    <textarea value={item.text} onChange={e => update('text', e.target.value)} className="w-full border rounded p-2 text-sm h-20" />
                                </div>
                                <div className="prop-row">
                                    <label className="prop-label">サイズ</label>
                                    <NumberInput value={item.fontSize} onChange={e => update('fontSize', Number(e.target.value))} className="prop-input" />
                                </div>
                                <div className="prop-row">
                                    <label className="prop-label">色</label>
                                    <input type="color" value={item.color} onChange={e => update('color', e.target.value)} className="h-8 w-full cursor-pointer" />
                                </div>
                            </div>
                        )}

                        {/* Copy / Lock / Delete */}
                        <div className="border-t pt-4 mt-2 space-y-2">
                            <button onClick={() => {
                                const newInst = { ...item, id: `${item.type === 'text' ? 't' : 'i'}-${Date.now()}`, x: item.x + 10, y: item.y + 10 };
                                setInstances(p => [...p, newInst]);
                                setSelectedIds([newInst.id]);
                            }} className="btn-action bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100">
                                <Icon p={Icons.Copy} size={14} /> コピーして配置
                            </button>
                            <label className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 border">
                                <input type="checkbox" checked={item.locked} onChange={e => update('locked', e.target.checked)} className="accent-blue-600" />
                                <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                                    {item.locked ? <Icon p={Icons.Lock} size={12} /> : <Icon p={Icons.Unlock} size={12} />} ロックする
                                </span>
                            </label>
                            <button onClick={() => { setInstances(p => p.filter(i => i.id !== item.id)); setSelectedIds([]); }} className="btn-action bg-white border border-red-200 text-red-500 hover:bg-red-50">
                                <Icon p={Icons.Trash} size={14} /> 削除
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
