const DEFAULT_CON_TIMEOUT = 5000;


module.exports = ({
	// From parent
	methods,
	opts,
	// From index
	utils,
	isOpen,
	onConnection,
	close,
}) => {
	const {
		now,
		ensureDict,
		parseJsonDict,
	} = utils;

	const connectionTimeout = opts.connectionTimeout || DEFAULT_CON_TIMEOUT;
	const heartbeatPeriod = opts.heartbeatPeriod || connectionTimeout / 2;


	onConnection((ws) => {
		let lastPong = now();

		function ping() {
			if (now() - lastPong > connectionTimeout) {
				// Close the socket if we haven't heard from the client for awhile
				ws.close();
			}
			if (isOpen(ws)) {
				ws.ping();
			}
		}

		const pingInterval = setInterval(ping, heartbeatPeriod);

		function send(msg) {
			if (isOpen(ws)) {
				ws.send(msg);
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
				command,
				transactionId,
				body,
			} = parseJsonDict(evt.data);

			if (command in methods && typeof transactionId === 'string') {
				methods[command]({
					body: ensureDict(body),
					reply(statusCode, respBody) {
						send(JSON.stringify({
							transactionId,
							statusCode,
							...(respBody && { body: respBody }),
						}));
					},
					socket: ws,
				});
			}

			onPong();
		}

		function onClose() {
			clearInterval(pingInterval);
		}

		ws.addEventListener('pong', onPong);
		ws.addEventListener('message', onMessage);
		ws.addEventListener('close', onClose);
		ws.addEventListener('error', () => {});
	});

	return {
		close,
	};
};
