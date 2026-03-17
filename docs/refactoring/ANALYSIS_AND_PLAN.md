# roomGenerator (間取りアーキテクト Pro) システム分析およびリファクタリング計画

このドキュメントは、`roomGenerator` プロジェクトの現状のアーキテクチャ、データフロー、主要な関数、および今後のリファクタリング戦略をコントリビュータ向けにまとめたものです。

## 1. URLとルーティング (URL & Routing)

アプリケーションは React Router (`HashRouter`) を使用してクライアントサイドのルーティングを行っています。

| URLパス | コンポーネント | 説明 |
| :--- | :--- | :--- |
| `/` | `frontend/src/pages/Home.jsx` | ホーム画面。作成済みのプロジェクト一覧を表示し、新規作成や開く操作を行います。 |
| `/library` | `frontend/src/pages/Library.jsx` | グローバルライブラリ画面。プロジェクト間で共有できるアセット（家具・設備など）を管理します。 |
| `/project/:id` | `frontend/src/pages/Editor.jsx` | メインの編集画面（エディタ）。指定されたIDのプロジェクトを読み込み、操作します。 |
| `/settings` | `frontend/src/pages/Settings.jsx` | アプリケーション全体のグローバル設定（デフォルトカラーなど）を管理します。 |

## 2. コンポーネント階層 (Component Hierarchy)

UIは複数の主要なコンポーネントブロックから構成されており、特に `Editor.jsx` が中心的な役割を果たします。

- **`App.jsx`**: アプリケーションのルート。ルーティングの定義と、起動時のグローバルデータ（プロジェクト一覧、グローバルアセット、パレット情報など）の初期読み込みを行います。
- **`Editor.jsx`**: 指定されたプロジェクトのワークスペース全体をオーケストレーションします。以下のサブコンポーネントを配置・管理します。
  - **`Header.jsx`**: 画面上部のヘッダー。Undo/Redoボタンやプロジェクト設定へのアクセスを提供します。
  - **`UnifiedSidebar.jsx`**: 画面左側のサイドバー。アセットの一覧表示、選択、ドラッグ＆ドロップによるインスタンス追加操作を提供します。
  - **キャンバスエリア**: 現在のモード(`mode`)に応じて以下のいずれかを表示します。
    - **`LayoutCanvas.jsx`**: 「レイアウトモード」。部屋や家具（インスタンス）を間取り図として配置・操作するためのキャンバスです。
    - **`DesignCanvas.jsx`**: 「パーツ設計モード」。個々のアセット（家具や設備）の形状（ポリゴン、円、テキストなど）を作成・編集するためのキャンバスです。
  - **プロパティパネル**: 画面右側のサイドバー。現在のモードに応じて以下のいずれかを表示します。
    - **`LayoutProperties.jsx`**: レイアウトモード時に、選択されたインスタンスのプロパティ（位置、回転、色など）を編集します。
    - **`DesignProperties.jsx`**: パーツ設計モード時に、選択された形状（Shape）のプロパティ（頂点、半径、テキストなど）を編集します。
  - **`Ruler.jsx`**: キャンバスのスケールを示す定規コンポーネント。

## 3. 状態管理とデータフロー (State Management & Data Flow)

グローバルな状態管理には **Zustand** を使用しており、`frontend/src/store/` ディレクトリで各スライス（機能ごとの状態）に分割して管理しています。また、Undo/Redo機能には `zundo` ミドルウェアを利用しています。

### 主要なストア（スライス）

- **`projectSlice.js`**: プロジェクト全体のデータ（`projects`一覧、現在の`currentProjectId`、キャンバスの`viewState`）を管理します。
- **`assetSlice.js`**: アセット（Blueprint）に関するデータ（`localAssets`、`globalAssets`）を管理します。
- **`instanceSlice.js`**: レイアウト上に配置されたインスタンス(`instances`)を管理します。
- **`uiSlice.js`**: UIの表示状態（現在の`mode`、選択中の`selectedIds`、サイドバーの開閉状態・幅など）を管理します。サイドバーの幅などの一部設定は `localStorage` に永続化されます。
- **`settingsSlice.js`**: カラーパレットなどの設定データを管理します。

### データの読み込みと保存のワークフロー

**プロジェクト読み込み:**
1. ユーザーが `/project/:id` にアクセスすると、`Editor.jsx` がマウントされ、Zustandストアの `loadProject(id)` アクションを呼び出します。
2. `loadProject` は内部で `frontend/src/domain/projectService.js` の `loadProjectData` を呼び出します。
3. `loadProjectData` はGoバックエンド（`API.getProjectData(id)`）経由で、`data/project_{id}.json` ファイルからデータを読み込みます。
4. 読み込んだデータは、必要に応じて正規化（レガシーな `shapes` 配列を `entities` に変換するなど）され、Zustandストアに格納されます。
5. プロジェクトデータが空の場合、グローバルアセットから初期のローカルアセットをフォーク（複製）して配置します。

