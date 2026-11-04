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
assets/js/app.js         início, arquivo, edição, carrossel e exportação
assets/js/store.js       armazenamento local (IndexedDB)
assets/js/nuvem.js       cliente da API
worker/                  API Cloudflare Worker + KV
assets/fonts/            Inter variável (com eixo óptico, para Inter Display)
vendor/                  html-to-image e JSZip
```

## Próximas páginas (menu geral)

Stories 9:16 · Calendário (com a regra de vizinhos do grid do perfil) · Biblioteca de imagens · Estratégia.
