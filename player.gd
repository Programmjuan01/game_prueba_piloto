extends CharacterBody2D

const SPEED = 200.0
const INTERP_SPEED = 14.0  # Velocidad de interpolación suave

var player_id: int = 0

var _net_position: Vector2 = Vector2.ZERO
var _net_velocity: Vector2 = Vector2.ZERO

@onready var label: Label = $Label
@onready var sprite: ColorRect = $ColorRect

func _ready():
	_net_position = global_position

func setup(id: int):
	player_id = id
	set_multiplayer_authority(id)
	_net_position = global_position

	if multiplayer.get_unique_id() == id:
		sprite.color = Color(0.11, 0.53, 0.98, 1)   # Azul – jugador local
		label.text = "TÚ  (ID:%d)" % id
	else:
		sprite.color = Color(0.95, 0.26, 0.21, 1)   # Rojo – jugador remoto
		label.text = "ID:%d" % id

# ──────────────────────────────────────────
#  SYNC VÍA RPC (más fiable que MultiplayerSynchronizer en relay)
# ──────────────────────────────────────────
@rpc("any_peer", "unreliable_ordered")
func sync_state(pos: Vector2, vel: Vector2):
	# Solo aplicar si somos el receptor (no la autoridad de este personaje)
	if not is_multiplayer_authority():
		_net_position = pos
		_net_velocity = vel

func _physics_process(delta: float):
	if not is_multiplayer_authority():
		# 1) Extrapolación: predecir posición usando la última velocidad recibida
		_net_position += _net_velocity * delta
		# 2) Interpolación suave hacia la posición extrapolada
		global_position = global_position.lerp(_net_position, min(INTERP_SPEED * delta, 1.0))
		return

	# Jugador local: leer input
	var direction = Vector2.ZERO
	if Input.is_action_pressed("ui_right"): direction.x += 1
	if Input.is_action_pressed("ui_left"):  direction.x -= 1
	if Input.is_action_pressed("ui_down"):  direction.y += 1
	if Input.is_action_pressed("ui_up"):    direction.y -= 1

	velocity = direction.normalized() * SPEED if direction != Vector2.ZERO else Vector2.ZERO
	move_and_slide()

	_net_position = global_position
	_net_velocity = velocity

	# Enviar estado a todos los peers en cada physics frame (~60 Hz)
	sync_state.rpc(global_position, velocity)
