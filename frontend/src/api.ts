export type BillFrequency = "once" | "weekly" | "monthly" | "yearly";
export type OccurrenceStatus = "pending" | "paid" | "skipped";

export interface Config {
  currency: string;
}

export interface Bill {
  id: number;
  name: string;
  amountMinor: number;
  frequency: BillFrequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  category: string | null;
  notes: string | null;
  nextDue: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillInput {
  name: string;
  amountMinor: number;
  frequency: BillFrequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  category: string | null;
  notes: string | null;
}

export interface Occurrence {
  billId: number;
  billName: string;
  amountMinor: number;
  dueDate: string;
  status: OccurrenceStatus;
  paidOn: string | null;
  amountPaidMinor: number | null;
  category: string | null;
}

export interface SaveOccurrenceInput {
  status: "paid" | "skipped";
  paidOn?: string;
  amountMinor?: number;
}

interface ProblemDetails {
  title?: string;
  status?: number;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errors?: Record<string, string[]>;

  constructor(
    status: number,
    message: string,
    errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

let configPromise: Promise<Config> | undefined;

export function getConfig(): Promise<Config> {
  configPromise ??= request<Config>("/api/config").catch((error: unknown) => {
    configPromise = undefined;
    throw error;
  });
  return configPromise;
}

export function getBills(): Promise<Bill[]> {
  return request<Bill[]>("/api/bills");
}

export function createBill(input: BillInput): Promise<Bill> {
  return request<Bill>("/api/bills", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBill(id: number, input: BillInput): Promise<Bill> {
  return request<Bill>(`/api/bills/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteBill(id: number): Promise<void> {
  return request<void>(`/api/bills/${id}`, { method: "DELETE" });
}

export function getOccurrences(
  from: string,
  to: string,
): Promise<Occurrence[]> {
  return request<Occurrence[]>(
    `/api/occurrences?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
}

export function saveOccurrence(
  billId: number,
  dueDate: string,
  input: SaveOccurrenceInput,
): Promise<Occurrence> {
  return request<Occurrence>(
    `/api/bills/${billId}/occurrences/${encodeURIComponent(dueDate)}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export function resetOccurrence(
  billId: number,
  dueDate: string,
): Promise<void> {
  return request<void>(
    `/api/bills/${billId}/occurrences/${encodeURIComponent(dueDate)}`,
    { method: "DELETE" },
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, headers });

  if (!response.ok) {
    let problem: ProblemDetails | undefined;

    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      problem = undefined;
    }

    throw new ApiError(
      response.status,
      problem?.title ?? `Request failed (${response.status})`,
      problem?.errors,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
