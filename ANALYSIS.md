# 間取りアーキテクト Pro (v5.7) - 現状分析レポート

**分析日**: 2026年2月7日  
**調査対象**: Go バックエンド + React フロントエンド

---

## 1. 定量的メトリクス

| 項目 | 値 | 評価 |
|------|-----|------|
| **Go 総行数** | 302行 | 小規模・標準ライブラリのみ |
| **React 総行数** | 890行 | **単一ファイルに集約** |
| **React コンポーネント数** | 18個 | 中程度（ネスト構造） |
| **API エンドポイント数** | 3個 | 最小限の設計 |
| **Go ハンドラ関数** | 3個 | RESTful パターン |
| **go.mod 存在** | ❌ なし | 外部依存ゼロ |
| **静的ファイル埋め込み** | ✅ あり | バイナリ化可能 |

---

## 2. ファイル構成

```
d:\program\Golang\bukken\src\
├── main.go (302行)
│   ├─ パッケージ・インポート (L1-15)
│   ├─ データ構造定義 (L16-33): Project, ProjectData など
│   ├─ HTTP ハンドラ (L34-156): 3個のエンドポイント
│   ├─ ヘルパー関数 (L157-240): JSON I/O、ブラウザ起動
│   └─ 初期化 (L241-302): デフォルトアセット17個
│
├── public/
│   └── index.html (890行)
│       ├─ CDN リンク (React 18, Babel, Tailwind)
│       ├─ API ラッパー (L68-76)
│       ├─ React コンポーネント18個 (L45-870)
│       └─ ルート App コンポーネント (L172-205)
│
└── data/
    ├── projects_index.json
    ├── global_assets.json
    └── project_{UUID}.json
```

---

## 3. Go バックエンド分析

### 3.1 ハンドラ構成

| エンドポイント | 行数 | 処理内容 |
|---|---|---|
| `GET/POST /api/assets` | 40 | グローバルアセット読み書き |
| `GET/POST /api/projects` | 50 | プロジェクト一覧・新規作成 |
| `GET/PUT/DELETE/PATCH /api/projects/:id` | 66 | 個別プロジェクト操作 |

### 3.2 問題点

#### 🔴 エラーハンドリング欠落
```go
// 例: L92
data, _ := ioutil.ReadFile(...)  // エラー無視
json.NewEncoder(w).Encode(data)   // nil を返すことも
```
- **影響**: ファイル不在時に不定の挙動
- **ユーザー体験**: 空の応答が返る

#### 🟠 並行制御が単純
```go
// 全エンドポイント共通
mutex.Lock()
defer mutex.Unlock()
```
- **問題**: 全リソースで 1 つの mutex
- **影響**: 複数プロジェクト同時アクセス時は直列化

#### 🟡 ファイル I/O の効率性
- 毎リクエストで全ファイル再読込
- キャッシング戦略なし

### 3.3 構造定義

```go
type Project struct {
    ID        string    `json:"id"`        // UUID
    Name      string    `json:"name"`
    UpdatedAt time.Time `json:"updatedAt"`
    Assets    []Asset   `json:"assets"`    // ローカル定義
    Instances []Instance `json:"instances"` // 配置データ
}

type Asset struct {
    ID     string  `json:"id"`
    Name   string  `json:"name"`
    Type   string  `json:"type"`  // room|fixture|furniture
    W, H   float64 `json:"w,h"`
    Color  string  `json:"color"`
    Snap   bool    `json:"snap"`
    Source string  `json:"source"` // global|local
    Shapes []Shape `json:"shapes"`
}
```

---

## 4. React フロントエンド分析

### 4.1 React コンポーネント構成

