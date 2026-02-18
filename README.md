<<<<<<< HEAD
# PT_PRUEBA_V3 — Servidor Dedicado + Clientes HTML5

## Arquitectura

```
[Servidor Dedicado - headless]   ← corre en tu PC o Hetzner
         ↑            ↑
  [Browser A]    [Browser B]     ← cualquier usuario con Chrome
```

El servidor NO tiene ventana ni UI. Solo maneja red y lógica.
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

## Cómo correr el servidor dedicado

### Opción A — Desde el editor de Godot (para pruebas)
```
Godot.exe --path "ruta/al/proyecto" --headless
```

### Opción B — Desde ejecutable exportado Windows
```powershell
PT_PRUEBA_V3.exe --headless
```

### Opción C — Desde ejecutable exportado Linux (Hetzner)
```bash
./PT_PRUEBA_V3.x86_64 --headless
```

Al arrancar en modo headless verás:
```
=== MODO SERVIDOR DEDICADO ===
Servidor WebSocket escuchando en puerto 7777
```

---

## Cómo correr el servidor HTTP para los clientes

En la carpeta con los archivos HTML exportados:

```powershell
node server.js
```

O con Python:
```powershell
python3 -m http.server 8080 --bind 0.0.0.0
```

---

## Flujo completo de prueba LAN

1. **Terminal 1** — Inicia el servidor del juego:
   ```
   Godot.exe --path "ruta/proyecto" --headless
   ```

2. **Terminal 2** — Inicia el servidor HTTP:
   ```
   cd carpeta_export_html && node server.js
   ```

3. **Cualquier navegador en la red**:
   - Abre `https://192.168.7.3:8080`
   - Ingresa `192.168.7.3` como IP
   - Clic en "Unirse"

---

## Puertos
| Puerto | Uso |
|--------|-----|
| 7777 TCP | WebSocket del juego (servidor dedicado) |
| 8080 TCP | Servidor HTTP para el HTML5 |

```powershell
netsh advfirewall firewall add rule name="Godot Game" dir=in action=allow protocol=TCP localport=7777
netsh advfirewall firewall add rule name="Godot HTTP" dir=in action=allow protocol=TCP localport=8080
```

---

## Para subir a Hetzner (próximo paso)
1. Crea VPS Linux en Hetzner (€4-6/mes)
2. Sube el ejecutable Linux headless
3. Corre: `./PT_PRUEBA_V3.x86_64 --headless &`
4. Sirve el HTML con nginx o el server.js
5. Los jugadores acceden por IP pública del VPS
=======
# game_prueba_piloto
>>>>>>> 0d396657f9494416587eb1e03d8ebc87bf33c940
