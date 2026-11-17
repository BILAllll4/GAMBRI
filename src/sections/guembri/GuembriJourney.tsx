/**
 * PAGE 3 — THE GUEMBRI: one story told with one 3D instrument.
 *   DISCOVER → DISASSEMBLE → EXPLORE → REASSEMBLE → PLAY
 *
 * A tall scroll track with a sticky stage holding ONE canvas (GuembriScene).
 * The scroll (GSAP ScrollTrigger) drives journey.p; the scene derives the
 * camera and the components' positions from it, and this file drives the few
 * DOM layers over the stage:
 *   - DISCOVER: "The soul of Gnawa", one line, a scroll cue (right side);
 *   - EXPLORE: for the component in focus, a large reference photograph, its
 *     Arabic and French names and two sentences (crossfades between steps);
 *   - PLAY: note buttons, key hint, music list (key 9) and sound toggle.
 * White museum page (beige in the playing pose), brass accents and Tifinagh
 * lettering; the instrument stays the main character throughout.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ScrollTrigger } from '../../lib/scroll'
import { useGuembri } from '../../store/useGuembri'
import { engine } from '../../audio/engine'
import { stopDemo, stopRecording, usePlayer } from '../../audio/demo'
import { useKeyboard } from '../../hooks/useKeyboard'
import { hasWebGL, isTouchDevice } from '../../lib/device'
import { useT, type T as Tr } from '../../lib/i18n'
import { COMPONENTS } from '../../data/anatomy'
import { PHOTOS } from '../../data/media'
import { Photo, CreditLine } from '../../components/ui/Photo'
import { TifinaghField } from '../../components/TifinaghField'
import { Fallback } from './Fallback'
import { NoteLabels } from './NoteLabels'
import { MusicPlayer } from './MusicPlayer'
import { journey, stepAt, T, travelOf } from './journey'

const GuembriScene = lazy(() => import('./GuembriScene').then((m) => ({ default: m.GuembriScene })))

const UI = {
  kicker: { en: 'III · The instrument', fr: 'III · L’instrument', ar: 'III · الآلة' },
  title: { en: 'The soul of Gnawa', fr: 'L’âme des Gnaoua', ar: 'روح كناوة' },
  lead: {
    en: 'The guembri, the three-stringed lute at the heart of Gnawa music. Turn it, then scroll to take it apart.',
    fr: 'Le guembri, le luth à trois cordes au cœur de la musique gnaoua. Tournez-le, puis faites défiler pour le démonter.',
    ar: 'الكَمبري، العود ذو الأوتار الثلاثة في قلب موسيقى كناوة. أدِره، ثم مرّر لتفكيكه.',
  },
  scroll: { en: 'Scroll', fr: 'Défiler', ar: 'مرّر' },
  whole: { en: 'Whole again.', fr: 'De nouveau entier.', ar: 'كاملًا من جديد.' },
  wholeLine: { en: 'Now play it.', fr: 'À vous de jouer.', ar: 'الآن اعزف عليه.' },
  loading: { en: 'Stretching the skin…', fr: 'On tend la peau…', ar: 'يُشدّ الجلد…' },
  keys: { en: 'Keys A E Y Q W X C V B N — or touch a string · drag to turn it', fr: 'Touches A E Y Q W X C V B N — ou touchez une corde · glissez pour le tourner', ar: 'المفاتيح A E Y Q W X C V B N — أو المس وترًا · اسحب لتدويره' },
  touchNote: { en: 'Touch a note or a string to play · drag to turn it', fr: 'Touchez une note ou une corde · glissez pour le tourner', ar: 'المس نغمة أو وترًا للعزف · اسحب لتدويره' },
  samples: { en: 'Recorded guembri samples', fr: 'Échantillons de guembri enregistrés', ar: 'عيّنات كَمبري مسجّلة' },
  synth: { en: 'Synthesized study tones, not a recording', fr: 'Sons de synthèse, pas un enregistrement', ar: 'نغمات مركّبة، وليست تسجيلًا' },
  soundOn: { en: 'Sound on', fr: 'Son activé', ar: 'الصوت مفعّل' },
  soundOff: { en: 'Sound off', fr: 'Son coupé', ar: 'الصوت مطفأ' },
} satisfies Record<string, Tr>

const ss = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function SoundToggle() {
  const t = useT()
  const muted = useGuembri((s) => s.muted)
  const toggle = () => {
    useGuembri.getState().set({ muted: !muted })
    engine.applyVolume()
  }
  return (
    <button onClick={toggle} aria-pressed={!muted} className="group flex items-center gap-3 text-emerald/55 transition-colors hover:text-emerald">
      {/* three bars = three strings; they flatten when muted */}
      <span className="flex h-3 items-end gap-[3px]" aria-hidden>
        {[0.55, 1, 0.75].map((h, i) => (
          <span key={i} className="w-px bg-brass transition-transform duration-500" style={{ height: '100%', transform: `scaleY(${muted ? 0.15 : h})`, transformOrigin: 'bottom' }} />
        ))}
      </span>
      <span className="label">{t(muted ? UI.soundOff : UI.soundOn)}</span>
    </button>
  )
}

