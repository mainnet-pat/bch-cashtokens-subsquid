module.exports = class Data1735215914199 {
    name = 'Data1735215914199'

    async up(db) {
        await db.query(`CREATE TABLE "token" ("id" character varying NOT NULL, "token_id" text NOT NULL, "genesis_supply" numeric NOT NULL, "total_supply" numeric NOT NULL, "nft_count" integer NOT NULL, CONSTRAINT "PK_82fae97f905930df5d62a702fc9" PRIMARY KEY ("id"))`)
        await db.query(`CREATE TABLE "utxo" ("id" character varying NOT NULL, "token_id" character varying NOT NULL, "amount" numeric NOT NULL, "commitment" text, "capability" text, "address" text NOT NULL, "holder_id" character varying, CONSTRAINT "PK_9685e55f63da9b8f4365f080cc1" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_242920d1fc4d631336cd4ac567" ON "utxo" ("token_id") `)
        await db.query(`CREATE INDEX "IDX_d6665472609932b5a22ff109b8" ON "utxo" ("holder_id") `)
        await db.query(`CREATE TABLE "token_holder" ("id" character varying NOT NULL, "address" text NOT NULL, "token_id" character varying NOT NULL, "amount" numeric NOT NULL, "nft_count" integer NOT NULL, CONSTRAINT "PK_c5e10d5c2543fac00a5d3086a2c" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_fc70f9ab515920d249fa5e9a8b" ON "token_holder" ("token_id") `)
        await db.query(`CREATE UNIQUE INDEX "IDX_2fad955cb9b3f42c91737c106f" ON "token_holder" ("address", "token_id") `)
        await db.query(`ALTER TABLE "utxo" ADD CONSTRAINT "FK_242920d1fc4d631336cd4ac5675" FOREIGN KEY ("token_id") REFERENCES "token"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
        await db.query(`ALTER TABLE "utxo" ADD CONSTRAINT "FK_d6665472609932b5a22ff109b8a" FOREIGN KEY ("holder_id") REFERENCES "token_holder"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
        await db.query(`ALTER TABLE "token_holder" ADD CONSTRAINT "FK_fc70f9ab515920d249fa5e9a8ba" FOREIGN KEY ("token_id") REFERENCES "token"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
    }

    async down(db) {
        await db.query(`DROP TABLE "token"`)
        await db.query(`DROP TABLE "utxo"`)
        await db.query(`DROP INDEX "public"."IDX_242920d1fc4d631336cd4ac567"`)
        await db.query(`DROP INDEX "public"."IDX_d6665472609932b5a22ff109b8"`)
        await db.query(`DROP TABLE "token_holder"`)
        await db.query(`DROP INDEX "public"."IDX_fc70f9ab515920d249fa5e9a8b"`)
        await db.query(`DROP INDEX "public"."IDX_2fad955cb9b3f42c91737c106f"`)
        await db.query(`ALTER TABLE "utxo" DROP CONSTRAINT "FK_242920d1fc4d631336cd4ac5675"`)
        await db.query(`ALTER TABLE "utxo" DROP CONSTRAINT "FK_d6665472609932b5a22ff109b8a"`)
        await db.query(`ALTER TABLE "token_holder" DROP CONSTRAINT "FK_fc70f9ab515920d249fa5e9a8ba"`)
    }
}
