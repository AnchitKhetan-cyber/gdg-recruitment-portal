import { useEffect, useState } from "react"
import { Laptop, Smartphone } from "lucide-react"
import { GdgMark } from "./Brand"

/**
 * Detects a phone or tablet and, on one, blocks the whole portal.
 *
 * The signal is pointer capability, not screen width: a laptop with a narrow
 * browser window must never be blocked mid-test, and a large phone must never
 * slip through. A real laptop/desktop always exposes a fine pointer (mouse or
 * trackpad) and true hover; a phone or bare tablet exposes neither. A
 * touchscreen laptop still has a trackpad, so it is correctly allowed.
 */
const isDesktopDevice = () => {
  if (typeof window === "undefined" || !window.matchMedia) return true
  const finePointer = window.matchMedia("(any-pointer: fine)").matches
  const canHover = window.matchMedia("(any-hover: hover)").matches
  return finePointer && canHover
}

const DesktopOnly = ({ children }) => {
  const [isDesktop, setIsDesktop] = useState(isDesktopDevice)

  useEffect(() => {
    const reevaluate = () => setIsDesktop(isDesktopDevice())

    // Attaching a real device (a mouse to a tablet) or rotating changes the
    // answer, so re-check rather than deciding once at mount.
    const pointer = window.matchMedia("(any-pointer: fine)")
    const hover = window.matchMedia("(any-hover: hover)")

    pointer.addEventListener?.("change", reevaluate)
    hover.addEventListener?.("change", reevaluate)
    window.addEventListener("orientationchange", reevaluate)
    window.addEventListener("resize", reevaluate)

    return () => {
      pointer.removeEventListener?.("change", reevaluate)
      hover.removeEventListener?.("change", reevaluate)
      window.removeEventListener("orientationchange", reevaluate)
      window.removeEventListener("resize", reevaluate)
    }
  }, [])

  if (isDesktop) return children

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-6 py-10">
      <div className="w-full max-w-md text-center">
        <div className="gdg-card overflow-hidden">
          <div className="gdg-rule h-1" aria-hidden="true" />

          <div className="px-7 py-10">
            <div className="mb-6 flex items-center justify-center gap-3" aria-hidden="true">
              <div className="grid size-14 place-items-center rounded-2xl bg-gdg-red/10">
                <Smartphone className="size-7 text-gdg-red" strokeWidth={1.5} />
              </div>
              <span className="text-2xl text-ink-subtle">&rarr;</span>
              <div className="grid size-14 place-items-center rounded-2xl bg-gdg-green/10">
                <Laptop className="size-7 text-gdg-green" strokeWidth={1.5} />
              </div>
            </div>

            <h1 className="text-xl font-semibold tracking-tight text-ink">
              Please switch to a laptop or desktop
            </h1>

            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-muted">
              This assessment can only be taken on a laptop or desktop computer. It is not
              supported on phones or tablets.
            </p>

            <div className="mt-6 rounded-xl border border-line bg-canvas p-4 text-left">
              <h2 className="text-sm font-semibold text-ink">To continue</h2>
              <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink-muted">
                <li className="flex gap-2.5">
                  <span className="font-mono text-xs text-ink-subtle">01</span>
                  <span>Open this same link on a laptop or desktop.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-xs text-ink-subtle">02</span>
                  <span>
                    Sign in with your <span className="font-medium text-ink">@thapar.edu</span>{" "}
                    account.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-xs text-ink-subtle">03</span>
                  <span>Use a stable connection and a working camera.</span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-subtle">
          <GdgMark size={16} />
          Google Developer Groups
        </div>
      </div>
    </main>
  )
}

export default DesktopOnly
