import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface EmailEntry {
  message_id: string;
  timestamp: string;
  sender: string;
  subject: string;
  body: string;
  source: string;
}

export interface CaseRecord {
  id: string;
  account_name: string;
  financial_tag?: string | null;
  due_tag?: string | null;
  sub_header?: string | null;
  status?: string | null;
  next_step?: string | null;
  approach?: string | null;
  evidence?: string | null;
  stage?: string | null;
  stage_locked?: boolean | null;
  days_offset?: number | null;
  is_action_on_me?: boolean | null;
  owner?: string | null;
  oppID?: string | null;
  salesforce_data?: Record<string, unknown> | null;
  salesforce_stage?: string | null;
  close_confidence?: string | null;
  email_history?: EmailEntry[];
  _ts: number;
}

type Listener = (event: unknown) => void;

const globalStore = globalThis as typeof globalThis & {
  __laccListeners?: Set<Listener>;
  __laccWrite?: Promise<void>;
};

function listeners() {
  if (!globalStore.__laccListeners) globalStore.__laccListeners = new Set();
  return globalStore.__laccListeners;
}

export function subscribe(listener: Listener) {
  const bucket = listeners();
  bucket.add(listener);
  return () => bucket.delete(listener);
}

export function broadcast(event: unknown) {
  for (const listener of listeners()) listener(event);
}

const dataFile = path.join(process.cwd(), "data", "cases.json");

async function readAll(): Promise<CaseRecord[]> {
  try {
    const raw = await readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw) as CaseRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(cases: CaseRecord[]) {
  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, JSON.stringify(cases, null, 2));
}

export function withCases<T>(work: (cases: CaseRecord[]) => Promise<{ cases: CaseRecord[]; result: T }>): Promise<T> {
  const run = (globalStore.__laccWrite ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      const cases = await readAll();
      const outcome = await work(cases);
      await writeAll(outcome.cases);
      return outcome.result;
    });
  globalStore.__laccWrite = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function readCases(): Promise<CaseRecord[]> {
  const cases = await readAll();
  return cases.sort((a, b) => (b._ts ?? 0) - (a._ts ?? 0));
}
