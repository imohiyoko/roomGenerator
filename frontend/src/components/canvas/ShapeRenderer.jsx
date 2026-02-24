import React from 'react';
import { BASE_SCALE } from '../../lib/constants';
import { generateSvgPath, generateEllipsePath, toSvgY, toSvgRotation } from '../../lib/utils';

export const ShapeRenderer = ({ asset, entities, selectedShapeIndices, onDown }) => {
    if (!asset) return null;

    const bx = (asset.boundX || 0) * BASE_SCALE;
    const by = toSvgY((asset.boundY || 0) + asset.h) * BASE_SCALE;

    return (
        <g>
            <rect x={bx} y={by} width={asset.w * BASE_SCALE} height={asset.h * BASE_SCALE} fill="none" stroke="blue" strokeWidth="1" strokeDasharray="4 2" opacity="0.3" pointerEvents="none" />

            {entities.map((s, i) => {
                const isSelected = selectedShapeIndices.includes(i);
                const style = { fill: s.color || asset.color, stroke: isSelected ? "#3b82f6" : "#999", strokeWidth: isSelected ? 2 : 1, cursor: 'move' };

                // Rotation logic (Cartesian CCW -> SVG CW)
                const rot = s.rotation ? toSvgRotation(s.rotation) : 0;

                // Rotation Center logic
                let cx_svg = 0, cy_svg = 0;
                if (s.type === 'ellipse' || s.type === 'circle' || s.type === 'arc') {
                    cx_svg = (s.cx !== undefined ? s.cx : (s.x + s.w/2)) * BASE_SCALE;
                    cy_svg = toSvgY(s.cy !== undefined ? s.cy : (s.y + s.h/2)) * BASE_SCALE;
                } else {
                    cx_svg = ((s.x || 0) + (s.w || 0) / 2) * BASE_SCALE;
                    cy_svg = toSvgY((s.y || 0) + (s.h || 0) / 2) * BASE_SCALE;
                }

                const rotateTransform = rot ? `rotate(${rot} ${cx_svg} ${cy_svg})` : '';

                return (
                    <g key={i} onPointerDown={(e) => onDown(e, i)}>
                        {s.type === 'circle'
                            ? <ellipse cx={(s.x + s.w / 2) * BASE_SCALE} cy={toSvgY(s.y + s.h / 2) * BASE_SCALE} rx={s.w * BASE_SCALE / 2} ry={s.h * BASE_SCALE / 2} {...style} />
                            : s.type === 'ellipse'
                                ? <path d={generateEllipsePath(s)} transform={rotateTransform} {...style} />
                                : <path d={generateSvgPath(s.points)} {...style} />
                        }
                    </g>
                );
            })}
        </g>
    );
};
