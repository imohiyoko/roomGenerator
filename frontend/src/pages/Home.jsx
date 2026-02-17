import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { API } from '../lib/api';
import { Icon, Icons } from '../components/Icon';
import { Header } from '../components/Header';

const Home = () => {
    const navigate = useNavigate();
    const projects = useStore(state => state.projects);
    const createProject = useStore(state => state.createProject);
    const deleteProject = useStore(state => state.deleteProject);
    const setProjects = useStore(state => state.setProjects);

    const fileInputRef = useRef(null);

    const handleCreate = async () => {
        const name = prompt("プロジェクト名を入力してください", "新しいプロジェクト");
        if (name) {
            const id = await createProject(name);
            if (id) {
                navigate(`/project/${id}`);
            }
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (confirm("プロジェクトを削除しますか？")) {
            await deleteProject(id);
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const json = evt.target.result;
                const name = file.name.replace(".json", "");
                await API.importProject(name, json);
                // Reload projects
                const newProjects = await API.getProjects();
                setProjects(newProjects);
                alert("インポートしました");
            } catch (err) {
                console.error(err);
                alert("インポートに失敗しました");
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleExport = async (e, id) => {
        e.stopPropagation();
        try {
            const jsonStr = await API.exportProject(id);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `project_${id}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert("エクスポートに失敗しました");
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Header title="ホーム" />

            <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-5xl mx-auto">

                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold text-gray-800">プロジェクト一覧</h2>
                        <div className="flex gap-4">
                            <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />
                            <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-2 px-4 py-2 bg-white border rounded shadow-sm text-gray-600 hover:bg-gray-50 font-bold">
                                <Icon p={Icons.Upload} size={18} /> インポート
                            </button>
                            <button onClick={() => navigate('/library')} className="flex items-center gap-2 px-4 py-2 bg-white border rounded shadow-sm text-blue-600 hover:bg-blue-50 font-bold">
                                <Icon p={Icons.Globe} size={18} /> 共通ライブラリ
                            </button>
                            <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 font-bold">
                                <Icon p={Icons.Plus} size={18} /> 新規作成
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {projects.map(p => (
                            <div key={p.id} onClick={() => navigate(`/project/${p.id}`)}
                                className="bg-white rounded-xl shadow-sm border hover:shadow-md transition cursor-pointer group flex flex-col h-40 relative overflow-hidden">
                                <div className="flex-1 p-5 flex flex-col justify-center items-center bg-gray-50 group-hover:bg-blue-50/30 transition">
                                    <Icon p={Icons.File} size={48} className="text-gray-300 group-hover:text-blue-400 mb-2" />
                                </div>
                                <div className="p-4 border-t flex items-center justify-between bg-white">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-800 truncate">{p.name}</h3>
                                        <p className="text-xs text-gray-400 truncate">ID: {p.id}</p>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                     <button onClick={(e) => handleExport(e, p.id)} className="p-1.5 bg-white rounded-full shadow border text-gray-400 hover:text-blue-600">
                                        <Icon p={Icons.Download} size={14} />
                                    </button>
                                    <button onClick={(e) => handleDelete(e, p.id)} className="p-1.5 bg-white rounded-full shadow border text-gray-400 hover:text-red-500">
                                        <Icon p={Icons.Trash} size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* New Project Card */}
                        <button onClick={handleCreate} className="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center h-40 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition gap-2">
                            <Icon p={Icons.Plus} size={32} />
                            <span className="font-bold text-sm">新規プロジェクト</span>
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Home;
