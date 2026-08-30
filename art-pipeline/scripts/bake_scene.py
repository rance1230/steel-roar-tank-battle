# Bake industrial test scene: ground sheet + per-prop sprites with baked shadows
# Output: art-pipeline/renders/scene/ground.png, prop_<name>.png, scene_meta.json
import bpy, math, os, json
from mathutils import Vector

SCENE_BLEND = "/Volumes/vol1/像素小游戏/art-pipeline/assets/environment/oga_industrial_baked/OGA_industrial_a52_version_baked_models/industrial_final_cycles_baked.blend"
OUT = "/Volumes/vol1/像素小游戏/art-pipeline/renders/scene"
MATS = "/Volumes/vol1/像素小游戏/art-pipeline/assets/materials"
HDRI = "/Volumes/vol1/像素小游戏/art-pipeline/assets/hdri/factory_yard_2k.hdr"
RES_X, RES_Y, ELEV, SAMPLES = 960, 540, 55.0, 40
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.open_mainfile(filepath=SCENE_BLEND)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices: d.use = True
    scene.cycles.device = 'GPU'
except Exception:
    scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = RES_X
scene.render.resolution_y = RES_Y
scene.render.resolution_percentage = 100   # 旧场景文件可能是50%
scene.view_settings.view_transform = 'Standard'

props = [o for o in bpy.data.objects if o.type == 'MESH']
print('PROPS:', len(props))
# scene bounds
allmn, allmx = Vector((1e9,)*3), Vector((-1e9,)*3)
for o in props:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        allmn = Vector(map(min, allmn, w)); allmx = Vector(map(max, allmx, w))
print('SCENE bounds', [round(v,1) for v in allmn], [round(v,1) for v in allmx])
cx, cy = (allmn.x+allmx.x)/2, (allmn.y+allmx.y)/2

# --- ground plane with Poly Haven PBR ---
gsize = max(allmx.x-allmn.x, allmx.y-allmn.y) * 1.6 + 60
gm = bpy.data.meshes.new('ground')
gm.from_pydata([(-gsize,-gsize,0),(gsize,-gsize,0),(gsize,gsize,0),(-gsize,gsize,0)], [], [(0,1,2,3)])
ground = bpy.data.objects.new('GROUND', gm)
scene.collection.objects.link(ground)

def img(path):
    return bpy.data.images.load(path) if os.path.exists(path) else None

gid = 'concrete_floor_damaged_01'
gmat = bpy.data.materials.new('groundPBR'); gmat.use_nodes = True
nt = gmat.node_tree; bsdf = nt.nodes['Principled BSDF']
d = img(f'{MATS}/{gid}/{gid}_diff_2k.jpg')
n = img(f'{MATS}/{gid}/{gid}_nor_gl_2k.jpg')
r = img(f'{MATS}/{gid}/{gid}_arm_2k.jpg')
texmap = {'diffuse':(d,'Base Color'), 'normal':(n,None)}
tdict = {}
for key, (im, inp) in texmap.items():
    if not im: continue
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = im
    mp = nt.nodes.new('ShaderNodeMapping'); co = nt.nodes.new('ShaderNodeTexCoord')
    mp.inputs['Scale'].default_value = (0.06, 0.06, 0.06)
    nt.links.new(co.outputs['Object'], mp.inputs['Vector'])   # plane has no UVs — use object coords
    nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
    if inp:
        nt.links.new(t.outputs['Color'], bsdf.inputs[inp])
    tdict[key] = t
if 'normal' in tdict:
    nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.8
    nt.links.new(tdict['normal'].outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
if r:
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = r
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(t.outputs['Color'], sep.inputs[0])
    nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
bsdf.inputs['Metallic'].default_value = 0.0
ground.data.materials.append(gmat)

# --- world: HDRI + sun ---
w = scene.world or bpy.data.worlds.new('W'); scene.world = w
w.use_nodes = True; wn = w.node_tree; wn.nodes.clear()
wout = wn.nodes.new('ShaderNodeOutputWorld'); bg = wn.nodes.new('ShaderNodeBackground')
env = wn.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(HDRI)
wn.links.new(env.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 0.4
wn.links.new(bg.outputs[0], wout.inputs['Surface'])
sun = bpy.data.objects.new('SUN', bpy.data.lights.new('SUN', 'SUN'))
sun.data.energy = 1.6; sun.data.angle = math.radians(6); sun.data.color = (1.0, 0.95, 0.87)
sun.rotation_euler = (math.radians(38), 0, math.radians(142))
scene.collection.objects.link(sun)

# --- camera: fixed ortho over play area ---
cam = bpy.data.objects.new('CAM', bpy.data.cameras.new('CAM'))
cam.data.type = 'ORTHO'
cam.data.clip_start = 0.1; cam.data.clip_end = 800
# 取景: 北排储罐/中排烟囱/南排车库集装箱之间的开阔走廊
CLUSTER = ('garage', 'tank_2', 'container', 'big_tank', 'smokestack', 'tower_2')
centers = []
for o in props:
    nm = o.name.strip()
    if any(nm.startswith(c) for c in CLUSTER):
        bbp = [o.matrix_world @ Vector(c) for c in o.bound_box]
        centers.append(Vector(((bbp[0].x+bbp[7].x)/2, (bbp[0].y+bbp[7].y)/2, 0)))
corridor = Vector((5, 5, 0))
ct = corridor
cam.data.ortho_scale = 55.0
th = math.radians(90 - ELEV)
fwd = Vector((0, math.sin(th), -math.cos(th)))
target = Vector((ct.x, ct.y, 3.0))
cam.location = target - fwd * 200
cam.rotation_euler = (math.radians(90 - ELEV), 0, 0)
scene.collection.objects.link(cam)
scene.camera = cam
print('CAM target', [round(v,1) for v in ct], 'scale', cam.data.ortho_scale)

# --- shadow catcher for per-prop shadow baking ---
pm = bpy.data.meshes.new('catcher')
pm.from_pydata([(-gsize,-gsize,-0.02),(gsize,-gsize,-0.02),(gsize,gsize,-0.02),(-gsize,gsize,-0.02)], [], [(0,1,2,3)])
catcher = bpy.data.objects.new('CATCHER', pm)
scene.collection.objects.link(catcher)
catcher.is_shadow_catcher = True

def render_to(path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('SAVED', path)

def solo(objs, with_ground=True, with_shadow=True):
    for o in props: o.hide_render = True
    ground.hide_render = not with_ground
    catcher.hide_render = not with_shadow
    sun.hide_render = False
    for o in objs: o.hide_render = False

# 1) ground only
solo([], True, False)
render_to(f'{OUT}/ground.png')
# 2) per-prop with its own shadow
meta = {"ground": {"img": "ground.png"}, "props": [], "ortho_scale": cam.data.ortho_scale,
        "elev": ELEV, "res": [RES_X, RES_Y]}
for o in props:
    solo([o], False, True)
    nm = o.name.strip().replace(' ', '_')
    render_to(f'{OUT}/prop_{nm}.png')
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    meta["props"].append({"name": nm, "img": f"prop_{nm}.png",
        "base": [round((bb[0].x+bb[7].x)/2 - ct.x, 2), round((bb[0].y+bb[7].y)/2 - ct.y, 2)],
        "zmax": round(max(v.z for v in bb), 2)})
with open(f'{OUT}/scene_meta.json', 'w') as f:
    json.dump(meta, f, indent=1)
print('SCENE BAKE DONE, props:', len(props))
