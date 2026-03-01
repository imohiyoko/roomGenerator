import React from 'react';
import { BASE_SCALE } from '../../lib/constants.js';
import { generateSvgPath, generateEllipsePath, toSvgY, toSvgRotation } from '../../lib/utils.js';

/**
 * エンティティ（シェイプ）のSVGパスを描画します。
 */
export const ShapeRenderer = ({ shape, index, isSelected, assetColor, onDown }) => {
    const style = {
        fill: shape.color || assetColor,
        stroke: isSelected ? "#3b82f6" : "#999",
        strokeWidth: isSelected ? 2 : 1,
        cursor: 'move'
    };

    // Rotation logic (Cartesian CCW -> SVG CW)
    const rot = shape.rotation ? toSvgRotation(shape.rotation) : 0;

    // Rotation Center logic
    let cx_svg = 0, cy_svg = 0;
    if (shape.type === 'ellipse' || shape.type === 'circle' || shape.type === 'arc') {
        cx_svg = (shape.cx !== undefined ? shape.cx : (shape.x + shape.w / 2)) * BASE_SCALE;
        cy_svg = toSvgY(shape.cy !== undefined ? shape.cy : (shape.y + shape.h / 2)) * BASE_SCALE;
    } else {
        cx_svg = ((shape.x || 0) + (shape.w || 0) / 2) * BASE_SCALE;
        cy_svg = toSvgY((shape.y || 0) + (shape.h || 0) / 2) * BASE_SCALE;
    }

    const rotateTransform = rot ? `rotate(${rot} ${cx_svg} ${cy_svg})` : '';

    return (
        <g onPointerDown={(e) => onDown(e, index)}>
            {shape.type === 'circle' ? (
                <ellipse
                    cx={(shape.x + shape.w / 2) * BASE_SCALE}
                    cy={toSvgY(shape.y + shape.h / 2) * BASE_SCALE}
                    rx={shape.w * BASE_SCALE / 2}
                    ry={shape.h * BASE_SCALE / 2}
                    transform={rotateTransform}
                    {...style}
                />
            ) : shape.type === 'ellipse' ? (
                <path d={generateEllipsePath(shape)} transform={rotateTransform} {...style} />
            ) : (
                <path d={generateSvgPath(shape.points)} transform={rotateTransform} {...style} />
            )}
        </g>
    );
};
