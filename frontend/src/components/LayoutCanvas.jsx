import React, { useRef, useState, useMemo, useEffect } from 'react';
import { BASE_SCALE, SNAP_UNIT, LAYERS } from '../lib/constants';
import { toMM } from '../lib/utils';
import { RenderAssetShapes } from './SharedRender';

// RenderItem (Pure Component if possible, but we pass props)
const RenderItem = ({ item, isSelected, onDown }) => (
    <g
        transform={`translate(${item.x * BASE_SCALE}, ${item.y * BASE_SCALE}) rotate(${item.rotation})`}
        onPointerDown={e => { e.stopPropagation(); onDown(e, item.id); }}
        className="hover:opacity-90"
        style={{ cursor: 'grab', opacity: isSelected ? 0.85 : 1 }}
    >
        {item.type === 'text' ? (
            <g>
                {isSelected && <rect x="-5" y="-25" width="100" height="35" fill="rgba(59,130,246,0.1)" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4" />}
                <text fill={item.color} fontSize={item.fontSize} fontWeight="bold" style={{ whiteSpace: 'pre', userSelect: 'none' }}>{item.text}</text>
            </g>
        ) : (
            <g>
                <RenderAssetShapes item={item} isSelected={isSelected} />
                {isSelected && (() => {
                    const bx = (item.boundX || 0) * BASE_SCALE;
                    const by = (item.boundY || 0) * BASE_SCALE;
                    return (
                        <g className="pointer-events-none">
                            <text x={bx - 15} y={by - 15} textAnchor="end" fontSize="9" fill="#666" fontWeight="bold">({toMM(item.x)}, {toMM(item.y)})</text>
                            <line x1={bx} y1={by - 10} x2={bx + item.w * BASE_SCALE} y2={by - 10} stroke="blue" strokeWidth="1" />
                            <text x={bx + item.w * BASE_SCALE / 2} y={by - 12} textAnchor="middle" fontSize="10" fill="blue">{toMM(item.w)}mm</text>
                            <line x1={bx - 10} y1={by} x2={bx - 10} y2={by + item.h * BASE_SCALE} stroke="blue" strokeWidth="1" />
                            <text x={bx - 12} y={by + item.h * BASE_SCALE / 2} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="blue">{toMM(item.h)}mm</text>
                            <rect x={bx - 2} y={by - 2} width={item.w * BASE_SCALE + 4} height={item.h * BASE_SCALE + 4} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="6 3" />
                        </g>
                    );
                })()}
                <text x={(item.boundX || 0) * BASE_SCALE + item.w * BASE_SCALE / 2} y={(item.boundY || 0) * BASE_SCALE + item.h * BASE_SCALE / 2} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#333" pointerEvents="none" style={{ userSelect: 'none', textShadow: '0 0 2px white' }}>{item.name}</text>
            </g>
        )}
    </g>
);

export const LayoutCanvas = ({ viewState, setViewState, assets, instances, setInstances, selectedIds, setSelectedIds }) => {
    // Local state for smooth dragging (only committed to store on pointerUp)
    const [localInstances, setLocalInstances] = useState(instances);
    const dragRef = useRef({ isDragging: false, mode: null });
    const svgRef = useRef(null);
    const [marquee, setMarquee] = useState(null);

    // Sync local instances with store when not dragging
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
            // Snapshot for drag delta calculation
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
                    y: (screenY - rect.top - viewState.y) / scale
                });
                const p1 = toWorld(dragRef.current.sx, dragRef.current.sy);
                const p2 = toWorld(e.clientX, e.clientY);
                const minX = Math.min(p1.x, p2.x);
                const maxX = Math.max(p1.x, p2.x);
                const minY = Math.min(p1.y, p2.y);
                const maxY = Math.max(p1.y, p2.y);

                const inBox = localInstances.filter(inst => {
                    const asset = assets.find(a => a.id === inst.assetId);
                    const w = inst.type === 'text' ? 100 : (asset?.w || 0);
                    const h = inst.type === 'text' ? 50 : (asset?.h || 0);
                    const cx = inst.x + w / 2;
                    const cy = inst.y + h / 2;
                    return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
                }).map(i => i.id);

                setSelectedIds([...new Set([...dragRef.current.prevSelectedIds, ...inBox])]);
            }
        } else if (dragRef.current.mode === 'dragging') {
            const wDx = dx / viewState.scale / BASE_SCALE;
            const wDy = dy / viewState.scale / BASE_SCALE;

            // Update LOCAL state for 60fps
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
        // COMMIT to STORE only here
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
