/**
 * THE GUEMBRI JOURNEY — one canvas, one instrument, one story:
 *   DISCOVER → DISASSEMBLE → EXPLORE → REASSEMBLE → PLAY
 *
 *  museum pose: the instrument stands upright on the left, turning slowly in
 *    a dark room under a warm key light; the visitor can turn it all the way
 *    round (OrbitControls), zoom with ctrl/⌘ + wheel or pinch.
 *  disassembly: its four real components (wood, leather, strings, neck) move
 *    apart along designed paths, one is brought forward and lit at a time,
 *    then they fly back into the exact assembled instrument.
 *  playing pose: the same object turns flat, the camera settles over the
 *    strings and the existing musical interaction takes over.
 *
 * Nothing is swapped or remounted: the components are the GLB's own meshes in
 * four groups (GuembriGLB `explodable`), and the camera blends between poses.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls, PerformanceMonitor, useGLTF } from '@react-three/drei'
import type { OrbitControls as OrbitImpl } from 'three-stdlib'
import * as THREE from 'three'
import { GUEMBRI_GLB, GuembriGLB } from '../../three/GuembriGLB'
import { hull, neckCarving, skinEngraving } from '../../three/engraving'
import { GEO, STRINGS } from '../../data/notes'
import { COMPONENT_BY_ID } from '../../data/anatomy'
import { excitation, useGuembri } from '../../store/useGuembri'
import { engine } from '../../audio/engine'
import { journey, zoomBy, travelOf, apartOf, focusOf, ORDER, EXPLODED, parts, VIEW_TURN, T } from './journey'

/** instrument extent in model space (spike knot → sersera rings), metres */
const X_MIN = -0.7
const X_MAX = 0.72
const LENGTH = X_MAX - X_MIN
const WIDTH = 0.24
const CX = (X_MIN + X_MAX) / 2
const FOV = 16

type Pose = { target: THREE.Vector3; dir: THREE.Vector3; up: THREE.Vector3; dist: number; shiftX: number; shiftY: number }

/** playing pose: the top-down framing (neck right; neck up on portrait screens), a touch closer over the strings */
function playPose(aspect: number): Pose {
  const t = Math.tan(THREE.MathUtils.degToRad(FOV) / 2)
  if (aspect < 0.9) {
    const visH = Math.max(LENGTH / 0.78, WIDTH / 0.42 / aspect)
    return { target: new THREE.Vector3(CX + visH * 0.045, 0, 0), dir: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(1, 0, 0), dist: visH / (2 * t), shiftX: 0, shiftY: 0 }
  }
  const visW = Math.max(LENGTH / 0.88, (WIDTH / 0.4) * aspect)
  return { target: new THREE.Vector3(CX, 0, 0), dir: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, -1), dist: visW / aspect / (2 * t), shiftX: 0, shiftY: 0 }
}

/**
 * museum pose: upright (neck to the top of the screen), turned so the side of
 * the body shows, large, shifted into the left half (right half in Arabic),
 * or into the top of the screen on phones.
 */
function museumPose(aspect: number): Pose {
  const t = Math.tan(THREE.MathUtils.degToRad(FOV) / 2)
  const portrait = aspect < 0.9
  const visH = portrait ? LENGTH / 0.5 : LENGTH / 0.8
  return {
    target: new THREE.Vector3(CX, 0, 0),
    dir: new THREE.Vector3(0, Math.cos(VIEW_TURN), Math.sin(VIEW_TURN)),
    up: new THREE.Vector3(1, 0, 0),
    dist: visH / (2 * t),
    shiftX: portrait ? 0 : document.documentElement.dir === 'rtl' ? -0.24 : 0.24,
    shiftY: portrait ? 0.22 : 0,
  }
}

const smooth01 = (x: number) => x * x * (3 - 2 * x)
const _q = new THREE.Quaternion()
const _id = new THREE.Quaternion()
function blendDir(a: THREE.Vector3, b: THREE.Vector3, e: number, out: THREE.Vector3) {
  _q.setFromUnitVectors(a, b)
  return out.copy(a).applyQuaternion(_id.identity().slerp(_q, e))
}

type Mode = 'museum' | 'blend' | 'play'

