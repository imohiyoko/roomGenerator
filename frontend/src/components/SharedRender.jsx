import React from 'react';
import { BASE_SCALE } from '../lib/constants';
import { generateEllipsePath, generateSvgPath, createRectPath, toSvgY, toSvgRotation } from '../lib/utils';

export const RenderAssetShapes = ({ item, isSelected }) => {
    // Fallback for migration
    const entities = (item.entities && item.entities.length > 0)
        ? item.entities
        : (item.shapes && item.shapes.length > 0)
            ? item.shapes
            : [{ type: item.shape || 'rect', w: item.w, h: item.h, x: 0, y: 0, color: item.color, points: item.points || createRectPath(item.w, item.h) }];

    return (
        <g>
            {entities.map((s, i) => {
                const style = { fill: s.color || item.color, stroke: isSelected ? "#3b82f6" : "#999", strokeWidth: isSelected ? 3 : 1 };

                const rot = s.rotation ? toSvgRotation(s.rotation) : 0;

                let cx_svg = 0, cy_svg = 0;
                if (s.type === 'ellipse' || s.type === 'circle' || s.type === 'arc') {
                    cx_svg = (s.cx !== undefined ? s.cx : (s.x + s.w/2)) * BASE_SCALE;
                    cy_svg = toSvgY(s.cy !== undefined ? s.cy : (s.y + s.h/2)) * BASE_SCALE;
                } else {
                    cx_svg = ((s.x || 0) + (s.w || 0) / 2) * BASE_SCALE;
                    cy_svg = toSvgY((s.y || 0) + (s.h || 0) / 2) * BASE_SCALE;
                }

                const rotateTransform = rot ? `rotate(${rot} ${cx_svg} ${cy_svg})` : '';

                if (s.type === 'circle') return <ellipse key={i} cx={(s.x + s.w / 2) * BASE_SCALE} cy={toSvgY(s.y + s.h / 2) * BASE_SCALE} rx={s.w * BASE_SCALE / 2} ry={s.h * BASE_SCALE / 2} {...style} />;
                if (s.type === 'ellipse') return <path key={i} d={generateEllipsePath(s)} transform={rotateTransform} {...style} />;
                if (s.type === 'polygon' && s.points) return <path key={i} d={generateSvgPath(s.points)} {...style} />;

                // Rect: Cartesian (Bottom-Left) -> SVG (Top-Left)
                // x=x, y=-(y+h)
                return <rect key={i} x={s.x * BASE_SCALE} y={toSvgY(s.y + s.h) * BASE_SCALE} width={s.w * BASE_SCALE} height={s.h * BASE_SCALE} rx={2} {...style} />;
            })}
        </g>
    );
};
