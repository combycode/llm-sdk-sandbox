import { useState } from 'react';
import { useEngine } from '../../state/EngineContext';

/** Saved chat members — rename (edit icon) or delete each. Click the @name to
 *  switch the active model to it. Persisted in localStorage. */
export function ContactsSection() {
  const { members, renameMember, removeMember, setSelectedModel } = useEngine();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (members.length === 0) return null;

  const startEdit = (model: string, name: string) => {
    setEditing(model);
    setDraft(name);
  };
  const commit = (model: string) => {
    const n = draft.trim().replace(/[^A-Za-z0-9_]/g, '');
    if (n) renameMember(model, n);
    setEditing(null);
  };

  return (
    <div className="contacts">
      <h4>Chat members</h4>
      {members.map((m) => (
        <div key={m.model} className="contact-row">
          {editing === m.model ? (
            <input
              className="contact-edit"
              // biome-ignore lint/a11y/noAutofocus: focus the field the user just opened
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commit(m.model)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit(m.model);
                if (e.key === 'Escape') setEditing(null);
              }}
            />
          ) : (
            <button
              type="button"
              className="contact-name"
              onClick={() => setSelectedModel(m.model)}
              title={`use ${m.model}`}
            >
              @{m.name}
            </button>
          )}
          <span className="contact-model" title={m.model}>
            {m.model.split('/').slice(1).join('/') || m.model}
          </span>
          <button
            type="button"
            className="contact-icon"
            onClick={() => startEdit(m.model, m.name)}
            title="Rename"
          >
            ✎
          </button>
          <button
            type="button"
            className="contact-icon"
            onClick={() => removeMember(m.model)}
            title="Delete"
          >
            🗑
          </button>
        </div>
      ))}
    </div>
  );
}
