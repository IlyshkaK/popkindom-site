const app = require("./app");
const checkDatabase = require("./database/check");

const PORT = process.env.PORT || 3020;

async function start() {
  try {
    await checkDatabase();

    app.listen(PORT, "127.0.0.1", () => {
      console.log(`PopkinDom backend started on http://127.0.0.1:${PORT}`);
    });
  } catch (error) {
    console.error("[SERVER] Failed to start:", error);
    process.exit(1);
  }
}

start();
