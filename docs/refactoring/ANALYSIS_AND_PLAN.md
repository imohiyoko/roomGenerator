# roomGenerator システム構造とリファクタリング計画 (Analysis & Plan)

このドキュメントは、`roomGenerator`（間取りアーキテクト Pro）の全体的なシステム構造、データフロー、コンポーネント構成、および将来のリファクタリング計画についてコントリビュータ向けにまとめたものです。

## 1. アプリケーションの全体概要
`roomGenerator`は、デスクトップ環境で動作する間取り図（部屋のレイアウト）を生成・編集・管理するためのアプリケーションです。
- **フロントエンド**: React (Vite)
- **バックエンド**: Go (Wailsフレームワーク)
- **状態管理**: Zustand (Undo/Redo機能としてzundoを利用)
- **ルーティング**: React Router (HashRouter)

## 2. URL・ルーティング構造
アプリケーションは`HashRouter`を使用し、以下のURL構造を持っています。

| URL | コンポーネント | 概要 |
| --- | --- | --- |
| `/` | `frontend/src/pages/Home.jsx` | ホーム画面。プロジェクトの新規作成、一覧表示・削除などを行うランディングページです。 |
| `/library` | `frontend/src/pages/Library.jsx` | グローバルアセット（家具、設備などの再利用可能なパーツ）を管理・編集するライブラリ画面です。 |
| `/project/:id` | `frontend/src/pages/Editor.jsx` | プロジェクトごとのメインエディタ画面です。Canvasやプロパティの編集を行います。 |
| `/settings` | `frontend/src/pages/Settings.jsx` | アプリケーション全体のグローバル設定（色、デフォルト値、スナップの挙動など）を管理します。 |

## 3. コンポーネント階層 (主要コンポーネント)
UIは複数の機能ブロックに分割されています。主な構造は以下の通りです。

- **`App.jsx`**: アプリケーションのルート。ルーティングの定義や、起動時の初期データ（プロジェクト一覧、グローバルアセット、パレット）の取得を行います。
- **`Editor.jsx`**: メインワークスペースのオーケストレーションを行います。現在のモード（Design Mode/Layout Mode）に応じて以下のコンポーネントを切り替えます。
  - **`UnifiedSidebar.jsx`**: 画面左側のサイドバー。アセットやツールの選択を行います。
  - **キャンバス領域**
    - **`DesignCanvas.jsx`**: 個々のアセット（家具や設備を構成する図形・ポリゴンなど）を作成・編集するためのキャンバスです（Design Mode）。
    - **`LayoutCanvas.jsx`**: 生成したアセットをインスタンスとして平面図（フロアプラン）に配置するためのキャンバスです（Layout Mode）。
  - **プロパティパネル領域**
    - **`DesignProperties.jsx`**: Design Modeにおいて、選択された図形（Shape/Entity）のプロパティ（色、サイズ、座標など）を編集します。
    - **`LayoutProperties.jsx`**: Layout Modeにおいて、選択されたインスタンスのプロパティを編集します。
  - **`Ruler.jsx`**: キャンバスの上部と左部に表示される定規（視覚的なガイド）。

## 4. 状態管理 (Zustand)
状態管理は`frontend/src/store/`ディレクトリ内に集約されています。

- **`projectSlice.js`** (Core Data Model)
  - `projects`: 利用可能なすべてのプロジェクトのリスト。
  - `localAssets`: 現在開いているプロジェクト固有のアセット（ブループリント）。
  - `instances`: レイアウトキャンバスに配置されたオブジェクト群（アセットへの参照）。
  - `viewState`: キャンバスのビューポート状態（パン、ズーム）。
- **`uiSlice.js`** (UI State)
  - サイドバーの幅や折りたたみ状態など、一時的なUIの表示状態を管理し、`localStorage`を利用してセッション間で永続化します。
- **Undo/Redo機能**: Zustandのミドルウェアである`zundo`（temporal）を利用して、特定のスライスに対する履歴管理を実装しています。

## 5. データフローとワークフロー

### プロジェクト読み込みのフロー
1. ユーザーが `/project/:id` にアクセスする。
2. `Editor.jsx` がマウントされ、Zustandストア (`projectSlice`) の `loadProject(id)` アクションを呼び出す。
3. `loadProject` はバックエンドのAPI (`API.getProjectData(id)`) を呼び出す。
4. Goバックエンドは `data/project_{id}.json` を読み込み、必要に応じてレガシーデータのマイグレーション（例: `shapes` → `entities`）を行ってフロントエンドに返す。
5. フロントエンドのZustandストアが更新され、`localAssets`、`instances` などのデータがUIに反映される。

