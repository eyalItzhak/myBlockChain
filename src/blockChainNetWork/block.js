//#####################################################################
//imports
const crypto = require("crypto");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");
const debug = require("debug")("savjeecoin:blockchain");

const { BloomFilter } = require("bloom-filters");
const { MerkleTree } = require("merkletreejs"); //maybe need be inside a block?

const SHA256 = require("crypto-js/sha256");

const numOfPendingTransactions = 3;

const {Transaction} = require('./transaction')
//#####################################################################


class Block {
    /**
     * @param {number} timestamp
     * @param {Transaction[]} transactions
     * @param {string} previousHash
     */
    constructor(timestamp, transactions, previousHash = "") {
      this.previousHash = previousHash;
      this.timestamp = timestamp;
      this.transactions = transactions;
      this.nonce = 0;
      this.hash = this.calculateHash();
  
      //creat the tree
  
      this.initMerkleTree(transactions);
      this.initBloomFilter(transactions);
    }
  
    /**
     * Returns the SHA256 of this block (by processing all the data stored
     * inside this block)
     *
     * @returns {string}
     */
    calculateHash() {
      return crypto
        .createHash("sha256")
        .update(
          this.previousHash +
            this.timestamp +
            JSON.stringify(this.transactions) +
            this.nonce
        )
        .digest("hex");
    }
  
    /**
     * Starts the mining process on the block. It changes the 'nonce' until the hash
     * of the block starts with enough zeros (= difficulty)
     *
     * @param {number} difficulty
     */
    mineBlock(difficulty) {
      while (
        this.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")
      ) {
        this.nonce++;
        this.hash = this.calculateHash();
      }
  
      debug(`Block mined: ${this.hash}`);
    }
  
    /**
     * Validates all the transactions inside this block (signature + hash) and
     * returns true if everything checks out. False if the block is invalid.
     *
     * @returns {boolean}
     */
    hasValidTransactions() {
      for (const tx of this.transactions) {
        if (!tx.isValid()) {
          return false;
        }
      }
  
      return true;
    }
  
    //MerkleTree
    initMerkleTree(transactions) {
      const leaves = transactions.map((transaction) =>
        SHA256(transaction.signature)
      ); //get all transactions and make them leaves of new MerkleTree //if undefined its do noting?
      this.tree = new MerkleTree(leaves, SHA256); //make actual the Tree from "merkletreejs"
      this.root = this.tree.getRoot().toString("hex"); // make the roots of the tree
    }
  
    //BloomFilter
    initBloomFilter(transactions) {
      // create a Bloom Filter with a size of 24 and 5 hash functions
      this.filter = new BloomFilter(32, 4);
      for (const tx of transactions) {
        if (tx.fromAddress != null) this.filter.add(tx.signature);
      }
    }
  
    BloomFilterSerch(signature) {
      return this.filter.has(signature);
    }
  
    GetProofFromMerkleTree(signature) {
      const leaf = SHA256(signature); //make leaf
      const proof = this.tree.getProof(leaf); //
      return this.tree.verify(proof, leaf, this.root); //true if the transaction in the block, if not return false
    }
  
    cheakIfTransactionInBlock(signature) {
      if (this.BloomFilterSerch(signature)) {
        return this.GetProofFromMerkleTree(signature);
      } else {
        false;
      }
    }
  }

  module.exports.Block = Block;