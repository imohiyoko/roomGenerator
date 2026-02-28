import React from 'react';
import { BASE_SCALE } from '../../lib/constants.js';
import { toSvgY } from '../../lib/utils.js';

/**
 * デザイナーキャンバスのグリッド、背景軸、原点、およびアセットのバウンディングボックスを描画します。
 */
export const GridRenderer = ({ asset }) => {
    return (
        <g>
            {/* 軸 */}
            <line x1="-5000" y1="0" x2="5000" y2="0" stroke="#ccc" strokeWidth="2" />
            <line x1="0" y1="-5000" x2="0" y2="5000" stroke="#ccc" strokeWidth="2" />
            {/* 原点 */}
            <circle cx="0" cy="0" r="5" fill="red" opacity="0.5" />

            {/* アセットのバウンディングボックス */}
            {asset && (() => {
                const bx = (asset.boundX || 0) * BASE_SCALE;
                const by = toSvgY((asset.boundY || 0) + asset.h) * BASE_SCALE;
                return (
                    <rect
                        x={bx}
                        y={by}
                        width={asset.w * BASE_SCALE}
                        height={asset.h * BASE_SCALE}
                        fill="none"
                        stroke="blue"
                        strokeWidth="1"
                        strokeDasharray="4 2"
                        opacity="0.3"
                        pointerEvents="none"
                    />
                );
            })()}
        </g>
    );
};
