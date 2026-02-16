package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// --- 設定 ---
const DATA_DIR_NAME = "data"
const LOG_FILE = "app.log"

// --- データ構造 ---
// 構造体は models.go に定義されています。
// Project, ProjectData, Asset, Instance, Entity, Point, Vec2

// App struct
type App struct {
	ctx     context.Context
	dataDir string
	mu      sync.Mutex
	logFile *os.File
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// カレントディレクトリの取得
	cwd, err := os.Getwd()
	if err != nil {
		cwd = "."
	}
	a.dataDir = filepath.Join(cwd, DATA_DIR_NAME)

	// ログファイル初期化
	var logErr error
	a.logFile, logErr = os.OpenFile(LOG_FILE, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if logErr != nil {
		fmt.Printf("ログファイルを開けません: %v\n", logErr)
	}

	a.logInfo("=== アプリケーション起動 ===")

	if _, err := os.Stat(a.dataDir); os.IsNotExist(err) {
		if err := os.Mkdir(a.dataDir, 0755); err != nil {
			a.logError("dataディレクトリ作成失敗: %v", err)
		} else {
			a.logInfo("dataディレクトリを作成しました")
		}
	}

	// global_assets.json が存在しない場合は自動生成
	globalAssetsPath := filepath.Join(a.dataDir, "global_assets.json")
	if _, err := os.Stat(globalAssetsPath); os.IsNotExist(err) {
		defaultAssets := getDefaultGlobalAssets()
		if err := a.saveFile(globalAssetsPath, defaultAssets); err != nil {
			a.logError("global_assets.json 初期化失敗: %v", err)
		} else {
			a.logInfo("global_assets.json を初期化しました")
		}
	}
}

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {
	if a.logFile != nil {
		a.logFile.Close()
	}
}

// ログ出力
func (a *App) logInfo(format string, v ...interface{}) {
	msg := fmt.Sprintf(format, v...)
	fmt.Println("[INFO]", msg)
	if a.logFile != nil {
		fmt.Fprintf(a.logFile, "[%s] [INFO] %s\n", time.Now().Format("2006-01-02 15:04:05"), msg)
		a.logFile.Sync()
	}
}

func (a *App) logError(format string, v ...interface{}) {
	msg := fmt.Sprintf(format, v...)
	fmt.Println("[ERROR]", msg)
	if a.logFile != nil {
		fmt.Fprintf(a.logFile, "[%s] [ERROR] %s\n", time.Now().Format("2006-01-02 15:04:05"), msg)
		a.logFile.Sync()
	}
}

// ヘルパー：ファイル保存
func (a *App) saveFile(path string, data interface{}) error {
	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	return os.WriteFile(path, bytes, 0644)
}

// ヘルパー：ファイル読み込み
func (a *App) loadJSON(path string) ([]byte, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return os.ReadFile(path)
}

// --- API Methods ---

// GetAssets returns global assets
func (a *App) GetAssets() (interface{}, error) {
	filePath := filepath.Join(a.dataDir, "global_assets.json")
	data, err := a.loadJSON(filePath)
	if err != nil {
		a.logInfo("global_assets.json が見つかりません。デフォルトデータを返します")
		return getDefaultGlobalAssets(), nil
	}

	// 1. まず構造体への直接変換を試みる（新フォーマットならロスレス）
	var assets []Asset
	if err := json.Unmarshal(data, &assets); err == nil {
		// レガシー "shapes" キーの場合、Entities が空になるためチェック
		needsMigration := false
		for _, a := range assets {
			if len(a.Entities) == 0 {
				needsMigration = true
				break
			}
		}
		if !needsMigration {
			return assets, nil
		}
	}

	// 2. レガシーデータ: マップ経由でマイグレーション（shapes → entities 変換）
	var rawAssets []map[string]interface{}
	if err := json.Unmarshal(data, &rawAssets); err != nil {
		return nil, err
	}
	return migrateAssets(rawAssets), nil
}

// SaveAssets saves global assets
func (a *App) SaveAssets(assets interface{}) error {
	filePath := filepath.Join(a.dataDir, "global_assets.json")
	if err := a.saveFile(filePath, assets); err != nil {
		a.logError("グローバルアセット保存失敗: %v", err)
		return err
	}
	a.logInfo("グローバルアセットを保存しました")
	return nil
}

// GetPalette returns color palette
func (a *App) GetPalette() (interface{}, error) {
	filePath := filepath.Join(a.dataDir, "palette.json")
	defaultColors := []string{
		"#f43f5e", "#fb923c", "#facc15", "#4ade80", "#22d3d8",
		"#3b82f6", "#8b5cf6", "#ec4899", "#78716c", "#1e293b",
		"#ffffff", "#fdfcdc", "#fffbf0", "#f0e68c", "#e6e6fa",
		"#b0e0e6", "#d3d3d3", "#cccccc", "#8b4513", "#87ceeb",
	}
	defaultTypeColors := map[string]string{
		"room":      "#fdfcdc",
		"furniture": "#8fbc8f",
		"fixture":   "#cccccc",
	}

	data, err := a.loadJSON(filePath)
	if err != nil {
		// palette.jsonが存在しない場合、作成してデフォルトを返す
		a.logInfo("palette.json が見つかりません。デフォルトカラーを作成します")
		defaultData := map[string]interface{}{
			"colors":   defaultColors,
			"defaults": defaultTypeColors,
		}
		if err := a.saveFile(filePath, defaultData); err != nil {
			a.logError("palette.json 作成失敗: %v", err)
		}
		return defaultData, nil
	}

	var palette map[string]interface{}
	if err := json.Unmarshal(data, &palette); err != nil {
		return nil, err
	}

	return palette, nil
}

// SavePalette saves color palette
func (a *App) SavePalette(palette interface{}) error {
	filePath := filepath.Join(a.dataDir, "palette.json")
	if err := a.saveFile(filePath, palette); err != nil {
		a.logError("パレット保存失敗: %v", err)
		return err
	}
	a.logInfo("カラーパレットを保存しました")
	return nil
}

// GetProjects returns list of projects
func (a *App) GetProjects() ([]Project, error) {
	filePath := filepath.Join(a.dataDir, "projects_index.json")
	data, err := a.loadJSON(filePath)
	if err != nil {
		a.logInfo("プロジェクト一覧が見つかりません")
		return []Project{}, nil
	}
	var projects []Project
	if err := json.Unmarshal(data, &projects); err != nil {
		return []Project{}, nil
	}
	return projects, nil
}

// CreateProject creates a new project
func (a *App) CreateProject(name string) (*Project, error) {
	filePath := filepath.Join(a.dataDir, "projects_index.json")

	newProj := Project{
		ID:        fmt.Sprintf("%d", time.Now().UnixNano()),
		Name:      name,
		UpdatedAt: time.Now().Format(time.RFC3339),
	}

	projects := []Project{}
	data, _ := a.loadJSON(filePath) // 無視して良い（ファイルがない場合は空リスト）
	json.Unmarshal(data, &projects)
	projects = append(projects, newProj)

	if err := a.saveFile(filePath, projects); err != nil {
		a.logError("プロジェクト一覧保存失敗: %v", err)
		return nil, err
	}

	// 新規プロジェクトファイル作成
	projPath := filepath.Join(a.dataDir, fmt.Sprintf("project_%s.json", newProj.ID))
	initialData := ProjectData{
		LocalAssets: []Asset{},
		Instances:   []Instance{},
	}
	if err := a.saveFile(projPath, initialData); err != nil {
		a.logError("プロジェクトファイル作成失敗: %v", err)
		return nil, err
	}

	a.logInfo("プロジェクト作成: %s (ID: %s)", newProj.Name, newProj.ID)
	return &newProj, nil
}

// GetProjectData returns project details
func (a *App) GetProjectData(id string) (ProjectData, error) {
	if id == "" {
		return ProjectData{}, fmt.Errorf("ID is empty")
	}
	projPath := filepath.Join(a.dataDir, fmt.Sprintf("project_%s.json", id))

	data, err := a.loadJSON(projPath)
	if err != nil {
		a.logInfo("プロジェクトファイルが見つかりません: %s", id)
		return ProjectData{LocalAssets: []Asset{}, Instances: []Instance{}}, nil
	}

	// 1. 新しい構造体への変換を試みる
	var projData ProjectData
	if err := json.Unmarshal(data, &projData); err == nil {
		// アンマーシャルが成功した場合でも、入力JSONが 'shapes' (旧キー) を使用していると
		// 'Entities' が空になる可能性があるため確認が必要。
		// json.Unmarshal は不明なフィールドを無視するため、レガシーデータの場合
		// projData.Entities は空になる。データが存在するか確認する。
		return normalizeProjectData(projData, data), nil
	}

	// 2. 互換性対応: 配列形式の場合 (非常に古いレガシーデータ)
	var raw interface{}
	json.Unmarshal(data, &raw)
	if list, ok := raw.([]interface{}); ok {
		instances := make([]Instance, len(list))
		for i, v := range list {
			if m, ok := v.(map[string]interface{}); ok {
				instances[i] = mapInstance(m)
			}
		}
		return ProjectData{
			LocalAssets: []Asset{},
			Instances:   instances,
		}, nil
	}

	return ProjectData{}, fmt.Errorf("failed to parse project data")
}

// normalizeProjectData は読み込まれたJSONが部分的にレガシーであってもデータを完全に構築します
func normalizeProjectData(p ProjectData, rawData []byte) ProjectData {
	// Entitiesが存在すれば、新しいフォーマットか既に正規化済みとみなす。
	// しかし "shapes" キーが存在するが "entities" が存在しない場合を処理する必要がある。
	// json.Unmarshal(struct) は不明なフィールドをスキップするため、生のJSONを検査するかマップを使用する。

	// レガシーフィールドを確認するためにマップにデコード
	var rawMap map[string]interface{}
	json.Unmarshal(rawData, &rawMap)

	// LocalAssets を確認
	if rawAssets, ok := rawMap["assets"].([]interface{}); ok {
		// 構造体のUnmarshalがEntitiesを埋めるのに失敗した場合（例："shapes"キーのため）、再処理を行う
		// 全アセットをチェック（一部だけレガシーの場合にも対応）
		needsMigration := len(p.LocalAssets) != len(rawAssets)
		if !needsMigration {
			for _, a := range p.LocalAssets {
				if len(a.Entities) == 0 {
					needsMigration = true
					break
				}
			}
		}
		if needsMigration {
			p.LocalAssets = migrateAssets(convertToMapList(rawAssets))
		} else {
			rawList := convertToMapList(rawAssets)
			for i, a := range p.LocalAssets {
				if len(a.Entities) == 0 && i < len(rawList) {
					p.LocalAssets[i] = mapAsset(rawList[i])
				}
			}
		}
	}

	return p
}

// []interface{} を []map[string]interface{} に変換するヘルパー
func convertToMapList(list []interface{}) []map[string]interface{} {
	res := make([]map[string]interface{}, len(list))
	for i, v := range list {
		if m, ok := v.(map[string]interface{}); ok {
			res[i] = m
		}
	}
	return res
}

// マイグレーションロジック: レガシーなマップベースのアセットを []Asset に変換
func migrateAssets(legacy []map[string]interface{}) []Asset {
	res := make([]Asset, len(legacy))
	for i, m := range legacy {
		res[i] = mapAsset(m)
	}
	return res
}

// 単一のレガシーアセットマップを Asset 構造体にマッピング
func mapAsset(m map[string]interface{}) Asset {
	a := Asset{
		ID:             getString(m, "id"),
		Name:           getString(m, "name"),
		Type:           getString(m, "type"),
		W:              getFloat(m, "w"),
		H:              getFloat(m, "h"),
		Color:          getString(m, "color"),
		IsDefaultShape: getBool(m, "isDefaultShape"),
		Snap:           getBool(m, "snap"),
	}

	// boundX/boundY を保持
	if v, ok := m["boundX"]; ok { val := getFloatVal(v); a.BoundX = &val }
	if v, ok := m["boundY"]; ok { val := getFloatVal(v); a.BoundY = &val }

	// Handle entities/shapes
	var shapes []interface{}
	if entities, ok := m["entities"].([]interface{}); ok {
		shapes = entities
	} else if s, ok := m["shapes"].([]interface{}); ok {
		shapes = s
	}

	if shapes != nil {
		a.Entities = make([]Entity, len(shapes))
		for j, s := range shapes {
			if sm, ok := s.(map[string]interface{}); ok {
				a.Entities[j] = mapEntity(sm)
			}
		}
	} else {
		a.Entities = []Entity{}
	}
	return a
}

// 単一のレガシーエンティティマップを Entity 構造体にマッピング
func mapEntity(m map[string]interface{}) Entity {
	e := Entity{
		Type:  getString(m, "type"),
		Layer: getString(m, "layer"),
		Color: getString(m, "color"),
	}
	if e.Layer == "" {
		e.Layer = "default"
	}

	// Points
	if pts, ok := m["points"].([]interface{}); ok {
		e.Points = make([]Point, len(pts))
		for k, p := range pts {
			if pm, ok := p.(map[string]interface{}); ok {
				e.Points[k] = mapPoint(pm)
			}
		}
	}

	// Circle/Arc props
	if v, ok := m["cx"]; ok {
		val := getFloatVal(v)
		e.CX = &val
	}
	if v, ok := m["cy"]; ok {
		val := getFloatVal(v)
		e.CY = &val
	}
	if v, ok := m["rx"]; ok {
		val := getFloatVal(v)
		e.RX = &val
	}
	if v, ok := m["ry"]; ok {
		val := getFloatVal(v)
		e.RY = &val
	}
	if v, ok := m["rotation"]; ok {
		val := getFloatVal(v)
		e.Rotation = &val
	}
	if v, ok := m["startAngle"]; ok {
		val := getFloatVal(v)
		e.StartAngle = &val
	}
	if v, ok := m["endAngle"]; ok {
		val := getFloatVal(v)
		e.EndAngle = &val
	}
	e.ArcMode = getString(m, "arcMode")

	// Rect/Generic props
	if v, ok := m["x"]; ok {
		val := getFloatVal(v)
		e.X = &val
	}
	if v, ok := m["y"]; ok {
		val := getFloatVal(v)
		e.Y = &val
	}
	if v, ok := m["w"]; ok {
		val := getFloatVal(v)
		e.W = &val
	}
	if v, ok := m["h"]; ok {
		val := getFloatVal(v)
		e.H = &val
	}

	// Text
	e.Text = getString(m, "text")
	if v, ok := m["fontSize"]; ok {
		val := getFloatVal(v)
		e.FontSize = &val
	}

	return e
}

func mapPoint(m map[string]interface{}) Point {
	p := Point{
		X:       getFloat(m, "x"),
		Y:       getFloat(m, "y"),
		IsCurve: getBool(m, "isCurve"),
	}
	if h1, ok := m["h1"].(map[string]interface{}); ok {
		p.H1 = Vec2{X: getFloat(h1, "x"), Y: getFloat(h1, "y")}
	}
	if h2, ok := m["h2"].(map[string]interface{}); ok {
		p.H2 = Vec2{X: getFloat(h2, "x"), Y: getFloat(h2, "y")}
	}
	if handles, ok := m["handles"].([]interface{}); ok {
		p.Handles = make([]Vec2, len(handles))
		for i, h := range handles {
			if hm, ok := h.(map[string]interface{}); ok {
				p.Handles[i] = Vec2{X: getFloat(hm, "x"), Y: getFloat(hm, "y")}
			}
		}
	}
	return p
}

func mapInstance(m map[string]interface{}) Instance {
	inst := Instance{
		ID:       getString(m, "id"),
		AssetID:  getString(m, "assetId"),
		Type:     getString(m, "type"),
		X:        getFloat(m, "x"),
		Y:        getFloat(m, "y"),
		Rotation: getFloat(m, "rotation"),
		Locked:   getBool(m, "locked"),
		Text:     getString(m, "text"),
		Color:    getString(m, "color"),
	}
	if v, ok := m["fontSize"]; ok {
		val := getFloatVal(v)
		inst.FontSize = &val
	}
	return inst
}

// Type conversion helpers
func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getFloat(m map[string]interface{}, key string) float64 {
	return getFloatVal(m[key])
}

func getFloatVal(v interface{}) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case int:
		return float64(n)
	case float32:
		return float64(n)
	}
	return 0
}

