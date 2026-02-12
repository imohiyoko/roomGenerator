import React, { useEffect, useRef } from 'react';
import { API } from './lib/api';
import { BASE_SCALE } from './lib/constants';
import { deepClone } from './lib/utils';
import { Icon, Icons } from './components/Icon';
import { UnifiedSidebar } from './components/UnifiedSidebar';
import { LayoutCanvas } from './components/LayoutCanvas';
import { DesignCanvas } from './components/DesignCanvas';
import { LayoutProperties } from './components/LayoutProperties';
import { DesignProperties } from './components/DesignProperties';
import { ProjectCard } from './components/ProjectCard';
import { Ruler } from './components/Ruler';
import { ColorPicker } from './components/ColorPicker';
import { useStore } from './lib/store';

const App = () => {
    // --- Store Selectors ---
    const projects = useStore(state => state.projects);
    const setProjects = useStore(state => state.setProjects);

    const currentProjectId = useStore(state => state.currentProjectId);
    const setCurrentProjectId = useStore(state => state.setCurrentProjectId);

    const view = useStore(state => state.view);
    const setView = useStore(state => state.setView);

    const mode = useStore(state => state.mode);
    const setMode = useStore(state => state.setMode);

    const viewState = useStore(state => state.viewState);
    const setViewState = useStore(state => state.setViewState);

    const localAssets = useStore(state => state.localAssets);
    const setLocalAssets = useStore(state => state.setLocalAssets);

    const globalAssets = useStore(state => state.globalAssets);
    const setGlobalAssets = useStore(state => state.setGlobalAssets);

    const instances = useStore(state => state.instances);
    const setInstances = useStore(state => state.setInstances);

    const selectedIds = useStore(state => state.selectedIds);
    const setSelectedIds = useStore(state => state.setSelectedIds);

    const designTargetId = useStore(state => state.designTargetId);
    const setDesignTargetId = useStore(state => state.setDesignTargetId);

    const selectedShapeIndices = useStore(state => state.selectedShapeIndices);
    const setSelectedShapeIndices = useStore(state => state.setSelectedShapeIndices);
    const selectedPointIndex = useStore(state => state.selectedPointIndex);
    const setSelectedPointIndex = useStore(state => state.setSelectedPointIndex);

    const colorPalette = useStore(state => state.colorPalette);
    const defaultColors = useStore(state => state.defaultColors);

    // Actions
    const updateDefaultColor = useStore(state => state.updateDefaultColor);
    const addToPalette = useStore(state => state.addToPalette);
    const removeFromPalette = useStore(state => state.removeFromPalette);
    const setColorPalette = useStore(state => state.setColorPalette);

    const loadProject = useStore(state => state.loadProject);
    const saveProjectData = useStore(state => state.saveProjectData);
    const addInstance = useStore(state => state.addInstance);
    const addText = useStore(state => state.addText);

    // Undo/Redo
    const { undo, redo, pastStates, futureStates } = useStore.temporal((state) => state);

    // --- Effects ---

    // Initial Load
    useEffect(() => {
        API.getProjects().then(setProjects);
        API.getAssets().then(assets => setGlobalAssets((assets || []).map(a => ({ ...a, source: 'global' }))));
        API.getPalette().then(data => {
            if (data?.colors) setColorPalette(data.colors);
            if (data?.defaults) useStore.setState({ defaultColors: data.defaults });
        });
    }, []);

    // Load Project Data when ID changes
    useEffect(() => {
        if (currentProjectId) {
            loadProject(currentProjectId);
        } else {
            setView('home');
        }
    }, [currentProjectId]);

    // Auto-Save (Debounced)
    useEffect(() => {
        if (!currentProjectId) return;
        const timer = setTimeout(() => {
            saveProjectData();
        }, 1000);
        return () => clearTimeout(timer);
    }, [localAssets, instances, currentProjectId]);


    // Keyboard Pan (WASD / Arrows)
    useEffect(() => {
        const PAN_STEP = 50;
        const handleKeyDown = (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

            // Undo/Redo Shortcuts
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
                return;
            }
             if ((e.ctrlKey || e.metaKey) && e.key === 'y') { // Windows Redo Standard
                e.preventDefault();
                redo();
                return;
            }

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
    }, [undo, redo]);

    // Number Input Wheel
    useEffect(() => {
        const handleWheel = (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
                e.preventDefault();
                const step = e.shiftKey ? 1000 : 10;
                const delta = e.deltaY < 0 ? step : -step;
            }
        };
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => window.removeEventListener('wheel', handleWheel);
    }, []);


    // Handlers
    const handleCreateProject = async () => {
        const name = prompt("プロジェクト名を入力してください", "新規プロジェクト");
        if (!name) return;
        const newProj = await API.createProject(name);
        if (newProj) {
            setProjects([...projects, newProj]);
        }
    };

    const handleDeleteProject = async (e, id) => {
        e.stopPropagation();
        if (!confirm("このプロジェクトを削除しますか？")) return;
        await API.deleteProject(id);
        setProjects(projects.filter(proj => proj.id !== id));
    };

    const handleRenameProject = async (id, name) => {
        await API.updateProjectName(id, name);
        setProjects(projects.map(proj => proj.id === id ? { ...proj, name } : proj));
    };

    // Throttled Add Instance
    const lastAddRef = useRef(0);
    const handleAddInstanceThrottled = (assetId) => {
        const now = Date.now();
        if (now - lastAddRef.current < 500) return;
        lastAddRef.current = now;
        addInstance(assetId);
    };

    const handleAddTextThrottled = () => {
        const now = Date.now();
        if (now - lastAddRef.current < 500) return;
        lastAddRef.current = now;
        addText();
    };


    // --- View Rendering ---

    if (view === 'library') {
        return (
            <div className="min-h-screen bg-gray-100 overflow-auto">
                <div className="bg-white border-b shadow-sm p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setView('home')} className="text-gray-500 hover:text-gray-800 flex items-center gap-2">
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
            {/* Sidebar */}
            <div className="w-64 flex-shrink-0 border-r bg-white flex flex-col z-20 shadow-sm">
                <div className="p-3 border-b flex items-center justify-between bg-gray-50">
                    <button onClick={() => setCurrentProjectId(null)} className="text-gray-500 hover:text-gray-800 p-1 rounded hover:bg-gray-200"><Icon p={Icons.LogOut} /></button>
                    <span className="font-bold text-sm truncate px-2">{activeProject?.name}</span>
                    <div className="flex gap-1">
                        <button onClick={() => undo()} disabled={pastStates.length === 0} className={`p-1 rounded ${pastStates.length > 0 ? 'hover:bg-gray-200 text-gray-600' : 'text-gray-300'}`} title="Undo (Ctrl+Z)"><Icon p={Icons.Undo} size={14}/></button>
                        <button onClick={() => redo()} disabled={futureStates.length === 0} className={`p-1 rounded ${futureStates.length > 0 ? 'hover:bg-gray-200 text-gray-600' : 'text-gray-300'}`} title="Redo (Ctrl+Shift+Z)"><Icon p={Icons.Redo} size={14}/></button>
                    </div>
                </div>
                <UnifiedSidebar
                    mode={mode}
                    assets={localAssets}
                    onAddInstance={handleAddInstanceThrottled}
                    onAddText={handleAddTextThrottled}
                    setLocalAssets={setLocalAssets}
                    setGlobalAssets={setGlobalAssets}
                    setDesignTargetId={setDesignTargetId}
                    designTargetId={designTargetId}
                    instances={instances}
                    setInstances={setInstances}
                    defaultColors={defaultColors}
                />
            </div>

            {/* Canvas Area */}
            <div className="flex-1 relative bg-gray-100 overflow-hidden relative">
                <div className={`absolute inset-0 ${mode === 'layout' ? 'grid-bg' : 'design-grid'}`}></div>

                {/* Toolbar */}
                <div className="absolute top-6 left-6 z-30 bg-white p-1 rounded shadow-md border flex gap-1">
                    <button onClick={() => setMode('layout')} className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 ${mode === 'layout' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                        <Icon p={Icons.Move} size={14} /> レイアウト
                    </button>
                    <button onClick={() => { setMode('design'); if (!designTargetId && localAssets.length > 0) setDesignTargetId(localAssets[0].id); }} className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 ${mode === 'design' ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                        <Icon p={Icons.Pen} size={14} /> パーツ設計
                    </button>
                </div>

                {/* Scale */}
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
                    />
                )}
            </div>

            {/* Properties Panel */}
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
                        defaultColors={defaultColors}
                    />
                )}
            </div>
        </div>
    );
};

export default App;
