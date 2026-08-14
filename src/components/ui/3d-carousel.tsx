"use client"

import { memo, useEffect, useLayoutEffect, useState } from "react"
import Link from "next/link"
import {
  AnimatePresence,
  motion,
  useAnimation,
  useMotionValue,
  useTransform,
} from "framer-motion"

export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect

type UseMediaQueryOptions = {
  defaultValue?: boolean
  initializeWithValue?: boolean
}

const IS_SERVER = typeof window === "undefined"

export function useMediaQuery(
  query: string,
  {
    defaultValue = false,
    initializeWithValue = true,
  }: UseMediaQueryOptions = {}
): boolean {
  const getMatches = (query: string): boolean => {
    if (IS_SERVER) {
      return defaultValue
    }
    return window.matchMedia(query).matches
  }

  const [matches, setMatches] = useState<boolean>(() => {
    if (initializeWithValue) {
      return getMatches(query)
    }
    return defaultValue
  })

  const handleChange = () => {
    setMatches(getMatches(query))
  }

  useIsomorphicLayoutEffect(() => {
    const matchMedia = window.matchMedia(query)
    handleChange()

    matchMedia.addEventListener("change", handleChange)

    return () => {
      matchMedia.removeEventListener("change", handleChange)
    }
  }, [query])

  return matches
}

export type ThreeDCarouselCard = {
  src: string
  alt: string
  href: string
  code: string
  title: string
  description: string
  ctaLabel: string
}

const duration = 0.15
const transition = { duration, ease: [0.32, 0.72, 0, 1] as const, filter: "blur(4px)" }
const transitionOverlay = { duration: 0.5, ease: [0.32, 0.72, 0, 1] as const }

const Carousel = memo(
  ({
    handleClick,
    controls,
    cards,
    isCarouselActive,
  }: {
    handleClick: (card: ThreeDCarouselCard, index: number) => void
    controls: ReturnType<typeof useAnimation>
    cards: ThreeDCarouselCard[]
    isCarouselActive: boolean
  }) => {
    const isScreenSizeSm = useMediaQuery("(max-width: 640px)", {
      initializeWithValue: false,
    })
    const faceCount = cards.length
    const faceWidth = isScreenSizeSm ? 168 : 230
    const cylinderWidth = faceWidth * Math.max(faceCount, 8)
    const radius = cylinderWidth / (2 * Math.PI)
    const rotation = useMotionValue(0)
    const transform = useTransform(
      rotation,
      (value) => `rotate3d(0, 1, 0, ${value}deg)`
    )

    return (
      <div
        className="flex h-full items-center justify-center bg-mauve-dark-2"
        style={{
          perspective: "1000px",
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        <motion.div
          drag={isCarouselActive ? "x" : false}
          className="relative flex h-full origin-center cursor-grab justify-center active:cursor-grabbing"
          style={{
            transform,
            rotateY: rotation,
            width: cylinderWidth,
            transformStyle: "preserve-3d",
          }}
          onDrag={(_, info) =>
            isCarouselActive &&
            rotation.set(rotation.get() + info.offset.x * 0.05)
          }
          onDragEnd={(_, info) =>
            isCarouselActive &&
            controls.start({
              rotateY: rotation.get() + info.velocity.x * 0.05,
              transition: {
                type: "spring",
                stiffness: 100,
                damping: 30,
                mass: 0.1,
              },
            })
          }
          animate={controls}
        >
          {cards.map((card, i) => (
            <motion.div
              key={`key-${card.alt}-${i}`}
              className="absolute flex h-full origin-center items-center justify-center rounded-xl bg-mauve-dark-2 p-2"
              style={{
                width: `${faceWidth}px`,
                transform: `rotateY(${
                  i * (360 / faceCount)
                }deg) translateZ(${radius}px)`,
              }}
              onClick={() => handleClick(card, i)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  handleClick(card, i)
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`${card.code}: ${card.title}`}
            >
              <motion.img
                src={card.src}
                alt={card.alt}
                layoutId={`img-${card.src}`}
                className="pointer-events-none  w-full rounded-xl object-cover aspect-square"
                initial={{ filter: "blur(4px)" }}
                layout="position"
                animate={{ filter: "blur(0px)" }}
                transition={transition}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    )
  }
)

Carousel.displayName = "Carousel"

function ThreeDPhotoCarousel({
  cards,
  className,
  closeLabel = "Close",
}: {
  cards: ThreeDCarouselCard[]
  className?: string
  closeLabel?: string
}) {
  const [activeImg, setActiveImg] = useState<ThreeDCarouselCard | null>(null)
  const [isCarouselActive, setIsCarouselActive] = useState(true)
  const controls = useAnimation()

  const handleClick = (card: ThreeDCarouselCard) => {
    setActiveImg(card)
    setIsCarouselActive(false)
    controls.stop()
  }

  const handleClose = () => {
    setActiveImg(null)
    setIsCarouselActive(true)
  }

  return (
    <motion.div layout className="relative">
      <AnimatePresence mode="sync">
        {activeImg && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            layoutId={`img-container-${activeImg.src}`}
            layout="position"
            onClick={handleClose}
            className="fixed inset-4 z-[100] flex items-center justify-center rounded-3xl bg-black/45 p-4 backdrop-blur-sm md:inset-12"
            style={{ willChange: "opacity" }}
            transition={transitionOverlay}
          >
            <motion.article
              onClick={(event) => event.stopPropagation()}
              className="grid w-full max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-[#F6F8F3] text-[#10271B] shadow-2xl sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const }}
            >
              <motion.img
                layoutId={`img-${activeImg.src}`}
                src={activeImg.src}
                alt={activeImg.alt}
                className="aspect-square h-full w-full object-cover"
                style={{ willChange: "transform" }}
              />
              <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8">
                <p className="font-heading text-4xl leading-none sm:text-5xl">{activeImg.code}</p>
                <h3 className="mt-3 font-heading text-xl leading-tight">{activeImg.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-[#405A49]">{activeImg.description}</p>
                <Link
                  href={activeImg.href}
                  className="mt-6 inline-flex min-h-11 items-center justify-between gap-3 border-b border-[#10271B] py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#10271B] focus-visible:ring-offset-4"
                >
                  {activeImg.ctaLabel}<span aria-hidden="true">↗</span>
                </Link>
                <button type="button" onClick={handleClose} className="mt-4 self-start text-xs text-[#405A49] underline underline-offset-4">
                  {closeLabel}
                </button>
              </div>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>
      <div className={`relative h-[330px] w-full overflow-hidden sm:h-[440px] ${className ?? ""}`}>
        <Carousel
          handleClick={handleClick}
          controls={controls}
          cards={cards}
          isCarouselActive={isCarouselActive}
        />
      </div>
    </motion.div>
  )
}

export { ThreeDPhotoCarousel };
