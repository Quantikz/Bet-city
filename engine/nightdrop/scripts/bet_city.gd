extends Node3D

enum Phase { TITLE, FREE }

var phase: Phase = Phase.TITLE
var bet_balance := 10000

var city: City
var clock: DayNight
var player: Player
var camera: CameraRig
var hud: BetHUD
var touch: BetTouchControls
var roads: RoadGraph
var active_vehicle: Vehicle
var traffic: Array[Vehicle] = []

func _ready() -> void:
	randomize()

	city = City.new()
	add_child(city)
	city.build()
	roads = city.make_graph()

	clock = DayNight.new()
	add_child(clock)
	clock.bind(city)

	camera = CameraRig.new()
	camera.add_to_group("camera_rig")
	add_child(camera)

	hud = BetHUD.new()
	add_child(hud)

	touch = BetTouchControls.new()
	touch.visible = false
	add_child(touch)

	player = Player.new()
	add_child(player)
	player.global_position = city.player_spawn
	player.locked = true
	camera.follow = player

	_spawn_traffic()
	_spawn_pedestrians()
	_add_lucky_shop_marker()

	clock.apply(false)
	hud.set_time_of_day(false)
	hud.set_wallet(bet_balance)
	hud.set_location("CENTRAL DISTRICT")

func begin() -> void:
	if phase != Phase.TITLE:
		return
	phase = Phase.FREE
	player.locked = false
	touch.visible = DisplayServer.is_touchscreen_available()
	hud.show_start(false)
	_sync_hud()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode == KEY_N:
		clock.toggle()
		hud.set_time_of_day(clock.is_night)

	if phase == Phase.TITLE:
		if event is InputEventKey and event.pressed and event.keycode == KEY_SPACE:
			begin()
		return

	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		camera.add_look(event.relative)

	if event is InputEventMouseButton and event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		if not DisplayServer.is_touchscreen_available():
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

	if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

	if event is InputEventKey and event.pressed and event.keycode == KEY_E:
		_interact()

func _process(_delta: float) -> void:
	if phase == Phase.TITLE:
		return

	var look := touch.consume_look()
	if look != Vector2.ZERO:
		camera.add_look(look, true)

	if touch.consume_interact():
		_interact()

	_sync_hud()

func _interact() -> void:
	if player.locked:
		return

	if active_vehicle:
		_exit_vehicle()
		return

	var nearest := _nearest_vehicle()
	if nearest:
		_enter_vehicle(nearest)
		return

	var d := player.global_position.distance_to(city.bar_pos)
	if d < 7.0:
		hud.set_banner("LUCKY SHOP  ·  BET ZONE")
		get_tree().create_timer(1.5).timeout.connect(func() -> void:
			if is_instance_valid(hud):
				hud.set_banner("")
		)

func _nearest_vehicle() -> Vehicle:
	var best: Vehicle = null
	var best_d := 4.8
	for node in get_tree().get_nodes_in_group("vehicles"):
		var v := node as Vehicle
		if v == null or v.occupied or v.wrecked:
			continue
		var d := player.global_position.distance_to(v.global_position)
		if d < best_d:
			best_d = d
			best = v
	return best

func _enter_vehicle(v: Vehicle) -> void:
	active_vehicle = v
	var driver := v.eject_driver()
	if driver:
		driver.scare(v.global_position)

	v.occupied = true
	v.ai_enabled = false
	v.fleeing = false
	player.in_vehicle = true
	player.set_hidden(true)
	camera.follow = v
	camera.set_vehicle_mode(true)
	touch.set_driving(true)
	hud.set_prompt("Drive freely  ·  E to exit")

func _exit_vehicle() -> void:
	if active_vehicle == null:
		return
	if abs(active_vehicle.speed) > 6.0:
		hud.set_prompt("Slow down to exit")
		return

	var v := active_vehicle
	player.global_position = v.global_position + v.global_transform.basis.x * 1.8 + Vector3(0, 0.1, 0)
	player.rotation.y = v.rotation.y
	v.occupied = false
	if v.kind == Vehicle.Kind.CIVILIAN:
		v.ai_enabled = true

	player.in_vehicle = false
	player.set_hidden(false)
	active_vehicle = null
	camera.follow = player
	camera.set_vehicle_mode(false)
	touch.set_driving(false)
	hud.set_prompt("Walk around town  ·  E to enter vehicles")

func _spawn_traffic() -> void:
	for spec in city.traffic_spawns:
		var v := Vehicle.new()
		v.kind = Vehicle.Kind.CIVILIAN
		add_child(v)
		v.setup(Vehicle.Kind.CIVILIAN, spec["pos"], spec["yaw"])
		v.patrol = city.patrol
		v.patrol_i = traffic.size() % maxi(city.patrol.size(), 1)
		v.bind_graph(roads)
		traffic.append(v)

	for spec in city.parked_spawns:
		var v := Vehicle.new()
		v.kind = Vehicle.Kind.PARKED
		add_child(v)
		v.setup(Vehicle.Kind.PARKED, spec["pos"], spec["yaw"])
		v.bind_graph(roads)

func _spawn_pedestrians() -> void:
	const PEDS_PER_PATH := 5
	for raw in city.sidewalk_paths:
		var typed: Array[Vector3] = []
		for p in raw:
			typed.append(p)
		for n in PEDS_PER_PATH:
			var ped := Pedestrian.new()
			add_child(ped)
			ped.setup(typed, n, PEDS_PER_PATH)

func _add_lucky_shop_marker() -> void:
	# Phase 1 rebrands an existing storefront as Lucky Shop.
	# The full interior and Darts Duel are added in the next phase.
	var pos := city.bar_pos + Vector3(0, 4.9, 4.2)
	var board := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(8.5, 1.25, 0.12)
	board.mesh = box
	board.position = pos
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color("10151c")
	mat.emission_enabled = true
	mat.emission = Color("f2b544")
	mat.emission_energy_multiplier = 2.5
	board.material_override = mat
	add_child(board)

func _sync_hud() -> void:
	if hud == null or player == null:
		return
	hud.set_wallet(bet_balance)
	if active_vehicle:
		hud.set_location("CENTRAL DISTRICT  ·  DRIVING")
	else:
		hud.set_location("CENTRAL DISTRICT")
