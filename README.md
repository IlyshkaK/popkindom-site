# PopkinDom account real WebBridge data patch

Замени файлы в корне сайта:

- account.html
- script.js
- style.css
- api/me.js

После замены:

```bash
git add .
git commit -m "Connect account page to WebBridge data"
git push origin main
```

Vercel сам выполнит новый deploy.

Что теперь берётся из WebBridge:

- players
- player_stats
- player_blocks
- player_crafts
- player_enchantments
- player_inventory
- список онлайна из players

История смертей и достижения пока остаются заглушкой, потому что WebBridge ещё не пишет отдельные таблицы для смертей и достижений.
