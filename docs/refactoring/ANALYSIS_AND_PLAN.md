# ANALYSIS AND PLAN

## 1. 概要
`roomGenerator` システムの全体像、コンポーネント構成、データの流れ、状態管理、および主要な関数群を整理し、コントリビュータがシステムを理解しやすくするためのドキュメントです。このドキュメントをもとに、後続のリファクタリング作業を進めます。

## 2. URLとルーティング構造

React Router (HashRouter) を使用してルーティングを行っています。

| URLパス | コンポーネント | 役割 |
|---|---|---|
| `/` | `src/pages/Home.jsx` | ホーム画面。プロジェクトの一覧表示と新規作成。 |
| `/library` | `src/pages/Library.jsx` | グローバルアセット（家具や設備のテンプレート）の管理画面。 |
| `/project/:id` | `src/pages/Editor.jsx` | エディタ画面。指定されたプロジェクトの編集を行うメイン画面。 |
| `/settings` | `src/pages/Settings.jsx` | アプリケーションの全体設定（色やグリッドなど）画面。 |

## 3. コンポーネント階層 (Editor画面)

エディタ画面 (`/project/:id`) の主なコンポーネント構成は以下の通りです。

- **`Editor`**: エディタ全体を囲むコンテナ。モードに応じて表示を切り替えます。
  - **`Header`**: 上部のヘッダー。プロジェクト名や保存状態を表示。
  - **`UnifiedSidebar`**: 左側のサイドバー。アセットの追加やツールの選択。
  - **キャンバスエリア**:
    - **`LayoutCanvas`** (レイアウトモード): 部屋や家具（インスタンス）を配置するキャンバス。
    - **`DesignCanvas`** (デザインモード): アセットの形状（エンティティ）を直接編集するキャンバス。
      - `ShapeRenderer`, `HandleRenderer`, `GridRenderer` などのサブコンポーネントを使用。
  - **プロパティエリア**:
    - **`LayoutProperties`**: 選択されたインスタンスのプロパティ（位置、回転など）を編集。
    - **`DesignProperties`**: 選択されたエンティティのプロパティ（サイズ、色、座標など）を編集。

## 4. 状態管理とデータの流れ (Zustand)

状態管理には `Zustand` を使用し、`zundo` ミドルウェアでUndo/Redo機能を提供しています。状態は `src/store/` 配下で管理されています。

### データの保存と読み込みフロー
1. **読み込み**: `App.jsx` や `Editor.jsx` がマウントされた際、API経由でGoバックエンドからJSONデータを取得し、Zustandのストアにセットします (`projectSlice.js` の `loadProject` など)。
2. **編集**: ユーザーがキャンバス上で操作を行うと、Zustandのストアが更新されます。
3. **保存**: ストアの変更を検知して自動保存（`useAutoSave` フック）が行われ、API経由でGoバックエンドにデータが送られ、ローカルのJSONファイルに保存されます。

### 主要な状態 (Slices)
- **`projectSlice.js`**: プロジェクト全体のメタデータやデフォルトカラー。
- **`assetSlice.js`**: `localAssets`（プロジェクト固有のアセット）と `globalAssets`。
- **`instanceSlice.js`**: `instances`（配置されたオブジェクト）。
- **`uiSlice.js`**: 選択状態（`selectedIds`, `selectedShapeIndices`）やビュー状態（パン、ズーム）。

## 5. 主要な関数とドメインロジック

### 座標系とジオメトリ (`src/domain/geometry.js`)
キャンバス上の論理座標（Cartesian: Y-Up）と描画座標（SVG: Y-Down）の変換や、バウンディングボックスの計算などを行います。
- `toSvgY`, `toCartesianY`: Y座標の反転。
- `rotatePoint`: 点の回転。
- `getRotatedAABB`: 回転を考慮したバウンディングボックスの計算。
- `snapValue`: グリッドへのスナップ。

### アセット管理 (`src/domain/assetService.js`)
アセットやエンティティの作成、更新、複製などのロジックを担当します。
- `updateAssetEntities(asset, entities)`: アセットのエンティティを更新し、全体の境界（AABB）を再計算します。
- `forkAsset(asset, defaultColors)`: グローバルアセットをプロジェクト用に複製（フォーク）します。

### プロジェクト読み込み (`src/domain/projectService.js`)
- `loadProjectData(projectId, api)`: バックエンドからデータを取得し、正規化やマイグレーションを行ってストアに渡す形に整えます。

## 6. バックエンド (Go) とデータ構造

バックエンドは `app.go` に実装され、データ構造は `models.go` に定義されています。
ローカルの `data/` ディレクトリにJSONファイルとしてデータを保存します。

- **`models.go`**:
  - `Project`, `Asset`, `Instance`, `Entity` などの構造体。
  - `Entity` はUnion構造体パターンを使用し、様々な形状（polygon, circle, textなど）に対応します。
- **`app.go`**:
  - `GetProjectData`: データの読み込みと、古いフォーマット（例: `shapes` -> `entities`）からのマイグレーションを行います。
  - `SaveProjectData`: 型安全性を確保するため、JSONを構造体にアンマーシャルして検証してからファイルに保存します。

## 7. 今後のリファクタリング方針

現在の構造は比較的整理されていますが、以下の点を中心に改善を検討します。

1. **コンポーネントの責務分離**: `DesignCanvas.jsx` や `LayoutCanvas.jsx` などの巨大なコンポーネントから、状態管理や複雑な計算ロジック（hooksや外部ヘルパー）をさらに切り離す。
2. **型安全性の向上 (フロントエンド)**: JSDocやTypeScriptの導入（または強化）により、`Asset`, `Instance`, `Entity` のデータ構造をフロントエンドでも厳密に扱う。
3. **テストカバレッジの向上**: ドメインロジック（`geometry.js`, `assetService.js`）に対する単体テストを拡充する。
4. **ドキュメントの最新化**: 本ドキュメント（`ANALYSIS_AND_PLAN.md`）を継続的に更新し、アーキテクチャやワークフローの変更をコントリビュータに分かりやすく伝える。