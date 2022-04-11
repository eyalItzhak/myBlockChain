const {
  extractMessageToSpecificPeer,
  extractPortFromIp,
  formatMessage,
  toLocalIp,
  extractPeersAndMyPort,
  getPeerIps,
  extractReceiverPeer,
} = require("./utils"); //import some functions...

const topology = require("fully-connected-topology");
const { Transaction } = require("../blockChainNetWork/Transaction");
const { Blockchain } = require("../blockChainNetWork/BlockChain");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");
const fs = require("fs");
const { stdin, exit, argv } = process;
const { log } = console;
const { me, peers } = extractPeersAndMyPort(argv);
const sockets = {};
const blockChain = new Blockchain();

const chalk = require("chalk");
const help = require("nodemon/lib/help");

//####################################################################################################################
log("---------------------");
log("me - ", me);
log("peers - ", peers);
log("connecting to peers...");

const myIp = toLocalIp(me);
const peerIps = getPeerIps(peers);
let doOnce = true;
let Reception;
// Init private keys for all nodes
let nodePrivateKeys = CreateDammyMap();

//connect to peers

topology(myIp, peerIps).on("connection", (socket, peerIp) => {
  const myPort = extractPortFromIp(myIp);
  const peerPort = extractPortFromIp(peerIp);
  const myKey = ec.keyFromPrivate(nodePrivateKeys.get(myPort));
  const myWalletAddress = myKey.getPublic("hex");
  log("connected to peer - ", peerPort);
  sockets[peerPort] = socket;

  if (doOnce && myPort == "4000") {
    for (let index = 0; index < 50; index++) {
      blockChain.minePendingTransactions(myWalletAddress);
    }
   // autoMine(myWalletAddress);
    loadTransactionFromMemePoll(myWalletAddress);
    doOnce = true;
  }

  //what to do when user put input
  stdin.on("data", (data) => {
    UserInputHandler(data, myPort, peerPort, myWalletAddress, myKey);
  });

  socket.on("data", (data) => {
    const message = data.toString().trim(); //2 Case... need to unload data from wallet and add to blockChian or need to update wallet of the transaction
    if (myPort == "4000") {
      //if its miner
      minerGetDataHandler(message, data);
    } else {
      //if its wallet
      walletGetDataHandler(data);
    }
  });
});

//#####################################################################################################################################################################
//#####################################################################################################################################################################

function loadTransactionFromMemePoll(myWalletAddress) {
  const jsonString = fs.readFileSync("./transactions.json");
  const jsonParsed = JSON.parse(jsonString);
  const transactionsArr = jsonParsed.tranactionsArray;
  transactionsArr.forEach((txn) => {
    const transaction = new Transaction(
      txn.fromAddress,
      txn.toAddress,
      txn.amount
    );
    transaction.setSignature(txn.signature);
    transaction.setDate(txn.timestamp);
    blockChain.addTransaction(transaction);
    blockChain.minePendingTransactions(myWalletAddress);
  });
}

function UserInputHandler(data, myPort, peerPort, myWalletAddress, myKey) {
  //user and miner command
  const message = data.toString().trim();
  if (message === "exit") {
    //on exit
    log("Bye bye");
    exit(0);
  }

  if (
    (myPort === "4000" && peerPort === "4001") ||
    (myPort !== "4000" && peerPort === "4000")
  ) {
    if (message === "proof") {
      userAskForPoof(myPort);
    }
    if (message === "help") {
      info();
    }
  }

  // if massage stat with port
  const receiverPeer = extractReceiverPeer(message);
  if (sockets[receiverPeer]) {
    if (peerPort === receiverPeer) {
      addTransactionToBlockChain(
        myPort,
        message,
        myWalletAddress,
        receiverPeer,
        myKey
      ); //my port (how sent), message (info of the transaction),myWalletAddress(from how) , to-port(need to change),myKey(to seal the transaction)
    }
  } else {
    // the miner mining...

    if ((myPort == 4000) & (peerPort == 4001)) {
      //(only runs one! )we need to run this on one port
      minerCommandHandler(message, myWalletAddress,peerPort); //need his wallet if command is mine
    }
  }
}

