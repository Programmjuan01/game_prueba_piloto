# PT_PRUEBA_V3 — Servidor Dedicado + Clientes HTML5

## Arquitectura

```
[Servidor Dedicado Godot - headless, puerto 7777]
         ↑            ↑
   [Node.js proxy, puerto 8080]   ← termina TLS, reenvía a Godot
         ↑            ↑
  [Browser A]    [Browser B]     ← cualquier usuario con Chrome
```

El servidor Godot NO tiene ventana ni UI. Solo maneja red y lógica.
El Node.js proxy actúa como terminador TLS: los browsers solo pueden usar `wss://` desde páginas HTTPS; el proxy recibe `wss://IP:8080` y lo reenvía como `ws://localhost:7777` al servidor Godot.
Los clientes son 100% navegador — no necesitan instalar nada.

---

## Exportaciones necesarias (2)

### Exportación 1 — Servidor Linux/Windows (headless)
- Proyecto → Exportar → Windows Desktop (o Linux)
- **Importante**: en las opciones de exportación activa **"Export Console Wrapper"**
- O simplemente usa el ejecutable de Godot con `--headless`

### Exportación 2 — Clientes HTML5
- Proyecto → Exportar → Web
- Exportar como `game_online.html`

---

## Cómo correr el servidor

### Paso 1 — Iniciar servidor Godot (headless)

#### Opción A — Desde el editor de Godot (para pruebas)
```
Godot.exe --path "ruta/al/proyecto" --headless
```

#### Opción B — Desde ejecutable exportado Windows
```powershell
PT_PRUEBA_V3.exe --headless
```

#### Opción C — Desde ejecutable exportado Linux (Hetzner)
```bash
./PT_PRUEBA_V3.x86_64 --headless
```

Al arrancar en modo headless verás:
```
=== MODO SERVIDOR DEDICADO ===
Servidor WebSocket escuchando en puerto 7777
```

### Paso 2 — Iniciar el proxy/servidor HTTP (Node.js)

```powershell
node server.js
```

Verás:
```
Servidor HTTPS (archivos): https://192.168.7.3:8080
Proxy WSS → WS:            wss://192.168.7.3:8080 → ws://localhost:7777
```

---

## Flujo completo de prueba LAN

1. **Terminal 1** — Inicia el servidor Godot:
   ```
   Godot.exe --path "ruta/proyecto" --headless
   ```

2. **Terminal 2** — Inicia el proxy Node.js:
   ```
   node server.js
   ```

3. **Cualquier navegador en la red**:
   - Abre `https://192.168.7.3:8080`
   - Acepta el certificado auto-firmado (botón "Avanzado" → "Continuar")
   - Ingresa `192.168.7.3` como IP del servidor
   - Clic en "Unirse"

---

## Puertos
| Puerto | Uso |
|--------|-----|
| 7777 TCP | WebSocket del juego (servidor Godot headless) |
| 8080 TCP | HTTPS + proxy WSS (Node.js) |

```powershell
# Windows Firewall
netsh advfirewall firewall add rule name="Godot Game" dir=in action=allow protocol=TCP localport=7777
netsh advfirewall firewall add rule name="Godot HTTP" dir=in action=allow protocol=TCP localport=8080
```

---

## Para subir a Hetzner (próximo paso)
1. Crea VPS Linux en Hetzner (€4-6/mes)
2. Sube el ejecutable Linux headless + carpeta con archivos web
3. Corre: `./PT_PRUEBA_V3.x86_64 --headless &`
4. Corre: `node server.js &`
5. Los jugadores acceden por IP pública del VPS

---

## Sync de movimiento (qué se mejoró)

| Antes | Después |
|-------|---------|
| Solo sincronizaba `position` | Sincroniza `_net_position` + `_net_velocity` |
| `replication_interval` = 0.1s (10 Hz) | `replication_interval` = 0.0 (cada physics frame) |
| Posición remota saltaba bruscamente | Interpolación suave + extrapolación con velocidad |
| URL `ws://` bloqueada por Chrome | Proxy `wss://` en puerto 8080 |
| Código duplicado en servidor dedicado | Limpiado |
