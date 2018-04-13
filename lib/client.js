const DEFAULT_CON_TIMEOUT = 5000;
const DEFAULT_MSG_TIMEOUT = 5000;


module.exports = ({
	// From parent
	opts,
	// From index
	ws,
	utils,
	isOpen,
}) => {
	const {
		randomAlphanumeric,
		positiveIntOrDefault,
		now,
		parseJsonDict,
		ensureDict,
	} = utils;

	const connectionTimeout = opts.connectionTimeout || DEFAULT_CON_TIMEOUT;
	const heartbeatPeriod = opts.heartbeatPeriod || connectionTimeout / 2;

	let hasClosed = false;
	let lastPong = now();
	const transactions = {};
	let msgQueue = [];

	const events = {
		close: [],
		error: [],
	};

	const emit = (name, ...args) => events[name].forEach(f => f(...args));

	function on(eventName, listener) {
		if (eventName in events && typeof listener === 'function') {
			events[eventName].push(listener);
		}
	}


	function send(msg) {
		if (isOpen(ws)) {
			ws.send(JSON.stringify(msg));
		} else {
			msgQueue.push(msg);
		}
	}


	function ping() {
		if (now() - lastPong > connectionTimeout) {
			// Close the socket if we haven't heard from the server for awhile
			ws.close();
			return;
		}
		if (isOpen(ws)) {
			ws.ping();
		}
	}

	const pingInterval = setInterval(ping, heartbeatPeriod);


	function call(command, body, options) {
		const tId = randomAlphanumeric(12);
		const timeout = positiveIntOrDefault(options && options.timeout, DEFAULT_MSG_TIMEOUT);

		return new Promise((resolve, reject) => {
			// eslint-disable-next-line no-use-before-define
			const transTimeout = setTimeout(() => callback(0, {}), timeout);

			const callback = (statusCode, respBody) => {
				// Delete the transaction
				clearTimeout(transTimeout);
				if (tId in transactions) {
					delete transactions[tId];
				}

				// Ensure this msg is no longer queued
				msgQueue = msgQueue.filter(msg => msg.transactionId === tId);

				// Resolve or reject depending on the status code
				if (statusCode !== 0 && statusCode < 400) {
					resolve({ statusCode, body: respBody });
				} else {
					reject({ statusCode, body: respBody });
				}
			};

			transactions[tId] = callback;

			send({
				command,
				body,
				transactionId: tId,
			});
		});
	}


	// Listeners
	function onOpen() {
		msgQueue.forEach(send);
		msgQueue = [];
	}


	function onClose() {
		if (!hasClosed) {
			hasClosed = true;
			clearInterval(pingInterval);
			emit('close');
			// Reject all outstanding msgs. Don't wait for them to timeout individually.
			msgQueue
				.map(msg => transactions[msg.transactionId])
				.filter(transaction => transaction)
				.forEach(transaction => transaction(0, {}));
		}
	}


	function onPong() {
		lastPong = now();
	}


	function onMessage(evt) {
		if (!(evt instanceof Object) || typeof evt.data !== 'string') {
			return;
		}

		const {
			transactionId,
			statusCode,
			body,
		} = parseJsonDict(evt.data);

		if (typeof transactionId === 'string' && transactionId in transactions) {
			transactions[transactionId](
				positiveIntOrDefault(statusCode, 200),
				ensureDict(body),
			);
		}

		// Treat every message as a pong
		onPong();
	}


	ws.addEventListener('pong', onPong);
	ws.addEventListener('message', onMessage);
	ws.addEventListener('open', onOpen);
	ws.addEventListener('close', onClose);
	ws.addEventListener('error', err => emit('error', err));


	function close() {
		ws.close();
		// Socket may not have ever opened. We still want to emit 'close' event.
		onClose();
	}


	return {
		on,
		call,
		close,
	};
};
