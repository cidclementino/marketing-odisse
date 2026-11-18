# Universo · marketing-odisse

Plataforma de gestão de marketing e aceleração de produção de mídias do **Odisse — Estúdio de Arquitetura & Design**.

A primeira página é o **editor de posts 3:4** para o Instagram (1080 × 1440 px). Ele segue o *Manual do sistema* (v1, out. 2026): grid de 12 colunas, Inter, ardósia como tinta, um registro por núcleo e o repertório de modelos de cada um.

## Como usar

1. **Início:** em *Nova publicação*, escolha o núcleo (Estúdio, Arquitetos, Objetos ou Elaia). O carrossel já começa com a sequência de modelos dele. Abaixo fica o **Arquivo**, com tudo o que foi criado, filtro por núcleo e busca.
2. **Informações (à esquerda):** *Publicação* (projeto ou série, data, contador, selo), depois as **imagens do card selecionado** e, por fim, *Fechamento e contatos*. Publicação e fechamento valem para todos os cards; as imagens, só para o card ativo. Os textos de ajuda ficam no ícone (i), ao pousar o mouse.
3. **Modelos (à direita):** cada núcleo tem o próprio repertório (tirado do `post-3x4-templates`), agrupado em *Capas*, *Corpo*, *Fechamento* e *Posts únicos*. Os grupos podem ser recolhidos.
4. **Padrões** (botão no início, `#/padroes`): os estilos de texto e os espaçamentos comuns a todos os modelos e formatos, com a contagem de uso e uma conferência automática de tudo o que estiver fora do padrão. Por enquanto só visualização.
4. **Canvas:**
   - **Texto:** clique e escreva. Enter quebra a linha e Ctrl/Cmd + B põe em negrito. O título ajusta o corpo; o texto de apoio vai até 5 linhas e, passando disso, alarga a caixa (meia tela → 3/4 → tela inteira, sempre dentro das margens). Imagens abaixo do texto mantêm distância fixa do fim dele.
   - **Imagem:** clique numa área vazia ou arraste um arquivo sobre ela. Arraste a imagem para reenquadrar.
   - **Cards:** setas, duplicar e excluir ficam sobre o card em destaque; **+** adiciona. Visualização **3** ou **Todos** no canto superior direito.
5. **Exportar** (canto inferior direito): JPG otimizado em 1080 × 1440 com o nome do manual (`AAMMDD-NNN-nn-assunto.jpg`), um card ou o carrossel em `.zip`. Exportar também salva a publicação.

## Publicações (`#/publicacoes/<formato>`)

O menu geral tem uma entrada só, **Publicações**, com uma subpágina por formato de arquivo: **Posts 3:4** (`#/publicacoes/posts`) e **Pins 2:3** (`#/publicacoes/pins`); Stories 9:16 em breve. O editor é o mesmo para todos os formatos — mudam o canvas, o repertório de modelos e os campos do canal. Publicações antigas são posts 3:4 (`formato` ausente = `3x4`).

### Pins 2:3 (Pinterest)

Segue `odisse-estrategia-pinterest.pdf` (nov. 2026). Cada publicação de pins é **um projeto** (peça ou texto), com 8 a 15 pins.

