import React from 'react';
import { BASE_SCALE } from '../../lib/constants';
import { toSvgY, toSvgRotation, generateSvgPath, generateEllipsePath, createRectPath } from '../../lib/utils';

const ShapeRenderer = ({ s, isSelected, index, assetColor, onDown }) => {
    const style = { fill: s.color || assetColor, stroke: isSelected ? "#3b82f6" : "#999", strokeWidth: isSelected ? 2 : 1, cursor: 'move' };
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

    const handleDown = (e) => {
        onDown(e, index);
    };

    return (
        <g onPointerDown={handleDown}>
            {s.type === 'circle'
                ? <ellipse cx={(s.x + s.w / 2) * BASE_SCALE} cy={toSvgY(s.y + s.h / 2) * BASE_SCALE} rx={s.w * BASE_SCALE / 2} ry={s.h * BASE_SCALE / 2} {...style} />
                : s.type === 'ellipse'
                    ? <path d={generateEllipsePath(s)} transform={rotateTransform} {...style} />
                    : <path d={s.type === 'rect' ? createRectPath(s.x, s.y, s.w, s.h) : generateSvgPath(s.points)} transform={rotateTransform} {...style} />
            }
        </g>
    );
};

export default ShapeRenderer;