/** places the camera from the journey; hands over to OrbitControls in the museum and playing poses */
function JourneyRig({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const { camera, size } = useThree()
  const cam = camera as THREE.PerspectiveCamera
  const sm = useRef(travelOf())
  const zoom = useRef(1)
  const tmp = useMemo(() => ({ dir: new THREE.Vector3(), up: new THREE.Vector3(), target: new THREE.Vector3(), pos: new THREE.Vector3() }), [])
  const shift = useRef({ x: 0, y: 0 })
  const first = useRef(true)

  useFrame((_, dt) => {
    const aspect = size.width / size.height
    const travel = travelOf()
    sm.current += (travel - sm.current) * (1 - Math.exp(-dt * 7))
    const p = sm.current
    const next: Mode = p < 0.004 && travel < 0.004 ? 'museum' : p > 0.996 && travel > 0.996 ? 'play' : 'blend'
    if (next !== mode) setMode(next)

    const m = museumPose(aspect)
    const pl = playPose(aspect)
    const e = smooth01(Math.min(1, Math.max(0, p)))
    shift.current.x = THREE.MathUtils.lerp(m.shiftX, pl.shiftX, e)
    shift.current.y = THREE.MathUtils.lerp(m.shiftY, pl.shiftY, e)

    if (mode === 'blend' || first.current) {
      blendDir(m.dir, pl.dir, e, tmp.dir)
      blendDir(m.up, pl.up, e, tmp.up)
      tmp.target.lerpVectors(m.target, pl.target, e)
      const dist = THREE.MathUtils.lerp(m.dist, pl.dist, e)
      tmp.pos.copy(tmp.target).addScaledVector(tmp.dir, dist)
      const k = first.current ? 1 : 1 - Math.exp(-dt * 8)
      cam.position.lerp(tmp.pos, k)
      cam.up.lerp(tmp.up, k).normalize()
      cam.lookAt(tmp.target)
      first.current = false
      journey.zoom += (1 - journey.zoom) * (1 - Math.exp(-dt * 4)) // the visitor's zoom eases back while travelling
    }

    // pull back a little while the components are apart, so the whole exploded diagram fits
    let apart = 0
    for (const id of ORDER) apart = Math.max(apart, apartOf(id))
    // (phones pull back further: the exploded diagram is taller than it is wide)
    const target = journey.zoom / (1 + (aspect < 0.9 ? 0.55 : 0.32) * apart)
    zoom.current += (target - zoom.current) * (1 - Math.exp(-dt * 6))
    cam.zoom = zoom.current
    const w = size.width
    const h = size.height
    if (Math.abs(shift.current.x) > 1e-4 || Math.abs(shift.current.y) > 1e-4) cam.setViewOffset(w, h, shift.current.x * w, shift.current.y * h, w, h)
    else cam.clearViewOffset()
    cam.updateProjectionMatrix()
  })
  return null
}

/**
 * OrbitControls for one pose, mounted with the camera already in place: the
 * limits are set relative to the rest angles. Museum: a full turn around the
 * instrument's long axis, and a slow turntable drift while the visitor only
 * looks (DISCOVER). Playing: a small tilt that eases back after a few idle
 * seconds. Wheel zoom stays off so the page keeps scrolling.
 */
function PoseControls({ mode }: { mode: 'museum' | 'play' }) {
  const ref = useRef<OrbitImpl>(null)
  const { camera, size, gl } = useThree()
  const rest = useRef<{ pos: THREE.Vector3 } | null>(null)
  const lastTouch = useRef(performance.now())
  const aspect = size.width / size.height
  const pose = useMemo(() => (mode === 'museum' ? museumPose(aspect) : playPose(aspect)), [mode, aspect])
  // OrbitControls takes its orbit axis from camera.up when it is created, and its limits are
  // measured from where the camera is: put the camera exactly in this pose first
  useState(() => {
    const at = pose.target.clone().addScaledVector(pose.dir, pose.dist)
    camera.up.copy(pose.up)
    if (camera.position.distanceTo(at) > pose.dist * 0.08) camera.position.copy(at)
    camera.lookAt(pose.target)
    return 0
  })

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const a0 = c.getAzimuthalAngle()
    const p0 = c.getPolarAngle()
    if (mode === 'museum') {
      c.minPolarAngle = Math.max(0.15, p0 - 0.45)
      c.maxPolarAngle = Math.min(Math.PI - 0.15, p0 + 0.45)
    } else {
      c.minAzimuthAngle = a0 - 0.6
      c.maxAzimuthAngle = a0 + 0.6
      c.minPolarAngle = Math.max(0.05, p0 - 0.5)
      c.maxPolarAngle = Math.min(Math.PI - 0.05, p0 + 0.5)
    }
    rest.current = { pos: camera.position.clone() }
    gl.domElement.style.touchAction = 'pan-y' // vertical swipes keep scrolling the page
    const onStart = () => (lastTouch.current = Infinity)
    const onEnd = () => (lastTouch.current = performance.now())
    c.addEventListener('start', onStart)
    c.addEventListener('end', onEnd)
    return () => {
      c.removeEventListener('start', onStart)
      c.removeEventListener('end', onEnd)
    }
  }, [mode, camera, gl])

  useFrame((_, dt) => {
    const c = ref.current
    if (!c) return
    const idle = performance.now() - lastTouch.current > (mode === 'play' ? 6000 : 2500)
    if (mode === 'museum') {
      // a slow turntable while the visitor just looks at it, before the disassembly
      c.autoRotate = idle && journey.p < T.discover[1]
      c.autoRotateSpeed = 0.55
    } else if (rest.current && idle) {
      camera.position.lerp(rest.current.pos, 1 - Math.exp(-dt * 1.5))
      c.update()
    }
  })

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      target={pose.target}
      enablePan={false}
      enableZoom={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: undefined as unknown as THREE.TOUCH }}
    />
  )
}

