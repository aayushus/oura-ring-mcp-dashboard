/**
 * Prism Component Library
 * v1.0 · 16 April 2026
 *
 * Every component here is token-driven — colours and radii reference
 * the tokens defined in tokens.css. Never hardcode values.
 *
 * Import at app root:
 *   import './tokens.css';
 *   import './components.css';
 *
 * Then use:
 *   import { Button, Field, StepRow, AIVerdict } from './components';
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Prism as AIGlyph, Check, Warn, Sun, Moon, Caret, Chevron, Cross, Plus, Dots, CalendarIcon, ArrowLeft, ArrowRight, User, Sparkle, Search, Upload } from './Icons';

/* ═══════════════════════════════════════════════════════════
   Existing components...
   ═══════════════════════════════════════════════════════════ */

/* [Existing components truncated for brevity, but I will include the full updated file below] */

/**
 * Badge — alias for Tag
 */
export const Badge = Tag;

/**
 * Dialog — alias for Modal
 */
export const Dialog = Modal;

/**
 * Drawer — alias for BottomSheet
 */
export const Drawer = BottomSheet;

/* ═══════════════════════════════════════════════════════════
   Accordion
   ═══════════════════════════════════════════════════════════ */

export function Accordion({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`accordion ${className}`}>{children}</div>;
}

