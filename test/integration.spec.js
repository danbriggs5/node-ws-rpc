const { test } = require('tape');
const { Client, Server } = require('../');


let curPort = 3000;
function getPort() {
	curPort += 1;
	return curPort;
}

const timeout = delay => new Promise(r => setTimeout(r, delay));


test('Rpc', (t1) => {
	t1.test('client call', (t) => {
		const port = getPort();

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
				server.close();
			});
	});

	t1.test('server response', (t) => {
		const port = getPort();

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
		const port = getPort();

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
				server.close();
			});
	});

	t1.test('server no response', (t) => {
		const port = getPort();

		const server = Server({ port }, {
			createUser() {
				// No response
			},
		});

		const client = Client(`ws://localhost:${port}`);
		client.call('createUser', { name: 'Dan' }, { timeout: 1 })
			.catch(({ statusCode }) => {
				t.equal(statusCode, 0, 'request times out with status === 0');
				t.end();
				server.close();
			});
	});

	t1.test('multiple clients', async (t) => {
		const port = getPort();

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
		server.close();
	});

	t1.test('on server close', async (t) => {
		const port = getPort();
		const server = Server({ port }, {});
		const client = Client(`ws://localhost:${port}`);

		let hasClosed = false;
		client.on('close', () => {
			hasClosed = true;
		});

		await timeout(100);
		server.close();
		await timeout(100);
		t.ok(hasClosed, 'client fires closed event');
		t.end();
	});

	t1.test('on client close', async (t) => {
		const port = getPort();
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

	t1.test('server not active', async (t) => {
		const port = getPort();
		const client = Client(`ws://localhost:${port}`, {}, { connectionTimeout: 1 });

		let hasClosed = false;
		client.on('close', () => {
			hasClosed = true;
		});

		await timeout(500);
		t.ok(hasClosed, 'client closes');
		t.end();
	});

	t1.test('server not sending heartbeats', async (t) => {
		const port = getPort();
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
		const port = getPort();
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
