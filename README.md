# node-ws-rpc
Rpc client built on persistent ws connections. Uses http status codes.

## Getting Started
```shell
npm install --save node-ws-rpc
```

## Basic Usage
```javascript
const { Client, Server } = require('node-ws-rpc');

// Create a server
const methods = {
	createUser(req) {
		const user = { name: req.body.name };
		req.reply(201, { user });
	},
};

const server = Server({ port: 3000 }, methods);


// Create a client
const client = Client('ws://localhost:3000');

client.call('createUser', { name: 'Dan' })
	.then((resp) => {
		console.log('Status:', resp.statusCode);
		console.log('User:', resp.body.user);
	})
	.catch((err) => {
		console.log(err.statusCode);
		console.log(err.body);
	});


// Detect when the persistent connection is closed
client.on('close', () => {
	console.log('Connection closed...');
});


// Later on... Manually close the connection
client.close();
```

## Client
### wsRpc.Client(address, socketOptions, rpcOptions)
address and socketOptions will be passed directly to the (ws)[https://github.com/websockets/ws] module when creating the socket.  
rpcOptions:
- `connectionTimeout`: how long we should wait before closing the socket if the server is not responding to heartbeats.
- `heartbeatPeriod`: how often to ping the server.

### client.call(methodName, body)
Send a message to the server.

### client.on(eventName, callback)
Subscribe to an event. Possible event names are `['close', 'error']`.

### client.close()
Close the socket. Will fire the `close` event if it hasn't already fired.

## Server
### wsRpc.Server(socketOptions, methods, rpcOptions)
socketOptions will be passed directly to the (ws)[https://github.com/websockets/ws] module when creating the socket.  
methods is a dictionary containing all the callable functions. A client will receive a `404` status if they call a function that we haven't defined.  
rpcOptions:
- `connectionTimeout`: how long we should wait before closing the socket if the client is not responding to heartbeats.
- `heartbeatPeriod`: how often to ping the client.

### server.close()
Close the server. Server will stop accepting new sockets. All existing sockets will be disconnected.  