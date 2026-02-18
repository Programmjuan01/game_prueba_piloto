extends Control

# Rutas a las escenas.
# Asegúrate de cambiar esta ruta por la ruta real de tu escena de juego (ej. nivel_1.tscn)
const ESCENA_JUEGO_PATH = "res://escenas/nivel_1.tscn" 

@onready var boton_jugar: Button = $MarginContainer/VBoxContainer/BotonJugar
@onready var boton_salir: Button = $MarginContainer/VBoxContainer/BotonSalir

func _ready() -> void:
	# Conectamos las señales de "presionado" a nuestras funciones
	boton_jugar.pressed.connect(_on_boton_jugar_pressed)
	boton_salir.pressed.connect(_on_boton_salir_pressed)
	
	# Opcional: Asegurarse de que el ratón sea visible si vienes del juego
	Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)

func _on_boton_jugar_pressed() -> void:
	print("Iniciando Racing Race...")
	# Verificamos si la escena existe antes de intentar cargarla para evitar crasheos
	if ResourceLoader.exists(ESCENA_JUEGO_PATH):
		get_tree().change_scene_to_file(ESCENA_JUEGO_PATH)
	else:
		printerr("Error: No se encuentra la escena del juego en: ", ESCENA_JUEGO_PATH)

func _on_boton_salir_pressed() -> void:
	print("Saliendo del juego.")
	# Cierra la aplicación
	get_tree().quit()
