'use client';

import { useEffect, useState, useRef, useMemo, useLayoutEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import type { MaterialServicio } from '../types/domain';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, Legend } from 'recharts';

// ─── CONSTANTS ───────────────────────────────────────────────
const SCOPE_META: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  Personal:      { icon: 'home',          color: '#4D9EFF', bg: 'rgba(77,158,255,0.08)',   border: 'rgba(77,158,255,0.35)' },
  Profesional:   { icon: 'briefcase',     color: '#F5A623', bg: 'rgba(245,166,35,0.08)',   border: 'rgba(245,166,35,0.35)' },
  Comunitario:   { icon: 'users',         color: '#00D68F', bg: 'rgba(0,214,143,0.08)',    border: 'rgba(0,214,143,0.35)' },
  Investigación: { icon: 'flask-conical', color: '#A88CFF', bg: 'rgba(168,140,255,0.08)', border: 'rgba(168,140,255,0.35)' },
  Personalizado: { icon: 'sparkles',      color: '#B7BAC7', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.18)' },
};

const STATUS_META: Record<string, { color: string; cls: string; dot: string }> = {
  'Por hacer':   { color: '#A88CFF', cls: 'pill-violet', dot: '' },
  'Planificado': { color: '#4D9EFF', cls: 'pill-blue',  dot: 'dot-blue' },
  'En curso':    { color: '#00D68F', cls: 'pill-jade',  dot: 'dot-jade' },
  'En revisión': { color: '#F5A623', cls: 'pill-amber', dot: 'dot-amber' },
  'Pausado':     { color: '#7A7E8F', cls: '',            dot: '' },
  'Completado':  { color: '#B7BAC7', cls: '',            dot: '' },
  'Bloqueado':   { color: '#FF4D6D', cls: 'pill-red',   dot: 'dot-red' },
};

const NAV = [
  { id: 'dashboard',    icon: 'layout-dashboard', label: 'Dashboard' },
  { id: 'projects',     icon: 'folder-kanban',    label: 'Proyectos' },
  { id: 'quotes',       icon: 'file-text',        label: 'Cotizaciones' },
  { id: 'inputs',       icon: 'package',          label: 'Insumos' },
  { id: 'returns',      icon: 'sparkles',         label: 'Retornos' },
  { id: 'settings',     icon: 'settings',         label: 'Configuración' },
];

const QUAL_DIMS = ['Bienestar', 'Aprendizaje', 'Impacto', 'Relaciones', 'Satisfacción'];
const CAT_META: Record<string, { color: string; cls: string }> = {
  'Material': { color: '#F5A623', cls: 'pill-amber' },
  'Servicio': { color: '#4D9EFF', cls: 'pill-blue' },
  'Software': { color: '#A88CFF', cls: 'pill-violet' },
  'RRHH':     { color: '#00D68F', cls: 'pill-jade' },
  'Otro':     { color: '#B7BAC7', cls: '' },
};

const STATUS_MAT_META: Record<string, { color: string; cls: string }> = {
  'Activo':      { color: '#00D68F', cls: 'pill-jade' },
  'Pendiente':   { color: '#F5A623', cls: 'pill-amber' },
  'En revisión': { color: '#4D9EFF', cls: 'pill-blue' },
  'Inactivo':    { color: '#7A7E8F', cls: '' },
};

// ─── HELPERS ─────────────────────────────────────────────────
const fmtCLP = (n: number) => '$' + (n||0).toLocaleString('es-CL');
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K';
  return '$' + (n||0);
};
const fmtDateShort = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
};
const toPascal = (name: string) => name.split(/[-_]/).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
const scopeMeta = (scope: string) => SCOPE_META[scope] || SCOPE_META.Personalizado;

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
      try { const node = fn({ width: size, height: size, stroke: color || 'currentColor', 'stroke-width': strokeWidth }); svg = (node && node.outerHTML) || ''; } catch (e) {}
    }
    if (!svg && w.lucide && w.lucide.icons) {
      const icon = w.lucide.icons[name] || w.lucide.icons[toPascal(name)];
      if (icon && Array.isArray(icon)) {
        const [, attrs, children] = icon;
        const attrStr = Object.entries({ ...attrs, width: size, height: size, stroke: color || 'currentColor', 'stroke-width': strokeWidth, fill: 'none' }).map(([k, v]) => `${k}="${v}"`).join(' ');
        const childStr = (children || []).map((c: any) => { if (Array.isArray(c)) { const [tag, cattrs] = c; return `<${tag} ${Object.entries(cattrs||{}).map(([k,v])=>`${k}="${v}"`).join(' ')} />`; } return ''; }).join('');
        svg = `<svg xmlns="http://www.w3.org/2000/svg" ${attrStr} viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">${childStr}</svg>`;
      }
    }
    ref.current.innerHTML = svg;
  }, [name, size, color, strokeWidth]);
  return <span ref={ref} className={'inline-flex items-center justify-center ' + className} style={{ width: size, height: size, color: color || 'currentColor', flexShrink: 0, ...style }} />;
}

// ─── PRIMITIVES ──────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] || { cls: '', dot: '' };
  return <span className={'pill ' + meta.cls}><span className={'dot ' + meta.dot} />{status}</span>;
}
function ScopePill({ scope }: { scope: string }) {
  const m = scopeMeta(scope);
  return <span className="pill" style={{ color: m.color, borderColor: m.border, background: m.bg }}><I name={m.icon} size={11} />{scope}</span>;
}
function ProgressBar({ value, tone, height = 6 }: { value: number; tone?: string; height?: number }) {
  let cls = 'progress';
  if (tone === 'warn' || (value >= 80 && value < 100 && !tone)) cls += ' warn';
  if (tone === 'danger' || value >= 100) cls += ' danger';
  return <div className={cls} style={{ height }}><i style={{ width: Math.min(100, value) + '%' }} /></div>;
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
    function step(t: number) { if (!start) start = t; const p = Math.min(1, (t-start)/duration); setVal(to*(1-Math.pow(1-p,3))); if(p<1) raf=requestAnimationFrame(step); }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return val;
}
function MoneyCounter({ value }: { value: number }) {
  const v = useCountUp(value);
  return <span className="num">${Math.round(v).toLocaleString('es-CL')}</span>;
}
function SlideOver({ open, onClose, title, subtitle, children, width = 580 }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; width?: number }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 fade-in" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} onClick={onClose}>
      <div className="absolute top-0 right-0 h-full panel-slide" style={{ width: Math.min(width, typeof window !== 'undefined' ? window.innerWidth : width) }} onClick={e => e.stopPropagation()}>
        <div className="h-full flex flex-col" style={{ background: 'linear-gradient(180deg,#0F0F18,#0A0A12)', borderLeft: '1px solid var(--line-strong)' }}>
          <div className="flex items-start justify-between p-6 hairline-b">
            <div>{subtitle && <div className="eyebrow mb-1">{subtitle}</div>}<h2 className="text-2xl font-bold" style={{ fontFamily: 'Sora' }}>{title}</h2></div>
            <button className="btn btn-ghost" onClick={onClose}><I name="x" size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────
function Sidebar({ active, onChange, collapsed, onToggle, projects, mobileOpen, onMobileClose, navItems = NAV }: any) {
  const totalBudget = projects.reduce((a: number, p: any) => a + (p.budget || 0), 0);
  const totalExec = projects.reduce((a: number, p: any) => a + (p.executed || 0), 0);
  const pct = totalBudget > 0 ? (totalExec / totalBudget) * 100 : 0;
  const widthClass = collapsed ? 'w-16' : 'w-60 md:w-64';
  const content = (
    <aside className={`hairline-r relative flex flex-col h-full ${widthClass} transition-width duration-300 ease-out`} style={{ transition: 'width 320ms cubic-bezier(.2,.7,.2,1)', background: 'linear-gradient(180deg,rgba(255,255,255,0.018),rgba(255,255,255,0.003))', backdropFilter: 'blur(20px)' }}>
      <div className="hairline-b flex items-center gap-3 px-4" style={{ height: 72 }}>
        <div style={{ width: 32, height: 32, flexShrink: 0 }}>
          <svg viewBox="0 0 32 32" width="32" height="32">
            <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#00D68F"/><stop offset="100%" stopColor="#1F6B5A"/></linearGradient></defs>
            <path d="M6 22 L6 10 L26 22 L26 10" stroke="url(#lg)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ filter:'drop-shadow(0 0 6px rgba(0,214,143,0.5))' }}/>
            <circle cx="6" cy="10" r="2.5" fill="#00D68F" style={{ filter:'drop-shadow(0 0 6px rgba(0,214,143,0.7))' }}/>
            <circle cx="26" cy="22" r="2.5" fill="#00D68F" style={{ filter:'drop-shadow(0 0 6px rgba(0,214,143,0.7))' }}/>
          </svg>
        </div>
        {!collapsed && <div className="flex-1 min-w-0"><div className="font-bold text-[15px]" style={{ fontFamily:'Sora', letterSpacing:'0.18em' }}>NEXUS</div><div className="text-[10px] mt-px" style={{ color:'var(--text-2)', letterSpacing:'0.16em', textTransform:'uppercase' }}>Control Presupuestario</div></div>}

      </div>
      {collapsed && <button className="btn btn-ghost mx-auto mt-3 !h-7 !w-7 !p-0" onClick={onToggle}><I name="panel-left-open" size={14}/></button>}

      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        {!collapsed && <div className="px-3 pb-2 eyebrow">Workspace</div>}
        <div className="flex flex-col gap-0.5">
          {navItems.map((item: any) => (
            <div key={item.id} className={'nav-item ' + (active === item.id ? 'active' : '')} onClick={() => { onChange(item.id); onMobileClose && onMobileClose(); }} title={item.label}>
              <I name={item.icon} size={17}/>
              {!collapsed && <span className="flex-1">{item.label}</span>}
            </div>
          ))}
        </div>
        {!collapsed && projects.length > 0 && <>
          <div className="px-3 pt-6 pb-2 eyebrow">Reciente</div>
          <div className="flex flex-col gap-0.5">
            {projects.slice(0,3).map((p: any) => (
              <div key={p.id} className="nav-item" style={{ height:32 }} onClick={() => { onChange('project:'+p.id); onMobileClose && onMobileClose(); }}>
                <span className={'inline-block w-1.5 h-1.5 rounded-full '+(p.health==='danger'?'dot-red':'dot-jade')}/>
                <span className="truncate text-[12.5px]" style={{ color:'var(--text-1)' }}>{p.name}</span>
              </div>
            ))}
          </div>
        </>}
      </nav>

      {!collapsed && <div className="px-4 py-4 hairline-t">
        <div className="flex items-center justify-between mb-2">
          <span className="eyebrow !text-[10px]">Presupuesto Global</span>
          <span className="font-mono text-[11px]" style={{ color: pct>100?'#FFB0BF':'var(--text-1)' }}>{pct.toFixed(0)}%</span>
        </div>
        <ProgressBar value={pct} tone={pct>100?'danger':pct>80?'warn':'ok'}/>
        <div className="flex justify-between mt-2 font-mono text-[10.5px]" style={{ color:'var(--text-2)' }}><span>{fmtShort(totalExec)}</span><span>de {fmtShort(totalBudget)}</span></div>
      </div>}

      <div className="hairline-t flex items-center gap-3 px-4 py-3" style={{ height:64 }}>
        <Avatar name="MC" size={32}/>
        {!collapsed && <div className="flex-1 min-w-0"><div className="text-[13px] font-medium truncate">Marcelo</div><div className="text-[11px] truncate" style={{ color:'var(--text-2)' }}>Project Lead</div></div>}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex h-full">{content}</div>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" onClick={onMobileClose}>
          <div onClick={e => e.stopPropagation()} className="w-60 md:w-64">{content}</div>
          <div className="flex-1 bg-black/50"/>
        </div>
      )}
    </>
  );
}

// ─── TOPBAR ──────────────────────────────────────────────────
function TopBar({ title, subtitle, onMenuClick, searchText, onSearchChange, onBellClick, hasNotifications }: { title: string; subtitle?: string; onMenuClick: () => void; searchText: string; onSearchChange: (val: string) => void; onBellClick: () => void; hasNotifications: boolean }) {
  return (
    <header className="hairline-b flex items-center gap-4 px-4 md:px-8" style={{ height:72 }}>

      <div className="flex-1 min-w-0">
        <h1 className="font-bold text-[18px] md:text-[22px] truncate" style={{ fontFamily:'Sora', letterSpacing:'-0.02em' }}>{title}</h1>
        {subtitle && <div className="hidden md:block text-[12px]" style={{ color:'var(--text-2)' }}>{subtitle}</div>}
      </div>
      <div className="hidden md:flex items-center gap-2 px-3 hairline rounded-lg" style={{ height:36, width:320, background:'rgba(255,255,255,0.025)' }}>
        <I name="search" size={14} color="var(--text-2)"/>
        <input className="bg-transparent outline-none text-[13px] flex-1" style={{ color:'var(--text-0)' }} placeholder="Buscar..." value={searchText} onChange={e => onSearchChange(e.target.value)}/>
      </div>
      <button className="btn btn-ghost !w-9 !p-0 relative" onClick={onBellClick}>
        <I name="bell" size={16}/>
        {hasNotifications && (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF4D6D] animate-pulse" />
        )}
      </button>
    </header>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────

function AlertItem({ sev, icon, title, detail }: { sev:string; icon:string; title:string; detail:string }) {
  const t = sev==='red'   ? { color:'#FFB0BF', bg:'rgba(255,77,109,0.10)',  border:'rgba(255,77,109,0.30)' }
           : sev==='amber' ? { color:'#FFD08A', bg:'rgba(245,166,35,0.10)',  border:'rgba(245,166,35,0.30)' }
           :                 { color:'#B5D6FF', bg:'rgba(77,158,255,0.10)',  border:'rgba(77,158,255,0.30)' };
  return (
    <div className="flex gap-3 p-3 rounded-xl" style={{ background:'rgba(255,255,255,0.02)', border:'1px solid var(--line)' }}>
      <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width:32, height:32, color:t.color, background:t.bg, border:`1px solid ${t.border}` }}>
        <I name={icon} size={14}/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium leading-tight">{title}</div>
        <div className="text-[11.5px] mt-0.5" style={{ color:'var(--text-2)' }}>{detail}</div>
      </div>
    </div>
  );
}

