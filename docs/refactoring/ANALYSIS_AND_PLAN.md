# システム分析とリファクタリング計画 (ANALYSIS_AND_PLAN.md)

このドキュメントは、`roomGenerator` のシステム全体構造、データフロー、コンポーネントの依存関係をコントリビューター向けにまとめたものです。将来的な機能追加やリファクタリング時の指針として活用してください。

## 1. システム概要とアーキテクチャ

`roomGenerator` は、Wails (Go) をバックエンド、React (Vite) をフロントエンドとして構築されたデスクトップアプリケーションです。
主に「間取りのレイアウト」と「アセット（家具・部屋・設備など）の編集」という2つの主要なモードを持ちます。

### 1.1 技術スタック
- **フロントエンド:** React 18, Vite, Zustand (状態管理), React Router (ルーティング)
- **バックエンド:** Go 1.24+, Wails v2
- **データ保存:** ローカルJSONファイル (`data/` ディレクトリ配下)

### 1.2 URLとルーティング構造

React Router (`HashRouter`) を使用したクライアントサイドルーティングを採用しています。

| URLパス | コンポーネント | 役割 |
|---|---|---|
| `/` | `frontend/src/pages/Home.jsx` | ホーム画面。既存プロジェクトのリスト表示と新規作成。 |
| `/library` | `frontend/src/pages/Library.jsx` | ライブラリ画面。グローバルに共有されるアセット群とカラーパレットの管理。 |
| `/project/:id` | `frontend/src/pages/Editor.jsx` | メインの編集画面。指定されたIDのプロジェクトを読み込み、編集を行う。 |
| `/settings` | `frontend/src/pages/Settings.jsx` | 全体設定画面 (グリッドサイズなど)。 |

## 2. 状態管理とデータフロー

全体の状態管理には **Zustand** を利用し、`zundo` ミドルウェアを組み合わせることで、履歴（Undo/Redo）機能を実現しています。

### 2.1 Zustand ストア構造 (`frontend/src/store/`)
ストアは関心事ごとに複数の Slice に分割され、`index.js` で結合されています。

- **`projectSlice.js`**:
  - プロジェクト全体のメタデータ（`projects`）、現在ロード中のプロジェクトIDを管理。
- **`assetSlice.js`**:
  - `localAssets`（現在のプロジェクト専用のアセット一覧、Undo/Redo対象）。
  - `globalAssets`（ライブラリで管理される共有アセット）。
  - カラーパレットやデフォルトカラー設定。
- **`instanceSlice.js`**:
  - `instances`（レイアウト上に配置されたアセットのインスタンス一覧、Undo/Redo対象）。
- **`uiSlice.js`**:
  - キャンバスのビュー状態（`viewState`: パン、ズーム）。
  - 選択中のインスタンス (`selectedIds`) やシェイプ (`selectedShapeIndices`)。
  - 現在の操作モード（`layout` か `design` か）。

### 2.2 主要なデータフロー (ロードから保存まで)

**【プロジェクトのロード】**
1. ユーザーが `/project/:id` にアクセス。
2. `Editor.jsx` がマウントされ、`projectSlice` の `loadProject(id)` を呼び出す。
3. フロントエンドのビジネスロジック (`frontend/src/domain/projectService.js` の `loadProjectData`) が実行される。
4. バックエンド API (`GetProjectData`, `GetAssets`, `GetPalette`) を通じて `data/` 配下の JSON ファイル群を読み込む。
5. 古いデータ形式の正規化 (例: `shapes` を `entities` に変換) を行い、ストアにセットする。

**【編集とUndo/Redo】**
- キャンバスでの操作中、軽量な操作（ドラッグ中など）は React のローカル state (`localAsset`) で処理し、操作完了時（`onUp`）にのみ Zustand ストアにコミットします。
- これにより、不必要な Undo 履歴の肥大化を防いでいます (`zundo` は特定の状態変更のみを監視)。

**【プロジェクトの保存 (自動保存)】**
1. ストア内の `localAssets` または `instances` に変更が加わると、`frontend/src/hooks/useAutoSave.js` が検知。
2. 一定時間（デバウンス）経過後、`projectSlice` の `saveProjectData()` アクションがトリガーされる。
3. 最新のデータをバックエンド API (`SaveProjectData`) に送信。
4. Goバックエンド側で型チェック（`models.go` の構造体への Unmarshal）を行い、安全に `data/project_{id}.json` に保存する。
## 3. コンポーネント階層と役割

主要なUIコンポーネントは、責務ごとに分割されています。特に `Editor.jsx` が全体のオーケストレーターとして機能します。

### 3.1 Editor.jsx (メインワークスペース)
- `App.jsx` から呼ばれ、URL パラメータの `id` に基づいてプロジェクトをロードします。
- `mode` (UI状態) に応じて、キャンバス領域とプロパティパネル領域を切り替えます。
  - **Layout Mode**: `LayoutCanvas.jsx` と `LayoutProperties.jsx` を表示。
  - **Design Mode**: `DesignCanvas.jsx` と `DesignProperties.jsx` を表示。

