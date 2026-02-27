# Room Generator システム分析とリファクタリング計画

このドキュメントは、Room Generator アプリケーションの現状のシステム構造、データフロー、主要コンポーネントを整理し、将来的なリファクタリングと機能拡張のためのガイドラインを提供するものです。

## 1. URLと画面構成

アプリケーションは `React Router (HashRouter)` を使用しており、以下のルートが定義されています。

| URL | コンポーネント | 説明 |
| :--- | :--- | :--- |
| `/` | `Home` | プロジェクト一覧、新規作成、インポート機能を提供するランディングページ。 |
| `/library` | `Library` | グローバルアセット（家具、設備など）の管理画面。アセットの追加・編集・削除が可能。 |
| `/project/:id` | `Editor` | メインのエディタ画面。レイアウトモードとパーツ設計モードを切り替えて操作する。 |
| `/settings` | `Settings` | アプリケーション全体の設定（グリッドサイズ、スナップ設定など）。 |

## 2. コンポーネント構造 (主要部分)

### Editor (`frontend/src/pages/Editor.jsx`)
エディタ画面は、サイドバー、キャンバス、プロパティパネルの3カラム構成です。

*   **Header**: 共通ヘッダー（Undo/Redo、設定ボタン）。
*   **Left Sidebar (`UnifiedSidebar`)**:
    *   **Layout Mode**: アセットライブラリからのドラッグ&ドロップ、インスタンス一覧。
    *   **Design Mode**: アセットのパーツ構成（レイヤー）、新規パーツ追加。
*   **Canvas Area**:
    *   **LayoutCanvas**: 部屋の配置、家具の配置を行うキャンバス。
    *   **DesignCanvas**: 個々のアセット（家具など）の形状を編集するキャンバス。
    *   **Ruler**: 目盛り表示。
*   **Right Sidebar (`Properties`)**:
    *   **LayoutProperties**: 選択されたインスタンスのプロパティ（位置、回転、サイズ）。
    *   **DesignProperties**: 選択されたパーツ（形状）のプロパティ（頂点、サイズ、色）。

## 3. データフローと状態管理

状態管理には `Zustand` を使用しており、`frontend/src/store/index.js` で複数のスライスを結合しています。

### ストアの構成 (`frontend/src/store/`)

| スライス | ファイル | 管理するデータ |
| :--- | :--- | :--- |
| **Project** | `projectSlice.js` | プロジェクトID、ロード/保存ロジック、デフォルトカラー。 |
| **Asset** | `assetSlice.js` | `localAssets` (プロジェクト内)、`globalAssets` (アプリ共通)、パレット。 |
| **Instance** | `instanceSlice.js` | `instances` (キャンバスに配置された家具や部屋の実体)。 |
| **UI** | `uiSlice.js` | 選択状態 (`selectedIds`, `selectedShapeIndices`)、モード (`mode`)、サイドバー開閉状態。 |
| **Settings** | `settingsSlice.js` | グリッド設定、自動保存間隔など。 |

### データの永続化
*   **自動保存**: `useAutoSave` フックにより、変更があった場合に `API.saveProjectData` を呼び出してバックエンドに保存。
*   **Undo/Redo**: `zundo` (temporal middleware) を使用して履歴管理。UI状態や設定は履歴から除外。

### バックエンド (Go/Wails)
*   **App struct**: ファイルシステムへの読み書きを担当。
*   **データモデル**: `models.go` に定義。
*   **マイグレーション**: レガシーデータ（`shapes` キーなど）の読み込み時に `normalizeProjectData` で現行形式（`entities`）に変換。

## 4. 座標系と変換ロジック

本システムでは、SVGの描画座標系（Y-Down）と、設計上の座標系（Cartesian Y-Up）が混在しており、変換が必要です。

### 座標系
1.  **SVG座標系 (Screen/View)**:
    *   原点: 左上
    *   Y軸: 下向き（正）
    *   回転: 時計回り（正）
    *   使用箇所: `<svg>` 描画、マウスイベント (`DesignCanvas.jsx`, `LayoutCanvas.jsx`)

2.  **Cartesian座標系 (World/Model)**:
    *   原点: 左下（概念的）または中心
    *   Y軸: 上向き（正）
    *   回転: 反時計回り（正）
    *   使用箇所: 内部データ構造 (`Instance.x`, `Instance.y`, `Point.y` など)

### 変換関数 (`frontend/src/domain/geometry.js` に移動済み)
*   `toSvgY(y)`: `y` -> `-y`
*   `toCartesianY(y)`: `y` -> `-y`
*   `toSvgRotation(deg)`: `deg` -> `-deg`
*   `generateSvgPath`: Cartesian座標の点配列を受け取り、SVGパス文字列（`d`属性）を生成する際にY軸を反転。

## 5. 主要な関数リスト

### ビジネスロジック (`frontend/src/domain/`)
*   **`loadProjectData`** (`projectService.js`):
    *   プロジェクトデータの取得、正規化、グローバルアセットとのマージを行う。
*   **`updateAssetEntities`** (`assetService.js`):
    *   アセットの形状編集時に呼び出され、境界ボックス (`boundX`, `boundY`, `w`, `h`) を再計算して更新する。
*   **`createInstance`** (`assetService.js`):
    *   アセットをキャンバスにドロップした際、現在のビューポート中心にインスタンスを生成する。座標変換が含まれる。
*   **`geometry.js`**:
    *   純粋な幾何学計算、座標変換、SVGパス生成ロジックを集約。`frontend/src/lib/utils.js` から抽出された。

### ユーティリティ (`frontend/src/lib/utils.js`)
*   **`calculateAssetBounds`** (Re-exported from geometry):
    *   アセットに含まれる全エンティティの回転後の境界ボックス（AABB）を計算し、アセット全体のサイズとオフセットを算出する。
*   **`getRotatedAABB`** (Re-exported from geometry):
    *   個々の形状（矩形、多角形、楕円）の回転後のAABBを計算する。楕円や円弧の計算ロジックが複雑。
*   **`generateEllipsePath`** (Re-exported from geometry):
    *   楕円、円弧、扇形のSVGパスを生成する。Cartesian座標（開始角・終了角）からSVGの `A` コマンドへの変換を行う。

## 6. リファクタリング案

### 実施済み
1.  **幾何学ロジックの分離**:
    *   `src/lib/utils.js` から `src/domain/geometry.js` へ純粋な計算ロジックを移動。
    *   `utils.js` は後方互換性のために `geometry.js` の関数を再エクスポートするように変更。

### 今後のステップ

1.  **ディレクトリ構造の整理**:
    *   `src/domain/models/`: データモデルの定義（JSDocまたはTypeScript化の前段階）。

2.  **カスタムフックの抽出**:
    *   `Editor.jsx` からUIロジック（サイドバー開閉など）を `useEditorLayout` などに抽出。
    *   `DesignCanvas` のドラッグ＆ドロップロジックをさらに細分化。

3.  **テストの拡充**:
    *   特に `geometry` 関連の計算ロジック（回転、AABB計算）に対する単体テストを追加。
    *   リファクタリング時の回帰テストとして機能させる。

4.  **座標変換の明確化**:
    *   変換ロジックを `ViewTransform` クラス/モジュールとして独立させ、変換ミスを防ぐ。

この計画に基づき、段階的にリファクタリングを進めることで、保守性と拡張性を向上させることができます。
