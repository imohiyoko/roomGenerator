import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore as useVanillaStore } from 'zustand';
import { useStore } from '../store';
import { Icon, Icons } from '../components/Icon';
import { UnifiedSidebar } from '../components/UnifiedSidebar';
import { LayoutCanvas } from '../components/LayoutCanvas';
import { DesignCanvas } from '../components/DesignCanvas';
import { LayoutProperties } from '../components/LayoutProperties';
import { DesignProperties } from '../components/DesignProperties';
import { ProjectSettingsModal } from '../components/ProjectSettingsModal';
import { Ruler } from '../components/Ruler';
import { useAutoSave } from '../hooks/useAutoSave';
import { useKeyboardControls } from '../hooks/useKeyboardControls';

const Editor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [showSettings, setShowSettings] = useState(false);

    // --- Store Selectors ---
    const projects = useStore(state => state.projects);
    const currentProjectId = useStore(state => state.currentProjectId);

    const mode = useStore(state => state.mode);
    const setMode = useStore(state => state.setMode);

    const viewState = useStore(state => state.viewState);
    const setViewState = useStore(state => state.setViewState);

    const localAssets = useStore(state => state.localAssets);
    const setLocalAssets = useStore(state => state.setLocalAssets);
    const setGlobalAssets = useStore(state => state.setGlobalAssets);

    const instances = useStore(state => state.instances);
    const setInstances = useStore(state => state.setInstances);

    const designTargetId = useStore(state => state.designTargetId);
    const setDesignTargetId = useStore(state => state.setDesignTargetId);

    const defaultColors = useStore(state => state.defaultColors);

    // Actions
    const loadProject = useStore(state => state.loadProject);
    const addInstance = useStore(state => state.addInstance);
    const addText = useStore(state => state.addText);

    // Undo/Redo
    const { undo, redo, pastStates, futureStates } = useVanillaStore(useStore.temporal, (state) => state);

    // --- Effects ---

    // Load Project Data when ID changes (from URL)
    useEffect(() => {
        if (id) {
            loadProject(id);
        }
    }, [id]);

    // Custom Hooks
    useAutoSave();
    useKeyboardControls();

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

    const activeProject = projects.find(p => p.id === currentProjectId);

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 flex-shrink-0 border-r bg-white flex flex-col z-20 shadow-sm">
                <div className="p-3 border-b flex items-center justify-between bg-gray-50">
                    <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-800 p-1 rounded hover:bg-gray-200"><Icon p={Icons.LogOut} /></button>
                    <div className="flex items-center min-w-0 flex-1 justify-center">
                        <span className="font-bold text-sm truncate px-1">{activeProject?.name || 'Loading...'}</span>
                        <button onClick={() => setShowSettings(true)} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200" title="プロジェクト設定"><Icon p={Icons.Settings} size={14}/></button>
                    </div>
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
                    <LayoutCanvas />
                ) : (
                    <DesignCanvas />
                )}
            </div>

            {/* Properties Panel */}
            <div className="w-72 flex-shrink-0 border-l bg-white z-20 shadow-sm flex flex-col">
                {mode === 'layout' ? (
                    <LayoutProperties />
                ) : (
                    <DesignProperties />
                )}
            </div>
            {showSettings && <ProjectSettingsModal onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default Editor;
