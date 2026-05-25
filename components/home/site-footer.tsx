import Link from 'next/link'
import { Facebook, Instagram, Linkedin, Mail } from 'lucide-react'

const CONTACT_EMAIL = 'digitalamenitiessas@gmail.com'

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-4 bg-[#1A1A1A] text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-7 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[var(--citify-terracotta)]">
            Citify
          </p>
          <p className="text-sm text-white/80">
            Conectamos vecinos, comercios y consorcios en una experiencia más simple.
          </p>
          <Link
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-white/90 transition hover:border-[var(--citify-terracotta)]/60 hover:bg-white/5"
          >
            <Mail className="h-3.5 w-3.5" />
            {CONTACT_EMAIL}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <SocialLink href="https://instagram.com/" label="Instagram"><Instagram className="h-4 w-4" /></SocialLink>
          <SocialLink href="https://facebook.com/" label="Facebook"><Facebook className="h-4 w-4" /></SocialLink>
          <SocialLink href="https://www.linkedin.com/" label="LinkedIn"><Linkedin className="h-4 w-4" /></SocialLink>
          <span className="ml-2 hidden text-xs text-white/50 md:inline">
            Desarrollado por Digital Amenities
          </span>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 py-2 flex flex-col items-center gap-2 md:flex-row md:justify-between md:gap-3">
        <p className="text-[11px] text-white/50 md:hidden">
          Desarrollado por Digital Amenities
        </p>
        <div className="flex items-center gap-3 text-[11px] text-white/60 md:ml-auto">
          <Link href="/legal/terminos" className="hover:text-white/90 transition-colors">
            Términos
          </Link>
          <span aria-hidden className="text-white/30">·</span>
          <Link href="/legal/privacidad" className="hover:text-white/90 transition-colors">
            Privacidad
          </Link>
          <span aria-hidden className="text-white/30">·</span>
          <Link href="/legal/cookies" className="hover:text-white/90 transition-colors">
            Cookies
          </Link>
        </div>
      </div>
    </footer>
  )
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/80 transition hover:border-[var(--citify-terracotta)]/60 hover:bg-white/5 hover:text-white"
    >
      {children}
    </a>
  )
}
