# roomGenerator (間取りアーキテクト Pro) システム構造・リファクタリング計画書

このドキュメントは、本プロジェクトに新たに参加するコントリビュータや、将来の継続的なリファクタリング・機能追加のための全体構造の理解を助けるガイドです。
アプリケーションの全体像（アーキテクチャ）、データの流れ（データフロー）、主要な関数やコンポーネントの役割、および開発ワークフローについて解説します。

---

## 1. 全体構造 (High-Level Architecture)

`roomGenerator` は、Go (バックエンド) と React (フロントエンド) を Wails フレームワークで統合したデスクトップアプリケーションです。
主に「間取り図（レイアウト）」の作成と、それに配置する「家具・設備（アセット）」のデザインを行うための2つのモードを持っています。

### 1.1 ディレクトリ構成

- `main.go`, `app.go`: WailsアプリケーションのエントリポイントとバックエンドAPIロジック。
- `models.go`: バックエンドとフロントエンド間でやり取りされるデータの型定義（構造体）。
- `data/`: ユーザーが作成したプロジェクトやグローバル設定（JSONファイル）が保存されるローカルディレクトリ。
- `frontend/src/`:
  - `pages/`: 画面単位のルーティングコンポーネント。
  - `components/`: UIを構成する部品（Canvas、Sidebar、Propertiesなど）。
  - `store/`: Zustandによるグローバルステート（状態管理）。
  - `domain/`: ビジネスロジックや幾何学計算、APIとストアの橋渡し（Service）。
  - `lib/`: 汎用的なユーティリティ（APIクライアントなど）。
  - `hooks/`: 再利用可能なカスタムReactフック。

### 1.2 URLとルーティング (React Router)

クライアントサイドルーティングには `react-router-dom` (HashRouter) を使用しています。

| URL | ページコンポーネント | 役割 |
| :--- | :--- | :--- |
| `/` | `Home.jsx` | ホーム画面。プロジェクト一覧の表示、新規作成、インポート。 |
| `/library` | `Library.jsx` | グローバルアセット（全プロジェクトで共有される家具や部屋の雛形）の管理画面。 |
| `/project/:id` | `Editor.jsx` | プロジェクト編集のメイン画面。URLの `:id` で対象プロジェクトを特定。 |
| `/settings` | `Settings.jsx` | アプリケーション全体の基本設定（グリッドサイズ、スナップ間隔など）。 |

---

## 2. データの流れと保存方法 (Data Flow)

データの永続化はすべてローカルのJSONファイル（`data/` ディレクトリ内）に行われます。

### 2.1 データモデルの階層

1. **Project (プロジェクト)**: `data/project_{id}.json` に保存される一つの間取り図。
   - **Local Assets (ローカルアセット)**: そのプロジェクト専用の家具や部屋の定義。グローバルアセットから「フォーク（複製）」されて作られるか、新規作成される。
   - **Instances (インスタンス)**: ローカルアセットをレイアウトキャンバス上に配置した実体。X/Y座標や回転角を持つ。
2. **Asset (アセット)**: 1つの家具や部屋の定義。
   - **Entities (エンティティ/シェイプ)**: アセットを構成する個々の図形（矩形、円、多角形、テキストなど）。

### 2.2 プロジェクトの読み込みフロー

1. ユーザーが `/project/123` にアクセス。
2. `Editor.jsx` がマウントされ、Zustandストア (`projectSlice.js`) の `loadProject("123")` アクションを呼び出す。
3. ストアが `frontend/src/domain/projectService.js` の `loadProjectData` を経由して、`API.getProjectData("123")` (Goの `app.go`) を実行。
4. **Goバックエンド**: `data/project_123.json` を読み込み。この際、古いフォーマット（例: `shapes` キー）であれば新しい構造体 (`ProjectData`) に正規化（マイグレーション）して返す。
5. **フロントエンド**: 受け取ったデータを Zustand の `localAssets` と `instances` ステートにセット。

