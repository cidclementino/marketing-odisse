# Universo · marketing-odisse — API do Marketing

As telas do Marketing moram no Universo, em `universo.odisse.com.br/marketing/` (repo universo-odisse, pasta
`marketing/`, que tem o README das telas). `marketing.odisse.com.br` só redireciona para lá (`index.html` e
`sw.js` daqui só fazem isso e desligam o service worker antigo).

Este repo guarda a **API**: o Cloudflare Worker em `worker/`, publicado pelo `.github/workflows/worker.yml` a cada
mudança em `worker/` ou em `assets/js/grade.js`. O `assets/js/grade.js` é importado pelo Worker (Início do
Universo); há uma cópia em `universo-odisse/marketing/assets/js/grade.js`: mudou lá, mude aqui.

## Worker (`worker/index.js`)

Endereço: `https://universo-odisse.reservaprojectbasework.workers.dev`. Todas as rotas exigem a senha da equipe
(`Authorization: Bearer <UNIVERSO_SENHA>`), menos o retorno do login do Meta.

- **KV `UNIVERSO`** (id em `worker/wrangler.toml`):
  - `pub:<id>` publicação completa · `resumo:<id>` resumo para o arquivo (com `criado`, `atualizado`, `salvoEm`,
    `enviadoEm`, `arquivado` e a miniatura da capa) · `img:<ref>` imagem (binário) · `pool:<id>` item do pool de
    mídias · `cfg:<chave>` configurações comuns (`pin-pastas`, `estrategia`, `pautas`)
  - Instagram e métricas: `ig:token`, `ig:app`, `ig:estado`, `ig:dias`, `ig:posts`, `ig:vinculos`,
    `igmini:<id>`, `ig:online`, `ig:publico`, `ig:publico-hist`, `ig:stories`, `met:etiquetas`, `conc:*`
- **Rotas:** `GET/PUT /api/publicacoes[/:id]` (a tela arquiva com `arquivado`; o `DELETE` ainda apaga a
  publicação e as imagens que só ela usa) · `HEAD/GET/PUT /api/imagens/:ref` · `GET /api/pool`,
  `PUT/DELETE /api/pool/:id` · `GET/PUT /api/config/:chave` · Instagram (`/api/instagram/…`), etiquetas
  (`/api/metricas/etiquetas/:chave`) e concorrentes (`/api/concorrentes[/:usuario]`). A lista completa está no
  cabeçalho de `worker/index.js`.
- **Cron diário** 09:17 UTC (06:17 de Brasília): coleta do Instagram e dos concorrentes (`instagram.js`,
  `concorrentes.js`), com no máximo 42 consultas por coleta.
- **Vínculo automático** de um post do Instagram com a publicação que o gerou: quando só uma publicação tem o
  dia do post, pelo dia do item no pool (encaixe ou publicação confirmada); nas publicações antigas, de antes do
  pool, pela data escolhida à mão no editor (`globais.dataPublicacao`).
- **Ponto de entrada `Universo`** (Worker a Worker, sem senha; binding `MARKETING` no hub, `worker/universo.js`):
  `resumo(dia)` (publicações do dia por plataforma, atrasadas e o Instagram de ontem), `periodo(de, ate)` (KPIs) e
  `publicar({ tipo, id })` (Confirmar publicação na Início).
- **Retorno do login do Meta:** aceita `universo.odisse.com.br/marketing/` (e o endereço antigo).

## Configuração (feita uma vez)

Namespace KV `UNIVERSO` e, no GitHub, os secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` e
`UNIVERSO_SENHA`. Conexão do Instagram: app do Meta `odisse_metricas` com login unificado, token de usuário do
sistema sem expiração e o redirecionamento `https://universo-odisse.reservaprojectbasework.workers.dev/api/instagram/retorno`;
na página Métricas, ID do app, chave secreta e ID da configuração, e *Entrar com o Instagram*. Token e chave ficam
só no KV e nunca voltam pela API.