| # | コンポーネント | 行番号 | 責務 | 主要 state |
|----|---|---|---|---|
| 1 | Icon (ヘルパー) | L45 | SVG アイコン | なし |
| 2 | Icons (オブジェクト) | L46-66 | アイコン定義 | 静的 |
| 3 | API | L68-76 | fetch ラッパー | なし |
| 4 | ProjectCard | L140-151 | プロジェクトカード表示 | name, editing |
| 5 | **App** | L172-205 | **ルート** | **view, projects, currentProject, globalAssets** |
| 6 | **Editor** | L208-312 | **メイン画面** | **localAssets, instances, mode, selectedIds, viewState (9個)** |
| 7 | Ruler | L315-331 | 定規表示 | props のみ |
| 8 | **LayoutCanvas** | L334-420 | **配置モード描画** | dragMode, selectedShapeIndex (**ドラッグバグあり**) |
| 9 | RenderItem | L422-448 | アイテム個別描画 | props のみ |
| 10 | RenderAssetShapes | L450-468 | SVG シェイプ描画 | props のみ |
| 11 | RenderDimensions | L470-475 | 寸法ラベル | props のみ |
| 12 | LayoutSidebar | L478-509 | 左パネル（配置） | filter |
| 13 | DesignListPanel | L511-560 | 左パネル（設計） | filter |
| 14 | **Properties** | L562-633 | **右パネル** | props のみ (**リスト非表示バグあり**) |
| 15 | **DesignCanvas** | L636-750 | **設計モード描画** | isSelected, selectedShapeIndex, selectedPointIndex (**座標表示バグあり**) |
| 16 | DesignProperties | L752-870 | 設計パラメータ | props のみ |
| 17 | EditableTitle | L153-161 | インライン編集 | val |
| 18 | AssetFilter | L163-169 | フィルタボタン | props のみ |

### 4.2 state 管理の現状

**App コンポーネント (4 個の state)**
```javascript
const [view, setView] = useState('dashboard');        // 'dashboard' | 'editor'
const [projects, setProjects] = useState([]);
const [currentProject, setCurrentProject] = useState(null);
const [globalAssets, setGlobalAssets] = useState([]);
```

**Editor コンポーネント (9 個の state + useRef 2 個)**
```javascript
const [localAssets, setLocalAssets] = useState([]);
const [instances, setInstances] = useState([]);
const [mode, setMode] = useState('layout');
const [selectedIds, setSelectedIds] = useState([]);
const [viewState, setViewState] = useState({ scale: 1, x: 0, y: 0 });
const [saving, setSaving] = useState(false);

// 設計モード専用
const [designTargetId, setDesignTargetId] = useState(null);
const [selectedShapeIndex, setSelectedShapeIndex] = useState(null);
const [selectedPointIndex, setSelectedPointIndex] = useState(null);

// useRef
const svgRef = useRef(null);
const canvasRef = useRef(null);
```

**問題**: Editor が **9 個の state** で過負荷 → 関心分離が必要

### 4.3 CDN ロード構成

```html
<!-- React 18 (Development) -->
<script src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>

<!-- Babel (JSX 変換) -->
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com"></script>
```

**初回読込**: ~400-500KB + Babel JSX 変換時間 (~500ms)

---

## 5. 3 つの主要バグ詳細分析

### バグ 1: 設計画面で座標リストが表示されない

**現象**: 多角形をクリック → 頂点ハンドルは表示される → 頂点をクリック → 座標フィールドが表示されない

**根本原因**:
```javascript
// L1047-1053: DesignCanvas の handleDown
const handleDown = (e, id, pointId) => {
    setSelectedIds([id]);
    if (pointId !== undefined) {
        setSelectedPointIndex(pointId);  // ← 呼ばれるが...
    }
};

// L1127-1137: DesignProperties での条件チェック
const selectedPoint = (selectedShape && selectedShape.points && selectedPointIndex !== null) 
    ? selectedShape.points[selectedPointIndex] 
    : null;

if (selectedPoint) {
    // 座標表示 ← selectedPointIndex が null のまま進む場合がある
}
```

