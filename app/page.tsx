'use client';

import { useEffect, useState, useRef, useMemo, useLayoutEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

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
function Sidebar({ active, onChange, collapsed, onToggle, projects, mobileOpen, onMobileClose }: any) {
  const totalBudget = projects.reduce((a: number, p: any) => a + (p.budget || 0), 0);
  const totalExec = projects.reduce((a: number, p: any) => a + (p.executed || 0), 0);
  const pct = totalBudget > 0 ? (totalExec / totalBudget) * 100 : 0;
  const W = collapsed ? 64 : 240;

  const content = (
    <aside className="hairline-r relative flex flex-col h-full" style={{ width: W, transition: 'width 320ms cubic-bezier(.2,.7,.2,1)', background: 'linear-gradient(180deg,rgba(255,255,255,0.018),rgba(255,255,255,0.003))', backdropFilter: 'blur(20px)' }}>
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
        {!collapsed && <button className="btn btn-ghost !h-7 !w-7 !p-0 ml-auto" onClick={onToggle}><I name="panel-left-close" size={14}/></button>}
        {!collapsed && onMobileClose && <button className="btn btn-ghost !h-7 !w-7 !p-0" onClick={onMobileClose}><I name="x" size={14}/></button>}
      </div>
      {collapsed && <button className="btn btn-ghost mx-auto mt-3 !h-7 !w-7 !p-0" onClick={onToggle}><I name="panel-left-open" size={14}/></button>}

      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        {!collapsed && <div className="px-3 pb-2 eyebrow">Workspace</div>}
        <div className="flex flex-col gap-0.5">
          {NAV.map(item => (
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
          <div onClick={e => e.stopPropagation()} style={{ width: 240 }}>{content}</div>
          <div className="flex-1 bg-black/50"/>
        </div>
      )}
    </>
  );
}

// ─── TOPBAR ──────────────────────────────────────────────────
function TopBar({ title, subtitle, onMenuClick }: { title: string; subtitle?: string; onMenuClick: () => void }) {
  return (
    <header className="hairline-b flex items-center gap-4 px-4 md:px-8" style={{ height:72 }}>
      <button className="btn btn-ghost !w-9 !p-0 md:hidden" onClick={onMenuClick}><I name="menu" size={18}/></button>
      <div className="flex-1 min-w-0">
        <h1 className="font-bold text-[18px] md:text-[22px] truncate" style={{ fontFamily:'Sora', letterSpacing:'-0.02em' }}>{title}</h1>
        {subtitle && <div className="hidden md:block text-[12px]" style={{ color:'var(--text-2)' }}>{subtitle}</div>}
      </div>
      <div className="hidden md:flex items-center gap-2 px-3 hairline rounded-lg" style={{ height:36, width:320, background:'rgba(255,255,255,0.025)' }}>
        <I name="search" size={14} color="var(--text-2)"/>
        <input className="bg-transparent outline-none text-[13px] flex-1" style={{ color:'var(--text-0)' }} placeholder="Buscar..."/>
      </div>
      <button className="btn btn-ghost !w-9 !p-0"><I name="bell" size={16}/></button>
    </header>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────
function Dashboard({ projects, onOpenProject }: { projects: any[]; onOpenProject: (id: string) => void }) {
  const totalBudget = projects.reduce((a:number,p:any)=>a+(p.budget||0),0);
  const totalExec = projects.reduce((a:number,p:any)=>a+(p.executed||0),0);
  const remaining = totalBudget - totalExec;
  const variation = totalBudget > 0 ? ((totalExec-totalBudget)/totalBudget)*100 : 0;
  const vUp = useCountUp(Math.abs(variation));

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label:'Presupuesto Total', value:totalBudget, sub:`${projects.length} proyectos` },
          { label:'Ejecutado', value:totalExec, sub:`${totalBudget>0?((totalExec/totalBudget)*100).toFixed(1):0}% del total` },
          { label:'Por Ejecutar', value:Math.abs(remaining), sub:remaining<0?'déficit':'disponible' },
        ].map(kpi => (
          <Card key={kpi.label} className="p-4 md:p-5 card-hover rise" style={{ minHeight:100 }}>
            <div className="eyebrow text-[10px] md:text-[11px]">{kpi.label}</div>
            <div className="mt-2 md:mt-3 font-mono font-semibold" style={{ fontSize:22, lineHeight:1.05 }}><MoneyCounter value={kpi.value}/></div>
            <div className="mt-1 text-[11px] md:text-[12px]" style={{ color:'var(--text-2)' }}>{kpi.sub}</div>
          </Card>
        ))}
        <Card className="p-4 md:p-5 card-hover rise" style={{ minHeight:100 }}>
          <div className="eyebrow text-[10px] md:text-[11px]">Variación</div>
          <div className="mt-2 md:mt-3 font-mono font-semibold" style={{ fontSize:26, color:variation>5?'#FFB0BF':variation>0?'#FFD08A':'#6FFFCB' }}>
            {variation>=0?'+':''}{vUp.toFixed(1)}<span className="text-lg opacity-70">%</span>
          </div>
          <div className="mt-1 text-[11px]" style={{ color:'var(--text-2)' }}>frente a presupuesto</div>
        </Card>
      </div>

      <div>
        <div className="flex items-end justify-between mb-4">
          <div><div className="eyebrow mb-1">Mapa de proyectos</div><h2 className="font-bold text-[18px] md:text-[20px]" style={{ fontFamily:'Sora' }}>{projects.length} iniciativas activas</h2></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p:any) => {
            const m = scopeMeta(p.scope);
            return (
              <div key={p.id} className="glass rounded-2xl p-4 md:p-5 card-hover cursor-pointer rise" onClick={() => onOpenProject(p.id)}>
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
                    <span className="font-mono text-[12px]" style={{ color:p.health==='danger'?'#FFB0BF':'#6FFFCB' }}>{p.progress||0}%</span>
                  </div>
                  <ProgressBar value={p.progress||0} tone={p.health==='danger'?'danger':p.health==='warn'?'warn':'ok'}/>
                  <div className="flex justify-between mt-2 font-mono text-[11px]" style={{ color:'var(--text-2)' }}><span>{fmtShort(p.executed||0)}</span><span>de {fmtShort(p.budget||0)}</span></div>
                </div>
                <div className="mt-3 pt-3 hairline-t flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0"><I name="calendar" size={12} color="var(--text-2)"/><span className="text-[11px] truncate" style={{ color:'var(--text-1)' }}>{p.next_label||'Sin hitos'}</span></div>
                  <span className="font-mono text-[11px] flex-shrink-0" style={{ color:'var(--text-2)' }}>{p.next_date?fmtDateShort(p.next_date):'—'}</span>
                </div>
              </div>
            );
          })}
          {projects.length===0 && <div className="col-span-3 glass rounded-2xl p-12 text-center" style={{ color:'var(--text-2)' }}><I name="folder-open" size={32} className="mx-auto mb-3 opacity-40"/><p>No hay proyectos. Crea uno desde Proyectos.</p></div>}
        </div>
      </div>
    </div>
  );
}

