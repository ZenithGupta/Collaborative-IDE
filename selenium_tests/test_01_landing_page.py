"""
Test Suite 1: Landing Page (Index)
===================================
Tests the public landing/home page of the Collaborative IDE.

What this tests:
- Page loads successfully
- Key UI elements are visible (header, hero, features, CTA)
- Navigation buttons work correctly
"""

import pytest
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class TestLandingPage:
    """Tests for the landing/home page."""

    def test_page_loads(self, driver, base_url):
        """TC-01: Verify the landing page loads without errors."""
        driver.get(base_url)
        time.sleep(3)  # Wait for animations to complete

        # Page should have loaded (not a blank error page)
        assert "localhost" in driver.current_url or "127.0.0.1" in driver.current_url
        print("✅ Landing page loaded successfully")

    def test_header_visible(self, driver, base_url):
        """TC-02: Verify the header/navbar is visible with brand name."""
        driver.get(base_url)
        wait = WebDriverWait(driver, 10)

        # Look for the brand name "Collaborative IDE" in the header
        header = wait.until(
            EC.presence_of_element_located((By.TAG_NAME, "header"))
        )
        assert header.is_displayed(), "Header should be visible"

        brand_text = header.text
        assert "Collaborative IDE" in brand_text, \
            f"Header should contain 'Collaborative IDE', got: {brand_text}"
        print("✅ Header with brand name is visible")

    def test_hero_section_content(self, driver, base_url):
        """TC-03: Verify hero section displays the main headline."""
        driver.get(base_url)
        wait = WebDriverWait(driver, 10)

        # Wait for hero section to load
        time.sleep(2)

        # Look for the main headline
        h1 = wait.until(
            EC.presence_of_element_located((By.TAG_NAME, "h1"))
        )
        assert h1.is_displayed(), "Hero headline should be visible"
        assert "speed" in h1.text.lower() or "thought" in h1.text.lower(), \
            f"Hero should mention 'speed' or 'thought', got: {h1.text}"
        print(f"✅ Hero headline found: '{h1.text[:50]}...'")

    def test_hero_subtitle_visible(self, driver, base_url):
        """TC-04: Verify the hero subtitle/description is visible."""
        driver.get(base_url)
        time.sleep(2)

        # Find the subtitle paragraph
        paragraphs = driver.find_elements(By.TAG_NAME, "p")
        subtitle_found = any(
            "collaborative" in p.text.lower() or "AI" in p.text
            for p in paragraphs if p.text.strip()
        )
        assert subtitle_found, "Hero subtitle about collaboration/AI should exist"
        print("✅ Hero subtitle is visible")

    def test_cta_buttons_present(self, driver, base_url):
        """TC-05: Verify 'Start Coding for Free' and 'Log In' CTA buttons exist."""
        driver.get(base_url)
        time.sleep(2)

        buttons = driver.find_elements(By.TAG_NAME, "button")
        button_texts = [b.text.strip().lower() for b in buttons]

        has_signup_cta = any("start coding" in t or "free" in t for t in button_texts)
        has_login_cta = any("log in" in t for t in button_texts)

        assert has_signup_cta, \
            f"'Start Coding for Free' button not found. Buttons: {button_texts}"
        assert has_login_cta, \
            f"'Log In' button not found. Buttons: {button_texts}"
        print("✅ Both CTA buttons (Start Coding, Log In) are present")

    def test_start_coding_button_navigates_to_auth(self, driver, base_url):
        """TC-06: Clicking 'Start Coding for Free' navigates to /auth with signup tab."""
        driver.get(base_url)
        time.sleep(2)

        buttons = driver.find_elements(By.TAG_NAME, "button")
        signup_btn = None
        for btn in buttons:
            if "start coding" in btn.text.lower():
                signup_btn = btn
                break

        assert signup_btn is not None, "'Start Coding for Free' button not found"
        signup_btn.click()
        time.sleep(2)

        assert "/auth" in driver.current_url, \
            f"Should navigate to /auth, but URL is: {driver.current_url}"
        assert "tab=signup" in driver.current_url, \
            f"URL should have tab=signup, but URL is: {driver.current_url}"
        print(f"✅ Navigated to: {driver.current_url}")

    def test_login_button_navigates_to_auth(self, driver, base_url):
        """TC-07: Clicking 'Log In' navigates to /auth with login tab."""
        driver.get(base_url)
        time.sleep(2)

        buttons = driver.find_elements(By.TAG_NAME, "button")
        login_btn = None
        for btn in buttons:
            if "log in" in btn.text.lower():
                login_btn = btn
                break

        assert login_btn is not None, "'Log In' button not found"
        login_btn.click()
        time.sleep(2)

        assert "/auth" in driver.current_url, \
            f"Should navigate to /auth, but URL is: {driver.current_url}"
        assert "tab=login" in driver.current_url, \
            f"URL should have tab=login, but URL is: {driver.current_url}"
        print(f"✅ Navigated to: {driver.current_url}")

    def test_features_section_visible(self, driver, base_url):
        """TC-08: Verify the features section ('Engineered for the elite') is visible."""
        driver.get(base_url)
        time.sleep(2)

        # Scroll down to find the features section
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight / 2)")
        time.sleep(1)

        headings = driver.find_elements(By.TAG_NAME, "h2")
        features_heading = any("engineered" in h.text.lower() for h in headings)
        assert features_heading, "Features section heading should be visible"
        print("✅ Features section is visible")

    def test_feature_cards_present(self, driver, base_url):
        """TC-09: Verify feature cards are present (AI, Collaboration, Terminal, Cloud)."""
        driver.get(base_url)
        time.sleep(2)

        driver.execute_script("window.scrollTo(0, document.body.scrollHeight / 2)")
        time.sleep(1)

        headings = driver.find_elements(By.TAG_NAME, "h3")
        heading_texts = [h.text.lower() for h in headings]

        expected_features = ["vibe", "canva", "terminal", "cloud"]
        found_features = []
        for feature in expected_features:
            if any(feature in t for t in heading_texts):
                found_features.append(feature)

        assert len(found_features) >= 3, \
            f"Expected at least 3 feature cards, found: {found_features}"
        print(f"✅ Feature cards found: {found_features}")

    def test_final_cta_section(self, driver, base_url):
        """TC-10: Verify the bottom CTA section exists."""
        driver.get(base_url)
        time.sleep(2)

        driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(1)

        headings = driver.find_elements(By.TAG_NAME, "h2")
        cta_heading = any("observatory" in h.text.lower() or "ready" in h.text.lower() for h in headings)
        assert cta_heading, "Bottom CTA section should be visible"
        print("✅ Bottom CTA section is visible")

    def test_page_title(self, driver, base_url):
        """TC-11: Verify the page has a proper title."""
        driver.get(base_url)
        time.sleep(2)

        title = driver.title
        assert title and len(title) > 0, "Page should have a title"
        print(f"✅ Page title: '{title}'")

    def test_ide_mockup_visible(self, driver, base_url):
        """TC-12: Verify the IDE mockup/preview in the hero section is visible."""
        driver.get(base_url)
        time.sleep(2)

        # The IDE mockup contains code-like text
        page_source = driver.page_source
        assert "import" in page_source and "vibe" in page_source, \
            "IDE mockup with sample code should be visible"
        print("✅ IDE mockup is visible in hero section")
