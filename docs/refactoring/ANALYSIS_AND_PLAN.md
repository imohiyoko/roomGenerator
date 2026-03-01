# Room Generator リファクタリング分析と計画

## 1. はじめに

本文書は、今後のリファクタリング作業とコントリビュータへのガイドを目的とした「Room Generator（パーツ設計キャンバス）」サブシステムの詳細な分析です。複雑な描画ロジックを分離し、データフローを明確にすることで、コードの保守性を向上させることを目標としています。

## 2. システム概要

### 2.1 URL構造とルーティング
アプリケーションはナビゲーションに `HashRouter` を使用しています。エディタの主要なルートは以下の通りです：

*   **URL:** `/project/:id`
*   **コンポーネント:** `frontend/src/pages/Editor.jsx`
*   **説明:** 指定されたIDのプロジェクトを読み込みます。

### 2.2 コンポーネント階層 (リファクタリング後)
「Room Generator」の機能は `DesignCanvas` コンポーネントにカプセル化されており、`Editor.jsx` の状態が `mode === 'design'` の場合に条件付きでレンダリングされます。

以前のモノリシックな `DesignCanvasRender` は、役割ごとに以下のコンポーネントに分割されました。

```text
Editor.jsx (ページ)
├── UnifiedSidebar (左パネル: アセットリスト)
├── DesignCanvas (中央: SVGキャンバス状態管理)
│   ├── GridRenderer (背景グリッド、軸、原点、アセットバウンディングボックス)
│   ├── ShapeRenderer (個々のシェイプのSVG描画と回転)
│   └── HandleRenderer (選択時のUI: リサイズ、回転、頂点ハンドル、削除ボタン)
└── DesignProperties (右パネル: プロパティエディタ)
```

### 2.3 データフローと保存の仕組み

バックエンド（ファイルシステム）とフロントエンド（Reactの状態）間でデータは以下のように流れます：

1.  **読み込み (Load):**
    *   `Editor.jsx` がマウントされ、`loadProject(id)`（Zustandのアクション）を呼び出します。
    *   `loadProject` は `API.getProjectData(id)` を呼び出します。
    *   バックエンド（`app.go`）は `data/project_{id}.json` を読み込み、レガシーデータをマイグレーションして `ProjectData` を返します。
    *   ストアが `localAssets`（アセット/部屋の配列）を更新します。

2.  **編集 (インタラクションループ):**
    *   ユーザーが `DesignCanvas` 上でシェイプをドラッグ/リサイズします。
    *   **操作中:** `onPointerMove` は、高パフォーマンスの描画（60fps）のために `DesignCanvas` 内のローカルなReact状態（`localAsset`）を更新します。この時点ではグローバルストアは更新されません。
    *   **確定:** `onPointerUp` によって `updateLocalAssetState` がトリガーされ、最終的な状態がグローバルなZustandストア（`setLocalAssets`）にコミットされます。

3.  **保存 (Save):**
    *   `useAutoSave` フックがストアの変更を検知します。
    *   `API.saveProjectData` を呼び出します。
    *   バックエンド（`app.go`）がデータを `data/project_{id}.json` に保存します。

## 3. 関数インベントリと状態管理

### 3.1 `frontend/src/components/DesignCanvas.jsx` と `useCanvasInteraction.js`

*   **`DesignCanvas` (メインコンポーネント)**
    *   Reactのレンダリングライフサイクルとローカル状態（`localAsset`）を管理します。
    *   複雑なイベントハンドリングは `useCanvasInteraction` カスタムフックに委譲し、ビューとロジックを分離しています。
    *   `GridRenderer`, `ShapeRenderer`, `HandleRenderer` を組み合わせてSVGを構築します。

*   **`useCanvasInteraction` (カスタムフック)**
    *   `frontend/src/hooks/useCanvasInteraction.js` に配置。
    *   ポインターイベントの状態機械（`dragRef`, `cursorMode`, `marquee`）をカプセル化。
    *   `handleDown`, `handleMove`, `handleUp` イベントハンドラを提供し、`DesignCanvas.logic.js` の純粋関数群を呼び出して実際の処理を行います。

### 3.1.5 状態管理と Undo/Redo (Zustand + zundo)
グローバル状態は `frontend/src/store/` 内で管理されています。
*   **`projectSlice.js`**: プロジェクト固有のデータ（`localAssets`, `instances`, `defaultColors`）を管理します。
*   **`index.js` (Store Root)**: `zundo` ミドルウェアを使用して Undo/Redo を実装。パフォーマンスと履歴の肥大化を防ぐため、`localAssets` と `instances` のみを履歴保存の対象（`partialize`）としています。

### 3.1.6 バックエンドとのデータ連携
データの保存・読み込みは `frontend/src/lib/api.js` を経由して Go バックエンド（`app.go`）と通信します。