// ─── PROJECTS VIEW ───────────────────────────────────────────
function ProjectsView({ projects, onOpenProject, onRefresh }: { projects: any[]; onOpenProject: (id:string)=>void; onRefresh: ()=>void }) {
  const [view, setView] = useState<'list'|'kanban'>('list');
  const [newOpen, setNewOpen] = useState(false);

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
          <Card className="overflow-hidden" style={{ minWidth:700 }}>
            <table className="tbl">
              <thead><tr><th>Proyecto</th><th style={{width:120}}>Ámbito</th><th style={{width:120}}>Presupuesto</th><th style={{width:120}}>Ejecutado</th><th style={{width:180}}>Avance</th><th style={{width:100}}>Estado</th><th style={{width:40}}></th></tr></thead>
              <tbody>
                {projects.map((p:any) => {
                  const m = scopeMeta(p.scope);
                  return (
                    <tr key={p.id} onClick={()=>onOpenProject(p.id)} style={{ cursor:'pointer' }}>
                      <td><div className="flex items-center gap-3"><span className="rounded-md flex items-center justify-center" style={{ width:26,height:26,background:m.bg,border:`1px solid ${m.border}`,color:m.color }}><I name={m.icon} size={13}/></span><div><div className="font-medium">{p.name}</div><div className="text-[10px] font-mono" style={{ color:'var(--text-3)' }}>{p.code}</div></div></div></td>
                      <td><ScopePill scope={p.scope||'Personal'}/></td>
                      <td className="font-mono">{fmtShort(p.budget||0)}</td>
                      <td className="font-mono" style={{ color:p.health==='danger'?'#FFB0BF':'var(--text-0)' }}>{fmtShort(p.executed||0)}</td>
                      <td><div className="flex items-center gap-2"><div className="flex-1"><ProgressBar value={p.progress||0} tone={p.health==='danger'?'danger':'ok'}/></div><span className="font-mono text-[11px] w-8 text-right">{p.progress||0}%</span></div></td>
                      <td><StatusPill status={p.status||'En curso'}/></td>
                      <td><button className="btn btn-ghost !w-8 !p-0" onClick={e=>e.stopPropagation()}><I name="more-horizontal" size={14}/></button></td>
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
          {['Planificado','En curso','En revisión','Completado'].map(col => {
            const items = projects.filter((p:any)=>p.status===col);
            const meta = STATUS_META[col];
            return (
              <div key={col} className="kanban-col">
                <div className="flex items-center gap-2 mb-3"><span className={'w-2 h-2 rounded-full '+(meta?.dot||'')} style={{ background:meta?.color }}/><span className="font-semibold text-[12px]" style={{ fontFamily:'Sora' }}>{col}</span><span className="font-mono text-[11px]" style={{ color:'var(--text-2)' }}>{items.length}</span></div>
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
        <div><label className="label">Estado</label><select className="select" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{Object.keys(STATUS_META).map(s=><option key={s}>{s}</option>)}</select></div>
      </div>
      <div className="hairline-t mt-8 pt-5 flex items-center justify-between">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleCreate} disabled={loading}><I name="check" size={14}/>{loading?'Creando...':'Crear proyecto'}</button>
      </div>
    </SlideOver>
  );
}

// ─── PROJECT DETAIL ──────────────────────────────────────────
function ProjectDetail({ project, onBack, onRefresh }: { project:any; onBack:()=>void; onRefresh:()=>void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({...project});
  const [loading, setLoading] = useState(false);
  async function handleSave() {
    setLoading(true);
    const progress = form.budget>0?Math.round((form.executed/form.budget)*100):0;
    const health = progress>=100?'danger':progress>=80?'warn':'ok';
    const { error } = await supabase.from('proyectos').update({ name:form.name, description:form.description, scope:form.scope, budget:Number(form.budget), executed:Number(form.executed), status:form.status, start_date:form.start_date, end_date:form.end_date, next_label:form.next_label, next_date:form.next_date, progress, health }).eq('id',project.id);
    setLoading(false);
    if (!error) { setEditing(false); onRefresh(); }
    else alert('Error: '+error.message);
  }
  const progress = form.budget>0?Math.round((Number(form.executed)/Number(form.budget))*100):0;
  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-ghost !h-8 !w-8 !p-0" onClick={onBack}><I name="arrow-left" size={16}/></button>
        <div className="flex-1"><div className="eyebrow mb-0.5">Detalle del proyecto</div><h1 className="font-bold text-[20px] md:text-[24px]" style={{ fontFamily:'Sora' }}>{project.name}</h1></div>
        <StatusPill status={project.status||'En curso'}/>
        {editing
          ? <><button className="btn btn-ghost" onClick={()=>{setEditing(false);setForm({...project});}}>Cancelar</button><button className="btn btn-primary" onClick={handleSave} disabled={loading}><I name="check" size={14}/>{loading?'Guardando...':'Guardar'}</button></>
          : <button className="btn" onClick={()=>setEditing(true)}><I name="pencil" size={14}/><span className="hidden md:inline">Editar</span></button>}
      </div>

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
            <div><label className="label">Estado</label><select className="select" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{Object.keys(STATUS_META).map(s=><option key={s}>{s}</option>)}</select></div>
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

// ─── QUOTES VIEW ─────────────────────────────────────────────
function QuotesView({ projects }: { projects: any[] }) {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);

  async function fetchQuotes() {
    const { data } = await supabase.from('cotizaciones').select('*').order('created_at', { ascending: false });
    if (data) setQuotes(data);
    setLoading(false);
  }

  useEffect(() => { fetchQuotes(); }, []);

  const getProject = (pid: string) => projects.find(p => p.id === pid);

  const statusColor: Record<string, string> = { 'Vigente':'pill-blue', 'Vencida':'pill-red', 'Adjudicada':'pill-jade', 'Rechazada':'' };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold text-[20px] md:text-[22px]" style={{ fontFamily:'Sora' }}>Cotizaciones</h2><p className="text-[12px] mt-0.5" style={{ color:'var(--text-2)' }}>Gestiona y compara cotizaciones de proveedores</p></div>
        <button className="btn btn-primary" onClick={()=>setNewOpen(true)}><I name="plus" size={14}/>Nueva cotización</button>
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color:'var(--text-2)' }}>Cargando...</div>
      ) : (
        <div className="overflow-x-auto">
          <Card className="overflow-hidden" style={{ minWidth:600 }}>
            <table className="tbl">
              <thead><tr><th>Referencia</th><th>Proveedor</th><th>Proyecto</th><th>Monto</th><th style={{width:100}}>Vence</th><th style={{width:120}}>Estado</th><th style={{width:40}}></th></tr></thead>
              <tbody>
                {quotes.map(q => {
                  const proj = getProject(q.project_id);
                  return (
                    <tr key={q.id}>
                      <td><div className="font-mono text-[12.5px]">{q.ref||q.id}</div><div className="text-[10px]" style={{ color:'var(--text-3)' }}>{q.notes||''}</div></td>
                      <td className="font-medium">{q.supplier||'—'}</td>
                      <td><span className="text-[12px]" style={{ color:'var(--text-1)' }}>{proj?.name||'—'}</span></td>
                      <td className="font-mono">{fmtCLP(q.total||0)}</td>
                      <td className="font-mono text-[12px]" style={{ color:'var(--text-1)' }}>{fmtDateShort(q.expires)}</td>
                      <td><span className={'pill '+(statusColor[q.status]||'')}>{q.status||'Vigente'}</span></td>
                      <td><button className="btn btn-ghost !w-8 !p-0"><I name="more-horizontal" size={14}/></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {quotes.length===0 && (
              <div className="p-12 text-center" style={{ color:'var(--text-2)' }}>
                <I name="file-text" size={32} className="mx-auto mb-3 opacity-40"/>
                <p className="mb-4">No hay cotizaciones aún.</p>
                <button className="btn btn-primary mx-auto" onClick={()=>setNewOpen(true)}><I name="plus" size={14}/>Nueva cotización</button>
              </div>
            )}
          </Card>
        </div>
      )}
      <NewQuotePanel open={newOpen} onClose={()=>{ setNewOpen(false); fetchQuotes(); }} projects={projects}/>
    </div>
  );
}

function NewQuotePanel({ open, onClose, projects }: { open:boolean; onClose:()=>void; projects:any[] }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ ref:'', supplier:'', project_id:'', total:'', status:'Vigente', notes:'', expires:'' });
  async function handleCreate() {
    if (!form.supplier.trim()) return;
    setLoading(true);
    const id = 'q'+Date.now();
    const ref = form.ref || 'COT-'+Date.now().toString().slice(-6);
    const { error } = await supabase.from('cotizaciones').insert([{ id, ref, supplier:form.supplier, project_id:form.project_id||null, total:Number(form.total)||0, status:form.status, notes:form.notes, expires:form.expires||null, currency:'CLP', items:[] }]);
    setLoading(false);
    if (!error) { setForm({ ref:'', supplier:'', project_id:'', total:'', status:'Vigente', notes:'', expires:'' }); onClose(); }
    else alert('Error: '+error.message);
  }
  return (
    <SlideOver open={open} onClose={onClose} subtitle="Nueva cotización" title="Registrar cotización">
      <div className="space-y-5">
        <div><label className="label">Referencia</label><input className="input" placeholder="COT-2026-XXXX (auto si vacío)" value={form.ref} onChange={e=>setForm({...form,ref:e.target.value})}/></div>
        <div><label className="label">Proveedor *</label><input className="input" placeholder="Nombre del proveedor" value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})}/></div>
        <div><label className="label">Proyecto</label>
          <select className="select" value={form.project_id} onChange={e=>setForm({...form,project_id:e.target.value})}>
            <option value="">Sin proyecto asignado</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Monto total (CLP)</label><input className="input" type="number" placeholder="0" value={form.total} onChange={e=>setForm({...form,total:e.target.value})}/></div>
          <div><label className="label">Fecha vencimiento</label><input className="input" type="date" value={form.expires} onChange={e=>setForm({...form,expires:e.target.value})}/></div>
        </div>
        <div><label className="label">Estado</label><select className="select" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{['Vigente','Vencida','Adjudicada','Rechazada'].map(s=><option key={s}>{s}</option>)}</select></div>
        <div><label className="label">Notas</label><textarea className="textarea" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
      </div>
      <div className="hairline-t mt-8 pt-5 flex items-center justify-between">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleCreate} disabled={loading}><I name="check" size={14}/>{loading?'Guardando...':'Guardar cotización'}</button>
      </div>
    </SlideOver>
  );
}