func getBool(m map[string]interface{}, key string) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return false
}

// SaveProjectData saves project data
func (a *App) SaveProjectData(id string, data interface{}) error {
	projPath := filepath.Join(a.dataDir, fmt.Sprintf("project_%s.json", id))

	// データ検証: 受け取ったデータをJSON化してProjectData構造体にマッピングできるか確認
	bytes, err := json.Marshal(data)
	if err != nil {
		a.logError("プロジェクト保存失敗(JSON化エラー) (ID: %s): %v", id, err)
		return err
	}

	var projData ProjectData
	if err := json.Unmarshal(bytes, &projData); err != nil {
		a.logError("プロジェクト保存失敗(構造体不整合) (ID: %s): %v", id, err)
		return fmt.Errorf("invalid project data structure: %v", err)
	}

	// レガシーの "shapes" キーを持つデータをマイグレーション
	projData = normalizeProjectData(projData, bytes)

	// 検証済みのデータを保存 (元のdataを使うか、構造体を通したデータを使うか)
	// 構造体を通すことで不正なフィールドを除外できるため、projDataを保存する
	if err := a.saveFile(projPath, projData); err != nil {
		a.logError("プロジェクト保存失敗 (ID: %s): %v", id, err)
		return err
	}
	a.logInfo("プロジェクト保存: %s", id)
	return nil
}

