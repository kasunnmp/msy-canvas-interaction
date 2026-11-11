import type { ReactNode } from 'react';
import { DOCK_TARGETS, type AppId, type DockSlot } from '../apps';

import avatarBase from '../assets/dock/a156c.png';
import avatarGlow from '../assets/dock/ee361.png';
import micIcon from '../assets/dock/c6fd9.svg';
import cursorSparkIcon from '../assets/dock/36847.svg';
import pillDivider from '../assets/dock/926cc.svg';
import searchIcon from '../assets/dock/cc112.svg';
import diamondApp from '../assets/dock/899d7.png';
import tileApp from '../assets/dock/7a402.png';
import messagesApp from '../assets/dock/264ec.png';
import folderIcon from '../assets/dock/f137e.svg';
import gridCalendarA from '../assets/dock/793e1.png';
import gridCalendarB from '../assets/dock/35536.png';
import gridFlow from '../assets/dock/f6c66.png';
import gridStarA from '../assets/dock/d01da.png';
import gridStarB from '../assets/dock/2b9e4.png';
import gridNews from '../assets/dock/fd006.png';
import sectionDivider from '../assets/dock/63318.svg';
import trashBody from '../assets/dock/2ff83.svg';
import recycleIcon from '../assets/dock/7f1da.svg';
import paperMask from '../assets/dock/dbcbb.svg';
import paperA from '../assets/dock/fe805.png';
import paperB from '../assets/dock/3bab8.png';
import paperC from '../assets/dock/ac059.png';
import profileA from '../assets/dock/68c98.png';
import profileB from '../assets/dock/1a462.png';
import activeDot from '../assets/dock/455ba.svg';

interface Props {
  activeApp: AppId | null;
  onOpen: (slot: DockSlot) => void;
  launcherOpen: boolean;
  onOpenLauncher: () => void;
}

function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`badge ${className}`}>{children}</span>;
}

