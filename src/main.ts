import { inspect } from 'util';
inspect.defaultOptions.depth = 10;

// main.js
// This is the main executable of the squid indexer.
import { config } from 'dotenv';
config({
  debug: false,
  path: './.env.local',
});

// BchBatchProcessor is the class responsible for data retrieval and processing.
import { BchBatchProcessor } from './bch-processor/src/processor.js';
// TypeormDatabase is the class responsible for data storage.
import { TypeormDatabase } from "@subsquid/typeorm-store";

import { Utxo, Token, TokenHolder } from './model/index.js';
import { Output } from '@bitauth/libauth';
import { In } from 'typeorm';

const BLOCK_TO = undefined; // 792775
// First we configure data retrieval.
const processor = new BchBatchProcessor()
  // // // SQD Network gateways are the primary source of blockchain data in
  // // // squids, providing pre-filtered data in chunks of roughly 1-10k blocks.
  // // // Set this for a fast sync.
  // .setGateway(process.env.GATEWAY as any)
  // // // Another data source squid processors can use is chain RPC.
  // // // In this particular squid it is used to retrieve the very latest chain data
  // // // (including unfinalized blocks) in real time. It can also be used to
  // // //   - make direct RPC queries to get extra data during indexing
  // // //   - sync a squid without a gateway (slow)
  .setRpcEndpoint("wss://electrum.imaginary.cash:50004")
  // .setP2pEndpoint("8.209.67.170:8363")
  // .setRpcEndpoint("http://localhost:8000")
  // The processor needs to know how many newest blocks it should mark as "hot".
  // If it detects a blockchain fork, it will roll back any changes to the
  // database made due to orphaned blocks, then re-run the processing for the
  // main chain blocks.
  .setFinalityConfirmation(5)
  .addTransaction({
    range: {
      from: 792773,
      to: BLOCK_TO,
    },
  })
  .setFields({
    block: {
      size: true,
      difficulty: true,
      nonce: true,
    },
    transaction: {
      hash: true,
      size: true,
      // sourceOutputs: true, // undefined for coinbase transactions
      // fee: true,
    },
  })
  // .addXXX() methods request data items.
  // Other .addXXX() methods (.addTransaction(), .addTrace(), .addStateDiff()
  // on EVM) are similarly feature-rich.
  // .addLog({
  //   address: [MARKETPLACE_CONTRACT_ADDRESS, MARKETPLACEDATA_CONTRACT_ADDRESS],
  //   range: {
  //     from: process.env.BLOCK_FROM ? Number(process.env.BLOCK_FROM) : 0,
  //   },
  // });

// TypeormDatabase objects store the data to Postgres. They are capable of
// handling the rollbacks that occur due to blockchain forks.
//
// There are also Database classes for storing data to files and BigQuery
// datasets.
const db = new TypeormDatabase({ supportHotBlocks: true });

// The processor.run() call executes the data processing. Its second argument is
// the handler function that is executed once on each batch of data. Processor
// object provides the data via "ctx.blocks". However, the handler can contain
// arbitrary TypeScript code, so it's OK to bring in extra data from IPFS,
// direct RPC calls, external APIs etc.

function* chunks<T>(arr: Array<T>, n: number = 75): Generator<Array<T>> {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n);
  }
}

export const extractSourceOutputTokenData2 = (sourceOutputs: Utxo[]) =>
  sourceOutputs.reduce(
    // eslint-disable-next-line complexity
    (agg, sourceOutput) => {
      if (sourceOutput.token === undefined) return agg;
      const categoryHex = sourceOutput.tokenId;
      return {
          ...agg,
          [categoryHex]:
            (agg[categoryHex] ?? 0n) +
            sourceOutput.amount,
      };
    },
    {} as Record<string,bigint>,
  );

export const extractTransactionOutputTokenData2 = (
  outputs: Output<string,string,bigint>[],
) =>
  outputs.reduce(
    // eslint-disable-next-line complexity
    (agg, output) => {
      if (output.token === undefined) return agg;
      const categoryHex = output.token.category;
      return {
        ...agg,
        [categoryHex]:
          (agg[categoryHex] ?? 0n) + output.token.amount,
      };
    },
    {} as Record<string,bigint>
  );

