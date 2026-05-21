import { createApp } from "./app";
import { connectDatabase } from "./config/database";
import { env } from "./config/env";
import { getPrimarySeller } from "./services/seller.service";

async function bootstrap() {
  await connectDatabase();
  await getPrimarySeller();

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`[api] Shopnix Express API → http://localhost:${env.port}`);
    console.log(`[ondc] BPP endpoints → ${env.ondc.bppUri}`);
    console.log(`[uploads] Static files → ${env.apiBaseUrl}/uploads`);
  });
}

bootstrap().catch((err) => {
  console.error("[api] Failed to start", err);
  process.exit(1);
});
