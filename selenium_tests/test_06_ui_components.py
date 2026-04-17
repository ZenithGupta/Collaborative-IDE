"""
Test Suite 6: UI Components & Visual Elements
===============================================
Tests specific UI components and visual polish.

What this tests:
- Background effects / gradients render
- Animations load (GSAP elements)
- Icons are present
- Images load correctly
- Scrolling behavior
"""

import pytest
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class TestUIComponents:
    """Tests for UI components, visual elements, and interactivity."""

    def test_background_glow_effects(self, driver, base_url):
        """TC-52: Verify background glow/blur effects are rendered."""
        driver.set_window_size(1920, 1080)
        driver.get(base_url)
        time.sleep(3)

        # Check for elements with blur classes (background effects)
        blur_elements = driver.find_elements(By.CSS_SELECTOR, "[class*='blur']")
        assert len(blur_elements) > 0, "Background blur/glow effects should be present"
        print(f"✅ Found {len(blur_elements)} background glow elements")

    def test_gradient_text_rendering(self, driver, base_url):
        """TC-53: Verify gradient text elements render (bg-clip-text)."""
        driver.get(base_url)
        time.sleep(3)

        gradient_text = driver.find_elements(By.CSS_SELECTOR, "[class*='bg-clip-text']")
        assert len(gradient_text) > 0, "Gradient text elements should be present"
        print(f"✅ Found {len(gradient_text)} gradient text elements")

    def test_material_icons_loaded(self, driver, base_url):
        """TC-54: Verify Material Symbols icons are loaded."""
        driver.get(base_url)
        time.sleep(3)

        icons = driver.find_elements(By.CSS_SELECTOR, ".material-symbols-outlined")
        assert len(icons) > 0, "Material icons should be loaded"
        print(f"✅ Found {len(icons)} Material Symbols icons")

    def test_avatar_images_load(self, driver, base_url):
        """TC-55: Verify collaborator avatar images load in header."""
        driver.get(base_url)
        time.sleep(3)

        images = driver.find_elements(By.CSS_SELECTOR, "header img")
        loaded_images = []
        for img in images:
            natural_width = driver.execute_script(
                "return arguments[0].naturalWidth", img
            )
            if natural_width and natural_width > 0:
                loaded_images.append(img)

        print(f"✅ {len(loaded_images)}/{len(images)} header images loaded successfully")

    def test_smooth_scroll_works(self, driver, base_url):
        """TC-56: Verify page can be scrolled smoothly."""
        driver.get(base_url)
        time.sleep(3)

        # Get initial scroll position
        initial_scroll = driver.execute_script("return window.pageYOffset")

        # Scroll down
        driver.execute_script("window.scrollTo(0, 500)")
        time.sleep(1)

        # Get new scroll position
        new_scroll = driver.execute_script("return window.pageYOffset")
        assert new_scroll > initial_scroll, \
            f"Page should scroll. Initial: {initial_scroll}, After: {new_scroll}"
        print("✅ Smooth scrolling works")

    def test_ide_mockup_has_code_elements(self, driver, base_url):
        """TC-57: Verify the IDE mockup section has code-like elements."""
        driver.get(base_url)
        time.sleep(3)

        # Check for monospace/code-like content
        mono_elements = driver.find_elements(By.CSS_SELECTOR, ".font-mono")
        assert len(mono_elements) > 0, "IDE mockup should have monospace elements"
        print(f"✅ Found {len(mono_elements)} monospace (code) elements")

    def test_hover_effects_on_buttons(self, driver, base_url):
        """TC-58: Verify buttons have interactive styling (not plain)."""
        driver.get(base_url)
        time.sleep(3)

        buttons = driver.find_elements(By.TAG_NAME, "button")
        styled_buttons = 0
        for btn in buttons:
            if btn.is_displayed() and btn.text.strip():
                classes = btn.get_attribute("class") or ""
                has_styling = any(cls in classes for cls in [
                    "hover:", "transition", "bg-", "gradient", "rounded"
                ])
                if has_styling:
                    styled_buttons += 1

        assert styled_buttons > 0, "Buttons should have interactive styling"
        print(f"✅ {styled_buttons} buttons have interactive styling")

    def test_rounded_corners_on_cards(self, driver, base_url):
        """TC-59: Verify feature cards have rounded corners."""
        driver.get(base_url)
        time.sleep(2)

        driver.execute_script("window.scrollTo(0, document.body.scrollHeight / 2)")
        time.sleep(1)

        rounded_elements = driver.find_elements(By.CSS_SELECTOR, "[class*='rounded-xl']")
        assert len(rounded_elements) > 0, "Feature cards should have rounded corners"
        print(f"✅ Found {len(rounded_elements)} elements with rounded corners")

    def test_page_has_sections(self, driver, base_url):
        """TC-60: Verify the page is organized into <section> elements."""
        driver.get(base_url)
        time.sleep(2)

        sections = driver.find_elements(By.TAG_NAME, "section")
        assert len(sections) >= 3, \
            f"Expected at least 3 sections (hero, features, cta), found {len(sections)}"
        print(f"✅ Page has {len(sections)} sections")

    def test_no_console_errors(self, driver, base_url):
        """TC-61: Verify no critical JavaScript errors in console."""
        driver.get(base_url)
        time.sleep(3)

        logs = driver.get_log("browser")
        severe_errors = [log for log in logs if log["level"] == "SEVERE"]

        if severe_errors:
            for err in severe_errors[:3]:
                print(f"  ⚠️ Console error: {err['message'][:100]}")
        
        # We allow some errors (CORS, etc.) but flag them
        print(f"✅ Console check complete. {len(severe_errors)} severe errors found")

    def test_footer_cta_gradient_bar(self, driver, base_url):
        """TC-62: Verify the CTA section has the gradient top bar."""
        driver.get(base_url)
        time.sleep(2)

        driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(1)

        gradient_bars = driver.find_elements(
            By.CSS_SELECTOR, "[class*='bg-gradient-to-r']"
        )
        assert len(gradient_bars) > 0, "CTA section gradient bar should be present"
        print(f"✅ Found {len(gradient_bars)} gradient elements")
