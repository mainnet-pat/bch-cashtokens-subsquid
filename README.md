# BCH CashTokens Subsquid

This squid captures the current state of BCH CashTokens, token holders and token utxos

Dependencies: Node.js, Docker.

## Quickstart

```bash
# 1. Install @subsquid/cli a.k.a. the sqd command globally
npm i -g @subsquid/cli

# 2. Install dependencies
npm ci

# 3. Start a Postgres database container and detach
sqd up

# 4. Build and start the processor
sqd process

# 5. The command above will block the terminal
#    being busy with fetching the chain data, 
#    transforming and storing it in the target database.
#
#    To start the graphql server open the separate terminal
#    and run
sqd serve
```
A GraphiQL playground will be available at [localhost:4350/graphql](http://localhost:4350/graphql).

# Cheatsheet

```
npx squid-typeorm-codegen


docker compose down -v && docker compose up -d db
npx tsc && rm -rf db/migrations/* && npx squid-typeorm-migration generate --esm true
docker compose down -v && docker compose up -d db && sleep 2 && npx squid-typeorm-migration apply


npx tsc && node -r dotenv/config lib/main.js


npx squid-graphql-server
```
