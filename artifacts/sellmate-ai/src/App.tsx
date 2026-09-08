import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Box,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Loader2,
  LogIn,
  Menu,
  MessageSquare,
  Package,
  Pencil,
  Plus,
  Search,
  Send,
  Settings as SettingsIcon,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  TrendingUp,
  Truck,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  getCloudState,
  isSupabaseConfigured,
  saveCloudState,
  supabase,
} from '@/lib/supabase';

type Product = { id: string; name: string; description: string; price: number; stock: number; imageUrl: string; createdAt: string };
type Customer = { id: string; name: string; phone: string; city: string; status: 'Active' | 'New' | 'At risk'; createdAt: string };
type Order = { id: string; customerId: string; productId: string; quantity: number; total: number; status: 'Delivered' | 'Processing' | 'Pending'; createdAt: string };
type StoreSettings = { storeName: string; storeDescription: string; currency: string; deliveryInformation: string; aiInstructions: string };
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };

const now = new Date().toISOString();
const seedProducts: Product[] = [
  { id: 'p1', name: 'Atlas Linen Overshirt', description: 'Relaxed linen overshirt woven in Casablanca.', price: 480, stock: 18, imageUrl: '', createdAt: now },
  { id: 'p2', name: 'Safi Ceramic Set', description: 'Hand-finished tableware from a family studio in Safi.', price: 320, stock: 7, imageUrl: '', createdAt: now },
  { id: 'p3', name: 'Rif Leather Tote', description: 'Structured everyday tote in vegetable-tanned leather.', price: 690, stock: 24, imageUrl: '', createdAt: now },
  { id: 'p4', name: 'Essaouira Candle Trio', description: 'Three warm, cedar-forward scents for slow evenings.', price: 260, stock: 3, imageUrl: '', createdAt: now },
];
const seedCustomers: Customer[] = [
  { id: 'c1', name: 'Nadia El Amrani', phone: '+212 6 61 42 08 77', city: 'Casablanca', status: 'Active', createdAt: now },
  { id: 'c2', name: 'Youssef Bennani', phone: '+212 6 72 18 40 11', city: 'Rabat', status: 'New', createdAt: now },
  { id: 'c3', name: 'Salma Idrissi', phone: '+212 6 66 90 13 45', city: 'Marrakech', status: 'Active', createdAt: now },
  { id: 'c4', name: 'Omar Tazi', phone: '+212 6 19 55 72 03', city: 'Tangier', status: 'At risk', createdAt: now },
];
const seedOrders: Order[] = [
  { id: 'SM-1048', customerId: 'c1', productId: 'p3', quantity: 1, total: 690, status: 'Delivered', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'SM-1047', customerId: 'c2', productId: 'p1', quantity: 2, total: 960, status: 'Processing', createdAt: new Date(Date.now() - 172800000).toISOString() },
  { id: 'SM-1046', customerId: 'c3', productId: 'p2', quantity: 1, total: 320, status: 'Pending', createdAt: new Date(Date.now() - 259200000).toISOString() },
  { id: 'SM-1045', customerId: 'c4', productId: 'p4', quantity: 2, total: 520, status: 'Delivered', createdAt: new Date(Date.now() - 432000000).toISOString() },
];
const seedSettings: StoreSettings = {
  storeName: 'Noura Atelier',
  storeDescription: 'Thoughtful objects and daily essentials, made close to home.',
  currency: 'MAD',
  deliveryInformation: 'Delivery across Morocco in 2–4 working days. Free delivery over 700 MAD.',
  aiInstructions: 'Be warm, concise, and confident. Mention availability and delivery details when useful.',
};
const seedMessages: ChatMessage[] = [
  { id: 'm1', role: 'assistant', content: 'Hello. I’m ready to help you turn product questions into confident replies. Ask me about a product, delivery, or a customer scenario.', createdAt: now },
];

function makeId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function readStore<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(`sellmate-${key}`); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function usePersisted<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStore(key, fallback));
  const [cloudReady, setCloudReady] = useState(!isSupabaseConfigured);
  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) return;
    void getCloudState(key, value).then(cloudValue => {
      if (!active) return;
      setValue(cloudValue);
      setCloudReady(true);
    });
    return () => { active = false; };
  }, [key]);
  useEffect(() => {
    localStorage.setItem(`sellmate-${key}`, JSON.stringify(value));
    if (cloudReady) void saveCloudState(key, value);
  }, [key, value, cloudReady]);
  return [value, setValue] as const;
}
function formatMoney(value: number, currency = 'MAD') {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value).replace(/\u00a0/g, ' ');
}
function formatDate(value: string) { return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)); }

function Logo({ dark = false }: { dark?: boolean }) {
  return <div className="flex items-center gap-2.5" data-testid="brand-sellmate"><div className={`grid size-9 place-items-center rounded-xl ${dark ? 'bg-primary text-primary-foreground' : 'bg-[#f4b942] text-[#173b47]'}`}><Sparkles className="size-4" /></div><span className={`font-display text-[17px] font-extrabold tracking-[-.04em] ${dark ? 'text-sidebar-foreground' : 'text-foreground'}`}>sellmate<span className={dark ? 'text-primary' : 'text-accent'}>.ai</span></span></div>;
}

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/orders', label: 'Orders', icon: ClipboardList },
  { href: '/assistant', label: 'AI Assistant', icon: Bot },
];