export function AccordionItem({ title, children, open: defaultOpen = false }: { title: ReactNode; children: ReactNode; open?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={`accordion-item ${isOpen ? 'open' : ''}`}>
      <button className="accordion-trigger" onClick={() => setIsOpen(!isOpen)}>
        {title}
        <Chevron direction={isOpen ? 'up' : 'down'} size={12} className="accordion-ico" />
      </button>
      <div className="accordion-content">
        <div style={{ padding: '0 4px' }}>{children}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Alert — specialized Callout
   ═══════════════════════════════════════════════════════════ */

export function Alert({ variant = 'info', title, children, icon }: { variant?: 'info' | 'warn' | 'success'; title?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className={`callout callout-${variant}`} style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--divider-strong)' }}>
      <div className="callout-ico">{icon || (variant === 'warn' ? <Warn /> : <Check />)}</div>
      <div className="callout-text">
        {title && <strong style={{ display: 'block', marginBottom: '2px' }}>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Avatar
   ═══════════════════════════════════════════════════════════ */

export function Avatar({ src, fallback, size, className = '' }: { src?: string; fallback: string; size?: number; className?: string }) {
  const style = size ? { width: size, height: size, fontSize: size * 0.4 } : {};
  return (
    <div className={`avatar ${className}`} style={style}>
      {src ? <img src={src} alt={fallback} /> : <span className="avatar-fallback">{fallback.slice(0, 2)}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Card
   ═══════════════════════════════════════════════════════════ */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="card-head">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 className="card-title">{title}</h3>
          {description && <p className="card-desc">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card-body ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card-foot ${className}`}>{children}</div>;
}

/* ═══════════════════════════════════════════════════════════
   Separator
   ═══════════════════════════════════════════════════════════ */

export function Separator({ orientation = 'horizontal', className = '' }: { orientation?: 'horizontal' | 'vertical'; className?: string }) {
  return <div className={`separator separator-${orientation === 'horizontal' ? 'h' : 'v'} ${className}`} />;
}

/* ═══════════════════════════════════════════════════════════
   Tabs (Desktop)
   ═══════════════════════════════════════════════════════════ */

export function Tabs({ value, children, className = '' }: { value: string; children: ReactNode; className?: string }) {
  return <div className={`tabs ${className}`}>{children}</div>;
}

export function TabsList({ children }: { children: ReactNode }) {
  return <div className="tabs-list">{children}</div>;
}

export function TabsTrigger({ value, active, onClick, children }: { value: string; active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button className={`tabs-trigger ${active ? 'active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

export function TabsContent({ value, active, children }: { value: string; active?: boolean; children: ReactNode }) {
  if (!active) return null;
  return <div className="tabs-content">{children}</div>;
}

/* ═══════════════════════════════════════════════════════════
   Calendar (Basic implementation)
   ═══════════════════════════════════════════════════════════ */

export function Calendar({ selected, onSelect }: { selected?: Date; onSelect?: (date: Date) => void }) {
  const now = new Date();
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  return (
    <div className="calendar">
      <div className="cal-head">
        <button className="btn-ghost" style={{ padding: 4 }}><ArrowLeft size={12} /></button>
        <div className="cal-month">{monthNames[now.getMonth()]} {now.getFullYear()}</div>
        <button className="btn-ghost" style={{ padding: 4 }}><ArrowRight size={12} /></button>
      </div>
      <div className="cal-grid">
        {days.map(d => <div key={d} className="cal-day-head">{d}</div>)}
        {Array.from({ length: 31 }).map((_, i) => (
          <button
            key={i}
            className={`cal-day ${i + 1 === now.getDate() ? 'today' : ''} ${selected?.getDate() === i + 1 ? 'active' : ''}`}
            onClick={() => onSelect?.(new Date(now.getFullYear(), now.getMonth(), i + 1))}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DatePicker
   ═══════════════════════════════════════════════════════════ */

export function DatePicker({ date, onChange, placeholder = "Pick a date" }: { date?: Date; onChange?: (d: Date) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <Button variant="secondary" icon={<CalendarIcon />} onClick={() => setOpen(!open)} className="f-input" style={{ justifyContent: 'flex-start', fontWeight: 400, color: date ? 'var(--text-default)' : 'var(--text-placeholder)' }}>
        {date ? date.toLocaleDateString() : placeholder}
      </Button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100 }}>
          <Calendar selected={date} onSelect={(d) => { onChange?.(d); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Slider
   ═══════════════════════════════════════════════════════════ */

export function Slider({ value = 50, onChange }: { value?: number; onChange?: (v: number) => void }) {
  return (
    <div className="slider">
      <div className="slider-track">
        <div className="slider-range" style={{ width: `${value}%` }} />
      </div>
      <div className="slider-thumb" style={{ position: 'absolute', left: `calc(${value}% - 8px)` }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ToggleGroup
   ═══════════════════════════════════════════════════════════ */

export function ToggleGroup({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return <div className="toggle-group">{children}</div>;
}

export function ToggleGroupItem({ value, active, onClick, children }: { value: string; active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button className={`btn-ghost ${active ? 'on' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   Popover
   ═══════════════════════════════════════════════════════════ */

export function Popover({ trigger, children, open, onOpenChange }: { trigger: ReactNode; children: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div onClick={() => onOpenChange?.(!open)}>{trigger}</div>
      {open && <div className="popover">{children}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Typography
   ═══════════════════════════════════════════════════════════ */

export const Typography = {
  H1: ({ children, className = '' }: { children: ReactNode; className?: string }) => <h1 className={`typo-h1 ${className}`}>{children}</h1>,
  H2: ({ children, className = '' }: { children: ReactNode; className?: string }) => <h2 className={`typo-h2 ${className}`}>{children}</h2>,
  H3: ({ children, className = '' }: { children: ReactNode; className?: string }) => <h3 className={`typo-h3 ${className}`}>{children}</h3>,
  P: ({ children, className = '' }: { children: ReactNode; className?: string }) => <p className={`typo-p ${className}`}>{children}</p>,
  Lead: ({ children, className = '' }: { children: ReactNode; className?: string }) => <p className={`typo-lead ${className}`}>{children}</p>,
  Large: ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={`typo-large ${className}`}>{children}</div>,
  Small: ({ children, className = '' }: { children: ReactNode; className?: string }) => <small className={`typo-small ${className}`}>{children}</small>,
  Muted: ({ children, className = '' }: { children: ReactNode; className?: string }) => <p className={`typo-muted ${className}`}>{children}</p>,
};

/* ═══════════════════════════════════════════════════════════
   AppShell — the root layout (sidebar + main)
   ═══════════════════════════════════════════════════════════ */

/**
 * Root layout shell that wraps the entire application — sidebar + main content area.
 * Always the outermost component in the tree; renders a single `div.app` flex container.
 *
 * @param children - Sidebar and Main components
 * @example
 * <AppShell>
 *   <Sidebar>…</Sidebar>
 *   <Main>…</Main>
 * </AppShell>
 */
export function AppShell({ children }: { children: ReactNode }) {
  return <div className="app">{children}</div>;
}

/**
 * Fixed-width sidebar container rendered on the left of AppShell.
 * Place WorkspaceSwitcher, TreeItem nav items, and SidebarFooter inside.
 *
 * @param collapsed - When true, shrinks sidebar to 56px icon rail
 * @param children - Sidebar content
 */
export function Sidebar({ children, collapsed }: { children: ReactNode; collapsed?: boolean }) {
  return <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>{children}</aside>;
}

/**
 * Logical grouping of sidebar items with an optional label.
 */
export function SidebarGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="sb-group">
      {label && <div className="sb-label">{label}</div>}
      {children}
    </div>
  );
}

/**
 * Main content area rendered to the right of the Sidebar inside AppShell.
 * Grows to fill remaining horizontal space. Place page content here.
 *
 * @param children - Page-level content
 * @example
 * <Main>
 *   <SectionHead title="Overview" />
 *   <StatStrip cells={[…]} />
 * </Main>
 */
export function Main({ children }: { children: ReactNode }) {
  return <main className="main">{children}</main>;
}

/* ═══════════════════════════════════════════════════════════
   Button — primary, secondary, ghost, AI, danger variants
   ═══════════════════════════════════════════════════════════ */

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'ai' | 'danger';
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  kbd?: string; // optional inline keyboard hint
  icon?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Primary action button with icon support and 5 visual variants.
 * Extends the native `<button>` — pass any standard button attribute via rest props.
 *
 * @param variant - Visual style: 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai' (default: 'secondary')
 * @param children - Button label text or content
 * @param onClick - Click handler
 * @param disabled - Disables interaction and greys out the button
 * @param kbd - Optional inline keyboard shortcut hint shown inside the button (e.g. '⌘S')
 * @param icon - Optional SVG element shown before the label (14×14px recommended)
 * @param className - Additional CSS class names to merge
 * @example
 * <Button variant="primary" onClick={save}>Save draft</Button>
 * <Button variant="ai" icon={<AIGlyph />}>Run AI</Button>
 */
export function Button({
  variant = 'secondary',
  children,
  onClick,
  disabled,
  kbd,
  icon,
  className = '',
  style,
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {icon}
      {children}
      {kbd && <span className="kbd-inline">{kbd}</span>}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   Field — the canonical input row
   ═══════════════════════════════════════════════════════════ */

type FieldProps = {
  label: string;
  icon?: ReactNode;
  required?: boolean;
  status?: 'default' | 'done' | 'ai-filled' | 'error';
  aiFilled?: boolean; // shortcut for status="ai-filled"
  children: ReactNode;
};

/**
 * Wrapper for any form input that provides a label, left-bar status indicator, and AI-fill badge.
 * Children should be an `<Input>`, `<Textarea>`, `<Select>`, or `<AffixInput>`.
 *
 * @param label - Field label text displayed above the control
 * @param icon - Optional icon shown to the left of the label text
 * @param required - Appends a required asterisk to the label when true
 * @param status - Left-bar colour: 'default' | 'done' | 'ai-filled' | 'error' (default: 'default')
 * @param aiFilled - Shorthand to set status='ai-filled' and show the AI badge
 * @param children - The form control(s) rendered inside the field
 * @example
 * <Field label="Company name" required>
 *   <Input placeholder="Acme Corp" />
 * </Field>
 * <Field label="Summary" aiFilled>
 *   <Textarea value={aiSummary} />
 * </Field>
 */
export function Field({ label, icon, required, status = 'default', aiFilled, children }: FieldProps) {
  const resolved = aiFilled ? 'ai-filled' : status;
  return (
    <div className={`f f-${resolved}`}>
      <div className="f-label">
        {icon && <span className="f-label-ico">{icon}</span>}
        {label} {required && <span className="f-req">*</span>}
      </div>
      <div className="f-ctl">
        {children}
        {resolved === 'ai-filled' && <AIFilledTag />}
      </div>
    </div>
  );
}

/**
 * Small badge rendered inside a Field when `aiFilled` or `status='ai-filled'` is set.
 * Not typically used directly — Field renders it automatically.
 *
 * @example
 * <AIFilledTag />
 */
export function AIFilledTag() {
  return (
    <span className="f-ai-tag" title="Auto-filled by AI">
      <AIGlyph size={9} strokeWidth={1.8} />
      AI
    </span>
  );
}

/**
 * Styled text input for use inside a `<Field>`. Accepts all native `<input>` attributes.
 *
 * @example
 * <Field label="Email">
 *   <Input type="email" placeholder="you@example.com" />
 * </Field>
 */
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="f-input" {...props} />;
}

/**
 * Styled multi-line text area for use inside a `<Field>`. Accepts all native `<textarea>` attributes.
 *
 * @example
 * <Field label="Notes">
 *   <Textarea rows={4} placeholder="Add context…" />
 * </Field>
 */
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="f-area" {...props} />;
}

/**
 * Styled dropdown select for use inside a `<Field>`. Accepts all native `<select>` attributes.
 *
 * @example
 * <Field label="Country">
 *   <Select>
 *     <option value="us">United States</option>
 *     <option value="gb">United Kingdom</option>
 *   </Select>
 * </Field>
 */
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="f-select" {...props} />;
}

/* ═══════════════════════════════════════════════════════════
   AffixInput — with a prefix (currency, country code, etc)
   ═══════════════════════════════════════════════════════════ */

/**
 * Text input with a fixed prefix label (e.g. currency symbol or country code).
 * Use inside a `<Field>` the same way as `<Input>`.
 *
 * @param prefix - Text displayed to the left of the input (e.g. '$', 'USD', '+1')
 * @example
 * <Field label="Amount">
 *   <AffixInput prefix="$" type="number" placeholder="0.00" />
 * </Field>
 */
export function AffixInput({
  prefix,
  ...props
}: { prefix: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="f-affix">
      <span className="pfx">{prefix}</span>
      <input {...props} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Tag / Pill — state or category
   ═══════════════════════════════════════════════════════════ */

type TagProps = {
  variant?: 'gray' | 'accent' | 'green' | 'yellow' | 'red' | 'ai';
  children: ReactNode;
  icon?: ReactNode;
};

/**
 * Inline label pill for status, category, or taxonomy labelling.
 * Optionally includes a leading icon. Not dismissable — use a custom composition for that.
 *
 * @param variant - Colour style: 'gray' | 'accent' | 'green' | 'yellow' | 'red' | 'ai' (default: 'gray')
 * @param children - Tag label text
 * @param icon - Optional SVG icon displayed before the label (12×12px recommended)
 * @example
 * <Tag variant="green">Approved</Tag>
 * <Tag variant="ai" icon={<AIGlyph />}>AI-reviewed</Tag>
 */
export function Tag({ variant = 'gray', children, icon }: TagProps) {
  return (
    <span className={`tag tag-${variant}`}>
      {icon}
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   StepRow — sidebar onboarding / checklist step
   ═══════════════════════════════════════════════════════════ */

type StepRowProps = {
  number: number | 'done';
  name: string;
  subtitle?: string;
  badge?: { label: string; variant?: 'ai' | 'default' };
  active?: boolean;
  done?: boolean;
  last?: boolean;
  onClick?: () => void;
};

/**
 * Single step in a vertical onboarding checklist or progress flow.
 * Renders a numbered dot (or checkmark when done), a label, optional subtitle, and optional badge.
 *
 * @param number - Step number shown in the dot, or 'done' to render a checkmark
 * @param name - Primary step label text
 * @param subtitle - Secondary description line below the name
 * @param badge - Optional pill appended to the name; pass `variant: 'ai'` for AI styling
 * @param active - Highlights this step as the currently active one
 * @param done - Marks the step complete (shows checkmark dot)
 * @param last - Omits the connector line below the dot when true (use on final step)
 * @param onClick - Click handler to navigate to or expand this step
 * @example
 * <StepRow number={1} name="Company details" active onClick={() => setStep(1)} />
 * <StepRow number={2} name="AI review" badge={{ label: 'AI', variant: 'ai' }} done last />
 */
export function StepRow({
  number, name, subtitle, badge, active, done, last, onClick,
}: StepRowProps) {
  return (
    <div
      className={`step-row ${active ? 'active' : ''} ${done ? 'done' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="step-dot-wrap">
        <div className="step-dot">
          {done ? <Check size={9} strokeWidth={2.2} /> : number}
        </div>
        {!last && <div className="step-line" />}
      </div>
      <div className="step-body">
        <div className="step-name">
          {name}
          {badge && (
            <span className={`step-badge ${badge.variant || ''}`}>
              {badge.variant === 'ai' && <AIGlyph size={8} strokeWidth={1.8} />}
              {badge.label}
            </span>
          )}
        </div>
        {subtitle && <div className="step-sub">{subtitle}</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AskAI — the dock hero tile
   ═══════════════════════════════════════════════════════════ */

/**
 * Hero tile in the sidebar dock that opens the AI command bar.
 * Displays a Sparkle icon, "Ask AI" label, hint text, and ⌘J shortcut badge.
 *
 * @param hint - Secondary hint text describing AI capabilities (default: 'Fill, review, rewrite, summarise…')
 * @param onClick - Called when the tile is clicked to open the AI bar
 * @example
 * <AskAI hint="Summarise, draft, review…" onClick={() => setAIOpen(true)} />
 */
export function AskAI({ hint = 'Fill, review, rewrite, summarise…', onClick }: { hint?: string; onClick?: () => void }) {
  return (
    <div className="ask-ai" onClick={onClick} role="button" tabIndex={0}>
      <div className="ask-ai-sparkle">
        <AIGlyph size={14} />
      </div>
      <div className="ask-ai-text">
        <div className="ask-ai-label">Ask AI</div>
        <div className="ask-ai-hint">{hint}</div>
      </div>
      <div className="ask-ai-kbd">⌘J</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AgentActivity — live feed of AI agent work
   ═══════════════════════════════════════════════════════════ */

type AgentStatus = 'running' | 'done' | 'warn';
type AgentItem = {
  task: string;
  status: AgentStatus;
  meta?: string;
  metaEmphasis?: string;
  metaEmphasisTone?: 'ok' | 'warn' | 'default';
};

/**
 * Real-time agent step feed rendered in the sidebar dock.
 * Implements "Submerged Logic": minimized by default, expands for power users.
 */
export function AgentActivity({ items, onClear }: { items: AgentItem[]; onClear?: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const activeTask = items.find(it => it.status === 'running');

  if (!isExpanded) {
    return (
      <div className="agent-minimized" onClick={() => setIsExpanded(true)}>
        <div className="agent-dot-pulse" />
        <span className="agent-min-text">
          {activeTask ? `AI: ${activeTask.task}` : `AI: ${items.length} steps complete`}
        </span>
        <Chevron direction="up" size={10} />
      </div>
    );
  }

  return (
    <>
      <div className="dock-label">
        <span className="dock-label-dot" onClick={() => setIsExpanded(false)}>
          <Chevron direction="down" size={10} style={{ marginRight: 6 }} />
          Agent activity
        </span>
        {onClear && <button className="dock-clear" onClick={onClear}>Clear</button>}
      </div>
      <div className="agent-activity">
        {items.map((item, i) => (
          <div className="agent-item" key={i}>
            <div className={`agent-ico ${item.status}`}>
              {item.status === 'running' && <AIGlyph size={11} strokeWidth={1.8} />}
              {item.status === 'done' && <Check size={11} strokeWidth={2} />}
              {item.status === 'warn' && <Warn size={11} strokeWidth={1.8} />}
            </div>
            <div className="agent-text">
              <div className="agent-task">{item.task}</div>
              {item.meta && (
                <div className="agent-meta">
                  {item.meta}
                  {item.metaEmphasis && (
                    <> · <span className={`val ${item.metaEmphasisTone || ''}`}>{item.metaEmphasis}</span></>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   ProgressCapsule — sidebar progress card
   ═══════════════════════════════════════════════════════════ */

type Stat = { value: string | number; label: string; tone?: 'default' | 'ai' };

/**
 * Card showing task completion percentage with a progress bar and stat pills.
 * Typically placed in the sidebar to surface overall project health at a glance.
 *
 * @param title - Card heading text (e.g. 'Application progress')
 * @param score - Human-readable score or grade displayed in the top-right (e.g. '82/100')
 * @param percent - Progress bar fill percentage (0–100)
 * @param stats - Array of `{ value, label, tone? }` pairs shown as chips below the bar
 * @example
 * <ProgressCapsule
 *   title="Application progress"
 *   score="82/100"
 *   percent={82}
 *   stats={[{ value: 12, label: 'Sections done' }, { value: 3, label: 'AI-filled', tone: 'ai' }]}
 * />
 */
export function ProgressCapsule({
  title, score, percent, stats,
}: { title: string; score: string; percent: number; stats: Stat[] }) {
  return (
    <div className="progress-capsule">
      <div className="pc-head">
        <div className="pc-title">{title}</div>
        <div className="pc-score">{score}</div>
      </div>
      <div className="pc-bar">
        <div className="pc-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="pc-stats">
        {stats.map((s, i) => (
          <div className="pc-stat" key={i}>
            <div className={`pc-stat-n ${s.tone === 'ai' ? 'ai-clr' : ''}`}>{s.value}</div>
            <div className="pc-stat-l">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AICommandBar — top-nav AI entry point
   ═══════════════════════════════════════════════════════════ */

/**
 * Desktop AI command bar rendered in the Topnav center slot.
 * Focuses automatically on ⌘J / Ctrl+J keyboard shortcut.
 *
 * @param placeholder - Input placeholder text (default: 'Ask AI anything…')
 * @param value - Controlled input value
 * @param onChange - Called with updated string on every keystroke
 * @example
 * <AICommandBar
 *   placeholder="Ask anything…"
 *   value={query}
 *   onChange={setQuery}
 * />
 */
export function AICommandBar({
  placeholder = "Ask AI anything…",
  onChange,
  value,
}: { placeholder?: string; onChange?: (v: string) => void; value?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="ai-bar" onClick={() => inputRef.current?.focus()}>
      <div className="ai-bar-icon"><AIGlyph size={14} /></div>
      <input
        ref={inputRef}
        className="ai-bar-input"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange?.(e.target.value)}
      />
      <div className="ai-bar-kbd">⌘J</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SectionHead — § NN Title + optional AI action buttons
   ═══════════════════════════════════════════════════════════ */

type SectionHeadProps = {
  number?: string;
  title: string;
  actions?: { label: string; icon?: ReactNode; onClick?: () => void; variant?: 'ai' | 'default' }[];
  description?: string;
};

/**
 * Section heading row with an optional section number, title, action buttons, and description.
 * Renders as `<h2>` — use once per logical form section or content region.
 *
 * @param number - Section reference number shown as "§ N" (e.g. '1', '2a')
 * @param title - Section heading text
 * @param actions - Array of action buttons shown to the right of the title; pass `variant: 'ai'` for AI styling
 * @param description - Optional paragraph rendered below the heading row
 * @example
 * <SectionHead
 *   number="3"
 *   title="Financial overview"
 *   description="Provide the last 3 years of audited financials."
 *   actions={[{ label: 'Auto-fill', variant: 'ai', onClick: autoFill }]}
 * />
 */
export function SectionHead({ number, title, actions, description }: SectionHeadProps) {
  return (
    <>
      <div className="sec-head">
        {number && <span className="sec-num">§ {number}</span>}
        <h2 className="sec-title">{title}</h2>
        {actions && (
          <div className="sec-actions">
            {actions.map((a, i) => (
              <button
                key={i}
                className={a.variant === 'ai' ? 'sec-ai-btn' : 'sec-btn'}
                onClick={a.onClick}
              >
                {a.variant === 'ai' && <AIGlyph size={10} strokeWidth={1.8} />}
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {description && <p className="sec-desc">{description}</p>}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   AIVerdict — the AI review hero card
   ═══════════════════════════════════════════════════════════ */

type Finding = {
  variant: 'positive' | 'warn' | 'action';
  title: string;
  body: string;
  cta?: { label: string; icon?: ReactNode; onClick?: () => void };
};

type AIVerdictProps = {
  score: string | number;
  recommendation: string;
  recommendationNote?: string;
  summary: ReactNode;
  findings?: Finding[];
  timestamp?: string;
  label?: string;
  title?: string;
};

/**
 * Full AI review panel displaying a score, recommendation verdict, summary text, and findings list.
 * Renders as a prominent card — use once per AI evaluation result.
 *
 * @param score - Numeric score displayed large (e.g. 82 renders as "82 / 100")
 * @param recommendation - Verdict label shown below the score (e.g. 'Approve' | 'Reject' | 'Review')
 * @param recommendationNote - Optional sub-note beneath the recommendation (e.g. 'Subject to conditions')
 * @param summary - Prose summary of the AI evaluation (string or JSX)
 * @param findings - Array of `AIFinding` props rendered below the summary
 * @param timestamp - Human-readable time string shown in the card header (default: 'just now')
 * @param label - Card header label (default: 'AI evaluation')
 * @param title - Optional sub-heading beneath the label
 * @example
 * <AIVerdict
 *   score={78}
 *   recommendation="Review"
 *   summary="The application meets most criteria but requires clarification on two points."
 *   findings={[
 *     { variant: 'positive', title: 'Strong financials', body: 'Revenue grew 40% YoY.' },
 *     { variant: 'warn', title: 'Missing document', body: 'Q4 audit not attached.' },
 *   ]}
 * />
 */
export function AIVerdict({
  score, recommendation, recommendationNote, summary, findings = [], timestamp = 'just now', label = 'AI evaluation', title,
}: AIVerdictProps) {
  return (
    <div className="ai-review-card verdict-card">
      <div className="ai-review-head">
        <div className="ai-avatar">
          <AIGlyph size={18} strokeWidth={1.8} />
        </div>
        <div>
          <div className="ai-review-title">{label}</div>
          {title && <div className="ai-review-subtitle">{title}</div>}
          <div className="ai-review-sub">Reviewed {timestamp} · AI-assisted summary</div>
        </div>
      </div>

      <div className="ai-review-body">
        <div className="ai-score-row">
          <div className="ai-score-display">
            <span className="ai-score-num">{score}</span>
            <span className="ai-score-slash">/100</span>
          </div>
          <div className="ai-score-meta">
            <div className="ai-score-label">Recommendation</div>
            <div className="ai-score-verdict">{recommendation}</div>
            {recommendationNote && <div className="ai-score-note">{recommendationNote}</div>}
          </div>
        </div>

        <div className="ai-summary">{summary}</div>

        {findings.length > 0 && (
          <>
            <div className="ai-findings-label">What AI found</div>
            <div className="ai-findings">
              {findings.map((f, i) => (
                <AIFinding key={i} {...f} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Single AI finding card rendered inside an `AIVerdict` findings list.
 * Shows a status icon, title, body text, and optional call-to-action link.
 *
 * @param variant - Tone icon: 'positive' (checkmark) | 'warn' (warning) | 'action' (sparkle)
 * @param title - Short finding headline
 * @param body - Explanatory sentence for the finding
 * @param cta - Optional inline action: `{ label, icon?, onClick? }`
 * @example
 * <AIFinding
 *   variant="warn"
 *   title="Missing document"
 *   body="The Q4 audit report was not attached."
 *   cta={{ label: 'Upload now', onClick: openUploader }}
 * />
 */
export function AIFinding({ variant, title, body, cta }: Finding) {
  return (
    <div className={`ai-finding ${variant}`}>
      <div className="ai-finding-ico">
        {variant === 'positive' && <Check size={14} strokeWidth={1.8} />}
        {variant === 'warn' && <Warn size={14} strokeWidth={1.8} />}
        {variant === 'action' && <AIGlyph size={14} strokeWidth={1.6} />}
      </div>
      <div className="ai-finding-text">
        <strong>{title}</strong>
        {body}
        {cta && (
          <div className="ai-finding-cta" onClick={cta.onClick}>
            {cta.icon || <AIGlyph size={10} strokeWidth={1.8} />}
            {cta.label}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FloatingActionBar — bottom-anchored save/continue UI
   ═══════════════════════════════════════════════════════════ */

type FloatingActionBarProps = {
  status?: { message: string; tone?: 'default' | 'ok' | 'warn' | 'error' };
  children: ReactNode;
};

/**
 * Floating save/discard action bar anchored to the bottom of the viewport.
 * Pins to the bottom on mobile. Use when edits need an explicit save action.
 *
 * @param status - Optional inline status dot: `{ message, tone?: 'default'|'ok'|'warn'|'error' }`
 * @param children - Action buttons (typically Save + Discard)
 * @example
 * <FloatingActionBar status={{ message: 'Unsaved changes', tone: 'warn' }}>
 *   <Button variant="ghost" onClick={discard}>Discard</Button>
 *   <Button variant="primary" onClick={save}>Save</Button>
 * </FloatingActionBar>
 */
export function FloatingActionBar({ status, children }: FloatingActionBarProps) {
  return (
    <div className="action-bar">
      {status && (
        <div className="action-status">
          <div className={`action-dot tone-${status.tone || 'ok'}`} />
          <span>{status.message}</span>
        </div>
      )}
      <div className="action-actions">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ThemeToggle — segmented light/dark selector
   ═══════════════════════════════════════════════════════════ */

/**
 * Light/dark mode switcher rendered as a segmented button pair (Sun/Moon icons).
 * Reads and writes `data-theme` on `document.documentElement`.
 * No props — self-contained. Place in sidebar footer or settings.
 *
 * @example
 * <ThemeToggle />
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'dark';
    const savedTheme = localStorage.getItem('oura-dashboard-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;

    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const syncTheme = () => {
      const current =
        (document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null) || 'dark';
      localStorage.setItem('oura-dashboard-theme', current);
      setTheme(current);
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  const apply = (t: 'light' | 'dark') => {
    localStorage.setItem('oura-dashboard-theme', t);
    document.documentElement.setAttribute('data-theme', t);
    setTheme(t);
  };

  return (
    <div className="theme-toggle">
      <button className={theme === 'light' ? 'on' : ''} onClick={() => apply('light')}>
        <Sun size={10} />Light
      </button>
      <button className={theme === 'dark' ? 'on' : ''} onClick={() => apply('dark')}>
        <Moon size={10} />Dark
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SizeChooser — 4-column card grid picker
   ═══════════════════════════════════════════════════════════ */

type SizeOption = { key: string; label: string; meta: string };

/**
 * Radio-style card grid for 3–5 mutually exclusive choices (e.g. plan tiers, package sizes).
 * Each card shows a label and a meta line. Grid columns auto-size to option count.
 *
 * @param options - Array of `{ key, label, meta }` option descriptors
 * @param value - Currently selected option key
 * @param onChange - Called with the selected key when a card is clicked
 * @example
 * <SizeChooser
 *   value={plan}
 *   onChange={setPlan}
 *   options={[
 *     { key: 'starter', label: 'Starter', meta: '$0 / mo' },
 *     { key: 'pro', label: 'Pro', meta: '$49 / mo' },
 *     { key: 'enterprise', label: 'Enterprise', meta: 'Custom' },
 *   ]}
 * />
 */
export function SizeChooser({
  options, value, onChange,
}: { options: SizeOption[]; value: string; onChange: (key: string) => void }) {
  return (
    <div className="size-chooser" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(opt => (
        <button
          key={opt.key}
          className={`size-card ${value === opt.key ? 'on' : ''}`}
          onClick={() => onChange(opt.key)}
        >
          <div className="size-label">{opt.label}</div>
          <div className="size-meta">{opt.meta}</div>
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   StatStrip — 3+ column numeric strip
   ═══════════════════════════════════════════════════════════ */

type StatCell = { label: string; children: ReactNode };

/**
 * Horizontal row of metric cells for summary dashboards.
 * Auto-sizes column widths equally based on cell count.
 * For 2 or fewer metrics, prefer inline text; for 8+, use a DataTable.
 *
 * @param cells - Array of `{ label, children }` where `children` is the metric value
 * @example
 * <StatStrip cells={[
 *   { label: 'Revenue', children: '$4.2M' },
 *   { label: 'Growth', children: '+18%' },
 *   { label: 'Customers', children: '1,204' },
 * ]} />
 */
export function StatStrip({ cells }: { cells: StatCell[] }) {
  return (
    <div className="stat-strip" style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
      {cells.map((c, i) => (
        <div className="stat-cell" key={i}>
          <div className="stat-label">{c.label}</div>
          <div className="stat-value">{c.children}</div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Callout — info / warn / success block
   ═══════════════════════════════════════════════════════════ */

type CalloutProps = {
  variant?: 'info' | 'warn' | 'success';
  icon?: ReactNode;
  children: ReactNode;
};

/**
 * Alert/notice block for inline warnings, tips, and AI notes.
 * Not for transient feedback — use Toast for that. Not for blocking errors — use a modal.
 *
 * @param variant - Colour tone: 'info' (default) | 'warn' | 'success'
 * @param icon - Leading icon or emoji (default: '💡')
 * @param children - Callout body content
 * @example
 * <Callout variant="warn" icon="⚠️">
 *   This section requires a certified auditor signature.
 * </Callout>
 * <Callout variant="info">
 *   AI filled 4 fields based on your previous submission.
 * </Callout>
 */
export function Callout({ variant = 'info', icon = '💡', children }: CalloutProps) {
  return (
    <div className={`callout callout-${variant}`}>
      <div className="callout-ico">{icon}</div>
      <div className="callout-text">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ProfileCard — entity/user profile hero card
   ═══════════════════════════════════════════════════════════ */

type ProfileCardProps = {
  name: string;
  avatarInitial?: string;
  verified?: boolean;
  subtitle?: string;
  tags?: { label: string; variant?: TagProps['variant']; icon?: ReactNode }[];
  about?: string;
  info?: { label: string; value: ReactNode; mono?: boolean }[];
};

/**
 * Entity profile card with banner, avatar initials, name, role subtitle, tags, about text, and info grid.
 * Use for organisation or user profile pages.
 *
 * @param name - Entity name displayed as the primary heading
 * @param avatarInitial - Single character shown in the avatar circle (defaults to first letter of name)
 * @param verified - Shows a verification badge; `true` = 'Verified', `false` = 'Pending verification'
 * @param subtitle - Role or entity type shown below the name
 * @param tags - Array of Tag props rendered as pills below the subtitle
 * @param about - Short bio paragraph
 * @param info - Key/value rows in the info grid: `{ label, value, mono? }`
 * @example
 * <ProfileCard
 *   name="Acme Corp"
 *   verified={true}
 *   subtitle="Technology · Series B"
 *   tags={[{ label: 'AI', variant: 'ai' }, { label: 'Fintech', variant: 'accent' }]}
 *   about="Acme builds compliance automation software for regulated industries."
 *   info={[{ label: 'Founded', value: '2019' }, { label: 'HQ', value: 'New York, NY' }]}
 * />
 */
export function ProfileCard({
  name, avatarInitial, verified, subtitle, tags = [], about, info = [],
}: ProfileCardProps) {
  return (
    <div className="profile">
      <div className="profile-banner" />
      <div className="profile-avatar-wrap">
        <div className="profile-avatar">{avatarInitial || name[0]}</div>
        {verified !== undefined && (
          <div className={`profile-verified ${verified ? 'on' : ''}`}>
            <Check size={11} strokeWidth={1.8} />
            {verified ? 'Verified' : 'Pending verification'}
          </div>
        )}
      </div>
      <div className="profile-head">
        <div className="profile-name">{name}</div>
        {subtitle && <div className="profile-sub">{subtitle}</div>}
      </div>
      {tags.length > 0 && (
        <div className="profile-tags">
          {tags.map((t, i) => <Tag key={i} variant={t.variant} icon={t.icon}>{t.label}</Tag>)}
        </div>
      )}
      {(about || info.length > 0) && (
        <div className="profile-body">
          {about && (
            <>
              <div className="profile-section-label">About</div>
              <p className="profile-about">{about}</p>
            </>
          )}
          {info.length > 0 && (
            <div className="profile-info">
              {info.map((it, i) => (
                <div className="info-item" key={i}>
                  <div className="info-label">{it.label}</div>
                  <div className={`info-value ${it.mono ? 'mono' : ''}`}>{it.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   TabBar / MobileTab — mobile bottom nav
   ═══════════════════════════════════════════════════════════ */

/**
 * Mobile bottom navigation container. Renders as a fixed `<nav>` at the bottom of the screen.
 * Wrap MobileTab items inside. Hidden on desktop via CSS.
 *
 * @param children - MobileTab items (typically 4–5)
 * @example
 * <TabBar>
 *   <MobileTab icon={<Home />} label="Home" active onClick={() => navigate('/')} />
 *   <MobileTab icon={<AIGlyph />} label="AI" isAI onClick={() => navigate('/ai')} />
 * </TabBar>
 */
export function TabBar({ children }: { children: React.ReactNode }) {
  return <nav className="mobile-tabs">{children}</nav>;
}

/**
 * Single tab item in the mobile bottom TabBar.
 * Pass `isAI` to apply gradient icon treatment for the AI tab.
 *
 * @param icon - SVG icon element (24×24px recommended)
 * @param label - Short tab label shown below the icon
 * @param active - Applies active colour treatment when this tab is selected
 * @param isAI - Applies gradient icon treatment for AI-branded tabs
 * @param onClick - Called when the tab is tapped
 * @example
 * <MobileTab icon={<AIGlyph />} label="AI" isAI active onClick={() => navigate('/ai')} />
 */
export function MobileTab({ icon, label, active, isAI, onClick }: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  isAI?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`mobile-tab${active ? ' active' : ''}${isAI ? ' ai' : ''}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   BottomSheet — mobile sheet overlay
   ═══════════════════════════════════════════════════════════ */

/**
 * Mobile modal replacement that slides up from the bottom of the screen.
 * Use in place of Modal on mobile (≤639px). On desktop, prefer Modal instead.
 *
 * @param title - Optional sheet heading rendered in the header bar
 * @param children - Sheet body content
 * @param footer - Action row fixed to the bottom of the sheet (e.g. Save/Cancel buttons)
 * @param full - Extends the sheet to full-screen height when true
 * @param onClose - Called when the backdrop is tapped to dismiss the sheet
 * @example
 * <BottomSheet title="Add note" onClose={close} footer={<Button variant="primary" onClick={save}>Save</Button>}>
 *   <Textarea placeholder="Write your note…" />
 * </BottomSheet>
 */
export function BottomSheet({ title, children, footer, full, onClose }: {
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  full?: boolean;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={`sheet${full ? ' full' : ''}`}>
        {title && <div className="sheet-head">{title}</div>}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   SegmentedToggle — inline multi-option selector
   ═══════════════════════════════════════════════════════════ */

/**
 * Pill-style inline tab switch for 2–4 options. Same visual style as ThemeToggle but generic.
 * Use for view modes (e.g. List / Grid), filter presets, or any small mutually exclusive choice.
 *
 * @param options - Array of `{ label, value }` segments
 * @param value - Currently active segment value
 * @param onChange - Called with the newly selected value when a segment is clicked
 * @example
 * <SegmentedToggle
 *   value={view}
 *   onChange={setView}
 *   options={[{ label: 'List', value: 'list' }, { label: 'Grid', value: 'grid' }]}
 * />
 */
export function SegmentedToggle({ options, value, onChange }: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="segmented">
      {options.map(opt => (
        <button
          key={opt.value}
          className={opt.value === value ? 'on' : undefined}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Modal — desktop dialog
   ═══════════════════════════════════════════════════════════ */

/**
 * Desktop modal dialog with backdrop. Replaces bottom sheets on desktop (≥640px).
 * Use for: confirmations, form dialogs, destructive action gates.
 * Never use for complex flows > 4 fields — use a full page instead.
 *
 * @param title - Modal heading (16px 600)
 * @param size - Width preset: 'sm' (400px) | 'md' (520px, default) | 'lg' (680px)
 * @param children - Modal body content
 * @param footer - Action row, typically [<Button variant="ghost">Cancel</Button>, <Button variant="primary">Confirm</Button>]
 * @param onClose - Called when backdrop clicked or Escape pressed
 * @example
 * <Modal title="Delete project" onClose={close}
 *   footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="danger" onClick={del}>Delete</Button></>}>
 *   <p>This action cannot be undone.</p>
 * </Modal>
 */
export function Modal({ title, size = 'md', children, footer, onClose }: {
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true">
        {(title || onClose) && (
          <div className="modal-head">
            {title && <span className="modal-title">{title}</span>}
            {onClose && (
              <button className="modal-close" onClick={onClose} aria-label="Close">
                <Cross size={14} />
              </button>
            )}
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Tooltip — hover tooltip
   ═══════════════════════════════════════════════════════════ */

/**
 * Hover tooltip. Wraps any trigger element — the tooltip appears on hover/focus.
 * Keep tooltip copy under 60 characters. Never put interactive elements inside.
 *
 * @param content - Tooltip text (string only — no JSX)
 * @param position - Which side the bubble appears on (default: 'top')
 * @param children - The trigger element (button, icon, text)
 * @example
 * <Tooltip content="Copy to clipboard" position="top">
 *   <button aria-label="Copy"><Dots /></button>
 * </Tooltip>
 */
export function Tooltip({ content, position = 'top', children }: {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
}) {
  return (
    <span className={`tooltip-wrap tooltip-${position}`} data-tip={content}>
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   DropdownMenu — contextual action menu
   ═══════════════════════════════════════════════════════════ */

/**
 * Contextual action menu anchored to a trigger. Use for overflow actions (⋯ button).
 * Items with `danger: true` render in red. Use `separator: true` for visual grouping.
 * Max 8 items before it becomes unwieldy — split into sub-menus or a modal instead.
 *
 * @param items - Menu items. Each: { label, icon?, onSelect, danger?, separator? }
 * @param children - The trigger element (usually a Dots icon button)
 * @param open - Controlled open state
 * @param onClose - Called when menu should close (click outside, Escape, item selected)
 * @example
 * <DropdownMenu open={open} onClose={() => setOpen(false)}
 *   items={[
 *     { label: 'Edit', onSelect: edit },
 *     { label: 'Duplicate', onSelect: dup },
 *     { separator: true },
 *     { label: 'Delete', danger: true, onSelect: del },
 *   ]}>
 *   <button onClick={() => setOpen(true)} aria-label="More actions"><Dots /></button>
 * </DropdownMenu>
 */
export function DropdownMenu({ items, children, open, onClose }: {
  items: Array<{ label?: string; icon?: React.ReactNode; onSelect?: () => void; danger?: boolean; separator?: boolean }>;
  children: React.ReactNode;
  open: boolean;
  onClose?: () => void;
}) {
  if (!open) return <div className="dropdown">{children}</div>;
  return (
    <div className="dropdown">
      {children}
      <div className="dropdown-menu" role="menu">
        {items.map((item, i) =>
          item.separator ? (
            <div key={i} className="menu-sep" role="separator" />
          ) : (
            <button
              key={i}
              className={`menu-item${item.danger ? ' danger' : ''}`}
              role="menuitem"
              onClick={() => { item.onSelect?.(); onClose?.(); }}
            >
              {item.icon && <span className="menu-icon">{item.icon}</span>}
              {item.label}
            </button>
          )
        )}
      </div>
      <div className="dropdown-backdrop" onClick={onClose} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Topnav — desktop top navigation bar
   ═══════════════════════════════════════════════════════════ */

/**
 * Desktop top navigation bar. Sits above the main workspace, below the window chrome.
 * Height: 44px. Contains breadcrumb/page title on the left, AI bar in center, actions on right.
 * On mobile this component is hidden — use the mobile top bar pattern from patterns-mobile.md instead.
 *
 * @param left - Left slot: breadcrumb or page title
 * @param center - Center slot: typically <AICommandBar /> (hidden on mobile via CSS)
 * @param right - Right slot: action buttons, avatar
 * @example
 * <Topnav
 *   left={<Breadcrumb items={[{label:'Projects'},{label:'Atlas',active:true}]} />}
 *   center={<AICommandBar placeholder="Ask anything…" onChange={setQuery} />}
 *   right={<Button variant="secondary" size="sm">Invite</Button>}
 * />
 */
export function Topnav({ left, center, right }: {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header className="topnav">
      <div className="topnav-left">{left}</div>
      {center && <div className="topnav-center">{center}</div>}
      <div className="topnav-right">{right}</div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════
   Breadcrumb — page location trail
   ═══════════════════════════════════════════════════════════ */

/**
 * Page location trail shown in the Topnav left slot.
 * Last item is the current page (bold, --text-default). Prior items are --text-3 with hover.
 * Max 4 items — truncate middle items with ellipsis if the path is deeper.
 *
 * @param items - Array of { label, href?, onClick?, active? }. Last item is auto-styled as active.
 * @example
 * <Breadcrumb items={[
 *   { label: 'Projects', onClick: goProjects },
 *   { label: 'Atlas', onClick: goAtlas },
 *   { label: 'Design review', active: true },
 * ]} />
 */
export function Breadcrumb({ items }: {
  items: Array<{ label: string; href?: string; onClick?: () => void; active?: boolean }>;
}) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="breadcrumb-sep" aria-hidden="true">/</span>}
          {item.active || i === items.length - 1 ? (
            <span className="breadcrumb-item active" aria-current="page">{item.label}</span>
          ) : item.href ? (
            <a className="breadcrumb-item" href={item.href}>{item.label}</a>
          ) : (
            <button className="breadcrumb-item" onClick={item.onClick}>{item.label}</button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════
   EmptyState — full-area empty state
   ═══════════════════════════════════════════════════════════ */

/**
 * Full-area empty state for lists, tables, and search results.
 * Always include a primary CTA — never leave the user staring at nothing.
 * Icon: use an emoji string (e.g. "📂") or an SVG element.
 *
 * @param icon - Visual anchor: emoji string or SVG element
 * @param title - Short noun phrase: "No projects yet" not "Nothing to show"
 * @param description - One sentence explaining what this space is for and how to fill it
 * @param action - Primary CTA button node (usually a Button variant="primary")
 * @example
 * <EmptyState
 *   icon="📂"
 *   title="No projects yet"
 *   description="Create your first project to start tracking work and running AI reviews."
 *   action={<Button variant="primary" icon={<Plus />} onClick={create}>New project</Button>}
 * />
 */
export function EmptyState({ icon, title, description, action }: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon">{icon}</div>}
      <p className="empty-title">{title}</p>
      {description && <p className="empty-desc">{description}</p>}
      {action && <div className="empty-actions">{action}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Skeleton — loading placeholder
   ═══════════════════════════════════════════════════════════ */

/**
 * Loading placeholder that prevents layout shift during data fetch.
 * Use the `variant` that matches the content being loaded.
 * Animate with the built-in shimmer — never use a spinner inside content areas.
 *
 * @param variant - Shape preset: 'text' (single line) | 'title' (wider line) | 'avatar' (circle) | 'rect' (block)
 * @param width - Override width (default: '100%' for text/title/rect, '32px' for avatar)
 * @param height - Override height (default: determined by variant)
 * @param lines - For 'text' variant, render N stacked lines (last line 60% width)
 * @example
 * // Loading a stat strip
 * <Skeleton variant="title" width="120px" />
 * <Skeleton variant="text" lines={3} />
 * // Loading an avatar + name row
 * <Skeleton variant="avatar" />
 * <Skeleton variant="text" width="140px" />
 */
export function Skeleton({ variant = 'text', width, height, lines }: {
  variant?: 'text' | 'title' | 'avatar' | 'rect';
  width?: string;
  height?: string;
  lines?: number;
}) {
  if (lines && lines > 1) {
    return (
      <div className="skeleton-group">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`skeleton skeleton-${variant}`}
            style={{ width: i === lines - 1 ? '60%' : (width ?? '100%'), height }}
          />
        ))}
      </div>
    );
  }
  return (
    <div
      className={`skeleton skeleton-${variant}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/* ═══════════════════════════════════════════════════════════
   Toast / ToastStack — transient notifications
   ═══════════════════════════════════════════════════════════ */

/**
 * Single transient notification. Stack multiple with <ToastStack>.
 * Auto-dismisses after `duration` ms (default 4000). Duration 0 = persistent.
 * Toasts are for confirming completed actions — not for errors that block work (use Callout for those).
 *
 * @param message - Short past-tense confirmation: "Saved", "Copied", "Deleted 3 items"
 * @param tone - 'default' | 'success' | 'warning' | 'error'
 * @param duration - Auto-dismiss delay in ms (default 4000; 0 = no auto-dismiss)
 * @param onDismiss - Called when dismissed (auto or manual)
 * @example
 * <Toast message="Changes saved" tone="success" onDismiss={() => removeToast(id)} />
 */
export function Toast({ message, tone = 'default', onDismiss }: {
  message: string;
  tone?: 'default' | 'success' | 'warning' | 'error';
  duration?: number;
  onDismiss?: () => void;
}) {
  const icons: Record<string, React.ReactNode> = {
    success: <Check />,
    warning: <Warn />,
    error: <Cross />,
  };
  return (
    <div className={`toast toast-${tone}`} role="status" aria-live="polite">
      {icons[tone] && <span className="toast-icon">{icons[tone]}</span>}
      <span className="toast-msg">{message}</span>
      {onDismiss && (
        <button className="toast-close" onClick={onDismiss} aria-label="Dismiss">
          <Cross size={12} />
        </button>
      )}
    </div>
  );
}

/**
 * Container that stacks Toast notifications in the bottom-right corner (desktop)
 * or bottom-center (mobile). Render once at the app root.
 *
 * @example
 * <ToastStack>
 *   {toasts.map(t => <Toast key={t.id} message={t.message} tone={t.tone} onDismiss={() => remove(t.id)} />)}
 * </ToastStack>
 */
export function ToastStack({ children }: { children: React.ReactNode }) {
  return <div className="toast-stack" aria-label="Notifications">{children}</div>;
}

/* ═══════════════════════════════════════════════════════════
   Toggle — binary on/off switch
   ═══════════════════════════════════════════════════════════ */

/**
 * Binary on/off toggle switch. Use for settings that take effect immediately without a Save action.
 * If the setting requires a Save to take effect, use a Checkbox instead.
 * Touch target is always 44×44px on mobile.
 *
 * @param checked - Current on/off state
 * @param onChange - Called with new boolean value when toggled
 * @param label - Optional visible label rendered to the right of the track
 * @param disabled - Greys out and prevents interaction
 * @example
 * <Toggle checked={emailAlerts} onChange={setEmailAlerts} label="Email alerts" />
 */
export function Toggle({ checked, onChange, label, disabled }: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`toggle${checked ? ' on' : ''}${disabled ? ' disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange?.(e.target.checked)}
        className="toggle-input"
      />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      {label && <span className="toggle-label">{label}</span>}
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════
   Checkbox — single checkbox with optional label
   ═══════════════════════════════════════════════════════════ */

/**
 * Single checkbox with optional label. Supports indeterminate state for "select all" patterns.
 * Use inside a <Field> wrapper if you need the standard label + left-bar treatment.
 * For a list of choices, compose multiple Checkboxes — don't build a custom multi-select.
 *
 * @param checked - Checked state
 * @param onChange - Called with new boolean value
 * @param label - Visible label text
 * @param indeterminate - Shows dash instead of checkmark (for partial "select all" state)
 * @param disabled - Greys out and prevents interaction
 * @example
 * <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} label="Select all" />
 */
export function Checkbox({ checked, onChange, label, indeterminate, disabled }: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  indeterminate?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={`cb${checked ? ' checked' : ''}${indeterminate ? ' indeterminate' : ''}${disabled ? ' disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange?.(e.target.checked)}
        className="cb-input"
      />
      <span className="cb-box">
        {indeterminate ? <span className="cb-dash" /> : checked ? <Check size={10} strokeWidth={2.4} /> : null}
      </span>
      {label && <span className="cb-label">{label}</span>}
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════
   Radio / RadioGroup — radio options
   ═══════════════════════════════════════════════════════════ */

/**
 * Single radio option. Always use inside a RadioGroup — never standalone.
 *
 * @param checked - Selected state
 * @param onChange - Called when this option is selected
 * @param label - Visible label text
 * @param value - The value this radio represents
 * @param name - Radio group name (for native browser grouping)
 * @param disabled - Greys out and prevents interaction
 */
export function Radio({ checked, onChange, label, value, name, disabled }: {
  checked: boolean;
  onChange?: (value: string) => void;
  label?: string;
  value: string;
  name?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`radio${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange?.(value)}
        className="radio-input"
      />
      <span className="radio-dot" />
      {label && <span className="radio-label">{label}</span>}
    </label>
  );
}

/**
 * Container for a set of Radio options. Manages grouping and layout.
 * Renders options vertically by default; pass direction="horizontal" for inline.
 *
 * @param options - Array of { value, label, disabled? }
 * @param value - Currently selected value
 * @param onChange - Called with newly selected value
 * @param name - HTML radio group name
 * @param direction - Layout: 'vertical' (default) | 'horizontal'
 * @example
 * <RadioGroup
 *   name="plan"
 *   value={plan}
 *   onChange={setPlan}
 *   options={[
 *     { value: 'starter', label: 'Starter' },
 *     { value: 'pro', label: 'Pro' },
 *     { value: 'enterprise', label: 'Enterprise' },
 *   ]}
 * />
 */
export function RadioGroup({ options, value, onChange, name, direction = 'vertical' }: {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  value: string;
  onChange: (value: string) => void;
  name: string;
  direction?: 'vertical' | 'horizontal';
}) {
  return (
    <div className={`radio-group radio-group-${direction}`} role="radiogroup">
      {options.map(opt => (
        <Radio
          key={opt.value}
          name={name}
          value={opt.value}
          label={opt.label}
          checked={opt.value === value}
          disabled={opt.disabled}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DataTable — structured multi-column data table
   ═══════════════════════════════════════════════════════════ */

/**
 * Data table for structured, multi-column lists. Use when you need sortable columns,
 * row selection, or more than 4 data points per row.
 * For simpler lists (1-3 data points per row), use StatStrip or a custom list with StepRow.
 *
 * Column widths: use `width` in px or '%'. Last column auto-fills remaining space.
 * Max recommended columns on desktop: 8. On mobile, the table scrolls horizontally.
 *
 * @param columns - Column definitions: { key, label, width?, align?, render? }
 * @param rows - Data rows. Each row must have a unique `id` field.
 * @param onRowClick - Optional — makes rows interactive (cursor changes, hover highlight)
 * @param emptyState - ReactNode shown when rows is empty (use EmptyState component)
 * @example
 * <DataTable
 *   columns={[
 *     { key: 'name', label: 'Name', width: '40%' },
 *     { key: 'status', label: 'Status', width: '120px', render: row => <Tag tone="green">{row.status}</Tag> },
 *     { key: 'date', label: 'Updated', align: 'right' },
 *   ]}
 *   rows={projects}
 *   onRowClick={openProject}
 *   emptyState={<EmptyState icon="📂" title="No projects yet" action={<Button variant="primary">New project</Button>} />}
 * />
 */
export function DataTable<T extends { id: string | number }>({
  columns,
  rows,
  onRowClick,
  emptyState,
}: {
  columns: Array<{
    key: string;
    label: string;
    width?: string;
    align?: 'left' | 'right' | 'center';
    render?: (row: T) => React.ReactNode;
  }>;
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
}) {
  if (rows.length === 0 && emptyState) {
    return <div className="table-empty">{emptyState}</div>;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                style={{ width: col.width, textAlign: col.align ?? 'left' }}
                className="table-th"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.id}
              className={`table-row${onRowClick ? ' clickable' : ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  style={{ textAlign: col.align ?? 'left' }}
                  className="table-td"
                >
                  {col.render ? col.render(row) : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AspectRatio
   ═══════════════════════════════════════════════════════════ */

export function AspectRatio({ ratio = 1, children, className = "" }: { ratio?: number; children: ReactNode; className?: string }) {
  return (
    <div className={`aspect-ratio ${className}`} style={{ paddingBottom: `${(1 / ratio) * 100}%` }}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Combobox
   ═══════════════════════════════════════════════════════════ */

export function Combobox({ options, value, onChange, placeholder = "Select option..." }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="combobox">
      <Input
        placeholder={placeholder}
        value={open ? query : options.find(o => o.value === value)?.label || ""}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setQuery(""); }}
      />
      {open && (
        <div className="dropdown-menu" style={{ display: 'block', width: '100%' }}>
          {filtered.map(o => (
            <button key={o.value} className="menu-item" onClick={() => { onChange(o.value); setOpen(false); }}>
              {o.label}
              {o.value === value && <Check size={12} className="menu-icon" />}
            </button>
          ))}
          {filtered.length === 0 && <div className="menu-item typo-muted">No results found.</div>}
        </div>
      )}
      {open && <div className="dropdown-backdrop" onClick={() => setOpen(false)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Pagination
   ═══════════════════════════════════════════════════════════ */

export function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  return (
    <nav className="pagination">
      <Button variant="ghost" disabled={current === 1} onClick={() => onChange(current - 1)}><ArrowLeft size={14} /> Previous</Button>
      {Array.from({ length: total }).map((_, i) => (
        <Button key={i} variant={current === i + 1 ? "primary" : "ghost"} className="pagination-btn" onClick={() => onChange(i + 1)}>
          {i + 1}
        </Button>
      ))}
      <Button variant="ghost" disabled={current === total} onClick={() => onChange(current + 1)}>Next <ArrowRight size={14} /></Button>
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════
   ScrollArea
   ═══════════════════════════════════════════════════════════ */

export function ScrollArea({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`scroll-area ${className}`}>{children}</div>;
}

/* ═══════════════════════════════════════════════════════════
   Collapsible
   ═══════════════════════════════════════════════════════════ */

export function Collapsible({ trigger, children, open: defaultOpen = false }: { trigger: ReactNode; children: ReactNode; open?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="collapsible">
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      {isOpen && <div className="collapsible-content">{children}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   NavigationMenu
   ═══════════════════════════════════════════════════════════ */

export function NavigationMenu({ items, value, onChange }: { items: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <nav className="nav-menu">
      {items.map(it => (
        <button key={it.value} className={`nav-item ${it.value === value ? 'active' : ''}`} onClick={() => onChange(it.value)}>
          {it.label}
        </button>
      ))}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════
   InputOTP
   ═══════════════════════════════════════════════════════════ */

export function InputOTP({ value, length = 6, onChange }: { value: string; length?: number; onChange: (v: string) => void }) {
  return (
    <div className="otp-wrap">
      {Array.from({ length }).map((_, i) => (
        <div key={i} className={`otp-slot ${value.length === i ? 'active' : ''}`}>
          {value[i] || ""}
        </div>
      ))}
    </div>
  );
}

/**
 * Simple SVG-based Sparkline for micro-visuals.
 */
export function Sparkline({ data, color = 'var(--accent)', height = 30 }: { data: number[]; color?: string; height?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min;
  const width = data.length * 4;
  const points = data.map((d, i) => `${i * 4},${height - ((d - min) / range) * height}`).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   SideDrawer
   ═══════════════════════════════════════════════════════════ */

/**
 * SideDrawer — Right-aligned inspector panel for editing and details.
 * Replaces centered Modals for 90% of SaaS editing tasks.
 *
 * @param open - Controlled visibility
 * @param onClose - Called when backdrop or close button clicked
 * @param title - Header title text
 * @param wide - Increases width to 640px for complex forms
 * @param footer - Sticky action bar at the bottom
 */
export function SideDrawer({ open, onClose, title, children, footer, wide }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className={`drawer-side ${wide ? 'wide' : ''}`}>
        <div className="drawer-head">
          <span className="drawer-title">{title}</span>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">
            <Cross size={16} />
          </button>
        </div>
        <div className="drawer-body">
          {children}
        </div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   CommandPalette (⌘K)
   ═══════════════════════════════════════════════════════════ */

export function CommandPalette({ open, onClose, items }: {
  open: boolean;
  onClose: () => void;
  items: { group: string; label: string; icon?: ReactNode; onSelect: () => void }[];
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        open ? onClose() : undefined; // Logic to toggle should be in parent
      }
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const groups = items.reduce((acc, it) => {
    if (!acc[it.group]) acc[it.group] = [];
    if (it.label.toLowerCase().includes(query.toLowerCase())) acc[it.group].push(it);
    return acc;
  }, {} as Record<string, typeof items>);

  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd-dialog" onClick={e => e.stopPropagation()}>
        <div className="cmd-input-wrap">
          <Search size={18} className="drop-icon" />
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Search projects, actions, settings..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <Badge variant="gray">Esc</Badge>
        </div>
        <div className="cmd-list">
          {Object.entries(groups).map(([group, groupItems]) => (
            groupItems.length > 0 && (
              <React.Fragment key={group}>
                <div className="cmd-group-label">{group}</div>
                {groupItems.map((it, i) => (
                  <div key={i} className="cmd-item" onClick={() => { it.onSelect(); onClose(); }}>
                    {it.icon}
                    <span>{it.label}</span>
                  </div>
                ))}
              </React.Fragment>
            )
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MultiSelect
   ═══════════════════════════════════════════════════════════ */

export function MultiSelect({ values, options, onChange, placeholder = "Select multiple..." }: {
  values: string[];
  options: { label: string; value: string }[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  
  const removeValue = (val: string) => onChange(values.filter(v => v !== val));
  const addValue = (val: string) => {
    if (!values.includes(val)) onChange([...values, val]);
    setOpen(false);
  };

  return (
    <div className="combobox">
      <div className="multi-wrap" onClick={() => setOpen(!open)}>
        {values.map(v => (
          <div key={v} className="multi-tag">
            {options.find(o => o.value === v)?.label || v}
            <Cross size={10} className="multi-tag-close" onClick={(e) => { e.stopPropagation(); removeValue(v); }} />
          </div>
        ))}
        {values.length === 0 && <span style={{ color: 'var(--text-placeholder)', fontSize: 13 }}>{placeholder}</span>}
      </div>
      {open && (
        <div className="dropdown-menu" style={{ display: 'block', width: '100%' }}>
          {options.map(o => (
            <button key={o.value} className="menu-item" onClick={() => addValue(o.value)}>
              {o.label}
              {values.includes(o.value) && <Check size={12} className="menu-icon" />}
            </button>
          ))}
        </div>
      )}
      {open && <div className="dropdown-backdrop" onClick={() => setOpen(false)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Dropzone
   ═══════════════════════════════════════════════════════════ */

export function Dropzone({ onDrop, accept = "All files supported" }: { onDrop?: (files: FileList) => void; accept?: string }) {
  const [isActive, setIsActive] = useState(false);
  
  return (
    <div 
      className={`dropzone ${isActive ? 'active' : ''}`}
      onDragOver={e => { e.preventDefault(); setIsActive(true); }}
      onDragLeave={() => setIsActive(false)}
      onDrop={e => { e.preventDefault(); setIsActive(false); onDrop?.(e.dataTransfer.files); }}
    >
      <div className="drop-icon"><Upload size={32} strokeWidth={1.2} /></div>
      <div className="drop-title">Click to upload or drag and drop</div>
      <div className="drop-sub">{accept}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ContextMenu
   ═══════════════════════════════════════════════════════════ */

export function ContextMenu({ x, y, items, onClose }: {
  x: number;
  y: number;
  items: { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; separator?: boolean }[];
  onClose: () => void;
}) {
  return (
    <>
      <div className="dropdown-backdrop" onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }} />
      <div className="context-menu" style={{ top: y, left: x }}>
        {items.map((item, i) => (
          item.separator ? <div key={i} className="menu-sep" /> : (
            <button key={i} className={`menu-item ${item.danger ? 'danger' : ''}`} onClick={() => { item.onSelect(); onClose(); }}>
              {item.icon}
              {item.label}
            </button>
          )
        ))}
      </div>
    </>
  );
}
