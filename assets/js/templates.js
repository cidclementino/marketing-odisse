// Modelos de card por núcleo — reconstruídos a partir de post-3x4-templates.pdf
// e do Manual do sistema Odisse (v1). Cada núcleo tem o seu repertório.
// Medidas em px do canvas 1080 × 1440. Grid de 12 colunas, margem 52, gutter 16.

import { COR, tintaSobre } from './nucleos.js';
import { mark } from './marks.js';
import { E, TEXTO_POR_CLASSE, corpoMin, corpoMax } from './padroes.js';

// Todo espaçamento vem de padroes.js (E.bloco, E.proximo…). Nenhum valor solto nos modelos.
export const LARG = 1080;
export const ALT = 1440;
const M = E.margem;
const G = E.gutter;
const COLW = (LARG - 2 * M - 11 * G) / 12; // 66,67
export const X = (c) => M + (c - 1) * (COLW + G);
export const W = (a, b) => (b - a + 1) * COLW + (b - a) * G;
const W12 = W(1, 12);
const CORTE = E.corte;
const TOPO = E.topo;
const px = (k) => `${E[k]}px`;
// cortes verticais no meio do gutter
const C4 = X(5) - G / 2;  // entre as colunas 4 e 5
const C6 = X(7) - G / 2;  // entre 6 e 7 (meio do card)
const C8 = X(9) - G / 2;  // entre 8 e 9
const h2 = CORTE / 2;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const pos = (x, y, w, h) =>
  `left:${x}px;top:${y}px;${w != null ? `width:${w}px;` : ''}${h != null ? `height:${h}px;` : ''}`;
const regraSobre = (fundo) => (tintaSobre(fundo) === COR.branco ? 'rgba(255,255,255,.55)' : 'rgba(63,75,87,.5)');
const B = COR.branco, A = COR.ardosia;
// Carimbo do cabeçalho: altura de um Bloco (48), centrado na linha dos pontos (y 50).
const CARIMBO = { y: E.cabecalho + 12 - E.bloco / 2, h: E.bloco };
const OP_CARIMBO = { k: 'carimbo', rot: 'Carimbo', valores: [['linhas', 'Só linhas'], ['cheio', 'Fundo cheio']], padrao: 'linhas' };

// ---------------------------------------------------------------------------
// Contexto de renderização

export function criarContexto({ card, indice, total, nucleo, globais, modelo, modo, fonteImagem }) {
  const n = nucleo;
  const g = globais;
  const editavel = modo === 'editar';
  const unico = !!modelo.unico;
  const ops = opcoesDe(modelo, card, n);
  const ex = resolverExemplo(modelo, n.id);
  // legenda no canto superior direito: modelos do Estúdio marcados, ou a opção "No topo"
  const legendaTopo = !!modelo.legendaTopo || ops.legenda === 'topo';

  const t = {
    n, g, editavel,
    op: (k) => ops[k],
    tem: (chave) => !!String(card.campos?.[chave] ?? '').replace(/<[^>]+>|&nbsp;|\s/g, ''),

    campo(chave, classe, estilo = '', opc = {}) {
      // O rótulo de contexto (ex.: "A VISTA") só existe em posts únicos, fechamentos e nos modelos marcados (O-07).
      if (chave === 'rotulo' && !modelo.rotulo && !['unico', 'fechamento'].includes(grupoDe(modelo))) return '';
      const valor = card.campos?.[chave] ?? '';
      // opc.fit = altura máxima da área; o corpo vai do máximo ao mínimo do estilo (padroes.js)
      let fit = '';
      if (opc.fit) {
        const est = TEXTO_POR_CLASSE[classe.split(' ').find((c) => TEXTO_POR_CLASSE[c])];
        fit = ` data-fit="${corpoMin(est)},${corpoMax(est)},${opc.fit}"`;
      }
      const ph = esc(String(opc.ph ?? ex[chave] ?? '').replace(/<[^>]+>/g, ''));
      if (!editavel && !valor) return '';
      const attrs = editavel ? ` contenteditable="true" spellcheck="true" data-campo="${chave}" data-ph="${ph}"` : '';
      return `<div class="${classe}" style="${estilo}"${fit}${opc.attrs || ''}${attrs}>${valor}</div>`;
    },

    /** Texto de apoio: até 5 linhas; se passar, alarga a caixa (3/4 → tela inteira).
     *  Não há mais meia tela: col 7 começa em 3/4 (coluna 5). */
    apoio(chave, col, estilo = '') {
      const estagios = [5, 1].filter((c) => c <= Math.max(col, 5));
      return t.campo(chave, 't-texto', `margin-left:${X(col) - M}px;${estilo}`, { attrs: ` data-cresce="${estagios.join(',')}"` });
    },

    global(chave, classe, estilo = '') {
      const v = g[chave] ?? '';
      if (!v) return '';
      const attr = editavel ? ` data-global="${chave}" title="Informação padrão — edite no painel à esquerda"` : '';
      return `<div class="${classe}" style="${estilo}"${attr}>${esc(v)}</div>`;
    },

    img(slot, x, y, w, h, opc = {}) {
      const im = card.imgs?.[slot];
      const segue = opc.segue ? ` data-segue="${opc.segue}" data-gap="${opc.gap ?? E.bloco}" data-fim="${y + h}"`
        : opc.antes ? ` data-antes="${opc.antes}" data-gap="${opc.gap ?? E.bloco}"` : '';
      const base = `class="slot${opc.contain ? ' contain' : ''}" style="${pos(x, y, w, h)}${opc.fundo ? `background:${opc.fundo};` : ''}" data-slot="${slot}"${segue}`;
      const src = im && (im.ref || im.src) ? fonteImagem(card, slot) : null;
      if (src) {
        const ox = im.x ?? 50, oy = im.y ?? 50, z = im.z ?? 1;
        return `<div ${base}><img src="${src}" alt="" draggable="false" style="object-position:${ox}% ${oy}%;transform-origin:${ox}% ${oy}%;transform:scale(${z})"></div>`;
      }
      if (modo === 'exportar') return opc.opcional ? '' : `<div ${base}></div>`;
      const rotulo = editavel ? `<span class="slot-vazio"><b>+</b> ${esc(modelo.slots?.[slot] || 'Imagem')}</span>` : '';
      return `<div ${base} data-vazio="1">${rotulo}</div>`;
    },

    fundo(cor) { return `<div class="bloco" style="${pos(0, 0, LARG, ALT)}background:${cor}"></div>`; },
    painel(x, y, w, h, cor, extra = '') { return `<div class="bloco" style="${pos(x, y, w, h)}background:${cor}"${extra}></div>`; },
    regra(x, y, w, cor) { return `<div class="bloco" style="${pos(x, y, w, 1.5)}background:${cor}"></div>`; },

    veuTopo(h = 200, a = 0.6, x = 0, w = LARG) {
      return `<div class="bloco" style="${pos(x, 0, w, h)}background:linear-gradient(${hexA(n.veu, a)},${hexA(n.veu, 0)})"></div>`;
    },
    veuBase(h = 340, a = 0.72, x = 0, w = LARG) {
      return `<div class="bloco" style="${pos(x, ALT - h, w, h)}background:linear-gradient(${hexA(n.veu, 0)},${hexA(n.veu, a)})"></div>`;
    },

    /** Carimbo: caixa tripartida no alto, como o carimbo de desenho técnico.
     *  Esquerda o núcleo · meio o tema (nome da publicação; no Elaia, "Escrito por …") ·
     *  direita a contagem (no post único, o aviso). Centrada na linha dos pontos (y 50),
     *  de margem a margem: fica a 26 px dos pontos, como os pontos ficam da borda.
     *  Opção "Carimbo": só linhas ou fundo cheio; a cor de cada célula vem do que está
     *  sob ela (colorirPontos). Com a legenda no topo, ela desce para baixo do carimbo. */
    cab(corEsq, corDir = corEsq) {
      const nome = g.projeto || '';
      const pre = n.autoria && nome ? `${esc(n.autoria)} ` : '';
      const tema = pre + (editavel ? `<span data-global="projeto" title="Informação padrão — edite no painel à esquerda">${esc(nome)}</span>` : esc(nome));
      let dir;
      if (unico) {
        dir = t.campo('aviso', 'cab-txt', '', { ph: 'Aviso' });
      } else {
        const ultimo = indice === total - 1;
        dir = `${String(indice + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}${ultimo ? '' : SETA}`;
      }
      const cel = (cls, cor, miolo) => `<div class="cel ${cls}" style="color:${cor}">${miolo}</div>`;
      let h = `<div class="carimbo t-rotulo" data-fundo="${ops.carimbo}" style="${pos(M, CARIMBO.y, W12, CARIMBO.h)}">${cel('esq', corEsq, esc(n.cabecalho))}${cel('meio', corDir, tema)}${cel('dir', corDir, dir)}</div>`;
      if (legendaTopo && !unico) {
        const r = t.campo('legR', 't-rotulo', '', { ph: 'Rótulo' });
        const l = t.campo('legT', 't-legenda', `margin-top:${px('justo')}`, { ph: 'Legenda: quem, onde, quando.' });
        h += `<div class="legenda-topo" style="right:${M}px;top:${CARIMBO.y + CARIMBO.h + E.proximo}px;color:${corDir}">${r}${l}</div>`;
      }
      return h;
    },

    /** Selo centrado no rodapé, com o centro a E.selo da base. Post único: mão. */
    selo(cor) {
      const nome = unico ? 'mao' : n.selo;
      const h = nome === 'mao' ? 72 : 64;
      return `<div class="selo" style="top:${ALT - E.selo - h / 2}px;color:${cor}">${mark(nome, h)}</div>`;
    },

    /** Linha de contexto da capa: uma linha de texto, sempre abaixo do título (opcional). */
    linha(estilo = '') {
      return t.campo('linha', 't-texto linha', `margin-top:${px('assinatura')};${estilo}`, { ph: 'Linha de contexto (opcional)' });
    },

    /** Assinatura: selo 46 px + rótulo (campo do card). */
    assinatura(cor, estilo = '') {
      return `<div class="assinatura" style="color:${cor};${estilo}">${mark(n.selo, 46)}${t.campo('assin', 't-rotulo', '')}</div>`;
    },

    /** Ficha em linhas: rótulo na coluna 1, valor na coluna 5 (ou empilhado). */
    ficha(prefixo, linhas, cor, regra, opc = {}) {
      let h = '';
      for (let i = 1; i <= linhas; i++) {
        const r = t.campo(`${prefixo}${i}r`, 't-rotulo ficha-r', '');
        const v = t.campo(`${prefixo}${i}v`, `${opc.valor || 't-texto'} ficha-v`, '');
        if (!r && !v && !(opc.todas && editavel)) continue;
        h += `<div class="ficha-linha${opc.empilhada ? ' empilhada' : ''}" style="border-color:${regra};${opc.linha || ''}">${r || '<div></div>'}${v}</div>`;
      }
      if (!h) return '';
      return `<div class="ficha${opc.distribuir ? ' distribuir' : ''}" style="color:${cor};border-color:${regra};${opc.estilo || ''}">${h}</div>`;
    },

    legenda(cor, largura = 380) {
      if (legendaTopo || ops.legenda === 'nao') return '';
      const r = t.campo('legR', 't-rotulo', '', { ph: 'Rótulo' });
      const l = t.campo('legT', 't-legenda', '', { ph: 'Legenda: quem, onde, quando.' });
      if (!r && !l) return '';
      return `<div class="legenda" style="color:${cor};width:${largura}px">${r}${l}</div>`;
    },

    fluxo(x, y, w, h, cor, miolo, classe = '', bloco = '') {
      return `<div class="fluxo ${classe}" style="${pos(x, y, w, h)}color:${cor}"${bloco ? ` data-bloco="${bloco}"` : ''}>${miolo}</div>`;
    },

  };
  return t;
}