/** ctrl/⌘ + wheel and two-finger pinch zoom (plain wheel scrolls the page) */
function ZoomInput() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const el = gl.domElement
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      zoomBy(Math.exp(-e.deltaY * 0.0025))
    }
    const touches = new Map<number, { x: number; y: number }>()
    let startD = 0
    const d = () => {
      const [a, b] = [...touches.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.size === 2) startD = d()
    }
    const move = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.size === 2 && startD > 0) {
        const now = d()
        zoomBy(now / startD)
        startD = now
      }
    }
    const up = (e: PointerEvent) => {
      touches.delete(e.pointerId)
      startD = 0
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl])
  return null
}

/**
 * DISASSEMBLE / EXPLORE / REASSEMBLE: writes each component's transform from
 * the scroll. Apart, each sits in its designed place (EXPLODED); the one being
 * explored comes a little further toward the visitor. When the strings come
 * into focus they are set ringing (silently), so they visibly vibrate.
 */
function Disassembly() {
  const V = useMemo(() => new THREE.Vector3(0, Math.cos(VIEW_TURN), Math.sin(VIEW_TURN)), [])
  const lastStrings = useRef(0)
  useFrame(() => {
    ORDER.forEach((id, i) => {
      const a = apartOf(id)
      const f = focusOf(i)
      const ease = smooth01(a)
      const x = EXPLODED[id]
      parts[id].pos.copy(x.off).multiplyScalar(ease).addScaledVector(V, 0.07 * f)
      parts[id].rot.set(x.rot[0] * ease, x.rot[1] * ease, x.rot[2] * ease)
      parts[id].focus = f
    })
    // set the strings ringing as they come into focus
    const fs = focusOf(ORDER.indexOf('strings'))
    if (fs > 0.5 && lastStrings.current <= 0.5) {
      const now = performance.now() / 1000
      STRINGS.forEach((s, k) => {
        excitation[s.id].t0 = now + k * 0.12
        excitation[s.id].amp = 0.8
        excitation[s.id].stop = 0
      })
    }
    lastStrings.current = fs
  })
  return null
}

function ReadySignal() {
  const frames = useRef(0)
  useFrame(() => {
    frames.current++
    if (frames.current === 3) useGuembri.getState().set({ ready: true })
  })
  return null
}

/**
 * Cinematic light: in the museum pose a warm key from above-left, a cool
 * fill and a gold rim from behind, so the instrument stands out of the dark;
 * on the way to the playing pose the light opens up and warms over the strings.
 * The glow over the strings breathes with the music.
 */
