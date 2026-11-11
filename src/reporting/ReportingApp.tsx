import { useEffect, useState } from 'react';
import { ReportingProvider, useReporting } from './state/store';
import { Sidebar } from './ui/Sidebar';
import { ReportPreview } from './ui/ReportPreview';
import { Builder } from './ui/Builder';
import { StazyChat } from './ui/StazyChat';
import { InfoModal, ShareModal, TemplatesModal, TrashDialog } from './ui/Modals';
import { Icon } from './ui/common';
import './reporting.css';

function Toasts() {
  const { state, cancelToast, dispatch } = useReporting();
  return (
    <div className="r-toasts" aria-live="polite">
      {state.toasts.map((t) => (
        <div key={t.id} className={`r-toast is-${t.kind}`} role="status">
          {t.kind === 'progress' ? <span className="r-spinner" aria-hidden /> : t.kind === 'success' ? <span className="r-toast__check">{Icon.check}</span> : null}
          <span className="r-toast__text">{t.text}</span>
          {t.cancellable ? (
            <button type="button" className="r-link" onClick={() => cancelToast(t.id)}>
              Cancel
            </button>
          ) : (
            <button type="button" className="r-toast__x" aria-label="Dismiss" onClick={() => dispatch({ type: 'dismissToast', id: t.id })}>
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** §21 First-time empty state. */
function EmptyState({ onNew, onTemplates }: { onNew: () => void; onTemplates: () => void }) {
  return (
    <div className="r-empty">
      <div className="r-empty__card">
        <div className="r-empty__media" aria-hidden>
          <div className="r-empty__table">
            <div className="r-empty__row r-empty__row--head">
              <span>Name</span>
              <span>Source</span>
              <span>Created on</span>
              <span>Viewed on</span>
            </div>
            {['Reporting', 'Action hub', 'Apollo', 'Reporting'].map((n, i) => (
              <div key={i} className="r-empty__row">
                <span>{n}</span>
                <span>Apollo</span>
                <span>Nov 18, 2025</span>
                <span>Nov 18, 2025</span>
              </div>
            ))}
          </div>
        </div>
        <h3>Build your first report</h3>
        <p>Track sign-ins, revenue, or anything else your connected apps hold.</p>
        <div className="r-empty__actions">
          <button type="button" className="r-btn r-btn--primary r-btn--lg" onClick={onNew}>
            New Report
          </button>
          <button type="button" className="r-btn r-btn--lg" onClick={onTemplates}>
            Browse Templates
          </button>
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const { state, dispatch, active } = useReporting();
  const [creatingName, setCreatingName] = useState<string | null>(null);

  useEffect(() => {
    const on = (e: Event) => setCreatingName((e as CustomEvent).detail as string | null);
    window.addEventListener('stazy:creating', on);
    return () => window.removeEventListener('stazy:creating', on);
  }, []);

  const card = active && !active.inTrash ? active : null;
  const hasMine = state.reports.some((r) => r.category === 'mine' && !r.inTrash);
  const builder = state.mode === 'builder' && state.draft && card;

  const newReport = () => {
    dispatch({ type: 'chat', open: true });
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('stazy:new')), 0);
  };
  const templates = () => dispatch({ type: 'modal', modal: { kind: 'templates' } });

  const exitBuilder = () => {
    if (state.draft?.dirty) dispatch({ type: 'modal', modal: { kind: 'leave' } });
    else dispatch({ type: 'closeBuilder' });
  };

  return (
    <div className={`ra${state.chatOpen ? ' has-chat' : ''}${builder ? ' is-builder' : ''}`}>
      <div className="ra-sheet">
        <div className="ra-sheet__bg" aria-hidden />
        {builder ? (
          <Builder card={card} onExit={exitBuilder} />
        ) : (
          <div className="ra-body">
            <Sidebar onNewReport={newReport} onBrowseTemplates={templates} creatingName={creatingName} />
            <div className="ra-main">
              {card ? (
                <ReportPreview key={card.id} card={card} />
              ) : !hasMine ? (
                <EmptyState onNew={newReport} onTemplates={templates} />
              ) : (
                <div className="r-empty">
                  <p className="r-empty__hint">Pick a report from the list.</p>
                </div>
              )}
            </div>
          </div>
        )}
        <Toasts />
        {card && state.modal?.kind === 'share' && <ShareModal card={card} />}
        {card && state.modal?.kind === 'info' && <InfoModal card={card} tab={state.modal.tab} />}
        {card && state.modal?.kind === 'trash' && (
          <TrashDialog
            card={card}
            onTrashed={() => {
              const next = state.reports.find((r) => r.id !== card.id && !r.inTrash && r.category === 'mine');
              dispatch({ type: 'select', id: next?.id ?? null });
            }}
          />
        )}
        {state.modal?.kind === 'templates' && (
          <TemplatesModal
            onUse={(r) => {
              dispatch({ type: 'addReport', report: r });
              dispatch({ type: 'select', id: r.id });
            }}
          />
        )}
      </div>
      {state.chatOpen && <StazyChat onClose={() => dispatch({ type: 'chat', open: false })} />}
    </div>
  );
}

/** The live Reporting app window that sits on the canvas (replaces the static Figma image). */
export function ReportingApp() {
  return (
    <ReportingProvider>
      <Shell />
    </ReportingProvider>
  );
}