// ---------------------------------------------------------------------------
// Peças reutilizadas por mais de um núcleo

const processo = (exemplo) => ({
  id: 'processo',
  rotulo: true,
  nome: 'Processo',
  desc: 'Três etapas: imagens sangrando à esquerda, número e texto nas colunas 8–12.',
  slots: { a: 'Etapa 01', b: 'Etapa 02', c: 'Etapa 03' },
  exemplo,
  render(t) {
    const linhas = ['a', 'b', 'c'].map((s, i) => {
      const y = 176 + i * 378;
      return `${t.img(s, 0, y, C6 - h2, 362, { fundo: COR.nevoa })}
        ${t.fluxo(X(8), y, W(8, 12), 362, A, `
          <div style="border-top:1.5px solid ${regraSobre(COR.papel)};padding-top:${px('filete')}">
            <div class="t-chamada">0${i + 1}</div>
            ${t.campo(`p${i + 1}r`, 't-rotulo', `margin:${px('proximo')} 0 ${px('proximo')}`)}
            ${t.campo(`p${i + 1}t`, 't-texto')}
          </div>`)}`;
    }).join('');
    return `${t.fundo(COR.papel)}${t.cab(A)}
      ${t.campo('rotulo', 't-rotulo', `position:absolute;left:${X(8)}px;top:${176 - E.proximo}px;transform:translateY(-100%);color:${A}`)}
      ${linhas}${t.selo(A)}`;
  },
});


const unicoTexto = ({ exemplo, fundo }) => ({
  id: 'unico',
  nome: 'Post único',
  desc: 'Aviso: rótulo, título, texto de apoio e ficha curta. Selo da mão.',
  unico: true,
  slots: {},
  exemplo,
  render(t) {
    const f = fundo(t), cor = tintaSobre(f);
    return `${t.fundo(f)}${t.cab(cor)}
      ${t.fluxo(M, 236, W12, 1004, cor, `
        ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
        ${t.campo('titulo', 't-titulo', '', { fit: 460 })}
        ${t.apoio('texto', 5, `margin-top:${px('bloco')}`)}
        ${t.ficha('f', 3, cor, regraSobre(f), { estilo: 'margin-top:auto' })}`)}
      ${t.selo(cor)}`;
  },
});



const desenho = {
  id: 'desenho',
  nome: 'Desenho técnico',
  desc: 'Desenho ou diagrama sobre papel, planta no canto e cota.',
  slots: { a: 'Desenho (PNG/SVG)', b: 'Planta (opcional)' },
  exemplo: {
    rotulo: 'Geometria',
    texto: 'A seção gira em torno do eixo vertical à medida que sobe. As variações de diâmetro formam sulcos helicoidais contínuos da base à borda.',
    planta: 'Planta',
    cota: '135 mm',
  },
  render(t) {
    return `${t.fundo(COR.papel)}${t.cab(A)}
      ${t.fluxo(M, TOPO, W(1, 6), 300, A, `
        ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
        ${t.campo('texto', 't-texto')}`)}
      ${t.img('b', X(9), 150, W(9, 11), 240, { contain: true, opcional: true })}
      ${t.campo('planta', 't-rotulo', `position:absolute;${pos(X(9), 390 + E.proximo)}color:${A}`)}
      ${t.img('a', M, 440, W(1, 9), 840, { contain: true })}
      ${t.campo('cota', 't-rotulo', `position:absolute;${pos(X(10), 860)}color:${A}`)}
      ${t.selo(A)}`;
  },
};

// ---------------------------------------------------------------------------
// ODISSE ESTÚDIO — pessoas, obras e bastidores. Ardósia, duotone, mão.

const ESTUDIO = [
  {
    id: 'janela',
    legendaTopo: true,
    nome: 'Janela',
    desc: 'Imagem inteira com outra inserida nas colunas 8–12.',
    slots: { a: 'Imagem de fundo', b: 'Janela (8–12)' },
    exemplo: { legR: 'Oficina', legT: 'Estudo em camadas e produção de peças.' },
    render(t) {
      return `${t.img('a', 0, 0, LARG, ALT)}
        ${t.img('b', X(8), 420, W(8, 12), 598)}
        ${t.veuTopo()}${t.veuBase()}
        ${t.cab(B)}${t.legenda(B)}${t.selo(B)}`;
    },
  },
  {
    id: 'abertura-ficha',
    nome: 'Abertura + ficha',
    desc: 'Faixa de imagem no alto, título e ficha sobre ardósia.',
    slots: { a: 'Imagem superior' },
    exemplo: {
      rotulo: 'Reserva Criativa',
      titulo: 'Um espaço permanente de pesquisa, desenho e experimentação.',
      f1r: 'Estúdio', f1v: 'Odisse Arquitetura & Design',
      f2r: 'Fundadores', f2v: 'Cid Clementino, Nathalia Linhares',
      f3r: 'Sede', f3v: 'João Pessoa · atuação em todo o Brasil',
      f4r: 'Site', f4v: 'odisse.com.br',
    },
    render(t) {
      return `${t.fundo(A)}
        ${t.img('a', 0, 0, LARG, 498)}${t.veuTopo()}
        ${t.cab(B)}
        ${t.fluxo(M, 498 + E.bloco, W12, 1300 - 498 - E.bloco, B, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo('titulo', 't-titulo', '', { fit: 280 })}
          ${t.ficha('f', 5, B, regraSobre(A), { estilo: 'margin-top:auto' })}`)}
        ${t.selo(B)}`;
    },
  },
  {
    id: 'tipografico-ficha',
    nome: 'Tipográfico + ficha',
    desc: 'Só painel: rótulo, título, apoio na coluna 5 e ficha.',
    slots: {},
    exemplo: {
      rotulo: 'Reserva Criativa',
      titulo: 'Um espaço permanente de pesquisa, desenho e experimentação.',
      texto: 'Rigor técnico, investigação histórica e sensibilidade artística, em arquitetura e design.',
      f1r: 'Estúdio', f1v: 'Odisse Arquitetura & Design',
      f2r: 'Fundadores', f2v: 'Cid Clementino, Nathalia Linhares',
      f3r: 'Sede', f3v: 'João Pessoa, PB · atuação em todo o Brasil',
      f4r: 'Site', f4v: 'odisse.com.br',
    },
    render(t) {
      return `${t.fundo(A)}${t.cab(B)}
        ${t.fluxo(M, 236, W12, 980, B, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo('titulo', 't-titulo', '', { fit: 300 })}
          ${t.apoio('texto', 5, `margin-top:${px('bloco')}`)}
          ${t.ficha('f', 5, B, regraSobre(A), { estilo: 'margin-top:auto' })}`)}
        ${t.selo(B)}`;
    },
  },
];

