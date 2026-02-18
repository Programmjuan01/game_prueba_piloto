extends Control

@onready var ip_input: LineEdit = $VBoxContainer/IPInput
@onready var status_label: Label = $VBoxContainer/StatusLabel
@onready var host_button: Button = $VBoxContainer/HostButton
@onready var join_button: Button = $VBoxContainer/JoinButton

func _ready():
	ip_input.text = "127.0.0.1"

func set_web_mode():
	host_button.hide()
	status_label.text = "Ingresa la IP del servidor"

func on_connection_failed():
	status_label.text = "No se pudo conectar. Verifica la IP."
	join_button.disabled = false

func _on_host_button_pressed():
	status_label.text = "Iniciando servidor..."
	host_button.disabled = true
	join_button.disabled = true
	get_node("/root/Main").host_game()

func _on_join_button_pressed():
	var ip = ip_input.text.strip_edges()
	if ip.is_empty():
		status_label.text = "Ingresa una IP válida"
		return
	status_label.text = "Conectando..."
	join_button.disabled = true
	get_node("/root/Main").join_game(ip)
