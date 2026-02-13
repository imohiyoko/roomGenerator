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
type Project struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	UpdatedAt string `json:"updatedAt"`
}

type ProjectData struct {
	LocalAssets []map[string]interface{} `json:"assets"`    // この物件専用のアセット定義
	Instances   []map[string]interface{} `json:"instances"` // 配置データ
}

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
	var assets interface{}
	if err := json.Unmarshal(data, &assets); err != nil {
		return nil, err
	}
	return assets, nil
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
		LocalAssets: []map[string]interface{}{},
		Instances:   []map[string]interface{}{},
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
		return ProjectData{LocalAssets: []map[string]interface{}{}, Instances: []map[string]interface{}{}}, nil
	}

	// 互換性対応: 配列だった場合の処理
	var raw interface{}
	json.Unmarshal(data, &raw)
	if list, ok := raw.([]interface{}); ok {
		instances := make([]map[string]interface{}, len(list))
		for i, v := range list {
			if m, ok := v.(map[string]interface{}); ok {
				instances[i] = m
			}
		}
		return ProjectData{
			LocalAssets: []map[string]interface{}{},
			Instances:   instances,
		}, nil
	}

	var projData ProjectData
	if err := json.Unmarshal(data, &projData); err != nil {
		return ProjectData{}, err
	}
	return projData, nil
}

// SaveProjectData saves project data
func (a *App) SaveProjectData(id string, data interface{}) error {
	projPath := filepath.Join(a.dataDir, fmt.Sprintf("project_%s.json", id))
	// io.ReadAll(r.Body) の代わりに data interface{} を受け取るのでそのまま保存
	// 実際には ProjectData 構造体か map[string]interface{} が渡ってくる想定

	if err := a.saveFile(projPath, data); err != nil {
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
