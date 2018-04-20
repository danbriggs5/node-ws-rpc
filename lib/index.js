const Emitter = require('events');
const WebSocket = require('ws');

const ClientWs = require('./client.ws');
const Client = require('./client');
const Server = require('./server');
const utils = require('./utils');


function isOpen(ws) {
	return ws.readyState === WebSocket.OPEN;
}


const ClientWsFactory = (addr, socketOpts, opts) => ClientWs({
	opts,
	utils,
	isOpen,
	emitter: new Emitter(),
	newWs: () => new WebSocket(addr, socketOpts),
});

const ClientFactory = (addr, socketOpts = {}, opts = {}) => Client({
	utils,
	emitter: new Emitter(),
	clientWs: ClientWsFactory(addr, socketOpts, opts),
});


const ServerFactory = (socketOpts = {}, methods = {}, opts = {}) => {
	const wss = new WebSocket.Server(socketOpts);

	const onConnection = callback => wss.on('connection', callback);
	const close = () => wss.close();

	return Server({
		methods,
		opts,
		utils,
		isOpen,
		onConnection,
		close,
	});
};


module.exports = {
	Client: ClientFactory,
	Server: ServerFactory,
};