function addTransactionToBlockChain(
  myPort,
  message,
  myWalletAddress,
  receiverPeer,
  myKey
) {
  //write only once
  const amount = extractMessageToSpecificPeer(message);
  const transFEE = Math.floor(Math.random() * 4 + 4);
  const minerFee = 1;
  const totalAmount =
    parseInt(transFEE) + parseInt(minerFee) + parseInt(amount);
  // If peer have enough money to send, and pay for fees
  log();
  log(
    chalk.yellow("You have paid a total of:") +
      " " +
      chalk.green.underline(totalAmount)
  );
  log(
    "on this transaction " +
      chalk.red.bold("burnFee=" + transFEE) +
      " and " +
      chalk.blue.bold("minerFee=" + minerFee)
  );

  //now we need to creat the transaction and sent them to the miner...

  const trans = createFeeTransactions(
    receiverPeer,
    myWalletAddress,
    amount,
    transFEE,
    minerFee,
    myKey
  );
  const transaction = trans[0];
  const CerberusTransaction = trans[1];
  const feeTransaction = trans[2];

  sockets[receiverPeer].write(formatMessage(amount, me));

  function myFunc() {
    sockets[receiverPeer].write("proof: " + transaction.signature);
  }
  setTimeout(myFunc, 500, "");

  //and sent them to the miner...
  if (myPort != 4000) {
    //miner on port 4000 so if the miner need to make transaction he cant sent the info of this transaction to herself so we handle this case late...
    let arr = [];
    arr.push(transaction);
    arr.push(CerberusTransaction);
    arr.push(feeTransaction);
    sockets[4000].write(JSON.stringify(arr));
  } else {
    //now we handle the other case...
    blockChain.addTransaction(transaction);
    blockChain.addTransaction(CerberusTransaction);
    blockChain.addTransaction(feeTransaction);
  }
}

function minerGetDataHandler(message, data) {
  //if gate jason file
  if (message.startsWith("{") || message.startsWith("[")) {
    const dataFrom = unloadTransactionsFromJSON(data);
    transactionArr = dataFrom[0];
    totalAmountForTnx = dataFrom[1];
    //check if also can pay fee
    if (
      checkIfCanAllowTransactions(transactionArr, transactionArr[0].fromAddress)
    ) {
      transactionArr.forEach((transaction) => {
        try {
          blockChain.addTransaction(transaction);
        } catch (error) {
          console.log("Something is wrong with the deal");
        }
      });
    }
    //to do add else handler...
  } else {
    const splitWord = message.split(" ");
    if (splitWord[0] === "getMyProof:") {
      sentProofHandler(splitWord);
    } else {
      walletGetDataHandler(data);
    }
  }
}

function userAskForPoof(myPort) {
  if (myPort != "4000") {
    const proofSent = "getMyProof: " + Reception + " " + myPort;
    sockets["4000"].write(proofSent);
  } else {
    if (Reception) {
      //console.log("your proof :" + blockChain.searchTransaction(Reception));
      approval(blockChain.searchTransaction(Reception) + "");
    } else {
      approval("");
    }
  }
}
function unloadTransactionsFromJSON(data) {
  const parsedData = JSON.parse(data); //unload data
  let transactionArr = [];
  let totalAmountForTnx = 0;
  parsedData.forEach((txn) => {
    const transaction = new Transaction( //make  transactions object
      txn.fromAddress,
      txn.toAddress,
      txn.amount
    );
    transaction.setSignature(txn.signature);
    transaction.setDate(txn.timestamp);
    transactionArr.push(transaction);
    totalAmountForTnx += parseInt(txn.amount);
  });
  return [transactionArr, totalAmountForTnx];
}

function sentProofHandler(splitWord) {
  const proof = splitWord[1];
  const yourProof = "yourProofFromMiner " + blockChain.searchTransaction(proof);
  const receiverPeer = splitWord[2];
  sockets[receiverPeer].write(yourProof);
}

function walletGetDataHandler(data) {
  massage = data.toString("utf8");
  const splitWord = massage.split(" ");
  if (splitWord[0] === "proof:") {
    log(chalk.underline.green("you got a reception!"));
    Reception = splitWord[1];
  } else if (splitWord[0] === "yourProofFromMiner") {
    // console.log("your approva " + splitWord[1]);
    approval(splitWord[1]);
  } else {
    log(data.toString("utf8"));
  }
}

function checkIfCanAllowTransactions(transactions, fromAddress) {
  const balance = blockChain.getBalanceOfAddress(fromAddress);
  let ToPay = 0;
  for (const transaction of transactions) {
    ToPay = ToPay + transaction.amount;
  }
  return balance >= ToPay;
}

function createFeeTransactions(
  receiverPeer,
  myWalletAddress,
  amount,
  transFEE,
  minerFee,
  myKey
) {
  const sentToAddress = ec
    .keyFromPrivate(nodePrivateKeys.get(receiverPeer))
    .getPublic("hex");

  const mineAddress = ec
    .keyFromPrivate(nodePrivateKeys.get("4000"))
    .getPublic("hex");
  const transaction = new Transaction(
    myWalletAddress,
    sentToAddress,
    parseInt(amount)
  );
  const CerberusTransaction = new Transaction(
    myWalletAddress,
    "CerberusSnack",
    transFEE
  );
  const feeTransaction = new Transaction(
    myWalletAddress,
    mineAddress,
    minerFee
  );
  //now we need to sign our transaction by used out private key...
  transaction.signTransaction(myKey);
  CerberusTransaction.signTransaction(myKey);
  feeTransaction.signTransaction(myKey);

  return [transaction, CerberusTransaction, feeTransaction];
}

