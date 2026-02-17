import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { API } from '../lib/api';
import { Icon, Icons } from '../components/Icon';
import { Header } from '../components/Header';
import { ColorPicker } from '../components/ColorPicker';

const Settings = () => {
    const navigate = useNavigate();

    // Store
    const colorPalette = useStore(state => state.colorPalette);
    const defaultColors = useStore(state => state.defaultColors);
    const categoryLabels = useStore(state => state.categoryLabels);
    const globalDefaultColors = useStore(state => state.globalDefaultColors);

    // Actions
    const addToPalette = useStore(state => state.addToPalette);
    const updateDefaultColor = useStore(state => state.updateDefaultColor);
    const addCategory = useStore(state => state.addCategory);
    const removeCategory = useStore(state => state.removeCategory);

    // Settings State
    const gridSize = useStore(state => state.gridSize);
    const snapInterval = useStore(state => state.snapInterval);
    const initialZoom = useStore(state => state.initialZoom);
    const autoSaveInterval = useStore(state => state.autoSaveInterval);

    const setGridSize = useStore(state => state.setGridSize);
    const setSnapInterval = useStore(state => state.setSnapInterval);
    const setInitialZoom = useStore(state => state.setInitialZoom);
    const setAutoSaveInterval = useStore(state => state.setAutoSaveInterval);

    // Local state for category addition
    const [newCatKey, setNewCatKey] = useState('');
    const [newCatLabel, setNewCatLabel] = useState('');
    const [newCatColor, setNewCatColor] = useState('#cccccc');

    // Load settings on mount
    useEffect(() => {
        API.getSettings().then(s => {
            if (s) {
                setGridSize(s.gridSize);
                setSnapInterval(s.snapInterval);
                setInitialZoom(s.initialZoom);
                setAutoSaveInterval(s.autoSaveInterval);
            }
        });
    }, []);

    const handleSave = async () => {
        const settings = {
            gridSize,
            snapInterval,
            initialZoom,
            autoSaveInterval
        };
        try {
            await API.saveSettings(settings);
            // Default colors are saved automatically via actions, but we can force a sync if needed.
            // Actually, updateDefaultColor calls savePalette immediately.
            alert("設定を保存しました");
        } catch (e) {
            alert("保存に失敗しました: " + e);
        }
    };

    const handleAddCategory = () => {
        if (!newCatKey || !newCatLabel) return alert('IDとラベルを入力してください');
        if (!/^[a-zA-Z0-9_]+$/.test(newCatKey)) return alert('IDは半角英数字とアンダースコアのみ使用可能です');
        if (categoryLabels[newCatKey]) return alert('このIDは既に使用されています');
        addCategory(newCatKey, newCatLabel, newCatColor);
        setNewCatKey('');
        setNewCatLabel('');
        setNewCatColor('#cccccc');
    };

    const handleRemoveCategory = (key) => {
        if (confirm(`カテゴリ「${categoryLabels[key]}」を削除しますか？\nこのカテゴリを使用しているアセットは色同期されなくなります。`)) {
            removeCategory(key);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-gray-100">
            <Header title="設定" />

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto space-y-8">

                    {/* Category Colors Section */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-lg font-bold text-gray-700 mb-6 flex items-center gap-2">
                            <span className="text-2xl">🖌️</span> カテゴリ別デフォルト色
                        </h2>

                        <div className="flex flex-wrap gap-8 mb-8">
                            {Object.entries(categoryLabels).map(([type, label]) => (
                                <div key={type} className="flex flex-col items-center gap-2 relative group">
                                    <span className="text-sm font-bold text-gray-600">{label}</span>
                                    <div className="text-[10px] text-gray-400 font-mono">{type}</div>
                                    <ColorPicker
                                        value={defaultColors[type] || '#cccccc'}
                                        onChange={(c) => updateDefaultColor(type, c)}
                                        palette={colorPalette}
                                        onAddToPalette={addToPalette}
                                    />
                                    <button
                                        onClick={() => handleRemoveCategory(type)}
                                        className="absolute -top-2 -right-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition bg-white rounded-full p-1 shadow border"
                                    >
                                        <Icon p={Icons.Trash} size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="border-t pt-4 bg-gray-50 -mx-6 -mb-6 p-6 rounded-b-lg flex items-end gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">ID (英数)</label>
                                <input value={newCatKey} onChange={e => setNewCatKey(e.target.value)} className="border rounded px-2 py-1.5 text-sm w-32" placeholder="room_kids" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">ラベル</label>
                                <input value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} className="border rounded px-2 py-1.5 text-sm w-40" placeholder="子供部屋" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">色</label>
                                <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="h-9 w-12 p-0 border cursor-pointer rounded" />
                            </div>
                            <button onClick={handleAddCategory} className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 flex items-center gap-1 font-bold">
                                <Icon p={Icons.Plus} size={14} /> 追加
                            </button>
                        </div>
                    </div>

                    {/* Display Settings */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-lg font-bold text-gray-700 mb-6 flex items-center gap-2">
                            <span className="text-2xl">🖥️</span> 表示設定
                        </h2>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-2">グリッドサイズ (px)</label>
                                <input
                                    type="number"
                                    value={gridSize}
                                    onChange={(e) => { const v = Number(e.target.value); if (isFinite(v)) setGridSize(Math.max(5, Math.min(100, v))); }}
                                    className="border rounded px-3 py-2 w-full"
                                    min="5" max="100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-2">スナップ間隔 (px)</label>
                                <input
                                    type="number"
                                    value={snapInterval}
                                    onChange={(e) => { const v = Number(e.target.value); if (isFinite(v)) setSnapInterval(Math.max(1, Math.min(50, v))); }}
                                    className="border rounded px-3 py-2 w-full"
                                    min="1" max="50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-2">初期ズームレベル (倍率)</label>
                                <input
                                    type="number"
                                    value={initialZoom}
                                    onChange={(e) => { const v = Number(e.target.value); if (isFinite(v)) setInitialZoom(Math.max(0.1, Math.min(5.0, v))); }}
                                    className="border rounded px-3 py-2 w-full"
                                    step="0.1" min="0.1" max="5.0"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Behavior Settings */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-lg font-bold text-gray-700 mb-6 flex items-center gap-2">
                            <span className="text-2xl">⚙️</span> 動作設定
                        </h2>
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-2">オートセーブ間隔 (ミリ秒)</label>
                            <input
                                type="number"
                                value={autoSaveInterval}
                                onChange={(e) => { const v = Number(e.target.value); if (isFinite(v)) setAutoSaveInterval(Math.max(5000, v)); }}
                                className="border rounded px-3 py-2 w-full"
                                step="1000" min="5000"
                            />
                            <p className="text-xs text-gray-400 mt-1">※ 最小値は5000ミリ秒（5秒）です</p>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-4 pt-4 pb-12">
                         <button
                             onClick={() => {
                                 if(confirm('設定をリセットしてもよろしいですか？')) {
                                     setGridSize(20);
                                     setSnapInterval(10);
                                     setInitialZoom(1.0);
                                     setAutoSaveInterval(30000);
                                 }
                             }}
                             className="px-6 py-2 rounded text-gray-600 hover:bg-gray-200 font-bold"
                         >
                             リセット
                         </button>
                        <button
                            onClick={handleSave}
                            className="bg-green-500 text-white px-8 py-2 rounded shadow hover:bg-green-600 font-bold flex items-center gap-2"
                        >
                            <Icon p={Icons.Save} /> 設定を保存
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Settings;