// DeleteProject deletes a project
func (a *App) DeleteProject(id string) error {
	indexPath := filepath.Join(a.dataDir, "projects_index.json")
	projPath := filepath.Join(a.dataDir, fmt.Sprintf("project_%s.json", id))

	projects := []Project{}
	data, _ := a.loadJSON(indexPath)
	json.Unmarshal(data, &projects)

	newProjects := []Project{}
	for _, p := range projects {
		if p.ID != id {
			newProjects = append(newProjects, p)
		}
	}

	if err := a.saveFile(indexPath, newProjects); err != nil {
		a.logError("プロジェクト削除失敗 (ID: %s): %v", id, err)
		return err
	}

	if err := os.Remove(projPath); err != nil && !os.IsNotExist(err) {
		a.logError("プロジェクトファイル削除失敗 (ID: %s): %v", id, err)
		// インデックスからは消えたのでエラーはログに残すのみにするか、エラーとして返すか。
		// ここではエラーログを出して終了とする
	}
	a.logInfo("プロジェクト削除: %s", id)
	return nil
}

// UpdateProjectName updates project name
func (a *App) UpdateProjectName(id string, name string) error {
	indexPath := filepath.Join(a.dataDir, "projects_index.json")

	projects := []Project{}
	data, _ := a.loadJSON(indexPath)
	json.Unmarshal(data, &projects)

	for i, p := range projects {
		if p.ID == id {
			projects[i].Name = name
			projects[i].UpdatedAt = time.Now().Format(time.RFC3339)
		}
	}

	if err := a.saveFile(indexPath, projects); err != nil {
		a.logError("プロジェクト名更新失敗 (ID: %s): %v", id, err)
		return err
	}
	a.logInfo("プロジェクト更新: %s", id)
	return nil
}

