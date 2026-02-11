import React from 'react';
import { Icon, Icons } from './Icon';
import { createRectPath } from '../lib/utils';

export const UnifiedSidebar = ({ mode, assets, onAddInstance, onAddText, setLocalAssets, setGlobalAssets, setDesignTargetId, designTargetId, instances, setInstances, defaultColors }) => {
    // 常にローカルアセットのみ表示（globalはプロジェクト読込時に自動フォーク済み）
    const filteredAssets = assets.filter(a => !a.source || a.source !== 'global');

    // 新規作成 (Design Mode用)
    const addNewAsset = () => {
        const defaultColor = (defaultColors && defaultColors.room) ? defaultColors.room : '#cccccc';
        const initialShape = {
            type: 'polygon',
            points: createRectPath(60, 60, 0, 0),
            color: defaultColor
        };
        const newA = {
            id: `a-${Date.now()}`, name: '新規パーツ', type: 'room',
            w: 60, h: 60, color: defaultColor, snap: true,
            isDefaultShape: true, // デフォルト形状フラグ
            shapes: [initialShape]
        };
        setLocalAssets(prev => [...prev, newA]);
        setDesignTargetId(newA.id);
    };

    const handleClick = (asset) => {
        if (mode === 'layout') {
            onAddInstance(asset.id);
        } else {
            setDesignTargetId(asset.id);
        }
    };

    const deleteAsset = (e, assetId, isGlobal) => {
        e.stopPropagation();
        const usageCount = instances.filter(inst => inst.assetId === assetId).length;
        const message = usageCount > 0
            ? `このアセットを削除しますか？\n配置済み: ${usageCount}個が削除されます。`
            : 'このアセットを削除しますか？';
        if (!confirm(message)) return;

        if (isGlobal) {
            setGlobalAssets(prev => prev.filter(a => a.id !== assetId));
        } else {
            setLocalAssets(prev => prev.filter(a => a.id !== assetId));
        }
        setInstances(prev => prev.filter(inst => inst.assetId !== assetId));
        if (designTargetId === assetId) {
            setDesignTargetId(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header Action Area */}
            <div className="p-3 pb-0">
                {mode === 'layout' ? (
                    <button onClick={onAddText} className="w-full py-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded font-bold mb-2 flex items-center justify-center gap-2 hover:bg-yellow-100 transition text-xs"><Icon p={Icons.Type} /> 文字を追加</button>
                ) : (
                    <button onClick={addNewAsset} className="w-full py-2 bg-white border border-dashed border-orange-300 rounded text-orange-600 hover:bg-orange-50 font-bold text-xs">+ 新規パーツ</button>
                )}
            </div>

            {/* Asset List (Grid) */}
            <div className="flex-1 overflow-y-auto p-3">
                {['room', 'fixture', 'furniture'].map(type => {
                    const typeAssets = filteredAssets.filter(a => a.type === type);
                    if (typeAssets.length === 0) return null;
                    const label = type === 'room' ? '部屋' : type === 'fixture' ? '設備' : '家具';
                    return (
                        <div key={type} className="mb-6">
                            <div className="text-xs font-bold text-gray-400 mb-2 px-1 border-b pb-1 flex items-center gap-2">{label}</div>
                            <div className="grid grid-cols-2 gap-2">
                                {typeAssets.map(a => {
                                    const isSelected = mode === 'design' && designTargetId === a.id;
                                    return (
                                        <button key={a.id} onClick={() => handleClick(a)}
                                            className={`flex flex-col items-center p-2 border rounded hover:bg-gray-50 text-center relative group transition
                                                ${a.source === 'global' ? 'bg-blue-50/30 border-blue-100' : ''}
                                                ${isSelected ? 'ring-2 ring-orange-400 bg-orange-50' : ''}
                                            `}>
                                            {a.source === 'global' && <div className="absolute top-1 right-1 text-blue-400"><Icon p={Icons.Globe} size={10} /></div>}
                                            <div className="w-8 h-8 rounded mb-2 border shadow-sm flex items-center justify-center" style={{ backgroundColor: a.color }}></div>
                                            <span className="text-[10px] w-full truncate font-medium text-gray-600">{a.name}</span>

                                            {/* Delete Button (Only visible in Design Mode or for cleanup) */}
                                            {mode === 'design' && (
                                                <div
                                                    onClick={(e) => deleteAsset(e, a.id, a.source === 'global')}
                                                    className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-1 transition"
                                                >
                                                    <Icon p={Icons.Trash} size={12} />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
