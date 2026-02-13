# roomGenerator (間取りアーキテクト Pro)

間取り図（部屋のレイアウト）を生成・編集・管理するためのアプリケーションです。
Wailsフレームワークを使用し、GoとReactで構築されています。

## 特徴

- デスクトップアプリケーションとして動作（Windows/Mac/Linux）
- React + Vite によるモダンなフロントエンド開発環境
- **Zustandによる堅牢な状態管理 + Undo/Redo機能**
- プロジェクトごとの保存・管理機能
- カスタムアセット（家具、設備など）のサポート

## セットアップ

### 必要条件

- Go 1.21 以上
- Node.js 16 以上
- Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

### インストール

1. リポジトリをクローンします。
2. 依存関係を整理します（フロントエンドの新しい依存関係を含む）：
   ```bash
   go mod tidy
   cd frontend
   npm install
   ```

## 使い方

### 開発モード (ホットリロード対応)

```bash
wails dev
```
フロントエンドの変更は即座に反映されます。

### ビルド (本番用)

```bash
wails build
```
`build/bin` ディレクトリに実行ファイルが生成されます。

## プロジェクト構成

- `main.go`: アプリケーションのエントリーポイント
- `app.go`: バックエンドロジック (API)
- `frontend/`: フロントエンド (React + Vite)
  - `src/`: ソースコード
    - `lib/store.js`: **状態管理（Zustand + zundo）** - アプリケーションの主要な状態とアクションはここにあります。
    - `App.jsx`: メインUIコンポーネント - ストアを使用して描画します。
- `data/`: 保存されたプロジェクトデータ

## ライセンス

このプロジェクトは [LICENSE](LICENSE) ファイルの条件に従って提供されています。

### 協力
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/imohiyoko/roomGenerator?utm_source=oss&utm_medium=github&utm_campaign=imohiyoko%2FroomGenerator&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)
