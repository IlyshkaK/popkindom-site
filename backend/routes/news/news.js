const news = [
  {
    id: "nether-update-04072026",
    title: "Открытие Ада + обновление GMusic",
    date: "04.07.2026",
    image: "/background-nether-update.png",
    short: "Ад стал прогрессирующей зоной выживания",
    content: `
🔥 ОТКРЫТИЕ АДА

Ад теперь прогрессирующая зона:

⏱ каждые 10 минут — дебафф

☠ эффекты:
• замедление
• слабость
• голод
• слепота
• тошнота

🛏 запрещены кровати
💥 TNT заблокирован

🎵 GMusic обновлён
`
  }
];

module.exports = async (req, res) => {
  res.json(news);
};