// ─── INPUTS VIEW ─────────────────────────────────────────────
function InputsView({ projects }: { projects: any[] }) {
  const [insumos, setInsumos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);

  async function fetchInsumos() {
    const { data } = await supabase.from('insumos').select('*').order('created_at', { ascending: false });
    if (data) setInsumos(data);
    setLoading(false);
  }

  useEffect(() => { fetchInsumos(); }, []);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold text-[20px] md:text-[22px]" style={{ fontFamily:'Sora' }}>Catálogo de insumos</h2><p className="text-[12px] mt-0.5" style={{ color:'var(--text-2)' }}>Materiales, servicios y recursos de tus proyectos</p></div>
        <button className="btn btn-primary" onClick={()=>setNewOpen(true)}><I name="plus" size={14}/>Nuevo insumo</button>
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color:'var(--text-2)' }}>Cargando...</div>
      ) : (
        <div className="overflow-x-auto">
          <Card className="overflow-hidden" style={{ minWidth:600 }}>
            <table className="tbl">
              <thead><tr><th>Insumo</th><th style={{width:120}}>Categoría</th><th style={{width:100}}>Unidad</th><th style={{width:140}}>Precio unitario</th><th>Proveedor</th><th style={{width:40}}></th></tr></thead>
              <tbody>
                {insumos.map(i => {
                  const catMeta = CAT_META[i.category] || CAT_META['Otro'];
                  return (
                    <tr key={i.id}>
                      <td><div className="font-medium">{i.name}</div>{i.note && <div className="text-[10.5px]" style={{ color:'var(--text-3)' }}>{i.note}</div>}</td>
                      <td><span className={'pill '+(catMeta.cls||'')}>{i.category||'Otro'}</span></td>
                      <td className="font-mono text-[12px]">{i.unit||'—'}</td>
                      <td className="font-mono">{fmtCLP(i.unit_price||0)}</td>
                      <td style={{ color:'var(--text-1)' }}>{i.supplier||'—'}</td>
                      <td><button className="btn btn-ghost !w-8 !p-0"><I name="more-horizontal" size={14}/></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {insumos.length===0 && (
              <div className="p-12 text-center" style={{ color:'var(--text-2)' }}>
                <I name="package" size={32} className="mx-auto mb-3 opacity-40"/>
                <p className="mb-4">No hay insumos registrados.</p>
                <button className="btn btn-primary mx-auto" onClick={()=>setNewOpen(true)}><I name="plus" size={14}/>Nuevo insumo</button>
              </div>
            )}
          </Card>
        </div>
      )}
      <NewInsumoPanel open={newOpen} onClose={()=>{ setNewOpen(false); fetchInsumos(); }} projects={projects}/>
    </div>
  );
}

function NewInsumoPanel({ open, onClose, projects }: { open:boolean; onClose:()=>void; projects:any[] }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name:'', category:'Material', unit:'', unit_price:'', supplier:'', note:'' });
  async function handleCreate() {
    if (!form.name.trim()) return;
    setLoading(true);
    const id = 'i'+Date.now();
    const { error } = await supabase.from('insumos').insert([{ id, name:form.name, category:form.category, unit:form.unit, unit_price:Number(form.unit_price)||0, supplier:form.supplier, note:form.note }]);
    setLoading(false);
    if (!error) { setForm({ name:'', category:'Material', unit:'', unit_price:'', supplier:'', note:'' }); onClose(); }
    else alert('Error: '+error.message);
  }
  return (
    <SlideOver open={open} onClose={onClose} subtitle="Nuevo insumo" title="Registrar insumo">
      <div className="space-y-5">
        <div><label className="label">Nombre *</label><input className="input" placeholder="Ej. Cemento 25kg, Mano de obra..." value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
        <div><label className="label">Categoría</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(CAT_META).map(([cat, meta])=>(
              <button key={cat} onClick={()=>setForm({...form,category:cat})} className="py-2.5 rounded-lg text-[12px] font-medium transition-all" style={{ background:form.category===cat?'rgba(0,214,143,0.08)':'rgba(255,255,255,0.02)', border:`1px solid ${form.category===cat?'rgba(0,214,143,0.45)':'var(--line)'}`, color:form.category===cat?'#6FFFCB':meta.color }}>{cat}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Unidad</label><input className="input" placeholder="m², kg, hr, gl..." value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/></div>
          <div><label className="label">Precio unitario (CLP)</label><input className="input" type="number" placeholder="0" value={form.unit_price} onChange={e=>setForm({...form,unit_price:e.target.value})}/></div>
        </div>
        <div><label className="label">Proveedor</label><input className="input" placeholder="Nombre del proveedor" value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})}/></div>
        <div><label className="label">Nota</label><input className="input" placeholder="Descripción corta" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></div>
      </div>
      <div className="hairline-t mt-8 pt-5 flex items-center justify-between">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleCreate} disabled={loading}><I name="check" size={14}/>{loading?'Guardando...':'Guardar insumo'}</button>
      </div>
    </SlideOver>
  );
}

