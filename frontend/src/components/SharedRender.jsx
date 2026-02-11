import React from 'react';
import { BASE_SCALE } from '../lib/constants';
import { generateEllipsePath, generateSvgPath, createRectPath } from '../lib/utils';

export const RenderAssetShapes = ({ item, isSelected }) => {
    const shapes = (item.shapes && item.shapes.length > 0)
        ? item.shapes
        : [{ type: item.shape || 'rect', w: item.w, h: item.h, x: 0, y: 0, color: item.color, points: item.points || createRectPath(item.w, item.h) }];
    return (
        <g>
            {shapes.map((s, i) => {
                const style = { fill: s.color || item.color, stroke: isSelected ? "#3b82f6" : "#999", strokeWidth: isSelected ? 3 : 1 };
                const rot = s.rotation || 0;
                const rotateTransform = rot ? `rotate(${rot} ${(s.cx || 0) * BASE_SCALE} ${(s.cy || 0) * BASE_SCALE})` : '';
                if (s.type === 'circle') return <ellipse key={i} cx={(s.x + s.w / 2) * BASE_SCALE} cy={(s.y + s.h / 2) * BASE_SCALE} rx={s.w * BASE_SCALE / 2} ry={s.h * BASE_SCALE / 2} {...style} />;
                if (s.type === 'ellipse') return <path key={i} d={generateEllipsePath(s)} transform={rotateTransform} {...style} />;
                if (s.type === 'polygon' && s.points) return <path key={i} d={generateSvgPath(s.points)} {...style} />;
                return <rect key={i} x={s.x * BASE_SCALE} y={s.y * BASE_SCALE} width={s.w * BASE_SCALE} height={s.h * BASE_SCALE} rx={2} {...style} />;
            })}
        </g>
    );
};
