PopkinDom site profile patch

Заменить в репозитории сайта:
- account.html
- script.js
- style.css

Остальные файлы приложены для целостности проекта.

Что изменено:
- убрана кирка из профиля;
- вместо смайлика головы используется Minecraft-голова по нику игрока через Minotar;
- UUID берётся из WebBridge players.uuid;
- статус Онлайн/Оффлайн берётся из WebBridge players.online и обновляется каждые 5 секунд;
- в блоке сервера отображается уровень игрока и XP до следующего уровня;
- верхняя XP-полоска показывает заполненность до следующего уровня и текст current / required XP.

После замены:
git add .
git commit -m "Update account real player profile"
git push origin main
