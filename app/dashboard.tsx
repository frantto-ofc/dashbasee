"use client";

import {
  ArrowLeft,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Columns3,
  Database,
  Download,
  FileDown,
  FolderKanban,
  GripVertical,
  HardDriveDownload,
  Handshake,
  LayoutDashboard,
  ListTodo,
  Menu,
  Moon,
  PauseCircle,
  PencilLine,
  Plus,
  ReceiptText,
  Repeat2,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type View =
  | "dashboard"
  | "daily"
  | "crm"
  | "projects"
  | "kanban"
  | "finance"
  | "backup"
  | "account";
type ProjectStatus = "planned" | "in-progress" | "paused" | "completed";
type CrmStatus = "prospecting" | "approach" | "follow-up" | "closed";
type DailyArea = "focus" | "routine" | "quick";
type DailyFilter = "all" | "pending" | "done";
type DailyCalendarView = "day" | "week" | "month";
type DailyAlarmMinutes = 30 | 60 | 120 | 180;
type ProjectType = "one-off" | "recurring";
type ProjectRecurrence =
  | "monthly"
  | "bimonthly"
  | "quarterly"
  | "semiannual"
  | "yearly";
type TransactionKind = "income" | "expense";
type TransactionStatus = "paid" | "pending";
type Theme = "light" | "dark";

type ModalState =
  | { kind: "project"; itemId?: string; initialStatus?: ProjectStatus }
  | { kind: "transaction"; itemId?: string }
  | { kind: "crm"; itemId?: string }
  | { kind: "daily"; itemId?: string };

type DailyTask = {
  id: string;
  title: string;
  area: DailyArea;
  projectId?: string;
  time: string;
  alarmMinutes?: DailyAlarmMinutes;
  estimatedMinutes: number;
  recurring: boolean;
  startDate: string;
  completedDates: string[];
  notes: string;
  createdAt: string;
};

type CrmLead = {
  id: string;
  company: string;
  contactName: string;
  contact: string;
  service: string;
  status: CrmStatus;
  potentialValue: number;
  nextAction: string;
  nextActionDate: string;
  notes: string;
  createdAt: string;
};

type Project = {
  id: string;
  title: string;
  client: string;
  category: string;
  status: ProjectStatus;
  budget: number;
  paidAmount?: number;
  pendingAmount?: number;
  dueDate: string;
  progress: number;
  progressSource?: "manual" | "tasks";
  manualProgress?: number;
  progressCycleStartedAt?: string;
  projectType?: ProjectType;
  recurrence?: ProjectRecurrence;
  financialSync?: boolean;
  createdAt: string;
};

type Transaction = {
  id: string;
  title: string;
  category: string;
  kind: TransactionKind;
  status: TransactionStatus;
  amount: number;
  dueDate: string;
  projectId?: string;
  source?: "project";
  paymentPart?: "paid" | "pending";
  createdAt: string;
};

type AppStore = {
  version: 1;
  lastUpdated: string;
  dailyTasks: DailyTask[];
  leads: CrmLead[];
  projects: Project[];
  transactions: Transaction[];
  settings: {
    currency: "BRL";
    monthlyGoal: number;
    theme: Theme;
  };
};


const USER_STORAGE_PREFIX = "dash-upboard:data:v2:";
const LEGACY_STORAGE_KEY = "estudio-fluxo:data:v1";
const APP_ID = "estudio-fluxo";
const currentDateKey = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const currentMonthKey = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) return new Date().toISOString().slice(0, 7);
  return `${year}-${month}`;
};
const DEFAULT_MONTH = currentMonthKey();

const projectStatus: Record<
  ProjectStatus,
  { label: string; className: string }
> = {
  planned: { label: "Planejado", className: "status-blue" },
  "in-progress": { label: "Em andamento", className: "status-green" },
  paused: { label: "Em pausa", className: "status-amber" },
  completed: { label: "Concluído", className: "status-neutral" },
};

const kanbanColumns: ProjectStatus[] = [
  "planned",
  "in-progress",
  "paused",
  "completed",
];

const crmStatus: Record<
  CrmStatus,
  { label: string; className: string }
> = {
  prospecting: { label: "Sondagem", className: "crm-status-prospecting" },
  approach: { label: "Abordagem", className: "crm-status-approach" },
  "follow-up": { label: "FlowUp", className: "crm-status-follow-up" },
  closed: { label: "Fechado", className: "crm-status-closed" },
};

const crmStatusOrder: CrmStatus[] = [
  "prospecting",
  "approach",
  "follow-up",
  "closed",
];

const dailyAreas: Record<
  DailyArea,
  { label: string; description: string; className: string }
> = {
  focus: {
    label: "Foco",
    description: "Trabalho que pede atenção profunda",
    className: "daily-area-focus",
  },
  routine: {
    label: "Rotina",
    description: "Rituais que mantêm o estúdio em ordem",
    className: "daily-area-routine",
  },
  quick: {
    label: "Rápidas",
    description: "Ações curtas para liberar a fila",
    className: "daily-area-quick",
  },
};

const dailyAreaOrder: DailyArea[] = ["focus", "routine", "quick"];

const dailyAlarmOptions: Record<DailyAlarmMinutes, string> = {
  30: "30 min antes",
  60: "1h antes",
  120: "2h antes",
  180: "3h antes",
};

const dailyAlarmValues = [180, 120, 60, 30] as const;

const recurrenceOptions: Record<
  ProjectRecurrence,
  { label: string; months: number }
> = {
  monthly: { label: "Mensal", months: 1 },
  bimonthly: { label: "Bimestral", months: 2 },
  quarterly: { label: "Trimestral", months: 3 },
  semiannual: { label: "Semestral", months: 6 },
  yearly: { label: "Anual", months: 12 },
};

const createEmptyStore = (): AppStore => ({
  version: 1,
  lastUpdated: new Date().toISOString(),
  settings: {
    currency: "BRL",
    monthlyGoal: 20000,
    theme: "light",
  },
  dailyTasks: [],
  leads: [],
  projects: [],
  transactions: [],
});

const createSampleStore = (): AppStore => ({
  version: 1,
  lastUpdated: new Date().toISOString(),
  settings: {
    currency: "BRL",
    monthlyGoal: 20000,
    theme: "light",
  },
  dailyTasks: [
    {
      id: "daily-priorities",
      title: "Definir as três prioridades do dia",
      area: "focus",
      time: "08:30",
      estimatedMinutes: 15,
      recurring: true,
      startDate: "2026-08-01",
      completedDates: [],
      notes: "Escolher entregas que realmente movem o estúdio.",
      createdAt: "2026-08-01T11:00:00.000Z",
    },
    {
      id: "daily-production",
      title: "Bloco de produção sem interrupções",
      area: "focus",
      time: "09:00",
      estimatedMinutes: 90,
      recurring: true,
      startDate: "2026-08-01",
      completedDates: [],
      notes: "Silenciar notificações durante o bloco.",
      createdAt: "2026-08-01T11:05:00.000Z",
    },
    {
      id: "daily-inbox",
      title: "Responder mensagens de clientes",
      area: "routine",
      time: "14:00",
      estimatedMinutes: 25,
      recurring: true,
      startDate: "2026-08-01",
      completedDates: [currentDateKey()],
      notes: "Atualizar o CRM quando houver avanço comercial.",
      createdAt: "2026-08-01T11:10:00.000Z",
    },
    {
      id: "daily-backup",
      title: "Exportar o backup da semana",
      area: "quick",
      time: "16:30",
      estimatedMinutes: 5,
      recurring: false,
      startDate: currentDateKey(),
      completedDates: [],
      notes: "Guardar o arquivo fora da pasta pública do projeto.",
      createdAt: "2026-08-13T11:15:00.000Z",
    },
  ],
  leads: [
    {
      id: "lead-aurora",
      company: "Clínica Aurora",
      contactName: "Marina Alves",
      contact: "marina@clinicaaurora.com",
      service: "Site institucional",
      status: "approach",
      potentialValue: 12000,
      nextAction: "Enviar escopo inicial",
      nextActionDate: "2026-08-15",
      notes: "Busca um site mais acolhedor e fácil de atualizar.",
      createdAt: "2026-08-08T12:00:00.000Z",
    },
    {
      id: "lead-norte",
      company: "Norte Arquitetura",
      contactName: "Caio Montenegro",
      contact: "(81) 99988-7711",
      service: "Portfólio digital",
      status: "prospecting",
      potentialValue: 6800,
      nextAction: "Mapear necessidades",
      nextActionDate: "2026-08-18",
      notes: "Indicação de cliente antigo.",
      createdAt: "2026-08-10T12:00:00.000Z",
    },
    {
      id: "lead-verde",
      company: "Verde Café",
      contactName: "Ana Costa",
      contact: "ana@verdecafe.com.br",
      service: "Identidade + landing page",
      status: "follow-up",
      potentialValue: 9400,
      nextAction: "Retomar proposta",
      nextActionDate: "2026-08-14",
      notes: "Proposta enviada; aguardando validação dos sócios.",
      createdAt: "2026-08-03T12:00:00.000Z",
    },
    {
      id: "lead-onda",
      company: "Onda Studio",
      contactName: "Lucas Melo",
      contact: "lucas@ondastudio.co",
      service: "Branding completo",
      status: "closed",
      potentialValue: 15000,
      nextAction: "Preparar kickoff",
      nextActionDate: "2026-08-20",
      notes: "Contrato aprovado e sinal confirmado.",
      createdAt: "2026-07-22T12:00:00.000Z",
    },
  ],
  projects: [
    {
      id: "project-mobile",
      title: "Redesign App Mobile",
      client: "Acme Corp",
      category: "Produto digital",
      status: "in-progress",
      budget: 15000,
      dueDate: "2026-08-14",
      progress: 45,
      createdAt: "2026-06-04T12:00:00.000Z",
    },
    {
      id: "project-branding",
      title: "Branding Completo",
      client: "Tech Solutions",
      category: "Identidade visual",
      status: "in-progress",
      budget: 8000,
      dueDate: "2026-07-31",
      progress: 90,
      projectType: "recurring",
      recurrence: "monthly",
      createdAt: "2026-05-12T12:00:00.000Z",
    },
    {
      id: "project-clinica",
      title: "Site Clínica Aurora",
      client: "Clínica Aurora",
      category: "Web design",
      status: "planned",
      budget: 12000,
      dueDate: "2026-09-08",
      progress: 20,
      createdAt: "2026-07-02T12:00:00.000Z",
    },
  ],
  transactions: [
    {
      id: "t-feb-income",
      title: "Sprint de marca",
      category: "Projeto",
      kind: "income",
      status: "paid",
      amount: 4200,
      dueDate: "2026-02-12",
      createdAt: "2026-02-01T12:00:00.000Z",
    },
    {
      id: "t-feb-expense",
      title: "Ferramentas de criação",
      category: "Software",
      kind: "expense",
      status: "paid",
      amount: 390,
      dueDate: "2026-02-08",
      createdAt: "2026-02-01T12:00:00.000Z",
    },
    {
      id: "t-mar-income",
      title: "Projeto editorial",
      category: "Projeto",
      kind: "income",
      status: "paid",
      amount: 5600,
      dueDate: "2026-03-15",
      createdAt: "2026-03-01T12:00:00.000Z",
    },
    {
      id: "t-mar-expense",
      title: "Produção fotográfica",
      category: "Produção",
      kind: "expense",
      status: "paid",
      amount: 1200,
      dueDate: "2026-03-18",
      createdAt: "2026-03-01T12:00:00.000Z",
    },
    {
      id: "t-apr-income",
      title: "Landing page",
      category: "Projeto",
      kind: "income",
      status: "paid",
      amount: 4800,
      dueDate: "2026-04-10",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
    {
      id: "t-apr-expense",
      title: "Freelancer motion",
      category: "Parceiros",
      kind: "expense",
      status: "paid",
      amount: 980,
      dueDate: "2026-04-22",
      createdAt: "2026-04-01T12:00:00.000Z",
    },
    {
      id: "t-may-income",
      title: "Portal institucional",
      category: "Projeto",
      kind: "income",
      status: "paid",
      amount: 7600,
      dueDate: "2026-05-16",
      createdAt: "2026-05-01T12:00:00.000Z",
    },
    {
      id: "t-may-expense",
      title: "Impressos e prova de cor",
      category: "Produção",
      kind: "expense",
      status: "paid",
      amount: 1100,
      dueDate: "2026-05-20",
      createdAt: "2026-05-01T12:00:00.000Z",
    },
    {
      id: "t-jun-income",
      title: "1ª parcela — Branding",
      category: "Projeto",
      kind: "income",
      status: "paid",
      amount: 6300,
      dueDate: "2026-06-18",
      projectId: "project-branding",
      createdAt: "2026-06-01T12:00:00.000Z",
    },
    {
      id: "t-jun-expense",
      title: "Banco de imagens",
      category: "Software",
      kind: "expense",
      status: "paid",
      amount: 700,
      dueDate: "2026-06-21",
      createdAt: "2026-06-01T12:00:00.000Z",
    },
    {
      id: "t-jul-paid",
      title: "Entrega — Site Vértice",
      category: "Projeto",
      kind: "income",
      status: "paid",
      amount: 5000,
      dueDate: "2026-07-05",
      createdAt: "2026-07-01T12:00:00.000Z",
    },
    {
      id: "t-jul-equipment",
      title: "Equipamento de captação",
      category: "Equipamentos",
      kind: "expense",
      status: "paid",
      amount: 1000,
      dueDate: "2026-07-08",
      createdAt: "2026-07-01T12:00:00.000Z",
    },
    {
      id: "t-jul-tools",
      title: "Softwares do estúdio",
      category: "Software",
      kind: "expense",
      status: "paid",
      amount: 150,
      dueDate: "2026-07-12",
      createdAt: "2026-07-01T12:00:00.000Z",
    },
    {
      id: "t-jul-tax",
      title: "Impostos do mês",
      category: "Impostos",
      kind: "expense",
      status: "paid",
      amount: 300,
      dueDate: "2026-07-20",
      createdAt: "2026-07-01T12:00:00.000Z",
    },
    {
      id: "t-jul-freelancer",
      title: "Freelancer ilustração",
      category: "Parceiros",
      kind: "expense",
      status: "pending",
      amount: 1200,
      dueDate: "2026-07-27",
      projectId: "project-branding",
      createdAt: "2026-07-03T12:00:00.000Z",
    },
    {
      id: "t-jul-receivable",
      title: "2ª parcela — Branding",
      category: "Projeto",
      kind: "income",
      status: "pending",
      amount: 4000,
      dueDate: "2026-07-29",
      projectId: "project-branding",
      createdAt: "2026-07-03T12:00:00.000Z",
    },
  ],
});

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(`${value}T12:00:00.000Z`))
    .replace(".", "");

