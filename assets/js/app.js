// Universo — editor de posts 3:4 do Odisse.

import { NUCLEOS, ORDEM_NUCLEOS, padroesDoNucleo, COR, tintaSobre } from './nucleos.js';
import { MODELOS, MODELO, renderCard, camposIniciais, exemploDe, ajustarTextos, ajustar, LARG, ALT } from './templates.js';
import { mark } from './marks.js';
import { lerArquivo, tratar } from './imaging.js';
import { ler, gravar } from './store.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);

// ---------------------------------------------------------------------------
// Estado

const SEQUENCIA_INICIAL = {
  estudio: ['capa', 'abertura', 'imagem-coluna', 'pausa', 'fechamento'],
  arquitetos: ['capa', 'tese', 'titulo-imagem', 'processo', 'ficha', 'fechamento'],
  objetos: ['capa', 'abertura', 'desenho', 'ficha', 'unico-imagem'],
  elaia: ['capa', 'tese', 'citacao', 'imagem-coluna', 'fechamento'],
};

function novoCard(modelo, nucleoId) {
  return { id: uid(), modelo, campos: camposIniciais(modelo, nucleoId), imgs: {} };
}
function novoDeck(id) {
  return { globais: padroesDoNucleo(id), cards: SEQUENCIA_INICIAL[id].map((m) => novoCard(m, id)), ativo: 0 };
}

let estado = {
  versao: 1,
  nucleo: 'estudio',
  modo: '3',
  decks: Object.fromEntries(ORDEM_NUCLEOS.map((id) => [id, novoDeck(id)])),
};

const deck = () => estado.decks[estado.nucleo];
const nucleo = () => NUCLEOS[estado.nucleo];
const cardAtivo = () => deck().cards[deck().ativo];

let timerSalvar;
function salvar() {
  $('#salvo').textContent = 'Salvando…';
  clearTimeout(timerSalvar);
  timerSalvar = setTimeout(async () => {
    await gravar('estado', estado);
    $('#salvo').textContent = 'Salvo neste navegador';
  }, 400);
}

function aviso(msg) {
  const el = $('#aviso');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => el.classList.remove('on'), 2600);
}

// ---------------------------------------------------------------------------
// Imagens tratadas (duotone/grão), em memória

const tratadas = new Map();
const chaveImg = (card, slot) => {
  const im = card.imgs[slot];
  return `${estado.nucleo}:${card.id}:${slot}:${im.src.length}:${im.src.slice(-24)}`;
};
let timerReTrilho;
function fonteImagem(card, slot) {
  const im = card.imgs[slot];
  const n = nucleo();
  if (!im?.src || im.original || n.tratamento.tipo === 'nenhum') return im?.src;
  const k = chaveImg(card, slot);
  if (tratadas.has(k)) {
    const v = tratadas.get(k);
    return typeof v === 'string' ? v : im.src;
  }
  tratadas.set(k, null);
  tratar(im.src, n.tratamento).then((out) => {
    tratadas.set(k, out);
    clearTimeout(timerReTrilho);
    timerReTrilho = setTimeout(() => { renderTrilho(); renderImagens(); }, 30);
  });
  return im.src;
}
async function aguardarTratamentos(cards) {
  const n = nucleo();
  if (n.tratamento.tipo === 'nenhum') return;
  const tarefas = [];
  for (const c of cards) for (const s of Object.keys(c.imgs)) {
    const im = c.imgs[s];
    if (!im?.src || im.original) continue;
    const k = chaveImg(c, s);
    if (typeof tratadas.get(k) !== 'string') {
      tarefas.push(tratar(im.src, n.tratamento).then((o) => tratadas.set(k, o)));
    }
  }
  await Promise.all(tarefas);
}

// ---------------------------------------------------------------------------
// Sanitização do texto editado: só negrito e quebra de linha.

