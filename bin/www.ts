import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

import app from '../app.js';
import debug from 'debug';
import http from 'http';
import { initializeSocketIO } from '../config/socket.js';

const debugLogger = debug('express-chat-app:server');

const port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

console.log('Starting server...', port);
const server = http.createServer(app);

const io = initializeSocketIO(server);

app.set('io', io);

const host = process.env.HOST ?? '0.0.0.0';
server.listen(Number(port), host);
server.on('error', onError);
server.on('listening', onListening);
console.log(host);
function normalizePort(val: string): number | string | false {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    return val;
  }

  if (port >= 0) {
    return port;
  }

  return false;
}

function onError(error: NodeJS.ErrnoException): void {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening(): void {
  const addr = server.address();
  const bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + (addr?.port || port);
  debugLogger('Listening on ' + bind);
}

