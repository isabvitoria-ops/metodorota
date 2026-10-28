#!/usr/bin/env python3
"""Inline CSS and JS from the Vite pages build into a single HTML file."""
import re, sys, datetime
from pathlib import Path

dist = Path(sys.argv[1])  # dist-pages/
root_html = Path(sys.argv[2])  # ../index.html (the existing root)

# Read the built index.html
html = (dist / "index.html").read_text()

# Read the CSS and JS files
css_files = list((dist / "assets").glob("*.css"))
js_files = list((dist / "assets").glob("*.js"))

if not css_files or not js_files:
    print("ERROR: missing CSS or JS in dist", file=sys.stderr)
    sys.exit(1)

css_content = css_files[0].read_text()
js_content = js_files[0].read_text()

# Read the existing root index.html to extract the custom head (meta tags, icons, etc.)
existing = root_html.read_text()

# Extract everything between <head> and the first <script or <link rel="stylesheet"
# from the existing file - this has the custom meta tags, icon, manifest link, etc.
head_match = re.search(r'<head>(.*?)(?=<script|<link rel="stylesheet")', existing, re.DOTALL)
custom_head = head_match.group(1).strip() if head_match else ""

# Update the version timestamp
now = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d %H:%M UTC")
custom_head = re.sub(r'content="[^"]*?"(\s*/>.*?versao-do-site)', f'content="{now}"\\1', custom_head)
if "versao-do-site" not in custom_head:
    custom_head = custom_head.replace(
        '<meta name="description"',
        f'<meta name="versao-do-site" content="{now}" />\n    <meta name="description"'
    )

# Build the new single-file HTML
output = f"""<!doctype html>
<html lang="pt-BR">
  <head>
    {custom_head}
    <title>MARVIA</title>
    <style>{css_content}</style>
    <script type="module">{js_content}</script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
"""

root_html.write_text(output)
print(f"Written {len(output):,} bytes to {root_html}")
