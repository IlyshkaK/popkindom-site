#!/usr/bin/env bash
set -euo pipefail

SITE_DIR="${1:-/opt/popkindom/site}"
VERSION="8"
CSS_TAG="  <link rel=\"stylesheet\" href=\"/support-widget.css?v=${VERSION}\" data-pd-support-widget=\"true\" />"
JS_TAG="  <script src=\"/support-widget.js?v=${VERSION}\"></script>"

cd "$SITE_DIR"

for required in support-widget.css support-widget.js; do
  if [[ ! -f "$required" ]]; then
    echo "Missing required file: $SITE_DIR/$required" >&2
    exit 1
  fi
done

python3 - "$SITE_DIR" "$VERSION" <<'PY'
from pathlib import Path
import re
import sys

site_dir = Path(sys.argv[1])
version = sys.argv[2]

public_pages = {
    'index.html',
    'news.html',
    'faq.html',
    'register.html',
    'login.html',
    'account.html',
    'rules.html',
    'server.html',
    'about.html',
    'team.html',
    'top.html',
    'security.html',
}
admin_pages = {
    'admin.html',
    'admin-news.html',
    'admin-support.html',
}

css_tag = f'  <link rel="stylesheet" href="/support-widget.css?v={version}" data-pd-support-widget="true" />'
js_tag = f'  <script src="/support-widget.js?v={version}"></script>'

support_link_pattern = re.compile(
    r'\s*<a\b[^>]*href=["\'](?:/support(?:\.html)?(?:\?[^"\']*)?)["\'][^>]*>.*?</a>\s*',
    re.IGNORECASE | re.DOTALL,
)

old_css_pattern = re.compile(r'\s*<link[^>]+support-widget\.css[^>]*>\s*', re.IGNORECASE)
old_js_pattern = re.compile(r'\s*<script[^>]+support-widget\.js[^>]*>\s*</script>\s*', re.IGNORECASE)
old_modal_script_pattern = re.compile(r'\s*<script[^>]+support-modal\.js[^>]*>\s*</script>\s*', re.IGNORECASE)

for name in sorted(public_pages | admin_pages):
    file = site_dir / name
    if not file.exists():
        print(f'Skipped missing: {name}')
        continue

    text = file.read_text(encoding='utf-8')

    # Удаляем пункт «Поддержка» из шапки, мобильного меню и футера.
    text = support_link_pattern.sub('\n', text)

    # Удаляем старые подключения модалки и предыдущих версий чата.
    text = old_modal_script_pattern.sub('\n', text)
    text = old_css_pattern.sub('\n', text)
    text = old_js_pattern.sub('\n', text)

    if name in public_pages:
        if '</head>' not in text or '</body>' not in text:
            raise RuntimeError(f'Invalid HTML structure in {name}')
        text = text.replace('</head>', css_tag + '\n</head>', 1)
        text = text.replace('</body>', js_tag + '\n</body>', 1)
        state = 'floating chat enabled'
    else:
        state = 'chat disabled'

    file.write_text(text, encoding='utf-8')
    print(f'Updated: {name} ({state})')

# Отдельной страницы/блока поддержки больше нет.
(site_dir / 'support.html').write_text(f'''<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Поддержка — PopkinDom</title>
  <meta http-equiv="refresh" content="0; url=/index?support=1" />
</head>
<body>
  <script>window.location.replace('/index?support=1');</script>
</body>
</html>
''', encoding='utf-8')

# Жёсткая проверка результата.
for name in sorted(public_pages):
    file = site_dir / name
    if not file.exists():
        continue
    text = file.read_text(encoding='utf-8')
    if f'/support-widget.js?v={version}' not in text:
        raise RuntimeError(f'Chat script was not added to {name}')

for name in sorted(admin_pages):
    file = site_dir / name
    if not file.exists():
        continue
    text = file.read_text(encoding='utf-8')
    if 'support-widget' in text:
        raise RuntimeError(f'Chat unexpectedly remains in {name}')
PY

rm -f "$SITE_DIR/support-modal.js"

echo "Done: floating chat is enabled on all public pages and disabled in admin pages."