function Lights() {
  const note = useRef<THREE.PointLight>(null)
  const key = useRef<THREE.DirectionalLight>(null)
  const rim = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const top = useRef<THREE.DirectionalLight>(null)
  const smooth = useRef(0)
  useFrame((_, dt) => {
    const { rms } = engine.levels()
    smooth.current += (rms - smooth.current) * (1 - Math.exp(-dt * 12))
    const t = travelOf()
    if (note.current) note.current.intensity = smooth.current * 0.9
    if (key.current) key.current.intensity = THREE.MathUtils.lerp(2.4, 1.9, t) + smooth.current * 0.6
    if (rim.current) rim.current.intensity = THREE.MathUtils.lerp(1.3, 0.35, t)
    if (hemi.current) hemi.current.intensity = THREE.MathUtils.lerp(0.55, 0.8, t)
    if (top.current) top.current.intensity = THREE.MathUtils.lerp(0.2, 1.1, t)
  })
  return (
    <>
      <hemisphereLight ref={hemi} args={['#fbf3e4', '#b49a78', 0.45]} />
      {/* warm key from above the head of the instrument, on the visitor's side */}
      <directionalLight ref={key} position={[1.6, 1.8, 1.6]} intensity={2.6} color="#ffe2b8" />
      {/* gold rim from behind, outlining the body and neck against the dark */}
      <directionalLight ref={rim} position={[-0.6, -1.4, -1.8]} intensity={2.2} color="#d6a35a" />
      {/* the playing light: over the strings, from above */}
      <directionalLight ref={top} position={[-0.6, 2.4, -0.9]} intensity={0.2} color="#fff6e8" />
      <directionalLight position={[0.8, 1.6, 0.9]} intensity={0.45} color="#e6ecf2" />
      <pointLight ref={note} position={[0.0, 0.25, 0]} intensity={0} distance={1.2} decay={2} color="#ffd9a0" />
    </>
  )
}

/** the floral engraving on the skin (carried by the leather component) */
function SkinEngraving() {
  const { scene } = useGLTF(GUEMBRI_GLB)
  const skin = useMemo(() => {
    const mesh = scene.getObjectByName('Skin') as THREE.Mesh | undefined
    if (!mesh) return null
    const pos = mesh.geometry.getAttribute('position')
    let top = -Infinity
    for (let i = 0; i < pos.count; i++) top = Math.max(top, pos.getY(i))
    const pts: [number, number][] = []
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > top - 0.004) pts.push([pos.getX(i), pos.getZ(i)])
    const outline = hull(pts)
    const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
    for (const [x, z] of outline) {
      b.minX = Math.min(b.minX, x)
      b.maxX = Math.max(b.maxX, x)
      b.minZ = Math.min(b.minZ, z)
      b.maxZ = Math.max(b.maxZ, z)
    }
    const mat = new THREE.MeshBasicMaterial({ map: skinEngraving(outline, b), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })
    return { mat, top, w: b.maxX - b.minX, h: b.maxZ - b.minZ, x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 }
  }, [scene])
  if (!skin) return null
  return (
    <mesh material={skin.mat} position={[skin.x, skin.top + 0.0006, skin.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[skin.w, skin.h]} />
    </mesh>
  )
}

/** the diamond carving on the neck (carried by the neck component) */
function NeckCarving() {
  const neck = useMemo(() => {
    const map = neckCarving()
    const start = GEO.bodyEnd + 0.01
    const end = 0.585 // the sersera plate
    const len = end - start
    map.repeat.set(1, len / 0.034)
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2 })
    const geo = new THREE.CylinderGeometry(GEO.neckRadius + 0.0006, GEO.neckRadius + 0.0006, len, 24, 1, true, Math.PI, Math.PI)
    return { mat, geo, x: (start + end) / 2 }
  }, [])
  return <mesh geometry={neck.geo} material={neck.mat} position={[neck.x, GEO.neckY, 0]} rotation={[0, 0, -Math.PI / 2]} renderOrder={1} />
}

/**
 * A soft gold halo along the strings (carried by the strings component): the
 * gut strings are fine dark lines that would vanish against the dark room once
 * they leave the skin, so while they are apart, and above all in focus, a warm
 * glow traces them. It is gone again when the instrument is assembled.
 */
