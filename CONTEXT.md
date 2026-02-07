# 間取りアーキテクト Pro - 次チャット用コンテキスト

**前回の作業**: プラン・分析・実装準備完了（2026年2月7日）  
**このファイルのコピペ先**: 次のチャットルーム → 最初の message に貼り付け

---

## 【背景】このシステムについて

**アプリケーション名**: 間取りアーキテクト Pro (v5.7)

**概要**: Go + React で動作する「間取り図・家具配置シミュレーションツール」

- バックエンド: Go 言語（標準ライブラリのみ）
- フロントエンド: React 18 (CDN) + Babel + Tailwind CSS
- データ保存: ローカル JSON ファイル
- ビルド成果物: 単一の Go 実行ファイル（HTML 埋め込み）

**ファイル構成**:
```
d:\program\Golang\bukken\src\
├── main.go (302行)
├── public/index.html (890行)
└── data/
    ├── projects_index.json
    └── project_*.json
```

---

## 【現在の課題】3つのバグと責務分割

### 📋 3つの主要バグ

#### バグ 1: 設計画面で座標リストが表示されない
- **症状**: 多角形の頂点をクリック → 座標入力フィールドが表示されない
- **原因**: `selectedPointIndex` が常に `null` で初期化されない（React 非同期更新の問題）
- **ファイル**: `public/index.html` の DesignCanvas/DesignProperties コンポーネント

#### バグ 2: 配置モードでアイテムが移動できない
- **症状**: アイテムをドラッグ → マウスカーソルが変わるが → アイテムが動かない
- **原因**: `dragMode` state が非同期更新で遅延、`handleMove()` 発火時にまだ `'idle'`
- **ファイル**: `public/index.html` の LayoutCanvas コンポーネント
- **修正ポイント**: `useRef` で同期的にドラッグ状態を追跡

#### バグ 3: 配置モード右パネルでノードリストが表示されない
- **症状**: リスト表示 → アイテム選択 → リスト消えて詳細に切り替わる
- **原因**: Properties コンポーネントが `selectedIds.length` で排他的に表示切り替え
- **ファイル**: `public/index.html` の Properties コンポーネント
- **修正ポイント**: タブ UI で「リスト」「詳細」を同時表示

---

### 🏗️ 責務分割による開発効率化

#### 現在の問題
- **Editor コンポーネント**: 9個の state を管理（過負荷）
- **単一 HTML**: 890行すべてが 1 ファイル（変更時の認知負荷高い）
- **コンポーネント責務が曖昧**: Canvas、プロパティ、状態管理が混在

#### 改善目標
- **コンポーネント責務を明確化** → 保守性 40% UP
- **Custom Hooks でロジック抽出** → 再利用性 50% UP
- **段階的改善** → npm 導入なしで実装可能

---

## 【実装プラン】段階別改善手順

### Phase 1: バグ修正（2-3h） 🔴 優先度高
```
1. ドラッグ状態を useRef で管理
   → LayoutCanvas で dragRef.current.isDragging を同期的に使用
2. 座標表示の初期化を修正
   → DesignCanvas handleDown() で selectedPointIndex を正確にセット
3. Properties をタブ化
   → `activeTab` state で「リスト」「詳細」を同時表示
```

### Phase 2: コンポーネント分割（2-3h） 🟠 優先度中
```
1. LayoutCanvas → LayoutCanvasRender (描画) + 親で event handling
2. DesignCanvas → DesignCanvasRender (描画) + 親で event handling
3. Editor から Canvas のイベントロジックを親コンポーネントに移動
```

### Phase 3: Custom Hooks 抽出（3-4h） 🟠 優先度中
```
1. useLayoutMode() 実装
   - 配置モード全ロジック（ドラッグ・選択・移動）
   - 返り値: { selectedIds, dragState, instances, ... }

2. useDesignMode() 実装
   - 設計モード全ロジック（図形選択・頂点編集）
   - 返り値: { selectedShapeIndex, selectedPointIndex, ... }

3. useViewState() 実装
   - ビュー管理（ズーム・パン・座標変換）
   - 返り値: { scale, x, y, zoom, pan, ... }

4. Editor で hooks 使用
   - state: 9個 → 4-5個に削減
```

### Phase 4: Go側強化（1-2h） 🟡 優先度低
```
1. APIResponse/APIError 型定義
2. 全エンドポイントでエラーハンドリング追加
3. HTTP ステータスコード (404/409/500) 返却
```

