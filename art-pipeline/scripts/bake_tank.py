# Bake IRONCLAD player tank: 16-direction prerendered sprite layers (Blender 5.x)
# 7 passes x 16 frames: hull/tur x {diffuse PNG, normal EXR->PNG, emissive EXR->PNG} + shadow PNG
# Output: art-pipeline/renders/IRONCLAD/{hull,tur}_{diff,norm,emis}_###.png + shadow_###.png
import bpy, math, os
import numpy as np
from mathutils import Vector

SRC = "/Volumes/vol1/像素小游戏/art-pipeline/assets/units/Tank Pack - June 2019/Blends/Tank.blend"
OUT = "/Volumes/vol1/像素小游戏/art-pipeline/renders/IRONCLAD"
HDRI = "/Volumes/vol1/像素小游戏/art-pipeline/assets/hdri/industrial_sunset_02_puresky_2k.hdr"
FRAMES, RES, ELEV = 16, 160, 55.0
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)   # 干净场景: 旧2.7x文件的场景残留(曲线映射等)会导致全屏过曝
scene = bpy.context.scene
with bpy.data.libraries.load(SRC, link=False) as (data_from, data_to):
    keep = [n for n in data_from.objects if n in ('Tank_body', 'Tank_Gun', 'TrackMesh.L', 'TrackMesh.R')]
    data_to.objects = keep
imported = list(bpy.data.objects)
for o in imported: scene.collection.objects.link(o)
for o in list(imported):
    if o.type == 'ARMATURE': bpy.data.objects.remove(o, do_unlink=True)
imported = [o for o in bpy.data.objects if o.type == 'MESH']
print('IMPORTED:', [o.name for o in imported])
bpy.ops.object.select_all(action='DESELECT')
for o in imported:
    o.select_set(True)
    for m in list(o.modifiers): o.modifiers.remove(m)   # 骨骼修改器随骨架丢弃, 保留静置姿态
bpy.context.view_layer.objects.active = imported[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
vl = scene.view_layers[0]
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'   # Metal GPU 在大量连续小渲染时会静默崩溃, CPU 稳定
print('DEVICE: CPU')
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = RES
scene.render.resolution_y = RES
scene.view_settings.view_transform = 'AgX'
try:
    scene.view_settings.look = 'Punchy'
except Exception:
    pass
scene.frame_start = 1
scene.frame_end = FRAMES
QUICK = os.environ.get('QUICK') == '1'
if QUICK:
    scene.frame_end = 1

def png_cfg():
    ims = scene.render.image_settings
    ims.file_format = 'PNG'; ims.color_mode = 'RGBA'; ims.color_depth = '8'; ims.compression = 15
def exr_cfg():
    ims = scene.render.image_settings
    ims.file_format = 'OPEN_EXR'; ims.color_mode = 'RGBA'; ims.color_depth = '16'
    ims.exr_codec = 'ZIP'

# ---- clean rig/animation ----
for o in list(bpy.data.objects):
    if o.type == 'ARMATURE':
        bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)
for o in bpy.data.objects:
    o.animation_data_clear()

def only(*names):
    bpy.ops.object.select_all(action='DESELECT')
    for n in names: bpy.data.objects[n].select_set(True)
    bpy.context.view_layer.objects.active = bpy.data.objects[names[0]]

only('Tank_body', 'TrackMesh.L', 'TrackMesh.R')
bpy.ops.object.join()
hull = bpy.context.active_object; hull.name = 'HULL'
only('HULL'); bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
turret = bpy.data.objects['Tank_Gun']
only('Tank_Gun'); bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

