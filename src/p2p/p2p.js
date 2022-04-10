const {extractMessageToSpecificPeer,extractPortFromIp,formatMessage,toLocalIp,extractPeersAndMyPort,getPeerIps,extractReceiverPeer} =require("./utils") //import some functions...

const topology = require("fully-connected-topology");
const { Transaction } = require("../blockChainNetWork/Transaction");
const { Blockchain } = require("../blockChainNetWork/BlockChain");
const EC = require("elliptic").ec;
const ec = new EC("secp256k1");

const { stdin, exit, argv } = process;
const { log } = console;
const { me, peers } = extractPeersAndMyPort(argv);
const sockets = {};
const blockChain = new Blockchain();



log("---------------------");
log("me - ", me);
log("peers - ", peers);
log("connecting to peers...");

const myIp = toLocalIp(me);
const peerIps = getPeerIps(peers);

let doOnce = true;

// Init private keys for all nodes
//##############################!dummey private Key!##############################
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
//###################################################################################



//connect to peers
topology(myIp, peerIps).on("connection", (socket, peerIp) => {
  const myPort = extractPortFromIp(myIp);
  const peerPort = extractPortFromIp(peerIp);

  const myKey = ec.keyFromPrivate(nodePrivateKeys.get(myPort));
  const myWalletAddress = myKey.getPublic("hex");

  log("connected to peer - ", peerPort);
  sockets[peerPort] = socket;

  if (doOnce && myPort == "4000") {
    //for some money
    for (let index = 0; index < 100; index++) {
      blockChain.minePendingTransactions(myWalletAddress);
    }
  }
  //##what to do when user put input
  stdin.on("data", (data) => {
    //on user input
    const message = data.toString().trim();
    if (message === "exit") {
      //on exit
      log("Bye bye");
      exit(0);
    }

    const receiverPeer = extractReceiverPeer(message);

    if (sockets[receiverPeer]) {
      //message to specific peer (if we sent money to someone....)
      if (peerPort === receiverPeer) {
        //write only once
        amount = extractMessageToSpecificPeer(message);
        const transFEE = Math.floor(Math.random() * 4 + 4);
        const minerFee = 1;
        const totalAmount =
          parseInt(transFEE) + parseInt(minerFee) + parseInt(amount);
        // If peer have enough money to send, and pay for fees
        log(
          `You have paid a total of ${totalAmount} on this transaction burnFee=${transFEE} minerFee=${minerFee}`
        );
        sockets[receiverPeer].write(formatMessage(amount,me));

        //now we need to creat the transaction and sent them to the miner...
        console.log(receiverPeer);

        const sentToAddress = ec
          .keyFromPrivate(nodePrivateKeys.get(receiverPeer))
          .getPublic("hex");

        //console.log("the adress!!!!: "+sentToAddress)//##########################################

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
    } else {
      //maybe we need to mining...
      if ((myPort == 4000) & (peerPort == 4001)) {
        //we need to run this on one port
        if (message.startsWith("mine")) {
          blockChain.minePendingTransactions(myWalletAddress);
        }

        if (message.startsWith("balance")) {
          const address4001 = ec
            .keyFromPrivate(nodePrivateKeys.get("4001"))
            .getPublic("hex");
          const address4002 = ec
            .keyFromPrivate(nodePrivateKeys.get("4002"))
            .getPublic("hex");
          console.log(
            "4000: " + blockChain.getBalanceOfAddress(myWalletAddress)
          );
          console.log("4001: " + blockChain.getBalanceOfAddress(address4001));
          console.log("4002: " + blockChain.getBalanceOfAddress(address4002));
        }
      }
    }
  });

  //##what to do when Get data!
  //print data when received
  socket.on("data", (data) => {
    //2 Case... need to unload data from wallet and add to blockChian or need to update wallet of the transaction
    const message = data.toString().trim();
    if (peerPort == "4002" && myPort == "4000") {
      addAndValidateTransactions(message, data);
    } else if (peerPort == "4001" && myPort == "4000") {
      addAndValidateTransactions(message, data);
    } else {
       log(data.toString("utf8"));
    }
  });
});


//#####################################################################################################################################################################
//#####################################################################################################################################################################
function addAndValidateTransactions(message, data) {
  //const message = data.toString().trim();
  if (message.startsWith("{") || message.startsWith("[")) {
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

    transactionArr.forEach((transaction) => {
      blockChain.addTransaction(transaction);
    });
  }
}