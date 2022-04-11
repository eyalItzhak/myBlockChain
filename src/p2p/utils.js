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

  

  module.exports.extractMessageToSpecificPeer = extractMessageToSpecificPeer;
  module.exports.extractReceiverPeer = extractReceiverPeer;
  module.exports.toLocalIp = toLocalIp;
  module.exports.getPeerIps = getPeerIps;
  module.exports.formatMessage = formatMessage;
  module.exports.extractPortFromIp = extractPortFromIp;
  module.exports.extractPeersAndMyPort = extractPeersAndMyPort;
