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

// ---------------------------------------------------------------------------
// Contexto de renderização

export function criarContexto({ card, indice, total, nucleo, globais, modelo, modo, fonteImagem }) {
  const n = nucleo;
  const g = globais;
  const editavel = modo === 'editar';
  const unico = !!modelo.unico;

  const t = {
    n, g, editavel,

    campo(chave, classe, estilo = '', opc = {}) {
      const valor = card.campos?.[chave] ?? '';
      // opc.fit = altura máxima da área; o corpo vai do máximo ao mínimo do estilo (padroes.js)
      let fit = '';
      if (opc.fit) {
        const est = TEXTO_POR_CLASSE[classe.split(' ').find((c) => TEXTO_POR_CLASSE[c])];
        fit = ` data-fit="${corpoMin(est)},${corpoMax(est)},${opc.fit}"`;
      }
      const ph = esc(String(opc.ph ?? modelo.exemplo?.[chave] ?? '').replace(/<[^>]+>/g, ''));
      if (!editavel && !valor) return '';
      const attrs = editavel ? ` contenteditable="true" spellcheck="true" data-campo="${chave}" data-ph="${ph}"` : '';
      return `<div class="${classe}" style="${estilo}"${fit}${opc.attrs || ''}${attrs}>${valor}</div>`;
    },

    /** Texto de apoio: até 5 linhas; se passar, alarga a caixa (meia tela → 3/4 → tela inteira). */
    apoio(chave, col, estilo = '') {
      const estagios = [7, 5, 1].filter((c) => c <= col);
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
      const segue = opc.segue ? ` data-segue="${opc.segue}" data-gap="${opc.gap ?? E.bloco}" data-fim="${y + h}"` : '';
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

    /** Cabeçalho: y 40. Esquerda "Odisse — Núcleo"; direita projeto + contador, ou o aviso do post único. */
    cab(corEsq, corDir = corEsq) {
      let dir;
      if (unico) {
        dir = t.campo('aviso', 'cab-txt', '', { ph: 'Aviso' });
      } else {
        const cont = g.contador ? `${String(indice + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}` : '';
        const txt = [g.projeto, cont].filter(Boolean).join(' — ');
        dir = editavel ? `<span data-global="projeto" title="Informação padrão — edite no painel à esquerda">${esc(txt)}</span>` : esc(txt);
      }
      return `<div class="cab t-rotulo" style="left:${M}px;color:${corEsq}">${esc(n.cabecalho)}</div>
        <div class="cab t-rotulo dir" style="right:${M}px;color:${corDir}">${dir}</div>`;
    },

    /** Selo centrado no rodapé, com o centro a E.selo da base. Post único: mão. */
    selo(cor) {
      if (!g.selo) return '';
      const nome = unico ? 'mao' : n.selo;
      const h = nome === 'mao' ? 72 : 64;
      return `<div class="selo" style="top:${ALT - E.selo - h / 2}px;color:${cor}">${mark(nome, h)}</div>`;
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
        if (!r && !v) continue;
        h += `<div class="ficha-linha${opc.empilhada ? ' empilhada' : ''}" style="border-color:${regra};${opc.linha || ''}">${r || '<div></div>'}${v}</div>`;
      }
      if (!h) return '';
      return `<div class="ficha${opc.distribuir ? ' distribuir' : ''}" style="color:${cor};border-color:${regra};${opc.estilo || ''}">${h}</div>`;
    },

    legenda(cor, largura = 380) {
      const r = t.campo('legR', 't-rotulo', '', { ph: 'Rótulo' });
      const l = t.campo('legT', 't-legenda', '', { ph: 'Legenda: quem, onde, quando.' });
      if (!r && !l) return '';
      return `<div class="legenda" style="color:${cor};width:${largura}px">${r}${l}</div>`;
    },

    fluxo(x, y, w, h, cor, miolo, classe = '', bloco = '') {
      return `<div class="fluxo ${classe}" style="${pos(x, y, w, h)}color:${cor}"${bloco ? ` data-bloco="${bloco}"` : ''}>${miolo}</div>`;
    },

    /** Fechamento comum aos núcleos: imagem estreita à esquerda, conteúdo a partir da coluna 4. */
    fechamento({ imgL = 264, lockup, seloRodape }) {
      const contatos = ['site', 'telefone', 'email'].map((k) => t.global(k, 't-texto')).join('');
      return `${t.fundo(n.fundo)}
        ${t.cab(A)}
        ${t.img('a', 0, 440, imgL, 544, { opcional: true })}
        ${t.fluxo(X(4), 400, W(4, 12), (seloRodape ? 1130 : 1170) - 400, A, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.global('contatoTitulo', 't-chamada', `margin-bottom:${px('bloco')}`)}
          ${t.global('contatoTexto', 't-texto', `margin-bottom:${px('bloco')}`)}
          <div class="contatos" style="border-top:1.5px solid ${regraSobre(n.fundo)};padding-top:${px('filete')}">${contatos}</div>
          <div class="lockup" style="margin-top:auto">${lockup}</div>`)}
        ${seloRodape ? t.selo(A) : ''}`;
    },
  };
  return t;
}

// ---------------------------------------------------------------------------
// Peças reutilizadas por mais de um núcleo

const processo = (exemplo) => ({
  id: 'processo',
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
      ${t.campo('rotulo', 't-rotulo', `position:absolute;${pos(M, TOPO)}color:${A}`)}
      ${linhas}${t.selo(A)}`;
  },
});

