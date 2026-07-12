#!/usr/bin/env bash
set -euo pipefail

SITE_DIR="${1:-/opt/popkindom/site}"
CSS_TAG='  <link rel="stylesheet" href="/support-widget.css?v=3" />'
JS_TAG='  <script src="/support-widget.js?v=3"></script>'

if [[ ! -d "$SITE_DIR" ]]; then
  echo "Site directory not found: $SITE_DIR" >&2
  exit 1
fi

if [[ ! -f "$SITE_DIR/support-widget.css" || ! -f "$SITE_DIR/support-widget.js" ]]; then
  echo "support-widget.css or support-widget.js is missing in $SITE_DIR" >&2
  exit 1
fi

python3 - "$SITE_DIR" <<'PY'
from pathlib import Path
import re
import sys

site_dir = Path(sys.argv[1])
css_tag = '  <link rel="stylesheet" href="/support-widget.css?v=3" />'
js_tag = '  <script src="/support-widget.js?v=3"></script>'

admin_pages = {
    'admin.html',
    'admin-news.html',
    'admin-support.html',
}

support_link_pattern = re.compile(
    r'\s*<a\b[^>]*href=["\'](?:/support(?:\.html)?(?:\?[^"\']*)?)["\'][^>]*>.*?</a>\s*',
    re.IGNORECASE | re.DOTALL,
)

for file in sorted(site_dir.glob('*.html')):
    if file.name == 'support.html':
        continue

    text = file.read_text(encoding='utf-8')

    # Удаляем пункт «Поддержка» из основной, мобильной и прочей навигации.
    text = support_link_pattern.sub('\n', text)

    # Удаляем старые подключения, чтобы не было дублей.
    text = re.sub(r'\s*<link[^>]+support-widget\.css[^>]*>\s*', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*<script[^>]+support-widget\.js[^>]*>\s*</script>\s*', '\n', text, flags=re.IGNORECASE)

    # В админских страницах чат не нужен.
    if file.name not in admin_pages:
        if '</head>' in text:
            text = text.replace('</head>', css_tag + '\n</head>', 1)
        if '</body>' in text:
            text = text.replace('</body>', js_tag + '\n</body>', 1)

    file.write_text(text, encoding='utf-8')
    state = 'without chat' if file.name in admin_pages else 'with chat'
    print(f'Updated: {file.name} ({state})')

# Старый адрес поддержки только открывает чат на главной.
(site_dir / 'support.html').write_text('''<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Поддержка — PopkinDom</title>
</head>
<body>
  <script>
    window.location.replace('/index?support=1');
  </script>
</body>
</html>
''', encoding='utf-8')
PY

echo "Support navigation removed. Chat kept on public pages and removed from admin pages."
