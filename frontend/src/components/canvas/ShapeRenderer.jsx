import React from 'react';
import { BASE_SCALE } from '../../lib/constants';
import { generateSvgPath, generateEllipsePath, toSvgY, toSvgRotation } from '../../lib/utils';
import { HandleRenderer } from './HandleRenderer';

export const ShapeRenderer = ({ entity, index, isSelected, selectedPointIndex, onDown, onDeleteShape, assetColor }) => {
    const s = entity;
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

    // Render Shape
    let shapeElement = null;
    if (s.type === 'circle') {
         shapeElement = <ellipse cx={(s.x + s.w / 2) * BASE_SCALE} cy={toSvgY(s.y + s.h / 2) * BASE_SCALE} rx={s.w * BASE_SCALE / 2} ry={s.h * BASE_SCALE / 2} {...style} />;
    } else if (s.type === 'ellipse') {
         shapeElement = <path d={generateEllipsePath(s)} transform={rotateTransform} {...style} />;
    } else {
         shapeElement = <path d={generateSvgPath(s.points)} {...style} />;
    }

    return (
        <g onPointerDown={(e) => onDown(e, index)}>
            {shapeElement}
            {isSelected && <HandleRenderer entity={s} index={index} onDown={onDown} onDeleteShape={onDeleteShape} selectedPointIndex={selectedPointIndex} />}
        </g>
    );
};