function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [settings] = usePersisted('settings', seedSettings);
  const pathname = location === '/' ? '/dashboard' : location;
  const isActive = (href: string) => pathname === href;
  const signOut = () => { void supabase?.auth.signOut(); localStorage.removeItem('sellmate-auth'); setLocation('/'); };
  return <div className="min-h-[100dvh] bg-background text-foreground">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-sidebar px-4 py-5 transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between px-2"><Logo dark /><button onClick={() => setOpen(false)} className="rounded-lg p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent lg:hidden" aria-label="Close navigation" data-testid="button-close-navigation"><X className="size-4" /></button></div>
       <div className="mt-9 flex items-center gap-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-3"><div className="grid size-9 place-items-center rounded-xl bg-[#9bd7c1] text-[#173b47]"><Store className="size-4" /></div><div className="min-w-0"><p className="truncate text-[13px] font-semibold text-sidebar-foreground" data-testid="text-store-name">{settings.storeName}</p><p className="text-[11px] text-sidebar-foreground/55">{isSupabaseConfigured ? 'Cloud workspace' : 'Demo workspace'}</p></div><ChevronRight className="ml-auto size-4 text-sidebar-foreground/45" /></div>
      <nav className="mt-8 space-y-1" aria-label="Main navigation">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${isActive(href) ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}><Icon className="size-[17px]" /><span>{label}</span>{label === 'AI Assistant' && <span className={`ml-auto rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${isActive(href) ? 'bg-sidebar-primary-foreground/15' : 'bg-sidebar-primary/20 text-sidebar-primary'}`}>AI</span>}</Link>)}</nav>
       <div className="mt-auto space-y-1"><Link href="/settings" onClick={() => setOpen(false)} data-testid="link-nav-settings" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium ${isActive('/settings') ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}><SettingsIcon className="size-[17px]" />Settings</Link><button onClick={signOut} data-testid="button-sign-out" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"><LogIn className="size-[17px] rotate-180" />Sign out</button><div className="mt-4 rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-3.5"><div className="flex items-center gap-2 text-[11px] font-semibold text-sidebar-foreground"><span className="size-2 rounded-full bg-[#9bd7c1]" />{isSupabaseConfigured ? 'Cloud sync active' : 'Demo mode active'}</div><p className="mt-1.5 text-[11px] leading-relaxed text-sidebar-foreground/50">{isSupabaseConfigured ? 'Your workspace syncs through Supabase.' : 'Your workspace is saved locally on this device.'}</p></div></div>
    </aside>
    {open && <button className="fixed inset-0 z-30 bg-[#102f38]/35 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu overlay" data-testid="button-menu-overlay" />}
    <div className="lg:pl-[248px]"><header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-md sm:px-7"><button className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu className="size-5" /></button><div className="hidden text-sm text-muted-foreground lg:block">{isActive('/dashboard') ? 'Good morning' : navItems.find(item => isActive(item.href))?.label || 'Settings'}<span className="ml-2 text-foreground/35">/</span><span className="ml-2 font-medium text-foreground">{settings.storeName}</span></div><div className="ml-auto flex items-center gap-3"><button className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm sm:flex" data-testid="button-help"><CircleHelp className="size-4" />Help center</button><div className="grid size-9 place-items-center rounded-full bg-[#d9e8df] text-xs font-bold text-[#2e6356]" data-testid="avatar-store-owner">NA</div></div></header><main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7 lg:px-9 lg:py-8">{children}</main></div>
  </div>;
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end animate-rise"><div>{eyebrow && <p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-accent">{eyebrow}</p>}<h1 className="font-display text-[28px] font-extrabold tracking-[-.045em] text-foreground sm:text-[32px]" data-testid="text-page-title">{title}</h1>{description && <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>}</div>{action}</div>;
}

function Button({ children, onClick, variant = 'primary', type = 'button', className = '', disabled = false, testId }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; type?: 'button' | 'submit'; className?: string; disabled?: boolean; testId?: string }) {
  const styles = { primary: 'bg-primary text-primary-foreground hover:brightness-95 shadow-[0_5px_14px_hsl(38_88%_54%/.18)]', secondary: 'border border-border bg-card text-foreground hover:bg-muted', ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground', danger: 'bg-destructive text-destructive-foreground hover:brightness-95' };
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}>{children}</button>;
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = { Delivered: 'bg-[#dff2e8] text-[#267251]', Processing: 'bg-[#fff0c9] text-[#9a6b00]', Pending: 'bg-[#e8edf5] text-[#536780]', Active: 'bg-[#dff2e8] text-[#267251]', New: 'bg-[#e4effb] text-[#2d6592]', 'At risk': 'bg-[#fbe5df] text-[#a24b3b]' };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status] || 'bg-muted text-muted-foreground'}`} data-testid={`status-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span>;
}

