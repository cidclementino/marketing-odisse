// Modelos de card — Manual do sistema Odisse, seção 10.
// Todas as medidas em px do canvas 1080 × 1440. Grid de 12 colunas, margem 52, gutter 16.

import { COR, tintaSobre } from './nucleos.js';
import { mark } from './marks.js';
import { EXEMPLOS } from './exemplos.js';

export const LARG = 1080;
export const ALT = 1440;
const M = 52;
const COLW = (LARG - 2 * M - 11 * 16) / 12; // 66,67
export const X = (c) => M + (c - 1) * (COLW + 16);
export const W = (a, b) => (b - a + 1) * COLW + (b - a) * 16;
const CORTE_V = X(9) - 8; // meio do gutter entre as colunas 8 e 9
const CORTE = 8; // espessura do corte

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const pos = (x, y, w, h) =>
  `left:${x}px;top:${y}px;${w != null ? `width:${w}px;` : ''}${h != null ? `height:${h}px;` : ''}`;

/** Contexto de renderização entregue a cada modelo. */
export function criarContexto({ card, indice, total, nucleo, globais, modelo, modo, fonteImagem }) {
  const n = nucleo;
  const g = globais;
  const editavel = modo === 'editar';
  const unico = modelo.unico || g.tipo === 'unico';

  const t = {
    n, g, COR, modo, editavel,
    tinta: tintaSobre,

    campo(chave, classe, estilo = '', opc = {}) {
      const valor = card.campos?.[chave] ?? '';
      const fit = opc.fit ? ` data-fit="${opc.fit.join(',')}"` : '';
      const ph = esc(String(opc.ph ?? (exemploDe(modelo.id, n.id)[chave] || modelo.exemplo?.[chave]) ?? '').replace(/<[^>]+>/g, ''));
      const tag = opc.tag || 'div';
      if (!editavel && !valor) return '';
      const attrs = editavel ? ` contenteditable="true" spellcheck="true" data-campo="${chave}" data-ph="${ph}"` : '';
      return `<${tag} class="${classe}" style="${estilo}"${fit}${attrs}>${valor}</${tag}>`;
    },

    global(chave, classe, estilo = '', texto) {
      const v = texto ?? g[chave] ?? '';
      if (!v) return '';
      const attr = editavel ? ` data-global="${chave}" title="Informação padrão — edite no painel à esquerda"` : '';
      return `<div class="${classe}" style="${estilo}"${attr}>${esc(v)}</div>`;
    },

    img(slot, x, y, w, h, opc = {}) {
      const im = card.imgs?.[slot];
      const base = `class="slot${opc.contain ? ' contain' : ''}" style="${pos(x, y, w, h)}${opc.fundo ? `background:${opc.fundo};` : ''}" data-slot="${slot}"`;
      if (im?.src) {
        const src = fonteImagem(card, slot);
        const ox = im.x ?? 50, oy = im.y ?? 50, z = im.z ?? 1;
        return `<div ${base}><img src="${src}" alt="" draggable="false" style="object-position:${ox}% ${oy}%;transform-origin:${ox}% ${oy}%;transform:scale(${z})"></div>`;
      }
      if (modo === 'exportar') return opc.opcional ? '' : `<div ${base}></div>`;
      const rotulo = editavel ? `<span class="slot-vazio"><b>+</b> ${esc(opc.rotulo || 'Imagem')}</span>` : '';
      return `<div ${base} data-vazio="1">${rotulo}</div>`;
    },

    painel(x, y, w, h, cor) {
      return `<div class="bloco" style="${pos(x, y, w, h)}background:${cor}"></div>`;
    },

    veuTopo() {
      return `<div class="bloco" style="${pos(0, 0, LARG, 200)}background:linear-gradient(${hexA(n.veu, 0.6)},${hexA(n.veu, 0)})"></div>`;
    },
    veuBase(h = 340, a = 0.72, y = ALT - h) {
      return `<div class="bloco" style="${pos(0, y, LARG, h)}background:linear-gradient(${hexA(n.veu, 0)},${hexA(n.veu, a)})"></div>`;
    },

    /** Cabeçalho: y 40, margens 52. Cores independentes para cabeçalho dividido. */
    cabecalho(corEsq, corDir = corEsq) {
      let dir;
      if (unico) dir = g.aviso || '';
      else {
        const cont = g.contador ? `${String(indice + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}` : '';
        dir = [g.projeto, cont].filter(Boolean).join(' — ');
      }
      const ed = editavel ? ' data-global="projeto" title="Informação padrão — edite no painel à esquerda"' : '';
      return `<div class="cab" style="left:${M}px;color:${corEsq}">${esc(n.cabecalho)}</div>
        <div class="cab dir" style="right:${M}px;color:${corDir}"${ed}>${esc(dir)}</div>`;
    },

    /** Selo centrado no rodapé, faixa y 1340–1408. */
    selo(cor) {
      if (!g.selo) return '';
      const nome = unico ? 'mao' : n.selo;
      const h = nome === 'mao' ? 72 : 64;
      return `<div class="selo" style="top:${1374 - h / 2}px;color:${cor}">${mark(nome, h)}</div>`;
    },

    /** Assinatura de capa: selo de 46 px + "Núcleo · assunto". */
    assinatura(cor) {
      const nome = unico ? 'mao' : n.selo;
      const txt = [n.marca, g.assunto].filter(Boolean).join(' · ');
      const attr = editavel ? ' data-global="assunto" title="Informação padrão — edite no painel à esquerda"' : '';
      return `<div class="assinatura" style="color:${cor}"${attr}>${mark(nome, 46)}<span class="t-rotulo">${esc(txt)}</span></div>`;
    },

    ficha(prefixo, linhas, cor, regra) {
      let h = '';
      for (let i = 1; i <= linhas; i++) {
        const r = t.campo(`${prefixo}${i}r`, 't-rotulo ficha-r', '');
        const v = t.campo(`${prefixo}${i}v`, 't-texto ficha-v', '');
        if (!r && !v) continue;
        h += `<div class="ficha-linha" style="border-color:${regra}">${r || '<div class="ficha-r"></div>'}${v}</div>`;
      }
      return h ? `<div class="ficha" style="color:${cor};border-color:${regra}">${h}</div>` : '';
    },

    legenda(cor) {
      const r = t.campo('legR', 't-rotulo', '', { ph: 'Rótulo' });
      const l = t.campo('legT', 't-legenda', '', { ph: 'Legenda: quem, onde, quando.' });
      if (!r && !l) return '';
      return `<div class="legenda" style="color:${cor}">${r}${l}</div>`;
    },
  };
  return t;
}

