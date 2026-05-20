'use client';

import { useEffect, useState, useRef, useMemo, useLayoutEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';

// ─── CONSTANTS ───────────────────────────────────────────────
const SCOPE_META: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  Personal:      { icon: 'home',          color: '#4D9EFF', bg: 'rgba(77,158,255,0.08)',   border: 'rgba(77,158,255,0.35)' },
  Profesional:   { icon: 'briefcase',     color: '#F5A623', bg: 'rgba(245,166,35,0.08)',   border: 'rgba(245,166,35,0.35)' },
  Comunitario:   { icon: 'users',         color: '#00D68F', bg: 'rgba(0,214,143,0.08)',    border: 'rgba(0,214,143,0.35)' },
  Investigación: { icon: 'flask-conical', color: '#A88CFF', bg: 'rgba(168,140,255,0.08)', border: 'rgba(168,140,255,0.35)' },
  Personalizado: { icon: 'sparkles',      color: '#B7BAC7', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.18)' },
};

const STATUS_META: Record<string, { color: string; cls: string; dot: string }> = {
  'Planificado': { color: '#4D9EFF', cls: 'pill-blue',  dot: 'dot-blue' },
  'En curso':    { color: '#00D68F', cls: 'pill-jade',  dot: 'dot-jade' },
  'En revisión': { color: '#F5A623', cls: 'pill-amber', dot: 'dot-amber' },
  'Pausado':     { color: '#7A7E8F', cls: '',            dot: '' },
  'Completado':  { color: '#B7BAC7', cls: '',            dot: '' },
  'Bloqueado':   { color: '#FF4D6D', cls: 'pill-red',   dot: 'dot-red' },
};

const NAV = [
  { id: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
  { id: 'projects',  icon: 'folder-kanban',    label: 'Proyectos' },
];

// ─── HELPERS ─────────────────────────────────────────────────
function fmtCLP(n: number) { return '$' + n.toLocaleString('es-CL'); }
function fmtShort(n: number) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K';
  return '$' + n;
}
function fmtDateShort(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}
function toPascal(name: string) {
  return name.split(/[-_]/).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

// ─── ICON ────────────────────────────────────────────────────
function I({ name, size = 16, color, className = '', strokeWidth = 1.7, style = {} }: {
  name: string; size?: number; color?: string; className?: string; strokeWidth?: number; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const w = window as any;
    const fn = w.lucide && (w.lucide[toPascal(name)] || (w.lucide.icons && w.lucide.icons[name]));
    let svg = '';
    if (typeof fn === 'function') {
      try {
        const node = fn({ width: size, height: size, stroke: color || 'currentColor', 'stroke-width': strokeWidth });
        svg = (node && node.outerHTML) || '';
      } catch (e) {}
    }
    if (!svg && w.lucide && w.lucide.icons) {
      const icon = w.lucide.icons[name] || w.lucide.icons[toPascal(name)];
      if (icon && Array.isArray(icon)) {
        const [, attrs, children] = icon;
        const attrStr = Object.entries({ ...attrs, width: size, height: size, stroke: color || 'currentColor', 'stroke-width': strokeWidth, fill: 'none' }).map(([k, v]) => `${k}="${v}"`).join(' ');
        const childStr = (children || []).map((c: any) => {
          if (Array.isArray(c)) { const [tag, cattrs] = c; const cAttrStr = Object.entries(cattrs || {}).map(([k, v]) => `${k}="${v}"`).join(' '); return `<${tag} ${cAttrStr} />`; }
          return '';
        }).join('');
        svg = `<svg xmlns="http://www.w3.org/2000/svg" ${attrStr} viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">${childStr}</svg>`;
      }
    }
    ref.current.innerHTML = svg;
  }, [name, size, color, strokeWidth]);
  return <span ref={ref} className={'inline-flex items-center justify-center ' + className} style={{ width: size, height: size, color: color || 'currentColor', flexShrink: 0, ...style }} />;
}

