// Universo — posts 3:4 do Odisse.
// Duas vistas: início (criar + arquivo) e editor de uma publicação.

import { NUCLEOS, ORDEM_NUCLEOS, padroesDoNucleo, COR, tintaSobre } from './nucleos.js';
import {
  modelosDo, modeloDe, SEQUENCIAS, GRUPOS, grupoDe, renderCard, exemploDe, ajustarLayout, ajustar, crescer, seguir, LARG, ALT,
} from './templates.js';
import { mark } from './marks.js';
import { lerArquivo, tratar } from './imaging.js';
import * as local from './store.js';
import * as nuvem from './nuvem.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const VERSAO = 3;

// ---------------------------------------------------------------------------
// Preferências de interface (por navegador)

const prefs = (() => {
  let p = {};
  try { p = JSON.parse(localStorage.getItem('universo-prefs') || '{}'); } catch { /* sem storage */ }
  return {
    get: (k, d) => (k in p ? p[k] : d),
    set: (k, v) => { p[k] = v; try { localStorage.setItem('universo-prefs', JSON.stringify(p)); } catch { /* */ } },
  };
})();

// ---------------------------------------------------------------------------
// Estado

let pub = null;          // publicação aberta no editor
let resumos = [];        // arquivo (local + nuvem)
let modo = prefs.get('modo', '3');
const imagens = new Map(); // ref → dataURL original

const nucleo = () => NUCLEOS[pub.nucleo];
const cardAtivo = () => pub?.cards[pub.ativo];

function novoCard(modelo, nucleoId) {
  return { id: uid('c'), modelo, campos: exemploDe(nucleoId, modelo), imgs: {} };
}

async function novaPublicacao(nucleoId) {
  const ultimos = (await local.lerMeta('globais:' + nucleoId)) || {};
  const agora = new Date().toISOString();
  return {
    id: uid('p'),
    versao: VERSAO,
    nucleo: nucleoId,
    titulo: '',
    globais: { ...padroesDoNucleo(nucleoId), ...ultimos, dataPublicacao: '' },
    cards: SEQUENCIAS[nucleoId].map((m) => novoCard(m, nucleoId)),
    ativo: 0,
    criado: agora,
    atualizado: agora,
    capa: '',
  };
}

const tituloDe = (p) => p.titulo || p.globais?.projeto || 'Sem título';

// ---------------------------------------------------------------------------
// Salvamento: local imediato, nuvem com atraso

let timerLocal, timerNuvem, sujoNuvem = false;
function salvar() {
  if (!pub) return;
  pub.atualizado = new Date().toISOString();
  status('salvando');
  clearTimeout(timerLocal);
  timerLocal = setTimeout(async () => {
    await local.gravarPub(pub);
    await local.gravarMeta('globais:' + pub.nucleo, pub.globais);
    if (!nuvem.ativa()) status('local');
  }, 350);
  if (nuvem.ativa()) {
    sujoNuvem = true;
    clearTimeout(timerNuvem);
    timerNuvem = setTimeout(sincronizarPub, 3500);
  }
}

async function sincronizarPub() {
  if (!pub || !nuvem.ativa() || !sujoNuvem) return;
  sujoNuvem = false;
  const alvo = pub;
  status('enviando');
  try {
    alvo.capa = await gerarCapa(alvo).catch(() => alvo.capa);
    await local.gravarPub(alvo);
    for (const ref of local.refsDe(alvo)) await garantirImagemNaNuvem(ref);
    await nuvem.gravar(alvo);
    status('nuvem');
  } catch (e) {
    console.warn(e);
    sujoNuvem = true;
    status('erro', e.message);
  }
}

const enviadas = new Set();
async function garantirImagemNaNuvem(ref) {
  if (enviadas.has(ref)) return;
  const src = imagens.get(ref) || (await local.lerImg(ref));
  if (!src) return;
  if (!(await nuvem.existeImg(ref))) await nuvem.enviarImg(ref, src);
  enviadas.add(ref);
}

function status(tipo, detalhe = '') {
  const b = $('#sinc');
  b.dataset.estado = tipo;
  $('#sincTxt').textContent = {
    salvando: 'Salvando…',
    enviando: 'Sincronizando…',
    local: 'Salvo neste navegador',
    nuvem: 'Salvo na nuvem',
    erro: 'Erro ao sincronizar',
  }[tipo] || tipo;
  b.title = tipo === 'erro' ? `Não foi possível salvar na nuvem (${detalhe}). As alterações continuam salvas neste navegador.` : 'Armazenamento';
}

function aviso(msg) {
  const el = $('#aviso');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => el.classList.remove('on'), 2600);
}

// ---------------------------------------------------------------------------
// Imagens: originais em memória/IndexedDB/nuvem; tratadas só em memória

async function carregarImagens(p) {
  const faltando = [];
  for (const ref of local.refsDe(p)) {
    if (imagens.has(ref)) continue;
    const src = await local.lerImg(ref);
    if (src) imagens.set(ref, src);
    else faltando.push(ref);
  }
  if (faltando.length && nuvem.ativa()) {
    await Promise.all(faltando.map(async (ref) => {
      try {
        const src = await nuvem.baixarImg(ref);
        imagens.set(ref, src);
        await local.gravarImg(ref, src);
        enviadas.add(ref);
      } catch (e) { console.warn('imagem não encontrada', ref, e); }
    }));
  }
}

