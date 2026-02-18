extends Node

# El relay Node.js (server.js) actúa como peer 1.
# Todos los jugadores son clientes. No se necesita servidor Godot headless.
const PORT = 8080

var is_connected := false

func _ready():
	multiplayer.peer_connected.connect(_on_peer_connected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	multiplayer.connected_to_server.connect(_on_connected_to_server)
	multiplayer.connection_failed.connect(_on_connection_failed)

# ──────────────────────────────────────────
#  CONEXIÓN (todos son clientes del relay)
# ──────────────────────────────────────────
func join_game(ip: String):
	var peer = WebSocketMultiplayerPeer.new()
	# wss:// obligatorio desde páginas HTTPS para evitar mixed-content block
	var url = "wss://" + ip + ":" + str(PORT)
	var err = peer.create_client(url)
	if err != OK:
		print("Error al conectar: ", err)
		if has_node("UI"):
			get_node("UI").on_connection_failed()
		return
	multiplayer.multiplayer_peer = peer
	print("Conectando a ", url)

func _process(_delta):
	if multiplayer.multiplayer_peer != null:
		multiplayer.multiplayer_peer.poll()

# ──────────────────────────────────────────
#  CALLBACKS DE RED
# ──────────────────────────────────────────
func _on_connected_to_server():
	var my_id = multiplayer.get_unique_id()
	print("Conectado al relay. Mi ID: ", my_id)
	is_connected = true
	load_game_scene()
	# Spawnear el jugador propio
	if has_node("GameScene"):
		get_node("GameScene").spawn_player(my_id)

func _on_peer_connected(id: int):
	# El relay notificó que otro jugador se conectó → spawnearlo
	print("Peer conectado: ", id)
	if has_node("GameScene"):
		get_node("GameScene").spawn_player(id)

func _on_peer_disconnected(id: int):
	# El relay notificó que un jugador se fue → eliminarlo
	print("Peer desconectado: ", id)
	if has_node("GameScene"):
		get_node("GameScene").remove_player(id)

func _on_connection_failed():
	print("Fallo de conexión")
	if has_node("UI"):
		get_node("UI").on_connection_failed()

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
