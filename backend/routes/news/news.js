
const news = [
  {
    id: "nether-update-04072026",
    title: "Открытие Ада + обновление GMusic",
    date: "04.07.2026",
    image: "/background.png",
    short: "Открытие Ада и новая система GMusic",
    content: "Ад переработан: дебаффы каждые 10 минут, ActionBar уведомления, запрет кроватей и TNT + обновление GMusic с новыми треками."
  }
];

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  return res.json(news);
};
