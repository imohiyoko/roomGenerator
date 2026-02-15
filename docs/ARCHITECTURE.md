# アーキテクチャとシステムの概要

このドキュメントでは、Room Generator アプリケーションの全体的なマップを提供し、その構造、機能、データフロー、およびワークフローについて詳しく説明します。

## 1. 技術スタック

- **バックエンド**: Go (1.21+) および [Wails](https://wails.io/)
- **フロントエンド**: React, Vite, Tailwind CSS
- **状態管理**: Zustand (スライスおよび Zundo による Undo/Redo 対応)
- **ルーティング**: React Router (HashRouter)
- **アイコン**: React Icons (Lucide, Fa, Md, etc.)

## 2. ディレクトリ構造

アプリケーションは標準的な Wails プロジェクト構造に従っており、Go バックエンドと React フロントエンドが明確に分離されています。

```
.
├── app.go                  # [Backend] メインアプリケーションロジックと API メソッド
├── main.go                 # [Backend] Wails エントリーポイントと設定
├── data/                   # [Data] ローカル JSON ストレージ (実行時に生成)
├── docs/                   # [Documentation] プロジェクトドキュメント
└── frontend/               # [Frontend] React アプリケーション
    ├── src/
    │   ├── App.jsx         # [Router] メインルーティング定義
    │   ├── main.jsx        # [Entry] React エントリーポイント
    │   ├── components/     # [UI] 再利用可能な UI コンポーネント (Canvas, Panels, etc.)
    │   ├── domain/         # [Logic] 純粋なビジネスロジック (Asset 操作)
    │   ├── hooks/          # [Logic] カスタム React フック (useAutoSave, etc.)
    │   ├── lib/            # [Utils] API ラッパー, 数学ヘルパー
    │   ├── pages/          # [Views] トップレベルのページコンポーネント
    │   └── store/          # [State] グローバル状態管理 (Zustand)
```

## 3. バックエンド API (Wails)

Go バックエンド (`app.go`) は、以下のメソッドを `window.go.main.App` を通じてフロントエンドに公開しています。これらは `frontend/src/lib/api.js` でラップされています。

| 関数名 | 入力 | 出力 | 説明 |
| :--- | :--- | :--- | :--- |
| **プロジェクト管理** | | | |
| `GetProjects` | `()` | `[]Project` | すべてのプロジェクト（メタデータ）のリストを返します。 |
| `CreateProject` | `(name string)` | `Project` | 新しいプロジェクトを作成し、データファイルを初期化します。 |
| `DeleteProject` | `(id string)` | `error` | インデックスからプロジェクトを削除し、そのデータファイルを削除します。 |
| `UpdateProjectName` | `(id, name)` | `error` | 既存のプロジェクトの名前を変更します。 |
| **プロジェクトコンテンツ** | | | |
| `GetProjectData` | `(id string)` | `ProjectData` | 特定のプロジェクトのアセットとインスタンスをロードします。 |
| `SaveProjectData` | `(id, data)` | `error` | プロジェクトの現在の状態を保存します（自動保存）。 |
| **グローバルライブラリ** | | | |
| `GetAssets` | `()` | `[]Asset` | グローバルアセットライブラリをロードします。 |
| `SaveAssets` | `(assets)` | `error` | グローバルアセットライブラリへの変更を保存します。 |
| **設定** | | | |
| `GetPalette` | `()` | `PaletteData` | グローバルカラーパレットとデフォルト設定をロードします。 |
| `SavePalette` | `(palette)` | `error` | カラーパレット設定を保存します。 |

## 4. フロントエンドアーキテクチャ

### ルーティング (URL)

アプリケーションは `HashRouter` を使用しています。

| URL パス | コンポーネント | 説明 |
| :--- | :--- | :--- |
| `/` | `pages/Home.jsx` | ダッシュボード。既存のプロジェクト一覧表示または新規作成。 |
| `/library` | `pages/Library.jsx` | グローバルアセットエディタ。再利用可能なシェイプと色を管理します。 |
| `/project/:id` | `pages/Editor.jsx` | メインワークスペース。レイアウトモードとデザインモードが含まれます。 |

### 状態管理 (Zustand)

グローバルストアは `frontend/src/store/` にあるいくつかのスライスで構成されています：

*   **`projectSlice`**: プロジェクト一覧と現在のプロジェクトのメタデータを管理します。
*   **`assetSlice`**: グローバルおよびローカル（プロジェクト固有）のアセットを管理します。
*   **`instanceSlice`**: レイアウト上に配置されたインスタンス（家具、部屋）を管理します。
*   **`uiSlice`**: UI の状態（現在のモード、選択、ズームレベル）を管理します。
*   **`historySlice` (Zundo)**: Undo/Redo 機能を処理します。

### React フックパターン

複雑なロジックはコンポーネントからカスタムフックに移動することを推奨しています。
- `useAutoSave`: プロジェクトデータのデバウンス（遅延）保存を処理します。
- `useKeyboardControls`: グローバルなキーボードショートカット（WASD、Undo/Redo）を処理します。

## 5. データフロー

### ストレージ形式
すべてのデータは、実行ファイルからの相対パス `data/` ディレクトリに JSON ファイルとして保存されます。

*   `projects_index.json`: プロジェクトメタデータのリスト。
*   `global_assets.json`: 共有アセットライブラリ。
*   `palette.json`: 色設定。
*   `project_<id>.json`: 特定のプロジェクトデータ（ローカルアセット + インスタンス）。

### フロー例: プロジェクトの保存
1.  **ユーザーアクション**: ユーザーが `LayoutCanvas` で家具を移動します。
2.  **状態更新**: `instanceSlice` が Zustand ストア内の `x, y` 座標を更新します。
3.  **自動保存トリガー**: `hooks/useAutoSave.js` の `useEffect` が `instances` と `localAssets` を監視しています。
4.  **デバウンス**: 短い遅延（例: 1000ms）の後、エフェクトが発火します。
5.  **API コール**: `frontend/src/lib/api.js` を介して `API.saveProjectData(id, { assets, instances })` が呼び出されます。
6.  **バックエンド**: `app.go` がデータを受け取り、`data/project_<id>.json` に書き込みます。

## 6. 主要なワークフロー

### プロジェクト作成
1.  ユーザーがホーム画面で「Create New Project」をクリックします。
2.  フロントエンドが `API.createProject(name)` を呼び出します。
3.  バックエンドが新しい ID を作成し、`projects_index.json` に追加し、空の `project_<id>.json` を作成します。
4.  フロントエンドが `/project/<new_id>` にナビゲートします。

### アセットのフォーク（分離）
1.  プロジェクトを開く際、`localAssets` が空の場合、フロントエンドは `globalAssets` を `localAssets` にコピーします。
2.  これにより、特定のプロジェクトでシェイプを変更しても、グローバルライブラリや他のプロジェクトには**影響しません**。
3.  ロジックの場所: `frontend/src/domain/assetService.js` (`store/projectSlice.js` から呼び出されます)。

### 幾何学的編集（デザインモード）
1.  ユーザーがアセットのデザインモードに入ります。
2.  頂点を変更すると、アセット内の `entities` 配列が更新されます。
3.  `calculateAssetBounds` を使用して `boundX`, `boundY`, `w`, `h` が再計算されます。
4.  自動カラー更新を防ぐために、アセットには `isDefaultShape: false` フラグが設定されます。