// ─── PRIMITIVES ──────────────────────────────────────────────
function Pill({ children, tone = '', className = '', icon, style }: { children: React.ReactNode; tone?: string; className?: string; icon?: string; style?: React.CSSProperties }) {
  return <span className={`pill${tone ? ' pill-' + tone : ''} ${className}`} style={style}>{icon && <I name={icon} size={11} />}{children}</span>;
}

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] || { cls: '', dot: '' };
  return <span className={'pill ' + meta.cls}><span className={'dot ' + meta.dot} />{status}</span>;
}

function ScopePill({ scope }: { scope: string }) {
  const meta = SCOPE_META[scope] || SCOPE_META.Personalizado;
  return <span className="pill" style={{ color: meta.color, borderColor: meta.border, background: meta.bg }}><I name={meta.icon} size={11} />{scope}</span>;
}

function ProgressBar({ value, tone, height = 6 }: { value: number; tone?: string; height?: number }) {
  const pct = Math.min(100, value);
  let cls = 'progress';
  if (tone === 'warn' || (pct >= 80 && pct < 100 && !tone)) cls += ' warn';
  if (tone === 'danger' || pct >= 100) cls += ' danger';
  if (tone === 'blue') cls += ' blue';
  return <div className={cls} style={{ height }}><i style={{ width: Math.min(100, pct) + '%' }} /></div>;
}

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>{name}</span>;
}

function Card({ children, className = '', strong = false, style }: { children: React.ReactNode; className?: string; strong?: boolean; style?: React.CSSProperties }) {
  return <div className={(strong ? 'glass-strong' : 'glass') + ' rounded-2xl ' + className} style={style}>{children}</div>;
}