const capaPapel = ({ exemplo, imgY = 562, imgH = 589, fit = 300 }) => ({
  id: 'capa-papel',
  nome: 'Capa sobre papel',
  desc: 'Título no alto, faixa de imagem e assinatura sob um filete.',
  slots: { a: 'Imagem' },
  exemplo,
  render(t) {
    return `${t.fundo(COR.papel)}${t.cab(A)}
      ${t.fluxo(M, 190, W12, imgY - 230, A, t.campo('titulo', 't-capa', '', { fit }), 'fim')}
      ${t.img('a', 0, imgY, LARG, imgH)}
      ${t.regra(M, 1172, W12, A)}
      ${t.assinatura(A, `position:absolute;${pos(M, 1172 + E.filete)}`)}
      ${t.campo('rodape', 't-rotulo', `position:absolute;${pos(M, 1364)}color:${A}`)}`;
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

const imagemColuna = (exemplo) => ({
  id: 'imagem-coluna',
  nome: 'Imagem + coluna',
  desc: 'Corte vertical 8 | 4: imagem inteira e coluna estreita no painel.',
  slots: { a: 'Imagem (colunas 1–8)' },
  exemplo,
  render(t) {
    const f = t.n.painel, cor = tintaSobre(f);
    return `${t.fundo(COR.papel)}
      ${t.painel(C8 + h2, 0, LARG - C8 - h2, ALT, f)}
      ${t.img('a', 0, 0, C8 - h2, ALT)}
      ${t.veuTopo(200, 0.6, 0, C8 - h2)}${t.veuBase(340, 0.72, 0, C8 - h2)}
      ${t.cab(B, cor)}
      ${t.fluxo(X(9), TOPO, W(9, 12), 1150, cor, `
        ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
        ${t.campo('texto', 't-texto')}`)}
      ${t.selo(B)}`;
  },
});

const pausa = ({ exemplo, cab = B, veuTopo = true }) => ({
  id: 'pausa',
  nome: 'Pausa',
  desc: 'Imagem inteira, sangrando. Legenda opcional no pé.',
  slots: { a: 'Imagem inteira' },
  exemplo,
  render(t) {
    return `${t.img('a', 0, 0, LARG, ALT)}
      ${veuTopo ? t.veuTopo() : ''}${t.veuBase()}
      ${t.cab(cab)}${t.legenda(B)}${t.selo(B)}`;
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
    id: 'capa',
    nome: 'Capa',
    desc: 'Imagem inteira, autoria e título no pé.',
    slots: { a: 'Imagem da capa' },
    exemplo: { rotulo: 'Cid Clementino · Nathalia Linhares', titulo: 'Reserva Criativa.' },
    render(t) {
      return `${t.img('a', 0, 0, LARG, ALT)}
        ${t.veuTopo()}${t.veuBase(760, 0.85)}
        ${t.cab(B)}
        ${t.fluxo(M, 180, W12, 1070, B, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo('titulo', 't-capa', '', { fit: 520 })}`, 'fim')}
        ${t.selo(B)}`;
    },
  },
  {
    id: 'capa-painel',
    nome: 'Capa em painel',
    desc: 'Título sobre ardósia e duas imagens lado a lado.',
    slots: { a: 'Imagem esquerda', b: 'Imagem direita' },
    exemplo: { titulo: 'Reserva Criativa.', rotulo: 'Cid Clementino · Nathalia Linhares', rodape: 'Odisse Arquitetura & Design · Bastidores' },
    render(t) {
      return `${t.fundo(A)}${t.cab(B)}
        ${t.fluxo(M, 200, W12, 360, B, `
          ${t.campo('titulo', 't-capa', '', { fit: 290 })}
          ${t.campo('rotulo', 't-rotulo', `margin-top:${px('assinatura')}`)}`)}
        ${t.img('a', 0, 580, C6 - h2, 590)}
        ${t.img('b', C6 + h2, 580, LARG - C6 - h2, 590)}
        ${t.campo('rodape', 't-rotulo', `position:absolute;${pos(M, 1206)}color:${B}`)}
        ${t.selo(B)}`;
    },
  },
  {
    id: 'imagem-legenda',
    nome: 'Imagem + legenda',
    desc: 'Imagem inteira com legenda no pé: rótulo e uma linha.',
    slots: { a: 'Imagem inteira' },
    exemplo: { legR: 'Obra', legT: 'A figura sob a cobertura metálica.' },
    render(t) {
      return `${t.img('a', 0, 0, LARG, ALT)}${t.veuTopo()}${t.veuBase()}
        ${t.cab(B)}${t.legenda(B)}${t.selo(B)}`;
    },
  },
  {
    id: 'vertical-8-4',
    nome: 'Vertical 8 | 4',
    desc: 'Pessoa e lugar: duas imagens com corte entre as colunas 8 e 9.',
    slots: { a: 'Imagem larga (1–8)', b: 'Imagem estreita (9–12)' },
    exemplo: { legR: 'Retrato', legT: 'Nathalia Linhares, desenho em campo.' },
    render(t) {
      return `${t.fundo(A)}
        ${t.img('a', 0, 0, C8 - h2, ALT)}
        ${t.img('b', C8 + h2, 0, LARG - C8 - h2, ALT)}
        ${t.veuTopo()}${t.veuBase()}
        ${t.cab(B)}${t.legenda(B, 420)}${t.selo(B)}`;
    },
  },
  {
    id: 'vertical-4-8',
    nome: 'Vertical 4 | 8',
    desc: 'Duas imagens com corte entre as colunas 4 e 5.',
    slots: { a: 'Imagem estreita (1–4)', b: 'Imagem larga (5–12)' },
    exemplo: { legR: 'Visita de obra', legT: 'O vão livre sob a cobertura.' },
    render(t) {
      return `${t.fundo(A)}
        ${t.img('a', 0, 0, C4 - h2, ALT)}
        ${t.img('b', C4 + h2, 0, LARG - C4 - h2, ALT)}
        ${t.veuTopo()}${t.veuBase()}
        ${t.cab(B)}${t.legenda(B, 420)}${t.selo(B)}`;
    },
  },
  {
    id: 'janela',
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
  unicoTexto({
    fundo: () => COR.papel,
    exemplo: {
      aviso: 'Prêmio',
      rotulo: 'Casacor Paraíba 2023',
      titulo: 'Melhor uso de materiais inovadores.',
      texto: 'O Odisse recebeu o prêmio na edição 2023 da mostra.',
      f1r: 'Mostra', f1v: 'CASACOR Paraíba',
      f2r: 'Ano', f2v: '2023',
      f3r: 'Estúdio', f3v: 'Odisse Arquitetura & Design',
    },
  }),
];

// ---------------------------------------------------------------------------
// ODISSE ARQUITETOS — projetos. Papel e areia, cor plena, roda.

const ARQUITETOS = [
  {
    id: 'capa',
    nome: 'Capa',
    desc: 'Render inteiro, título branco e assinatura no pé.',
    slots: { a: 'Imagem da capa' },
    exemplo: { titulo: 'Um horizonte comum.', assin: 'Odisse Arquitetos · Projeto de interiores' },
    render(t) {
      return `${t.img('a', 0, 0, LARG, ALT)}
        ${t.veuTopo()}${t.veuBase(820, 0.8)}
        ${t.cab(B)}
        ${t.fluxo(M, 180, W12, 1060, B, `
          ${t.campo('titulo', 't-capa', '', { fit: 560 })}
          ${t.assinatura(B, `margin-top:${px('assinatura')}`)}`, 'fim')}`;
    },
  },
  capaPapel({
    imgY: 356, imgH: 795, fit: 120,
    exemplo: { titulo: 'Um horizonte comum.', assin: 'Odisse Arquitetos · Apto RP 201', rodape: 'Projeto de interiores' },
  }),
  {
    id: 'capa-tres',
    nome: 'Capa em areia',
    desc: 'Título grande no painel areia e três imagens em faixa.',
    slots: { a: 'Imagem 1', b: 'Imagem 2', c: 'Imagem 3' },
    exemplo: { titulo: 'Um<br>horizonte<br>comum.', assin: 'Odisse Arquitetos · Apto RP 201' },
    render(t) {
      return `${t.fundo(COR.areia)}${t.cab(A)}
        ${t.fluxo(M, 200, W12, 520, A, t.campo('titulo', 't-capa', '', { fit: 470 }))}
        ${t.img('a', 0, 770, C4 - h2, 360)}
        ${t.img('b', C4 + h2, 770, C8 - C4 - CORTE, 360)}
        ${t.img('c', C8 + h2, 770, LARG - C8 - h2, 360)}
        ${t.assinatura(A, `position:absolute;${pos(M, 1130 + E.assinatura)}`)}`;
    },
  },
  {
    id: 'abertura-projeto',
    nome: 'Abertura do projeto',
    desc: 'Imagem no alto, nome do projeto e duas colunas: problema e solução.',
    slots: { a: 'Imagem superior' },
    exemplo: {
      rotulo: '(01) O projeto',
      titulo: 'Apto RP 201',
      sub: 'Odisse Arquitetos · Projeto de interiores',
      c1r: 'O problema', c1t: 'O mar era um privilégio recluso à varanda, visto de um único ambiente.',
      c2r: 'A solução', c2t: 'A planta abre sala, jantar e cozinha para o mesmo horizonte e redistribui a vista.',
    },
    render(t) {
      const col = (i) => `<div style="border-top:1.5px solid ${A};padding-top:${px('filete')}">
          ${t.campo(`c${i}r`, 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo(`c${i}t`, 't-legenda')}
        </div>`;
      return `${t.fundo(COR.papel)}
        ${t.img('a', 0, 0, LARG, 820)}${t.veuTopo()}
        ${t.cab(B)}
        ${t.fluxo(M, 820 + E.bloco, W12, 1300 - 820 - E.bloco, A, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo('titulo', 't-capa', '', { fit: 130 })}
          ${t.campo('sub', 't-legenda', `margin-top:${px('proximo')}`)}
          <div style="display:grid;grid-template-columns:${W(1, 6)}px ${W(7, 12)}px;column-gap:${G}px;margin-top:${px('bloco')}">${col(1)}${col(2)}</div>`)}
        ${t.selo(A)}`;
    },
  },
  {
    id: 'tese',
    nome: 'Tese',
    desc: 'Rótulo, título e apoio na coluna 7; croqui ou render sangrando embaixo.',
    slots: { a: 'Imagem inferior' },
    exemplo: {
      rotulo: 'A tese',
      titulo: 'Três ambientes, um ponto de fuga.',
      texto: 'Sem anteparos entre sala, jantar e cozinha, os três ambientes se voltam para o mesmo horizonte.',
    },
    render(t) {
      return `${t.fundo(COR.papel)}
        ${t.img('a', 0, 640, LARG, 800, { segue: 'txt' })}
        ${t.cab(A)}
        ${t.fluxo(M, TOPO, W12, 700, A, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo('titulo', 't-titulo', '', { fit: 230 })}
          ${t.apoio('texto', 7, `margin-top:${px('bloco')}`)}`, '', 'txt')}
        ${t.selo(A)}`;
    },
  },
  {
    id: 'vista',
    nome: 'Imagem + título',
    desc: 'Imagem no alto; rótulo, título e apoio na coluna 7.',
    slots: { a: 'Imagem superior' },
    exemplo: {
      rotulo: 'A vista',
      titulo: 'A vista atravessa a casa.',
      texto: 'Antes restrito à varanda, o mar passa a fazer parte da sala e do jantar.',
    },
    render(t) {
      return `${t.fundo(COR.papel)}
        ${t.img('a', 0, 0, LARG, 820)}${t.veuTopo()}
        ${t.cab(B)}
        ${t.fluxo(M, 820 + E.bloco, W12, 420, A, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo('titulo', 't-titulo', '', { fit: 230 })}
          ${t.apoio('texto', 7, `margin-top:${px('bloco')}`)}`)}
        ${t.selo(A)}`;
    },
  },
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
  pausa({ exemplo: { legR: '', legT: '' } }),
  {
    id: 'referencia',
    nome: 'Referência + coluna',
    desc: 'Imagem nas colunas 1–8 sobre papel; coluna de texto e crédito nas 9–12.',
    slots: { a: 'Imagem (1–8)' },
    exemplo: {
      rotulo: 'A referência',
      texto: 'Partimos de expressões simbólicas já postas, que transcendem o figurativismo e se imbuem de uma narrativa mitopoética.',
      fonte: 'Gilvan Samico, A Árvore da Vida e o Infinito Azul, xilogravura.',
    },
    render(t) {
      return `${t.fundo(COR.papel)}${t.cab(A)}
        ${t.img('a', 0, TOPO, C8 - h2, 1170)}
        ${t.fluxo(X(9), TOPO, W(9, 12), 1170, A, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo('texto', 't-texto')}
          ${t.campo('fonte', 't-legenda fonte', `margin-top:auto;border-top:1.5px solid ${regraSobre(COR.papel)};padding-top:${px('filete')}`)}`)}
        ${t.selo(A)}`;
    },
  },
  {
    id: 'duas-coluna',
    nome: 'Duas imagens + coluna',
    desc: 'Duas imagens empilhadas nas colunas 1–8; texto e crédito nas 9–12.',
    slots: { a: 'Imagem superior', b: 'Imagem inferior' },
    exemplo: {
      rotulo: 'O caminho',
      texto: 'Um caminho em construção. A pacificação da tensão entre a expressão simbólico-material de uma cultura que nos é própria e a proficiência técnica da modernidade.',
      fonte: 'Acima, couro trabalhado. Abaixo, concreto aparente.',
    },
    render(t) {
      return `${t.fundo(COR.papel)}${t.cab(A)}
        ${t.img('a', 0, TOPO, C8 - h2, 581)}
        ${t.img('b', 0, TOPO + 581 + CORTE, C8 - h2, 581)}
        ${t.fluxo(X(9), TOPO, W(9, 12), 1170, A, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo('texto', 't-texto')}
          ${t.campo('fonte', 't-legenda fonte', `margin-top:auto;border-top:1.5px solid ${regraSobre(COR.papel)};padding-top:${px('filete')}`)}`)}
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
  {
    id: 'vertical-4-8',
    nome: 'Vertical 4 | 8',
    desc: 'Duas imagens com corte entre as colunas 4 e 5.',
    slots: { a: 'Imagem estreita (1–4)', b: 'Imagem larga (5–12)' },
    exemplo: { legR: '', legT: '' },
    render(t) {
      return `${t.fundo(COR.papel)}
        ${t.img('a', 0, 0, C4 - h2, ALT)}
        ${t.img('b', C4 + h2, 0, LARG - C4 - h2, ALT)}
        ${t.veuTopo()}${t.veuBase()}
        ${t.cab(B)}${t.legenda(B, 300)}${t.selo(B)}`;
    },
  },
  processo({
    rotulo: 'Processo',
    p1r: 'Estudo', p1t: 'O enquadramento da vista a partir da mesa de jantar.',
    p2r: 'Croqui', p2t: 'Sala, jantar e cozinha desenhados sobre o mesmo ponto de fuga.',
    p3r: 'Imagem final', p3t: 'A vista atravessa toda a planta, da cozinha à varanda.',
  }),
  {
    id: 'ficha',
    nome: 'Ficha técnica',
    desc: 'Título e até seis linhas sobre ardósia.',
    slots: {},
    exemplo: {
      titulo: 'Ficha técnica.',
      f1r: 'Projeto', f1v: 'Retrofit de Interiores do Edf. AVS. Sala de Conferência',
      f2r: 'Escritório', f2v: 'Odisse, Estúdio de Arquitetura e Design',
      f3r: 'Tipo', f3v: 'Projeto de Interiores; Retrofit.',
      f4r: 'Programa', f4v: 'Sala de Conferência; Sala de Reuniões; Estações de Trabalho; Área de Exposição e Encontro.',
      f5r: 'Premissa', f5v: 'Atualização dos ambientes criativos do edifício segundo o estado da arte, tanto em termos concretos quanto simbólicos.',
    },
    render(t) {
      return `${t.fundo(A)}${t.cab(B)}
        ${t.fluxo(M, TOPO, W12, 1172, B, `
          ${t.campo('titulo', 't-titulo', '', { fit: 250 })}
          ${t.ficha('f', 6, B, regraSobre(A), { estilo: 'margin-top:auto', distribuir: true })}`)}
        ${t.selo(B)}`;
    },
  },
  {
    id: 'fechamento',
    nome: 'Fechamento',
    desc: 'Chamada e contatos (das informações padrão), mão e logotipo.',
    slots: { a: 'Imagem lateral (opcional)' },
    exemplo: { rotulo: 'Contato' },
    render(t) { return t.fechamento({ imgL: 202, lockup: `${mark('mao', 62)}${mark('odisse', 32)}`, seloRodape: true }); },
  },
];

// ---------------------------------------------------------------------------
// ODISSE OBJETOS — peças e loja. Grafite, foto de estúdio, flor.

const OBJETOS = [
  {
    id: 'capa',
    nome: 'Capa',
    desc: 'Foto de estúdio inteira, nome da peça no alto e assinatura no pé.',
    slots: { a: 'Foto da peça' },
    exemplo: { titulo: 'Vórtice I', assin: 'Odisse Objetos · Receptáculo' },
    render(t) {
      return `${t.img('a', 0, 0, LARG, ALT, { fundo: '#EDEDEB' })}
        ${t.veuBase(520, 0.7)}
        ${t.cab(A)}
        ${t.fluxo(M, 180, W12, 360, A, t.campo('titulo', 't-capa', '', { fit: 320 }))}
        ${t.assinatura(B, `position:absolute;${pos(M, 1198)}`)}`;
    },
  },
  {
    id: 'painel-imagem',
    nome: 'Painel + imagem',
    desc: 'Título e apoio no painel grafite; foto da peça embaixo.',
    slots: { a: 'Foto inferior' },
    exemplo: {
      rotulo: 'A peça',
      titulo: 'Um coração em processo.',
      texto: 'Corpo único que se torce em torno do próprio eixo, em sulcos helicoidais contínuos.',
    },
    render(t) {
      return `${t.fundo(COR.papel)}
        ${t.painel(0, 0, LARG, 578, COR.grafite, ` data-segue="txt" data-gap="${E.bloco}" data-modo="altura"`)}
        ${t.img('a', 0, 586, LARG, 854, { fundo: '#EDEDEB', segue: 'txt', gap: E.bloco + CORTE })}${t.veuBase()}
        ${t.cab(B)}
        ${t.fluxo(M, TOPO, W12, 700, B, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo('titulo', 't-titulo', '', { fit: 230 })}
          ${t.apoio('texto', 7, `margin-top:${px('bloco')}`)}`, '', 'txt')}
        ${t.selo(B)}`;
    },
  },
  {
    id: 'imagem-painel',
    nome: 'Imagem + painel',
    desc: 'Foto da peça no alto; título e apoio no painel grafite.',
    slots: { a: 'Foto superior' },
    exemplo: {
      rotulo: 'A peça',
      titulo: 'Um coração em processo.',
      texto: 'Um receptáculo em corpo único que se torce em torno do próprio eixo, da base ao topo, em sulcos helicoidais contínuos.',
    },
    render(t) {
      return `${t.fundo(COR.grafite)}
        ${t.img('a', 0, 0, LARG, 760, { fundo: '#EDEDEB' })}
        ${t.cab(A)}
        ${t.fluxo(M, 760 + E.bloco, W12, 1300 - 760 - E.bloco, B, `
          ${t.campo('rotulo', 't-rotulo', `margin-bottom:${px('proximo')}`)}
          ${t.campo('titulo', 't-titulo', '', { fit: 230 })}
          ${t.apoio('texto', 5, `margin-top:${px('bloco')}`)}`)}
        ${t.selo(B)}`;
    },
  },
  pausa({ cab: A, veuTopo: false, exemplo: { legR: '', legT: '' } }),
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
  processo({
    rotulo: 'Processo',
    p1r: 'Modelagem', p1t: 'A forma é modelada digitalmente: uma seção que gira em torno do eixo à medida que sobe.',
    p2r: 'Impressão', p2t: 'Impressa em PLA, em peça única e sem montagem, por deposição de filamento fundido.',
    p3r: 'Acabamento', p3t: 'Lixada, corrigida, preparada com primer e pintada à mão em PU texturizado preto fosco.',
  }),
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
    id: 'imagem-ficha',
    nome: 'Imagem + ficha',
    desc: 'Foto da peça no alto e ficha completa embaixo.',
    slots: { a: 'Foto superior' },
    exemplo: {
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
        ${t.img('a', 0, 0, LARG, 698, { fundo: '#EDEDEB' })}
        ${t.cab(A)}
        ${t.fluxo(M, 698 + E.bloco, W12, 1300 - 698 - E.bloco, A, t.ficha('f', 7, A, regraSobre(COR.papel)))}
        ${t.selo(A)}`;
    },
  },
  {
    id: 'fechamento',
    nome: 'Fechamento · loja',
    desc: 'Chamada para a loja, contatos, flor e logotipo.',
    slots: { a: 'Foto lateral (opcional)' },
    exemplo: { rotulo: 'Loja' },
    render(t) { return t.fechamento({ imgL: 264, lockup: `${mark('flor', 70)}${mark('odisse', 32)}`, seloRodape: false }); },
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
    id: 'capa',
    nome: 'Capa',
    desc: 'Imagem inteira, título, assinatura e linha da série no pé.',
    slots: { a: 'Imagem da capa' },
    exemplo: {
      titulo: 'Backrooms, Labirinto Domesticado.',
      assin: 'Elaia · Ensaio de Nathalia Linhares',
      rodape: 'A partir de Backrooms, Labirinto Domesticado: Parte I',
    },
    render(t) {
      return `${t.img('a', 0, 0, LARG, ALT)}
        ${t.veuTopo()}${t.veuBase(900, 0.8)}
        ${t.cab(B)}
        ${t.fluxo(M, 180, W12, 1062, B, `
          ${t.campo('titulo', 't-capa', '', { fit: 600 })}
          ${t.assinatura(B, `margin-top:${px('assinatura')}`)}`, 'fim')}
        ${t.campo('rodape', 't-rotulo', `position:absolute;${pos(M, 1364)}color:${B}`)}`;
    },
  },
  capaPapel({
    exemplo: {
      titulo: 'Backrooms,<br>Labirinto<br>Domesticado',
      assin: 'Elaia · Ensaio de Nathalia Linhares',
      rodape: 'A partir de Backrooms, Labirinto Domesticado: Parte I',
    },
  }),
  {
    id: 'tese',
    nome: 'Tese',
    desc: 'Título e apoio sobre papel; imagem sangrando embaixo.',
    slots: { a: 'Imagem inferior' },
    exemplo: {
      titulo: 'A incerteza é mais assustadora que a alegoria.',
      texto: 'Ao traçar um paralelo entre os anseios da mente de Clark e os backrooms, a narrativa do filme homônimo perde forças na exploração do horror espacial ao dar sentido ao desconhecido.',
    },
    render(t) {
      return `${t.fundo(COR.papel)}
        ${t.img('a', 0, 762, LARG, 678, { segue: 'txt' })}${t.veuBase()}
        ${t.cab(A)}
        ${t.fluxo(M, TOPO, W12, 800, A, `
          ${t.campo('titulo', 't-titulo', '', { fit: 340 })}
          ${t.apoio('texto', 5, `margin-top:${px('bloco')}`)}`, '', 'txt')}
        ${t.selo(B)}`;
    },
  },
  {
    id: 'titulo-imagem',
    nome: 'Imagem + título',
    desc: 'Imagem no alto; título e texto sobre papel.',
    slots: { a: 'Imagem superior' },
    exemplo: {
      titulo: 'Aquilo que é indefinido nos causa ansiedade.',
      texto: 'Ao virarmos a esquina, estaremos seguros ou encararemos um monstro?<br>Ao ir do ponto A ao ponto B, tem-se uma jornada com um fim claro, no entanto, entre esses dois pontos, o caminho é um espaço liminar.',
    },
    render(t) {
      return `${t.fundo(COR.papel)}
        ${t.img('a', 0, 0, LARG, 660)}${t.veuTopo()}
        ${t.cab(B)}
        ${t.fluxo(M, 660 + E.bloco, W12, 600, A, `
          ${t.campo('titulo', 't-titulo', '', { fit: 340 })}
          ${t.campo('texto', 't-texto', `margin-top:${px('bloco')}`)}`)}
        ${t.selo(A)}`;
    },
  },
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
    id: 'imagem-titulo-topo',
    nome: 'Imagem + título no alto',
    desc: 'Imagem inteira, título branco no alto e apoio na coluna 7.',
    slots: { a: 'Imagem inteira' },
    exemplo: {
      titulo: 'Espaço liminar é qualquer espaço intermediário.',
      texto: 'Um estágio de transição que não se restringe à abordagem espacial, mas à sua condição transitória.',
    },
    render(t) {
      return `${t.img('a', 0, 0, LARG, ALT)}
        ${t.veuTopo(760, 0.6)}${t.veuBase()}
        ${t.cab(B)}
        ${t.fluxo(M, TOPO, W12, 700, B, `
          ${t.campo('titulo', 't-titulo', '', { fit: 340 })}
          ${t.apoio('texto', 7, `margin-top:${px('bloco')}`)}`)}
        ${t.selo(B)}`;
    },
  },
  {
    id: 'imagem-titulo-base',
    nome: 'Imagem + título no pé',
    desc: 'Imagem inteira, título e texto brancos na base.',
    slots: { a: 'Imagem inteira' },
    exemplo: {
      titulo: 'Uma outra face do Espaço Liminar: Backrooms.',
      texto: 'Os backrooms são espaços liminares que não pressupõem um fim.<br>Um lugar <b>sem razão</b> de ser, <b>não-lugares</b>, uma passagem que leva a lugar nenhum. O que existe ao virar a esquina?',
    },
    render(t) {
      return `${t.img('a', 0, 0, LARG, ALT)}
        ${t.veuTopo()}${t.veuBase(860, 0.82)}
        ${t.cab(B)}
        ${t.fluxo(M, 180, W(1, 11), 1000, B, `
          ${t.campo('titulo', 't-titulo', '', { fit: 340 })}
          ${t.campo('texto', 't-texto', `margin-top:${px('bloco')}`)}`, 'fim')}
        ${t.selo(B)}`;
    },
  },
  imagemColuna({
    rotulo: 'Dante',
    texto: 'O <b>Purgatório</b> descrito por Dante na Divina Comédia é um exemplo de espaço liminar.<br>Uma travessia com obstáculos que prenunciam uma transformação. É um estado intermediário que tem sentido e encaminha a um propósito.',
  }),
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
    id: 'fechamento',
    nome: 'Fechamento · leitura',
    desc: 'Chamada para o Substack, link e logotipo Elaia.',
    slots: { a: 'Retrato lateral (opcional)' },
    exemplo: { rotulo: 'Leitura' },
    render(t) { return t.fechamento({ imgL: 264, lockup: mark('elaia', 44), seloRodape: true }); },
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
  unicoTexto({
    fundo: () => COR.pessego,
    exemplo: {
      aviso: 'Novo ensaio',
      rotulo: 'Agora no Elaia',
      titulo: 'Backrooms, Labirinto Domesticado.',
      texto: 'Parte I da série de ensaios de <b>Cid Clementino</b> sobre o fenômeno dos backrooms.',
      f1r: 'Série', f1v: 'Backrooms, Labirinto Domesticado',
      f2r: 'Leitura', f2v: 'odisse.substack.com',
      f3r: 'Autor', f3v: 'Cid Clementino',
    },
  }),
];

// ---------------------------------------------------------------------------

export const CATALOGO = { estudio: ESTUDIO, arquitetos: ARQUITETOS, objetos: OBJETOS, elaia: ELAIA };

/** Sequências de abertura de cada núcleo (seguem os carrosséis de referência). */
export const SEQUENCIAS = {
  estudio: ['capa', 'vertical-8-4', 'imagem-legenda', 'vertical-4-8', 'janela', 'abertura-ficha'],
  arquitetos: ['capa', 'abertura-projeto', 'tese', 'processo', 'vista', 'amplitude', 'ficha', 'fechamento'],
  objetos: ['capa', 'painel-imagem', 'uso-janela', 'processo', 'desenho', 'imagem-ficha', 'fechamento'],
  elaia: ['capa', 'tese', 'citacao', 'imagem-titulo-base', 'imagem-coluna', 'imagem-titulo-topo', 'titulo-imagem', 'imagem-ficha', 'fechamento'],
};

export function modelosDo(nucleoId) { return CATALOGO[nucleoId] || []; }
export function modeloDe(nucleoId, id) {
  const lista = modelosDo(nucleoId);
  return lista.find((m) => m.id === id) || lista[0];
}

/** Renderiza o miolo de um card (1080 × 1440) como HTML. */
export function renderCard(opc) {
  const modelo = modeloDe(opc.nucleo.id, opc.card.modelo);
  const t = criarContexto({ ...opc, modelo });
  return modelo.render(t);
}

export function exemploDe(nucleoId, modeloId) {
  return { ...(modeloDe(nucleoId, modeloId)?.exemplo || {}) };
}

/** Grupo do modelo no painel direito. */
const CAPAS = new Set(['capa', 'capa-painel', 'capa-papel', 'capa-tres']);
const FECHAMENTOS = new Set(['fechamento', 'tipografico-ficha']);
export const GRUPOS = [
  ['capa', 'Capas'],
  ['corpo', 'Corpo'],
  ['fechamento', 'Fechamento'],
  ['unico', 'Posts únicos'],
];
export function grupoDe(m) {
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
