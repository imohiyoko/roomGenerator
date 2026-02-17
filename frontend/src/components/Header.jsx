import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, Icons } from './Icon';

export const Header = ({ title, children }) => {
    const navigate = useNavigate();

    return (
        <div className="h-12 bg-white border-b shadow-sm flex items-center justify-between px-4 z-50 relative flex-shrink-0">
            {/* Left: Home & Title */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/')}
                    className="text-gray-500 hover:text-gray-800 p-1.5 rounded hover:bg-gray-100 flex items-center gap-2 transition"
                    title="ホームに戻る"
                >
                    <Icon p={Icons.LogOut} size={18} />
                </button>
                <h1 className="text-lg font-bold text-gray-700 truncate">{title}</h1>
            </div>

            {/* Center: Custom Page Actions (e.g. Undo/Redo) */}
            <div className="flex-1 flex justify-center">
                {children}
            </div>

            {/* Right: Settings */}
            <div>
                <button
                    onClick={() => navigate('/settings')}
                    className="text-gray-500 hover:text-gray-800 p-1.5 rounded hover:bg-gray-100 flex items-center gap-2 transition"
                    title="設定"
                >
                    <Icon p={Icons.Settings} size={18} />
                </button>
            </div>
        </div>
    );
};
