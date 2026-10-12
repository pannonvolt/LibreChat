import { readFileSync } from 'node:fs';
import { defineRailway, github, image, project, service, volume } from 'railway/iac';

// Run node .railway/setup.mjs once. Never commit this credential file.
const secrets: Record<string, string> = JSON.parse(
  readFileSync(new URL('./secrets.json', import.meta.url), 'utf8'),
);

export default defineRailway((ctx) => {
  const data = volume('librechat-data', { region: 'europe-west4', sizeMB: 1024 });
  const mongoData = volume('mongo-data', { region: 'europe-west4', sizeMB: 1024 });
  const pgData = volume('postgres-data', { region: 'europe-west4', sizeMB: 1024 });
  const searchData = volume('search-data', { region: 'europe-west4', sizeMB: 1024 });
  const modelCache = volume('embedding-cache', { region: 'europe-west4', sizeMB: 1024 });
  const placement = { replicas: { 'europe-west4': 1 }, deploy: { restartPolicyType: 'ON_FAILURE' as const, restartPolicyMaxRetries: 10 } };
  const mongodb = service('mongodb', {
    ...placement, source: image('mongo:8.0.20'), start: 'mongod --bind_ip_all --ipv6',
    volumeMounts: { '/data/db': mongoData },
    env: { MONGO_INITDB_ROOT_USERNAME: 'librechat', MONGO_INITDB_ROOT_PASSWORD: secrets.MONGO_PASSWORD },
  });
  const vectordb = service('vectordb', {
    ...placement, source: image('pgvector/pgvector:pg16'),
    volumeMounts: { '/var/lib/postgresql/data': pgData },
    env: { POSTGRES_DB: 'librechat', POSTGRES_USER: 'librechat', POSTGRES_PASSWORD: secrets.POSTGRES_PASSWORD },
  });
  const meilisearch = service('meilisearch', {
    ...placement, source: image('getmeili/meilisearch:v1.35.1'),
    volumeMounts: { '/meili_data': searchData }, healthcheck: '/health',
    env: { PORT: '7700', MEILI_HTTP_ADDR: '[::]:7700', MEILI_NO_ANALYTICS: 'true',
      MEILI_MASTER_KEY: secrets.MEILI_MASTER_KEY, MEILI_MAX_INDEXING_THREADS: '2' },
  });
  const rag = service('rag-api', {
    ...placement, source: image('ghcr.io/danny-avila/librechat-rag-api-dev:v0.8.0'),
    volumeMounts: { '/app/hf-cache': modelCache }, healthcheck: '/health', healthcheckTimeout: 600,
    env: { PORT: '8000', RAG_PORT: '8000', RAG_HOST: '::', JWT_SECRET: secrets.JWT_SECRET,
      DB_HOST: vectordb.env.RAILWAY_PRIVATE_DOMAIN, DB_PORT: '5432',
      POSTGRES_DB: 'librechat', POSTGRES_USER: 'librechat', POSTGRES_PASSWORD: secrets.POSTGRES_PASSWORD,
      EMBEDDINGS_PROVIDER: 'huggingface', EMBEDDINGS_MODEL: 'sentence-transformers/all-MiniLM-L6-v2',
      HF_HOME: '/app/hf-cache', TOKENIZERS_PARALLELISM: 'false', OMP_NUM_THREADS: '2' },
  });
  const api = service('LibreChat', {
    ...placement, source: github('pannonvolt/LibreChat', { branch: 'main' }),
    build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile.railway' },
    volumeMounts: { '/app/data': data }, healthcheck: '/health', healthcheckTimeout: 600,
    env: { NODE_ENV: 'production', HOST: '::', PORT: '3080', RAILWAY_RUN_UID: '0',
      CONFIG_PATH: '/app/librechat.yaml', ENDPOINTS: 'custom,agents', OPENROUTER_KEY: ctx.shared.OPENROUTER_KEY,
      MONGO_URI: `mongodb://librechat:${secrets.MONGO_PASSWORD}@\${{mongodb.RAILWAY_PRIVATE_DOMAIN}}:27017/LibreChat?authSource=admin`,
      MEILI_HOST: 'http://${{meilisearch.RAILWAY_PRIVATE_DOMAIN}}:7700', MEILI_MASTER_KEY: secrets.MEILI_MASTER_KEY,
      SEARCH: 'true', RAG_API_URL: 'http://${{rag-api.RAILWAY_PRIVATE_DOMAIN}}:8000',
      JWT_SECRET: secrets.JWT_SECRET, JWT_REFRESH_SECRET: secrets.JWT_REFRESH_SECRET,
      CREDS_KEY: secrets.CREDS_KEY, CREDS_IV: secrets.CREDS_IV,
      ALLOW_REGISTRATION: 'true', ALLOW_EMAIL_LOGIN: 'true',
      DOMAIN_CLIENT: 'https://${{LibreChat.RAILWAY_PUBLIC_DOMAIN}}',
      DOMAIN_SERVER: 'https://${{LibreChat.RAILWAY_PUBLIC_DOMAIN}}' },
  });
  const admin = service('admin-panel', {
    ...placement, source: image('registry.librechat.ai/clickhouse/librechat-admin-panel:latest'),
    env: { PORT: '3000', SESSION_SECRET: secrets.ADMIN_PANEL_SESSION_SECRET,
      API_SERVER_URL: 'http://${{LibreChat.RAILWAY_PRIVATE_DOMAIN}}:3080',
      VITE_API_BASE_URL: 'https://${{LibreChat.RAILWAY_PUBLIC_DOMAIN}}', SESSION_COOKIE_SECURE: 'true' },
  });
  return project(ctx.projectName ?? 'LibreChat', {
    resources: [mongodb, vectordb, meilisearch, rag, api, admin, data, mongoData, pgData, searchData, modelCache],
  });
});