### プロジェクト保存のフロー
1. ユーザーがキャンバス上で操作（アセットの移動、図形の変更など）を行う。
2. Zustandストアの状態が即座に更新され、UIが再レンダリングされる。
3. `useAutoSave` カスタムフックが状態の変更を検知する。
4. `useAutoSave` が `saveProjectData()` アクションをトリガーする。
5. 現在の `localAssets` と `instances` がバックエンドのAPI (`API.saveProjectData(id)`) に送信される。
6. Goバックエンドはデータをバリデーションし、`data/project_{id}.json` に書き込む。

## 6. 主要なドメインロジック・関数群
ビジネスロジックは主に `frontend/src/domain/` および `frontend/src/lib/` に配置されています。

- **`calculateAssetBounds(entities)`** (`src/lib/utils.js` または `src/domain/geometry.js` 関連):
  - エンティティグループのAxis-Aligned Bounding Box (AABB: 軸並行境界箱) を計算します。アセットの中心座標やサイズを決定する重要な関数です。
- **`updateAssetEntities(asset, entities)`** (`src/domain/assetService.js`):
  - アセット内のエンティティを更新するための標準的なヘルパー関数。
  - エンティティの変更に伴い、自動的に境界情報（`w`, `h`, `boundX`, `boundY`）を再計算し、データの一貫性を保ちます。
- **`normalizeAsset(asset)`** (`src/lib/utils.js`):
  - 後方互換性を保つため、古いデータ構造（例: `shapes` キー）を新しい構造（`entities` キー）に正規化します。
- **`forkAsset(asset, defaultColors)`** (`src/domain/assetService.js`):
  - グローバルアセットを現在のプロジェクト用にディープコピーします（ローカルでの変更がグローバルに影響しないようにするため）。
  - 新しい一意のIDを割り当て、プロジェクトのデフォルトカラーを適用します。

## 7. バックエンドとの連携 (Go - `app.go`)
バックエンドはファイルシステムとのブリッジとして機能し、Wailsフレームワークを通じてフロントエンドにAPIを提供します。

- **データ保存先**: 全てのJSONデータは実行ファイルと同じディレクトリの `data/` フォルダに保存されます（例: `global_assets.json`, `palette.json`, `project_{id}.json`）。
- **`GetProjectData(id string)`**: 指定されたIDのプロジェクトデータを読み込みます。JSONの厳格なUnmarshalを試し、失敗した場合はフォールバックとしてマップベースのマニュアルマイグレーション（旧形式のサポート）を行います。
- **`SaveProjectData(id string, data interface{})`**: フロントエンドから受け取ったデータを型安全にパース・検証し、ディスクに保存します。
- **インポート/エクスポート**: `ImportProject`, `ExportProject`, `ImportGlobalAssets` などのメソッドを通じて、プロジェクトやアセットの共有・移行をサポートします。

## 8. リファクタリングの方針 (今後のステップ)
アーキテクチャの全容を把握した上で、今後は以下の観点でリファクタリングを進めることが推奨されます。

1. **ドメインロジックとUIコンポーネントの分離**:
   - キャンバスの複雑なインタラクション（ドラッグ、リサイズ、パンなど）は、`useCanvasInteraction` のようなカスタムフックや `DesignCanvas.logic.js` に抽出されています。このパターンをさらに推し進め、View層（React）とModel層（ジオメトリ計算、データ構造）を明確に分離します。
2. **パフォーマンスの最適化**:
   - 高頻度で更新されるドラッグ操作などはローカルのReactステート (`localAsset`) で処理し、操作完了時（`onPointerUp`）にのみグローバルのZustandストアにコミットするパターンを標準化します。
3. **型安全性の向上**:
   - JSDoc（`@typedef`）を利用し、`Asset`, `Entity`, `Point` といったコアデータモデルの型定義を明確にし、フロントエンド全体の型安全性を高めます。
4. **テストの拡充**:
   - `docs/TEST_IMPLEMENTATION_PLAN.md` に従い、Playwrightを利用したE2Eテストや、主要ドメイン関数の単体テストを拡充します。

このドキュメントはシステムの全体像を理解し、安全にコードを変更するためのベースラインとなります。コードの変更を行う際は、必ず本ドキュメントと関連ファイル（例: `CONTRIBUTING.md`）を参照してください。
