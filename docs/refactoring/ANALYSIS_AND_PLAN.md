# 間取りアーキテクト Pro (roomGenerator) 構造とデータフロー

このドキュメントは、アプリケーションの全体的な構造、関数リスト、コンポーネント構成、URLルーティング、およびデータがどのように保存・参照されているか（ワークフロー）をまとめたものです。将来のリファクタリングや機能追加を行うコントリビュータ向けのガイドとして機能します。

## 1. アプリケーションの全体像

roomGeneratorは、Go言語とWailsをバックエンドに、ReactとZustandをフロントエンドに採用したデスクトップアプリケーションです。
主に以下の2つのモード（用途）を提供します。

1.  **デザインモード (Design Mode)**: 個々の家具や設備（アセット）の形状（Polygon, Circle, Textなど）を描画・編集するモード。
2.  **レイアウトモード (Layout Mode)**: 作成したアセットをインスタンスとして配置し、部屋全体の間取り図を作成するモード。

## 2. URLとルーティング構造

フロントエンドは `react-router-dom` (HashRouter) を使用してルーティングを行っています。

| URLパターン | コンポーネント (ファイルパス) | 説明 |
| :--- | :--- | :--- |
| `/` | `Home.jsx` (`frontend/src/pages/Home.jsx`) | ホーム画面。プロジェクトの新規作成、一覧表示、削除を行う。 |
| `/library` | `Library.jsx` (`frontend/src/pages/Library.jsx`) | グローバルアセット（全体で共有されるプリセットパーツ）の管理画面。 |
| `/project/:id` | `Editor.jsx` (`frontend/src/pages/Editor.jsx`) | プロジェクト編集のメイン画面。この中でモード（デザイン/レイアウト）が切り替わる。 |
| `/settings` | `Settings.jsx` (`frontend/src/pages/Settings.jsx`) | アプリケーション全体の共通設定（カラーパレットやデフォルト値）を管理する画面。 |

## 3. コンポーネントの階層と役割 (Editor内)

`/project/:id` (Editor) の画面は、以下の主要なコンポーネントで構成されています。

-   **`Editor.jsx`**: メインのコンテナ。ルーティングからIDを受け取り、プロジェクトデータをストアにロードし、全体を管理する。
    -   **`Header.jsx`**: 上部ナビゲーション。モード切替、元に戻す/やり直し（Undo/Redo）、ホームへの戻るボタンなどを配置。
    -   **`UnifiedSidebar.jsx`**: 左側のサイドバー。利用可能なアセットのリストを表示し、キャンバスへの追加をトリガーする。
    -   **中央キャンバス (モードによって切り替え)**:
        -   **`DesignCanvas.jsx`**: デザインモード時。選択された単一のアセットを構成する形状（Shape/Entity）を編集する。
            -   *ロジックの分離*: 複雑なドラッグやリサイズ処理は `DesignCanvas.logic.js` に抽出されている。
        -   **`LayoutCanvas.jsx`**: レイアウトモード時。間取り図上に複数のアセットのインスタンスを配置・回転・移動する。
    -   **右側プロパティパネル (モードによって切り替え)**:
        -   **`DesignProperties.jsx`**: デザインモード時。選択された形状（Polygonの頂点、円の半径、色など）のプロパティを編集する。
        -   **`LayoutProperties.jsx`**: レイアウトモード時。選択されたインスタンスの座標、回転角、色などのプロパティを編集する。

## 4. データ構造とバックエンド API

バックエンド（Go）は `app.go` と `models.go` に分かれています。JSONとの相互変換を安全に行うため、構造体が明確に定義されています。

### 主要な構造体 (`models.go`)
-   `ProjectData`: 1つのプロジェクトの全データ（`LocalAssets`と`Instances`を含む）。
-   `Asset`: アセット（家具や設備）の定義。`Entities`（形状の配列）を持つ。
-   `Entity`: アセットを構成する1つの形状（Polygon, Circleなど）。Union Structパターンを採用しており、すべてのプロパティのフィールドを持つが、使わないものは省略(`omitempty`)される。
-   `Instance`: `LayoutCanvas` に配置されたアセットの実体。座標(`X`, `Y`)や回転角(`Rotation`)を持つ。

### 主要なバックエンド関数 (`app.go`)
フロントエンドから `API.*` (例: `API.getProjectData()`) を通じて呼び出されます。