// ExportProject exports project data as JSON string
func (a *App) ExportProject(id string) (string, error) {
	data, err := a.GetProjectData(id)
	if err != nil {
		return "", err
	}
	bytes, err := json.Marshal(data)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// ImportProject imports project from JSON string and creates new project
func (a *App) ImportProject(name string, jsonData string) (*Project, error) {
	var projData ProjectData
	if err := json.Unmarshal([]byte(jsonData), &projData); err != nil {
		return nil, fmt.Errorf("invalid project data: %v", err)
	}

	// Create new project entry
	newProj, err := a.CreateProject(name)
	if err != nil {
		return nil, err
	}

	// Save the imported data to the new project
	if err := a.SaveProjectData(newProj.ID, projData); err != nil {
		// Cleanup if save fails
		a.DeleteProject(newProj.ID)
		return nil, err
	}

	return newProj, nil
}

// ExportGlobalAssets exports global assets as JSON string
func (a *App) ExportGlobalAssets() (string, error) {
	assetsRaw, err := a.GetAssets()
	if err != nil {
		return "", err
	}
	bytes, err := json.Marshal(assetsRaw)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// ImportGlobalAssets imports global assets from JSON string
func (a *App) ImportGlobalAssets(jsonData string, mergeMode bool) error {
	var newAssets []Asset
	// Try parsing as []Asset first
	if err := json.Unmarshal([]byte(jsonData), &newAssets); err != nil {
		// Fallback: try parsing as []map[string]interface{} and migrate
		var rawMaps []map[string]interface{}
		if err2 := json.Unmarshal([]byte(jsonData), &rawMaps); err2 != nil {
			return fmt.Errorf("failed to parse assets: %v", err)
		}
		newAssets = migrateAssets(rawMaps)
	} else {
		// Check if migration is needed (legacy "shapes" key parsed as empty Entities)
		needsMigration := false
		for _, a := range newAssets {
			if len(a.Entities) == 0 {
				needsMigration = true
				break
			}
		}
		if needsMigration {
			var rawMaps []map[string]interface{}
			if err := json.Unmarshal([]byte(jsonData), &rawMaps); err == nil {
				newAssets = migrateAssets(rawMaps)
			}
		}
	}


	if !mergeMode {
		return a.SaveAssets(newAssets)
	}

	// Merge mode
	currentRaw, err := a.GetAssets()
	if err != nil {
		return err
	}

	// Safe type assertion as GetAssets always returns []Asset
	currentAssets, ok := currentRaw.([]Asset)
	if !ok {
		return fmt.Errorf("internal error: failed to cast current assets")
	}

	// Create map of existing assets for easy update
	assetMap := make(map[string]int)
	for i, asset := range currentAssets {
		assetMap[asset.ID] = i
	}

	// Merge
	for _, newAsset := range newAssets {
		if idx, exists := assetMap[newAsset.ID]; exists {
			// Update existing
			currentAssets[idx] = newAsset
		} else {
			// Append new
			currentAssets = append(currentAssets, newAsset)
			assetMap[newAsset.ID] = len(currentAssets) - 1
		}
	}

	return a.SaveAssets(currentAssets)
}

// --- 初期データ生成ロジック ---

func getDefaultGlobalAssets() []Asset {
	// ヘルパー：矩形ポイントを生成
	createRect := func(w, h float64) []Point {
		return []Point{
			{X: 0, Y: 0, H1: Vec2{0, 0}, H2: Vec2{0, 0}, IsCurve: false},
			{X: w, Y: 0, H1: Vec2{0, 0}, H2: Vec2{0, 0}, IsCurve: false},
			{X: w, Y: h, H1: Vec2{0, 0}, H2: Vec2{0, 0}, IsCurve: false},
			{X: 0, Y: h, H1: Vec2{0, 0}, H2: Vec2{0, 0}, IsCurve: false},
		}
	}

	// ヘルパー：多角形アセットを生成（wとhは頂点座標から決定）
	createPolygonAsset := func(id, name, typ string, w, h float64, color string, snap bool) Asset {
		return Asset{
			ID:             id,
			Name:           name,
			Type:           typ,
			W:              w,
			H:              h,
			Color:          color,
			Snap:           snap,
			IsDefaultShape: true,
			Entities: []Entity{
				{
					Type:   "polygon",
					Points: createRect(w, h),
					Color:  color,
					Layer:  "default",
				},
			},
		}
	}

	assets := []Asset{
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
