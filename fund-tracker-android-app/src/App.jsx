import React, { useState, useEffect, useMemo } from 'react';
import {
  Home, Users, CalendarDays, Wallet, Plus, X, Trash2, Settings as SettingsIcon,
  ChevronLeft, ChevronRight, Loader2, AlertTriangle, Check
} from 'lucide-react';
import { getItem, setItem } from './storage.js';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_LABELS[m - 1]} ${y}`;
}

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthsBetween(fromKey, toKey) {
  const [ay, am] = fromKey.split('-').map(Number);
  const [by, bm] = toKey.split('-').map(Number);
  const diff = (by - ay) * 12 + (bm - am) + 1;
  return diff > 0 ? diff : 0;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
}

function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function money(n, symbol) {
  const v = Number(n) || 0;
  return `${symbol}${v.toLocaleString('en-IN')}`;
}

const DEFAULT_SETTINGS = { groupName: 'Friends Fund', monthlyDue: 500, currency: '\u20B9' };

export default function FundTracker() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('dashboard');

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [payFor, setPayFor] = useState(null);

  useEffect(() => { loadAll(); }, []);

  async function safeGet(key) {
    return getItem(key);
  }

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [s, m, c, e] = await Promise.all([
        safeGet('settings'), safeGet('members'), safeGet('contributions'), safeGet('expenses')
      ]);
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) });
      if (m) setMembers(JSON.parse(m));
      if (c) setContributions(JSON.parse(c));
      if (e) setExpenses(JSON.parse(e));
    } catch (err) {
      setError('Could not load your fund data. Pull to retry.');
    }
    setLoading(false);
  }

  async function persist(key, value, setter) {
    setter(value);
    const ok = await setItem(key, JSON.stringify(value));
    if (!ok) setError('Save failed. Your change may not stick around.');
  }

  const totalCollected = useMemo(() => contributions.reduce((s, c) => s + Number(c.amount), 0), [contributions]);
  const totalSpent = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const balance = totalCollected - totalSpent;

  const memberStats = useMemo(() => {
    return members.map(m => {
      const mine = contributions.filter(c => c.memberId === m.id);
      const paidTotal = mine.reduce((s, c) => s + Number(c.amount), 0);
      const monthsActive = monthsBetween(m.joinedMonth || currentMonthKey(), currentMonthKey());
      const expected = monthsActive * Number(settings.monthlyDue);
      const due = Math.max(0, expected - paidTotal);
      return { ...m, paidTotal, due, monthsActive };
    });
  }, [members, contributions, settings.monthlyDue]);

  const monthEntries = useMemo(() => {
    return members.map(m => {
      const mine = contributions.filter(c => c.memberId === m.id && c.month === selectedMonth);
      const paid = mine.reduce((s, c) => s + Number(c.amount), 0);
      let status = 'pending';
      if (paid >= Number(settings.monthlyDue) && paid > 0) status = 'paid';
      else if (paid > 0) status = 'partial';
      return { member: m, entries: mine, paid, status };
    });
  }, [members, contributions, selectedMonth, settings.monthlyDue]);

  const monthCollected = monthEntries.reduce((s, e) => s + e.paid, 0);
  const monthPaidCount = monthEntries.filter(e => e.status === 'paid').length;

  const activity = useMemo(() => {
    const rows = [
      ...contributions.map(c => ({
        id: 'c-' + c.id, date: c.date, amount: Number(c.amount), kind: 'in',
        label: `${members.find(m => m.id === c.memberId)?.name || 'Member'} paid`,
        sub: monthLabel(c.month)
      })),
      ...expenses.map(e => ({
        id: 'e-' + e.id, date: e.date, amount: Number(e.amount), kind: 'out',
        label: e.desc, sub: e.category || 'Expense'
      }))
    ];
    rows.sort((a, b) => (a.date < b.date ? 1 : -1));
    return rows;
  }, [contributions, expenses, members]);

  async function addMember(name, joinedMonth) {
    const list = [...members, { id: newId(), name: name.trim(), joinedMonth }];
    await persist('members', list, setMembers);
  }

  async function removeMember(id) {
    await persist('members', members.filter(m => m.id !== id), setMembers);
    await persist('contributions', contributions.filter(c => c.memberId !== id), setContributions);
  }

  async function addContribution(memberId, month, amount, date) {
    const list = [...contributions, { id: newId(), memberId, month, amount: Number(amount), date }];
    await persist('contributions', list, setContributions);
  }

  async function removeContribution(id) {
    await persist('contributions', contributions.filter(c => c.id !== id), setContributions);
  }

  async function addExpense(desc, amount, date, category) {
    const list = [...expenses, { id: newId(), desc: desc.trim(), amount: Number(amount), date, category: category.trim() }];
    await persist('expenses', list, setExpenses);
  }

  async function removeExpense(id) {
    await persist('expenses', expenses.filter(e => e.id !== id), setExpenses);
  }

  async function saveSettings(next) {
    await persist('settings', next, setSettings);
  }

  async function clearAll() {
    await persist('settings', DEFAULT_SETTINGS, setSettings);
    await persist('members', [], setMembers);
    await persist('contributions', [], setContributions);
    await persist('expenses', [], setExpenses);
  }

  return (
    <div className="ft-app" style={{ background: 'transparent', minHeight: '100%', display: 'flex', justifyContent: 'center', padding: '20px 12px' }}>
      <Style />
      <div className="ft-frame">
        <Cover
          settings={settings}
          balance={balance}
          totalCollected={totalCollected}
          totalSpent={totalSpent}
          onSettings={() => setShowSettings(true)}
        />

        {error && (
          <div className="ft-error">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}

        <div className="ft-body">
          {loading ? (
            <div className="ft-loading"><Loader2 size={22} className="ft-spin" /><span>Opening passbook…</span></div>
          ) : tab === 'dashboard' ? (
            <Dashboard
              settings={settings}
              members={members}
              monthEntries={monthEntries}
              monthCollected={monthCollected}
              monthPaidCount={monthPaidCount}
              activity={activity}
              memberStats={memberStats}
              onGoContributions={() => { setSelectedMonth(currentMonthKey()); setTab('contributions'); }}
              onAddExpense={() => setShowAddExpense(true)}
            />
          ) : tab === 'members' ? (
            <MembersView
              settings={settings}
              memberStats={memberStats}
              onAdd={() => setShowAddMember(true)}
              onRemove={removeMember}
            />
          ) : tab === 'contributions' ? (
            <ContributionsView
              settings={settings}
              selectedMonth={selectedMonth}
              onShiftMonth={(d) => setSelectedMonth(shiftMonth(selectedMonth, d))}
              monthEntries={monthEntries}
              onPay={(member) => setPayFor({ member, month: selectedMonth })}
              onRemoveEntry={removeContribution}
            />
          ) : (
            <ExpensesView
              settings={settings}
              expenses={[...expenses].sort((a, b) => (a.date < b.date ? 1 : -1))}
              totalSpent={totalSpent}
              onAdd={() => setShowAddExpense(true)}
              onRemove={removeExpense}
            />
          )}
        </div>

        <BottomNav tab={tab} setTab={setTab} />
      </div>

      {showAddMember && (
        <AddMemberSheet
          onClose={() => setShowAddMember(false)}
          onSave={async (name, joinedMonth) => { await addMember(name, joinedMonth); setShowAddMember(false); }}
        />
      )}

      {showAddExpense && (
        <AddExpenseSheet
          symbol={settings.currency}
          onClose={() => setShowAddExpense(false)}
          onSave={async (desc, amount, date, category) => { await addExpense(desc, amount, date, category); setShowAddExpense(false); }}
        />
      )}

      {showSettings && (
        <SettingsSheet
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={async (next) => { await saveSettings(next); setShowSettings(false); }}
          onClearAll={async () => { if (window.confirm('Erase every member, payment and expense? This cannot be undone.')) { await clearAll(); setShowSettings(false); } }}
        />
      )}

      {payFor && (
        <PaySheet
          symbol={settings.currency}
          defaultAmount={settings.monthlyDue}
          member={payFor.member}
          month={payFor.month}
          onClose={() => setPayFor(null)}
          onSave={async (amount, date) => { await addContribution(payFor.member.id, payFor.month, amount, date); setPayFor(null); }}
        />
      )}
    </div>
  );
}

function Cover({ settings, balance, totalCollected, totalSpent, onSettings }) {
  return (
    <div className="ft-cover">
      <button className="ft-gear" onClick={onSettings} aria-label="Settings"><SettingsIcon size={17} /></button>
      <div className="ft-cover-eyebrow">Passbook</div>
      <div className="ft-cover-name">{settings.groupName}</div>
      <div className="ft-cover-balance">{money(balance, settings.currency)}</div>
      <div className="ft-cover-sub">
        <span>{money(totalCollected, settings.currency)} in</span>
        <span className="ft-dot" />
        <span>{money(totalSpent, settings.currency)} out</span>
      </div>
    </div>
  );
}

function Dashboard({ settings, members, monthEntries, monthCollected, monthPaidCount, activity, memberStats, onGoContributions, onAddExpense }) {
  const pct = members.length ? Math.round((monthPaidCount / members.length) * 100) : 0;
  const mostDue = [...memberStats].sort((a, b) => b.due - a.due).filter(m => m.due > 0).slice(0, 3);

  return (
    <div className="ft-stack">
      <button className="ft-panel ft-panel-tap" onClick={onGoContributions}>
        <div className="ft-panel-head">
          <span>{monthLabel(currentMonthKey())} collection</span>
          <span className="ft-mono-strong">{monthPaidCount}/{members.length}</span>
        </div>
        <div className="ft-progress-track"><div className="ft-progress-fill" style={{ width: `${pct}%` }} /></div>
        <div className="ft-panel-foot">{money(monthCollected, settings.currency)} collected this month</div>
      </button>

      <div className="ft-row-2">
        <button className="ft-quick" onClick={onGoContributions}><Plus size={15} /> Record payment</button>
        <button className="ft-quick ft-quick-alt" onClick={onAddExpense}><Plus size={15} /> Log expense</button>
      </div>

      {mostDue.length > 0 && (
        <div className="ft-panel">
          <div className="ft-panel-head"><span>Outstanding dues</span></div>
          <div className="ft-ledger">
            {mostDue.map(m => (
              <div className="ft-ledger-row" key={m.id}>
                <div className="ft-avatar">{m.name.charAt(0).toUpperCase()}</div>
                <div className="ft-ledger-mid">
                  <div className="ft-ledger-label">{m.name}</div>
                  <div className="ft-ledger-sub">since {monthLabel(m.joinedMonth)}</div>
                </div>
                <div className="ft-amt ft-amt-out">{money(m.due, settings.currency)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ft-panel">
        <div className="ft-panel-head"><span>Recent activity</span></div>
        {activity.length === 0 ? (
          <EmptyNote text="No entries yet. Record a payment or an expense to start the ledger." />
        ) : (
          <div className="ft-ledger">
            {activity.slice(0, 8).map(a => (
              <div className="ft-ledger-row" key={a.id}>
                <div className={`ft-stampdot ${a.kind === 'in' ? 'ft-stampdot-in' : 'ft-stampdot-out'}`}>{a.kind === 'in' ? '+' : '−'}</div>
                <div className="ft-ledger-mid">
                  <div className="ft-ledger-label">{a.label}</div>
                  <div className="ft-ledger-sub">{fmtDate(a.date)} · {a.sub}</div>
                </div>
                <div className={`ft-amt ${a.kind === 'in' ? 'ft-amt-in' : 'ft-amt-out'}`}>
                  {a.kind === 'in' ? '+' : '−'}{money(a.amount, settings.currency)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MembersView({ settings, memberStats, onAdd, onRemove }) {
  return (
    <div className="ft-stack">
      <div className="ft-view-head">
        <span>{memberStats.length} member{memberStats.length === 1 ? '' : 's'}</span>
        <button className="ft-add-btn" onClick={onAdd}><Plus size={15} /> Add</button>
      </div>

      {memberStats.length === 0 ? (
        <EmptyNote text="Add the friends in your fund to start tracking their dues." />
      ) : (
        <div className="ft-panel">
          <div className="ft-ledger">
            {memberStats.map(m => (
              <div className="ft-ledger-row" key={m.id}>
                <div className="ft-avatar">{m.name.charAt(0).toUpperCase()}</div>
                <div className="ft-ledger-mid">
                  <div className="ft-ledger-label">{m.name}</div>
                  <div className="ft-ledger-sub">Paid {money(m.paidTotal, settings.currency)} · since {monthLabel(m.joinedMonth)}</div>
                </div>
                <div className="ft-member-right">
                  <div className={m.due > 0 ? 'ft-amt ft-amt-out' : 'ft-amt ft-amt-in'}>
                    {m.due > 0 ? `${money(m.due, settings.currency)} due` : 'Settled'}
                  </div>
                  <button className="ft-icon-btn" onClick={() => onRemove(m.id)} aria-label={`Remove ${m.name}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ContributionsView({ settings, selectedMonth, onShiftMonth, monthEntries, onPay, onRemoveEntry }) {
  return (
    <div className="ft-stack">
      <div className="ft-month-nav">
        <button className="ft-icon-btn" onClick={() => onShiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
        <div className="ft-month-label">{monthLabel(selectedMonth)}</div>
        <button className="ft-icon-btn" onClick={() => onShiftMonth(1)} aria-label="Next month"><ChevronRight size={18} /></button>
      </div>

      {monthEntries.length === 0 ? (
        <EmptyNote text="Add members first, then mark their monthly payments here." />
      ) : (
        <div className="ft-panel">
          <div className="ft-ledger">
            {monthEntries.map(({ member, entries, paid, status }) => (
              <div key={member.id} className="ft-contrib-block">
                <div className="ft-ledger-row">
                  <div className="ft-avatar">{member.name.charAt(0).toUpperCase()}</div>
                  <div className="ft-ledger-mid">
                    <div className="ft-ledger-label">{member.name}</div>
                    <div className="ft-ledger-sub">
                      {status === 'paid' ? `Paid ${money(paid, settings.currency)}` : status === 'partial' ? `${money(paid, settings.currency)} of ${money(settings.monthlyDue, settings.currency)}` : `Due ${money(settings.monthlyDue, settings.currency)}`}
                    </div>
                  </div>
                  {status === 'paid' ? (
                    <div className="ft-stamp">PAID</div>
                  ) : (
                    <button className="ft-mark-btn" onClick={() => onPay(member)}>
                      {status === 'partial' ? 'Add' : 'Mark paid'}
                    </button>
                  )}
                </div>
                {entries.length > 0 && (
                  <div className="ft-entries">
                    {entries.map(e => (
                      <div className="ft-entry-row" key={e.id}>
                        <span className="ft-entry-date">{fmtDate(e.date)}</span>
                        <span className="ft-entry-amt">{money(e.amount, settings.currency)}</span>
                        <button className="ft-icon-btn ft-entry-del" onClick={() => onRemoveEntry(e.id)} aria-label="Remove entry"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExpensesView({ settings, expenses, totalSpent, onAdd, onRemove }) {
  return (
    <div className="ft-stack">
      <div className="ft-view-head">
        <span>{money(totalSpent, settings.currency)} spent total</span>
        <button className="ft-add-btn" onClick={onAdd}><Plus size={15} /> Add</button>
      </div>

      {expenses.length === 0 ? (
        <EmptyNote text="Log what the fund has spent on, so the balance stays accurate." />
      ) : (
        <div className="ft-panel">
          <div className="ft-ledger">
            {expenses.map(e => (
              <div className="ft-ledger-row" key={e.id}>
                <div className="ft-stampdot ft-stampdot-out">−</div>
                <div className="ft-ledger-mid">
                  <div className="ft-ledger-label">{e.desc}</div>
                  <div className="ft-ledger-sub">{fmtDate(e.date)}{e.category ? ` · ${e.category}` : ''}</div>
                </div>
                <div className="ft-member-right">
                  <div className="ft-amt ft-amt-out">{money(e.amount, settings.currency)}</div>
                  <button className="ft-icon-btn" onClick={() => onRemove(e.id)} aria-label="Remove expense"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyNote({ text }) {
  return <div className="ft-empty">{text}</div>;
}

function BottomNav({ tab, setTab }) {
  const items = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'contributions', label: 'Dues', icon: CalendarDays },
    { id: 'expenses', label: 'Expenses', icon: Wallet },
  ];
  return (
    <div className="ft-nav">
      {items.map(({ id, label, icon: Icon }) => (
        <button key={id} className={`ft-nav-btn ${tab === id ? 'ft-nav-btn-active' : ''}`} onClick={() => setTab(id)}>
          <Icon size={18} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function Sheet({ title, onClose, children }) {
  return (
    <div className="ft-overlay" onClick={onClose}>
      <div className="ft-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ft-sheet-head">
          <div className="ft-sheet-title">{title}</div>
          <button className="ft-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddMemberSheet({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [joinedMonth, setJoinedMonth] = useState(currentMonthKey());
  const canSave = name.trim().length > 0;
  return (
    <Sheet title="Add member" onClose={onClose}>
      <label className="ft-field">
        <span>Name</span>
        <input className="ft-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya" autoFocus />
      </label>
      <label className="ft-field">
        <span>Contributing since</span>
        <input className="ft-input" type="month" value={joinedMonth} onChange={(e) => setJoinedMonth(e.target.value)} />
      </label>
      <button className="ft-submit" disabled={!canSave} onClick={() => canSave && onSave(name, joinedMonth)}>
        <Check size={15} /> Add member
      </button>
    </Sheet>
  );
}

function AddExpenseSheet({ symbol, onClose, onSave }) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState('');
  const canSave = desc.trim().length > 0 && Number(amount) > 0;
  return (
    <Sheet title="Log an expense" onClose={onClose}>
      <label className="ft-field">
        <span>What was it for</span>
        <input className="ft-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Birthday cake" autoFocus />
      </label>
      <label className="ft-field">
        <span>Amount ({symbol})</span>
        <input className="ft-input ft-mono-input" type="number" min="0" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
      </label>
      <label className="ft-field">
        <span>Date</span>
        <input className="ft-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="ft-field">
        <span>Category (optional)</span>
        <input className="ft-input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Food, Travel" />
      </label>
      <button className="ft-submit" disabled={!canSave} onClick={() => canSave && onSave(desc, amount, date, category)}>
        <Check size={15} /> Save expense
      </button>
    </Sheet>
  );
}

function PaySheet({ symbol, defaultAmount, member, month, onClose, onSave }) {
  const [amount, setAmount] = useState(String(defaultAmount));
  const [date, setDate] = useState(todayISO());
  const canSave = Number(amount) > 0;
  return (
    <Sheet title={`${member.name} · ${monthLabel(month)}`} onClose={onClose}>
      <label className="ft-field">
        <span>Amount received ({symbol})</span>
        <input className="ft-input ft-mono-input" type="number" min="0" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      </label>
      <label className="ft-field">
        <span>Date</span>
        <input className="ft-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <button className="ft-submit" disabled={!canSave} onClick={() => canSave && onSave(amount, date)}>
        <Check size={15} /> Record payment
      </button>
    </Sheet>
  );
}

function SettingsSheet({ settings, onClose, onSave, onClearAll }) {
  const [groupName, setGroupName] = useState(settings.groupName);
  const [monthlyDue, setMonthlyDue] = useState(String(settings.monthlyDue));
  const [currency, setCurrency] = useState(settings.currency);
  const canSave = groupName.trim().length > 0 && Number(monthlyDue) > 0 && currency.trim().length > 0;
  return (
    <Sheet title="Settings" onClose={onClose}>
      <label className="ft-field">
        <span>Fund name</span>
        <input className="ft-input" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
      </label>
      <label className="ft-field">
        <span>Monthly due per member</span>
        <input className="ft-input ft-mono-input" type="number" min="0" inputMode="decimal" value={monthlyDue} onChange={(e) => setMonthlyDue(e.target.value)} />
      </label>
      <label className="ft-field">
        <span>Currency symbol</span>
        <input className="ft-input" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} />
      </label>
      <button className="ft-submit" disabled={!canSave} onClick={() => canSave && onSave({ groupName: groupName.trim(), monthlyDue: Number(monthlyDue), currency })}>
        <Check size={15} /> Save settings
      </button>
      <button className="ft-danger" onClick={onClearAll}><Trash2 size={14} /> Clear all data</button>
    </Sheet>
  );
}

function Style() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

      .ft-app, .ft-app * { box-sizing: border-box; }
      .ft-app {
        --ink: #241f18;
        --ink-soft: #6b6252;
        --paper: #ECE4CC;
        --paper-2: #E2D8BA;
        --line: #CFC29A;
        --cover: #1E3A34;
        --cover-2: #142722;
        --gold: #A9793A;
        --gold-soft: #C9A15E;
        --rust: #954832;
        --teal: #3C6E5E;
        font-family: 'IBM Plex Mono', ui-monospace, monospace;
        color: var(--ink);
        width: 100%;
      }
      .ft-frame {
        width: 100%;
        max-width: 408px;
        background: var(--paper);
        border-radius: 22px;
        overflow: hidden;
        box-shadow: 0 1px 2px rgba(36,31,24,0.08), 0 12px 28px rgba(36,31,24,0.16);
        border: 1px solid var(--line);
        display: flex;
        flex-direction: column;
      }
      .ft-cover {
        position: relative;
        background: linear-gradient(160deg, var(--cover), var(--cover-2));
        color: #EFE8D2;
        padding: 26px 22px 20px;
        text-align: center;
      }
      .ft-cover-eyebrow {
        font-size: 11px;
        letter-spacing: 0.14em;
        color: var(--gold-soft);
        margin-bottom: 6px;
      }
      .ft-cover-name {
        font-family: 'Fraunces', serif;
        font-weight: 600;
        font-size: 22px;
        letter-spacing: 0.01em;
      }
      .ft-cover-balance {
        font-family: 'Fraunces', serif;
        font-weight: 700;
        font-size: 40px;
        margin-top: 10px;
        color: #F6EFDC;
      }
      .ft-cover-sub {
        margin-top: 6px;
        font-size: 12px;
        color: #C9BFA0;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;
      }
      .ft-dot { width: 3px; height: 3px; border-radius: 50%; background: #7C8F84; display: inline-block; }
      .ft-gear {
        position: absolute; top: 16px; right: 16px;
        background: rgba(239,232,210,0.12); border: 1px solid rgba(239,232,210,0.25);
        color: #EFE8D2; border-radius: 10px; padding: 7px; cursor: pointer;
      }
      .ft-body { padding: 16px 14px 6px; flex: 1; min-height: 260px; }
      .ft-stack { display: flex; flex-direction: column; gap: 12px; }
      .ft-loading { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 60px 0; color: var(--ink-soft); font-size: 13px; }
      .ft-error { display: flex; align-items: center; gap: 6px; background: #F3E3D6; color: var(--rust); font-size: 12px; padding: 8px 14px; }

      .ft-panel { background: #F5EFDC; border: 1px solid var(--line); border-radius: 14px; padding: 14px; }
      .ft-panel-tap { width: 100%; text-align: left; cursor: pointer; }
      .ft-panel-head { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: var(--ink-soft); }
      .ft-panel-foot { margin-top: 8px; font-size: 11.5px; color: var(--ink-soft); }
      .ft-mono-strong { font-weight: 600; color: var(--ink); }
      .ft-progress-track { margin-top: 8px; height: 6px; border-radius: 4px; background: var(--paper-2); overflow: hidden; }
      .ft-progress-fill { height: 100%; background: var(--teal); border-radius: 4px; }

      .ft-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .ft-quick {
        display: flex; align-items: center; justify-content: center; gap: 6px;
        background: var(--cover); color: #F1EAD4; border: none; border-radius: 12px;
        padding: 11px 8px; font-family: inherit; font-size: 12.5px; cursor: pointer;
      }
      .ft-quick-alt { background: var(--rust); }

      .ft-view-head { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: var(--ink-soft); padding: 2px 2px 2px; }
      .ft-add-btn {
        display: flex; align-items: center; gap: 4px; background: var(--cover); color: #F1EAD4;
        border: none; border-radius: 999px; padding: 6px 12px; font-family: inherit; font-size: 12px; cursor: pointer;
      }

      .ft-ledger { display: flex; flex-direction: column; }
      .ft-ledger-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px dashed var(--line); }
      .ft-ledger-row:last-child { border-bottom: none; }
      .ft-avatar {
        width: 32px; height: 32px; border-radius: 50%; background: var(--paper-2); color: var(--ink);
        display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; flex-shrink: 0;
        border: 1px solid var(--line);
      }
      .ft-stampdot {
        width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
        font-size: 14px; font-weight: 700; flex-shrink: 0;
      }
      .ft-stampdot-in { background: #DCE8DF; color: var(--teal); }
      .ft-stampdot-out { background: #F0DAD1; color: var(--rust); }
      .ft-ledger-mid { flex: 1; min-width: 0; }
      .ft-ledger-label { font-size: 13.5px; font-weight: 500; }
      .ft-ledger-sub { font-size: 11px; color: var(--ink-soft); margin-top: 1px; }
      .ft-amt { font-size: 13px; font-weight: 600; white-space: nowrap; }
      .ft-amt-in { color: var(--teal); }
      .ft-amt-out { color: var(--rust); }
      .ft-member-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }

      .ft-icon-btn { background: transparent; border: none; color: var(--ink-soft); cursor: pointer; padding: 4px; display: flex; }
      .ft-icon-btn:hover { color: var(--ink); }

      .ft-month-nav { display: flex; align-items: center; justify-content: space-between; padding: 2px 4px; }
      .ft-month-label { font-family: 'Fraunces', serif; font-size: 17px; font-weight: 600; }

      .ft-contrib-block { border-bottom: 1px dashed var(--line); padding-bottom: 4px; }
      .ft-contrib-block:last-child { border-bottom: none; }
      .ft-contrib-block .ft-ledger-row { border-bottom: none; padding-bottom: 6px; }
      .ft-mark-btn { background: var(--gold); color: #2B2013; border: none; border-radius: 999px; padding: 7px 12px; font-family: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
      .ft-stamp {
        border: 2px solid var(--teal); color: var(--teal); font-size: 11px; font-weight: 700;
        letter-spacing: 0.08em; padding: 4px 9px; border-radius: 6px; transform: rotate(-6deg);
      }
      .ft-entries { padding: 0 0 8px 42px; display: flex; flex-direction: column; gap: 4px; }
      .ft-entry-row { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--ink-soft); }
      .ft-entry-date { flex: 1; }
      .ft-entry-amt { font-weight: 600; color: var(--ink); }
      .ft-entry-del { padding: 2px; }

      .ft-empty { text-align: center; font-size: 12.5px; color: var(--ink-soft); padding: 34px 20px; border: 1px dashed var(--line); border-radius: 14px; }

      .ft-nav { display: flex; border-top: 1px solid var(--line); background: #F5EFDC; }
      .ft-nav-btn {
        flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
        padding: 10px 4px 12px; background: transparent; border: none; color: var(--ink-soft);
        font-family: inherit; font-size: 10.5px; cursor: pointer;
      }
      .ft-nav-btn-active { color: var(--cover); }

      .ft-overlay {
        position: fixed; inset: 0; background: rgba(20,17,12,0.5); display: flex; align-items: flex-end; justify-content: center; z-index: 50; padding: 0;
      }
      .ft-sheet {
        width: 100%; max-width: 408px; background: var(--paper); border-radius: 20px 20px 0 0;
        padding: 18px 18px 22px; max-height: 86vh; overflow-y: auto;
      }
      .ft-sheet-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
      .ft-sheet-title { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 600; }
      .ft-field { display: flex; flex-direction: column; gap: 5px; font-size: 11.5px; color: var(--ink-soft); margin-bottom: 12px; }
      .ft-input {
        font-family: inherit; font-size: 14px; color: var(--ink); background: #F7F2E2;
        border: 1px solid var(--line); border-radius: 10px; padding: 10px 11px; width: 100%;
      }
      .ft-input:focus { outline: 2px solid var(--gold-soft); outline-offset: 1px; }
      .ft-mono-input { font-weight: 600; }
      .ft-submit {
        width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;
        background: var(--cover); color: #F1EAD4; border: none; border-radius: 12px;
        padding: 12px; font-family: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; margin-top: 4px;
      }
      .ft-submit:disabled { opacity: 0.45; cursor: not-allowed; }
      .ft-danger {
        width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;
        background: transparent; color: var(--rust); border: none; padding: 12px; margin-top: 6px;
        font-family: inherit; font-size: 12px; cursor: pointer;
      }

      @media (max-width: 380px) {
        .ft-cover-balance { font-size: 34px; }
      }
      .ft-spin { animation: ft-spin-kf 1s linear infinite; }
      @keyframes ft-spin-kf { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `}</style>
  );
}
