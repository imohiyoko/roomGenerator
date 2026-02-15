import json
from playwright.sync_api import sync_playwright, expect

def run(page):
    # Mock data
    project_id = "proj_1"

    mock_project_data = {
        "id": project_id,
        "name": "Test Project",
        "assets": [
            {
                "id": "asset_1",
                "name": "Test Asset",
                "type": "composite",
                "w": 100,
                "h": 100,
                "entities": [
                    {
                        "type": "polygon",
                        "x": 10, "y": 10, "w": 80, "h": 80,
                        "points": [{"x": 10, "y": 10}, {"x": 90, "y": 10}, {"x": 50, "y": 90}],
                        "color": "#ff0000"
                    }
                ]
            }
        ],
        "instances": [],
        "viewState": {"x": 100, "y": 500, "scale": 1}
    }

    # Inject mock window.go
    page.add_init_script(f"""
        window.go = {{
            main: {{
                App: {{
                    GetProjects: () => {{ console.log("GetProjects called"); return Promise.resolve([{{ "id": "{project_id}", "name": "Test Project" }}]); }},
                    GetAssets: () => Promise.resolve([]),
                    GetPalette: () => Promise.resolve({{ "colors": [], "defaults": {{}} }}),
                    GetProjectData: (id) => {{ console.log("GetProjectData called for " + id); return Promise.resolve({json.dumps(mock_project_data)}); }},
                    SaveProjectData: () => Promise.resolve(),
                    CreateProject: () => Promise.resolve("{project_id}")
                }}
            }}
        }};
        console.log("Mock window.go injected");
    """)

    page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Browser Error: {err}"))

    # Go to home
    page.goto(f"http://localhost:5173/")

    # Wait for project card
    try:
        # Match input with display value
        card_input = page.locator(f"input[value='Test Project']")
        expect(card_input).to_be_visible(timeout=5000)
    except:
        print("Test Project card not found. Page content:")
        page.screenshot(path="/home/jules/verification/home_failure.png")
        raise

    project_card = card_input.locator("../..")
    project_card.click()

    # Switch to Design mode
    try:
        design_mode_btn = page.get_by_role("button", name="パーツ設計")
        expect(design_mode_btn).to_be_visible(timeout=5000)
    except:
        print("Design mode button not found.")
        page.screenshot(path="/home/jules/verification/editor_failure.png")
        raise

    design_mode_btn.click()

    # Wait for canvas path
    shape_path = page.locator("div.canvas-scroll svg path").first
    expect(shape_path).to_be_visible()

    # Get initial path d attribute
    initial_d = shape_path.get_attribute("d")
    print(f"Initial path d: {initial_d}")

    # Click the path to select
    shape_path.click(force=True)

    # Wait for point
    point = page.locator("div.canvas-scroll circle.cursor-crosshair").first
    expect(point).to_be_visible()

    # Select point
    point.click(force=True)
    expect(point).to_have_attribute("fill", "red")

    # Find delete button (red circle)
    delete_btn_group = page.locator("div.canvas-scroll g.cursor-pointer").filter(has=page.locator("circle[fill='red']")).first
    expect(delete_btn_group).to_be_visible()

    # Handle confirm dialog
    page.on("dialog", lambda dialog: dialog.accept())

    # Get bounding box and click manually
    box = delete_btn_group.bounding_box()
    if box:
        page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    else:
        delete_btn_group.click(force=True)

    # Verify path changed (meaning old shape deleted, default shape appeared)
    # We wait for d attribute to be different
    expect(shape_path).not_to_have_attribute("d", initial_d)

    final_d = shape_path.get_attribute("d")
    print(f"Final path d: {final_d}")

    # Take screenshot
    page.screenshot(path="/home/jules/verification/verification.png")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
        run(page)
        print("Verification script finished successfully.")
    except Exception as e:
        print(f"Verification failed: {e}")
    finally:
        browser.close()
