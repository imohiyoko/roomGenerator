# システム分析およびリファクタリング計画 (ANALYSIS_AND_PLAN)

このドキュメントは、`imohiyoko/roomGenerator` の全体的なアーキテクチャ、データフロー、主要な関数、およびURL構造を新規コントリビュータ向けにわかりやすくまとめたものです。リファクタリングを行う前に、システムの現状を把握し、どこにどのように影響を与えるかを理解するためのガイドとして機能します。

## 1. 全体像とアーキテクチャ概要

roomGenerator（間取りアーキテクト Pro）は、間取り図を作成・編集するためのデスクトップアプリケーションです。

*   **バックエンド:** Go (Wailsフレームワークを使用)
    *   OSのファイルシステムと直接やり取りし、JSON形式でデータの読み書きを行います（データベースは使用していません）。
*   **フロントエンド:** React (Vite)
    *   Wailsを通じて提供されるバックエンドAPIと通信し、UIの描画とユーザーインタラクションを処理します。
*   **状態管理:** Zustand
    *   フロントエンド全体の状態（プロジェクトデータ、アセット、UI状態など）を一元管理し、zundoミドルウェアによるUndo/Redo機能を備えています。
*   **ルーティング:** React Router (HashRouter)

---

## 2. ディレクトリ構造と主要ファイル

```text
roomGenerator/
├── app.go              # バックエンドAPI (フロントエンドから呼び出されるメソッド群)
├── models.go           # バックエンドで扱うデータ構造体 (Project, Asset, Entity等)
├── frontend/src/
│   ├── components/     # UIコンポーネント (Canvas, Sidebar, Properties等)
│   ├── domain/         # ビジネスロジック (AssetService, ProjectService等)
│   ├── hooks/          # カスタムHooks (useCanvasInteraction, useAutoSave等)
│   ├── lib/            # ユーティリティ (math, 座標変換処理等)
│   ├── pages/          # ページコンポーネント (URLに紐づくView)
│   └── store/          # Zustandストア定義
└── data/               # 保存されたJSONデータ (Git管理外)
```

---

## 3. URL構造と画面(Pages)

フロントエンドは `HashRouter` を使用して画面遷移を行います。

| URL | コンポーネント (`frontend/src/pages/`) | 概要 |
| :--- | :--- | :--- |
| `/` | `Home.jsx` | 起動直後の画面。既存プロジェクトの一覧表示、新規作成を行います。 |
| `/library` | `Library.jsx` | プロジェクト横断で使用できる「グローバルアセット（家具・設備等のテンプレート）」と「カラーパレット」を管理する画面です。 |
| `/project/:id` | `Editor.jsx` | 選択したプロジェクトの編集画面。Canvasとプロパティパネルを備えたメインワークスペースです。 |
| `/settings` | `Settings.jsx` | グローバルなアプリケーション設定（グリッドサイズなど）を行う画面です。 |

---

## 4. UIコンポーネントとデータフロー (Editor画面)

`/project/:id` にアクセスした際のコンポーネント階層とデータの流れです。

### 主要コンポーネント階層

*   **`Editor.jsx`**: 全体のコンテナ。URLから `id` を取得し、プロジェクトデータをロードします。
    *   **`UnifiedSidebar.jsx`**: 左側のメニュー。アセット（家具や部屋）のリストを表示し、キャンバスにドラッグ＆ドロップで配置できるようにします。
    *   **キャンバス領域 (モードによって切り替え)**:
        *   **`LayoutCanvas.jsx` (Layout Mode)**: 部屋や家具（Instance）を配置し、間取り図全体を作成するキャンバス。
        *   **`DesignCanvas.jsx` (Design Mode)**: 個々のアセット（家具そのもの）の形状（Entity）を編集・作成するキャンバス。
    *   **プロパティ領域 (モードによって切り替え)**:
        *   **`LayoutProperties.jsx`**: 選択されたInstance（配置済みの家具）の座標や角度、色を変更。
        *   **`DesignProperties.jsx`**: 選択されたEntity（形状の頂点やサイズ）を編集。

### データはどのように保存され、参照されるか？ (Workflow)

