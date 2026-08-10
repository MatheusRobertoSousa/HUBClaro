import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Globe2,
  Headphones,
  Inbox,
  KeyRound,
  LogOut,
  MessageCircle,
  Phone,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  UserRound,
  Wifi
} from "lucide-react";
import {
  assignToMe,
  clearToken,
  generateReply,
  getIntegrationStatus,
  getMetrics,
  listTickets,
  login,
  me,
  sendMessage,
  testAi,
  testWhatsApp,
  testWhatsAppTemplate,
  getWhatsAppEvents,
  updateStatus
} from "./lib/api";
import { channelLabel, formatDate, initials, priorityLabel, statusLabel } from "./lib/format";
import { useHubSocket } from "./hooks/useHubSocket";
import type { Channel, Metrics, Ticket, TicketStatus, User } from "./types";

const statuses: Array<TicketStatus | "ALL"> = ["ALL", "NEW", "AI_TRIAGE", "OPEN", "PENDING", "CLOSED"];
const channels: Array<Channel | "ALL"> = ["ALL", "WHATSAPP", "SITE", "APP"];
type HubView = "inbox" | "ai" | "channels";

export function App() {
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    me()
      .then(({ user }) => setSessionUser(user))
      .catch(() => clearToken())
      .finally(() => setAuthLoading(false));
  }, []);

  if (authLoading) {
    return (
      <main className="boot-screen">
        <ClaroLogo variant="light" size="large" />
        <div className="boot-pulse" />
      </main>
    );
  }

  if (!sessionUser) {
    return (
      <div className="screen-transition">
        <LoginScreen onLogin={setSessionUser} />
      </div>
    );
  }

  return (
    <div className="screen-transition">
      <Hub user={sessionUser} onLogout={() => setSessionUser(null)} />
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("admin@claro.com.br");
  const [password, setPassword] = useState("Claro@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const session = await login(email, password);
      onLogin(session.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-backdrop" aria-hidden="true" />
      <section className="login-panel" aria-label="Login">
        <div className="login-brand">
          <ClaroLogo />
          <div>
            <h1>Claro HUB AI</h1>
            <p>Central de atendimento conversacional</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            E-mail
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
          </label>
          <label>
            Senha
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="primary-action" disabled={loading}>
            <ShieldCheck size={18} />
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Hub({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<TicketStatus | "ALL">("ALL");
  const [channel, setChannel] = useState<Channel | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<HubView>("inbox");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ tickets: nextTickets }, nextMetrics] = await Promise.all([
        listTickets({ status, channel, q: query }),
        getMetrics()
      ]);
      setTickets(nextTickets);
      setMetrics(nextMetrics);
      setSelectedId((current) => current ?? nextTickets[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }, [channel, query, status]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTicketUpdated = useCallback((ticket: Ticket) => {
    setTickets((current) => {
      const exists = current.some((item) => item.id === ticket.id);
      const next = exists ? current.map((item) => (item.id === ticket.id ? ticket : item)) : [ticket, ...current];
      return next.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    });
    setMetrics((current) => current);
  }, []);

  useHubSocket(handleTicketUpdated);

  const selectedTicket = useMemo(() => tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0] ?? null, [tickets, selectedId]);

  function logout() {
    clearToken();
    onLogout();
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <ClaroLogo variant="light" />
          <span>HUB AI</span>
        </div>

        <nav className="nav-list" aria-label="Principal">
          <button className={`nav-item ${activeView === "inbox" ? "active" : ""}`} title="Inbox" onClick={() => setActiveView("inbox")}>
            <Inbox size={19} />
            <span>Inbox</span>
          </button>
          <button className={`nav-item ${activeView === "ai" ? "active" : ""}`} title="Automação" onClick={() => setActiveView("ai")}>
            <Bot size={19} />
            <span>IA</span>
          </button>
          <button className={`nav-item ${activeView === "channels" ? "active" : ""}`} title="Canais" onClick={() => setActiveView("channels")}>
            <Wifi size={19} />
            <span>Canais</span>
          </button>
        </nav>

        <button className="nav-item logout" onClick={logout} title="Sair">
          <LogOut size={19} />
          <span>Sair</span>
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Claro Atendimento</span>
            <h2>Convergência Conversacional</h2>
          </div>
          <div className="agent-pill">
            <div className="avatar">{initials(user.name)}</div>
            <div>
              <strong>{user.name}</strong>
              <span>{user.role}</span>
            </div>
          </div>
        </header>

        {activeView === "inbox" ? (
          <>
            <Dashboard metrics={metrics} />

            <section className="hub-grid">
              <div className="queue-panel">
                <div className="panel-header">
                  <div>
                    <h3>Fila Unificada</h3>
                    <span>{loading ? "Atualizando" : `${tickets.length} chamados`}</span>
                  </div>
                  <button className={`icon-button ${loading ? "is-spinning" : ""}`} title="Atualizar fila" onClick={load}>
                    <Clock3 size={18} />
                  </button>
                </div>

                <div className="filter-row">
                  <div className="search-box">
                    <Search size={17} />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" />
                  </div>
                  <Select value={status} onChange={(value) => setStatus(value as TicketStatus | "ALL")} options={statuses} getLabel={(value) => (value === "ALL" ? "Status" : statusLabel[value])} />
                  <Select value={channel} onChange={(value) => setChannel(value as Channel | "ALL")} options={channels} getLabel={(value) => (value === "ALL" ? "Canal" : channelLabel[value])} />
                </div>

                <div className="ticket-list">
                  {loading && tickets.length === 0 ? (
                    <TicketSkeleton />
                  ) : (
                    tickets.map((ticket) => (
                      <TicketRow
                        key={ticket.id}
                        ticket={ticket}
                        active={ticket.id === selectedTicket?.id}
                        onClick={() => setSelectedId(ticket.id)}
                      />
                    ))
                  )}
                </div>
              </div>

              <TicketConversation
                ticket={selectedTicket}
                user={user}
                onAssign={async (ticketId) => {
                  const { ticket } = await assignToMe(ticketId, user.id);
                  handleTicketUpdated(ticket);
                }}
                onStatus={async (ticketId, nextStatus) => {
                  const { ticket } = await updateStatus(ticketId, nextStatus);
                  handleTicketUpdated(ticket);
                }}
                onSend={async (ticketId, body) => {
                  const { ticket } = await sendMessage(ticketId, body);
                  handleTicketUpdated(ticket);
                }}
                onGenerate={async (ticketId) => {
                  const { ticket } = await generateReply(ticketId);
                  handleTicketUpdated(ticket);
                }}
              />
            </section>
          </>
        ) : activeView === "ai" ? (
          <AiWorkspace />
        ) : (
          <ChannelsWorkspace />
        )}
      </section>
    </main>
  );
}

function Dashboard({ metrics }: { metrics: Metrics | null }) {
  if (!metrics) {
    return (
      <section className="metrics-grid" aria-label="Indicadores carregando">
        {Array.from({ length: 4 }, (_, index) => (
          <MetricSkeleton key={index} />
        ))}
      </section>
    );
  }

  const byChannel = Object.fromEntries((metrics?.byChannel ?? []).map((item) => [item.channel, item.count]));

  return (
    <section className="metrics-grid" aria-label="Indicadores">
      <MetricCard icon={<Headphones size={20} />} label="Em atendimento" value={metrics?.totalOpen ?? 0} tone="red" />
      <MetricCard icon={<Sparkles size={20} />} label="Triagem IA" value={metrics?.aiTriaged ?? 0} tone="blue" />
      <MetricCard icon={<Phone size={20} />} label="WhatsApp" value={byChannel.WHATSAPP ?? 0} tone="green" />
      <MetricCard icon={<TicketCheck size={20} />} label="Urgentes" value={metrics?.urgent ?? 0} tone="amber" />
    </section>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <article className={`metric-card tone-${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function MetricSkeleton() {
  return (
    <article className="metric-card metric-skeleton">
      <span className="skeleton-icon" />
      <div>
        <span className="skeleton-line skeleton-medium" />
        <strong className="skeleton-number" />
      </div>
    </article>
  );
}

function AiWorkspace() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getIntegrationStatus>> | null>(null);
  const [message, setMessage] = useState("Cliente informa que está sem internet desde ontem e precisa de suporte urgente.");
  const [result, setResult] = useState<Awaited<ReturnType<typeof testAi>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getIntegrationStatus().then(setStatus).catch((err) => setError(err instanceof Error ? err.message : "Falha ao ler status."));
  }, []);

  async function runTest() {
    setLoading(true);
    setError("");
    try {
      setResult(await testAi(message));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao testar IA.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="settings-grid">
      <article className="settings-panel hero-panel">
        <div className="settings-heading">
          <div className="panel-icon tone-blue">
            <Bot size={22} />
          </div>
          <div>
            <span className="eyebrow">Automação</span>
            <h3>IA de triagem e resposta</h3>
          </div>
        </div>
        <p>
          A IA classifica o chamado, estima prioridade, resume o caso e gera uma resposta sugerida para o atendente usar
          com segurança.
        </p>
        <div className="status-row">
          <StatusPill ok={Boolean(status?.ai.configured)} label={status?.ai.configured ? "OpenAI conectado" : "Fallback local"} />
          <span>Modelo: {status?.ai.model ?? "carregando"}</span>
          <span>Auto-resposta: {Math.round((status?.ai.autoReplyThreshold ?? 0) * 100)}%</span>
        </div>
      </article>

      <article className="settings-panel">
        <div className="panel-header flat">
          <div>
            <h3>Teste de IA</h3>
            <span>Valide se a chave OpenAI está respondendo pelo backend.</span>
          </div>
          <button className="primary-action compact-action" disabled={loading || !message.trim()} onClick={runTest}>
            <Sparkles size={17} />
            {loading ? "Testando" : "Testar"}
          </button>
        </div>
        <textarea className="settings-textarea" value={message} onChange={(event) => setMessage(event.target.value)} rows={4} />
        {error ? <p className="form-error">{error}</p> : null}
        {result ? (
          <div className="result-card">
            <div className="result-meta">
              <Badge value={result.provider === "openai" ? "OpenAI" : "Fallback"} tone={result.provider === "openai" ? "site" : "medium"} />
              <Badge value={result.result.priority} tone={result.result.priority.toLowerCase()} />
              <span>{Math.round(result.result.confidence * 100)}% confiança</span>
            </div>
            {result.providerError ? <p className="warning-message">{result.providerError}</p> : null}
            <strong>{result.result.summary}</strong>
            <p>{result.result.suggestedReply}</p>
            <small>{result.result.nextBestAction}</small>
          </div>
        ) : null}
      </article>
    </section>
  );
}

function ChannelsWorkspace() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getIntegrationStatus>> | null>(null);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof getWhatsAppEvents>>["events"]>([]);
  const [to, setTo] = useState("+55 11 97785-4607");
  const [message, setMessage] = useState("Teste do Claro HUB AI: WhatsApp integrado com sucesso.");
  const [messageId, setMessageId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function refreshStatus() {
    setError("");
    try {
      const [nextStatus, nextEvents] = await Promise.all([getIntegrationStatus(), getWhatsAppEvents()]);
      setStatus(nextStatus);
      setEvents(nextEvents.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao ler status.");
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function sendTest() {
    setLoading(true);
    setError("");
    setFeedback("");
    setMessageId(null);
    try {
      const response = await testWhatsApp(to, message);
      setMessageId(response.messageId);
      setFeedback("Texto livre aceito pela Meta. A entrega só acontece se existir janela de atendimento aberta pelo cliente.");
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar WhatsApp.");
    } finally {
      setLoading(false);
    }
  }

  async function sendTemplateTest() {
    setLoading(true);
    setError("");
    setFeedback("");
    setMessageId(null);
    try {
      const response = await testWhatsAppTemplate(to);
      setMessageId(response.messageId);
      setFeedback("Template hello_world aceito pela Meta. Esse é o teste correto para iniciar conversa fora da janela de 24h.");
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar template WhatsApp.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="settings-grid">
      <article className="settings-panel hero-panel">
        <div className="settings-heading">
          <div className="panel-icon tone-green">
            <Wifi size={22} />
          </div>
          <div>
            <span className="eyebrow">Canais</span>
            <h3>WhatsApp, Site e App</h3>
          </div>
        </div>
        <p>
          O HUB recebe mensagens via webhook do WhatsApp e por API pública para Site/App, criando chamados unificados com
          triagem automática.
        </p>
        <div className="status-row">
          <StatusPill ok={Boolean(status?.whatsapp.configured)} label={status?.whatsapp.configured ? "WhatsApp conectado" : "WhatsApp incompleto"} />
          <StatusPill ok={Boolean(status?.ai.configured)} label={status?.ai.configured ? "IA conectada" : "IA em fallback"} />
          <span>Phone ID: {status?.whatsapp.phoneNumberIdLast4 ? `****${status.whatsapp.phoneNumberIdLast4}` : "ausente"}</span>
        </div>
      </article>

      <article className="settings-panel">
        <div className="panel-header flat">
          <div>
            <h3>Teste de WhatsApp</h3>
            <span>Use template para iniciar conversa; use texto livre apenas depois do cliente responder.</span>
          </div>
          <div className="header-actions">
            <button className="secondary-action compact-action" disabled={loading || !to.trim()} onClick={sendTemplateTest}>
              <MessageCircle size={17} />
              Template
            </button>
            <button className="primary-action compact-action" disabled={loading || !to.trim() || !message.trim()} onClick={sendTest}>
              <Send size={17} />
              Texto livre
            </button>
          </div>
        </div>

        <div className="settings-form-grid">
          <label>
            Número de teste
            <input value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <label>
            Mensagem
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} />
          </label>
        </div>

        <div className="channel-cards">
          <InfoCard icon={<Phone size={19} />} title="WhatsApp" text="/api/integrations/whatsapp/webhook" />
          <InfoCard icon={<Globe2 size={19} />} title="Site/App" text="/api/integrations/public/message" />
          <InfoCard icon={<KeyRound size={19} />} title="Verify token" text="Configurado no server/.env" />
        </div>

        {feedback ? <p className="success-message">{feedback}</p> : null}
        {messageId ? <p className="message-id">Message ID: {messageId}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        <div className="events-panel">
          <div className="panel-header flat compact-header">
            <div>
              <h3>Últimos eventos WhatsApp</h3>
              <span>Entrega real aparece aqui quando a Meta enviar status por webhook.</span>
            </div>
            <button className="icon-button" title="Atualizar eventos" onClick={() => void refreshStatus()}>
              <Clock3 size={17} />
            </button>
          </div>
          <div className="event-list">
            {events.length ? (
              events.slice(0, 8).map((event) => (
                <div className="event-row" key={event.id}>
                  <Badge value={event.eventType.replace("STATUS_", "")} tone={event.eventType.includes("FAILED") ? "urgent" : event.eventType.includes("DELIVERED") || event.eventType.includes("READ") ? "low" : "neutral"} />
                  <span>{event.externalId ?? "sem id"}</span>
                  <time>{formatDate(event.createdAt)}</time>
                </div>
              ))
            ) : (
              <p className="muted-copy">Nenhum status de entrega recebido ainda.</p>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`status-pill ${ok ? "ok" : "warn"}`}>
      <CheckCircle2 size={15} />
      {label}
    </span>
  );
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="info-card">
      <div className="info-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

function TicketRow({ ticket, active, onClick }: { ticket: Ticket; active: boolean; onClick: () => void }) {
  const latest = ticket.messages.at(-1);

  return (
    <button className={`ticket-row ${active ? "active" : ""}`} onClick={onClick}>
      <div className="ticket-row-top">
        <strong>{ticket.customer.name}</strong>
        <span>{formatDate(ticket.lastMessageAt)}</span>
      </div>
      <div className="ticket-subject">{ticket.subject}</div>
      <p>{latest?.body ?? ticket.summary}</p>
      <div className="ticket-meta">
        <Badge value={channelLabel[ticket.channel]} tone={ticket.channel.toLowerCase()} />
        <Badge value={statusLabel[ticket.status]} tone="neutral" />
        <Badge value={priorityLabel[ticket.priority]} tone={ticket.priority.toLowerCase()} />
      </div>
    </button>
  );
}

function TicketConversation({
  ticket,
  user,
  onAssign,
  onStatus,
  onSend,
  onGenerate
}: {
  ticket: Ticket | null;
  user: User;
  onAssign: (ticketId: string) => Promise<void>;
  onStatus: (ticketId: string, status: TicketStatus) => Promise<void>;
  onSend: (ticketId: string, body: string) => Promise<void>;
  onGenerate: (ticketId: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft("");
  }, [ticket?.id]);

  if (!ticket) {
    return (
      <div className="conversation-panel empty-state">
        <MessageCircle size={38} />
        <strong>Nenhum chamado selecionado</strong>
      </div>
    );
  }

  const suggestion = ticket.suggestions[0];

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="conversation-panel">
      <div className="conversation-header">
        <div>
          <div className="protocol-line">
            <span>{ticket.protocol}</span>
            <Badge value={channelLabel[ticket.channel]} tone={ticket.channel.toLowerCase()} />
          </div>
          <h3>{ticket.subject}</h3>
          <p>{ticket.customer.phone ?? ticket.customer.email ?? ticket.customer.claroId ?? "Cliente Claro"}</p>
        </div>
        <div className="header-actions">
          <button className="secondary-action" disabled={busy || ticket.assignedTo?.id === user.id} onClick={() => run(() => onAssign(ticket.id))}>
            <UserRound size={17} />
            {ticket.assignedTo?.id === user.id ? "Com você" : "Assumir"}
          </button>
          <Select value={ticket.status} onChange={(value) => run(() => onStatus(ticket.id, value as TicketStatus))} options={statuses.filter((item) => item !== "ALL") as TicketStatus[]} getLabel={(value) => statusLabel[value]} />
        </div>
      </div>

      <div className="context-strip">
        <div>
          <span>Resumo</span>
          <strong>{ticket.summary ?? "Aguardando triagem"}</strong>
        </div>
        <div>
          <span>Prioridade</span>
          <strong>{priorityLabel[ticket.priority]}</strong>
        </div>
        <div>
          <span>Confiança IA</span>
          <strong>{Math.round((ticket.aiConfidence ?? 0) * 100)}%</strong>
        </div>
      </div>

      {suggestion ? (
        <section className="ai-panel">
          <div className="ai-panel-head">
            <Sparkles size={18} />
            <strong>Sugestão IA</strong>
            <span>{Math.round(suggestion.confidence * 100)}%</span>
          </div>
          <p>{suggestion.suggestedReply}</p>
          <small>{suggestion.nextBestAction}</small>
          <div className="ai-actions">
            <button className="secondary-action" onClick={() => setDraft(suggestion.suggestedReply)}>
              <CheckCircle2 size={17} />
              Usar resposta
            </button>
            <button className="icon-button" title="Gerar nova sugestão" disabled={busy} onClick={() => run(() => onGenerate(ticket.id))}>
              <Sparkles size={17} />
            </button>
          </div>
        </section>
      ) : (
        <section className="ai-panel compact">
          <button className="secondary-action" disabled={busy} onClick={() => run(() => onGenerate(ticket.id))}>
            <Sparkles size={17} />
            Gerar sugestão
          </button>
        </section>
      )}

      <div className="message-stream">
        {ticket.messages.map((message) => (
          <div key={message.id} className={`message-bubble ${message.senderType.toLowerCase()}`}>
            <span>{message.senderType === "CUSTOMER" ? ticket.customer.name : message.senderType === "AGENT" ? "Atendente" : message.senderType}</span>
            <p>{message.body}</p>
            <time>{formatDate(message.createdAt)}</time>
          </div>
        ))}
      </div>

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          void run(async () => {
            await onSend(ticket.id, draft.trim());
            setDraft("");
          });
        }}
      >
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Responder" rows={3} />
        <button className="primary-action send-button" disabled={busy || !draft.trim()} title="Enviar resposta">
          <Send size={18} />
          Enviar
        </button>
      </form>
    </div>
  );
}

function Badge({ value, tone }: { value: string; tone: string }) {
  return <span className={`badge tone-${tone}`}>{value}</span>;
}

function Select<T extends string>({
  value,
  options,
  getLabel,
  onChange
}: {
  value: T;
  options: T[];
  getLabel: (value: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <label className="select-control">
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {getLabel(option)}
          </option>
        ))}
      </select>
      <ChevronDown size={16} />
    </label>
  );
}

function ClaroLogo({ variant = "red", size = "default" }: { variant?: "red" | "light"; size?: "default" | "large" }) {
  return (
    <div className={`claro-logo claro-logo-${variant} claro-logo-${size}`} aria-label="Claro">
      <img src="/assets/claro-logo.svg" alt="Claro" />
    </div>
  );
}

function TicketSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => (
        <div className="ticket-row ticket-skeleton" key={index}>
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line skeleton-medium" />
          <div className="skeleton-line skeleton-body" />
          <div className="ticket-meta">
            <span className="skeleton-pill" />
            <span className="skeleton-pill" />
            <span className="skeleton-pill" />
          </div>
        </div>
      ))}
    </>
  );
}
