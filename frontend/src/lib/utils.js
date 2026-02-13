import { BASE_SCALE } from './constants.js';

export const toMM = (val) => Math.round(val * 10);
export const fromMM = (val) => val / 10;

// 座標系変換 (デカルト Y-Up <-> SVG Y-Down)
// SVGの原点は左上 (Yは下に増加)。デカルト座標の原点は左下 (Yは上に増加)。
// 描画のために、デカルト座標のYをSVGのYに符号反転してマッピングします。
// 注: これは、他の場所で相対変換やセンタリング（例: viewStateの移動）が適用されることを前提としています。
export const toSvgY = (y) => -y;
export const toCartesianY = (y) => -y;
export const toSvgRotation = (deg) => -deg;
export const toCartesianRotation = (deg) => -deg;
export const toSvgAngle = (deg) => -deg;
export const toCartesianAngle = (deg) => -deg;

export const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    return JSON.parse(JSON.stringify(obj));
};

export const createRectPath = (w, h, x = 0, y = 0) => [
    { x: x, y: y, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },
    { x: x + w, y: y, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },
    { x: x + w, y: y + h, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },
    { x: x, y: y + h, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },
];

export const createTrianglePath = (w, h, x = 0, y = 0) => [
    { x: x + w / 2, y: y + h, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false }, // Top vertex
    { x: x + w, y: y, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },     // Bottom Right
    { x: x, y: y, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false },         // Bottom Left
];

export const normalizeAsset = (asset) => {
    if (!asset) return null;
    let entities = asset.entities || asset.shapes || []; // Fallback to shapes for migration
    if (entities.length === 0) {
        if (asset.shape === 'rect' || !asset.shape) {
            entities.push({ type: 'polygon', points: createRectPath(asset.w || 60, asset.h || 60), color: asset.color, layer: 'default' });
        } else if (asset.shape === 'polygon' && asset.points) {
            const pts = asset.points.map(p => ({ x: p.x, y: p.y, h1: { x: 0, y: 0 }, h2: { x: 0, y: 0 }, isCurve: false }));
            entities.push({ type: 'polygon', points: pts, color: asset.color, layer: 'default' });
        } else if (asset.shape === 'circle') {
            entities.push({ type: 'circle', x: 0, y: 0, w: asset.w || 60, h: asset.h || 60, color: asset.color, layer: 'default' });
        }
    }
    // Remove old 'shapes' if moving to entities, but for now just ensure entities is populated
    // We return 'entities' property.
    return { ...asset, entities, shapes: undefined, w: asset.w || 60, h: asset.h || 60 };
};

