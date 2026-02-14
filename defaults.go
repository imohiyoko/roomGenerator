package main

// --- 初期データ生成ロジック ---

func getDefaultGlobalAssets() []map[string]interface{} {
	// ヘルパー：矩形ポイントを生成
	createRect := func(w, h int) []interface{} {
		return []interface{}{
			map[string]interface{}{"x": 0, "y": 0, "h1": map[string]int{"x": 0, "y": 0}, "h2": map[string]int{"x": 0, "y": 0}, "isCurve": false},
			map[string]interface{}{"x": w, "y": 0, "h1": map[string]int{"x": 0, "y": 0}, "h2": map[string]int{"x": 0, "y": 0}, "isCurve": false},
			map[string]interface{}{"x": w, "y": h, "h1": map[string]int{"x": 0, "y": 0}, "h2": map[string]int{"x": 0, "y": 0}, "isCurve": false},
			map[string]interface{}{"x": 0, "y": h, "h1": map[string]int{"x": 0, "y": 0}, "h2": map[string]int{"x": 0, "y": 0}, "isCurve": false},
		}
	}

	// ヘルパー：多角形アセットを生成（wとhは頂点座標から決定）
	createPolygonAsset := func(id, name, typ string, w, h int, color string, snap bool) map[string]interface{} {
		return map[string]interface{}{
			"id": id, "name": name, "type": typ, "w": w, "h": h, "color": color, "snap": snap,
			"isDefaultShape": true, // デフォルト形状としてマーク
			"entities": []interface{}{
				map[string]interface{}{
					"type":   "polygon",
					"points": createRect(w, h),
					"color":  color,
					"layer":  "default",
				},
			},
		}
	}

	assets := []map[string]interface{}{
		// --- 部屋 ---
		createPolygonAsset("a_room6", "洋室 (6畳)", "room", 360, 270, "#fdfcdc", true),
		createPolygonAsset("a_ldk10", "LDK (10畳)", "room", 360, 450, "#fffbf0", true),
		createPolygonAsset("a_ent", "玄関ホール", "room", 135, 135, "#f0e68c", true),
		createPolygonAsset("a_toilet", "トイレ (0.4坪)", "room", 90, 135, "#e6e6fa", true),
		createPolygonAsset("a_bath", "浴室 (1坪)", "room", 160, 160, "#b0e0e6", true),
		createPolygonAsset("a_balcony", "ベランダ", "room", 360, 90, "#d3d3d3", true),

		// --- 設備 ---
		createPolygonAsset("a_kitchen", "キッチン(2100)", "fixture", 210, 65, "#cccccc", true),
		createPolygonAsset("a_pan", "防水パン", "fixture", 64, 64, "#ffffff", true),
		createPolygonAsset("a_door", "ドア(片開)", "fixture", 80, 5, "#8b4513", true),
		createPolygonAsset("a_window", "窓(掃出し)", "fixture", 180, 5, "#87ceeb", true),

		// --- 家具 ---
		createPolygonAsset("a_bed_s", "ベッド(S)", "furniture", 100, 200, "#8fbc8f", true),
		createPolygonAsset("a_sofa2", "ソファ(2人)", "furniture", 160, 90, "#f4a460", true),
		createPolygonAsset("a_table4", "食卓(140)", "furniture", 140, 80, "#8b4513", true),
		createPolygonAsset("a_tvboard", "TVボード", "furniture", 150, 45, "#deb887", true),
		createPolygonAsset("a_fridge", "冷蔵庫", "furniture", 60, 65, "#aaddff", true),
		createPolygonAsset("a_drum", "ドラム式", "furniture", 64, 60, "#dcdcdc", true),
		createPolygonAsset("a_chair", "椅子", "furniture", 45, 45, "#cd853f", false),
	}

	return assets
}
