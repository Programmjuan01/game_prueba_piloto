extends CharacterBody2D

const SPEED = 200.0
var player_id: int = 0

@onready var label: Label = $Label
@onready var sprite: ColorRect = $ColorRect
@onready var sync: MultiplayerSynchronizer = $MultiplayerSynchronizer

func _ready():
	pass

func setup(id: int):
	player_id = id
	# Autoridad: el dueño del personaje es quien lo mueve
	set_multiplayer_authority(id)
	
	var my_id = multiplayer.get_unique_id()
	if my_id == id:
		sprite.color = Color.DODGER_BLUE
		label.text = "Tú (ID:%d)" % id
		# Solo el dueño sincroniza hacia afuera
		sync.set_multiplayer_authority(id)
	else:
		sprite.color = Color.TOMATO
		label.text = "ID:%d" % id

func _physics_process(_delta: float):
	# Solo procesar input si este personaje me pertenece
	if multiplayer.get_unique_id() != player_id:
		move_and_slide()
		return

	var direction = Vector2.ZERO
	if Input.is_action_pressed("ui_right"): direction.x += 1
	if Input.is_action_pressed("ui_left"):  direction.x -= 1
	if Input.is_action_pressed("ui_down"):  direction.y += 1
	if Input.is_action_pressed("ui_up"):    direction.y -= 1

	velocity = direction.normalized() * SPEED if direction != Vector2.ZERO else Vector2.ZERO
	move_and_slide()
