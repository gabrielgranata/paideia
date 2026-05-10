/**
 * Minimal typed fetch client over the Backboard REST API.
 *
 * Endpoint shapes verified against the live API (https://app.backboard.io/api).
 * Auth is via the X-API-Key header (NOT Bearer), per cookbook recipe 9.
 *
 * Backboard is retrieval over composed prose; never source of truth. Memory
 * informs which question to ask next; never what to say on the student's
 * behalf. If Backboard contradicts Postgres, Postgres wins.
 */

const DEFAULT_BASE_URL = "https://app.backboard.io/api";
const DEFAULT_TIMEOUT_MS = 60_000;

export interface BackboardAssistant {
  assistant_id: string;
  name: string;
  description?: string | null;
  system_prompt?: string | null;
  created_at: string;
}

export interface BackboardThread {
  thread_id: string;
  created_at: string;
  messages?: BackboardMessage[];
}

export interface BackboardMessage {
  message_id: string;
  role: "user" | "assistant" | "system";
  content?: string;
  created_at: string;
  status?: string;
}

export interface BackboardMemory {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface BackboardMessageResponse {
  content?: string;
  status?: string;
  run_id?: string;
  memory_operation_id?: string;
  model_provider?: string;
  model_name?: string;
  total_tokens?: number;
}

export interface BackboardMemoryOperationStatus {
  // Verified live: API also returns "PROCESSING" as a non-terminal state in
  // addition to "IN_PROGRESS" documented in the cookbook. Treat anything not
  // in {COMPLETED, FAILED} as in-flight and keep polling.
  status: "IN_PROGRESS" | "PROCESSING" | "COMPLETED" | "FAILED" | string;
  status_message?: string;
}

export interface BackboardDocument {
  document_id: string;
  filename: string;
  status: "pending" | "processing" | "indexed" | "error";
  status_message?: string | null;
  summary?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface BackboardDocumentStatus {
  document_id: string;
  filename: string;
  document_type?: string;
  status: "pending" | "processing" | "indexed" | "error";
  status_message?: string | null;
  file_size_bytes?: number;
  total_tokens?: number;
  chunk_count?: number;
  processing_started_at?: string | null;
  processing_completed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface AddMessageOptions {
  memory?: "Auto" | "Readonly" | "Off";
  stream?: false; // Streaming is intentionally unsupported here.
  llmProvider?: string;
  modelName?: string;
}

export class BackboardClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    apiKey: string,
    baseUrl: string = DEFAULT_BASE_URL,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {
    if (!apiKey) throw new Error("BackboardClient: apiKey required");
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.timeoutMs = timeoutMs;
  }

  private headers(): Record<string, string> {
    return { "X-API-Key": this.apiKey };
  }

  private async request<T>(
    method: string,
    endpoint: string,
    options?: {
      json?: Record<string, unknown>;
      formData?: Record<string, string>;
      multipart?: FormData;
      params?: Record<string, string | number>;
      expectJson?: boolean;
    },
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/${endpoint.replace(/^\//, "")}`);
    if (options?.params) {
      for (const [k, v] of Object.entries(options.params)) {
        url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = { ...this.headers() };
    let body: string | FormData | undefined;

    if (options?.json) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    } else if (options?.multipart) {
      // Let fetch set the multipart boundary; do not set Content-Type.
      body = options.multipart;
    } else if (options?.formData) {
      // application/x-www-form-urlencoded — what addMessage uses per cookbook.
      const fd = new FormData();
      for (const [k, v] of Object.entries(options.formData)) fd.append(k, v);
      body = fd;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url.toString(), {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "<no body>");
        throw new Error(`Backboard API ${res.status} ${method} ${endpoint}: ${text}`);
      }

      if (options?.expectJson === false) {
        return undefined as unknown as T;
      }

      // 204s and empty bodies — try parse, fall back to undefined.
      const text = await res.text();
      if (!text) return undefined as unknown as T;
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // --- Assistants ---

  async listAssistants(skip = 0, limit = 100): Promise<BackboardAssistant[]> {
    return this.request<BackboardAssistant[]>("GET", "/assistants", {
      params: { skip, limit },
    });
  }

  async createAssistant(
    name: string,
    system_prompt?: string,
  ): Promise<BackboardAssistant> {
    const json: Record<string, unknown> = { name };
    if (system_prompt) json.system_prompt = system_prompt;
    return this.request<BackboardAssistant>("POST", "/assistants", { json });
  }

  // --- Threads ---

  async createThread(assistant_id: string): Promise<BackboardThread> {
    return this.request<BackboardThread>(
      "POST",
      `/assistants/${assistant_id}/threads`,
      { json: {} },
    );
  }

  // --- Messages ---

  /**
   * Send a message to a thread, non-streaming. Form-data per cookbook recipe 9.
   * `memory: "Auto"` triggers async memory write; the returned
   * `memory_operation_id` can be polled with getMemoryOperationStatus.
   */
  async addMessage(
    thread_id: string,
    content: string,
    opts: AddMessageOptions = {},
  ): Promise<BackboardMessageResponse> {
    const formData: Record<string, string> = {
      content,
      stream: "false",
    };
    if (opts.memory) formData.memory = opts.memory;
    if (opts.llmProvider) formData.llm_provider = opts.llmProvider;
    if (opts.modelName) formData.model_name = opts.modelName;

    return this.request<BackboardMessageResponse>(
      "POST",
      `/threads/${thread_id}/messages`,
      { formData },
    );
  }

  // --- Memory operations ---

  /** Memories are immutable. Update = delete + add. ID changes on update. */
  async addMemory(
    assistant_id: string,
    content: string,
    metadata: Record<string, unknown> = {},
  ): Promise<{ memory_id?: string; id?: string } & Record<string, unknown>> {
    return this.request("POST", `/assistants/${assistant_id}/memories`, {
      json: { content, metadata },
    });
  }

  /**
   * Returns ALL memories for the assistant — no server-side filtering.
   * Filter client-side by metadata.type.
   */
  async getMemories(
    assistant_id: string,
  ): Promise<{ memories: BackboardMemory[]; total_count?: number }> {
    return this.request("GET", `/assistants/${assistant_id}/memories`);
  }

  async deleteMemory(assistant_id: string, memory_id: string): Promise<void> {
    await this.request("DELETE", `/assistants/${assistant_id}/memories/${memory_id}`, {
      expectJson: false,
    });
  }

  async getMemoryOperationStatus(
    operation_id: string,
  ): Promise<BackboardMemoryOperationStatus> {
    return this.request<BackboardMemoryOperationStatus>(
      "GET",
      `/assistants/memories/operations/${operation_id}`,
    );
  }

  // --- Documents ---

  /**
   * Upload a document to an assistant. Triggers async indexing — poll
   * getDocumentStatus until status === "indexed".
   */
  async uploadDocumentToAssistant(
    assistant_id: string,
    filename: string,
    content: Buffer | string,
  ): Promise<BackboardDocument> {
    const fd = new FormData();
    const blob =
      typeof content === "string"
        ? new Blob([content], { type: "text/plain" })
        : new Blob([new Uint8Array(content)]);
    fd.append("file", blob, filename);

    return this.request<BackboardDocument>(
      "POST",
      `/assistants/${assistant_id}/documents`,
      { multipart: fd },
    );
  }

  /**
   * Note: document status uses lowercase ("pending"|"processing"|"indexed"|"error"),
   * unlike memory operations which use UPPERCASE ("COMPLETED"|"FAILED"|"IN_PROGRESS").
   */
  async getDocumentStatus(document_id: string): Promise<BackboardDocumentStatus> {
    return this.request<BackboardDocumentStatus>(
      "GET",
      `/documents/${document_id}/status`,
    );
  }
}

// --- Singleton ---

let _client: BackboardClient | null = null;

export function getBackboardClient(): BackboardClient {
  if (_client) return _client;
  const apiKey = process.env.BACKBOARD_API_KEY;
  if (!apiKey) throw new Error("BACKBOARD_API_KEY environment variable required");
  const baseUrl = process.env.BACKBOARD_BASE_URL ?? DEFAULT_BASE_URL;
  _client = new BackboardClient(apiKey, baseUrl);
  return _client;
}
