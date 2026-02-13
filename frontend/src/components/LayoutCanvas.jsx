import React, { useRef, useState, useMemo, useEffect } from 'react';
import { BASE_SCALE, SNAP_UNIT, LAYERS } from '../lib/constants';
import { toMM, toSvgY, toCartesianY, toSvgRotation } from '../lib/utils';
import { RenderAssetShapes } from './SharedRender';

// RenderItem (Pure Component if possible, but we pass props)
const RenderItem = ({ item, isSelected, onDown }) => {
    // Transform Item Coordinates (Cartesian) to SVG (Y-down)
    const svgX = item.x * BASE_SCALE;
    const svgY = toSvgY(item.y) * BASE_SCALE;
    const svgRot = item.rotation ? toSvgRotation(item.rotation) : 0; // Flip rotation

    return (
        <g
            transform={`translate(${svgX}, ${svgY}) rotate(${svgRot})`}
            onPointerDown={e => { e.stopPropagation(); onDown(e, item.id); }}
            className="hover:opacity-90"
            style={{ cursor: 'grab', opacity: isSelected ? 0.85 : 1 }}
        >
            {item.type === 'text' ? (
                <g>
                    {/* Text is rendered normally? */}
                    {/* Usually text needs scale(1, -1) to not be upside down if we flipped the whole group.
                        But here we are just positioning the group at flipped Y.
                        The group itself is not flipped (scale is 1, 1).
                        So text renders normally.
                        However, if 'y' coordinate for text baseline is flipped?
                        RenderItem places <text> at (0,0) (local).
                        If item.y is the baseline position.
                        If we want text to appear "upright", we just render text.
                        Selection box: x=-5, y=-25. This is hardcoded relative to (0,0).
                        (0,0) is the anchor.
                    */}
                    {isSelected && <rect x="-5" y="-25" width="100" height="35" fill="rgba(59,130,246,0.1)" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4" />}
                    <text fill={item.color} fontSize={item.fontSize} fontWeight="bold" style={{ whiteSpace: 'pre', userSelect: 'none' }}>{item.text}</text>
                </g>
            ) : (
                <g>
                    <RenderAssetShapes item={item} isSelected={isSelected} />
                    {isSelected && (() => {
                        // Cartesian Bounds relative to Asset Origin
                        const bx = (item.boundX || 0);
                        const by = (item.boundY || 0);
                        const w = item.w;
                        const h = item.h;

                        // SVG Bounds (Local)
                        // bx_svg = bx * SCALE
                        // by_svg (Bottom) = toSvgY(by) * SCALE
                        // top_svg = toSvgY(by + h) * SCALE

                        const bx_s = bx * BASE_SCALE;
                        const bottom_s = toSvgY(by) * BASE_SCALE;
                        const top_s = toSvgY(by + h) * BASE_SCALE;
                        const w_s = w * BASE_SCALE;
                        const h_s = h * BASE_SCALE; // Distance is positive

                        // Note: top_s is numerically smaller than bottom_s (higher up).

                        return (
                            <g className="pointer-events-none">
                                {/* Coordinates Text: Display Cartesian */}
                                {/* Place it slightly above the object (SVG Y < top_s) */}
                                <text x={bx_s - 15} y={top_s - 15} textAnchor="end" fontSize="9" fill="#666" fontWeight="bold">({toMM(item.x)}, {toMM(item.y)})</text>

                                {/* Width Dimension Line (Above top edge) */}
                                <line x1={bx_s} y1={top_s - 10} x2={bx_s + w_s} y2={top_s - 10} stroke="blue" strokeWidth="1" />
                                <text x={bx_s + w_s / 2} y={top_s - 12} textAnchor="middle" fontSize="10" fill="blue">{toMM(w)}mm</text>

                                {/* Height Dimension Line (Left side) */}
                                <line x1={bx_s - 10} y1={top_s} x2={bx_s - 10} y2={bottom_s} stroke="blue" strokeWidth="1" />
                                <text x={bx_s - 12} y={top_s + h_s / 2} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="blue">{toMM(h)}mm</text>

                                {/* Bounding Box Rect */}
                                {/* x=bx_s, y=top_s (Top-Left), width=w_s, height=h_s */}
                                <rect x={bx_s - 2} y={top_s - 2} width={w_s + 4} height={h_s + 4} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6 3" />
                            </g>
                        );
                    })()}
                    {/* Name Label: Center of object */}
                    {/* Center Y (Cartesian) = by + h/2 */}
                    {/* Center Y (SVG) = toSvgY(by + h/2) */}
                    <text x={(item.boundX || 0) * BASE_SCALE + item.w * BASE_SCALE / 2}
                          y={toSvgY((item.boundY || 0) + item.h / 2) * BASE_SCALE}
                          textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#333" pointerEvents="none" style={{ userSelect: 'none', textShadow: '0 0 2px white' }}>
                        {item.name}
                    </text>
                </g>
            )}
        </g>
    );
};

export const LayoutCanvas = ({ viewState, setViewState, assets, instances, setInstances, selectedIds, setSelectedIds }) => {
    const [localInstances, setLocalInstances] = useState(instances);
    const dragRef = useRef({ isDragging: false, mode: null });
    const svgRef = useRef(null);
    const [marquee, setMarquee] = useState(null);

    useEffect(() => {
        if (!dragRef.current.isDragging) {
            setLocalInstances(instances);
        }
    }, [instances]);

    const handleDown = (e, id) => {
        if (e.button !== 0 && e.button !== 1) return;
        if (svgRef.current && e.pointerId) {
            try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        }

        const isPan = e.button === 1;
        const isMarquee = (id === null && e.button === 0);

        let targetIds = [];
        if (id) {
            if (e.ctrlKey || e.metaKey) {
                if (selectedIds.includes(id)) {
                    targetIds = selectedIds.filter(x => x !== id);
                } else {
                    targetIds = [...selectedIds, id];
                }
                setSelectedIds(targetIds);
            } else if (selectedIds.includes(id)) {
                targetIds = [...selectedIds];
            } else {
                targetIds = [id];
                setSelectedIds([id]);
            }
        } else if (!isMarquee) {
            setSelectedIds([]);
        }

        if (isMarquee) {
            setMarquee({ sx: e.clientX, sy: e.clientY, ex: e.clientX, ey: e.clientY });
            if (!e.ctrlKey && !e.metaKey) setSelectedIds([]);
        }

        dragRef.current = {
            isDragging: true,
            mode: isPan ? 'panning' : (isMarquee ? 'marquee' : (id ? 'dragging' : null)),
            sx: e.clientX, sy: e.clientY,
            vx: viewState.x, vy: viewState.y,
            items: localInstances.map(i => ({ ...i })),
            targetIds: targetIds,
            prevSelectedIds: e.ctrlKey || e.metaKey ? [...selectedIds] : []
        };

        if (!isPan && id) {
            const hasUnlocked = targetIds.some(tid => {
                const t = localInstances.find(i => i.id === tid);
                return t && !t.locked;
            });
            if (!hasUnlocked) {
                dragRef.current.isDragging = false;
                dragRef.current.mode = null;
            }
        }

        if (id) e.stopPropagation();
        e.preventDefault();
    };

    const handleMove = (e) => {
        if (!dragRef.current.isDragging) return;
        e.preventDefault();
        const dx = e.clientX - dragRef.current.sx;
        const dy = e.clientY - dragRef.current.sy;

        if (dragRef.current.mode === 'panning') {
            setViewState(p => ({ ...p, x: dragRef.current.vx + dx, y: dragRef.current.vy + dy }));
        } else if (dragRef.current.mode === 'marquee') {
            setMarquee(prev => prev ? { ...prev, ex: e.clientX, ey: e.clientY } : null);
            if (svgRef.current) {
                const rect = svgRef.current.getBoundingClientRect();
                const scale = viewState.scale * BASE_SCALE;
                const toWorld = (screenX, screenY) => ({
                    x: (screenX - rect.left - viewState.x) / scale,
                    y: toCartesianY((screenY - rect.top - viewState.y) / scale) // Convert to Cartesian
                });
                const p1 = toWorld(dragRef.current.sx, dragRef.current.sy);
                const p2 = toWorld(e.clientX, e.clientY);
                const minX = Math.min(p1.x, p2.x);
                const maxX = Math.max(p1.x, p2.x);
                // Cartesian Bounds
                const minY = Math.min(p1.y, p2.y);
                const maxY = Math.max(p1.y, p2.y);

                const inBox = localInstances.filter(inst => {
                    // Check intersection in Cartesian space
                    const asset = assets.find(a => a.id === inst.assetId);
                    const w = inst.type === 'text' ? 100 : (asset?.w || 0);
                    const h = inst.type === 'text' ? 50 : (asset?.h || 0);

                    // Instance Origin (Bottom-Left in Cartesian) = inst.x, inst.y
                    // Center
                    const cx = inst.x + w / 2;
                    const cy = inst.y + h / 2;
                    return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
                }).map(i => i.id);

                setSelectedIds([...new Set([...dragRef.current.prevSelectedIds, ...inBox])]);
            }
        } else if (dragRef.current.mode === 'dragging') {
            const wDx = dx / viewState.scale / BASE_SCALE;
            const wDySvg = dy / viewState.scale / BASE_SCALE;
            const wDy = toCartesianY(wDySvg); // Flip Y delta

            setLocalInstances(prev => prev.map(inst => {
                if (dragRef.current.targetIds?.includes(inst.id) && !inst.locked) {
                    const org = dragRef.current.items.find(i => i.id === inst.id);
                    if (!org) return inst;
                    const asset = assets.find(a => a.id === inst.assetId);
                    let nx = org.x + wDx;
                    let ny = org.y + wDy;
                    if (inst.type !== 'text' && asset?.snap && inst.rotation % 90 === 0 && !e.shiftKey) {
                        nx = Math.round(nx / SNAP_UNIT) * SNAP_UNIT;
                        ny = Math.round(ny / SNAP_UNIT) * SNAP_UNIT;
                    }
                    return { ...inst, x: nx, y: ny };
                }
                return inst;
            }));
        }
    };

    const handleUp = () => {
        if (dragRef.current.mode === 'dragging') {
            setInstances(localInstances);
        }

        setMarquee(null);
        dragRef.current = { isDragging: false, mode: null, targetIds: [] };
    };

    const sortedItems = useMemo(() => {
        return localInstances.map(inst => {
            if (inst.type === 'text') return { ...inst, z: 99 };
            const asset = assets.find(a => a.id === inst.assetId);
            return asset ? { ...inst, ...asset, id: inst.id, z: LAYERS[asset.type] } : null;
        }).filter(Boolean).sort((a, b) => {
            const aSelected = selectedIds.includes(a.id) ? 1000 : 0;
            const bSelected = selectedIds.includes(b.id) ? 1000 : 0;
            return (a.z + aSelected) - (b.z + bSelected);
        });
    }, [localInstances, assets, selectedIds]);

    return (
        <div className="w-full h-full absolute top-0 left-0 z-20 overflow-auto canvas-scroll pt-5 pl-5" onPointerDown={e => handleDown(e, null)} onPointerMove={handleMove} onPointerUp={handleUp} ref={svgRef}>
            <svg width="3000" height="3000" style={{ minWidth: '3000px', minHeight: '3000px' }}>
                <g transform={`translate(${viewState.x}, ${viewState.y}) scale(${viewState.scale})`}>
                    <line x1="-5000" y1="0" x2="5000" y2="0" stroke="#ddd" strokeWidth="2" />
                    <line x1="0" y1="-5000" x2="0" y2="5000" stroke="#ddd" strokeWidth="2" />
                    {sortedItems.map(item => <RenderItem key={item.id} item={item} isSelected={selectedIds.includes(item.id)} onDown={handleDown} />)}
                </g>
            </svg>
            {marquee && (
                <div
                    style={{
                        position: 'fixed',
                        left: Math.min(marquee.sx, marquee.ex),
                        top: Math.min(marquee.sy, marquee.ey),
                        width: Math.abs(marquee.ex - marquee.sx),
                        height: Math.abs(marquee.ey - marquee.sy),
                        border: '2px dashed #3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        pointerEvents: 'none',
                        zIndex: 9999
                    }}
                />
            )}
        </div>
    );
};
