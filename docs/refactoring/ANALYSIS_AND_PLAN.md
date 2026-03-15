# システム分析およびリファクタリング計画 (ANALYSIS_AND_PLAN)

本ドキュメントは、`roomGenerator` (間取りアーキテクト Pro) の全体的なシステム構造、データフロー、主要なコンポーネントと関数のリストをまとめ、将来のリファクタリングおよび新規コントリビュータ向けのガイドとして機能します。

## 1. システム概要

`roomGenerator` は、Wailsフレームワークを使用し、Go (バックエンド) と React (フロントエンド) で構築されたデスクトップアプリケーションです。間取り図（部屋のレイアウト）およびそれを構成する個別のアセット（家具、設備など）の生成・編集・管理を行います。

### 動作モード (Room Generator System)
1. **Design Mode (アセット編集)**:
   - 個別の家具や設備（Asset）を構成する形状（Shapes: Polygon, Circle, Rectangleなど）を描画・編集するモード。
   - 座標系はアセットの中心を原点とするローカル座標系。
2. **Layout Mode (間取り編集)**:
   - 作成したアセットをインスタンス（Instance）としてフロアプラン上に配置・回転・移動するモード。
   - 座標系はキャンバス全体のグローバル座標系。

## 2. ディレクトリ構成とファイルリスト

### フロントエンド (`frontend/src/`)
- **`App.jsx` / `main.jsx`**: アプリケーションのエントリーポイント。ルーティングと初期データロードを担当。
- **`pages/`**: 各URLに対応する最上位ページコンポーネント。
  - `Home.jsx` (`/`): プロジェクト一覧画面。
  - `Library.jsx` (`/library`): グローバルアセットライブラリ管理画面。
  - `Editor.jsx` (`/project/:id`): メインの編集画面。
  - `Settings.jsx` (`/settings`): グローバル設定画面。
- **`components/`**: UIコンポーネント。
  - `DesignCanvas.jsx`: Design Modeのキャンバス。複雑なインタラクションは `DesignCanvas.logic.js` に分離。
  - `LayoutCanvas.jsx`: Layout Modeのキャンバス。
  - `UnifiedSidebar.jsx`: 左側のツールバー/アセットリスト。
  - `DesignProperties.jsx` / `LayoutProperties.jsx`: 右側のプロパティエディタ。
  - `SharedRender.jsx`: 両キャンバスで共通の描画ロジック。
- **`domain/`**: ビジネスロジックと純粋な関数。
  - `assetService.js`: アセットのフォーク、エンティティ更新、バウンディングボックス(AABB)計算など。
  - `projectService.js`: プロジェクトデータのロードと正規化。
- **`store/`**: Zustandによる状態管理。
  - `index.js`, `projectSlice.js`, `assetSlice.js`, `uiSlice.js`, `instanceSlice.js`。
- **`hooks/`**: カスタムフック。
  - `useAutoSave.js`: 自動保存ロジック。
- **`lib/`**: ユーティリティとAPI定義。
  - `utils.js`, `api.js`, `constants.js`。

### バックエンド (Go)
- **`main.go`**: Wailsアプリケーションの起動。
- **`app.go`**: ファイルシステムとのやり取りを行う主要なAPI定義 (`GetProjectData`, `SaveProjectData` など)。
- **`models.go`**: データの型定義 (`Project`, `Asset`, `Instance`, `Entity` など)。JSONとGo構造体のマッピングを担当。

### データストレージ (`data/`)
ユーザーデータはローカルのJSONファイルとして保存されます。
- `projects_index.json`: プロジェクトのメタデータ一覧。
- `project_<id>.json`: 個別のプロジェクトデータ（ローカルアセット、配置済みインスタンスなど）。
- `global_assets.json`: 共有アセットライブラリ。
- `palette.json`: カラーパレット設定。

## 3. URL構造とルーティング (HashRouter)

| URL (Hash) | Page Component | 機能 |
|---|---|---|
| `/` | `Home.jsx` | プロジェクトの新規作成・一覧表示 |
| `/library` | `Library.jsx` | プロジェクト間で共有するグローバルアセットの管理 |
| `/project/:id` | `Editor.jsx` | 特定のプロジェクトを開き、Design/Layoutの編集を行う |
| `/settings` | `Settings.jsx` | アプリケーションの全体設定 |

