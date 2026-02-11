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

        print("Changing Room Default Color...")
        # Open custom color picker for Room (first one)
        page.get_by_title("カスタム色").first.click()

        # Change to Yellow
        room_picker = page.locator("input[type='color']").first
        room_picker.fill("#ffff00")
        time.sleep(0.5)
        expect(page.get_by_text("#ffff00")).to_be_visible()

        print("Going to Project...")
        page.get_by_role("button", name="戻る").click()
        time.sleep(0.5)
        page.locator(".h-40").filter(has=page.locator("input[value='TestProject']")).click()
        time.sleep(1)

        print("Creating Part...")
        page.get_by_role("button", name="パーツ設計").click()
        time.sleep(0.5)
        page.get_by_role("button", name="+ 新規パーツ").click()
        time.sleep(0.5)

        # Verify Yellow
        # We need to open the custom picker in sidebar property panel to check input value
        # Sidebar properties also uses ColorPicker.
        # It's inside "DesignProperties".
        # Let's verify by checking the text span if DesignProperties renders it?
        # DesignProperties does NOT render the hex text below ColorPicker in my implementation (I checked DesignProperties.jsx previously).
        # It only renders ColorPicker.

        # However, ColorPicker has `value` prop.
        # If I open the custom picker in sidebar, the input should have the value.
        print("Verifying Part Color...")
        # Find the custom color button in the sidebar (it might be the only one visible if others are hidden? No, sidebar has one).
        # We are in Design Mode. Sidebar has properties.
        # Click the custom color button in sidebar.
        # There might be multiple ColorPickers (one for 'overall color', one for 'shape color').
        # Let's click the first available 'カスタム色' button which should be for the overall asset color.
        page.get_by_title("カスタム色").first.click()
        expect(page.locator("input[type='color']").first).to_have_value("#ffff00")

        # Modify Part
        print("Modifying Part...")
        vertex = page.locator("circle[r='5']").first
        if vertex.count() > 0:
            box = vertex.bounding_box()
            page.mouse.move(box['x'], box['y'])
            page.mouse.down()
            page.mouse.move(box['x'] + 50, box['y'] + 50)
            page.mouse.up()
            time.sleep(0.5)

        # Change Default to Cyan
        print("Changing Default to Cyan...")
        page.locator(".border-b button").first.click() # Back
        time.sleep(0.5)
        page.get_by_role("button", name="共通ライブラリ管理").click()
        time.sleep(0.5)

        page.get_by_title("カスタム色").first.click()
        page.locator("input[type='color']").first.fill("#00ffff")
        time.sleep(0.5)

        # Verify Part did NOT change
        print("Verifying Part Unchanged...")
        page.get_by_role("button", name="戻る").click()
        time.sleep(0.5)
        page.locator(".h-40").filter(has=page.locator("input[value='TestProject']")).click()
        time.sleep(1)
        page.get_by_role("button", name="パーツ設計").click()
        time.sleep(0.5)
        page.get_by_text("新規パーツ").click()
        time.sleep(0.5)

        page.get_by_title("カスタム色").first.click()
        expect(page.locator("input[type='color']").first).to_have_value("#ffff00")

        print("Verification SUCCESS")
        page.screenshot(path="/home/jules/verification/success.png")
        browser.close()

if __name__ == "__main__":
    run()
