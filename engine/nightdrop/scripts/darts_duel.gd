class_name DartsDuel
extends CanvasLayer

signal finished(result: String, payout: int)

const STAKE := 1000
const START_SCORE := 301
const DARTS := 3

var active := false
var player_score := START_SCORE
var opponent_score := START_SCORE
var darts_left := DARTS
var _root: Control
var _board: DartsBoard
var _score: Label
var _status: Label
var _wallet: Label
var _throw: Button

func _ready() -> void:
	layer = 40
	_build()
	_root.visible = false

func open(wallet: int) -> bool:
	if wallet < STAKE:
		return false
	player_score = START_SCORE
	opponent_score = START_SCORE
	darts_left = DARTS
	active = true
	_wallet.text = "%s BET" % _money(wallet)
	_score.text = "301  —  301"
	_status.text = "YOUR TURN  ·  TAP THE BOARD"
	_throw.disabled = false
	_board.reset()
	_root.visible = true
	return true

func hide_game() -> void:
	active = false
	if _root:
		_root.visible = false

func _build() -> void:
	_root = Control.new()
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_root)

	var bg := ColorRect.new()
	bg.color = Color(0.012,0.016,0.024,0.96)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.add_child(bg)

	var title := _label(38, Color("f4f4f2"))
	title.text = "DARTS DUEL"
	title.set_anchors_preset(Control.PRESET_TOP_WIDE)
	title.offset_top = 24
	title.offset_bottom = 70
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_root.add_child(title)

	_wallet = _label(20, Color("f2c65b"))
	_wallet.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_wallet.offset_left = -250
	_wallet.offset_top = 24
	_wallet.offset_right = -24
	_wallet.offset_bottom = 56
	_wallet.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_root.add_child(_wallet)

	var stake := _label(14, Color("8f98a6"))
	stake.text = "LUCKY SHOP  ·  STAKE 1,000 BET  ·  WIN 1,900"
	stake.set_anchors_preset(Control.PRESET_TOP_WIDE)
	stake.offset_top = 70
	stake.offset_bottom = 96
	stake.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_root.add_child(stake)

	_score = _label(24, Color("f4f4f2"))
	_score.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_score.offset_top = 108
	_score.offset_bottom = 145
	_score.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_root.add_child(_score)

	_board = DartsBoard.new()
	_board.set_anchors_preset(Control.PRESET_CENTER)
	_board.offset_left = -245
	_board.offset_top = -190
	_board.offset_right = 245
	_board.offset_bottom = 300
	_board.throw_requested.connect(_throw_at)
	_root.add_child(_board)

	_status = _label(16, Color("f2c65b"))
	_status.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_status.offset_left = -360
	_status.offset_top = -132
	_status.offset_right = 360
	_status.offset_bottom = -100
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_root.add_child(_status)

	_throw = _button("THROW DART")
	_throw.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_throw.offset_left = -135
	_throw.offset_top = -88
	_throw.offset_right = 135
	_throw.offset_bottom = -34
	_throw.pressed.connect(func() -> void: _throw_at(_board.size * 0.5))
	_root.add_child(_throw)

	var leave := _button("LEAVE")
	leave.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	leave.offset_left = -145
	leave.offset_top = -70
	leave.offset_right = -24
	leave.offset_bottom = -24
	leave.pressed.connect(func() -> void:
		finished.emit("LEAVE", 0)
		hide_game()
	)
	_root.add_child(leave)

func _throw_at(pos: Vector2) -> void:
	if not active or darts_left <= 0:
		return
	var points := _score_at(pos)
	player_score = maxi(0, player_score - points)
	darts_left -= 1
	_board.show_hit(pos, points)
	_score.text = "%d  —  %d" % [player_score, opponent_score]

	if player_score == 0:
		_finish("WIN")
		return

	if darts_left == 0:
		darts_left = DARTS
		_throw.disabled = true
		_status.text = "OPPONENT TURN"
		await get_tree().create_timer(0.45).timeout
		_opponent_turn()
	else:
		_status.text = "YOUR TURN  ·  %d DART%s LEFT  ·  +%d" % [darts_left, "" if darts_left == 1 else "S", points]

