import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { io } from 'socket.io-client';

const base = process.env.DEMO_API_URL ?? process.argv[2];
if (!base) throw new Error('Informe DEMO_API_URL ou a URL como argumento.');
const password = process.env.DEMO_PASSWORD;
if (!password) throw new Error('Configure DEMO_PASSWORD.');
const evidence = { apiUrl: base, timestamp: new Date().toISOString(), checks: [] };
async function request(method, path, body, token, expected = 200) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(90000)
  });
  const data = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
  evidence.checks.push({ method, path, status: response.status, ...(path.includes('/login') || path === '/api/integrations/status' ? {} : { response: data }) });
  console.log(`${method} ${path} -> ${response.status}`);
  return data;
}
let socket;
try {
  const health = await request('GET', '/api/health');
  assert.equal(health.ok, true);
  assert.match(health.database, /postgres/i, 'A demonstracao exige PostgreSQL em nuvem.');
  await request('GET', '/api/health/architecture');
  await request('GET', '/api/tickets', undefined, undefined, 401);
  await request('POST', '/api/integrations/public/message', { channel: 'INVALID' }, undefined, 400);
  const { token, user } = await request('POST', '/api/auth/login', { email: process.env.DEMO_EMAIL ?? 'admin@claro.com.br', password });
  const unauthorized = io(base, { transports: ['websocket'], reconnection: false, timeout: 20000 });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unauthorized.disconnect(); reject(new Error('Timeout ao verificar bloqueio do socket anonimo')); }, 25000);
    unauthorized.on('connect', () => { clearTimeout(timer); unauthorized.disconnect(); reject(new Error('Socket anonimo foi aceito')); });
    unauthorized.on('connect_error', error => { clearTimeout(timer); unauthorized.disconnect(); error.message === 'Sessao invalida.' ? resolve() : reject(error); });
  });
  evidence.checks.push({ check: 'Socket anonimo rejeitado', passed: true });
  socket = io(base, { auth: { token }, transports: ['websocket'], reconnection: false, timeout: 20000 });
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  const events = [];
  socket.on('ticket:updated', ticket => events.push(ticket));
  const runId = Date.now();
  const body = { channel: 'SITE', subject: `Demo Azure ${runId}`, body: 'Minha internet Claro esta lenta e preciso de suporte.', customer: { name: `Cliente Demo ${runId}`, phone: `55119${String(runId).slice(-8)}`, email: `demo.${runId}@example.com` } };
  const created = await request('POST', '/api/integrations/public/message', body, undefined, 201);
  assert.ok(created.protocol);
  const list = await request('GET', `/api/tickets?q=${encodeURIComponent(created.protocol)}`, undefined, token);
  const saved = list.tickets.find(ticket => ticket.protocol === created.protocol);
  assert.ok(saved);
  assert.equal(saved.customer.phone, body.customer.phone);
  assert.ok(saved.messages.some(message => message.body === body.body));
  assert.ok(saved.suggestions.length);
  const id = saved.id;
  await request('POST', `/api/tickets/${id}/assign`, { userId: user.id }, token);
  const reply = `Resposta do atendente ${runId}: vamos verificar sua conexao.`;
  await request('POST', `/api/tickets/${id}/messages`, { body: reply, sendToChannel: false }, token, 201);
  await request('PATCH', `/api/tickets/${id}/status`, { status: 'CLOSED' }, token);
  const reread = await request('GET', `/api/tickets/${id}`, undefined, token);
  assert.equal(reread.ticket.status, 'CLOSED');
  assert.equal(reread.ticket.assignedTo.id, user.id);
  assert.ok(reread.ticket.messages.some(message => message.body === reply));
  await request('GET', '/api/tickets/metrics/summary', undefined, token);
  const ai = await request('POST', '/api/integrations/ai/test', { message: 'Minha internet Claro esta lenta.' }, token);
  assert.ok(ai.result.suggestedReply);
  await request('GET', '/api/integrations/status', undefined, token);
  assert.ok(events.some(ticket => ticket.id === id && ticket.status === 'CLOSED'), 'Evento WebSocket de encerramento ausente.');
  evidence.checks.push({ check: 'WebSocket autenticado recebeu atualizacoes', passed: true, count: events.length });
  evidence.protocol = created.protocol;
  evidence.passed = true;
  mkdirSync('docs/evidencias', { recursive: true });
  const filename = `docs/evidencias/azure-${runId}.json`;
  writeFileSync(filename, JSON.stringify(evidence, null, 2));
  console.log(`SUCESSO: ${created.protocol} gravado, relido, respondido e encerrado no PostgreSQL. Evidencia: ${filename}`);
} finally {
  socket?.disconnect();
}
