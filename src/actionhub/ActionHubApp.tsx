import { useEffect, useRef } from 'react';
import { ActionHubProvider, useHub } from './store';
import { Sidebar } from './Sidebar';
import { AllFeed, Header, ListView, SectionView, Summary } from './Views';
import { TaskDetail } from './Detail';
import { DeleteListModal, FeedbackCard, ListModal, MaiseyFlow, MoveModal, NewTaskModal } from './Modals';
import { I, ListIcon } from './ui';
import './actionhub.css';

function Toasts() {
  const hub = useHub();
  return (
    <div className="ah-toasts" aria-live="polite">
      {hub.toasts.map((t) => (
        <div key={t.id} className="ah-toast" role="status">
          {t.icon && <ListIcon icon={t.icon} size={18} />}
          <span className="ah-toast__text">{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="ah-toast__action"
              onClick={() => {
                t.action!.run();
                hub.dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" className="ah-toast__x" aria-label="Dismiss" onClick={() => hub.dismissToast(t.id)}>
            {I.close}
          </button>
        </div>
      ))}
    </div>
  );
}

function Shell() {
  const hub = useHub();
  const root = useRef<HTMLDivElement>(null);
  const { view, modal } = hub;

  // §6.1 shortcuts — only while focus is inside Action Hub.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 't') hub.setModal({ kind: 'newTask', mode: 'task' });
      else if (k === 'b') hub.setModal({ kind: 'newTask', mode: 'brain' });
      else if (k === 'l') hub.canCreateList ? hub.setModal({ kind: 'newList' }) : hub.toast({ text: 'You’ve reached 10 lists.' });
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [hub]);

  return (
    <div ref={root} className="ah" tabIndex={-1}>
      <div className="ah__bg" aria-hidden />
      <Sidebar />
      <main className="ah-main">
        <Header />
        <div key={JSON.stringify(view)} className="ah-view">
          {view.kind === 'all' && <AllFeed />}
          {view.kind === 'section' && <SectionView id={view.id} />}
          {view.kind === 'list' && <ListView id={view.id} />}
        </div>
      </main>
      <Summary />
      {hub.detailId && <TaskDetail id={hub.detailId} />}
      {modal?.kind === 'newTask' && <NewTaskModal key={modal.mode} mode={modal.mode} listId={modal.listId} />}
      {modal?.kind === 'maisey' && <MaiseyFlow text={modal.text} listId={modal.listId} />}
      {modal?.kind === 'newList' && <ListModal moveItemIds={modal.moveItemIds} />}
      {modal?.kind === 'editList' && <ListModal editId={modal.listId} />}
      {modal?.kind === 'deleteList' && <DeleteListModal listId={modal.listId} />}
      {modal?.kind === 'move' && <MoveModal itemIds={modal.itemIds} />}
      <FeedbackCard />
      <Toasts />
    </div>
  );
}

/** Live Action Hub window on the canvas (replaces the static Figma image). */
export function ActionHubApp() {
  return (
    <ActionHubProvider>
      <Shell />
    </ActionHubProvider>
  );
}
