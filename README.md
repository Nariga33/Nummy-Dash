# Outbound Dashboard

Dashboard gerencial de operação outbound: acompanha quantidade de ligações
(via API4COM) e quantidade de mensagens WhatsApp encaminhadas, com login por
e-mail e senha (contas criadas apenas por administradores, sem cadastro
público).

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Auth.js (NextAuth v5) com credenciais (e-mail/senha), sessão JWT
- Prisma + SQLite (troque `DATABASE_URL` para Postgres em produção se preferir)
- Recharts para os gráficos

## Configuração local

```bash
npm install
cp .env.example .env   # preencha os segredos (veja abaixo)
npx prisma migrate deploy
npm run db:seed        # cria o primeiro usuário admin + dados de demonstração
npm run dev
```

Acesse `http://localhost:3000` e entre com o `ADMIN_EMAIL` / `ADMIN_PASSWORD`
definidos no `.env`.

### Variáveis de ambiente (`.env`)

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Conexão do banco (SQLite por padrão) |
| `AUTH_SECRET` | Segredo do Auth.js — gere com `openssl rand -base64 32` |
| `INTEGRATIONS_ENCRYPTION_KEY` | Chave usada para criptografar as credenciais de integração salvas no banco — gere com `openssl rand -hex 32` |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Conta admin criada no primeiro `npm run db:seed` |
| `WHATSAPP_WEBHOOK_TOKEN` | Token padrão do webhook de WhatsApp (pode ser trocado depois pela tela Integrações) |

## Como os dados chegam no dashboard

### Ligações — API4COM

Em **Integrações**, um administrador cola a chave de API da API4COM e pode:

- **Testar conexão** — valida a chave direto contra a API4COM.
- **Sincronizar agora** — busca o histórico de ligações e grava em
  `CallRecord`, alimentando os cards e o gráfico.

O cliente da API4COM está em `src/lib/integrations/api4com.ts`. Como a
API4COM pode variar o formato exato da resposta por conta/plano, a função
`normalizeCall` é o único lugar que deve ser ajustado caso os nomes de campo
retornados sejam diferentes dos assumidos — use "Testar conexão" para ver a
resposta bruta assim que a chave real for configurada.

Sincronização automática periódica (cron) ainda não está configurada — hoje
é acionada manualmente pelo botão "Sincronizar agora". Para automatizar,
chame `POST /api/sync/api4com` (autenticado como admin) num agendador (cron
job, Vercel Cron, etc.).

### Mensagens — WhatsApp

Não há uma API de WhatsApp fixa: qualquer plataforma usada pela operação
(Evolution API, Z-API, WPPConnect, Meta Cloud API, CRM, etc.) pode alimentar
o dashboard de duas formas:

1. **Webhook** — configure a plataforma para enviar um evento por mensagem
   para `POST /api/webhooks/whatsapp` com o header `x-webhook-token` (token
   definido na tela Integrações).
2. **Lançamento manual** — enquanto nenhuma API está conectada, um admin
   pode registrar a quantidade de mensagens de um dia diretamente na tela
   Integrações.

## Usuários

Não existe cadastro público. Um administrador cria cada login em
**Usuários** (nome, e-mail, senha provisória, papel Admin/Visualizador) e
repassa as credenciais à pessoa. Sempre deve haver pelo menos um
administrador ativo no sistema.

## Dados de demonstração

Enquanto a API4COM não está conectada, `npm run db:seed` popula o banco com
30 dias de ligações e mensagens fictícias (marcadas como demo) para o
dashboard não ficar vazio. Um aviso amarelo aparece no topo enquanto os
dados exibidos forem de demonstração.
