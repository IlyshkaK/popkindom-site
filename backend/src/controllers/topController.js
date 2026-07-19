const topService = require("../services/topService");
const asyncHandler = require("../utils/asyncHandler");

const getTop = asyncHandler(async (req, res) => {
  const category = String(req.query.category || "playtime").toLowerCase();
  const data = await topService.getTop(category);

  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
  return res.json(data);
});

module.exports = {
  getTop,
};
