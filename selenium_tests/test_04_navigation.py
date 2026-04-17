"""
Test Suite 4: Navigation & Routing
====================================
Tests the application's routing and navigation behavior.

What this tests:
- Route protection (authenticated vs unauthenticated)
- 404 page for unknown routes
- Back navigation
- URL handling
"""

import pytest
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class TestNavigation:
    """Tests for application routing and navigation."""

    def test_404_page_for_unknown_route(self, driver, base_url):
        """TC-39: Verify unknown routes show a 404/Not Found page."""
        driver.get(f"{base_url}/some-random-page-that-doesnt-exist")
        time.sleep(2)

        page_text = driver.find_element(By.TAG_NAME, "body").text.lower()
        has_not_found = "not found" in page_text or "404" in page_text
        assert has_not_found, \
            f"404 page should show for unknown routes. Page text: {page_text[:200]}"
        print("✅ 404 page displayed for unknown routes")

    def test_root_redirects_unauthenticated_to_landing(self, driver, base_url):
        """TC-40: Verify root URL shows landing page for unauthenticated users."""
        driver.delete_all_cookies()
        driver.get(base_url)
        time.sleep(3)

        # Should show landing page (not redirect to auth)
        page_text = driver.find_element(By.TAG_NAME, "body").text
        is_landing = "speed" in page_text.lower() or "Collaborative IDE" in page_text
        assert is_landing, "Root URL should show landing page for unauthenticated users"
        print("✅ Root URL shows landing page for unauthenticated users")

    def test_project_route_requires_auth(self, driver, base_url):
        """TC-41: Verify /project/:id requires authentication."""
        driver.delete_all_cookies()
        driver.get(f"{base_url}/project/some-fake-id")
        time.sleep(3)

        # Should redirect to auth or show landing
        current_url = driver.current_url
        is_protected = "/auth" in current_url or current_url.rstrip("/") == base_url.rstrip("/")
        assert is_protected, \
            f"Project route should require auth. Current URL: {current_url}"
        print(f"✅ Project route is protected. Redirected to: {current_url}")

    def test_join_route_accessible(self, driver, base_url):
        """TC-42: Verify /join/:roomCode/:password route is accessible."""
        driver.get(f"{base_url}/join/TEST123/password123")
        time.sleep(3)

        # Join page should load (might show login prompt or join interface)
        current_url = driver.current_url
        page_text = driver.find_element(By.TAG_NAME, "body").text
        # It should either show the join page or redirect to auth
        page_loaded = len(page_text.strip()) > 0
        assert page_loaded, "Join route should render some content"
        print(f"✅ Join route accessible. Current URL: {current_url}")

    def test_browser_back_navigation(self, driver, base_url):
        """TC-43: Verify browser back button works correctly."""
        # Go to landing page first
        driver.get(base_url)
        time.sleep(2)

        # Navigate to auth
        driver.get(f"{base_url}/auth")
        time.sleep(2)

        # Go back
        driver.back()
        time.sleep(2)

        # Should be back on landing page
        current_url = driver.current_url.rstrip("/")
        base = base_url.rstrip("/")
        assert current_url == base or current_url == f"{base}/", \
            f"Back button should return to landing. Current URL: {current_url}"
        print("✅ Browser back navigation works correctly")

    def test_direct_url_access_to_auth(self, driver, base_url):
        """TC-44: Verify direct URL access to /auth works."""
        driver.get(f"{base_url}/auth")
        time.sleep(2)

        assert "/auth" in driver.current_url
        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "Sign In" in page_text or "Welcome" in page_text, \
            "Auth page should be accessible via direct URL"
        print("✅ Direct URL access to /auth works")

    def test_url_query_parameters_preserved(self, driver, base_url):
        """TC-45: Verify URL query parameters are correctly handled."""
        driver.get(f"{base_url}/auth?tab=signup")
        time.sleep(2)

        page_text = driver.find_element(By.TAG_NAME, "body").text
        # Should show signup tab since tab=signup is in URL
        has_signup = "Create an account" in page_text or "Create Account" in page_text
        assert has_signup, "URL query parameter 'tab=signup' should activate signup tab"
        print("✅ URL query parameters are handled correctly")
