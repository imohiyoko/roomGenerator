import React, { useState } from 'react';

export const ColorPicker = ({ value, onChange, palette, onAddToPalette }) => {
    const [showMore, setShowMore] = useState(false);
    const [showCustom, setShowCustom] = useState(false);
    const [customColor, setCustomColor] = useState(value || '#cccccc');

    const handleCustomChange = (e) => {
        setCustomColor(e.target.value);
        onChange(e.target.value);
    };

    const handleAddToPalette = () => {
        if (onAddToPalette && !palette.includes(customColor)) {
            onAddToPalette(customColor);
        }
    };

    const colors = palette || [];
    const firstRow = colors.slice(0, 5);
    const moreColors = colors.slice(5);

    return (
        <div className="space-y-1">
            {/* 1行目: 最初の5色 */}
            <div className="flex gap-1 items-center">
                {firstRow.map((color, i) => (
                    <button
                        key={i}
                        onClick={() => { onChange(color); setShowMore(false); }}
                        className={`w-6 h-6 rounded border-2 transition hover:scale-110 ${value === color ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                    />
                ))}
                {moreColors.length > 0 && (
                    <button
                        onClick={() => setShowMore(!showMore)}
                        className="w-6 h-6 rounded border-2 border-dashed border-gray-300 text-gray-400 text-[10px] hover:border-blue-400 hover:text-blue-500"
                        title={showMore ? '閉じる' : 'もっと見る'}
                    >
                        {showMore ? '−' : `+${moreColors.length}`}
                    </button>
                )}
                <button
                    onClick={() => setShowCustom(!showCustom)}
                    className="w-6 h-6 rounded border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-blue-400"
                    title="カスタム色"
                >
                    <span className="text-[10px]">🎨</span>
                </button>
            </div>

            {/* 展開時: 残りの色 */}
            {showMore && moreColors.length > 0 && (
                <div className="grid grid-cols-5 gap-1 p-2 bg-gray-50 rounded border">
                    {moreColors.map((color, i) => (
                        <button
                            key={i}
                            onClick={() => { onChange(color); setShowMore(false); }}
                            className={`w-6 h-6 rounded border-2 transition hover:scale-110 ${value === color ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'}`}
                            style={{ backgroundColor: color }}
                            title={color}
                        />
                    ))}
                </div>
            )}

            {/* カスタムカラー */}
            {showCustom && (
                <div className="flex gap-2 items-center p-2 bg-gray-50 rounded border">
                    <input
                        type="color"
                        value={customColor}
                        onChange={handleCustomChange}
                        className="w-8 h-6 cursor-pointer border rounded"
                    />
                    <button
                        onClick={handleAddToPalette}
                        className="text-[10px] px-2 py-0.5 bg-green-50 text-green-600 border border-green-200 rounded hover:bg-green-100"
                        title="パレットに追加"
                    >
                        +追加
                    </button>
                    <button
                        onClick={() => setShowCustom(false)}
                        className="text-[10px] text-gray-400 hover:text-gray-600"
                    >
                        閉じる
                    </button>
                </div>
            )}
        </div>
    );
};
