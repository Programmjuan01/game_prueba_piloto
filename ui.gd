extends Control

@onready var ip_input: LineEdit = $VBoxContainer/IPInput
@onready var status_label: Label = $VBoxContainer/StatusLabel
@onready var host_button: Button = $VBoxContainer/HostButton
@onready var join_button: Button = $VBoxContainer/JoinButton

func _ready():
	ip_input.text = "192.168.7.3"
	# No hay servidor Godot: todos conectan al relay → ocultar botón Host
	host_button.hide()
	status_label.text = "Ingresa la IP del servidor y une"

# Llamado desde main.gd cuando se detecta OS.get_name() == "Web"
# (ya no necesario, pero se mantiene por compatibilidad)
func set_web_mode():
	host_button.hide()
	status_label.text = "Ingresa la IP del servidor"

func on_connection_failed():
	status_label.text = "No se pudo conectar. Verifica la IP y que el servidor esté activo."
	join_button.disabled = false

func _on_join_button_pressed():
	var ip = ip_input.text.strip_edges()
	if ip.is_empty():
		status_label.text = "Ingresa una IP válida"
		return
	status_label.text = "Conectando a " + ip + "..."
	join_button.disabled = true
	get_node("/root/Main").join_game(ip)