/** EXPLORE: the component in focus — photograph, Arabic and French names, two sentences */
function ComponentPanel({ step }: { step: number }) {
  const t = useT()
  const c = step >= 0 ? COMPONENTS[step] : null
  return (
    <div className="pointer-events-none absolute z-[6] flex flex-col justify-center max-md:inset-x-0 max-md:bottom-0 max-md:top-[52svh] max-md:px-[var(--gutter)] max-md:pb-6 md:bottom-0 md:top-0 md:w-[38vw] md:ltr:right-[5vw] md:rtl:left-[5vw]">
      {/* progress: four components */}
      <div className={`mb-6 flex items-center gap-3 transition-opacity duration-500 max-md:mb-3 ${c ? 'opacity-100' : 'opacity-0'}`} aria-hidden>
        {COMPONENTS.map((x, i) => (
          <span key={x.id} className={`h-px transition-all duration-700 ${i === step ? 'w-10 bg-brass' : i < step ? 'w-5 bg-brass/50' : 'w-5 bg-emerald/20'}`} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        {c && (
          <motion.article
            key={c.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.2, 0.8, 0.2, 1] } }}
            exit={{ opacity: 0, y: -16, transition: { duration: 0.35 } }}
            className="max-md:grid max-md:grid-cols-[34%_1fr] max-md:gap-4"
          >
            <figure>
              <motion.div
                initial={{ clipPath: 'inset(100% 0% 0% 0%)' }}
                animate={{ clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: 1, ease: [0.65, 0, 0.35, 1] } }}
                className="relative aspect-[4/5] w-full overflow-hidden bg-forest md:h-[44svh] md:w-auto"
              >
                <Photo k={c.photo} sizes="(min-width: 768px) 30vw, 34vw" className="absolute inset-0" imgClassName="object-cover" />
              </motion.div>
              <figcaption className="mt-2 text-emerald/40 max-md:hidden">
                <CreditLine caption={PHOTOS[c.photo].caption} credit={PHOTOS[c.photo].credit} className="text-[10px]" />
              </figcaption>
            </figure>
            <div className="md:mt-7">
              <p className="label text-[10px] text-brass/80">
                {String(step + 1).padStart(2, '0')} / 04 · {c.en}
              </p>
              <h3 className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <span lang="ar" dir="rtl" className="text-[clamp(30px,3.2vw,48px)] leading-none text-brass" style={{ fontFamily: '"Noto Naskh Arabic", serif' }}>
                  {c.ar}
                </span>
                <span lang="fr" className="display text-[clamp(26px,2.6vw,40px)] italic leading-none text-emerald">
                  {c.fr}
                </span>
              </h3>
              <p className="mt-4 max-w-[44ch] text-[14px] leading-relaxed text-emerald/70 max-md:text-[13px]">{t(c.text)}</p>
            </div>
          </motion.article>
        )}
      </AnimatePresence>
    </div>
  )
}

