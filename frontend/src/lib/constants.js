// TODO: BASE_SCALE と SNAP_UNIT を settingsSlice の gridSize / snapInterval から
// 動的に読み込むようにリファクタリングする。現在は以下のハードコード値が
// LayoutCanvas, DesignCanvas, Ruler, assetService, utils 等で直接参照されている。
export const BASE_SCALE = 2.0;
export const SNAP_UNIT = 5;
export const LAYERS = { room: 0, fixture: 1, furniture: 2, text: 3 };