function EmptyState({ icon: Icon, title, description, action }: { icon: typeof Box; title: string; description: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-14 text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-accent"><Icon className="size-5" /></div><h3 className="mt-4 font-display text-base font-bold" data-testid="text-empty-title">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function LandingPage() {
  const [, setLocation] = useLocation();
  const enterDemo = () => { localStorage.setItem('sellmate-auth', JSON.stringify({ email: 'demo@noura.ma', name: 'Demo owner' })); setLocation('/dashboard'); };
  return <div className="min-h-[100dvh] overflow-hidden bg-[#f7f6f0] text-[#173b47]"><header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8"><Logo /><div className="flex items-center gap-2"><Link href="/login" data-testid="link-landing-login" className="hidden rounded-xl px-4 py-2.5 text-sm font-bold text-[#173b47]/70 hover:bg-[#e9ede5] sm:inline-flex">Log in</Link><Button onClick={() => setLocation('/signup')} testId="button-landing-signup">Start free <ArrowRight className="size-4" /></Button></div></header><main><section className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24"><div className="absolute -right-32 -top-28 size-[420px] rounded-full bg-[#f4b942]/20 blur-3xl" /><div className="relative grid items-center gap-14 lg:grid-cols-[1.08fr_.92fr]"><div className="animate-rise"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d6ddcf] bg-[#eff2e8] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-[#477063]"><span className="size-1.5 rounded-full bg-[#5ea485]" />The calm side of commerce</div><h1 className="max-w-2xl font-display text-[48px] font-extrabold leading-[1.04] tracking-[-.065em] sm:text-[72px]">Run your store.<br /><span className="text-[#cc8d16]">Keep your head.</span></h1><p className="mt-7 max-w-lg text-[16px] leading-7 text-[#54707a]">SellMate brings your products, customers, orders, and best next reply into one clear command center.</p><div className="mt-9 flex flex-wrap gap-3"><Button onClick={() => setLocation('/signup')} testId="button-hero-start">Create your workspace <ArrowRight className="size-4" /></Button><Button variant="secondary" onClick={enterDemo} testId="button-hero-demo">Explore the demo</Button></div><div className="mt-7 flex items-center gap-2 text-xs text-[#71858a]"><Check className="size-4 text-[#4e9a78]" /> No card required <span className="mx-1">·</span> Saved locally in demo mode</div></div><div className="relative animate-rise stagger-2"><div className="absolute -inset-5 rounded-[32px] bg-[#dce7dc]/70 blur-2xl" /><div className="relative overflow-hidden rounded-[24px] border border-[#d2ddd4] bg-[#fbfbf6] shadow-[0_28px_80px_rgba(28,69,74,.15)]"><div className="flex items-center justify-between border-b border-[#e5e8de] px-5 py-4"><div className="flex gap-1.5"><span className="size-2 rounded-full bg-[#dfc8a0]" /><span className="size-2 rounded-full bg-[#c9dfc8]" /><span className="size-2 rounded-full bg-[#d5dfe3]" /></div><span className="text-[10px] font-bold uppercase tracking-[.15em] text-[#9aaba7]">sellmate.ai / overview</span></div><div className="grid gap-5 p-5 sm:p-7"><div className="flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#7c9690]">Today at Noura Atelier</p><p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-[#173b47]">A good day to sell.</p></div><div className="grid size-10 place-items-center rounded-xl bg-[#f7df9d] text-[#9c6d12]"><TrendingUp className="size-5" /></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-[#eaf1e9] p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-[#729187]">Revenue</p><p className="mt-2 font-display text-xl font-extrabold text-[#254e4c]">2,490 MAD</p><p className="mt-1 text-[11px] font-semibold text-[#4c9c76]">+18.4% this week</p></div><div className="rounded-2xl bg-[#f8edcf] p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-[#9a824d]">Orders</p><p className="mt-2 font-display text-xl font-extrabold text-[#725c28]">12</p><p className="mt-1 text-[11px] font-semibold text-[#9a824d]">3 need attention</p></div></div><div className="rounded-2xl border border-[#e5e8de] p-4"><div className="flex items-center justify-between"><p className="text-xs font-bold text-[#315863]">Reply ready</p><span className="rounded-full bg-[#dcefe5] px-2 py-1 text-[10px] font-bold text-[#398065]">AI suggestion</span></div><p className="mt-3 text-sm leading-6 text-[#536e76]">“The Atlas Overshirt is available in your size. We deliver to Rabat in 2–4 days.”</p><div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-[#78908e]"><MessageSquare className="size-3.5" /> Based on your store settings</div></div></div></div></div></div></section><section className="border-y border-[#e4e6dc] bg-[#eef1e8]"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:grid-cols-3 sm:px-8"><div><p className="font-display text-3xl font-extrabold tracking-tight text-[#173b47]">One view.</p><p className="mt-2 text-sm leading-6 text-[#607a7d]">Know what needs your attention before you open five tabs.</p></div><div><p className="font-display text-3xl font-extrabold tracking-tight text-[#173b47]">Better replies.</p><p className="mt-2 text-sm leading-6 text-[#607a7d]">Answer product and delivery questions with context, not guesswork.</p></div><div><p className="font-display text-3xl font-extrabold tracking-tight text-[#173b47]">Your rhythm.</p><p className="mt-2 text-sm leading-6 text-[#607a7d]">A workspace that stays useful as your store gets busy.</p></div></div></section><section className="mx-auto max-w-7xl px-5 py-20 text-center sm:px-8 sm:py-28"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#6b9380]">For the people behind the shop</p><h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-extrabold tracking-[-.06em] text-[#173b47] sm:text-5xl">Less admin. More of the work that matters.</h2><p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-[#607a7d]">Start with a thoughtful demo store, make it yours, and let the busywork become background noise.</p><Button onClick={() => setLocation('/signup')} className="mt-8" testId="button-bottom-start">Set up your store <ArrowRight className="size-4" /></Button></section></main></div>;
}

function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    if (supabase) {
      const result = mode === 'signup'
        ? await supabase.auth.signUp({ email, password, options: { data: { name } } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        setError(result.error.message);
        setLoading(false);
        return;
      }
      localStorage.setItem('sellmate-auth', JSON.stringify({ email, name: name || 'Store owner' }));
      setLocation('/dashboard');
      return;
    }
    setTimeout(() => {
      localStorage.setItem('sellmate-auth', JSON.stringify({ email: email || 'demo@noura.ma', name: name || 'Store owner' }));
      setLocation('/dashboard');
    }, 450);
  };
  return <div className="grid min-h-[100dvh] bg-background lg:grid-cols-[.9fr_1.1fr]"><div className="relative hidden overflow-hidden bg-sidebar p-10 lg:flex lg:flex-col lg:justify-between"><Logo dark /><div className="relative z-10 max-w-md pb-16"><div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground"><Sparkles className="size-5" /></div><h1 className="font-display text-5xl font-extrabold leading-[1.04] tracking-[-.065em] text-sidebar-foreground">Your shop,<br /><span className="text-sidebar-primary">in good hands.</span></h1><p className="mt-6 text-sm leading-7 text-sidebar-foreground/60">A calm command center for the daily decisions that move your store forward.</p></div><div className="relative z-10 flex items-center gap-2 text-xs text-sidebar-foreground/45"><span className="size-2 rounded-full bg-[#9bd7c1]" />Local demo mode · no setup required</div><div className="absolute -bottom-28 -right-28 size-96 rounded-full border-[60px] border-sidebar-primary/10" /><div className="absolute right-16 top-32 size-24 rounded-full bg-sidebar-primary/10 blur-2xl" /></div><div className="flex flex-col p-5 sm:p-10"><div className="flex justify-end lg:invisible"><Link href="/" className="text-sm font-bold text-muted-foreground" data-testid="link-auth-home">Back home</Link></div><div className="m-auto w-full max-w-[410px] animate-rise"><div className="mb-9 lg:hidden"><Logo /></div><p className="mb-3 text-[11px] font-bold uppercase tracking-[.16em] text-accent">{mode === 'login' ? 'Welcome back' : 'Start simply'}</p><h2 className="font-display text-3xl font-extrabold tracking-[-.05em]">{mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace'}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{mode === 'login' ? 'Pick up where you left off.' : 'A few details, then you are ready to sell with less noise.'}</p><div className="mt-6 flex items-center gap-2 rounded-xl border border-[#c9e1d4] bg-[#eef8f1] px-3.5 py-3 text-xs font-semibold text-[#3c745b]"><Sparkles className="size-4" /> Demo mode is active. Your data stays on this device.</div><form onSubmit={submit} className="mt-7 space-y-4">{mode === 'signup' && <label className="block"><span className="mb-2 block text-xs font-bold text-foreground">Your name</span><input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sara El Mansouri" className="h-12 w-full rounded-xl border border-input bg-card px-3.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" data-testid="input-signup-name" /></label>}<label className="block"><span className="mb-2 block text-xs font-bold text-foreground">Email address</span><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourstore.ma" className="h-12 w-full rounded-xl border border-input bg-card px-3.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" data-testid="input-auth-email" /></label><label className="block"><span className="mb-2 block text-xs font-bold text-foreground">Password</span><input required minLength={4} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 4 characters" className="h-12 w-full rounded-xl border border-input bg-card px-3.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" data-testid="input-auth-password" /></label>{mode === 'login' && <div className="text-right"><button type="button" className="text-xs font-bold text-accent hover:underline" data-testid="button-forgot-password">Forgot password?</button></div>}<Button type="submit" className="h-12 w-full" disabled={loading} testId="button-submit-auth">{loading ? <Loader2 className="size-4 animate-spin" /> : mode === 'login' ? 'Enter workspace' : 'Create workspace'} {!loading && <ArrowRight className="size-4" />}</Button></form><p className="mt-7 text-center text-sm text-muted-foreground">{mode === 'login' ? 'New to SellMate?' : 'Already have an account?'} <Link href={mode === 'login' ? '/signup' : '/login'} className="font-bold text-accent hover:underline" data-testid="link-switch-auth">{mode === 'login' ? 'Create an account' : 'Log in'}</Link></p></div><p className="mt-auto pt-8 text-center text-[11px] text-muted-foreground">SellMate AI · Built for independent stores</p></div></div>;
}

function Dashboard() {
  const [products] = usePersisted('products', seedProducts);
  const [customers] = usePersisted('customers', seedCustomers);
  const [orders] = usePersisted('orders', seedOrders);
  const [settings] = usePersisted('settings', seedSettings);
  const [messages] = usePersisted('messages', seedMessages);
  const revenue = orders.reduce((sum, order) => sum + (products.find(product => product.id === order.productId)?.price ?? order.total) * order.quantity, 0);
  const activeOrders = orders.filter(order => order.status !== 'Delivered').length;
  const lowStock = products.filter(product => product.stock < 8);
  const byId = useMemo(() => Object.fromEntries(customers.map(item => [item.id, item])), [customers]);
  const productById = useMemo(() => Object.fromEntries(products.map(item => [item.id, item])), [products]);
  return <><PageIntro eyebrow="Overview" title={`Good morning, ${settings.storeName.split(' ')[0]}.`} description="Here’s the useful version of what’s happening in your shop today." action={<Link href="/assistant" data-testid="link-dashboard-assistant" className="inline-flex items-center justify-center gap-2 rounded-xl bg-sidebar px-4 py-2.5 text-[13px] font-bold text-sidebar-foreground shadow-sm hover:bg-sidebar-accent"><Sparkles className="size-4 text-primary" />Ask your assistant</Link>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard label="Total revenue" value={formatMoney(revenue, settings.currency)} note="Across all recorded orders" icon={CreditCard} tone="amber" /><MetricCard label="Orders" value={String(orders.length)} note={`${activeOrders} need your attention`} icon={ShoppingBag} tone="blue" /><MetricCard label="Customers" value={String(customers.length)} note="People in your circle" icon={Users} tone="green" /><MetricCard label="Products" value={String(products.length)} note={`${lowStock.length} running low`} icon={Box} tone="peach" /><MetricCard label="AI conversations" value={String(messages.filter(message => message.role === 'user').length)} note="Questions answered" icon={MessageSquare} tone="blue" /></div><div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]"><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-base font-extrabold tracking-tight">Recent orders</h2><p className="mt-1 text-xs text-muted-foreground">The latest movement in your store.</p></div><Link href="/orders" data-testid="link-dashboard-orders" className="text-xs font-bold text-accent hover:underline">View all</Link></div>{orders.length === 0 ? <div className="mt-6"><EmptyState icon={ClipboardList} title="No orders yet" description="Orders will appear here once customers begin checking out." /></div> : <div className="mt-5 space-y-1">{orders.slice(0, 5).map((order, index) => <div key={order.id} className="flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-muted/60 animate-rise" style={{ animationDelay: `${index * 50}ms` }} data-testid={`row-dashboard-order-${order.id}`}><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eef1e8] text-[#527c70]"><Package className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{productById[order.productId]?.name || 'Product removed'}</p><p className="mt-0.5 text-xs text-muted-foreground">{byId[order.customerId]?.name || 'Customer'} · {formatDate(order.createdAt)}</p></div><div className="text-right"><p className="text-sm font-bold">{formatMoney(order.total, settings.currency)}</p><StatusPill status={order.status} /></div></div>)}</div>}</section><section className="rounded-2xl bg-sidebar p-5 text-sidebar-foreground sm:p-6"><div className="flex items-center gap-2"><div className="grid size-8 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><Sparkles className="size-4" /></div><p className="text-sm font-bold">Worth a look</p></div><h2 className="mt-7 font-display text-2xl font-extrabold leading-tight tracking-[-.04em]">Your attention,<br /><span className="text-sidebar-primary">nicely focused.</span></h2><div className="mt-7 space-y-3">{lowStock.length > 0 && <Link href="/products" data-testid="link-dashboard-low-stock" className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3 hover:bg-sidebar-accent"><div className="grid size-8 place-items-center rounded-lg bg-[#f8dfb0] text-[#9b6a18]"><Package className="size-4" /></div><div className="min-w-0 flex-1"><p className="text-xs font-bold">Low stock</p><p className="mt-0.5 truncate text-[11px] text-sidebar-foreground/55">{lowStock.map(product => product.name).join(', ')}</p></div><ChevronRight className="size-4 text-sidebar-foreground/45" /></Link>}{activeOrders > 0 && <Link href="/orders" data-testid="link-dashboard-active-orders" className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3 hover:bg-sidebar-accent"><div className="grid size-8 place-items-center rounded-lg bg-[#dcefe5] text-[#4d866e]"><Truck className="size-4" /></div><div className="min-w-0 flex-1"><p className="text-xs font-bold">Orders in motion</p><p className="mt-0.5 text-[11px] text-sidebar-foreground/55">{activeOrders} orders are not delivered yet</p></div><ChevronRight className="size-4 text-sidebar-foreground/45" /></Link>}</div><Link href="/assistant" data-testid="link-dashboard-co-pilot" className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-sidebar-primary py-3 text-xs font-bold text-sidebar-primary-foreground">Open co-pilot <ArrowRight className="size-3.5" /></Link></section></div></>;
}

function MetricCard({ label, value, note, icon: Icon, tone }: { label: string; value: string; note: string; icon: typeof Box; tone: string }) {
  const tones: Record<string, string> = { amber: 'bg-[#fff0ca] text-[#a87516]', blue: 'bg-[#e3edf4] text-[#4d7892]', green: 'bg-[#dfefe7] text-[#4a896f]', peach: 'bg-[#f7e4de] text-[#a36458]' };
  return <div className="rounded-2xl border border-border bg-card p-5 soft-shadow animate-rise"><div className="flex items-start justify-between"><p className="text-xs font-semibold text-muted-foreground">{label}</p><div className={`grid size-8 place-items-center rounded-lg ${tones[tone]}`}><Icon className="size-4" /></div></div><p className="mt-5 font-display text-[27px] font-extrabold tracking-[-.045em]" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{note}</p></div>;
}

function ProductsPage() {
  const [products, setProducts] = usePersisted('products', seedProducts);
  const [settings] = usePersisted('settings', seedSettings);
  const [modal, setModal] = useState<Product | null | false>(false);
  const [search, setSearch] = useState('');
  const filtered = products.filter(product => `${product.name} ${product.description}`.toLowerCase().includes(search.toLowerCase()));
  const save = (product: Product) => { setProducts(current => modal && typeof modal !== 'boolean' ? current.map(item => item.id === product.id ? product : item) : [product, ...current]); setModal(false); };
  const remove = (id: string) => { if (window.confirm('Delete this product?')) setProducts(current => current.filter(item => item.id !== id)); };
   return <><PageIntro eyebrow="Catalog" title="Products" description="Keep your catalog sharp, useful, and ready for a customer question." action={<Button onClick={() => setModal(null)} testId="button-add-product"><Plus className="size-4" />Add product</Button>} /><div className="mb-5 flex items-center gap-3"><div className="relative max-w-sm flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products" className="h-11 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" data-testid="input-search-products" /></div><span className="hidden text-xs text-muted-foreground sm:inline">{filtered.length} products</span></div>{filtered.length === 0 ? <EmptyState icon={Package} title={search ? 'No matching products' : 'Your catalog is ready when you are'} description={search ? 'Try a different search term.' : 'Add your first product and SellMate will keep it close for every customer conversation.'} action={!search && <Button onClick={() => setModal(null)} testId="button-empty-add-product"><Plus className="size-4" />Add your first product</Button>} /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((product, index) => <article key={product.id} className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-lg animate-rise" style={{ animationDelay: `${index * 45}ms` }} data-testid={`card-product-${product.id}`}><div className="relative flex h-36 items-center justify-center overflow-hidden bg-[#edf1eb]">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid size-16 place-items-center rounded-2xl bg-[#dbe8dc] text-[#538174]"><Package className="size-7" /></div>}<span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold ${product.stock < 8 ? 'bg-[#fff0ca] text-[#9a6b00]' : 'bg-card/90 text-muted-foreground'}`}>{product.stock} in stock</span></div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold">{product.name}</h2><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{product.description || 'No description yet.'}</p></div><p className="shrink-0 font-display text-base font-extrabold">{formatMoney(product.price, settings.currency)}</p></div><div className="mt-5 flex items-center justify-between border-t border-border/70 pt-3"><p className="text-[11px] text-muted-foreground">{formatDate(product.createdAt)}</p><div className="flex gap-1"><button onClick={() => setModal(product)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Edit ${product.name}`} data-testid={`button-edit-product-${product.id}`}><Pencil className="size-3.5" /></button><button onClick={() => remove(product.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-[#fbe5df] hover:text-destructive" aria-label={`Delete ${product.name}`} data-testid={`button-delete-product-${product.id}`}><Trash2 className="size-3.5" /></button></div></div></div></article>)}</div>}{modal !== false && <ProductModal product={modal || undefined} currency={settings.currency} onClose={() => setModal(false)} onSave={save} />}</>;
}

function ProductModal({ product, currency, onClose, onSave }: { product?: Product; currency: string; onClose: () => void; onSave: (product: Product) => void }) {
  const [form, setForm] = useState<Product>(product || { id: makeId('p'), name: '', description: '', price: 0, stock: 0, imageUrl: '', createdAt: new Date().toISOString() });
  const update = (key: keyof Product, value: string | number) => setForm(current => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => { event.preventDefault(); if (!form.name.trim()) return; onSave({ ...form, name: form.name.trim(), price: Number(form.price), stock: Number(form.stock) }); };
   return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#173b47]/35 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true"><div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 shadow-2xl sm:rounded-3xl sm:p-7 animate-rise"><div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-accent">{product ? 'Edit catalog item' : 'New catalog item'}</p><h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight">{product ? 'Refine the details' : 'Add a product'}</h2></div><button onClick={onClose} aria-label="Close product form" className="rounded-lg p-2 text-muted-foreground hover:bg-muted" data-testid="button-close-product-modal"><X className="size-5" /></button></div><form onSubmit={submit} className="mt-7 space-y-4"><Field label="Product name" value={form.name} onChange={value => update('name', value)} placeholder="e.g. Palm Woven Basket" required testId="input-product-name" /><Field label="Description" value={form.description} onChange={value => update('description', value)} placeholder="What makes it worth choosing?" multiline testId="input-product-description" /><div className="grid gap-4 sm:grid-cols-2"><Field label={`Price (${currency})`} value={String(form.price || '')} onChange={value => update('price', value)} type="number" placeholder="480" required testId="input-product-price" /><Field label="Stock" value={String(form.stock || '')} onChange={value => update('stock', value)} type="number" placeholder="12" required testId="input-product-stock" /></div><Field label="Image URL" value={form.imageUrl} onChange={value => update('imageUrl', value)} placeholder="https://..." testId="input-product-image" /><div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={onClose} testId="button-cancel-product">Cancel</Button><Button type="submit" testId="button-save-product"><Check className="size-4" />{product ? 'Save changes' : 'Add product'}</Button></div></form></div></div>;
}

function Field({ label, value, onChange, placeholder, type = 'text', multiline = false, required = false, testId }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; multiline?: boolean; required?: boolean; testId: string }) {
  const classes = "w-full rounded-xl border border-input bg-card px-3.5 py-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/10";
  return <label className="block"><span className="mb-2 block text-xs font-bold">{label}</span>{multiline ? <textarea required={required} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className={`${classes} resize-none`} data-testid={testId} /> : <input required={required} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`${classes} h-11`} data-testid={testId} />}</label>;
}

function CustomersPage() {
  const [customers] = usePersisted('customers', seedCustomers);
  const [search, setSearch] = useState('');
  const filtered = customers.filter(customer => `${customer.name} ${customer.city} ${customer.phone}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageIntro eyebrow="Relationships" title="Customers" description="A useful view of the people choosing your store." action={<div className="hidden items-center gap-2 rounded-xl bg-[#e9f1eb] px-3 py-2 text-xs font-bold text-[#4d7d6d] sm:flex"><Users className="size-4" />{customers.length} people</div>} /><div className="mb-5 flex max-w-sm items-center"><div className="relative w-full"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers" className="h-11 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" data-testid="input-search-customers" /></div></div><div className="overflow-hidden rounded-2xl border border-border bg-card"><div className="hidden grid-cols-[1.5fr_1.2fr_1fr_.8fr_1fr] gap-4 border-b border-border bg-muted/35 px-5 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground md:grid"><span>Customer</span><span>Phone</span><span>City</span><span>Status</span><span>Joined</span></div>{filtered.length === 0 ? <EmptyState icon={Users} title="No customers found" description="Try another search term." /> : filtered.map(customer => <div key={customer.id} className="grid gap-3 border-b border-border/70 px-4 py-4 last:border-0 sm:px-5 md:grid-cols-[1.5fr_1.2fr_1fr_.8fr_1fr] md:items-center md:gap-4" data-testid={`row-customer-${customer.id}`}><div className="flex items-center gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#dcece2] text-xs font-bold text-[#427564]">{customer.name.split(' ').map(word => word[0]).slice(0, 2).join('')}</div><div><p className="text-sm font-bold" data-testid={`text-customer-name-${customer.id}`}>{customer.name}</p><p className="text-xs text-muted-foreground md:hidden">{customer.city} · {customer.phone}</p></div></div><span className="hidden text-sm text-muted-foreground md:block">{customer.phone}</span><span className="hidden text-sm text-muted-foreground md:block">{customer.city}</span><div><StatusPill status={customer.status} /></div><span className="text-xs text-muted-foreground md:text-sm">{formatDate(customer.createdAt)}</span></div>)}</div></>;
}

function OrdersPage() {
  const [orders] = usePersisted('orders', seedOrders);
  const [customers] = usePersisted('customers', seedCustomers);
  const [products] = usePersisted('products', seedProducts);
  const [settings] = usePersisted('settings', seedSettings);
  const [filter, setFilter] = useState('All');
  const customerById = useMemo(() => Object.fromEntries(customers.map(item => [item.id, item])), [customers]);
  const productById = useMemo(() => Object.fromEntries(products.map(item => [item.id, item])), [products]);
  const visible = filter === 'All' ? orders : orders.filter(order => order.status === filter);
   return <><PageIntro eyebrow="Fulfillment" title="Orders" description="Stay close to what has shipped, what is moving, and what needs a nudge." action={<div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><BarChart3 className="size-4 text-accent" />{orders.length} total orders</div>} /><div className="mb-5 flex gap-2 overflow-x-auto pb-1">{['All', 'Pending', 'Processing', 'Delivered'].map(item => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition ${filter === item ? 'bg-sidebar text-sidebar-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`} data-testid={`button-filter-orders-${item.toLowerCase()}`}>{item}</button>)}</div><div className="overflow-hidden rounded-2xl border border-border bg-card"><div className="hidden grid-cols-[1fr_1.45fr_1.25fr_.5fr_1fr_1fr] gap-4 border-b border-border bg-muted/35 px-5 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground lg:grid"><span>Order</span><span>Customer</span><span>Product</span><span>Qty</span><span>Status</span><span>Total</span></div>{visible.length === 0 ? <EmptyState icon={ClipboardList} title="Nothing here yet" description="Orders with this status will appear here." /> : visible.map(order => <div key={order.id} className="grid gap-3 border-b border-border/70 px-4 py-4 last:border-0 sm:px-5 lg:grid-cols-[1fr_1.45fr_1.25fr_.5fr_1fr_1fr] lg:items-center lg:gap-4" data-testid={`row-order-${order.id}`}><div><p className="text-sm font-bold">{order.id}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatDate(order.createdAt)}</p></div><div className="flex items-center gap-2.5"><div className="grid size-8 place-items-center rounded-lg bg-[#edf1eb] text-accent"><UserRound className="size-3.5" /></div><span className="text-sm font-semibold">{customerById[order.customerId]?.name || 'Customer removed'}</span></div><span className="text-sm text-muted-foreground">{productById[order.productId]?.name || 'Product removed'}</span><span className="text-sm text-muted-foreground">× {order.quantity}</span><div><StatusPill status={order.status} /></div><p className="font-display text-sm font-extrabold">{formatMoney(order.total, settings.currency)}</p></div>)}</div></>;
}

function AssistantPage() {
  const [products] = usePersisted('products', seedProducts);
  const [settings] = usePersisted('settings', seedSettings);
  const [messages, setMessages] = usePersisted('messages', seedMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const suggestions = ['What is available under 500 MAD?', 'How long does delivery take?', 'Write a reply for a low-stock product'];
  const reply = (question: string) => {
    const lower = question.toLowerCase();
    const matched = products.find(product => lower.includes(product.name.toLowerCase().split(' ')[0]) || lower.includes(product.name.toLowerCase()));
    if (lower.includes('deliver') || lower.includes('shipping')) return `${settings.deliveryInformation} ${settings.aiInstructions}`;
    if (lower.includes('stock') || lower.includes('available') || matched) {
      const list = matched ? [matched] : products.filter(product => lower.includes('under') ? product.price < 500 : true).slice(0, 3);
      if (!list.length) return 'I could not find a product that fits that request yet. Try asking about a named product or update your catalog.';
      return list.map(product => `${product.name} is ${product.stock > 0 ? `available with ${product.stock} in stock at ${formatMoney(product.price, settings.currency)}` : 'currently out of stock'}.`).join(' ');
    }
    if (lower.includes('reply') || lower.includes('customer')) return `You can say: “Thanks for reaching out. ${products[0]?.name || 'This item'} is ${products[0]?.stock ? 'available' : 'currently unavailable'} at ${products[0] ? formatMoney(products[0].price, settings.currency) : ''}. ${settings.deliveryInformation}”`;
    return `I can help with product availability, pricing, and delivery. ${settings.aiInstructions}`;
  };
  const send = (text = input) => { if (!text.trim() || sending) return; const clean = text.trim(); setInput(''); setSending(true); setMessages(current => [...current, { id: makeId('m'), role: 'user', content: clean, createdAt: new Date().toISOString() }]); setTimeout(() => { setMessages(current => [...current, { id: makeId('m'), role: 'assistant', content: reply(clean), createdAt: new Date().toISOString() }]); setSending(false); }, 500); };
  return <><PageIntro eyebrow="Your co-pilot" title="AI Assistant" description="Ask about your catalog, or get a ready-to-send customer reply grounded in your store." action={<div className="flex items-center gap-2 rounded-xl border border-[#c9e1d4] bg-[#eef8f1] px-3 py-2 text-xs font-bold text-[#3c745b]"><span className="size-2 rounded-full bg-[#5da27e]" />Local intelligence</div>} /><div className="grid gap-6 xl:grid-cols-[1fr_300px]"><section className="flex min-h-[590px] flex-col overflow-hidden rounded-2xl border border-border bg-card"><div className="flex items-center gap-3 border-b border-border px-5 py-4"><div className="grid size-9 place-items-center rounded-xl bg-[#f7df9d] text-[#966c1a]"><Sparkles className="size-4" /></div><div><p className="text-sm font-bold">SellMate co-pilot</p><p className="text-[11px] text-muted-foreground">Uses your catalog and store settings</p></div><span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-[#4d8a70]"><span className="size-1.5 rounded-full bg-[#62a985]" />Ready</span></div><div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-7">{messages.map(message => <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`} data-testid={`chat-message-${message.id}`}><div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'rounded-br-md bg-sidebar text-sidebar-foreground' : 'rounded-bl-md bg-muted text-foreground'}`}><p>{message.content}</p><p className={`mt-1.5 text-[10px] ${message.role === 'user' ? 'text-sidebar-foreground/45' : 'text-muted-foreground'}`}>{formatDate(message.createdAt)}</p></div></div>)}{sending && <div className="flex gap-3"><div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3"><span className="flex gap-1"><i className="size-1.5 animate-pulse rounded-full bg-muted-foreground" /><i className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:.15s]" /><i className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:.3s]" /></span></div></div>}</div><div className="border-t border-border p-4"><div className="mb-3 flex gap-2 overflow-x-auto">{suggestions.map(suggestion => <button key={suggestion} onClick={() => send(suggestion)} className="whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground" data-testid={`button-suggestion-${suggestion.slice(0, 8).replaceAll(' ', '-').toLowerCase()}`}>{suggestion}</button>)}</div><form onSubmit={event => { event.preventDefault(); send(); }} className="flex items-center gap-2 rounded-xl border border-input bg-background p-1.5 pl-3 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10"><input value={input} onChange={event => setInput(event.target.value)} placeholder="Ask about your store..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/65" data-testid="input-assistant-message" /><button type="submit" disabled={!input.trim() || sending} className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40" aria-label="Send message" data-testid="button-send-message"><Send className="size-4" /></button></form></div></section><aside className="space-y-4"><div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2"><SettingsIcon className="size-4 text-accent" /><h2 className="text-sm font-bold">Your context</h2></div><div className="mt-5 space-y-3 text-xs"><ContextRow label="Products" value={`${products.length} in catalog`} /><ContextRow label="Currency" value={settings.currency} /><ContextRow label="Delivery" value={settings.deliveryInformation} /></div><Link href="/settings" data-testid="link-assistant-settings" className="mt-5 flex items-center gap-1 text-xs font-bold text-accent hover:underline">Tune instructions <ArrowRight className="size-3.5" /></Link></div><div className="rounded-2xl bg-[#eaf1e9] p-5"><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#568073]">Good to know</p><p className="mt-3 text-sm leading-6 text-[#4d6d6b]">The assistant only uses the products and settings in this workspace. Keep them current for more useful replies.</p></div></aside></div></>;
}
function ContextRow({ label, value }: { label: string; value: string }) { return <div><p className="font-bold text-foreground">{label}</p><p className="mt-1 leading-5 text-muted-foreground">{value}</p></div>; }

function SettingsPage() {
  const [settings, setSettings] = usePersisted('settings', seedSettings);
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);
  const update = (key: keyof StoreSettings, value: string) => setForm(current => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => { event.preventDefault(); setSettings(form); setSaved(true); setTimeout(() => setSaved(false), 2200); };
  return <><PageIntro eyebrow="Workspace" title="Settings" description="Shape the context SellMate uses to help you and your customers." /><form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_300px]"><section className="rounded-2xl border border-border bg-card p-5 sm:p-7"><div className="flex items-center gap-3 border-b border-border pb-5"><div className="grid size-10 place-items-center rounded-xl bg-[#eaf1e9] text-accent"><Store className="size-5" /></div><div><h2 className="text-sm font-bold">Store profile</h2><p className="mt-1 text-xs text-muted-foreground">The basics customers should feel in every reply.</p></div></div><div className="mt-6 space-y-5"><Field label="Store name" value={form.storeName} onChange={value => update('storeName', value)} placeholder="Your store name" required testId="input-settings-store-name" /><Field label="Store description" value={form.storeDescription} onChange={value => update('storeDescription', value)} placeholder="A short description" multiline testId="input-settings-description" /><div className="grid gap-5 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-bold">Currency</span><select value={form.currency} onChange={e => update('currency', e.target.value)} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" data-testid="select-settings-currency"><option value="MAD">MAD · Moroccan Dirham</option><option value="EUR">EUR · Euro</option><option value="USD">USD · US Dollar</option></select></label><Field label="Delivery information" value={form.deliveryInformation} onChange={value => update('deliveryInformation', value)} placeholder="How delivery works" testId="input-settings-delivery" /></div></div></section><div className="space-y-6"><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-[#f7df9d] text-[#966c1a]"><Bot className="size-4" /></div><div><h2 className="text-sm font-bold">AI instructions</h2><p className="mt-1 text-xs text-muted-foreground">Your tone, always nearby.</p></div></div><textarea value={form.aiInstructions} onChange={e => update('aiInstructions', e.target.value)} rows={7} className="mt-5 w-full resize-none rounded-xl border border-input bg-background p-3.5 text-sm leading-6 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="Tell the assistant how to sound..." data-testid="textarea-settings-ai" /></section><Button type="submit" className="w-full" testId="button-save-settings">{saved ? <><Check className="size-4" />Saved locally</> : <><Check className="size-4" />Save settings</>}</Button><p className="text-center text-[11px] leading-5 text-muted-foreground">Demo mode stores changes in your browser. Supabase can be connected later without changing this workspace.</p></div></form></>;
}

function Router() {
  const isAuthed = Boolean(localStorage.getItem('sellmate-auth'));
  const protectedPage = (page: ReactNode) => isAuthed ? <AppShell>{page}</AppShell> : <AuthPage mode="login" />;
  return <Switch><Route path="/" component={LandingPage} /><Route path="/signup" component={() => <AuthPage mode="signup" />} /><Route path="/login" component={() => <AuthPage mode="login" />} /><Route path="/dashboard">{protectedPage(<Dashboard />)}</Route><Route path="/products">{protectedPage(<ProductsPage />)}</Route><Route path="/customers">{protectedPage(<CustomersPage />)}</Route><Route path="/orders">{protectedPage(<OrdersPage />)}</Route><Route path="/assistant">{protectedPage(<AssistantPage />)}</Route><Route path="/settings">{protectedPage(<SettingsPage />)}</Route><Route component={NotFound} /></Switch>;
}

const queryClient = new QueryClient();
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary resetKey={useLocation()[0]}><Router /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;