1.  **データの読み込み (Load Workflow)**
    *   ユーザーが Home 画面からプロジェクトを選択 (`/project/123` へ遷移)。
    *   `Editor.jsx` がマウントされ、Zustandの `loadProject(123)` アクションを呼び出し。
    *   `frontend/src/domain/projectService.js` を経由して、バックエンドAPI `App.GetProjectData("123")` (in `app.go`) を呼び出す。
    *   バックエンドは `data/project_123.json` を読み込み、`models.go` の構造体に合わせて正規化し、フロントエンドに返す。
    *   Zustandストア (`projectSlice.js` 等) にデータが格納され、UIが描画される。

2.  **データの変更 (Edit Workflow)**
    *   ユーザーがキャンバス上で家具をドラッグして移動する。
    *   **DesignCanvas等の高速な操作:** ドラッグ中(`onPointerMove`)は Reactのローカルステート (`localAsset` など) のみを更新し、60fpsで滑らかに再描画する。（履歴に残さないため）
    *   ドラッグ終了時(`onPointerUp`): Zustandストア (`projectSlice.js` の `updateInstance` など) に変更をコミットする。ここでUndo/Redoの履歴が作られる。

3.  **データの保存 (Save Workflow)**
    *   Zustandストアのデータが変更されると、`useAutoSave` フックが変更を検知する。
    *   デバウンス（一定時間操作がないことを確認）後、Zustandの `saveProjectData()` が呼ばれる。
    *   バックエンドAPI `App.SaveProjectData(id, data)` が呼ばれ、最新のJSONファイル (`data/project_123.json`) が上書き保存される。

---

## 5. 主要なドメイン関数 (どこに影響を与えるか)

ロジックは主に `frontend/src/domain/` および `frontend/src/lib/` に集約されています。

*   **`calculateAssetBounds(entities)`** (`src/lib/utils.js`)
    *   **役割:** 複数の図形(Entity)からなるアセット全体の「バウンディングボックス（外接矩形）」を計算します。
    *   **影響:** アセットのサイズ(`w`, `h`)や中心基準点(`boundX`, `boundY`)を決定します。これがズレるとキャンバス上での選択枠や配置座標がおかしくなります。
*   **`updateAssetEntities(asset, entities)`** (`src/domain/assetService.js`)
    *   **役割:** アセット内の図形(Entities)を追加・削除・更新した際に、自動的に `calculateAssetBounds` を呼び出してアセット全体のサイズ情報も同期させるヘルパー関数。
    *   **影響:** `DesignCanvas` や `DesignProperties` で形状を変更する際は、**必ずこの関数を経由して** Zustandストアを更新する必要があります。
*   **`forkAsset(asset, defaultColors)`** (`src/domain/assetService.js`)
    *   **役割:** グローバルアセット（共有ライブラリ）を、現在のプロジェクト専用のローカルアセットとして「コピー（フォーク）」します。
    *   **影響:** プロジェクトごとに家具の色や形をカスタマイズしても、他のプロジェクトに影響を与えないようにするための重要な関数です。
*   **座標変換関数群 (`toSvgY`, `toCartesianY` など)** (`src/domain/geometry.js`)
    *   **役割:** ロジック用の「デカルト座標（Y軸が上向き）」と、描画用の「SVGスクリーン座標（Y軸が下向き）」を変換します。
    *   **影響:** マウスのクリック位置計算や描画処理全般で不可欠です。

---

## 6. 今後のリファクタリング方針

システム構造を理解した上で、今後のコントリビュータが作業しやすいように以下のリファクタリングを推奨します。

1.  **型の明示とドキュメント化:**
    *   JavaScriptで書かれているため、Zustandストアに格納されるデータの形（Asset, Instance, Entityの構造）がコード上で分かりにくい場合があります。JSDoc (`@typedef`) を活用して型定義を強化するか、TypeScriptへの段階的移行を検討します。
2.  **キャンバスロジックのさらなる分離:**
    *   現在 `DesignCanvas.logic.js` に分離されていますが、マウスイベントから純粋な「図形計算」部分をさらに `geometry.js` などへ切り出し、テスト可能（Jest/Vitest等でUIなしでテストできる状態）にします。
3.  **UIコンポーネントの責務分割:**
    *   `Editor.jsx` が多くの状態とモード切り替えを抱えています。Right Panel (Properties) や Left Panel (Sidebar) のコンテナコンポーネントを独立させ、Zustandからのデータ取得を各コンポーネント内で直接行う（Prop Drillingを減らす）アプローチを強化します。

---

このドキュメントは、コードの変更に合わせて常に最新の状態に保つようにしてください。
