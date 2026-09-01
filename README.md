# Outbound Dashboard

Dashboard gerencial de operação outbound: acompanha quantidade de ligações
(via API4COM), quantidade de mensagens WhatsApp encaminhadas e prospecção de
empresas de e-commerce via Apollo, com login por e-mail e senha (contas
criadas apenas por administradores, sem cadastro público).

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Auth.js (NextAuth v5) com credenciais (e-mail/senha), sessão JWT
- Prisma + PostgreSQL
- Recharts para os gráficos

## Banco de dados local

O projeto usa PostgreSQL (necessário para funcionar em hospedagens
serverless como a Vercel, que não têm disco persistente). Para rodar
localmente, instale o Postgres e crie um banco:

```bash
sudo -u postgres psql -c "CREATE USER nummydash WITH PASSWORD 'localdevpass' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE nummydash OWNER nummydash;"
```

Ou use um banco gratuito na nuvem (Neon, Supabase, Vercel Postgres) e cole a
connection string em `DATABASE_URL`.

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
| `DATABASE_URL` | Connection string do PostgreSQL |
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

### Prospecção — Apollo (empresas de e-commerce)

Tela **Prospecção** (`/prospeccao`) para buscar lojas online direto no
Apollo, endereçando dois problemas específicos:

1. **Empresas pequenas somem da busca.** Filtrando direto na UI do Apollo é
   fácil esquecer de marcar as faixas pequenas de funcionários (1–10,
   11–20), então o resultado fica dominado por empresas grandes. Aqui a
   busca sempre manda faixas explícitas para a API — nunca "todas" — e as
   faixas pequenas (1–10, 11–20, 21–50, 51–100) já vêm marcadas por padrão.
   Essa é justamente a lacuna que o concorrente interno, focado nas
   empresas grandes, deixa aberta — o ICP daqui começa nesse porte menor.
2. **Precisa ser e-commerce com carrinho ativo.** A busca filtra por
   `technology_names` do Apollo, reconhecendo plataformas de carrinho
   (Shopify, Nuvemshop, VTEX, Loja Integrada, Tray, WooCommerce, Magento,
   BigCommerce, Wake, Linx, Vnda, Yampi, Wix Stores, PrestaShop, OpenCart,
   Cartpanda, Salesforce Commerce Cloud). Cada empresa retornada mostra a(s)
   plataforma(s) detectada(s) — se nenhuma vier marcada na busca, o filtro
   de tecnologia fica desligado e traz e-commerce e não-e-commerce juntos.

Cada empresa encontrada é salva com link do site e do LinkedIn, porte
(nº de funcionários), local e um status de funil (Novo → Contatado →
Qualificado/Descartado) que pode ser atualizado direto na tabela. O Apollo
não expõe faturamento em reais de forma confiável — o corte de R$ 50 mil/mês
do ICP entra como critério manual na hora de qualificar, usando porte e
plataforma como sinais.

Para conectar: em **Integrações**, cole a API key do Apollo (Settings → API
no painel do Apollo) e clique em "Testar conexão".

#### Decisores e telefone

Em cada empresa da lista, o botão **Decisores** abre uma busca de pessoas por
cargo e/ou nome (ex: "Sócio, Fundador, CEO, Diretor" ou o nome de alguém),
igual à busca de pessoas do próprio Apollo — mas já restrita àquela empresa.
A busca de pessoas do Apollo nunca devolve telefone direto; por isso cada
decisor tem um botão **Revelar telefone**, que:

1. Pede confirmação (a revelação consome 1 crédito Apollo por decisor).
2. Dispara a revelação, que é **assíncrona** — o Apollo não devolve o número
   na hora, ele confirma depois via webhook (`/api/webhooks/apollo-phone`,
   autenticado por um token gerado automaticamente ao salvar a chave do
   Apollo). O decisor fica "Pendente" até o webhook chegar (segundos a poucos
   minutos) — atualize a página pra ver o número.

E-mail não é o foco (o time não usa muito) — a tela não pede revelação de
e-mail, só telefone. O formato exato do payload do webhook do Apollo ainda
não foi confirmado com uma revelação real nesta sessão (só a busca de
empresas foi validada com uma chamada real) — o payload recebido é logado no
servidor pra ajustar `normalizePhoneWebhook` em
`src/lib/integrations/apollo.ts` assim que a primeira revelação real
acontecer.

Validado com uma busca real: Brasil + 1–50 funcionários + qualquer uma das
tecnologias retornou 6.293 empresas — confirma que a lacuna existe e é
grande. Os slugs de tecnologia confirmados nessa busca foram `shopify`,
`loja_integrada`, `vtex`, `wake_commerce`, `linx_commerce`, `vnda` e
`cartpanda` (ver comentário em `src/lib/integrations/apollo.ts` para o que
ainda falta confirmar, incluindo o slug real do Nuvemshop e do WooCommerce).
A mesma busca também trouxe empresas sem carrinho nenhum — a detecção de
tecnologia do Apollo tem falso-positivo, por isso os resultados entram como
"Novo" e passam pelo funil manual antes de virar contato.

## Usuários

Não existe cadastro público. Um administrador cria cada login em
**Usuários** (nome, e-mail, senha provisória, papel Admin/Visualizador) e
repassa as credenciais à pessoa. Sempre deve haver pelo menos um
administrador ativo no sistema.

## Deploy na Vercel

`vercel.json` já define o build command (`prisma migrate deploy && db:seed && next build`),
então migração e criação do admin acontecem sozinhas a cada deploy — não
precisa rodar nada manualmente depois.

1. Importe este repositório em [vercel.com/new](https://vercel.com/new), branch `claude/outbound-management-dashboard-3h9myg`.
2. Adicione as variáveis de ambiente (Settings → Environment Variables, ou na tela de import): `AUTH_SECRET`, `INTEGRATIONS_ENCRYPTION_KEY`, `WHATSAPP_WEBHOOK_TOKEN`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (valores fortes e únicos).
3. Aba **Storage** → conecte/crie um banco Postgres — preenche `DATABASE_URL` sozinho e dispara um novo deploy.
4. Pronto. Acesse a URL gerada e entre com o `ADMIN_EMAIL`/`ADMIN_PASSWORD` do passo 2.

## Dados de demonstração (opcional)

Por padrão o dashboard mostra zero até a API4COM/WhatsApp serem conectados —
não gera nenhum número fictício sozinho. Se quiser ver a UI populada para
teste, defina `SEED_DEMO_DATA="true"` antes de rodar `npm run db:seed`: isso
cria 30 dias de ligações e mensagens fictícias (marcadas como demo), com um
aviso amarelo no topo do dashboard e um botão para apagar esses dados a
qualquer momento (aba Visão geral, ou `POST /api/demo-data/clear`).
