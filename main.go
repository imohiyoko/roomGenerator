package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"time"
)

// --- 設定 ---
const PORT = ":8080"
const DATA_DIR_NAME = "data"
const LOG_FILE = "app.log"

//go:embed public/*
var staticFiles embed.FS

// --- データ構造 ---
type Project struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	UpdatedAt string `json:"updatedAt"`
}

// プロジェクトファイルの構造
type ProjectData struct {
	LocalAssets []map[string]interface{} `json:"assets"`    // この物件専用のアセット定義
	Instances   []map[string]interface{} `json:"instances"` // 配置データ
}

// エラーレスポンス
type APIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
}

var mu sync.Mutex
var logFile *os.File

// ログを標準出力とファイルに出力
func logInfo(format string, v ...interface{}) {
	msg := fmt.Sprintf(format, v...)
	fmt.Println("[INFO]", msg)
	if logFile != nil {
		fmt.Fprintf(logFile, "[%s] [INFO] %s\n", time.Now().Format("2006-01-02 15:04:05"), msg)
		logFile.Sync()
	}
}

func logError(format string, v ...interface{}) {
	msg := fmt.Sprintf(format, v...)
	fmt.Println("[ERROR]", msg)
	if logFile != nil {
		fmt.Fprintf(logFile, "[%s] [ERROR] %s\n", time.Now().Format("2006-01-02 15:04:05"), msg)
		logFile.Sync()
	}
}

func main() {
	cwd, err := os.Getwd()
	if err != nil {
		cwd = "."
	}
	dataDir := filepath.Join(cwd, DATA_DIR_NAME)

	// ログファイル初期化
	var logErr error
	logFile, logErr = os.OpenFile(LOG_FILE, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if logErr != nil {
		fmt.Printf("ログファイルを開けません: %v\n", logErr)
	} else {
		defer logFile.Close()
	}

	logInfo("=== アプリケーション起動 ===")

	if _, err := os.Stat(dataDir); os.IsNotExist(err) {
		if err := os.Mkdir(dataDir, 0755); err != nil {
			logError("dataディレクトリ作成失敗: %v", err)
			fmt.Printf("エラー: %v\n", err)
		}
		logInfo("dataディレクトリを作成しました")
	}

	// global_assets.json が存在しない場合は自動生成
	globalAssetsPath := filepath.Join(dataDir, "global_assets.json")
	if _, err := os.Stat(globalAssetsPath); os.IsNotExist(err) {
		defaultAssets := getDefaultGlobalAssets()
		if err := saveFile(globalAssetsPath, defaultAssets); err != nil {
			logError("global_assets.json 初期化失敗: %v", err)
		} else {
			logInfo("global_assets.json を初期化しました")
		}
	}

	mux := http.NewServeMux()

	publicFS, err := fs.Sub(staticFiles, "public")
	if err != nil {
		logError("publicファイルシステム読み込み失敗: %v", err)
		panic(err)
	}

	// SPA ルーティング: /library へのアクセスも index.html を返す
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// APIリクエストはスキップ
		if len(r.URL.Path) >= 4 && r.URL.Path[:4] == "/api" {
			http.NotFound(w, r)
			return
		}
		// /library パスは index.html を返す
		if r.URL.Path == "/library" || r.URL.Path == "/library/" {
			data, _ := fs.ReadFile(publicFS, "index.html")
			w.Header().Set("Content-Type", "text/html")
			w.Write(data)
			return
		}
		// その他は通常の静的ファイルサーバー
		http.FileServer(http.FS(publicFS)).ServeHTTP(w, r)
	})

	mux.HandleFunc("/api/assets", func(w http.ResponseWriter, r *http.Request) {
		logInfo("[%s] /api/assets", r.Method)
		handleAssets(w, r, dataDir)
	})
	mux.HandleFunc("/api/palette", func(w http.ResponseWriter, r *http.Request) {
		logInfo("[%s] /api/palette", r.Method)
		handlePalette(w, r, dataDir)
	})
	mux.HandleFunc("/api/projects", func(w http.ResponseWriter, r *http.Request) {
		logInfo("[%s] /api/projects", r.Method)
		handleProjects(w, r, dataDir)
	})
	mux.HandleFunc("/api/projects/", func(w http.ResponseWriter, r *http.Request) {
		logInfo("[%s] /api/projects/...", r.Method)
		handleProjectDetail(w, r, dataDir)
	})

	url := "http://localhost" + PORT
	fmt.Println("-------------------------------------------------------")
	fmt.Printf(" 間取りアーキテクト Pro を起動しました。\n")
	fmt.Printf(" 自動的にブラウザが開きます... %s\n", url)
	fmt.Printf(" ログファイル: %s\n", LOG_FILE)
	fmt.Println("-------------------------------------------------------")

	openBrowser(url)

	logInfo("HTTPサーバー開始: %s", url)
	if err := http.ListenAndServe(PORT, mux); err != nil {
		logError("HTTPサーバーエラー: %v", err)
	}
}

