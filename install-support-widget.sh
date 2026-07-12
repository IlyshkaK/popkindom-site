#!/usr/bin/env bash
set -euo pipefail

SITE_DIR="${1:-/opt/popkindom/site}"
CSS_TAG='  <link rel="stylesheet" href="/support-widget.css?v=2" />'
JS_TAG='  <script src="/support-widget.js?v=2"></script>'

if [[ ! -d "$SITE_DIR" ]]; then
  echo "Site directory not found: $SITE_DIR" >&2
  exit 1
fi

if [[ ! -f "$SITE_DIR/support-widget.css" || ! -f "$SITE_DIR/support-widget.js" ]]; then
  echo "support-widget.css or support-widget.js is missing in $SITE_DIR" >&2
  exit 1
fi

find "$SITE_DIR" -maxdepth 1 -type f -name '*.html' -print0 | while IFS= read -r -d '' file; do
  sed -i '/support-widget\.css/d;/support-widget\.js/d' "$file"
  sed -i "s#</head>#$CSS_TAG\n</head>#" "$file"
  sed -i "s#</body>#$JS_TAG\n</body>#" "$file"
  echo "Updated: $(basename "$file")"
done

cat > "$SITE_DIR/support.html" <<'HTML'
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Поддержка — PopkinDom</title>
  <link rel="stylesheet" href="/support-widget.css?v=2" />
</head>
<body>
  <script>
    sessionStorage.setItem('pd_support_widget_open', '1');
    window.location.replace('/index');
  </script>
  <script src="/support-widget.js?v=2"></script>
</body>
</html>
HTML

echo "Support widget installed into all HTML pages."