**プロジェクト保存:**
1. キャンバス上でユーザーが操作（インスタンスの移動、アセットの形状変更など）を行うと、Zustandストアが即座に更新されます。
2. `useAutoSave` フックがストアの変更を検知します。
3. 一定のデバウンス処理後、`saveProjectData` アクションがトリガーされ、`localAssets` と `instances` をバックエンド（`API.SaveProjectData`）に送信します。
4. バックエンドはデータ構造を検証し、`data/project_{id}.json` に書き込みます。

## 4. 主要な関数とドメインロジック (Key Functions & Domain Logic)

ビジネスロジックは主に `frontend/src/domain/` と `frontend/src/lib/` にカプセル化されています。

- **`frontend/src/domain/projectService.js`**
  - **`loadProjectData(projectId, api)`**: プロジェクトデータ、グローバルアセット、カラーパレットを並行してロードし、正規化やマージを行った上で統合された状態オブジェクトを返します。
- **`frontend/src/domain/assetService.js`**
  - **`updateAssetEntities(asset, entities)`**: アセットの形状（`entities`）を更新する際の標準関数。変更に伴い、AABB（Axis-Aligned Bounding Box）の再計算を自動的に行い、整合性を保ちます。
  - **`forkAsset(asset, defaultColors)`**: グローバルアセットからプロジェクトローカルなアセットへのディープコピーを作成します（新しいIDの付与、デフォルトカラーの適用など）。
- **`frontend/src/domain/geometry.js` / `frontend/src/lib/utils.js`**
  - **`calculateAssetBounds(entities)`**: 複数のエンティティから構成されるアセットの全体的なバウンディングボックス（AABB）を計算します。
  - **座標変換ユーティリティ**: バックエンドの直交座標系（Y-Up）とフロントエンド（SVG）の描画座標系（Y-Down）を相互に変換する関数群（`toSvgY`、`toCartesianY`など）を提供します。

## 5. データの保存とバックエンド (Data Persistence & Backend)

バックエンド（Go）は主にローカルファイルシステムへのJSONデータの読み書きを担当し、`app.go` に処理が実装されています。
データは実行ファイルに対する相対パスである `data/` ディレクトリに保存されます。

- **`models.go`**: データの型安全性を担保するための構造体（`ProjectData`, `Asset`, `Entity`, `Instance`, `Point`, `Vec2`）が定義されています。フロントエンドから送られるJSONデータは、ここで一度型チェックとマッピングが行われます。
- **`app.go`**
  - **`GetProjectData`**: 古い形式のJSONから新しい形式（`entities`）へのマイグレーションを透過的に行いながらデータを読み込みます。
  - **`SaveProjectData`**: `interface{}` で受け取ったデータを一度 `ProjectData` 構造体にアンマーシャルしてスキーマ検証を行い、安全なデータのみをファイルに書き込みます。

## 6. リファクタリング戦略と提案 (Refactoring Strategies & Proposals)

現状のアーキテクチャ分析に基づき、以下のリファクタリングを提案します。

1. **コンポーネントとロジックのさらなる分離**
   - `DesignCanvas.jsx` や `LayoutCanvas.jsx` には、まだUIの描画と複雑なインタラクションロジックが混在している部分があります（一部は `DesignCanvas.logic.js` に抽出済み）。イベントハンドリング（ドラッグ、パン、ズーム）と描画コンポーネントを完全に分離するカスタムフック（例：`useCanvasInteraction`）の利用を推進し、コンポーネントの肥大化を防ぎます。
2. **型定義の強化とドキュメント化**
   - フロントエンド側ではJavaScriptを使用していますが、Goバックエンドの `models.go` とのデータ構造の一致を確実にするため、JSDoc (`@typedef`) による型の明記を `src/domain/` 以下のファイルに徹底します。
3. **Zustandストアの最適化**
   - ストアの更新頻度が高い操作（例：ドラッグ中のマウス移動）において、不要な再レンダリングを防ぐため、一時的な状態（`localAsset`など）と最終的なストアのコミットの使い分けのパターン（`DesignCanvas.jsx` で採用済み）を他の機能にも適用・標準化します。
4. **定数とマジックナンバーの排除**
   - 各コンポーネントに散在しているサイズ、色、デフォルト値などのマジックナンバーを `src/lib/constants.js` または設定管理モジュールに集約します。
5. **テストカバレッジの向上**
   - `docs/TEST_IMPLEMENTATION_PLAN.md` に基づき、ビジネスロジック（`domain/` および `lib/utils.js`）のフロントエンドユニットテスト（JestまたはVitest）および、バックエンドのデータマイグレーションロジック（`app_test.go`）のテストを拡充します。

---

*このドキュメントはシステムの変更に応じて随時更新してください。変更を加える前に、アーキテクチャの全体像を把握するために活用してください。*