**なぜ selectedPointIndex が null のままか**:
1. DesignCanvas で `setSelectedPointIndex()` が呼ばれ、React state が更新
2. しかし DesignProperties は親の state を依存
3. **タイミングズレ**: state 更新前に DesignProperties の条件チェックが実行される

**修正ポイント**:
- `handleDown()` 内で `selectedPointIndex` を正確にセット
- または、DesignCanvas コンポーネント内でローカル state を持たせる

---

### バグ 2: 配置モードでアイテムが移動できない

**現象**: アイテムをドラッグ → マウスカーソルが変わるが → アイテムが動かない

**根本原因**: React 非同期状態更新

```javascript
// L656-660: LayoutCanvas の handleDown
const handleDown = (e, id) => {
    const target = instances.find(i => i.id === id);
    if (target && !target.locked) {
        setDragMode('dragging');  // ← 非同期、ここで state は未更新
    }
};

// L683-690: handleMove
const handleMove = (e) => {
    if (dragMode === 'idle') return;  // ← dragMode はまだ 'idle'
    // 移動ロジック実行されない
};
```

**実行フロー**:
1. マウスダウン: `setDragMode('dragging')` キュー登録
2. マウスムーブイベント即座に発火: `dragMode === 'idle'` で return
3. ← 状態が反映されるまで数ms遅延

**修正ポイント**:
- `useRef` で `isDragging` フラグを同期的に管理
- `handleMove()` では Ref から即座に読み取る

```javascript
const dragRef = useRef({ isDragging: false, ... });

const handleDown = (e, id) => {
    dragRef.current.isDragging = true;  // 即座に反映
};

const handleMove = (e) => {
    if (!dragRef.current.isDragging) return;  // Ref から同期的に読み取り
};
```

---

### バグ 3: 配置モード右パネルでノードリストが表示されない

**現象**: 最初はノードリストが表示される → アイテムをクリック → リストが消えて詳細パネルに切り替わる

**根本原因**: UI 構造の排他性

```javascript
// L987-1010: Properties コンポーネント
if (selectedIds.length === 0) {
    // リスト表示
    return (
        <div>
            {instances.map(inst => (
                <div onClick={() => setSelectedIds([inst.id])}>
                    {inst.name}
                </div>
            ))}
        </div>
    );
} else {
    // 詳細表示 ← ここに切り替わる
    return (
        <div>
            {/* 選択アイテムの詳細 */}
        </div>
    );
}
```

**問題**:
- リストと詳細が `if-else` で排他的
- ユーザーは複数アイテムを比較参照できない

**修正ポイント**:
- タブ UI または分割パネルで「リスト」「詳細」を同時表示

```javascript
const [activeTab, setActiveTab] = useState('list');  // 'list' | 'details'

return (
    <div className="flex flex-col">
        <div className="flex border-b">
            <button onClick={() => setActiveTab('list')}>リスト ({instances.length})</button>
            <button onClick={() => setActiveTab('details')}>詳細</button>
        </div>
        {activeTab === 'list' ? (
            <div>{/* リスト表示 */}</div>
        ) : (
            <div>{/* 詳細表示 */}</div>
        )}
    </div>
);
```

---

## 6. 開発環境の課題

### 6.1 ビルド・開発フロー

| 項目 | 現状 | 課題 |
|------|------|------|
| Go ビルド | `go run main.go` | ✅ 問題なし |
| React 編集 | HTML 内で直接 JSX | ❌ ホットリロードなし |
| Babel 変換 | ブラウザで実行時変換 | ⚠️ 開発中は遅い (500ms+) |
| 本番最適化 | なし | ❌ minify/tree-shake なし |
| 依存管理 | npm/yarn 未使用 | ⚠️ バージョン固定なし |

### 6.2 パフォーマンス影響

```
初回ページロード:
├─ HTML ダウンロード: ~50KB
├─ React (dev) CDN: ~200KB
├─ Babel CDN: ~140KB
├─ Tailwind CDN: ~50-100KB (変換)
└─ Babel JSX 変換: ~500ms
────────────────
総合: 400-500KB + 500ms
```