### Phase 5: Vite 検討（中期・1day） 🟡 優先度低 (3か月後)
```
- npm/Vite 導入
- モジュール分割（src/components, src/hooks など）
- TypeScript 対応（オプション）
```

---

## 【技術的なポイント】

### 🔍 Ref vs State の使い分け
- **dragMode**: `useRef` で管理（マウスイベント中の即座反映が必要）
- **selectedIds**: `useState` で管理（画面再描画が必要）
- **Pattern**: `dragRef.current` で参照管理、`setSelectedIds()` で画面更新トリガー

### 📐 座標系メモ
- **内部データ**: cm（センチメートル）
- **画面表示**: mm（ミリメートル）
- **BASE_SCALE**: ピクセル変換スケール
- **変換公式**: `screenPixel = cmValue * BASE_SCALE * 10`

### 🎨 UI 構造
- 左パネル: アセット選択（カテゴリフィルタ付き）
- 中央: キャンバス（配置/設計モード）
- 右パネル: プロパティ（タブ式 → 「リスト」「詳細」同時表示）

---

## 【ファイル位置情報】主要コンポーネント

### main.go (302行)
- L1-15: パッケージ・インポート
- L16-33: 構造体定義（Project, Asset など）
- L34-156: ハンドラ関数（3個のエンドポイント）
- L157-240: ヘルパー関数（JSON I/O）
- L241-302: 初期化・デフォルトアセット定義

### index.html (890行)
- **L68-76**: API ラッパー（fetch）
- **L172-205**: App（ルートコンポーネント）
- **L208-312**: Editor（メインコンテナ、**9 state あり）
- **L334-420**: LayoutCanvas（**ドラッグバグあり）
- **L478-509**: LayoutSidebar（左パネル）
- **L562-633**: Properties（**リスト非表示バグあり）
- **L636-750**: DesignCanvas（設計モード描画）
- **L752-870**: DesignProperties（**座標表示バグあり）

---

## 【前回の成果物】

### 作成済みドキュメント

1. **PLAN.md**
   - 実装プラン（6段階）
   - バグ詳細分析
   - チェックリスト

2. **ANALYSIS.md**
   - 定量的メトリクス
   - コンポーネント構成マップ
   - 3つのバグ詳細分析
   - Go バックエンド分析
   - 開発環境課題分析

3. **このファイル (CONTEXT.md)**
   - 背景・現況
   - 実装プラン概要
   - 技術的なポイント
   - 次ステップガイド

---

## 【次ステップ】各フェーズのプロンプト指示

### Phase 1: バグ修正 3件（次チャット開始時のプロンプト）

**📝 次のチャットで下記を実行してください：**

```
ドキュメント CONTEXT.md と PLAN.md を参考にして、以下の 3 つのバグを修正してください。

【修正対象】
1. ドラッグ状態を useRef で管理（LayoutCanvas）
   - dragRef.current.isDragging で同期的に参照
   - handleMove() が即座に反応するように修正

2. 座標表示の初期化を修正（DesignCanvas/DesignProperties）
   - 頂点をクリック時に selectedPointIndex を正確にセット
   - 座標入力フィールドが表示されるように修正

3. Properties をタブ UI に変更
   - 「リスト」「詳細」を排他的ではなく同時表示
   - activeTab state で切り替え可能にする

【ファイル】
- public/index.html

【確認項目】
- 座標が表示される
- アイテムがドラッグで移動できる
- リストと詳細が同時表示される
```

**実行後**: 修正完了したら Phase 2 に進む

---

### Phase 2: コンポーネント分割（修正完了後のプロンプト）

**📝 修正後、次のように実行してください：**

```
PLAN.md の「Phase 2: コンポーネント分割」に従い、index.html 内のコンポーネントを分割してください。

【分割対象】
1. LayoutCanvas
   - LayoutCanvasRender（SVG 描画のみ）
   - イベントハンドラ（ドラッグ・選択ロジック）を親に移動

2. DesignCanvas
   - DesignCanvasRender（SVG 描画のみ）
   - イベントハンドラ（頂点選択・編集ロジック）を親に移動

【効果】
- 各コンポーネントが 50行程度に
- ロジックと描画が明確に分離
- テスト容易性向上

【ファイル】
- public/index.html

【動作確認】
- 配置・設計モード両方が動作すること
- Phase 1 の修正が保持されていること
```

**実行後**: 分割完了したら Phase 3 に進む

---

### Phase 3: Custom Hooks 抽出（分割完了後のプロンプト）

**📝 分割後、次のように実行してください：**