-   `GetProjects()`: 既存のプロジェクト一覧を取得。
-   `CreateProject(name)`: 新しいプロジェクトを作成し、一意のIDを返す。
-   `GetProjectData(id)`: プロジェクトのJSONファイル（`data/project_{id}.json`）を読み込み、構造体にマッピングして返す（古いフォーマットのマイグレーションも担当）。
-   `SaveProjectData(id, data)`: フロントエンドから送られたプロジェクトデータをJSONにシリアライズしてファイルに保存する。型安全性のチェックを含む。
-   `GetAssets() / SaveAssets()`: グローバルアセット（`data/global_assets.json`）の読み書き。

## 5. 状態管理 (Zustand + zundo)

フロントエンドの状態管理は `Zustand` を用い、`frontend/src/store/` 配下で管理されています。また、`zundo` ミドルウェアにより Undo/Redo の履歴管理が行われています。

-   **`projectSlice.js`**: プロジェクト固有のデータ（`localAssets`, `instances`, `viewState`）を管理する。最も頻繁に更新される中心的なストア。
-   **`uiSlice.js`**: モード（`mode`: 'layout' or 'design'）や、選択されている要素のID（`designTargetId`, `selectedShapeIndices`, `selectedIds`）などのUI状態を管理。
-   **`assetSlice.js` / `settingsSlice.js`**: グローバルアセットや設定（カラーパレットなど）を管理。

### データフロー (保存と参照のワークフロー)

#### 1. プロジェクトのロード時 (`Editor.jsx` マウント時)
1.  URLのパラメータからプロジェクトIDを取得。
2.  `API.getProjectData(id)` を呼び出し、バックエンドからデータを取得。
3.  取得したデータを `projectSlice` の `localAssets` と `instances` にセット。
4.  これにより、CanvasやSidebarが再描画される。

#### 2. キャンバス上での編集時 (例：形状の移動)
1.  ユーザーが `DesignCanvas` 上で形状をドラッグする。
2.  `onPointerMove` イベント中、**高頻度な更新によるパフォーマンス低下を防ぐため、Reactのローカルステート (`localAsset`) のみを更新し、画面に即座に反映**する。
3.  ユーザーがドラッグを終了（`onPointerUp`）したタイミングで、最終的な座標を Zustand ストアの `setLocalAssets` を用いてグローバルステートにコミットする。
4.  これにより、`zundo` ミドルウェアが変更履歴（Undoスタック）を記録する。

#### 3. データの自動保存 (`useAutoSave.js` フック)
1.  `projectSlice` のデータ（`localAssets`, `instances`）に変更があったことを監視。
2.  変更後、一定時間（デバウンス処理）経過すると自動的にトリガーされる。
3.  `API.saveProjectData(id, currentData)` を呼び出し、バックエンドへ送信。
4.  バックエンドが `data/` ディレクトリ内のJSONファイルを上書き保存。

## 6. ドメインロジックの分離

幾何学計算やアセットのデータ操作など、UIに依存しない純粋なロジックは以下のディレクトリに分離されています。

-   **`frontend/src/domain/geometry.js`**:
    -   座標変換、回転計算、AABB（Axis-Aligned Bounding Box: 境界ボックス）の計算、SVGパスの生成など。
-   **`frontend/src/domain/assetService.js`**:
    -   `updateAssetEntities`: アセット内のエンティティを更新し、同時にAABB（アセットの幅・高さ、中心点）を再計算して一貫性を保つためのヘルパー関数。
-   **`frontend/src/components/DesignCanvas.logic.js`**:
    -   `DesignCanvas.jsx` が肥大化するのを防ぐため、ドラッグやリサイズの複雑なインタラクション処理 (`initiate*` および `process*` 関数群) を抽出したもの。

## 7. 今後のリファクタリング方針

この構造を踏まえ、将来的なリファクタリングでは以下の点に留意する必要があります。

1.  **コンポーネントの責務の明確化**: `DesignCanvas` や `DesignProperties` など、依然としてコード量が多いコンポーネントを、さらに小さな表示用コンポーネントに分割する。
2.  **AABBの計算ロジックの一元化**: 形状を追加・削除・変更した際、必ず `updateAssetEntities` などの共通のドメインロジックを経由してアセットのサイズ(`W`, `H`)が再計算されるように徹底し、UIコンポーネント側で直接 `w` や `h` を書き換えないようにする。
3.  **型安全性のフロントエンドへの拡張**: バックエンド（Go）は型安全になったため、フロントエンドでも JSDoc（`@typedef`）や TypeScript を活用し、`Entity` や `Instance` の構造を明示的に定義する。
