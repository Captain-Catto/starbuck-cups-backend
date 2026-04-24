#!/bin/sh
set -e

trap 'kill $POSTGRES_PID 2>/dev/null' TERM INT

docker-entrypoint.sh "$@" &
POSTGRES_PID=$!

until pg_isready -U "${POSTGRES_USER:-postgres}" 2>/dev/null; do
    sleep 0.5
done

psql -U "${POSTGRES_USER:-postgres}" \
    -c "ALTER USER ${POSTGRES_USER:-postgres} WITH PASSWORD '${POSTGRES_PASSWORD}';" \
    2>/dev/null && echo "Postgres password synchronized" || true

wait $POSTGRES_PID