def bbox(o):
    ws = [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = Vector((min(v.x for v in ws), min(v.y for v in ws), min(v.z for v in ws)))
    mx = Vector((max(v.x for v in ws), max(v.y for v in ws), max(v.z for v in ws)))
    return mn, mx

hb0, hb1 = bbox(hull)
tb0, tb1 = bbox(turret)
print('HULL bbox', [round(v,2) for v in hb0], [round(v,2) for v in hb1])
pivot_t = Vector(((tb0.x+tb1.x)/2, (tb0.y+tb1.y)/2, 0))

# ---- art-directed PBR materials (IRONCLAD steel/cyan identity) ----
def pbr(name, col, metal, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1.0)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    return m

def emis(name, col, strength):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*col, 1.0)
    e.inputs['Strength'].default_value = strength
    nt.links.new(e.outputs[0], out.inputs['Surface'])
    return m

m_steel = pbr('steel',  (0x5f/255,0x71/255,0x86/255), 0.75, 0.42)
m_steel2= pbr('steel2', (0x4a/255,0x59/255,0x6a/255), 0.70, 0.50)
m_lite  = pbr('lite',   (0x9f/255,0xb1/255,0xc5/255), 0.65, 0.36)
m_dark  = pbr('dark',   (0x23/255,0x2a/255,0x33/255), 0.50, 0.55)
m_accent= pbr('accent', (0x1f/255,0xa8/255,0xd8/255), 0.60, 0.40)
m_track = pbr('track',  (0x1d/255,0x22/255,0x29/255), 0.35, 0.68)
HULL_SLOTS  = [m_dark, m_steel, m_steel2, m_dark, m_accent]
TUR_SLOTS   = [m_dark, m_lite, m_steel, m_dark, m_accent]
for i, s in enumerate(hull.material_slots): s.material = HULL_SLOTS[i % 5]
for i, s in enumerate(turret.material_slots): s.material = TUR_SLOTS[i % 5]

def empty(name, loc):
    e = bpy.data.objects.new(name, None); e.location = loc
    scene.collection.objects.link(e); return e

piv_h = empty('PIV_HULL', (0, 0, 0))
piv_t = empty('PIV_TUR', pivot_t)
hull.parent = piv_h; hull.matrix_parent_inverse.identity()
turret.parent = piv_t; turret.matrix_parent_inverse.identity()

def plane(name, loc, sx, sy, mat, parent):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(-sx,-sy,0),(sx,-sy,0),(sx,sy,0),(-sx,sy,0)], [], [(0,1,2,3)])
    o = bpy.data.objects.new(name, mesh); o.location = loc
    o.data.materials.append(mat)
    scene.collection.objects.link(o)
    o.parent = parent; o.matrix_parent_inverse.identity()
    return o

exh = plane('EXHAUST', (hb0.x + 1.7, 0, hb1.z + 0.05), 1.1, 0.65,
            emis('em_exh', (1.0, 0.42, 0.13), 1.8), piv_h)
core = plane('CORE', (pivot_t.x - 1.6, pivot_t.y, tb1.z + 0.05), 0.6, 0.6,
             emis('em_core', (0.20, 0.85, 1.0), 2.2), piv_t)
exh.visible_camera = False   # 发光片只进 emissive pass, 不出现在 diffuse
core.visible_camera = False

def shadow_copy(src):
    c = src.copy(); c.data = src.data; c.name = src.name + '_SH'
    c.parent = src.parent; c.matrix_parent_inverse = src.matrix_parent_inverse.copy()
    c.visible_camera = False
    scene.collection.objects.link(c)
    return c

sh_hull = shadow_copy(hull); sh_turret = shadow_copy(turret)
pm = bpy.data.meshes.new('catcher')
pm.from_pydata([(-60,-60,-0.02),(60,-60,-0.02),(60,60,-0.02),(-60,60,-0.02)], [], [(0,1,2,3)])
catcher = bpy.data.objects.new('CATCHER', pm)
scene.collection.objects.link(catcher)
catcher.is_shadow_catcher = True

# ---- collections ----
def move_to(o, c):
    for oc in list(o.users_collection):
        oc.objects.unlink(o)
    c.objects.link(o)