export function GuembriJourney() {
  const root = useRef<HTMLElement>(null)
  const hold = useRef<HTMLDivElement>(null)
  const discover = useRef<HTMLDivElement>(null)
  const whole = useRef<HTMLDivElement>(null)
  const playUi = useRef<HTMLDivElement>(null)
  const glowMuseum = useRef<HTMLDivElement>(null)
  const glowPlay = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false) // mount + render when close to the viewport
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState(-1)
  const { sectionActive, started, ready, source } = useGuembri()
  const webgl = useMemo(hasWebGL, [])
  const touch = useMemo(isTouchDevice, [])
  const t = useT()
  useKeyboard()

  useEffect(() => {
    void engine.boot() // decode / synthesize buffers early; the context stays suspended
    const nearObs = new IntersectionObserver(
      ([e]) => {
        setNear(e.isIntersecting)
        if (e.isIntersecting) setMounted(true)
      },
      { rootMargin: '60% 0px 60% 0px' },
    )
    // keys, demo and music only once the instrument has arrived in its playing pose
    const activeObs = new IntersectionObserver(([e]) => useGuembri.getState().set({ sectionActive: e.intersectionRatio > 0.55 }), { threshold: [0, 0.55, 1] })
    nearObs.observe(root.current!)
    activeObs.observe(hold.current!)
    return () => {
      nearObs.disconnect()
      activeObs.disconnect()
    }
  }, [])

  // the whole story is one ScrollTrigger over the track; DOM layers follow through refs
  useEffect(() => {
    let last = -2
    const show = (el: HTMLElement | null, o: number) => {
      if (!el) return
      el.style.opacity = o.toFixed(3)
      el.style.visibility = o > 0.01 ? 'visible' : 'hidden'
    }
    const apply = (p: number) => {
      journey.p = p
      show(discover.current, 1 - ss(p, T.discover[1] - 0.025, T.discover[1] + 0.01))
      show(whole.current, ss(p, T.together[1] - 0.03, T.together[1]) * (1 - ss(p, T.travel[0] + 0.02, T.travel[0] + 0.06)))
      const travel = travelOf(p)
      if (glowMuseum.current) glowMuseum.current.style.opacity = String(1 - travel)
      if (glowPlay.current) glowPlay.current.style.opacity = String(travel)
      if (playUi.current) {
        const o = ss(p, T.travel[1] - 0.02, T.travel[1] + 0.03)
        playUi.current.style.opacity = String(o)
        // display, not visibility: NoteMarkers sets each note button visible, which would override a hidden parent
        playUi.current.style.display = o > 0.02 ? 'block' : 'none'
      }
      const s = stepAt(p)
      if (s !== last) {
        last = s
        setStep(s)
        useGuembri.getState().set({ part: s >= 0 ? COMPONENTS[s].id : null })
      }
    }
    apply(0)
    const st = ScrollTrigger.create({
      trigger: root.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (s) => apply(s.progress),
      onRefresh: (s) => apply(s.progress),
    })
    return () => {
      st.kill()
      useGuembri.getState().set({ part: null })
    }
  }, [])

  // leaving the playing pose stops the music and closes its list
  useEffect(() => {
    if (sectionActive) return
    if (useGuembri.getState().demo) stopDemo()
    stopRecording()
    usePlayer.setState({ open: false })
  }, [sectionActive])

  return (
    <section ref={root} id="guembri-intro" data-nav="light" data-nav-clear className="relative h-[1000svh] bg-[#fbf8f2]" aria-label={t(UI.title)}>
      {/* ---------------- the stage: one canvas for the whole story ---------------- */}
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        {/* ground: the beige playing room under the white museum page, both with Tifinagh lettering */}
        <div ref={glowPlay} className="absolute inset-0 bg-[#e4e2dc] opacity-0">
          <TifinaghField preset="play" opacity={0.04} />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(240,238,233,.9)_0%,rgba(228,226,220,.55)_45%,rgba(228,226,220,0)_75%)]" />
        </div>
        <div ref={glowMuseum} className="absolute inset-0 bg-[#fbf8f2]">
          <TifinaghField preset="intro" opacity={0.035} />
          {/* a soft studio pool of light behind the instrument */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_42%_60%_at_26%_50%,#ffffff_0%,rgba(255,255,255,0)_70%)] rtl:bg-[radial-gradient(ellipse_42%_60%_at_74%_50%,#ffffff_0%,rgba(255,255,255,0)_70%)] max-md:bg-[radial-gradient(ellipse_70%_40%_at_50%_32%,#ffffff_0%,rgba(255,255,255,0)_70%)]" />
        </div>

        <div className="absolute inset-0">
          {webgl ? (
            mounted && (
              <Suspense fallback={null}>
                <GuembriScene active={near} />
              </Suspense>
            )
          ) : (
            <Fallback />
          )}
        </div>

        {/* ---------------- DISCOVER ---------------- */}
        <div
          ref={discover}
          className="pointer-events-none absolute z-[6] flex flex-col justify-center max-md:inset-x-0 max-md:bottom-0 max-md:top-[58svh] max-md:px-[var(--gutter)] md:bottom-0 md:top-0 md:w-[34vw] md:ltr:right-[7vw] md:rtl:left-[7vw]"
        >
          <p className="label text-brass/80">{t(UI.kicker)}</p>
          <h2 className="display mt-5 text-[clamp(40px,4.6vw,76px)] uppercase leading-[0.95] tracking-[0.04em] text-emerald">{t(UI.title)}</h2>
          <span className="mt-6 block h-px w-16 bg-brass/70" />
          <p className="mt-6 max-w-[38ch] text-[15px] font-light leading-relaxed text-emerald/65">{t(UI.lead)}</p>
          <p className="label mt-10 flex items-center gap-3 text-[10px] text-emerald/50 max-md:mt-5">
            <span className="scroll-cue scale-75" aria-hidden />
            {t(UI.scroll)}
          </p>
        </div>

        {/* ---------------- EXPLORE ---------------- */}
        <ComponentPanel step={step} />

        {/* ---------------- REASSEMBLED ---------------- */}
        <div ref={whole} className="pointer-events-none absolute z-[6] flex flex-col justify-center max-md:inset-x-0 max-md:bottom-[8svh] max-md:px-[var(--gutter)] md:bottom-0 md:top-0 md:ltr:right-[9vw] md:rtl:left-[9vw]" style={{ opacity: 0, visibility: 'hidden' }}>
          <p className="display text-[clamp(34px,3.6vw,56px)] italic leading-none text-emerald">{t(UI.whole)}</p>
          <p className="label mt-4 text-brass/80">{t(UI.wholeLine)}</p>
        </div>

        {/* ---------------- PLAY ---------------- */}
        <div ref={playUi} className="pointer-events-none absolute inset-0" style={{ opacity: 0, display: 'none' }}>
          {webgl && mounted && <NoteLabels />}
          <motion.p
            animate={{ opacity: started ? 0.45 : 0.8 }}
            transition={{ duration: 1.2 }}
            className="label pointer-events-none absolute inset-x-0 top-24 z-20 px-gutter text-center text-emerald/80 sm:top-28"
          >
            {t(touch ? UI.touchNote : UI.keys)}
          </motion.p>
          <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-between px-gutter pb-5 sm:pb-7">
            <p className="credit max-w-[30ch] text-emerald/40">{t(source === 'samples' ? UI.samples : UI.synth)}</p>
            <div className="pointer-events-auto flex items-center gap-5 sm:gap-7">
              <MusicPlayer />
              <SoundToggle />
            </div>
          </footer>
        </div>

        {/* loading veil until shaders + textures are ready */}
        <AnimatePresence>
          {webgl && mounted && !ready && (
            <motion.div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-[#fbf8f2]" exit={{ opacity: 0, transition: { duration: 1.1 } }}>
              <p className="label text-emerald/50">{t(UI.loading)}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* the playing pose: deep links (#guembri) land here, and keys work while it is on screen */}
      <div ref={hold} id="guembri" data-guembri-section className="pointer-events-none absolute inset-x-0 bottom-0 h-[100svh]" aria-hidden />
    </section>
  )
}
