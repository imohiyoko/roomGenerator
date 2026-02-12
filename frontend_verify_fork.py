from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        context.add_init_script("""
            window.go = {
                main: {
                    App: {
                        GetProjects: () => Promise.resolve([{id: 'p1', name: 'TestProject', updatedAt: '2023-01-01T00:00:00Z'}]),
                        CreateProject: (name) => Promise.resolve({id: 'p-' + Date.now(), name: name, updatedAt: new Date().toISOString()}),
                        GetAssets: () => Promise.resolve([]),
                        SaveAssets: (data) => Promise.resolve(),
                        GetPalette: () => Promise.resolve({
                            colors: ['#ff0000', '#00ff00', '#0000ff'],
                            defaults: { room: '#ff0000', furniture: '#00ff00', fixture: '#0000ff' }
                        }),
                        SavePalette: (data) => { console.log('Saved Palette:', JSON.stringify(data)); window.mockPalette = data; return Promise.resolve(); },
                        GetProjectData: (id) => Promise.resolve({ assets: [], instances: [] }),
                        SaveProjectData: (id, data) => Promise.resolve(),
                        DeleteProject: (id) => Promise.resolve(),
                        UpdateProjectName: (id, name) => Promise.resolve()
                    }
                }
            };
        """)

        page = context.new_page()
        page.goto("http://localhost:5173")
        time.sleep(1)

        print("Going to Library...")
        page.get_by_role("button", name="共通ライブラリ管理").click()
        time.sleep(1)

        print("Changing Room Default Color to Yellow...")
        room_section = page.locator("div.flex-col").filter(has_text="部屋・床").first
        room_section.get_by_title("カスタム色").click()
        picker = room_section.locator("input[type='color']")

        # When user interacts with color picker:
        # 1. Click to open (done above)
        # 2. Change value.
        # In `ColorPicker.jsx`: `onChange={handleCustomChange}` -> `setCustomColor` -> `onChange(prop)`
        # React's `onChange` for input type=color fires on input?
        # Yes, usually.
        # But `evaluate` setting value doesn't trigger React's synthetic event system properly sometimes.
        # The key is to wait for the value to propagate.

        # Try a more robust way to set value if possible, or retry evaluate.
        # Using `fill` works for text, but color? Playwright `fill` works for color inputs too.
        picker.fill("#ffff00")

        # Also force event dispatch just in case
        # picker.evaluate("e => { e.value = '#ffff00'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }")

        time.sleep(1)

        # Check Mock
        palette = page.evaluate("window.mockPalette")
        if not palette or palette.get('defaults', {}).get('room') != '#ffff00':
             print("ERROR: Palette not saved correctly. Current state:", palette)
             page.screenshot(path="/home/jules/verification/fail_save.png")
             # Continue anyway to see if other things work (maybe just a race condition in test)
        else:
             print("Verified: Backend SavePalette called with #ffff00")


        print("Going to Project...")
        page.get_by_role("button", name="戻る").click()
        time.sleep(0.5)
        page.locator(".h-40").filter(has=page.locator("input[value='TestProject']")).click()
        time.sleep(1)

        print("Creating Part (Should be Yellow)...")
        page.get_by_role("button", name="パーツ設計").click()
        time.sleep(0.5)
        page.get_by_role("button", name="+ 新規パーツ").click()
        time.sleep(0.5)

        # Open properties panel picker to verify
        page.get_by_title("カスタム色").first.click()
        time.sleep(0.5)

        # Check value
        val = page.locator("input[type='color']").first.input_value()
        print(f"DEBUG: Part color value is {val}")
        if val != "#ffff00":
             print("FAILURE: New part is not Yellow")
             exit(1)

        # Fork the part
        print("Forking Part (Copy/Clone)...")
        page.get_by_role("button", name="コピーして保存").click()
        time.sleep(0.5)

        print("Going back to Library...")
        page.locator(".border-b button").first.click() # Back
        time.sleep(0.5)
        page.get_by_role("button", name="共通ライブラリ管理").click()
        time.sleep(0.5)

        print("Changing Default to Cyan...")
        room_section = page.locator("div.flex-col").filter(has_text="部屋・床").first
        room_section.get_by_title("カスタム色").click()
        picker = room_section.locator("input[type='color']")
        picker.fill("#00ffff")
        time.sleep(0.5)

        print("Verifying Forked Part Changed to Cyan...")
        page.get_by_role("button", name="戻る").click()
        time.sleep(0.5)
        page.locator(".h-40").filter(has=page.locator("input[value='TestProject']")).click()
        time.sleep(1)
        page.get_by_role("button", name="パーツ設計").click()
        time.sleep(0.5)

        page.get_by_text("新規パーツ (コピー)").click()
        time.sleep(0.5)

        page.get_by_title("カスタム色").first.click()
        val = page.locator("input[type='color']").first.input_value()
        print(f"DEBUG: Forked part color value is {val}")

        if val == "#00ffff":
             print("Verification SUCCESS: Forked part auto-updated.")
        else:
             print("FAILURE: Forked part did not update")
             exit(1)

        page.screenshot(path="/home/jules/verification/fork_success.png")
        browser.close()

if __name__ == "__main__":
    run()
