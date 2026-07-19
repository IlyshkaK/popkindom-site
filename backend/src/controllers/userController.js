const userRepository = require("../repositories/userRepository");

async function getUserByNickname(req, res) {
  try {
    const { nickname } = req.params;

    if (!nickname || nickname.trim().length < 3) {
      return res.status(400).json({
        ok: false,
        message: "Некорректный никнейм",
      });
    }

    const user = await userRepository.findByNickname(nickname.trim());

    if (!user) {
      return res.status(404).json({
        ok: false,
        message: "Пользователь не найден",
      });
    }

    return res.json({
      ok: true,
      user,
    });
  } catch (error) {
    console.error("[UserController] getUserByNickname:", error);

    return res.status(500).json({
      ok: false,
      message: "Ошибка сервера",
    });
  }
}

module.exports = {
  getUserByNickname,
};
