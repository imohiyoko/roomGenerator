# roomGenerator (間取りアーキテクト Pro)

間取り図（部屋のレイアウト）を生成・編集・管理するためのアプリケーションです。
Wailsフレームワークを使用し、GoとReactで構築されています。

## 特徴

- デスクトップアプリケーションとして動作（Windows/Mac/Linux）
- React + Vite によるモダンなフロントエンド開発環境
- プロジェクトごとの保存・管理機能
- カスタムアセット（家具、設備など）のサポート

## セットアップ

### 必要条件

- Go 1.21 以上
- Node.js 16 以上
- Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

### インストール

1. リポジトリをクローンします。
2. 依存関係を整理します：
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
- `data/`: 保存されたプロジェクトデータ

## ライセンス

このプロジェクトは [LICENSE](LICENSE) ファイルの条件に従って提供されています。
