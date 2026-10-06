class_name BetTouchControls
extends TouchControls

func _ready() -> void:
	super._ready()
	_hide_punch()

func set_driving(on: bool) -> void:
	super.set_driving(on)
	_hide_punch()

func _hide_punch() -> void:
	for node in get_children():
		_hide_buttons_recursive(node)

func _hide_buttons_recursive(node: Node) -> void:
	if node is Button:
		var b := node as Button
		if b.text == "PUNCH" or b.text == "E-BRAKE":
			b.visible = false
	for child in node.get_children():
		_hide_buttons_recursive(child)
