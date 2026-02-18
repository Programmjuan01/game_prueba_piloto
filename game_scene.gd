extends Node2D

const SPAWN_POSITIONS = [
	Vector2(150, 300),
	Vector2(650, 300),
	Vector2(150, 450),
	Vector2(650, 450),
	Vector2(400, 150),
	Vector2(400, 500),
	Vector2(200, 200),
	Vector2(600, 200),
]

var spawn_index = 0

func spawn_player(id: int):
	if has_node("Player_" + str(id)):
		return

	var PlayerScene = load("res://player.tscn")
	if PlayerScene == null:
		push_error("No se pudo cargar player.tscn")
		return

	var player = PlayerScene.instantiate()
	player.name = "Player_" + str(id)
	player.position = SPAWN_POSITIONS[spawn_index % SPAWN_POSITIONS.size()]
	spawn_index += 1
	add_child(player)
	player.setup(id)
	print("Spawneado Player_", id, " en ", player.position)

func remove_player(id: int):
	var node = get_node_or_null("Player_" + str(id))
	if node:
		node.queue_free()
		print("Eliminado Player_", id)
