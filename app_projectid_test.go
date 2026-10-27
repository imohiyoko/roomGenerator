package main

import (
	"os"
	"path/filepath"
	"testing"
)

// TestProjectFilePathRejectsInvalidID はパス区切りや ".." を含むIDを拒否することを検証します
func TestProjectFilePathRejectsInvalidID(t *testing.T) {
	a := &App{dataDir: t.TempDir()}

	invalid := []string{"", "..", "../x", "..\\x", "a/b", "a\\b", "x/../../evil", "a.b", "a b", "\x00"}
	for _, id := range invalid {
		if _, err := a.projectFilePath(id); err == nil {
			t.Errorf("不正なID %q が受理されました", id)
		}
	}

	valid := []string{"1700000000000000000", "abc_DEF-123"}
	for _, id := range valid {
		p, err := a.projectFilePath(id)
		if err != nil {
			t.Errorf("正当なID %q が拒否されました: %v", id, err)
			continue
		}
		if filepath.Dir(p) != a.dataDir {
			t.Errorf("パスがdataディレクトリの外です: %s", p)
		}
	}
}

// TestProjectAPIsRejectTraversal は各APIがdataディレクトリ外のファイルに触れないことを検証します
func TestProjectAPIsRejectTraversal(t *testing.T) {
	root := t.TempDir()
	dataDir := filepath.Join(root, "data")
	if err := os.Mkdir(dataDir, 0755); err != nil {
		t.Fatal(err)
	}
	// dataディレクトリの外に置いた攻撃対象のファイル
	victim := filepath.Join(root, "project_victim.json")
	if err := os.WriteFile(victim, []byte(`{"keep":true}`), 0644); err != nil {
		t.Fatal(err)
	}

	a := &App{dataDir: dataDir}
	id := "x/../../project_victim"

	if _, err := a.GetProjectData(id); err == nil {
		t.Error("GetProjectData が不正なIDを受理しました")
	}
	if err := a.SaveProjectData(id, map[string]interface{}{}); err == nil {
		t.Error("SaveProjectData が不正なIDを受理しました")
	}
	if err := a.DeleteProject(id); err == nil {
		t.Error("DeleteProject が不正なIDを受理しました")
	}

	got, err := os.ReadFile(victim)
	if err != nil {
		t.Fatalf("dataディレクトリ外のファイルが削除されました: %v", err)
	}
	if string(got) != `{"keep":true}` {
		t.Errorf("dataディレクトリ外のファイルが書き換えられました")
	}
}

// TestProjectRoundTripWithGeneratedID は CreateProject が生成するIDで保存・読込・削除できることを検証します
func TestProjectRoundTripWithGeneratedID(t *testing.T) {
	a := &App{dataDir: t.TempDir()}

	p, err := a.CreateProject("test")
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	if err := a.SaveProjectData(p.ID, map[string]interface{}{"instances": []interface{}{}}); err != nil {
		t.Fatalf("SaveProjectData: %v", err)
	}
	if _, err := a.GetProjectData(p.ID); err != nil {
		t.Fatalf("GetProjectData: %v", err)
	}
	if err := a.DeleteProject(p.ID); err != nil {
		t.Fatalf("DeleteProject: %v", err)
	}
}