### 2.3 プロジェクトの保存フロー

1. ユーザーがキャンバス上で家具を移動させる（Zustandの `instances` が更新される）。
2. `Editor.jsx` 内の `useAutoSave` フックがストアの変更を検知。
3. 設定されたインターバル（例: 3秒）経過後、ストアの `saveProjectData()` アクションが呼ばれる。
4. ストアの現在の状態を `API.saveProjectData` へ送信。
5. **Goバックエンド**: 受け取ったJSONを `models.go` の `ProjectData` 構造体にマッピングしてスキーマ検証を行い、`data/project_{id}.json` に上書き保存する。

---

## 3. 主要な画面構成と状態管理 (UI & State)

編集画面 (`/project/:id`) である `Editor.jsx` は、複雑な状態を持っています。

### 3.1 コンポーネントツリー

- `Editor.jsx` (メインコンテナ。現在のモード "Design" か "Layout" を管理)
  - `Header.jsx` (上部メニュー。保存ボタン、Undo/Redoなど)
  - `UnifiedSidebar.jsx` (左サイドバー。アセットの一覧、新規シェイプの追加ツール)
  - **Canvas領域 (中央)**:
    - `DesignCanvas.jsx`: アセット（家具自体）の形状を編集するモード。
      - 背景グリッド、シェイプの描画 (`ShapeRenderer`)、操作ハンドル (`HandleRenderer`) を含む。
    - `LayoutCanvas.jsx`: 部屋や家具（インスタンス）を間取り図に配置するモード。
  - **Properties領域 (右サイドバー)**:
    - `DesignProperties.jsx`: 選択中のシェイプ（色、サイズ、頂点座標など）を編集。
    - `LayoutProperties.jsx`: 選択中のインスタンス（配置座標、回転角など）を編集。

### 3.2 状態管理 (Zustand + zundo)

`frontend/src/store/index.js` で複数の Slice を統合しています。
`zundo` ミドルウェアを使用して、キャンバス操作の Undo/Redo（履歴管理）を実現しています。

- `projectSlice.js`: プロジェクト全体のデータ（`localAssets`, `instances`）。
- `uiSlice.js`: 選択状態（現在選択されているアセット、インスタンス、シェイプのID）や、UIの開閉状態。UI状態はUndo/Redoの対象外。
- `settingsSlice.js`: グリッドサイズやスナップ設定。

---

## 4. コアロジックと計算 (Domain Logic)

このアプリケーションで最も複雑な部分は、SVG描画と幾何学計算です。これらは `frontend/src/domain/` 以下のファイルに集約されています。

### 4.1 座標系の違い（重要）

- **論理座標 (デカルト座標系)**:
  - 内部データ（JSON、Zustand）は **数学的な座標系（Y軸が上向きでプラス）** を使用しています。原点 `(0,0)` を基準に、右が `+X`、上が `+Y` です。
- **描画座標 (SVGスクリーン座標系)**:
  - ブラウザの描画（SVG）は **画面座標系（Y軸が下向きでプラス）** です。
- **変換**: `frontend/src/domain/geometry.js` にある `toSvgY(y)` と `toCartesianY(svgY)` を使って、描画時とマウスイベント発生時に必ず相互変換を行います。

### 4.2 主要な関数インベントリ

#### `frontend/src/domain/geometry.js`
幾何学的な計算をすべて担う純粋な関数群。
- `rotatePoint(px, py, cx, cy, angle)`: 点を中心に回転させる。
- `getRotatedAABB(entity)`: 回転を考慮したエンティティ（シェイプ）の Axis-Aligned Bounding Box (軸に平行な境界ボックス) を計算。
- `snapValue(val, snapInterval)`: グリッドへのスナップ計算。
- `generateSvgPath(points, isClosed)`: 多角形の頂点データからSVGの `d` 属性文字列を生成（ベジェ曲線対応）。

