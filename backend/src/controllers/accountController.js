const accountService = require("../services/accountService");
const { success, fail } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const getAccount = asyncHandler(async (req, res) => {
  const accountData = await accountService.getAccount(req.user.id);

  if (!accountData) {
    return fail(res, "Аккаунт не найден", 404);
  }

  return success(res, accountData);
});

module.exports = {
  getAccount,
};
