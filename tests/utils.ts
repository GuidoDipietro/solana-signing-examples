import { web3 } from "@coral-xyz/anchor";
import { assert } from "chai";

export const assertLogs = async (connection: web3.Connection, txid: string) => {
  // Confirm tx
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  await connection.confirmTransaction(
    {
      signature: txid,
      blockhash,
      lastValidBlockHeight,
    },
    `confirmed`
  );

  // Get logs
  const parsedTx = await connection.getParsedTransaction(txid, {
    commitment: `confirmed`,
    maxSupportedTransactionVersion: 0,
  });

  assert.ok(parsedTx.meta.logMessages.join("").includes("Congratulations"));
};
