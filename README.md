# Starbucks Cups Backend Stack

Backend stack for the Starbucks cups shop.

## Structure

```text
starbuck-cups-backend/
├── backend/            # Express + TypeScript API
├── deploy/             # Production nginx/systemd/env examples
├── docker/             # Docker helper files
├── docker-compose.yml  # Local PostgreSQL, Redis, MeiliSearch, API stack
└── README.md
```

## Local Docker Stack

From this directory:

```bash
cp .env.docker.example .env
docker compose up -d --build
docker compose logs -f backend
```

After the database has data, sync MeiliSearch:

```bash
docker compose exec backend node dist/scripts/sync-meilisearch.js
```

## Backend Development

```bash
cd backend
npm install
npm run dev
```

Useful commands:

```bash
npm run build
npm start
npm run db:migrate
npm run db:migrate:status
npm run sync-meilisearch
```

## Runtime Services

- API: `http://localhost:8080`
- PostgreSQL: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`
- MeiliSearch: `127.0.0.1:7700`

## Notes

- Database schema changes are managed through Sequelize migrations in `backend/migrations`.
- Backend source scripts live under `backend/src/scripts`.
- Deployment notes live in `deploy/README.md`.