### 6.3 開発効率の課題

- ❌ コンポーネント分割が困難（単一 HTML）
- ❌ 状態管理ライブラリが未導入
- ❌ TypeScript サポート不可（Babel のみ）
- ❌ ユニットテストが実施困難

---

## 7. 責務分割の必要性

### 7.1 現在の構造図

```
App
 ├─ Editor (9 state) ← 過負荷
 │   ├─ LayoutCanvas (dragMode) ← バグあり
 │   ├─ DesignCanvas (selectedShape, selectedPoint) ← バグあり
 │   ├─ LayoutSidebar
 │   ├─ DesignListPanel
 │   ├─ Properties (selectedIds) ← バグあり
 │   └─ Ruler
```

**問題**:
- Editor が配置・設計両モード + プロパティ管理を一括
- Canvas コンポーネント内でドラッグロジックが複雑
- 状態更新の非同期性がバグの原因

### 7.2 改善後の構造（目標）

```
App
 ├─ Editor
 │   ├─ useLayoutMode()  ← custom hook (配置モード全ロジック)
 │   ├─ useDesignMode()  ← custom hook (設計モード全ロジック)
 │   └─ useViewState()   ← custom hook (ビュー管理)
 │
 ├─ LayoutCanvasRender (描画のみ)
 ├─ DesignCanvasRender (描画のみ)
 ├─ Properties (タブ UI)
 └─ Sidebar (フィルタのみ)
```

**効果**:
- ✅ ロジックと描画の分離
- ✅ 状態管理の明確化
- ✅ バグの根本原因排除
- ✅ テスト容易性向上
- ✅ 再利用性向上

---

## 8. 推奨される段階的改善

### 段階 1: 緊急修正（2-3h）
1. ドラッグ状態を Ref に変更 → 非同期バグ解決
2. 座標表示の初期化を修正 → 座標リスト表示
3. Properties をタブ化 → リスト常時表示

### 段階 2: コンポーネント分割（2-3h）
- Canvas 描画部とイベントロジック分離
- 単一 HTML 内での構造化

### 段階 3: Custom Hooks 抽出（3-4h）
- useLayoutMode, useDesignMode, useViewState 実装
- Editor の state 削減

### 段階 4: バックエンド強化（1-2h）
- エラー型定義
- 全エンドポイントにエラーハンドリング追加

### 段階 5: Vite 検討（中期・1day）
- npm/Vite 導入
- モジュール分割
- TypeScript 対応

---

## 参考資料

### ファイル行番号マップ

**main.go**
- L1-15: インポート
- L16-33: 構造体定義
- L34-156: ハンドラ関数
- L157-240: ヘルパー
- L241-302: 初期化

**index.html**
- L45-76: Icon/API（ヘルパー）
- L140-169: ProjectCard/EditableTitle/AssetFilter
- L172-205: App コンポーネント
- L208-312: Editor コンポーネント（**9 state）
- L315-475: Canvas/Ruler 関連
- L478-560: Sidebar 関連
- L562-633: Properties（**バグあり）
- L636-870: DesignCanvas/DesignProperties（**バグあり）

---

## 附録: 技術選定メモ

### なぜ現在 Vite を導入していないか
1. 環境構築を最小化（Go の単一実行ファイルで完結）
2. 初心者向けの敷居を低くしたい
3. ローカル環境が前提のため、ビルド最適化は優先度低い

### なぜ現在 TypeScript を使っていないか
1. Babel + JSX の組み合わせで十分
2. 現在のチーム規模では型チェックの効果が限定的

### なぜ Custom Hooks で十分か（Zustand 不要）
1. 状態が Router ベース（App/Editor/Canvas）
2. グローバル state がほぼない
3. Props drilling は許容範囲内

---

**作成**: 2026年2月7日  
**バージョン**: 1.0
