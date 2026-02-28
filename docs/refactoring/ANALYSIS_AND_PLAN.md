# Room Generator リファクタリング分析と計画

## 1. はじめに

本文書は、今後のリファクタリング作業とコントリビュータへのガイドを目的とした「Room Generator（パーツ設計キャンバス）」サブシステムの詳細な分析です。複雑な描画ロジックを分離し、データフローを明確にすることで、コードの保守性を向上させることを目標としています。

## 2. システム概要

### 2.1 URL構造とルーティング
アプリケーションはナビゲーションに `HashRouter` を使用しています。エディタの主要なルートは以下の通りです：

*   **URL:** `/project/:id`
*   **コンポーネント:** `frontend/src/pages/Editor.jsx`
*   **説明:** 指定されたIDのプロジェクトを読み込みます。

### 2.2 コンポーネント階層
「Room Generator」の機能は `DesignCanvas` コンポーネントにカプセル化されており、`Editor.jsx` の状態が `mode === 'design'` の場合に条件付きでレンダリングされます。

```text
Editor.jsx (ページ)
├── UnifiedSidebar (左パネル: アセットリスト)
├── DesignCanvas (中央: SVGキャンバス)
│   └── DesignCanvasRender (内部コンポーネント: SVG要素を描画)
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

## 3. 関数インベントリ

### 3.1 `frontend/src/components/DesignCanvas.jsx`

*   **`DesignCanvas` (メインコンポーネント)**
    *   ローカル状態（`localAsset`, `cursorMode`, `marquee`）を管理します。
    *   イベントリスナー（`handleDown`, `handleMove`, `handleUp`）を設定します。
    *   `DesignCanvas.logic.js` と統合されています。
*   **`DesignCanvasRender` (描画コンポーネント)**
    *   **現在の責務:** グリッド、背景、すべてのシェイプ（矩形、多角形、楕円）、選択ハンドル、リサイズハンドル、回転ハンドルを含むSVGを描画します。
    *   **課題:** このコンポーネントはモノリシックであり、異なるシェイプタイプの表示ロジックが混在しています。

### 3.2 `frontend/src/components/DesignCanvas.logic.js`

このファイルには、インタラクション状態の遷移を処理する純粋関数が含まれています。

| 操作 | トリガー | 開始関数 | 処理関数 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| **パニング** | 中央クリック | `initiatePanning` | `processPanning` | ビューポートを移動します。 |
| **矩形選択 (Marquee)** | 左クリック（Empty Space: シェイプがない空白領域） | `initiateMarquee` | `processMarquee` | 矩形を描画して複数のシェイプを選択します。 |
| **リサイズ** | ハンドルをドラッグ | `initiateResizing` | `processResizing` | エッジハンドルを介してシェイプ（矩形/楕円）をリサイズします。 |
| **シェイプ移動** | シェイプをドラッグ | `initiateDraggingShape` | `processDraggingShape` | 選択されたシェイプを移動します。スナップを処理します。 |
| **頂点移動** | 頂点をドラッグ | `initiateDraggingPoint` | `processDraggingPoint` | 多角形の頂点を移動します。 |
| **ハンドル移動** | 曲線のハンドルをドラッグ | `initiateDraggingHandle` | `processDraggingHandle` | ベジェ制御点（曲線用）を移動します。 |
| **回転** | 回転ハンドルをドラッグ | `initiateDraggingRotation` | `processDraggingRotation` | シェイプを回転させます。 |
| **角度調整** | 角度ハンドルをドラッグ | `initiateDraggingAngle` | `processDraggingAngle` | 円弧の開始/終了角度を調整します。 |
| **半径調整** | 半径ハンドルをドラッグ | `initiateDraggingRadius` | `processDraggingRadius` | 楕円の半径（rx, ry）を調整します。 |

## 4. リファクタリング戦略

主な目標は、`DesignCanvasRender` を分解して可読性と拡張性を向上させることです。

### 4.1 提案するコンポーネント構造

```text
DesignCanvas
├── CanvasGrid (新規)
│   └── 無限グリッドと軸線を描画します。
├── CanvasShape (新規)
│   └── `type` に基づいて個々のシェイプ（Rect, Polygon, Ellipse）を描画します。
│   └── 幾何学的な変換（SVGの回転）を処理します。
├── CanvasSelection (新規)
│   └── シェイプの*上*に選択UIを描画します。
│   └── リサイズハンドル、回転ハンドル、頂点ハンドルなど。
│   └── 矩形選択（Marquee）のオーバーレイ。
└── DesignCanvasRender (簡略化)
    └── 上記のコンポーネントを構成します。
```

### 4.2 コントリビュータ向けワークフロー

**新しいシェイプタイプを追加する場合:**
1.  **モデル:** `models.go` を更新します（新しいデータフィールドが必要な場合）。
2.  **ロジック:** カスタムインタラクションハンドルが必要な場合は `DesignCanvas.logic.js` を更新します。
3.  **描画:** `CanvasShape`（フロントエンド）に新しいタイプのケースを追加します。
4.  **プロパティ:** `DesignProperties.jsx` にプロパティコントロールを追加します。

**表示のバグを修正する場合:**
1.  ロジックのバグ（`DesignCanvas.logic.js` の座標が間違っているなど）か、表示のバグかを特定します。
2.  表示のバグの場合は、`CanvasShape`（リファクタリング前は `DesignCanvasRender`）を確認してください。