// ---------------------------------------------------------------------------
// ODISSE ARQUITETOS — projetos. Papel e areia, cor plena, roda.

const ARQUITETOS = [
  {
    id: 'amplitude',
    nome: 'Três ambientes',
    desc: 'Título, três imagens em faixa com rótulos e texto na coluna 7.',
    slots: { a: 'Ambiente 1', b: 'Ambiente 2', c: 'Ambiente 3' },
    exemplo: {
      rotulo: 'A amplitude',
      titulo: 'A amplitude não é vazio.',
      l1: 'Estar', l2: 'Jantar', l3: 'Cozinha',
      texto: 'É a soma de programas distintos que encontram no mar seu horizonte comum.',
    },
    render(t) {
      const y = 438, hh = 544, ly = y + hh + E.proximo;
      const seg = { segue: 'tit' };
      return `${t.fundo(COR.papel)}${t.cab(A)}
        ${t.fluxo(M, TOPO, W12, 300, A, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo('titulo', 't-titulo', '', { fit: 230 })}`, '', 'tit')}
        ${t.img('a', 0, y, C4 - h2, hh, seg)}
        ${t.img('b', C4 + h2, y, C8 - C4 - CORTE, hh, seg)}
        ${t.img('c', C8 + h2, y, LARG - C8 - h2, hh, seg)}
        ${t.campo('l1', 't-rotulo', `position:absolute;${pos(M, ly)}color:${A}`)}
        ${t.campo('l2', 't-rotulo', `position:absolute;${pos(X(5), ly)}color:${A}`)}
        ${t.campo('l3', 't-rotulo', `position:absolute;${pos(X(9), ly)}color:${A}`)}
        ${t.fluxo(M, ly + 24 + E.bloco, W12, 220, A, t.apoio('texto', 7))}
        ${t.selo(A)}`;
    },
  },
  {
    id: 'material',
    nome: 'Material',
    desc: 'Imagem no alto, rótulo e texto em faixa de papel, segunda imagem e legenda.',
    slots: { a: 'Imagem superior', b: 'Imagem inferior' },
    exemplo: {
      rotulo: 'Couro',
      texto: 'Um caminho em construção. A pacificação da tensão entre a expressão simbólico-material de uma cultura que nos é própria e a proficiência técnica da modernidade.',
      rodape: 'Concreto aparente',
    },
    render(t) {
      return `${t.fundo(COR.papel)}
        ${t.img('a', 0, 0, LARG, 558)}${t.veuTopo()}
        ${t.cab(B)}
        ${t.campo('rotulo', 't-rotulo', `position:absolute;${pos(M, 558 + E.bloco)}color:${A}`)}
        ${t.fluxo(X(5), 558 + E.bloco, W(5, 12), 200, A, t.campo('texto', 't-texto'), '', 'txt')}
        ${t.img('b', 0, 802, LARG, 498, { segue: 'txt' })}
        ${t.campo('rodape', 't-rotulo', `position:absolute;${pos(M, 1364)}color:${A}`)}
        ${t.selo(A)}`;
    },
  },
];

// ---------------------------------------------------------------------------
// ODISSE OBJETOS — peças e loja. Grafite, foto de estúdio, flor.

const OBJETOS = [
  {
    id: 'uso-janela',
    nome: 'Uso + janela',
    desc: 'Título grande no grafite, texto curto e foto de uso nas colunas 7–12.',
    slots: { a: 'Foto de uso (7–12)' },
    exemplo: {
      rotulo: 'O uso',
      titulo: 'Como o coração que o inspira, guarda um pouco de tudo.',
      texto: 'Flores secas e arranjos permanentes, ou o que se deposita ao longo do dia: chaves, lápis e pequenos objetos.',
    },
    render(t) {
      return `${t.fundo(COR.grafite)}${t.cab(B)}
        ${t.fluxo(M, TOPO, W(1, 11), 490, B, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo('titulo', 't-titulo', '', { fit: 430 })}`)}
        ${t.fluxo(M, 644, W(1, 5), 400, B, t.campo('texto', 't-texto'))}
        ${t.img('a', X(7), 640, W(7, 12), 640)}
        ${t.selo(B)}`;
    },
  },
  {
    id: 'tipografico',
    nome: 'Tipográfico',
    desc: 'Só painel grafite: título e apoio na coluna 5.',
    slots: {},
    exemplo: {
      rotulo: 'O uso',
      titulo: 'Como o coração que o inspira, guarda um pouco de tudo.',
      texto: 'Flores secas e arranjos permanentes, ou o que se deposita ao longo do dia: chaves, lápis e pequenos objetos.',
    },
    render(t) {
      return `${t.fundo(COR.grafite)}${t.cab(B)}
        ${t.campo('rotulo', 't-rotulo', `position:absolute;${pos(M, TOPO)}color:${B}`)}
        ${t.fluxo(M, 400, W12, 700, B, `
          ${t.campo('titulo', 't-titulo', '', { fit: 430 })}
          ${t.apoio('texto', 7, `margin-top:${px('bloco')}`)}`)}
        ${t.selo(B)}`;
    },
  },
  desenho,
  {
    id: 'ficha-lateral',
    nome: 'Ficha + imagem lateral',
    desc: 'Detalhe da peça nas colunas 1–4; ficha empilhada nas 5–12.',
    slots: { a: 'Detalhe (1–4)' },
    exemplo: {
      rotulo: 'Ficha técnica',
      f1r: 'Coleção', f1v: 'Vórtice',
      f2r: 'Função', f2v: 'Vaso decorativo, uso seco',
      f3r: 'Dimensões', f3v: '115 × 115 × 135 mm',
      f4r: 'Material', f4v: 'PLA, pintura PU texturizada',
      f5r: 'Processo', f5v: 'Impressão 3D, acabamento à mão',
      f6r: 'Cor', f6v: 'Preto fosco',
      f7r: 'Design', f7v: 'Cid Clementino, Nathalia Linhares',
    },
    render(t) {
      return `${t.fundo(COR.papel)}
        ${t.img('a', 0, 0, C4 - h2, ALT)}${t.veuTopo(200, 0.6, 0, C4 - h2)}
        ${t.cab(B, A)}
        ${t.fluxo(X(5), TOPO, W(5, 12), 1150, A, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.ficha('f', 7, A, regraSobre(COR.papel), { empilhada: true })}`)}
        ${t.selo(A)}`;
    },
  },
  {
    id: 'unico-imagem',
    nome: 'Post único · lançamento',
    desc: 'Foto no alto, painel grafite com nome da peça e link. Selo da mão.',
    unico: true,
    slots: { a: 'Foto superior' },
    exemplo: {
      aviso: 'Lançamento',
      rotulo: 'Novo na loja',
      titulo: 'Vórtice I.',
      texto: 'Receptáculo escultórico em peça única, impresso em 3D e acabado à mão.',
      link: 'odisseobjetos.com',
    },
    render(t) {
      return `${t.fundo(COR.grafite)}
        ${t.img('a', 0, 0, LARG, 760, { fundo: '#EDEDEB' })}
        ${t.cab(A)}
        ${t.fluxo(M, 760 + E.bloco, W12, 1300 - 760 - E.bloco, B, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo('titulo', 't-titulo', '', { fit: 140 })}
          ${t.apoio('texto', 5, `margin-top:${px('bloco')}`)}
          ${t.campo('link', 't-rotulo', `margin:auto 0 ${px('bloco')} ${X(5) - M}px`)}`)}
        ${t.selo(B)}`;
    },
  },
];

// ---------------------------------------------------------------------------
// ELAIA — ensaios e podcast. Pêssego, duotone ocre, sol.

