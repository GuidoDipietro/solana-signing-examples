# Signing in Solana

Perhaps part of a buggy incremental design, perhaps part of a master plan to allow infinite features, Solana has a ton of different ways you can sign a transaction.

In this repo I give 8 examples of ways to sign a transaction in Solana.

1. Anchor's way - through `signers()` builder method
2. Using Solana's `sign()`
3. Using Solana's `partialSign()`
4. Using Solana's `addSignature()` and `tweetnacl` to externally derive the signature
5. Using Solana's `sign()` on a `base64` string (serialized transaction)
6. **V0** - Adding raw `tweetnacl` signature upon VersionedTransaction creation
7. **V0** - Using Solana's `sign()` on unsigned VersionedTransaction
8. **V0** - Using Solana's `addSignature()` and `tweetnacl` to externally derive the signature

# How to use the repo

Find the test you'd like to investigate and just add `console.log()` on everything so you can see what every object looks like at any given step.

# Running tests

Install [Anchor](https://www.anchor-lang.com/docs/installation) and all it needs. Make sure you have a Solana keypair properly set up.

Install dependencies compile and run:

```bash
yarn
anchor test
```