const tratadas = new Map();
let timerReTrilho;
function fonteImagem(card, slot) {
  const im = card.imgs[slot];
  const src = im?.ref ? imagens.get(im.ref) : im?.src;
  if (!src) return null;
  const trat = NUCLEOS[pub?.nucleo || 'estudio'].tratamento;
  if (im.original || trat.tipo === 'nenhum') return src;
  const k = `${pub.nucleo}:${im.ref || card.id + slot}`;
  if (typeof tratadas.get(k) === 'string') return tratadas.get(k);
  if (!tratadas.has(k)) {
    tratadas.set(k, null);
    tratar(src, trat).then((out) => {
      tratadas.set(k, out);
      clearTimeout(timerReTrilho);
      timerReTrilho = setTimeout(() => { if (pub) { renderTrilho(); renderImagens(); } }, 30);
    });
  }
  return src;
}
async function aguardarTratamentos(cards) {
  const trat = nucleo().tratamento;
  if (trat.tipo === 'nenhum') return;
  const tarefas = [];
  for (const c of cards) for (const s of Object.keys(c.imgs)) {
    const im = c.imgs[s];
    const src = im?.ref ? imagens.get(im.ref) : null;
    if (!src || im.original) continue;
    const k = `${pub.nucleo}:${im.ref}`;
    if (typeof tratadas.get(k) !== 'string') tarefas.push(tratar(src, trat).then((o) => tratadas.set(k, o)));
  }
  await Promise.all(tarefas);
}

// ---------------------------------------------------------------------------
// Texto editado: só negrito e quebra de linha

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

// ===========================================================================
// INÍCIO — criar e arquivo

let filtro = 'todos';

async function carregarArquivo() {
  const locais = await local.listarPubs();
  const mapa = new Map(locais.map((r) => [r.id, { ...r, origem: 'local' }]));
  if (nuvem.ativa()) {
    try {
      const remotos = await nuvem.listar();
      for (const r of remotos) {
        const l = mapa.get(r.id);
        if (!l || (r.atualizado || '') > (l.atualizado || '')) mapa.set(r.id, { ...r, origem: 'nuvem' });
      }
      status('nuvem');
    } catch (e) {
      status('erro', e.message);
    }
  }
  resumos = [...mapa.values()].sort((a, b) => (b.atualizado || '').localeCompare(a.atualizado || ''));
}

function renderInicio() {
  $('#tiles').innerHTML = ORDEM_NUCLEOS.map((id) => {
    const n = NUCLEOS[id];
    const cor = tintaSobre(n.painel);
    const qtd = resumos.filter((r) => r.nucleo === id).length;
    return `<button class="tile" data-criar="${id}" style="--painel:${n.painel};--tinta:${cor}">
      <span class="tile-selo">${mark(n.selo, 54)}</span>
      <span class="tile-txt"><b>Odisse ${n.nome}</b><small>${n.conteudo}</small></span>
      <span class="tile-mais">+ Criar</span>
      <span class="tile-qtd">${qtd} ${qtd === 1 ? 'publicação' : 'publicações'}</span>
    </button>`;
  }).join('');

  $('#filtros').innerHTML = [['todos', 'Todos'], ...ORDEM_NUCLEOS.map((id) => [id, NUCLEOS[id].nome])]
    .map(([v, r]) => `<button data-filtro="${v}" class="${filtro === v ? 'ativo' : ''}">${r}</button>`).join('');

  const busca = $('#busca').value.trim().toLowerCase();
  const lista = resumos.filter((r) => (filtro === 'todos' || r.nucleo === filtro) && (!busca || (r.titulo || '').toLowerCase().includes(busca)));
  $('#arquivoInfo').textContent = resumos.length
    ? `${resumos.length} ${resumos.length === 1 ? 'publicação' : 'publicações'}${nuvem.ativa() ? ' · na nuvem' : ' · neste navegador'}`
    : 'Nenhuma publicação ainda.';
  $('#avisoNuvem').hidden = nuvem.ativa();

  const data = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  $('#listaPubs').innerHTML = lista.length ? lista.map((r) => {
    const n = NUCLEOS[r.nucleo] || NUCLEOS.estudio;
    const capa = r.capa
      ? `<img src="${r.capa}" alt="">`
      : `<span class="sem-capa" style="background:${n.painel};color:${tintaSobre(n.painel)}">${mark(n.selo, 40)}</span>`;
    return `<article class="pub" data-id="${r.id}">
      <a class="pub-capa" href="#/p/${r.id}">${capa}</a>
      <div class="pub-info">
        <a href="#/p/${r.id}" class="pub-nome">${esc(r.titulo || 'Sem título')}</a>
        <span class="pub-meta"><i style="background:${n.painel}"></i>${n.nome} · ${r.ncards} cards</span>
        <span class="pub-data">${data(r.atualizado)}</span>
      </div>
      <div class="pub-acoes">
        <button data-dup="${r.id}" title="Duplicar">Duplicar</button>
        <button data-del="${r.id}" class="perigo" title="Excluir">Excluir</button>
      </div>
    </article>`;
  }).join('') : `<p class="vazio-arquivo">${resumos.length ? 'Nada encontrado com esse filtro.' : 'As publicações que você criar aparecem aqui.'}</p>`;
}

