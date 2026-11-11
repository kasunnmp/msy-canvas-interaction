import { APPS, person, type AppRef, type Seg } from './model';

/** Stacked image layers (Figma avatars/logos are several fills on one circle). */
export function Layers({ srcs, className }: { srcs: string[]; className?: string }) {
  return (
    <span className={`mc-layers${className ? ` ${className}` : ''}`} aria-hidden>
      {srcs.map((s, i) => <img key={i} src={s} alt="" />)}
    </span>
  );
}

/** Figma Name-tag · Type=Person (519:11902). `onBlue` = inside a user bubble. */
export function NameTag({ id }: { id: string }) {
  const p = person(id);
  return (
    <span className="mc-tag" contentEditable={false}>
      <Layers srcs={p.avatar} className="mc-tag__av" />
      {p.name}
    </span>
  );
}

/** Figma Name-tag · Type=Application (565:6079). */
export function AppTag({ id, label }: { id: AppRef['id']; label?: string }) {
  const a = APPS[id];
  return (
    <span className="mc-tag mc-tag--app">
      <Layers srcs={a.logo} className="mc-tag__logo" />
      {label ?? a.name}
    </span>
  );
}

/** Text is split into words so name-tags wrap inline with it inside flex-wrap rows. */
export const Words = ({ v }: { v: string }) => (
  <>
    {v.split(/(?<=\s)/).map((w, i) => (
      <span key={i} className="mc-w">{w}</span>
    ))}
  </>
);

export function Rich({ segs }: { segs: Seg[] }) {
  return (
    <>
      {segs.map((s, i) =>
        s.t === 'person' ? <NameTag key={i} id={s.id} /> : s.t === 'app' ? <AppTag key={i} id={s.id} label={s.label} /> : <Words key={i} v={s.v} />,
      )}
    </>
  );
}

export function AvatarStack({ ids, max = 3 }: { ids: string[]; max?: number }) {
  const shown = ids.slice(0, max);
  return (
    <span className="mc-stack">
      <span className="mc-stack__avs">
        {shown.map((id, i) => (
          <span key={id} style={{ zIndex: max - i }} className="mc-stack__slot">
            <Layers srcs={person(id).avatar} className="mc-stack__av" />
          </span>
        ))}
      </span>
      {ids.length > max && <span className="mc-stack__more">+{ids.length - max} people</span>}
    </span>
  );
}
