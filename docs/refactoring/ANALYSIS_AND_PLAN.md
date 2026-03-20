# 間取りアーキテクト Pro (v5.7) - アーキテクチャ分析とリファクタリング計画

このドキュメントは、現在の`roomGenerator`のアーキテクチャ全体を俯瞰し、各コンポーネントの責務、データフロー、およびリファクタリング計画をコントリビュータ向けにわかりやすく解説するものです。

## 1. システム概要とURL構造

本アプリケーションは、React (Vite) をフロントエンド、Go (Wails) をバックエンドとしたデスクトップアプリケーションです。
クライアントサイドのルーティングには `HashRouter` を使用しています。

| URL | コンポーネント | 役割 |
|---|---|---|
| `/` | `frontend/src/pages/Home.jsx` | プロジェクト一覧画面。新規プロジェクト作成や既存プロジェクトの選択を行う。 |
| `/library` | `frontend/src/pages/Library.jsx` | グローバルアセット（家具・建具など）の管理、カラーパレットの編集。 |
| `/project/:id` | `frontend/src/pages/Editor.jsx` | メインエディタ画面。指定されたプロジェクトの編集を行う。 |
| `/settings` | `frontend/src/pages/Settings.jsx` | アプリケーション全体のグローバル設定（色、デフォルト設定など）。 |

## 2. コンポーネント階層と主要モジュール

UIは以下の主要コンポーネントで構成されています。

- **`App.jsx`**: アプリケーションのルート。ルーティングの設定と、初期起動時のグローバルデータ（プロジェクト一覧、アセット、パレット）の取得を行う。
- **`Editor.jsx`**: エディタのメインコンテナ。以下のサブコンポーネントを統合管理する。
  - **`UnifiedSidebar.jsx`**: 左側パネル。アセットライブラリの表示やフィルタリング。
  - **`DesignCanvas.jsx`**: 「設計モード」。個々のアセット（形状、ポリゴンなど）を作成・編集するキャンバス。
  - **`LayoutCanvas.jsx`**: 「配置モード」。作成したアセットを間取り図に配置するためのキャンバス。
  - **`DesignProperties.jsx`**: 右側パネル（設計モード）。選択した形状の詳細プロパティを編集。
  - **`LayoutProperties.jsx`**: 右側パネル（配置モード）。選択したインスタンスの詳細プロパティを編集。
  - **`Ruler.jsx`**: キャンバスのガイド定規。

### 2.1 DesignCanvas の責務分割 (New Refactoring)

`DesignCanvas.jsx` は大規模化していたため、描画責務を以下のサブコンポーネント（`frontend/src/components/canvas/` に配置）に分割しています。

- **`GridRenderer.jsx`**: キャンバス背景のグリッドとスナップラインの描画を担当。
- **`ShapeRenderer.jsx`**: ポリゴン、円形、テキストなど各種エンティティのSVG描画を担当。
- **`HandleRenderer.jsx`**: 選択された形状のバウンディングボックス、リサイズハンドル、頂点ハンドルの描画を担当。

これにより `DesignCanvas.jsx` 自体は「イベントハンドリング」と「状態の統合（Logicファイルとの連携）」のみに集中するコンテナとして機能します。

## 3. 状態管理とデータフロー

### 3.1 Zustandによる状態管理
グローバルな状態管理には **Zustand** を使用し、`frontend/src/store/` 内で機能ごとにスライス分割しています。
Undo/Redo機能には `zundo` ミドルウェアを利用しています。

- **`projectSlice.js`**: コアデータ（`projects`, `localAssets`, `instances`, `viewState`）を管理。
- **`assetSlice.js`**: アセット関連の状態。
- **`uiSlice.js`**: サイドバーの開閉状態など、UI固有の状態を管理。
- **`instanceSlice.js`**: インスタンス関連の状態。
- **`settingsSlice.js`**: アプリケーション設定。

### 3.2 データフローの仕組み

**プロジェクト読み込み時:**
1. ユーザーが `/project/:id` にアクセス。
2. `Editor.jsx` がマウントされ、`projectSlice` の `loadProject(id)` アクションを呼び出す。
3. `loadProject` はバックエンドの `API.getProjectData(id)` を実行。
4. バックエンドはローカルディスク（`data/project_{id}.json`）からデータを読み込む。
5. フロントエンドでデータが正規化され、Zustandストアに格納される。

**プロジェクト保存時:**
1. ユーザーがキャンバスを操作し、Zustandのストアが更新される。
2. `useAutoSave` カスタムフックが変更を検知。
3. `API.saveProjectData(id)` を呼び出し、現在の `localAssets` と `instances` をバックエンドに送信。
4. バックエンドがJSONファイルとして永続化する。

### 3.3 座標系とデータ形式 (Cartesian vs SVG)

本アプリケーションでは2つの座標系が混在しています。コントリビュータはデータ操作時にこの違いを意識する必要があります。

1. **論理座標系 (Cartesian / データモデル)**:
   - バックエンドの JSON および Zustandストア 内で保持される座標データ。
   - 原点 `(0, 0)` は中心などに配置され、数学的に直感的な直交座標系（Y軸が上方向）となることが多い。
   - 例: `models.go` の `Vec2` や `Point`、`asset.entities[0].points` のデータ。