const regraSobre = (fundo) => (tintaSobre(fundo) === COR.branco ? 'rgba(255,255,255,.55)' : 'rgba(63,75,87,.45)');

// ---------------------------------------------------------------------------
// Modelos

export const MODELOS = [
  {
    id: 'capa',
    nome: 'Capa',
    desc: 'Imagem cheia, título curto e assinatura dentro do recorte 1:1.',
    slots: { a: 'Imagem da capa' },
    exemplo: { titulo: 'Um horizonte comum.' },
    render(t) {
      return `${t.img('a', 0, 0, LARG, ALT, { rotulo: 'Imagem da capa' })}
        ${t.veuTopo()}${t.veuBase(820, 0.8)}
        ${t.cabecalho(COR.branco)}
        <div class="fluxo fim" style="${pos(M, 180, W(1, 12), 1080)}color:${COR.branco}">
          ${t.assinatura(COR.branco)}
          ${t.campo('titulo', 't-capa', '', { fit: [120, 150, 560] })}
        </div>`;
    },
  },
  {
    id: 'abertura',
    nome: 'Abertura + ficha',
    desc: 'Faixa de imagem, painel do núcleo com título e ficha.',
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
      const fundo = t.n.painel, cor = t.tinta(fundo);
      return `${t.painel(0, 0, LARG, ALT, fundo)}
        ${t.img('a', 0, 0, LARG, 436, { rotulo: 'Imagem superior' })}
        ${t.veuTopo()}${t.cabecalho(COR.branco)}
        <div class="fluxo" style="${pos(M, 500, W(1, 12), 780)}color:${cor}">
          ${t.campo('rotulo', 't-rotulo', 'margin-bottom:18px')}
          ${t.campo('titulo', 't-titulo', 'margin-bottom:56px', { fit: [72, 104, 320] })}
          ${t.ficha('f', 5, cor, regraSobre(fundo))}
        </div>
        ${t.selo(cor)}`;
    },
  },
  {
    id: 'tese',
    nome: 'Tese',
    desc: 'Título e texto de apoio sobre papel, imagem sangrando na base.',
    slots: { a: 'Imagem inferior' },
    exemplo: {
      titulo: 'Três ambientes, um ponto de fuga.',
      texto: 'Sem anteparos entre sala, jantar e cozinha, os três ambientes se voltam para o mesmo horizonte.',
    },
    render(t) {
      return `${t.painel(0, 0, LARG, ALT, t.n.fundo)}
        ${t.img('a', 0, 760, LARG, 680, { rotulo: 'Imagem inferior' })}
        ${t.veuBase()}
        ${t.cabecalho(COR.ardosia)}
        <div class="fluxo" style="${pos(M, 130, W(1, 12), 600)}color:${COR.ardosia}">
          ${t.campo('titulo', 't-titulo', 'margin-bottom:30px', { fit: [88, 112, 420] })}
          ${t.campo('texto', 't-texto', `margin-left:${X(5) - M}px`)}
        </div>
        ${t.selo(COR.branco)}`;
    },
  },
  {
    id: 'processo',
    nome: 'Processo',
    desc: 'Três etapas numeradas, imagem nas colunas 1–6 e texto nas 7–12.',
    slots: { a: 'Etapa 01', b: 'Etapa 02', c: 'Etapa 03' },
    exemplo: {
      rotulo: 'Processo',
      p1r: 'Estudo', p1t: 'O enquadramento da vista a partir da mesa de jantar.',
      p2r: 'Croqui', p2t: 'Sala, jantar e cozinha desenhados sobre o mesmo ponto de fuga.',
      p3r: 'Imagem final', p3t: 'A vista atravessa toda a planta, da cozinha à varanda.',
    },
    render(t) {
      const linhas = ['a', 'b', 'c'].map((s, i) => {
        const y = 196 + i * 380;
        return `${t.img(s, M, y, W(1, 6), 350, { rotulo: `Etapa 0${i + 1}`, fundo: COR.nevoa })}
          <div class="fluxo" style="${pos(X(7), y, W(7, 12), 350)}color:${COR.ardosia}">
            <div class="t-numero">0${i + 1}</div>
            ${t.campo(`p${i + 1}r`, 't-rotulo', 'margin:14px 0 10px')}
            ${t.campo(`p${i + 1}t`, 't-legenda')}
          </div>`;
      }).join('');
      return `${t.painel(0, 0, LARG, ALT, t.n.fundo)}
        ${t.cabecalho(COR.ardosia)}
        ${t.campo('rotulo', 't-rotulo', `position:absolute;${pos(M, 130)}color:${COR.ardosia}`)}
        ${linhas}
        ${t.selo(COR.ardosia)}`;
    },
  },
  {
    id: 'pausa',
    nome: 'Pausa',
    desc: 'Só imagem, sangrando. Legenda opcional no pé.',
    slots: { a: 'Imagem' },
    exemplo: { legR: '', legT: '' },
    render(t) {
      return `${t.img('a', 0, 0, LARG, ALT, { rotulo: 'Imagem inteira' })}
        ${t.veuTopo()}${t.veuBase()}
        ${t.cabecalho(COR.branco)}
        ${t.legenda(COR.branco)}
        ${t.selo(COR.branco)}`;
    },
  },
  {
    id: 'titulo-imagem',
    nome: 'Título + imagem',
    desc: 'Imagem no alto, título e texto sobre papel.',
    slots: { a: 'Imagem superior' },
    exemplo: {
      titulo: 'A vista atravessa a casa.',
      texto: 'Antes restrito à varanda, o mar passa a fazer parte da sala e do jantar.',
    },
    render(t) {
      return `${t.painel(0, 0, LARG, ALT, t.n.fundo)}
        ${t.img('a', 0, 0, LARG, 720, { rotulo: 'Imagem superior' })}
        ${t.veuTopo()}${t.cabecalho(COR.branco)}
        <div class="fluxo" style="${pos(M, 780, W(1, 12), 540)}color:${COR.ardosia}">
          ${t.campo('titulo', 't-titulo', 'margin-bottom:28px', { fit: [88, 112, 360] })}
          ${t.campo('texto', 't-texto', `max-width:${W(1, 10)}px`)}
        </div>
        ${t.selo(COR.ardosia)}`;
    },
  },
  {
    id: 'citacao',
    nome: 'Citação',
    desc: 'Só painel e texto. Selecione palavras e use Ctrl+B para destacar.',
    slots: {},
    exemplo: {
      rotulo: 'O horror',
      citacao: 'O <b>horror</b> está em nunca saber o que esperar deste cenário antinatural, em não saber o que vem a seguir ou de estar <b>preso</b> em um contínuo sem propósito.',
      fonte: '',
    },
    render(t) {
      const fundo = t.n.painel, cor = t.tinta(fundo);
      return `${t.painel(0, 0, LARG, ALT, fundo)}
        ${t.cabecalho(cor)}
        ${t.campo('rotulo', 't-rotulo', `position:absolute;${pos(M, 130)}color:${cor}`)}
        <div class="fluxo meio" style="${pos(M, 180, W(1, 12), 1080)}color:${cor}">
          ${t.campo('citacao', 't-citacao', '', { fit: [44, 60, 900] })}
          ${t.campo('fonte', 't-legenda', `margin:36px 0 0 ${X(5) - M}px`, { ph: 'Fonte ou autoria (opcional)' })}
        </div>
        ${t.selo(cor)}`;
    },
  },
  {
    id: 'desenho',
    nome: 'Desenho técnico',
    desc: 'Desenho ou diagrama inteiro sobre papel, com rótulo e texto curto.',
    slots: { a: 'Desenho (PNG/SVG)' },
    exemplo: {
      rotulo: 'Geometria',
      texto: 'A seção gira em torno do eixo vertical à medida que sobe, formando sulcos helicoidais contínuos da base à borda.',
      cota: '',
    },
    render(t) {
      return `${t.painel(0, 0, LARG, ALT, t.n.fundo)}
        ${t.cabecalho(COR.ardosia)}
        <div class="fluxo" style="${pos(M, 130, W(1, 7), 300)}color:${COR.ardosia}">
          ${t.campo('rotulo', 't-rotulo', 'margin-bottom:12px')}
          ${t.campo('texto', 't-legenda')}
        </div>
        ${t.img('a', M, 420, W(1, 12), 860, { contain: true, rotulo: 'Desenho técnico' })}
        ${t.campo('cota', 't-rotulo', `position:absolute;right:${M}px;top:1290px;color:${COR.ardosia}`, { ph: 'Escala / cota (opcional)' })}
        ${t.selo(COR.ardosia)}`;
    },
  },
  {
    id: 'ficha',
    nome: 'Ficha técnica',
    desc: 'Título e até seis linhas de rótulo + valor.',
    slots: {},
    exemplo: {
      titulo: 'Ficha técnica.',
      f1r: 'Projeto', f1v: 'Apartamento RP 201',
      f2r: 'Escritório', f2v: 'Odisse, Estúdio de Arquitetura e Design',
      f3r: 'Tipo', f3v: 'Projeto de interiores',
      f4r: 'Programa', f4v: 'Sala, jantar, cozinha e varanda integrados',
      f5r: 'Área', f5v: '142 m²',
      f6r: 'Local', f6v: 'João Pessoa, PB',
    },
    render(t) {
      const fundo = t.n.id === 'arquitetos' ? COR.ardosia : t.n.painel;
      const cor = t.tinta(fundo);
      return `${t.painel(0, 0, LARG, ALT, fundo)}
        ${t.cabecalho(cor)}
        <div class="fluxo" style="${pos(M, 130, W(1, 12), 1150)}color:${cor}">
          ${t.campo('titulo', 't-titulo', 'margin-bottom:auto', { fit: [88, 112, 260] })}
          ${t.ficha('f', 6, cor, regraSobre(fundo))}
        </div>
        ${t.selo(cor)}`;
    },
  },
  {
    id: 'imagem-coluna',
    nome: 'Imagem + coluna',
    desc: 'Corte vertical 8 | 4: imagem à esquerda, coluna estreita de texto.',
    slots: { a: 'Imagem (colunas 1–8)' },
    exemplo: {
      rotulo: 'Dante',
      texto: 'O <b>Purgatório</b> descrito por Dante na Divina Comédia é um exemplo de espaço liminar.',
    },
    render(t) {
      const fundo = t.n.painel;
      const cor = t.tinta(fundo);
      return `${t.painel(0, 0, LARG, ALT, t.n.fundo)}
        ${t.painel(CORTE_V + CORTE / 2, 0, LARG - CORTE_V - CORTE / 2, ALT, fundo)}
        ${t.img('a', 0, 0, CORTE_V - CORTE / 2, ALT, { rotulo: 'Imagem 1–8' })}
        <div class="bloco" style="${pos(0, 0, CORTE_V - CORTE / 2, 200)}background:linear-gradient(${hexA(t.n.veu, 0.6)},${hexA(t.n.veu, 0)})"></div>
        <div class="bloco" style="${pos(0, ALT - 340, CORTE_V - CORTE / 2, 340)}background:linear-gradient(${hexA(t.n.veu, 0)},${hexA(t.n.veu, 0.72)})"></div>
        ${t.cabecalho(COR.branco, cor)}
        <div class="fluxo" style="${pos(X(9) + 6, 130, W(9, 12) - 6, 1150)}color:${cor}">
          ${t.campo('rotulo', 't-rotulo', 'margin-bottom:12px')}
          ${t.campo('texto', 't-texto')}
        </div>
        ${t.selo(COR.branco)}`;
    },
  },
  {
    id: 'duas-imagens',
    nome: 'Duas imagens',
    desc: 'Corte horizontal: duas imagens empilhadas.',
    slots: { a: 'Imagem superior', b: 'Imagem inferior' },
    exemplo: { legR: '', legT: '' },
    render(t) {
      const meio = 716;
      return `${t.painel(0, 0, LARG, ALT, t.n.fundo)}
        ${t.img('a', 0, 0, LARG, meio, { rotulo: 'Imagem superior' })}
        ${t.img('b', 0, meio + CORTE, LARG, ALT - meio - CORTE, { rotulo: 'Imagem inferior' })}
        ${t.veuTopo()}${t.veuBase()}
        ${t.cabecalho(COR.branco)}
        ${t.legenda(COR.branco)}
        ${t.selo(COR.branco)}`;
    },
  },
  {
    id: 'fechamento',
    nome: 'Fechamento',
    desc: 'Chamada direta e contatos (vêm das informações padrão).',
    slots: { a: 'Imagem lateral (opcional)' },
    exemplo: { rotulo: 'Contato' },
    render(t) {
      const g = t.g;
      const contatos = [
        t.global('site', 't-legenda'),
        t.global('telefone', 't-legenda'),
        t.global('email', 't-legenda'),
      ].join('');
      return `${t.painel(0, 0, LARG, ALT, t.n.fundo)}
        ${t.cabecalho(COR.ardosia)}
        ${t.img('a', 0, 520, X(5) - 8 - 8, 620, { rotulo: 'Opcional', opcional: true })}
        <div class="fluxo" style="${pos(X(5), 520, W(5, 12), 760)}color:${COR.ardosia}">
          ${t.campo('rotulo', 't-rotulo', 'margin-bottom:18px')}
          ${t.global('contatoTitulo', 't-titulo t-titulo-m', 'margin-bottom:24px')}
          ${t.global('contatoTexto', 't-texto', 'margin-bottom:48px')}
          <div class="contatos">${contatos}</div>
          <div class="lockup" style="margin-top:auto">${mark(t.n.selo === 'sol' ? 'sol' : 'mao', 60)}${mark(t.n.logo, t.n.logo === 'elaia' ? 34 : 30)}</div>
        </div>`;
    },
  },
  {
    id: 'unico',
    nome: 'Post único',
    desc: 'Aviso em post único: rótulo, título, texto e ficha curta. Selo da mão.',
    unico: true,
    slots: {},
    exemplo: {
      rotulo: 'Casacor Paraíba 2023',
      titulo: 'Melhor uso de materiais inovadores.',
      texto: 'O Odisse recebeu o prêmio na edição 2023 da mostra.',
      f1r: 'Mostra', f1v: 'CASACOR Paraíba',
      f2r: 'Ano', f2v: '2023',
      f3r: 'Estúdio', f3v: 'Odisse Arquitetura & Design',
    },
    render(t) {
      const fundo = t.n.id === 'estudio' ? t.n.fundo : t.n.painel;
      const cor = t.tinta(fundo);
      return `${t.painel(0, 0, LARG, ALT, fundo)}
        ${t.cabecalho(cor)}
        <div class="fluxo" style="${pos(M, 480, W(1, 12), 800)}color:${cor}">
          ${t.campo('rotulo', 't-rotulo', 'margin-bottom:18px')}
          ${t.campo('titulo', 't-titulo', 'margin-bottom:30px', { fit: [88, 124, 400] })}
          ${t.campo('texto', 't-texto', `margin-left:${X(5) - M}px;margin-bottom:auto`)}
          ${t.ficha('f', 3, cor, regraSobre(fundo))}
        </div>
        ${t.selo(cor)}`;
    },
  },
  {
    id: 'unico-imagem',
    nome: 'Post único com imagem',
    desc: 'Lançamento ou novidade: imagem no alto e painel com chamada.',
    unico: true,
    slots: { a: 'Imagem superior' },
    exemplo: {
      rotulo: 'Agenda aberta',
      titulo: 'Agenda aberta para 2027.',
      texto: 'Projetos de arquitetura e interiores, com atendimento em todo o Brasil.',
      link: 'projetos.odisse.com.br',
    },
    render(t) {
      const fundo = t.n.painel, cor = t.tinta(fundo);
      return `${t.painel(0, 0, LARG, ALT, fundo)}
        ${t.img('a', 0, 0, LARG, 800, { rotulo: 'Imagem superior' })}
        ${t.veuTopo()}${t.cabecalho(COR.branco)}
        <div class="fluxo" style="${pos(M, 860, W(1, 12), 420)}color:${cor}">
          ${t.campo('rotulo', 't-rotulo', 'margin-bottom:18px')}
          ${t.campo('titulo', 't-titulo', 'margin-bottom:26px', { fit: [88, 120, 200] })}
          ${t.campo('texto', 't-texto', `margin-left:${X(5) - M}px;margin-bottom:auto`)}
          ${t.campo('link', 't-rotulo', `margin-left:${X(5) - M}px`)}
        </div>
        ${t.selo(cor)}`;
    },
  },
];

export const MODELO = Object.fromEntries(MODELOS.map((m) => [m.id, m]));

/** Renderiza o miolo de um card (1080 × 1440) como HTML. */
export function renderCard(opc) {
  const modelo = MODELO[opc.card.modelo] || MODELOS[0];
  const t = criarContexto({ ...opc, modelo });
  return modelo.render(t);
}

/** Exemplo do modelo ajustado ao núcleo. */
export function exemploDe(modeloId, nucleoId) {
  return { ...(MODELO[modeloId]?.exemplo || {}), ...(EXEMPLOS[nucleoId]?.[modeloId] || {}) };
}

/** Campos de exemplo para um card novo. */
export function camposIniciais(modeloId, nucleoId) {
  return exemploDe(modeloId, nucleoId);
}

/** Ajusta o corpo dos títulos marcados com data-fit="min,max,alturaMax". */
export function ajustarTextos(raiz) {
  raiz.querySelectorAll('[data-fit]').forEach(ajustar);
}
export function ajustar(el) {
  const [min, max, alt] = el.dataset.fit.split(',').map(Number);
  let s = max;
  el.style.fontSize = s + 'px';
  while (s > min && el.scrollHeight > alt) {
    s -= 2;
    el.style.fontSize = s + 'px';
  }
}