function limparHtml(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  let out = '';
  const andar = (no) => {
    for (const c of no.childNodes) {
      if (c.nodeType === 3) out += c.textContent.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
      else if (c.nodeType === 1) {
        const tag = c.tagName;
        if (tag === 'BR') out += '<br>';
        else if (tag === 'B' || tag === 'STRONG') { out += '<b>'; andar(c); out += '</b>'; }
        else if (tag === 'DIV' || tag === 'P') { if (out && !out.endsWith('<br>')) out += '<br>'; andar(c); }
        else andar(c);
      }
    }
  };
  andar(tpl.content);
  out = out.replace(/(<br>)+$/, '');
  return out === '<br>' ? '' : out;
}

// ---------------------------------------------------------------------------
// Núcleos

function renderNucleos() {
  const el = $('#nucleos');
  el.innerHTML = ORDEM_NUCLEOS.map((id) => {
    const n = NUCLEOS[id];
    const fundo = n.painel;
    const cor = tintaSobre(fundo);
    const qtd = estado.decks[id].cards.length;
    return `<button class="nucleo ${id === estado.nucleo ? 'ativo' : ''}" data-nucleo="${id}" style="--cor-nucleo:${id === 'arquitetos' ? COR.ocre : n.painel === COR.pessego ? COR.ocre : n.painel}">
      <span class="chip" style="background:${fundo};color:${cor}">${mark(n.selo, 16)}</span>
      <span>Odisse ${n.nome}</span>
      <span class="qtd">${qtd}</span>
    </button>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Informações padrão (painel esquerdo)

const CAMPOS_GLOBAIS = [
  { grupo: 'Publicação', campos: [
    { k: 'tipo', tipo: 'seg', rot: 'Formato', opcoes: [['carrossel', 'Carrossel'], ['unico', 'Post único']] },
    { k: 'projeto', rot: 'Projeto, série ou autoria', dica: 'Cabeçalho à direita, antes do contador.' },
    { k: 'assunto', rot: 'Assunto', dica: 'Entra na assinatura da capa: "Núcleo · assunto".' },
    { k: 'aviso', rot: 'Aviso do post único', dica: 'Substitui o contador: Prêmio, Novo episódio, Lançamento…' },
    { k: 'dataPublicacao', rot: 'Data de publicação', tipo: 'date', dica: 'Usada no nome dos arquivos exportados.' },
    { k: 'contador', tipo: 'check', rot: 'Mostrar contador (03/08)' },
    { k: 'selo', tipo: 'check', rot: 'Mostrar selo no rodapé' },
  ] },
  { grupo: 'Fechamento e contatos', campos: [
    { k: 'contatoTitulo', rot: 'Chamada', area: true },
    { k: 'contatoTexto', rot: 'Texto de apoio', area: true },
    { k: 'site', rot: 'Site' },
    { k: 'telefone', rot: 'Telefone' },
    { k: 'email', rot: 'E-mail' },
  ] },
];

function renderGlobais() {
  const n = nucleo();
  const g = deck().globais;
  const cor = tintaSobre(n.painel);
  const amostra = (c) => `<span class="amostra" style="background:${c}"></span>`;
  let h = `<div class="registro">
    <div class="sel" style="background:${n.painel};color:${cor}">${mark(n.selo, 34)}</div>
    <dl>
      <dt>Painel</dt><dd>${amostra(n.painel)}${nomeCor(n.painel)}</dd>
      <dt>Véu</dt><dd>${amostra(n.veu)}${nomeCor(n.veu)}</dd>
      <dt>Imagem</dt><dd>${n.tratamentoNome}</dd>
      <dt>Selo</dt><dd>${{ roda: 'Roda', sol: 'Sol', flor: 'Flor', mao: 'Mão' }[n.selo]}</dd>
    </dl>
  </div>`;
  for (const grp of CAMPOS_GLOBAIS) {
    h += `<div class="grupo"><h3>${grp.grupo}</h3>`;
    for (const c of grp.campos) {
      if (c.tipo === 'seg') {
        h += `<div class="campo" data-campo-global="${c.k}"><span>${c.rot}</span><div class="seg2">${c.opcoes
          .map(([v, r]) => `<button type="button" data-k="${c.k}" data-v="${v}" class="${g[c.k] === v ? 'ativo' : ''}">${r}</button>`)
          .join('')}</div></div>`;
      } else if (c.tipo === 'check') {
        h += `<label class="check"><input type="checkbox" data-k="${c.k}" ${g[c.k] ? 'checked' : ''}> ${c.rot}</label>`;
      } else {
        const v = String(g[c.k] ?? '').replace(/"/g, '&quot;');
        const input = c.area
          ? `<textarea data-k="${c.k}" rows="2">${String(g[c.k] ?? '').replace(/</g, '&lt;')}</textarea>`
          : `<input type="${c.tipo || 'text'}" data-k="${c.k}" value="${v}">`;
        h += `<label class="campo" data-campo-global="${c.k}"><span>${c.rot}</span>${input}${c.dica ? `<small>${c.dica}</small>` : ''}</label>`;
      }
    }
    h += `</div>`;
  }
  $('#globais').innerHTML = h;
}
function nomeCor(hex) {
  return { [COR.ardosia]: 'Ardósia', [COR.areia]: 'Areia', [COR.grafite]: 'Grafite', [COR.pessego]: 'Pêssego', [COR.terra]: 'Terra', [COR.papel]: 'Papel' }[hex] || hex;
}

let timerGlobais;
function aoMudarGlobal(k, v) {
  deck().globais[k] = v;
  salvar();
  clearTimeout(timerGlobais);
  timerGlobais = setTimeout(() => { renderTrilho(); renderModelos(); }, 120);
}

// ---------------------------------------------------------------------------
// Modelos (painel direito)

function renderModelos() {
  const n = nucleo();
  const g = deck().globais;
  const atual = cardAtivo()?.modelo;
  const el = $('#modelos');
  el.innerHTML = MODELOS.map((m) => `
    <button class="modelo ${m.id === atual ? 'ativo' : ''}" data-modelo="${m.id}" title="${m.desc}">
      <div class="mini"><div class="card">${renderCard({
        card: { id: 'm-' + m.id, modelo: m.id, campos: exemploDe(m.id, n.id), imgs: {} },
        indice: 0, total: 8, nucleo: n, globais: g, modo: 'miniatura', fonteImagem,
      })}</div></div>
      ${m.unico ? '<span class="tag">Post único</span>' : ''}
      <b>${m.nome}</b>
      <small>${m.desc}</small>
    </button>`).join('');
  requestAnimationFrame(() => {
    $$('.modelo .mini', el).forEach((mini) => {
      const k = mini.clientWidth / LARG;
      const c = mini.firstElementChild;
      c.style.transform = `scale(${k})`;
      ajustarTextos(c);
    });
  });
}

function aplicarModelo(id) {
  const c = cardAtivo();
  if (!c || c.modelo === id) return;
  const ex = exemploDe(id, estado.nucleo);
  const exAntigo = exemploDe(c.modelo, estado.nucleo);
  const campos = {};
  // mantém o que já foi escrito (diferente do exemplo) quando o campo existe no novo modelo
  for (const k of Object.keys(ex)) {
    const escrito = c.campos[k] && c.campos[k] !== exAntigo[k];
    campos[k] = escrito ? c.campos[k] : ex[k];
  }
  c.modelo = id;
  c.campos = campos;
  salvar();
  renderTudo();
}

// ---------------------------------------------------------------------------
// Imagens do card selecionado (painel direito, abaixo dos modelos)

function renderImagens() {
  const c = cardAtivo();
  const el = $('#imagens');
  if (!c) { el.innerHTML = ''; return; }
  const m = MODELO[c.modelo];
  const slots = Object.entries(m.slots || {});
  const n = nucleo();
  let h = `<h3>Imagens do card</h3>`;
  if (!slots.length) {
    h += `<p class="vazio">Este modelo é só texto. Clique nos textos do card para editar.</p>`;
  }
  for (const [s, nome] of slots) {
    const im = c.imgs[s];
    if (!im?.src) {
      h += `<div class="img-item"><div class="img-topo"><div class="th"></div><div><b>${nome}</b><span>Vazio</span></div></div>
        <div class="img-acoes"><button data-acao="trocar" data-slot="${s}">Adicionar imagem</button></div></div>`;
      continue;
    }
    const th = fonteImagem(c, s);
    const trat = n.tratamento.tipo !== 'nenhum'
      ? `<button data-acao="tratada" data-slot="${s}" class="${!im.original ? 'ativo' : ''}">${n.tratamentoNome.split(',')[0]}</button>
         <button data-acao="original" data-slot="${s}" class="${im.original ? 'ativo' : ''}">Original</button>`
      : '';
    h += `<div class="img-item" data-slot="${s}">
      <div class="img-topo"><div class="th" style="background-image:url('${th}')"></div><div><b>${nome}</b><span>${im.w} × ${im.h}px</span></div></div>
      <div class="img-acoes">
        <button data-acao="trocar" data-slot="${s}">Trocar</button>
        <button data-acao="remover" data-slot="${s}">Remover</button>
        ${trat}
      </div>
      <label class="faixa">Zoom <input type="range" min="1" max="3" step="0.01" value="${im.z ?? 1}" data-faixa="z" data-slot="${s}"><output>${Math.round((im.z ?? 1) * 100)}%</output></label>
      <label class="faixa">Horiz. <input type="range" min="0" max="100" step="0.5" value="${im.x ?? 50}" data-faixa="x" data-slot="${s}"><output>${Math.round(im.x ?? 50)}</output></label>
      <label class="faixa">Vert. <input type="range" min="0" max="100" step="0.5" value="${im.y ?? 50}" data-faixa="y" data-slot="${s}"><output>${Math.round(im.y ?? 50)}</output></label>
    </div>`;
  }
  if (slots.length) h += `<p class="dica">Clique numa área vazia do card para adicionar, arraste um arquivo sobre ela ou arraste a imagem para reenquadrar.</p>`;
  el.innerHTML = h;
}

function atualizarImgNoCard(cardId, slot) {
  const c = deck().cards.find((x) => x.id === cardId);
  const im = c?.imgs[slot];
  const img = $(`.peca[data-id="${cardId}"] .slot[data-slot="${slot}"] img`);
  if (!im || !img) return;
  img.style.objectPosition = `${im.x}% ${im.y}%`;
  img.style.transformOrigin = `${im.x}% ${im.y}%`;
  img.style.transform = `scale(${im.z})`;
}

// ---------------------------------------------------------------------------
// Palco (canvas)

function indicesVisiveis() {
  const d = deck();
  const n = d.cards.length;
  if (estado.modo === '1') return [d.ativo];
  if (estado.modo === '3') return [d.ativo - 1, d.ativo, d.ativo + 1].map((i) => (i >= 0 && i < n ? i : null));
  return d.cards.map((_, i) => i);
}

const LATERAL = 0.6; // no modo 3, os vizinhos aparecem menores

function escala(qtd) {
  const wrap = $('#trilhoWrap');
  const W = wrap.clientWidth - 112;
  const H = wrap.clientHeight - 44 - 22;
  const gap = estado.modo === 'todos' ? 18 : 28;
  const kH = H / ALT;
  const unidades = estado.modo === '3' ? 1 + 2 * LATERAL : qtd;
  const kW = (W - 70 - gap * qtd) / (unidades * LARG);
  let k = Math.min(kH, kW);
  if (estado.modo === 'todos') k = Math.max(k, Math.min(kH, 0.17));
  return { k: Math.max(0.08, k), gap };
}

function renderTrilho() {
  const d = deck();
  const n = nucleo();
  const trilho = $('#trilho');
  const vis = indicesVisiveis();
  const { k, gap } = escala(vis.length);
  trilho.style.setProperty('--gap', gap + 'px');
  $('#trilhoWrap').classList.toggle('todos', estado.modo === 'todos');

  let h = '';
  for (const i of vis) {
    if (i === null) { h += `<div class="peca" style="width:${LARG * k * LATERAL}px"></div>`; continue; }
    const c = d.cards[i];
    const lateral = estado.modo === '3' && i !== d.ativo;
    const kk = lateral ? k * LATERAL : k;
    h += `<div class="peca ${i === d.ativo ? 'ativa' : ''} ${lateral ? 'lateral' : ''}" data-id="${c.id}" data-i="${i}">
      <span class="num">${String(i + 1).padStart(2, '0')} · ${MODELO[c.modelo]?.nome || ''}</span>
      <div class="moldura" style="--k:${kk}"><div class="card editar">${renderCard({
        card: c, indice: i, total: d.cards.length, nucleo: n, globais: d.globais, modo: 'editar', fonteImagem,
      })}</div></div>
    </div>`;
  }
  h += `<button class="mais" id="btMais" title="Adicionar card ${estado.modo === 'todos' ? 'no fim' : 'depois deste'}">+</button>`;
  trilho.innerHTML = h;
  ajustarTextos(trilho);

  const largura = vis.length * (LARG * k + gap) + 70;
  trilho.classList.toggle('rolavel', largura > trilho.clientWidth);
  if (estado.modo === 'todos') {
    const ativa = $('.peca.ativa', trilho);
    ativa?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  renderBarra();
}

function renderBarra() {
  const d = deck();
  const c = cardAtivo();
  $('#posicao').textContent = d.cards.length ? `Card ${d.ativo + 1} de ${d.cards.length}` : 'Nenhum card';
  $('#modeloAtual').textContent = c ? `· ${MODELO[c.modelo].nome}` : '';
  $('#btMoverEsq').disabled = d.ativo <= 0;
  $('#btMoverDir').disabled = d.ativo >= d.cards.length - 1;
  $('#btExcluir').disabled = d.cards.length <= 1;
  $('#navEsq').disabled = d.ativo <= 0;
  $('#navDir').disabled = d.ativo >= d.cards.length - 1;
  $$('#modos button').forEach((b) => b.classList.toggle('ativo', b.dataset.modo === estado.modo));
  $('#pontos').innerHTML = d.cards
    .map((_, i) => `<button data-ir="${i}" class="${i === d.ativo ? 'ativo' : ''}">${i + 1}</button>`)
    .join('');
}

function renderTudo() {
  renderNucleos();
  renderTrilho();
  renderModelos();
  renderImagens();
}

function irPara(i) {
  const d = deck();
  const novo = Math.max(0, Math.min(d.cards.length - 1, i));
  if (novo === d.ativo) return;
  d.ativo = novo;
  salvar();
  renderTrilho();
  $$('.modelo', $('#modelos')).forEach((b) => b.classList.toggle('ativo', b.dataset.modelo === cardAtivo().modelo));
  renderImagens();
}

function adicionarCard() {
  const d = deck();
  const ultimo = cardAtivo()?.modelo;
  // sugere um corte diferente do anterior (manual: nunca duas composições seguidas)
  const sugestao = ultimo === 'pausa' ? 'titulo-imagem' : ultimo === 'titulo-imagem' ? 'tese' : 'pausa';
  const c = novoCard(sugestao, estado.nucleo);
  const pos = estado.modo === 'todos' ? d.cards.length : d.ativo + 1;
  d.cards.splice(pos, 0, c);
  d.ativo = pos;
  salvar();
  renderTudo();
  aviso('Card adicionado. Escolha o modelo à direita.');
}

// ---------------------------------------------------------------------------
// Upload de imagens

let destinoUpload = null;
async function receberArquivo(file, cardId, slot) {
  if (!file || !file.type.startsWith('image/')) { aviso('Arquivo não é uma imagem.'); return; }
  const c = deck().cards.find((x) => x.id === cardId);
  if (!c) return;
  aviso('Carregando imagem…');
  const { src, w, h } = await lerArquivo(file);
  c.imgs[slot] = { src, w, h, x: 50, y: 50, z: 1, original: false };
  salvar();
  renderTrilho();
  renderImagens();
}
function abrirSeletor(cardId, slot) {
  destinoUpload = { cardId, slot };
  $('#arquivo').value = '';
  $('#arquivo').click();
}

// ---------------------------------------------------------------------------
// Exportação PNG 1080 × 1440

const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
function dataArquivo() {
  const v = deck().globais.dataPublicacao;
  const d = v ? new Date(v + 'T12:00:00') : new Date();
  return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
function nomeArquivo(i) {
  const g = deck().globais;
  return `${dataArquivo()}-${String(i + 1).padStart(3, '0')}-${nucleo().sigla}-${slug(g.projeto || g.assunto) || 'post'}.png`;
}

async function gerarPng(i) {
  const d = deck();
  const c = d.cards[i];
  const host = $('#exportador');
  host.innerHTML = `<div class="card">${renderCard({
    card: c, indice: i, total: d.cards.length, nucleo: nucleo(), globais: d.globais, modo: 'exportar', fonteImagem,
  })}</div>`;
  const no = host.firstElementChild;
  await document.fonts.ready;
  ajustarTextos(no);
  await Promise.all($$('img', no).map((im) => im.decode().catch(() => {})));
  const opc = { width: LARG, height: ALT, pixelRatio: 1, cacheBust: false, backgroundColor: COR.papel };
  await window.htmlToImage.toPng(no, opc); // 1ª passada carrega fontes no Safari/Chrome
  const url = await window.htmlToImage.toPng(no, opc);
  host.innerHTML = '';
  return url;
}

function baixar(url, nome) {
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function exportarCard() {
  const d = deck();
  aviso('Gerando PNG…');
  await aguardarTratamentos([cardAtivo()]);
  const url = await gerarPng(d.ativo);
  baixar(url, nomeArquivo(d.ativo));
  aviso('PNG exportado em 1080 × 1440.');
}

async function exportarTudo() {
  const d = deck();
  aviso(`Gerando ${d.cards.length} cards…`);
  await aguardarTratamentos(d.cards);
  const zip = new window.JSZip();
  for (let i = 0; i < d.cards.length; i++) {
    const url = await gerarPng(i);
    zip.file(nomeArquivo(i), url.split(',')[1], { base64: true });
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const g = d.globais;
  const u = URL.createObjectURL(blob);
  baixar(u, `${dataArquivo()}-${nucleo().sigla}-${slug(g.projeto || g.assunto) || 'carrossel'}.zip`);
  setTimeout(() => URL.revokeObjectURL(u), 4000);
  aviso('Carrossel exportado (.zip).');
}

// ---------------------------------------------------------------------------
// Eventos

function ligarEventos() {
  $('#nucleos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-nucleo]');
    if (!b || b.dataset.nucleo === estado.nucleo) return;
    estado.nucleo = b.dataset.nucleo;
    salvar();
    renderGlobais();
    renderTudo();
  });

  // Informações padrão
  const glob = $('#globais');
  glob.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    aoMudarGlobal(k, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
  });
  glob.addEventListener('click', (e) => {
    const b = e.target.closest('.seg2 button');
    if (!b) return;
    aoMudarGlobal(b.dataset.k, b.dataset.v);
    $$('button', b.parentElement).forEach((x) => x.classList.toggle('ativo', x === b));
  });

  // Modelos
  $('#modelos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-modelo]');
    if (b) aplicarModelo(b.dataset.modelo);
  });

  // Painel de imagens
  const imgs = $('#imagens');
  imgs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const c = cardAtivo();
    const s = b.dataset.slot;
    if (b.dataset.acao === 'trocar') abrirSeletor(c.id, s);
    if (b.dataset.acao === 'remover') { delete c.imgs[s]; salvar(); renderTrilho(); renderImagens(); }
    if (b.dataset.acao === 'original') { c.imgs[s].original = true; salvar(); renderTrilho(); renderImagens(); }
    if (b.dataset.acao === 'tratada') { c.imgs[s].original = false; salvar(); renderTrilho(); renderImagens(); }
  });
  imgs.addEventListener('input', (e) => {
    const f = e.target.dataset.faixa;
    if (!f) return;
    const c = cardAtivo();
    const im = c.imgs[e.target.dataset.slot];
    im[f] = Number(e.target.value);
    e.target.nextElementSibling.textContent = f === 'z' ? Math.round(im.z * 100) + '%' : Math.round(im[f]);
    atualizarImgNoCard(c.id, e.target.dataset.slot);
    salvar();
  });

  // Barra
  $('#modos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-modo]');
    if (!b) return;
    estado.modo = b.dataset.modo;
    salvar();
    renderTrilho();
  });
  $('#btMoverEsq').onclick = () => mover(-1);
  $('#btMoverDir').onclick = () => mover(1);
  $('#btDuplicar').onclick = () => {
    const d = deck();
    const c = structuredClone(cardAtivo());
    c.id = uid();
    d.cards.splice(d.ativo + 1, 0, c);
    d.ativo += 1;
    salvar();
    renderTudo();
  };
  $('#btExcluir').onclick = () => {
    const d = deck();
    if (d.cards.length <= 1) return;
    if (!confirmarExclusao()) return;
    d.cards.splice(d.ativo, 1);
    d.ativo = Math.min(d.ativo, d.cards.length - 1);
    salvar();
    renderTudo();
  };
  $('#btExportarCard').onclick = () => exportarCard().catch(erroExport);
  $('#btExportarTudo').onclick = () => exportarTudo().catch(erroExport);
  $('#navEsq').onclick = () => irPara(deck().ativo - 1);
  $('#navDir').onclick = () => irPara(deck().ativo + 1);
  $('#pontos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ir]');
    if (b) irPara(Number(b.dataset.ir));
  });

  // Trilho: seleção, texto, imagens
  const trilho = $('#trilho');
  trilho.addEventListener('click', (e) => {
    if (e.target.closest('#btMais')) { adicionarCard(); return; }
    const peca = e.target.closest('.peca[data-i]');
    if (!peca) return;
    const i = Number(peca.dataset.i);
    if (i !== deck().ativo) { irPara(i); return; }
    const g = e.target.closest('[data-global]');
    if (g) { focarGlobal(g.dataset.global); return; }
    const vazio = e.target.closest('.slot[data-vazio]');
    if (vazio) abrirSeletor(peca.dataset.id, vazio.dataset.slot);
  });
  trilho.addEventListener('dblclick', (e) => {
    const slot = e.target.closest('.slot:not([data-vazio])');
    const peca = e.target.closest('.peca.ativa');
    if (slot && peca) abrirSeletor(peca.dataset.id, slot.dataset.slot);
  });
  trilho.addEventListener('input', (e) => {
    const el = e.target.closest('[data-campo]');
    if (!el) return;
    const c = cardAtivo();
    c.campos[el.dataset.campo] = limparHtml(el.innerHTML);
    if (el.dataset.fit) ajustar(el);
    salvar();
  });
  trilho.addEventListener('focusout', (e) => {
    const el = e.target.closest('[data-campo]');
    if (el && !el.textContent.trim()) el.innerHTML = '';
  });
  trilho.addEventListener('keydown', (e) => {
    const el = e.target.closest('[data-campo]');
    if (!el) return;
    if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); }
    if (e.key === 'Escape') el.blur();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); document.execCommand('bold'); }
  });
  trilho.addEventListener('paste', (e) => {
    if (!e.target.closest('[data-campo]')) return;
    e.preventDefault();
    const txt = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, txt);
  });

  // Arrastar para reenquadrar
  trilho.addEventListener('pointerdown', (e) => {
    const slot = e.target.closest('.peca.ativa .slot:not([data-vazio])');
    if (!slot || e.button !== 0) return;
    const peca = slot.closest('.peca');
    const c = deck().cards.find((x) => x.id === peca.dataset.id);
    const im = c.imgs[slot.dataset.slot];
    const k = parseFloat(slot.closest('.moldura').style.getPropertyValue('--k'));
    const bw = slot.offsetWidth, bh = slot.offsetHeight;
    const cobre = Math.max(bw / im.w, bh / im.h);
    const sobraX = Math.max(1, im.w * cobre * im.z - bw);
    const sobraY = Math.max(1, im.h * cobre * im.z - bh);
    const x0 = e.clientX, y0 = e.clientY, ox = im.x, oy = im.y;
    slot.setPointerCapture(e.pointerId);
    e.preventDefault();
    const mov = (ev) => {
      im.x = Math.max(0, Math.min(100, ox - ((ev.clientX - x0) / k / sobraX) * 100));
      im.y = Math.max(0, Math.min(100, oy - ((ev.clientY - y0) / k / sobraY) * 100));
      atualizarImgNoCard(c.id, slot.dataset.slot);
    };
    const fim = () => {
      slot.removeEventListener('pointermove', mov);
      slot.removeEventListener('pointerup', fim);
      salvar();
      renderImagens();
    };
    slot.addEventListener('pointermove', mov);
    slot.addEventListener('pointerup', fim);
  });

  // Soltar arquivos sobre as áreas de imagem
  trilho.addEventListener('dragover', (e) => {
    const slot = e.target.closest('.peca.ativa .slot');
    if (!slot) return;
    e.preventDefault();
    $$('.slot.alvo').forEach((s) => s !== slot && s.classList.remove('alvo'));
    slot.classList.add('alvo');
  });
  trilho.addEventListener('dragleave', (e) => e.target.closest?.('.slot')?.classList.remove('alvo'));
  trilho.addEventListener('drop', (e) => {
    const slot = e.target.closest('.peca.ativa .slot');
    document.body.classList.remove('arrastando');
    if (!slot) return;
    e.preventDefault();
    slot.classList.remove('alvo');
    const f = e.dataTransfer.files[0];
    receberArquivo(f, slot.closest('.peca').dataset.id, slot.dataset.slot);
  });
  window.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) document.body.classList.add('arrastando'); });
  window.addEventListener('dragend', () => document.body.classList.remove('arrastando'));
  window.addEventListener('drop', (e) => { document.body.classList.remove('arrastando'); if (!e.target.closest('.slot')) e.preventDefault(); });
  window.addEventListener('dragover', (e) => e.preventDefault());

  $('#arquivo').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f && destinoUpload) receberArquivo(f, destinoUpload.cardId, destinoUpload.slot);
  });

  // Teclado
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, [contenteditable]')) return;
    if (e.key === 'ArrowLeft') irPara(deck().ativo - 1);
    if (e.key === 'ArrowRight') irPara(deck().ativo + 1);
  });

  new ResizeObserver(() => renderTrilho()).observe($('#trilhoWrap'));
}

function mover(delta) {
  const d = deck();
  const j = d.ativo + delta;
  if (j < 0 || j >= d.cards.length) return;
  [d.cards[d.ativo], d.cards[j]] = [d.cards[j], d.cards[d.ativo]];
  d.ativo = j;
  salvar();
  renderTrilho();
}

function confirmarExclusao() {
  const b = $('#btExcluir');
  if (b.dataset.confirmar) { delete b.dataset.confirmar; b.textContent = 'Excluir'; return true; }
  b.dataset.confirmar = '1';
  b.textContent = 'Confirmar?';
  setTimeout(() => { delete b.dataset.confirmar; b.textContent = 'Excluir'; }, 2500);
  return false;
}

function focarGlobal(k) {
  const alvo = $(`#globais [data-campo-global="${k}"]`);
  if (!alvo) return;
  alvo.scrollIntoView({ block: 'center', behavior: 'smooth' });
  alvo.classList.remove('pisca');
  void alvo.offsetWidth;
  alvo.classList.add('pisca');
  alvo.querySelector('input, textarea')?.focus();
}

function erroExport(err) {
  console.error(err);
  aviso('Não foi possível exportar. Abra o editor por um servidor (veja o README).');
}

// ---------------------------------------------------------------------------
// Início

async function iniciar() {
  $('#marcaSelo').innerHTML = mark('mao', 24);
  const salvo = await ler('estado');
  if (salvo?.versao === 1) {
    estado = salvo;
    for (const id of ORDEM_NUCLEOS) {
      estado.decks[id] ||= novoDeck(id);
      estado.decks[id].globais = { ...padroesDoNucleo(id), ...estado.decks[id].globais };
    }
  }
  await document.fonts.load('700 112px Inter').catch(() => {});
  await document.fonts.ready;
  renderGlobais();
  renderTudo();
  ligarEventos();
}

iniciar();
