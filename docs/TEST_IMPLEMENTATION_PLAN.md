# テスト実装計画

このドキュメントは、本プロジェクト（imohiyoko/roomGenerator）にテストを導入するためのガイドラインとプロンプトを提供します。

## プロジェクト概要

- **フレームワーク:** Wails v2 (Go backend + React frontend)
- **構造:**
  - `main.go`: エントリーポイント。`//go:embed all:frontend/dist` を使用してビルド済みフロントエンド資産を埋め込みます。
  - `app.go`: アプリケーションロジック（`App`構造体、APIメソッド）。
  - `frontend/`: React + Vite フロントエンド。
  - `wails.json`: プロジェクト設定。

## テストの目的

1.  **バックエンドロジックの検証:** `app.go` 内のデータ処理（マイグレーション、ファイルI/O、計算ロジック）が正しく動作することを確認する。
2.  **CIの信頼性向上:** プルリクエストごとに自動テストを実行し、リグレッションを防ぐ。

## テスト実装プロンプト

以下は、AIアシスタントや開発者がテストを実装する際に使用できるプロンプトです。

---

**タスク: Wailsプロジェクトへのテスト追加**

このプロジェクト（imohiyoko/roomGenerator）はWailsを使用したデスクトップアプリケーションです。現在はテストファイルが存在しません。以下の要件に従って、Goバックエンドのテストを実装してください。

### 要件

1.  **テスト対象:**
    - `app.go` 内のロジック、特に外部依存（DBやGUI）が少ないメソッド。
    - 例: `getDefaultGlobalAssets`（初期データ生成）、`migrateAssets`（データ変換）、`createPolygonAsset`（ヘルパー関数）。

2.  **テストの種類:**
    - **ユニットテスト:** `app_test.go` をルートディレクトリに作成してください。
    - Wailsのランタイム（`runtime`パッケージ）に依存するメソッドは、モックが必要になる場合があるため、まずは依存の少ないロジックからテストしてください。

3.  **制約事項:**
    - `main.go` にある `//go:embed` ディレクティブは、`frontend/dist` が存在しない場合（CI環境など）にビルドエラーを引き起こす可能性があります。テスト実行時（`go test`）は `main` パッケージのビルドを含まないようにするか、または `embed` を回避する工夫が必要です。
    - ただし、ユニットテストが `main` パッケージ（`package main`）に属する場合、`main.go` もコンパイル対象になる点に注意してください。

4.  **ファイル配置:**
    - テストファイルはテスト対象のコードと同じディレクトリ（ルート）に `app_test.go` として配置してください。

5.  **サンプルコード:**
    ```go
    package main

    import (
        "testing"
    )

    func TestGetDefaultGlobalAssets(t *testing.T) {
        assets := getDefaultGlobalAssets()
        if len(assets) == 0 {
            t.Errorf("Expected default assets to be returned, got 0")
        }
        // 追加の検証（特定のIDが含まれているかなど）
    }
    ```

### 注意点

- CI環境ではフロントエンドのビルドが行われていない状態で `go test` が走る可能性があります。`embed` エラーを回避するため、テストファイル内でのパッケージ構成やビルドタグの使用を検討してください。

---
