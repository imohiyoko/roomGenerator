import React from 'react';

export const AssetFilter = ({ filter, setFilter }) => (
    <div className="flex p-2 gap-1 bg-gray-50 border-b shrink-0">
        <button onClick={() => setFilter('local')} className={`flex-1 py-1 text-[10px] rounded border transition ${filter === 'local' ? 'bg-white border-orange-300 shadow-sm font-bold text-orange-600' : 'border-transparent text-gray-400 hover:bg-gray-100'}`}>ローカル</button>
        <button onClick={() => setFilter('global')} className={`flex-1 py-1 text-[10px] rounded border transition ${filter === 'global' ? 'bg-white border-blue-300 shadow-sm font-bold text-blue-600' : 'border-transparent text-gray-400 hover:bg-gray-100'}`}>共通</button>
    </div>
);
