# 間取りアーキテクト Pro (roomGenerator) リファクタリング分析・計画書

本ドキュメントは、コントリビュータがプロジェクトの全体像、データフロー、主要コンポーネント、ワークフローを理解し、今後のリファクタリングを円滑に進めるためのガイドとして機能します。

## 1. システム概要・概形

本システムは、Wailsを利用してGo（バックエンド）とReact/Vite（フロントエンド）を統合したデスクトップアプリケーションです。
主に「間取り図（レイアウト）」と「アセット（家具・設備など）」を作成・管理します。

### 1.1 主なディレクトリ構造

- `main.go`, `app.go`: バックエンドAPIのエントリーポイントとロジック。
- `models.go`: Go側のデータモデル（Project, Asset, Entityなど）。
- `data/`: JSON形式で保存されるローカルデータ（プロジェクト、グローバルアセット、パレットなど）。
- `frontend/src/`: フロントエンドコード。
  - `pages/`: ルーティングごとのページコンポーネント（Home, Editor, Libraryなど）。
  - `components/`: UIコンポーネント（Canvas, Sidebar, Propertiesなど）。
  - `domain/` & `lib/`: ドメインロジック、ユーティリティ（AABB計算、アセット更新など）。
  - `store/`: Zustandを用いた状態管理スライス（projectSlice, uiSliceなど）。
  - `hooks/`: カスタムフック（キャンバスインタラクションなど）。

### 1.2 URL・ルーティング構造 (HashRouter)

| パス | ページコンポーネント | 役割 |
|---|---|---|
| `/` | `pages/Home.jsx` | プロジェクト一覧を表示するランディングページ。 |
| `/library` | `pages/Library.jsx` | グローバルアセットライブラリの管理画面。 |
| `/project/:id` | `pages/Editor.jsx` | プロジェクトのメインエディタ画面（キャンバス、プロパティパネルなど）。 |
| `/settings` | `pages/Settings.jsx` | アプリケーション全体のグローバル設定（カラー、デフォルト設定など）。 |

## 2. データフローとワークフロー

### 2.1 データモデルの階層

- **Project**: プロジェクト全体のコンテナ。
- **Asset (Blueprint)**: 家具や設備のひな形（デザインモードで作成・編集）。`entities`（形状の配列）を持つ。
- **Entity (Shape)**: アセットを構成する個々の図形（矩形、円、ポリゴンなど）。
- **Instance**: レイアウトモードで配置されたアセットの実体。特定の位置・回転を持つ。

### 2.2 プロジェクトのロードフロー

1. ユーザーがHome画面から `/project/:id` に遷移。
2. `Editor.jsx` がマウントされ、`projectSlice`の `loadProject(id)` アクションを呼び出す。
3. `loadProject` はバックエンドの `API.getProjectData(id)` を呼び出す。
4. バックエンドは `data/project_{id}.json` を読み込み、必要に応じてマイグレーション（例: `shapes` -> `entities`）を行い返す。
5. フロントエンドは受け取ったデータを正規化（`normalizeAsset` など）し、Zustandストア（`localAssets`, `instances` など）を更新。

### 2.3 編集と自動保存（AutoSave）フロー

1. ユーザーがキャンバス上で操作（アセットの移動、形状の変更など）を行う。
2. Zustandストアの該当スライスが即座に更新される（`temporal`ミドルウェアによりUndo/Redo履歴も記録）。
3. `useAutoSave` フックがストアの変更を検知。
4. デバウンス処理後、現在の状態（`localAssets`, `instances`）を `API.saveProjectData(id)` 経由でバックエンドに送信。
5. バックエンドは `data/project_{id}.json` に変更を書き込む。

## 3. 主要コンポーネントと役割

### 3.1 Editor.jsx と関連コンポーネント

エディタ画面（`/project/:id`）のメインコンテナであり、モード（Design Mode / Layout Mode）に応じて子コンポーネントを切り替えます。

- **`UnifiedSidebar.jsx`**: 左側のツールバー・アセット選択パネル。
- **キャンバスエリア**:
  - **`LayoutCanvas.jsx`**: レイアウトモード用。インスタンス（部屋や家具）をフロアプラン上に配置。
  - **`DesignCanvas.jsx`**: デザインモード用。個々のアセット（ひな形）の形状（Entities）を編集。
    - インタラクションロジック（ドラッグ、リサイズ、パンなど）は `DesignCanvas.logic.js` および `useCanvasInteraction` フックに分離・カプセル化されています。
- **プロパティパネル**:
  - **`LayoutProperties.jsx`**: 選択されたインスタンスのプロパティ（位置、回転など）を編集。
  - **`DesignProperties.jsx`**: 選択された図形（Entity）のプロパティ（サイズ、色、頂点など）を編集。
- **`Ruler.jsx`**: キャンバスの周囲に表示されるルーラー（定規）。

### 3.2 状態管理 (Zustand - `frontend/src/store/`)

- **`projectSlice.js`**: プロジェクト固有のデータ（`localAssets`, `instances`, `viewState` など）を管理。
- **`assetSlice.js`** / **`instanceSlice.js`**: アセットやインスタンスの操作アクション。
- **`uiSlice.js`**: UIの表示状態（モードの切り替え、サイドバーの状態など）を管理。
- **`zundo` ミドルウェア**: 特定のスライスに対するUndo/Redo（履歴）機能を提供。

## 4. 重要なドメインロジック (frontend/src/domain/ & lib/)

- **`calculateAssetBounds(entities)`** (`src/lib/utils.js`):
  エンティティ群のAxis-Aligned Bounding Box (AABB) を計算。アセットの中心やサイズ決定に必須。
- **`updateAssetEntities(asset, entities)`** (`src/domain/assetService.js`):
  アセットのエンティティを更新する際の中央ハブ。更新と同時にバウンディングボックス（`w`, `h`, `boundX`, `boundY`）を再計算し、一貫性を保つ。
- **幾何学関数 (`src/domain/geometry.js`)**:
  座標変換、AABB計算、回転など、描画とロジックをつなぐコア関数群。

## 5. 今後のリファクタリング計画

現在の構造を基に、以下の観点でリファクタリング・整理を進めることが推奨されます。

1. **ドメインロジックの分離・整理**:
   - `frontend/src/lib/utils.js` に混在しているロジックを、適切なドメイン層（`geometry.js`, `assetService.js`, `projectService.js`など）へさらに明確に分離する。
2. **コンポーネントの責務明確化**:
   - 特に `DesignCanvas` と `LayoutCanvas` が肥大化しがちなため、レンダリング責務（例: `ShapeRenderer`, `GridRenderer`）とロジック（カスタムフック）の分離を徹底する。
3. **型定義の強化（JSDoc / TypeScript化の検討）**:
   - Goの構造体（`Entity`, `Asset`）とフロントエンドのJSONオブジェクト間の整合性を強固にするため、JSDocを用いた型定義（`@typedef`）を拡充する。
4. **テストカバレッジの向上**:
   - バックエンドのAPIロジック、フロントエンドのコアロジック（特にAABB計算やZustandアクション）のユニットテストを追加する。

---

*※ このドキュメントは、コードの変更やアーキテクチャの更新に合わせて随時更新してください。*
