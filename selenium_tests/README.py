# Selenium Test Suite — Collaborative IDE
# =========================================
# 
# This is the complete Selenium testing suite for the Collaborative IDE project.
# 
# ## Quick Start
# 
# 1. Make sure the dev server is running:
#    ```
#    npm run dev
#    ```
# 
# 2. Activate the virtual environment:
#    ```
#    selenium_tests\.venv\Scripts\activate
#    ```
# 
# 3. Run ALL tests:
#    ```
#    cd selenium_tests
#    python -m pytest --html=report.html --self-contained-html -v
#    ```
# 
# 4. Run a SINGLE test file:
#    ```
#    python -m pytest test_01_landing_page.py -v
#    ```
# 
# 5. Run a SPECIFIC test:
#    ```
#    python -m pytest test_01_landing_page.py::TestLandingPage::test_page_loads -v
#    ```
# 
# ## Test Files
# 
# | File                        | Tests | What it covers                        |
# |-----------------------------|-------|---------------------------------------|
# | test_01_landing_page.py     | 12    | Homepage: header, hero, CTAs, features|
# | test_02_auth_page.py        | 15    | Login/Signup: forms, validation, tabs |
# | test_03_dashboard.py        | 11    | Dashboard: projects, dialogs, menu    |
# | test_04_navigation.py       |  7    | Routing: 404, auth guards, back btn   |
# | test_05_responsiveness.py   |  6    | Responsive: desktop, tablet, mobile   |
# | test_06_ui_components.py    | 11    | UI: gradients, icons, scroll, errors  |
# |                             |       |                                       |
# | **TOTAL**                   | **62**| **Complete coverage**                 |
# 
# ## Configuration
# 
# Edit conftest.py to change:
# - BASE_URL (default: http://localhost:8080)
# - TEST_EMAIL / TEST_PASSWORD (for authenticated tests)
# - Headless mode (uncomment the headless line to run without browser UI)
# 
# ## Generating HTML Report
# 
# The --html flag creates a beautiful HTML report:
# ```
# python -m pytest --html=report.html --self-contained-html -v
# ```
# Open report.html in your browser to see a visual test report.
