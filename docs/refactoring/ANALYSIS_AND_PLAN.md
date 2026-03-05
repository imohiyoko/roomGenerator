# `roomGenerator` リファクタリングおよびシステム分析ガイド

本ドキュメントは、`imohiyoko/roomGenerator` の全体的なアーキテクチャ、データフロー、コンポーネント構成、URL構造、および主要なワークフローを整理したものです。
コントリビュータがシステムを理解し、今後のリファクタリングを安全かつ効率的に進めるための基盤として機能します。

## 1. URLとルーティング構造

アプリケーションは `React Router (HashRouter)` を使用して画面遷移を管理しています。

| URLパス | コンポーネント | 役割 |
|---|---|---|
| `/` | `frontend/src/pages/Home.jsx` | ホーム画面。既存のプロジェクト一覧を表示し、新規プロジェクトの作成を行います。 |
| `/library` | `frontend/src/pages/Library.jsx` | グローバルアセット（共通の家具や部屋のひな形）やカラーパレットを管理する画面です。 |
| `/project/:id` | `frontend/src/pages/Editor.jsx` | 特定のプロジェクトのメインエディタ画面。ここでレイアウトやデザインを行います。 |
| `/settings` | `frontend/src/pages/Settings.jsx` | アプリケーション全体のグローバル設定（デフォルトカラーなど）を行います。 |

## 2. 主要なコンポーネント階層

エディタ画面 (`/project/:id`) を中心とした主要なコンポーネントの構造は以下の通りです。

- **`App.jsx`**: アプリケーションのルート。ルーティングの設定と、初期データ（プロジェクト一覧、グローバルアセット、パレット）の読み込みを行います。
  - **`Editor.jsx`**: ワークスペース全体を管理するコンテナコンポーネント。
    - **`Header.jsx`**: 上部のナビゲーションバー（戻るボタン、モード切替など）。
    - **`UnifiedSidebar.jsx`**: 左側のパネル。アセットリストの表示やツールの選択に使用します。
    - **Canvas Area** (状態に応じて切り替わる):
      - **`DesignCanvas.jsx`**: 【Part Design Mode】個々のアセット（家具や部屋）の形状（エンティティ）をSVGベースで編集します。
        - 描画は `ShapeRenderer`, `HandleRenderer`, `GridRenderer` などのサブコンポーネントに委譲されます。
      - **`LayoutCanvas.jsx`**: 【Room Layout Mode】アセットのインスタンスをフロアプラン上に配置します。
    - **Properties Area** (右側パネル、状態に応じて切り替わる):
      - **`DesignProperties.jsx`**: 選択中の形状（エンティティ）の色、サイズ、位置などを編集します。
      - **`LayoutProperties.jsx`**: 選択中のインスタンスのプロパティを編集します。

## 3. データフローと状態管理

アプリケーションは、状態管理に **Zustand** (`frontend/src/store/index.js`) を採用し、永続化のためにGoバックエンドを介してJSONファイルに保存します。

### 3.1 状態管理 (Zustand Slices)

ストアはドメインごとに分割されています。

- **`projectSlice.js`**:
  - `projects`: 全プロジェクトのメタデータ。
  - `currentProjectId`: 現在開いているプロジェクトのID。
  - `localAssets`: 現在のプロジェクトに固有のアセットデータ（形状やサイズ）。
- **`instanceSlice.js`**:
  - `instances`: レイアウトキャンバスに配置されたアセットのインスタンス（位置、回転角など）。
- **`assetSlice.js`**:
  - `globalAssets`: グローバルライブラリのアセット。
  - `colorPalette`, `defaultColors`: アプリ全体の色設定。
- **`uiSlice.js`**:
  - `mode`: 現在のモード (`layout` または `design`)。
  - `viewState`: キャンバスのパン・ズーム状態 (`x`, `y`, `scale`)。
  - `selectedIds`, `designTargetId`, `selectedShapeIndices`: 各種選択状態。

