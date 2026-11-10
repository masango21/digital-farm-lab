import { createApp } from './app';
import { env } from './config/env';
import { deliverPendingCredentials } from './lib/credentials';

const app = createApp();
app.listen(env.PORT, () => {
  console.log(`🌱 Digital Farm Lab API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Retry microcredential events that AgriLearn hasn't accepted yet.
if (env.AGRILEARN_WEBHOOK_URL) {
  const retry = () => deliverPendingCredentials().catch((e) => console.warn('Credential delivery failed', e));
  setTimeout(retry, 15_000);
  setInterval(retry, 10 * 60_000).unref();
}
