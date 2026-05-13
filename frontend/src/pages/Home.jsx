import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { API } from '../lib/api';
import { Icon, Icons } from '../components/Icon';
import { Header } from '../components/Header';

const InputModal = ({ title, defaultValue, onConfirm, onCancel }) => {
    const [value, setValue] = useState(defaultValue);
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') onConfirm(value);
        if (e.key === 'Escape') onCancel();
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
            <div className="bg-white rounded-lg shadow-xl w-80 p-6" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-gray-700 mb-3">{title}</h3>
                <input
                    autoFocus
                    className="w-full border rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onCancel} className="px-4 py-1.5 text-sm rounded border text-gray-600 hover:bg-gray-50">キャンセル</button>
                    <button onClick={() => onConfirm(value)} className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">OK</button>
                </div>
            </div>
        </div>
    );
};

const ConfirmModal = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
        <div className="bg-white rounded-lg shadow-xl w-80 p-6" onClick={e => e.stopPropagation()}>
            <p className="text-gray-700 mb-4">{message}</p>
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-4 py-1.5 text-sm rounded border text-gray-600 hover:bg-gray-50">キャンセル</button>
                <button onClick={onConfirm} className="px-4 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700">削除</button>
            </div>
        </div>
    </div>
);

const Home = () => {
    const navigate = useNavigate();
    const projects = useStore(state => state.projects);
    const setProjects = useStore(state => state.setProjects);

    const fileInputRef = useRef(null);
    const [modal, setModal] = useState(null);

    const showInput = (title, defaultValue) =>
        new Promise(resolve => setModal({ type: 'input', title, defaultValue, resolve }));

    const showConfirm = (message) =>
        new Promise(resolve => setModal({ type: 'confirm', message, resolve }));

    const handleModalConfirm = (value) => { modal.resolve(value ?? true); setModal(null); };
    const handleModalCancel = () => { modal.resolve(null); setModal(null); };

    const handleCreate = async () => {
        const name = await showInput("プロジェクト名を入力してください", "新しいプロジェクト");
        if (!name) return;
        const newProj = await API.createProject(name);
        if (newProj) {
            setProjects(prev => [...prev, newProj]);
            navigate(`/project/${newProj.id}`);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        const ok = await showConfirm("プロジェクトを削除しますか？");
        if (!ok) return;
        await API.deleteProject(id);
        setProjects(prev => prev.filter(p => p.id !== id));
    };

    const handleRename = async (e, id, currentName) => {
        e.stopPropagation();
        const newName = await showInput("新しいプロジェクト名を入力してください", currentName);
        if (!newName || newName === currentName) return;
        await API.updateProjectName(id, newName);
        setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const json = evt.target.result;
                const name = file.name.replace(/\.json$/i, "");
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
            {modal?.type === 'input' && <InputModal title={modal.title} defaultValue={modal.defaultValue} onConfirm={handleModalConfirm} onCancel={handleModalCancel} />}
            {modal?.type === 'confirm' && <ConfirmModal message={modal.message} onConfirm={() => handleModalConfirm(true)} onCancel={handleModalCancel} />}
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
                                    <button onClick={(e) => handleRename(e, p.id, p.name)} className="p-1.5 bg-white rounded-full shadow border text-gray-400 hover:text-green-600" title="名前変更">
                                        <Icon p={Icons.Pen} size={14} />
                                    </button>
                                     <button onClick={(e) => handleExport(e, p.id)} className="p-1.5 bg-white rounded-full shadow border text-gray-400 hover:text-blue-600" title="エクスポート">
                                        <Icon p={Icons.Download} size={14} />
                                    </button>
                                    <button onClick={(e) => handleDelete(e, p.id)} className="p-1.5 bg-white rounded-full shadow border text-gray-400 hover:text-red-500" title="削除">
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
