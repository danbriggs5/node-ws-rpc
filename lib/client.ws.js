module.exports = ({
	emitter,
	isOpen,
	opts,
	utils,
	newWs,
}) => {
	const { posNumOrDefault, now } = utils;

	// Connection timeout will be set to 0 for infinite reconnects
	const connectionTimeout = posNumOrDefault(opts.connectionTimeout, 5000);
	const heartbeatPeriod = opts.heartbeatPeriod || connectionTimeout / 2;
	const minReconnectDelay = opts.minReconnectDelay || 500;
	const maxReconnectDelay = opts.maxReconnectDelay || 2000;
	const growthFactor = opts.growthFactor || 1.3;

	const infiniteReconnect = connectionTimeout === 0;
	let reconnectDelay = minReconnectDelay;
	let reconnectTimeout;
	let pingInterval;
	let lastPong = now();
	let isClosed = false;
	let msgQueue = [];
	let ws;


	function send(msg, timeout) {
		if (isOpen(ws)) {
			ws.send(msg);
		} else {
			msgQueue.push({
				msg,
				exp: timeout ? (now() + timeout) : null,
			});
		}
	}


	function ping() {
		if (infiniteReconnect) {
			return;
		}
		if (isOpen(ws)) {
			ws.ping();
		}
		// Close if we haven't heard from the server for awhile.
		if (now() > lastPong + connectionTimeout) {
			close(); // eslint-disable-line no-use-before-define
		}
	}


	// Send all queued messages if they have not expired
	function flushQueue() {
		msgQueue
			.filter(data => !data.exp || now() < data.exp)
			.forEach(data => send(data.msg));
		msgQueue = [];
	}


	// Flush the queue when a new socket opens
	function onOpen() {
		ping();
		flushQueue();
		reconnectDelay = minReconnectDelay;
	}


	function onClose({ code }) {
		if (isClosed) {
			return;
		}
		if (code === 0 || (!infiniteReconnect && code !== 1006)) {
			// Voluntary close. By us or the server.
			isClosed = true;
			clearTimeout(reconnectTimeout);
			clearInterval(pingInterval);
			emitter.emit('close', code === 0 ? 1000 : code);
			emitter.removeAllListeners();
			return;
		}
		// Involuntary disconnect. Do we have enough time before the connection timeout?
		if (!infiniteReconnect && now() + reconnectDelay > lastPong + connectionTimeout) {
			// Reconnect will take too long. Close socket.
			close(); // eslint-disable-line no-use-before-define
			return;
		}

		// Attempt a reconnect. Each attempt waits a bit longer (exponential backoff).
		// eslint-disable-next-line no-use-before-define
		reconnectTimeout = setTimeout(reconnect, reconnectDelay);
		reconnectDelay = Math.min(reconnectDelay * growthFactor, maxReconnectDelay);
	}


	function onPong() {
		lastPong = now();
	}


	function onMessage(evt) {
		onPong();
		emitter.emit('message', evt);
	}


	function onError(err) {
		emitter.emit('error', err);
	}


	function connect() {
		ws = newWs();
		ws.addEventListener('pong', onPong);
		ws.addEventListener('message', onMessage);
		ws.addEventListener('open', onOpen);
		ws.addEventListener('close', onClose);
		ws.addEventListener('error', onError);
	}

	function reconnect() {
		ws.removeEventListener('pong', onPong);
		ws.removeEventListener('message', onMessage);
		ws.removeEventListener('open', onOpen);
		ws.removeEventListener('close', onClose);
		ws.removeEventListener('error', onError);
		connect();
	}


	function close() {
		ws.close();
		// Socket may not be open. Close listener should still fire. Use code = 0 to indicate
		// that the client chose to close the socket.
		onClose({ code: 0 });
	}


	connect();
	if (!infiniteReconnect) {
		pingInterval = setInterval(ping, heartbeatPeriod);
	}


	return {
		close,
		send,
		getSocket: () => ws,
		on: emitter.on.bind(emitter),
		once: emitter.once.bind(emitter),
		removeListener: emitter.removeListener.bind(emitter),
	};
};
