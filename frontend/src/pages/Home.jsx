import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { API } from '../lib/api';
import { Icon, Icons } from '../components/Icon';
import { ProjectCard } from '../components/ProjectCard';

const Home = () => {
    const navigate = useNavigate();
    const projects = useStore(state => state.projects);
    const setProjects = useStore(state => state.setProjects);

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
                    <button onClick={() => navigate('/library')} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                        <Icon p={Icons.Settings} size={14} /> 共通ライブラリ管理
                    </button>
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
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Home;
