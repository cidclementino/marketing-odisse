# Universo · marketing-odisse

Plataforma de gestão de marketing e aceleração de produção de mídias do **Odisse — Estúdio de Arquitetura & Design**.

A primeira página é o **editor de posts 3:4** para o Instagram (1080 × 1440 px). Ele segue o *Manual do sistema* (v1, out. 2026): grid de 12 colunas, Inter, ardósia como tinta, um registro por núcleo e os 14 modelos de card.

## Como usar

1. **Núcleo:** escolha na faixa abaixo do menu entre Odisse Estúdio, Arquitetos, Objetos ou Elaia. Cada núcleo tem o próprio carrossel e as próprias informações padrão. Painel, véu, tratamento de imagem e selo mudam sozinhos.
2. **Informações padrão (à esquerda):** projeto ou série, assunto, aviso do post único, data de publicação, contador, selo e contatos do fechamento. Valem para todos os cards. Clicar num desses textos no canvas leva direto ao campo certo.
3. **Modelos (à direita):** clique para aplicar ao card selecionado. O texto que você já escreveu é mantido quando o campo existe no novo modelo.
4. **Canvas:**
   - **Texto:** clique e escreva. Enter quebra a linha e Ctrl/Cmd + B põe em negrito. O corpo do título se ajusta à faixa do manual (88–132 px).
   - **Imagem:** clique numa área vazia ou arraste um arquivo sobre ela. Arraste a imagem para reenquadrar. Zoom, posição e "original × tratada" ficam em *Imagens do card*, à direita.
   - **Novo card:** use o **+** ao lado.
   - **Visualização:** **1** (centralizado), **3** (o card ativo com os vizinhos) ou **Todos** (em linha, como carrossel).
5. **Exportar:** gera PNGs em 1080 × 1440 com o nome do manual (`AAMMDD-NNN-nn-assunto.png`). Pode ser só o card selecionado ou o carrossel inteiro em `.zip`.

Tudo fica salvo no navegador (IndexedDB), inclusive as imagens. Nada é enviado para servidor.

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
assets/js/templates.js   os 14 modelos de card
assets/js/exemplos.js    textos de exemplo por núcleo
assets/js/marks.js       selos (roda, sol, flor, mão) e logotipos em vetor
assets/js/imaging.js     leitura de imagem e duotone com grão
assets/js/app.js         estado, edição, carrossel e exportação
assets/fonts/            Inter variável (com eixo óptico, para Inter Display)
vendor/                  html-to-image e JSZip
```

## Próximas páginas (menu geral)

Stories 9:16 · Calendário (com a regra de vizinhos do grid do perfil) · Biblioteca de imagens · Estratégia.
