import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { SignatureExamples } from "../target/types/signature_examples";
import { assertLogs } from "./utils";
import nacl from "tweetnacl";

describe("signature-examples", () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .SignatureExamples as Program<SignatureExamples>;

  const signer = anchor.web3.Keypair.generate();

  before(async () => {
    // Fund signer
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          toPubkey: signer.publicKey,
          lamports: 100 * anchor.web3.LAMPORTS_PER_SOL,
        })
      ),
      undefined,
      { commitment: `confirmed` }
    );
  });

  it(`Rejects tx if unsigned`, async () => {
    try {
      await program.methods
        .checkSigner()
        .accounts({ signer: signer.publicKey })
        .rpc();
    } catch (e) {
      assert.ok(e.toString().includes("Signature verification failed"));
    }
  });

  it(`Processes tx if signed - Anchor's way`, async () => {
    const txid = await program.methods
      .checkSigner()
      .accounts({ signer: signer.publicKey })
      .signers([signer])
      .rpc();

    await assertLogs(provider.connection, txid);
  });

  it(`Processes tx if signer - sign()`, async () => {
    // Craft raw unsigned transaction
    const tx = await program.methods
      .checkSigner()
      .accounts({ signer: signer.publicKey })
      .transaction();

    assert.equal(tx.signatures.length, 0);

    // Add needed fields
    const info = await provider.connection.getLatestBlockhash();
    tx.recentBlockhash = info.blockhash;
    tx.lastValidBlockHeight = info.lastValidBlockHeight;
    // tx.feePayer = not needed for sign(), first signer is taken as feePayer

    // Sign using sign() method
    tx.sign(signer);

    assert.equal(tx.signatures.length, 1);

    // Send tx
    const txid = await provider.connection.sendRawTransaction(tx.serialize());
    await assertLogs(provider.connection, txid);
  });

  it(`Processes tx if signer - partialSign()`, async () => {
    // Craft raw unsigned transaction
    const tx = await program.methods
      .checkSigner()
      .accounts({ signer: signer.publicKey })
      .transaction();

    assert.equal(tx.signatures.length, 0);

    // Add needed fields
    const info = await provider.connection.getLatestBlockhash();
    tx.recentBlockhash = info.blockhash;
    tx.lastValidBlockHeight = info.lastValidBlockHeight;
    tx.feePayer = signer.publicKey; // We do need to set feePayer here

    // Sign using partialSign() method
    tx.partialSign(signer);

    assert.equal(tx.signatures.length, 1);

    // Send tx
    const txid = await provider.connection.sendRawTransaction(tx.serialize());
    await assertLogs(provider.connection, txid);
  });

  it(`Processes tx if signed - addSignature()`, async () => {
    // Craft raw unsigned transaction
    const tx = await program.methods
      .checkSigner()
      .accounts({ signer: signer.publicKey })
      .transaction();

    assert.equal(tx.signatures.length, 0);

    // Add other needed fields - we need them all to serialize the message
    const info = await provider.connection.getLatestBlockhash();
    tx.recentBlockhash = info.blockhash;
    tx.lastValidBlockHeight = info.lastValidBlockHeight;
    tx.feePayer = signer.publicKey;

    // Externally derive Ed25519 signature of the serialized message
    let rawSignature = nacl.sign.detached(
      tx.serializeMessage(),
      signer.secretKey
    );

    // Append to tx
    tx.addSignature(signer.publicKey, Buffer.from(rawSignature));

    // Send tx
    const txid = await provider.connection.sendRawTransaction(tx.serialize());

    await assertLogs(provider.connection, txid);
  });

  it(`Processes tx if signed - base64 serialized Legacy Transaction`, async () => {
    // Create unsigned tx and serialize to b64
    const b64tx = await program.methods
      .checkSigner()
      .accounts({ signer: signer.publicKey })
      .transaction()
      .then(async (tx) => {
        const info = await provider.connection.getLatestBlockhash();
        tx.recentBlockhash = info.blockhash;
        tx.lastValidBlockHeight = info.lastValidBlockHeight;
        tx.feePayer = signer.publicKey;

        // We need requireAllSignatures = false as it's unsigned
        return tx.serialize({ requireAllSignatures: false }).toString(`base64`);
      });

    // Other server - reconstruct tx from b64 string
    const tx = anchor.web3.Transaction.from(Buffer.from(b64tx, `base64`));

    // Unsigned yet, however the array has one element because we serialized before
    assert.equal(tx.signatures.length, 1);
    assert.ok(tx.signatures[0].signature === null);
    assert.ok(
      tx.signatures[0].publicKey.toBase58() === signer.publicKey.toBase58()
    );

    // Sign send and confirm (use any method you'd like)
    tx.sign(signer);

    const txid = await provider.connection.sendRawTransaction(tx.serialize());
    assertLogs(provider.connection, txid);
  });

  it(`Processes tx if signed - upon VersionedTransaction V0 creation`, async () => {
    // Create ix
    const ix = await program.methods
      .checkSigner()
      .accounts({ signer: signer.publicKey })
      .instruction();

    // Create v0 Message
    const { blockhash } = await provider.connection.getLatestBlockhash();

    const v0msg = new anchor.web3.TransactionMessage({
      payerKey: signer.publicKey,
      instructions: [ix],
      recentBlockhash: blockhash,
    }).compileToV0Message();

    // Serialize message. Send this over the wire or do whatever you want!
    const v0msgSerialized = v0msg.serialize();

    // Sign message externally
    let rawSignature = nacl.sign.detached(v0msgSerialized, signer.secretKey);

    // Create signed tx
    const tx = new anchor.web3.VersionedTransaction(v0msg, [rawSignature]);

    assert.equal(tx.signatures.length, 1);

    // Send and check
    const txid = await provider.connection.sendRawTransaction(tx.serialize());
    await assertLogs(provider.connection, txid);
  });

  it(`Processes tx if signed - VersionedTransaction V0 sign()`, async () => {
    // Create ix
    const ix = await program.methods
      .checkSigner()
      .accounts({ signer: signer.publicKey })
      .instruction();

    // Create v0 Message
    const { blockhash } = await provider.connection.getLatestBlockhash();

    const v0msg = new anchor.web3.TransactionMessage({
      payerKey: signer.publicKey,
      instructions: [ix],
      recentBlockhash: blockhash,
    }).compileToV0Message();

    // Create unsigned tx
    const tx = new anchor.web3.VersionedTransaction(v0msg);

    assert.equal(tx.signatures.length, 1);

    // Sign with sign()
    tx.sign([signer]);

    // Send and check
    const txid = await provider.connection.sendRawTransaction(tx.serialize());
    await assertLogs(provider.connection, txid);
  });

  it(`Processes tx if signed - VersionedTransaction V0 addSignature()`, async () => {
    // Create ix
    const ix = await program.methods
      .checkSigner()
      .accounts({ signer: signer.publicKey })
      .instruction();

    // Create v0 Message
    const { blockhash } = await provider.connection.getLatestBlockhash();

    const v0msg = new anchor.web3.TransactionMessage({
      payerKey: signer.publicKey,
      instructions: [ix],
      recentBlockhash: blockhash,
    }).compileToV0Message();

    // Create unsigned tx
    const tx = new anchor.web3.VersionedTransaction(v0msg);

    assert.equal(tx.signatures.length, 1);

    // Externally derive ed25519 signature
    let rawSignature = nacl.sign.detached(
      tx.message.serialize(),
      signer.secretKey
    );

    // Sign with addSignature()
    tx.addSignature(signer.publicKey, Buffer.from(rawSignature));

    // Send and check
    const txid = await provider.connection.sendRawTransaction(tx.serialize());
    await assertLogs(provider.connection, txid);
  });
});