2. **描画座標系 (SVG)**:
   - 画面描画用に使用される座標系。
   - 原点 `(0, 0)` は左上にあり、Y軸は**下方向**が正となる。
   - 変換: この変換は `frontend/src/domain/geometry.js` に集約されています。例えば `toSvgY(y)` 関数を利用して Cartesian -> SVG 変換を行います。

**ワークフロー: 形状(Shape)の追加・更新**
1. ユーザー操作イベントは `DesignCanvas.logic.js` などのロジック層で捕捉されます。
2. ロジックは幾何計算（`domain/geometry.js`）を呼び出し、新しい論理座標（Cartesian）を計算します。
3. `assetService.js` の `updateAssetEntities()` ヘルパーを使ってエンティティを更新します。これによりバウンディングボックス（AABB）の再計算も自動的に行われます。
4. React state が更新されると、`ShapeRenderer` が `toSvgY()` などを用いてSVGパスへと変換・描画します。

## 4. コアドメインロジック

複雑なビジネスロジックはコンポーネントから分離され、以下のモジュールに集約されています。

- **`calculateAssetBounds(entities)`** (`src/lib/utils.js`):
  エンティティ群のAABB（Axis-Aligned Bounding Box: 軸平行境界ボックス）を計算。アセットの中心やサイズ決定に不可欠。
- **`updateAssetEntities(asset, entities)`** (`src/domain/assetService.js`):
  アセット内のエンティティを更新し、整合性を保つために境界ボックス（`w`, `h`, `boundX`, `boundY`）を自動再計算する。
- **`normalizeAsset(asset)`** (`src/lib/utils.js`):
  古いデータ形式（例: `shapes` 配列を `entities` にリネーム）をマイグレーションし、互換性を維持する。
- **`forkAsset(asset, defaultColors)`** (`src/domain/assetService.js`):
  グローバルアセットを現在のプロジェクト用にディープコピーし、新しいIDを付与する。
- **`domain/geometry.js`**: (New)
  座標変換（`toSvgY`, `toCartesianY`）、バウンディングボックス計算（`getRotatedAABB`）、SVGパス生成（`generateSvgPath`）など、幾何学的な純粋関数の集約場所。

## 5. バックエンド (Go / Wails)

`app.go` に実装されており、主にファイルシステムとのブリッジとして機能します。

- **主要なメソッド**:
  - `GetProjectData(id string)`: 指定されたプロジェクトデータを読み込み、必要に応じてレガシーJSONのマイグレーションを実施。
  - `SaveProjectData(id string, data interface{})`: プロジェクトデータを検証し、`data/project_{id}.json` に保存する。
  - `ImportProject(name, json)` / `ExportProject(id)`: プロジェクト全体のインポート・エクスポートを処理。

---

## 6. リファクタリング方針とコントリビュータ向けガイド

現在のアーキテクチャは初期の一枚岩(単一HTML)から大きく改善されましたが、一部のコンポーネント（特に `DesignCanvas.jsx` と `DesignProperties.jsx`）は依然として責務が大きく、複雑です。

### 6.1 課題と改善目標

1. **コンポーネントの巨大化**: `DesignCanvas.jsx` は大規模化していたため、描画責務を `frontend/src/components/canvas/` ディレクトリ配下のサブコンポーネント（`GridRenderer.jsx`, `ShapeRenderer.jsx`, `HandleRenderer.jsx`）に分割しました。これにより、`DesignCanvas.jsx` はイベントハンドリングと状態統合に集中できるようになりました。
2. **ロジックの分離**: `frontend/src/components/DesignCanvas.logic.js` への抽出が進んでいますが、さらにUI描画とビジネスロジックを明確に分離する必要があります。
3. **テストカバレッジ**: フロントエンドのユニットテストや、PlaywrightによるE2Eテストの拡充が必要です。

### 6.2 コントリビュータへの推奨ワークフロー

1. **バグ修正や機能追加を行う前**:
   - 必ずこの `ANALYSIS_AND_PLAN.md` を確認し、全体像を把握してください。
   - `docs/` ディレクトリ内の他の関連ドキュメント（`ROUTING.md`, `STATE_MANAGEMENT.md` など）も参照してください。
2. **コードの変更**:
   - UIの描画のみに関わる変更は `*.jsx` コンポーネント内で行います。
   - ドラッグ操作や座標計算などの複雑なロジックは、対応する `.logic.js` や `domain/` 内のモジュールに抽出・追加してください。
3. **検証**:
   - 変更後は必ず `cd frontend && npm run dev` でローカルサーバーを起動し、動作確認を行ってください。
   - バックエンドの変更時は `go test ./...` を実行してください。（※事前にフロントエンドのビルド `npm run build` が必要です）。

### 6.3 今後のリファクタリング計画（予定）

- `DesignProperties.jsx` の細分化。
- `NumberInput.jsx` を利用した座標入力の安定化・バグ修正。
- 幾何計算モジュール（`geometry.js`）の共通化とテスト追加。