// --- ハンドラ関数 ---

func handleAssets(w http.ResponseWriter, r *http.Request, dataDir string) {
	filePath := filepath.Join(dataDir, "global_assets.json")
	if r.Method == http.MethodGet {
		data, err := loadJSON(filePath)
		if err != nil {
			logInfo("global_assets.json が見つかりません。デフォルトデータを返します")
			respondJSON(w, http.StatusOK, getDefaultGlobalAssets())
			return
		}
		// ファイルから読んだ場合も APIResponse 形式で返す
		var assets interface{}
		json.Unmarshal(data, &assets)
		respondJSON(w, http.StatusOK, assets)
	} else if r.Method == http.MethodPost {
		body, _ := io.ReadAll(r.Body)
		mu.Lock()
		if err := os.WriteFile(filePath, body, 0644); err != nil {
			mu.Unlock()
			logError("グローバルアセット保存失敗: %v", err)
			respondError(w, http.StatusInternalServerError, 500, "アセット保存に失敗しました")
			return
		}
		mu.Unlock()
		logInfo("グローバルアセットを保存しました")
		respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

func handlePalette(w http.ResponseWriter, r *http.Request, dataDir string) {
	filePath := filepath.Join(dataDir, "palette.json")
	defaultColors := []string{
		"#f43f5e", "#fb923c", "#facc15", "#4ade80", "#22d3d8",
		"#3b82f6", "#8b5cf6", "#ec4899", "#78716c", "#1e293b",
		"#ffffff", "#fdfcdc", "#fffbf0", "#f0e68c", "#e6e6fa",
		"#b0e0e6", "#d3d3d3", "#cccccc", "#8b4513", "#87ceeb",
	}

	if r.Method == http.MethodGet {
		data, err := loadJSON(filePath)
		if err != nil {
			logInfo("palette.json が見つかりません。デフォルトカラーを返します")
			respondJSON(w, http.StatusOK, map[string]interface{}{"colors": defaultColors})
			return
		}
		var palette interface{}
		json.Unmarshal(data, &palette)
		respondJSON(w, http.StatusOK, palette)
	} else if r.Method == http.MethodPost {
		body, _ := io.ReadAll(r.Body)
		mu.Lock()
		if err := os.WriteFile(filePath, body, 0644); err != nil {
			mu.Unlock()
			logError("パレット保存失敗: %v", err)
			respondError(w, http.StatusInternalServerError, 500, "パレット保存に失敗しました")
			return
		}
		mu.Unlock()
		logInfo("カラーパレットを保存しました")
		respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

func handleProjects(w http.ResponseWriter, r *http.Request, dataDir string) {
	filePath := filepath.Join(dataDir, "projects_index.json")
	if r.Method == http.MethodGet {
		data, err := loadJSON(filePath)
		if err != nil {
			logInfo("プロジェクト一覧が見つかりません")
			respondJSON(w, http.StatusOK, []Project{})
			return
		}
		// ファイルから読んだ場合も APIResponse 形式で返す
		var projects []Project
		json.Unmarshal(data, &projects)
		respondJSON(w, http.StatusOK, projects)
	} else if r.Method == http.MethodPost {
		var newProj Project
		if err := json.NewDecoder(r.Body).Decode(&newProj); err != nil {
			logError("プロジェクト作成: JSON デコード失敗: %v", err)
			respondError(w, http.StatusBadRequest, 400, "無効なJSONです")
			return
		}
		newProj.ID = fmt.Sprintf("%d", time.Now().UnixNano())
		newProj.UpdatedAt = time.Now().Format(time.RFC3339)

		projects := []Project{}
		data, _ := loadJSON(filePath)
		json.Unmarshal(data, &projects)
		projects = append(projects, newProj)

		if err := saveFile(filePath, projects); err != nil {
			logError("プロジェクト一覧保存失敗: %v", err)
			respondError(w, http.StatusInternalServerError, 500, "プロジェクト保存に失敗しました")
			return
		}

		// 新規プロジェクト作成
		projPath := filepath.Join(dataDir, fmt.Sprintf("project_%s.json", newProj.ID))
		initialData := ProjectData{
			LocalAssets: []map[string]interface{}{},
			Instances:   []map[string]interface{}{},
		}
		if err := saveFile(projPath, initialData); err != nil {
			logError("プロジェクトファイル作成失敗: %v", err)
			respondError(w, http.StatusInternalServerError, 500, "プロジェクトファイル作成に失敗しました")
			return
		}

		logInfo("プロジェクト作成: %s (ID: %s)", newProj.Name, newProj.ID)
		respondJSON(w, http.StatusOK, newProj)
	}
}

func handleProjectDetail(w http.ResponseWriter, r *http.Request, dataDir string) {
	id := r.URL.Path[len("/api/projects/"):]
	if id == "" {
		logError("プロジェクト詳細: ID が指定されていません")
		respondError(w, http.StatusBadRequest, 400, "ID が指定されていません")
		return
	}
	projPath := filepath.Join(dataDir, fmt.Sprintf("project_%s.json", id))
	indexPath := filepath.Join(dataDir, "projects_index.json")

	switch r.Method {
	case http.MethodGet:
		data, err := loadJSON(projPath)
		if err != nil {
			logInfo("プロジェクトファイルが見つかりません: %s", id)
			respondJSON(w, http.StatusOK, ProjectData{LocalAssets: []map[string]interface{}{}, Instances: []map[string]interface{}{}})
			return
		}
		// 互換性対応
		var raw interface{}
		json.Unmarshal(data, &raw)
		if list, ok := raw.([]interface{}); ok {
			instances := make([]map[string]interface{}, len(list))
			for i, v := range list {
				if m, ok := v.(map[string]interface{}); ok {
					instances[i] = m
				}
			}
			respondJSON(w, http.StatusOK, ProjectData{
				LocalAssets: []map[string]interface{}{},
				Instances:   instances,
			})
			return
		}
		// ファイルから読んだ場合も APIResponse 形式で返す
		var projData ProjectData
		json.Unmarshal(data, &projData)
		respondJSON(w, http.StatusOK, projData)

	case http.MethodPut:
		body, _ := io.ReadAll(r.Body)
		mu.Lock()
		if err := os.WriteFile(projPath, body, 0644); err != nil {
			mu.Unlock()
			logError("プロジェクト保存失敗 (ID: %s): %v", id, err)
			respondError(w, http.StatusInternalServerError, 500, "プロジェクト保存に失敗しました")
			return
		}
		mu.Unlock()
		logInfo("プロジェクト保存: %s", id)
		respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})

	case http.MethodDelete:
		projects := []Project{}
		data, _ := loadJSON(indexPath)
		json.Unmarshal(data, &projects)
		newProjects := []Project{}
		for _, p := range projects {
			if p.ID != id {
				newProjects = append(newProjects, p)
			}
		}
		if err := saveFile(indexPath, newProjects); err != nil {
			logError("プロジェクト削除失敗 (ID: %s): %v", id, err)
			respondError(w, http.StatusInternalServerError, 500, "プロジェクト削除に失敗しました")
			return
		}
		if err := os.Remove(projPath); err != nil && !os.IsNotExist(err) {
			logError("プロジェクトファイル削除失敗 (ID: %s): %v", id, err)
		}
		logInfo("プロジェクト削除: %s", id)
		respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})

	case http.MethodPatch:
		var req Project
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			logError("プロジェクト更新: JSON デコード失敗: %v", err)
			respondError(w, http.StatusBadRequest, 400, "無効なJSONです")
			return
		}
		projects := []Project{}
		data, _ := loadJSON(indexPath)
		json.Unmarshal(data, &projects)
		for i, p := range projects {
			if p.ID == id {
				projects[i].Name = req.Name
				projects[i].UpdatedAt = time.Now().Format(time.RFC3339)
			}
		}
		if err := saveFile(indexPath, projects); err != nil {
			logError("プロジェクト名更新失敗 (ID: %s): %v", id, err)
			respondError(w, http.StatusInternalServerError, 500, "プロジェクト更新に失敗しました")
			return
		}
		logInfo("プロジェクト更新: %s", id)
		respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
	}
}

// --- ヘルパー関数 ---

func loadJSON(path string) ([]byte, error) {
	mu.Lock()
	defer mu.Unlock()
	return os.ReadFile(path)
}

func saveFile(path string, data interface{}) error {
	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	mu.Lock()
	defer mu.Unlock()
	return os.WriteFile(path, bytes, 0644)
}

func respondJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(&APIResponse{
		Success: true,
		Data:    data,
	})
}

func respondError(w http.ResponseWriter, statusCode int, errorCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(&APIResponse{
		Success: false,
		Error: &APIError{
			Code:    errorCode,
			Message: message,
		},
	})
}

func jsonResponse(w http.ResponseWriter, data interface{}) {
	respondJSON(w, http.StatusOK, data)
}

func openBrowser(url string) {
	var err error
	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	}
	if err != nil {
		fmt.Printf("ブラウザを開けませんでした: %v\n", err)
	}
}

// ★修正: v6対応の初期データ生成
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
			"shapes": []interface{}{
				map[string]interface{}{
					"type":   "polygon",
					"points": createRect(w, h),
					"color":  color,
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
