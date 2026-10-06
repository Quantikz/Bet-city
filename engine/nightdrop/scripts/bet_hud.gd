class_name BetHUD
extends CanvasLayer

var _root: Control
var _start_panel: ColorRect
var _wallet: Label
var _location: Label
var _time: Button
var _prompt: Label
var _banner: Label
var _radar: Radar

func _ready() -> void:
	layer = 10
	_build()
	show_start(true)

func show_start(on: bool) -> void:
	_start_panel.visible = on
	if _root:
		_root.visible = true
	if _radar:
		_radar.visible = not on
	if _wallet:
		_wallet.visible = not on
	if _location:
		_location.visible = not on
	if _time:
		_time.visible = not on

func set_wallet(amount: int) -> void:
	if _wallet:
		_wallet.text = "%s BET" % _format_amount(amount)

func set_location(text: String) -> void:
	if _location:
		_location.text = text

func set_prompt(text: String) -> void:
	if _prompt:
		_prompt.text = text

func set_banner(text: String) -> void:
	if _banner:
		_banner.text = text
		_banner.visible = text != ""

func set_time_of_day(night: bool) -> void:
	if _time:
		_time.text = "NIGHT" if night else "DAY"

func _build() -> void:
	_root = Control.new()
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)

	_radar = Radar.new()
	_radar.position = Vector2(18, 18)
	_radar.custom_minimum_size = Vector2(148, 148)
	_root.add_child(_radar)

	_location = _label(15, Color("d7dbe2"))
	_location.position = Vector2(188, 20)
	_root.add_child(_location)

	_wallet = _label(22, Color("f2c65b"))
	_wallet.position = Vector2(0, 18)
	_wallet.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_wallet.offset_left = -250
	_wallet.offset_right = -24
	_root.add_child(_wallet)

	_time = Button.new()
	_time.text = "DAY"
	_time.focus_mode = Control.FOCUS_NONE
	_time.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_time.offset_left = -138
	_time.offset_top = 58
	_time.offset_right = -24
	_time.offset_bottom = 98
	_style_button(_time)
	_time.pressed.connect(_toggle_time)
	_root.add_child(_time)

	_prompt = _label(15, Color("f0c56a"))
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_prompt.offset_left = -300
	_prompt.offset_top = -72
	_prompt.offset_right = 300
	_prompt.offset_bottom = -42
	_root.add_child(_prompt)

	_banner = _label(34, Color("f2c65b"))
	_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner.set_anchors_preset(Control.PRESET_CENTER)
	_banner.offset_left = -420
	_banner.offset_top = -35
	_banner.offset_right = 420
	_banner.offset_bottom = 35
	_root.add_child(_banner)

	_start_panel = ColorRect.new()
	_start_panel.color = Color(0.025, 0.03, 0.045, 0.9)
	_start_panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_start_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_start_panel)

	var col := VBoxContainer.new()
	col.set_anchors_preset(Control.PRESET_CENTER)
	col.offset_left = -320
	col.offset_top = -180
	col.offset_right = 320
	col.offset_bottom = 180
	col.add_theme_constant_override("separation", 14)
	_start_panel.add_child(col)

	var kicker := _label(14, Color("f2c65b"))
	kicker.text = "CENTRAL DISTRICT  ·  OPEN WORLD"
	kicker.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(kicker)

	var title := _label(64, Color("f4f4f2"))
	title.text = "BET CITY"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(title)

	var subtitle := _label(19, Color("b8bec8"))
	subtitle.text = "Walk the town. Meet players.\nChallenge. Wager. Play."
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(subtitle)

	var start := Button.new()
	start.text = "ENTER BET CITY"
	start.custom_minimum_size = Vector2(0, 58)
	start.focus_mode = Control.FOCUS_NONE
	_style_button(start, true)
	start.pressed.connect(_on_start)
	col.add_child(start)

	var info := _label(13, Color("8e96a3"))
	info.text = "Virtual BET only  ·  Free-roam prototype"
	info.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(info)

func _toggle_time() -> void:
	var clock := get_tree().get_first_node_in_group("day_night") as DayNight
	if clock:
		clock.toggle()
		set_time_of_day(clock.is_night)

func _on_start() -> void:
	var game := get_tree().current_scene
	if game and game.has_method("begin"):
		game.begin()

func _format_amount(value: int) -> String:
	var s := str(value)
	var out := ""
	var count := 0
	for i in range(s.length() - 1, -1, -1):
		out = s[i] + out
		count += 1
		if count == 3 and i > 0:
			out = "," + out
			count = 0
	return out

func _label(size: int, color: Color) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	l.add_theme_constant_override("shadow_offset_x", 1)
	l.add_theme_constant_override("shadow_offset_y", 1)
	return l

func _style_button(b: Button, primary := false) -> void:
	var normal := StyleBoxFlat.new()
	normal.bg_color = Color("f2b544") if primary else Color(0.05, 0.07, 0.1, 0.86)
	normal.border_color = Color("f2b544")
	normal.set_border_width_all(1)
	normal.set_corner_radius_all(12)
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_color_override("font_color", Color("10151c") if primary else Color("f4f4f2"))
	b.add_theme_font_size_override("font_size", 17 if primary else 14)
