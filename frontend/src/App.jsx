import React, { useState, useEffect } from 'react';
import { API } from './lib/api';
import { BASE_SCALE } from './lib/constants';
import { Icon, Icons } from './components/Icon';
import { UnifiedSidebar } from './components/UnifiedSidebar';
import { LayoutCanvas } from './components/LayoutCanvas';
import { DesignCanvas } from './components/DesignCanvas';
import { LayoutProperties } from './components/LayoutProperties';
import { DesignProperties } from './components/DesignProperties';
import { ProjectCard } from './components/ProjectCard';
import { Ruler } from './components/Ruler';
import { ColorPicker } from './components/ColorPicker';

const App = () => {
    const [projects, setProjects] = useState([]);
    const [currentProjectId, setCurrentProjectId] = useState(null);
    const [view, setView] = useState('home'); // 'home', 'project', 'library'
    const [mode, setMode] = useState('layout'); // 'layout', 'design'
    const [viewState, setViewState] = useState({ x: 50, y: 50, scale: 1 });
    const [localAssets, setLocalAssets] = useState([]);
    const [globalAssets, setGlobalAssets] = useState([]);
    const [instances, setInstances] = useState([]);

    const [selectedIds, setSelectedIds] = useState([]);
    const [designTargetId, setDesignTargetId] = useState(null);
    const [selectedShapeIndices, setSelectedShapeIndices] = useState([]);
    const [selectedPointIndex, setSelectedPointIndex] = useState(null);
    const [colorPalette, setColorPalette] = useState([]);

    // パレットに色を追加
    const addToPalette = (color) => {
        if (!colorPalette.includes(color)) {
            const newPalette = [...colorPalette, color];
            setColorPalette(newPalette);
            API.savePalette({ colors: newPalette });
        }
    };

    // 初期ロード
    useEffect(() => {
        API.getProjects().then(setProjects);
        // グローバルアセットにsource: 'global'を付与
        API.getAssets().then(assets => setGlobalAssets((assets || []).map(a => ({ ...a, source: 'global' }))));
        // カラーパレットを読み込み
        API.getPalette().then(data => setColorPalette(data?.colors || []));
    }, []);

    // キーボードパン（WASD / 矢印キー）
    useEffect(() => {
        const PAN_STEP = 50;
        const handleKeyDown = (e) => {
            // 入力フィールドにフォーカスがある場合は無視
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

            let dx = 0, dy = 0;
            switch (e.key.toLowerCase()) {
                case 'w': case 'arrowup': dy = PAN_STEP; break;
                case 's': case 'arrowdown': dy = -PAN_STEP; break;
                case 'a': case 'arrowleft': dx = PAN_STEP; break;
                case 'd': case 'arrowright': dx = -PAN_STEP; break;
                default: return;
            }
            if (dx !== 0 || dy !== 0) {
                e.preventDefault();
                setViewState(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // 数値入力のホイール操作
    useEffect(() => {
        const handleWheel = (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
                e.preventDefault();
                const step = e.shiftKey ? 1000 : 10;
                const delta = e.deltaY < 0 ? step : -step;
                const currentValue = parseFloat(e.target.value) || 0;
                const newValue = currentValue + delta;
                // Reactのステート更新をトリガーするために setter を呼び出す必要があるが、
                // ここでは標準イベント発火で対応（React管理外の変更になるため注意が必要だが、簡易実装として）
                // ただし、React 18 ではこれだけでは反映されない場合があるため、onChangeハンドラ側で制御するのがベター。
                // 今回は移植元のコードに従うが、input要素への直接操作はReactでは非推奨。
                // 本来は各コンポーネントでonWheelを実装すべきだが、グローバルリスナーでの実装を維持するならカスタムイベント等が必要。
                // とりあえずこの機能は移植元にあるので残すが、Reactではうまく動かない可能性がある。
            }
        };
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => window.removeEventListener('wheel', handleWheel);
    }, []);

    useEffect(() => {
        if (!currentProjectId) {
            setView('home');
            return;
        }
        setView('project');
        API.getProjectData(currentProjectId).then(data => {
            let loadedAssets = data?.LocalAssets || []; // Go struct field name is LocalAssets

            // グローバルアセットを自動的にローカルにフォーク
            const localAssetNames = new Set(loadedAssets.map(a => a.name));
            const forkedAssets = globalAssets
                .filter(ga => !localAssetNames.has(ga.name))
                .map(ga => ({ ...ga, id: `a-fork-${ga.id}-${Date.now()}`, source: undefined }));

            setLocalAssets([...loadedAssets, ...forkedAssets]);
            setInstances(data?.Instances || []);
        });
    }, [currentProjectId, globalAssets]);

    // 自動保存 (簡易)
    useEffect(() => {
        if (!currentProjectId) return;
        const timer = setTimeout(() => {
            // Go struct: ProjectData { LocalAssets, Instances }
            // JS object keys must match Go struct JSON tags: "assets", "instances"
            API.saveProjectData(currentProjectId, { assets: localAssets, instances });
        }, 1000);
        return () => clearTimeout(timer);
    }, [localAssets, instances, currentProjectId]);

    const handleCreateProject = async () => {
        // Wails doesn't support prompt() natively in some environments without polyfill, but mostly works in WebView2.
        // If it fails, we might need a custom modal. For now assume it works.
        const name = prompt("プロジェクト名を入力してください", "新規プロジェクト");
        if (!name) return;
        const newProj = await API.createProject(name);
        if (newProj) {
            setProjects(p => [...p, newProj]);
        }
    };

    const handleDeleteProject = async (e, id) => {
        e.stopPropagation();
        if (!confirm("このプロジェクトを削除しますか？")) return;
        await API.deleteProject(id);
        setProjects(p => p.filter(proj => proj.id !== id));
    };

    const handleRenameProject = async (id, name) => {
        await API.updateProjectName(id, name);
        setProjects(p => p.map(proj => proj.id === id ? { ...proj, name } : proj));
    };

    const handleAddInstance = (assetId) => {
        let asset = [...localAssets, ...globalAssets].find(a => a.id === assetId);
        let targetAssetId = assetId;

        // グローバルアセットの場合、自動的にローカルコピーを作成
        if (asset && asset.source === 'global') {
            const newLocalId = `a-fork-${Date.now()}`;
            const newLocalAsset = { ...asset, id: newLocalId, name: asset.name, source: undefined };
            setLocalAssets(prev => [...prev, newLocalAsset]);
            targetAssetId = newLocalId;
            asset = newLocalAsset;
        }

        const newInst = {
            id: `i-${Date.now()}`,
            assetId: targetAssetId,
            x: (400 - viewState.x) / viewState.scale / BASE_SCALE,
            y: (300 - viewState.y) / viewState.scale / BASE_SCALE,
            rotation: 0,
            locked: false,
            type: asset ? asset.type : 'unknown'
        };
        setInstances(prev => [...prev, newInst]);
        setSelectedIds([newInst.id]);
    };

    const handleAddText = () => {
        const newInst = {
            id: `t-${Date.now()}`,
            type: 'text',
            text: 'テキスト',
            fontSize: 24,
            color: '#333333',
            x: (400 - viewState.x) / viewState.scale / BASE_SCALE,
            y: (300 - viewState.y) / viewState.scale / BASE_SCALE,
            rotation: 0,
            locked: false
        };
        setInstances(prev => [...prev, newInst]);
        setSelectedIds([newInst.id]);
    };

    // ライブラリ管理画面
    if (view === 'library') {
        return (
            <div className="min-h-screen bg-gray-100 overflow-auto">
                {/* Header */}
                <div className="bg-white border-b shadow-sm p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setView('home')} className="text-gray-500 hover:text-gray-800 flex items-center gap-2">
                            <Icon p={Icons.LogOut} /> 戻る
                        </button>
                        <h1 className="text-xl font-bold text-gray-800">共通ライブラリ管理</h1>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto p-6 space-y-8">
                    {/* カラーパレット管理 */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                            🎨 カラーパレット
                        </h2>
                        <div className="grid grid-cols-10 gap-2 mb-4">
                            {colorPalette.map((color, i) => (
                                <div key={i} className="relative group">
                                    <div
                                        className="w-10 h-10 rounded border-2 border-gray-300"
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                                    <button
                                        onClick={() => {
                                            const newPalette = colorPalette.filter((_, idx) => idx !== i);
                                            setColorPalette(newPalette);
                                            API.savePalette({ colors: newPalette });
                                        }}
                                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                            {/* 新規色追加 */}
                            <label className="w-10 h-10 rounded border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                                <input
                                    type="color"
                                    className="sr-only"
                                    onChange={(e) => {
                                        const newColor = e.target.value;
                                        if (!colorPalette.includes(newColor)) {
                                            const newPalette = [...colorPalette, newColor];
                                            setColorPalette(newPalette);
                                            API.savePalette({ colors: newPalette });
                                        }
                                    }}
                                />
                                <Icon p={Icons.Plus} size={16} className="text-gray-400" />
                            </label>
                        </div>
                        <p className="text-xs text-gray-400">クリックで削除、+ ボタンで新しい色を追加</p>
                    </div>

                    {/* 共通アセット管理 */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                                📦 共通アセット
                            </h2>
                            <button
                                onClick={async () => {
                                    try {
                                        const data = globalAssets.map(a => ({ ...a, source: undefined }));
                                        await API.saveAssets(data);
                                        alert('共通アセットを保存しました');
                                    } catch (e) {
                                        console.error('Save failed:', e);
                                        alert('保存に失敗しました: ' + e);
                                    }
                                }}
                                className="text-xs bg-green-50 text-green-600 px-3 py-1 rounded border border-green-200 hover:bg-green-100"
                            >
                                変更を保存
                            </button>
                        </div>
                        <div className="flex gap-6">
                            {/* アセット一覧 */}
                            <div className="flex-1">
                                <div className="grid grid-cols-3 gap-3">
                                    {globalAssets.map(asset => (
                                        <div
                                            key={asset.id}
                                            onClick={() => setDesignTargetId(designTargetId === asset.id ? null : asset.id)}
                                            className={`border rounded p-3 relative group cursor-pointer transition ${designTargetId === asset.id
                                                ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200'
                                                : 'bg-gray-50 hover:bg-gray-100'
                                                }`}
                                        >
                                            <div className="w-10 h-10 mx-auto rounded mb-2 border" style={{ backgroundColor: asset.color }} />
                                            <div className="text-xs font-bold text-gray-700 text-center truncate">{asset.name}</div>
                                            <div className="text-[10px] text-gray-400 text-center">{asset.type}</div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!confirm(`"${asset.name}" を削除しますか？`)) return;
                                                    const newAssets = globalAssets.filter(a => a.id !== asset.id);
                                                    setGlobalAssets(newAssets);
                                                    API.saveAssets(newAssets.map(a => ({ ...a, source: undefined })));
                                                    if (designTargetId === asset.id) setDesignTargetId(null);
                                                }}
                                                className="absolute top-1 right-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-1"
                                            >
                                                <Icon p={Icons.Trash} size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {globalAssets.length === 0 && (
                                    <div className="text-center py-8 text-gray-400">
                                        共通アセットはまだありません
                                    </div>
                                )}
                            </div>

                            {/* 編集パネル */}
                            {designTargetId && (() => {
                                const editAsset = globalAssets.find(a => a.id === designTargetId);
                                if (!editAsset) return null;
                                const updateAsset = (key, value) => {
                                    const newAssets = globalAssets.map(a =>
                                        a.id === designTargetId ? { ...a, [key]: value } : a
                                    );
                                    setGlobalAssets(newAssets);
                                };
                                return (
                                    <div className="w-64 bg-gray-50 border rounded-lg p-4 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-sm text-gray-700">アセット編集</h3>
                                            <button onClick={() => setDesignTargetId(null)} className="text-gray-400 hover:text-gray-600">×</button>
                                        </div>

                                        {/* プレビュー */}
                                        <div className="flex justify-center">
                                            <div className="w-20 h-20 rounded border-2" style={{ backgroundColor: editAsset.color }} />
                                        </div>

                                        {/* 名称 */}
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 block mb-1">名称</label>
                                            <input
                                                value={editAsset.name}
                                                onChange={e => updateAsset('name', e.target.value)}
                                                className="w-full px-2 py-1 border rounded text-sm"
                                            />
                                        </div>

                                        {/* 種類 */}
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 block mb-1">種類</label>
                                            <select
                                                value={editAsset.type}
                                                onChange={e => updateAsset('type', e.target.value)}
                                                className="w-full px-2 py-1 border rounded text-sm"
                                            >
                                                <option value="room">部屋・床</option>
                                                <option value="fixture">設備・建具</option>
                                                <option value="furniture">家具</option>
                                            </select>
                                        </div>

                                        {/* 色 */}
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 block mb-1">色</label>
                                            <ColorPicker
                                                value={editAsset.color}
                                                onChange={c => updateAsset('color', c)}
                                                palette={colorPalette}
                                                onAddToPalette={addToPalette}
                                            />
                                        </div>

                                        {/* サイズ */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">幅 (mm)</label>
                                                <input
                                                    type="number"
                                                    value={editAsset.w || 100}
                                                    onChange={e => updateAsset('w', Number(e.target.value))}
                                                    className="w-full px-2 py-1 border rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">高さ (mm)</label>
                                                <input
                                                    type="number"
                                                    value={editAsset.h || 100}
                                                    onChange={e => updateAsset('h', Number(e.target.value))}
                                                    className="w-full px-2 py-1 border rounded text-sm"
                                                />
                                            </div>
                                        </div>

                                        {/* 保存ボタン */}
                                        <button
                                            onClick={() => {
                                                API.saveAssets(globalAssets.map(a => ({ ...a, source: undefined })));
                                                alert('保存しました');
                                            }}
                                            className="w-full bg-blue-600 text-white text-sm py-2 rounded hover:bg-blue-700 transition"
                                        >
                                            保存
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'home') {
        return (
            <div className="p-8 bg-gray-100 min-h-screen">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold text-gray-700">プロジェクト一覧</h1>
                        <button onClick={() => setView('library')} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                            <Icon p={Icons.Settings} size={14} /> 共通ライブラリ管理
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                        <div onClick={handleCreateProject} className="h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-50 hover:border-blue-400 hover:text-blue-500 transition">
                            <Icon p={Icons.Plus} size={32} />
                            <span className="mt-2 font-bold">新規作成</span>
                        </div>
                        {projects.map(p => (
                            <ProjectCard key={p.id} project={p} onOpen={() => setCurrentProjectId(p.id)} onDelete={handleDeleteProject} onRename={handleRenameProject} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const activeProject = projects.find(p => p.id === currentProjectId);
    const allAssets = [...localAssets, ...globalAssets];

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Size: 260px Sidebar */}
            <div className="w-64 flex-shrink-0 border-r bg-white flex flex-col z-20 shadow-sm">
                <div className="p-3 border-b flex items-center justify-between bg-gray-50">
                    <button onClick={() => setCurrentProjectId(null)} className="text-gray-500 hover:text-gray-800 p-1 rounded hover:bg-gray-200"><Icon p={Icons.LogOut} /></button>
                    <span className="font-bold text-sm truncate px-2">{activeProject?.name}</span>
                    <div className="w-6"></div>
                </div>
                <UnifiedSidebar
                    mode={mode}
                    assets={localAssets}
                    onAddInstance={handleAddInstance}
                    onAddText={handleAddText}
                    setLocalAssets={setLocalAssets}
                    setGlobalAssets={setGlobalAssets}
                    setDesignTargetId={setDesignTargetId}
                    designTargetId={designTargetId}
                    instances={instances}
                    setInstances={setInstances}
                />
            </div>

            {/* Main Canvas */}
            <div className="flex-1 relative bg-gray-100 overflow-hidden relative">
                <div className={`absolute inset-0 ${mode === 'layout' ? 'grid-bg' : 'design-grid'}`}></div>

                {/* Toolbar - ルーラーの下に配置 */}
                <div className="absolute top-6 left-6 z-30 bg-white p-1 rounded shadow-md border flex gap-1">
                    <button onClick={() => setMode('layout')} className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 ${mode === 'layout' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                        <Icon p={Icons.Move} size={14} /> レイアウト
                    </button>
                    <button onClick={() => { setMode('design'); if (!designTargetId && localAssets.length > 0) setDesignTargetId(localAssets[0].id); }} className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 ${mode === 'design' ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                        <Icon p={Icons.Pen} size={14} /> パーツ設計
                    </button>
                </div>

                {/* Scale Controls */}
                <div className="absolute bottom-4 left-4 z-30 bg-white p-1 rounded shadow-md border flex gap-1">
                    <button onClick={() => setViewState(p => ({ ...p, scale: p.scale * 1.2 }))} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><Icon p={Icons.ZoomIn} /></button>
                    <span className="px-2 py-1 text-xs min-w-[3rem] text-center">{Math.round(viewState.scale * 100)}%</span>
                    <button onClick={() => setViewState(p => ({ ...p, scale: p.scale / 1.2 }))} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><Icon p={Icons.ZoomOut} /></button>
                </div>

                <Ruler viewState={viewState} />

                {mode === 'layout' ? (
                    <LayoutCanvas
                        viewState={viewState} setViewState={setViewState}
                        assets={allAssets}
                        instances={instances} setInstances={setInstances}
                        selectedIds={selectedIds} setSelectedIds={setSelectedIds}
                    />
                ) : (
                    <DesignCanvas
                        viewState={viewState} setViewState={setViewState}
                        assets={allAssets}
                        designTargetId={designTargetId} setLocalAssets={setLocalAssets}
                        setGlobalAssets={setGlobalAssets}
                        selectedShapeIndices={selectedShapeIndices} setSelectedShapeIndices={setSelectedShapeIndices}
                        selectedPointIndex={selectedPointIndex} setSelectedPointIndex={setSelectedPointIndex}
                    />
                )}
            </div>

            {/* Right Properties Panel */}
            <div className="w-72 flex-shrink-0 border-l bg-white z-20 shadow-sm flex flex-col">
                {mode === 'layout' ? (
                    <LayoutProperties
                        instances={instances} setInstances={setInstances}
                        selectedIds={selectedIds} assets={allAssets} setSelectedIds={setSelectedIds}
                        setMode={setMode} setDesignTargetId={setDesignTargetId}
                    />
                ) : (
                    <DesignProperties
                        assets={allAssets} designTargetId={designTargetId}
                        setLocalAssets={setLocalAssets} setGlobalAssets={setGlobalAssets}
                        selectedShapeIndices={selectedShapeIndices} setSelectedShapeIndices={setSelectedShapeIndices}
                        selectedPointIndex={selectedPointIndex} setSelectedPointIndex={setSelectedPointIndex}
                        setDesignTargetId={setDesignTargetId}
                        palette={colorPalette} onAddToPalette={addToPalette}
                    />
                )}
            </div>
        </div>
    );
};

export default App;
