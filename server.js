const https = require('https');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

const PORT = 8080;

// Generar certificado compatible con Chrome
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

https.createServer({ key: keyPem, cert: certPem }, (req, res) => {
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
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor HTTPS en https://192.168.7.3:${PORT}`);
    console.log(`Generando certificado... puede tardar unos segundos al iniciar.`);
});