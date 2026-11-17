/**
 * The guembri journey — one scroll value, one story:
 *   DISCOVER → DISASSEMBLE → EXPLORE (×4) → REASSEMBLE → PLAY
 *
 * journey.p (0..1) is written by the section's ScrollTrigger and read every
 * frame by the 3D scene and the DOM overlays, so scrolling never re-renders
 * React. Everything that depends on the scroll is derived here, in one place.
 */
import * as THREE from 'three'
import type { ComponentId } from '../../data/anatomy'

export const journey = { p: 0, zoom: 1 }

export const ZOOM_MIN = 1
export const ZOOM_MAX = 2.4
export function zoomBy(f: number) {
  journey.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, journey.zoom * f))
}

/* ------------------------------------------------------------------ timeline */

export const ORDER: ComponentId[] = ['wood', 'leather', 'strings', 'neck']

export const T = {
  discover: [0, 0.07],
  apart: [0.07, 0.17], // components separate (staggered)
  explore: [0.17, 0.69], // four equal steps, one per component
  together: [0.69, 0.79], // components return (reverse order)
  travel: [0.8, 0.95], // upright museum pose → flat playing pose
} as const

const ss = (x: number, a: number, b: number) => THREE.MathUtils.smoothstep(x, a, b)

/** 0..1 separation of one component (staggered out, reverse-staggered back) */
export function apartOf(id: ComponentId, p = journey.p) {
  const k = ORDER.indexOf(id)
  const out = ss(p, T.apart[0] + k * 0.018, T.apart[1] - (3 - k) * 0.012)
  const back = ss(p, T.together[0] + (3 - k) * 0.018, T.together[1] - k * 0.012)
  return out * (1 - back)
}

/** the component being explored (null outside the explore stretch) */
export function stepAt(p = journey.p): number {
  if (p < T.explore[0] || p >= T.explore[1]) return -1
  return Math.min(3, Math.floor(((p - T.explore[0]) / (T.explore[1] - T.explore[0])) * 4))
}

/** 0..1 how much component i is in focus (eases in and out within its step) */
export function focusOf(i: number, p = journey.p) {
  const len = (T.explore[1] - T.explore[0]) / 4
  const a = T.explore[0] + i * len
  return ss(p, a, a + len * 0.22) * (1 - ss(p, a + len * 0.82, a + len))
}

/** 0..1 museum → playing pose */
export const travelOf = (p = journey.p) => ss(p, T.travel[0], T.travel[1])

/* ----------------------------------------------------- component transforms */

/**
 * Exploded layout, in the instrument's model space (long axis +X, skin facing
 * +Y). In the museum view +X is "up" on screen, the viewer sits toward
 * V = (0, cos a, sin a) and screen-right is R = (0, -sin a, cos a).
 * Each component keeps its identity and materials; only these offsets move it.
 */
export const VIEW_TURN = 0.52
const V = new THREE.Vector3(0, Math.cos(VIEW_TURN), Math.sin(VIEW_TURN))
const R = new THREE.Vector3(0, -Math.sin(VIEW_TURN), Math.cos(VIEW_TURN))
const UP = new THREE.Vector3(1, 0, 0)
const mix = (u: number, v: number, r: number) => new THREE.Vector3().addScaledVector(UP, u).addScaledVector(V, v).addScaledVector(R, r)

export const EXPLODED: Record<ComponentId, { off: THREE.Vector3; rot: [number, number, number] }> = {
  // the body drops a little and steps back-left: the anchor of the diagram
  wood: { off: mix(-0.16, -0.08, -0.14), rot: [0.0, 0.0, 0.05] },
  // the skin lifts off its face toward the viewer
  leather: { off: mix(-0.06, 0.24, 0.08), rot: [0.18, 0.0, 0.0] },
  // the strings and their bridge float furthest out, to the right
  strings: { off: mix(0.02, 0.4, 0.3), rot: [0.0, 0.0, 0.0] },
  // the neck slides out of the body along its own axis, upward
  neck: { off: mix(0.36, 0.06, 0.2), rot: [0.0, 0.0, -0.04] },
}

/** live transforms per component, written by the scene each frame and applied by GuembriGLB */
export const parts: Record<ComponentId, { pos: THREE.Vector3; rot: THREE.Euler; focus: number }> = {
  wood: { pos: new THREE.Vector3(), rot: new THREE.Euler(), focus: 0 },
  leather: { pos: new THREE.Vector3(), rot: new THREE.Euler(), focus: 0 },
  strings: { pos: new THREE.Vector3(), rot: new THREE.Euler(), focus: 0 },
  neck: { pos: new THREE.Vector3(), rot: new THREE.Euler(), focus: 0 },
}