func _opponent_turn() -> void:
	var total := 0
	for i in DARTS:
		var points := randi_range(18, 62)
		total += points
		opponent_score = maxi(0, opponent_score - points)
		_score.text = "%d  —  %d" % [player_score, opponent_score]
		await get_tree().create_timer(0.25).timeout
		if opponent_score == 0:
			_finish("LOSS")
			return
	_throw.disabled = false
	_status.text = "YOUR TURN  ·  OPPONENT SCORED %d" % total

func _score_at(pos: Vector2) -> int:
	var c := _board.size * 0.5
	var r := minf(_board.size.x, _board.size.y) * 0.43
	var d := pos.distance_to(c) / r
	if d > 1.0:
		return 0
	if d < 0.09:
		return 50
	if d < 0.17:
		return 25
	var values := [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5]
	var sector := int((atan2(pos.y-c.y,pos.x-c.x)+PI)/TAU*20.0) % 20
	var base := values[sector]
	return base * 3 if d < 0.49 else base

func _finish(result: String) -> void:
	active = false
	_throw.disabled = true
	if result == "WIN":
		_status.text = "YOU WIN  ·  +1,900 BET"
		finished.emit("WIN", 1900)
	else:
		_status.text = "YOU LOSE  ·  -1,000 BET"
		finished.emit("LOSS", 0)

func _money(v: int) -> String:
	var s := str(v)
	var out := ""
	var n := 0
	for i in range(s.length()-1,-1,-1):
		out = s[i] + out
		n += 1
		if n == 3 and i > 0:
			out = "," + out
			n = 0
	return out

func _label(size: int, color: Color) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l

func _button(text: String) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color("f2b544")
	sb.set_corner_radius_all(12)
	b.add_theme_stylebox_override("normal", sb)
	b.add_theme_color_override("font_color", Color("10151c"))
	b.add_theme_font_size_override("font_size", 15)
	return b

class DartsBoard extends Control:
	signal throw_requested(position: Vector2)
	var _hit := Vector2(-1000,-1000)
	var _hit_score := -1

	func _ready() -> void:
		mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		queue_redraw()

	func reset() -> void:
		_hit = Vector2(-1000,-1000)
		_hit_score = -1
		queue_redraw()

	func show_hit(pos: Vector2, score: int) -> void:
		_hit = pos
		_hit_score = score
		queue_redraw()

	func _gui_input(event: InputEvent) -> void:
		if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			throw_requested.emit(event.position)
		elif event is InputEventScreenTouch and event.pressed:
			throw_requested.emit(event.position)

	func _draw() -> void:
		var c := size * 0.5
		var r := minf(size.x,size.y) * 0.43
		draw_circle(c,r+18,Color("101318"))
		draw_circle(c,r,Color("e8e0d0"))
		var colors := [Color("17191d"),Color("f0ede4")]
		for i in 20:
			var a0 := -PI*0.5+float(i)*TAU/20.0
			var a1 := -PI*0.5+float(i+1)*TAU/20.0
			draw_colored_polygon(PackedVector2Array([c,c+Vector2(cos(a0),sin(a0))*r,c+Vector2(cos(a1),sin(a1))*r]),colors[i%2])
		for rr in [r*0.72,r*0.49,r*0.17,r*0.09]:
			draw_arc(c,rr,0,TAU,96,Color("d0c8b8"),3)
		draw_arc(c,r,0,TAU,96,Color("090b0d"),4)
		draw_circle(c,r*0.17,Color("2b6f5a"))
		draw_circle(c,r*0.09,Color("d19a34"))
		if _hit.x > -100:
			draw_circle(_hit,14,Color("f2b544"),false,3)
			draw_string(ThemeDB.fallback_font,_hit+Vector2(18,6),str(_hit_score),HORIZONTAL_ALIGNMENT_LEFT,-1,18,Color("f2c65b"))
