import { config } from "./config";
import { startServer } from "./server";

async function main(): Promise<void> {
  const server = await startServer();

  const shutdown = () => {
    server
      .close()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  if (config.logLevel === "debug") {
    console.log(
      `[dropwire] room lifetime ${config.roomTtlSec / 3600}h · host idle ${config.hostIdleSec / 60}m · peer idle ${config.peerIdleSec / 60}m`,
    );
  }
}

void main().catch((error) => {
  console.error("[dropwire] failed to start", error);
  process.exit(1);
});