processor.run(db, async (ctx) => {
  if (ctx.blocks.length === 0 && ctx.mempoolTransactions.length === 0) {
    return;
  }

  if (BLOCK_TO && ctx.blocks[0].header.height > BLOCK_TO) {
    console.log("Done indexing");
    process.exit(0);
  }

  const tokens: Record<string, Token> = {};
  const utxos: Record<string, Utxo[]> = {};
  const utxosToDelete: Record<string, string[]> = {};
  const holders: Record<string, TokenHolder> = {};

  const processTransactions = async (transactions: typeof ctx.blocks[0]["transactions"]) => {
    // split in smaller chunks so postgres doesn't run out of query parameter space
    for (const chunk of chunks(transactions)) {
      const utxoIds = [...new Set<string>(chunk.flatMap(transaction => transaction.inputs.map(input => `${input.outpointTransactionHash}:${input.outpointIndex}`)))];
      const fetchedUtxos: Record<string, Utxo> = (await ctx.store.findBy(Utxo, {
        id: In(utxoIds) as any,
      })).reduce((acc, utxo) => ({...acc,[utxo.id]: utxo}), {});
      // const fetchedUtxos = (await ctx.store.findBy(Utxo, {
      //   id: In(utxoIds) as any,
      // }));

      for (const transaction of chunk) {
        // skip coinbase
        if (transaction.transactionIndex === 0) {
          continue;
        }

        const sourceOutputUtxos = transaction.inputs.map(input => fetchedUtxos[`${input.outpointTransactionHash}:${input.outpointIndex}`]).filter(utxo => utxo !== undefined);
        //  transaction.inputs.filter(input => fetchedUtxos[`${input.outpointTransactionHash}:${input.outpointIndex}`]).map(input => fetchedUtxos[`${input.outpointTransactionHash}:${input.outpointIndex}`]).map(utxo => ({
        //   address: utxo.address,
        //   token: {
        //     category: hexToBin(utxo.tokenId),
        //     amount: utxo.amount,
        //     nft: utxo.capability ? { capability: utxo.capability ?? undefined, commitment: utxo.commitment == null ? undefined : hexToBin(utxo.commitment) } : undefined,
        //   },
        //   index: Number(utxo.id.split(":")[1]),
        //   outpointTransactionHash: utxo.id.split(":")[0]
        // }));

        const hasTokens = transaction.outputs.some(output => output.token?.category) || sourceOutputUtxos.some(output => output.tokenId);
        if (!hasTokens) {
          continue;
        }

        const availableSumsByCategory = extractSourceOutputTokenData2(sourceOutputUtxos);
        const outputSumsByCategory = extractTransactionOutputTokenData2(transaction.outputs);

        const categories = [...new Set(sourceOutputUtxos.map(output => output.tokenId).concat(transaction.outputs.filter(output => output.token?.category).map(output => output.token!.category)))];
        for (const categoryHex of categories) {
          // rare case where miner ordered the transactions that spending transaction comes before genesis
          if (!tokens[categoryHex]) {
            tokens[categoryHex] = new Token({
              id: categoryHex,
              tokenId: categoryHex,
              genesisSupply: 0n,
              nftCount: 0,
              totalSupply: 0n,
            });
          }
        }

        for (const [categoryHex, sum] of Object.entries(outputSumsByCategory)) {
          const availableSum = availableSumsByCategory[categoryHex];
          if (availableSum !== undefined) {
            tokens[categoryHex].totalSupply += sum - availableSum;
          }
        }

        for (const [outputIndex, output] of transaction.outputs.entries()) {
          if (output.token?.category) {
            const category = output.token.category;
            const token = tokens[category] ?? await ctx.store.get(Token, category);
            tokens[category] = token;
            if (transaction.inputs.find(input => input.outpointIndex === 0 && input.outpointTransactionHash, output.token!.category)) {
              if (tokens[category]) {
                // rare case where miner ordered the transactions that spending transaction comes before genesis
                tokens[category].genesisSupply = output.token.amount;
                tokens[category].totalSupply = output.token.amount;
              } else {
                tokens[category] = new Token({
                  id: category,
                  tokenId: category,
                  genesisSupply: output.token.amount,
                  nftCount: 0,
                  totalSupply: output.token.amount,
                });
              }
            }

            if (output.token.nft) {
              tokens[category].nftCount++;
            }

            if (!utxos[category]) {
              utxos[category] = [];
            }

            utxos[category].push(new Utxo({
              id: `${transaction.hash}:${outputIndex}`,
              capability: output.token?.nft?.capability !== undefined ? output.token.nft.capability : null,
              commitment: output.token?.nft?.commitment !== undefined ? output.token.nft.commitment : null,
              token: new Token({ id: category }),
              amount: output.token.amount,
              holder: new TokenHolder({ id: `${category}-${output.address}` }),
              address: output.address,
              tokenId: category,
            }));

            const holderId = `${category}-${output.address}`;
            const holder = holders[holderId] ?? await ctx.store.get(TokenHolder, holderId);
            holders[holderId] = holder;

            if (!holders[holderId]) {
              holders[holderId] = new TokenHolder({
                id: holderId,
                address: output.address,
                amount: output.token.amount,
                nftCount: output.token.nft ? 1 : 0,
                token: new Token({ id: category }),
                tokenId: category,
              });
            } else {
              holders[holderId].amount += output.token.amount;
              holders[holderId].nftCount += output.token.nft ? 1 : 0;
            }
          }
        }

        for (const [index, input] of transaction.inputs.entries()) {
          const sourceOutput = sourceOutputUtxos.find(output => {
            const [outpointIndex, outpointTransactionHash] = output.id.split(":");
            Number(outpointIndex) === input.outpointIndex && outpointTransactionHash === input.outpointTransactionHash
          });

          if (!sourceOutput) {
            continue;
          }

          if (sourceOutput.tokenId) {
            const category = sourceOutput.tokenId;
            if (sourceOutput.capability) {
              tokens[category].nftCount--;
            }

            if (!utxosToDelete[category]) {
              utxosToDelete[category] = [];
            }

            utxosToDelete[category].push(sourceOutput.id);

            const holderId = `${category}-${sourceOutput.address}`;
            const holder = holders[holderId] ?? await ctx.store.get(TokenHolder, holderId);
            holders[holderId] = holder;

            if (!holders[holderId]) {
              holders[holderId] = new TokenHolder({
                id: holderId,
                address: sourceOutput.address,
                amount: -1n * (sourceOutput.amount),
                nftCount: -1 * (sourceOutput.capability ? 1 : 0),
                token: new Token({ id: category }),
                tokenId: category,
              });
            }

            holders[holderId].amount -= sourceOutput.amount;
            holders[holderId].nftCount -= sourceOutput.capability ? 1 : 0;
          }
        }
      }
    }
  }

  for (const block of ctx.blocks) {
    await processTransactions(block.transactions);
  }
  await processTransactions(ctx.mempoolTransactions);

  await ctx.store.upsert(Object.values(tokens));
  await ctx.store.upsert(Object.values(holders));
  await ctx.store.upsert(Object.values(utxos).flat());

  const deletedUtxos = Object.values(utxosToDelete).flat();
  if (deletedUtxos.length > 0) {
    // console.log(ctx.blocks.at(-1)!.header.height, "Deleting", deletedUtxos.length, "utxos");
    // console.log(deletedUtxos)
    await ctx.store.remove(Utxo, deletedUtxos);
  }

  const holdersToDelete = Object.values(holders).filter(holder => holder.amount === 0n && holder.nftCount === 0).map(holder => holder.id);
  if (holdersToDelete.length > 0) {
    // console.log(ctx.blocks.at(-1)!.header.height, "Deleting", holdersToDelete.length, "holders");
    // console.log(holdersToDelete)
    await ctx.store.remove(TokenHolder, holdersToDelete);
  }

  ctx.blocks.length && console.log("Cumulative block size", ctx.blocks.reduce((acc, block) => acc + block.header.size, 0) / 1024 / 1024, "MB");
  ctx.mempoolTransactions.length && console.log("Processed", ctx.mempoolTransactions.length, `mempool transactions.${ctx.mempoolTransactions.length > 2 ? ' last:' : ''}`, ctx.mempoolTransactions.at(-1)!.hash);
});