- **Canvas:** desenhado em 1080 × 1620 e exportado em **JPG 1000 × 1500** (qualidade 0,86, como o 3:4) (a margem de 52 vira 48, a mesma proporção). Sem carimbo e sem pontos; selo do núcleo centrado no rodapé, menor que no Instagram.
- **Modelo universal P-01** com a opção *Composição*: **Imagem plena** (padrão de Arquitetos e Estúdio; no Estúdio, duotone pelo tratamento do núcleo), **Foto sobre painel** (padrão de Objetos) e **Título + imagem** (padrão do Elaia: título e linha de contexto ligados). Recorte pela mesma dinâmica do 3:4 (arrastar, zoom, posição). O painel de imagens avisa quando a imagem será ampliada na exportação.
- **Campos do Pinterest** (por pin, no painel esquerdo): idioma, título (até 100, sem ponto final), descrição (até 500 contando os créditos), texto alternativo, pasta, link de destino, tipo (imagem ou capa de vídeo). Avisos não impedem a exportação. **+ Versão em inglês** duplica o pin ligado ao original (`pin.par`).
- **Dados da publicação:** projeto, data dos arquivos, link de destino padrão e créditos (PT e EN), que fecham a descrição de cada pin.
- **Link com UTMs:** `utm_source=pinterest`, `utm_medium=social`, `utm_campaign=<sigla>-<projeto>`, `utm_content=<AAMMDD-NNN-sigla>[-en]`, `utm_term=<pasta>`.
- **Pastas:** editáveis na subpágina Pins (nome, o que entra, ordem do perfil), guardadas na nuvem em `cfg:pin-pastas` (`/api/config/pin-pastas`).
- **Exportação:** `AAMMDD-NNN-nn-assunto-pin.jpg` (inglês: `…-en-pin.jpg`); o lote sai em `.zip` com o **textos.txt** (título, descrição, pasta, link, alt, idioma, tipo e avisos de cada pin).
- Código em `assets/js/pinterest.js` (pastas, campos, UTMs, textos.txt) e o modelo em `templates.js` (`P01`, `ALT_PIN`).

## Calendário e pool de mídias (`#/calendario`)

- **Enviar ao pool** (no editor, ao lado da exportação): cada pin vira um item do pool (`pl-<card>`); um carrossel 3:4 inteiro, um item (`pl-<publicação>`). O item guarda os JPGs exportados (`img:<ref>`), uma miniatura, os textos do pin (título, descrição final, alt, pasta, link com UTMs), a origem e as fotos de origem (hash + recorte). Reenviar atualiza imagens e textos e mantém dia, situação e origem; o que já foi publicado não muda.
- **Situação:** no pool (sem dia) → agendado (com dia) → publicado (marcado à mão, no detalhe). Agendado com dia passado aparece como atrasado.
- **Calendário:** mês com segunda a domingo; arrastar do pool para um dia, de um dia para outro e de volta ao pool. Contagem de pins por dia (alerta acima de 3). **Distribuir**: agenda os pins prontos a partir de um dia, com 1, 2 ou 3 por dia, um projeto por dia e pastas alternadas. **Lote ↓** em cada semana baixa um .zip com uma pasta por dia e o `textos.txt` (com o dia de cada pin), para o agendador do Pinterest.
- **Pool de mídias:** por projeto — quantos ainda só no editor, no pool, agendados e publicados; pins por pasta; filtros de situação, origem (acervo, fluxo contínuo, imprensa) e busca. Detalhe de cada item com os textos para copiar, download, origem, dia e situação.
- **Repetição:** a mesma foto com o mesmo recorte em outro item aparece como *repetida*; outro recorte, como *mesma foto* (permitido). O editor avisa no painel de imagens quando a foto já está no pool. O par em outro idioma não conta.
- **Plataformas:** substitui a planilha `odisse-plataformas-de-publicacao.xlsx` — uma linha por projeto e plataforma (só no editor, no pool, agendados, publicados, pastas, último lote, próximo), com download em .csv.
- Código: `assets/js/pool.js` (dados, repetição, distribuição) e `assets/js/pagina-calendario.js`. API: `GET/PUT/DELETE /api/pool[/:id]` (KV `pool:<id>`).

## Estratégia: o plano de publicação (`#/estrategia`)

Fonte: `odisse-estrategia-instagram.pdf` (seções 02, 03, 05, 06 e 07). Guardado na nuvem em `cfg:estrategia` e `cfg:pautas`.

