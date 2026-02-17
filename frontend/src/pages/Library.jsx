import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { API } from '../lib/api';
import { Icon, Icons } from '../components/Icon';
import { Header } from '../components/Header';

const Library = () => {
    const navigate = useNavigate();

    const colorPalette = useStore(state => state.colorPalette);
    const globalAssets = useStore(state => state.globalAssets);
    const designTargetId = useStore(state => state.designTargetId);

    const addToPalette = useStore(state => state.addToPalette);
    const removeFromPalette = useStore(state => state.removeFromPalette);
    const setDesignTargetId = useStore(state => state.setDesignTargetId);

    const fileInputRef = useRef(null);

    const handleExportAssets = async () => {
        try {
            const jsonStr = await API.exportGlobalAssets();
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `global_assets.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            alert("エクスポートに失敗しました");
        }
    };

    const handleImportAssets = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            if (confirm("既存のアセットに追加（マージ）しますか？\n[OK] 追加\n[キャンセル] 上書きまたは中止")) {
                await API.importGlobalAssets(text, true);
                alert("インポートしました（追加）。画面を更新します。");
                window.location.reload();
            } else {
                if (confirm("既存のアセットを全て削除して上書きしますか？\nこの操作は取り消せません。")) {
                    await API.importGlobalAssets(text, false);
                    alert("インポートしました（上書き）。画面を更新します。");
                    window.location.reload();
                }
            }
        } catch (err) {
            console.error(err);
            alert("インポートに失敗しました: " + err);
        }
        e.target.value = '';
    };

    return (
        <div className="h-screen flex flex-col bg-gray-100">
            <Header title="共通ライブラリ管理" />

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="max-w-4xl mx-auto space-y-8">
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

                    {/* Global Assets */}
                    <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">📦 共通アセット</h2>
                            <div className="flex gap-2">
                                <input type="file" ref={fileInputRef} onChange={handleImportAssets} accept=".json" className="hidden" />
                                <button onClick={() => fileInputRef.current.click()} className="text-xs bg-gray-50 text-gray-600 px-3 py-1 rounded border border-gray-200 flex items-center gap-1">
                                    <Icon p={Icons.Upload} size={12} /> インポート
                                </button>
                                <button onClick={handleExportAssets} className="text-xs bg-gray-50 text-gray-600 px-3 py-1 rounded border border-gray-200 flex items-center gap-1">
                                    <Icon p={Icons.Download} size={12} /> エクスポート
                                </button>
                                <button onClick={async () => {
                                    await API.saveAssets(globalAssets.map(a => ({ ...a, source: undefined })));
                                    alert('保存しました');
                                }} className="text-xs bg-green-50 text-green-600 px-3 py-1 rounded border border-green-200">変更を保存</button>
                            </div>
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
        </div>
    );
};

export default Library;