// ─── RETURNS VIEW ────────────────────────────────────────────
function ReturnsView({ projects }: { projects: any[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [evalOpen, setEvalOpen] = useState(false);
  const [evals, setEvals] = useState<Record<string, any[]>>({});

  // Build radar data from projects with qualitative data
  const scopedProjects = projects.filter(p => selected.includes(p.id) && p.qualitative);
  const radarData = QUAL_DIMS.map(dim => {
    const row: any = { dim: dim.slice(0,8) };
    scopedProjects.forEach(p => {
      const found = (p.qualitative||[]).find((d:any)=>d.dim===dim||d.dim.startsWith(dim.slice(0,6)));
      row[p.id] = found ? found.score : 0;
    });
    return row;
  });

  const COLORS = ['#00D68F','#4D9EFF','#F5A623','#A88CFF'];

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold text-[20px] md:text-[22px]" style={{ fontFamily:'Sora' }}>Retornos</h2><p className="text-[12px] mt-0.5" style={{ color:'var(--text-2)' }}>Mide retornos cualitativos y financieros de tus proyectos</p></div>
        <button className="btn btn-primary" onClick={()=>setEvalOpen(true)}><I name="plus" size={14}/>Nueva evaluación</button>
      </div>

      {/* Project selector */}
      <Card className="p-4" strong>
        <div className="eyebrow mb-3">Selecciona proyectos a comparar</div>
        <div className="flex flex-wrap gap-2">
          {projects.map(p => {
            const m = scopeMeta(p.scope);
            const isSel = selected.includes(p.id);
            return (
              <button key={p.id} onClick={()=>setSelected(s=>isSel?s.filter(x=>x!==p.id):[...s,p.id])} className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all" style={{ background:isSel?m.bg:'rgba(255,255,255,0.02)', border:`1px solid ${isSel?m.border:'var(--line)'}`, color:isSel?m.color:'var(--text-1)' }}>
                <I name={m.icon} size={13}/><span className="text-[12px] font-medium">{p.name}</span>
                {isSel && <I name="check" size={11}/>}
              </button>
            );
          })}
        </div>
      </Card>

      {selected.length === 0 ? (
        <Card className="p-12 text-center"><I name="sparkles" size={32} className="mx-auto mb-3 opacity-40"/><p style={{ color:'var(--text-2)' }}>Selecciona al menos un proyecto para ver sus retornos.</p></Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {scopedProjects.map((p,i) => {
              const qual = p.qualitative||[];
              const avg = qual.length ? qual.reduce((a:number,d:any)=>a+d.score,0)/qual.length : 0;
              return (
                <Card key={p.id} className="p-4 md:p-5">
                  <div className="eyebrow mb-2 truncate">{p.name}</div>
                  <div className="font-mono font-semibold text-[24px]" style={{ color:COLORS[i%COLORS.length] }}>{avg>0?avg.toFixed(1):'—'}<span className="text-[14px] opacity-60">/10</span></div>
                  <div className="text-[11px] mt-1" style={{ color:'var(--text-2)' }}>índice cualitativo</div>
                  {p.roi && <div className="mt-2 font-mono text-[13px]" style={{ color:'#6FFFCB' }}>ROI: +{p.roi}%</div>}
                </Card>
              );
            })}
          </div>

          {/* Radar */}
          {scopedProjects.length > 0 && scopedProjects.some(p=>(p.qualitative||[]).length>0) && (
            <Card className="p-4 md:p-6">
              <div className="eyebrow mb-4">Comparativa por dimensión</div>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)"/>
                  <PolarAngleAxis dataKey="dim" tick={{ fill:'var(--text-2)', fontSize:11 }}/>
                  <Tooltip contentStyle={{ background:'#0A0A12', border:'1px solid var(--line-strong)', borderRadius:8, fontSize:12 }}/>
                  {scopedProjects.map((p,i)=>(
                    <Radar key={p.id} name={p.name} dataKey={p.id} stroke={COLORS[i%COLORS.length]} fill={COLORS[i%COLORS.length]} fillOpacity={0.12}/>
                  ))}
                </RadarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-3 justify-center">
                {scopedProjects.map((p,i)=>(
                  <span key={p.id} className="flex items-center gap-1.5 text-[11px]"><span className="w-3 h-1.5 rounded-full inline-block" style={{ background:COLORS[i%COLORS.length] }}/>{p.name}</span>
                ))}
              </div>
            </Card>
          )}

          {/* Qualitative detail */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scopedProjects.map((p,i)=>(
              <Card key={p.id} className="p-4 md:p-5">
                <div className="flex items-center gap-2 mb-4"><span className="w-2.5 h-2.5 rounded-full" style={{ background:COLORS[i%COLORS.length] }}/><span className="font-semibold" style={{ fontFamily:'Sora' }}>{p.name}</span></div>
                {(p.qualitative||[]).length>0 ? (
                  <div className="space-y-3">
                    {(p.qualitative||[]).map((d:any)=>(
                      <div key={d.dim}>
                        <div className="flex justify-between mb-1"><span className="text-[12px]">{d.dim}</span><span className="font-mono text-[12px]">{d.score}/10</span></div>
                        <div className="progress" style={{ height:4 }}><i style={{ width:(d.score/10*100)+'%', background:COLORS[i%COLORS.length] }}/></div>
                        {d.note && <div className="text-[10.5px] mt-1" style={{ color:'var(--text-2)' }}>{d.note}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[12px] py-4 text-center" style={{ color:'var(--text-2)' }}>Sin evaluaciones. Agrega una con "Nueva evaluación".</div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      <NewEvalPanel open={evalOpen} onClose={()=>setEvalOpen(false)} projects={projects} onSaved={()=>{}} />
    </div>
  );
}

function NewEvalPanel({ open, onClose, projects, onSaved }: { open:boolean; onClose:()=>void; projects:any[]; onSaved:()=>void }) {
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [scores, setScores] = useState<Record<string,number>>(Object.fromEntries(QUAL_DIMS.map(d=>[d,5])));

  async function handleSave() {
    if (!projectId) return;
    setLoading(true);
    const qualitative = QUAL_DIMS.map(dim=>({ dim, score:scores[dim] }));
    const { error } = await supabase.from('proyectos').update({ qualitative }).eq('id', projectId);
    setLoading(false);
    if (!error) { onSaved(); onClose(); }
    else alert('Error: '+error.message);
  }

  return (
    <SlideOver open={open} onClose={onClose} subtitle="Nueva evaluación" title="Evaluar retorno cualitativo">
      <div className="space-y-6">
        <div><label className="label">Proyecto *</label>
          <select className="select" value={projectId} onChange={e=>setProjectId(e.target.value)}>
            <option value="">Selecciona un proyecto...</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="space-y-5">
          {QUAL_DIMS.map(dim=>(
            <div key={dim}>
              <div className="flex justify-between mb-2"><label className="label !mb-0">{dim}</label><span className="font-mono text-[13px]" style={{ color:'var(--jade)' }}>{scores[dim]}/10</span></div>
              <input type="range" min={1} max={10} value={scores[dim]} onChange={e=>setScores({...scores,[dim]:Number(e.target.value)})} className="slider-jade w-full" style={{ '--val':`${(scores[dim]-1)/9*100}%` } as any}/>
              <div className="flex justify-between text-[10px] mt-1" style={{ color:'var(--text-3)' }}><span>1 · Muy bajo</span><span>10 · Excelente</span></div>
            </div>
          ))}
        </div>
      </div>
      <div className="hairline-t mt-8 pt-5 flex items-center justify-between">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading||!projectId}><I name="check" size={14}/>{loading?'Guardando...':'Guardar evaluación'}</button>
      </div>
    </SlideOver>
  );
}

// ─── SETTINGS VIEW ───────────────────────────────────────────
function SettingsView() {
  const [name, setName] = useState('Marcelo');
  const [saved, setSaved] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

function toggleTheme() {
  const next = !darkMode;
  setDarkMode(next);
  document.body.classList.toggle('light', !next);
}

  function handleSave() { setSaved(true); setTimeout(()=>setSaved(false), 2000); }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-2xl">
      <div><h2 className="font-bold text-[20px] md:text-[22px]" style={{ fontFamily:'Sora' }}>Configuración</h2><p className="text-[12px] mt-0.5" style={{ color:'var(--text-2)' }}>Ajustes de tu cuenta y preferencias</p></div>

      <Card className="p-5 md:p-6">
        <div className="eyebrow mb-4">Perfil</div>
        <div className="flex items-center gap-4 mb-5">
          <Avatar name="MC" size={48}/>
          <div><div className="font-medium text-[15px]">{name}</div><div className="text-[12px]" style={{ color:'var(--text-2)' }}>Project Lead · NEXUS</div></div>
        </div>
        <div className="space-y-4">
          <div><label className="label">Nombre</label><input className="input" value={name} onChange={e=>setName(e.target.value)}/></div>
          <div><label className="label">Moneda por defecto</label><select className="select"><option>CLP · Peso chileno</option><option>USD · Dólar</option><option>EUR · Euro</option></select></div>
        </div>
      </Card>

      <div>
  <label className="label">Tema</label>
  <button onClick={toggleTheme} className="flex items-center gap-3 p-3 rounded-lg w-full transition-all" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid var(--line-strong)' }}>
    <I name={darkMode ? 'moon' : 'sun'} size={16} color={darkMode ? '#4D9EFF' : '#F5A623'}/>
    <span className="flex-1 text-left text-[13px]">{darkMode ? 'Modo oscuro' : 'Modo claro'}</span>
    <div className="rounded-full transition-all" style={{ width:36, height:20, background:darkMode?'var(--jade)':'rgba(255,255,255,0.1)', border:'1px solid var(--line-strong)', position:'relative' }}>
      <div style={{ position:'absolute', top:2, left:darkMode?18:2, width:14, height:14, borderRadius:'50%', background:'white', transition:'left 200ms' }}/>
    </div>
  </button>
</div>

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

      <Card className="p-5 md:p-6">
        <div className="eyebrow mb-4">Acerca de NEXUS</div>
        <div className="space-y-2 text-[13px]" style={{ color:'var(--text-1)' }}>
          <div className="flex justify-between"><span>Versión</span><span className="font-mono">1.0.0</span></div>
          <div className="flex justify-between"><span>Stack</span><span className="font-mono">Next.js + Supabase + Vercel</span></div>
          <div className="flex justify-between"><span>Repositorio</span><a href="https://github.com/MarceloSMV88/Proyecto-Nexus" target="_blank" className="font-mono" style={{ color:'var(--jade)' }}>GitHub ↗</a></div>
        </div>
      </Card>

      <div className="flex justify-end">
        <button className="btn btn-primary" onClick={handleSave}><I name={saved?'check':'save'} size={14}/>{saved?'¡Guardado!':'Guardar cambios'}</button>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState<{ view:string; projectId?:string }>({ view:'dashboard' });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function fetchProjects() {
    const { data, error } = await supabase.from('proyectos').select('*').order('created_at');
    if (!error && data) setProjects(data);
    setLoading(false);
  }

  useEffect(() => { fetchProjects(); }, []);

  useEffect(() => {
    if ((window as any).__lucideLoaded) return;
    (window as any).__lucideLoaded = true;
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/lucide@0.460.0/dist/umd/lucide.js';
    s.onload = () => { if ((window as any).lucide?.createIcons) (window as any).lucide.createIcons(); };
    document.head.appendChild(s);
  }, []);

  function onNavigate(id: string) {
    if (id.startsWith('project:')) setRoute({ view:'project_detail', projectId:id.split(':')[1] });
    else setRoute({ view:id });
  }

  const activeNav = route.view === 'project_detail' ? 'projects' : route.view;
  const currentProject = route.projectId ? projects.find(p=>p.id===route.projectId) : null;

  const titles: Record<string,string> = { dashboard:'Dashboard', projects:'Proyectos', quotes:'Cotizaciones', inputs:'Insumos', returns:'Retornos', settings:'Configuración', project_detail: currentProject?.name||'Detalle' };
  const subtitles: Record<string,string> = { dashboard:`${projects.length} proyectos activos`, projects:'Administra todas tus iniciativas', quotes:'Gestiona cotizaciones de proveedores', inputs:'Catálogo de materiales y servicios', returns:'Mide el retorno de tus proyectos', settings:'Ajustes y preferencias' };

  if (loading) return (
    <div className="app-bg w-screen h-screen flex items-center justify-center">
      <div className="text-center"><div className="font-bold text-[20px] mb-2" style={{ fontFamily:'Sora', color:'var(--jade)' }}>NEXUS</div><div className="text-[13px]" style={{ color:'var(--text-2)' }}>Cargando...</div></div>
    </div>
  );

  return (
    <div className="app-bg w-screen h-screen flex relative overflow-hidden">
      <div className="blur-spot" style={{ width:600,height:600,top:-200,left:-200,background:'rgba(0,214,143,0.10)' }}/>
      <div className="blur-spot" style={{ width:500,height:500,bottom:-180,right:-120,background:'rgba(31,107,90,0.18)' }}/>

      <Sidebar active={activeNav} onChange={onNavigate} collapsed={collapsed} onToggle={()=>setCollapsed(!collapsed)} projects={projects} mobileOpen={mobileOpen} onMobileClose={()=>setMobileOpen(false)}/>

      <main className="flex-1 flex flex-col relative" style={{ minWidth:0 }}>
        <TopBar title={titles[route.view]||''} subtitle={subtitles[route.view]} onMenuClick={()=>setMobileOpen(true)}/>
        <div className="flex-1 overflow-y-auto relative">
          <div className="fade-in">
            {route.view==='dashboard' && <Dashboard projects={projects} onOpenProject={id=>setRoute({view:'project_detail',projectId:id})}/>}
            {route.view==='projects' && <ProjectsView projects={projects} onOpenProject={id=>setRoute({view:'project_detail',projectId:id})} onRefresh={fetchProjects}/>}
            {route.view==='project_detail' && currentProject && <ProjectDetail project={currentProject} onBack={()=>setRoute({view:'projects'})} onRefresh={fetchProjects}/>}
            {route.view==='quotes' && <QuotesView projects={projects}/>}
            {route.view==='inputs' && <InputsView projects={projects}/>}
            {route.view==='returns' && <ReturnsView projects={projects}/>}
            {route.view==='settings' && <SettingsView/>}
          </div>
        </div>
      </main>
    </div>
  );
}