- **Grade:** a grade semanal de cada fase da escalada (1 a 5; a fase 5 alterna semanas A e B), com os encaixes de cada dia na ordem de publicação: núcleo, post ou reel (E1–E10) e o formato. O horário vem da posição no dia (11h–13h, 15h–17h, 20h–22h). Avisa quando um núcleo se repete em publicações seguidas ou Estúdio encosta em Objetos. Editável; "Restaurar a grade do documento" volta ao original. A **fase atual** vale a partir da segunda-feira em que foi trocada (`fases`), e o **início do ciclo** define as semanas 1–4 (A = 1 e 3, B = 2 e 4).
- **Pautas:** o banco de ângulos por obra (projeto de arquitetura, objeto, ensaio da Elaia, rotina do estúdio), com os ângulos sugeridos do documento, formato (post, reel com modelo, pin), situação (pauta, em produção, pronta, publicada), dia e notas.
- **Ciclo:** os prazos desta semana (pautas do ciclo 3 semanas antes, captação 2–3, textos 2, design 1, revisão e agendamento até a sexta anterior, métricas na última semana), a escalada (reserva de uma semana de posts prontos fora da agenda + 4 semanas cumpridas) e as próximas 8 semanas com encaixes, lacunas, pautadas, prontas e publicadas.
- **No Calendário:** cada dia mostra os encaixes da grade (Instagram), com lacunas, pautas e carrosséis; a coluna da semana mostra a semana do ciclo, a fase e os prazos que vencem nela. O painel lateral tem as abas Pool e Pautas: arraste para um encaixe. A pauta acompanha o carrossel do encaixe (pronta quando ele chega, publicada quando é publicado).
- Código: `assets/js/plano.js` e `assets/js/pagina-estrategia.js`.

## Métricas (`#/metricas`)

Hub de desempenho do marketing do Odisse. **Fase 1: Instagram** (conta única @odisse, profissional).

- **Conexão (uma vez):** apps novos do Meta (desde out. 2026) só oferecem o *login unificado*. No app (caso de uso *Gerenciar mensagens e conteúdo no Instagram*): permissões `instagram_basic` e `instagram_manage_insights`; em *API setup with Unified login*, uma configuração com token de **usuário do sistema** (expiração *Nunca*) e o URL de redirecionamento `https://universo-odisse.reservaprojectbasework.workers.dev/api/instagram/retorno`. Na página Métricas, informe ID do app, chave secreta e ID da configuração e clique em *Entrar com o Instagram*. Token e chave ficam só no KV (`ig:token`, `ig:app`), nunca voltam pela API. Também aceita colar um token (de sistema ou `IGAA…` do login do Instagram, que é renovado toda semana).
- **Coleta:** todo dia às 06:17 (cron do Worker) e no botão *Atualizar agora*. Guarda os números diários da conta (visualizações, alcance, contas engajadas, interações, seguidores) e as métricas de cada post, com histórico diário nos primeiros 90 dias — o Instagram apaga os dados da conta depois de 90 dias, o Universo não.
- **Vínculo com o Universo:** cada post do Instagram pode ser ligado à publicação que o gerou. Se só houver uma publicação com a mesma *data de publicação*, a ligação é automática. Com isso as métricas se abrem **por núcleo** e **por modelo de capa** (códigos OE-01, OA-03…).
- Miniaturas dos posts ficam guardadas no KV (`igmini:`), porque os links do Instagram expiram.
- **Subpáginas** (`#/metricas/<seção>`), organizadas por pergunta; a rede é um filtro comum a todas:
  - *Visão geral* — leituras automáticas do período, comparação entre redes (só métricas equivalentes, relativas ao alcance) e melhores posts;
  - *Conteúdo* — o que funciona, agrupando por núcleo, formato, tema, objetivo, modelo de capa, dia ou horário; tabela de posts com tema e objetivo editáveis (`met:etiquetas`);
  - *Público* — idade, gênero, cidades e países de seguidores, alcançados e engajados (`ig:publico`, histórico semanal em `ig:publico-hist`);
  - *Horários* — mapa de seguidores online por dia e hora, em Brasília (`ig:online`), e alcance dos posts por dia/faixa;
  - *Crescimento* — funil alcance → visitas ao perfil → seguidores → toques; alcance de seguidores × não seguidores; posts que trouxeram seguidores;
  - *Concorrentes* — contas profissionais adicionadas pelo @ (limite em `MAX_CONCORRENTES`, `worker/concorrentes.js`), só com dados públicos (Business Discovery): seguidores, frequência, formatos, engajamento público e posts fora da curva;
  - *Instagram* — o que é só desta rede: conta por dia, retenção de reels, stories (capturados enquanto estão no ar);
  - *Conexões* — estado da coleta e das redes.
