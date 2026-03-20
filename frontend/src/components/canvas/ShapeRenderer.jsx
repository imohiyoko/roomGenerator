import React from 'react';
import { BASE_SCALE } from '../../lib/constants';
import { generateSvgPath, generateEllipsePath, toSvgY } from '../../lib/utils';

/**
 * Renders an individual shape (entity).
 *
 * @param {Object} props - The component props.
 * @param {Object} props.shape - The entity data.
 * @param {string} props.assetColor - Fallback color from the asset.
 * @param {boolean} props.isSelected - Whether the shape is currently selected.
 * @param {string} props.rotateTransform - The SVG rotate transform string.
 * @returns {JSX.Element} The rendered shape path.
 */
export const ShapeRenderer = ({ shape, assetColor, isSelected, rotateTransform }) => {
    const style = {
        fill: shape.color || assetColor,
        stroke: isSelected ? "#3b82f6" : "#999",
        strokeWidth: isSelected ? 2 : 1,
        cursor: 'move'
    };

    if (shape.type === 'circle') {
        return (
            <ellipse
                cx={(shape.x + shape.w / 2) * BASE_SCALE}
                cy={toSvgY(shape.y + shape.h / 2) * BASE_SCALE}
                rx={shape.w * BASE_SCALE / 2}
                ry={shape.h * BASE_SCALE / 2}
                {...style}
            />
        );
    }

    if (shape.type === 'ellipse') {
        return (
            <path
                d={generateEllipsePath(shape)}
                transform={rotateTransform}
                {...style}
            />
        );
    }

    // Default to polygon/rect
    return (
        <path
            d={generateSvgPath(shape.points)}
            {...style}
        />
    );
};
