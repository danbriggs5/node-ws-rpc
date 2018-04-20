const DEFAULT_MSG_TIMEOUT = 5000;


module.exports = ({
	emitter,
	utils,
	clientWs,
}) => {
	const {
		randomAlphanumeric,
		positiveIntOrDefault,
		parseJsonDict,
		ensureDict,
	} = utils;

	const transactions = {};

	// Ensure errors are caught in case app doesn't subscribe
	emitter.on('error', () => {});


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

				// Resolve or reject depending on the status code
				if (statusCode !== 0 && statusCode < 400) {
					resolve({ statusCode, body: respBody });
				} else {
					reject({ statusCode, body: respBody });
				}
			};

			transactions[tId] = callback;

			clientWs.send(JSON.stringify({
				command,
				body,
				transactionId: tId,
			}), timeout);
		});
	}


	function onClose() {
		// Reject all outstanding msgs. Don't wait for them to timeout individually.
		Object.keys(transactions).forEach((key) => {
			transactions[key](0, {});
			delete transactions[key];
		});

		emitter.emit('close');
		emitter.removeAllListeners();
	}


	function onError(err) {
		emitter.emit('error', err);
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
	}


	clientWs.once('close', onClose);
	clientWs.on('error', onError);
	clientWs.on('message', onMessage);


	function close() {
		clientWs.close();
	}


	return {
		call,
		close,
		on: emitter.on.bind(emitter),
		once: emitter.once.bind(emitter),
		removeListener: emitter.removeListener.bind(emitter),
	};
};
