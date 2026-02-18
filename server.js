const https = require('https');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const WebSocket = require('ws');

const PORT = 8080;

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

// --- Servidor HTTPS para archivos estáticos ---
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

// --- Relay WebSocket para Godot 4 WebSocketMultiplayerPeer ---
// Protocolo:
//   Conexión nueva → servidor envía peer_id (int32 little-endian, 4 bytes)
//   Paquetes de datos → se reenvían a TODOS los demás peers conectados
//   Desconexión → se cierra y elimina el peer

const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false });

let nextPeerId = 2; // Godot reserva 1 para el servidor
const peers = new Map(); // peerId -> ws

function sendPeerId(ws, peerId) {
    const buf = Buffer.allocUnsafe(4);
    buf.writeInt32LE(peerId, 0);
    ws.send(buf);
}

wss.on('connection', (ws) => {
    const peerId = nextPeerId++;
    peers.set(peerId, ws);
    ws._peerId = peerId;

    console.log(`[Relay] Peer ${peerId} conectado. Total: ${peers.size}`);

    // Enviar ID al cliente (protocolo Godot 4)
    sendPeerId(ws, peerId);

    ws.on('message', (data, isBinary) => {
        // Reenviar a todos los demás peers lo antes posible (sin procesar)
        for (const [id, peer] of peers) {
            if (id !== peerId && peer.readyState === WebSocket.OPEN) {
                peer.send(data, { binary: true });
            }
        }
    });

    ws.on('close', () => {
        peers.delete(peerId);
        console.log(`[Relay] Peer ${peerId} desconectado. Total: ${peers.size}`);
    });

    ws.on('error', (err) => {
        console.error(`[Relay] Error en peer ${peerId}:`, err.message);
        peers.delete(peerId);
    });
});

// Interceptar upgrade HTTP → WebSocket (mismo puerto 8080)
httpsServer.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});

httpsServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor HTTPS + WSS en https://192.168.7.3:${PORT}`);
    console.log(`Relay WebSocket activo en wss://192.168.7.3:${PORT}`);
});