## 4. 状態管理とデータフロー (Workflow)

フロントエンドの状態管理は Zustand と Zundo (Undo/Redo) によって行われます。

### データフロー (ロードから保存まで)
1. **初期化 (`App.jsx`)**: 起動時にバックエンド (Go) からグローバルアセットとプロジェクト一覧を取得。
2. **プロジェクト読み込み (`Editor.jsx` -> `projectSlice.js:loadProject`)**:
   - ユーザーが `/project/:id` にアクセス。
   - Zustandアクションが `app.GetProjectData(id)` を呼び出し、プロジェクトJSONを読み込む。
   - データが正規化され（例: 古い `shapes` 配列を `entities` に変換）、Zustandストアに格納される。
3. **ユーザーインタラクション**:
   - ユーザーがキャンバス上で操作を行う（例: 形状の移動）。
   - `DesignCanvas` 内で、ドラッグ中はローカルのReactステート (`localAsset`) を更新して高頻度描画に対応（パフォーマンス最適化）。
   - ドラッグ終了時 (`onPointerUp`) に、Zustandストアのデータを更新 (`updateAssetEntities` などを経由)。
4. **自動保存 (`useAutoSave.js`)**:
   - Zustandストアの特定の変更（プロジェクトデータ）を検知。
   - `SaveProjectData` を呼び出し、変更をGoバックエンドへ送信。
   - バックエンドが `data/project_<id>.json` にデータを書き込み永続化。

## 5. 主要な関数リスト

### フロントエンド (`domain/assetService.js` 等)
- **`updateAssetEntities(asset, entities)`**:
  - アセット内のエンティティ（形状）を更新する際の中核関数。
  - 新しいエンティティリストを受け取り、AABB（Axis-Aligned Bounding Box）を再計算し、アセット全体のサイズ (`w`, `h`) とオフセット (`boundX`, `boundY`) を自動的に更新する。
- **`forkAsset(asset, defaultColors)`**:
  - グローバルライブラリからアセットをプロジェクトにインポートする際、IDを振り直し、ローカルコピーを作成する。
- **`normalizeAsset(asset)`**:
  - 後方互換性のため、レガシーなデータ構造（例: `shapes`）を現在の `entities` 構造に変換する。
- **`generateSvgPath`, `getRotatedAABB`, `toSvgY`**:
  - ジオメトリ計算とSVG描画用パス文字列の生成。数学的なローカル座標とSVGの描画座標を橋渡しする。

### バックエンド (`app.go`)
- **`GetProjectData(id string)`**:
  - ファイルからJSONを読み込み、厳密な構造体 (`ProjectData`) へのアンマーシャルを試みる。失敗した場合はレガシーフォーマットのマイグレーション処理を行う。
- **`SaveProjectData(id string, data interface{})`**:
  - フロントエンドから受け取ったデータを一度 `ProjectData` 構造体にアンマーシャルして型安全性を検証した後、ファイルに保存する。

## 6. リファクタリング方針とコントリビュータ向けガイドライン

### アーキテクチャ原則
1. **Single Source of Truth**:
   - 描画や計算に使用するデータは、必ずZustandストア（および同期された `localAsset`）から取得すること。
2. **Domain Logicの分離**:
   - 複雑な計算（AABBの計算、ジオメトリの変換、データの正規化）はコンポーネント内（`.jsx`）に書かず、`domain/` や `lib/` 配下の純粋な関数として実装すること。
   - `DesignCanvas` のような複雑なUIは、ステート管理 (`.logic.js`) とビュー描画 (`.jsx` およびサブコンポーネント) に分離する。
3. **型の安全性**:
   - Goバックエンドでは `models.go` の構造体を厳密に使用し、フロントエンドではJSDoc (`@typedef`) を活用してデータ構造の堅牢性を保つ。

### 今後のリファクタリングタスクの例
- Canvas内でのイベントハンドリングとUndo/Redoの更なる最適化。
- Playwrightテストカバレッジの向上（カスタムコンポーネントに対する操作自動化）。
- Reactコンポーネントの再描画パフォーマンス改善（React.memoの活用など）。
