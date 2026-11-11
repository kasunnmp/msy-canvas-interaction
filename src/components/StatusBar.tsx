import statusBg from '../assets/status/5b733.png';
import layersIcon from '../assets/status/3cbc2.svg';
import hubTags from '../assets/status/29f6c.svg';
import bellIcon from '../assets/status/a5065.svg';
import graphIcon from '../assets/status/89052.svg';
import powerIcon from '../assets/status/4f5de.svg';
import settingsIcon from '../assets/status/cec31.svg';

interface Props {
  overview: boolean;
  onToggleOverview: () => void;
}

/** Figma: Status Bar 2487:15926 */
export function StatusBar({ overview, onToggleOverview }: Props) {
  return (
    <div className="status-bar">
      <div className="status-bar__bg" aria-hidden>
        <img src={statusBg} alt="" />
      </div>

      <div className="status-bar__left">
        <div className="status-bar__icon-frame">
          <button
            type="button"
            className={`round-icon round-icon--filled${overview ? ' is-active' : ''}`}
            onClick={onToggleOverview}
            aria-pressed={overview}
            aria-label="Canvas overview"
            title="Canvas overview (O)"
          >
            <span className="round-icon__glyph round-icon__glyph--layers">
              <img src={layersIcon} alt="" />
            </span>
          </button>
        </div>
      </div>

      <div className="status-bar__right">
        <div className="status-bar__date-group">
          <div className="status-bar__date">{'Wed 2 Jul  10:19 '}</div>
          <div className="status-bar__settings">
            <span className="round-icon round-icon--p3">
              <img src={settingsIcon} alt="" width={24} height={24} />
            </span>
          </div>
          <div className="status-bar__power">
            <span className="round-icon">
              <img src={powerIcon} alt="" width={20} height={20} />
            </span>
          </div>
        </div>

        <div className="status-bar__notifications">
          <div className="status-bar__metrics">
            <div className="notif-btn notif-btn--hub">
              <div className="notif-btn__pill notif-btn__pill--hub">
                <img src={hubTags} alt="" width={24} height={10} />
                <span>5</span>
              </div>
              <div className="notif-btn__icon">
                <span className="notif-btn__icon-pad">
                  <img src={graphIcon} alt="" width={22} height={22} />
                </span>
              </div>
            </div>
          </div>
          <div className="status-bar__alerts">
            <div className="notif-btn notif-btn--alert">
              <div className="notif-btn__pill">
                <span>6</span>
              </div>
              <div className="notif-btn__icon">
                <img src={bellIcon} alt="" width={22} height={22} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
