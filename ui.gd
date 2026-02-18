extends Control

# Rutas actualizadas para la nueva jerarquía:
# UI → CenterContainer → Panel → VBoxContainer → ...
@onready var ip_input:     LineEdit = $CenterContainer/Panel/VBoxContainer/IPInput
@onready var status_label: Label    = $CenterContainer/Panel/VBoxContainer/StatusLabel
@onready var join_button:  Button   = $CenterContainer/Panel/VBoxContainer/JoinButton

func _ready():
	ip_input.text = "192.168.7.3"
	status_label.text = "Ingresa la IP del servidor y pulsa Unirse"

func on_connection_failed():
	status_label.text = "No se pudo conectar. Verifica la IP y que el servidor este activo."
	status_label.add_theme_color_override("font_color", Color(0.95, 0.35, 0.35, 1))
	join_button.disabled = false

func _on_join_button_pressed():
	var ip = ip_input.text.strip_edges()
	if ip.is_empty():
		status_label.text = "Ingresa una IP valida"
		return
	status_label.text = "Conectando a " + ip + "..."
	status_label.add_theme_color_override("font_color", Color(0.38, 0.84, 0.44, 1))
	join_button.disabled = true
	get_node("/root/Main").join_game(ip)
