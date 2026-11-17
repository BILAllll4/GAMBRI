/**
 * THE PORTAL — a doorway after the traditional doors of Tiznit (TiznitDoor),
 * set in an earth rampart at night, and behind it the showroom: three display
 * cards, each with a 3D guembri (PortalShowroom).
 * Everything is driven by a 0..1 scroll progress value (no React re-renders).
 */
import { useMemo, useRef, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Vignette, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { TiznitDoor } from './TiznitDoor'
import { PortalShowroom, STOP_Z, STOP_Y, type CardLabel, type ShowpieceItem } from './PortalShowroom'

/*
 * Scroll choreography (progress 0..1 over the portal's scroll track):
 *   0.02–0.50  the camera approaches the doorway
 *   0.18–0.42  the doors swing open: the three cards are already visible through the opening
 *   0.42–0.70  the camera walks through and stops in front of the cards
 *   0.60–0.72  the cards' names, prices and lines fade in
 *   0.72–1.00  hold: a finished, interactive showroom (hover to turn, click to open)
 * After 1 the sticky stage simply scrolls up and the Full Collection follows below it.
 */
export const PHASES = { approach: [0.02, 0.5], open: [0.18, 0.42], through: [0.42, 0.7], reveal: [0.6, 0.72] } as const
const ss = (p: number, [a, b]: readonly [number, number]) => THREE.MathUtils.smoothstep(p, a, b)

function Portal({ progress, items, labels, onOpen }: { progress: RefObject<number>; items: ShowpieceItem[]; labels: CardLabel[]; onOpen: (slug: string, name: string) => void }) {
  const spill = useRef<THREE.SpotLight>(null)
  const smooth = useRef(0)
  const reveal = useRef(0)
  const opened = useRef(0)
  const scene = useThree((s) => s.scene)

  useFrame(({ camera }, dt) => {
    const target = progress.current ?? 0
    smooth.current += (target - smooth.current) * (1 - Math.exp(-dt * 6))
    const p = smooth.current
    const approach = ss(p, PHASES.approach)
    const through = ss(p, PHASES.through)
    const open = ss(p, PHASES.open)
    // approach the door, then walk through it and stop just past the open leaves
    const z = THREE.MathUtils.lerp(THREE.MathUtils.lerp(11, 2.4, approach), STOP_Z, through)
    // on portrait screens the names hang below the cards: aim a little lower so cards + names sit centred
    const stopY = (camera as THREE.PerspectiveCamera).aspect < 0.8 ? STOP_Y - 0.3 : STOP_Y
    camera.position.set(Math.sin(p * 2.2) * 0.3 * (1 - approach), THREE.MathUtils.lerp(1.8 - 0.1 * approach, stopY, through), z)
    camera.lookAt(0, THREE.MathUtils.lerp(1.9, stopY, through), z - 10)
    // the doors swing open (TiznitDoor reads this)
    opened.current = open
    reveal.current = ss(p, PHASES.reveal)
    // the night fog outside thins out inside the room, so the cards keep their true colours
    const fog = scene.fog as THREE.Fog | null
    if (fog) {
      fog.near = THREE.MathUtils.lerp(6, 40, through)
      fog.far = THREE.MathUtils.lerp(22, 90, through)
    }
    beamMat.uniforms.uOpacity.value = open * 0.55 * (1 - through)
    if (spill.current) spill.current.intensity = 4 + open * 140
  })

  const beamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uOpacity: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uOpacity; varying vec2 vUv;
          void main(){ float a = (1.0 - vUv.y) * smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
          gl_FragColor = vec4(1.0, 0.82, 0.52, a * uOpacity * 0.5); }`,
      }),
    [],
  )

  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 4]} receiveShadow>
        <planeGeometry args={[40, 30]} />
        <meshStandardMaterial color="#102a20" roughness={0.55} metalness={0.1} />
      </mesh>
      {/* the Tiznit doorway in its rampart; a warm lantern above it, as on the reference */}
      <TiznitDoor open={opened} />
      <pointLight position={[0, 5.2, 1.2]} intensity={5} distance={9} decay={1.6} color="#ffcf8a" />
      {/* a soft fill on the door leaves, set back in the wall's depth */}
      <pointLight position={[0, 2.0, 2.6]} intensity={3.2} distance={6} decay={1.5} color="#fff0dc" />

      {/* the showroom behind the door: a sand floor from the threshold back, and the three cards */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -15.7]} receiveShadow>
        <planeGeometry args={[16, 30]} />
        <meshStandardMaterial color="#c9b28a" roughness={0.9} />
      </mesh>
      <PortalShowroom items={items} reveal={reveal} glow={opened} labels={labels} onOpen={onOpen} />
      {/* light shafts spilling out */}
      <mesh position={[0, 1.6, 1.8]} rotation={[-Math.PI / 2 + 0.25, 0, 0]} material={beamMat}>
        <planeGeometry args={[2.8, 4.6]} />
      </mesh>
      <spotLight ref={spill} position={[0, 2.8, -2.5]} angle={0.7} penumbra={0.6} intensity={4} color="#ffd59a" castShadow target-position={[0, 0, 5]} />
      <hemisphereLight args={['#9aa48a', '#0d2a20', 0.3]} />
      <pointLight position={[0, 4, 6]} intensity={6} distance={14} color="#9aa48a" />
    </group>
  )
}

export function PortalScene({
  progress,
  active,
  items,
  labels,
  onOpen,
}: {
  progress: RefObject<number>
  active: boolean
  items: ShowpieceItem[]
  labels: CardLabel[]
  onOpen: (slug: string, name: string) => void
}) {
  return (
    <Canvas
      shadows
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: 40, near: 0.1, far: 60, position: [0, 1.8, 11] }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.NoToneMapping
        scene.background = new THREE.Color('#0d2a20')
        scene.fog = new THREE.Fog('#0d2a20', 6, 22)
      }}
    >
      <Portal progress={progress} items={items} labels={labels} onOpen={onOpen} />
      {/* no bloom: nothing in the showroom may glow soft. A light vignette only. */}
      <EffectComposer enableNormalPass={false} multisampling={4}>
        <Vignette offset={0.3} darkness={0.5} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  )
}
