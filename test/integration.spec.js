const { test } = require('tape');
const { Client, Server } = require('../');


let curPort = 3000;
function getUniquePort() {
	curPort += 1;
	return curPort;
}

const timeout = delay => new Promise(r => setTimeout(r, delay));


test('Rpc', (t1) => {
	t1.test('client call', (t) => {
		const port = getUniquePort();

		const server = Server({ port }, {
			createUser(req) {
				t.deepEqual(req.body, { name: 'Dan' }, 'server receives the body');
				t.end();
				req.reply(201);
			},
		});

		const client = Client(`ws://localhost:${port}`);
		client.call('createUser', { name: 'Dan' })
			.then(() => {
				client.close();
				server.close();
			});
	});


	t1.test('server response', (t) => {
		const port = getUniquePort();

		const server = Server({ port }, {
			createUser(req) {
				req.reply(201, { age: 24 });
			},
		});

		const client = Client(`ws://localhost:${port}`);
		client.call('createUser', { name: 'Dan' })
			.then(({ statusCode, body }) => {
				t.equal(statusCode, 201, 'client receives the status');
				t.deepEqual(body, { age: 24 }, 'client receives the body');
				t.end();
				server.close();
			});
	});


	t1.test('server error response', (t) => {
		const port = getUniquePort();

		const server = Server({ port }, {
			createUser(req) {
				req.reply(500, { reason: 'server' });
			},
		});

		const client = Client(`ws://localhost:${port}`);
		client.call('createUser', { name: 'Dan' })
			.catch(({ statusCode, body }) => {
				t.equal(statusCode, 500, 'client gets status in error response');
				t.deepEqual(body, { reason: 'server' }, 'client gets body in error response');
				t.end();
				client.close();
				server.close();
			});
	});


	t1.test('server no response', async (t) => {
		const port = getUniquePort();

		const server = Server({ port }, {
			createUser() {
				// No response
			},
		});

		const client = Client(`ws://localhost:${port}`);
		let errCode;
		client.call('createUser', { name: 'Dan' }, { timeout: 1 })
			.catch(({ statusCode }) => {
				errCode = statusCode;
			});

		await timeout(100);

		t.equal(errCode, 0, 'request times out with status === 0');
		t.end();
		client.close();
		server.close();
	});


	t1.test('multiple clients', async (t) => {
		const port = getUniquePort();

		let msgCount = 0;
		const server = Server({ port }, {
			createUser(req) {
				msgCount += 1;
				req.reply(200);
			},
		});

		const client = Client(`ws://localhost:${port}`);
		const client2 = Client(`ws://localhost:${port}`);

		client.call('createUser', { name: 'Dan' });
		client2.call('createUser', { name: 'Dan' });
		client2.call('createUser', { name: 'Dan' });
		client.call('createUser', { name: 'Dan' });

		await timeout(100);

		t.equal(msgCount, 4, 'servers receives messages from each');
		t.end();
		client.close();
		client2.close();
		server.close();
	});


	t1.test('on client close', async (t) => {
		const port = getUniquePort();
		const server = Server({ port }, {});
		const client = Client(`ws://localhost:${port}`);

		let hasClosed = false;
		let code;
		client.on('close', (c) => {
			hasClosed = true;
			code = c;
		});

		await timeout(100);
		client.close();
		await timeout(100);
		t.ok(hasClosed, 'client fires closed event');
		t.equal(code, 1000, 'with code === 1000');
		t.end();
		server.close();
	});


	t1.test('on client close', async (t) => {
		const port = getUniquePort();
		const server = Server({ port }, {});
		const client = Client(`ws://localhost:${port}`);

		let hasClosed = false;
		client.on('close', () => {
			hasClosed = true;
		});

		await timeout(100);
		client.close();
		await timeout(100);
		t.ok(hasClosed, 'client fires closed event');
		t.end();
		server.close();
	});


	t1.test('on client close with infinite reconnect', async (t) => {
		const port = getUniquePort();
		const server = Server({ port }, {});
		const client = Client(`ws://localhost:${port}`, {}, { connectionTimeout: 0 });

		// Client will still close even with infinite reconnect if we manually close it.
		let hasClosed = false;
		client.on('close', () => {
			hasClosed = true;
		});

		await timeout(100);
		client.close();
		await timeout(100);
		t.ok(hasClosed, 'client fires closed event');
		t.end();
		server.close();
	});


	t1.test('on server close', async (t) => {
		const port = getUniquePort();
		const server = Server({ port }, {});
		const client = Client(`ws://localhost:${port}`, {}, { connectionTimeout: 1000 });

		let hasClosed = false;
		client.on('close', () => {
			hasClosed = true;
		});

		server.close();
		await timeout(500);

		t.notOk(hasClosed, 'client keeps trying to connect');
		t.end();
		client.close();
	});


	t1.test('server not open', async (t) => {
		const port = getUniquePort();
		const client = Client(`ws://localhost:${port}`, {}, { connectionTimeout: 1000 });

		let hasClosed = false;
		client.on('close', () => {
			hasClosed = true;
		});

		await timeout(500);

		t.notOk(hasClosed, 'client tries to connect for awhile');
		t.end();
		client.close();
	});


	t1.test('server not open', async (t) => {
		const port = getUniquePort();
		const client = Client(`ws://localhost:${port}`, {}, { connectionTimeout: 10 });

		let hasClosed = false;
		client.on('close', () => {
			hasClosed = true;
		});

		await timeout(500);

		t.ok(hasClosed, 'client eventually closes');
		t.end();
	});


	t1.test('server not open with infinite reconnect', async (t) => {
		const port = getUniquePort();
		const opts = {
			connectionTimeout: 0,
			minReconnectDelay: 10,
		};

		// Set connectionTimeout = 0 to reconnect forever
		const client = Client(`ws://localhost:${port}`, {}, opts);

		let hasClosed = false;
		client.on('close', () => {
			hasClosed = true;
		});

		// Must wait longer than the default connection timeout
		await timeout(6000);

		t.notOk(hasClosed, 'client never closes');
		t.end();
		client.close();
	});


	t1.test('client call when server opens late', async (t) => {
		const port = getUniquePort();
		const opts = {
			connectionTimeout: 1000,
			minReconnectDelay: 10,
			growthFactor: 1,
		};

		const client = Client(`ws://localhost:${port}`, {}, opts);
		client.call('createUser', {});

		await timeout(100);

		let received = false;
		const server = Server({ port }, {
			createUser(req) {
				received = true;
				req.reply(201);
			},
		});

		await timeout(100);

		t.ok(received, 'server still receives the message');
		t.end();
		client.close();
		server.close();
	});


	t1.test('call with retry opts and server opens late', async (t) => {
		const port = getUniquePort();
		const msgOpts = {
			timeout: 100,
			minReconnectDelay: 100,
			growthFactor: 1,
			maxRetries: 5,
		};

		const client = Client(`ws://localhost:${port}`, {}, { connectionTimeout: 5000 });
		client.call('createUser', {}, msgOpts);

		await timeout(500);

		let received = false;
		const server = Server({ port }, {
			createUser(req) {
				received = true;
				req.reply(201);
			},
		});

		await timeout(500);

		t.ok(received, 'server receives the message');
		t.end();
		client.close();
		server.close();
	});


	t1.test('server not sending heartbeats', async (t) => {
		const port = getUniquePort();
		const server = Server({ port }, {});
		const client = Client(
			`ws://localhost:${port}`,
			{},
			{ connectionTimeout: 1, heartbeatPeriod: 100 },
		);

		let hasClosed = false;
		client.on('close', () => {
			hasClosed = true;
		});

		await timeout(500);

		t.ok(hasClosed, 'client closes');
		t.end();
		server.close();
	});


	t1.test('client not sending heartbeats', async (t) => {
		const port = getUniquePort();
		const server = Server({ port }, {}, { connectionTimeout: 1, heartbeatPeriod: 100 });
		const client = Client(`ws://localhost:${port}`, {});

		let hasClosed = false;
		client.on('close', () => {
			hasClosed = true;
		});

		await timeout(500);

		t.ok(hasClosed, 'client closes');
		t.end();
		server.close();
	});
});