// SVGパス生成（デカルト -> SVG座標変換付き）
// Y軸の反転を処理
export const generateSvgPath = (points) => {
    if (!points || points.length === 0) return "";

    const tx = (x) => x * BASE_SCALE;
    const ty = (y) => toSvgY(y) * BASE_SCALE;

    let d = `M ${tx(points[0].x)} ${ty(points[0].y)}`;
    for (let i = 0; i < points.length; i++) {
        const curr = points[i];
        const next = points[(i + 1) % points.length];
        const handles = curr.handles || [];

        if (handles.length === 0) {
            if (curr.isCurve || next.isCurve) {
                // Legacy curve support
                const cp1x = tx(curr.x + (curr.h2?.x || 0));
                const cp1y = ty(curr.y + (curr.h2?.y || 0));
                const cp2x = tx(next.x + (next.h1?.x || 0));
                const cp2y = ty(next.y + (next.h1?.y || 0));
                d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${tx(next.x)} ${ty(next.y)}`;
            } else {
                d += ` L ${tx(next.x)} ${ty(next.y)}`;
            }
        } else if (handles.length === 1) {
            const h = handles[0];
            d += ` Q ${tx(h.x)} ${ty(h.y)}, ${tx(next.x)} ${ty(next.y)}`;
        } else if (handles.length === 2) {
            const h1 = handles[0];
            const h2 = handles[1];
            d += ` C ${tx(h1.x)} ${ty(h1.y)}, ${tx(h2.x)} ${ty(h2.y)}, ${tx(next.x)} ${ty(next.y)}`;
        } else {
            const step = 1 / handles.length;
            let lastX = curr.x, lastY = curr.y;
            for (let j = 0; j < handles.length; j++) {
                const h = handles[j];
                const t = (j + 1) * step;
                const endX = curr.x + (next.x - curr.x) * t;
                const endY = curr.y + (next.y - curr.y) * t;
                d += ` Q ${tx(h.x)} ${ty(h.y)}, ${tx(endX)} ${ty(endY)}`;
                lastX = endX; lastY = endY;
            }
            if (Math.abs(lastX - next.x) > 0.01 || Math.abs(lastY - next.y) > 0.01) {
                d += ` L ${tx(next.x)} ${ty(next.y)}`;
            }
        }
    }
    d += " Z";
    return d;
};

// 楕円/円弧パスの生成（デカルト -> SVG座標変換付き）
export const generateEllipsePath = (shape) => {
    // デカルト座標の入力
    const { cx = 0, cy = 0, rx = 50, ry = 50, startAngle = 0, endAngle = 360, arcMode = 'sector', rotation = 0 } = shape;

    // SVG座標へ変換
    const cxs = cx * BASE_SCALE;
    const cys = toSvgY(cy) * BASE_SCALE;
    const rxs = Math.abs(rx * BASE_SCALE); // SVGエラーを防ぐための絶対値半径
    const rys = Math.abs(ry * BASE_SCALE);

    // 角度: デカルト座標では反時計回り(CCW)に増加。SVG(Y-Down)では時計回り(CW)に増加。
    // 見た目を一致させるため: angle_svg = -angle_cartesian。
    // ただし、0度はどちらも東を指します。
    // Y反転を用いた標準的な数学を使用します。
    // x = cx + rx * cos(theta)
    // y_cart = cy + ry * sin(theta)
    // y_svg = -y_cart = -cy - ry * sin(theta) = cys - rys * sin(theta)

    // SVGパスの 'A' コマンドはローカル座標系です。
    // 理想的には、SVG空間での始点/終点を計算します。

    // デカルト座標での始点/終点角度（東からCCW）
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    // SVG空間で直接始点/終点を計算
    // P_svg = (cx, -cy) + (rx * cos(-theta), ry * sin(-theta))  <-- ryは半径なので常に正
    // y_svg = -y_cart = - (cy + ry * sin(theta)) = -cy - ry * sin(theta).
    // これは 中心(cx, -cy) + 半径(rx, ry) 角度(-theta) と等価です。
    // したがって、-startAngle と -endAngle を使用します。

    const svgStartAngle = -startAngle;
    const svgEndAngle = -endAngle;

    // 円弧計算のために角度を正規化
    // 注: SVGの円弧は始点から終点へ向かいます。
    // -0 から -360 (CW) へ移動する場合、SVG (CW) の 0 から 360 と同じです。
    // デカルト座標の 0 -> 90 (CCW) は SVGの 0 -> -90 (見た目上CCW、または360->270) となります。

    const startRadSvg = (svgStartAngle * Math.PI) / 180;
    const endRadSvg = (svgEndAngle * Math.PI) / 180;

    const x1 = cxs + rxs * Math.cos(startRadSvg);
    const y1 = cys + rys * Math.sin(startRadSvg);
    const x2 = cxs + rxs * Math.cos(endRadSvg);
    const y2 = cys + rys * Math.sin(endRadSvg);

    // 完全な楕円のチェック
    const angleDiff = Math.abs(endAngle - startAngle); // 角度の絶対差分
    if (angleDiff >= 360) {
        return `M ${cxs - rxs} ${cys} A ${rxs} ${rys} 0 1 1 ${cxs + rxs} ${cys} A ${rxs} ${rys} 0 1 1 ${cxs - rxs} ${cys}`;
    }

    // 大円弧フラグ
    // SVGでは、角度 > 180 の場合、large-arc-flag は 1
    const largeArc = angleDiff > 180 ? 1 : 0;

    // スイープフラグ
    // デカルト座標: 始点 -> 終点は CCW
    // SVG角度: -始点 -> -終点
    // 例: Start=0, End=90。SVG: 0 -> -90。Delta = -90。
    // これは標準数学では「負」のスイープですが、SVGの sweep-flag=0 は CCW（負の角度方向）、sweep-flag=1 は CW です。
    // 待って: SVG 'A' コマンド: sweep-flag=1 は「正の角度方向」（SVG Y-down では時計回り）を意味します。
    // Start(0) から End(90 Cartesian) へ描画したい。
    // SVG座標で: (r, 0) から (0, -r) へ。
    // (r,0) から (0,-r) へ「右上」象限を通って移動する場合、スクリーン空間では CCW に移動しています。
    // SVG (Y-down) では、(1,0) -> (0,-1) の移動は...
    // (1,0) は右。(0,-1) は上。
    // 右 -> 上 は CCW (反時計回り)。
    // SVG標準では、角度は CW (右 -> 下) に増加します。
    // したがって、*負*の角度方向に移動しています。
    // よって sweep-flag は 0 であるべきです。

    const sweepFlag = 0; // デカルト座標の正の角度方向はCCW

    if (arcMode === 'sector') {
        return `M ${cxs} ${cys} L ${x1} ${y1} A ${rxs} ${rys} 0 ${largeArc} ${sweepFlag} ${x2} ${y2} Z`;
    } else {
        return `M ${x1} ${y1} A ${rxs} ${rys} 0 ${largeArc} ${sweepFlag} ${x2} ${y2} Z`;
    }
};

export const getClientPos = (e, viewState, svgRect) => {
    const cx = e.clientX - svgRect.left;
    const cy = e.clientY - svgRect.top;
    const x = (cx - viewState.x) / viewState.scale / BASE_SCALE;
    const ySvg = (cy - viewState.y) / viewState.scale / BASE_SCALE;
    // SVGのYをデカルト座標のYに変換
    const y = toCartesianY(ySvg);
    return { x, y };
};



export const calculateAssetBounds = (asset) => {
    if (!asset || !asset.entities || asset.entities.length === 0) {
        return { boundX: 0, boundY: 0, w: asset.w || 0, h: asset.h || 0 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    asset.entities.forEach(entity => {
        const bounds = getRotatedAABB(entity);
        if (bounds.minX < minX) minX = bounds.minX;
        if (bounds.maxX > maxX) maxX = bounds.maxX;
        if (bounds.minY < minY) minY = bounds.minY;
        if (bounds.maxY > maxY) maxY = bounds.maxY;
    });

    if (minX === Infinity) return { boundX: 0, boundY: 0, w: asset.w, h: asset.h };
    return {
        boundX: Math.round(minX),
        boundY: Math.round(minY),
        w: Math.round(maxX - minX),
        h: Math.round(maxY - minY)
    };
};

// getRotatedAABBを円弧/セクター対応でオーバーライド
export const getRotatedAABB = (entity) => {
    const rotation = entity.rotation || 0;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // 中心（ピボット）を決定
    let cx, cy;
    if (entity.type === 'ellipse' || entity.type === 'circle' || entity.type === 'arc') {
        cx = entity.cx !== undefined ? entity.cx : ((entity.x || 0) + (entity.w || 0) / 2);
        cy = entity.cy !== undefined ? entity.cy : ((entity.y || 0) + (entity.h || 0) / 2);
    } else {
        cx = (entity.x || 0) + (entity.w || 0) / 2;
        cy = (entity.y || 0) + (entity.h || 0) / 2;
    }

    // ケース1: 楕円 / 円 / 円弧 / セクター
    if (entity.type === 'ellipse' || entity.type === 'circle' || entity.type === 'arc') {
        const rx = Math.abs(entity.rx !== undefined ? entity.rx : (entity.w / 2));
        const ry = Math.abs(entity.ry !== undefined ? entity.ry : (entity.h / 2));

        // 開始/終了角度がない、または完全な円の場合の楕円ロジック
        const startAngle = entity.startAngle !== undefined ? entity.startAngle : 0;
        const endAngle = entity.endAngle !== undefined ? entity.endAngle : 360;
        const arcMode = entity.arcMode || 'sector';

        // チェック用に角度を[0, 360)に正規化
        let sDeg = startAngle % 360;
        if (sDeg < 0) sDeg += 360;
        let eDeg = endAngle % 360;
        if (eDeg < 0) eDeg += 360;

        if (Math.abs(endAngle - startAngle) >= 360) {
            // 完全な楕円の公式
            const halfW = Math.sqrt(Math.pow(rx * cos, 2) + Math.pow(ry * sin, 2));
            const halfH = Math.sqrt(Math.pow(rx * sin, 2) + Math.pow(ry * cos, 2));
            return {
                minX: cx - halfW, maxX: cx + halfW,
                minY: cy - halfH, maxY: cy + halfH,
                width: halfW * 2, height: halfH * 2
            };
        }

        // 部分的な楕円（円弧/セクター）のロジック
        // [startRad, endRad]の範囲内でx(t)とy(t)の極値を求める必要があります。
        // x(t) = cx + rx cos(t) cos(rot) - ry sin(t) sin(rot)
        // y(t) = cy + rx cos(t) sin(rot) + ry sin(t) cos(rot)

        // 入力角度をラジアンに変換
        const sRad = (startAngle * Math.PI) / 180;
        const eRad = (endAngle * Math.PI) / 180;

        // チェックする点: 始点、終点、中心（セクターの場合）、および局所的な極値。
        let points = [];

        // 始点と終点
        const getPoint = (theta) => ({
            x: cx + rx * Math.cos(theta) * cos - ry * Math.sin(theta) * sin,
            y: cy + rx * Math.cos(theta) * sin + ry * Math.sin(theta) * cos
        });

        points.push(getPoint(sRad));
        points.push(getPoint(eRad));

        if (arcMode === 'sector') {
            points.push({ x: cx, y: cy });
        }

        // [0, 2PI)の範囲で極値パラメータ't'を見つける
        // 角度't'(ラジアン)が実質的に[startAngle, endAngle](度)の範囲内にあるかを確認するヘルパー
        // 't'を度数法[0, 360)に正規化し、sDeg, eDegと比較します。
        const inRange = (tRad) => {
            let tDeg = (tRad * 180 / Math.PI) % 360;
            if (tDeg < 0) tDeg += 360;

            // 方向の確認: start -> end (CCW)
            // s < e の場合: s <= t <= e
            // s > e の場合: s <= t または t <= e (wrapping)
            if (sDeg < eDeg) {
                return tDeg >= sDeg && tDeg <= eDeg;
            } else {
                return tDeg >= sDeg || tDeg <= eDeg;
            }
        };

        // Xの極値
        // tan(t) = - (ry sin(rot)) / (rx cos(rot))
        const tanTx = - (ry * sin) / (rx * cos);
        const tx1 = Math.atan(tanTx);
        const tx2 = tx1 + Math.PI;

        if (inRange(tx1)) points.push(getPoint(tx1));
        if (inRange(tx2)) points.push(getPoint(tx2));

        // Yの極値
        // tan(t) = (ry cos(rot)) / (rx sin(rot))
        const tanTy = (ry * cos) / (rx * sin);
        const ty1 = Math.atan(tanTy);
        const ty2 = ty1 + Math.PI;

        if (inRange(ty1)) points.push(getPoint(ty1));
        if (inRange(ty2)) points.push(getPoint(ty2));

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        const minX = Math.min(...xs); const maxX = Math.max(...xs);
        const minY = Math.min(...ys); const maxY = Math.max(...ys);

        return {
            minX, maxX, minY, maxY,
            width: maxX - minX, height: maxY - minY
        };
    }

    // ケース2: ポリゴン / 短形（頂点回転）
    let points = [];
    if (entity.type === 'polygon' && entity.points) {
        points = entity.points;
    } else {
        // 短形のために4つの角の点を作成
        const x = entity.x || 0; const y = entity.y || 0;
        const w = entity.w || 0; const h = entity.h || 0;
        points = [{x, y}, {x: x+w, y}, {x: x+w, y: y+h}, {x, y: y+h}];
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
        // 点pをcx, cyを中心に回転（デカルト座標CCW）
        const dx = p.x - cx;
        const dy = p.y - cy;
        const rx = dx * cos - dy * sin + cx;
        const ry = dx * sin + dy * cos + cy;
        if (rx < minX) minX = rx; if (rx > maxX) maxX = rx;
        if (ry < minY) minY = ry; if (ry > maxY) maxY = ry;
    });

    return {
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX,
        height: maxY - minY
    };
};

export const shiftEntity = (entity, dx, dy) => {
    let ns = { ...entity };
    if (ns.x !== undefined) ns.x += dx;
    if (ns.y !== undefined) ns.y += dy;
    if (ns.cx !== undefined) ns.cx += dx;
    if (ns.cy !== undefined) ns.cy += dy;
    if (ns.points) {
        ns.points = ns.points.map(p => {
            let np = { ...p, x: p.x + dx, y: p.y + dy };
            if (p.handles) {
                np.handles = p.handles.map(h => ({ x: h.x + dx, y: h.y + dy }));
            }
            return np;
        });
    }
    return ns;
};