const ELAIA = [
  {
    id: 'imagem-texto',
    nome: 'Imagem + texto',
    desc: 'Imagem grande no alto; rótulo na coluna 1 e texto a partir da 4.',
    slots: { a: 'Imagem superior' },
    exemplo: {
      rotulo: 'Dante',
      texto: 'O <b>Purgatório</b> descrito por Dante na Divina Comédia é um exemplo de espaço liminar.<br>Uma travessia com obstáculos que prenunciam uma transformação. É um estado intermediário que tem sentido e encaminha a um propósito.',
    },
    render(t) {
      return `${t.fundo(COR.papel)}
        ${t.img('a', 0, 0, LARG, 880)}${t.veuTopo()}
        ${t.cab(B)}
        ${t.campo('rotulo', 't-rotulo', `position:absolute;${pos(M, 880 + E.bloco)}color:${A}`)}
        ${t.fluxo(X(4), 880 + E.bloco, W(4, 12), 380, A, t.campo('texto', 't-texto'))}
        ${t.selo(A)}`;
    },
  },
  {
    id: 'citacao',
    nome: 'Citação',
    desc: 'Só pêssego e texto. Selecione palavras e use Ctrl+B para destacar.',
    slots: {},
    exemplo: {
      rotulo: 'O horror',
      citacao: 'O <b>horror</b> está em nunca saber o que esperar deste cenário antinatural, em não saber o que vem a seguir ou de estar <b>preso</b> em um contínuo sem propósito.',
    },
    render(t) {
      return `${t.fundo(COR.pessego)}${t.cab(A)}
        ${t.campo('rotulo', 't-rotulo', `position:absolute;${pos(M, TOPO)}color:${A}`)}
        ${t.fluxo(M, 400, W12, 700, A, t.campo('citacao', 't-citacao', '', { fit: 700 }))}
        ${t.selo(A)}`;
    },
  },
  {
    id: 'imagem-ficha',
    nome: 'Recorte + ficha',
    desc: 'Imagem recortada sobre pêssego, texto e três linhas de ficha.',
    slots: { a: 'Imagem recortada (PNG)' },
    exemplo: {
      texto: 'Este estado foi caracterizado por <b>Gennep</b> como um rito de passagem processado em três etapas:',
      f1r: 'Rito de separação', f1v: 'A saída do ambiente familiar e da vida comunitária.',
      f2r: 'Rito de transição', f2v: 'Quando se enfrentam, sozinho, os desafios que farão surgir uma nova pessoa.',
      f3r: 'Rito de incorporação', f3v: 'A reintegração da nova pessoa ao ambiente comunitário, ocupando um novo espaço com responsabilidades e privilégios.',
    },
    render(t) {
      return `${t.fundo(COR.pessego)}${t.cab(A)}
        ${t.img('a', X(2), 100, W(2, 11), 610, { contain: true })}
        ${t.fluxo(M, 710 + E.bloco, W12, 1300 - 710 - E.bloco, A, `
          ${t.campo('texto', 't-texto', `margin-bottom:${px('bloco')}`)}
          ${t.ficha('f', 3, A, regraSobre(COR.pessego))}`)}
        ${t.selo(A)}`;
    },
  },
  {
    id: 'materia-bruta',
    nome: 'Matéria Bruta · episódio',
    desc: 'Post do podcast: faixa ocre com título, episódio, "Com" e "Ouça"; retrato abaixo.',
    unico: true,
    slots: { a: 'Retrato (duotone)' },
    exemplo: {
      aviso: 'Novo episódio',
      rotulo: 'Matéria Bruta · Episódio 01',
      titulo: 'Matéria Bruta.',
      sub: 'A matéria antes da forma.',
      f1r: 'Com', f1v: 'Cid Clementino e Nathalia Linhares',
      f2r: 'Ouça', f2v: 'Plataformas de áudio · link na bio',
    },
    render(t) {
      return `${t.fundo(COR.ocre)}
        ${t.img('a', 0, 620, LARG, 820, { fundo: COR.ocre })}
        ${t.veuBase(300, 0.5)}
        ${t.cab(A)}
        ${t.fluxo(M, TOPO, W12, 620 - TOPO - E.bloco, A, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo('titulo', 't-capa', 'white-space:nowrap', { fit: 160 })}
          <div style="display:grid;grid-template-columns:${W(1, 6)}px ${W(7, 12)}px;column-gap:${G}px;margin-top:${px('bloco')};align-items:start">
            ${t.campo('sub', 't-chamada') || '<div></div>'}
            ${t.ficha('f', 2, A, regraSobre(COR.pessego), { empilhada: true, valor: 't-legenda' })}
          </div>`)}
        ${t.selo(B)}`;
    },
  },
];

// ---------------------------------------------------------------------------
// MODELOS UNIVERSAIS (O-01…O-11) — uma composição comum aos quatro núcleos.
// O núcleo continua definindo a identidade (papel, painel, véu, selo, tratamento, logotipo);
// o card define a composição, com opções escolhidas no painel esquerdo ("Personalização do card").

const FOTO_CLARA = (n) => n.id === 'objetos'; // foto de estúdio sobre fundo claro: texto ardósia, sem véu no alto
const FUNDO_FOTO = (n) => (FOTO_CLARA(n) ? '#EDEDEB' : undefined);
const op = (k, rot, valores, padrao) => ({ k, rot, valores, padrao });
const OP_FUNDO = (padrao = 'papel') => op('fundo', 'Fundo', [['papel', 'Papel'], ['painel', 'Painel do núcleo']], padrao);
const OP_LEGENDA = op('legenda', 'Legenda', [['nao', 'Sem'], ['pe', 'No pé'], ['topo', 'No topo']], (n) => (n.id === 'estudio' ? 'topo' : 'pe'));
const porNucleo = (mapa) => (nid) => ({ ...(mapa[nid] || mapa.padrao) });

const EX_CAPA = {
  estudio: { titulo: 'Reserva Criativa.', linha: 'Cid Clementino e Nathalia Linhares' },
  arquitetos: { titulo: 'Um horizonte comum.', linha: 'Projeto de interiores do Apto RP 201' },
  objetos: { titulo: 'Vórtice I', linha: 'Receptáculo escultórico, impresso em 3D' },
  elaia: { titulo: 'Backrooms, Labirinto Domesticado.', linha: 'A partir de Backrooms, Labirinto Domesticado: Parte I' },
};

/** Fatias horizontais de uma faixa de imagens: 1 inteira, 2 no meio (6 | 6), 3 nos cortes 4 | 8. */
function fatias(qtd) {
  if (qtd === 3) return [[0, C4 - h2], [C4 + h2, C8 - C4 - CORTE], [C8 + h2, LARG - C8 - h2]];
  if (qtd === 2) return [[0, C6 - h2], [C6 + h2, LARG - C6 - h2]];
  return [[0, LARG]];
}

const O01 = {
  id: 'o01', cod: 'O-01', grupo: 'capa',
  nome: 'Capa com imagem inteira',
  desc: 'Imagem inteira, título e linha de contexto no alto ou no pé.',
  slots: { a: 'Imagem da capa' },
  opcoes: [
    op('texto', 'Bloco de texto', [['alto', 'No alto'], ['pe', 'No pé']], (n) => (FOTO_CLARA(n) ? 'alto' : 'pe')),
    op('alinhar', 'Alinhamento', [['esq', 'À esquerda'], ['centro', 'Centralizado']], 'esq'),
  ],
  exemplo: porNucleo(EX_CAPA),
  render(t) {
    const clara = FOTO_CLARA(t.n), alto = t.op('texto') === 'alto';
    const al = t.op('alinhar') === 'centro' ? 'text-align:center' : '';
    const cor = clara && alto ? A : B; // foto clara: ardósia no alto; no pé, branco sobre o véu
    const extra = t.tem('linha') ? 0 : 80; // sem linha de contexto, o título ocupa o espaço dela
    const miolo = `${t.campo('titulo', 't-capa', al, { fit: (alto ? 400 : 520) + extra })}${t.linha(al)}`;
    const veus = clara ? t.veuBase(520, 0.7) : alto ? `${t.veuTopo(760, 0.6)}${t.veuBase()}` : `${t.veuTopo()}${t.veuBase(820, 0.8)}`;
    return `${t.img('a', 0, 0, LARG, ALT, { fundo: FUNDO_FOTO(t.n) })}${veus}
      ${t.cab(clara ? A : B)}
      ${alto ? t.fluxo(M, 180, W12, 560, cor, miolo) : t.fluxo(M, 180, W12, 1070, cor, miolo, 'fim')}
      ${t.selo(B)}`;
  },
};

const BASE_FAIXA = 1170; // base fixa da faixa de imagens do O-02
const O02 = {
  id: 'o02', cod: 'O-02', grupo: 'capa',
  nome: 'Capa com faixa de imagens',
  desc: 'Título e linha no alto; faixa de 1 a 3 imagens com a base fixa, que encolhe pelo topo quando o título cresce.',
  slots: { a: 'Imagem 1', b: 'Imagem 2', c: 'Imagem 3' },
  opcoes: [
    op('imagens', 'Imagens na faixa', [['1', '1'], ['2', '2'], ['3', '3']], (n) => (n.id === 'estudio' ? '2' : '1')),
    OP_FUNDO((n) => (n.id === 'estudio' ? 'painel' : 'papel')),
  ],
  slotsAtivos: (t) => ['a', 'b', 'c'].slice(0, Number(t.op('imagens'))),
  exemplo: porNucleo({ ...EX_CAPA, elaia: { titulo: 'Backrooms,<br>Labirinto<br>Domesticado', linha: EX_CAPA.elaia.linha } }),
  render(t) {
    const f = t.op('fundo') === 'painel' ? t.n.painel : COR.papel, cor = tintaSobre(f);
    const imgs = fatias(Number(t.op('imagens'))).map(([x, w], i) =>
      t.img('abc'[i], x, 560, w, BASE_FAIXA - 560, { segue: 'tit', fundo: FUNDO_FOTO(t.n) })).join('');
    return `${t.fundo(f)}${t.cab(cor)}
      ${t.fluxo(M, 160, W12, 560, cor, `${t.campo('titulo', 't-capa', '', { fit: t.tem('linha') ? 400 : 480 })}${t.linha()}`, '', 'tit')}
      ${imgs}
      ${t.selo(cor)}`;
  },
};

const EX_TESE = {
  estudio: { titulo: 'Um espaço permanente de pesquisa.', texto: 'Rigor técnico, investigação histórica e sensibilidade artística, em arquitetura e design.' },
  arquitetos: { titulo: 'Três ambientes, um ponto de fuga.', texto: 'Sem anteparos entre sala, jantar e cozinha, os três ambientes se voltam para o mesmo horizonte.' },
  objetos: { titulo: 'Um coração em processo.', texto: 'Corpo único que se torce em torno do próprio eixo, em sulcos helicoidais contínuos.' },
  elaia: { titulo: 'A incerteza é mais assustadora que a alegoria.', texto: 'Ao traçar um paralelo entre os anseios da mente de Clark e os backrooms, a narrativa do filme homônimo perde forças na exploração do horror espacial ao dar sentido ao desconhecido.' },
};

const O03 = {
  id: 'o03', cod: 'O-03',
  nome: 'Título + imagem',
  desc: 'Título e texto de apoio com uma imagem sangrando, em cima ou embaixo.',
  slots: { a: 'Imagem' },
  opcoes: [
    op('ordem', 'Ordem', [['texto', 'Texto em cima'], ['imagem', 'Imagem em cima']], 'texto'),
    OP_FUNDO((n) => (n.id === 'objetos' ? 'painel' : 'papel')),
  ],
  exemplo: porNucleo(EX_TESE),
  render(t) {
    const painel = t.op('fundo') === 'painel';
    const f = painel ? t.n.painel : COR.papel, cor = tintaSobre(f);
    const texto = (y, h, bloco = '') => t.fluxo(M, y, W12, h, cor, `
      ${t.campo('titulo', 't-titulo', '', { fit: 340 })}
      ${t.apoio('texto', 5, `margin-top:${px('bloco')}`)}`, '', bloco);
    if (t.op('ordem') === 'imagem') {
      // texto ancorado embaixo (fim em 1300); a imagem desce até um Bloco antes do início do texto
      const yTxt = IMG_MIN + E.bloco;
      return `${t.fundo(f)}
        ${t.img('a', 0, 0, LARG, 760, { antes: 'txt', fundo: FUNDO_FOTO(t.n) })}${FOTO_CLARA(t.n) ? '' : t.veuTopo()}
        ${t.cab(FOTO_CLARA(t.n) ? A : B)}
        ${t.fluxo(M, yTxt, W12, 1300 - yTxt, cor, `
          ${t.campo('titulo', 't-titulo', '', { fit: 340 })}
          ${t.apoio('texto', 5, `margin-top:${px('bloco')}`)}`, 'fim', 'txt')}
        ${t.selo(cor)}`;
    }
    // texto em cima: a imagem acompanha o fim do texto; com painel, o painel também
    const seg = painel ? { segue: 'txt', gap: E.bloco + CORTE } : { segue: 'txt' };
    return `${t.fundo(COR.papel)}
      ${painel ? t.painel(0, 0, LARG, 578, f, ` data-segue="txt" data-gap="${E.bloco}" data-modo="altura"`) : ''}
      ${t.img('a', 0, 640, LARG, ALT - 640, { ...seg, fundo: FUNDO_FOTO(t.n) })}${t.veuBase()}
      ${t.cab(cor)}
      ${texto(TOPO, 800, 'txt')}
      ${t.selo(B)}`;
  },
};

const O04 = {
  id: 'o04', cod: 'O-04',
  nome: 'Imagem inteira',
  desc: 'Imagem inteira, sangrando. Legenda opcional no pé ou no topo.',
  slots: { a: 'Imagem inteira' },
  opcoes: [OP_LEGENDA],
  exemplo: porNucleo({ estudio: { legR: 'Obra', legT: 'A figura sob a cobertura metálica.' }, padrao: { legR: '', legT: '' } }),
  render(t) {
    const clara = FOTO_CLARA(t.n);
    return `${t.img('a', 0, 0, LARG, ALT, { fundo: FUNDO_FOTO(t.n) })}
      ${clara ? '' : t.veuTopo()}${t.veuBase()}
      ${t.cab(clara ? A : B)}${t.legenda(B)}${t.selo(B)}`;
  },
};

const CORTES = { '4-8': C4, '8-4': C8, '6-6': C6 };
const O05 = {
  id: 'o05', cod: 'O-05',
  nome: 'Duas imagens verticais',
  desc: 'Duas imagens de altura inteira, com corte nas colunas 4 | 8, 8 | 4 ou 6 | 6.',
  slots: { a: 'Imagem esquerda', b: 'Imagem direita' },
  opcoes: [
    op('corte', 'Corte', [['4-8', '4 | 8'], ['8-4', '8 | 4'], ['6-6', '6 | 6']], (n) => (n.id === 'estudio' ? '8-4' : '4-8')),
    OP_LEGENDA,
  ],
  exemplo: porNucleo({ estudio: { legR: 'Retrato', legT: 'Nathalia Linhares, desenho em campo.' }, padrao: { legR: '', legT: '' } }),
  render(t) {
    const c = CORTES[t.op('corte')] || C4;
    return `${t.fundo(t.n.id === 'estudio' ? A : COR.papel)}
      ${t.img('a', 0, 0, c - h2, ALT)}
      ${t.img('b', c + h2, 0, LARG - c - h2, ALT)}
      ${t.veuTopo()}${t.veuBase()}
      ${t.cab(B)}${t.legenda(B, 420)}${t.selo(B)}`;
  },
};

const EX_COLUNA = {
  elaia: { texto: 'O <b>Purgatório</b> descrito por Dante na Divina Comédia é um exemplo de espaço liminar.<br>Uma travessia com obstáculos que prenunciam uma transformação. É um estado intermediário que tem sentido e encaminha a um propósito.', fonte: '' },
  padrao: { texto: 'Partimos de expressões simbólicas já postas, que transcendem o figurativismo e se imbuem de uma narrativa mitopoética.', fonte: 'Gilvan Samico, A Árvore da Vida e o Infinito Azul, xilogravura.' },
};
const O06 = {
  id: 'o06', cod: 'O-06',
  nome: 'Imagem + coluna',
  desc: 'Uma ou duas imagens nas colunas 1–8; coluna de texto nas 9–12, com crédito opcional no pé.',
  slots: { a: 'Imagem 1 (1–8)', b: 'Imagem 2 (1–8)' },
  opcoes: [
    op('imagens', 'Imagens', [['1', '1'], ['2', '2']], '1'),
    OP_FUNDO((n) => (n.id === 'elaia' ? 'painel' : 'papel')),
    op('credito', 'Crédito no pé', [['sim', 'Sim'], ['nao', 'Não']], (n) => (n.id === 'elaia' ? 'nao' : 'sim')),
  ],
  slotsAtivos: (t) => (t.op('imagens') === '2' ? ['a', 'b'] : ['a']),
  exemplo: porNucleo(EX_COLUNA),
  render(t) {
    const painel = t.op('fundo') === 'painel';
    const f = painel ? t.n.painel : COR.papel, cor = tintaSobre(f);
    const fimImg = C8 - h2;
    // respiro de um Bloco entre a imagem e a coluna de texto
    const xCol = fimImg + E.bloco, wCol = LARG - M - xCol;
    const y0 = painel ? 0 : TOPO, y1 = painel ? ALT : TOPO + 1170;
    const dois = t.op('imagens') === '2';
    const hImg = dois ? (y1 - y0 - CORTE) / 2 : y1 - y0;
    const imgs = t.img('a', 0, y0, fimImg, hImg) + (dois ? t.img('b', 0, y0 + hImg + CORTE, fimImg, hImg) : '');
    const credito = t.op('credito') === 'sim'
      ? t.campo('fonte', 't-legenda fonte', `margin-top:auto;border-top:1.5px solid ${regraSobre(f)};padding-top:${px('filete')}`, { ph: 'Crédito ou legenda' })
      : '';
    return `${t.fundo(COR.papel)}
      ${painel ? t.painel(C8 + h2, 0, LARG - C8 - h2, ALT, f) : ''}
      ${imgs}
      ${painel ? `${t.veuTopo(200, 0.6, 0, fimImg)}${t.veuBase(340, 0.72, 0, fimImg)}` : ''}
      ${t.cab(painel ? B : A, cor)}
      ${t.fluxo(xCol, TOPO, wCol, 1170, cor, `${t.campo('texto', 't-texto')}${credito}`)}
      ${t.selo(painel ? B : A)}`;
  },
};

const EX_PROCESSO = {
  objetos: {
    rotulo: 'Processo',
    p1r: 'Modelagem', p1t: 'A forma é modelada digitalmente: uma seção que gira em torno do eixo à medida que sobe.',
    p2r: 'Impressão', p2t: 'Impressa em PLA, em peça única e sem montagem, por deposição de filamento fundido.',
    p3r: 'Acabamento', p3t: 'Lixada, corrigida, preparada com primer e pintada à mão em PU texturizado preto fosco.',
  },
  padrao: {
    rotulo: 'Processo',
    p1r: 'Estudo', p1t: 'O enquadramento da vista a partir da mesa de jantar.',
    p2r: 'Croqui', p2t: 'Sala, jantar e cozinha desenhados sobre o mesmo ponto de fuga.',
    p3r: 'Imagem final', p3t: 'A vista atravessa toda a planta, da cozinha à varanda.',
  },
};
const O07 = { ...processo(porNucleo(EX_PROCESSO)), id: 'o07', cod: 'O-07' };

const EX_IMG_TITULO = {
  elaia: { titulo: 'Espaço liminar é qualquer espaço intermediário.', texto: 'Um estágio de transição que não se restringe à abordagem espacial, mas à sua condição transitória.' },
  padrao: { titulo: 'A vista atravessa a casa.', texto: 'Antes restrito à varanda, o mar passa a fazer parte da sala e do jantar.' },
};
const O08 = {
  id: 'o08', cod: 'O-08',
  nome: 'Imagem inteira + título',
  desc: 'Imagem inteira com título e texto de apoio brancos, no alto ou no pé.',
  slots: { a: 'Imagem inteira' },
  opcoes: [op('texto', 'Bloco de texto', [['alto', 'No alto'], ['pe', 'No pé']], 'pe')],
  exemplo: porNucleo(EX_IMG_TITULO),
  render(t) {
    const alto = t.op('texto') === 'alto';
    const miolo = `${t.campo('titulo', 't-titulo', '', { fit: 340 })}${t.apoio('texto', 5, `margin-top:${px('bloco')}`)}`;
    return `${t.img('a', 0, 0, LARG, ALT)}
      ${alto ? `${t.veuTopo(760, 0.6)}${t.veuBase()}` : `${t.veuTopo()}${t.veuBase(860, 0.82)}`}
      ${t.cab(B)}
      ${alto ? t.fluxo(M, TOPO, W12, 700, B, miolo) : t.fluxo(M, 180, W12, 1060, B, miolo, 'fim')}
      ${t.selo(B)}`;
  },
};

const FICHA_ARQ = {
  titulo: 'Ficha técnica.',
  f1r: 'Projeto', f1v: 'Retrofit de Interiores do Edf. AVS. Sala de Conferência',
  f2r: 'Escritório', f2v: 'Odisse, Estúdio de Arquitetura e Design',
  f3r: 'Tipo', f3v: 'Projeto de Interiores; Retrofit.',
  f4r: 'Programa', f4v: 'Sala de Conferência; Sala de Reuniões; Estações de Trabalho; Área de Exposição e Encontro.',
  f5r: 'Premissa', f5v: 'Atualização dos ambientes criativos do edifício segundo o estado da arte, tanto em termos concretos quanto simbólicos.',
};
const FICHA_OBJ = {
  titulo: '',
  f1r: 'Coleção', f1v: 'Vórtice',
  f2r: 'Função', f2v: 'Vaso decorativo, uso seco',
  f3r: 'Dimensões', f3v: '115 × 115 × 135 mm',
  f4r: 'Material', f4v: 'PLA, pintura PU texturizada',
  f5r: 'Processo', f5v: 'Impressão 3D, acabamento à mão',
  f6r: 'Cor', f6v: 'Preto fosco',
  f7r: 'Design', f7v: 'Cid Clementino, Nathalia Linhares',
};
const O09 = {
  id: 'o09', cod: 'O-09',
  nome: 'Ficha',
  desc: 'Título e ficha em linhas, travada embaixo: cada linha a mais sobe a pilha. Sobre o tom escuro do núcleo, ou sobre papel com imagem no alto.',
  slots: { a: 'Imagem superior' },
  opcoes: [
    op('imagem', 'Imagem', [['sem', 'Sem'], ['com', 'Com imagem no alto']], (n) => (n.id === 'objetos' ? 'com' : 'sem')),
    op('linhas', 'Linhas da ficha', ['1', '2', '3', '4', '5', '6', '7', '8'].map((v) => [v, v]), (n) => (n.id === 'objetos' ? '7' : '5')),
  ],
  slotsAtivos: (t) => (t.op('imagem') === 'com' ? ['a'] : []),
  exemplo: porNucleo({ objetos: FICHA_OBJ, padrao: FICHA_ARQ }),
  render(t) {
    if (t.op('imagem') === 'com') {
      const clara = FOTO_CLARA(t.n), hImg = 560;
      return `${t.fundo(COR.papel)}
        ${t.img('a', 0, 0, LARG, hImg, { fundo: FUNDO_FOTO(t.n) })}${clara ? '' : t.veuTopo()}
        ${t.cab(clara ? A : B)}
        ${t.fluxo(M, hImg + E.bloco, W12, 1300 - hImg - E.bloco, A, `
          ${t.campo('titulo', 't-titulo', `margin-bottom:${px('bloco')}`, { fit: 120, ph: 'Título (opcional)' })}
          ${t.ficha('f', Number(t.op('linhas')), A, regraSobre(COR.papel), { estilo: 'margin-top:auto', todas: true })}`)}
        ${t.selo(A)}`;
    }
    const f = t.n.veu;
    return `${t.fundo(f)}${t.cab(B)}
      ${t.fluxo(M, TOPO, W12, 1172, B, `
        ${t.campo('titulo', 't-titulo', '', { fit: 250 })}
        ${t.ficha('f', Number(t.op('linhas')), B, regraSobre(f), { estilo: 'margin-top:auto', todas: true })}`)}
      ${t.selo(B)}`;
  },
};

const LOCKUP = {
  estudio: () => `${mark('mao', 62)}${mark('odisse', 32)}`,
  arquitetos: () => `${mark('mao', 62)}${mark('odisse', 32)}`,
  objetos: () => `${mark('flor', 70)}${mark('odisse', 32)}`,
  elaia: () => mark('elaia', 44),
};
const IMG_FECH = { y: 440, h: 544, w: 264 };
const O10 = {
  id: 'o10', cod: 'O-10', grupo: 'fechamento',
  nome: 'Fechamento',
  desc: 'Chamada no topo da imagem (rótulo acima), contatos na base dela e texto de apoio no meio; logotipo no pé, sem selo.',
  slots: { a: 'Imagem lateral (opcional)' },
  exemplo: porNucleo({ objetos: { rotulo: 'Loja' }, elaia: { rotulo: 'Leitura' }, padrao: { rotulo: 'Contato' } }),
  render(t) {
    const contatos = ['site', 'telefone', 'email'].map((k) => t.global(k, 't-texto')).join('');
    const topo = IMG_FECH.y, base = IMG_FECH.y + IMG_FECH.h;
    const apoio = t.global('contatoTexto', 't-texto', 'margin:auto 0');
    return `${t.fundo(COR.papel)}
      ${t.cab(A)}
      ${t.img('a', 0, topo, IMG_FECH.w, IMG_FECH.h, { opcional: true })}
      ${t.campo('rotulo', 't-rotulo', `position:absolute;left:${X(4)}px;top:${topo - E.proximo}px;transform:translateY(-100%);color:${A}`)}
      ${t.fluxo(X(4), topo, W(4, 12), base - topo, A, `
        ${t.global('contatoTitulo', 't-chamada fech-chamada', '')}
        ${apoio || '<div style="margin-top:auto"></div>'}
        <div class="contatos" style="border-top:1.5px solid ${regraSobre(COR.papel)};padding-top:${px('filete')}">${contatos}</div>`)}
      <div class="lockup" style="position:absolute;left:${X(4)}px;top:${ALT - E.selo}px;transform:translateY(-50%);color:${A}">${LOCKUP[t.n.id]()}</div>`;
  },
};

const EX_UNICO = {
  elaia: {
    aviso: 'Novo ensaio', rotulo: 'Agora no Elaia', titulo: 'Backrooms, Labirinto Domesticado.',
    texto: 'Parte I da série de ensaios de <b>Cid Clementino</b> sobre o fenômeno dos backrooms.',
    f1r: 'Série', f1v: 'Backrooms, Labirinto Domesticado', f2r: 'Leitura', f2v: 'odisse.substack.com', f3r: 'Autor', f3v: 'Cid Clementino',
  },
  padrao: {
    aviso: 'Prêmio', rotulo: 'Casacor Paraíba 2023', titulo: 'Melhor uso de materiais inovadores.',
    texto: 'O Odisse recebeu o prêmio na edição 2023 da mostra.',
    f1r: 'Mostra', f1v: 'CASACOR Paraíba', f2r: 'Ano', f2v: '2023', f3r: 'Estúdio', f3v: 'Odisse Arquitetura & Design',
  },
};
const O11 = {
  ...unicoTexto({ exemplo: porNucleo(EX_UNICO), fundo: (t) => (t.n.id === 'elaia' ? COR.pessego : COR.papel) }),
  id: 'o11', cod: 'O-11',
};

const UNIVERSAIS = [O01, O02, O03, O04, O05, O06, O07, O08, O09, O10, O11];
const UNIV_POR_ID = Object.fromEntries(UNIVERSAIS.map((m) => [m.id, m]));

/** Cards de versões anteriores → universal + opções equivalentes (a aparência não muda). */
const MIGRA = {
  'estudio:capa': ['o01', { texto: 'pe' }], 'arquitetos:capa': ['o01', { texto: 'pe' }], 'elaia:capa': ['o01', { texto: 'pe' }],
  'objetos:capa': ['o01', { texto: 'alto' }], 'objetos:capa-centro': ['o01', { texto: 'alto', alinhar: 'centro' }],
  'arquitetos:capa-papel': ['o02', { imagens: '1', fundo: 'papel' }], 'elaia:capa-papel': ['o02', { imagens: '1', fundo: 'papel' }],
  'arquitetos:capa-tres': ['o02', { imagens: '3', fundo: 'painel' }], 'estudio:capa-painel': ['o02', { imagens: '2', fundo: 'painel' }],
  'arquitetos:tese': ['o03', { ordem: 'texto', fundo: 'papel' }], 'elaia:tese': ['o03', { ordem: 'texto', fundo: 'papel' }],
  'objetos:painel-imagem': ['o03', { ordem: 'texto', fundo: 'painel' }],
  'arquitetos:vista': ['o03', { ordem: 'imagem', fundo: 'papel' }], 'elaia:titulo-imagem': ['o03', { ordem: 'imagem', fundo: 'papel' }],
  'arquitetos:abertura-projeto': ['o03', { ordem: 'imagem', fundo: 'papel' }],
  'objetos:imagem-painel': ['o03', { ordem: 'imagem', fundo: 'painel' }],
  'estudio:imagem-legenda': ['o04', { legenda: 'topo' }], 'arquitetos:pausa': ['o04', { legenda: 'pe' }], 'objetos:pausa': ['o04', { legenda: 'pe' }],
  'estudio:vertical-8-4': ['o05', { corte: '8-4', legenda: 'topo' }], 'estudio:vertical-4-8': ['o05', { corte: '4-8', legenda: 'topo' }],
  'arquitetos:vertical-4-8': ['o05', { corte: '4-8', legenda: 'pe' }],
  'arquitetos:referencia': ['o06', { imagens: '1', fundo: 'papel', credito: 'sim' }],
  'arquitetos:duas-coluna': ['o06', { imagens: '2', fundo: 'papel', credito: 'sim' }],
  'elaia:imagem-coluna': ['o06', { imagens: '1', fundo: 'painel', credito: 'nao' }],
  'arquitetos:processo': ['o07', {}], 'objetos:processo': ['o07', {}],
  'elaia:imagem-titulo-topo': ['o08', { texto: 'alto' }], 'elaia:imagem-titulo-base': ['o08', { texto: 'pe' }],
  'arquitetos:ficha': ['o09', { imagem: 'sem' }], 'objetos:imagem-ficha': ['o09', { imagem: 'com' }],
  'arquitetos:fechamento': ['o10', {}], 'objetos:fechamento': ['o10', {}], 'elaia:fechamento': ['o10', {}],
  'estudio:unico': ['o11', {}], 'elaia:unico': ['o11', {}],
};

/** Converte um card antigo para o universal equivalente. Devolve true se mudou. */
export function migrarCard(nucleoId, card) {
  const m = MIGRA[`${nucleoId}:${card.modelo}`];
  if (!m) return false;
  card.modelo = m[0];
  card.opcoes = { ...m[1], ...(card.opcoes || {}) };
  const c = card.campos || {};
  if (c.rotulo && !c.linha && UNIV_POR_ID[m[0]].grupo === 'capa') c.linha = c.rotulo; // autoria do Estúdio vira linha
  if (m[0] === 'o06' && c.rotulo) delete c.rotulo;
  return true;
}

/** Opções do card, com os padrões do modelo para o núcleo. */
export function opcoesDoModelo(modelo) {
  return [...(modelo?.opcoes || []), OP_CARIMBO];
}
export function opcoesDe(modelo, card, n) {
  const o = {};
  for (const d of opcoesDoModelo(modelo)) {
    const pad = typeof d.padrao === 'function' ? d.padrao(n) : d.padrao;
    o[d.k] = card?.opcoes?.[d.k] ?? pad;
  }
  return o;
}

// ---------------------------------------------------------------------------

/** Catálogo de cada núcleo: os universais (O-01…O-11) seguidos dos modelos específicos do núcleo. */
export const CATALOGO = {
  estudio: [...UNIVERSAIS, ...ESTUDIO],
  arquitetos: [...UNIVERSAIS, ...ARQUITETOS],
  objetos: [...UNIVERSAIS, ...OBJETOS],
  elaia: [...UNIVERSAIS, ...ELAIA],
};

/** Sequências de abertura de cada núcleo (seguem os carrosséis de referência). */
export const SEQUENCIAS = {
  estudio: ['o01', 'o05', 'o04', 'janela', 'abertura-ficha', 'o10'],
  arquitetos: ['o01', 'o03', 'o07', 'amplitude', 'o06', 'o09', 'o10'],
  objetos: ['o01', 'o03', 'uso-janela', 'o07', 'desenho', 'o09', 'o10'],
  elaia: ['o01', 'o03', 'citacao', 'o08', 'o06', 'imagem-ficha', 'o10'],
};

/**
 * Códigos de referência fixos: sigla do núcleo + número. A ordem destas listas é a numeração
 * original (04/11); modelo retirado deixa o número vago (OA-04, Abertura do projeto, saiu em 13/11)
 * e modelo novo recebe o próximo número.
 */
const NUMERACAO = {
  estudio: ['capa', 'capa-painel', 'imagem-legenda', 'vertical-8-4', 'vertical-4-8', 'janela', 'abertura-ficha', 'tipografico-ficha', 'unico'],
  arquitetos: ['capa', 'capa-papel', 'capa-tres', null, 'tese', 'vista', 'amplitude', 'pausa', 'referencia', 'duas-coluna', 'material', 'vertical-4-8', 'processo', 'ficha', 'fechamento'],
  objetos: ['capa', 'painel-imagem', 'imagem-painel', 'pausa', 'uso-janela', 'tipografico', 'processo', 'desenho', 'ficha-lateral', 'imagem-ficha', 'fechamento', 'unico-imagem', 'capa-centro'],
  elaia: ['capa', 'capa-papel', 'tese', 'titulo-imagem', 'imagem-texto', 'imagem-titulo-topo', 'imagem-titulo-base', 'imagem-coluna', 'citacao', 'imagem-ficha', 'fechamento', 'materia-bruta', 'unico'],
};
const SIGLAS = { estudio: 'OE', arquitetos: 'OA', objetos: 'OO', elaia: 'EL' };
export function codigoDe(nucleoId, modeloId) {
  if (UNIV_POR_ID[modeloId]) return UNIV_POR_ID[modeloId].cod;
  const i = NUMERACAO[nucleoId]?.indexOf(modeloId) ?? -1;
  return i < 0 ? '' : `${SIGLAS[nucleoId]}-${String(i + 1).padStart(2, '0')}`;
}

export function modelosDo(nucleoId) { return CATALOGO[nucleoId] || []; }
export function modeloDe(nucleoId, id) {
  const lista = modelosDo(nucleoId);
  return lista.find((m) => m.id === id) || lista[0];
}

/** Seta fina para a direita, na altura das maiúsculas do Rótulo. */
const SETA = '<svg class="seta" viewBox="0 0 30 14" width="30" height="14" aria-hidden="true"><path d="M0 7H28M22 1l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

/** Renderiza o miolo de um card (1080 × 1440) como HTML. */
export function renderCard(opc) {
  const modelo = modeloDe(opc.nucleo.id, opc.card.modelo);
  const t = criarContexto({ ...opc, modelo });
  return modelo.render(t) + pontos();
}

/**
 * Seis pontos: três de cada lado, centrados na margem, alinhados ao centro do cabeçalho,
 * ao meio do card e ao centro do selo. A cor é definida em colorirPontos (ajustarLayout).
 */
function pontos() {
  const d = E.ponto;
  const ys = [E.cabecalho + 12, ALT / 2, ALT - E.selo]; // 12 = metade da linha do Rótulo (20 × 1,2)
  const xs = [M / 2, LARG - M / 2];
  return xs.flatMap((x) => ys.map((y) => `<div class="ponto" style="${pos(x - d / 2, y - d / 2, d, d)}"></div>`)).join('');
}

/** Cor que contrasta com o que está sob o ponto: imagem ou fundo escuro → branco; claro → ardósia. */
function corSob(card, x, y) {
  const els = [...card.children].reverse();
  for (const el of els) {
    if (!el.classList.contains('bloco') && !el.classList.contains('slot')) continue;
    const l = el.offsetLeft, t = el.offsetTop;
    if (x < l || x > l + el.offsetWidth || y < t || y > t + el.offsetHeight) continue;
    const bg = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)?.map(Number);
    const transparente = !bg || (bg.length > 3 && bg[3] === 0);
    const lum = transparente ? null : (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255;
    if (el.classList.contains('slot') && !el.dataset.vazio) {
      // imagem: branco, salvo foto de estúdio sobre fundo muito claro (Objetos)
      return lum !== null && lum > 0.85 ? A : B;
    }
    if (transparente) continue; // véu (gradiente) ou transparente
    return lum < 0.5 ? B : A;
  }
  return A;
}

/** Fundo sob um ponto: { img: true } sobre imagem, ou { cor: [r,g,b] } do bloco opaco mais alto. */
function fundoSob(card, x, y) {
  const els = [...card.children].reverse();
  for (const el of els) {
    if (!el.classList.contains('bloco') && !el.classList.contains('slot')) continue;
    const l = el.offsetLeft, t = el.offsetTop;
    if (x < l || x > l + el.offsetWidth || y < t || y > t + el.offsetHeight) continue;
    const bg = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)?.map(Number);
    const transparente = !bg || (bg.length > 3 && bg[3] === 0);
    if (el.classList.contains('slot') && !el.dataset.vazio) return { img: true, cor: transparente ? null : bg };
    if (transparente) continue;
    return { cor: bg };
  }
  return { cor: [250, 250, 247] };
}
const lumDe = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

export function colorirPontos(card) {
  card.querySelectorAll(':scope > .ponto').forEach((p) => {
    p.style.background = corSob(card, p.offsetLeft + p.offsetWidth / 2, p.offsetTop + p.offsetHeight / 2);
  });
  // Carimbo: cada célula pega a cor do que está sob ela. Só linhas → tinta que contrasta;
  // fundo cheio → a cor do fundo do card sob a célula (papel, sobre imagem) e a tinta que contrasta.
  card.querySelectorAll(':scope > .carimbo').forEach((cb) => {
    const cheio = cb.dataset.fundo === 'cheio';
    cb.querySelectorAll('.cel').forEach((c) => {
      const x0 = cb.offsetLeft + c.offsetLeft, y = cb.offsetTop + cb.offsetHeight / 2;
      const x = x0 + c.offsetWidth / 2;
      // extensão real do texto na célula (o card pode estar em escala)
      const k = card.getBoundingClientRect().width / card.offsetWidth || 1;
      const rg = document.createRange();
      rg.selectNodeContents(c);
      const r = rg.getBoundingClientRect(), base = card.getBoundingClientRect().left;
      const xa = r.width ? (r.left - base) / k : x, xb = r.width ? (r.right - base) / k : x;
      // célula mista (metade sobre imagem, metade sobre fundo liso, como no O-06 com painel):
      // mesmo em "só linhas" ela ganha o fundo liso, para o texto não sumir no meio
      const mista = corSob(card, xa, y) !== corSob(card, xb, y);
      if (!cheio && !mista) { c.style.background = ''; c.style.color = corSob(card, x, y); return; }
      let f = fundoSob(card, x, y);
      if (mista && f.img) f = [fundoSob(card, xa, y), fundoSob(card, xb, y)].find((o) => !o.img) || f;
      const cor = f.img ? [250, 250, 247] : f.cor;
      c.style.background = `rgb(${cor.slice(0, 3).join(',')})`;
      c.style.color = lumDe(cor) < 0.5 ? B : A;
    });
  });
}

const resolverExemplo = (m, nid) => (typeof m?.exemplo === 'function' ? m.exemplo(nid) : { ...(m?.exemplo || {}) });
export function exemploDe(nucleoId, modeloId) {
  return resolverExemplo(modeloDe(nucleoId, modeloId), nucleoId);
}

/** Áreas de imagem que o card usa de fato (algumas opções escondem slots). */
export function slotsDe(nucleoId, card) {
  const m = modeloDe(nucleoId, card.modelo);
  const todos = Object.entries(m.slots || {});
  if (!m.slotsAtivos) return todos;
  const ops = opcoesDe(m, card, { id: nucleoId });
  const ativos = m.slotsAtivos({ op: (k) => ops[k] });
  return todos.filter(([s]) => ativos.includes(s));
}

/** Grupo do modelo no painel direito. */
const CAPAS = new Set();
const FECHAMENTOS = new Set(['tipografico-ficha']);
export const GRUPOS = [
  ['capa', 'Capas'],
  ['corpo', 'Corpo'],
  ['fechamento', 'Fechamento'],
  ['unico', 'Posts únicos'],
];
export function grupoDe(m) {
  if (m.grupo) return m.grupo;
  if (m.unico) return 'unico';
  if (CAPAS.has(m.id)) return 'capa';
  if (FECHAMENTOS.has(m.id)) return 'fechamento';
  return 'corpo';
}

const LINHAS_MAX = 5;
const IMG_MIN = 220;

/**
 * Passe de layout depois de renderizar um card:
 * 1. títulos ajustam o corpo (data-fit);
 * 2. textos de apoio com mais de 5 linhas alargam a caixa: meia tela → 3/4 → tela inteira (data-cresce);
 * 3. imagens e painéis abaixo do texto mantêm distância fixa do fim do texto (data-segue).
 */
export function ajustarLayout(raiz) {
  raiz.querySelectorAll('[data-fit]').forEach(ajustar);
  raiz.querySelectorAll('[data-cresce]').forEach(crescer);
  raiz.querySelectorAll('[data-segue]').forEach((el) => seguir(el, raiz));
  raiz.querySelectorAll('[data-antes]').forEach((el) => anteceder(el, raiz));
  const cards = raiz.classList?.contains('card') ? [raiz] : raiz.querySelectorAll('.card');
  cards.forEach(colorirPontos);
}

export function crescer(el) {
  const estagios = el.dataset.cresce.split(',').map(Number);
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 39;
  for (const col of estagios) {
    el.style.marginLeft = X(col) - M + 'px';
    if (Math.round(el.scrollHeight / lh) <= LINHAS_MAX) break;
  }
}

function fimDoBloco(bloco) {
  let b = 0;
  for (const c of bloco.children) {
    if (!c.offsetHeight) continue;
    b = Math.max(b, c.offsetTop + c.offsetHeight);
  }
  return bloco.offsetTop + b;
}

export function seguir(el, raiz) {
  const card = raiz.classList?.contains('card') ? raiz : el.closest('.card') || raiz;
  const bloco = card.querySelector(`[data-bloco="${el.dataset.segue}"]`);
  if (!bloco) return;
  const y = Math.round(fimDoBloco(bloco) + Number(el.dataset.gap || 96));
  if (el.dataset.modo === 'altura') {
    el.style.height = Math.max(0, y - el.offsetTop) + 'px';
  } else {
    const fim = Number(el.dataset.fim || ALT);
    const topo = Math.min(y, fim - IMG_MIN);
    el.style.top = topo + 'px';
    el.style.height = fim - topo + 'px';
  }
}

function inicioDoBloco(bloco) {
  let t = Infinity;
  for (const c of bloco.children) {
    if (!c.offsetHeight) continue;
    t = Math.min(t, c.offsetTop);
  }
  return bloco.offsetTop + (t === Infinity ? bloco.offsetHeight : t);
}

/** Imagem acima de um bloco ancorado embaixo: desce até data-gap antes do início do bloco. */
export function anteceder(el, raiz) {
  const card = raiz.classList?.contains('card') ? raiz : el.closest('.card') || raiz;
  const bloco = card.querySelector(`[data-bloco="${el.dataset.antes}"]`);
  if (!bloco) return;
  const fim = Math.round(inicioDoBloco(bloco) - Number(el.dataset.gap || E.bloco));
  el.style.height = Math.max(IMG_MIN, fim - el.offsetTop) + 'px';
}

/** Ajusta o corpo dos títulos marcados com data-fit="min,max,alturaMax". */
export function ajustarTextos(raiz) {
  ajustarLayout(raiz);
}
export function ajustar(el) {
  const [min, max, alt] = el.dataset.fit.split(',').map(Number);
  let s = max;
  el.style.fontSize = s + 'px';
  while (s > min && (el.scrollHeight > alt || el.scrollWidth > el.clientWidth + 1)) {
    s -= 2;
    el.style.fontSize = s + 'px';
  }
}