async function abrirPublicacao(id) {
  let p = await local.lerPub(id);
  const r = resumos.find((x) => x.id === id);
  if (nuvem.ativa() && (!p || (r && (r.atualizado || '') > (p.atualizado || '')))) {
    try {
      p = await nuvem.ler(id);
      await local.gravarPub(p);
    } catch (e) {
      if (!p) { aviso('Não foi possível abrir essa publicação.'); location.hash = '#/'; return; }
    }
  }
  if (!p) { aviso('Publicação não encontrada.'); location.hash = '#/'; return; }
  await carregarImagens(p);
  pub = p;
  pub.ativo = Math.min(pub.ativo || 0, pub.cards.length - 1);
  mostrar('editor');
  renderEditor();
}

async function duplicarPublicacao(id) {
  let p = await local.lerPub(id);
  if (!p && nuvem.ativa()) p = await nuvem.ler(id);
  if (!p) return;
  const agora = new Date().toISOString();
  const copia = { ...structuredClone(p), id: uid('p'), titulo: `${tituloDe(p)} (cópia)`, criado: agora, atualizado: agora };
  copia.cards.forEach((c) => { c.id = uid('c'); });
  await local.gravarPub(copia);
  if (nuvem.ativa()) nuvem.gravar(copia).catch(() => {});
  await carregarArquivo();
  renderInicio();
  aviso('Publicação duplicada.');
}

async function excluirPublicacao(id, botao) {
  if (!botao.dataset.confirmar) {
    botao.dataset.confirmar = '1';
    botao.textContent = 'Confirmar?';
    setTimeout(() => { delete botao.dataset.confirmar; botao.textContent = 'Excluir'; }, 2500);
    return;
  }
  await local.apagarPub(id);
  if (nuvem.ativa()) await nuvem.apagar(id).catch((e) => aviso('Excluída aqui, mas não na nuvem: ' + e.message));
  await carregarArquivo();
  renderInicio();
}

// ===========================================================================
// EDITOR

function renderEditor() {
  const n = nucleo();
  document.documentElement.style.setProperty('--cor-nucleo', n.painel === COR.pessego || n.painel === COR.areia ? COR.ocre : n.painel);
  $('#pubChip').innerHTML = mark(n.selo, 15);
  $('#pubChip').style.cssText = `background:${n.painel};color:${tintaSobre(n.painel)}`;
  $('#pubNucleo').textContent = `Odisse ${n.nome}`;
  $('#pubTitulo').value = pub.titulo || '';
  $('#pubTitulo').placeholder = pub.globais.projeto || 'Título da publicação';
  document.title = `${tituloDe(pub)} · Universo`;
  renderGlobais();
  renderTrilho();
  renderModelos();
  renderImagens();
}

// ---- Informações padrão ---------------------------------------------------

const CAMPOS_GLOBAIS = [
  { grupo: 'Publicação', campos: [
    { k: 'projeto', rot: 'Projeto, série ou autoria', dica: 'Cabeçalho à direita, antes do contador. Também nomeia os arquivos.' },
    { k: 'dataPublicacao', rot: 'Data de publicação', tipo: 'date', dica: 'Usada no nome dos arquivos exportados.' },
    { k: 'contador', tipo: 'check', rot: 'Mostrar contador (03/08)' },
    { k: 'selo', tipo: 'check', rot: 'Mostrar selo no rodapé' },
  ] },
  { grupo: 'Fechamento e contatos', fechamento: true, campos: [
    { k: 'contatoTitulo', rot: 'Chamada', area: true },
    { k: 'contatoTexto', rot: 'Texto de apoio', area: true },
    { k: 'site', rot: 'Site' },
    { k: 'telefone', rot: 'Telefone' },
    { k: 'email', rot: 'E-mail' },
  ] },
];

