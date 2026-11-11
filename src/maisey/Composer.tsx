import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { PEOPLE, type Seg } from './model';
import { NameTag, Layers, Words } from './parts';
import addIcon from './assets/add.svg';
import historyIcon from './assets/history.svg';
import micIcon from './assets/mic-ai.svg';
import sendIcon from './assets/send.svg';

export interface ComposerHandle {
  focus(): void;
  /** Composer has nothing typed. */
  isEmpty(): boolean;
}

interface Props {
  busy: boolean;
  /** A question card is waiting: typed text answers it ("or type above"). */
  onSend(segs: Seg[]): void;
  onStop(): void;
  onHistory(): void;
  onPlus(): void;
  onKeyNav?(e: KeyboardEvent<HTMLInputElement>): boolean;
  placeholder?: string;
}

const useVoice = (onText: (t: string) => void) => {
  const [on, setOn] = useState(false);
  const rec = useRef<{ stop(): void } | null>(null);
  type Rec = { interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start(): void; stop(): void };
  const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  const toggle = () => {
    if (!Ctor) return false;
    if (on) { rec.current?.stop(); return true; }
    const r = new Ctor();
    r.interimResults = false;
    r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0].transcript).join(' '));
    r.onend = () => setOn(false);
    r.start();
    rec.current = r;
    setOn(true);
    return true;
  };
  return { on, toggle, supported: !!Ctor };
};

let measureCtx: CanvasRenderingContext2D | null = null;
const textWidth = (s: string) => {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return s.length * 7.5;
  measureCtx.font = '400 15px Inter, system-ui, sans-serif';
  return measureCtx.measureText(s).width;
};

/** Figma: "Ask Maisey" input (746:16285) — text + @mention name-tags, + / history / mic · send · stop. */
export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ busy, onSend, onStop, onHistory, onPlus, onKeyNav, placeholder = 'Ask anything' }, ref) {
  const [segs, setSegs] = useState<Seg[]>([]);
  const [value, setValue] = useState('');
  const [hi, setHi] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const [popLeft, setPopLeft] = useState(0);
  const voice = useVoice((t) => setValue((v) => (v ? `${v} ${t}` : t)));

  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus({ preventScroll: true }), isEmpty: () => !segs.length && !value.trim() }), [segs, value]);

  const mention = /(^|\s)@([A-Za-z]*)$/.exec(value);
  const query = mention && dismissed !== value ? mention[2].toLowerCase() : null;
  const matches = useMemo(
    () => (query === null ? [] : PEOPLE.filter((p) => p.name.toLowerCase().split(' ').some((w) => w.startsWith(query)) || p.name.toLowerCase().startsWith(query)).slice(0, 5)),
    [query],
  );
  useEffect(() => setHi(0), [query]);

  // Popover follows the "@" (Figma places it right above the typed handle).
  useLayoutEffect(() => {
    if (!mention || !input.current || !row.current) return;
    const at = value.length - mention[2].length - 1;
    const x = input.current.offsetLeft + textWidth(value.slice(0, at)) - input.current.scrollLeft;
    setPopLeft(Math.max(0, Math.min(x - 6, row.current.clientWidth - 203)));
  }, [value, mention]);

  const pick = (id: string) => {
    if (!mention) return;
    const before = value.slice(0, value.length - mention[2].length - 1);
    setSegs((s) => [...s, ...(before ? [{ t: 'text', v: before } as Seg] : []), { t: 'person', id }]);
    setValue(' ');
    requestAnimationFrame(() => input.current?.focus());
  };

  const content = (): Seg[] => {
    const out: Seg[] = [...segs];
    // Unmatched "@Name" handles stay as typed — they fail recipient resolution later (§5.8).
    const parts = value.split(/(@[A-Za-z]+)/);
    for (const p of parts) if (p) out.push(/^@[A-Za-z]+$/.test(p) ? { t: 'raw', v: p } : { t: 'text', v: p });
    return out;
  };
  const hasContent = segs.length > 0 || value.trim().length > 0;

  const send = () => {
    if (!hasContent || busy) return;
    onSend(content());
    setSegs([]);
    setValue('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (matches.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => (h + 1) % matches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => (h - 1 + matches.length) % matches.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(matches[hi].id); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDismissed(value); return; }
    }
    if (!hasContent && onKeyNav?.(e)) return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); return; }
    if (e.key === 'Backspace' && !value && segs.length) {
      e.preventDefault();
      const last = segs[segs.length - 1];
      setSegs(segs.slice(0, -1));
      if (last.t === 'text') setValue(last.v.slice(0, -1));
    }
  };

  return (
    <div className="mc-input" onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); input.current?.focus(); } }}>
      {matches.length > 0 && (
        <div className="mc-people" role="listbox" aria-label="People" style={{ left: popLeft + 8 }}>
          <div className="mc-people__label">People</div>
          {matches.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={i === hi}
              className={`mc-people__row${i === hi ? ' is-hi' : ''}`}
              onMouseMove={() => setHi(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(p.id); }}
            >
              <Layers srcs={p.avatar} className="mc-people__av" />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}
      <div ref={row} className="mc-input__text" onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); input.current?.focus(); } }}>
        {segs.map((s, i) =>
          s.t === 'person' ? <NameTag key={i} id={s.id} /> : s.t === 'text' || s.t === 'raw' ? <Words key={i} v={s.v} /> : null,
        )}
        <input
          ref={input}
          value={value}
          onChange={(e) => { setValue(e.target.value); setDismissed(null); }}
          onKeyDown={onKey}
          placeholder={segs.length ? '' : placeholder}
          aria-label="Ask Maisey"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="mc-input__bar">
        <button type="button" className="mc-ibtn mc-ibtn--add" aria-label="Add" onClick={onPlus}>
          <img src={addIcon} alt="" width={24} height={24} />
        </button>
        <div className="mc-input__right">
          <button type="button" className="mc-ibtn" aria-label="Chat history" onClick={onHistory}>
            <img src={historyIcon} alt="" width={24} height={24} />
          </button>
          {busy ? (
            <button type="button" className="mc-ibtn mc-ibtn--dark" aria-label="Stop generating" onClick={onStop}>
              <span className="mc-stop" />
            </button>
          ) : hasContent ? (
            <button type="button" className="mc-ibtn mc-ibtn--dark" aria-label="Send" onClick={send}>
              <img src={sendIcon} alt="" width={24} height={24} />
            </button>
          ) : (
            <button
              type="button"
              className={`mc-ibtn mc-ibtn--mic${voice.on ? ' is-on' : ''}`}
              aria-label={voice.on ? 'Stop dictation' : 'Dictate'}
              aria-pressed={voice.on}
              title={voice.supported ? 'Dictate' : 'Voice input isn’t supported in this browser'}
              onClick={() => voice.toggle()}
            >
              <img src={micIcon} alt="" width={24} height={24} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
