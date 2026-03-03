# リファクタリングおよびシステム分析ガイド (ANALYSIS_AND_PLAN.md)

このドキュメントは、`imohiyoko/roomGenerator` の現在のシステムアーキテクチャ、データフロー、主要な関数、および今後のリファクタリング計画をコントリビュータ向けに詳細に解説したものです。

## 1. 概要 (Overview)

`roomGenerator`（間取りアーキテクト Pro）は、間取り図（部屋のレイアウト）を生成・編集・管理するためのアプリケーションです。
Wailsフレームワークを使用し、バックエンドはGo、フロントエンドはReact（Vite）で構築されています。

最近のデータベースリファクタリング（`models.go`の導入）により、Go側のデータ構造が型安全になりました。次のステップとして、フロントエンドのロジックの分離、型・データの取り扱いの堅牢化、およびテストカバレッジの向上を目指します。

## 2. URL構造とルーティング (URL Structure & Routing)

アプリケーションは `react-router-dom` の `HashRouter` を使用してルーティングを行っています。
エントリポイントは `frontend/src/App.jsx` です。

| URLパターン | 対応コンポーネント | 説明 |
| :--- | :--- | :--- |
| `/` | `pages/Home.jsx` | ホーム画面。利用可能なプロジェクトのリストを表示します。 |
| `/library` | `pages/Library.jsx` | グローバルアセット（共有家具・設備など）を管理するライブラリ画面。 |
| `/project/:id` | `pages/Editor.jsx` | メインの編集画面。指定されたIDのプロジェクトを開きます。 |
| `/settings` | `pages/Settings.jsx` | グローバルなアプリケーション設定（色、デフォルト値など）の管理画面。 |

## 3. コンポーネント階層 (Component Hierarchy)

メインの編集画面である `Editor.jsx` は、以下の主要コンポーネントを統合しています。

- **`UnifiedSidebar.jsx`**: 画面左側のサイドバー。アセットやツールの選択を行います。
- **キャンバスエリア**: モードに応じて以下のいずれかが表示されます。
  - **`DesignCanvas.jsx`**: アセット自体（形状、ポリゴンなど）を編集・作成する「デザインモード」のキャンバス。
  - **`LayoutCanvas.jsx`**: 作成したアセット（インスタンス）を間取り図に配置する「レイアウトモード」のキャンバス。
- **プロパティパネル**: 画面右側に表示され、選択中のオブジェクトの属性を編集します。
  - **`DesignProperties.jsx`**: デザインモードで選択された形状要素（Entity）の色やサイズ、頂点などを編集します。
  - **`LayoutProperties.jsx`**: レイアウトモードで選択されたインスタンスの回転や位置などを編集します。
- **`Ruler.jsx`**: キャンバスの周囲に表示されるルーラー（定規）。

## 4. 状態管理 (State Management - Zustand)

グローバルな状態管理は `Zustand`（`frontend/src/store/index.js`）で行われており、`zundo` ミドルウェアによって Undo/Redo 機能がサポートされています。ストアは以下のスライス（Slice）に分割されています。

- **`projectSlice.js`**: `projects`, `localAssets`（プロジェクト固有のアセット）, `viewState`（パン/ズーム状態）などを管理。
- **`instanceSlice.js`**: キャンバス上に配置されたオブジェクト（`instances`）を管理。
- **`assetSlice.js`**: グローバルアセットやパレット情報などを管理。
- **`uiSlice.js`**: 選択状態（`selectedIds`, `selectedShapeIndices`）、モード切り替えなどのUI固有の状態を管理。
- **`settingsSlice.js`**: スナップ設定やグリッドサイズなどのエディタ設定を管理。

*※ `localAssets` と `instances`、`projectDefaultColors` が Undo/Redo (`zundo`) の対象となっています。*

## 5. データフローとワークフロー (Data Flow & Workflow)

ユーザーのアクションからデータがファイルに保存されるまでの典型的な流れは以下の通りです。

### プロジェクトの読み込みフロー
1. ユーザーが `/project/:id` にアクセスする。
2. `App.jsx` で初期のグローバルデータ（プロジェクト一覧、グローバルアセット、パレット）が読み込まれる。
3. `Editor.jsx` がマウントされ、`domain/projectService.js` の `loadProjectData` を呼び出す。
4. バックエンド（Go）の `GetProjectData(id)` が呼ばれ、`data/project_{id}.json` が読み込まれる。
5. Go側でマイグレーション（旧 `shapes` から `entities` への変換など）が行われ、構造体がパースされる。
6. フロントエンド側でデータが正規化され、Zustandストアに格納される。

### キャンバスでの編集と保存フロー
1. `DesignCanvas` 上でユーザーが図形をドラッグして移動させる。
2. ドラッグ中の高頻度な更新は、パフォーマンス上の理由からReactのローカルステート（`localAsset`）で管理される。
3. ユーザーがマウスボタンを離す（`onPointerUp`）と、変更がZustandストアの `updateAssetEntities` などを通じてグローバルステートに反映される。
4. Zustandのストア（`localAssets` または `instances`）が更新されると、カスタムフック `useAutoSave` が変更を検知する。
5. `useAutoSave` が一定時間経過後に バックエンドの `SaveProjectData` を呼び出す。
6. Go側でデータが `models.ProjectData` 構造体にアンマーシャルされて型検証が行われた後、`data/project_{id}.json` に保存される。

## 6. 座標系 (Coordinate System)

システム内では2つの異なる座標系が混在しており、変換が必要です。これらの変換ロジックは `frontend/src/domain/geometry.js` に集約されています。

- **Cartesian（論理・デカルト座標系）**:
  数学的な標準座標系。原点 (0,0) は左下にあり、**Y軸は上に向かって増加**します。
- **SVG（レンダリング座標系）**:
  ブラウザおよびSVGの標準座標系。原点 (0,0) は左上にあり、**Y軸は下に向かって増加**します。

`toSvgY` や `toCartesianY` などのヘルパー関数を使用して、論理データと画面描画データの相互変換を行います。（例：`toSvgY(y) => -y` のように、符号を反転させることで表現しています）

## 7. 今後のリファクタリング戦略 (Refactoring Strategy)

今後の開発およびコントリビューションにおいて、以下の点に重点を置いたリファクタリングを推奨します。

1. **ロジックのUIからの分離**
   - `DesignCanvas.jsx` などの肥大化したコンポーネントから、インタラクションロジック（ドラッグ、リサイズ、パンなど）を `useCanvasInteraction` のようなカスタムフックや純粋なロジック関数（例：`DesignCanvas.logic.js`）へ完全に分離する。
2. **型とドメインの整合性確保**
   - バックエンドの `models.go` の変更に合わせて、フロントエンドの Entity や Asset の扱いを標準化する。特に `points` や `w, h` の計算など、形状（Union Structパターン）に依存した処理をヘルパー関数に集約する。
3. **境界ボックス (AABB) ロジックの集約**
   - 形状の回転や移動に伴う境界ボックスの再計算ロジック（`calculateAssetBounds`, `updateAssetEntities`）を一元管理し、CanvasとPropertiesパネル間でのズレを防ぐ。
4. **テストの拡充**
   - Goバックエンドの純粋なロジックに対する単体テスト（`go test`）を記述する。
   - `playwright` 等を用いてフロントエンドの結合テストおよびビジュアルリグレッションテストの基盤を強化する。

コントリビュータは、コードを変更する前にこのドキュメントおよび `docs/` ディレクトリ内の他の設計ドキュメントを参照してください。