function ProjectMultiSelectCompact({ projects, selected, onToggle, onClear, open, setOpen }: any) {
  const selectedProjects = projects.filter((p:any) => selected.includes(p.id));
  const showAll = selected.length === 0;
  return (
    <Card className="p-3" strong>
      <div className="flex items-center gap-3">
        <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width:32, height:32, background:'rgba(77,158,255,0.10)', border:'1px solid rgba(77,158,255,0.30)', color:'#4D9EFF' }}>
          <I name="folder-open" size={15}/>
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          {showAll ? (
            <span className="text-[12.5px] font-medium">Vista: todos los proyectos</span>
          ) : selectedProjects.length <= 3 ? (
            selectedProjects.map((p:any) => {
              const m = scopeMeta(p.scope);
              return (
                <span key={p.id} className="pill !text-[11px]" style={{ background:m.bg, borderColor:m.border, color:m.color, cursor:'pointer', gap:'4px', display:'inline-flex', alignItems:'center' }} onClick={()=>onToggle(p.id)}>
                  <I name={m.icon} size={10}/>{p.name}<I name="x" size={9} style={{ opacity:0.6 }}/>
                </span>
              );
            })
          ) : (
            <span className="pill pill-blue !text-[11px]"><I name="check" size={10}/>{selected.length} proyectos seleccionados</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!showAll && <button className="btn btn-ghost !h-7 !text-[11px]" onClick={onClear}>Ver todos</button>}
          <button className="btn !h-7 !text-[11px]" onClick={()=>setOpen(!open)}>
            <I name={open?'chevron-up':'filter'} size={11}/>{open?'Cerrar':'Filtrar'}
          </button>
        </div>
      </div>
      {open && (
        <div className="hairline-t mt-3 pt-3 grid grid-cols-2 md:grid-cols-4 gap-2 fade-in">
          {projects.map((p:any) => {
            const isSel = selected.includes(p.id);
            const m = scopeMeta(p.scope);
            return (
              <button key={p.id} onClick={()=>onToggle(p.id)} className="flex items-center gap-2 p-2 rounded-lg text-left transition-all" style={{ background:isSel?'rgba(77,158,255,0.08)':'rgba(255,255,255,0.02)', border:`1px solid ${isSel?'rgba(77,158,255,0.40)':'var(--line)'}` }}>
                <span className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0" style={{ background:isSel?'#4D9EFF':'rgba(255,255,255,0.04)', border:`1px solid ${isSel?'#4D9EFF':'var(--line-strong)'}` }}>
                  {isSel && <I name="check" size={9} color="#0A0A12"/>}
                </span>
                <span className="rounded flex items-center justify-center flex-shrink-0" style={{ width:20, height:20, background:m.bg, border:`1px solid ${m.border}`, color:m.color }}>
                  <I name={m.icon} size={10}/>
                </span>
                <span className="text-[11.5px] font-medium truncate">{p.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Dashboard({ projects, onOpenProject }: { projects: any[]; onOpenProject: (id: string) => void }) {
  const [filterIds, setFilterIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const scoped = useMemo(
    () => filterIds.length > 0 ? projects.filter(p => filterIds.includes(p.id)) : projects,
    [filterIds, projects]
  );

  const totalBudget = scoped.reduce((a:number,p:any) => a+(p.budget||0), 0);
  const totalExec   = scoped.reduce((a:number,p:any) => a+(p.executed||0), 0);
  const remaining   = totalBudget - totalExec;
  const variation   = totalBudget > 0 ? ((totalExec-totalBudget)/totalBudget)*100 : 0;
  const vUp = useCountUp(Math.abs(variation));

  const projWithROI  = scoped.filter((p:any) => p.roi != null);
  const projWithQual = scoped.filter((p:any) => (p.qualitative||[]).length > 0);
  const avgROI  = projWithROI.length  ? projWithROI.reduce((a:number,p:any) => a+(p.roi||0), 0) / projWithROI.length : 0;
  const avgQual = projWithQual.length ? projWithQual.reduce((a:number,p:any) =>
    a + (p.qualitative||[]).reduce((s:number,d:any)=>s+d.score,0)/p.qualitative.length, 0) / projWithQual.length : 0;

  const alerts = useMemo(() => [
    ...scoped.filter((p:any) => p.health==='danger').map((p:any) => ({
      id:p.id+'_over', sev:'red', icon:'alert-triangle',
      title:`${p.name} sobre presupuesto`,
      detail:`${p.progress||0}% ejecutado · ${fmtCLP(p.executed||0)} de ${fmtCLP(p.budget||0)}`
    })),
    ...scoped.filter((p:any) => p.health==='warn').map((p:any) => ({
      id:p.id+'_warn', sev:'amber', icon:'trending-up',
      title:`${p.name} cerca del límite`,
      detail:`${p.progress||0}% ejecutado · quedan ${fmtCLP(Math.max(0,(p.budget||0)-(p.executed||0)))}`
    })),
    ...scoped.filter((p:any) => {
      if (!p.next_date) return false;
      const d = Math.ceil((new Date(p.next_date).getTime()-Date.now())/86400000);
      return d>=0 && d<=10;
    }).map((p:any) => {
      const d = Math.ceil((new Date(p.next_date).getTime()-Date.now())/86400000);
      return { id:p.id+'_hito', sev:'blue', icon:'calendar',
        title:p.next_label||'Hito próximo',
        detail:`${p.name} · ${d===0?'hoy':`en ${d}d`}` };
    }),
  ], [scoped]);

  const MOOD_TONE: Record<string,{color:string;bg:string;border:string}> = {
    jade:  {color:'#6FFFCB',bg:'rgba(0,214,143,0.07)',   border:'rgba(0,214,143,0.28)'},
    amber: {color:'#FFD08A',bg:'rgba(245,166,35,0.07)',  border:'rgba(245,166,35,0.28)'},
    blue:  {color:'#B5D6FF',bg:'rgba(77,158,255,0.07)',  border:'rgba(77,158,255,0.28)'},
    violet:{color:'#D5C2FF',bg:'rgba(168,140,255,0.07)',border:'rgba(168,140,255,0.28)'},
  };
  const MOOD_KEYS = ['jade','amber','blue','violet'];
  const moods = scoped
    .filter((p:any) => (p.qualitative||[]).some((d:any)=>d.note))
    .slice(0,5)
    .map((p:any,i:number) => {
      const best = (p.qualitative||[]).filter((d:any)=>d.note).sort((a:any,b:any)=>b.score-a.score)[0];
      return { id:p.id, project:p.name, note:best?.note, score:best?.score, dim:best?.dim, tone:MOOD_KEYS[i%MOOD_KEYS.length] };
    });

  function toggleFilter(pid:string) { setFilterIds(s=>s.includes(pid)?s.filter(x=>x!==pid):[...s,pid]); }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Project filter bar */}
      <ProjectMultiSelectCompact projects={projects} selected={filterIds} onToggle={toggleFilter} onClear={()=>setFilterIds([])} open={pickerOpen} setOpen={setPickerOpen}/>

      {/* 5-KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <Card className="p-4 md:p-5 card-hover rise" style={{ minHeight:110 }}>
          <div className="eyebrow text-[10px] md:text-[11px]">Presupuesto Total</div>
          <div className="mt-2 md:mt-3 font-mono font-semibold" style={{ fontSize:22, lineHeight:1.05 }}><MoneyCounter value={totalBudget}/></div>
          <div className="mt-1 text-[11px]" style={{ color:'var(--text-2)' }}>{scoped.length} proyecto{scoped.length!==1?'s':''} activos</div>
        </Card>
        <Card className="p-4 md:p-5 card-hover rise" style={{ minHeight:110 }}>
          <div className="eyebrow text-[10px] md:text-[11px]">Ejecutado</div>
          <div className="mt-2 md:mt-3 font-mono font-semibold" style={{ fontSize:22, lineHeight:1.05 }}><MoneyCounter value={totalExec}/></div>
          <div className="mt-1 text-[11px]" style={{ color:'var(--text-2)' }}>{totalBudget>0?((totalExec/totalBudget)*100).toFixed(1):0}% del total</div>
        </Card>
        <Card className="p-4 md:p-5 card-hover rise" style={{ minHeight:110 }}>
          <div className="flex items-start justify-between">
            <div className="eyebrow text-[10px] md:text-[11px]">Por Ejecutar</div>
            <span className={'pill !py-0.5 !text-[10px] '+(remaining<0?'pill-red':'pill-jade')}>{remaining<0?'déficit':'saludable'}</span>
          </div>
          <div className="mt-2 font-mono font-semibold" style={{ fontSize:22, lineHeight:1.05 }}><MoneyCounter value={Math.abs(remaining)}/></div>
          <div className="mt-1 text-[11px]" style={{ color:'var(--text-2)' }}>{remaining<0?'déficit a cubrir':'disponible'}</div>
        </Card>
        <Card className="p-4 md:p-5 card-hover rise" style={{ minHeight:110 }}>
          <div className="flex items-start justify-between">
            <div className="eyebrow text-[10px] md:text-[11px]">Variación</div>
            <span className={'pill !py-0.5 !text-[10px] '+(variation>5?'pill-red':variation>0?'pill-amber':'pill-jade')}>
              <I name={variation>0?'trending-up':'trending-down'} size={10}/>
              {variation>0?'sobre plan':'bajo plan'}
            </span>
          </div>
          <div className="mt-2 font-mono font-semibold" style={{ fontSize:26, color:variation>5?'#FFB0BF':variation>0?'#FFD08A':'#6FFFCB' }}>
            {variation>=0?'+':''}{vUp.toFixed(1)}<span className="text-lg opacity-70">%</span>
          </div>
          <div className="mt-1 text-[11px]" style={{ color:'var(--text-2)' }}>frente a presupuesto</div>
        </Card>
        <Card className="p-4 md:p-5 card-hover rise col-span-2 md:col-span-1" style={{ minHeight:110 }}>
          <div className="eyebrow text-[10px] md:text-[11px]">Retornos</div>
          <div className="mt-2 md:mt-3 flex items-baseline gap-3">
            <div>
              <div className="text-[10px] mb-0.5" style={{ color:'var(--text-2)' }}>ROI financiero</div>
              <div className="font-mono font-semibold" style={{ fontSize:20, color:avgROI>0?'#6FFFCB':'var(--text-1)' }}>{avgROI>0?`+${avgROI.toFixed(0)}%`:'—'}</div>
            </div>
            <div className="self-stretch w-px" style={{ background:'var(--line)' }}/>
            <div>
              <div className="text-[10px] mb-0.5" style={{ color:'var(--text-2)' }}>Cualitativo</div>
              <div className="font-mono font-semibold" style={{ fontSize:20, color:avgQual>=8?'#6FFFCB':avgQual>=5?'#FFD08A':'var(--text-1)' }}>{avgQual>0?`${avgQual.toFixed(1)}/10`:'—'}</div>
            </div>
          </div>
          <div className="mt-1.5 text-[10px]" style={{ color:'var(--text-2)' }}>{projWithROI.length} con ROI · {projWithQual.length} evaluados</div>
        </Card>
      </div>

      {/* Chart + Alerts */}
      {scoped.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: alerts.length>0 ? '1fr' : '1fr' }}>
          <div className={`grid gap-4 ${alerts.length>0 ? 'md:grid-cols-[1fr_360px]' : ''}`}>
            <Card className="p-4 md:p-6">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <div className="eyebrow mb-1">Presupuesto vs Ejecución</div>
                  <h3 className="font-bold text-[16px] md:text-[18px]" style={{ fontFamily:'Sora' }}>Comparativa por proyecto</h3>
                </div>
                <div className="flex items-center gap-3">
                  {[{color:'rgba(77,158,255,0.5)',label:'Presupuesto'},{color:'#00D68F',label:'Ejecutado'}].map(l=>(
                    <span key={l.label} className="hidden md:flex items-center gap-1.5 text-[11px]" style={{ color:'var(--text-2)' }}>
                      <span className="inline-block w-3 h-2.5 rounded-sm" style={{ background:l.color }}/>{l.label}
                    </span>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={scoped.map((p:any)=>({ name:p.name.length>13?p.name.slice(0,13)+'…':p.name, Presupuesto:p.budget||0, Ejecutado:p.executed||0 }))} margin={{ top:4, right:8, left:0, bottom:4 }} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                  <XAxis dataKey="name" tick={{ fill:'var(--text-2)', fontSize:11 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:'var(--text-2)', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={n=>fmtShort(n)} width={52}/>
                  <Tooltip contentStyle={{ background:'#0F0F18', border:'1px solid var(--line-strong)', borderRadius:10, fontSize:12, padding:'8px 12px' }} formatter={(v:any)=>[fmtCLP(Number(v)),undefined]} labelStyle={{ color:'var(--text-1)', fontWeight:600, marginBottom:4 }} cursor={{ fill:'rgba(255,255,255,0.03)' }}/>
                  <Bar dataKey="Presupuesto" fill="rgba(77,158,255,0.25)" radius={[3,3,0,0]} maxBarSize={32}/>
                  <Bar dataKey="Ejecutado" radius={[3,3,0,0]} maxBarSize={32}>
                    {scoped.map((p:any,i:number)=><Cell key={i} fill={p.health==='danger'?'#FF4D6D':p.health==='warn'?'#F5A623':'#00D68F'}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {alerts.length > 0 && (
              <Card className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-[15px] flex items-center gap-2" style={{ fontFamily:'Sora' }}>
                    <I name="bell-ring" size={15} color="#F5A623"/>Alertas
                  </h3>
                  {alerts.filter(a=>a.sev==='red').length > 0 && (
                    <span className="pill pill-red"><span className="dot dot-red"/>{alerts.filter(a=>a.sev==='red').length} crítica{alerts.filter(a=>a.sev==='red').length!==1?'s':''}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight:260 }}>
                  {alerts.map(a=><AlertItem key={a.id} sev={a.sev} icon={a.icon} title={a.title} detail={a.detail}/>)}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Project map */}
      <div>
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="eyebrow mb-1">Mapa de proyectos</div>
            <h2 className="font-bold text-[18px] md:text-[20px]" style={{ fontFamily:'Sora' }}>
              {scoped.length} {scoped.length===1?'iniciativa':'iniciativas'} {filterIds.length>0?'seleccionadas':'activas'}
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scoped.map((p:any) => {
            const m = scopeMeta(p.scope);
            const daysLeft = p.next_date ? Math.ceil((new Date(p.next_date).getTime()-Date.now())/86400000) : null;
            const urgent = daysLeft != null && daysLeft >= 0 && daysLeft < 8;
            return (
              <div key={p.id} className="glass rounded-2xl p-4 md:p-5 card-hover cursor-pointer rise" onClick={()=>onOpenProject(p.id)}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-md flex items-center justify-center" style={{ width:32,height:32,background:m.bg,border:`1px solid ${m.border}`,color:m.color }}><I name={m.icon} size={15}/></span>
                    <div><div className="font-semibold text-[14px]" style={{ fontFamily:'Sora' }}>{p.name}</div><div className="text-[11px] font-mono" style={{ color:'var(--text-3)' }}>{p.code}</div></div>
                  </div>
                  <StatusPill status={p.status||'En curso'}/>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[11px]" style={{ color:'var(--text-2)' }}>Ejecución</span>
                    <span className="font-mono text-[12px]" style={{ color:p.health==='danger'?'#FFB0BF':p.health==='warn'?'#FFD08A':'#6FFFCB' }}>{p.progress||0}%</span>
                  </div>
                  <ProgressBar value={p.progress||0} tone={p.health==='danger'?'danger':p.health==='warn'?'warn':'ok'}/>
                  <div className="flex justify-between mt-2 font-mono text-[11px]" style={{ color:'var(--text-2)' }}><span>{fmtShort(p.executed||0)}</span><span>de {fmtShort(p.budget||0)}</span></div>
                </div>
                <div className="mt-3 pt-3 hairline-t flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <I name={urgent?'alert-circle':'calendar'} size={12} color={urgent?'#F5A623':'var(--text-2)'}/>
                    <span className="text-[11px] truncate" style={{ color:'var(--text-1)' }}>{p.next_label||'Sin hitos'}</span>
                  </div>
                  <span className="font-mono text-[11px] flex-shrink-0" style={{ color:urgent?'#FFD08A':'var(--text-2)' }}>
                    {daysLeft!=null && daysLeft>=0 ? (daysLeft===0?'hoy':`en ${daysLeft}d`) : p.next_date?fmtDateShort(p.next_date):'—'}
                  </span>
                </div>
              </div>
            );
          })}
          {scoped.length===0 && <div className="col-span-3 glass rounded-2xl p-12 text-center" style={{ color:'var(--text-2)' }}><I name="folder-open" size={32} className="mx-auto mb-3 opacity-40"/><p>{filterIds.length>0?'Sin proyectos en el filtro.':'No hay proyectos. Crea uno desde Proyectos.'}</p></div>}
        </div>
      </div>

      {/* Mood board — qualitative highlights */}
      {moods.length > 0 && (
        <Card className="p-4 md:p-5">
          <div className="flex items-center gap-3 mb-4">
            <I name="sparkles" size={16} color="#F5A623"/>
            <h3 className="font-bold text-[15px]" style={{ fontFamily:'Sora' }}>Retornos cualitativos</h3>
            <span className="text-[11px] hidden md:block" style={{ color:'var(--text-2)' }}>Las mejores valoraciones registradas</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {moods.map((mood:any) => {
              const t = MOOD_TONE[mood.tone];
              return (
                <div key={mood.id} className="rounded-xl p-3" style={{ background:t.bg, border:`1px solid ${t.border}` }}>
                  <p className="text-[12.5px] leading-snug" style={{ color:t.color, fontStyle:'italic' }}>"{mood.note}"</p>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <span className="text-[10.5px] truncate" style={{ color:'var(--text-2)' }}>{mood.dim} · {mood.project}</span>
                    <span className="font-mono text-[11px] flex-shrink-0" style={{ color:t.color }}>{mood.score}/10</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── PROJECT ACTION DROPDOWN ─────────────────────────────────
function ProjectActionDropdown({ project, onClose, onOpenDetail, onRefresh, position }: { project: any; onClose: () => void; onOpenDetail: () => void; onRefresh: () => void; position?: {x:number; y:number} }) {
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [onClose]);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    const { error } = await supabase.from('proyectos').update({ status: newStatus }).eq('id', project.id);
    setLoading(false);
    if (!error) {
      onRefresh();
      onClose();
    } else {
      alert('Error: ' + error.message);
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar proyecto "${project.name}" y toda su información vinculada?`)) return;
    setLoading(true);
    const { error } = await supabase.from('proyectos').delete().eq('id', project.id);
    setLoading(false);
    if (!error) {
      onRefresh();
      onClose();
    } else {
      alert('Error: ' + error.message);
    }
  }

  const posStyle: React.CSSProperties = position
    ? { position: 'fixed', top: position.y + 4, left: Math.min(position.x - 160, window.innerWidth - 170), right: 'auto' }
    : { position: 'absolute', right: 8, top: 40 };

  return (
    <div ref={ref} className="z-[999] rounded-xl p-1.5 shadow-2xl flex flex-col min-w-[160px] border border-white/10" style={{ ...posStyle, background: '#0F0F18', backdropFilter: 'blur(16px)' }} onClick={e => e.stopPropagation()}>
      <button className="flex items-center gap-2 px-2.5 py-1.5 text-[11.5px] rounded-lg text-left hover:bg-white/5 transition-all text-white w-full" onClick={onOpenDetail}>
        <I name="eye" size={13} color="var(--text-2)" />Ver detalles
      </button>

      <div className="hairline-t my-1" />

      <div className="px-2.5 py-1 text-[9px] eyebrow">Cambiar estado</div>
      {(['Por hacer', 'Planificado', 'En curso', 'Pausado', 'Bloqueado', 'Completado'] as const).map(st => {
        const active = project.status === st;
        const c = STATUS_META[st]?.color || '#7A7E8F';
        return (
          <button key={st} disabled={loading} className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] rounded-lg text-left hover:bg-white/5 transition-all w-full" style={{ color: active ? c : 'var(--text-2)' }} onClick={() => updateStatus(st)}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: active ? c : '#374151' }}/>
            {st}
          </button>
        );
      })}

      <div className="hairline-t my-1" />

      <button disabled={loading} className="flex items-center gap-2 px-2.5 py-1.5 text-[11.5px] rounded-lg text-left hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-all w-full" onClick={handleDelete}>
        <I name="trash-2" size={13} color="currentColor" />Eliminar
      </button>
    </div>
  );
}

// ─── PROJECTS VIEW ───────────────────────────────────────────
const STATUS_SORT_ORDER: Record<string, number> = {
  'En curso': 0, 'Planificado': 1, 'Por hacer': 2, 'Bloqueado': 3, 'Pausado': 4, 'En revisión': 5, 'Completado': 6,
};

function ProjectsView({ projects, onOpenProject, onRefresh }: { projects: any[]; onOpenProject: (id:string)=>void; onRefresh: ()=>void }) {
  const [view, setView] = useState<'list'|'kanban'>('list');
  const [newOpen, setNewOpen] = useState(false);
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{x:number; y:number}>({x:0, y:0});
  const [sortCol, setSortCol] = useState('status');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');

  function handleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const sorted = useMemo(() => {
    return [...projects].sort((a, b) => {
      let av: any, bv: any;
      if (sortCol === 'status') { av = STATUS_SORT_ORDER[a.status] ?? 99; bv = STATUS_SORT_ORDER[b.status] ?? 99; }
      else if (sortCol === 'name') { av = a.name?.toLowerCase(); bv = b.name?.toLowerCase(); }
      else if (sortCol === 'scope') { av = a.scope?.toLowerCase(); bv = b.scope?.toLowerCase(); }
      else if (sortCol === 'budget') { av = a.budget || 0; bv = b.budget || 0; }
      else if (sortCol === 'executed') { av = a.executed || 0; bv = b.executed || 0; }
      else if (sortCol === 'progress') { av = a.progress || 0; bv = b.progress || 0; }
      else return 0;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [projects, sortCol, sortDir]);

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <I name="chevrons-up-down" size={11} color="var(--text-3)"/>;
    return <I name={sortDir === 'asc' ? 'chevron-up' : 'chevron-down'} size={11} color="var(--jade)"/>;
  }

  const menuProject = menuProjectId ? projects.find(p => p.id === menuProjectId) : null;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><h2 className="font-bold text-[20px] md:text-[22px]" style={{ fontFamily:'Sora' }}>Proyectos</h2><span className="pill">{projects.length} totales</span></div>
        <div className="flex items-center gap-2">
          <div className="flex items-center hairline rounded-lg overflow-hidden" style={{ background:'rgba(255,255,255,0.02)' }}>
            {(['list','kanban'] as const).map(v => (
              <button key={v} onClick={()=>setView(v)} className="px-3 h-9 transition-all flex items-center gap-1.5 text-[12px]" style={{ background:view===v?'rgba(255,255,255,0.06)':'transparent', color:view===v?'var(--text-0)':'var(--text-2)' }}>
                <I name={v==='list'?'list':'layout-grid'} size={13}/><span className="hidden md:inline">{v==='list'?'Lista':'Kanban'}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={()=>setNewOpen(true)}><I name="plus" size={14}/><span className="hidden md:inline">Nuevo proyecto</span></button>
        </div>
      </div>

      {view==='list' ? (
        <div className="overflow-x-auto">
          <Card className="overflow-hidden min-w-full md:min-w-[700px]">
            <table className="tbl">
              <thead>
                <tr>
                  {[
                    { col:'name',     label:'Proyecto',     style:{} },
                    { col:'scope',    label:'Ámbito',       style:{width:120} },
                    { col:'budget',   label:'Presupuesto',  style:{width:120} },
                    { col:'executed', label:'Ejecutado',    style:{width:120} },
                    { col:'progress', label:'Avance',       style:{width:180} },
                    { col:'status',   label:'Estado',       style:{width:110} },
                  ].map(({ col, label, style }) => (
                    <th key={col} style={style} className="cursor-pointer select-none" onClick={() => handleSort(col)}>
                      <div className="flex items-center gap-1">{label}<SortIcon col={col}/></div>
                    </th>
                  ))}
                  <th style={{width:40}}/>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p:any) => {
                  const m = scopeMeta(p.scope);
                  return (
                    <tr key={p.id} onClick={()=>onOpenProject(p.id)} style={{ cursor:'pointer' }}>
                      <td><div className="flex items-center gap-3"><span className="rounded-md flex items-center justify-center" style={{ width:26,height:26,background:m.bg,border:`1px solid ${m.border}`,color:m.color }}><I name={m.icon} size={13}/></span><div><div className="font-medium">{p.name}</div><div className="text-[10px] font-mono" style={{ color:'var(--text-3)' }}>{p.code}</div></div></div></td>
                      <td><ScopePill scope={p.scope||'Personal'}/></td>
                      <td className="font-mono">{fmtShort(p.budget||0)}</td>
                      <td className="font-mono" style={{ color:p.health==='danger'?'#FFB0BF':'var(--text-0)' }}>{fmtShort(p.executed||0)}</td>
                      <td><div className="flex items-center gap-2"><div className="flex-1"><ProgressBar value={p.progress||0} tone={p.health==='danger'?'danger':'ok'}/></div><span className="font-mono text-[11px] w-8 text-right">{p.progress||0}%</span></div></td>
                      <td><StatusPill status={p.status||'En curso'}/></td>
                      <td>
                        <button className="btn btn-ghost !w-8 !p-0" onClick={(e)=>{ e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenuPos({x:r.right, y:r.bottom}); setMenuProjectId(menuProjectId===p.id?null:p.id); }}><I name="more-horizontal" size={14}/></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {projects.length===0 && <div className="p-12 text-center" style={{ color:'var(--text-2)' }}><p>Crea el primer proyecto.</p></div>}
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {(['Por hacer','Planificado','En curso','Completado'] as const).map(col => {
            const items = projects.filter((p:any)=>p.status===col);
            const meta = STATUS_META[col];
            return (
              <div key={col} className="kanban-col">
                <div className="flex items-center gap-2 mb-3"><span className="w-2 h-2 rounded-full" style={{ background:meta?.color }}/><span className="font-semibold text-[12px]" style={{ fontFamily:'Sora' }}>{col}</span><span className="font-mono text-[11px]" style={{ color:'var(--text-2)' }}>{items.length}</span></div>
                {items.map((p:any)=>(
                  <div key={p.id} className="glass rounded-xl p-3 mb-3 card-hover cursor-pointer" onClick={()=>onOpenProject(p.id)}>
                    <div className="font-semibold text-[13px] mb-2" style={{ fontFamily:'Sora' }}>{p.name}</div>
                    <ProgressBar value={p.progress||0} tone={p.health==='danger'?'danger':'ok'}/>
                    <div className="flex justify-between mt-1.5 font-mono text-[10px]" style={{ color:'var(--text-1)' }}><span>{fmtShort(p.executed||0)}</span><span>{fmtShort(p.budget||0)}</span></div>
                  </div>
                ))}
                {items.length===0 && <div className="text-[12px] text-center py-6" style={{ color:'var(--text-3)' }}>Vacío</div>}
              </div>
            );
          })}
        </div>
      )}

      <NewProjectPanel open={newOpen} onClose={()=>{ setNewOpen(false); onRefresh(); }}/>

      {/* Dropdown flotante fuera del overflow-hidden */}
      {menuProject && (
        <ProjectActionDropdown
          project={menuProject}
          position={menuPos}
          onClose={()=>setMenuProjectId(null)}
          onOpenDetail={()=>{ onOpenProject(menuProject.id); setMenuProjectId(null); }}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

// ─── NEW PROJECT PANEL ───────────────────────────────────────
function NewProjectPanel({ open, onClose }: { open:boolean; onClose:()=>void }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name:'', description:'', scope:'Personal', budget:'', status:'En curso' });
  async function handleCreate() {
    if (!form.name.trim()) return;
    setLoading(true);
    const id = 'p'+Date.now();
    const code = 'PRJ-'+String(Math.floor(Math.random()*900)+100);
    const { error } = await supabase.from('proyectos').insert([{ id, code, name:form.name, description:form.description, scope:form.scope, budget:Number(form.budget)||0, executed:0, status:form.status, health:'ok', progress:0, currency:'CLP', return_type:'Cualitativo' }]);
    setLoading(false);
    if (!error) { setForm({ name:'', description:'', scope:'Personal', budget:'', status:'En curso' }); onClose(); }
    else alert('Error: '+error.message);
  }
  return (
    <SlideOver open={open} onClose={onClose} subtitle="Nuevo proyecto" title="Crear iniciativa">
      <div className="space-y-5">
        <div><label className="label">Nombre *</label><input className="input" placeholder="Ej. Invernadero, Taller..." value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
        <div><label className="label">Descripción</label><textarea className="textarea" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
        <div><label className="label">Ámbito *</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(SCOPE_META).map(([name,meta])=>(
              <button key={name} onClick={()=>setForm({...form,scope:name})} className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all" style={{ background:form.scope===name?meta.bg:'rgba(255,255,255,0.02)', border:`1px solid ${form.scope===name?meta.border:'var(--line)'}`, color:form.scope===name?meta.color:'var(--text-1)' }}>
                <I name={meta.icon} size={16}/><span className="text-[10px] font-medium">{name}</span>
              </button>
            ))}
          </div>
        </div>
        <div><label className="label">Presupuesto (CLP)</label><input className="input" placeholder="0" value={form.budget} onChange={e=>setForm({...form,budget:e.target.value})}/></div>
        <div><label className="label">Estado</label><select className="select" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{(['Por hacer','Planificado','En curso','Pausado','Bloqueado','Completado']).map(s=><option key={s}>{s}</option>)}</select></div>
      </div>
      <div className="hairline-t mt-8 pt-5 flex items-center justify-between">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleCreate} disabled={loading}><I name="check" size={14}/>{loading?'Creando...':'Crear proyecto'}</button>
      </div>
    </SlideOver>
  );
}

// ─── PROJECT TABS ─────────────────────────────────────────────
const PROJECT_TABS = [
  { id: 'resumen',      icon: 'layout-dashboard', label: 'Resumen' },
  { id: 'presupuesto',  icon: 'wallet',           label: 'Presupuesto' },
  { id: 'cotizaciones', icon: 'file-text',        label: 'Cotizaciones' },
  { id: 'insumos',      icon: 'package',          label: 'Insumos' },
  { id: 'retornos',     icon: 'sparkles',         label: 'Retornos' },
  { id: 'timeline',     icon: 'milestone',        label: 'Timeline' },
] as const;
type ProjectTab = typeof PROJECT_TABS[number]['id'];

function TabResumen({ project, form, setForm, editing, progress }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {[{label:'Presupuesto',value:fmtCLP(Number(form.budget)||0)},{label:'Ejecutado',value:fmtCLP(Number(form.executed)||0)},{label:'Avance',value:`${progress}%`}].map(k=>(
          <Card key={k.label} className="p-4 md:p-5"><div className="eyebrow text-[10px]">{k.label}</div><div className="mt-2 font-mono font-semibold text-[20px] md:text-[24px]">{k.value}</div></Card>
        ))}
      </div>
      <Card className="p-4 md:p-5">
        <div className="eyebrow mb-3">Progreso de ejecución</div>
        <ProgressBar value={progress} tone={progress>=100?'danger':progress>=80?'warn':'ok'} height={10}/>
        <div className="flex justify-between mt-2 font-mono text-[11px] md:text-[12px]" style={{ color:'var(--text-2)' }}><span>{fmtCLP(Number(form.executed)||0)} ejecutado</span><span>{fmtCLP(Number(form.budget)||0)} presupuestado</span></div>
      </Card>
      {editing ? (
        <Card className="p-4 md:p-6">
          <div className="eyebrow mb-4">Editar proyecto</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="label">Nombre</label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
            <div className="md:col-span-2"><label className="label">Descripción</label><textarea className="textarea" value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/></div>
            <div><label className="label">Presupuesto (CLP)</label><input className="input" type="number" value={form.budget||0} onChange={e=>setForm({...form,budget:e.target.value})}/></div>
            <div><label className="label">Ejecutado (CLP)</label><input className="input" type="number" value={form.executed||0} onChange={e=>setForm({...form,executed:e.target.value})}/></div>
            <div><label className="label">Estado</label><select className="select" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{(['Por hacer','Planificado','En curso','Pausado','Bloqueado','Completado']).map(s=><option key={s}>{s}</option>)}</select></div>
            <div><label className="label">Ámbito</label><select className="select" value={form.scope} onChange={e=>setForm({...form,scope:e.target.value})}>{Object.keys(SCOPE_META).map(s=><option key={s}>{s}</option>)}</select></div>
            <div><label className="label">Fecha inicio</label><input className="input" type="date" value={form.start_date||''} onChange={e=>setForm({...form,start_date:e.target.value})}/></div>
            <div><label className="label">Fecha fin</label><input className="input" type="date" value={form.end_date||''} onChange={e=>setForm({...form,end_date:e.target.value})}/></div>
            <div><label className="label">Próximo hito</label><input className="input" value={form.next_label||''} onChange={e=>setForm({...form,next_label:e.target.value})} placeholder="Ej. Pago hito 1"/></div>
            <div><label className="label">Fecha hito</label><input className="input" type="date" value={form.next_date||''} onChange={e=>setForm({...form,next_date:e.target.value})}/></div>
          </div>
        </Card>
      ) : (
        <Card className="p-4 md:p-6">
          <div className="eyebrow mb-4">Información del proyecto</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><div className="label">Descripción</div><p className="text-[13px]" style={{ color:'var(--text-1)' }}>{project.description||'—'}</p></div>
            <div className="space-y-3">
              <div><div className="label">Ámbito</div><ScopePill scope={project.scope||'Personal'}/></div>
              <div><div className="label">Periodo</div><span className="font-mono text-[12px]">{fmtDateShort(project.start_date)} → {fmtDateShort(project.end_date)}</span></div>
              {project.next_label && <div><div className="label">Próximo hito</div><span className="text-[13px]">{project.next_label} · {fmtDateShort(project.next_date)}</span></div>}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function TabPresupuesto({ project, onRefresh }: { project:any; onRefresh:()=>void }) {
  const [editing, setEditing] = useState(false);
  const [vals, setVals] = useState({ budget: Number(project.budget)||0, executed: Number(project.executed)||0 });
  const [loading, setLoading] = useState(false);
  const [insumosTotal, setInsumosTotal] = useState<number|null>(null);

  useEffect(() => { setVals({ budget: Number(project.budget)||0, executed: Number(project.executed)||0 }); }, [project.budget, project.executed]);

  useEffect(() => {
    supabase.from('insumos').select('unit_price,quantity').eq('project_id', project.id).then(({ data }) => {
      if (data) setInsumosTotal(data.reduce((s,i) => s + (Number(i.unit_price)||0)*(Number(i.quantity)||1), 0));
    });
  }, [project.id]);

  const progress = vals.budget > 0 ? Math.round((vals.executed / vals.budget) * 100) : 0;
  const remaining = vals.budget - vals.executed;

  function syncFromInsumos() {
    if (insumosTotal === null) return;
    setVals(v => ({ ...v, executed: insumosTotal }));
    setEditing(true);
  }

  async function handleSave() {
    setLoading(true);
    const prog = vals.budget>0?Math.round((vals.executed/vals.budget)*100):0;
    const health = prog>=100?'danger':prog>=80?'warn':'ok';
    const { error } = await supabase.from('proyectos').update({ budget:vals.budget, executed:vals.executed, progress:prog, health }).eq('id',project.id);
    setLoading(false);
    if (!error) { setEditing(false); onRefresh(); }
    else alert('Error: '+error.message);
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'Presupuesto total', value:fmtCLP(vals.budget),         color:'var(--text-0)' },
          { label:'Ejecutado',         value:fmtCLP(vals.executed),        color:progress>=100?'#FFB0BF':progress>=80?'#FFD08A':'var(--text-0)' },
          { label:'Disponible',        value:fmtCLP(Math.abs(remaining)), color:remaining<0?'#FFB0BF':'#6FFFCB' },
          { label:'Ejecución',         value:`${progress}%`,               color:progress>=100?'#FFB0BF':progress>=80?'#FFD08A':'#6FFFCB' },
        ].map(k=>(
          <Card key={k.label} className="p-4 md:p-5">
            <div className="eyebrow text-[10px]">{k.label}</div>
            <div className="mt-2 font-mono font-semibold text-[20px] md:text-[22px]" style={{ color:k.color }}>{k.value}</div>
            {k.label==='Disponible' && <div className="text-[10px] mt-1" style={{ color:'var(--text-3)' }}>{remaining<0?'déficit':'por ejecutar'}</div>}
          </Card>
        ))}
      </div>
      <Card className="p-4 md:p-5">
        <div className="eyebrow mb-3">Progreso de ejecución presupuestaria</div>
        <ProgressBar value={progress} tone={progress>=100?'danger':progress>=80?'warn':'ok'} height={12}/>
        <div className="flex justify-between mt-2 font-mono text-[12px]" style={{ color:'var(--text-2)' }}>
          <span>{fmtCLP(vals.executed)} ejecutado</span>
          <span className="font-semibold" style={{ color:progress>=100?'#FFB0BF':progress>=80?'#FFD08A':'var(--jade)' }}>{progress}%</span>
          <span>de {fmtCLP(vals.budget)}</span>
        </div>
      </Card>
      {/* Insumos sync indicator */}
      {insumosTotal !== null && insumosTotal !== vals.executed && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background:'rgba(77,158,255,0.06)', border:'1px solid rgba(77,158,255,0.2)' }}>
          <div className="flex items-center gap-2">
            <I name="package" size={14} color="#4D9EFF"/>
            <span className="text-[12px]" style={{ color:'var(--text-2)' }}>Total desde insumos:</span>
            <span className="font-mono font-semibold text-[13px]" style={{ color:'#4D9EFF' }}>{fmtCLP(insumosTotal)}</span>
          </div>
          <button className="btn btn-ghost !h-7 !text-[11.5px]" onClick={syncFromInsumos}><I name="refresh-cw" size={12}/>Sincronizar</button>
        </div>
      )}
      {insumosTotal !== null && insumosTotal > 0 && insumosTotal === vals.executed && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background:'rgba(0,214,143,0.06)', border:'1px solid rgba(0,214,143,0.15)' }}>
          <I name="check-circle" size={13} color="#00D68F"/>
          <span className="text-[12px]" style={{ color:'var(--jade)' }}>Ejecutado sincronizado con la suma de insumos</span>
        </div>
      )}
      <Card className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="eyebrow">Actualizar montos</div>
          {!editing
            ? <button className="btn btn-ghost !h-8" onClick={()=>setEditing(true)}><I name="pencil" size={13}/>Editar</button>
            : <div className="flex gap-2">
                <button className="btn btn-ghost !h-8" onClick={()=>{setEditing(false);setVals({budget:Number(project.budget)||0,executed:Number(project.executed)||0});}}>Cancelar</button>
                <button className="btn btn-primary !h-8" onClick={handleSave} disabled={loading}><I name="check" size={13}/>{loading?'Guardando...':'Guardar'}</button>
              </div>
          }
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="label">Presupuesto total (CLP)</label><input className="input" type="number" disabled={!editing} value={vals.budget} onChange={e=>setVals({...vals,budget:Number(e.target.value)})}/></div>
          <div><label className="label">Monto ejecutado (CLP)</label><input className="input" type="number" disabled={!editing} value={vals.executed} onChange={e=>setVals({...vals,executed:Number(e.target.value)})}/></div>
        </div>
      </Card>
    </div>
  );
}

const QUOTE_STATUS_CLS: Record<string,string> = { 'Vigente':'pill-blue','Vencida':'pill-red','Adjudicada':'pill-jade','Rechazada':'','Pendiente':'' };

function TabCotizaciones({ quotes, project, onRefresh }: { quotes:any[]; project:any; onRefresh:()=>void }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editQuote, setEditQuote] = useState<any>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparativoOpen, setComparativoOpen] = useState(false);

  const total      = quotes.reduce((a,q)=>a+(q.total||0),0);
  const adjudicado = quotes.filter(q=>q.status==='Adjudicada').reduce((a,q)=>a+(q.total||0),0);

  function toggleSel(id:string) { setSelected(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]); }

  async function handleAdjudicar(q:any) {
    const hasItems = Array.isArray(q.items)&&q.items.filter((i:any)=>i.name).length>0;
    if (!confirm(`¿Adjudicar ${q.ref||q.id} de ${q.supplier}?${hasItems?' Los ítems se guardarán como insumos.':''}`)) return;
    const { error, insumosCreados } = await adjudicarCotizacion(q);
    if (error) { alert('Error: '+error.message); return; }
    if (insumosCreados > 0) alert(`Cotización adjudicada. ${insumosCreados} insumo${insumosCreados!==1?'s':''} creados en el catálogo.`);
    onRefresh();
  }

  async function handleDelete(q:any) {
    if (!confirm(`¿Eliminar la cotización ${q.ref||q.id}?`)) return;
    const { error } = await supabase.from('cotizaciones').delete().eq('id',q.id);
    if (error) { alert('Error: '+error.message); return; }
    onRefresh();
  }

  const selectedQuotes = quotes.filter(q=>selected.includes(q.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <Card className="p-3 md:p-4"><div className="eyebrow text-[10px]">Total cotizado</div><div className="font-mono font-semibold text-[18px] mt-1">{fmtCLP(total)}</div></Card>
          <Card className="p-3 md:p-4"><div className="eyebrow text-[10px]">Adjudicado</div><div className="font-mono font-semibold text-[18px] mt-1" style={{ color:'#6FFFCB' }}>{fmtCLP(adjudicado)}</div></Card>
        </div>
        <div className="flex gap-2">
          <button className={`btn${compareMode?' btn-primary':''}`} onClick={()=>{setCompareMode(!compareMode);setSelected([]);}}><I name="columns-3" size={13}/><span className="hidden md:inline">{compareMode?'Cancelar':'Comparar'}</span></button>
          <button className="btn btn-primary" onClick={()=>{setEditQuote(null);setFormOpen(true);}}><I name="plus" size={14}/><span className="hidden md:inline">Nueva</span></button>
        </div>
      </div>

      {compareMode && selected.length>=2 && (
        <div className="flex items-center justify-between p-3 rounded-xl" style={{ background:'rgba(0,214,143,0.08)', border:'1px solid rgba(0,214,143,0.25)' }}>
          <span className="text-[13px]" style={{ color:'var(--jade)' }}>{selected.length} seleccionadas</span>
          <button className="btn btn-primary !h-8" onClick={()=>setComparativoOpen(true)}><I name="bar-chart-2" size={13}/>Ver comparativo</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <Card className="overflow-hidden" style={{ minWidth:500 }}>
          <table className="tbl">
            <thead><tr>
              {compareMode && <th style={{width:40}}/>}
              <th>Referencia</th><th>Proveedor</th><th>Monto</th>
              <th style={{width:100}}>Vence</th><th style={{width:120}}>Estado</th><th style={{width:108}}/>
            </tr></thead>
            <tbody>
              {quotes.map(q=>{
                const isSel = selected.includes(q.id);
                return (
                  <tr key={q.id} style={{ background:isSel?'rgba(0,214,143,0.04)':undefined }}>
                    {compareMode && <td onClick={()=>toggleSel(q.id)} style={{ cursor:'pointer' }}>
                      <div className="w-4 h-4 rounded flex items-center justify-center" style={{ border:`1.5px solid ${isSel?'var(--jade)':'var(--line-strong)'}`, background:isSel?'rgba(0,214,143,0.15)':'transparent' }}>
                        {isSel && <I name="check" size={10} color="var(--jade)"/>}
                      </div>
                    </td>}
                    <td><div className="font-mono text-[12.5px]">{q.ref||q.id}</div>{q.notes&&<div className="text-[10px]" style={{color:'var(--text-3)'}}>{q.notes}</div>}</td>
                    <td className="font-medium">{q.supplier||'—'}</td>
                    <td className="font-mono">{fmtCLP(q.total||0)}</td>
                    <td className="font-mono text-[12px]" style={{color:'var(--text-1)'}}>{fmtDateShort(q.expires)}</td>
                    <td><span className={'pill '+(QUOTE_STATUS_CLS[q.status]||'')}>{q.status||'Pendiente'}</span></td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="btn btn-ghost !w-7 !h-7 !p-0" title="Editar" onClick={()=>{setEditQuote(q);setFormOpen(true);}}><I name="pencil" size={13}/></button>
                        {q.status!=='Adjudicada' && <button className="btn btn-ghost !w-7 !h-7 !p-0" title="Adjudicar" onClick={()=>handleAdjudicar(q)}><I name="award" size={13} color="#F5A623"/></button>}
                        <button className="btn btn-ghost !w-7 !h-7 !p-0" title="Eliminar" onClick={()=>handleDelete(q)}><I name="trash-2" size={13} color="#FF4D6D"/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {quotes.length===0 && (
            <div className="p-12 text-center" style={{color:'var(--text-2)'}}>
              <I name="file-text" size={32} className="mx-auto mb-3 opacity-40"/>
              <p className="mb-4">Sin cotizaciones para este proyecto.</p>
              <button className="btn btn-primary mx-auto" onClick={()=>{setEditQuote(null);setFormOpen(true);}}><I name="plus" size={14}/>Nueva cotización</button>
            </div>
          )}
        </Card>
      </div>

      <QuoteFormPanel open={formOpen} onClose={()=>{setFormOpen(false);onRefresh();}} projects={[project]} defaultProjectId={project.id} quote={editQuote||undefined}/>
      <ComparativoPanel open={comparativoOpen} onClose={()=>setComparativoOpen(false)} quotes={selectedQuotes}
        onAdjudicar={async(q)=>{ await handleAdjudicar(q); setComparativoOpen(false); setSelected(p=>p.filter(x=>x!==q.id)); }}/>
    </div>
  );
}

function TabInsumos({ insumos, project, onRefresh }: { insumos:any[]; project:any; onRefresh:()=>void }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editInsumo, setEditInsumo] = useState<any>(null);
  const totalCost = insumos.reduce((a,i)=>a+((i.unit_price||0)*(i.quantity||1)),0);

  async function handleDelete(i:any) {
    if (!confirm(`¿Eliminar "${i.name}"?`)) return;
    const { error } = await supabase.from('insumos').delete().eq('id',i.id);
    if (error) { alert('Error: '+error.message); return; }
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Card className="p-3 md:p-4"><div className="eyebrow text-[10px]">Costo total insumos</div><div className="font-mono font-semibold text-[18px] mt-1">{fmtCLP(totalCost)}</div></Card>
        <button className="btn btn-primary" onClick={()=>{setEditInsumo(null);setFormOpen(true);}}><I name="plus" size={14}/>Nuevo insumo</button>
      </div>
      <div className="overflow-x-auto">
        <Card className="overflow-hidden" style={{ minWidth:520 }}>
          <table className="tbl">
            <thead><tr><th>Insumo</th><th style={{width:120}}>Categoría</th><th style={{width:70}}>Cant.</th><th style={{width:90}}>Unidad</th><th style={{width:130}}>P. unitario</th><th style={{width:130}}>Subtotal</th><th style={{width:80}}/></tr></thead>
            <tbody>
              {insumos.map(i=>{
                const catMeta = CAT_META[i.category]||CAT_META['Otro'];
                const subtotal = (i.unit_price||0)*(i.quantity||1);
                return (
                  <tr key={i.id}>
                    <td><div className="font-medium">{i.name}</div>{i.note&&<div className="text-[10.5px]" style={{color:'var(--text-3)'}}>{i.note}</div>}</td>
                    <td><span className={'pill '+(catMeta.cls||'')}>{i.category||'Otro'}</span></td>
                    <td className="font-mono text-[12px]">{i.quantity||1}</td>
                    <td className="font-mono text-[12px]">{i.unit||'—'}</td>
                    <td className="font-mono">{fmtCLP(i.unit_price||0)}</td>
                    <td className="font-mono font-medium">{fmtCLP(subtotal)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="btn btn-ghost !w-7 !h-7 !p-0" title="Editar" onClick={()=>{setEditInsumo(i);setFormOpen(true);}}><I name="pencil" size={13}/></button>
                        <button className="btn btn-ghost !w-7 !h-7 !p-0" title="Eliminar" onClick={()=>handleDelete(i)}><I name="trash-2" size={13} color="#FF4D6D"/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {insumos.length===0 && (
            <div className="p-12 text-center" style={{color:'var(--text-2)'}}>
              <I name="package" size={32} className="mx-auto mb-3 opacity-40"/>
              <p className="mb-4">Sin insumos para este proyecto.</p>
              <button className="btn btn-primary mx-auto" onClick={()=>{setEditInsumo(null);setFormOpen(true);}}><I name="plus" size={14}/>Nuevo insumo</button>
            </div>
          )}
        </Card>
      </div>
      <InsumoFormPanel open={formOpen} onClose={()=>{setFormOpen(false);onRefresh();}} projects={[project]} defaultProjectId={project.id} insumo={editInsumo||undefined}/>
    </div>
  );
}

function TabRetornos({ project, onRefresh }: { project:any; onRefresh:()=>void }) {
  const [evalOpen, setEvalOpen] = useState(false);
  const qual: any[] = project.qualitative || [];
  const avg = qual.length ? qual.reduce((a:number,d:any)=>a+d.score,0)/qual.length : 0;
  const COLORS = ['#00D68F','#4D9EFF','#F5A623','#A88CFF'];
  const radarData = QUAL_DIMS.map(dim => {
    const found = qual.find((d:any)=>d.dim===dim||d.dim.startsWith(dim.slice(0,6)));
    return { dim: dim.slice(0,8), score: found ? found.score : 0 };
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <Card className="p-3 md:p-4">
            <div className="eyebrow text-[10px]">Índice cualitativo</div>
            <div className="font-mono font-semibold text-[22px] mt-1" style={{ color:'var(--jade)' }}>{avg>0?avg.toFixed(1):'—'}<span className="text-[13px] opacity-60">/10</span></div>
          </Card>
          {project.roi && <Card className="p-3 md:p-4"><div className="eyebrow text-[10px]">ROI estimado</div><div className="font-mono font-semibold text-[22px] mt-1" style={{ color:'#6FFFCB' }}>+{project.roi}%</div></Card>}
        </div>
        <button className="btn btn-primary" onClick={()=>setEvalOpen(true)}><I name="pencil" size={14}/>{qual.length?'Editar evaluación':'Nueva evaluación'}</button>
      </div>
      {qual.length > 0 ? (
        <>
          <Card className="p-4 md:p-6">
            <div className="eyebrow mb-4">Radar de dimensiones</div>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.06)"/>
                <PolarAngleAxis dataKey="dim" tick={{ fill:'var(--text-2)', fontSize:11 }}/>
                <Tooltip contentStyle={{ background:'#0A0A12', border:'1px solid var(--line-strong)', borderRadius:8, fontSize:12 }}/>
                <Radar name={project.name} dataKey="score" stroke="#00D68F" fill="#00D68F" fillOpacity={0.15}/>
              </RadarChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-4 md:p-6">
            <div className="eyebrow mb-4">Detalle por dimensión</div>
            <div className="space-y-4">
              {qual.map((d:any,i:number)=>(
                <div key={d.dim}>
                  <div className="flex justify-between mb-1.5"><span className="text-[13px] font-medium">{d.dim}</span><span className="font-mono text-[13px]" style={{ color:COLORS[i%COLORS.length] }}>{d.score}/10</span></div>
                  <div className="progress" style={{ height:5 }}><i style={{ width:(d.score/10*100)+'%', background:COLORS[i%COLORS.length] }}/></div>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-12 text-center">
          <I name="sparkles" size={32} className="mx-auto mb-3 opacity-40"/>
          <p style={{ color:'var(--text-2)' }} className="mb-4">Sin evaluaciones de retorno aún.</p>
          <button className="btn btn-primary mx-auto" onClick={()=>setEvalOpen(true)}><I name="plus" size={14}/>Nueva evaluación</button>
        </Card>
      )}
      <NewEvalPanel open={evalOpen} onClose={()=>{setEvalOpen(false);onRefresh();}} projects={[project]} onSaved={onRefresh} defaultProjectId={project.id}/>
    </div>
  );
}

const HITO_STATUS_META: Record<string,{ color:string; cls:string }> = {
  'Pendiente':  { color:'#4D9EFF', cls:'pill-blue' },
  'En curso':   { color:'#F5A623', cls:'pill-amber' },
  'Completado': { color:'#00D68F', cls:'pill-jade' },
  'Bloqueado':  { color:'#FF4D6D', cls:'pill-red' },
};
const HITO_TYPE_COLOR: Record<string,string> = { 'Hito':'#A88CFF','Entrega':'#4D9EFF','Revisión':'#F5A623','Pago':'#00D68F','Otro':'#7A7E8F' };

function TabTimeline({ hitos, project, onRefresh }: { hitos:any[]; project:any; onRefresh:()=>void }) {
  const [newOpen, setNewOpen] = useState(false);
  const completed = hitos.filter(h=>h.status==='Completado').length;
  const sorted = [...hitos].sort((a,b)=>new Date(a.date||'9999').getTime()-new Date(b.date||'9999').getTime());
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <Card className="p-3 md:p-4"><div className="eyebrow text-[10px]">Total hitos</div><div className="font-mono font-semibold text-[18px] mt-1">{hitos.length}</div></Card>
          <Card className="p-3 md:p-4"><div className="eyebrow text-[10px]">Completados</div><div className="font-mono font-semibold text-[18px] mt-1" style={{ color:'var(--jade)' }}>{completed}</div></Card>
        </div>
        <button className="btn btn-primary" onClick={()=>setNewOpen(true)}><I name="plus" size={14}/>Nuevo hito</button>
      </div>
      {hitos.length===0 ? (
        <Card className="p-12 text-center">
          <I name="milestone" size={32} className="mx-auto mb-3 opacity-40"/>
          <p style={{ color:'var(--text-2)' }} className="mb-4">Sin hitos registrados para este proyecto.</p>
          <button className="btn btn-primary mx-auto" onClick={()=>setNewOpen(true)}><I name="plus" size={14}/>Agregar hito</button>
        </Card>
      ) : (
        <Card className="p-4 md:p-6">
          <div className="eyebrow mb-5">Línea de tiempo</div>
          <div className="relative">
            <div className="absolute left-[19px] top-0 bottom-0 w-px" style={{ background:'var(--line)' }}/>
            <div className="space-y-4">
              {sorted.map(h=>{
                const meta = HITO_STATUS_META[h.status]||HITO_STATUS_META['Pendiente'];
                const typeColor = HITO_TYPE_COLOR[h.type]||HITO_TYPE_COLOR['Otro'];
                const done = h.status==='Completado';
                return (
                  <div key={h.id} className="flex gap-4 relative">
                    <div className="flex-shrink-0 w-10 flex items-start justify-center pt-0.5 relative z-10">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background:done?'rgba(0,214,143,0.15)':'rgba(255,255,255,0.04)', border:`1.5px solid ${done?'#00D68F':meta.color}` }}>
                        {done ? <I name="check" size={10} color="#00D68F"/> : <span className="w-2 h-2 rounded-full inline-block" style={{ background:meta.color }}/>}
                      </div>
                    </div>
                    <div className="flex-1 glass rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-[13px]" style={{ fontFamily:'Sora' }}>{h.label}</div>
                        <span className={'pill flex-shrink-0 '+(meta.cls||'')} style={{ fontSize:10 }}>{h.status}</span>
                      </div>
                      {h.notes && <div className="text-[11px] mt-0.5" style={{ color:'var(--text-2)' }}>{h.notes}</div>}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-[11px]" style={{ color:'var(--text-2)' }}><I name="calendar" size={11} color="var(--text-2)"/>{fmtDateShort(h.date)}</span>
                        <span className="text-[11px] font-medium" style={{ color:typeColor }}>{h.type||'Hito'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
      <NewHitoPanel open={newOpen} onClose={()=>{setNewOpen(false);onRefresh();}} projectId={project.id}/>
    </div>
  );
}

function NewHitoPanel({ open, onClose, projectId }: { open:boolean; onClose:()=>void; projectId:string }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ label:'', date:'', type:'Hito', status:'Pendiente', notes:'' });
  async function handleCreate() {
    if (!form.label.trim()) return;
    setLoading(true);
    const id = 'h'+Date.now();
    const { error } = await supabase.from('hitos').insert([{ id, project_id:projectId, label:form.label, date:form.date||null, type:form.type, status:form.status, notes:form.notes }]);
    setLoading(false);
    if (!error) { setForm({ label:'', date:'', type:'Hito', status:'Pendiente', notes:'' }); onClose(); }
    else alert('Error: '+error.message);
  }
  return (
    <SlideOver open={open} onClose={onClose} subtitle="Nuevo hito" title="Agregar al timeline">
      <div className="space-y-5">
        <div><label className="label">Nombre del hito *</label><input className="input" placeholder="Ej. Entrega de planos, Pago inicial..." value={form.label} onChange={e=>setForm({...form,label:e.target.value})}/></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Fecha</label><input className="input" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>
          <div><label className="label">Tipo</label>
            <select className="select" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
              {['Hito','Entrega','Revisión','Pago','Otro'].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div><label className="label">Estado</label>
          <select className="select" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
            {['Pendiente','En curso','Completado','Bloqueado'].map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div><label className="label">Notas</label><textarea className="textarea" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Descripción o comentarios..."/></div>
      </div>
      <div className="hairline-t mt-8 pt-5 flex items-center justify-between">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleCreate} disabled={loading}><I name="check" size={14}/>{loading?'Guardando...':'Agregar hito'}</button>
      </div>
    </SlideOver>
  );
}

// ─── PROJECT DETAIL ──────────────────────────────────────────
function ProjectDetail({ project, onBack, onRefresh }: { project:any; onBack:()=>void; onRefresh:()=>void }) {
  const [tab, setTab] = useState<ProjectTab>('resumen');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({...project});
  const [loading, setLoading] = useState(false);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [insumos, setInsumos] = useState<any[]>([]);
  const [hitos, setHitos] = useState<any[]>([]);

  useEffect(() => { setForm({...project}); setTab('resumen'); setEditing(false); }, [project.id]);

  useEffect(() => {
    async function load() {
      const [{ data: q }, { data: i }, { data: h }] = await Promise.all([
        supabase.from('cotizaciones').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
        supabase.from('insumos').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
        supabase.from('hitos').select('*').eq('project_id', project.id).order('date', { ascending: true }),
      ]);
      if (q) setQuotes(q);
      if (i) setInsumos(i);
      if (h) setHitos(h);
    }
    load();
  }, [project.id]);

  async function handleSave() {
    setLoading(true);
    const progress = Number(form.budget)>0?Math.round((Number(form.executed)/Number(form.budget))*100):0;
    const health = progress>=100?'danger':progress>=80?'warn':'ok';
    const { error } = await supabase.from('proyectos').update({ name:form.name, description:form.description, scope:form.scope, budget:Number(form.budget), executed:Number(form.executed), status:form.status, start_date:form.start_date, end_date:form.end_date, next_label:form.next_label, next_date:form.next_date, progress, health }).eq('id',project.id);
    setLoading(false);
    if (!error) { setEditing(false); onRefresh(); }
    else alert('Error: '+error.message);
  }

  const progress = Number(form.budget)>0?Math.round((Number(form.executed)/Number(form.budget))*100):0;
  const m = scopeMeta(project.scope);

  const refreshQuotes  = async () => { const {data}=await supabase.from('cotizaciones').select('*').eq('project_id',project.id).order('created_at',{ascending:false}); if(data)setQuotes(data); };
  const refreshInsumos = async () => { const {data}=await supabase.from('insumos').select('*').eq('project_id',project.id).order('created_at',{ascending:false}); if(data)setInsumos(data); };
  const refreshHitos   = async () => { const {data}=await supabase.from('hitos').select('*').eq('project_id',project.id).order('date',{ascending:true}); if(data)setHitos(data); };

  return (
    <div className="p-4 md:p-8 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-ghost !h-8 !w-8 !p-0" onClick={onBack}><I name="arrow-left" size={16}/></button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="rounded-md flex items-center justify-center flex-shrink-0" style={{ width:32,height:32,background:m.bg,border:`1px solid ${m.border}`,color:m.color }}><I name={m.icon} size={15}/></span>
          <div className="min-w-0">
            <div className="eyebrow mb-0.5">Detalle del proyecto</div>
            <h1 className="font-bold text-[20px] md:text-[24px] truncate" style={{ fontFamily:'Sora' }}>{project.name}</h1>
          </div>
        </div>
        <StatusPill status={project.status||'En curso'}/>
        {tab==='resumen' && (editing
          ? <><button className="btn btn-ghost" onClick={()=>{setEditing(false);setForm({...project});}}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={loading}><I name="check" size={14}/>{loading?'Guardando...':'Guardar'}</button></>
          : <button className="btn" onClick={()=>setEditing(true)}><I name="pencil" size={14}/><span className="hidden md:inline">Editar</span></button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 overflow-x-auto" style={{ borderBottom:'1px solid var(--line)' }}>
        {PROJECT_TABS.map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setEditing(false);}}
            className="flex items-center gap-1.5 px-3 py-2.5 text-[12.5px] font-medium transition-all whitespace-nowrap"
            style={{ color:tab===t.id?'var(--text-0)':'var(--text-2)',
                     borderBottom:tab===t.id?'2px solid var(--jade)':'2px solid transparent',
                     background:'transparent' }}>
            <I name={t.icon} size={13}/>{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab==='resumen'      && <TabResumen project={project} form={form} setForm={setForm} editing={editing} progress={progress}/>}
      {tab==='presupuesto'  && <TabPresupuesto project={project} onRefresh={onRefresh}/>}
      {tab==='cotizaciones' && <TabCotizaciones quotes={quotes} project={project} onRefresh={refreshQuotes}/>}
      {tab==='insumos'      && <TabInsumos insumos={insumos} project={project} onRefresh={refreshInsumos}/>}
      {tab==='retornos'     && <TabRetornos project={project} onRefresh={onRefresh}/>}
      {tab==='timeline'     && <TabTimeline hitos={hitos} project={project} onRefresh={refreshHitos}/>}
    </div>
  );
}

// ─── QUOTE HELPERS ───────────────────────────────────────────
async function adjudicarCotizacion(quote: any): Promise<{ error: any; insumosCreados: number }> {
  const { error: e1 } = await supabase.from('cotizaciones').update({ status:'Adjudicada' }).eq('id', quote.id);
  if (e1) return { error: e1, insumosCreados: 0 };
  const items: any[] = Array.isArray(quote.items) ? quote.items.filter((i:any)=>i.name?.trim()) : [];
  if (items.length > 0) {
    const base = Date.now();
    const rows = items.map((item:any, idx:number) => ({
      id: 'i'+base+'_'+idx,
      name: item.name,
      category: item.category||'Material',
      unit: item.unit||'',
      unit_price: Number(item.unit_price)||0,
      quantity: Number(item.qty)||1,
      project_id: quote.project_id||null,
      supplier: quote.supplier||'',
      note: `Cotización ${quote.ref||quote.id}`,
    }));
    const { error: e2 } = await supabase.from('insumos').insert(rows);
    if (e2) return { error: e2, insumosCreados: 0 };
    return { error: null, insumosCreados: items.length };
  }
  return { error: null, insumosCreados: 0 };
}

// ─── QUOTE FORM PANEL ────────────────────────────────────────
type QItem = { name:string; qty:number; unit:string; unit_price:number };

function QuoteFormPanel({ open, onClose, projects, defaultProjectId, quote }: {
  open:boolean; onClose:()=>void; projects:any[]; defaultProjectId?:string; quote?:any;
}) {
  const isEdit = !!quote;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ref:'', supplier:'', project_id:defaultProjectId||'', status:'Vigente', notes:'', expires:'', manualTotal:'' });
  const [items, setItems] = useState<QItem[]>([]);

  useEffect(() => {
    if (!open) return;
    if (quote) {
      setForm({ ref:quote.ref||'', supplier:quote.supplier||'', project_id:quote.project_id||'', status:quote.status||'Vigente', notes:quote.notes||'', expires:quote.expires||'', manualTotal:String(quote.total||'') });
      setItems(Array.isArray(quote.items)&&quote.items.length>0 ? quote.items.map((i:any)=>({ name:i.name||'', qty:Number(i.qty)||1, unit:i.unit||'', unit_price:Number(i.unit_price)||0 })) : []);
    } else {
      setForm({ ref:'', supplier:'', project_id:defaultProjectId||'', status:'Vigente', notes:'', expires:'', manualTotal:'' });
      setItems([]);
    }
  }, [open, quote?.id, defaultProjectId]);

  const itemsTotal = items.reduce((a,i)=>a+(i.qty*i.unit_price),0);
  const total = items.length>0 ? itemsTotal : Number(form.manualTotal)||0;

  function addItem() { setItems(p=>[...p,{ name:'', qty:1, unit:'', unit_price:0 }]); }
  function removeItem(idx:number) { setItems(p=>p.filter((_,i)=>i!==idx)); }
  function updItem(idx:number, field:keyof QItem, val:string) {
    setItems(p=>p.map((item,i)=>i===idx?{...item,[field]:field==='name'||field==='unit'?val:Number(val)||0}:item));
  }

  async function handleSave() {
    if (!form.supplier.trim()) return;
    setLoading(true);
    const ref = form.ref||'COT-'+Date.now().toString().slice(-6);
    const payload = { ref, supplier:form.supplier, project_id:form.project_id||null, total, status:form.status, notes:form.notes, expires:form.expires||null, currency:'CLP', items };
    const { error } = isEdit
      ? await supabase.from('cotizaciones').update(payload).eq('id', quote.id)
      : await supabase.from('cotizaciones').insert([{ id:'q'+Date.now(), ...payload }]);
    setLoading(false);
    if (!error) onClose();
    else alert('Error: '+error.message);
  }

  return (
    <SlideOver open={open} onClose={onClose} width={640} subtitle={isEdit?'Editar':'Nueva cotización'} title={isEdit?(form.ref||'Editar cotización'):'Registrar cotización'}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Referencia</label><input className="input" placeholder="COT-2026-XXXX (auto)" value={form.ref} onChange={e=>setForm({...form,ref:e.target.value})}/></div>
          <div><label className="label">Fecha vencimiento</label><input className="input" type="date" value={form.expires} onChange={e=>setForm({...form,expires:e.target.value})}/></div>
        </div>
        <div><label className="label">Proveedor *</label><input className="input" placeholder="Nombre del proveedor" value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})}/></div>
        <div><label className="label">Proyecto</label>
          <select className="select" value={form.project_id} onChange={e=>setForm({...form,project_id:e.target.value})}>
            <option value="">Sin proyecto asignado</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><label className="label">Estado</label>
          <select className="select" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
            {['Vigente','Vencida','Adjudicada','Rechazada'].map(s=><option key={s}>{s}</option>)}
          </select>
        </div>

        {/* Ítems */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label !mb-0">Ítems de la cotización</label>
            <button className="btn btn-ghost !h-7 text-[11px]" onClick={addItem}><I name="plus" size={12}/>Agregar ítem</button>
          </div>
          {items.length>0 ? (
            <div className="rounded-xl overflow-hidden" style={{ border:'1px solid var(--line)' }}>
              <div className="grid text-[10px] px-3 py-2 gap-2" style={{ gridTemplateColumns:'1fr 54px 62px 92px 86px 28px', color:'var(--text-3)', background:'rgba(255,255,255,0.02)' }}>
                <span>Descripción</span><span>Cant.</span><span>Unidad</span><span>P. unitario</span><span className="text-right">Subtotal</span><span/>
              </div>
              {items.map((item,idx)=>(
                <div key={idx} className="grid px-3 py-1.5 gap-2 hairline-t items-center" style={{ gridTemplateColumns:'1fr 54px 62px 92px 86px 28px' }}>
                  <input className="input !h-7 !text-[12px]" placeholder="Descripción" value={item.name} onChange={e=>updItem(idx,'name',e.target.value)}/>
                  <input className="input !h-7 !text-[12px]" type="number" min="0" value={item.qty||''} onChange={e=>updItem(idx,'qty',e.target.value)}/>
                  <input className="input !h-7 !text-[12px]" placeholder="m²…" value={item.unit} onChange={e=>updItem(idx,'unit',e.target.value)}/>
                  <input className="input !h-7 !text-[12px]" type="number" min="0" placeholder="0" value={item.unit_price||''} onChange={e=>updItem(idx,'unit_price',e.target.value)}/>
                  <span className="font-mono text-[11px] text-right pr-1" style={{ color:'var(--text-1)' }}>{fmtCLP(item.qty*item.unit_price)}</span>
                  <button className="btn btn-ghost !w-7 !h-7 !p-0" onClick={()=>removeItem(idx)}><I name="x" size={12} color="var(--text-3)"/></button>
                </div>
              ))}
              <div className="flex justify-end items-center gap-2 px-3 py-2 hairline-t" style={{ background:'rgba(255,255,255,0.02)' }}>
                <span className="text-[11px]" style={{ color:'var(--text-2)' }}>Total:</span>
                <span className="font-mono font-semibold text-[14px]">{fmtCLP(itemsTotal)}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button className="w-full py-3 rounded-xl text-[12px] transition-all" style={{ border:'1px dashed var(--line-strong)', color:'var(--text-3)' }} onClick={addItem}>+ Agregar ítems a esta cotización</button>
              <div><label className="label">Monto total manual (CLP)</label><input className="input" type="number" placeholder="0" value={form.manualTotal} onChange={e=>setForm({...form,manualTotal:e.target.value})}/></div>
            </div>
          )}
        </div>
        <div><label className="label">Notas</label><textarea className="textarea" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Observaciones, condiciones..."/></div>
      </div>
      <div className="hairline-t mt-8 pt-5 flex items-center justify-between">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}><I name="check" size={14}/>{loading?'Guardando...':(isEdit?'Guardar cambios':'Crear cotización')}</button>
      </div>
    </SlideOver>
  );
}

// ─── COMPARATIVO PANEL ────────────────────────────────────────
function ComparativoPanel({ open, onClose, quotes, onAdjudicar }: { open:boolean; onClose:()=>void; quotes:any[]; onAdjudicar:(q:any)=>void }) {
  if (!open || quotes.length<2) return null;
  const COLORS = ['#00D68F','#4D9EFF','#F5A623','#A88CFF','#FF8FAD'];
  return (
    <div className="fixed inset-0 z-50 fade-in" style={{ background:'rgba(0,0,0,0.65)', backdropFilter:'blur(3px)' }} onClick={onClose}>
      <div className="absolute inset-4 md:inset-8 rounded-2xl overflow-hidden flex flex-col" style={{ background:'linear-gradient(180deg,#0F0F18,#0A0A12)', border:'1px solid var(--line-strong)' }} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 hairline-b flex-shrink-0">
          <div><div className="eyebrow mb-1">Módulo cotizaciones</div><h2 className="font-bold text-[20px]" style={{ fontFamily:'Sora' }}>Comparativo · {quotes.length} cotizaciones</h2></div>
          <button className="btn btn-ghost" onClick={onClose}><I name="x" size={16}/></button>
        </div>
        <div className="flex-1 overflow-auto p-5">
          <div className="grid gap-4" style={{ gridTemplateColumns:`repeat(${quotes.length}, minmax(200px,1fr))` }}>
            {quotes.map((q,i)=>{
              const color = COLORS[i%COLORS.length];
              const items: any[] = Array.isArray(q.items)?q.items.filter((x:any)=>x.name):[];
              const isAdj = q.status==='Adjudicada';
              return (
                <div key={q.id} className="glass rounded-2xl p-4 flex flex-col gap-4" style={{ borderTop:`2px solid ${color}` }}>
                  <div>
                    <div className="font-mono text-[10px] mb-1" style={{ color:'var(--text-3)' }}>{q.ref||q.id}</div>
                    <div className="font-bold text-[15px]" style={{ fontFamily:'Sora', color }}>{q.supplier||'—'}</div>
                    <div className="font-mono font-semibold text-[24px] mt-2">{fmtCLP(q.total||0)}</div>
                  </div>
                  <div className="hairline-t pt-3 space-y-2 text-[12px]">
                    <div className="flex justify-between"><span style={{ color:'var(--text-2)' }}>Vence</span><span className="font-mono">{fmtDateShort(q.expires)}</span></div>
                    <div className="flex justify-between items-center"><span style={{ color:'var(--text-2)' }}>Estado</span><span className={'pill '+(QUOTE_STATUS_CLS[q.status]||'')}>{q.status||'—'}</span></div>
                    <div className="flex justify-between"><span style={{ color:'var(--text-2)' }}>Ítems</span><span>{items.length}</span></div>
                  </div>
                  {items.length>0 && (
                    <div className="hairline-t pt-3">
                      <div className="eyebrow text-[10px] mb-2">Desglose</div>
                      <div className="space-y-1.5">
                        {items.map((item:any,idx:number)=>(
                          <div key={idx} className="flex justify-between text-[12px]">
                            <span className="truncate mr-2" style={{ color:'var(--text-1)' }}>{item.name}{item.qty>1?` ×${item.qty}`:''}</span>
                            <span className="font-mono flex-shrink-0" style={{ color:'var(--text-2)' }}>{fmtCLP((item.unit_price||0)*(item.qty||1))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-auto pt-3 hairline-t">
                    <button className="btn w-full justify-center" disabled={isAdj}
                      style={{ background:isAdj?'transparent':`${color}18`, border:`1px solid ${isAdj?'var(--line)':color}`, color:isAdj?'var(--text-3)':color }}
                      onClick={()=>!isAdj&&onAdjudicar(q)}>
                      <I name={isAdj?'check-circle':'award'} size={14}/>{isAdj?'Ya adjudicada':'Adjudicar esta'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── QUOTES VIEW ─────────────────────────────────────────────
function QuotesView({ projects, searchText = '' }: { projects: any[]; searchText?: string }) {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editQuote, setEditQuote] = useState<any>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparativoOpen, setComparativoOpen] = useState(false);
  const [filterProjectId, setFilterProjectId] = useState('');

  async function fetchQuotes() {
    const { data } = await supabase.from('cotizaciones').select('*').order('created_at', { ascending: false });
    if (data) setQuotes(data);
    setLoading(false);
  }
  useEffect(() => { fetchQuotes(); }, []);

  function toggleSel(id:string) { setSelected(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]); }

  async function handleAdjudicar(q:any) {
    const hasItems = Array.isArray(q.items)&&q.items.filter((i:any)=>i.name).length>0;
    if (!confirm(`¿Adjudicar ${q.ref||q.id} de ${q.supplier}?${hasItems?' Los ítems se guardarán como insumos.':''}`)) return;
    const { error, insumosCreados } = await adjudicarCotizacion(q);
    if (error) { alert('Error: '+error.message); return; }
    if (insumosCreados > 0) alert(`Cotización adjudicada. ${insumosCreados} insumo${insumosCreados!==1?'s':''} creados en el catálogo.`);
    fetchQuotes();
  }

  async function handleDelete(q:any) {
    if (!confirm(`¿Eliminar la cotización ${q.ref||q.id}?`)) return;
    const { error } = await supabase.from('cotizaciones').delete().eq('id',q.id);
    if (error) { alert('Error: '+error.message); return; }
    fetchQuotes();
  }

  const visibleQuotes = filterProjectId ? quotes.filter(q => q.project_id === filterProjectId) : quotes;
  const filteredQuotes = visibleQuotes.filter(q => 
    q.supplier?.toLowerCase().includes(searchText.toLowerCase()) ||
    q.ref?.toLowerCase().includes(searchText.toLowerCase()) ||
    (q.notes && q.notes.toLowerCase().includes(searchText.toLowerCase()))
  );
  const selectedQuotes = filteredQuotes.filter(q=>selected.includes(q.id));
  const getProject = (pid:string) => projects.find(p=>p.id===pid);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold text-[20px] md:text-[22px]" style={{ fontFamily:'Sora' }}>Cotizaciones</h2><p className="text-[12px] mt-0.5" style={{ color:'var(--text-2)' }}>Gestiona y compara cotizaciones de proveedores</p></div>
        <div className="flex items-center gap-2">
          <select className="select !h-9 !text-[12px]" style={{ minWidth:160 }} value={filterProjectId} onChange={e=>{setFilterProjectId(e.target.value);setSelected([]);}}>
            <option value="">Todos los proyectos</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className={`btn${compareMode?' btn-primary':''}`} onClick={()=>{setCompareMode(!compareMode);setSelected([]);}}><I name="columns-3" size={14}/>{compareMode?'Cancelar':'Comparar'}</button>
          <button className="btn btn-primary" onClick={()=>{setEditQuote(null);setFormOpen(true);}}><I name="plus" size={14}/>Nueva cotización</button>
        </div>
      </div>

      {compareMode && selected.length>=2 && (
        <div className="flex items-center justify-between p-3 rounded-xl" style={{ background:'rgba(0,214,143,0.08)', border:'1px solid rgba(0,214,143,0.25)' }}>
          <span className="text-[13px]" style={{ color:'var(--jade)' }}>{selected.length} cotizaciones seleccionadas</span>
          <button className="btn btn-primary !h-8" onClick={()=>setComparativoOpen(true)}><I name="bar-chart-2" size={13}/>Ver comparativo</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12" style={{ color:'var(--text-2)' }}>Cargando...</div>
      ) : (
        <div className="overflow-x-auto">
          <Card className="overflow-hidden" style={{ minWidth:620 }}>
            <table className="tbl">
              <thead><tr>
                {compareMode && <th style={{width:40}}/>}
                <th>Referencia</th><th>Proveedor</th><th>Proyecto</th><th>Monto</th>
                <th style={{width:100}}>Vence</th><th style={{width:120}}>Estado</th><th style={{width:108}}/>
              </tr></thead>
              <tbody>
                {filteredQuotes.map(q=>{
                  const proj = getProject(q.project_id);
                  const isSel = selected.includes(q.id);
                  return (
                    <tr key={q.id} style={{ background:isSel?'rgba(0,214,143,0.04)':undefined }}>
                      {compareMode && <td onClick={()=>toggleSel(q.id)} style={{ cursor:'pointer' }}>
                        <div className="w-4 h-4 rounded flex items-center justify-center" style={{ border:`1.5px solid ${isSel?'var(--jade)':'var(--line-strong)'}`, background:isSel?'rgba(0,214,143,0.15)':'transparent' }}>
                          {isSel && <I name="check" size={10} color="var(--jade)"/>}
                        </div>
                      </td>}
                      <td><div className="font-mono text-[12.5px]">{q.ref||q.id}</div><div className="text-[10px]" style={{ color:'var(--text-3)' }}>{q.notes||''}</div></td>
                      <td className="font-medium">{q.supplier||'—'}</td>
                      <td><span className="text-[12px]" style={{ color:'var(--text-1)' }}>{proj?.name||'—'}</span></td>
                      <td className="font-mono">{fmtCLP(q.total||0)}</td>
                      <td className="font-mono text-[12px]" style={{ color:'var(--text-1)' }}>{fmtDateShort(q.expires)}</td>
                      <td><span className={'pill '+(QUOTE_STATUS_CLS[q.status]||'')}>{q.status||'Vigente'}</span></td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button className="btn btn-ghost !w-7 !h-7 !p-0" title="Editar" onClick={()=>{setEditQuote(q);setFormOpen(true);}}><I name="pencil" size={13}/></button>
                          {q.status!=='Adjudicada' && <button className="btn btn-ghost !w-7 !h-7 !p-0" title="Adjudicar" onClick={()=>handleAdjudicar(q)}><I name="award" size={13} color="#F5A623"/></button>}
                          <button className="btn btn-ghost !w-7 !h-7 !p-0" title="Eliminar" onClick={()=>handleDelete(q)}><I name="trash-2" size={13} color="#FF4D6D"/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredQuotes.length===0 && (
              <div className="p-12 text-center" style={{ color:'var(--text-2)' }}>
                <I name="file-text" size={32} className="mx-auto mb-3 opacity-40"/>
                <p className="mb-4">{filterProjectId ? 'No hay cotizaciones para este proyecto.' : 'No hay cotizaciones aún.'}</p>
                <button className="btn btn-primary mx-auto" onClick={()=>{setEditQuote(null);setFormOpen(true);}}><I name="plus" size={14}/>Nueva cotización</button>
              </div>
            )}
          </Card>
        </div>
      )}

      <QuoteFormPanel open={formOpen} onClose={()=>{setFormOpen(false);fetchQuotes();}} projects={projects} quote={editQuote||undefined}/>
      <ComparativoPanel open={comparativoOpen} onClose={()=>setComparativoOpen(false)} quotes={selectedQuotes}
        onAdjudicar={async(q)=>{ await handleAdjudicar(q); setComparativoOpen(false); setSelected(p=>p.filter(x=>x!==q.id)); }}/>
    </div>
  );
}

// ─── INSUMO FORM PANEL ───────────────────────────────────────
function InsumoFormPanel({ open, onClose, projects, defaultProjectId, insumo }: { open:boolean; onClose:()=>void; projects:any[]; defaultProjectId?:string; insumo?:any }) {
  const isEdit = !!insumo;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name:'', category:'Material', unit:'', unit_price:'', quantity:'1', supplier:'', note:'' });

  useEffect(() => {
    if (!open) return;
    if (insumo) {
      setForm({ name:insumo.name||'', category:insumo.category||'Material', unit:insumo.unit||'', unit_price:String(insumo.unit_price||''), quantity:String(insumo.quantity||1), supplier:insumo.supplier||'', note:insumo.note||'' });
    } else {
      setForm({ name:'', category:'Material', unit:'', unit_price:'', quantity:'1', supplier:'', note:'' });
    }
  }, [open, insumo?.id]);

  async function handleSave() {
    if (!form.name.trim()) return;
    setLoading(true);
    const payload = { name:form.name, category:form.category, unit:form.unit, unit_price:Number(form.unit_price)||0, quantity:Number(form.quantity)||1, supplier:form.supplier, note:form.note, project_id: defaultProjectId||null };
    const { error } = isEdit
      ? await supabase.from('insumos').update(payload).eq('id', insumo.id)
      : await supabase.from('insumos').insert([{ id:'i'+Date.now(), ...payload }]);
    setLoading(false);
    if (!error) onClose();
    else alert('Error: '+error.message);
  }

  return (
    <SlideOver open={open} onClose={onClose} subtitle={isEdit?'Editar insumo':'Nuevo insumo'} title={isEdit?(form.name||'Editar'):'Registrar insumo'}>
      <div className="space-y-5">
        <div><label className="label">Nombre *</label><input className="input" placeholder="Ej. Cemento 25kg, Mano de obra..." value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
        <div><label className="label">Categoría</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(CAT_META).map(([cat, meta])=>(
              <button key={cat} onClick={()=>setForm({...form,category:cat})} className="py-2.5 rounded-lg text-[12px] font-medium transition-all" style={{ background:form.category===cat?'rgba(0,214,143,0.08)':'rgba(255,255,255,0.02)', border:`1px solid ${form.category===cat?'rgba(0,214,143,0.45)':'var(--line)'}`, color:form.category===cat?'#6FFFCB':meta.color }}>{cat}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Cantidad</label><input className="input" type="number" min="0" placeholder="1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/></div>
          <div><label className="label">Unidad</label><input className="input" placeholder="m², kg…" value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/></div>
          <div><label className="label">P. unitario (CLP)</label><input className="input" type="number" placeholder="0" value={form.unit_price} onChange={e=>setForm({...form,unit_price:e.target.value})}/></div>
        </div>
        {Number(form.quantity)>0 && Number(form.unit_price)>0 && (
          <div className="flex justify-between items-center px-3 py-2 rounded-lg" style={{ background:'rgba(0,214,143,0.06)', border:'1px solid rgba(0,214,143,0.2)' }}>
            <span className="text-[12px]" style={{ color:'var(--text-2)' }}>Subtotal</span>
            <span className="font-mono font-semibold text-[14px]" style={{ color:'var(--jade)' }}>{fmtCLP(Number(form.quantity)*Number(form.unit_price))}</span>
          </div>
        )}
        <div><label className="label">Proveedor</label><input className="input" placeholder="Nombre del proveedor" value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})}/></div>
        <div><label className="label">Nota</label><input className="input" placeholder="Descripción corta" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></div>
      </div>
      <div className="hairline-t mt-8 pt-5 flex items-center justify-between">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}><I name="check" size={14}/>{loading?'Guardando...':(isEdit?'Guardar cambios':'Guardar insumo')}</button>
      </div>
    </SlideOver>
  );
}

// ─── MAT. Y SERVICIOS FORM PANEL ─────────────────────────────
function MatServicioFormPanel({ open, onClose, projects, defaultProjectId, item }: { open: boolean; onClose: () => void; projects: any[]; defaultProjectId?: string; item?: MaterialServicio }) {
  const isEdit = !!item;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Material', supplier: '', unit: 'unidad', unit_price: '', quantity: '1', status: 'Activo', notes: '', project_id: '' });

  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({ name: item.name || '', category: item.category || 'Material', supplier: item.supplier || '', unit: item.unit || 'unidad', unit_price: String(item.unit_price || ''), quantity: String(item.quantity || 1), status: item.status || 'Activo', notes: item.notes || '', project_id: item.project_id || '' });
    } else {
      setForm({ name: '', category: 'Material', supplier: '', unit: 'unidad', unit_price: '', quantity: '1', status: 'Activo', notes: '', project_id: defaultProjectId || '' });
    }
  }, [open, item?.id]);

  async function handleSave() {
    if (!form.name.trim()) return;
    setLoading(true);
    const payload = { name: form.name, category: form.category, supplier: form.supplier || null, unit: form.unit, unit_price: Number(form.unit_price) || 0, quantity: Number(form.quantity) || 1, status: form.status, notes: form.notes || null, project_id: form.project_id || null };
    const { error } = isEdit
      ? await supabase.from('lista_materiales_servicios').update(payload).eq('id', item!.id)
      : await supabase.from('lista_materiales_servicios').insert([{ id: 'ms' + Date.now(), ...payload }]);
    setLoading(false);
    if (!error) onClose();
    else alert('Error: ' + error.message);
  }

  const subtotal = Number(form.quantity) * Number(form.unit_price);

  return (
    <SlideOver open={open} onClose={onClose} subtitle={isEdit ? 'Editar ítem' : 'Nuevo ítem'} title={isEdit ? (form.name || 'Editar') : 'Registrar material o servicio'}>
      <div className="space-y-5">
        <div><label className="label">Nombre *</label><input className="input" placeholder="Ej. Pintura látex, Consultoría legal…" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="label">Categoría</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(CAT_META).map(([cat, meta]) => (
              <button key={cat} onClick={() => setForm({ ...form, category: cat })} className="py-2.5 rounded-lg text-[12px] font-medium transition-all" style={{ background: form.category === cat ? 'rgba(0,214,143,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${form.category === cat ? 'rgba(0,214,143,0.45)' : 'var(--line)'}`, color: form.category === cat ? '#6FFFCB' : meta.color }}>{cat}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Cantidad</label><input className="input" type="number" min="0" placeholder="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
          <div><label className="label">Unidad</label><input className="input" placeholder="m², kg…" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
          <div><label className="label">P. unitario (CLP)</label><input className="input" type="number" placeholder="0" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} /></div>
        </div>
        {subtotal > 0 && (
          <div className="flex justify-between items-center px-3 py-2 rounded-lg" style={{ background: 'rgba(0,214,143,0.06)', border: '1px solid rgba(0,214,143,0.2)' }}>
            <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>Subtotal</span>
            <span className="font-mono font-semibold text-[14px]" style={{ color: 'var(--jade)' }}>{fmtCLP(subtotal)}</span>
          </div>
        )}
        <div><label className="label">Proveedor</label><input className="input" placeholder="Nombre del proveedor" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} /></div>
        <div><label className="label">Estado</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(STATUS_MAT_META).map(([s, meta]) => (
              <button key={s} onClick={() => setForm({ ...form, status: s })} className="py-2.5 rounded-lg text-[12px] font-medium transition-all" style={{ background: form.status === s ? 'rgba(0,214,143,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${form.status === s ? 'rgba(0,214,143,0.45)' : 'var(--line)'}`, color: form.status === s ? '#6FFFCB' : meta.color }}>{s}</button>
            ))}
          </div>
        </div>
        <div><label className="label">Proyecto (opcional)</label>
          <select className="select" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
            <option value="">Sin proyecto</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><label className="label">Notas</label><input className="input" placeholder="Descripción corta" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <div className="hairline-t mt-8 pt-5 flex items-center justify-between">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}><I name="check" size={14} />{loading ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Guardar ítem')}</button>
      </div>
    </SlideOver>
  );
}

// ─── INPUTS VIEW ─────────────────────────────────────────────
function InputsView({ projects, searchText = '' }: { projects: any[]; searchText?: string }) {
  const [activeTab, setActiveTab] = useState<'insumos' | 'materiales'>('insumos');

  // ── Insumos state ──
  const [insumos, setInsumos] = useState<any[]>([]);
  const [loadingInsumos, setLoadingInsumos] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editInsumo, setEditInsumo] = useState<any>(null);
  const [filterProjectId, setFilterProjectId] = useState('');

  // ── Materiales y Servicios state ──
  const [materiales, setMateriales] = useState<MaterialServicio[]>([]);
  const [loadingMat, setLoadingMat] = useState(true);
  const [matFormOpen, setMatFormOpen] = useState(false);
  const [editMat, setEditMat] = useState<MaterialServicio | null>(null);
  const [filterMatProjectId, setFilterMatProjectId] = useState('');
  const [filterMatStatus, setFilterMatStatus] = useState('');
  const [filterMatCategory, setFilterMatCategory] = useState('');

  async function fetchInsumos() {
    const { data } = await supabase.from('insumos').select('*').order('created_at', { ascending: false });
    if (data) setInsumos(data);
    setLoadingInsumos(false);
  }
  async function fetchMateriales() {
    const { data } = await supabase.from('lista_materiales_servicios').select('*').order('created_at', { ascending: false });
    if (data) setMateriales(data as MaterialServicio[]);
    setLoadingMat(false);
  }
  useEffect(() => { fetchInsumos(); fetchMateriales(); }, []);

  async function handleDeleteInsumo(i: any) {
    if (!confirm(`¿Eliminar "${i.name}"?`)) return;
    const { error } = await supabase.from('insumos').delete().eq('id', i.id);
    if (error) { alert('Error: ' + error.message); return; }
    fetchInsumos();
  }
  async function handleDeleteMat(m: MaterialServicio) {
    if (!confirm(`¿Eliminar "${m.name}"?`)) return;
    const { error } = await supabase.from('lista_materiales_servicios').delete().eq('id', m.id);
    if (error) { alert('Error: ' + error.message); return; }
    fetchMateriales();
  }

  const visibleInsumos = filterProjectId ? insumos.filter(i => i.project_id === filterProjectId) : insumos;
  const filteredInsumos = visibleInsumos.filter(i =>
    i.name.toLowerCase().includes(searchText.toLowerCase()) ||
    i.category.toLowerCase().includes(searchText.toLowerCase()) ||
    (i.supplier && i.supplier.toLowerCase().includes(searchText.toLowerCase())) ||
    (i.note && i.note.toLowerCase().includes(searchText.toLowerCase()))
  );

  const filteredMateriales = materiales.filter(m => {
    const matchText = m.name.toLowerCase().includes(searchText.toLowerCase()) ||
      m.category.toLowerCase().includes(searchText.toLowerCase()) ||
      (m.supplier && m.supplier.toLowerCase().includes(searchText.toLowerCase())) ||
      (m.notes && m.notes.toLowerCase().includes(searchText.toLowerCase()));
    const matchProject = !filterMatProjectId || m.project_id === filterMatProjectId;
    const matchStatus = !filterMatStatus || m.status === filterMatStatus;
    const matchCat = !filterMatCategory || m.category === filterMatCategory;
    return matchText && matchProject && matchStatus && matchCat;
  });

  const getProject = (pid: string | null | undefined) => pid ? projects.find(p => p.id === pid) : null;
  const totalMat = filteredMateriales.reduce((s, m) => s + m.unit_price * m.quantity, 0);

  return (
    <div className="p-4 md:p-8 space-y-6">

      {/* ── Sub-tab navigation ── */}
      <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)', width: 'fit-content' }}>
        {([
          { id: 'insumos',    label: 'Catálogo de Insumos',      icon: 'package' },
          { id: 'materiales', label: 'Materiales y Servicios',    icon: 'layers'  },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all"
            style={{ background: activeTab === tab.id ? 'rgba(0,214,143,0.1)' : 'transparent', color: activeTab === tab.id ? '#6FFFCB' : 'var(--text-2)', border: activeTab === tab.id ? '1px solid rgba(0,214,143,0.3)' : '1px solid transparent' }}>
            <I name={tab.icon} size={14} />{tab.label}
          </button>
        ))}
      </div>

      {/* ══ Tab: Catálogo de Insumos ══ */}
      {activeTab === 'insumos' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-bold text-[20px] md:text-[22px]" style={{ fontFamily: 'Sora' }}>Catálogo de insumos</h2><p className="text-[12px] mt-0.5" style={{ color: 'var(--text-2)' }}>Materiales, servicios y recursos de tus proyectos</p></div>
            <div className="flex items-center gap-2">
              <select className="select !h-9 !text-[12px]" style={{ minWidth: 160 }} value={filterProjectId} onChange={e => setFilterProjectId(e.target.value)}>
                <option value="">Todos los proyectos</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn btn-primary" onClick={() => { setEditInsumo(null); setFormOpen(true); }}><I name="plus" size={14} />Nuevo insumo</button>
            </div>
          </div>
          {loadingInsumos ? (
            <div className="text-center py-12" style={{ color: 'var(--text-2)' }}>Cargando...</div>
          ) : (
            <div className="overflow-x-auto">
              <Card className="overflow-hidden" style={{ minWidth: 620 }}>
                <table className="tbl">
                  <thead><tr><th>Insumo</th><th style={{ width: 120 }}>Categoría</th><th style={{ width: 80 }}>Cant.</th><th style={{ width: 100 }}>Unidad</th><th style={{ width: 140 }}>P. unitario</th><th>Proyecto</th><th style={{ width: 80 }} /></tr></thead>
                  <tbody>
                    {filteredInsumos.map(i => {
                      const catMeta = CAT_META[i.category] || CAT_META['Otro'];
                      const proj = getProject(i.project_id);
                      return (
                        <tr key={i.id}>
                          <td><div className="font-medium">{i.name}</div>{i.note && <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{i.note}</div>}</td>
                          <td><span className={'pill ' + (catMeta.cls || '')}>{i.category || 'Otro'}</span></td>
                          <td className="font-mono text-[12px]">{i.quantity || 1}</td>
                          <td className="font-mono text-[12px]">{i.unit || '—'}</td>
                          <td className="font-mono">{fmtCLP(i.unit_price || 0)}</td>
                          <td className="text-[12px]" style={{ color: 'var(--text-1)' }}>{proj?.name || '—'}</td>
                          <td>
                            <div className="flex items-center gap-1">
                              <button className="btn btn-ghost !w-7 !h-7 !p-0" title="Editar" onClick={() => { setEditInsumo(i); setFormOpen(true); }}><I name="pencil" size={13} /></button>
                              <button className="btn btn-ghost !w-7 !h-7 !p-0" title="Eliminar" onClick={() => handleDeleteInsumo(i)}><I name="trash-2" size={13} color="#FF4D6D" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredInsumos.length === 0 && (
                  <div className="p-12 text-center" style={{ color: 'var(--text-2)' }}>
                    <I name="package" size={32} className="mx-auto mb-3 opacity-40" />
                    <p className="mb-4">{filterProjectId ? 'No hay insumos para este proyecto.' : 'No hay insumos registrados.'}</p>
                    <button className="btn btn-primary mx-auto" onClick={() => { setEditInsumo(null); setFormOpen(true); }}><I name="plus" size={14} />Nuevo insumo</button>
                  </div>
                )}
              </Card>
            </div>
          )}
          <InsumoFormPanel open={formOpen} onClose={() => { setFormOpen(false); fetchInsumos(); }} projects={projects} insumo={editInsumo || undefined} />
        </>
      )}

      {/* ══ Tab: Lista de Materiales y Servicios ══ */}
      {activeTab === 'materiales' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-[20px] md:text-[22px]" style={{ fontFamily: 'Sora' }}>Lista de Materiales y Servicios</h2>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-2)' }}>Registro con estado y seguimiento de ítems</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="select !h-9 !text-[12px]" style={{ minWidth: 140 }} value={filterMatCategory} onChange={e => setFilterMatCategory(e.target.value)}>
                <option value="">Todas las categorías</option>
                {Object.keys(CAT_META).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="select !h-9 !text-[12px]" style={{ minWidth: 130 }} value={filterMatStatus} onChange={e => setFilterMatStatus(e.target.value)}>
                <option value="">Todos los estados</option>
                {Object.keys(STATUS_MAT_META).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="select !h-9 !text-[12px]" style={{ minWidth: 160 }} value={filterMatProjectId} onChange={e => setFilterMatProjectId(e.target.value)}>
                <option value="">Todos los proyectos</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn btn-primary" onClick={() => { setEditMat(null); setMatFormOpen(true); }}><I name="plus" size={14} />Nuevo ítem</button>
            </div>
          </div>

          {filteredMateriales.length > 0 && (
            <div className="flex items-center gap-6 px-4 py-3 rounded-xl" style={{ background: 'rgba(0,214,143,0.06)', border: '1px solid rgba(0,214,143,0.2)' }}>
              <div><span className="text-[11px]" style={{ color: 'var(--text-2)' }}>Ítems</span><p className="font-mono font-bold text-[16px]">{filteredMateriales.length}</p></div>
              <div className="w-px h-8" style={{ background: 'var(--line)' }} />
              <div><span className="text-[11px]" style={{ color: 'var(--text-2)' }}>Total</span><p className="font-mono font-bold text-[16px]" style={{ color: 'var(--jade)' }}>{fmtCLP(totalMat)}</p></div>
            </div>
          )}

          {loadingMat ? (
            <div className="text-center py-12" style={{ color: 'var(--text-2)' }}>Cargando...</div>
          ) : (
            <div className="overflow-x-auto">
              <Card className="overflow-hidden" style={{ minWidth: 860 }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th style={{ width: 110 }}>Categoría</th>
                      <th>Proveedor</th>
                      <th style={{ width: 70 }}>Cant.</th>
                      <th style={{ width: 80 }}>Unidad</th>
                      <th style={{ width: 130 }}>P. Unitario</th>
                      <th style={{ width: 130 }}>Subtotal</th>
                      <th style={{ width: 110 }}>Estado</th>
                      <th>Proyecto</th>
                      <th style={{ width: 80 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMateriales.map(m => {
                      const catMeta = CAT_META[m.category] || CAT_META['Otro'];
                      const statusMeta = STATUS_MAT_META[m.status] || STATUS_MAT_META['Inactivo'];
                      const proj = getProject(m.project_id);
                      const subtotal = m.unit_price * m.quantity;
                      return (
                        <tr key={m.id}>
                          <td><div className="font-medium">{m.name}</div>{m.notes && <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{m.notes}</div>}</td>
                          <td><span className={'pill ' + (catMeta.cls || '')}>{m.category}</span></td>
                          <td className="text-[12px]" style={{ color: 'var(--text-1)' }}>{m.supplier || '—'}</td>
                          <td className="font-mono text-[12px]">{m.quantity}</td>
                          <td className="font-mono text-[12px]">{m.unit}</td>
                          <td className="font-mono text-[12px]">{fmtCLP(m.unit_price)}</td>
                          <td className="font-mono font-semibold" style={{ color: 'var(--jade)' }}>{fmtCLP(subtotal)}</td>
                          <td><span className={'pill ' + (statusMeta.cls || '')}>{m.status}</span></td>
                          <td className="text-[12px]" style={{ color: 'var(--text-1)' }}>{proj?.name || '—'}</td>
                          <td>
                            <div className="flex items-center gap-1">
                              <button className="btn btn-ghost !w-7 !h-7 !p-0" title="Editar" onClick={() => { setEditMat(m); setMatFormOpen(true); }}><I name="pencil" size={13} /></button>
                              <button className="btn btn-ghost !w-7 !h-7 !p-0" title="Eliminar" onClick={() => handleDeleteMat(m)}><I name="trash-2" size={13} color="#FF4D6D" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredMateriales.length === 0 && (
                  <div className="p-12 text-center" style={{ color: 'var(--text-2)' }}>
                    <I name="layers" size={32} className="mx-auto mb-3 opacity-40" />
                    <p className="mb-4">No hay materiales o servicios registrados.</p>
                    <button className="btn btn-primary mx-auto" onClick={() => { setEditMat(null); setMatFormOpen(true); }}><I name="plus" size={14} />Nuevo ítem</button>
                  </div>
                )}
              </Card>
            </div>
          )}
          <MatServicioFormPanel open={matFormOpen} onClose={() => { setMatFormOpen(false); fetchMateriales(); }} projects={projects} item={editMat || undefined} />
        </>
      )}

    </div>
  );
}

// ─── RETURNS VIEW ────────────────────────────────────────────
function ReturnsView({ projects, onRefresh }: { projects: any[]; onRefresh: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [evalOpen, setEvalOpen] = useState(false);

  const COLORS = ['#00D68F', '#4D9EFF', '#F5A623', '#A88CFF'];
  const noProjects = selected.length === 0;
  const scopedProjects = projects.filter(p => selected.includes(p.id));

  const radarData = QUAL_DIMS.map(dim => {
    const row: any = { dim: dim.slice(0, 8) };
    scopedProjects.forEach(p => {
      const found = (p.qualitative || []).find((d: any) => d.dim === dim || d.dim.startsWith(dim.slice(0, 6)));
      row[p.id] = found ? found.score : 0;
    });
    return row;
  });

  const ranking = scopedProjects
    .filter(p => (p.qualitative || []).length > 0)
    .map(p => ({ ...p, avg: p.qualitative.reduce((a: number, d: any) => a + d.score, 0) / p.qualitative.length }))
    .sort((a, b) => b.avg - a.avg);

  const avgQual = ranking.length > 0 ? ranking.reduce((s, p) => s + p.avg, 0) / ranking.length : null;
  const projectsWithRoi = scopedProjects.filter(p => p.roi != null);
  const avgRoi = projectsWithRoi.length > 0 ? projectsWithRoi.reduce((s, p) => s + p.roi, 0) / projectsWithRoi.length : null;

  const bestDim = (() => {
    const dimScores: Record<string, number[]> = {};
    scopedProjects.forEach(p => (p.qualitative || []).forEach((d: any) => { if (!dimScores[d.dim]) dimScores[d.dim] = []; dimScores[d.dim].push(d.score); }));
    const avgs = Object.entries(dimScores).map(([dim, sc]) => ({ dim, avg: sc.reduce((a, s) => a + s, 0) / sc.length }));
    return avgs.sort((a, b) => b.avg - a.avg)[0] || null;
  })();

  const finChartData = scopedProjects.map(p => ({
    name: p.name.length > 14 ? p.name.slice(0, 14) + '…' : p.name,
    Presupuesto: Number(p.budget) || 0,
    Ejecutado: Number(p.executed) || 0,
  }));
  const roiChartData = projectsWithRoi.map(p => ({
    name: p.name.length > 14 ? p.name.slice(0, 14) + '…' : p.name,
    roi: p.roi,
  }));

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-[20px] md:text-[22px]" style={{ fontFamily: 'Sora' }}>Retornos</h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-2)' }}>Mide y compara retornos cualitativos y financieros de tus proyectos</p>
        </div>
        <button className="btn btn-primary" disabled={noProjects} onClick={() => setEvalOpen(true)} style={{ opacity: noProjects ? 0.5 : 1 }}>
          <I name="plus" size={14}/>Nueva evaluación
        </button>
      </div>

      {/* Project selector */}
      <Card className="p-4" strong>
        <div className="flex items-start gap-4">
          <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 38, height: 38, background: 'rgba(168,140,255,0.10)', border: '1px solid rgba(168,140,255,0.30)', color: '#A88CFF' }}>
            <I name="heart" size={17}/>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-[13.5px]">Proyectos a evaluar</span>
              {selected.length > 0
                ? <span className="pill" style={{ background: 'rgba(168,140,255,0.10)', borderColor: 'rgba(168,140,255,0.30)', color: '#A88CFF' }}><I name="check" size={10}/>{selected.length} {selected.length === 1 ? 'proyecto' : 'proyectos'}</span>
                : <span className="pill pill-amber"><I name="alert-circle" size={10}/>selecciona al menos uno</span>
              }
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selected.length === 0
                ? <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>Filtra por uno o más proyectos para ver y crear evaluaciones.</span>
                : scopedProjects.map(p => {
                    const m = scopeMeta(p.scope);
                    return (
                      <span key={p.id} className="pill !text-[11.5px] gap-1.5 cursor-pointer" style={{ background: m.bg, borderColor: m.border, color: m.color }} onClick={() => setSelected(s => s.filter(x => x !== p.id))}>
                        <I name={m.icon} size={11}/>{p.name}<I name="x" size={10} className="opacity-60"/>
                      </span>
                    );
                  })
              }
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {selected.length < projects.length && <button className="btn !h-8 !text-[11.5px]" onClick={() => setSelected(projects.map(p => p.id))}><I name="check-square" size={11}/>Todos</button>}
            {selected.length > 0 && <button className="btn btn-ghost !h-8 !text-[11.5px]" onClick={() => setSelected([])}><I name="x" size={11}/>Limpiar</button>}
            <button className="btn btn-primary !h-8 !text-[12px]" onClick={() => setPickerOpen(o => !o)}><I name={pickerOpen ? 'chevron-up' : 'plus'} size={12}/>{pickerOpen ? 'Cerrar' : 'Elegir'}</button>
          </div>
        </div>
        {pickerOpen && (
          <div className="hairline-t mt-4 pt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
            {projects.map(p => {
              const isSel = selected.includes(p.id);
              const m = scopeMeta(p.scope);
              return (
                <button key={p.id} onClick={() => setSelected(s => isSel ? s.filter(x => x !== p.id) : [...s, p.id])}
                  className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                  style={{ background: isSel ? 'rgba(168,140,255,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isSel ? 'rgba(168,140,255,0.40)' : 'var(--line)'}` }}>
                  <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{ background: isSel ? '#A88CFF' : 'rgba(255,255,255,0.04)', border: `1px solid ${isSel ? '#A88CFF' : 'var(--line-strong)'}` }}>
                    {isSel && <I name="check" size={10} color="#0A0A12"/>}
                  </span>
                  <span className="rounded-md flex items-center justify-center flex-shrink-0" style={{ width: 24, height: 24, background: m.bg, border: `1px solid ${m.border}`, color: m.color }}><I name={m.icon} size={11}/></span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium truncate">{p.name}</div>
                    <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{p.scope}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {noProjects ? (
        <Card className="p-12 text-center">
          <div className="mx-auto mb-5 rounded-2xl flex items-center justify-center" style={{ width: 60, height: 60, background: 'rgba(168,140,255,0.07)', border: '1px solid rgba(168,140,255,0.25)', color: '#A88CFF' }}>
            <I name="heart" size={26}/>
          </div>
          <h3 className="font-bold text-[18px] mb-2" style={{ fontFamily: 'Sora' }}>Selecciona uno o más proyectos</h3>
          <p className="text-[13px] max-w-md mx-auto mb-5" style={{ color: 'var(--text-1)' }}>Elige los proyectos para ver sus retornos y crear nuevas evaluaciones.</p>
          <div className="flex items-center justify-center gap-2">
            <button className="btn btn-primary" onClick={() => setPickerOpen(true)}><I name="folder-plus" size={13}/>Elegir proyectos</button>
            <button className="btn" onClick={() => setSelected(projects.map(p => p.id))}><I name="check-square" size={13}/>Ver todos</button>
          </div>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 md:p-5">
              <div className="eyebrow text-[10px] mb-2">Retorno cualitativo</div>
              <div className="font-mono font-semibold text-[24px]" style={{ color: avgQual ? (avgQual >= 7 ? '#6FFFCB' : avgQual >= 5 ? '#FFD08A' : '#FFB0BF') : 'var(--text-3)' }}>
                {avgQual ? avgQual.toFixed(1) : '—'}<span className="text-[14px] opacity-60">/10</span>
              </div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--text-2)' }}>promedio ponderado</div>
            </Card>
            <Card className="p-4 md:p-5">
              <div className="eyebrow text-[10px] mb-2">ROI financiero</div>
              <div className="font-mono font-semibold text-[24px]" style={{ color: avgRoi != null ? '#6FFFCB' : 'var(--text-3)' }}>
                {avgRoi != null ? `+${avgRoi.toFixed(0)}%` : '—'}
              </div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--text-2)' }}>{projectsWithRoi.length > 0 ? `${projectsWithRoi.length} proyecto${projectsWithRoi.length > 1 ? 's' : ''} con datos` : 'sin datos financieros'}</div>
            </Card>
            <Card className="p-4 md:p-5">
              <div className="eyebrow text-[10px] mb-2">Con evaluaciones</div>
              <div className="font-mono font-semibold text-[24px]">{ranking.length}<span className="text-[14px] opacity-60">/{scopedProjects.length}</span></div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--text-2)' }}>proyectos evaluados</div>
            </Card>
            <Card className="p-4 md:p-5">
              <div className="eyebrow text-[10px] mb-2">Mejor dimensión</div>
              <div className="font-bold text-[17px] truncate" style={{ fontFamily: 'Sora', color: bestDim ? '#6FFFCB' : 'var(--text-3)' }}>{bestDim ? bestDim.dim : '—'}</div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--text-2)' }}>{bestDim ? `${bestDim.avg.toFixed(1)}/10 promedio` : 'sin datos'}</div>
            </Card>
          </div>

          {/* Radar + Ranking */}
          {scopedProjects.some(p => (p.qualitative || []).length > 0) && (
            <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
              <Card className="p-5 md:p-6">
                <div className="eyebrow mb-1">Radar cualitativo</div>
                <p className="text-[12px] mb-4" style={{ color: 'var(--text-2)' }}>Comparativa en {QUAL_DIMS.length} dimensiones · {scopedProjects.length} proyecto{scopedProjects.length > 1 ? 's' : ''}</p>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.06)"/>
                    <PolarAngleAxis dataKey="dim" tick={{ fill: 'var(--text-2)', fontSize: 11 }}/>
                    <Tooltip contentStyle={{ background: '#0A0A12', border: '1px solid var(--line-strong)', borderRadius: 8, fontSize: 12 }}/>
                    {scopedProjects.map((p, i) => (
                      <Radar key={p.id} name={p.name} dataKey={p.id} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.13}/>
                    ))}
                  </RadarChart>
                </ResponsiveContainer>
                {scopedProjects.length > 1 && (
                  <div className="flex flex-wrap gap-3 mt-3 justify-center">
                    {scopedProjects.map((p, i) => (
                      <span key={p.id} className="flex items-center gap-1.5 text-[11px]"><span className="w-3 h-1.5 rounded-full inline-block" style={{ background: COLORS[i % COLORS.length] }}/>{p.name}</span>
                    ))}
                  </div>
                )}
              </Card>
              <Card className="p-5 md:p-6">
                <div className="eyebrow mb-1">Ranking</div>
                <p className="text-[12px] mb-4" style={{ color: 'var(--text-2)' }}>Por retorno cualitativo promedio</p>
                {ranking.length > 0 ? (
                  <div className="space-y-2">
                    {ranking.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line)' }}>
                        <span className="font-bold text-[18px] w-7 text-center flex-shrink-0" style={{ fontFamily: 'Sora', color: i === 0 ? '#F5A623' : i === 1 ? '#B7BAC7' : i === 2 ? '#C28A5A' : 'var(--text-3)' }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate">{p.name}</div>
                          <div className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>{p.scope}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-mono font-semibold text-[15px]" style={{ color: p.avg >= 8 ? '#6FFFCB' : p.avg >= 6 ? '#FFD08A' : 'var(--text-1)' }}>{p.avg.toFixed(1)}</div>
                          <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>de 10</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-[12px]" style={{ color: 'var(--text-2)' }}>Sin evaluaciones en los proyectos seleccionados.</div>
                )}
              </Card>
            </div>
          )}

          {/* Financial performance */}
          <Card className="p-5 md:p-6">
            <div className="eyebrow mb-1">Desempeño financiero</div>
            <p className="text-[12px] mb-4" style={{ color: 'var(--text-2)' }}>Presupuesto vs ejecutado · proyectos seleccionados</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={finChartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false}/>
                <YAxis tick={{ fill: 'var(--text-2)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={n => fmtShort(n)} width={52}/>
                <Tooltip contentStyle={{ background: '#0F0F18', border: '1px solid var(--line-strong)', borderRadius: 10, fontSize: 12, padding: '8px 12px' }} formatter={(v: any) => [fmtCLP(Number(v)), undefined]} labelStyle={{ color: 'var(--text-1)', fontWeight: 600, marginBottom: 4 }} cursor={{ fill: 'rgba(255,255,255,0.03)' }}/>
                <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-2)', paddingTop: 12 }}/>
                <Bar dataKey="Presupuesto" fill="rgba(77,158,255,0.45)" radius={[4, 4, 0, 0]}/>
                <Bar dataKey="Ejecutado" fill="#00D68F" radius={[4, 4, 0, 0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* ROI chart */}
          {roiChartData.length > 0 && (
            <Card className="p-5 md:p-6">
              <div className="eyebrow mb-1">ROI Financiero</div>
              <p className="text-[12px] mb-4" style={{ color: 'var(--text-2)' }}>Retorno sobre inversión · proyectos con datos cuantitativos</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={roiChartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false}/>
                  <YAxis tick={{ fill: 'var(--text-2)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} width={40}/>
                  <Tooltip contentStyle={{ background: '#0F0F18', border: '1px solid var(--line-strong)', borderRadius: 10, fontSize: 12, padding: '8px 12px' }} formatter={(v: any) => [`+${Number(v).toFixed(1)}%`, 'ROI']} labelStyle={{ color: 'var(--text-1)', fontWeight: 600, marginBottom: 4 }} cursor={{ fill: 'rgba(255,255,255,0.03)' }}/>
                  <Bar dataKey="roi" name="ROI" fill="#6FFFCB" radius={[6, 6, 0, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Qualitative detail per project */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scopedProjects.map((p, i) => {
              const qual = p.qualitative || [];
              return (
                <Card key={p.id} className="p-4 md:p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }}/>
                    <span className="font-semibold truncate" style={{ fontFamily: 'Sora' }}>{p.name}</span>
                    {p.roi != null && <span className="pill pill-jade ml-auto !text-[10.5px]">ROI +{p.roi}%</span>}
                  </div>
                  {qual.length > 0 ? (
                    <div className="space-y-3">
                      {qual.map((d: any) => (
                        <div key={d.dim}>
                          <div className="flex justify-between mb-1"><span className="text-[12px]">{d.dim}</span><span className="font-mono text-[12px]">{d.score}/10</span></div>
                          <div className="progress" style={{ height: 4 }}><i style={{ width: (d.score / 10 * 100) + '%', background: COLORS[i % COLORS.length] }}/></div>
                          {d.note && <div className="text-[10.5px] mt-1" style={{ color: 'var(--text-2)' }}>{d.note}</div>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[12px] py-4 text-center" style={{ color: 'var(--text-2)' }}>Sin evaluaciones. Agrega una con "Nueva evaluación".</div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      <NewEvalPanel open={evalOpen} onClose={() => { setEvalOpen(false); onRefresh(); }} projects={scopedProjects.length > 0 ? scopedProjects : projects} onSaved={onRefresh} defaultProjectId={scopedProjects.length === 1 ? scopedProjects[0].id : undefined}/>
    </div>
  );
}

function NewEvalPanel({ open, onClose, projects, onSaved, defaultProjectId }: { open:boolean; onClose:()=>void; projects:any[]; onSaved:()=>void; defaultProjectId?:string }) {
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [evalType, setEvalType] = useState<'qual'|'quant'|'both'>('both');
  const [scores, setScores] = useState<Record<string,number>>(Object.fromEntries(QUAL_DIMS.map(d => [d, 5])));
  const [notes, setNotes] = useState('');
  const [investment, setInvestment] = useState('');
  const [revenue, setRevenue] = useState('');

  useEffect(() => {
    if (!open) return;
    setProjectId(defaultProjectId || '');
    setEvalType('both');
    setScores(Object.fromEntries(QUAL_DIMS.map(d => [d, 5])));
    setNotes(''); setInvestment(''); setRevenue('');
  }, [open, defaultProjectId]);

  const roi = investment && revenue && Number(investment) > 0
    ? (Number(revenue) - Number(investment)) / Number(investment) * 100
    : null;
  const avgQual = QUAL_DIMS.reduce((s, d) => s + scores[d], 0) / QUAL_DIMS.length;

  async function handleSave() {
    if (!projectId) return;
    setLoading(true);
    const updates: any = {};
    if (evalType !== 'quant') updates.qualitative = QUAL_DIMS.map(dim => ({ dim, score: scores[dim], ...(notes ? { note: notes } : {}) }));
    if (evalType !== 'qual' && roi !== null) updates.roi = Math.round(roi);
    const { error } = await supabase.from('proyectos').update(updates).eq('id', projectId);
    setLoading(false);
    if (!error) { onSaved(); onClose(); }
    else alert('Error: ' + error.message);
  }

  return (
    <SlideOver open={open} onClose={onClose} subtitle="Nueva evaluación" title="Evaluar retorno de proyecto">
      <div className="space-y-5">
        <div><label className="label">Proyecto a evaluar *</label>
          <select className="select" value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">Selecciona un proyecto...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label mb-2">Tipo de evaluación</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { val: 'qual',  label: 'Cualitativo', icon: 'heart',       desc: 'Bienestar, impacto, aprendizaje' },
              { val: 'quant', label: 'Financiero',  icon: 'trending-up', desc: 'ROI e ingresos vs inversión' },
              { val: 'both',  label: 'Ambos',       icon: 'combine',     desc: 'Evaluación completa' },
            ] as const).map(t => (
              <button key={t.val} onClick={() => setEvalType(t.val)} type="button"
                className="flex flex-col items-start gap-1.5 p-3 rounded-xl text-left transition-all"
                style={{ background: evalType === t.val ? 'rgba(168,140,255,0.10)' : 'rgba(255,255,255,0.02)', border: `1px solid ${evalType === t.val ? 'rgba(168,140,255,0.40)' : 'var(--line)'}` }}>
                <div className="flex items-center gap-2">
                  <I name={t.icon} size={14} color={evalType === t.val ? '#A88CFF' : 'var(--text-2)'}/>
                  <span className="text-[12.5px] font-medium" style={{ color: evalType === t.val ? '#A88CFF' : 'var(--text-1)' }}>{t.label}</span>
                </div>
                <span className="text-[10.5px]" style={{ color: 'var(--text-2)' }}>{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {(evalType === 'qual' || evalType === 'both') && (
          <div className="hairline-t pt-5 space-y-4">
            <div className="flex items-center gap-2">
              <I name="heart" size={15} color="#A88CFF"/>
              <span className="font-semibold text-[14px]">Evaluación cualitativa</span>
              <span className="text-[11px]" style={{ color: 'var(--text-2)' }}>1 mínimo · 10 máximo</span>
            </div>
            {QUAL_DIMS.map(dim => (
              <div key={dim}>
                <div className="flex items-center justify-between mb-2">
                  <label className="label !mb-0">{dim}</label>
                  <span className="font-mono font-semibold text-[14px]" style={{ color: scores[dim] >= 8 ? '#6FFFCB' : scores[dim] >= 5 ? '#FFD08A' : '#FFB0BF' }}>{scores[dim]}/10</span>
                </div>
                <input type="range" min={1} max={10} value={scores[dim]} onChange={e => setScores({ ...scores, [dim]: Number(e.target.value) })} className="slider-jade w-full" style={{ '--val': `${(scores[dim] - 1) / 9 * 100}%` } as any}/>
                <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--text-3)' }}><span>Muy bajo</span><span>Excelente</span></div>
              </div>
            ))}
            <div className="flex justify-between items-center px-3 py-2 rounded-lg" style={{ background: 'rgba(168,140,255,0.06)', border: '1px solid rgba(168,140,255,0.2)' }}>
              <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>Promedio cualitativo</span>
              <span className="font-mono font-bold text-[16px]" style={{ color: avgQual >= 8 ? '#6FFFCB' : avgQual >= 5 ? '#FFD08A' : '#FFB0BF' }}>{avgQual.toFixed(1)}/10</span>
            </div>
            <div><label className="label">Notas / aprendizajes</label>
              <textarea className="input" style={{ minHeight: 68, resize: 'none' }} placeholder="¿Qué aprendiste? ¿Qué harías diferente?" value={notes} onChange={e => setNotes(e.target.value)}/>
            </div>
          </div>
        )}

        {(evalType === 'quant' || evalType === 'both') && (
          <div className="hairline-t pt-5 space-y-4">
            <div className="flex items-center gap-2">
              <I name="trending-up" size={15} color="var(--jade)"/>
              <span className="font-semibold text-[14px]">Evaluación financiera</span>
              <span className="text-[11px]" style={{ color: 'var(--text-2)' }}>opcional · ROI</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Inversión total (CLP)</label><input className="input font-mono" type="number" placeholder="0" value={investment} onChange={e => setInvestment(e.target.value)}/></div>
              <div><label className="label">Retorno / ingresos (CLP)</label><input className="input font-mono" type="number" placeholder="0" value={revenue} onChange={e => setRevenue(e.target.value)}/></div>
            </div>
            {roi !== null && (
              <div className="flex items-center justify-between px-3 py-3 rounded-lg" style={{ background: roi >= 0 ? 'rgba(0,214,143,0.06)' : 'rgba(255,77,109,0.06)', border: `1px solid ${roi >= 0 ? 'rgba(0,214,143,0.2)' : 'rgba(255,77,109,0.2)'}` }}>
                <span className="text-[12px]" style={{ color: 'var(--text-2)' }}>ROI calculado</span>
                <span className="font-mono font-bold text-[18px]" style={{ color: roi >= 0 ? '#6FFFCB' : '#FFB0BF' }}>{roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="hairline-t mt-8 pt-5 flex items-center justify-between">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading || !projectId}><I name="check" size={14}/>{loading ? 'Guardando...' : 'Guardar evaluación'}</button>
      </div>
    </SlideOver>
  );
}

// ─── LOGIN SCREEN ────────────────────────────────────────────
function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  async function handleGoogle() {
    setBusy(true);
    await signInWithGoogle();
    setBusy(false);
  }
  return (
    <div className="app-bg w-screen h-screen flex items-center justify-center relative overflow-hidden">
      <div className="blur-spot" style={{ width:600,height:600,top:-200,left:-200,background:'rgba(0,214,143,0.10)' }}/>
      <div className="blur-spot" style={{ width:500,height:500,bottom:-180,right:-120,background:'rgba(31,107,90,0.18)' }}/>
      <div className="relative z-10 flex flex-col items-center gap-8" style={{ maxWidth:360, width:'100%', padding:'0 24px' }}>
        <div className="text-center">
          <div className="font-bold text-[32px] tracking-tight mb-1" style={{ fontFamily:'Sora', color:'var(--jade)' }}>NEXUS</div>
          <div className="text-[13px]" style={{ color:'var(--text-2)' }}>Control de proyectos personales</div>
        </div>
        <div className="w-full p-8 rounded-2xl flex flex-col gap-6" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid var(--line-strong)', backdropFilter:'blur(12px)' }}>
          <div className="text-center">
            <div className="font-semibold text-[17px] mb-1" style={{ fontFamily:'Sora' }}>Iniciar sesión</div>
            <div className="text-[12px]" style={{ color:'var(--text-2)' }}>Usa tu cuenta de Google para acceder</div>
          </div>
          <button
            onClick={handleGoogle}
            disabled={busy}
            className="flex items-center justify-center gap-3 w-full py-3 rounded-xl font-medium text-[14px] transition-all"
            style={{ background:'rgba(255,255,255,0.06)', border:'1px solid var(--line-strong)', color:'var(--text-0)', opacity: busy ? 0.6 : 1 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {busy ? 'Redirigiendo…' : 'Continuar con Google'}
          </button>
          <div className="text-center text-[11px]" style={{ color:'var(--text-2)' }}>
            Solo cuentas autorizadas tienen acceso a la plataforma.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ACCESS DENIED SCREEN ────────────────────────────────────
function AccessDeniedScreen() {
  const { user, signOut } = useAuth();
  return (
    <div className="app-bg w-screen h-screen flex items-center justify-center relative overflow-hidden">
      <div className="blur-spot" style={{ width:600,height:600,top:-200,left:-200,background:'rgba(255,77,109,0.06)' }}/>
      <div className="relative z-10 flex flex-col items-center gap-6 text-center" style={{ maxWidth:380, padding:'0 24px' }}>
        <div style={{ width:64,height:64,borderRadius:'50%',background:'rgba(255,77,109,0.10)',border:'1px solid rgba(255,77,109,0.30)',display:'flex',alignItems:'center',justifyContent:'center' }}>
          <I name="shield-off" size={28} color="#FF4D6D"/>
        </div>
        <div>
          <div className="font-bold text-[20px] mb-2" style={{ fontFamily:'Sora' }}>Acceso restringido</div>
          <div className="text-[13px] leading-relaxed" style={{ color:'var(--text-2)' }}>
            Tu cuenta <span style={{ color:'var(--text-1)' }}>{user?.email}</span> está pendiente de aprobación.<br/>Contacta al administrador para que te asigne un rol.
          </div>
        </div>
        <button className="btn btn-ghost flex items-center gap-2" onClick={signOut}>
          <I name="log-out" size={14}/>Cerrar sesión
        </button>
      </div>
    </div>
  );
}

// ─── SETTINGS VIEW ───────────────────────────────────────────
function SettingsView() {
  const { user, isAdmin, signOut } = useAuth();
  const [saved, setSaved] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [appUsers, setAppUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [roleChanging, setRoleChanging] = useState<string | null>(null);

  function toggleTheme() {
    const next = !darkMode;
    setDarkMode(next);
    document.body.classList.toggle('light', !next);
  }

  function handleSave() { setSaved(true); setTimeout(()=>setSaved(false), 2000); }

  async function fetchUsers() {
    setUsersLoading(true);
    const { data, error } = await supabase.rpc('get_all_users');
    if (!error && data) setAppUsers(data);
    setUsersLoading(false);
  }

  useEffect(() => { if (isAdmin) fetchUsers(); }, [isAdmin]);

  async function handleRoleChange(email: string, newRole: string) {
    setRoleChanging(email);
    await supabase.rpc('set_user_role', { p_target_email: email, p_new_role: newRole });
    await fetchUsers();
    setRoleChanging(null);
  }

  const ROLE_LABELS: Record<string, string> = {
    none: 'Sin Permisos', viewer: 'Lectura', editor: 'Escritura', admin: 'Administrador', superadmin: 'SuperAdmin'
  };
  const ROLE_COLORS: Record<string, string> = {
    none: '#7A7E8F', viewer: '#4D9EFF', editor: '#F5A623', admin: '#00D68F', superadmin: '#A88CFF'
  };

  const displayName = user?.display_name || user?.email?.split('@')[0] || 'Usuario';
  const initials = displayName.split(' ').map((w: string)=>w[0]).join('').slice(0,2).toUpperCase();

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-2xl">
      <div><h2 className="font-bold text-[20px] md:text-[22px]" style={{ fontFamily:'Sora' }}>Configuración</h2><p className="text-[12px] mt-0.5" style={{ color:'var(--text-2)' }}>Ajustes de tu cuenta y preferencias</p></div>

      {/* Perfil */}
      <Card className="p-5 md:p-6">
        <div className="eyebrow mb-4">Perfil</div>
        <div className="flex items-center gap-4 mb-4">
          {user?.avatar_url
            ? <img src={user.avatar_url} alt="avatar" style={{ width:48,height:48,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--line-strong)' }}/>
            : <Avatar name={initials} size={48}/>
          }
          <div>
            <div className="font-medium text-[15px]">{displayName}</div>
            <div className="text-[12px]" style={{ color:'var(--text-2)' }}>{user?.email}</div>
            <div className="mt-1">
              <span className="pill text-[10px]" style={{ background:`${ROLE_COLORS[user?.role||'none']}18`, color:ROLE_COLORS[user?.role||'none'], borderColor:`${ROLE_COLORS[user?.role||'none']}40` }}>
                {ROLE_LABELS[user?.role||'none']}
              </span>
            </div>
          </div>
        </div>
        <div>
          <label className="label">Moneda por defecto</label>
          <select className="select"><option>CLP · Peso chileno</option><option>USD · Dólar</option><option>EUR · Euro</option></select>
        </div>
      </Card>

      {/* Tema */}
      <div>
        <label className="label">Tema</label>
        <button onClick={toggleTheme} className="flex items-center gap-3 p-3 rounded-lg w-full transition-all" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid var(--line-strong)' }}>
          <I name={darkMode ? 'moon' : 'sun'} size={16} color={darkMode ? '#4D9EFF' : '#F5A623'}/>
          <span className="flex-1 text-left text-[13px]">{darkMode ? 'Modo oscuro' : 'Modo claro'}</span>
          <div className="rounded-full transition-all" style={{ width:36,height:20,background:darkMode?'var(--jade)':'rgba(255,255,255,0.1)',border:'1px solid var(--line-strong)',position:'relative' }}>
            <div style={{ position:'absolute',top:2,left:darkMode?18:2,width:14,height:14,borderRadius:'50%',background:'white',transition:'left 200ms' }}/>
          </div>
        </button>
      </div>

      {/* Admin: Usuarios y Permisos */}
      {isAdmin && (
        <Card className="p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="eyebrow">Usuarios y Permisos</div>
            <button className="btn btn-ghost !h-7 !px-2.5 !text-[11px] flex items-center gap-1" onClick={fetchUsers}>
              <I name="refresh-cw" size={11}/>Actualizar
            </button>
          </div>
          {usersLoading ? (
            <div className="text-center py-6 text-[12px]" style={{ color:'var(--text-2)' }}>Cargando usuarios…</div>
          ) : appUsers.length === 0 ? (
            <div className="text-center py-6 text-[12px]" style={{ color:'var(--text-2)' }}>No hay usuarios registrados aún.</div>
          ) : (
            <div className="space-y-2">
              {appUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background:'rgba(255,255,255,0.02)', border:'1px solid var(--line)' }}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{ width:32,height:32,borderRadius:'50%',objectFit:'cover',flexShrink:0 }}/>
                    : <Avatar name={(u.display_name||u.email||'?').split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase()} size={32}/>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[13px] truncate">{u.display_name || u.email}</div>
                    <div className="text-[11px] truncate" style={{ color:'var(--text-2)' }}>{u.email}</div>
                  </div>
                  {u.email === 'marcelo.moyav@gmail.com' ? (
                    <span className="pill text-[10px]" style={{ background:'rgba(168,140,255,0.15)', color:'#A88CFF', borderColor:'rgba(168,140,255,0.35)' }}>SuperAdmin</span>
                  ) : (
                    <select
                      value={u.role}
                      disabled={roleChanging === u.email}
                      onChange={e => handleRoleChange(u.email, e.target.value)}
                      className="select !h-7 !text-[11px] !py-0 !w-auto"
                      style={{ minWidth:120 }}
                    >
                      <option value="none">Sin Permisos</option>
                      <option value="viewer">Lectura</option>
                      <option value="editor">Escritura</option>
                      <option value="admin">Administrador</option>
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 text-[11px]" style={{ color:'var(--text-2)' }}>
            Los nuevos usuarios necesitan que les asignes un rol para poder acceder a NEXUS.
          </div>
        </Card>
      )}

      {/* Base de datos */}
      <Card className="p-5 md:p-6">
        <div className="eyebrow mb-4">Base de datos</div>
        <div className="space-y-3">
          {[
            { label:'Proyectos', icon:'folder-kanban', color:'#4D9EFF' },
            { label:'Cotizaciones', icon:'file-text', color:'#F5A623' },
            { label:'Insumos', icon:'package', color:'#00D68F' },
          ].map(item=>(
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg" style={{ background:'rgba(255,255,255,0.02)', border:'1px solid var(--line)' }}>
              <span className="rounded-md flex items-center justify-center" style={{ width:32,height:32,background:`${item.color}18`,border:`1px solid ${item.color}55`,color:item.color }}><I name={item.icon} size={15}/></span>
              <span className="flex-1 text-[13px] font-medium">{item.label}</span>
              <span className="pill pill-jade"><I name="check" size={10}/>Conectado</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Acerca de */}
      <Card className="p-5 md:p-6">
        <div className="eyebrow mb-4">Acerca de NEXUS</div>
        <div className="space-y-2 text-[13px]" style={{ color:'var(--text-1)' }}>
          <div className="flex justify-between"><span>Versión</span><span className="font-mono">1.0.0</span></div>
          <div className="flex justify-between"><span>Stack</span><span className="font-mono">Next.js + Supabase + Vercel</span></div>
          <div className="flex justify-between"><span>Repositorio</span><a href="https://github.com/MarceloSMV88/Proyecto-Nexus" target="_blank" className="font-mono" style={{ color:'var(--jade)' }}>GitHub ↗</a></div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <button className="btn btn-ghost flex items-center gap-2 !text-[12px]" onClick={signOut} style={{ color:'#FF4D6D' }}>
          <I name="log-out" size={13}/>Cerrar sesión
        </button>
        <button className="btn btn-primary" onClick={handleSave}><I name={saved?'check':'save'} size={14}/>{saved?'¡Guardado!':'Guardar cambios'}</button>
      </div>
    </div>
  );
}

// ─── NOTIFICATIONS PANEL ─────────────────────────────────────
function NotificationsPanel({ open, onClose, alerts, onNavigate }: { open: boolean; onClose: () => void; alerts: any[]; onNavigate: (id: string) => void }) {
  return (
    <SlideOver open={open} onClose={onClose} title="Alertas de Control" subtitle={`${alerts.length} eventos pendientes`}>
      <div className="space-y-4">
        {alerts.length === 0 ? (
          <div className="text-center py-12 text-[13px]" style={{ color: 'var(--text-2)' }}>
            <I name="check-circle" size={32} className="mx-auto mb-3 opacity-80" style={{ color: '#00D68F' }} />
            <p className="font-semibold" style={{ fontFamily: 'Sora', color: 'var(--text-0)' }}>¡Todo en orden!</p>
            <p className="text-[11.5px] opacity-75 mt-1">No hay presupuestos sobregirados, hitos atrasados ni cotizaciones vencidas.</p>
          </div>
        ) : (
          alerts.map(alert => {
            const colors = alert.severity === 'red' 
              ? { bg: 'rgba(255, 77, 109, 0.08)', border: 'rgba(255, 77, 109, 0.25)', text: '#FF4D6D' }
              : { bg: 'rgba(245, 166, 35, 0.08)', border: 'rgba(245, 166, 35, 0.25)', text: '#F5A623' };
            return (
              <div key={alert.id} className="p-4 rounded-xl flex gap-3 transition-all hover:bg-white/5" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
                <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', color: colors.text }}>
                  <I name={alert.icon} size={15} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13.5px]" style={{ color: 'var(--text-1)', fontFamily: 'Sora' }}>{alert.title}</div>
                  <p className="text-[12px] mt-1" style={{ color: 'var(--text-2)', lineHeight: 1.4 }}>{alert.detail}</p>
                  <div className="mt-3 flex gap-2">
                    <button className="btn btn-ghost !h-7 !px-2.5 !text-[11px] flex items-center gap-1" onClick={() => { onNavigate(alert.view ? alert.view : `project:${alert.projectId}`); onClose(); }}>
                      <I name="eye" size={11} />Ver detalles
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </SlideOver>
  );
}

// ─── MAIN APP SHELL ───────────────────────────────────────────
function AppShell() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [hitos, setHitos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState<{ view:string; projectId?:string }>({ view:'dashboard' });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  async function fetchProjects() {
    const { data, error } = await supabase.from('proyectos').select('*').order('created_at');
    if (!error && data) setProjects(data);
    setLoading(false);
  }

  async function fetchNotificationData() {
    const { data: qData } = await supabase.from('cotizaciones').select('*');
    if (qData) setQuotes(qData);
    const { data: hData } = await supabase.from('hitos').select('*');
    if (hData) setHitos(hData);
  }

  const alerts = useMemo(() => {
    const list: any[] = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    // 1. Proyectos con presupuesto excedido
    projects.forEach(p => {
      if ((p.executed || 0) > (p.budget || 0) && (p.budget || 0) > 0) {
        list.push({
          id: `p-budget-${p.id}`,
          type: 'budget',
          title: `Presupuesto Excedido: ${p.name}`,
          detail: `Se ha ejecutado ${fmtCLP(p.executed)} de un presupuesto de ${fmtCLP(p.budget)}.`,
          severity: 'red',
          icon: 'wallet',
          projectId: p.id,
        });
      } else if ((p.executed || 0) >= (p.budget || 0) * 0.85 && (p.budget || 0) > 0) {
        list.push({
          id: `p-warn-${p.id}`,
          type: 'budget-warn',
          title: `Presupuesto Cercano al Límite: ${p.name}`,
          detail: `Se ha ejecutado el ${((p.executed/p.budget)*100).toFixed(0)}% del presupuesto total.`,
          severity: 'amber',
          icon: 'wallet',
          projectId: p.id,
        });
      }
    });

    // 2. Cotizaciones vigentes vencidas
    quotes.forEach(q => {
      if (q.status === 'Vigente' && q.expires) {
        const expDate = new Date(q.expires);
        expDate.setHours(0,0,0,0);
        if (expDate < today) {
          const projName = projects.find(p=>p.id===q.project_id)?.name || 'Proyecto';
          list.push({
            id: `q-exp-${q.id}`,
            type: 'quote',
            title: `Cotización Vencida: ${q.ref || q.id}`,
            detail: `Proveedor: ${q.supplier}. Venció el ${fmtDateShort(q.expires)} para el proyecto ${projName}.`,
            severity: 'red',
            icon: 'file-text',
            projectId: q.project_id,
            view: 'quotes',
          });
        } else {
          // cotizaciones que vencen en los próximos 3 días
          const diffTime = expDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 3) {
            list.push({
              id: `q-near-${q.id}`,
              type: 'quote-warn',
              title: `Cotización por Vencer: ${q.ref || q.id}`,
              detail: `Proveedor: ${q.supplier}. Vence en ${diffDays} día${diffDays!==1?'s':''} (${fmtDateShort(q.expires)}).`,
              severity: 'amber',
              icon: 'file-text',
              projectId: q.project_id,
              view: 'quotes',
            });
          }
        }
      }
    });

    // 3. Hitos atrasados
    hitos.forEach(h => {
      if (h.status !== 'Completado' && h.date) {
        const hDate = new Date(h.date);
        hDate.setHours(0,0,0,0);
        if (hDate < today) {
          const projName = projects.find(p=>p.id===h.project_id)?.name || 'Proyecto';
          list.push({
            id: `h-late-${h.id}`,
            type: 'hito',
            title: `Hito Atrasado: ${h.label}`,
            detail: `Venció el ${fmtDateShort(h.date)} en ${projName}. Estado: ${h.status || 'Pendiente'}.`,
            severity: 'red',
            icon: 'calendar',
            projectId: h.project_id,
          });
        }
      }
    });

    return list;
  }, [projects, quotes, hitos]);

  async function loadData() {
    await Promise.all([
      fetchProjects(),
      fetchNotificationData()
    ]);
  }

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if ((window as any).__lucideLoaded) return;
    (window as any).__lucideLoaded = true;
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/lucide@0.460.0/dist/umd/lucide.js';
    s.onload = () => { if ((window as any).lucide?.createIcons) (window as any).lucide.createIcons(); };
    document.head.appendChild(s);
  }, []);

  function onNavigate(id: string) {
    setSearchText('');
    if (id.startsWith('project:')) setRoute({ view:'project_detail', projectId:id.split(':')[1] });
    else setRoute({ view:id });
  }

  const activeNav = route.view === 'project_detail' ? 'projects' : route.view;
  const currentProject = route.projectId ? projects.find(p=>p.id===route.projectId) : null;

  const filteredProjects = useMemo(() => {
    if (!searchText) return projects;
    const q = searchText.toLowerCase();
    return projects.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.code.toLowerCase().includes(q)
    );
  }, [projects, searchText]);

  const titles: Record<string,string> = { dashboard:'Dashboard', projects:'Proyectos', quotes:'Cotizaciones', inputs:'Insumos', returns:'Retornos', settings:'Configuración', project_detail: currentProject?.name||'Detalle' };
  const subtitles: Record<string,string> = { dashboard:`${projects.length} proyectos activos`, projects:'Administra todas tus iniciativas', quotes:'Gestiona cotizaciones de proveedores', inputs:'Catálogo de materiales y servicios', returns:'Mide el retorno de tus proyectos', settings:'Ajustes y preferencias' };

  const visibleNav = isAdmin ? NAV : NAV.filter(n => n.id !== 'settings');
  // Redirect non-admins away from settings
  const safeRoute = (route.view === 'settings' && !isAdmin) ? { view: 'dashboard' } : route;

  // Auth guards — after all hooks
  if (authLoading) return (
    <div className="app-bg w-screen h-screen flex items-center justify-center">
      <div className="text-center"><div className="font-bold text-[20px] mb-2" style={{ fontFamily:'Sora', color:'var(--jade)' }}>NEXUS</div><div className="text-[13px]" style={{ color:'var(--text-2)' }}>Verificando sesión…</div></div>
    </div>
  );
  if (!user) return <LoginScreen/>;
  if (user.role === 'none') return <AccessDeniedScreen/>;

  if (loading) return (
    <div className="app-bg w-screen h-screen flex items-center justify-center">
      <div className="text-center"><div className="font-bold text-[20px] mb-2" style={{ fontFamily:'Sora', color:'var(--jade)' }}>NEXUS</div><div className="text-[13px]" style={{ color:'var(--text-2)' }}>Cargando...</div></div>
    </div>
  );

  return (
    <div className="app-bg w-screen h-screen flex relative overflow-hidden">
      <div className="blur-spot" style={{ width:600,height:600,top:-200,left:-200,background:'rgba(0,214,143,0.10)' }}/>
      <div className="blur-spot" style={{ width:500,height:500,bottom:-180,right:-120,background:'rgba(31,107,90,0.18)' }}/>

      <Sidebar active={activeNav} onChange={onNavigate} collapsed={collapsed} onToggle={()=>setCollapsed(!collapsed)} projects={projects} mobileOpen={mobileOpen} onMobileClose={()=>setMobileOpen(false)} navItems={visibleNav}/>

      <main className="flex-1 flex flex-col relative" style={{ minWidth:0 }}>
        <TopBar title={titles[safeRoute.view]||''} subtitle={subtitles[safeRoute.view]} onMenuClick={()=>setMobileOpen(true)} searchText={searchText} onSearchChange={setSearchText} onBellClick={()=>setNotificationsOpen(true)} hasNotifications={alerts.length > 0}/>
        <div className="flex-1 overflow-y-auto relative">
          <div className="fade-in">
            {safeRoute.view==='dashboard' && <Dashboard projects={filteredProjects} onOpenProject={id=>setRoute({view:'project_detail',projectId:id})}/>}
            {safeRoute.view==='projects' && <ProjectsView projects={filteredProjects} onOpenProject={id=>setRoute({view:'project_detail',projectId:id})} onRefresh={loadData}/>}
            {safeRoute.view==='project_detail' && currentProject && <ProjectDetail project={currentProject} onBack={()=>setRoute({view:'projects'})} onRefresh={loadData}/>}
            {safeRoute.view==='quotes' && <QuotesView projects={projects} searchText={searchText}/>}
            {safeRoute.view==='inputs' && <InputsView projects={projects} searchText={searchText}/>}
            {safeRoute.view==='returns' && <ReturnsView projects={projects} onRefresh={loadData}/>}
            {safeRoute.view==='settings' && isAdmin && <SettingsView/>}
          </div>
        </div>
      </main>

      <NotificationsPanel open={notificationsOpen} onClose={()=>setNotificationsOpen(false)} alerts={alerts} onNavigate={onNavigate}/>
    </div>
  );
}

// ─── ROOT EXPORT ──────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AppShell/>
    </AuthProvider>
  );
}