// Universo — posts 3:4 do Odisse.
// Duas vistas: início (criar + arquivo) e editor de uma publicação.

import { NUCLEOS, ORDEM_NUCLEOS, padroesDoNucleo, COR, tintaSobre } from './nucleos.js';
import {
  modelosDo, modeloDe, codigoDe, slotsDe, migrarCard, opcoesDe, opcoesDoModelo, SEQUENCIAS, GRUPOS, grupoDe, renderCard, exemploDe, ajustarLayout, ajustar, crescer, seguir, LARG, ALT,
} from './templates.js';
import { mark } from './marks.js';
import { lerArquivo, tratar } from './imaging.js';
import * as local from './store.js';
import * as nuvem from './nuvem.js';
import { instalarPadroes } from './padroes.js';
import { renderPadroes } from './pagina-padroes.js';
import { renderMetricas } from './pagina-metricas.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const VERSAO = 4; // 4: modelos universais (O-01…O-11) com opções por card
/** Ícone (i): o texto de ajuda aparece ao pousar o mouse. */
const info = (txt) => (txt ? ` <span class="info" tabindex="0" data-info="${esc(txt)}">i</span>` : '');

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
// Guias de composição (só no editor; não entram na exportação)

const GUIAS_SVG = `<svg class="guias" viewBox="0 0 1080 1440" preserveAspectRatio="none" aria-hidden="true">
  <g class="g-diagonais"><path d="M0 0L1080 1440M1080 0L0 1440"/></g>
  <g class="g-tercos"><path d="M360 0V1440M720 0V1440M0 480H1080M0 960H1080"/></g>
  <g class="g-quadrado"><path class="veu-q" d="M0 0H1080V180H0ZM0 1260H1080V1440H0Z"/><rect x="0" y="180" width="1080" height="1080"/></g>
</svg>`;
const GUIAS = [
  ['diagonais', 'Diagonais', 'Diagonais do card, de canto a canto'],
  ['tercos', 'Terços', 'Regra dos terços (360 / 720 px na horizontal, 480 / 960 px na vertical)'],
  ['quadrado', '1080×1080', 'Recorte quadrado do grid do perfil (y 180 a 1260)'],
];

function renderGuias() {
  const ativas = prefs.get('guias', []);
  $('#guias').innerHTML = GUIAS.map(([id, rot, dica]) =>
    `<button class="${ativas.includes(id) ? 'ativo' : ''}" data-guia="${id}" title="${dica}" aria-pressed="${ativas.includes(id)}">${rot}</button>`).join('');
  GUIAS.forEach(([id]) => $('#palco').classList.toggle(`com-${id}`, ativas.includes(id)));
}

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
// Salvamento
// - rascunho: cada alteração vai para o navegador (IndexedDB), automaticamente;
// - nuvem: ao criar, no botão Salvar (Ctrl+S), ao exportar, ao sair do editor
//   e a cada 20 minutos se houver alteração.

const AUTOSALVAR_MIN = 20;
let timerLocal;
const pendente = () => !!pub && (pub.atualizado || '') > (pub.salvoEm || '');

function salvar() {
  if (!pub) return;
  pub.atualizado = new Date().toISOString();
  status('pendente');
  clearTimeout(timerLocal);
  timerLocal = setTimeout(async () => {
    await local.gravarPub(pub);
    await local.gravarMeta('globais:' + pub.nucleo, pub.globais);
  }, 350);
}

let salvando = null;
async function salvarNaNuvem({ silencioso = false } = {}) {
  if (!pub) return;
  if (salvando) return salvando;
  const alvo = pub;
  status('salvando');
  salvando = (async () => {
    try {
      alvo.capa = await gerarCapa(alvo).catch(() => alvo.capa);
      for (const ref of local.refsDe(alvo)) await garantirImagemNaNuvem(ref);
      const marca = alvo.atualizado;
      await nuvem.gravar({ ...alvo, salvoEm: marca });
      alvo.salvoEm = marca;
      await local.gravarPub(alvo);
      status(pub === alvo && pendente() ? 'pendente' : 'salvo', alvo.salvoEm);
      if (!silencioso) aviso('Publicação salva.');
    } catch (e) {
      console.warn(e);
      if (e.message === 'senha incorreta') return sair();
      status('erro', e.message);
      if (!silencioso) aviso('Não foi possível salvar na nuvem. O rascunho continua neste computador.');
    } finally {
      salvando = null;
    }
  })();
  return salvando;
}