- **Formato comum entre redes:** `assets/js/metricas/modelo.js` converte os posts de cada rede para o mesmo formato; ligar TikTok ou YouTube é escrever outro adaptador ali e a coleta no Worker.
- **Cota:** cada coleta faz no máximo 42 consultas (plano gratuito do Worker); perfil e posts têm prioridade, depois concorrentes, horários, público (até 6 consultas, renovado por semana), stories e métricas extras por post.

## Entrada e armazenamento

O Universo abre numa tela de **senha** (a mesma cadastrada no secret `UNIVERSO_SENHA`). A senha fica lembrada no computador até alguém clicar em **Sair**.

- **Rascunho:** enquanto você trabalha, cada alteração é guardada no navegador (IndexedDB).
- **Nuvem:** a publicação vai para o Cloudflare (Worker + KV, `worker/`) ao ser criada, no botão **Salvar** (ou Ctrl+S), ao exportar, ao voltar para o arquivo e automaticamente a cada 20 minutos se houver alteração. O indicador ao lado do botão mostra "Alterações não salvas" ou "Salvo às hh:mm".
- No arquivo, publicações com alterações deste computador que ainda não foram para a nuvem aparecem como **não salvo**.

Configuração do Worker (feita uma vez): namespace KV `UNIVERSO` (id em `worker/wrangler.toml`) e os secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` e `UNIVERSO_SENHA` no GitHub. O workflow *Publicar API* publica a cada mudança em `worker/`.

## Rodar localmente

O editor precisa ser aberto por um servidor para a exportação embutir as fontes:

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

Para publicar, ative o **GitHub Pages** (Settings → Pages → branch `main`, pasta `/`).

## Estrutura

```
index.html               menu geral, núcleos e editor
assets/css/card.css      o card 1080 × 1440 (grid, tipografia, elementos fixos)
assets/css/app.css       interface do editor
assets/js/nucleos.js     paleta e registro de cada núcleo
assets/js/padroes.js     estilos de texto e espaçamentos (fonte única, vale para 3:4, 9:16…)
assets/js/pagina-padroes.js  página de visualização e conferência dos padrões
assets/js/templates.js   os modelos de card de cada núcleo (post-3x4-templates)
assets/js/marks.js       selos (roda, sol, flor, mão) e logotipos em vetor
assets/js/imaging.js     leitura de imagem e duotone com grão
assets/js/app.js         início (subpáginas por formato), arquivo, edição, carrossel e exportação
assets/js/pinterest.js   pins: pastas, campos do Pinterest, link com UTMs e textos.txt
assets/js/pool.js        pool de mídias: itens, repetição, distribuição no calendário
assets/js/pagina-calendario.js  Calendário, Pool de mídias e Plataformas
assets/js/plano.js       plano de publicação: grade por fase, ciclo, prazos, pautas, escalada
assets/js/pagina-estrategia.js  Estratégia: Grade, Pautas e Ciclo
assets/js/store.js       armazenamento local (IndexedDB)
assets/js/nuvem.js       cliente da API
assets/js/pagina-metricas.js  página de métricas: navegação, filtros e eventos
assets/js/metricas/          modelo.js (formato comum), leituras.js, graficos.js, paginas.js
worker/concorrentes.js        concorrentes (Business Discovery)
worker/                  API Cloudflare Worker + KV (index.js; instagram.js = coleta e métricas)
assets/fonts/            Inter variável (com eixo óptico, para Inter Display)
vendor/                  html-to-image e JSZip
```

## Próximas páginas (menu geral)

Stories 9:16 · Calendário (com a regra de vizinhos do grid do perfil) · Biblioteca de imagens · Estratégia · Métricas fase 2 (TikTok, sites, Substack, ações manuais).

## Cache e versões dos arquivos

Antes de cada commit que mude JS ou CSS, rode `python3 tools/versionar.py`. Ele numera os arquivos
(`?v=<hash>`) no `index.html` — import map dos módulos, CSS e `vendor/`. O service worker (`sw.js`)
guarda os arquivos numerados até a próxima versão; a página sempre confere se há versão nova.

Dados: o Início mostra na hora as publicações deste navegador e consulta a nuvem por baixo (no máximo
uma vez por minuto); a Marca é atualizada por baixo uma vez por dia; as métricas e as miniaturas do
Instagram ficam guardadas no navegador (IndexedDB) e a leitura nova chega por baixo.
