import React from 'react';
import { useStore } from '../store';
import { ColorPicker } from './ColorPicker';
import { Icon, Icons } from './Icon';

export const ProjectSettingsModal = ({ onClose }) => {
    const categoryLabels = useStore(state => state.categoryLabels) || {};
    const globalDefaultColors = useStore(state => state.globalDefaultColors) || {};
    const projectDefaultColors = useStore(state => state.projectDefaultColors) || {};
    const updateProjectDefaultColor = useStore(state => state.updateProjectDefaultColor);
    const resetProjectDefaultColors = useStore(state => state.resetProjectDefaultColors);
    const colorPalette = useStore(state => state.colorPalette) || [];
    const addToPalette = useStore(state => state.addToPalette);

    const handleReset = () => {
        if (confirm('プロジェクト固有のデフォルト色設定を全てクリアし、グローバル設定に戻しますか？')) {
            resetProjectDefaultColors();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-96 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h2 className="font-bold text-gray-700 flex items-center gap-2">
                        <Icon p={Icons.Settings} /> プロジェクト設定
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <Icon p={Icons.Close} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <div className="mb-4">
                        <h3 className="text-sm font-bold text-gray-600 mb-2">カテゴリ別デフォルト色</h3>
                        <p className="text-xs text-gray-400 mb-4">
                            このプロジェクト内での新規パーツ作成時に適用されるデフォルト色を設定します。
                            変更すると、既存のデフォルト形状のアセットの色も更新されます。
                        </p>

                        <div className="space-y-4">
                            {Object.entries(categoryLabels).map(([key, label]) => {
                                const isOverridden = projectDefaultColors && projectDefaultColors.hasOwnProperty(key);
                                const currentColor = isOverridden ? projectDefaultColors[key] : (globalDefaultColors[key] || '#cccccc');

                                return (
                                    <div key={key} className="border rounded p-3 bg-gray-50/50">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-bold text-sm text-gray-700">{label}</span>
                                            {isOverridden ? (
                                                <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded border border-orange-200">独自設定</span>
                                            ) : (
                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">グローバル</span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-8 h-8 rounded border shadow-sm" style={{ backgroundColor: currentColor }}></div>
                                            <div className="flex-1">
                                                <ColorPicker
                                                    value={currentColor}
                                                    onChange={(c) => updateProjectDefaultColor(key, c)}
                                                    palette={colorPalette}
                                                    onAddToPalette={addToPalette}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="border-t pt-4 mt-6">
                        <button
                            onClick={handleReset}
                            className="w-full py-2 bg-white border border-red-200 text-red-600 rounded hover:bg-red-50 text-xs font-bold flex items-center justify-center gap-2"
                            disabled={!projectDefaultColors || Object.keys(projectDefaultColors).length === 0}
                        >
                            <Icon p={Icons.Refresh} size={14} />
                            プロジェクト設定をクリア
                        </button>
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 text-sm font-bold">
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
};