setInterval(() => { if (pendente()) salvarNaNuvem({ silencioso: true }); }, AUTOSALVAR_MIN * 60 * 1000);

const enviadas = new Set();
async function garantirImagemNaNuvem(ref) {
  if (enviadas.has(ref)) return;
  const src = imagens.get(ref) || (await local.lerImg(ref));
  if (!src) return;
  if (!(await nuvem.existeImg(ref))) await nuvem.enviarImg(ref, src);
  enviadas.add(ref);
}

function status(tipo, detalhe = '') {
  const el = $('#sinc');
  el.dataset.estado = tipo;
  const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
  $('#sincTxt').textContent = {
    pendente: 'Alterações não salvas',
    salvando: 'Salvando…',
    salvo: detalhe ? `Salvo às ${hora(detalhe)}` : 'Salvo',
    erro: 'Erro ao salvar',
    pronto: '',
  }[tipo] ?? tipo;
  el.title = tipo === 'erro' ? `Não foi possível salvar na nuvem (${detalhe}). O rascunho continua neste computador.` : '';
  $('#btSalvar').disabled = tipo === 'salvando';
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
  if (faltando.length) {
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
  const mapa = new Map(locais.map((r) => [r.id, { ...r, rascunho: (r.atualizado || '') > (r.salvoEm || '') }]));
  try {
    for (const r of await nuvem.listar()) {
      const l = mapa.get(r.id);
      if (!l || (r.atualizado || '') >= (l.atualizado || '')) mapa.set(r.id, { ...r, rascunho: false });
    }
    status('pronto');
  } catch (e) {
    if (e.message === 'senha incorreta') return sair();
    status('erro', e.message);
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
    ? `${resumos.length} ${resumos.length === 1 ? 'publicação' : 'publicações'}`
    : 'Nenhuma publicação ainda.';

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
        <span class="pub-data">${data(r.atualizado)}${r.rascunho ? ' · <b class="rascunho" title="Há alterações deste computador que ainda não foram salvas na nuvem">não salvo</b>' : ''}</span>
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
  if (!p || (r && !r.rascunho && (r.atualizado || '') > (p.atualizado || ''))) {
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
  // cards de versões anteriores → modelos universais com as opções equivalentes
  const migrou = pub.cards.map((c) => migrarCard(pub.nucleo, c)).some(Boolean);
  if (migrou || (pub.versao || 0) < VERSAO) { pub.versao = VERSAO; salvar(); }
  mostrar('editor');
  status(pendente() ? 'pendente' : 'salvo', pub.salvoEm);
  renderEditor();
}

async function duplicarPublicacao(id) {
  let p = await local.lerPub(id);
  if (!p && nuvem.ativa()) p = await nuvem.ler(id);
  if (!p) return;
  const agora = new Date().toISOString();
  const copia = { ...structuredClone(p), id: uid('p'), titulo: `${tituloDe(p)} (cópia)`, criado: agora, atualizado: agora };
  copia.cards.forEach((c) => { c.id = uid('c'); });
  copia.salvoEm = copia.atualizado;
  await local.gravarPub(copia);
  await nuvem.gravar(copia).catch(() => { copia.salvoEm = ''; return local.gravarPub(copia); });
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
  await nuvem.apagar(id).catch((e) => aviso('Excluída aqui, mas não na nuvem: ' + e.message));
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
  { grupo: 'Dados da publicação', dica: 'Valem para todos os cards desta publicação.', campos: [
    { k: '__titulo', rot: 'Nome da publicação' },
    { k: 'projeto', rot: 'Rótulo do cabeçalho', rotElaia: 'Autoria', dica: 'Texto do canto superior direito dos cards.', dicaElaia: 'Canto superior direito dos cards, depois do texto fixo "Escrito por".' },
    { k: 'dataPublicacao', rot: 'Data de publicação', tipo: 'date' },
  ] },
  { grupo: 'Fechamento e contatos', dica: 'Aparecem no card de fechamento. Valem para toda a publicação.', fechamento: true, campos: [
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
  const grupo = (grp) => {
    let h = `<div class="grupo"><h3>${grp.grupo}${info(grp.dica)}</h3>`;
    for (const c of grp.campos) {
      if (c.tipo === 'check') {
        h += `<label class="check"><input type="checkbox" data-k="${c.k}" ${g[c.k] ? 'checked' : ''}> ${c.rot}${info(c.dica)}</label>`;
      } else {
        const valor = c.k === '__titulo' ? pub.titulo : g[c.k];
        const elaia = n.autoria && c.rotElaia;
        const input = c.area
          ? `<textarea data-k="${c.k}" rows="2">${esc(valor)}</textarea>`
          : `<input type="${c.tipo || 'text'}" data-k="${c.k}" value="${esc(valor)}"${c.k === '__titulo' ? ' placeholder="Ex.: Apto RP 201 · lançamento"' : ''}>`;
        h += `<label class="campo" data-campo-global="${c.k}"><span>${elaia ? c.rotElaia : c.rot}${info(elaia ? c.dicaElaia : c.dica)}</span>${input}</label>`;
      }
    }
    return h + `</div>`;
  };
  const [pubGrp, fechGrp] = CAMPOS_GLOBAIS;
  $('#globaisPub').innerHTML = grupo(pubGrp);
  $('#globaisFech').innerHTML = grupo(fechGrp);
  $('#registro').innerHTML = `<div class="grupo registro-grupo"><h3>Registro do núcleo</h3><div class="registro">
    <div class="sel" style="background:${n.painel};color:${cor}">${mark(n.selo, 34)}</div>
    <dl>
      <dt>Painel</dt><dd>${amostra(n.painel)}${nomeCor(n.painel)}</dd>
      <dt>Véu</dt><dd>${amostra(n.veu)}${nomeCor(n.veu)}</dd>
      <dt>Imagem</dt><dd>${n.tratamentoNome}</dd>
      <dt>Selo</dt><dd>${{ roda: 'Roda', sol: 'Sol', flor: 'Flor', mao: 'Mão' }[n.selo]}</dd>
    </dl>
  </div></div>`;
}

let timerGlobais;
function aoMudarGlobal(k, v) {
  if (k === '__titulo') {
    pub.titulo = v;
    $('#pubTitulo').value = v;
    document.title = `${tituloDe(pub)} · Universo`;
    salvar();
    return;
  }
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
        <button class="modelo ${m.id === atual ? 'ativo' : ''}" data-modelo="${m.id}">
          <div class="mini"><div class="card">${renderCard({
            card: { id: 'm-' + m.id, modelo: m.id, campos: exemploDe(n.id, m.id), imgs: {} },
            indice: 0, total: 8, nucleo: n, globais: g, modo: 'miniatura', fonteImagem,
          })}</div></div>
          <span class="cod">${codigoDe(n.id, m.id)}</span>
          <b>${m.nome}${info(m.desc)}</b>
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
  c.opcoes = c.opcoes?.carimbo ? { carimbo: c.opcoes.carimbo } : {}; // o carimbo passa de um modelo para outro
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
  renderOpcoes();
  const slots = slotsDe(pub.nucleo, c);
  const n = nucleo();
  const dica = slots.length
    ? 'Valem só para este card. Clique numa área vazia do card para adicionar, arraste um arquivo sobre ela ou arraste a imagem para reenquadrar.'
    : 'Este modelo é só texto. Clique nos textos do card para editar.';
  let h = `<h3>Imagens do card <span class="card-tag">${String(pub.ativo + 1).padStart(2, '0')}</span>${info(dica)}</h3>`;
  if (!slots.length) h += `<p class="vazio">Sem imagens neste modelo.</p>`;
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
      ${FAIXAS.map(([f, rot, min, max, passo, pad, unid]) => {
        const v = im[f] ?? pad;
        const mostrado = f === 'z' ? Math.round(v * 100) : Math.round(v * 10) / 10;
        return `<label class="faixa">${rot} <input type="range" min="${min}" max="${max}" step="${passo}" value="${v}" data-faixa="${f}" data-slot="${s}">
          <span class="num"><input type="number" min="${f === 'z' ? min * 100 : min}" max="${f === 'z' ? max * 100 : max}" step="${f === 'z' ? 1 : 0.5}" value="${mostrado}" data-num="${f}" data-slot="${s}" aria-label="${rot}">${unid}</span></label>`;
      }).join('')}
    </div>`;
  }
  el.innerHTML = h;
}

// [campo, rótulo, mín, máx, passo da barra, padrão, unidade] — o zoom aparece em %
const FAIXAS = [
  ['z', 'Zoom', 1, 3, 0.01, 1, '%'],
  ['x', 'Horiz.', 0, 100, 0.5, 50, ''],
  ['y', 'Vert.', 0, 100, 0.5, 50, ''],
];

// ---- Personalização do card (opções do modelo) ------------------------------

function renderOpcoes() {
  const c = cardAtivo();
  const el = $('#opcoes');
  const m = c && modeloDe(pub.nucleo, c.modelo);
  if (!m) {
    el.innerHTML = '';
    el.hidden = true;
    return;
  }
  const ops = opcoesDe(m, c, nucleo());
  el.hidden = false;
  el.innerHTML = `<h3>Personalização do card${info('Opções de composição deste card. A identidade (cores, véu, selo, tratamento) vem do núcleo.')}</h3>
    ${opcoesDoModelo(m).map((d) => `<div class="opcao"><span>${d.rot}</span>
      <div class="seg" role="group" aria-label="${d.rot}">${d.valores.map(([v, rot]) =>
        `<button class="${ops[d.k] === v ? 'ativo' : ''}" data-op="${d.k}" data-v="${v}" aria-pressed="${ops[d.k] === v}">${rot}</button>`).join('')}</div></div>`).join('')}`;
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
      <span class="num">${String(i + 1).padStart(2, '0')} · ${codigoDe(pub.nucleo, c.modelo)}</span>
      <div class="moldura" style="--k:${kk}"><div class="card editar">${renderCard({
        card: c, indice: i, total: pub.cards.length, nucleo: n, globais: pub.globais, modo: 'editar', fonteImagem,
      })}</div>${GUIAS_SVG}</div>
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
  renderImagens();
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
  garantirImagemNaNuvem(ref).catch(() => {});
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
const nomeArquivo = (i) => `${dataArquivo()}-${String(i + 1).padStart(3, '0')}-${nucleo().sigla}-${nomeBase()}.jpg`;

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

/** JPG otimizado: 1080 × 1440, sRGB, qualidade 0,86 (bom equilíbrio para o Instagram, que recomprime). */
const QUALIDADE_JPG = 0.86;
async function gerarJpg(i) {
  const no = await montarCard(pub, i);
  const opc = { width: LARG, height: ALT, canvasWidth: LARG, canvasHeight: ALT, pixelRatio: 1, cacheBust: false, backgroundColor: COR.papel };
  await window.htmlToImage.toCanvas(no, opc); // 1ª passada carrega as fontes
  const canvas = await window.htmlToImage.toCanvas(no, opc);
  $('#exportador').innerHTML = '';
  return new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', QUALIDADE_JPG));
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
  aviso('Gerando JPG…');
  await aguardarTratamentos([cardAtivo()]);
  const u = URL.createObjectURL(await gerarJpg(pub.ativo));
  baixar(u, nomeArquivo(pub.ativo));
  setTimeout(() => URL.revokeObjectURL(u), 4000);
  aviso('JPG exportado em 1080 × 1440.');
  salvarNaNuvem({ silencioso: true });
}

async function exportarTudo() {
  aviso(`Gerando ${pub.cards.length} cards…`);
  await aguardarTratamentos(pub.cards);
  const zip = new window.JSZip();
  for (let i = 0; i < pub.cards.length; i++) zip.file(nomeArquivo(i), await gerarJpg(i));
  const u = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
  baixar(u, `${dataArquivo()}-${nucleo().sigla}-${nomeBase()}.zip`);
  setTimeout(() => URL.revokeObjectURL(u), 4000);
  aviso('Carrossel exportado (.zip).');
  salvarNaNuvem({ silencioso: true });
}

// ===========================================================================
// Navegação

function mostrar(vista) {
  for (const v of ['login', 'inicio', 'editor', 'padroes', 'metricas']) document.body.classList.toggle('vista-' + v, vista === v);
}

async function sairDoEditor() {
  if (!pub) return;
  clearTimeout(timerLocal);
  await local.gravarPub(pub);
  if (pendente()) await salvarNaNuvem({ silencioso: true });
  pub = null;
}

async function rotear() {
  if (!nuvem.ativa()) { mostrar('login'); $('#loginSenha').focus(); return; }
  const m = location.hash.match(/^#\/p\/(.+)$/);
  // o retorno do login do Meta às vezes chega com o fragmento "#_=_"; volta para as métricas
  if (location.hash === '#_=_') { history.replaceState(null, '', location.pathname + '#/metricas'); }
  const metr = location.hash.startsWith('#/metricas');
  $('#menuPosts').classList.toggle('ativo', !metr);
  $('#menuMetricas').classList.toggle('ativo', metr);
  if (metr) {
    if (pub) await sairDoEditor();
    document.title = 'Métricas · Universo';
    mostrar('metricas');
    await renderMetricas($('#metricas'));
    return;
  }
  if (location.hash === '#/padroes') {
    if (pub) await sairDoEditor();
    document.title = 'Padrões · Universo';
    mostrar('padroes');
    renderPadroes($('#padroes'));
    return;
  }
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

// ---- Entrada ----------------------------------------------------------------

async function entrar(senha) {
  const c = { url: nuvem.URL_PADRAO, senha };
  await nuvem.testar(c);
  nuvem.salvarConfig(c);
  await enviarTudoParaNuvem().catch(() => {});
  await rotear();
}

async function sair() {
  if (pub) {
    clearTimeout(timerLocal);
    await local.gravarPub(pub);
    pub = null;
  }
  nuvem.salvarConfig(null);
  resumos = [];
  status('pronto');
  location.hash = '#/';
  mostrar('login');
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
    try {
      await nuvem.gravar({ ...p, salvoEm: p.atualizado });
      p.salvoEm = p.atualizado;
      await local.gravarPub(p);
    } catch { /* fica como rascunho até o próximo salvamento */ }
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

  // Entrada e saída
  $('#formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const bt = $('#btEntrar');
    bt.disabled = true;
    $('#loginErro').textContent = '';
    try {
      await entrar($('#loginSenha').value);
      $('#loginSenha').value = '';
    } catch (err) {
      $('#loginErro').textContent = err.message === 'Failed to fetch' ? 'Sem conexão com o servidor. Tente de novo em instantes.' : err.message;
    } finally {
      bt.disabled = false;
    }
  });
  $('#btSair').onclick = sair;

  // Salvar
  $('#btSalvar').onclick = () => salvarNaNuvem();
  window.addEventListener('keydown', (e) => {
    if (pub && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); salvarNaNuvem(); }
  });

  // Editor: título
  $('#pubTitulo').addEventListener('input', (e) => {
    pub.titulo = e.target.value;
    const campo = $('#globais [data-k="__titulo"]');
    if (campo) campo.value = pub.titulo;
    salvar();
  });

  // Informações padrão
  const glob = $('#globais');
  glob.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (k) aoMudarGlobal(k, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
  });

  // Modelos
  $('#modelos').addEventListener('click', (e) => {
    if (e.target.closest('.info')) return;
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
    const f = e.target.dataset.faixa || e.target.dataset.num;
    if (!f) return;
    const c = cardAtivo();
    const s = e.target.dataset.slot;
    const im = c.imgs[s];
    const [, , min, max, , pad] = FAIXAS.find((x) => x[0] === f);
    const label = e.target.closest('.faixa');
    if (e.target.dataset.faixa) {
      im[f] = Number(e.target.value);
      label.querySelector('[data-num]').value = f === 'z' ? Math.round(im.z * 100) : Math.round(im[f] * 10) / 10;
    } else {
      // valor digitado: zoom em %, posições de 0 a 100
      const bruto = parseFloat(String(e.target.value).replace(',', '.'));
      if (Number.isNaN(bruto)) return;
      const v = f === 'z' ? bruto / 100 : bruto;
      im[f] = Math.max(min, Math.min(max, v ?? pad));
      label.querySelector('[data-faixa]').value = im[f];
    }
    atualizarImgNoCard(c.id, s);
    salvar();
  });
  // Opções do card
  $('#opcoes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-op]');
    if (!b) return;
    const c = cardAtivo();
    c.opcoes = { ...(c.opcoes || {}), [b.dataset.op]: b.dataset.v };
    salvar();
    renderTrilho();
    renderImagens();
  });

  // Barra
  renderGuias();
  $('#guias').addEventListener('click', (e) => {
    const b = e.target.closest('[data-guia]');
    if (!b) return;
    const ativas = new Set(prefs.get('guias', []));
    ativas.has(b.dataset.guia) ? ativas.delete(b.dataset.guia) : ativas.add(b.dataset.guia);
    prefs.set('guias', [...ativas]);
    renderGuias();
  });
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
  // Roda do mouse (ou trackpad) passa de card em card; um passo por gesto.
  let rodaAcum = 0, rodaTrava = 0;
  $('#trilhoWrap').addEventListener('wheel', (e) => {
    if (!pub || e.ctrlKey) return; // Ctrl+roda continua sendo zoom do navegador
    e.preventDefault();
    const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    const agora = performance.now();
    if (agora < rodaTrava) return;
    rodaAcum += e.deltaMode === 1 ? d * 40 : d;
    if (Math.abs(rodaAcum) < 50) return;
    irPara(pub.ativo + Math.sign(rodaAcum));
    rodaAcum = 0;
    rodaTrava = agora + 260;
  }, { passive: false });
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
  window.addEventListener('beforeunload', (e) => {
    if (!pub) return;
    local.gravarPub(pub);
    if (pendente()) { e.preventDefault(); e.returnValue = ''; }
  });
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
    p.salvoEm = p.atualizado;
    await nuvem.gravar(p);
    await local.gravarPub(p);
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

/** Dica flutuante dos ícones (i): uma só, posicionada junto ao ícone, fora de qualquer recorte. */
function ligarDicas() {
  const el = $('#dicaFlut');
  const mostrarDica = (alvo) => {
    el.textContent = alvo.dataset.info;
    el.classList.add('on');
    const r = alvo.getBoundingClientRect();
    const w = el.offsetWidth, hh = el.offsetHeight;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(8, Math.min(innerWidth - w - 8, x));
    let y = r.bottom + 8;
    if (y + hh > innerHeight - 8) y = r.top - hh - 8;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  };
  const esconder = () => el.classList.remove('on');
  document.addEventListener('mouseover', (e) => { const a = e.target.closest?.('.info'); if (a) mostrarDica(a); });
  document.addEventListener('mouseout', (e) => { if (e.target.closest?.('.info')) esconder(); });
  document.addEventListener('focusin', (e) => { const a = e.target.closest?.('.info'); if (a) mostrarDica(a); });
  document.addEventListener('focusout', (e) => { if (e.target.closest?.('.info')) esconder(); });
  document.addEventListener('scroll', esconder, true);
  // dentro de um <label>, o (i) não marca a caixa nem foca o campo
  document.addEventListener('click', (e) => { if (e.target.closest?.('label .info')) e.preventDefault(); });
}

async function iniciar() {
  instalarPadroes();
  ligarDicas();
  $('#marcaSelo').innerHTML = mark('mao', 24);
  $('#loginSelo').innerHTML = mark('mao', 30);
  status('pronto');
  await migrar();
  await document.fonts.load('700 112px Inter').catch(() => {});
  await document.fonts.ready;
  ligarEventos();
  await rotear();
}

iniciar();
