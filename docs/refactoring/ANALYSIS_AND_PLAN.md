# アーキテクチャ解析およびリファクタリング計画 (Analysis and Plan)

本書は `roomGenerator` のアーキテクチャ全体を詳細に解説し、コントリビュータがシステムの構造、データの流れ、およびワークフローを理解しやすくするためのドキュメントです。
将来のリファクタリングは、必ずこのドキュメントを更新し、全体像を把握した上で行う必要があります。

---

## 1. システム概要 (Overview)

本アプリケーションは、React (Vite) をフロントエンド、Go (Wails) をバックエンドとするデスクトップアプリケーションです。
- **フロントエンド**: React, Zustand (状態管理), React Router (ルーティング), Tailwind CSS
- **バックエンド**: Go, Wails (デスクトップバインディング)
- **データ保存**: 実行ファイル相対パスのローカル `data/` ディレクトリ内の JSON ファイル (SQLite 等のDBは不使用)

---

## 2. URL と ルーティング (URL Structure & Routing)

アプリケーションのナビゲーションは `react-router-dom` (HashRouter) を使用しています。

| URL | コンポーネント | 役割 |
|---|---|---|
| `/` | `frontend/src/pages/Home.jsx` | ホーム画面。プロジェクトの一覧表示、新規作成、インポート/エクスポートを行う。 |
| `/library` | `frontend/src/pages/Library.jsx` | 共通ライブラリ画面。プロジェクト間で再利用可能なグローバルアセットの管理。 |
| `/project/:id` | `frontend/src/pages/Editor.jsx` | エディタ画面。指定されたIDのプロジェクトの編集を行うメインワークスペース。 |
| `/settings` | `frontend/src/pages/Settings.jsx` | アプリケーションの全体設定 (カラーパレットやデフォルトカラーなど)。 |

---

## 3. コンポーネント階層 (Component Hierarchy)

エディタ画面 (`/project/:id`) を中心とした主要なコンポーネント構成です。

- **`App.jsx`**: アプリケーションのルート。初期データ (プロジェクト一覧、グローバルアセット、パレット等) をGoバックエンドから取得する。
- **`Editor.jsx`**: プロジェクト編集のオーケストレーションコンポーネント。モード (`layout` / `design`) に応じて表示を切り替える。
  - **左サイドバー (`UnifiedSidebar.jsx`)**: アセットの選択、キャンバスへの配置(`addInstance`)、アセットの編集対象(`designTargetId`)の選択を行う。
  - **キャンバスエリア (Canvas Area)**:
    - **`LayoutCanvas.jsx`** (Layout Mode): フロアプラン内にアセット(インスタンス)を配置・移動・回転する画面。
    - **`DesignCanvas.jsx`** (Part Design Mode): 個々のアセットの形状(ポリゴン、円、矩形などの Entities/Shapes)を編集・作成する画面。
      - レンダリングは `ShapeRenderer`, `HandleRenderer`, `GridRenderer` (`frontend/src/components/canvas/`) に委譲されている。
  - **右プロパティパネル (Properties Panel)**:
    - **`LayoutProperties.jsx`**: Layout Mode で選択されたインスタンスのプロパティ(位置、角度など)を編集。
    - **`DesignProperties.jsx`**: Part Design Mode で選択された図形(Shape)のプロパティ(サイズ、座標、色など)を編集。

---

## 4. 状態管理とデータフロー (State Management & Data Flow)

グローバルな状態管理は `Zustand` を使用して `frontend/src/store/` 内で管理されています。

### Zustand スライス (Slices)
- **`projectSlice.js`**: プロジェクトのコアデータ (`projects`, `localAssets`, `instances`, `viewState` など) を管理。
- **`uiSlice.js`**: UIの表示状態 (選択中のID `selectedIds`、モード `mode`、サイドバーの開閉幅など) を管理。ローカルストレージにも一部保存。
- **Zundo (Temporal)**: Undo/Redo の履歴管理。`localAssets` と `instances` などの変更履歴を記録する (`useVanillaStore(useStore.temporal)`).