function StringsHalo() {
  const mat = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 8
    c.height = 64
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 0, 64)
    grad.addColorStop(0, 'rgba(232,194,122,0)')
    grad.addColorStop(0.5, 'rgba(232,194,122,1)')
    grad.addColorStop(1, 'rgba(232,194,122,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 8, 64)
    return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  }, [])
  const mesh = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const o = 0.25 * apartOf('strings') + 0.35 * focusOf(ORDER.indexOf('strings'))
    mat.opacity = o
    if (mesh.current) mesh.current.visible = o > 0.01
  })
  const x0 = GEO.tailX
  const x1 = GEO.neckTip
  return (
    <mesh ref={mesh} material={mat} position={[(x0 + x1) / 2, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[x1 - x0, 0.045]} />
    </mesh>
  )
}

/**
 * the instrument rests on the ground in the playing pose: real contact shadows
 * (a tight dark one where it touches, a wide soft one around it) that follow it
 * as the visitor turns it. Mounted only near the playing pose.
 */
function FloorShadow() {
  const [on, setOn] = useState(false)
  const near = useRef<THREE.Group>(null)
  const wide = useRef<THREE.Group>(null)
  useFrame(() => {
    const k = THREE.MathUtils.smoothstep(travelOf(), 0.7, 1)
    if ((k > 0.01) !== on) setOn(k > 0.01)
    const fade = (g: THREE.Group | null, o: number) =>
      g?.traverse((x) => {
        const m = (x as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined
        if (m && 'opacity' in m) m.opacity = o * k
      })
    fade(near.current, 0.75)
    fade(wide.current, 0.45)
  })
  if (!on) return null
  const cx = (X_MIN + X_MAX) / 2
  const len = X_MAX - X_MIN + 0.5
  return (
    <>
      <ContactShadows ref={near} position={[cx, -0.17, 0]} scale={[len, len]} resolution={1024} blur={0.8} far={0.12} opacity={0.75} color="#2b1b10" />
      <ContactShadows ref={wide} position={[cx, -0.171, 0]} scale={[len, len]} resolution={512} blur={3} far={0.45} opacity={0.45} color="#3d2a1a" />
    </>
  )
}

function Instrument() {
  const part = useGuembri((s) => s.part)
  const nodes = part ? COMPONENT_BY_ID.get(part)?.nodes : undefined
  const attach = useMemo(() => ({ leather: <SkinEngraving />, neck: <NeckCarving />, strings: <StringsHalo /> }), [])
  return <GuembriGLB interactive explodable finish="play" stringColor="#2a1a10" highlight={nodes && nodes.length ? nodes : undefined} attach={attach} />
}

export function GuembriScene({ active }: { active: boolean }) {
  const [quality, setQuality] = useState<'high' | 'low'>(() => (Math.min(window.innerWidth, window.innerHeight) < 700 ? 'low' : 'high'))
  const [mode, setMode] = useState<Mode>(() => (travelOf() > 0.996 ? 'play' : travelOf() < 0.004 ? 'museum' : 'blend'))

  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, quality === 'high' ? 2 : 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: FOV, near: 0.05, far: 40, position: [CX, 8, 0] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        gl.setClearColor(0x000000, 0)
      }}
      aria-label="Three-dimensional guembri: drag to turn it"
    >
      <PerformanceMonitor onDecline={() => setQuality('low')} flipflops={2} onFallback={() => setQuality('low')} />
      <Suspense fallback={null}>
        {/* a photo studio for the varnish and the skin to reflect: overhead softbox, two strip lights, a warm floor bounce */}
        <Environment resolution={256} frames={1}>
          <color attach="background" args={['#2a221a']} />
          <Lightformer form="rect" intensity={2.2} color="#fff1dc" position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[4, 2.5, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#ffe6c4" position={[-3, 1.5, 1]} scale={[0.6, 4, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={0.8} color="#f2eee6" position={[3, 1.2, -1]} scale={[0.6, 4, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={0.35} color="#c9a57a" position={[0, -3, 0]} rotation-x={-Math.PI / 2} scale={[6, 6, 1]} />
        </Environment>
        <Lights />
        <Instrument />
        <FloorShadow />
        <ReadySignal />
      </Suspense>
      <Disassembly />
      <JourneyRig mode={mode} setMode={setMode} />
      {mode !== 'blend' && <PoseControls key={mode} mode={mode} />}
      <ZoomInput />
    </Canvas>
  )
}
