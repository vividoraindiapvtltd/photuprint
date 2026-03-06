"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

const SOCIAL_ICONS = {
  facebook: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
    </svg>
  ),
  instagram: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.048-1.067-.06-1.407-.06-4.123v-.08c0-2.643.012-2.987.06-4.043.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.994 2.013 9.338 2 11.965 2h.08c.046 0 .091 0 .136.002v.001z" clipRule="evenodd" />
      <path d="M12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zM12 15a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M16.712 6.23a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4z" />
    </svg>
  ),
  twitter: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  youtube: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  linkedin: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
  pinterest: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.291 7.464-1.228 0-2.385-.639-2.79-1.394l-.757 2.898c-.274 1.041-1.002 2.352-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
    </svg>
  ),
  tiktok: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  ),
  whatsapp: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  ),
  other: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13.5 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 12a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM13.5 18a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  ),
}

function SectionLinks({ section }) {
  const links = (section.config?.links || []).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
  if (!links.length) return null
  return (
    <div>
      {section.title && <h4 className="text-sm font-semibold text-white mb-3">{section.title}</h4>}
      <ul className="space-y-2">
        {links.map((link, i) => (
          <li key={i}>
            <Link
              href={link.url || "#"}
              target={link.openInNewTab ? "_blank" : undefined}
              rel={link.openInNewTab ? "noopener noreferrer" : undefined}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SectionContact({ section }) {
  const { address, phone, email } = section.config || {}
  if (!address && !phone && !email) return null
  return (
    <div>
      {section.title && <h4 className="text-sm font-semibold text-white mb-3">{section.title}</h4>}
      <div className="space-y-2 text-sm text-gray-400">
        {address && <p className="whitespace-pre-line">{address}</p>}
        {phone && (
          <a href={`tel:${phone}`} className="block hover:text-white transition-colors">
            {phone}
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className="block hover:text-white transition-colors">
            {email}
          </a>
        )}
      </div>
    </div>
  )
}

function SectionNewsletter({ section }) {
  const placeholder = section.config?.placeholder || "Enter your email"
  const buttonText = section.config?.buttonText || "Subscribe"
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("idle")

  const handleSubmit = (e) => {
    e.preventDefault()
    setStatus("loading")
    // Placeholder - integrate with your newsletter API
    setTimeout(() => {
      setStatus("success")
      setEmail("")
    }, 800)
  }

  return (
    <div>
      {section.title && <h4 className="text-sm font-semibold text-white mb-3">{section.title}</h4>}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          required
          className="flex-1 border border-gray-600 bg-gray-800 text-white placeholder-gray-500 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="px-4 py-2 bg-white text-gray-900 text-sm font-medium rounded hover:bg-gray-100 disabled:opacity-50"
        >
          {status === "loading" ? "..." : buttonText}
        </button>
      </form>
      {status === "success" && (
        <p className="mt-2 text-sm text-green-400">{section.config?.successMessage || "Thank you for subscribing!"}</p>
      )}
    </div>
  )
}

function SectionSocial({ section }) {
  const platforms = (section.config?.platforms || []).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
  if (!platforms.length) return null
  return (
    <div>
      {section.title && <h4 className="text-sm font-semibold text-white mb-3">{section.title}</h4>}
      <div className="flex gap-3">
        {platforms.map((p, i) => (
          <a
            key={i}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors"
            aria-label={p.platform}
          >
            {SOCIAL_ICONS[p.platform] || SOCIAL_ICONS.other}
          </a>
        ))}
      </div>
    </div>
  )
}

function SectionAbout({ section }) {
  const { description, logoUrl } = section.config || {}
  return (
    <div>
      {logoUrl && (
        <img src={logoUrl} alt="" className="h-10 mb-3 object-contain" />
      )}
      {section.title && <h4 className="text-sm font-semibold text-white mb-2">{section.title}</h4>}
      {description && <p className="text-sm text-gray-400">{description}</p>}
    </div>
  )
}

function SectionPayment({ section }) {
  const icons = (section.config?.icons || []).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
  if (!icons.length) return null
  return (
    <div>
      {section.title && <h4 className="text-sm font-semibold text-white mb-3">{section.title}</h4>}
      <div className="flex flex-wrap gap-3 items-center">
        {icons.map((icon, i) =>
          icon.iconUrl ? (
            <img key={i} src={icon.iconUrl} alt={icon.name} className="h-8 object-contain opacity-80" />
          ) : (
            <span key={i} className="text-xs text-gray-500 border border-gray-600 rounded px-2 py-1">
              {icon.name}
            </span>
          )
        )}
      </div>
    </div>
  )
}

function SectionCopyright({ section }) {
  const text = section.config?.text || "© {year} All rights reserved."
  const year = new Date().getFullYear()
  return <div className="text-sm text-gray-500">{text.replace("{year}", year)}</div>
}

function SectionCustom({ section }) {
  const html = section.config?.html
  if (!html) return null
  return (
    <div
      className="footer-custom-html text-sm text-gray-400 [&_a]:text-gray-400 [&_a:hover]:text-white"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function renderSection(section) {
  switch (section.type) {
    case "links":
      return <SectionLinks section={section} />
    case "contact":
      return <SectionContact section={section} />
    case "newsletter":
      return <SectionNewsletter section={section} />
    case "social":
      return <SectionSocial section={section} />
    case "about":
      return <SectionAbout section={section} />
    case "payment":
      return <SectionPayment section={section} />
    case "copyright":
      return <SectionCopyright section={section} />
    case "custom":
      return <SectionCustom section={section} />
    default:
      return null
  }
}

export default function Footer() {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/footer-sections", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : { sections: [] })
      .then((data) => setSections(data.sections || []))
      .catch(() => setSections([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse h-32 bg-gray-800 rounded" />
        </div>
      </footer>
    )
  }

  if (sections.length === 0) {
    return (
      <footer className="bg-gray-900 text-white py-8 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          © {new Date().getFullYear()} All rights reserved.
        </div>
      </footer>
    )
  }

  const mainSections = sections.filter((s) => s.type !== "copyright")
  const copyrightSection = sections.find((s) => s.type === "copyright")

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 text-gray-400">
          {mainSections.map((section) => (
            <div key={section._id} className="min-w-0">
              {renderSection(section)}
            </div>
          ))}
        </div>
        {copyrightSection && (
          <div className="mt-8 pt-8 border-t border-gray-800">
            {renderSection(copyrightSection)}
          </div>
        )}
      </div>
    </footer>
  )
}
