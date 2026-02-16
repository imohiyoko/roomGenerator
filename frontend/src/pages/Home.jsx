import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { API } from '../lib/api';
import { Icon, Icons } from '../components/Icon';
import { ProjectCard } from '../components/ProjectCard';

const Home = () => {
    const navigate = useNavigate();
    const projects = useStore(state => state.projects);
    const setProjects = useStore(state => state.setProjects);
    const fileInputRef = useRef(null);

    const handleExportProject = async (id) => {
        try {
            const jsonStr = await API.exportProject(id);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `project_${id}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
            alert("エクスポートに失敗しました");
        }
    };

    const handleImportProject = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const defaultName = file.name.replace(/\.json$/i, '');
            const name = prompt("プロジェクト名を入力してください", defaultName);
            if (!name) return;

            const newProj = await API.importProject(name, text);
            if (newProj) {
                setProjects(prev => [...prev, newProj]);
                alert("インポートしました");
            }
        } catch (err) {
            console.error(err);
            alert("インポートに失敗しました: " + err);
        }
        e.target.value = '';
    };

    const handleCreateProject = async () => {
        const name = prompt("プロジェクト名を入力してください", "新規プロジェクト");
        if (!name) return;
        const newProj = await API.createProject(name);
        if (newProj) {
            setProjects(prev => [...prev, newProj]);
            // Navigate to the new project
            navigate(`/project/${newProj.id}`);
        }
    };

    const handleDeleteProject = async (e, id) => {
        e.stopPropagation();
        if (!confirm("このプロジェクトを削除しますか？")) return;
        await API.deleteProject(id);
        setProjects(prev => prev.filter(proj => proj.id !== id));
    };

    const handleRenameProject = async (id, name) => {
        await API.updateProjectName(id, name);
        setProjects(prev => prev.map(proj => proj.id === id ? { ...proj, name } : proj));
    };

    return (
        <div className="p-8 bg-gray-100 min-h-screen">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-gray-700">プロジェクト一覧</h1>
                    <div className="flex items-center gap-4">
                        <input type="file" ref={fileInputRef} onChange={handleImportProject} accept=".json" className="hidden" />
                        <button onClick={() => fileInputRef.current.click()} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                            <Icon p={Icons.Upload} size={14} /> プロジェクトをインポート
                        </button>
                        <button onClick={() => navigate('/library')} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                            <Icon p={Icons.Settings} size={14} /> 共通ライブラリ管理
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                    <div onClick={handleCreateProject} className="h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-50 hover:border-blue-400 hover:text-blue-500 transition">
                        <Icon p={Icons.Plus} size={32} />
                        <span className="mt-2 font-bold">新規作成</span>
                    </div>
                    {projects.map(p => (
                        <ProjectCard
                            key={p.id}
                            project={p}
                            onOpen={() => navigate(`/project/${p.id}`)}
                            onDelete={handleDeleteProject}
                            onRename={handleRenameProject}
                            onExport={handleExportProject}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Home;