### 3.2 DesignCanvas.jsx (アセットの形状編集)
- アセット（家具・部屋など）を構成する個々のシェイプ（`entities`）の編集を行います。
- **操作ロジックの分離**:
  - 複雑なマウスインタラクション（パニング、リサイズ、ドラッグなど）は、別ファイルの `frontend/src/components/DesignCanvas.logic.js` に抽出されています。
  - イベントハンドラ（`onPointerDown` で `initiate*` を呼び、`onPointerMove` で `process*` を呼ぶパターン）を用いています。
- **ローカルステートによるパフォーマンス最適化**:
  - `onPointerMove` 時は、Zustand ストアではなく、React のローカル状態 (`localAsset`) を更新することで、高頻度な再描画を効率的に処理しています。`onPointerUp` で最終結果をストアにコミットします。

### 3.3 LayoutCanvas.jsx (アセットの配置)
- 複数のアセットのインスタンス（`instances`）をフロアプランに配置するためのキャンバスです。
- アセットの形状データ（`localAssets`）を参照し、指定された座標 (`x`, `y`) と回転 (`rotation`) で描画します。

## 4. コアとなるドメイン関数とユーティリティ

ビジネスロジックや幾何学計算は、UIコンポーネントから分離され、`src/domain/` や `src/lib/` に配置されています。

### 4.1 ジオメトリ・座標変換 (`frontend/src/lib/utils.js` / `frontend/src/domain/geometry.js`)
- 内部データは **デカルト座標系（Y-Up）** を使用し、SVG 描画は **スクリーン座標系（Y-Down）** を使用しています。
- `toSvgY`, `toCartesianY`: 座標系の相互変換。
- `calculateAssetBounds(entities)`: 複数のエンティティ（シェイプ）を含むアセット全体の Axis-Aligned Bounding Box (AABB) を計算し、幅 (`w`)、高さ (`h`)、および基準点（`boundX`, `boundY`）を決定します。

### 4.2 アセット管理ロジック (`frontend/src/domain/assetService.js`)
- `updateAssetEntities(asset, entities)`:
  - エンティティの追加、削除、プロパティ更新を行う際の標準的なヘルパー関数。
  - 更新と同時に必ず `calculateAssetBounds` を呼び出し、AABB の整合性を保証します（`DesignCanvas` と `DesignProperties` 間で一貫したバウンディングボックスの同期を行うため）。
- `forkAsset(asset, defaultColors)`:
  - グローバルライブラリからアセットをインポートする際、IDを新規生成し、プロジェクト固有の色（デフォルトカラー）を適用して「フォーク（複製）」します。

## 5. コントリビューター向け 開発ワークフロー

`roomGenerator` の新機能追加やバグ修正を行う際は、以下のワークフローに従ってください。

### 5.1 状態の変更 (Zustand)
- コンポーネント間で状態を受け渡すための prop drilling は避け、`useStore` フックを使用して必要な状態やアクションを直接取得してください。
- ユーザー操作によるキャンバス上のアイテムの移動や変形は、Undo/Redo の対象にするため、必ず `projectSlice` や `instanceSlice`、`assetSlice` の適切なアクションを経由して更新してください。ただし、ドラッグ中などの高頻度更新はローカルステートで行い、確定時にストアを更新するパターン（`DesignCanvas` 参照）を推奨します。

### 5.2 ロジックの分離
- UIコンポーネント内に複雑な計算（数学、幾何学）やビジネスロジックを含めないでください。
- アセットの操作に関するドメインロジックは `frontend/src/domain/` に、汎用的なユーティリティは `frontend/src/lib/` に追加してください。

### 5.3 依存関係のインポート (ESM 互換性)
- `frontend/src/domain/` や `frontend/src/lib/` 内で内部モジュールをインポートする際は、**必ず `.js` 拡張子を明記**してください（例: `import { ... } from './utils.js'`）。これは、Node.js ESM 環境（例えばテストスクリプトなど）で実行する際の互換性を保つためです。

### 5.4 テスト実行
- UIコンポーネント以外のドメインロジックを変更した場合は、可能な限りテスト（Playwright 等）を実行して検証してください。
- バックエンド (Go) とフロントエンドの統合テストを実行するには、以下のコマンドを使用します（フロントエンドのビルドが前提となります）。
  ```bash
  cd frontend && npm install && npm run build && cd .. && go test ./...
  ```

### 5.5 リファクタリング時の注意点
- 大きな構造変更を伴うリファクタリングを行う場合は、まずこのドキュメント (`ANALYSIS_AND_PLAN.md`) などの設計文書を更新し、全体の流れを把握してから実際のコード修正を行ってください。
