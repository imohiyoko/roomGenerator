import React, { useState, useEffect } from 'react';
import { Icon, Icons } from './Icon';

export const ProjectCard = ({ project, onOpen, onDelete, onRename, onExport }) => {
    const [name, setName] = useState(project.name);
    useEffect(() => setName(project.name), [project.name]);
    const handleBlur = () => { if (name !== project.name) onRename(project.id, name); };
    const handleKeyDown = (e) => { if (e.key === 'Enter') e.currentTarget.blur(); };
    return (
        <div onClick={onOpen} className="h-40 bg-white border rounded-lg shadow-sm hover:shadow-md p-4 flex flex-col cursor-pointer relative group transition">
            <div className="flex-1 flex flex-col items-center justify-center">
                <Icon p={Icons.Folder} size={40} className="text-orange-200 mb-2" />
                <input value={name} onClick={e => e.stopPropagation()} onChange={e => setName(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown} className="text-center font-bold text-lg w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none text-gray-700" />
            </div>
            <button onClick={(e) => onDelete(e, project.id)} className="absolute top-2 right-2 p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Icon p={Icons.Trash} /></button>
            <button onClick={(e) => { e.stopPropagation(); onExport(project.id); }} className="absolute top-2 left-2 p-2 text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition" title="エクスポート"><Icon p={Icons.Download} /></button>
        </div>
    );
};
