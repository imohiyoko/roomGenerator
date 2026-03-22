# roomGenerator リファクタリング分析および計画書 (Analysis and Plan)

本ドキュメントは、`roomGenerator` (間取りアーキテクト Pro) の全体的なシステム構造、データフロー、主要コンポーネントの役割を整理し、今後のリファクタリングを円滑に進めるためのガイドラインを提供するものです。

## 1. システム概要
`roomGenerator` は、Wailsフレームワークを利用し、バックエンドをGo、フロントエンドをReact(Vite)で構築したデスクトップアプリケーションです。
- **フロントエンド**: React, Vite, TailwindCSS, Zustand (状態管理)
- **バックエンド**: Go (Wails App バインディング)
- **データ永続化**: ローカルファイルシステム (`data/` ディレクトリ内のJSONファイル)

## 2. URL構造とルーティング
フロントエンドのルーティングには `react-router-dom` の `HashRouter` を使用しています。

| URLパス | コンポーネント (`pages/`) | 役割と影響範囲 |
|---|---|---|
| `/` | `Home.jsx` | ランディングページ。プロジェクトの一覧表示と新規作成を行います。 |
| `/library` | `Library.jsx` | グローバルなアセット（共有家具・設備）とカラーパレットの管理画面です。 |
| `/project/:id` | `Editor.jsx` | 特定のプロジェクトを編集するメイン画面です。URLの `:id` パラメータからプロジェクトデータを読み込みます。 |
| `/settings` | `Settings.jsx` | アプリケーションのグローバル設定画面です。 |

## 3. 主要コンポーネントツリーと役割
編集画面（`/project/:id`）の中心となる `Editor.jsx` は、以下の主要コンポーネントで構成されています。

- **`Editor.jsx`**: 全体のオーケストレーター。URLからプロジェクトIDを取得し、Zustandストアにデータをロード（`loadProject`）します。
  - **`UnifiedSidebar.jsx`**: 左側のパネル。利用可能なアセット（家具など）の一覧やツール選択を提供します。
  - **`Header.jsx`**: 上部のナビゲーションバー。プロジェクト名やUndo/Redo、設定ボタンを配置します。
  - **Canvas群** (中央のメイン描画エリア):
    - **`DesignCanvas.jsx`**: 「パーツ設計モード」時。個々のアセットを構成する形状（図形）の作成・編集（リサイズ、頂点移動など）を行います。
    - **`LayoutCanvas.jsx`**: 「レイアウトモード」時。部屋の平面図に対してアセット（インスタンス）の配置や回転を行います。
  - **Properties群** (右側のパネル):
    - **`DesignProperties.jsx`**: `DesignCanvas`で選択されたシェイプの属性（色、サイズなど）を編集します。
    - **`LayoutProperties.jsx`**: `LayoutCanvas`で選択されたインスタンスの属性を編集します。

## 4. データフローと状態管理 (Workflow)
状態管理には Zustand と `zundo` (Undo/Redoミドルウェア) を採用し、複数の Slice で管理しています。

### 4.1. Zustandストアの構造 (`frontend/src/store/`)
- **`projectSlice.js`**: プロジェクト全体のリスト (`projects`)。
- **`assetSlice.js`**:
  - `localAssets`: 現在のプロジェクト専用のアセット定義。
  - `globalAssets`: アプリ全体で共有されるアセット（Libraryで管理）。
- **`instanceSlice.js`**: `LayoutCanvas` に配置されたインスタンス（座標、回転、参照元アセットID）のリスト。
- **`uiSlice.js`**: UIの表示状態（現在のモード `design` または `layout`、キャンバスのパン/ズーム状態 `viewState`、選択状態など）。

### 4.2. データの読み込みフロー (Read Workflow)
1. ユーザーが `/project/:id` にアクセス。
2. `Editor.jsx` がマウントされ、Zustand の `loadProject(id)` アクションを呼び出す。
3. `loadProject` は Goバックエンドの API (`GetProjectData(id)`) を呼び出す。
4. バックエンドは `data/project_{id}.json` を読み込み、必要に応じてデータのマイグレーション（旧フォーマットからの変換など）を行ってフロントエンドに返す。
5. フロントエンドは受け取ったデータを Zustand ストア (`localAssets`, `instances`) にセットし、画面を描画する。

### 4.3. データの保存フロー (Save Workflow)
1. ユーザーがキャンバス上で操作（家具の移動など）を行い、Zustand ストアの状態が更新される。
2. カスタムフック `useAutoSave` がストアの変更（`localAssets` または `instances` の変化）を検知。
3. `useAutoSave` が `saveProjectData()` を呼び出す。
4. Goバックエンドの API (`SaveProjectData(id, data)`) が呼ばれ、`data/project_{id}.json` に上書き保存される。

## 5. 主要な関数とドメインロジック
ビジネスロジックは UI コンポーネントから分離され、`domain/` や `lib/` ディレクトリに配置されています。

- **`frontend/src/domain/geometry.js`**:
  - 幾何学計算の中核。SVG描画用のパス生成（`generateSvgPath`）、座標系の変換（`toSvgY`, `toCartesianY`）、バウンディングボックスの計算（`getRotatedAABB`）などを担当します。
  - Y-Up（デカルト座標）とY-Down（SVGスクリーン座標）の変換がここで行われます。
- **`frontend/src/domain/assetService.js`**:
  - アセット操作の中核。`updateAssetEntities` はアセットの要素（シェイプ）を更新し、全体の境界線サイズを自動再計算して整合性を保ちます。
  - `forkAsset` は、グローバルアセットをプロジェクト用に複製（ディープコピー）し、新しい一意のIDを付与するロジックです。
- **`frontend/src/lib/utils.js`**:
  - `calculateAssetBounds` など、`geometry.js` に依存する計算ユーティリティや、レガシーデータフォーマットを正規化する `normalizeAsset` が含まれます。

## 6. 現在の課題と今後のリファクタリング方針
現在のアーキテクチャは十分に機能していますが、今後の拡張性（CADデータエクスポートなど）や保守性向上のため、以下のリファクタリングを計画・提案します。

### 6.1. 型安全性のさらなる向上 (JSDoc / TypeScriptへの移行検討)
現状、Goバックエンドは `models.go` にて厳密に型定義されていますが、フロントエンドは JSDoc `@typedef` によるアノテーションに留まっています。
**方針**: データ構造（Asset, Entity, Instance）の定義を明確化し、コンポーネント間の Props バケツリレーを減らすため、Zustand の Selector の利用をさらに推進します。

### 6.2. `DesignCanvas` のロジック分割
`DesignCanvas.jsx` は、ユーザーの複雑なマウスインタラクション（パニング、シェイプ移動、リサイズ、頂点編集）を処理するため、非常に大きくなりがちです（一部は `DesignCanvas.logic.js` に抽出済み）。
**方針**: インタラクションごとの状態管理（DragRef など）をさらに純粋な関数やカスタムフックとして分離し、Canvas コンポーネントは「描画」と「イベントの委譲」のみに専念する設計（Presentational / Container パターン）への移行を検討します。

### 6.3. Undo/Redo の最適化
現在の `zundo` による履歴管理は `localAssets` と `instances` 全体を監視していますが、特定の操作（例えば一時的なドラッグ中）の履歴が細かく記録されすぎないように、`onUp` などの確定イベントのタイミングでのみコミットされる設計をより徹底します。

---
*このドキュメントは、新規コントリビューターが `roomGenerator` の全体像を把握し、安全に改修を行うための基礎資料として維持されます。*