function renderGlobais() {
  const n = nucleo();
  const g = pub.globais;
  const cor = tintaSobre(n.painel);
  const nomeCor = (hex) => ({ [COR.ardosia]: 'Ardósia', [COR.areia]: 'Areia', [COR.grafite]: 'Grafite', [COR.pessego]: 'Pêssego', [COR.terra]: 'Terra', [COR.papel]: 'Papel' }[hex] || hex);
  const amostra = (c) => `<span class="amostra" style="background:${c}"></span>`;
  const temFechamento = modelosDo(n.id).some((m) => m.id === 'fechamento');
  let h = '';
  for (const grp of CAMPOS_GLOBAIS) {
    if (grp.fechamento && !temFechamento) continue;
    h += `<div class="grupo"><h3>${grp.grupo}</h3>`;
    for (const c of grp.campos) {
      if (c.tipo === 'check') {
        h += `<label class="check"><input type="checkbox" data-k="${c.k}" ${g[c.k] ? 'checked' : ''}> ${c.rot}</label>`;
      } else {
        const input = c.area
          ? `<textarea data-k="${c.k}" rows="2">${esc(g[c.k])}</textarea>`
          : `<input type="${c.tipo || 'text'}" data-k="${c.k}" value="${esc(g[c.k])}">`;
        h += `<label class="campo" data-campo-global="${c.k}"><span>${c.rot}</span>${input}${c.dica ? `<small>${c.dica}</small>` : ''}</label>`;
      }
    }
    h += `</div>`;
  }
  h += `<div class="grupo registro-grupo"><h3>Registro do núcleo</h3><div class="registro">
    <div class="sel" style="background:${n.painel};color:${cor}">${mark(n.selo, 34)}</div>
    <dl>
      <dt>Painel</dt><dd>${amostra(n.painel)}${nomeCor(n.painel)}</dd>
      <dt>Véu</dt><dd>${amostra(n.veu)}${nomeCor(n.veu)}</dd>
      <dt>Imagem</dt><dd>${n.tratamentoNome}</dd>
      <dt>Selo</dt><dd>${{ roda: 'Roda', sol: 'Sol', flor: 'Flor', mao: 'Mão' }[n.selo]}</dd>
    </dl>
  </div></div>`;
  $('#globais').innerHTML = h;
}

let timerGlobais;
function aoMudarGlobal(k, v) {
  pub.globais[k] = v;
  salvar();
  clearTimeout(timerGlobais);
  timerGlobais = setTimeout(() => {
    renderTrilho();
    renderModelos();
    $('#pubTitulo').placeholder = pub.globais.projeto || 'Título da publicação';
  }, 120);
}

// ---- Modelos, em grupos recolhíveis ----------------------------------------

function renderModelos() {
  const n = nucleo();
  const g = pub.globais;
  const atual = cardAtivo()?.modelo;
  const fechados = prefs.get('gruposFechados', []);
  const lista = modelosDo(n.id);
  $('#modelos').innerHTML = GRUPOS.map(([gid, gnome]) => {
    const itens = lista.filter((m) => grupoDe(m) === gid);
    if (!itens.length) return '';
    return `<details class="grupo-modelos" data-grupo="${gid}" ${fechados.includes(gid) ? '' : 'open'}>
      <summary><span>${gnome}</span><small>${itens.length}</small></summary>
      <div class="modelos">${itens.map((m) => `
        <button class="modelo ${m.id === atual ? 'ativo' : ''}" data-modelo="${m.id}" title="${esc(m.desc)}">
          <div class="mini"><div class="card">${renderCard({
            card: { id: 'm-' + m.id, modelo: m.id, campos: exemploDe(n.id, m.id), imgs: {} },
            indice: 0, total: 8, nucleo: n, globais: g, modo: 'miniatura', fonteImagem,
          })}</div></div>
          <b>${m.nome}</b>
          <small>${m.desc}</small>
        </button>`).join('')}</div>
    </details>`;
  }).join('');
  requestAnimationFrame(escalarMiniaturas);
}
function escalarMiniaturas() {
  $$('#modelos details[open] .mini').forEach((mini) => {
    const c = mini.firstElementChild;
    if (c.dataset.k) return;
    const k = mini.clientWidth / LARG;
    if (!k) return;
    c.style.transform = `scale(${k})`;
    c.dataset.k = k;
    ajustarLayout(c);
  });
}

function aplicarModelo(id) {
  const c = cardAtivo();
  if (!c || c.modelo === id) return;
  const ex = exemploDe(pub.nucleo, id);
  const exAntigo = exemploDe(pub.nucleo, c.modelo);
  const campos = {};
  for (const k of Object.keys(ex)) {
    const escrito = c.campos[k] && c.campos[k] !== exAntigo[k];
    campos[k] = escrito ? c.campos[k] : ex[k];
  }
  c.modelo = id;
  c.campos = campos;
  salvar();
  renderTrilho();
  $$('.modelo', $('#modelos')).forEach((b) => b.classList.toggle('ativo', b.dataset.modelo === id));
  renderImagens();
}

// ---- Imagens do card -------------------------------------------------------

