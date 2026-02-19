package main

import (
	"testing"
)

// TestGetDefaultGlobalAssets はデフォルトアセットの生成ロジックを検証します
func TestGetDefaultGlobalAssets(t *testing.T) {
	assets := getDefaultGlobalAssets()

	if len(assets) == 0 {
		t.Error("デフォルトアセットが生成されていません")
	}

	// 期待されるアセットが含まれているか確認 (例: ID "a_room6")
	found := false
	for _, a := range assets {
		if a.ID == "a_room6" {
			found = true
			if a.Type != "room" {
				t.Errorf("アセット 'a_room6' のタイプが不正です: got %s, want room", a.Type)
			}
			break
		}
	}

	if !found {
		t.Error("必須アセット 'a_room6' が見つかりません")
	}
}

// TestMigrateAssets はレガシーデータ（shapes）のマイグレーションを検証します
func TestMigrateAssets(t *testing.T) {
	// レガシーデータ構造（map[string]interface{}）
	legacyData := []map[string]interface{}{
		{
			"id":   "legacy_1",
			"name": "Legacy Room",
			"type": "room",
			"w":    100.0,
			"h":    100.0,
			"shapes": []interface{}{ // 旧キー "shapes"
				map[string]interface{}{
					"type":  "polygon",
					"color": "#ffffff",
					"points": []interface{}{
						map[string]interface{}{"x": 0.0, "y": 0.0},
						map[string]interface{}{"x": 100.0, "y": 0.0},
						map[string]interface{}{"x": 100.0, "y": 100.0},
						map[string]interface{}{"x": 0.0, "y": 100.0},
					},
				},
			},
		},
	}

	migrated := migrateAssets(legacyData)

	if len(migrated) != 1 {
		t.Fatalf("マイグレーション結果の件数が不正です: got %d, want 1", len(migrated))
	}

	asset := migrated[0]
	if asset.ID != "legacy_1" {
		t.Errorf("IDが正しくありません: got %s, want legacy_1", asset.ID)
	}

	// Entitiesに変換されているか確認
	if len(asset.Entities) != 1 {
		t.Fatalf("Entitiesが生成されていません: got %d, want 1", len(asset.Entities))
	}

	entity := asset.Entities[0]
	if entity.Type != "polygon" {
		t.Errorf("Entityタイプが不正です: got %s, want polygon", entity.Type)
	}
	if len(entity.Points) != 4 {
		t.Errorf("Points数が不正です: got %d, want 4", len(entity.Points))
	}
}
