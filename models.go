package main

// --- データ構造 ---

// Project はプロジェクトのメタ情報を保持します
type Project struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	UpdatedAt string `json:"updatedAt"`
}

// ProjectData はプロジェクトの中身（アセットと配置）を保持します
type ProjectData struct {
	LocalAssets []map[string]interface{} `json:"assets"`    // この物件専用のアセット定義
	Instances   []map[string]interface{} `json:"instances"` // 配置データ
}