### データ保存のワークフロー
1. **ユーザー操作**: キャンバスでオブジェクトを動かすと、Zustand の Store が更新される。
2. **自動保存 (`useAutoSave.js`)**: Store の変更を検知し、デバウンス処理を経て `saveProjectData` アクションを発火。
3. **バックエンド通信 (`API.saveProjectData`)**: Go の `app.go` (`SaveProjectData` メソッド) にデータを送信。
4. **ファイル書き込み**: Go側で `data/project_{id}.json` として保存される。
※ 高頻度のイベント (ドラッグ中など) では、React のローカルステート (`localAsset`) を更新して描画を最適化し、`onPointerUp` (ドラッグ終了時) に Zustand の Store にコミットするパターン (`updateLocalAssetState`) を採用しています。

---

## 5. 主要な関数とドメインロジック (Key Functions & Domain Logic)

ビジネスロジックは `frontend/src/domain/` および `frontend/src/lib/` に分離されています。

### ジオメトリと座標計算 (`frontend/src/domain/geometry.js`)
論理的な直交座標系 (Cartesian, Y軸上向き) と 描画用のSVG座標系 (SVG, Y軸下向き) の変換や、図形の計算を担当します。
- `rotatePoint(px, py, cx, cy, angle)`: 座標の回転。
- `toSvgY(y)`, `toCartesianY(svgY)`: 座標系の変換。
- `getRotatedAABB(shape)`: 図形の回転を考慮した Axis-Aligned Bounding Box (AABB) を計算 (円弧の境界判定なども含む)。
- `generateSvgPath(points)`: 頂点配列から SVG の `d` 属性文字列を生成。

### アセット管理 (`frontend/src/domain/assetService.js`)
- `updateAssetEntities(asset, entities)`: アセット内の図形(Entities)を更新し、同時に全体の AABB (`w`, `h`, `boundX`, `boundY`) を再計算する**標準的なヘルパー関数**。`DesignCanvas` と `DesignProperties` での一貫性を担保。
- `forkAsset(asset, defaultColors)`: グローバルアセットをプロジェクトローカルにコピーする処理。

### プロジェクトロードと正規化 (`frontend/src/domain/projectService.js`)
- `loadProjectData(projectId, API)`: バックエンドからJSONを読み込み、旧フォーマット (例: `shapes` 配列) から新フォーマット (`entities`) への正規化やマイグレーションを実行して Store に渡す。

---

## 6. バックエンド構造 (Go Backend)

Go のバックエンドはファイルシステムとのブリッジとして機能し、型の安全性を担保します。

- **`models.go`**: `Project`, `Asset`, `Entity`, `Instance`, `Point`, `Vec2` などの構造体を定義 (座標系はすべて `float64`)。
  - `Entity` 構造体は Union Struct パターンを採用し、フロントエンドからのポリモーフィックなJSONデータ (矩形、円、多角形など) を `omitempty` フィールドで柔軟に受け取る。
- **`app.go`**: Wails のバインディングメソッド (`GetProjectData`, `SaveProjectData`, `ImportProject` など) を提供。
  - `GetProjectData` では、厳密な構造体のアンマーシャルを試み、失敗した場合は `map[string]interface{}` を用いた手動マイグレーション (レガシーデータの `shapes` → `entities` 変換など) にフォールバックするロジックを実装。

---

## 7. リファクタリングのワークフローとガイドライン (Refactoring Workflow)

将来のコントリビュータが機能追加やリファクタリングを行う際は、以下の手順に従ってください。

1. **ドキュメントの更新 (事前分析)**:
   - 変更を加える前に、本ドキュメント (`docs/refactoring/ANALYSIS_AND_PLAN.md`) を確認し、変更予定の関数、コンポーネント、データフローを追記・修正して計画を立てる。
2. **コードの修正**:
   - アーキテクチャの制約 (例: AABBの再計算は `updateAssetEntities` を使う、ドラッグ中の状態は `localAsset` を使うなど) に従いコードを修正する。
3. **テストの実行**:
   - バックエンドのテスト実行にはフロントエンドのビルドが必要です。
   - コマンド: `cd frontend && npm install && npm run build && cd .. && go test ./...`
4. **事後ドキュメント修正**:
   - 実装を通じてアーキテクチャに変更があった場合は、再度このドキュメントを最新の状態に更新する。
