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
import { Header } from '../components/Header';
import { ResizeHandle } from '../components/ResizeHandle';

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

    // UI State
    const leftSidebarWidth = useStore(state => state.leftSidebarWidth);
    const rightSidebarWidth = useStore(state => state.rightSidebarWidth);
    const leftSidebarCollapsed = useStore(state => state.leftSidebarCollapsed);
    const rightSidebarCollapsed = useStore(state => state.rightSidebarCollapsed);

    const setLeftSidebarWidth = useStore(state => state.setLeftSidebarWidth);
    const setRightSidebarWidth = useStore(state => state.setRightSidebarWidth);
    const toggleLeftSidebar = useStore(state => state.toggleLeftSidebar);
    const toggleRightSidebar = useStore(state => state.toggleRightSidebar);

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
    const projectTitle = activeProject?.name || 'Loading...';

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            {/* Common Header with Editor-specific actions */}
            <Header title={projectTitle}>
                <div className="flex items-center gap-4">
                     <div className="flex bg-gray-100 rounded p-0.5">
                        <button onClick={() => undo()} disabled={pastStates.length === 0} className={`p-1.5 rounded ${pastStates.length > 0 ? 'hover:bg-white hover:shadow-sm text-gray-700' : 'text-gray-300'}`} title="Undo (Ctrl+Z)"><Icon p={Icons.Undo} size={16}/></button>
                        <button onClick={() => redo()} disabled={futureStates.length === 0} className={`p-1.5 rounded ${futureStates.length > 0 ? 'hover:bg-white hover:shadow-sm text-gray-700' : 'text-gray-300'}`} title="Redo (Ctrl+Shift+Z)"><Icon p={Icons.Redo} size={16}/></button>
                    </div>
                    <div className="h-4 border-r border-gray-300"></div>
                     <button onClick={() => setShowSettings(true)} className="text-gray-500 hover:text-gray-800 flex items-center gap-1 text-sm font-bold px-2 py-1 rounded hover:bg-gray-100">
                        <Icon p={Icons.Settings} size={14}/> プロジェクト設定
                    </button>
                </div>
            </Header>

            <div className="flex flex-1 overflow-hidden relative">

                {/* Left Sidebar */}
                <div
                    className={`flex-shrink-0 bg-white flex flex-col z-20 shadow-sm relative transition-all duration-200 ease-in-out border-r`}
                    style={{ width: leftSidebarCollapsed ? 40 : leftSidebarWidth }}
                >
                     {/* Collapse/Expand Toggle (Inside Sidebar) */}
                    <div className="h-8 border-b flex items-center justify-end px-1 bg-gray-50">
                        <button onClick={toggleLeftSidebar} className="p-1 hover:bg-gray-200 rounded text-gray-500">
                            <Icon p={leftSidebarCollapsed ? Icons.Menu : Icons.ChevronLeft} size={14} />
                        </button>
                    </div>

                    {!leftSidebarCollapsed ? (
                        <>
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
                            <ResizeHandle
                                side="right"
                                onResize={(delta) => setLeftSidebarWidth(leftSidebarWidth + delta)}
                            />
                        </>
                    ) : (
                         /* Collapsed State Content */
                        <div className="flex flex-col items-center py-4 gap-4">
                            <button onClick={() => setMode('layout')} title="レイアウト" className={`p-2 rounded ${mode === 'layout' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}>
                                <Icon p={Icons.Move} />
                            </button>
                            <button onClick={() => setMode('design')} title="パーツ設計" className={`p-2 rounded ${mode === 'design' ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:bg-gray-100'}`}>
                                <Icon p={Icons.Pen} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Canvas Area */}
                <div className="flex-1 relative bg-gray-100 overflow-hidden relative">
                    <div className={`absolute inset-0 ${mode === 'layout' ? 'grid-bg' : 'design-grid'}`}></div>

                    {/* Toolbar (Only show if sidebar is expanded, otherwise controls are in sidebar) */}
                    {/* Actually, let's keep it but maybe adjust position? Or just keep it as is. */}
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

                {/* Properties Panel (Right Sidebar) */}
                <div
                    className="flex-shrink-0 border-l bg-white z-20 shadow-sm flex flex-col relative transition-all duration-200 ease-in-out"
                    style={{ width: rightSidebarCollapsed ? 40 : rightSidebarWidth }}
                >
                    {/* Collapse/Expand Toggle */}
                     <div className="h-8 border-b flex items-center justify-start px-1 bg-gray-50">
                        <button onClick={toggleRightSidebar} className="p-1 hover:bg-gray-200 rounded text-gray-500">
                             <Icon p={rightSidebarCollapsed ? Icons.Menu : Icons.ChevronRight} size={14} />
                        </button>
                    </div>

                    {!rightSidebarCollapsed ? (
                        <>
                            <ResizeHandle
                                side="left"
                                onResize={(delta) => setRightSidebarWidth(rightSidebarWidth - delta)}
                            />
                            {mode === 'layout' ? (
                                <LayoutProperties />
                            ) : (
                                <DesignProperties />
                            )}
                        </>
                    ) : (
                        /* Collapsed Content */
                         <div className="flex flex-col items-center py-4 text-gray-400">
                             <span className="writing-vertical-rl text-xs font-bold tracking-widest">PROPERTIES</span>
                         </div>
                    )}
                </div>
            </div>

            {showSettings && <ProjectSettingsModal onClose={() => setShowSettings(false)} />}
        </div>
    );
};

export default Editor;