def coll(name, objs):
    c = bpy.data.collections.new(name)
    for o in objs: move_to(o, c)
    scene.collection.children.link(c)
    return c

C_HULL = coll('C_HULL', [hull, exh])
C_TUR  = coll('C_TUR',  [turret, core])
C_SHAD = coll('C_SHAD', [sh_hull, sh_turret, catcher])

# ---- world + sun + camera ----
w = scene.world or bpy.data.worlds.new('World'); scene.world = w
w.use_nodes = True; wn = w.node_tree; wn.nodes.clear()
wout = wn.nodes.new('ShaderNodeOutputWorld'); bg = wn.nodes.new('ShaderNodeBackground')
env = wn.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(HDRI)
wn.links.new(env.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 0.3
wn.links.new(bg.outputs[0], wout.inputs['Surface'])
sun = bpy.data.objects.new('SUN', bpy.data.lights.new('SUN', 'SUN'))
sun.data.energy = 1.6; sun.data.angle = math.radians(5); sun.data.color = (1.0, 0.95, 0.88)
sun.rotation_euler = (math.radians(38), 0, math.radians(138))
scene.collection.objects.link(sun)

cam = bpy.data.objects.new('CAM', bpy.data.cameras.new('CAM'))
cam.data.type = 'ORTHO'
half = max(math.hypot(max(abs(hb0.x), abs(hb1.x)), max(abs(hb0.y), abs(hb1.y))),
           math.hypot(max(abs(tb0.x-pivot_t.x), abs(tb1.x-pivot_t.x)), max(abs(tb0.y-pivot_t.y), abs(tb1.y-pivot_t.y))) + math.hypot(pivot_t.x, pivot_t.y))
cam.data.ortho_scale = half * 2.24
cam.data.clip_start = 0.1; cam.data.clip_end = 300
th = math.radians(90 - ELEV)
fwd = Vector((0, math.sin(th), -math.cos(th)))
cam.location = Vector((0, 0, hb1.z*0.42)) - fwd * 60
cam.rotation_euler = (math.radians(90 - ELEV), 0, 0)
scene.collection.objects.link(cam)
scene.camera = cam
print('ORTHO scale', round(cam.data.ortho_scale, 2))

def on_frame(s):
    k = (s.frame_current - 1) % FRAMES
    yaw = math.radians(-22.5 * k)
    piv_h.rotation_euler = (0, 0, yaw)
    piv_t.rotation_euler = (0, 0, yaw)
bpy.app.handlers.frame_change_pre.append(on_frame)
bpy.app.handlers.render_pre.append(on_frame)

# ---- normal-override material: world normal -> emission (n*0.5+0.5) ----
nm_mat = bpy.data.materials.new('normalOverride'); nm_mat.use_nodes = True
nt = nm_mat.node_tree; nt.nodes.clear()
out = nt.nodes.new('ShaderNodeOutputMaterial')
em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 1.0
geo = nt.nodes.new('ShaderNodeNewGeometry')
sep = nt.nodes.new('ShaderNodeSeparateXYZ')
com = nt.nodes.new('ShaderNodeCombineXYZ')
nt.links.new(geo.outputs['Normal'], sep.inputs[0])
for i, ch in enumerate('XYZ'):
    m1 = nt.nodes.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'; m1.inputs[1].default_value = 0.5
    m2 = nt.nodes.new('ShaderNodeMath'); m2.operation = 'ADD'; m2.inputs[1].default_value = 0.5
    nt.links.new(sep.outputs[ch], m1.inputs[0]); nt.links.new(m1.outputs[0], m2.inputs[0])
    nt.links.new(m2.outputs[0], com.inputs[i])
nt.links.new(com.outputs[0], em.inputs['Color'])
nt.links.new(em.outputs[0], out.inputs['Surface'])

# ---- collection visibility driver ----
C_NAMES = [c.name for c in bpy.data.collections if c.name.startswith('C_')]
def set_visible(keep):
    def walk(lc):
        if lc.collection.name in C_NAMES:
            lc.exclude = lc.collection.name not in keep
        else:
            lc.exclude = False
        for ch in lc.children: walk(ch)
    walk(vl.layer_collection)

_saved = {}
def set_override(objs, mat):
    for o, slots in _saved.items():
        for i, m in enumerate(slots):
            o.material_slots[i].material = m
    _saved.clear()
    if mat is not None:
        for o in objs:
            _saved[o] = [s.material for s in o.material_slots]
            for s in o.material_slots: s.material = mat

def render_pass(prefix, keep, mode, fmt):
    set_visible(keep)
    if mode == 'normal':
        set_override([hull, exh, turret, core], nm_mat)
    else:
        set_override([], None)
    exr_cfg() if fmt == 'EXR' else png_cfg()
    scene.render.filepath = f'{OUT}/{prefix}_####'
    bpy.ops.render.render(animation=True)
    print('PASS DONE', prefix, mode)

if not QUICK:
    render_pass('hull_diff', ['C_HULL'], 'beauty', 'PNG')
    render_pass('hull_norm', ['C_HULL'], 'normal', 'EXR')
    render_pass('tur_diff',  ['C_TUR'], 'beauty', 'PNG')
    render_pass('tur_norm',  ['C_TUR'], 'normal', 'EXR')
    render_pass('shadow',    ['C_SHAD'], 'beauty', 'PNG')
else:
    render_pass('hull_diff', ['C_HULL'], 'beauty', 'PNG')
def render_emis_only(prefix, plane_obj):
    def walk(lc):
        if lc.collection.name in C_NAMES:
            lc.exclude = True
        else:
            lc.exclude = False
        for ch in lc.children: walk(ch)
    walk(vl.layer_collection)
    scene.collection.objects.link(plane_obj)  # plane alone in scene collection
    plane_obj.visible_shadow = False
    plane_obj.visible_camera = True   # emissive pass 需要可见
    set_override([], None)
    exr_cfg()
    scene.render.filepath = f'{OUT}/{prefix}_####'
    bpy.ops.render.render(animation=True)
    scene.collection.objects.unlink(plane_obj)
    plane_obj.visible_camera = False
    print('PASS DONE', prefix, 'emis-only')

render_emis_only('hull_emis', exh)
if not QUICK: render_emis_only('tur_emis', core)

# ---- EXR -> PNG conversion (linear bytes, no gamma) ----
for f in sorted(os.listdir(OUT)):
    if not f.endswith('.exr'): continue
    p = os.path.join(OUT, f)
    im = bpy.data.images.load(p)
    w_, h_ = im.size
    arr = np.array(im.pixels[:], dtype=np.float32).reshape(h_, w_, 4)[::-1]  # flip vertically
    arr = np.clip(arr, 0, 1)
    out8 = (arr * 255).astype(np.uint8)
    png_path = p[:-4] + '.png'
    # write via Blender image (avoids PIL dependency here)
    ni = bpy.data.images.new('tmp', w_, h_, alpha=True)
    ni.pixels = (arr[::-1]).ravel().tolist()  # back to blender top-down order
    ni.file_format = 'PNG'
    ni.filepath_raw = png_path
    ni.save()
    bpy.data.images.remove(ni)
    bpy.data.images.remove(im)
    os.remove(p)
    print('CONVERTED', png_path)

if QUICK:
    import numpy as np2
    im = bpy.data.images.load(f'{OUT}/hull_diff_0001.png')
    arr = np.array(im.pixels[:], dtype=np.float32).reshape(im.size[1], im.size[0], 4)
    op = arr[..., 3] > 0.5
    if op.any():
        print('DIAG mean', arr[..., :3][op].mean(axis=0), 'p95', np2.percentile(arr[..., :3][op], 95, axis=0))
    print('QUICK DONE')

print('BAKE DONE')
