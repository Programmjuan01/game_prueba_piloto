extends CharacterBody2D

const SPEED = 200.0
const INTERP_SPEED = 12.0  # Velocidad de interpolación de posición remota

var player_id: int = 0

# Variables sincronizadas por MultiplayerSynchronizer
# (NO sincronizar position directamente para poder interpolar)
var _net_position: Vector2 = Vector2.ZERO
var _net_velocity: Vector2 = Vector2.ZERO

@onready var label: Label = $Label
@onready var sprite: ColorRect = $ColorRect
@onready var sync: MultiplayerSynchronizer = $MultiplayerSynchronizer

func _ready():
	_net_position = global_position

func setup(id: int):
	player_id = id
	set_multiplayer_authority(id)
	_net_position = global_position

	if multiplayer.get_unique_id() == id:
		sprite.color = Color.DODGER_BLUE
		label.text = "Tú (ID:%d)" % id
		sync.set_multiplayer_authority(id)
	else:
		sprite.color = Color.TOMATO
		label.text = "ID:%d" % id

	# Sincronizar cada physics frame para máxima fluidez
	sync.replication_interval = 0.0

func _physics_process(delta: float):
	if not is_multiplayer_authority():
		# Jugador remoto:
		# 1) Extrapolar la posición de red usando la velocidad recibida
		_net_position += _net_velocity * delta
		# 2) Interpolación suave hacia la posición extrapolada (corrige drift)
		global_position = global_position.lerp(_net_position, min(INTERP_SPEED * delta, 1.0))
		return

	# Jugador local: leer input y mover
	var direction = Vector2.ZERO
	if Input.is_action_pressed("ui_right"): direction.x += 1
	if Input.is_action_pressed("ui_left"):  direction.x -= 1
	if Input.is_action_pressed("ui_down"):  direction.y += 1
	if Input.is_action_pressed("ui_up"):    direction.y -= 1

	velocity = direction.normalized() * SPEED if direction != Vector2.ZERO else Vector2.ZERO
	move_and_slide()

	# Actualizar variables de red para que el Synchronizer las envíe
	_net_position = global_position
	_net_velocity = velocity