function renderImagens() {
  const c = cardAtivo();
  const el = $('#imagens');
  if (!c) { el.innerHTML = ''; return; }
  const m = modeloDe(pub.nucleo, c.modelo);
  const slots = Object.entries(m.slots || {});
  const n = nucleo();
  let h = `<h3>Imagens do card</h3>`;
  if (!slots.length) h += `<p class="vazio">Este modelo é só texto. Clique nos textos do card para editar.</p>`;
  for (const [s, nome] of slots) {
    const im = c.imgs[s];
    const th = im ? fonteImagem(c, s) : null;
    if (!th) {
      h += `<div class="img-item"><div class="img-topo"><div class="th"></div><div><b>${nome}</b><span>Vazio</span></div></div>
        <div class="img-acoes"><button data-acao="trocar" data-slot="${s}">Adicionar imagem</button></div></div>`;
      continue;
    }
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
  const c = pub.cards.find((x) => x.id === cardId);
  const im = c?.imgs[slot];
  const img = $(`.peca[data-id="${cardId}"] .slot[data-slot="${slot}"] img`);
  if (!im || !img) return;
  img.style.objectPosition = `${im.x}% ${im.y}%`;
  img.style.transformOrigin = `${im.x}% ${im.y}%`;
  img.style.transform = `scale(${im.z})`;
}

// ---- Palco -----------------------------------------------------------------

const LATERAL = 0.6;

function indicesVisiveis() {
  const n = pub.cards.length;
  if (modo === '3') return [pub.ativo - 1, pub.ativo, pub.ativo + 1].map((i) => (i >= 0 && i < n ? i : null));
  return pub.cards.map((_, i) => i);
}

function escala(qtd) {
  const wrap = $('#trilhoWrap');
  const W = wrap.clientWidth - 112;
  const H = wrap.clientHeight - 44 - 22;
  const gap = modo === 'todos' ? 18 : 28;
  const kH = H / ALT;
  const unidades = modo === '3' ? 1 + 2 * LATERAL : qtd;
  const kW = (W - 70 - gap * qtd) / (unidades * LARG);
  let k = Math.min(kH, kW);
  if (modo === 'todos') k = Math.max(k, Math.min(kH, 0.17));
  return { k: Math.max(0.08, k), gap };
}

function renderTrilho() {
  if (!pub) return;
  const n = nucleo();
  const trilho = $('#trilho');
  const vis = indicesVisiveis();
  const { k, gap } = escala(vis.length);
  trilho.style.setProperty('--gap', gap + 'px');
  $('#trilhoWrap').classList.toggle('todos', modo === 'todos');

  let h = '';
  for (const i of vis) {
    if (i === null) { h += `<div class="peca" style="width:${LARG * k * LATERAL}px"></div>`; continue; }
    const c = pub.cards[i];
    const lateral = modo === '3' && i !== pub.ativo;
    const kk = lateral ? k * LATERAL : k;
    h += `<div class="peca ${i === pub.ativo ? 'ativa' : ''} ${lateral ? 'lateral' : ''}" data-id="${c.id}" data-i="${i}">
      <span class="num">${String(i + 1).padStart(2, '0')} · ${modeloDe(pub.nucleo, c.modelo)?.nome || ''}</span>
      <div class="moldura" style="--k:${kk}"><div class="card editar">${renderCard({
        card: c, indice: i, total: pub.cards.length, nucleo: n, globais: pub.globais, modo: 'editar', fonteImagem,
      })}</div></div>
    </div>`;
  }
  h += `<button class="mais" id="btMais" title="Adicionar card ${modo === 'todos' ? 'no fim' : 'depois deste'}">+</button>`;
  trilho.innerHTML = h;
  $$('.card', trilho).forEach(ajustarLayout);

  const largura = vis.length * (LARG * k + gap) + 70;
  trilho.classList.toggle('rolavel', largura > trilho.clientWidth);
  if (modo === 'todos') $('.peca.ativa', trilho)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  renderBarra();
}

/** Ações do card (setas, duplicar, excluir) centradas sobre o card em destaque. */
function posicionarAcoes() {
  const ativa = $('#trilho .peca.ativa .moldura');
  const grupo = $('#acoesCard');
  if (!ativa) return;
  const palco = $('#palco').getBoundingClientRect();
  const r = ativa.getBoundingClientRect();
  const meio = r.left + r.width / 2 - palco.left;
  const metade = grupo.offsetWidth / 2;
  grupo.style.left = Math.max(metade + 8, Math.min(palco.width - metade - 8, meio)) + 'px';
}

function renderBarra() {
  const c = cardAtivo();
  $('#posicao').textContent = `Card ${pub.ativo + 1} de ${pub.cards.length}`;
  $('#modeloAtual').textContent = c ? `· ${modeloDe(pub.nucleo, c.modelo).nome}` : '';
  $('#btMoverEsq').disabled = pub.ativo <= 0;
  $('#btMoverDir').disabled = pub.ativo >= pub.cards.length - 1;
  $('#btExcluir').disabled = pub.cards.length <= 1;
  $('#navEsq').disabled = pub.ativo <= 0;
  $('#navDir').disabled = pub.ativo >= pub.cards.length - 1;
  $$('#modos button').forEach((b) => b.classList.toggle('ativo', b.dataset.modo === modo));
  $('#pontos').innerHTML = pub.cards.map((_, i) => `<button data-ir="${i}" class="${i === pub.ativo ? 'ativo' : ''}">${i + 1}</button>`).join('');
  requestAnimationFrame(posicionarAcoes);
}

function irPara(i) {
  const novo = Math.max(0, Math.min(pub.cards.length - 1, i));
  if (novo === pub.ativo) return;
  pub.ativo = novo;
  salvar();
  renderTrilho();
  $$('.modelo', $('#modelos')).forEach((b) => b.classList.toggle('ativo', b.dataset.modelo === cardAtivo().modelo));
  renderImagens();
}

function adicionarCard() {
  const lista = modelosDo(pub.nucleo).filter((m) => grupoDe(m) === 'corpo');
  const i = lista.findIndex((m) => m.id === cardAtivo()?.modelo);
  const sugestao = lista[(i + 1) % lista.length].id;
  const c = novoCard(sugestao, pub.nucleo);
  const pos = modo === 'todos' ? pub.cards.length : pub.ativo + 1;
  pub.cards.splice(pos, 0, c);
  pub.ativo = pos;
  salvar();
  renderTrilho();
  renderModelos();
  renderImagens();
  aviso('Card adicionado. Escolha o modelo à direita.');
}

function mover(delta) {
  const j = pub.ativo + delta;
  if (j < 0 || j >= pub.cards.length) return;
  [pub.cards[pub.ativo], pub.cards[j]] = [pub.cards[j], pub.cards[pub.ativo]];
  pub.ativo = j;
  salvar();
  renderTrilho();
}

// ---- Upload ---------------------------------------------------------------

let destinoUpload = null;
async function receberArquivo(file, cardId, slot) {
  if (!file || !file.type.startsWith('image/')) { aviso('Arquivo não é uma imagem.'); return; }
  const c = pub.cards.find((x) => x.id === cardId);
  if (!c) return;
  aviso('Carregando imagem…');
  const { src, w, h } = await lerArquivo(file);
  const ref = uid('i');
  imagens.set(ref, src);
  await local.gravarImg(ref, src);
  c.imgs[slot] = { ref, w, h, x: 50, y: 50, z: 1, original: false };
  salvar();
  renderTrilho();
  renderImagens();
  if (nuvem.ativa()) garantirImagemNaNuvem(ref).catch(() => {});
}
function abrirSeletor(cardId, slot) {
  destinoUpload = { cardId, slot };
  $('#arquivo').value = '';
  $('#arquivo').click();
}

// ---- Exportação -------------------------------------------------------------

const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
function dataArquivo() {
  const v = pub.globais.dataPublicacao;
  const d = v ? new Date(v + 'T12:00:00') : new Date();
  return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
const nomeBase = () => slug(pub.titulo || pub.globais.projeto) || 'post';
const nomeArquivo = (i) => `${dataArquivo()}-${String(i + 1).padStart(3, '0')}-${nucleo().sigla}-${nomeBase()}.png`;

async function montarCard(p, i) {
  const host = $('#exportador');
  host.innerHTML = `<div class="card">${renderCard({
    card: p.cards[i], indice: i, total: p.cards.length, nucleo: NUCLEOS[p.nucleo], globais: p.globais, modo: 'exportar', fonteImagem,
  })}</div>`;
  const no = host.firstElementChild;
  await document.fonts.ready;
  ajustarLayout(no);
  await Promise.all($$('img', no).map((im) => im.decode().catch(() => {})));
  return no;
}

async function gerarPng(i) {
  const no = await montarCard(pub, i);
  const opc = { width: LARG, height: ALT, pixelRatio: 1, cacheBust: false, backgroundColor: COR.papel };
  await window.htmlToImage.toPng(no, opc);
  const url = await window.htmlToImage.toPng(no, opc);
  $('#exportador').innerHTML = '';
  return url;
}

async function gerarCapa(p) {
  if (!p.cards.length) return '';
  const no = await montarCard(p, 0);
  const url = await window.htmlToImage.toJpeg(no, { width: LARG, height: ALT, pixelRatio: 0.25, quality: 0.82, backgroundColor: COR.papel });
  $('#exportador').innerHTML = '';
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
  aviso('Gerando PNG…');
  await aguardarTratamentos([cardAtivo()]);
  baixar(await gerarPng(pub.ativo), nomeArquivo(pub.ativo));
  aviso('PNG exportado em 1080 × 1440.');
}

async function exportarTudo() {
  aviso(`Gerando ${pub.cards.length} cards…`);
  await aguardarTratamentos(pub.cards);
  const zip = new window.JSZip();
  for (let i = 0; i < pub.cards.length; i++) zip.file(nomeArquivo(i), (await gerarPng(i)).split(',')[1], { base64: true });
  const u = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
  baixar(u, `${dataArquivo()}-${nucleo().sigla}-${nomeBase()}.zip`);
  setTimeout(() => URL.revokeObjectURL(u), 4000);
  aviso('Carrossel exportado (.zip).');
}

// ===========================================================================
// Navegação

function mostrar(vista) {
  document.body.classList.toggle('vista-inicio', vista === 'inicio');
  document.body.classList.toggle('vista-editor', vista === 'editor');
}

async function sairDoEditor() {
  if (!pub) return;
  const saindo = pub;
  clearTimeout(timerLocal);
  try { saindo.capa = await gerarCapa(saindo); } catch { /* sem capa */ }
  await local.gravarPub(saindo);
  if (nuvem.ativa() && sujoNuvem) { clearTimeout(timerNuvem); await sincronizarPub(); }
  pub = null;
}

async function rotear() {
  const m = location.hash.match(/^#\/p\/(.+)$/);
  if (m) {
    if (pub?.id === m[1]) return;
    if (pub) await sairDoEditor();
    if (!resumos.length) await carregarArquivo();
    await abrirPublicacao(decodeURIComponent(m[1]));
  } else {
    if (pub) await sairDoEditor();
    document.title = 'Universo · Posts 3:4';
    mostrar('inicio');
    await carregarArquivo();
    renderInicio();
  }
}

// ===========================================================================
// Eventos

function ligarEventos() {
  window.addEventListener('hashchange', rotear);

  // Início
  $('#tiles').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-criar]');
    if (!b) return;
    const p = await novaPublicacao(b.dataset.criar);
    await local.gravarPub(p);
    location.hash = `#/p/${p.id}`;
  });
  $('#filtros').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filtro]');
    if (!b) return;
    filtro = b.dataset.filtro;
    renderInicio();
  });
  $('#busca').addEventListener('input', renderInicio);
  $('#listaPubs').addEventListener('click', (e) => {
    const d = e.target.closest('[data-dup]');
    if (d) duplicarPublicacao(d.dataset.dup);
    const x = e.target.closest('[data-del]');
    if (x) excluirPublicacao(x.dataset.del, x);
  });

  // Nuvem
  const modal = $('#modalNuvem');
  const abrirNuvem = () => {
    const c = nuvem.config() || {};
    $('#nuvemUrl').value = c.url || nuvem.URL_PADRAO;
    $('#nuvemSenha').value = c.senha || '';
    $('#nuvemErro').textContent = '';
    $('#btDesconectar').hidden = !nuvem.ativa();
    modal.showModal();
  };
  $('#btConectar').onclick = abrirNuvem;
  $('#sinc').onclick = abrirNuvem;
  $('#btFecharNuvem').onclick = () => modal.close();
  $('#btDesconectar').onclick = async () => {
    nuvem.salvarConfig(null);
    modal.close();
    status('local');
    if (!pub) { await carregarArquivo(); renderInicio(); }
  };
  $('#formNuvem').addEventListener('submit', async (e) => {
    e.preventDefault();
    const c = { url: $('#nuvemUrl').value.trim(), senha: $('#nuvemSenha').value };
    $('#btSalvarNuvem').disabled = true;
    $('#nuvemErro').textContent = '';
    try {
      await nuvem.testar(c);
      nuvem.salvarConfig(c);
      modal.close();
      aviso('Armazenamento conectado.');
      await enviarTudoParaNuvem();
      if (pub) { sujoNuvem = true; sincronizarPub(); } else { await carregarArquivo(); renderInicio(); }
    } catch (err) {
      $('#nuvemErro').textContent = err.message === 'Failed to fetch' ? 'Não foi possível acessar esse endereço.' : err.message;
    } finally {
      $('#btSalvarNuvem').disabled = false;
    }
  });

  // Editor: título
  $('#pubTitulo').addEventListener('input', (e) => { pub.titulo = e.target.value; salvar(); });

  // Informações padrão
  const glob = $('#globais');
  glob.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (k) aoMudarGlobal(k, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
  });

  // Modelos
  $('#modelos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-modelo]');
    if (b) aplicarModelo(b.dataset.modelo);
  });
  $('#modelos').addEventListener('toggle', (e) => {
    const d = e.target.closest('details[data-grupo]');
    if (!d) return;
    const fechados = new Set(prefs.get('gruposFechados', []));
    if (d.open) fechados.delete(d.dataset.grupo); else fechados.add(d.dataset.grupo);
    prefs.set('gruposFechados', [...fechados]);
    if (d.open) requestAnimationFrame(escalarMiniaturas);
  }, true);

  // Imagens
  const imgs = $('#imagens');
  imgs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const c = cardAtivo();
    const s = b.dataset.slot;
    if (b.dataset.acao === 'trocar') { abrirSeletor(c.id, s); return; }
    if (b.dataset.acao === 'remover') delete c.imgs[s];
    if (b.dataset.acao === 'original') c.imgs[s].original = true;
    if (b.dataset.acao === 'tratada') c.imgs[s].original = false;
    salvar();
    renderTrilho();
    renderImagens();
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
    modo = b.dataset.modo;
    prefs.set('modo', modo);
    renderTrilho();
  });
  $('#btMoverEsq').onclick = () => mover(-1);
  $('#btMoverDir').onclick = () => mover(1);
  $('#btDuplicar').onclick = () => {
    const c = structuredClone(cardAtivo());
    c.id = uid('c');
    pub.cards.splice(pub.ativo + 1, 0, c);
    pub.ativo += 1;
    salvar();
    renderTrilho();
    renderImagens();
  };
  $('#btExcluir').onclick = (e) => {
    const b = e.currentTarget;
    if (pub.cards.length <= 1) return;
    if (!b.dataset.confirmar) {
      b.dataset.confirmar = '1';
      b.textContent = 'Confirmar?';
      setTimeout(() => { delete b.dataset.confirmar; b.textContent = 'Excluir'; }, 2500);
      return;
    }
    delete b.dataset.confirmar;
    b.textContent = 'Excluir';
    pub.cards.splice(pub.ativo, 1);
    pub.ativo = Math.min(pub.ativo, pub.cards.length - 1);
    salvar();
    renderTrilho();
    renderModelos();
    renderImagens();
  };
  $('#btExportarCard').onclick = () => exportarCard().catch(erroExport);
  $('#btExportarTudo').onclick = () => exportarTudo().catch(erroExport);
  $('#navEsq').onclick = () => irPara(pub.ativo - 1);
  $('#navDir').onclick = () => irPara(pub.ativo + 1);
  $('#pontos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ir]');
    if (b) irPara(Number(b.dataset.ir));
  });

  // Trilho
  const trilho = $('#trilho');
  trilho.addEventListener('scroll', () => requestAnimationFrame(posicionarAcoes));
  trilho.addEventListener('click', (e) => {
    if (e.target.closest('#btMais')) { adicionarCard(); return; }
    const peca = e.target.closest('.peca[data-i]');
    if (!peca) return;
    const i = Number(peca.dataset.i);
    if (i !== pub.ativo) { irPara(i); return; }
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
    cardAtivo().campos[el.dataset.campo] = limparHtml(el.innerHTML);
    if (el.dataset.fit) ajustar(el);
    if (el.dataset.cresce) crescer(el);
    const card = el.closest('.card');
    card.querySelectorAll('[data-segue]').forEach((s) => seguir(s, card));
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
    document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
  });

  // Arrastar para reenquadrar
  trilho.addEventListener('pointerdown', (e) => {
    const slot = e.target.closest('.peca.ativa .slot:not([data-vazio])');
    if (!slot || e.button !== 0) return;
    const peca = slot.closest('.peca');
    const c = pub.cards.find((x) => x.id === peca.dataset.id);
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

  // Soltar arquivos
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
    receberArquivo(e.dataTransfer.files[0], slot.closest('.peca').dataset.id, slot.dataset.slot);
  });
  window.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) document.body.classList.add('arrastando'); });
  window.addEventListener('drop', (e) => { document.body.classList.remove('arrastando'); if (!e.target.closest('.slot')) e.preventDefault(); });
  window.addEventListener('dragover', (e) => e.preventDefault());

  $('#arquivo').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f && destinoUpload) receberArquivo(f, destinoUpload.cardId, destinoUpload.slot);
  });

  window.addEventListener('keydown', (e) => {
    if (!pub || e.target.closest('input, textarea, [contenteditable], dialog')) return;
    if (e.key === 'ArrowLeft') irPara(pub.ativo - 1);
    if (e.key === 'ArrowRight') irPara(pub.ativo + 1);
  });
  window.addEventListener('beforeunload', () => { if (pub) local.gravarPub(pub); });
  new ResizeObserver(() => { if (pub) renderTrilho(); }).observe($('#trilhoWrap'));
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