/** A clickable dock slot that sends the camera to its app. */
function DockButton({
  slot,
  activeApp,
  onOpen,
  label,
  className,
  children,
}: {
  slot: DockSlot;
  activeApp: AppId | null;
  onOpen: (slot: DockSlot) => void;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const active = activeApp === DOCK_TARGETS[slot];
  return (
    <button
      type="button"
      className={`dock-btn ${className ?? ''}${active ? ' is-active' : ''}`}
      onClick={() => onOpen(slot)}
      aria-label={`Open ${label}`}
      aria-pressed={active}
      title={label}
    >
      {children}
      <img className="dock-btn__dot" src={activeDot} alt="" width={4} height={4} />
    </button>
  );
}

const PAPERS = [
  { box: [2.57, 1.92, 26.038, 26.349], rot: -14.59, skew: 0.19, back: [21.178, 21.734, -2.11, -2.624], inner: [4.24, 3.58, 22.528, 22.377, 18.446, 18.338, -3.779, -4.282], img: paperA },
  { box: [14.55, -0.24, 24.045, 24.462], rot: 8.01, skew: -0.11, back: [21.185, 21.728, -14.092, -0.46], inner: [16.19, 1.3, 20.859, 20.72, 18.451, 18.333, -15.733, -1.995], img: paperB },
  { box: [19.49, 1.63, 25.938, 26.254], rot: 14.22, skew: -0.18, back: [21.179, 21.734, -19.026, -2.327], inner: [21.32, 3.28, 22.444, 22.294, 18.446, 18.338, -20.857, -3.979], img: paperC },
  { box: [28.15, 7.33, 22.555, 23.038], rot: -3.68, skew: 0.05, back: [21.187, 21.725, -27.693, -8.034], inner: [29.61, 8.78, 19.606, 19.475, 18.453, 18.331, -29.145, -9.477], img: paperC },
] as const;

function Trash() {
  const maskBase = {
    maskImage: `url(${paperMask})`,
    WebkitMaskImage: `url(${paperMask})`,
    maskSize: '54.327px 15.555px',
    WebkitMaskSize: '54.327px 15.555px',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
  } as const;
  return (
    <div className="trash" aria-hidden>
      <div className="trash__block" style={{ background: '#5d5d5d', left: 11.05, top: 24.86, width: 24.862, height: 25.782 }} />
      <div className="trash__block" style={{ background: '#9ab4f6', left: 19.34, top: 19.34, width: 19.337, height: 20.258 }} />
      <div className="trash__block" style={{ background: '#fff', left: 8.29, top: 20.26, width: 19.337, height: 20.258 }} />
      <div className="trash__block" style={{ background: '#8897bb', left: 28.54, top: 20.26, width: 19.337, height: 20.258 }} />
      <div className="trash__block" style={{ background: '#92bdb8', left: 24.86, top: 27.62, width: 19.337, height: 20.258 }} />
      <div className="trash__body">
        <img src={trashBody} alt="" />
      </div>
      <img className="trash__recycle" src={recycleIcon} alt="" />
      {PAPERS.map((p, i) => (
        <div key={i}>
          <div className="trash__paper" style={{ left: p.box[0], top: p.box[1], width: p.box[2], height: p.box[3] }}>
            <div style={{ transform: `rotate(${p.rot}deg) skewX(${p.skew}deg)` }}>
              <div
                style={{
                  ...maskBase,
                  background: '#fff',
                  width: p.back[0],
                  height: p.back[1],
                  maskPosition: `${p.back[2]}px ${p.back[3]}px`,
                  WebkitMaskPosition: `${p.back[2]}px ${p.back[3]}px`,
                }}
              />
            </div>
          </div>
          <div className="trash__paper" style={{ left: p.inner[0], top: p.inner[1], width: p.inner[2], height: p.inner[3] }}>
            <div style={{ transform: `rotate(${p.rot}deg) skewX(${p.skew}deg)` }}>
              <div
                style={{
                  ...maskBase,
                  position: 'relative',
                  width: p.inner[4],
                  height: p.inner[5],
                  maskPosition: `${p.inner[6]}px ${p.inner[7]}px`,
                  WebkitMaskPosition: `${p.inner[6]}px ${p.inner[7]}px`,
                  background: `#fff url(${p.img}) center / cover no-repeat`,
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Figma: Dynamic Dock 2487:15944 */
export function Dock({ activeApp, onOpen, launcherOpen, onOpenLauncher }: Props) {
  return (
    <nav className="dock" aria-label="Dock">
      <div className="dock__glass" aria-hidden>
        <div className="dock__glass-dodge" />
        <div className="dock__glass-blur" />
      </div>
      <div className="dock__darker" aria-hidden />

      <div className="dock__row">
        {/* Ask Maisey */}
        <div className="dock__maisey-wrap">
          <div className="maisey-pill">
            <div className="maisey-pill__avatar">
              <span className="maisey-pill__avatar-bg" />
              <img className="maisey-pill__avatar-img" src={avatarBase} alt="" />
              <span className="maisey-pill__avatar-glow">
                <img src={avatarGlow} alt="" />
              </span>
              <span className="maisey-pill__avatar-ring" />
            </div>
            <div className="maisey-pill__text">Ask Maisey</div>
            <div className="maisey-pill__actions">
              <div className="maisey-pill__mic">
                <img src={micIcon} alt="" width={23.77} height={30.46} />
              </div>
              <div className="maisey-pill__spark">
                <img src={cursorSparkIcon} alt="" />
              </div>
              <div className="maisey-pill__divider">
                <img src={pillDivider} alt="" />
              </div>
            </div>
          </div>
        </div>

        <div className="dock__apps">
          <div className="dock__app-group">
            <div className="dock__icons">
              <div className="dock__search" aria-label="Search">
                <img src={searchIcon} alt="" width={44} height={55} />
              </div>
              <DockButton slot="diamond" label="Action Hub" activeApp={activeApp} onOpen={onOpen}>
                <span className="app-icon">
                  <img src={diamondApp} alt="" />
                </span>
              </DockButton>
              <DockButton slot="tile" label="Reports" activeApp={activeApp} onOpen={onOpen}>
                <span className="app-icon">
                  <img src={tileApp} alt="" />
                </span>
              </DockButton>
              <DockButton slot="messages" label="Internal Chat" activeApp={activeApp} onOpen={onOpen}>
                <span className="app-icon">
                  <img src={messagesApp} alt="" />
                </span>
                <Badge className="badge--app">5</Badge>
              </DockButton>
              <DockButton slot="folder" label="Foxtale Studio" activeApp={activeApp} onOpen={onOpen} className="dock-btn--folder">
                <img src={folderIcon} alt="" width={54} height={52} />
              </DockButton>
            </div>

            <button
              type="button"
              className={`dock-btn dock-btn--grid${launcherOpen ? ' is-active' : ''}`}
              onClick={onOpenLauncher}
              aria-label="Open App Launcher"
              aria-expanded={launcherOpen}
              title="App Launcher (Ctrl/⌘ O)"
            >
              <span className="grid-stack">
                <span className="grid-stack__bg grid-stack__bg--back" />
                <span className="grid-stack__bg grid-stack__bg--mid" />
                <span className="grid-stack__front">
                  <span className="grid-stack__row">
                    <span className="mini-icon">
                      <img src={gridCalendarA} alt="" />
                      <img src={gridCalendarB} alt="" />
                    </span>
                    <span className="mini-icon">
                      <img src={gridFlow} alt="" />
                    </span>
                  </span>
                  <span className="grid-stack__row">
                    <span className="mini-icon">
                      <img src={gridStarA} alt="" />
                      <img src={gridStarB} alt="" />
                    </span>
                    <span className="mini-icon">
                      <img src={gridNews} alt="" />
                    </span>
                  </span>
                </span>
              </span>
              <img className="dock-btn__dot" src={activeDot} alt="" width={4} height={4} />
            </button>

            <div className="dock__divider" aria-hidden>
              <img src={sectionDivider} alt="" />
            </div>

            <Trash />
          </div>

          <DockButton slot="people" label="Maisey Minions chat" activeApp={activeApp} onOpen={onOpen} className="dock-btn--people">
            <span className="dock__people">
              <img src={profileA} alt="" width={44} height={44} />
              <Badge className="badge--people">5</Badge>
              <img src={profileB} alt="" width={44} height={44} />
            </span>
          </DockButton>
        </div>
      </div>

      <div className="dock__edge dock__edge--lt" aria-hidden />
      <div className="dock__edge dock__edge--rb" aria-hidden />
      <div className="dock__inner-glow" aria-hidden />
    </nav>
  );
}
