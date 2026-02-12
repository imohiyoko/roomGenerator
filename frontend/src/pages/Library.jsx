import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { API } from '../lib/api';
import { Icon, Icons } from '../components/Icon';
import { ColorPicker } from '../components/ColorPicker';

const Library = () => {
    const navigate = useNavigate();

    const colorPalette = useStore(state => state.colorPalette);
    const defaultColors = useStore(state => state.defaultColors);
    const globalAssets = useStore(state => state.globalAssets);
    const designTargetId = useStore(state => state.designTargetId);

    const addToPalette = useStore(state => state.addToPalette);
    const removeFromPalette = useStore(state => state.removeFromPalette);
    const updateDefaultColor = useStore(state => state.updateDefaultColor);
    const setDesignTargetId = useStore(state => state.setDesignTargetId);

    return (
        <div className="min-h-screen bg-gray-100 overflow-auto">
            <div className="bg-white border-b shadow-sm p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-800 flex items-center gap-2">
                        <Icon p={Icons.LogOut} /> 戻る
                    </button>
                    <h1 className="text-xl font-bold text-gray-800">共通ライブラリ管理</h1>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-6 space-y-8">
                {/* Palette */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">🎨 カラーパレット</h2>
                    <div className="grid grid-cols-10 gap-2 mb-4">
                        {colorPalette.map((color, i) => (
                            <div key={i} className="relative group">
                                <div className="w-10 h-10 rounded border-2 border-gray-300" style={{ backgroundColor: color }} title={color} />
                                <button onClick={() => removeFromPalette(i)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition">×</button>
                            </div>
                        ))}
                        <label className="w-10 h-10 rounded border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                            <input type="color" className="sr-only" onChange={(e) => addToPalette(e.target.value)} />
                            <Icon p={Icons.Plus} size={16} className="text-gray-400" />
                        </label>
                    </div>
                </div>

                {/* Default Colors */}
                    <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">🖌️ カテゴリ別デフォルト色</h2>
                    <div className="flex gap-8">
                        {[
                            { type: 'room', label: '部屋・床' },
                            { type: 'fixture', label: '設備・建具' },
                            { type: 'furniture', label: '家具' }
                        ].map(({ type, label }) => (
                            <div key={type} className="flex flex-col items-center gap-2">
                                <span className="text-sm font-bold text-gray-600">{label}</span>
                                <ColorPicker
                                    value={defaultColors[type] || '#cccccc'}
                                    onChange={(c) => updateDefaultColor(type, c)}
                                    palette={colorPalette}
                                    onAddToPalette={addToPalette}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Global Assets */}
                <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">📦 共通アセット</h2>
                        <button onClick={async () => {
                            await API.saveAssets(globalAssets.map(a => ({ ...a, source: undefined })));
                            alert('保存しました');
                        }} className="text-xs bg-green-50 text-green-600 px-3 py-1 rounded border border-green-200">変更を保存</button>
                    </div>
                    <div className="grid grid-cols-6 gap-3">
                            {globalAssets.map(asset => (
                            <div key={asset.id} onClick={() => setDesignTargetId(designTargetId === asset.id ? null : asset.id)}
                                className={`border rounded p-2 cursor-pointer ${designTargetId === asset.id ? 'ring-2 ring-blue-200' : ''}`}>
                                <div className="w-8 h-8 mx-auto rounded mb-1 border" style={{ backgroundColor: asset.color }} />
                                <div className="text-[10px] text-center truncate">{asset.name}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Library;
