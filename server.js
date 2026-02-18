const https = require('https');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const WebSocket = require('ws');

const HTTP_PORT = 8080;
const GODOT_HOST = '127.0.0.1';
const GODOT_PORT = 7777;

// --- Certificado auto-firmado compatible con Chrome ---
const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

const attrs = [{ name: 'commonName', value: '192.168.7.3' }];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'subjectAltName', altNames: [
        { type: 7, ip: '192.168.7.3' },
        { type: 2, value: 'localhost' }
    ]}
]);
cert.sign(keys.privateKey, forge.md.sha256.create());

const certPem = forge.pki.certificateToPem(cert);
const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.wasm': 'application/wasm',
    '.pck': 'application/octet-stream',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};

// --- Servidor HTTPS para archivos estáticos del juego ---
const httpsServer = https.createServer({ key: keyPem, cert: certPem }, (req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './game_online.html';

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found: ' + filePath);
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

// --- Proxy WSS → WS hacia servidor Godot dedicado ---
//
// El navegador no puede conectar a ws:// desde una página HTTPS (mixed content).
// Este proxy actúa como terminador TLS: acepta wss://IP:8080 del browser
// y lo reenvía como ws://localhost:7777 al servidor Godot headless.
//
// Flujo:
//   Browser --wss:8080--> [Node.js proxy] --ws:7777--> [Godot headless]
//
const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false });

wss.on('connection', (clientWs) => {
    const godotUrl = `ws://${GODOT_HOST}:${GODOT_PORT}`;
    const godotWs = new WebSocket(godotUrl, { perMessageDeflate: false });

    godotWs.on('open', () => {
        console.log('[Proxy] Cliente conectado → Godot server');

        // Browser → Godot
        clientWs.on('message', (data) => {
            if (godotWs.readyState === WebSocket.OPEN) {
                godotWs.send(data, { binary: true });
            }
        });

        // Godot → Browser
        godotWs.on('message', (data) => {
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(data, { binary: true });
            }
        });

        clientWs.on('close', () => {
            if (godotWs.readyState === WebSocket.OPEN) godotWs.close();
        });

        godotWs.on('close', () => {
            if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
        });
    });

    godotWs.on('error', (err) => {
        console.error(`[Proxy] No se pudo conectar al servidor Godot (${godotUrl}):`, err.message);
        console.error('        Asegúrate de que el servidor Godot está corriendo en el puerto', GODOT_PORT);
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close(1013, 'Servidor de juego no disponible');
        }
    });
});

// Interceptar upgrade HTTP → WebSocket en el mismo puerto 8080
httpsServer.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});

httpsServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`\nServidor HTTPS (archivos): https://192.168.7.3:${HTTP_PORT}`);
    console.log(`Proxy WSS → WS:            wss://192.168.7.3:${HTTP_PORT} → ws://localhost:${GODOT_PORT}`);
    console.log('\nPara jugar:');
    console.log('  1. Ejecutar servidor Godot headless (puerto 7777)');
    console.log('  2. Abrir https://192.168.7.3:8080 en el navegador');
    console.log('  3. Ingresar IP del servidor y hacer clic en "Unirse"\n');
});
