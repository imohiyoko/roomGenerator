# データベースリファクタリング計画書

## 概要
`imohiyoko/roomGenerator` リポジトリのデータ構造をリファクタリングし、型安全性を向上させ、将来的なCADエクスポート機能の実装基盤を整備します。

## 1. 新しい構造体設計 (models.go)

データ構造を `app.go` から `models.go` に分離し、以下の型安全な構造体を定義しました。

```go
package main

// Vec2: 2次元ベクトル
type Vec2 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// Point: 制御点とハンドル
type Point struct {
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
	H1      Vec2    `json:"h1"`
	H2      Vec2    `json:"h2"`
	IsCurve bool    `json:"isCurve"`
}

// Entity: アセットを構成する形状要素（Union Struct）
type Entity struct {
	Type  string `json:"type"`  // "polygon", "circle" など
	Layer string `json:"layer"`
	Color string `json:"color"`

	// Polygon用
	Points []Point `json:"points,omitempty"`

	// Circle/Arc用
	CX         *float64 `json:"cx,omitempty"`
	CY         *float64 `json:"cy,omitempty"`
	RX         *float64 `json:"rx,omitempty"`
	RY         *float64 `json:"ry,omitempty"`
	Rotation   *float64 `json:"rotation,omitempty"`
	StartAngle *float64 `json:"startAngle,omitempty"`
	EndAngle   *float64 `json:"endAngle,omitempty"`
	ArcMode    string   `json:"arcMode,omitempty"`

	// 汎用/Text用
	X *float64 `json:"x,omitempty"`
	Y *float64 `json:"y,omitempty"`
	W *float64 `json:"w,omitempty"`
	H *float64 `json:"h,omitempty"`
	Text     string   `json:"text,omitempty"`
	FontSize *float64 `json:"fontSize,omitempty"`
}

// Asset: アセット定義
type Asset struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Type           string   `json:"type"`
	W              float64  `json:"w"`
	H              float64  `json:"h"`
	Color          string   `json:"color"`
	Entities       []Entity `json:"entities"` // 旧 shapes
	IsDefaultShape bool     `json:"isDefaultShape,omitempty"`
	Snap           bool     `json:"snap,omitempty"`
}

// Instance: 配置インスタンス
type Instance struct {
	ID       string  `json:"id"`
	AssetID  string  `json:"assetId,omitempty"`
	Type     string  `json:"type"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Rotation float64 `json:"rotation"`
	Locked   bool    `json:"locked"`
	Text     string  `json:"text,omitempty"`
	Color    string  `json:"color,omitempty"`
	FontSize *float64 `json:"fontSize,omitempty"`
}

// ProjectData: プロジェクト全体データ
type ProjectData struct {
	LocalAssets []Asset    `json:"assets"`
	Instances   []Instance `json:"instances"`
}
```

## 2. 実装変更点

### app.go の更新
- `models.go` の構造体を利用するように `CreateProject`, `GetProjectData`, `SaveProjectData`, `getDefaultGlobalAssets` を更新しました。
- 旧来の `map[string]interface{}` の使用を廃止（マイグレーションロジック内を除く）しました。

### データマイグレーション戦略 (`GetProjectData`)
既存のプロジェクトファイルを読み込む際、以下の順序で処理を行います：

1. **新フォーマット試行**: `ProjectData` 構造体への Unmarshal を試みます。
2. **正規化 (`normalizeProjectData`)**: 構造体への Unmarshal が成功しても、`Entities` が空の場合（旧 `shapes` キーを使用している場合など）は、内部的にマップ変換を行い、データを補完します。
3. **レガシー配列対応**: 最も古いフォーマットである「インスタンス配列のみのJSON」の場合、それを検出し、デフォルトの空アセットリストを持つ `ProjectData` に変換します。

### データ保存の安全性 (`SaveProjectData`)
フロントエンドから渡されるデータ（`interface{}`）に対し、以下の検証を行います：

1. JSONへのマーシャル
2. `ProjectData` 構造体へのアンマーシャル（ここで構造と型を検証）
3. 検証済みの構造体をファイルに保存

これにより、不正なフィールドや型ミスマッチを含むデータが保存されるのを防ぎます。

## 3. リスクと対策

- **リスク**: フロントエンドが送信するJSON構造とバックエンドの構造体定義に不整合が生じた場合、データが欠落する可能性がある。
- **対策**: `Entity` 構造体に `omitempty` タグを使用し、多様な形状タイプに対応できる柔軟な Union 構造を採用しました。また、保存時に一度構造体を通すことで、スキーマ違反を早期に検知します。

## 4. 今後の展望

- このリファクタリングにより、アセットデータが Go の静的型付けされた構造体として扱えるようになりました。
- これにより、DXFやSVGへのエクスポート処理を実装する際、`Entity.Points` や `Entity.RX/RY` などのフィールドに安全にアクセスでき、計算ロジックの実装が容易になります。
