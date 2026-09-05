/* Servidor estático mínimo para Alliance Gym (sin dependencias).
   Uso:  node server.js   ->  http://localhost:5173  */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUERTO = process.env.PORT || 5173;
const RAIZ = __dirname;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.md': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
  let ruta = decodeURIComponent(req.url.split('?')[0]);
  if (ruta === '/') ruta = '/index.html';

  const destino = path.normalize(path.join(RAIZ, ruta));
  if (!destino.startsWith(RAIZ)) {
    res.writeHead(403).end('Prohibido');
    return;
  }

  fs.readFile(destino, (err, datos) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404</h1><p>No se encontró ' + ruta + '</p>');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(datos);
  });
}).listen(PUERTO, () => {
  console.log('');
  console.log('  ALLIANCE GYM — Sistema de gestión');
  console.log('  ---------------------------------');
  console.log('  Abre en tu navegador:  http://localhost:' + PUERTO);
  console.log('  Para detener: Ctrl + C');
  console.log('');
});