/** Ao conectar a nuvem pela primeira vez, envia o que já existe neste navegador. */
async function enviarTudoParaNuvem() {
  const locais = await local.listarPubs();
  let remotos = [];
  try { remotos = await nuvem.listar(); } catch { return; }
  const r = new Map(remotos.map((x) => [x.id, x]));
  for (const res of locais) {
    if ((r.get(res.id)?.atualizado || '') >= (res.atualizado || '')) continue;
    const p = await local.lerPub(res.id);
    for (const ref of local.refsDe(p)) await garantirImagemNaNuvem(ref);
    await nuvem.gravar(p);
  }
}

// ---------------------------------------------------------------------------
// Migração das versões anteriores (carrossel único por núcleo, imagens embutidas)

async function migrar() {
  const antigo = await local.ler('estado');
  if (!antigo?.decks || (await local.lerMeta('migrado'))) return;
  for (const id of ORDEM_NUCLEOS) {
    const d = antigo.decks[id];
    if (!d) continue;
    await local.gravarMeta('globais:' + id, d.globais);
    const temImagem = d.cards?.some((c) => Object.values(c.imgs || {}).some((im) => im?.src));
    if (!temImagem || antigo.versao !== 2) continue;
    const p = await novaPublicacao(id);
    p.titulo = `${d.globais?.projeto || NUCLEOS[id].nome} (rascunho anterior)`;
    p.globais = { ...p.globais, ...d.globais };
    p.cards = await Promise.all(d.cards.map(async (c) => {
      const imgs = {};
      for (const [s, im] of Object.entries(c.imgs || {})) {
        if (!im?.src) continue;
        const ref = uid('i');
        await local.gravarImg(ref, im.src);
        const { src, ...resto } = im;
        imgs[s] = { ...resto, ref };
      }
      return { ...c, imgs };
    }));
    await local.gravarPub(p);
  }
  await local.gravarMeta('migrado', true);
}

// ---------------------------------------------------------------------------

async function iniciar() {
  $('#marcaSelo').innerHTML = mark('mao', 24);
  status(nuvem.ativa() ? 'nuvem' : 'local');
  await migrar();
  await document.fonts.load('700 112px Inter').catch(() => {});
  await document.fonts.ready;
  ligarEventos();
  await rotear();
}

iniciar();