function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf: number, start: number;
    const to = Number(target) || 0;
    function step(t: number) {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(to * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function MoneyCounter({ value }: { value: number }) {
  const v = useCountUp(value);
  return <span className="num">${Math.round(v).toLocaleString('es-CL')}</span>;
}

function SlideOver({ open, onClose, title, subtitle, children, width = 580 }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; width?: number;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 fade-in" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} onClick={onClose}>
      <div className="absolute top-0 right-0 h-full panel-slide" style={{ width }} onClick={e => e.stopPropagation()}>
        <div className="h-full flex flex-col" style={{ background: 'linear-gradient(180deg, #0F0F18 0%, #0A0A12 100%)', borderLeft: '1px solid var(--line-strong)' }}>
          <div className="flex items-start justify-between p-6 hairline-b">
            <div>{subtitle && <div className="eyebrow mb-1">{subtitle}</div>}<h2 className="text-2xl font-bold">{title}</h2></div>
            <button className="btn btn-ghost" onClick={onClose}><I name="x" size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────
function Sidebar({ active, onChange, collapsed, onToggle, projects }: {
  active: string; onChange: (id: string) => void; collapsed: boolean; onToggle: () => void; projects: any[];
}) {
  const totalBudget = projects.reduce((a: number, p: any) => a + (p.budget || 0), 0);
  const totalExec = projects.reduce((a: number, p: any) => a + (p.executed || 0), 0);
  const pct = totalBudget > 0 ? (totalExec / totalBudget) * 100 : 0;
  const W = collapsed ? 64 : 240;

  return (
    <aside className="hairline-r relative flex flex-col" style={{ width: W, transition: 'width 320ms cubic-bezier(.2,.7,.2,1)', background: 'linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0.003))', backdropFilter: 'blur(20px)' }}>
      <div className="hairline-b flex items-center gap-3 px-4" style={{ height: 72 }}>
        <div className="relative flex-shrink-0" style={{ width: 32, height: 32 }}>
          <svg viewBox="0 0 32 32" width="32" height="32">
            <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#00D68F" /><stop offset="100%" stopColor="#1F6B5A" /></linearGradient></defs>
            <path d="M6 22 L6 10 L26 22 L26 10" stroke="url(#lg)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px rgba(0,214,143,0.5))' }} />
            <circle cx="6" cy="10" r="2.5" fill="#00D68F" style={{ filter: 'drop-shadow(0 0 6px rgba(0,214,143,0.7))' }} />
            <circle cx="26" cy="22" r="2.5" fill="#00D68F" style={{ filter: 'drop-shadow(0 0 6px rgba(0,214,143,0.7))' }} />
          </svg>
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[15px]" style={{ fontFamily: 'Sora', letterSpacing: '0.18em' }}>NEXUS</div>
            <div className="text-[10px] mt-px" style={{ color: 'var(--text-2)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Control Presupuestario</div>
          </div>
        )}
        {!collapsed && <button className="btn btn-ghost !h-7 !w-7 !p-0 ml-auto" onClick={onToggle}><I name="panel-left-close" size={14} /></button>}
      </div>
      {collapsed && <button className="btn btn-ghost mx-auto mt-3 !h-7 !w-7 !p-0" onClick={onToggle}><I name="panel-left-open" size={14} /></button>}

      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        {!collapsed && <div className="px-3 pb-2 eyebrow">Workspace</div>}
        <div className="flex flex-col gap-0.5">
          {NAV.map(item => (
            <div key={item.id} className={'nav-item ' + (active === item.id ? 'active' : '')} onClick={() => onChange(item.id)} title={item.label}>
              <I name={item.icon} size={17} />
              {!collapsed && <span className="flex-1">{item.label}</span>}
            </div>
          ))}
        </div>
        {!collapsed && projects.length > 0 && (
          <>
            <div className="px-3 pt-6 pb-2 eyebrow">Reciente</div>
            <div className="flex flex-col gap-0.5">
              {projects.slice(0, 3).map((p: any) => (
                <div key={p.id} className="nav-item" style={{ height: 32 }} onClick={() => onChange('project:' + p.id)}>
                  <span className={'inline-block w-1.5 h-1.5 rounded-full ' + (p.health === 'danger' ? 'dot-red' : 'dot-jade')} />
                  <span className="truncate text-[12.5px]" style={{ color: 'var(--text-1)' }}>{p.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </nav>

      {!collapsed && (
        <div className="px-4 py-4 hairline-t">
          <div className="flex items-center justify-between mb-2">
            <span className="eyebrow !text-[10px]">Presupuesto Global</span>
            <span className="font-mono text-[11px]" style={{ color: pct > 100 ? '#FFB0BF' : 'var(--text-1)' }}>{pct.toFixed(0)}%</span>
          </div>
          <ProgressBar value={pct} tone={pct > 100 ? 'danger' : pct > 80 ? 'warn' : 'ok'} />
          <div className="flex justify-between mt-2 font-mono text-[10.5px]" style={{ color: 'var(--text-2)' }}>
            <span>{fmtShort(totalExec)}</span><span>de {fmtShort(totalBudget)}</span>
          </div>
        </div>
      )}

      <div className="hairline-t flex items-center gap-3 px-4 py-3" style={{ height: 64 }}>
        <Avatar name="MC" size={32} />
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate">Marcelo</div>
            <div className="text-[11px] truncate" style={{ color: 'var(--text-2)' }}>Project Lead</div>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── TOPBAR ──────────────────────────────────────────────────
function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="hairline-b flex items-center gap-6 px-8" style={{ height: 72 }}>
      <div className="flex-1 min-w-0">
        <h1 className="font-bold text-[22px] truncate" style={{ fontFamily: 'Sora', letterSpacing: '-0.02em' }}>{title}</h1>
        {subtitle && <div className="text-[12px]" style={{ color: 'var(--text-2)' }}>{subtitle}</div>}
      </div>
      <div className="hidden md:flex items-center gap-2 px-3 hairline rounded-lg" style={{ height: 36, width: 320, background: 'rgba(255,255,255,0.025)' }}>
        <I name="search" size={14} color="var(--text-2)" />
        <input className="bg-transparent outline-none text-[13px] flex-1" style={{ color: 'var(--text-0)' }} placeholder="Buscar proyectos..." />
      </div>
      <button className="btn btn-ghost !w-9 !p-0 relative"><I name="bell" size={16} /></button>
    </header>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────
function Dashboard({ projects, onOpenProject }: { projects: any[]; onOpenProject: (id: string) => void }) {
  const totalBudget = projects.reduce((a: number, p: any) => a + (p.budget || 0), 0);
  const totalExec = projects.reduce((a: number, p: any) => a + (p.executed || 0), 0);
  const remaining = totalBudget - totalExec;
  const variation = totalBudget > 0 ? ((totalExec - totalBudget) / totalBudget) * 100 : 0;
  const vUp = useCountUp(Math.abs(variation));

  return (
    <div className="p-8 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Presupuesto Total', value: totalBudget, sub: `${projects.length} proyectos` },
          { label: 'Ejecutado', value: totalExec, sub: `${totalBudget > 0 ? ((totalExec / totalBudget) * 100).toFixed(1) : 0}% del total` },
          { label: 'Por Ejecutar', value: Math.abs(remaining), sub: remaining < 0 ? 'déficit' : 'disponible' },
        ].map(kpi => (
          <Card key={kpi.label} className="p-5 card-hover rise" style={{ minHeight: 124 }}>
            <div className="eyebrow">{kpi.label}</div>
            <div className="mt-3 font-mono font-semibold" style={{ fontSize: 26, lineHeight: 1.05 }}>
              <MoneyCounter value={kpi.value} />
            </div>
            <div className="mt-1.5 text-[12px]" style={{ color: 'var(--text-2)' }}>{kpi.sub}</div>
          </Card>
        ))}
        <Card className="p-5 card-hover rise" style={{ minHeight: 124 }}>
          <div className="eyebrow">Variación</div>
          <div className="mt-3 font-mono font-semibold" style={{ fontSize: 30, lineHeight: 1.05, color: variation > 5 ? '#FFB0BF' : variation > 0 ? '#FFD08A' : '#6FFFCB' }}>
            {variation >= 0 ? '+' : ''}{vUp.toFixed(1)}<span className="text-xl opacity-70">%</span>
          </div>
          <div className="mt-1.5 text-[12px]" style={{ color: 'var(--text-2)' }}>frente a presupuesto</div>
        </Card>
      </div>

      {/* Project cards */}
      <div>
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="eyebrow mb-1">Mapa de proyectos</div>
            <h2 className="font-bold text-[20px]" style={{ fontFamily: 'Sora' }}>{projects.length} iniciativas activas</h2>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {projects.map((p: any) => (
            <div key={p.id} className="glass rounded-2xl p-5 card-hover cursor-pointer rise" onClick={() => onOpenProject(p.id)}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-md flex items-center justify-center" style={{ width: 32, height: 32, background: (SCOPE_META[p.scope] || SCOPE_META.Personalizado).bg, border: `1px solid ${(SCOPE_META[p.scope] || SCOPE_META.Personalizado).border}`, color: (SCOPE_META[p.scope] || SCOPE_META.Personalizado).color }}>
                    <I name={(SCOPE_META[p.scope] || SCOPE_META.Personalizado).icon} size={15} />
                  </span>
                  <div>
                    <div className="font-semibold text-[14.5px]" style={{ fontFamily: 'Sora', letterSpacing: '-0.02em' }}>{p.name}</div>
                    <div className="text-[11px] font-mono" style={{ color: 'var(--text-3)' }}>{p.code}</div>
                  </div>
                </div>
                <StatusPill status={p.status || 'En curso'} />
              </div>
              <div className="mt-4">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[11px]" style={{ color: 'var(--text-2)' }}>Ejecución</span>
                  <span className="font-mono text-[12.5px]" style={{ color: p.health === 'danger' ? '#FFB0BF' : '#6FFFCB' }}>{p.progress || 0}%</span>
                </div>
                <ProgressBar value={p.progress || 0} tone={p.health === 'danger' ? 'danger' : p.health === 'warn' ? 'warn' : 'ok'} />
                <div className="flex justify-between mt-2 font-mono text-[11px]" style={{ color: 'var(--text-2)' }}>
                  <span>{fmtShort(p.executed || 0)}</span><span>de {fmtShort(p.budget || 0)}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 hairline-t flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <I name="calendar" size={12} color="var(--text-2)" />
                  <span className="text-[11.5px] truncate" style={{ color: 'var(--text-1)' }}>{p.next_label || 'Sin hitos'}</span>
                </div>
                <span className="font-mono text-[11px] flex-shrink-0" style={{ color: 'var(--text-2)' }}>
                  {p.next_date ? fmtDateShort(p.next_date) : '—'}
                </span>
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="col-span-3 glass rounded-2xl p-12 text-center" style={{ color: 'var(--text-2)' }}>
              <I name="folder-open" size={32} className="mx-auto mb-3 opacity-40" />
              <p>No hay proyectos aún. Crea uno desde la vista Proyectos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PROJECTS VIEW ───────────────────────────────────────────
function ProjectsView({ projects, onOpenProject, onRefresh }: { projects: any[]; onOpenProject: (id: string) => void; onRefresh: () => void }) {
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-[22px]" style={{ fontFamily: 'Sora' }}>Proyectos</h2>
          <span className="pill ml-2">{projects.length} totales</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center hairline rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
            {(['list', 'kanban'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className="px-3 h-9 transition-all flex items-center gap-1.5 text-[12px]" style={{ background: view === v ? 'rgba(255,255,255,0.06)' : 'transparent', color: view === v ? 'var(--text-0)' : 'var(--text-2)' }}>
                <I name={v === 'list' ? 'list' : 'layout-grid'} size={13} />{v === 'list' ? 'Lista' : 'Kanban'}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setNewOpen(true)}><I name="plus" size={14} />Nuevo proyecto</button>
        </div>
      </div>

      {view === 'list' ? (
        <Card className="overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>Proyecto</th><th style={{ width: 140 }}>Ámbito</th><th style={{ width: 140 }}>Presupuesto</th>
                <th style={{ width: 140 }}>Ejecutado</th><th style={{ width: 200 }}>% Avance</th>
                <th style={{ width: 110 }}>Inicio</th><th style={{ width: 110 }}>Fin</th>
                <th style={{ width: 140 }}>Estado</th><th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p: any) => (
                <tr key={p.id} onClick={() => onOpenProject(p.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="rounded-md flex items-center justify-center" style={{ width: 26, height: 26, background: (SCOPE_META[p.scope] || SCOPE_META.Personalizado).bg, border: `1px solid ${(SCOPE_META[p.scope] || SCOPE_META.Personalizado).border}`, color: (SCOPE_META[p.scope] || SCOPE_META.Personalizado).color }}>
                        <I name={(SCOPE_META[p.scope] || SCOPE_META.Personalizado).icon} size={13} />
                      </span>
                      <div>
                        <div className="font-medium text-white/95">{p.name}</div>
                        <div className="text-[10.5px] font-mono" style={{ color: 'var(--text-3)' }}>{p.code}</div>
                      </div>
                    </div>
                  </td>
                  <td><ScopePill scope={p.scope || 'Personal'} /></td>
                  <td className="font-mono">{fmtShort(p.budget || 0)}</td>
                  <td className="font-mono" style={{ color: p.health === 'danger' ? '#FFB0BF' : 'var(--text-0)' }}>{fmtShort(p.executed || 0)}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex-1"><ProgressBar value={p.progress || 0} tone={p.health === 'danger' ? 'danger' : 'ok'} /></div>
                      <span className="font-mono text-[12px] w-10 text-right">{p.progress || 0}%</span>
                    </div>
                  </td>
                  <td className="font-mono text-[12px]" style={{ color: 'var(--text-1)' }}>{fmtDateShort(p.start_date)}</td>
                  <td className="font-mono text-[12px]" style={{ color: 'var(--text-1)' }}>{fmtDateShort(p.end_date)}</td>
                  <td><StatusPill status={p.status || 'En curso'} /></td>
                  <td><button className="btn btn-ghost !w-8 !p-0" onClick={e => e.stopPropagation()}><I name="more-horizontal" size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {projects.length === 0 && (
            <div className="p-12 text-center" style={{ color: 'var(--text-2)' }}>
              <I name="folder-open" size={32} className="mx-auto mb-3 opacity-40" />
              <p>No hay proyectos. Crea el primero con el botón "Nuevo proyecto".</p>
            </div>
          )}
        </Card>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {['Planificado', 'En curso', 'En revisión', 'Completado'].map(col => {
            const items = projects.filter((p: any) => p.status === col);
            const meta = STATUS_META[col];
            return (
              <div key={col} className="kanban-col">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className={'w-2 h-2 rounded-full ' + (meta?.dot || '')} style={{ background: meta?.color }} />
                    <span className="font-semibold text-[13px]" style={{ fontFamily: 'Sora' }}>{col}</span>
                    <span className="font-mono text-[11px]" style={{ color: 'var(--text-2)' }}>{items.length}</span>
                  </div>
                </div>
                {items.map((p: any) => (
                  <div key={p.id} className="glass rounded-xl p-3 mb-3 card-hover cursor-pointer" onClick={() => onOpenProject(p.id)}>
                    <div className="font-semibold text-[13.5px] mb-2 leading-tight" style={{ fontFamily: 'Sora' }}>{p.name}</div>
                    <ProgressBar value={p.progress || 0} tone={p.health === 'danger' ? 'danger' : 'ok'} />
                    <div className="flex justify-between mt-2 font-mono text-[11px]" style={{ color: 'var(--text-1)' }}>
                      <span>{fmtShort(p.executed || 0)}</span><span>{fmtShort(p.budget || 0)}</span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div className="text-[12px] text-center py-8" style={{ color: 'var(--text-3)' }}>Sin proyectos</div>}
              </div>
            );
          })}
        </div>
      )}

      <NewProjectPanel open={newOpen} onClose={() => { setNewOpen(false); onRefresh(); }} />
    </div>
  );
}

// ─── NEW PROJECT PANEL ───────────────────────────────────────
function NewProjectPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', scope: 'Personal', budget: '', status: 'En curso' });

  async function handleCreate() {
    if (!form.name.trim()) return;
    setLoading(true);
    const id = 'p' + Date.now();
    const code = 'PRJ-' + String(Math.floor(Math.random() * 900) + 100);
    const { error } = await supabase.from('proyectos').insert([{
      id, code, name: form.name, description: form.description,
      scope: form.scope, budget: Number(form.budget) || 0,
      executed: 0, status: form.status, health: 'ok', progress: 0,
      currency: 'CLP', return_type: 'Cualitativo',
    }]);
    setLoading(false);
    if (!error) { setForm({ name: '', description: '', scope: 'Personal', budget: '', status: 'En curso' }); onClose(); }
    else alert('Error: ' + error.message);
  }

  return (
    <SlideOver open={open} onClose={onClose} subtitle="Nuevo proyecto" title="Crear iniciativa">
      <div className="space-y-5">
        <div>
          <label className="label">Nombre del proyecto *</label>
          <input className="input" placeholder="Ej. Invernadero, Taller, Bodega..." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Descripción</label>
          <textarea className="textarea" placeholder="¿Qué incluye este proyecto?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="label">Ámbito *</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(SCOPE_META).map(([name, meta]) => (
              <button key={name} onClick={() => setForm({ ...form, scope: name })} className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all"
                style={{ background: form.scope === name ? meta.bg : 'rgba(255,255,255,0.02)', border: `1px solid ${form.scope === name ? meta.border : 'var(--line)'}`, color: form.scope === name ? meta.color : 'var(--text-1)' }}>
                <I name={meta.icon} size={16} /><span className="text-[10.5px] font-medium">{name}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Presupuesto total (CLP)</label>
          <input className="input" placeholder="0" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} />
        </div>
        <div>
          <label className="label">Estado inicial</label>
          <select className="select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            {Object.keys(STATUS_META).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="hairline-t mt-8 pt-5 flex items-center justify-between">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
          <I name="check" size={14} />{loading ? 'Creando...' : 'Crear proyecto'}
        </button>
      </div>
    </SlideOver>
  );
}

// ─── PROJECT DETAIL ──────────────────────────────────────────
function ProjectDetail({ project, onBack, onRefresh }: { project: any; onBack: () => void; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...project });
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const progress = form.budget > 0 ? Math.round((form.executed / form.budget) * 100) : 0;
    const health = progress >= 100 ? 'danger' : progress >= 80 ? 'warn' : 'ok';
    const { error } = await supabase.from('proyectos').update({
      name: form.name, description: form.description, scope: form.scope,
      budget: Number(form.budget), executed: Number(form.executed),
      status: form.status, start_date: form.start_date, end_date: form.end_date,
      next_label: form.next_label, next_date: form.next_date, progress, health,
    }).eq('id', project.id);
    setLoading(false);
    if (!error) { setEditing(false); onRefresh(); }
    else alert('Error: ' + error.message);
  }

  const progress = form.budget > 0 ? Math.round((form.executed / form.budget) * 100) : 0;
  const tone = progress >= 100 ? 'danger' : progress >= 80 ? 'warn' : 'ok';

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <button className="btn btn-ghost !h-8 !w-8 !p-0" onClick={onBack}><I name="arrow-left" size={16} /></button>
        <div className="flex-1">
          <div className="eyebrow mb-1">Proyectos / Detalle</div>
          <h1 className="font-bold text-[24px]" style={{ fontFamily: 'Sora' }}>{project.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={project.status || 'En curso'} />
          {editing
            ? <><button className="btn btn-ghost" onClick={() => { setEditing(false); setForm({ ...project }); }}>Cancelar</button><button className="btn btn-primary" onClick={handleSave} disabled={loading}><I name="check" size={14} />{loading ? 'Guardando...' : 'Guardar'}</button></>
            : <button className="btn" onClick={() => setEditing(true)}><I name="pencil" size={14} />Editar</button>
          }
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Presupuesto', value: fmtCLP(form.budget || 0) },
          { label: 'Ejecutado', value: fmtCLP(form.executed || 0) },
          { label: 'Avance', value: `${progress}%` },
        ].map(kpi => (
          <Card key={kpi.label} className="p-5">
            <div className="eyebrow">{kpi.label}</div>
            <div className="mt-2 font-mono font-semibold text-[24px]" style={{ color: kpi.label === 'Ejecutado' && progress > 100 ? '#FFB0BF' : 'var(--text-0)' }}>{kpi.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="eyebrow mb-3">Progreso de ejecución</div>
        <ProgressBar value={progress} tone={tone} height={10} />
        <div className="flex justify-between mt-2 font-mono text-[12px]" style={{ color: 'var(--text-2)' }}>
          <span>{fmtCLP(form.executed || 0)} ejecutado</span><span>{fmtCLP(form.budget || 0)} presupuestado</span>
        </div>
      </Card>

      {editing ? (
        <Card className="p-6">
          <div className="eyebrow mb-4">Editar proyecto</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Nombre</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="col-span-2"><label className="label">Descripción</label><textarea className="textarea" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><label className="label">Presupuesto (CLP)</label><input className="input" type="number" value={form.budget || 0} onChange={e => setForm({ ...form, budget: e.target.value })} /></div>
            <div><label className="label">Ejecutado (CLP)</label><input className="input" type="number" value={form.executed || 0} onChange={e => setForm({ ...form, executed: e.target.value })} /></div>
            <div><label className="label">Estado</label><select className="select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{Object.keys(STATUS_META).map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label className="label">Ámbito</label><select className="select" value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })}>{Object.keys(SCOPE_META).map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label className="label">Fecha inicio</label><input className="input" type="date" value={form.start_date || ''} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><label className="label">Fecha fin</label><input className="input" type="date" value={form.end_date || ''} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
            <div><label className="label">Próximo hito</label><input className="input" value={form.next_label || ''} onChange={e => setForm({ ...form, next_label: e.target.value })} placeholder="Ej. Pago hito 1" /></div>
            <div><label className="label">Fecha próximo hito</label><input className="input" type="date" value={form.next_date || ''} onChange={e => setForm({ ...form, next_date: e.target.value })} /></div>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="eyebrow mb-3">Información del proyecto</div>
          <div className="grid grid-cols-2 gap-6">
            <div><div className="label">Descripción</div><p className="text-[13px]" style={{ color: 'var(--text-1)' }}>{project.description || '—'}</p></div>
            <div className="space-y-3">
              <div><div className="label">Ámbito</div><ScopePill scope={project.scope || 'Personal'} /></div>
              <div><div className="label">Periodo</div><span className="font-mono text-[13px]">{fmtDateShort(project.start_date)} → {fmtDateShort(project.end_date)}</span></div>
              {project.next_label && <div><div className="label">Próximo hito</div><span className="text-[13px]">{project.next_label} · {fmtDateShort(project.next_date)}</span></div>}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState<{ view: string; projectId?: string }>({ view: 'dashboard' });
  const [collapsed, setCollapsed] = useState(false);

  async function fetchProjects() {
    const { data, error } = await supabase.from('proyectos').select('*').order('created_at');
    if (!error && data) setProjects(data);
    setLoading(false);
  }

  useEffect(() => { fetchProjects(); }, []);

  // Load Lucide icons
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/lucide@0.460.0/dist/umd/lucide.js';
    script.onload = () => { if ((window as any).lucide?.createIcons) (window as any).lucide.createIcons(); };
    document.head.appendChild(script);
  }, []);

  function onNavigate(id: string) {
    if (id.startsWith('project:')) {
      setRoute({ view: 'project_detail', projectId: id.split(':')[1] });
    } else {
      setRoute({ view: id });
    }
  }

  function openProject(id: string) {
    setRoute({ view: 'project_detail', projectId: id });
  }

  const activeNav = route.view === 'project_detail' ? 'projects' : route.view;
  const currentProject = route.projectId ? projects.find(p => p.id === route.projectId) : null;

  const titles: Record<string, string> = { dashboard: 'Dashboard', projects: 'Proyectos', project_detail: currentProject?.name || 'Detalle' };
  const subtitles: Record<string, string> = {
    dashboard: `${projects.length} proyectos activos`,
    projects: 'Administra todas tus iniciativas en un solo lugar',
  };

  if (loading) {
    return (
      <div className="app-bg w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="font-bold text-[20px] mb-2" style={{ fontFamily: 'Sora', color: 'var(--jade)' }}>NEXUS</div>
          <div className="text-[13px]" style={{ color: 'var(--text-2)' }}>Cargando proyectos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg w-screen h-screen flex relative overflow-hidden">
      <div className="blur-spot" style={{ width: 600, height: 600, top: -200, left: -200, background: 'rgba(0,214,143,0.10)' }} />
      <div className="blur-spot" style={{ width: 500, height: 500, bottom: -180, right: -120, background: 'rgba(31,107,90,0.18)' }} />

      <Sidebar active={activeNav} onChange={onNavigate} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} projects={projects} />

      <main className="flex-1 flex flex-col relative" style={{ minWidth: 0 }}>
        <TopBar title={titles[route.view] || ''} subtitle={subtitles[route.view]} />
        <div className="flex-1 overflow-y-auto relative">
          <div className="fade-in">
            {route.view === 'dashboard' && <Dashboard projects={projects} onOpenProject={openProject} />}
            {route.view === 'projects' && <ProjectsView projects={projects} onOpenProject={openProject} onRefresh={fetchProjects} />}
            {route.view === 'project_detail' && currentProject && <ProjectDetail project={currentProject} onBack={() => setRoute({ view: 'projects' })} onRefresh={fetchProjects} />}
          </div>
        </div>
      </main>
    </div>
  );
}
