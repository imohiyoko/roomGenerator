import React from 'react';
import { BASE_SCALE } from '../../lib/constants';
import { toSvgY } from '../../lib/utils';

export const AssetBoundsRenderer = ({ asset }) => {
    if (!asset) return null;
    const bx = (asset.boundX || 0) * BASE_SCALE;
    const by = toSvgY((asset.boundY || 0) + asset.h) * BASE_SCALE;
    return (
        <rect x={bx} y={by} width={asset.w * BASE_SCALE} height={asset.h * BASE_SCALE} fill="none" stroke="blue" strokeWidth="1" strokeDasharray="4 2" opacity="0.3" pointerEvents="none" />
    );
};