function CreateDammyMap() {
  let nodePrivateKeys = new Map();
  nodePrivateKeys.set(
    "4000",
    "1f8b805f18072e4208f0db82be10434f7bcab3e1bcea0bde0695b4dc37c35bbc"
  );
  nodePrivateKeys.set(
    "4001",
    "eb202c3fa25792e9d5c805b82cd3cbaa5aeacc063a12d27a3a18c04065e8ac3d"
  );
  nodePrivateKeys.set(
    "4002",
    "875e4c78d8cfcd06b4a07d7e11c7504f6ab608472eb5849cd3eadc383706b6c2"
  );
  return nodePrivateKeys;
}

function minerCommandHandler(message, myWalletAddress,peerPort) {
  if (message.startsWith("mine")) {
    blockChain.minePendingTransactions(myWalletAddress);
  } else if (message.startsWith("balance")) {
    balanceOFallPorts();
  } else if (message.startsWith("total burned coins")) {
    let total = blockChain.burnedCoins();
    log(chalk.red("Total burned coins in BlockCain = " + total));
  } else if (message.startsWith("total coins")) {
    let total = blockChain.minedCoins() - blockChain.burnedCoins();
    log(chalk.yellow("Total coins in BlockCain = " + total));
  } else if (message.startsWith("total mined coins")) {
    let total = blockChain.minedCoins();
    log(chalk.green("Total mined coins in BlockCain = " + total));
  } else if (message === "help") {
    info();
  } else if (message === "autoMine"){
    if(peerPort==="4001"){
      console.log(chalk.yellow("we start mining!"))
      autoMine(myWalletAddress)
    }
  }
}

function balanceOFallPorts() {
  const address4000 = ec
    .keyFromPrivate(nodePrivateKeys.get("4000"))
    .getPublic("hex");
  const address4001 = ec
    .keyFromPrivate(nodePrivateKeys.get("4001"))
    .getPublic("hex");
  const address4002 = ec
    .keyFromPrivate(nodePrivateKeys.get("4002"))
    .getPublic("hex");

  log();
  log(chalk.underline.bold.red("balance by ports"));
  log(
    chalk.yellow("4000: ") +
      chalk.green(blockChain.getBalanceOfAddress(address4000))
  );
  log(
    chalk.yellow("4001: ") +
      chalk.green(blockChain.getBalanceOfAddress(address4001))
  );
  log(
    chalk.yellow("4002: ") +
      chalk.green(blockChain.getBalanceOfAddress(address4002))
  );
}

function info() {
  log();
  log();
  log(chalk.underline.bold("welcome to help!:"));
  log();
  log(
    chalk.bold.red("command 1 (only miner): ") + chalk.yellow.underline("mine")
  );
  log("manual do mining");
  log();
  log(
    chalk.bold.red("command 2 (only miner): ") + chalk.yellow.underline("autoMine")
  );
  log("start to automatic mining");
  log();
  log(chalk.bold.red("command 3: ") + chalk.yellow.underline("sent money"));
  log("the syntax is to(port) and amount");
  log("example 4001 500");
  log();
  log(chalk.bold.red("command 4: ") + chalk.yellow.underline("proof"));
  log("check if the system has approved the transaction ");
  log("(work only the last transaction)");
  log();
  log(
    chalk.bold.red("command 5 (only miner): ") +
      chalk.yellow.underline("balance")
  );
  log("The balance of all accounts");
  log();
  log(
    chalk.bold.red("command 6 (only miner): ") +
      chalk.yellow.underline("total mined coins")
  );
  log("all coins ever");
  log();
  log(
    chalk.bold.red("command 7 (only miner): ") +
      chalk.yellow.underline("total coins")
  );
  log("all coins in the system");
  log();
  log(
    chalk.bold.red("command 8 (only miner): ") +
      chalk.yellow.underline("total burned coins")
  );
  log("all coins that burned");
}

function approval(myAprove) {
  log();
  if (myAprove === "true") {
    log(
      chalk.green(
        "The last transfer of currency to your account has been " +
          chalk.green.underline("confirmed!")
      )
    );
  } else {
    log(
      chalk.red(
        "The last transfer of currency to your account has " +
          chalk.red.underline("not yet") +
          chalk.red(" been confirmed!")
      )
    );
  }
  log();
}

function autoMine(myWalletAddress,peerPort) {
  minerCommandHandler("mine",myWalletAddress,peerPort);
  setTimeout(autoMine, 5000, myWalletAddress,peerPort);
}
