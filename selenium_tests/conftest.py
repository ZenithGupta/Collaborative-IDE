"""
Selenium Test Configuration
============================
Shared fixtures and configuration for all Selenium tests.
"""

import pytest
import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

# ─── Configuration ───────────────────────────────────────────────────
BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:8080")

# Test account credentials (create this account in Supabase first)
TEST_EMAIL = os.getenv("TEST_EMAIL", "test@example.com")
TEST_PASSWORD = os.getenv("TEST_PASSWORD", "test123456")
TEST_USERNAME = os.getenv("TEST_USERNAME", "testuser")


@pytest.fixture(scope="session")
def driver():
    """
    Creates a single Chrome WebDriver instance for the entire test session.
    This is more efficient than creating a new browser for each test.
    """
    chrome_options = Options()
    # Uncomment the next line to run headless (no browser window visible)
    # chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    # Suppress DevTools logging noise
    chrome_options.add_experimental_option("excludeSwitches", ["enable-logging"])

    service = Service(ChromeDriverManager().install())
    browser = webdriver.Chrome(service=service, options=chrome_options)
    browser.implicitly_wait(10)  # Wait up to 10s for elements to appear

    yield browser

    browser.quit()


@pytest.fixture(scope="session")
def base_url():
    """Returns the base URL for the application."""
    return BASE_URL


@pytest.fixture(scope="session")
def test_credentials():
    """Returns test account credentials."""
    return {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "username": TEST_USERNAME,
    }
