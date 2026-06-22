const TABS = [
  { id: 'chat', label: 'Chat', enabled: true },
  { id: 'agents', label: 'Agents — later', enabled: false },
];

export function Tabs({ active, onChange }: { active: string; onChange: (tab: string) => void }) {
  return (
    <div className="tabs">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tab${active === t.id ? ' active' : ''}`}
          disabled={!t.enabled}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
