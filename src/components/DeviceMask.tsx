import cornerLeft from '../assets/mask/5a119.svg';
import cornerRight from '../assets/mask/84227.svg';

/** Figma: Mask 2487:15912 — the display bezel (side rules + rounded bottom corners). */
export function DeviceMask() {
  return (
    <div className="device-mask" aria-hidden>
      <div className="device-mask__sides">
        <span className="device-mask__rule" />
        <span className="device-mask__rule" />
      </div>
      <div className="device-mask__footer">
        <img src={cornerLeft} alt="" width={38.133} height={51} />
        <span className="device-mask__bottom" />
        <img className="device-mask__corner-r" src={cornerRight} alt="" width={38.133} height={51} />
      </div>
    </div>
  );
}