const monthLabel = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthNumber - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const moveMonth = (month: string, delta: number) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(year, monthNumber - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(
    2,
    "0",
  )}`;
};

const moveDate = (value: string, delta: number) => {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
};

const moveCalendarDate = (
  value: string,
  view: DailyCalendarView,
  delta: number,
) => {
  if (view === "day") return moveDate(value, delta);
  if (view === "week") return moveDate(value, delta * 7);
  const [year, month, day] = value.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + delta, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
};

const startOfCalendarWeek = (value: string) => {
  const date = new Date(`${value}T12:00:00.000Z`);
  const day = date.getUTCDay();
  return moveDate(value, -(day === 0 ? 6 : day - 1));
};

const calendarDateKeys = (value: string, view: DailyCalendarView) => {
  if (view === "day") return [value];
  if (view === "week") {
    const start = startOfCalendarWeek(value);
    return Array.from({ length: 7 }, (_, index) => moveDate(start, index));
  }
  const firstDay = `${value.slice(0, 7)}-01`;
  const start = startOfCalendarWeek(firstDay);
  return Array.from({ length: 42 }, (_, index) => moveDate(start, index));
};

const calendarWeekdayLabel = (value: string, narrow = false) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: narrow ? "narrow" : "short",
    timeZone: "UTC",
  })
    .format(new Date(`${value}T12:00:00.000Z`))
    .replace(".", "");

const dailyTaskOccursOn = (task: DailyTask, date: string) =>
  task.recurring ? task.startDate <= date : task.startDate === date;

const playDailyAlarmTone = async (existingContext: AudioContext | null) => {
  const context = existingContext ?? new AudioContext();
  if (context.state === "suspended") await context.resume();

  const start = context.currentTime + 0.04;
  const peakVolume = 0.24 * 1.3;
  [0, 0.34, 0.68].forEach((offset, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = index === 2 ? 880 : 740;
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(
      peakVolume,
      start + offset + 0.025,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.24);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.25);
  });

  return context;
};

const dailyTasksOnDate = (
  tasks: DailyTask[],
  date: string,
  query = "",
) =>
  tasks
    .filter((task) => dailyTaskOccursOn(task, date))
    .filter(
      (task) =>
        !query ||
        `${task.title} ${task.notes} ${dailyAreas[task.area].label}`
          .toLocaleLowerCase("pt-BR")
          .includes(query),
    )
    .sort((a, b) => {
      if (!a.time && b.time) return 1;
      if (a.time && !b.time) return -1;
      return a.time.localeCompare(b.time) || a.createdAt.localeCompare(b.createdAt);
    });

const dailyDateLabel = (value: string) => {
  const label = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00.000Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const isRecurringProject = (project: Project) =>
  project.projectType === "recurring";

const nextRecurringDate = (
  value: string,
  recurrence: ProjectRecurrence = "monthly",
) => {
  const [year, month, day] = value.split("-").map(Number);
  const monthIndex = month - 1 + recurrenceOptions[recurrence].months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)),
  )
    .toISOString()
    .slice(0, 10);
};

const projectIncomeTitle = (project: Project) =>
  isRecurringProject(project)
    ? `Ciclo — ${project.title}`
    : `Projeto — ${project.title}`;

const projectPaidAmount = (project: Project) =>
  Math.max(0, project.paidAmount ?? 0);

const projectPendingAmount = (project: Project) =>
  Math.max(
    0,
    project.pendingAmount ?? project.budget - projectPaidAmount(project),
  );

const normalizeProjectFinancials = (project: Project): Project => ({
  ...project,
  paidAmount: projectPaidAmount(project),
  pendingAmount: projectPendingAmount(project),
});

const projectTaskStats = (project: Project, tasks: DailyTask[]) => {
  const linkedTasks = tasks.filter((task) => task.projectId === project.id);
  const completed = linkedTasks.filter((task) =>
    task.completedDates.some(
      (date) =>
        !project.progressCycleStartedAt ||
        date >= project.progressCycleStartedAt,
    ),
  ).length;
  return {
    total: linkedTasks.length,
    completed,
    progress: linkedTasks.length
      ? Math.round((completed / linkedTasks.length) * 100)
      : project.progress,
  };
};

const syncProjectTaskProgress = (
  projects: Project[],
  dailyTasks: DailyTask[],
) =>
  projects.map((project) => {
    const stats = projectTaskStats(project, dailyTasks);
    if (stats.total) {
      return {
        ...project,
        manualProgress:
          project.progressSource === "tasks"
            ? project.manualProgress
            : project.progress,
        progress: stats.progress,
        progressSource: "tasks" as const,
      };
    }
    if (project.progressSource === "tasks") {
      const progress = project.manualProgress ?? 0;
      return {
        ...project,
        progress,
        manualProgress: progress,
        progressSource: "manual" as const,
      };
    }
    return project;
  });

const createProjectIncome = (
  project: Project,
  paymentPart: "paid" | "pending",
  dueDate = project.dueDate,
): Transaction => {
  const amount =
    paymentPart === "paid"
      ? projectPaidAmount(project)
      : projectPendingAmount(project);
  return {
    id: `project-income-${project.id}-${dueDate}-${paymentPart}`,
    title: `${paymentPart === "paid" ? "Valor pago" : "Valor pendente"} — ${projectIncomeTitle(project)}`,
    category: "Projetos",
    kind: "income",
    status: paymentPart,
    amount,
    dueDate,
    projectId: project.id,
    source: "project",
    paymentPart,
    createdAt: project.createdAt,
  };
};

const syncProjectIncome = (
  transactions: Transaction[],
  project: Project,
  previousProject?: Project,
  preserveLegacyLinkedIncome = false,
) => {
  const cycleDates = new Set(
    [project.dueDate, previousProject?.dueDate].filter(Boolean),
  );
  const autoCycleEntries = transactions.filter(
    (transaction) =>
      transaction.source === "project" &&
      transaction.kind === "income" &&
      transaction.projectId === project.id &&
      cycleDates.has(transaction.dueDate),
  );

  if (project.financialSync === false) {
    return transactions.filter(
      (transaction) =>
        !(
          transaction.source === "project" &&
          transaction.status === "pending" &&
          transaction.projectId === project.id &&
          cycleDates.has(transaction.dueDate)
        ),
    );
  }

  const hasLinkedIncome = transactions.some(
    (transaction) =>
      transaction.kind === "income" && transaction.projectId === project.id,
  );
  if (
    preserveLegacyLinkedIncome &&
    !autoCycleEntries.length &&
    hasLinkedIncome
  ) {
    return transactions;
  }

  const withoutCurrentCycle = transactions.filter(
    (transaction) => !autoCycleEntries.includes(transaction),
  );
  const projectEntries = (["paid", "pending"] as const)
    .map((paymentPart) => createProjectIncome(project, paymentPart))
    .filter((transaction) => transaction.amount > 0);
  return [...projectEntries, ...withoutCurrentCycle];
};

const syncMissingProjectIncome = (store: AppStore): AppStore => {
  const dailyTasks = Array.isArray(store.dailyTasks)
    ? store.dailyTasks.map((task) => ({
        ...task,
        completedDates: Array.isArray(task.completedDates)
          ? task.completedDates
          : [],
      }))
    : [];
  const leads = Array.isArray(store.leads) ? store.leads : [];
  const projects = syncProjectTaskProgress(
    store.projects.map(normalizeProjectFinancials),
    dailyTasks,
  );
  const transactions = projects.reduce(
    (current, project, index) => {
      const originalProject = store.projects[index];
      return syncProjectIncome(
        current,
        project,
        undefined,
        originalProject.financialSync !== true,
      );
    },
    store.transactions,
  );
  return { ...store, dailyTasks, leads, projects, transactions };
};

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const isValidStore = (value: unknown): value is AppStore => {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<AppStore>;
  if (
    data.version !== 1 ||
    !Array.isArray(data.projects) ||
    !Array.isArray(data.transactions) ||
    !data.settings ||
    data.settings.currency !== "BRL"
  ) {
    return false;
  }

  return (
    (data.dailyTasks === undefined ||
      (Array.isArray(data.dailyTasks) &&
        data.dailyTasks.every(
          (task) =>
            task &&
            typeof task.id === "string" &&
            typeof task.title === "string" &&
            typeof task.area === "string" &&
            dailyAreaOrder.includes(task.area as DailyArea) &&
            (task.projectId === undefined ||
              typeof task.projectId === "string") &&
            (task.alarmMinutes === undefined ||
              dailyAlarmValues.includes(
                task.alarmMinutes as DailyAlarmMinutes,
              )) &&
            typeof task.recurring === "boolean" &&
            typeof task.startDate === "string" &&
            Array.isArray(task.completedDates),
        ))) &&
    (data.leads === undefined ||
      (Array.isArray(data.leads) &&
        data.leads.every(
          (lead) =>
            lead &&
            typeof lead.id === "string" &&
            typeof lead.company === "string" &&
            typeof lead.status === "string" &&
            crmStatusOrder.includes(lead.status as CrmStatus),
        ))) &&
    data.projects.every(
      (project) =>
        project &&
        typeof project.id === "string" &&
        typeof project.title === "string" &&
        typeof project.budget === "number" &&
        typeof project.progress === "number" &&
        typeof project.dueDate === "string",
    ) &&
    data.transactions.every(
      (transaction) =>
        transaction &&
        typeof transaction.id === "string" &&
        typeof transaction.title === "string" &&
        typeof transaction.amount === "number" &&
        (transaction.kind === "income" ||
          transaction.kind === "expense") &&
        (transaction.status === "paid" ||
          transaction.status === "pending"),
    )
  );
};

const isStoreEmpty = (store: AppStore | null | undefined): boolean => {
  if (!store) return true;
  return (
    (!store.projects || store.projects.length === 0) &&
    (!store.dailyTasks || store.dailyTasks.length === 0) &&
    (!store.leads || store.leads.length === 0) &&
    (!store.transactions || store.transactions.length === 0)
  );
};

function IconButton({
  label,
  children,
  onClick,
  className = "",
  disabled = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <FolderKanban size={22} />
      </div>
      <strong>{title}</strong>
      <p>{text}</p>
      {action}
    </div>
  );
}

type DashboardUser = {
  id: string;
  email: string;
  fullName?: string;
  businessName?: string;
  phone?: string;
};

export default function Dashboard({ user }: { user: DashboardUser }) {
  const userStorageKey = `${USER_STORAGE_PREFIX}${user.id}`;
  const [store, setStore] = useState<AppStore>(createEmptyStore);
  const [savedAt, setSavedAt] = useState(() => new Date().toISOString());
  const [hydrated, setHydrated] = useState(false);
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(DEFAULT_MONTH);
  const [selectedDailyDate, setSelectedDailyDate] = useState(currentDateKey);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<ProjectStatus | "all">(
    "all",
  );
  const [financeFilter, setFinanceFilter] = useState<
    TransactionKind | "all"
  >("all");
  const [crmFilter, setCrmFilter] = useState<CrmStatus | "all">("all");
  const [dailyFilter, setDailyFilter] = useState<DailyFilter>("all");
  const [dailyCalendarView, setDailyCalendarView] =
    useState<DailyCalendarView>("month");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [projectTypeDraft, setProjectTypeDraft] =
    useState<ProjectType>("one-off");
  const [projectInvestmentDraft, setProjectInvestmentDraft] = useState(0);
  const [projectPaidDraft, setProjectPaidDraft] = useState(0);
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    status: ProjectStatus;
    projectId?: string;
  } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState({
    fullName: user.fullName ?? "",
    businessName: user.businessName ?? "",
    phone: user.phone ?? "",
  });
  const lastSyncedAtRef = useRef("");
  const skipNextSaveRef = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);
  const alarmAudioContextRef = useRef<AudioContext | null>(null);
  const alarmedTaskKeysRef = useRef<Set<string>>(new Set());
  const editingProject =
    modal?.kind === "project" && modal.itemId
      ? store.projects.find((project) => project.id === modal.itemId)
      : undefined;
  const editingTransaction =
    modal?.kind === "transaction" && modal.itemId
      ? store.transactions.find(
          (transaction) => transaction.id === modal.itemId,
        )
      : undefined;
  const editingLead =
    modal?.kind === "crm" && modal.itemId
      ? store.leads.find((lead) => lead.id === modal.itemId)
      : undefined;
  const editingDailyTask =
    modal?.kind === "daily" && modal.itemId
      ? store.dailyTasks.find((task) => task.id === modal.itemId)
      : undefined;
  const editingProjectTaskStats = editingProject
    ? projectTaskStats(editingProject, store.dailyTasks)
    : undefined;

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const readLocalStore = () => {
      for (const key of [userStorageKey, LEGACY_STORAGE_KEY]) {
        const saved = localStorage.getItem(key);
        if (!saved) continue;
        const parsed = JSON.parse(saved) as unknown;
        if (isValidStore(parsed)) return syncMissingProjectIncome(parsed);
      }
      return null;
    };

    const hydrate = async () => {
      try {
        const localStore = readLocalStore();
        const { data: cloudRow, error } = await supabase
          .from("user_app_state")
          .select("data, updated_at")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) throw error;

        const cloudStore = isValidStore(cloudRow?.data)
          ? syncMissingProjectIncome(cloudRow.data)
          : null;
        const localHasData = !isStoreEmpty(localStore);
        const cloudHasData = !isStoreEmpty(cloudStore);

        const localTime = Date.parse(localStore?.lastUpdated ?? "") || 0;
        const cloudTime = Date.parse(cloudRow?.updated_at ?? cloudStore?.lastUpdated ?? "") || 0;

        let selected: AppStore;
        if (cloudStore && cloudHasData && !localHasData) {
          // Nuvem tem dados válidos e local está vazio/novo: nunca sobrescrever com vazio
          selected = cloudStore;
        } else if (localStore && localHasData && !cloudHasData) {
          // Local tem dados e nuvem está vazia/recém-criada: migrar local para nuvem
          selected = localStore;
        } else if (cloudStore && cloudTime >= localTime) {
          // Ambos têm dados (ou ambos vazios), e a nuvem é mais recente ou igual: prevalece a nuvem
          selected = cloudStore;
        } else {
          selected = localStore ?? cloudStore ?? createEmptyStore();
        }

        const selectedTime = new Date(Math.max(localTime, cloudTime, Date.now())).toISOString();
        const hydratedStore = { ...selected, lastUpdated: selectedTime };

        if (cancelled) return;
        skipNextSaveRef.current = true;
        lastSyncedAtRef.current = cloudRow?.updated_at ?? "";
        setStore(hydratedStore);
        setSavedAt(hydratedStore.lastUpdated);
        localStorage.setItem(userStorageKey, JSON.stringify(hydratedStore));
        localStorage.removeItem(LEGACY_STORAGE_KEY);

        const shouldSyncToCloud = !cloudStore || (localHasData && (!cloudHasData || localTime > cloudTime));
        if (shouldSyncToCloud) {
          const { data: savedRow, error: saveError } = await supabase
            .from("user_app_state")
            .upsert({ user_id: user.id, data: hydratedStore }, { onConflict: "user_id" })
            .select("updated_at")
            .single();
          if (saveError) throw saveError;
          lastSyncedAtRef.current = savedRow.updated_at;
        }
        setSaveError(false);
      } catch {
        if (!cancelled) {
          const localStore = (() => {
            try { return readLocalStore(); } catch { return null; }
          })();
          skipNextSaveRef.current = true;
          if (localStore) setStore(localStore);
          setSaveError(true);
          setToast("Sem conexão com a nuvem. Seus dados locais continuam disponíveis.");
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
          setSyncing(false);
        }
      }
    };

    void hydrate();
    return () => { cancelled = true; };
  }, [user.id, userStorageKey]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    const next = { ...store, lastUpdated: new Date().toISOString() };
    try {
      localStorage.setItem(userStorageKey, JSON.stringify(next));
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaveError(true);
      return;
    }
    setSavedAt(next.lastUpdated);
    setSyncing(true);
    const timeout = window.setTimeout(async () => {
      const { data, error } = await createClient()
        .from("user_app_state")
        .upsert({ user_id: user.id, data: next }, { onConflict: "user_id" })
        .select("updated_at")
        .single();
      if (error) {
        setSaveError(true);
      } else {
        lastSyncedAtRef.current = data.updated_at;
        setSaveError(false);
      }
      setSyncing(false);
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [hydrated, store, user.id, userStorageKey]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const pullLatest = async () => {
      const { data, error } = await createClient()
        .from("user_app_state")
        .select("data, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled || error || !data || data.updated_at === lastSyncedAtRef.current || !isValidStore(data.data)) return;
      if (Date.parse(data.updated_at) <= Date.parse(lastSyncedAtRef.current)) return;
      const latest = syncMissingProjectIncome(data.data);
      skipNextSaveRef.current = true;
      lastSyncedAtRef.current = data.updated_at;
      setStore(latest);
      setSavedAt(data.updated_at);
      localStorage.setItem(userStorageKey, JSON.stringify(latest));
      setSaveError(false);
    };
    const onFocus = () => { void pullLatest(); };
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => { void pullLatest(); }, 20000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [hydrated, user.id, userStorageKey]);

  useEffect(() => {
    document.documentElement.dataset.theme = store.settings.theme;
    document.documentElement.style.colorScheme = store.settings.theme;
  }, [store.settings.theme]);

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== user.id)) {
        window.location.replace("/login");
      }
    });
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [user.id]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!hydrated) return;

    const checkDailyAlarms = () => {
      const today = currentDateKey();
      const occurrenceDates = [today, moveDate(today, 1)];
      const now = Date.now();

      store.dailyTasks.forEach((task) => {
        const alarmMinutes = task.alarmMinutes;
        if (!task.time || !alarmMinutes) return;

        occurrenceDates.forEach((occurrenceDate) => {
          if (
            !dailyTaskOccursOn(task, occurrenceDate) ||
            task.completedDates.includes(occurrenceDate)
          ) {
            return;
          }

          const taskTime = Date.parse(
            `${occurrenceDate}T${task.time}:00-03:00`,
          );
          const alarmTime = taskTime - alarmMinutes * 60_000;
          const alarmKey = `${task.id}:${occurrenceDate}:${task.time}:${alarmMinutes}`;
          if (
            now < alarmTime ||
            now - alarmTime > 5 * 60_000 ||
            alarmedTaskKeysRef.current.has(alarmKey)
          ) {
            return;
          }

          alarmedTaskKeysRef.current.add(alarmKey);
          setToast(
            `Alarme: “${task.title}” começa ${dailyAlarmOptions[alarmMinutes].toLowerCase()}.`,
          );
          void playDailyAlarmTone(alarmAudioContextRef.current)
            .then((context) => {
              alarmAudioContextRef.current = context;
            })
            .catch(() => {
              setToast(
                "O navegador bloqueou o áudio. Use “Testar som” na aba Daily.",
              );
            });
        });
      });
    };

    checkDailyAlarms();
    const interval = window.setInterval(checkDailyAlarms, 15_000);
    return () => window.clearInterval(interval);
  }, [hydrated, store.dailyTasks]);

  useEffect(() => {
    if (!modal) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
    };
    document.body.classList.add("modal-open");
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [modal]);

  const monthTransactions = useMemo(
    () =>
      store.transactions.filter((transaction) =>
        transaction.dueDate.startsWith(selectedMonth),
      ),
    [selectedMonth, store.transactions],
  );

  const financials = useMemo(() => {
    const received = monthTransactions
      .filter(
        (transaction) =>
          transaction.kind === "income" && transaction.status === "paid",
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const paidExpenses = monthTransactions
      .filter(
        (transaction) =>
          transaction.kind === "expense" && transaction.status === "paid",
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const receivable = monthTransactions
      .filter(
        (transaction) =>
          transaction.kind === "income" && transaction.status === "pending",
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const payable = monthTransactions
      .filter(
        (transaction) =>
          transaction.kind === "expense" && transaction.status === "pending",
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    return {
      received,
      paidExpenses,
      receivable,
      payable,
      result: received - paidExpenses,
      forecast: received + receivable - paidExpenses - payable,
    };
  }, [monthTransactions]);

  const projectIncomeSummary = useMemo(() => {
    const entries = monthTransactions.filter(
      (transaction) =>
        transaction.source === "project" && transaction.kind === "income",
    );
    return {
      count: entries.length,
      total: entries.reduce((sum, transaction) => sum + transaction.amount, 0),
    };
  }, [monthTransactions]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return store.leads
      .filter((lead) => {
        const matchesStatus = crmFilter === "all" || lead.status === crmFilter;
        const matchesQuery =
          !query ||
          `${lead.company} ${lead.contactName} ${lead.contact} ${lead.service} ${lead.nextAction}`
            .toLocaleLowerCase("pt-BR")
            .includes(query);
        return matchesStatus && matchesQuery;
      })
      .sort((a, b) => a.nextActionDate.localeCompare(b.nextActionDate));
  }, [crmFilter, search, store.leads]);

  const crmSummary = useMemo(() => {
    const openLeads = store.leads.filter((lead) => lead.status !== "closed");
    const today = currentDateKey();
    return {
      open: openLeads.length,
      potential: openLeads.reduce(
        (sum, lead) => sum + lead.potentialValue,
        0,
      ),
      followUps: openLeads.filter(
        (lead) => lead.nextActionDate && lead.nextActionDate <= today,
      ).length,
      closed: store.leads.filter((lead) => lead.status === "closed").length,
    };
  }, [store.leads]);

  const dailyTasksForDate = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return dailyTasksOnDate(store.dailyTasks, selectedDailyDate, query);
  }, [search, selectedDailyDate, store.dailyTasks]);

  const visibleDailyTasks = useMemo(
    () =>
      dailyTasksForDate.filter((task) => {
        const done = task.completedDates.includes(selectedDailyDate);
        return (
          dailyFilter === "all" ||
          (dailyFilter === "done" && done) ||
          (dailyFilter === "pending" && !done)
        );
      }),
    [dailyFilter, dailyTasksForDate, selectedDailyDate],
  );

  const dailySummary = useMemo(() => {
    const done = dailyTasksForDate.filter((task) =>
      task.completedDates.includes(selectedDailyDate),
    ).length;
    const total = dailyTasksForDate.length;
    return {
      done,
      total,
      pending: total - done,
      recurring: dailyTasksForDate.filter((task) => task.recurring).length,
      progress: total ? Math.round((done / total) * 100) : 0,
    };
  }, [dailyTasksForDate, selectedDailyDate]);

  const dailyCalendar = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return calendarDateKeys(selectedDailyDate, dailyCalendarView).map((date) => {
      const tasks = dailyTasksOnDate(store.dailyTasks, date, query);
      const done = tasks.filter((task) =>
        task.completedDates.includes(date),
      ).length;
      return {
        date,
        tasks,
        done,
        progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      };
    });
  }, [dailyCalendarView, search, selectedDailyDate, store.dailyTasks]);

  const dailyCalendarTitle = useMemo(() => {
    if (dailyCalendarView === "day") return dailyDateLabel(selectedDailyDate);
    if (dailyCalendarView === "week") {
      const start = dailyCalendar[0]?.date ?? selectedDailyDate;
      const end = dailyCalendar.at(-1)?.date ?? selectedDailyDate;
      return `${dateLabel(start)} — ${dateLabel(end)}`;
    }
    return monthLabel(selectedDailyDate.slice(0, 7));
  }, [dailyCalendar, dailyCalendarView, selectedDailyDate]);

  const dailyCalendarSummary = useMemo(() => {
    const total = dailyCalendar.reduce((sum, day) => sum + day.tasks.length, 0);
    const done = dailyCalendar.reduce((sum, day) => sum + day.done, 0);
    return { total, done };
  }, [dailyCalendar]);

  const activeProjects = useMemo(
    () =>
      store.projects.filter(
        (project) =>
          project.status === "in-progress" || project.status === "planned",
      ),
    [store.projects],
  );

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return store.projects.filter((project) => {
      const matchesStatus =
        projectFilter === "all" || project.status === projectFilter;
      const matchesQuery =
        !query ||
        `${project.title} ${project.client} ${project.category}`
          .toLocaleLowerCase("pt-BR")
          .includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [projectFilter, search, store.projects]);

  const kanbanProjects = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return store.projects.filter(
      (project) =>
        !query ||
        `${project.title} ${project.client} ${project.category}`
          .toLocaleLowerCase("pt-BR")
          .includes(query),
    );
  }, [search, store.projects]);

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return monthTransactions
      .filter((transaction) => {
        const matchesKind =
          financeFilter === "all" || transaction.kind === financeFilter;
        const matchesQuery =
          !query ||
          `${transaction.title} ${transaction.category}`
            .toLocaleLowerCase("pt-BR")
            .includes(query);
        return matchesKind && matchesQuery;
      })
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  }, [financeFilter, monthTransactions, search]);

  const chartData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) =>
      moveMonth(selectedMonth, index - 5),
    );
    return months.map((month) => {
      const records = store.transactions.filter((transaction) =>
        transaction.dueDate.startsWith(month),
      );
      return {
        month,
        income: records
          .filter((transaction) => transaction.kind === "income")
          .reduce((sum, transaction) => sum + transaction.amount, 0),
        expense: records
          .filter((transaction) => transaction.kind === "expense")
          .reduce((sum, transaction) => sum + transaction.amount, 0),
      };
    });
  }, [selectedMonth, store.transactions]);

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + 7);
    return store.transactions
      .filter((transaction) => {
        const due = new Date(`${transaction.dueDate}T12:00:00`);
        return (
          transaction.status === "pending" && due >= today && due <= limit
        );
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [store.transactions]);

  const maxChartValue = Math.max(
    1,
    ...chartData.flatMap((item) => [item.income, item.expense]),
  );

  const showToast = (message: string) => setToast(message);

  const testDailyAlarm = async () => {
    try {
      alarmAudioContextRef.current = await playDailyAlarmTone(
        alarmAudioContextRef.current,
      );
      showToast("Som do alarme ativado neste dispositivo.");
    } catch {
      showToast(
        "Não foi possível tocar o som. Verifique o volume e a permissão do navegador.",
      );
    }
  };

  const openProjectModal = (
    options: { itemId?: string; initialStatus?: ProjectStatus } = {},
  ) => {
    const project = options.itemId
      ? store.projects.find((item) => item.id === options.itemId)
      : undefined;
    setProjectTypeDraft(project?.projectType ?? "one-off");
    setProjectInvestmentDraft(project?.budget ?? 0);
    setProjectPaidDraft(project ? projectPaidAmount(project) : 0);
    setModal({ kind: "project", ...options });
  };

  const saveDailyTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedAlarm = Number(form.get("alarmMinutes"));
    const task: DailyTask = {
      id: editingDailyTask?.id ?? uid(),
      title: String(form.get("title") || "").trim(),
      area: String(form.get("area")) as DailyArea,
      projectId: String(form.get("projectId") || "") || undefined,
      time: String(form.get("time") || ""),
      alarmMinutes: dailyAlarmValues.includes(
        selectedAlarm as DailyAlarmMinutes,
      )
        ? (selectedAlarm as DailyAlarmMinutes)
        : undefined,
      estimatedMinutes: Math.max(
        0,
        Number(form.get("estimatedMinutes")) || 0,
      ),
      recurring: form.get("recurring") === "on",
      startDate: String(form.get("startDate") || selectedDailyDate),
      completedDates: editingDailyTask?.completedDates ?? [],
      notes: String(form.get("notes") || "").trim(),
      createdAt: editingDailyTask?.createdAt ?? new Date().toISOString(),
    };
    if (!task.title || !dailyAreaOrder.includes(task.area)) {
      showToast("Preencha o nome e escolha uma área para a tarefa.");
      return;
    }
    if (task.alarmMinutes && !task.time) {
      showToast("Defina um horário para usar o alarme sonoro.");
      return;
    }
    setStore((current) => {
      const dailyTasks = editingDailyTask
        ? current.dailyTasks.map((item) =>
            item.id === task.id ? task : item,
          )
        : [task, ...current.dailyTasks];
      return {
        ...current,
        dailyTasks,
        projects: syncProjectTaskProgress(current.projects, dailyTasks),
      };
    });
    setModal(null);
    showToast(
      editingDailyTask
        ? task.projectId
          ? "Tarefa e progresso do projeto atualizados."
          : "Tarefa diária atualizada."
        : task.recurring
          ? task.projectId
            ? "Tarefa recorrente vinculada ao projeto."
            : "Tarefa adicionada e preparada para renovar diariamente."
          : "Tarefa adicionada ao dia.",
    );
  };

  const toggleDailyTask = (id: string, date = selectedDailyDate) => {
    const task = store.dailyTasks.find((item) => item.id === id);
    if (!task) return;
    const isDone = task.completedDates.includes(date);
    setStore((current) => {
      const dailyTasks = current.dailyTasks.map((item) =>
        item.id === id
          ? {
              ...item,
              completedDates: isDone
                ? item.completedDates.filter(
                    (completedDate) => completedDate !== date,
                  )
                : [...new Set([...item.completedDates, date])],
            }
          : item,
      );
      return {
        ...current,
        dailyTasks,
        projects: syncProjectTaskProgress(current.projects, dailyTasks),
      };
    });
    showToast(
      task.projectId
        ? isDone
          ? "Tarefa reaberta e progresso do projeto recalculado."
          : "Tarefa concluída e progresso do projeto atualizado."
        : isDone
          ? "Tarefa reaberta."
          : "Tarefa concluída por hoje.",
    );
  };

  const deleteProject = (id: string) => {
    const project = store.projects.find((item) => item.id === id);
    if (!project) return;
    const linkedTaskCount = store.dailyTasks.filter(
      (task) => task.projectId === id,
    ).length;
    const linkedTaskNotice = linkedTaskCount
      ? ` ${linkedTaskCount} tarefa${linkedTaskCount === 1 ? " será" : "s serão"} preservada${linkedTaskCount === 1 ? "" : "s"} e desvinculada${linkedTaskCount === 1 ? "" : "s"}.`
      : "";
    if (
      !window.confirm(
        `Excluir o projeto “${project.title}”?${linkedTaskNotice} Os lançamentos financeiros automáticos também serão removidos.`,
      )
    ) {
      return;
    }

    setStore((current) => ({
      ...current,
      projects: current.projects.filter((item) => item.id !== id),
      dailyTasks: current.dailyTasks.map((task) =>
        task.projectId === id ? { ...task, projectId: undefined } : task,
      ),
      transactions: current.transactions
        .filter(
          (transaction) =>
            !(transaction.source === "project" && transaction.projectId === id),
        )
        .map((transaction) =>
          transaction.projectId === id
            ? { ...transaction, projectId: undefined }
            : transaction,
        ),
    }));
    if (modal?.kind === "project" && modal.itemId === id) setModal(null);
    showToast(
      linkedTaskCount
        ? "Projeto excluído; tarefas preservadas e desvinculadas."
        : "Projeto excluído dos quadros.",
    );
  };

  const deleteDailyTask = (id: string) => {
    const task = store.dailyTasks.find((item) => item.id === id);
    if (!task || !window.confirm(`Excluir a tarefa “${task.title}”?`)) return;
    setStore((current) => {
      const dailyTasks = current.dailyTasks.filter((item) => item.id !== id);
      return {
        ...current,
        dailyTasks,
        projects: syncProjectTaskProgress(current.projects, dailyTasks),
      };
    });
    if (modal?.kind === "daily" && modal.itemId === id) setModal(null);
    showToast(
      task.projectId
        ? "Tarefa removida e progresso do projeto recalculado."
        : "Tarefa removida do Daily Work.",
    );
  };

  const saveCrmLead = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lead: CrmLead = {
      id: editingLead?.id ?? uid(),
      company: String(form.get("company") || "").trim(),
      contactName: String(form.get("contactName") || "").trim(),
      contact: String(form.get("contact") || "").trim(),
      service: String(form.get("service") || "").trim(),
      status: String(form.get("status")) as CrmStatus,
      potentialValue: Math.max(
        0,
        Number(form.get("potentialValue")) || 0,
      ),
      nextAction: String(form.get("nextAction") || "").trim(),
      nextActionDate: String(form.get("nextActionDate") || ""),
      notes: String(form.get("notes") || "").trim(),
      createdAt: editingLead?.createdAt ?? new Date().toISOString(),
    };
    if (!lead.company || !lead.contactName || !lead.service) {
      showToast("Preencha empresa, contato e serviço de interesse.");
      return;
    }
    setStore((current) => ({
      ...current,
      leads: editingLead
        ? current.leads.map((item) => (item.id === lead.id ? lead : item))
        : [lead, ...current.leads],
    }));
    setModal(null);
    showToast(
      editingLead
        ? "Contato do CRM atualizado."
        : "Contato adicionado ao CRM.",
    );
  };

  const updateCrmStatus = (id: string, status: CrmStatus) => {
    setStore((current) => ({
      ...current,
      leads: current.leads.map((lead) =>
        lead.id === id ? { ...lead, status } : lead,
      ),
    }));
    showToast(`Contato movido para ${crmStatus[status].label}.`);
  };

  const deleteCrmLead = (id: string) => {
    const lead = store.leads.find((item) => item.id === id);
    if (!lead || !window.confirm(`Excluir ${lead.company} do CRM?`)) return;
    setStore((current) => ({
      ...current,
      leads: current.leads.filter((item) => item.id !== id),
    }));
    showToast("Contato removido do CRM.");
  };

  const switchView = (view: View) => {
    setActiveView(view);
    setSearch("");
    setMobileMenuOpen(false);
  };

  const toggleTheme = () => {
    setStore((current) => ({
      ...current,
      settings: {
        ...current.settings,
        theme: current.settings.theme === "light" ? "dark" : "light",
      },
    }));
  };

  const updateProjectProgress = (id: string, delta: number) => {
    const project = store.projects.find((item) => item.id === id);
    if (project && projectTaskStats(project, store.dailyTasks).total) {
      showToast("O progresso deste projeto é calculado pelas tarefas do Daily.");
      return;
    }
    setStore((current) => ({
      ...current,
      projects: current.projects.map((project) => {
        if (project.id !== id) return project;
        const progress = Math.min(100, Math.max(0, project.progress + delta));
        return {
          ...project,
          progress,
          manualProgress: progress,
          progressSource: "manual",
          status: progress === 100 ? "completed" : project.status,
        };
      }),
    }));
    showToast("Progresso do projeto atualizado.");
  };

  const completeRecurringCycle = (project: Project) => {
    if (!isRecurringProject(project)) return;
    const nextDueDate = nextRecurringDate(
      project.dueDate,
      project.recurrence ?? "monthly",
    );
    setStore((current) => {
      const nextProject: Project = {
        ...project,
        dueDate: nextDueDate,
        progress: 0,
        manualProgress: 0,
        progressCycleStartedAt: moveDate(currentDateKey(), 1),
        status: "planned",
        paidAmount: 0,
        pendingAmount: project.budget,
      };
      const alreadyScheduled = current.transactions.some(
        (transaction) =>
          transaction.source === "project" &&
          transaction.projectId === project.id &&
          transaction.dueDate === nextDueDate,
      );
      return {
        ...current,
        projects: current.projects.map((item) =>
          item.id === project.id ? nextProject : item,
        ),
        transactions:
          project.financialSync !== false && !alreadyScheduled
            ? [
                createProjectIncome(nextProject, "pending"),
                ...current.transactions,
              ]
            : current.transactions,
      };
    });
    showToast(
      project.financialSync === false
        ? `Ciclo concluído. Próxima entrega em ${dateLabel(nextDueDate)}.`
        : `Ciclo concluído. Próxima entrega e entrada criadas para ${dateLabel(nextDueDate)}.`,
    );
  };

  const moveProjectToStatus = (
    id: string,
    status: ProjectStatus,
    beforeProjectId?: string,
  ) => {
    const project = store.projects.find((item) => item.id === id);
    if (!project || beforeProjectId === id) return;

    setStore((current) => {
      const movingProject = current.projects.find((item) => item.id === id);
      if (!movingProject) return current;

      const projects = current.projects.filter((item) => item.id !== id);
      const progress =
        status === "completed"
          ? 100
          : movingProject.status === "completed" && movingProject.progress === 100
            ? 90
            : status === "in-progress" && movingProject.progress === 0
              ? 10
              : movingProject.progress;
      const movedProject = { ...movingProject, status, progress };

      if (beforeProjectId) {
        const targetIndex = projects.findIndex(
          (item) => item.id === beforeProjectId,
        );
        if (targetIndex >= 0) {
          projects.splice(targetIndex, 0, movedProject);
          return { ...current, projects };
        }
      }

      const lastColumnIndex = projects.findLastIndex(
        (item) => item.status === status,
      );
      projects.splice(lastColumnIndex + 1, 0, movedProject);
      return { ...current, projects };
    });

    setDraggedProjectId(null);
    setDragOverTarget(null);
    showToast(
      project.status === status
        ? "Ordem do quadro atualizada."
        : `Projeto movido para ${projectStatus[status].label}.`,
    );
  };

  const moveProjectOneColumn = (project: Project, direction: -1 | 1) => {
    const currentIndex = kanbanColumns.indexOf(project.status);
    const nextStatus = kanbanColumns[currentIndex + direction];
    if (nextStatus) moveProjectToStatus(project.id, nextStatus);
  };

  const saveProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const projectType: ProjectType =
      form.get("projectType") === "recurring" ? "recurring" : "one-off";
    const investment = Number(form.get("budget"));
    const paidAmount = Math.max(0, Number(form.get("paidAmount")) || 0);
    const pendingAmount = Math.max(0, investment - paidAmount);
    const enteredProgress = Math.min(
      100,
      Math.max(0, Number(form.get("progress")) || 0),
    );
    const project: Project = {
      id: editingProject?.id ?? uid(),
      title: String(form.get("title") || "").trim(),
      client: String(form.get("client") || "").trim(),
      category: String(form.get("category") || "Projeto").trim(),
      status: String(form.get("status")) as ProjectStatus,
      budget: investment,
      paidAmount,
      pendingAmount,
      dueDate: String(form.get("dueDate")),
      progress: enteredProgress,
      manualProgress:
        editingProject?.progressSource === "tasks"
          ? editingProject.manualProgress
          : enteredProgress,
      progressSource: editingProject?.progressSource ?? "manual",
      progressCycleStartedAt: editingProject?.progressCycleStartedAt,
      projectType,
      recurrence:
        projectType === "recurring"
          ? (String(form.get("recurrence")) as ProjectRecurrence)
          : undefined,
      financialSync: form.get("financialSync") === "on",
      createdAt: editingProject?.createdAt ?? new Date().toISOString(),
    };
    if (
      !project.title ||
      !project.client ||
      !project.dueDate ||
      (project.projectType === "recurring" && !project.recurrence) ||
      project.budget <= 0 ||
      project.paidAmount! > project.budget
    ) {
      showToast(
        project.paidAmount! > project.budget
          ? "O valor pago não pode ser maior que o investimento."
          : "Preencha os campos obrigatórios do projeto.",
      );
      return;
    }
    setStore((current) => {
      const projects = editingProject
        ? current.projects.map((item) =>
            item.id === editingProject.id ? project : item,
          )
        : [project, ...current.projects];
      return {
        ...current,
        projects: syncProjectTaskProgress(projects, current.dailyTasks),
        transactions: syncProjectIncome(
          current.transactions,
          project,
          editingProject,
        ),
      };
    });
    if (project.financialSync) {
      setSelectedMonth(project.dueDate.slice(0, 7));
    }
    setModal(null);
    showToast(
      editingProject
        ? project.financialSync
          ? "Projeto e entrada financeira atualizados."
          : "Projeto atualizado sem entrada financeira."
        : project.financialSync
          ? "Projeto criado com entrada no Financeiro."
          : "Projeto criado sem entrada financeira.",
    );
  };

  const saveTransaction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const transaction: Transaction = {
      id: editingTransaction?.id ?? uid(),
      title: String(form.get("title") || "").trim(),
      category: String(form.get("category") || "").trim(),
      kind: String(form.get("kind")) as TransactionKind,
      status: String(form.get("status")) as TransactionStatus,
      amount: Number(form.get("amount")),
      dueDate: String(form.get("dueDate")),
      projectId: String(form.get("projectId") || "") || undefined,
      createdAt: editingTransaction?.createdAt ?? new Date().toISOString(),
    };
    if (
      !transaction.title ||
      !transaction.category ||
      !transaction.dueDate ||
      transaction.amount <= 0
    ) {
      showToast("Preencha os campos obrigatórios da transação.");
      return;
    }
    setStore((current) => ({
      ...current,
      transactions: editingTransaction
        ? current.transactions.map((item) =>
            item.id === editingTransaction.id ? transaction : item,
          )
        : [transaction, ...current.transactions],
    }));
    setSelectedMonth(transaction.dueDate.slice(0, 7));
    setModal(null);
    setActiveView("finance");
    showToast(
      editingTransaction
        ? "Alterações do lançamento salvas."
        : "Transação adicionada ao fluxo financeiro.",
    );
  };

  const deleteTransaction = (id: string) => {
    const transaction = store.transactions.find((item) => item.id === id);
    setStore((current) => ({
      ...current,
      projects:
        transaction?.source === "project" &&
        transaction.status === "pending" &&
        transaction.projectId
          ? current.projects.map((project) =>
              project.id === transaction.projectId
                ? { ...project, financialSync: false }
                : project,
            )
          : current.projects,
      transactions: current.transactions.filter(
        (currentTransaction) => currentTransaction.id !== id,
      ),
    }));
    showToast(
      transaction?.source === "project" && transaction.status === "pending"
        ? "Entrada removida e sincronização financeira desativada no projeto."
        : "Transação removida.",
    );
  };

  const markTransactionPaid = (id: string) => {
    const transaction = store.transactions.find((item) => item.id === id);
    setStore((current) => ({
      ...current,
      projects:
        transaction?.source === "project" && transaction.projectId
          ? current.projects.map((project) =>
              project.id === transaction.projectId
                ? {
                    ...project,
                    paidAmount: Math.min(
                      project.budget,
                      projectPaidAmount(project) + transaction.amount,
                    ),
                    pendingAmount: Math.max(
                      0,
                      projectPendingAmount(project) - transaction.amount,
                    ),
                  }
                : project,
            )
          : current.projects,
      transactions: current.transactions.map((currentTransaction) =>
        currentTransaction.id === id
          ? {
              ...currentTransaction,
              status: "paid",
              paymentPart:
                currentTransaction.source === "project"
                  ? "paid"
                  : currentTransaction.paymentPart,
              title:
                currentTransaction.source === "project"
                  ? currentTransaction.title.replace(
                      /^Valor pendente/,
                      "Valor pago",
                    )
                  : currentTransaction.title,
            }
          : currentTransaction,
      ),
    }));
    showToast(
      transaction?.source === "project"
        ? "Pagamento realizado e valores do projeto atualizados."
        : "Transação marcada como realizada.",
    );
  };

  const exportBackup = () => {
    const exportedAt = new Date().toISOString();
    const payload = {
      app: APP_ID,
      exportVersion: 1,
      exportedAt,
      data: { ...store, lastUpdated: exportedAt },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `estudio-fluxo-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Backup exportado. Guarde o arquivo em local seguro.");
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as {
        app?: string;
        data?: unknown;
      };
      if (parsed.app !== APP_ID || !isValidStore(parsed.data)) {
        throw new Error("invalid");
      }
      setStore(
        syncMissingProjectIncome({
          ...parsed.data,
          lastUpdated: new Date().toISOString(),
        }),
      );
      setSelectedMonth(DEFAULT_MONTH);
      setSelectedDailyDate(currentDateKey());
      showToast("Backup importado com sucesso.");
    } catch {
      showToast("Arquivo inválido. Use um backup JSON exportado por este app.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const resetSampleData = () => {
    if (
      !window.confirm(
        "Restaurar os dados de exemplo? Os dados atuais deste navegador serão substituídos.",
      )
    ) {
      return;
    }
    setStore(syncMissingProjectIncome(createSampleStore()));
    setSelectedMonth(DEFAULT_MONTH);
    setSelectedDailyDate(currentDateKey());
    showToast("Dados de exemplo restaurados.");
  };

  const navItems: {
    id: View;
    label: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  }[] = [
    { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
    { id: "daily", label: "Daily Work", icon: ListTodo },
    { id: "crm", label: "CRM", icon: Building2 },
    { id: "projects", label: "Projetos", icon: FolderKanban },
    { id: "kanban", label: "Flooow", icon: Columns3 },
    { id: "finance", label: "Financeiro", icon: WalletCards },
    { id: "backup", label: "Dados e backup", icon: Database },
    { id: "account", label: "Conta", icon: Settings },
  ];

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const { error } = await createClient().auth.signOut({ scope: "local" });
    if (error) {
      setSigningOut(false);
      setToast("Não foi possível sair. Tente novamente.");
      return;
    }
    window.location.replace("/login");
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    const { error } = await createClient().auth.updateUser({
      data: {
        full_name: profile.fullName.trim(),
        business_name: profile.businessName.trim(),
        phone: profile.phone.trim(),
      },
    });
    setSavingProfile(false);
    showToast(error ? "Não foi possível salvar o perfil." : "Perfil atualizado.");
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="brand" aria-label="Dash Upboard">
          <Image
            className="brand-logo"
            src="/logo-dashupboard.svg"
            alt="Dash Upboard"
            width={1400}
            height={531}
            priority
          />
        </div>

        <p className="nav-label">Seu estúdio</p>
        <nav className="side-nav" aria-label="Navegação principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                className={activeView === item.id ? "active" : ""}
                onClick={() => switchView(item.id)}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-note">
          <div className="save-dot" />
          <div>
            <strong>Salvamento automático</strong>
            <span>{saveError ? "Cópia local ativa" : "Nuvem e dispositivo"}</span>
          </div>
        </div>

        <div className="profile">
          <span className="profile-avatar">{user.email.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong title={user.email}>{user.email}</strong>
            <span>Dados privados desta conta</span>
          </div>
          <ShieldCheck size={18} />
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <IconButton
              label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="menu-button"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </IconButton>
            <label className="search-box">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Buscar</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar em tarefas, projetos, CRM e finanças…"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setSearch("")}
                >
                  <X size={16} />
                </button>
              )}
            </label>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="button secondary"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? "Saindo…" : "Sair"}
            </button>
            <span className="local-status">
              <span className="save-dot" />
              {saveError
                ? "Sem sincronização — cópia local salva"
                : syncing
                  ? "Sincronizando…"
                  : "Sincronizado na nuvem"}
            </span>
            <IconButton
              label={
                store.settings.theme === "light"
                  ? "Ativar tema escuro"
                  : "Ativar tema claro"
              }
              onClick={toggleTheme}
            >
              {store.settings.theme === "light" ? (
                <Moon size={19} />
              ) : (
                <Sun size={19} />
              )}
            </IconButton>
          </div>
        </header>

        <div className="content">
          {activeView === "dashboard" && (
            <>
              <section className="page-heading dashboard-heading">
                <div>
                  <span className="eyebrow">Painel do mês</span>
                  <h1>Visão geral</h1>
                  <p>O ritmo operacional e financeiro do seu estúdio.</p>
                </div>
                <div className="heading-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={exportBackup}
                  >
                    <FileDown size={18} />
                    Exportar backup
                  </button>
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => setModal({ kind: "transaction" })}
                  >
                    <Plus size={18} />
                    Nova transação
                  </button>
                </div>
              </section>

              <section className="month-pulse" aria-label="Mês selecionado">
                <IconButton
                  label="Mês anterior"
                  onClick={() =>
                    setSelectedMonth((month) => moveMonth(month, -1))
                  }
                >
                  <ChevronLeft size={18} />
                </IconButton>
                <div>
                  <span>Você está vendo</span>
                  <strong>{monthLabel(selectedMonth)}</strong>
                </div>
                <div className="pulse-line" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, Math.max(8, financials.received / store.settings.monthlyGoal * 100))}%` }} />
                </div>
                <span className="goal-label">
                  {Math.round(
                    (financials.received / store.settings.monthlyGoal) * 100,
                  )}
                  % da meta
                </span>
                <IconButton
                  label="Próximo mês"
                  onClick={() =>
                    setSelectedMonth((month) => moveMonth(month, 1))
                  }
                >
                  <ChevronRight size={18} />
                </IconButton>
              </section>

              <section className="metrics-grid" aria-label="Resumo financeiro">
                <article className="metric-card featured">
                  <div className="metric-top">
                    <span>Saldo realizado</span>
                    <CircleDollarSign size={20} />
                  </div>
                  <strong>{money(financials.result)}</strong>
                  <p className={financials.result >= 0 ? "positive" : "negative"}>
                    {financials.result >= 0 ? (
                      <ArrowUpRight size={16} />
                    ) : (
                      <ArrowDownRight size={16} />
                    )}
                    Entradas menos saídas pagas
                  </p>
                </article>
                <article className="metric-card">
                  <div className="metric-top">
                    <span>Total recebido</span>
                    <TrendingUp size={20} />
                  </div>
                  <strong>{money(financials.received)}</strong>
                  <div className="mini-progress">
                    <span
                      style={{
                        width: `${Math.min(
                          100,
                          (financials.received /
                            store.settings.monthlyGoal) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                  <p>
                    Meta do mês: {money(store.settings.monthlyGoal)}
                  </p>
                </article>
                <article className="metric-card">
                  <div className="metric-top">
                    <span>Saídas do mês</span>
                    <ReceiptText size={20} />
                  </div>
                  <strong>{money(financials.paidExpenses)}</strong>
                  <p>
                    + {money(financials.payable)} ainda a pagar
                  </p>
                </article>
                <article className="metric-card">
                  <div className="metric-top">
                    <span>A receber</span>
                    <Target size={20} />
                  </div>
                  <strong>{money(financials.receivable)}</strong>
                  <p>Previsão final: {money(financials.forecast)}</p>
                </article>
              </section>

              <section className="dashboard-grid">
                <article className="panel project-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">Produção</span>
                      <h2>Projetos em movimento</h2>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => switchView("projects")}
                    >
                      Ver todos <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="project-list">
                    {activeProjects.length ? (
                      activeProjects.slice(0, 3).map((project) => (
                        <div className="project-row" key={project.id}>
                          <div className="project-icon">
                            <BriefcaseBusiness size={20} />
                          </div>
                          <div className="project-copy">
                            <strong>{project.title}</strong>
                            <span>
                              {project.client} ·{" "}
                              {isRecurringProject(project)
                                ? "Próxima entrega"
                                : "Entrega"}{" "}
                              {dateLabel(project.dueDate)}
                            </span>
                          </div>
                          <div className="project-value">
                            <strong>{money(project.budget)}</strong>
                            <div>
                              <span className="progress-track">
                                <span style={{ width: `${project.progress}%` }} />
                              </span>
                              <small>{project.progress}%</small>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title="Nenhum projeto ativo"
                        text="Crie um projeto para acompanhar investimento, prazo e progresso."
                      />
                    )}
                  </div>
                </article>

                <article className="panel upcoming-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">Agenda financeira</span>
                      <h2>Próximos 7 dias</h2>
                    </div>
                    <Clock3 size={20} />
                  </div>
                  <div className="upcoming-list">
                    {upcoming.length ? (
                      upcoming.map((transaction) => (
                        <div className="upcoming-row" key={transaction.id}>
                          <div>
                            <strong>{transaction.title}</strong>
                            <span>
                              <CalendarDays size={14} />
                              {dateLabel(transaction.dueDate)}
                            </span>
                          </div>
                          <span
                            className={`amount-pill ${transaction.kind}`}
                          >
                            {transaction.kind === "income" ? "+" : "−"}
                            {money(transaction.amount)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title="Agenda livre"
                        text="Não há valores pendentes nos próximos sete dias."
                      />
                    )}
                  </div>
                </article>
              </section>

              <section className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">Pulso financeiro</span>
                    <h2>Entradas e saídas em 6 meses</h2>
                  </div>
                  <div className="chart-legend">
                    <span><i className="income-dot" />Entradas</span>
                    <span><i className="expense-dot" />Saídas</span>
                  </div>
                </div>
                <div className="bar-chart">
                  {chartData.map((item) => (
                    <div className="bar-group" key={item.month}>
                      <div className="bars">
                        <span
                          className="bar income-bar"
                          style={{
                            height: `${Math.max(
                              4,
                              (item.income / maxChartValue) * 100,
                            )}%`,
                          }}
                          title={`Entradas: ${money(item.income)}`}
                          aria-label={`${monthLabel(item.month)} — entradas ${money(item.income)}`}
                        />
                        <span
                          className="bar expense-bar"
                          style={{
                            height: `${Math.max(
                              4,
                              (item.expense / maxChartValue) * 100,
                            )}%`,
                          }}
                          title={`Saídas: ${money(item.expense)}`}
                          aria-label={`${monthLabel(item.month)} — saídas ${money(item.expense)}`}
                        />
                      </div>
                      <span>
                        {new Intl.DateTimeFormat("pt-BR", {
                          month: "short",
                        })
                          .format(
                            new Date(
                              Number(item.month.slice(0, 4)),
                              Number(item.month.slice(5)) - 1,
                              1,
                            ),
                          )
                          .replace(".", "")}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {activeView === "daily" && (
            <>
              <section className="page-heading daily-heading">
                <div>
                  <span className="eyebrow">Ritual de execução</span>
                  <h1>Daily Work</h1>
                  <p>
                    Organize o que importa hoje. As rotinas renovam sozinhas
                    no próximo dia.
                  </p>
                </div>
                <div className="daily-heading-actions">
                  <button
                    type="button"
                    className="button secondary alarm-test-button"
                    onClick={testDailyAlarm}
                  >
                    <BellRing size={17} />
                    Testar som
                  </button>
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => setModal({ kind: "daily" })}
                  >
                    <Plus size={18} />
                    Nova tarefa
                  </button>
                </div>
              </section>

              <section className="daily-pulse" aria-label="Resumo do dia">
                <div className="daily-date-card">
                  <IconButton
                    label="Dia anterior"
                    onClick={() =>
                      setSelectedDailyDate((date) => moveDate(date, -1))
                    }
                  >
                    <ChevronLeft size={18} />
                  </IconButton>
                  <div>
                    <span>
                      {selectedDailyDate === currentDateKey()
                        ? "Hoje"
                        : "Dia selecionado"}
                    </span>
                    <strong>{dailyDateLabel(selectedDailyDate)}</strong>
                  </div>
                  <IconButton
                    label="Próximo dia"
                    onClick={() =>
                      setSelectedDailyDate((date) => moveDate(date, 1))
                    }
                  >
                    <ChevronRight size={18} />
                  </IconButton>
                </div>
                <div className="daily-progress-card">
                  <div>
                    <span>Ritmo do dia</span>
                    <strong>{dailySummary.progress}%</strong>
                  </div>
                  <div
                    className="daily-progress-bar"
                    aria-label={`${dailySummary.progress}% concluído`}
                  >
                    <span style={{ width: `${dailySummary.progress}%` }} />
                  </div>
                  <small>
                    {dailySummary.done} de {dailySummary.total} tarefas
                    concluídas
                  </small>
                </div>
                <div className="daily-stat-card">
                  <span>Pendentes</span>
                  <strong>{dailySummary.pending}</strong>
                  <small>Para encerrar o dia</small>
                </div>
                <div className="daily-stat-card recurring">
                  <span>Renovação diária</span>
                  <strong>{dailySummary.recurring}</strong>
                  <small>Reaparecem amanhã</small>
                </div>
              </section>

              <div className="daily-toolbar">
                <div
                  className="filter-row compact"
                  role="group"
                  aria-label="Filtrar tarefas diárias"
                >
                  {(["all", "pending", "done"] as const).map((filter) => (
                    <button
                      type="button"
                      key={filter}
                      className={dailyFilter === filter ? "active" : ""}
                      onClick={() => setDailyFilter(filter)}
                    >
                      {filter === "all"
                        ? "Todas"
                        : filter === "pending"
                          ? "Pendentes"
                          : "Concluídas"}
                    </button>
                  ))}
                </div>
                {selectedDailyDate !== currentDateKey() && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setSelectedDailyDate(currentDateKey())}
                  >
                    <CalendarDays size={15} /> Voltar para hoje
                  </button>
                )}
              </div>

              <section className="daily-board" aria-label="Tarefas do dia">
                {dailyAreaOrder.map((area) => {
                  const areaTasks = visibleDailyTasks.filter(
                    (task) => task.area === area,
                  );
                  const areaTotal = dailyTasksForDate.filter(
                    (task) => task.area === area,
                  ).length;
                  return (
                    <section
                      className={`daily-column ${dailyAreas[area].className}`}
                      key={area}
                      aria-labelledby={`daily-area-${area}`}
                    >
                      <header>
                        <div className="daily-column-mark">
                          {area === "focus" ? (
                            <Target size={18} />
                          ) : area === "routine" ? (
                            <Repeat2 size={18} />
                          ) : (
                            <Timer size={18} />
                          )}
                        </div>
                        <div>
                          <h2 id={`daily-area-${area}`}>
                            {dailyAreas[area].label}
                          </h2>
                          <p>{dailyAreas[area].description}</p>
                        </div>
                        <span className="daily-column-count">{areaTotal}</span>
                      </header>
                      <div className="daily-task-list">
                        {areaTasks.length ? (
                          areaTasks.map((task) => {
                            const done = task.completedDates.includes(
                              selectedDailyDate,
                            );
                            const linkedProject = task.projectId
                              ? store.projects.find(
                                  (project) => project.id === task.projectId,
                                )
                              : undefined;
                            return (
                              <article
                                className={`daily-task-card ${done ? "done" : ""}`}
                                key={task.id}
                              >
                                <label className="daily-check">
                                  <input
                                    type="checkbox"
                                    checked={done}
                                    onChange={() => toggleDailyTask(task.id)}
                                    aria-label={`${done ? "Reabrir" : "Concluir"} ${task.title}`}
                                  />
                                  <span aria-hidden="true">
                                    <Check size={15} />
                                  </span>
                                </label>
                                <div className="daily-task-copy">
                                  <strong>{task.title}</strong>
                                  {task.notes && <p>{task.notes}</p>}
                                  <div className="daily-task-meta">
                                    {task.time && (
                                      <span>
                                        <Clock3 size={13} /> {task.time}
                                      </span>
                                    )}
                                    {task.alarmMinutes && (
                                      <span className="task-alarm">
                                        <BellRing size={13} />
                                        {dailyAlarmOptions[task.alarmMinutes]}
                                      </span>
                                    )}
                                    {task.estimatedMinutes > 0 && (
                                      <span>
                                        <Timer size={13} /> {task.estimatedMinutes}
                                        min
                                      </span>
                                    )}
                                    <span className={task.recurring ? "recurring" : "single"}>
                                      {task.recurring ? (
                                        <Repeat2 size={13} />
                                      ) : (
                                        <CalendarDays size={13} />
                                      )}
                                      {task.recurring ? "Todo dia" : "Só hoje"}
                                    </span>
                                    {linkedProject && (
                                      <span className="linked-project">
                                        <BriefcaseBusiness size={13} />
                                        {linkedProject.title}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="daily-task-actions">
                                  <IconButton
                                    label={`Editar ${task.title}`}
                                    onClick={() =>
                                      setModal({ kind: "daily", itemId: task.id })
                                    }
                                  >
                                    <PencilLine size={15} />
                                  </IconButton>
                                  <IconButton
                                    label={`Excluir ${task.title}`}
                                    onClick={() => deleteDailyTask(task.id)}
                                    className="danger"
                                  >
                                    <Trash2 size={15} />
                                  </IconButton>
                                </div>
                              </article>
                            );
                          })
                        ) : (
                          <div className="daily-column-empty">
                            <span />
                            <p>
                              {areaTotal
                                ? "Nenhuma tarefa neste filtro."
                                : "Nenhuma tarefa para este bloco."}
                            </p>
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })}
              </section>

              <section
                className="daily-calendar panel"
                aria-labelledby="daily-calendar-title"
              >
                <header className="daily-calendar-heading">
                  <div className="daily-calendar-intro">
                    <span className="eyebrow">Histórico de execução</span>
                    <h2 id="daily-calendar-title">Calendário de tarefas</h2>
                    <p>
                      Consulte, marque e edite cada registro. Os checks ficam
                      guardados na data em que foram feitos.
                    </p>
                  </div>
                  <div className="daily-calendar-controls">
                    <div
                      className="calendar-view-switch"
                      role="group"
                      aria-label="Visualização do calendário"
                    >
                      {(["day", "week", "month"] as const).map((view) => (
                        <button
                          type="button"
                          key={view}
                          className={dailyCalendarView === view ? "active" : ""}
                          aria-pressed={dailyCalendarView === view}
                          onClick={() => setDailyCalendarView(view)}
                        >
                          {view === "day" ? "Dia" : view === "week" ? "Semana" : "Mês"}
                        </button>
                      ))}
                    </div>
                    <div className="calendar-period-nav">
                      <IconButton
                        label="Período anterior"
                        onClick={() =>
                          setSelectedDailyDate((date) =>
                            moveCalendarDate(date, dailyCalendarView, -1),
                          )
                        }
                      >
                        <ChevronLeft size={17} />
                      </IconButton>
                      <button
                        type="button"
                        className="calendar-today-button"
                        onClick={() => setSelectedDailyDate(currentDateKey())}
                      >
                        Hoje
                      </button>
                      <IconButton
                        label="Próximo período"
                        onClick={() =>
                          setSelectedDailyDate((date) =>
                            moveCalendarDate(date, dailyCalendarView, 1),
                          )
                        }
                      >
                        <ChevronRight size={17} />
                      </IconButton>
                    </div>
                  </div>
                </header>

                <div className="daily-calendar-period">
                  <div>
                    <CalendarDays size={18} />
                    <strong>{dailyCalendarTitle}</strong>
                  </div>
                  <span>
                    {dailyCalendarSummary.done} de {dailyCalendarSummary.total}{" "}
                    registros concluídos
                  </span>
                </div>

                {dailyCalendarView === "day" ? (
                  <div className="daily-calendar-agenda">
                    <aside className="calendar-day-stamp">
                      <span>{calendarWeekdayLabel(selectedDailyDate)}</span>
                      <strong>{Number(selectedDailyDate.slice(-2))}</strong>
                      <small>{monthLabel(selectedDailyDate.slice(0, 7))}</small>
                      <div
                        className="calendar-day-progress"
                        aria-label={`${dailyCalendar[0]?.progress ?? 0}% concluído`}
                      >
                        <span
                          style={{ width: `${dailyCalendar[0]?.progress ?? 0}%` }}
                        />
                      </div>
                    </aside>
                    <div className="calendar-agenda-list">
                      {dailyCalendar[0]?.tasks.length ? (
                        dailyCalendar[0].tasks.map((task) => {
                          const done = task.completedDates.includes(
                            selectedDailyDate,
                          );
                          const linkedProject = task.projectId
                            ? store.projects.find(
                                (project) => project.id === task.projectId,
                              )
                            : undefined;
                          return (
                            <article
                              className={`calendar-agenda-record ${done ? "done" : ""}`}
                              key={task.id}
                            >
                              <label className="daily-check">
                                <input
                                  type="checkbox"
                                  checked={done}
                                  onChange={() =>
                                    toggleDailyTask(task.id, selectedDailyDate)
                                  }
                                  aria-label={`${done ? "Reabrir" : "Concluir"} ${task.title}`}
                                />
                                <span aria-hidden="true">
                                  <Check size={15} />
                                </span>
                              </label>
                              <button
                                type="button"
                                className="calendar-record-copy"
                                onClick={() =>
                                  setModal({ kind: "daily", itemId: task.id })
                                }
                              >
                                <span>{task.time || "Sem horário"}</span>
                                <strong>{task.title}</strong>
                                <small>
                                  {linkedProject
                                    ? `${dailyAreas[task.area].label} · ${linkedProject.title}`
                                    : dailyAreas[task.area].label}
                                </small>
                              </button>
                              <IconButton
                                label={`Editar ${task.title}`}
                                onClick={() =>
                                  setModal({ kind: "daily", itemId: task.id })
                                }
                              >
                                <PencilLine size={15} />
                              </IconButton>
                            </article>
                          );
                        })
                      ) : (
                        <div className="calendar-empty-period">
                          <CalendarDays size={22} />
                          <strong>Dia livre</strong>
                          <p>Nenhuma tarefa registrada nesta data.</p>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => setModal({ kind: "daily" })}
                          >
                            <Plus size={15} /> Adicionar tarefa
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : dailyCalendarView === "week" ? (
                  <div
                    className="daily-calendar-week"
                    key={`week-${dailyCalendar[0]?.date ?? selectedDailyDate}`}
                  >
                    <div className="calendar-week-grid">
                      {dailyCalendar.map((day) => {
                        const isToday = day.date === currentDateKey();
                        const isSelected = day.date === selectedDailyDate;
                        return (
                          <article
                            className={`calendar-week-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`}
                            key={day.date}
                          >
                            <button
                              type="button"
                              className="calendar-week-date"
                              onClick={() => setSelectedDailyDate(day.date)}
                              aria-label={`Selecionar ${dailyDateLabel(day.date)}`}
                            >
                              <span>{calendarWeekdayLabel(day.date)}</span>
                              <strong>{Number(day.date.slice(-2))}</strong>
                              <small>{day.done}/{day.tasks.length}</small>
                            </button>
                            <div className="calendar-week-progress">
                              <span style={{ width: `${day.progress}%` }} />
                            </div>
                            <div className="calendar-week-records">
                              {day.tasks.length ? (
                                day.tasks.map((task) => {
                                  const done = task.completedDates.includes(day.date);
                                  return (
                                    <button
                                      type="button"
                                      className={`calendar-task-chip area-${task.area} ${done ? "done" : ""}`}
                                      key={task.id}
                                      onClick={() => {
                                        setSelectedDailyDate(day.date);
                                        setModal({ kind: "daily", itemId: task.id });
                                      }}
                                      title={`${task.time ? `${task.time} · ` : ""}${task.title}`}
                                    >
                                      {done && <Check size={12} />}
                                      <span>{task.time && <small>{task.time}</small>}{task.title}</span>
                                    </button>
                                  );
                                })
                              ) : (
                                <button
                                  type="button"
                                  className="calendar-add-record"
                                  onClick={() => {
                                    setSelectedDailyDate(day.date);
                                    setModal({ kind: "daily" });
                                  }}
                                >
                                  <Plus size={14} /> Registrar
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div
                    className="daily-calendar-month"
                    key={`month-${selectedDailyDate.slice(0, 7)}`}
                  >
                    <div className="calendar-month-weekdays" aria-hidden="true">
                      {dailyCalendar.slice(0, 7).map((day) => (
                        <span key={day.date}>{calendarWeekdayLabel(day.date, true)}</span>
                      ))}
                    </div>
                    <div className="calendar-month-grid">
                      {dailyCalendar.map((day) => {
                        const isToday = day.date === currentDateKey();
                        const isSelected = day.date === selectedDailyDate;
                        const outsideMonth =
                          day.date.slice(0, 7) !== selectedDailyDate.slice(0, 7);
                        return (
                          <article
                            className={`calendar-month-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${outsideMonth ? "outside" : ""}`}
                            key={day.date}
                          >
                            <button
                              type="button"
                              className="calendar-month-date"
                              onClick={() => setSelectedDailyDate(day.date)}
                              aria-label={`Selecionar ${dailyDateLabel(day.date)}`}
                            >
                              <span>{Number(day.date.slice(-2))}</span>
                              {day.tasks.length > 0 && (
                                <small>{day.done}/{day.tasks.length}</small>
                              )}
                            </button>
                            <div className="calendar-month-records">
                              {day.tasks.slice(0, 3).map((task) => {
                                const done = task.completedDates.includes(day.date);
                                return (
                                  <button
                                    type="button"
                                    className={`calendar-task-chip area-${task.area} ${done ? "done" : ""}`}
                                    key={task.id}
                                    onClick={() => {
                                      setSelectedDailyDate(day.date);
                                      setModal({ kind: "daily", itemId: task.id });
                                    }}
                                    title={`${task.time ? `${task.time} · ` : ""}${task.title}`}
                                  >
                                    {done && <Check size={11} />}
                                    <span>{task.title}</span>
                                  </button>
                                );
                              })}
                              {day.tasks.length > 3 && (
                                <button
                                  type="button"
                                  className="calendar-more-records"
                                  onClick={() => {
                                    setSelectedDailyDate(day.date);
                                    setDailyCalendarView("day");
                                  }}
                                >
                                  +{day.tasks.length - 3} registros
                                </button>
                              )}
                            </div>
                            <div className="calendar-month-progress">
                              <span style={{ width: `${day.progress}%` }} />
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            </>
          )}

          {activeView === "crm" && (
            <>
              <section className="page-heading">
                <div>
                  <span className="eyebrow">Relacionamento comercial</span>
                  <h1>CRM</h1>
                  <p>
                    Contatos, oportunidades e próximas ações em uma única fila.
                  </p>
                </div>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => setModal({ kind: "crm" })}
                >
                  <Plus size={18} />
                  Novo contato
                </button>
              </section>

              <section className="crm-summary" aria-label="Resumo do CRM">
                <article>
                  <span>Oportunidades abertas</span>
                  <strong>{crmSummary.open}</strong>
                  <small>Em sondagem, abordagem ou FlowUp</small>
                </article>
                <article>
                  <span>Potencial em aberto</span>
                  <strong>{money(crmSummary.potential)}</strong>
                  <small>Soma das oportunidades ativas</small>
                </article>
                <article className={crmSummary.followUps ? "needs-attention" : ""}>
                  <span>Ações para hoje</span>
                  <strong>{crmSummary.followUps}</strong>
                  <small>Follow-ups vencidos ou programados</small>
                </article>
                <article>
                  <span>Negócios fechados</span>
                  <strong>{crmSummary.closed}</strong>
                  <small>Prontos para virar projeto</small>
                </article>
              </section>

              <div className="crm-toolbar">
                <div
                  className="filter-row compact"
                  role="group"
                  aria-label="Filtrar contatos do CRM"
                >
                  {(["all", ...crmStatusOrder] as const).map((filter) => (
                    <button
                      type="button"
                      key={filter}
                      className={crmFilter === filter ? "active" : ""}
                      onClick={() => setCrmFilter(filter)}
                    >
                      {filter === "all" ? "Todos" : crmStatus[filter].label}
                      <span>
                        {filter === "all"
                          ? store.leads.length
                          : store.leads.filter((lead) => lead.status === filter)
                              .length}
                      </span>
                    </button>
                  ))}
                </div>
                <span className="crm-result-count">
                  {filteredLeads.length}{" "}
                  {filteredLeads.length === 1 ? "contato" : "contatos"}
                </span>
              </div>

              <section className="panel crm-panel">
                {filteredLeads.length ? (
                  <div className="crm-table" role="table" aria-label="Contatos do CRM">
                    <div className="crm-table-head" role="row">
                      <span role="columnheader">Cliente / empresa</span>
                      <span role="columnheader">Status</span>
                      <span role="columnheader">Contato</span>
                      <span role="columnheader">Interesse</span>
                      <span role="columnheader">Valor potencial</span>
                      <span role="columnheader">Próxima ação</span>
                      <span className="sr-only" role="columnheader">
                        Ações
                      </span>
                    </div>
                    <div className="crm-table-body">
                      {filteredLeads.map((lead) => {
                        const actionIsDue =
                          lead.status !== "closed" &&
                          Boolean(lead.nextActionDate) &&
                          lead.nextActionDate <= currentDateKey();
                        return (
                          <article className="crm-row" role="row" key={lead.id}>
                            <div className="crm-company-cell" role="cell" data-label="Cliente / empresa">
                              <span className="crm-company-mark" aria-hidden="true">
                                {lead.company.slice(0, 2).toLocaleUpperCase("pt-BR")}
                              </span>
                              <div>
                                <strong>{lead.company}</strong>
                                <small>Desde {dateLabel(lead.createdAt.slice(0, 10))}</small>
                              </div>
                            </div>
                            <div className="crm-status-cell" role="cell" data-label="Status">
                              <select
                                className={`crm-status-select ${crmStatus[lead.status].className}`}
                                value={lead.status}
                                onChange={(event) =>
                                  updateCrmStatus(
                                    lead.id,
                                    event.target.value as CrmStatus,
                                  )
                                }
                                aria-label={`Status de ${lead.company}`}
                              >
                                {crmStatusOrder.map((status) => (
                                  <option value={status} key={status}>
                                    {crmStatus[status].label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="crm-contact-cell" role="cell" data-label="Contato">
                              <strong>{lead.contactName}</strong>
                              <small>{lead.contact || "Contato não informado"}</small>
                            </div>
                            <div className="crm-service-cell" role="cell" data-label="Interesse">
                              <span>{lead.service}</span>
                            </div>
                            <div className="crm-value-cell" role="cell" data-label="Valor potencial">
                              <strong>{money(lead.potentialValue)}</strong>
                            </div>
                            <div
                              className={`crm-next-action ${actionIsDue ? "due" : ""}`}
                              role="cell"
                              data-label="Próxima ação"
                            >
                              <strong>{lead.nextAction || "Definir próxima ação"}</strong>
                              <small>
                                {lead.nextActionDate
                                  ? `${actionIsDue ? "Atenção · " : ""}${dateLabel(lead.nextActionDate)}`
                                  : "Sem data definida"}
                              </small>
                            </div>
                            <div className="crm-row-actions" role="cell">
                              <IconButton
                                label={`Editar ${lead.company}`}
                                onClick={() =>
                                  setModal({ kind: "crm", itemId: lead.id })
                                }
                              >
                                <PencilLine size={16} />
                              </IconButton>
                              <IconButton
                                label={`Excluir ${lead.company}`}
                                onClick={() => deleteCrmLead(lead.id)}
                                className="danger"
                              >
                                <Trash2 size={16} />
                              </IconButton>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="Nenhum contato encontrado"
                    text="Adicione uma oportunidade ou ajuste os filtros para continuar seu relacionamento comercial."
                    action={
                      <button
                        type="button"
                        className="button primary"
                        onClick={() => setModal({ kind: "crm" })}
                      >
                        <Plus size={17} /> Novo contato
                      </button>
                    }
                  />
                )}
              </section>
            </>
          )}

          {activeView === "projects" && (
            <>
              <section className="page-heading">
                <div>
                  <span className="eyebrow">Operação</span>
                  <h1>Projetos</h1>
                  <p>Prazo, investimento e andamento em uma única visão.</p>
                </div>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => openProjectModal()}
                >
                  <Plus size={18} />
                  Novo projeto
                </button>
              </section>

              <section className="summary-strip">
                <div>
                  <span>Investimento total</span>
                  <strong>
                    {money(
                      store.projects.reduce(
                        (sum, project) => sum + project.budget,
                        0,
                      ),
                    )}
                  </strong>
                </div>
                <div>
                  <span>Em andamento</span>
                  <strong>
                    {
                      store.projects.filter(
                        (project) => project.status === "in-progress",
                      ).length
                    }
                  </strong>
                </div>
                <div>
                  <span>Progresso médio</span>
                  <strong>
                    {store.projects.length
                      ? Math.round(
                          store.projects.reduce(
                            (sum, project) => sum + project.progress,
                            0,
                          ) / store.projects.length,
                        )
                      : 0}
                    %
                  </strong>
                </div>
              </section>

              <div className="filter-row" role="group" aria-label="Filtrar projetos">
                {(["all", "in-progress", "planned", "paused", "completed"] as const).map(
                  (filter) => (
                    <button
                      type="button"
                      key={filter}
                      className={projectFilter === filter ? "active" : ""}
                      onClick={() => setProjectFilter(filter)}
                    >
                      {filter === "all"
                        ? "Todos"
                        : projectStatus[filter].label}
                    </button>
                  ),
                )}
              </div>

              <section className="project-card-grid">
                {filteredProjects.length ? (
                  filteredProjects.map((project) => {
                    const taskStats = projectTaskStats(
                      project,
                      store.dailyTasks,
                    );
                    return (
                      <article className="project-card" key={project.id}>
                      <div className="project-card-top">
                        <span
                          className={`status-badge ${
                            projectStatus[project.status].className
                          }`}
                        >
                          {project.status === "completed" ? (
                            <CheckCircle2 size={14} />
                          ) : project.status === "paused" ? (
                            <PauseCircle size={14} />
                          ) : (
                            <span className="status-dot" />
                          )}
                          {projectStatus[project.status].label}
                        </span>
                        <div className="project-card-tags">
                          {isRecurringProject(project) && (
                            <span className="recurrence-badge">
                              <RotateCcw size={11} />
                              {recurrenceOptions[project.recurrence ?? "monthly"].label}
                            </span>
                          )}
                          <span className="project-category">
                            {project.category}
                          </span>
                        </div>
                      </div>
                      <div className="project-card-copy">
                        <h2>{project.title}</h2>
                        <p>{project.client}</p>
                      </div>
                      <div className="project-card-data">
                        <div>
                          <span>Investimento</span>
                          <strong>{money(project.budget)}</strong>
                        </div>
                        <div>
                          <span>
                            {isRecurringProject(project)
                              ? "Próxima entrega"
                              : "Entrega"}
                          </span>
                          <strong>{dateLabel(project.dueDate)}</strong>
                        </div>
                      </div>
                      <div className="project-payment-split">
                        <div>
                          <span>Valor pago</span>
                          <strong className="paid-amount">
                            {money(projectPaidAmount(project))}
                          </strong>
                        </div>
                        <div>
                          <span>Valor pendente</span>
                          <strong className="pending-amount">
                            {money(projectPendingAmount(project))}
                          </strong>
                        </div>
                      </div>
                      <div className="project-card-progress">
                        <div>
                          <span>
                            {taskStats.total
                              ? `Daily · ${taskStats.completed}/${taskStats.total} tarefas`
                              : "Progresso"}
                          </span>
                          <strong>{project.progress}%</strong>
                        </div>
                        <span className="progress-track">
                          <span style={{ width: `${project.progress}%` }} />
                        </span>
                      </div>
                      <div className="project-card-actions">
                        {project.status !== "completed" &&
                          taskStats.total === 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                updateProjectProgress(project.id, -10)
                              }
                              disabled={project.progress === 0}
                            >
                              −10%
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateProjectProgress(project.id, 10)
                              }
                              disabled={project.progress === 100}
                            >
                              +10%
                            </button>
                          </>
                        )}
                        {taskStats.total > 0 && (
                          <span className="project-task-sync">
                            <ListTodo size={13} /> Sincronizado com o Daily
                          </span>
                        )}
                        {project.status === "completed" &&
                          isRecurringProject(project) && (
                            <button
                              type="button"
                              className="cycle-action compact"
                              onClick={() => completeRecurringCycle(project)}
                            >
                              <RotateCcw size={14} />
                              Concluir ciclo
                            </button>
                          )}
                        <button
                          type="button"
                          className="edit-action"
                          onClick={() => openProjectModal({ itemId: project.id })}
                          aria-label={`Editar projeto ${project.title}`}
                        >
                          <PencilLine size={14} />
                          Editar
                        </button>
                        <button
                          type="button"
                          className="delete-action"
                          onClick={() => deleteProject(project.id)}
                          aria-label={`Excluir projeto ${project.title}`}
                        >
                          <Trash2 size={14} />
                          Excluir
                        </button>
                      </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="full-span">
                    <EmptyState
                      title="Nenhum projeto encontrado"
                      text="Ajuste o filtro ou crie um novo projeto para começar."
                      action={
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => openProjectModal()}
                        >
                          <Plus size={17} /> Novo projeto
                        </button>
                      }
                    />
                  </div>
                )}
              </section>
            </>
          )}

          {activeView === "kanban" && (
            <>
              <section className="page-heading kanban-heading">
                <div>
                  <span className="eyebrow">Fluxo de trabalho</span>
                  <h1>Flooow</h1>
                  <p>
                    Mova cada projeto pela etapa em que o trabalho realmente está.
                  </p>
                </div>
                <button
                  type="button"
                  className="button primary"
                  onClick={() =>
                    openProjectModal({ initialStatus: "planned" })
                  }
                >
                  <Plus size={18} />
                  Novo projeto
                </button>
              </section>

              <section className="kanban-overview" aria-label="Resumo do quadro">
                <div>
                  <span>Projetos no quadro</span>
                  <strong>{kanbanProjects.length}</strong>
                </div>
                <div>
                  <span>Em produção</span>
                  <strong>
                    {
                      kanbanProjects.filter(
                        (project) => project.status === "in-progress",
                      ).length
                    }
                  </strong>
                </div>
                <div>
                  <span>Concluídos</span>
                  <strong>
                    {
                      kanbanProjects.filter(
                        (project) => project.status === "completed",
                      ).length
                    }
                  </strong>
                </div>
                <div className="kanban-completion">
                  <span>Conclusão do portfólio</span>
                  <strong>
                    {kanbanProjects.length
                      ? Math.round(
                          (kanbanProjects.filter(
                            (project) => project.status === "completed",
                          ).length /
                            kanbanProjects.length) *
                            100,
                        )
                      : 0}
                    %
                  </strong>
                </div>
              </section>

              <p id="kanban-instructions" className="kanban-instructions">
                Arraste os cartões para mover ou reordenar. Se preferir, use os
                botões de seta em cada cartão.
              </p>

              <section
                className="kanban-board"
                aria-label="Quadro Flooow de projetos"
                aria-describedby="kanban-instructions"
              >
                {kanbanColumns.map((status) => {
                  const columnProjects = kanbanProjects.filter(
                    (project) => project.status === status,
                  );
                  return (
                    <div
                      className={`kanban-column kanban-${status} ${
                        dragOverTarget?.status === status ? "drop-active" : ""
                      }`}
                      key={status}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverTarget({ status });
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const projectId =
                          draggedProjectId ||
                          event.dataTransfer.getData("text/plain");
                        if (projectId) moveProjectToStatus(projectId, status);
                      }}
                    >
                      <header className="kanban-column-header">
                        <div>
                          <span className="kanban-column-dot" aria-hidden="true" />
                          <h2>{projectStatus[status].label}</h2>
                        </div>
                        <span className="kanban-count" aria-label={`${columnProjects.length} projetos`}>
                          {columnProjects.length}
                        </span>
                      </header>

                      <div className="kanban-card-list">
                        {columnProjects.map((project) => {
                          const statusIndex = kanbanColumns.indexOf(project.status);
                          const taskStats = projectTaskStats(
                            project,
                            store.dailyTasks,
                          );
                          return (
                            <article
                              className={`kanban-card ${
                                draggedProjectId === project.id ? "dragging" : ""
                              } ${
                                dragOverTarget?.projectId === project.id
                                  ? "drop-before"
                                  : ""
                              }`}
                              draggable
                              key={project.id}
                              onDragStart={(event) => {
                                setDraggedProjectId(project.id);
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/plain", project.id);
                              }}
                              onDragEnd={() => {
                                setDraggedProjectId(null);
                                setDragOverTarget(null);
                              }}
                              onDragOver={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setDragOverTarget({
                                  status,
                                  projectId: project.id,
                                });
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                const projectId =
                                  draggedProjectId ||
                                  event.dataTransfer.getData("text/plain");
                                if (projectId) {
                                  moveProjectToStatus(
                                    projectId,
                                    status,
                                    project.id,
                                  );
                                }
                              }}
                            >
                              <div className="kanban-card-top">
                                <span className="kanban-drag-handle" aria-hidden="true">
                                  <GripVertical size={16} />
                                </span>
                                <span className="kanban-category">
                                  {project.category}
                                </span>
                                {isRecurringProject(project) && (
                                  <span className="recurrence-badge">
                                    <RotateCcw size={11} />
                                    {
                                      recurrenceOptions[
                                        project.recurrence ?? "monthly"
                                      ].label
                                    }
                                  </span>
                                )}
                                <div className="kanban-card-tools">
                                  <button
                                    type="button"
                                    className="kanban-delete"
                                    aria-label={`Excluir projeto ${project.title}`}
                                    onClick={() => deleteProject(project.id)}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    className="kanban-edit"
                                    aria-label={`Editar projeto ${project.title}`}
                                    onClick={() =>
                                      openProjectModal({ itemId: project.id })
                                    }
                                  >
                                    <PencilLine size={15} />
                                  </button>
                                </div>
                              </div>
                              <h3>{project.title}</h3>
                              <p>{project.client}</p>

                              <div className="kanban-card-meta">
                                <span>
                                  <CalendarDays size={14} />
                                  <span className="sr-only">
                                    {isRecurringProject(project)
                                      ? "Próxima entrega:"
                                      : "Entrega:"}
                                  </span>
                                  {dateLabel(project.dueDate)}
                                </span>
                                <span className="kanban-investment">
                                  <small>Investimento</small>
                                  <strong>{money(project.budget)}</strong>
                                </span>
                              </div>

                              <div className="kanban-payment-split">
                                <div>
                                  <span>Valor pago</span>
                                  <strong className="paid-amount">
                                    {money(projectPaidAmount(project))}
                                  </strong>
                                </div>
                                <div>
                                  <span>Valor pendente</span>
                                  <strong className="pending-amount">
                                    {money(projectPendingAmount(project))}
                                  </strong>
                                </div>
                              </div>

                              <div className="kanban-progress">
                                <div>
                                  <span>
                                    {taskStats.total
                                      ? `Daily · ${taskStats.completed}/${taskStats.total}`
                                      : "Progresso"}
                                  </span>
                                  <strong>{project.progress}%</strong>
                                </div>
                                <span className="progress-track">
                                  <span style={{ width: `${project.progress}%` }} />
                                </span>
                              </div>

                              <div
                                className={`kanban-card-actions ${
                                  project.status === "completed" &&
                                  isRecurringProject(project)
                                    ? "cycle-ready"
                                    : ""
                                }`}
                              >
                                {project.status === "completed" &&
                                isRecurringProject(project) ? (
                                  <button
                                    type="button"
                                    className="cycle-action"
                                    onClick={() => completeRecurringCycle(project)}
                                  >
                                    <RotateCcw size={14} />
                                    Concluir ciclo e planejar o próximo
                                  </button>
                                ) : (
                                  <>
                                    <IconButton
                                      label={`Mover ${project.title} para a etapa anterior`}
                                      onClick={() =>
                                        moveProjectOneColumn(project, -1)
                                      }
                                      className="kanban-move-button"
                                      disabled={statusIndex === 0}
                                    >
                                      <ArrowLeft size={16} />
                                    </IconButton>
                                    <span>
                                      {statusIndex + 1} de {kanbanColumns.length}
                                    </span>
                                    <IconButton
                                      label={`Mover ${project.title} para a próxima etapa`}
                                      onClick={() =>
                                        moveProjectOneColumn(project, 1)
                                      }
                                      className="kanban-move-button"
                                      disabled={
                                        statusIndex === kanbanColumns.length - 1
                                      }
                                    >
                                      <ArrowRight size={16} />
                                    </IconButton>
                                  </>
                                )}
                              </div>
                            </article>
                          );
                        })}

                        {!columnProjects.length && (
                          <div className="kanban-empty">
                            <span className="kanban-empty-mark" aria-hidden="true" />
                            <p>Nenhum projeto nesta etapa.</p>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="kanban-add-card"
                        onClick={() =>
                          openProjectModal({ initialStatus: status })
                        }
                      >
                        <Plus size={16} /> Adicionar projeto
                      </button>
                    </div>
                  );
                })}
              </section>
            </>
          )}

          {activeView === "finance" && (
            <>
              <section className="page-heading">
                <div>
                  <span className="eyebrow">Fluxo mensal</span>
                  <h1>Financeiro</h1>
                  <p>Entradas, saídas e pendências organizadas por mês.</p>
                </div>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => setModal({ kind: "transaction" })}
                >
                  <Plus size={18} />
                  Nova transação
                </button>
              </section>

              <section className="finance-toolbar">
                <div className="month-switcher">
                  <IconButton
                    label="Mês anterior"
                    onClick={() =>
                      setSelectedMonth((month) => moveMonth(month, -1))
                    }
                  >
                    <ChevronLeft size={18} />
                  </IconButton>
                  <div>
                    <span>Competência</span>
                    <strong>{monthLabel(selectedMonth)}</strong>
                  </div>
                  <IconButton
                    label="Próximo mês"
                    onClick={() =>
                      setSelectedMonth((month) => moveMonth(month, 1))
                    }
                  >
                    <ChevronRight size={18} />
                  </IconButton>
                </div>
                <div className="filter-row compact" role="group" aria-label="Filtrar transações">
                  {(["all", "income", "expense"] as const).map((filter) => (
                    <button
                      type="button"
                      key={filter}
                      className={financeFilter === filter ? "active" : ""}
                      onClick={() => setFinanceFilter(filter)}
                    >
                      {filter === "all"
                        ? "Todas"
                        : filter === "income"
                          ? "Entradas"
                          : "Saídas"}
                    </button>
                  ))}
                </div>
              </section>

              <section className="financial-sync-note" aria-label="Integração com projetos">
                <span className="financial-sync-icon" aria-hidden="true">
                  <Columns3 size={18} />
                </span>
                <div>
                  <strong>Flooow conectado</strong>
                  <p>
                    {projectIncomeSummary.count
                      ? `${projectIncomeSummary.count} ${
                          projectIncomeSummary.count === 1
                            ? "entrada de projeto compõe"
                            : "entradas de projetos compõem"
                        } esta competência.`
                      : "Nenhuma entrega de projeto está prevista nesta competência."}
                  </p>
                </div>
                <strong>{money(projectIncomeSummary.total)}</strong>
              </section>

              <section className="finance-cards">
                <article>
                  <span>Entradas previstas</span>
                  <strong className="positive">
                    {money(financials.received + financials.receivable)}
                  </strong>
                  <small>{money(financials.received)} já recebidos</small>
                </article>
                <article>
                  <span>Saídas previstas</span>
                  <strong className="negative">
                    {money(financials.paidExpenses + financials.payable)}
                  </strong>
                  <small>{money(financials.payable)} ainda pendentes</small>
                </article>
                <article className="forecast-card">
                  <span>Resultado projetado</span>
                  <strong>{money(financials.forecast)}</strong>
                  <small>Considera valores pagos e pendentes</small>
                </article>
              </section>

              <section className="panel transaction-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">Movimentações</span>
                    <h2>{filteredTransactions.length} registros</h2>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={exportBackup}
                  >
                    <Download size={16} /> Exportar backup
                  </button>
                </div>
                {filteredTransactions.length ? (
                  <div className="transaction-list">
                    {filteredTransactions.map((transaction) => (
                      <div className="transaction-row" key={transaction.id}>
                        <div
                          className={`transaction-icon ${transaction.kind}`}
                        >
                          {transaction.kind === "income" ? (
                            <ArrowDownRight size={18} />
                          ) : (
                            <ArrowUpRight size={18} />
                          )}
                        </div>
                        <div className="transaction-copy">
                          <strong>{transaction.title}</strong>
                          <div className="transaction-meta">
                            <span>
                              {transaction.category} ·{" "}
                              {dateLabel(transaction.dueDate)}
                            </span>
                            {transaction.source === "project" && (
                              <span className="transaction-source">
                                <Columns3 size={10} /> Flooow
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`transaction-status ${transaction.status}`}
                        >
                          {transaction.status === "paid"
                            ? "Realizado"
                            : "Pendente"}
                        </span>
                        <strong
                          className={`transaction-amount ${transaction.kind}`}
                        >
                          {transaction.kind === "income" ? "+" : "−"}
                          {money(transaction.amount)}
                        </strong>
                        <div className="row-actions">
                          <IconButton
                            label={
                              transaction.source === "project"
                                ? `Editar projeto relacionado a ${transaction.title}`
                                : `Editar lançamento ${transaction.title}`
                            }
                            onClick={() => {
                              if (
                                transaction.source === "project" &&
                                transaction.projectId
                              ) {
                                openProjectModal({
                                  itemId: transaction.projectId,
                                });
                                return;
                              }
                              setModal({
                                kind: "transaction",
                                itemId: transaction.id,
                              });
                            }}
                          >
                            <PencilLine size={16} />
                          </IconButton>
                          {transaction.status === "pending" && (
                            <IconButton
                              label="Marcar como realizado"
                              onClick={() =>
                                markTransactionPaid(transaction.id)
                              }
                            >
                              <Check size={17} />
                            </IconButton>
                          )}
                          <IconButton
                            label="Excluir transação"
                            onClick={() =>
                              deleteTransaction(transaction.id)
                            }
                            className="danger"
                          >
                            <Trash2 size={17} />
                          </IconButton>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Nenhuma transação neste mês"
                    text="Adicione uma entrada ou saída para começar seu fluxo financeiro."
                    action={
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => setModal({ kind: "transaction" })}
                      >
                        <Plus size={17} /> Nova transação
                      </button>
                    }
                  />
                )}
              </section>
            </>
          )}

          {activeView === "backup" && (
            <>
              <section className="page-heading">
                <div>
                  <span className="eyebrow">Portabilidade</span>
                  <h1>Dados e backup</h1>
                  <p>Seus dados acompanham sua conta em qualquer dispositivo.</p>
                </div>
              </section>

              <section className="backup-hero">
                <div className="backup-illustration" aria-hidden="true">
                  <span className="backup-orbit orbit-one" />
                  <span className="backup-orbit orbit-two" />
                  <HardDriveDownload size={38} />
                </div>
                <div>
                  <span className="eyebrow">Sincronização automática</span>
                  <h2>Salva sozinho. Viaja com você.</h2>
                  <p>
                    Cada alteração é salva na nuvem e também neste dispositivo.
                    Ao entrar com a mesma conta, seus dados são carregados
                    automaticamente.
                  </p>
                </div>
                <div className="backup-actions">
                  <button
                    type="button"
                    className="button primary"
                    onClick={exportBackup}
                  >
                    <Download size={18} /> Exportar backup
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => importRef.current?.click()}
                  >
                    <Upload size={18} /> Importar backup
                  </button>
                  <input
                    ref={importRef}
                    className="sr-only"
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) =>
                      importBackup(event.target.files?.[0])
                    }
                  />
                </div>
              </section>

              <section className="backup-grid">
                <article className="panel backup-card">
                  <span className="card-icon blue">
                    <Database size={21} />
                  </span>
                  <h2>Estado atual</h2>
                  <dl>
                    <div>
                      <dt>Tarefas no Daily Work</dt>
                      <dd>{store.dailyTasks.length}</dd>
                    </div>
                    <div>
                      <dt>Contatos no CRM</dt>
                      <dd>{store.leads.length}</dd>
                    </div>
                    <div>
                      <dt>Projetos</dt>
                      <dd>{store.projects.length}</dd>
                    </div>
                    <div>
                      <dt>Transações</dt>
                      <dd>{store.transactions.length}</dd>
                    </div>
                    <div>
                      <dt>Última atualização</dt>
                      <dd>
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(savedAt))}
                      </dd>
                    </div>
                  </dl>
                </article>
                <article className="panel backup-card">
                  <span className="card-icon green">
                    <ShieldCheck size={21} />
                  </span>
                  <h2>Privacidade por conta</h2>
                  <p>
                    Tarefas, contatos, projetos e finanças são protegidos pelo
                    seu login. Cada usuário só pode acessar os próprios dados.
                  </p>
                </article>
                <article className="panel backup-card">
                  <span className="card-icon coral">
                    <RotateCcw size={21} />
                  </span>
                  <h2>Ambiente de demonstração</h2>
                  <p>
                    Restaure os dados de exemplo caso queira explorar o produto
                    do começo novamente.
                  </p>
                  <button
                    type="button"
                    className="text-button danger-text"
                    onClick={resetSampleData}
                  >
                    Restaurar dados de exemplo
                  </button>
                </article>
              </section>

              <section className="panel architecture-note">
                <div>
                  <span className="card-icon amber">
                    <ShieldCheck size={21} />
                  </span>
                  <div>
                    <h2>Sincronização ativa</h2>
                    <p>
                      O banco na nuvem mantém os dados atualizados entre
                      dispositivos. O backup exportável continua disponível
                      como uma camada extra de segurança.
                    </p>
                  </div>
                </div>
                <span className="phase-pill">Ativo</span>
              </section>
            </>
          )}

          {activeView === "account" && (
            <>
              <section className="page-heading account-heading">
                <div>
                  <span className="eyebrow">Preferências do workspace</span>
                  <h1>Conta e configurações</h1>
                  <p>Gerencie sua identidade, seu estúdio e suas preferências.</p>
                </div>
              </section>

              <section className="account-grid">
                <article className="panel account-profile-card">
                  <span className="profile-avatar account-avatar">
                    {(profile.fullName || user.email).slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <span className="eyebrow">Sua conta</span>
                    <h2>{profile.fullName || "Complete seu perfil"}</h2>
                    <p>{user.email}</p>
                  </div>
                  <span className="account-status">
                    <span className="save-dot" /> Conta ativa
                  </span>
                </article>

                <form className="panel account-form" onSubmit={saveProfile}>
                  <div className="account-section-heading">
                    <div>
                      <span className="eyebrow">Perfil e negócio</span>
                      <h2>Informações principais</h2>
                    </div>
                    <ShieldCheck size={22} />
                  </div>
                  <div className="account-fields">
                    <label>
                      <span>Nome</span>
                      <input
                        value={profile.fullName}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            fullName: event.target.value,
                          }))
                        }
                        placeholder="Seu nome"
                      />
                    </label>
                    <label>
                      <span>Nome do estúdio ou negócio</span>
                      <input
                        value={profile.businessName}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            businessName: event.target.value,
                          }))
                        }
                        placeholder="Nome do seu negócio"
                      />
                    </label>
                    <label>
                      <span>WhatsApp</span>
                      <input
                        value={profile.phone}
                        onChange={(event) =>
                          setProfile((current) => ({
                            ...current,
                            phone: event.target.value,
                          }))
                        }
                        placeholder="+55 81 99999-9999"
                      />
                    </label>
                    <label>
                      <span>E-mail de acesso</span>
                      <input value={user.email} readOnly />
                      <small>O e-mail é gerenciado pelo seu método de login.</small>
                    </label>
                  </div>
                  <div className="account-form-actions">
                    <span>As alterações ficam vinculadas à sua conta.</span>
                    <button
                      type="submit"
                      className="button primary"
                      disabled={savingProfile}
                    >
                      {savingProfile ? "Salvando…" : "Salvar perfil"}
                    </button>
                  </div>
                </form>

                <article className="panel account-preferences">
                  <div className="account-section-heading">
                    <div>
                      <span className="eyebrow">Workspace</span>
                      <h2>Preferências</h2>
                    </div>
                    <Settings size={22} />
                  </div>
                  <label>
                    <span>Meta mensal</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={store.settings.monthlyGoal}
                      onChange={(event) =>
                        setStore((current) => ({
                          ...current,
                          settings: {
                            ...current.settings,
                            monthlyGoal: Number(event.target.value) || 0,
                          },
                        }))
                      }
                    />
                  </label>
                  <div className="account-preference-row">
                    <div>
                      <strong>Tema da interface</strong>
                      <span>Alterne entre visual claro e escuro.</span>
                    </div>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={toggleTheme}
                    >
                      {store.settings.theme === "light" ? (
                        <Moon size={17} />
                      ) : (
                        <Sun size={17} />
                      )}
                      {store.settings.theme === "light" ? "Escuro" : "Claro"}
                    </button>
                  </div>
                </article>

                <article className="panel account-security">
                  <div className="account-section-heading">
                    <div>
                      <span className="eyebrow">Segurança</span>
                      <h2>Sessão e acesso</h2>
                    </div>
                    <ShieldCheck size={22} />
                  </div>
                  <p>
                    Seus dados ficam isolados por usuário e sincronizados com a
                    conta usada no login.
                  </p>
                  <button
                    type="button"
                    className="button secondary danger-text"
                    onClick={handleSignOut}
                    disabled={signingOut}
                  >
                    {signingOut ? "Saindo…" : "Sair desta conta"}
                  </button>
                </article>
              </section>
            </>
          )}
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Navegação móvel">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.id}
              className={activeView === item.id ? "active" : ""}
              onClick={() => switchView(item.id)}
            >
              <Icon size={20} />
              <span>{item.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </nav>

      {modal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">
                  {modal.kind === "project"
                    ? editingProject
                      ? "Ajustar trabalho"
                      : "Novo trabalho"
                    : modal.kind === "daily"
                      ? editingDailyTask
                        ? "Ajustar rotina"
                        : "Planejar o dia"
                    : modal.kind === "crm"
                      ? editingLead
                        ? "Ajustar relacionamento"
                        : "Nova oportunidade"
                      : editingTransaction
                        ? "Ajustar lançamento"
                        : "Novo lançamento"}
                </span>
                <h2 id="modal-title">
                  {modal.kind === "project"
                    ? editingProject
                      ? "Editar projeto"
                      : "Criar projeto"
                    : modal.kind === "daily"
                      ? editingDailyTask
                        ? "Editar tarefa"
                        : "Nova tarefa diária"
                    : modal.kind === "crm"
                      ? editingLead
                        ? "Editar contato"
                        : "Adicionar ao CRM"
                      : editingTransaction
                        ? "Editar lançamento"
                        : "Nova transação"}
                </h2>
              </div>
              <IconButton label="Fechar" onClick={() => setModal(null)}>
                <X size={20} />
              </IconButton>
            </div>

            {modal.kind === "project" ? (
              <form
                key={`project-${editingProject?.id ?? "new"}`}
                onSubmit={saveProject}
                className="form-grid"
              >
                <label className="full">
                  <span>Nome do projeto *</span>
                  <input
                    name="title"
                    autoFocus
                    required
                    placeholder="Ex.: Site institucional"
                    defaultValue={editingProject?.title ?? ""}
                  />
                </label>
                <label>
                  <span>Cliente *</span>
                  <input
                    name="client"
                    required
                    placeholder="Nome do cliente"
                    defaultValue={editingProject?.client ?? ""}
                  />
                </label>
                <label>
                  <span>Categoria</span>
                  <input
                    name="category"
                    defaultValue={editingProject?.category ?? "Web design"}
                  />
                </label>
                <fieldset className="project-type-picker full">
                  <legend>Tipo de projeto</legend>
                  <div className="project-type-options">
                    <label>
                      <input
                        type="radio"
                        name="projectType"
                        value="one-off"
                        checked={projectTypeDraft === "one-off"}
                        onChange={() => setProjectTypeDraft("one-off")}
                      />
                      <span>
                        <strong>Pontual</strong>
                        <small>Uma entrega com início e fim</small>
                      </span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="projectType"
                        value="recurring"
                        checked={projectTypeDraft === "recurring"}
                        onChange={() => setProjectTypeDraft("recurring")}
                      />
                      <span>
                        <strong>Recorrente</strong>
                        <small>Um novo ciclo após cada entrega</small>
                      </span>
                    </label>
                  </div>
                </fieldset>
                {projectTypeDraft === "recurring" && (
                  <label className="recurrence-select full">
                    <span>Frequência da recorrência</span>
                    <select
                      name="recurrence"
                      required
                      defaultValue={editingProject?.recurrence ?? "monthly"}
                    >
                      {(
                        Object.entries(recurrenceOptions) as Array<
                          [ProjectRecurrence, { label: string; months: number }]
                        >
                      ).map(([value, option]) => (
                        <option key={value} value={value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <small>
                      Ao concluir um ciclo, a próxima data será calculada
                      automaticamente.
                    </small>
                  </label>
                )}
                <label>
                  <span>
                    {projectTypeDraft === "recurring"
                      ? "Investimento por ciclo *"
                      : "Investimento *"}
                  </span>
                  <input
                    name="budget"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={projectInvestmentDraft || ""}
                    onChange={(event) => {
                      const investment = Math.max(
                        0,
                        Number(event.target.value) || 0,
                      );
                      setProjectInvestmentDraft(investment);
                      setProjectPaidDraft((current) =>
                        Math.min(current, investment),
                      );
                    }}
                  />
                </label>
                <label>
                  <span>
                    {projectTypeDraft === "recurring"
                      ? "Próxima entrega *"
                      : "Entrega *"}
                  </span>
                  <input
                    name="dueDate"
                    type="date"
                    required
                    defaultValue={editingProject?.dueDate ?? "2026-08-31"}
                  />
                </label>
                <div className="project-payment-fields full">
                  <label>
                    <span>Valor pago</span>
                    <input
                      name="paidAmount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={projectInvestmentDraft}
                      step="0.01"
                      value={projectPaidDraft}
                      onChange={(event) =>
                        setProjectPaidDraft(
                          Math.min(
                            projectInvestmentDraft,
                            Math.max(0, Number(event.target.value) || 0),
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Valor pendente</span>
                    <input
                      name="pendingAmount"
                      type="number"
                      inputMode="decimal"
                      readOnly
                      value={Math.max(
                        0,
                        projectInvestmentDraft - projectPaidDraft,
                      )}
                      aria-describedby="payment-values-help"
                    />
                  </label>
                  <small id="payment-values-help">
                    O valor pendente é calculado automaticamente a partir do
                    investimento e do que já foi pago.
                  </small>
                </div>
                <label className="financial-sync-toggle full">
                  <input
                    name="financialSync"
                    type="checkbox"
                    defaultChecked={editingProject?.financialSync !== false}
                  />
                  <span className="financial-sync-control" aria-hidden="true">
                    <Check size={14} />
                  </span>
                  <span>
                    <strong>Adicionar ao Financeiro</strong>
                    <small>
                      Cria entradas realizada e pendente usando os valores
                      acima. Ao editar o projeto, o Financeiro acompanha as
                      alterações.
                    </small>
                  </span>
                </label>
                <label>
                  <span>Status</span>
                  <select
                    name="status"
                    defaultValue={
                      editingProject?.status ??
                      modal.initialStatus ??
                      "planned"
                    }
                  >
                    <option value="planned">Planejado</option>
                    <option value="in-progress">Em andamento</option>
                    <option value="paused">Em pausa</option>
                    <option value="completed">Concluído</option>
                  </select>
                </label>
                <label>
                  <span>Progresso</span>
                  <input
                    name="progress"
                    type="number"
                    min="0"
                    max="100"
                    readOnly={Boolean(editingProjectTaskStats?.total)}
                    defaultValue={editingProject?.progress ?? 0}
                    aria-describedby={
                      editingProjectTaskStats?.total
                        ? "project-progress-help"
                        : undefined
                    }
                  />
                  {Boolean(editingProjectTaskStats?.total) && (
                    <small
                      className="project-progress-source"
                      id="project-progress-help"
                    >
                      Calculado por {editingProjectTaskStats?.completed} de{" "}
                      {editingProjectTaskStats?.total} tarefas vinculadas no
                      Daily.
                    </small>
                  )}
                </label>
                <div className="form-actions full">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setModal(null)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="button primary">
                    {editingProject ? "Salvar alterações" : "Criar projeto"}
                  </button>
                </div>
              </form>
            ) : modal.kind === "daily" ? (
              <form
                key={`daily-${editingDailyTask?.id ?? "new"}`}
                onSubmit={saveDailyTask}
                className="form-grid daily-form"
              >
                <label className="full">
                  <span>Nome da tarefa *</span>
                  <input
                    name="title"
                    autoFocus
                    required
                    placeholder="Ex.: Revisar a entrega principal"
                    defaultValue={editingDailyTask?.title ?? ""}
                  />
                </label>
                <label>
                  <span>Bloco do dia *</span>
                  <select
                    name="area"
                    required
                    defaultValue={editingDailyTask?.area ?? "focus"}
                  >
                    {dailyAreaOrder.map((area) => (
                      <option value={area} key={area}>
                        {dailyAreas[area].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="daily-project-field">
                  <span>Projeto associado</span>
                  <select
                    name="projectId"
                    defaultValue={editingDailyTask?.projectId ?? ""}
                  >
                    <option value="">Sem projeto</option>
                    {store.projects
                      .filter(
                        (project) =>
                          project.status !== "completed" ||
                          project.id === editingDailyTask?.projectId,
                      )
                      .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"))
                      .map((project) => (
                        <option value={project.id} key={project.id}>
                          {project.title} — {project.client}
                        </option>
                      ))}
                  </select>
                  <small>
                    Ao concluir, esta tarefa passa a compor o progresso do
                    projeto.
                  </small>
                </label>
                <label>
                  <span>Data de início *</span>
                  <input
                    name="startDate"
                    type="date"
                    required
                    defaultValue={
                      editingDailyTask?.startDate ?? selectedDailyDate
                    }
                  />
                </label>
                <label>
                  <span>Horário</span>
                  <input
                    name="time"
                    type="time"
                    defaultValue={editingDailyTask?.time ?? ""}
                  />
                </label>
                <label>
                  <span>Tempo estimado</span>
                  <div className="daily-duration-input">
                    <input
                      name="estimatedMinutes"
                      type="number"
                      min="0"
                      step="5"
                      placeholder="30"
                      defaultValue={editingDailyTask?.estimatedMinutes || ""}
                    />
                    <span>min</span>
                  </div>
                </label>
                <label className="daily-alarm-field">
                  <span>Alarme sonoro</span>
                  <select
                    name="alarmMinutes"
                    defaultValue={editingDailyTask?.alarmMinutes ?? ""}
                  >
                    <option value="">Sem alarme</option>
                    {dailyAlarmValues.map((minutes) => (
                      <option value={minutes} key={minutes}>
                        {dailyAlarmOptions[minutes]}
                      </option>
                    ))}
                  </select>
                  <small>Usa o horário definido acima.</small>
                </label>
                <label className="daily-repeat-toggle full">
                  <input
                    name="recurring"
                    type="checkbox"
                    defaultChecked={editingDailyTask?.recurring ?? true}
                  />
                  <span className="daily-repeat-control" aria-hidden="true">
                    <Repeat2 size={15} />
                  </span>
                  <span>
                    <strong>Renovar esta tarefa todos os dias</strong>
                    <small>
                      Ao marcar hoje, ela reaparece desmarcada amanhã e mantém
                      o histórico de cada dia.
                    </small>
                  </span>
                </label>
                <label className="full">
                  <span>Observações</span>
                  <textarea
                    name="notes"
                    rows={3}
                    placeholder="Contexto, resultado esperado ou lembrete."
                    defaultValue={editingDailyTask?.notes ?? ""}
                  />
                </label>
                <div className="daily-form-hint full">
                  <CheckCircle2 size={17} aria-hidden="true" />
                  <span>
                    Cada check fica salvo na data exibida. Para o projeto, cada
                    tarefa vinculada conta uma vez após a primeira conclusão.
                  </span>
                </div>
                <div className="daily-alarm-note full">
                  <BellRing size={17} aria-hidden="true" />
                  <span>
                    Para ouvir no horário, mantenha o dashboard aberto e use
                    “Testar som” uma vez neste dispositivo.
                  </span>
                </div>
                <div className="form-actions full">
                  {editingDailyTask && (
                    <button
                      type="button"
                      className="button danger-button form-delete-action"
                      onClick={() => deleteDailyTask(editingDailyTask.id)}
                    >
                      <Trash2 size={16} />
                      Excluir tarefa
                    </button>
                  )}
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setModal(null)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="button primary">
                    {editingDailyTask ? "Salvar alterações" : "Adicionar tarefa"}
                  </button>
                </div>
              </form>
            ) : modal.kind === "crm" ? (
              <form
                key={`crm-${editingLead?.id ?? "new"}`}
                onSubmit={saveCrmLead}
                className="form-grid crm-form"
              >
                <label className="full">
                  <span>Cliente / empresa *</span>
                  <input
                    name="company"
                    autoFocus
                    required
                    placeholder="Ex.: Clínica Aurora"
                    defaultValue={editingLead?.company ?? ""}
                  />
                </label>
                <label>
                  <span>Pessoa de contato *</span>
                  <input
                    name="contactName"
                    required
                    placeholder="Nome da pessoa"
                    defaultValue={editingLead?.contactName ?? ""}
                  />
                </label>
                <label>
                  <span>E-mail ou telefone</span>
                  <input
                    name="contact"
                    placeholder="contato@empresa.com"
                    defaultValue={editingLead?.contact ?? ""}
                  />
                </label>
                <label className="full">
                  <span>Serviço de interesse *</span>
                  <input
                    name="service"
                    required
                    placeholder="Ex.: Site institucional + identidade"
                    defaultValue={editingLead?.service ?? ""}
                  />
                </label>
                <label>
                  <span>Status *</span>
                  <select name="status" defaultValue={editingLead?.status ?? "prospecting"}>
                    {crmStatusOrder.map((status) => (
                      <option value={status} key={status}>
                        {crmStatus[status].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Valor potencial</span>
                  <input
                    name="potentialValue"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    defaultValue={editingLead?.potentialValue || ""}
                  />
                </label>
                <label>
                  <span>Próxima ação</span>
                  <input
                    name="nextAction"
                    placeholder="Ex.: Enviar proposta"
                    defaultValue={editingLead?.nextAction ?? ""}
                  />
                </label>
                <label>
                  <span>Data da próxima ação</span>
                  <input
                    name="nextActionDate"
                    type="date"
                    defaultValue={editingLead?.nextActionDate ?? currentDateKey()}
                  />
                </label>
                <label className="full">
                  <span>Observações</span>
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder="Contexto da conversa, objeções e detalhes importantes."
                    defaultValue={editingLead?.notes ?? ""}
                  />
                </label>
                <div className="crm-form-hint full">
                  <Handshake size={17} aria-hidden="true" />
                  <span>
                    Defina sempre uma próxima ação: é ela que mantém a oportunidade em movimento.
                  </span>
                </div>
                <div className="form-actions full">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setModal(null)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="button primary">
                    {editingLead ? "Salvar alterações" : "Adicionar contato"}
                  </button>
                </div>
              </form>
            ) : (
              <form
                key={`transaction-${editingTransaction?.id ?? "new"}`}
                onSubmit={saveTransaction}
                className="form-grid"
              >
                <label className="full">
                  <span>Descrição *</span>
                  <input
                    name="title"
                    autoFocus
                    required
                    placeholder="Ex.: Parcela do projeto"
                    defaultValue={editingTransaction?.title ?? ""}
                  />
                </label>
                <label>
                  <span>Tipo *</span>
                  <select
                    name="kind"
                    defaultValue={editingTransaction?.kind ?? "income"}
                  >
                    <option value="income">Entrada</option>
                    <option value="expense">Saída</option>
                  </select>
                </label>
                <label>
                  <span>Situação *</span>
                  <select
                    name="status"
                    defaultValue={editingTransaction?.status ?? "pending"}
                  >
                    <option value="pending">Pendente</option>
                    <option value="paid">Realizado</option>
                  </select>
                </label>
                <label>
                  <span>Valor *</span>
                  <input
                    name="amount"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="0,00"
                    defaultValue={editingTransaction?.amount}
                  />
                </label>
                <label>
                  <span>Data *</span>
                  <input
                    name="dueDate"
                    type="date"
                    required
                    defaultValue={editingTransaction?.dueDate ?? "2026-07-31"}
                  />
                </label>
                <label>
                  <span>Categoria *</span>
                  <input
                    name="category"
                    required
                    defaultValue={editingTransaction?.category ?? "Projeto"}
                  />
                </label>
                <label>
                  <span>Projeto relacionado</span>
                  <select
                    name="projectId"
                    defaultValue={editingTransaction?.projectId ?? ""}
                  >
                    <option value="">Sem projeto</option>
                    {store.projects.map((project) => (
                      <option value={project.id} key={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-actions full">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setModal(null)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="button primary">
                    {editingTransaction
                      ? "Salvar alterações"
                      : "Salvar transação"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}

      {!hydrated && (
        <div className="loading-cover" role="status">
          <span className="loading-mark" />
          <p>Preparando seu estúdio…</p>
        </div>
      )}


    </div>
  );
}
