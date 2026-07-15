/* Combobox.jsx — a searchable single-select. Looks like the native styled
   <select> used elsewhere, but opening it reveals a search field that
   type-to-filters the options. The dropdown is rendered position:fixed
   (anchored to the trigger's rect) so it never gets clipped by the
   floating panel's / bottom sheet's overflow. */
import { useState, useRef, useEffect, useLayoutEffect, useId } from 'react'

export default function Combobox({ value, placeholder, options, onChange, disabled, size = 'sm' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [rect, setRect] = useState(null);
  const [hi, setHi] = useState(0);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const inputRef = useRef(null);
  const listboxId = useId();
  const optionId = (i) => `${listboxId}-option-${i}`;

  const lg = size === 'lg';
  const RENDER_CAP = 300; // real road lists can be thousands — cap rendered rows so the popup stays snappy
  const matches = options.filter(o => o.toLowerCase().includes(q.trim().toLowerCase()));
  const filtered = matches.slice(0, RENDER_CAP);
  const overflow = matches.length - filtered.length;

  const place = () => { if (btnRef.current) setRect(btnRef.current.getBoundingClientRect()); };
  const openIt = () => { if (disabled) return; place(); setQ(''); setHi(0); setOpen(true); };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', place, true);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', place, true);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useLayoutEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  const pick = (o) => { onChange(o); setOpen(false); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hi]) pick(filtered[hi]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const btnBg = disabled ? 'bg-[#DCD7C9]/50' : 'bg-[#DCD7C9]';
  const btnBorder = disabled
    ? 'border-[#C8C3B8]'
    : open
      ? 'border-[#A27B5C]'
      : 'border-[#A27B5C]/33';
  const btnColor = disabled ? 'text-[#B0AA9E]' : (value ? 'text-[#2C3930]' : 'text-[#B0AA9E]');
  const btnSize = lg
    ? 'rounded-[9px] px-[15px] py-[13px] text-[15px]'
    : 'rounded-lg px-3 py-2.5 text-sm';
  const btnState = disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-activedescendant={open && filtered[hi] ? optionId(hi) : undefined}
        onClick={() => (open ? setOpen(false) : openIt())}
        disabled={disabled}
        className={[
          'w-full text-left flex items-center justify-between gap-2 transition-colors border',
          btnSize, btnBg, btnBorder, btnColor, btnState,
        ].join(' ')}
      >
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">
          {value || placeholder}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 16 16"
          fill="none" stroke="#2C3930" strokeWidth="1.5"
          className={`flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="4 6 8 10 12 6"/>
        </svg>
      </button>

      {open && rect && (
        <div
          ref={popRef}
          className="fixed z-[9999] bg-[#EDE9E1] border border-[#C8C3B8] rounded-xl shadow-2xl flex flex-col max-h-80 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{ top: rect.bottom + 5, left: rect.left, width: Math.max(rect.width, 230) }}
        >
          <div className="p-[9px] border-b border-[#C8C3B8] relative">
            <svg
              width="15" height="15" viewBox="0 0 24 24"
              fill="none" stroke="#B0AA9E" strokeWidth="2" strokeLinecap="round"
              className="absolute left-[19px] top-1/2 -translate-y-1/2"
            >
              <circle cx="11" cy="11" r="7"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={inputRef}
              value={q}
              onChange={e => { setQ(e.target.value); setHi(0); }}
              onKeyDown={onKey}
              placeholder="Search…"
              aria-label={placeholder || 'Search options'}
              aria-autocomplete="list"
              aria-controls={listboxId}
              className="w-full pl-8 pr-3 py-2.5 border border-[#A27B5C]/25 rounded-lg bg-[#DCD7C9] text-sm text-[#2C3930] outline-none"
            />
          </div>
          <div id={listboxId} role="listbox" aria-label={placeholder || 'Options'} className="overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-[14px] py-4 text-[13px] text-[#B0AA9E] text-center">
                No matches
              </div>
            ) : filtered.map((o, i) => (
              <div
                key={o}
                id={optionId(i)}
                role="option"
                aria-selected={o === value}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(o)}
                className={[
                  'px-3.5 py-2.5 cursor-pointer text-sm flex items-center justify-between gap-2',
                  o === value
                    ? 'bg-[#2C3930] text-[#DCD7C9]'
                    : i === hi
                      ? 'bg-[#DCD7C9] text-[#2C3930]'
                      : 'text-[#2C3930]',
                ].join(' ')}
              >
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{o}</span>
                {o === value && (
                  <svg
                    width="15" height="15" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor"
                    strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                    className="flex-shrink-0"
                  >
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
            ))}
            {overflow > 0 && (
              <div className="px-[14px] py-[9px] text-[11.5px] text-[#B0AA9E] text-center border-t border-[#C8C3B8]">
                +{overflow.toLocaleString()} more — keep typing to narrow
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export { Combobox }