```
PLAN.md の「Phase 3: Custom Hooks 抽出」に従い、Editor のロジックを custom hooks に抽出してください。

【実装対象】
1. useLayoutMode()
   - 配置モード全ロジック（selectedIds, dragState, instances 管理）
   - ドラッグ・選択・移動関連の状態と関数を返す

2. useDesignMode()
   - 設計モード全ロジック（designTargetId, selectedShapeIndex, selectedPointIndex 管理）
   - 図形選択・頂点編集関連の状態と関数を返す

3. useViewState()
   - ビュー管理（scale, x, y, zoom, pan 管理）
   - 座標変換関数も提供

【効果】
- Editor の state: 9個 → 4-5個に削減
- ロジック再利用性向上
- ユニットテスト対象の明確化

【ファイル】
- public/index.html（hooks は HTML 内に定義）

【動作確認】
- 配置・設計モード両方が動作すること
- Phase 1・2 の修正が保持されていること
- Editor コンポーネントのコード行数が削減されていること
```

**実行後**: Custom Hooks 完了したら Phase 4 に進む

---

### Phase 4: Go側エラーハンドリング強化（hooks 完了後のプロンプト）

**📝 Custom Hooks 完了後、次のように実行してください：**

```
PLAN.md の「Phase 4: Go側強化」に従い、main.go にエラーハンドリングを追加してください。

【実装対象】
1. APIResponse/APIError 型定義
   - Success bool
   - Data interface{}
   - Error *APIError

2. APIError 型定義
   - Code int（1000: ファイル不見つかり など）
   - Message string（詳細メッセージ）

3. エラーハンドリングを全エンドポイントに追加
   - handleGetAssets
   - handleGetProjects
   - handleGetProjectData
   - その他 PUT/DELETE/PATCH

4. ヘルパー関数を追加
   - respondJSON(w, data)
   - respondError(w, code, message)

【効果】
- ネットワーク障害時に適切なエラー応答
- フロント側で error 判定可能に
- デバッグが容易に

【ファイル】
- src/main.go

【動作確認】
- curl で GET /api/assets などをテストして 200 OK か error が返されることを確認
- 存在しないファイルをアクセスして 404 相当のエラーが返されることを確認
```

**実行後**: Go側改善完了

---

### Phase 5: Vite 導入検討（3か月後以降）

**📝 中期的に Vite 導入を検討する場合：**

```
PLAN.md の「Phase 5: Vite 検討」を参照し、以下を実施してください。

【準備項目】
1. npm プロジェクト初期化
2. Vite + React + Babel プラグイン設定
3. src/ ディレクトリ構造設計
4. HTML → JSX への段階的移行
5. Go 側で Vite ビルド出力を embed

【実施時期】
- Phase 1-4 が完全に完了してから
- チーム規模が増えてから（現在不要）
```

---

## 【次チャットでの流れ】

1. **チャット開始** → CONTEXT.md をすべてコピペ
2. **Phase 1 プロンプト** → 上記「Phase 1: バグ修正 3件」のプロンプトを実行するよう指示
3. **修正完了確認** → 動作テスト
4. **Phase 2 プロンプト** → 修正後、上記「Phase 2: コンポーネント分割」を実行
5. **以降同様に** → Phase 3, 4 を順序通り実施

---

## 【参照リンク】重要なセクション

**PLAN.md の主要セクション:**
- 実装スケジュール（表）
- 実装チェックリスト（タスク分解）

**ANALYSIS.md の主要セクション:**
- 3つの主要バグ詳細分析
- React コンポーネント構成マップ（行番号付き）
- 開発環境課題分析

---

## 【よくある質問】

### Q1: なぜ npm/Vite を導入しないのか？
A: ローカル完結型ツールで環境構築最小化が目標。段階 1-4 で十分な効果が得られる。Vite は中期の選択肢。

### Q2: Custom Hooks だけで状態管理は十分か？
A: 現在のアーキテクチャ（App → Editor → Canvas）では十分。グローバル state がほぼないため。

### Q3: 既存 HTML を修正しつつ分割できるのか？
A: 可能。HTML 内でコンポーネント分割（描画関数の分離）→ Custom Hooks 抽出 → 最終的に Vite 検討。

### Q4: どのバグから修正すべき？
A: バグ 2（ドラッグ不可）→ バグ 1（座標表示）→ バグ 3（リスト表示）の順推奨。ユーザーへの影響度順。

---

**文書バージョン**: 1.0  
**作成日**: 2026年2月7日  
**用途**: 次チャットルーム開始時に貼り付け用
