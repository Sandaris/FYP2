import { useState } from 'react'
import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { C } from '@/lib/colors'
import { Display } from '@/components/shared/primitives'
import { DASHBOARD, Icon, NAV_ITEMS, PAGE_TITLES } from '@/components/layout/NavIcons'
import { useChrome } from '@/components/layout/ChromeContext'

function FloatingSidebar() {
  const { navOpen, setNavOpen } = useChrome()

  return (
    <>
      <div
        onMouseEnter={() => setNavOpen(true)}
        className="fixed left-0 top-0 bottom-0 w-6 z-[68]"
        aria-hidden="true"
      />

      <div
        aria-hidden="true"
        className="fixed left-[9px] top-1/2 -translate-y-1/2 w-1 h-12 rounded-full bg-[#2C3930] pointer-events-none z-[67] transition-opacity duration-300"
        style={{
          opacity: navOpen ? 0 : 0.55,
          boxShadow: '0 2px 10px rgba(44,57,48,.3)',
        }}
      />

      <nav
        onMouseEnter={() => setNavOpen(true)}
        onMouseLeave={() => setNavOpen(false)}
        className="fixed left-3 top-3 bottom-3 w-[220px] z-[72] rounded-2xl overflow-hidden transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)]"
        style={{
          transform: navOpen ? 'translateX(0)' : 'translateX(calc(-100% - 18px))',
          boxShadow: '0 22px 60px rgba(20,28,22,.42)',
        }}
      >
        <aside
          className="flex flex-col h-full text-[#DCD7C9]"
          style={{ background: C.deep }}
        >
          <div className="flex items-center gap-2.5 px-5 pt-5 pb-[18px] border-b border-white/8">
            <Icon.HouseMark />
            <Display size={20} color={C.cream} weight={500}>Mytanah</Display>
          </div>

          <div className="flex flex-col py-3 flex-1">
            {NAV_ITEMS.map(({ id, label, icon: Ico, path }) => (
              <NavLink
                key={id}
                to={path}
                end={path === DASHBOARD}
                onClick={() => setNavOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-[11px] px-5 py-3 text-left font-sans text-sm transition-all duration-150 no-underline ${
                    isActive ? '' : ''
                  }`
                }
                style={({ isActive }) => ({
                  background: isActive ? C.mid : 'transparent',
                  color: isActive ? C.cream : 'rgba(220,215,201,.6)',
                })}
              >
                <Ico />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>

          <div className="px-5 pb-5 font-sans text-[10px] tracking-wide text-white/40">
            Data: NAPIC 2021–2025
          </div>
        </aside>
      </nav>
    </>
  )
}

function formatHeaderDate(date = new Date()) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Header({ title }) {
  return (
    <header
      className="flex items-center justify-between shrink-0 h-14 px-7 border-b border-[#C8C3B8]"
      style={{ background: C.cream }}
    >
      <Display as="h1" size={22} weight={500}>{title}</Display>
      <span
        className="rounded-full px-3.5 py-1.5 font-mono text-xs font-medium"
        style={{ background: C.deep, color: C.cream }}
      >
        {formatHeaderDate()}
      </span>
    </header>
  )
}

export default function AppShell() {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const { chromeShown, isMapPage } = useChrome()
  const [firstReveal, setFirstReveal] = useState(() => searchParams.get('from') === 'intro')
  const title = PAGE_TITLES[pathname] ?? 'Mytanah'

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col">
      <div
        className="shrink-0 overflow-hidden transition-[height] duration-700 ease-[cubic-bezier(.16,1,.3,1)]"
        style={{ height: chromeShown ? 56 : 0 }}
      >
        <Header title={title} />
      </div>

      <main
        className="flex-1 relative"
        style={{
          overflow: isMapPage ? 'hidden' : 'auto',
          padding: isMapPage ? 0 : 28,
          background: '#DCD7C9',
        }}
      >
        <div
          key={pathname}
          style={{
            height: isMapPage ? '100%' : 'auto',
            animation: firstReveal && isMapPage
              ? 'mapReveal 1.5s cubic-bezier(.16,1,.3,1) both'
              : undefined,
            transformOrigin: '50% 46%',
          }}
        >
          <Outlet />
        </div>
      </main>

      <FloatingSidebar />

      {firstReveal && (
        <div
          onAnimationEnd={() => setFirstReveal(false)}
          className="fixed inset-0 z-[90] pointer-events-none"
          style={{
            background: C.cream,
            animation: 'curtainFade 1.15s cubic-bezier(.4,0,.2,1) both',
          }}
        />
      )}

      <style>{`
        @keyframes mapReveal {
          0%   { opacity: 0; transform: scale(1.12); filter: blur(6px); }
          55%  { opacity: 1; }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes curtainFade {
          0%   { opacity: 1; }
          40%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
