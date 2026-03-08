# roomGenerator システム分析・リファクタリング計画 (ANALYSIS AND PLAN)

本ドキュメントは、`roomGenerator` の全体構造（コンポーネント、状態管理、データフロー、バックエンド連携）を整理し、今後のリファクタリング方針をコントリビュータ向けに明確にするためのものです。

## 1. 全体アーキテクチャ概要

`roomGenerator` は、Go(Wails) をバックエンド、React(Vite) をフロントエンドとしたデスクトップアプリケーションです。
- **フロントエンド**: ユーザーインターフェース、キャンバス描画（SVG）、状態管理（Zustand）。
- **バックエンド**: ローカルファイルシステム(`data/` ディレクトリ) への JSON データの読み書き、Wails を介したブリッジ通信。

---

## 2. フロントエンドの構造 (URL・コンポーネント・機能)

アプリケーションは `react-router-dom` を使用したハッシュルーティング（`HashRouter`）で画面遷移を行います。

### 2.1 URL と ページコンポーネント
| URL パス | ページコンポーネント | 役割 |
|---|---|---|
| `/` | `pages/Home.jsx` | プロジェクト一覧の表示、新規プロジェクト作成。 |
| `/library` | `pages/Library.jsx` | グローバルアセット（共有家具・設備）およびカラーパレットの管理。 |
| `/project/:id` | `pages/Editor.jsx` | メインの編集画面。Canvas とプロパティパネルを統括。 |
| `/settings` | `pages/Settings.jsx` | アプリケーション全体のグローバル設定。 |

### 2.2 主要コンポーネント構成 (`Editor.jsx` 内)
- **`UnifiedSidebar.jsx`**: 左側パネル。アセットやツールの選択を行う。
- **キャンバスエリア**: モードに応じて切り替わる。
  - **`DesignCanvas.jsx`**: アセット（個別の家具など）の形状を編集するモード。SVGを用いた詳細な編集。
    - **`canvas/GridRenderer.jsx`**: グリッド（背景）の描画。
    - **`canvas/ShapeRenderer.jsx`**: 各シェイプ（図形）の描画。
    - **`canvas/HandleRenderer.jsx`**: 選択時のリサイズや回転ハンドルの描画。
    - マウス操作のロジックは `hooks/useCanvasInteraction.js` および `DesignCanvas.logic.js` に分離されています。
  - **`LayoutCanvas.jsx`**: 作成したアセットを部屋の間取りに配置するモード。
- **プロパティパネル**: 選択中の要素に応じて右側に表示される。
  - **`DesignProperties.jsx`**: 選択されたシェイプ（図形）のプロパティ（色、サイズなど）を編集。
  - **`LayoutProperties.jsx`**: 配置されたインスタンスのプロパティを編集。

---

## 3. 状態管理とデータフロー (Zustand)

状態管理は `frontend/src/store/` 内で Slice ごとに分割され、`index.js` で統合されています。`zundo` ミドルウェアにより Undo/Redo (履歴管理) が実装されています。

### 3.1 データの保存と参照（Store）
- **`projectSlice.js`**: プロジェクト全体のロード・保存アクション。
- **`assetSlice.js`**: `localAssets` (プロジェクト固有のアセット定義) と `globalAssets` (ライブラリ全体のアセット)。
- **`instanceSlice.js`**: `instances` (LayoutCanvas 上に配置されたアセットのインスタンス情報)。
- **`uiSlice.js`**: キャンバスの表示状態 (`viewState`)、選択状態 (`selectedIds`, `selectedShapeIndices`)、編集モード (`mode: 'layout' | 'design'`) などの UI 状態。

### 3.2 データの流れとワークフロー (Workflow)

1. **初期ロード (`App.jsx`)**:
   - `API.getProjects()`, `API.getAssets()`, `API.getPalette()` を呼び出し、グローバルデータを Store に格納。
2. **プロジェクト読み込み (`Editor.jsx`)**:
   - `/project/:id` に遷移すると、`useStore.getState().loadProject(id)` が発火。
   - バックエンド API `GetProjectData(id)` を呼び出し、結果を Store (`localAssets`, `instances`) に展開。
   - レガシーデータ形式からの正規化 (`domain/projectService.js`) もここで行われる。
3. **ユーザー操作 (キャンバス編集)**:
   - 例: `DesignCanvas` で図形をドラッグ。
   - ドラッグ中 (`onPointerMove`) はパフォーマンス最適化のためローカル State (`localAsset`) のみを更新。
   - ドロップ時 (`onPointerUp`) に Store の `setLocalAssets` を呼び出し、変更をコミット（ここで Undo 履歴が作成される）。
4. **自動保存 (`useAutoSave`)**:
   - Store の `localAssets` または `instances` の変更を検知。
   - `API.SaveProjectData(id, data)` を通じてバックエンドにデータを送信し、JSON ファイルとして永続化。

---

## 4. ドメインロジックの分離

複雑なビジネスロジックや計算処理はコンポーネントから分離されています。
- **`frontend/src/domain/assetService.js`**: アセットのエンティティ更新 (`updateAssetEntities`)、グローバルアセットからのフォーク (`forkAsset`) など。AABB (境界ボックス) の再計算もここで統一。
- **`frontend/src/domain/geometry.js`**: 座標変換 (`toSvgY`, `toCartesianY`)、回転、スナップ処理などの純粋な幾何学計算。

---

## 5. バックエンド (Go) の構造と保存処理

バックエンドの主な役割はデータの型安全な永続化です。

### 5.1 主要なファイルと構造体
- **`main.go`**: エントリーポイント、Wails の初期化。
- **`app.go`**: API メソッドの実装。`GetProjectData`, `SaveProjectData` などフロントから呼ばれる関数群。
- **`models.go`**: `ProjectData`, `Asset`, `Entity`, `Instance` などの静的型付けされた構造体定義。

### 5.2 データの保存戦略 (マイグレーションと型検証)
- **読み込み (`GetProjectData`)**: `data/project_{id}.json` を読み込む際、新しい構造体 (`ProjectData`) へのバインドを試み、失敗した場合やレガシー形式 (`shapes` 配列など) の場合はマップ変換を利用して内部で最新形式にマイグレーション（正規化）します。
- **保存 (`SaveProjectData`)**: フロントから受け取った `interface{}` 型のデータを一旦 JSON にマーシャルし、再度 `ProjectData` 構造体にアンマーシャルすることで**型と構造の厳密な検証**を実施してから保存します。

---

## 6. 今後のリファクタリング計画 (Plan)

*既に `DesignCanvas` の UI 分離（`canvas/` サブコンポーネントの導入）およびイベントハンドリングの切り出し（`useCanvasInteraction.js`）は完了しました。*

今後は以下のリファクタリングを提案します。

1. **型安全性のフロントエンド側への導入**:
   - JSDocによる `@typedef` を強化し、バックエンドの `models.go` と整合性のとれた型チェックをフロントエンドにも導入する（TypeScript化の布石）。
2. **`LayoutCanvas` の整理**:
   - `DesignCanvas` と同様に、イベントハンドリングや描画処理の分割を検討する。
