extends Node

const PORT = 7777
const MAX_PLAYERS = 8

var players = {}
var is_dedicated_server = false

func _ready():
	multiplayer.peer_connected.connect(_on_peer_connected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	multiplayer.connected_to_server.connect(_on_connected_to_server)
	multiplayer.connection_failed.connect(_on_connection_failed)

	# Detectar si corre en modo headless (servidor dedicado)
	if DisplayServer.get_name() == "headless":
		is_dedicated_server = true
		print("=== MODO SERVIDOR DEDICADO ===")
		start_dedicated_server()
	elif OS.get_name() == "Web":
		# En navegador: ocultar botón host, mostrar solo join
		get_node("UI").set_web_mode()

# ──────────────────────────────────────────
#  SERVIDOR DEDICADO (headless)
# ──────────────────────────────────────────
func start_dedicated_server():
	var peer = WebSocketMultiplayerPeer.new()
	var err = peer.create_server(PORT)
	if err != OK:
		print("Error al crear servidor: ", err)
		get_tree().quit()
		return
	multiplayer.multiplayer_peer = peer
	print("Servidor WebSocket escuchando en puerto ", PORT)
	if has_node("UI"):
		get_node("UI").hide()
	load_game_scene()
	# NO agregar jugador ID:1 — el servidor no es un jugador
	
	
	multiplayer.multiplayer_peer = peer
	print("Servidor WebSocket escuchando en puerto ", PORT)
	if has_node("UI"):
		get_node("UI").hide()
	load_game_scene()
	# NO agregar jugador ID:1 — el servidor no es un jugador
	multiplayer.multiplayer_peer = peer
	print("Servidor WebSocket escuchando en puerto ", PORT)
	# Ocultar UI (no existe en headless)
	if has_node("UI"):
		get_node("UI").hide()
	# Cargar escena de juego directamente
	load_game_scene()

# ──────────────────────────────────────────
#  HOST desde editor/ejecutable con ventana
# ──────────────────────────────────────────
func host_game():
	var peer = WebSocketMultiplayerPeer.new()
	var err = peer.create_server(PORT)
	if err != OK:
		print("Error al crear servidor WebSocket: ", err)
		return
	multiplayer.multiplayer_peer = peer
	print("Servidor WebSocket iniciado en puerto ", PORT)
	
	load_game_scene()

# ──────────────────────────────────────────
#  CLIENTE
# ──────────────────────────────────────────
func join_game(ip: String):
	var peer = WebSocketMultiplayerPeer.new()
	var url = "ws://" + ip + ":" + str(PORT)
	var err = peer.create_client(url)
	if err != OK:
		print("Error al conectar: ", err)
		return
	multiplayer.multiplayer_peer = peer
	print("Conectando a ", url)

func _process(_delta):
	if multiplayer.multiplayer_peer != null:
		multiplayer.multiplayer_peer.poll()

# ──────────────────────────────────────────
#  CALLBACKS RED
# ──────────────────────────────────────────
func _on_peer_connected(id: int):
	print("Peer conectado: ", id)

func _on_peer_disconnected(id: int):
	print("Peer desconectado: ", id)
	players.erase(id)
	if has_node("GameScene"):
		get_node("GameScene").remove_player(id)
	if multiplayer.is_server():
		player_left.rpc(id)

func _on_connected_to_server():
	var my_id = multiplayer.get_unique_id()
	print("Conectado. Mi ID: ", my_id)
	# Cargar escena en el cliente
	load_game_scene()
	# Registrarse en el servidor
	await get_tree().create_timer(0.3).timeout
	register_player.rpc_id(1, "Jugador_" + str(my_id))

func _on_connection_failed():
	print("Fallo de conexión")
	if has_node("UI"):
		get_node("UI").on_connection_failed()

# ──────────────────────────────────────────
#  RPCs DE JUGADORES
# ──────────────────────────────────────────
@rpc("any_peer", "reliable")
func register_player(player_name: String):
	var sender_id = multiplayer.get_remote_sender_id()
	players[sender_id] = player_name
	print("Registrado: ", player_name, " ID:", sender_id)

	if multiplayer.is_server():
		# Notificar a todos que llegó este jugador
		player_joined.rpc(sender_id, player_name)
		# Enviar lista de jugadores existentes al nuevo
		await get_tree().create_timer(0.2).timeout
		for id in players:
			if id != sender_id:
				spawn_existing_player.rpc_id(sender_id, id, players[id])

@rpc("authority", "reliable")
func player_joined(id: int, player_name: String):
	players[id] = player_name
	if has_node("GameScene"):
		get_node("GameScene").spawn_player(id)

@rpc("authority", "reliable")
func spawn_existing_player(id: int, player_name: String):
	players[id] = player_name
	if has_node("GameScene"):
		get_node("GameScene").spawn_player(id)

@rpc("authority", "reliable")
func player_left(id: int):
	players.erase(id)
	if has_node("GameScene"):
		get_node("GameScene").remove_player(id)

# ──────────────────────────────────────────
#  CARGAR ESCENA
# ──────────────────────────────────────────
func load_game_scene():
	if has_node("GameScene"):
		return
	if has_node("UI"):
		get_node("UI").hide()
	var game_scene = preload("res://game_scene.tscn").instantiate()
	game_scene.name = "GameScene"
	add_child(game_scene)
	# Solo spawnear si soy cliente (no servidor dedicado)
	if not multiplayer.is_server():
		for id in players:
			game_scene.spawn_player(id)
		var my_id = multiplayer.get_unique_id()
		if not has_node("GameScene/Player_" + str(my_id)):
			game_scene.spawn_player(my_id)
