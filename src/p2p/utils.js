const chalk =  require('chalk');
//extract ports from process arguments, {me: first_port, peers: rest... }
function extractPeersAndMyPort(argv) {
    return {
      me: argv[2],
      peers: argv.slice(3, argv.length),
    };
  }
  
  //'4000' -> '127.0.0.1:4000'
  function toLocalIp(port) {
    return `127.0.0.1:${port}`;
  }
  
  //['4000', '4001'] -> ['127.0.0.1:4000', '127.0.0.1:4001']
  function getPeerIps(peers) {
    return peers.map((peer) => toLocalIp(peer));
  }
  
  //'hello' -> 'myPort:hello'
  function formatMessage(message,me) {
    return chalk.green.underline(message)+" coins sent to you from - >"+chalk.yellow( me);
  }
  
  //'127.0.0.1:4000' -> '4000'
  function extractPortFromIp(peer) {
    return peer.toString().slice(peer.length - 4, peer.length);
  }
  
  //'4000>hello' -> '4000'
  function extractReceiverPeer(message) {
    return message.slice(0, 4);
  }
  
  //'4000>hello' -> 'hello'
  function extractMessageToSpecificPeer(message) {
    return message.slice(5, message.length);
  }

  function info() {
    log()
    log()
    log(chalk.underline.bold("welcome to help!:"))
    log()
    log(chalk.bold.red("command 1 (only miner): ") +chalk.yellow.underline("mine"))
    log("manual do mining")
    log()
    log(chalk.bold.red("command 2: ") +chalk.yellow.underline("sent money") )
    log("the syntax is to(port) and amount")
    log("example 4001 500")
    log()
    log(chalk.bold.red("command 3: ") +chalk.yellow.underline("proof") )
    log("check if the system has approved the transaction ")
    log("(work only the last transaction)")
    log()
    log(chalk.bold.red("command 4 (only miner): ") +chalk.yellow.underline("balance") )
    log("The balance of all accounts")
    log()
    log(chalk.bold.red("command 5 (only miner): ") +chalk.yellow.underline("total mined coins") )
    log("all coins ever")
    log()
    log(chalk.bold.red("command 6 (only miner): ") +chalk.yellow.underline("total coins") )
    log("all coins in the system")
    log()
    log(chalk.bold.red("command 7 (only miner): ") +chalk.yellow.underline("total burned coins") )
    log("all coins that burned")
  
  
  }

  module.exports.extractMessageToSpecificPeer = extractMessageToSpecificPeer;
  module.exports.extractReceiverPeer = extractReceiverPeer;
  module.exports.toLocalIp = toLocalIp;
  module.exports.getPeerIps = getPeerIps;
  module.exports.formatMessage = formatMessage;
  module.exports.extractPortFromIp = extractPortFromIp;
  module.exports.extractPeersAndMyPort = extractPeersAndMyPort;
  module.exports.info=info
