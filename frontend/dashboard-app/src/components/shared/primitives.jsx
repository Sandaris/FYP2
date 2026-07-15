import { C } from '@/lib/colors'

export { C }

export const Eyebrow = ({ children, style, ...rest }) => (
  <div
    className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-[#694F3A]"
    style={style}
    {...rest}
  >
    {children}
  </div>
)

export const PrimitiveCard = ({ children, style, borderTop }) => (
  <div
    className="bg-[#EDE9E1] border border-[#C8C3B8] rounded-xl p-5 shadow-sm"
    style={{
      borderTop: borderTop ? `3px solid ${borderTop}` : undefined,
      ...style,
    }}
  >
    {children}
  </div>
)

export const Pill = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-full px-3.5 py-2 font-sans text-[13px] font-medium transition-all duration-150"
    style={{
      border: `1px solid ${active ? C.deep : C.border}`,
      background: active ? C.deep : C.cream,
      color: active ? C.cream : C.deep,
    }}
  >
    {children}
  </button>
)

export const Mono = ({ children, size = 18, color = C.deep, weight = 500, style }) => (
  <span
    className="font-mono tabular-nums"
    style={{ fontSize: size, color, fontWeight: weight, ...style }}
  >
    {children}
  </span>
)

export const Button = ({ children, onClick, variant = 'primary', style }) => {
  const styles = {
    primary: { background: C.deep, color: C.cream },
    cta: { background: C.earthText, color: C.cream },
    ghost: { background: 'transparent', color: C.deep, border: `1px solid ${C.border}` },
  }[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-[22px] py-3 font-sans text-sm font-semibold cursor-pointer tracking-wide transition-colors duration-200 border-0"
      style={{ ...styles, ...style }}
    >
      {children}
    </button>
  )
}

export const Display = ({ children, size = 28, weight = 500, color = C.deep, style, as: Tag = 'span' }) => (
  <Tag
    className="font-display leading-tight tracking-tight"
    style={{ fontSize: size, fontWeight: weight, color, margin: 0, ...style }}
  >
    {children}
  </Tag>
)
