const https = require('https');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const WebSocket = require('ws');

const HTTP_PORT = 8080;

// --- Certificado auto-firmado compatible con Chrome ---
const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

// Detectar IP local automáticamente
const os = require('os');
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}
const LOCAL_IP = process.env.SERVER_IP || getLocalIP();

const attrs = [{ name: 'commonName', value: LOCAL_IP }];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'subjectAltName', altNames: [
        { type: 7, ip: LOCAL_IP },
        { type: 2, value: 'localhost' }
    ]}
]);
cert.sign(keys.privateKey, forge.md.sha256.create());

const certPem = forge.pki.certificateToPem(cert);
const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

// --- Archivos estáticos ---
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.wasm': 'application/wasm',
    '.pck': 'application/octet-stream',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};

const httpsServer = https.createServer({ key: keyPem, cert: certPem }, (req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './game_online.html';
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found: ' + filePath); return; }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
//  RELAY GODOT 4 — Implementa el protocolo de SceneMultiplayer/WebSocketMultiplayerPeer
//
//  Sin servidor Godot headless separado.
//  Todos los jugadores son "clientes" del relay. El relay actúa como peer 1.
//
//  Protocolo SceneMultiplayer (scene_multiplayer.h):
//    NETWORK_COMMAND_SYS = 6  (0x06)
//    SYS_COMMAND_ADD_REMOTE = 0   → peer conectado (peer_connected signal)
//    SYS_COMMAND_DEL_REMOTE = 1   → peer desconectado (peer_disconnected signal)
//    SYS_COMMAND_RELAY = 2        → reenviar paquete entre peers
//
//  Formato paquetes SYS (6 bytes):
//    [0]: 0x06
//    [1]: sys_command (0, 1 ó 2)
//    [2-5]: peer_id como uint32 little-endian
//
//  Formato RELAY (6+ bytes):
//    [0]: 0x06
//    [1]: 0x02
//    [2-5]: peer_id origen (o destino cuando lo envía el cliente)
//    [6+]: paquete interior
// ─────────────────────────────────────────────────────────────────────────────

const GODOT_SYS          = 0x06;
const SYS_ADD_REMOTE     = 0;
const SYS_DEL_REMOTE     = 1;
const SYS_RELAY          = 2;

const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false });

let nextPeerId = 2;          // peer 1 = este relay; jugadores empiezan en 2
const peers = new Map();     // peerId → WebSocket

// Envía peer_id al nuevo cliente (protocolo WebSocketMultiplayerPeer)
function sendPeerId(ws, peerId) {
    const buf = Buffer.allocUnsafe(4);
    buf.writeInt32LE(peerId, 0);
    ws.send(buf);
}

// Notifica a un peer que otro peer se conectó/desconectó
function sendSys(ws, sysCmd, peerId) {
    const buf = Buffer.allocUnsafe(6);
    buf[0] = GODOT_SYS;
    buf[1] = sysCmd;
    buf.writeUInt32LE(peerId, 2);
    ws.send(buf);
}

// Envuelve datos como paquete RELAY con el ID del emisor original
function buildRelayPacket(srcPeerId, innerData) {
    const buf = Buffer.allocUnsafe(6 + innerData.length);
    buf[0] = GODOT_SYS;
    buf[1] = SYS_RELAY;
    buf.writeUInt32LE(srcPeerId, 2);
    innerData.copy(buf, 6);
    return buf;
}

wss.on('connection', (ws) => {
    const peerId = nextPeerId++;
    peers.set(peerId, ws);
    ws._peerId = peerId;

    console.log(`[Relay] Peer ${peerId} conectado. Total: ${peers.size}`);

    // 1. Enviar ID al nuevo peer
    sendPeerId(ws, peerId);

    // 2. Informar al nuevo peer sobre todos los peers existentes,
    //    y a los peers existentes sobre el nuevo
    for (const [existingId, existingWs] of peers) {
        if (existingId === peerId) continue;
        // Nuevo peer → entera de que 'existingId' ya estaba
        sendSys(ws, SYS_ADD_REMOTE, existingId);
        // Peer existente → entera de que llegó 'peerId'
        if (existingWs.readyState === WebSocket.OPEN) {
            sendSys(existingWs, SYS_ADD_REMOTE, peerId);
        }
    }

    ws.on('message', (data) => {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

        // ¿Es un paquete SYS_RELAY del cliente (peer-to-peer via relay)?
        //   Formato: [0x06][0x02][dest_int32_LE][inner...]
        if (buf.length >= 6 && buf[0] === GODOT_SYS && buf[1] === SYS_RELAY) {
            const destId = buf.readInt32LE(2);  // signed: 0=broadcast, <0=todos menos abs(destId), >0=específico
            const inner  = buf.slice(6);
            const fwd    = buildRelayPacket(peerId, inner);

            if (destId === 0) {
                // Broadcast a todos menos el emisor
                for (const [id, peerWs] of peers) {
                    if (id !== peerId && peerWs.readyState === WebSocket.OPEN)
                        peerWs.send(fwd);
                }
            } else if (destId > 0) {
                // Unicast a peer específico
                const target = peers.get(destId);
                if (target && target.readyState === WebSocket.OPEN)
                    target.send(fwd);
            } else {
                // Negativo = todos menos abs(destId) (típico "broadcast excepto yo")
                const excludeId = -destId;
                for (const [id, peerWs] of peers) {
                    if (id !== peerId && id !== excludeId && peerWs.readyState === WebSocket.OPEN)
                        peerWs.send(fwd);
                }
            }
        } else {
            // Paquete directo al "servidor" (peer 1 = relay):
            // Lo reenvía como RELAY con el origen correcto para que SceneMultiplayer
            // aplique la autoridad correcta en MultiplayerSynchronizer.
            const fwd = buildRelayPacket(peerId, buf);
            for (const [id, peerWs] of peers) {
                if (id !== peerId && peerWs.readyState === WebSocket.OPEN)
                    peerWs.send(fwd);
            }
        }
    });

    ws.on('close', () => {
        peers.delete(peerId);
        console.log(`[Relay] Peer ${peerId} desconectado. Total: ${peers.size}`);
        // Notificar a todos los peers restantes
        for (const [id, peerWs] of peers) {
            if (peerWs.readyState === WebSocket.OPEN)
                sendSys(peerWs, SYS_DEL_REMOTE, peerId);
        }
    });

    ws.on('error', (err) => {
        console.error(`[Relay] Error en peer ${peerId}:`, err.message);
        peers.delete(peerId);
    });
});

// Interceptar upgrade HTTP → WSS en el mismo puerto 8080
httpsServer.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});

httpsServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`\n=== Servidor listo ===`);
    console.log(`HTTPS (archivos): https://${LOCAL_IP}:${HTTP_PORT}`);
    console.log(`WSS  (relay):     wss://${LOCAL_IP}:${HTTP_PORT}`);
    console.log(`\nNo se necesita servidor Godot headless.`);
    console.log(`Abrir https://${LOCAL_IP}:${HTTP_PORT} en el navegador.\n`);
});