*   **`SaveProjectData(id string, data interface{})`**: フロントエンドから受け取った JSON をパースし、`ProjectData` 構造体としてバリデーションした上で、`data/project_{id}.json` に保存します。
*   **`GetProjectData(id string)`**: プロジェクトファイルを読み込み、必要に応じてレガシーデータ（`shapes` 配列など）を新しい形式（`entities`）にマイグレーションして返します。

### 3.2 `frontend/src/components/canvas/` (新規ディレクトリ)

*   **`GridRenderer.jsx`**
    *   軸線、原点、およびアセット全体のバウンディングボックスを描画します。
*   **`ShapeRenderer.jsx`**
    *   `type` (rect, circle, ellipse, polygon) に基づいて、エンティティの基本形状を描画します。
    *   SVG空間での回転変換（`transform="rotate(...)"`）を処理します。
*   **`HandleRenderer.jsx`**
    *   選択されたシェイプの上にインタラクティブなUIを描画します。
    *   リサイズハンドル（矩形、楕円）、回転ハンドル、頂点ハンドル（多角形）、および削除ボタンが含まれます。

### 3.3 `frontend/src/components/DesignCanvas.logic.js`

このファイルには、インタラクション状態の遷移を処理する純粋関数が含まれています。

| 操作 | トリガー | 開始関数 | 処理関数 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **パニング** | 中央クリック | `initiatePanning` | `processPanning` | ビューポートを移動します。 |
| **矩形選択 (Marquee)** | 左クリック（空の領域） | `initiateMarquee` | `processMarquee` | 矩形を描画して複数のシェイプを選択します。 |
| **リサイズ** | ハンドルをドラッグ | `initiateResizing` | `processResizing` | エッジハンドルを介してシェイプをリサイズします。 |
| **シェイプ移動** | シェイプをドラッグ | `initiateDraggingShape` | `processDraggingShape` | 選択されたシェイプを移動します。スナップを処理します。 |
| **頂点移動** | 頂点をドラッグ | `initiateDraggingPoint` | `processDraggingPoint` | 多角形の頂点を移動します。 |
| **回転** | 回転ハンドルをドラッグ | `initiateDraggingRotation` | `processDraggingRotation` | シェイプを回転させます。 |

## 4. コントリビュータ向けガイド

リファクタリングにより、描画ロジックが分離されたため、機能追加やバグ修正が容易になりました。

**新しいシェイプタイプを追加する場合:**
1.  **モデル:** バックエンドの `models.go` を更新します（新しいデータフィールドが必要な場合）。
2.  **ロジック:** カスタムインタラクションが必要な場合は `DesignCanvas.logic.js` に新しい処理を追加します。
3.  **描画:** `frontend/src/components/canvas/ShapeRenderer.jsx` に新しいシェイプのレンダリングケースを追加します。
4.  **ハンドル:** 専用の操作ハンドルが必要な場合は `frontend/src/components/canvas/HandleRenderer.jsx` にUIを追加します。
5.  **プロパティ:** `DesignProperties.jsx` にプロパティエディタのコントロールを追加します。

**詳細なインタラクションワークフロー:**
1.  **イベント発火:** ユーザーがキャンバス上でマウスを操作（down, move, up）。
2.  **イベントハンドラ (`useCanvasInteraction.js`):** `handleMove` などがトリガーされ、`dragRef.current.mode` に基づいて操作を分岐。
3.  **純粋関数ロジック (`DesignCanvas.logic.js`):** 座標計算や変換処理（`processDraggingShape` など）を実行し、新しい `entities` 配列を生成。
4.  **ローカル状態更新 (`DesignCanvas.jsx`):** `updateLocalEntities` または `updateLocalAssetState` を通じて、Reactのローカル状態（`localAsset`）を更新。これにより60fpsの高フレームレート描画を実現。
5.  **グローバルストアへのコミット:** マウス操作完了時（`handleUp`）、最終的な状態が Zustand の `setLocalAssets` に渡され、グローバルストアが更新されると同時に Undo 履歴が追加される。
6.  **自動保存:** `useAutoSave` フックがストアの変更を検知し、バックエンドの `SaveProjectData` を呼び出し。

**バグの切り分けと修正:**
1.  **表示がおかしい（色、形、位置がずれている）:** `ShapeRenderer` または `HandleRenderer` を確認してください。
2.  **ドラッグ時の動きがおかしい、座標計算が間違っている:** `DesignCanvas.logic.js` の各種 `process...` 関数を確認してください。
3.  **背景やグリッドがおかしい:** `GridRenderer` を確認してください。
4.  **イベントが発火しない、モードが切り替わらない:** `useCanvasInteraction.js` のイベントハンドラを確認してください。
5.  **保存されない、またはリロードすると消える:** `useCanvasInteraction.js` の `handleUp` での `updateLocalAssetState` 呼び出し、または Zustand ストアの状態更新を確認してください。