*※ `zundo` ミドルウェアを使用して、`localAssets` と `instances` の変更履歴を管理し、Undo/Redo機能を提供しています。*

### 3.2 データの保存と参照（ワークフロー）

データは以下のように流れます。

#### A. プロジェクトのロードフロー (`Editor.jsx` マウント時)
1. ユーザーが `/project/:id` にアクセス。
2. `projectSlice` の `loadProject(id, api)` アクションが発火。
3. ドメインロジック `frontend/src/domain/projectService.js` の `loadProjectData` が呼ばれる。
4. Goバックエンド (`app.go` の `GetProjectData`) を通じて `data/project_{id}.json` を読み込む。
   - *この際、バックエンドで古いデータ構造（`shapes` -> `entities`）のマイグレーションが自動的に行われます。*
5. データが空の場合、グローバルアセットをフォーク（`forkAsset`）して初期アセットとして設定。
6. Zustandストアにデータがセットされ、UIが描画される。

#### B. データの編集フロー (例: `DesignCanvas` での形状移動)
1. ユーザーがマウス操作を開始 (`onPointerDown`)。
2. 操作中 (`onPointerMove`) はパフォーマンスのため、コンポーネントローカルなReactのState (`localAsset`) のみを更新。
3. 操作終了時 (`onPointerUp` / `handleUp`) に、ドメインロジックのヘルパー関数 (`updateAssetEntities` など) またはストアのアクション (`setLocalAssets`) を呼び出す。
   - *重要: このタイミングで `calculateAssetBounds` が呼ばれ、アセット全体のバウンディングボックス(AABB)が再計算されます。*
4. Zustandストアが更新され、Undo/Redoの履歴が追加される。

#### C. 自動保存フロー (`useAutoSave` フック)
1. Zustandストアの `localAssets` または `instances` が変更される。
2. `frontend/src/hooks/useAutoSave.js` が変更を検知。
3. 一定時間のデバウンス後、ストアの `saveProjectData` アクションが発火。
4. Goバックエンド (`app.go` の `SaveProjectData`) にデータを送信し、`data/project_{id}.json` が上書き保存される。
   - *バックエンドでは、受信したデータを `models.go` で定義された厳格な構造体 (`ProjectData`) に一度マッピングして検証を行ってから保存します。*

## 4. 座標系について

このアプリケーションでは、２つの座標系が混在しており、変換が必要な点に注意してください。

- **論理座標系（デカルト座標系）**:
  - 内部データ、ストア、ファイルの保存に使用。
  - **Y-Up**: Y軸は上に向かって増加。原点 (0,0) は左下基準。
- **描画座標系（SVG/スクリーン座標系）**:
  - SVGでの描画やマウスイベントの処理に使用。
  - **Y-Down**: Y軸は下に向かって増加。原点 (0,0) は左上基準。

*変換処理は `frontend/src/domain/geometry.js` に集約されており、`toSvgY` や `toCartesianY` 関数を使用します。*

## 5. 今後のリファクタリング方針

1. **ドメインロジックの分離**:
   - `DesignCanvas.jsx` や `DesignProperties.jsx` に残っている複雑な計算や状態更新ロジックを、`frontend/src/domain/` 以下のサービス（`assetService.js` など）やカスタムフックにさらに切り出します。
2. **コンポーネントの責任範囲の明確化**:
   - UIの描画のみに専念するコンポーネント（Presentational Components）と、状態とロジックを管理するコンポーネント（Container Components）をより明確に分けます。
3. **データ更新の統一 (`updateAssetEntities`)**:
   - アセットの形状（`entities`）を変更する場合は、必ず `frontend/src/domain/assetService.js` の `updateAssetEntities` ヘルパーを使用し、バウンディングボックスの同期漏れを防ぎます。
4. **テストの拡充**:
   - Goバックエンドの構造体 (`models.go`) を活用し、データマイグレーションや保存ロジックの単体テスト (`app_test.go`) を充実させます。
