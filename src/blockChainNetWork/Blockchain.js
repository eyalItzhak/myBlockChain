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

const {Block} = require('./block')
const {Transaction} = require('./transaction')

//#####################################################################


class Blockchain {
    constructor() {
      this.chain = [this.createGenesisBlock()]; //if first block=> next is the new block
      this.difficulty = 2;
      this.pendingTransactions = [];
      this.miningReward = 20;
      this.initBloomFilter();
    }
  
    /**
     * @returns {Block}
     */
    createGenesisBlock() {
      return new Block(Date.parse("2017-01-01"), [], "0");
    }
  
    //BloomFilter =>for fast Search in all the blocks
    initBloomFilter() {
      this.filter = new BloomFilter(64, 5);
    }
    //BloomFilter search
    BloomFilterSerch(signature) {
      return this.filter.has(signature);
    }
  
    searchTransaction(signature) { 
      //const signature = transaction.signature;
      if (this.BloomFilterSerch(signature)) {
        for (const block of this.chain) {
          if (block.cheakIfTransactionInBlock(signature)) {
            return true;
          }
        }
        return false;
      } else {
        return false;
      }
    }
  
    /**
     * Returns the latest block on our chain. Useful when you want to create a
     * new Block and you need the hash of the previous Block.
     *
     * @returns {Block[]}
     */
    getLatestBlock() {
      return this.chain[this.chain.length - 1];
    }
  
    /**
     * Takes all the pending transactions, puts them in a Block and starts the
     * mining process. It also adds a transaction to send the mining reward to
     * the given address.
     *
     * @param {string} miningRewardAddress
     */
    minePendingTransactions(miningRewardAddress) {
      const rewardTx = new Transaction(
        null,
        miningRewardAddress,
        this.miningReward
      ); //Transaction that give crypto amount of "miningReward" to the miner (miningRewardAddress)
      //this.pendingTransactions.push(rewardTx); //+all the transaction need to approval
  
      let transactionsToApprove = [];
  
      for (let i = 0; i < numOfPendingTransactions; i++) {
        if (this.pendingTransactions[i] != undefined)
          transactionsToApprove.push(this.pendingTransactions[i]);
        else break;
      }
      transactionsToApprove.push(rewardTx);
  
      const block = new Block(
        Date.now(),
        transactionsToApprove,
        this.getLatestBlock().hash
      ); //create new blockchain
      block.mineBlock(this.difficulty); //mined new block with the difficulty we define
      
        

      //when succeeded
      debug("Block successfully mined!");
      this.chain.push(block); //add new block to the
     
      this.addTransactionsToBloomFilter(transactionsToApprove);

      this.pendingTransactions = this.pendingTransactions.slice(
        numOfPendingTransactions
      );
    }
  
    addTransactionsToBloomFilter(transactions) {
      const popped = transactions.pop();
      for (let transaction of transactions ) {
        if(transaction.signature){
          this.filter.add(transaction.signature); //ex filter.add(x) for all transaction
        }
      }
      
      transactions.push(popped);
    }
  
    /**
     * Add a new transaction to the list of pending transactions (to be added
     * next time the mining process starts). This verifies that the given
     * transaction is properly signed.
     *
     * @param {Transaction} transaction
     */
    addTransaction(transaction) {
      if (!transaction.fromAddress || !transaction.toAddress) {
        throw new Error("Transaction must include from and to address");
      }
  
      // Verify the transactiion
      if (!transaction.isValid()) {
        throw new Error("Cannot add invalid transaction to chain");
      }
  
      if (transaction.amount <= 0) {
        throw new Error("Transaction amount should be higher than 0");
      }
  
      // Making sure that the amount sent is not greater than existing balance
      const walletBalance = this.getBalanceOfAddress(transaction.fromAddress);
      if (walletBalance < transaction.amount) {
        throw new Error("Not enough balance");
      }
  
      // Get all other pending transactions for the "from" wallet
      const pendingTxForWallet = this.pendingTransactions.filter(
        (tx) => tx.fromAddress === transaction.fromAddress
      );
  
      // If the wallet has more pending transactions, calculate the total amount
      // of spend coins so far. If this exceeds the balance, we refuse to add this
      // transaction.
      if (pendingTxForWallet.length > 0) {
        const totalPendingAmount = pendingTxForWallet
          .map((tx) => tx.amount)
          .reduce((prev, curr) => prev + curr);
  
        const totalAmount = totalPendingAmount + transaction.amount;
        if (totalAmount > walletBalance) {
          throw new Error(
            "Pending transactions for this wallet is higher than its balance."
          );
        }
      }
  
      this.pendingTransactions.push(transaction);
      debug("transaction added: %s", transaction);
    }
  
    /**
     * Returns the balance of a given wallet address.
     *
     * @param {string} address
     * @returns {number} The balance of the wallet
     */
    getBalanceOfAddress(address) {
      let balance = 0;
  
      for (const block of this.chain) {
        for (const trans of block.transactions) {
          if (trans.fromAddress === address) {
            balance -= (trans.amount) ;
          }
  
          if (trans.toAddress === address) {
            balance += trans.amount;
          }
        }
      }
  
      debug("getBalanceOfAdrees: %s", balance);
      return balance;
    }

    burnedCoins() {
        let total = 0;
        for (const block of this.chain) {
          for (const trans of block.transactions) {
            if (trans.toAddress === "CerberusSnack") {
              total += trans.amount;
            }
          }
        }
        return total;
      }

      minedCoins() {
        let total = 0;
        for (const block of this.chain) {
          for (const trans of block.transactions) {
            if (trans.fromAddress === null) {
              total += trans.amount;
            }
          }
        }
        return total;
      }
  
    /**
     * Returns a list of all transactions that happened
     * to and from the given wallet address.
     *
     * @param  {string} address
     * @return {Transaction[]}
     */
    getAllTransactionsForWallet(address) {
      const txs = [];
  
      for (const block of this.chain) {
        for (const tx of block.transactions) {
          if (tx.fromAddress === address || tx.toAddress === address) {
            txs.push(tx);
          }
        }
      }
  
      debug("get transactions for wallet count: %s", txs.length);
      return txs;
    }
  
    /**
     * Loops over all the blocks in the chain and verify if they are properly
     * linked together and nobody has tampered with the hashes. By checking
     * the blocks it also verifies the (signed) transactions inside of them.
     *
     * @returns {boolean}
     */
    isChainValid() {
      // Check if the Genesis block hasn't been tampered with by comparing
      // the output of createGenesisBlock with the first block on our chain
      const realGenesis = JSON.stringify(this.createGenesisBlock());
  
      if (realGenesis !== JSON.stringify(this.chain[0])) {
        return false;
      }
  
      // Check the remaining blocks on the chain to see if there hashes and
      // signatures are correct
      for (let i = 1; i < this.chain.length; i++) {
        const currentBlock = this.chain[i];
        const previousBlock = this.chain[i - 1];
  
        if (previousBlock.hash !== currentBlock.previousHash) {
          return false;
        }
  
        if (!currentBlock.hasValidTransactions()) {
          return false;
        }
  
        if (currentBlock.hash !== currentBlock.calculateHash()) {
          return false;
        }
      }
  
      return true;
    }
  }

  module.exports.Blockchain = Blockchain;