#### `frontend/src/domain/assetService.js`
アセットのデータ操作に関するビジネスロジック。
- `updateAssetEntities(asset, newEntities)`: アセット内のシェイプ配列を更新し、**全体の外形サイズ (w, h) と配置基準点 (boundX, boundY) を自動的に再計算**する重要な関数。

#### `frontend/src/components/DesignCanvas.logic.js` (カスタムフック化予定)
キャンバス上でのマウス操作（ドラッグ、リサイズ、頂点移動）の複雑な状態遷移を管理。
- `initiate*` (例: `initiateDragging`): マウスダウン (`onPointerDown`) 時に初期状態を記録。
- `process*` (例: `processDragging`): マウス移動 (`onPointerMove`) 時に新しい座標を計算。

---

## 5. コントリビュータ向けワークフロー

新機能の追加やバグ修正を行う際の標準的なアプローチです。

### 5.1 バグ修正の場合のアプローチ
1. **問題の特定**: まず UI のどの部分か（例: 選択枠がずれる）を特定し、対応するコンポーネント（例: `DesignCanvas.jsx`）を見つけます。
2. **状態の確認**: 描画がおかしい場合、Zustandのデータ（`localAssets`）がおかしいのか、SVGへの変換処理（`geometry.js`）がおかしいのかを切り分けます。
3. **データ更新フロー**: Zustandのストアを直接ミューテート（破壊的変更）してはいけません。必ず Store のアクション (`updateAsset`, `updateInstance`) または `updateAssetEntities` ヘルパーを介して新しいオブジェクトを生成してセットします。

### 5.2 新機能追加の場合のアプローチ
例：「新しい図形（星型）を追加したい」
1. **バックエンド (`models.go`)**: `Entity` 構造体に星型特有のパラメータが必要であれば追加し、`app.go` の JSON マイグレーションが壊れないか確認。
2. **ドメイン (`geometry.js`)**: 星型のバウンディングボックス計算 (`getRotatedAABB` の分岐) と、SVGパス生成ロジックを追加。
3. **UI (`ShapeRenderer.jsx`)**: 新しい `type: "star"` の描画分岐を追加。
4. **サイドバー (`UnifiedSidebar.jsx`)**: 星型を追加するボタンを実装し、初期エンティティを生成してストアに追加するアクションを呼ぶ。
5. **プロパティ (`DesignProperties.jsx`)**: 星型専用のパラメータ（頂点の数など）を編集するUIを追加。

### 5.3 テストと検証
- バックエンドのテスト: `go test ./...`
- フロントエンドの検証:
  - 開発中は `wails dev` (または `cd frontend && npm run dev`) でホットリロードを有効にして作業します。
  - Playwright（自動E2Eテスト）用のモック作成時は、`Entity` 構造体に必須プロパティ（`points` など）が欠けないように注意してください。

---

## 6. 継続的なリファクタリング計画

現在のコードベースは既に整理が進んでいますが、以下の点を今後の課題（TODO）としています。

- [ ] **ロジックのさらなる分離**: `DesignCanvas.jsx` は依然として描画とイベントハンドリングが混在している部分があります。`DesignCanvas.logic.js` を完全に独立したカスタムフック（例: `useCanvasInteraction`）として分離し、View（Reactコンポーネント）と Controller（イベント処理）の境界をより明確にする。
- [ ] **プロパティパネルのコンポーネント分割**: `DesignProperties.jsx` 内で、図形タイプ（Polygon, Circle, Text）ごとに大量の条件分岐があります。これらを `PolygonProperties.jsx`, `CircleProperties.jsx` などのサブコンポーネントに分割し、見通しを良くする。
- [ ] **TypeScriptの導入検討**: 現在 JSDoc によって型を明示していますが、中長期的にはフロントエンド全体を TypeScript に移行することで、`models.go` との型安全性をより強固なものにする。
