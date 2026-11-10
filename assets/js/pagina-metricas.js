// Página "Métricas": hub de desempenho do marketing do Odisse.
// Fase 1: Instagram (conta única, coletada todo dia pelo Worker — ver worker/instagram.js).
// Cada post do Instagram pode ser ligado a uma publicação do Universo; assim as métricas
// se abrem por núcleo e por modelo de capa.

import * as nuvem from './nuvem.js';
import { NUCLEOS, ORDEM_NUCLEOS } from './nucleos.js';
import { modelosDo } from './templates.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NF = new Intl.NumberFormat('pt-BR');
const NFc = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const n = (v) => (v == null || Number.isNaN(v) ? '—' : NF.format(Math.round(v)));
const nc = (v) => (v == null || Number.isNaN(v) ? '—' : Math.abs(v) < 10000 ? NF.format(Math.round(v)) : NFc.format(v));
const pct = (v) => (v == null || !Number.isFinite(v) ? '—' : (v * 100).toFixed(1).replace('.', ',') + '%');
const DIA = 86400000;
const diaLocal = (ms) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10);
const dataCurta = (d, ano = true) => { const [a, m, dd] = d.split('-'); return `${dd}/${m}${ano ? '/' + a.slice(2) : ''}`; };
const media = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const soma = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) : null);

const PERIODOS = [['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias'], ['tudo', 'Tudo']];
const SERIES = [
  ['views', 'Visualizações'],
  ['alcance', 'Alcance'],
  ['interacoes', 'Interações'],
  ['contas', 'Contas engajadas'],
];
const TIPOS = { CAROUSEL_ALBUM: 'Carrossel', IMAGE: 'Imagem', VIDEO: 'Vídeo' };

let raiz = null;
let dados = null;
let resumos = [];
let periodo = '30';
let serie = 'views';
let ordem = { col: 'data', desc: true };
const minis = new Map();

// ---------------------------------------------------------------------------

export async function renderMetricas(el) {
  raiz = el;
  if (!raiz.dataset.ligado) ligar();
  if (!dados) raiz.innerHTML = '<section><p class="met-carregando">Carregando métricas…</p></section>';
  await carregar();
}

async function carregar() {
  try {
    [dados, resumos] = await Promise.all([nuvem.igMetricas(), nuvem.listar().catch(() => [])]);
  } catch (e) {
    raiz.innerHTML = `<section><p class="met-erro">Não foi possível carregar as métricas: ${esc(e.message)}</p></section>`;
    return;
  }
  desenhar();
}

function desenhar() {
  const est = dados.estado || {};
  if (!est.conectado) { raiz.innerHTML = telaConexao(est); return; }
  const c = calcular();
  G.w = Math.max(560, Math.min(1240, raiz.clientWidth - 2 * parseFloat(getComputedStyle(raiz).paddingLeft || 0)) - 22);
  raiz.innerHTML = `
    ${cabecalho(est)}
    ${est.erro ? `<section><p class="met-erro">${esc(est.erro)}</p></section>` : ''}
    <section class="met-kpis">${kpis(c)}</section>
    <section class="met-bloco">
      <div class="met-bloco-cab">
        <h2>Conta por dia <span class="info" tabindex="0" data-info="Números diários da conta toda (inclui posts antigos, stories e reels). O dia de ontem ainda pode mudar; os anteriores ficam fechados. Os tracinhos ocre na base marcam os dias com post publicado.">i</span></h2>
        <div class="seg met-seg" data-grupo="serie">${SERIES.map(([k, r]) => `<button data-v="${k}" class="${k === serie ? 'ativo' : ''}">${r}</button>`).join('')}</div>
      </div>
      <div class="met-grafico" id="metGrafico">${grafico(c)}</div>
    </section>
    <section class="met-bloco">
      <div class="met-bloco-cab"><h2>Por núcleo <span class="info" tabindex="0" data-info="Médias por post publicado no período. O núcleo vem da publicação do Universo ligada ao post; posts sem vínculo ficam em “Sem vínculo”. Engajamento = interações ÷ alcance.">i</span></h2></div>
      ${tabelaNucleos(c)}
    </section>
    <section class="met-bloco">
      <div class="met-bloco-cab"><h2>Por modelo de capa <span class="info" tabindex="0" data-info="Só posts ligados a uma publicação. O código é o mesmo do panorama da página de padrões.">i</span></h2></div>
      ${tabelaModelos(c)}
    </section>
    <section class="met-bloco">
      <div class="met-bloco-cab">
        <h2>Posts <span class="cont">${c.posts.length}</span> <span class="info" tabindex="0" data-info="Ligue cada post à publicação do Universo que o gerou. Quando só existe uma publicação com a mesma data de publicação, a ligação é feita sozinha (marcada como auto).">i</span></h2>
      </div>
      ${tabelaPosts(c)}
    </section>`;
  ligarGrafico(c);
  carregarMinis();
}

// ---------------------------------------------------------------------------
// Conexão

const RETORNO = 'https://universo-odisse.reservaprojectbasework.workers.dev/api/instagram/retorno';

function telaConexao(est) {
  const app = est.app || {};
  return `
    <section class="met-conectar">
      <h1>Métricas</h1>
      <p class="met-lead">Conecte a conta do Odisse no Instagram. Depois disso, o Universo busca os números todo dia, às 6h, e guarda o histórico (o Instagram só mantém 90 dias).</p>
      ${est.erro ? `<p class="met-erro">${esc(est.erro)}</p>` : ''}
      <ol class="met-passos">
        <li>No app do Meta (<b>developers.facebook.com</b>), caso de uso <i>Gerenciar mensagens e conteúdo no Instagram</i>, em <i>Permissões e recursos</i>, adicione <b>instagram_basic</b> e <b>instagram_manage_insights</b>.</li>
        <li>Em <i>API setup with Unified login → Criar nova configuração</i>: token de <b>usuário do sistema</b>, expiração <b>Nunca</b>, ativo <b>conta do Instagram</b>, permissões <b>instagram_basic</b> e <b>instagram_manage_insights</b>.</li>
        <li>Registre este URL de redirecionamento e salve:<code class="met-url">${RETORNO}</code></li>
        <li>Preencha abaixo o ID do app e a chave secreta (<i>Configurações do app → Básico</i>) e o ID da configuração. A chave fica guardada só no servidor.</li>
      </ol>
      <form class="met-form" id="metLogin">
        <div class="met-campos">
          <label class="campo"><span>ID do app</span><input type="text" id="metApp" inputmode="numeric" value="${esc(app.appId || '')}" required></label>
          <label class="campo"><span>ID da configuração</span><input type="text" id="metConfig" inputmode="numeric" value="${esc(app.config || '')}" required></label>
        </div>
        <label class="campo"><span>Chave secreta do app</span><input type="password" id="metSegredo" autocomplete="off" placeholder="${app.temSegredo ? 'já guardada — deixe em branco para manter' : ''}" ${app.temSegredo ? '' : 'required'}></label>
        <button type="submit" id="metEntrar">Entrar com o Instagram</button>
        <p class="met-msg" id="metMsg" role="status"></p>
      </form>
      <details class="met-alt">
        <summary>Já tenho um token de acesso</summary>
        <form class="met-form" id="metForm">
          <label class="campo"><span>Token (de usuário do sistema ou do login do Instagram)</span><input type="password" id="metToken" autocomplete="off" required></label>
          <button type="submit" id="metConectar">Conectar e coletar</button>
          <p class="met-msg" id="metMsgToken" role="status"></p>
        </form>
      </details>
    </section>`;
}

function cabecalho(est) {
  const quando = est.ultimaColeta
    ? new Date(est.ultimaColeta).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'nunca';
  const expira = est.expira ? Math.round((est.expira - Date.now()) / DIA) : null;
  return `
    <section class="met-cab">
      <div>
        <h1>Métricas</h1>
        <p><b>Instagram @${esc(est.usuario || '')}</b> · ${n(est.seguidores)} seguidores · ${n(est.nposts)} posts · atualizado em ${quando}${expira != null && expira < 20 ? ` · <span class="alerta">token expira em ${expira} dias</span>` : ''}</p>
      </div>
      <div class="met-acoes">
        <div class="seg met-seg" data-grupo="periodo">${PERIODOS.map(([k, r]) => `<button data-v="${k}" class="${k === periodo ? 'ativo' : ''}">${r}</button>`).join('')}</div>
        <button class="bt-padroes" id="metAtualizar">Atualizar agora</button>
        <button class="bt-link" id="metDesconectar" title="Esquecer o token (o histórico fica guardado)">Desconectar</button>
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Cálculos

const interacoesDe = (m) => m.interacoes ?? ((m.curtidas || 0) + (m.comentarios || 0) + (m.salvos || 0) + (m.compart || 0));
const engajDe = (m) => (m.alcance ? interacoesDe(m) / m.alcance : null);

function calcular() {
  const hoje = diaLocal(Date.now());
  const diasTodos = Object.keys(dados.dias).sort();
  const primeiro = diasTodos[0] || hoje;
  const inicio = periodo === 'tudo' ? primeiro : diaLocal(Date.now() - Number(periodo) * DIA);
  // eixo do gráfico: de `inicio` até ontem, dia a dia
  const eixo = [];
  for (let t = Date.parse(inicio); diaLocal(t + 3 * 3600000) < hoje; t += DIA) eixo.push(new Date(t).toISOString().slice(0, 10));
  const dias = eixo.map((d) => ({ d, ...(dados.dias[d] || {}) }));

  const pubs = dados.pubs || {};
  const posts = dados.posts
    .filter((p) => p.dia >= inicio)
    .map((p) => {
      const v = dados.vinculos[p.id];
      const pub = v?.pub ? pubs[v.pub] : null;
      return { ...p, vinc: v || null, pub, nucleo: pub?.nucleo || 'sem', inter: interacoesDe(p.m), engaj: engajDe(p.m) };
    });

  // seguidores: diferença entre a primeira e a última foto do período; senão, soma dos novos
  const fotos = diasTodos.filter((d) => d >= inicio && dados.dias[d].seguidores != null);
  let ganho = null;
  if (fotos.length >= 2) ganho = dados.dias[fotos.at(-1)].seguidores - dados.dias[fotos[0]].seguidores;
  else {
    const novos = dias.map((x) => x.novos).filter((v) => v != null);
    if (novos.length) ganho = soma(novos);
  }
  return { inicio, eixo, dias, posts, ganho };
}

const valores = (dias, k) => dias.map((x) => x[k]).filter((v) => v != null);

function kpis(c) {
  const est = dados.estado;
  const comAlc = c.posts.filter((p) => p.engaj != null);
  const ligados = c.posts.filter((p) => p.pub).length;
  const tiles = [
    ['Seguidores', n(est.seguidores), c.ganho == null ? 'variação aparece após alguns dias de coleta' : `${c.ganho >= 0 ? '+' : ''}${n(c.ganho)} no período`],
    ['Visualizações', nc(soma(valores(c.dias, 'views'))), `${valores(c.dias, 'views').length} dias com dados`],
    ['Alcance por dia', nc(media(valores(c.dias, 'alcance'))), 'média diária de contas alcançadas'],
    ['Interações', nc(soma(valores(c.dias, 'interacoes'))), 'curtidas, comentários, salvamentos e compartilhamentos'],
    ['Posts publicados', n(c.posts.length), `${ligados} ligados a publicações do Universo`],
    ['Engajamento por post', pct(media(comAlc.map((p) => p.engaj))), 'interações ÷ alcance, média dos posts'],
  ];
  return tiles.map(([r, v, nota]) => `<div class="met-kpi"><span>${r}</span><b>${v}</b><small>${esc(nota)}</small></div>`).join('');
}

// ---------------------------------------------------------------------------
// Gráfico diário (uma série por vez, sem segundo eixo)

const G = { w: 1000, h: 250, e: 48, d: 12, t: 14, b: 30 };

function escala(c) {
  const vals = valores(c.dias, serie);
  const bruto = Math.max(1, ...vals) / 4; // 4 faixas de grade com passo "redondo"
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((f) => f * pot).find((p) => p >= bruto);
  const max = passo * 4;
  const x = (i) => G.e + (c.eixo.length <= 1 ? 0 : (i * (G.w - G.e - G.d)) / (c.eixo.length - 1));
  const y = (v) => G.t + (1 - v / max) * (G.h - G.t - G.b);
  return { max, x, y };
}

function grafico(c) {
  if (!c.eixo.length) return '<p class="met-vazio">Ainda não há dias coletados.</p>';
  const { max, x, y } = escala(c);
  const grade = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = max * f;
    const rot = v >= 10000 ? NFc.format(v) : NF.format(v);
    return `<line x1="${G.e}" x2="${G.w - G.d}" y1="${y(v)}" y2="${y(v)}" class="g-grade${f === 0 ? ' base' : ''}"/><text x="${G.e - 8}" y="${y(v) + 4}" class="g-rot" text-anchor="end">${rot}</text>`;
  }).join('');
  // linha com quebras onde falta dado
  let caminho = '';
  let aberto = false;
  c.dias.forEach((dd, i) => {
    const v = dd[serie];
    if (v == null) { aberto = false; return; }
    caminho += `${aberto ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    aberto = true;
  });
  const isolados = c.dias.map((dd, i) => {
    const v = dd[serie];
    const ant = c.dias[i - 1]?.[serie];
    const prox = c.dias[i + 1]?.[serie];
    return v != null && ant == null && prox == null ? `<circle cx="${x(i)}" cy="${y(v)}" r="3" class="g-ponto"/>` : '';
  }).join('');
  const comPost = new Set(c.posts.map((p) => p.dia));
  const marcas = c.eixo.map((d, i) => (comPost.has(d) ? `<line x1="${x(i)}" x2="${x(i)}" y1="${G.h - G.b}" y2="${G.h - G.b + 6}" class="g-post"/>` : '')).join('');
  const nRot = Math.min(6, c.eixo.length);
  const rotX = Array.from({ length: nRot }, (_, k) => Math.round((k * (c.eixo.length - 1)) / Math.max(1, nRot - 1)))
    .map((i) => `<text x="${x(i)}" y="${G.h - 6}" class="g-rot" text-anchor="${i === 0 ? 'start' : i === c.eixo.length - 1 ? 'end' : 'middle'}">${dataCurta(c.eixo[i], false)}</text>`).join('');
  return `
    <svg viewBox="0 0 ${G.w} ${G.h}" role="img" aria-label="${esc(SERIES.find((s) => s[0] === serie)[1])} por dia">
      ${grade}${marcas}
      <path d="${caminho}" class="g-linha"/>${isolados}
      <line class="g-mira" id="gMira" y1="${G.t}" y2="${G.h - G.b}" x1="0" x2="0"/>
      <circle class="g-foco" id="gFoco" r="5" cx="-10" cy="-10"/>
      ${rotX}
      <rect class="g-alvo" id="gAlvo" x="${G.e}" y="0" width="${G.w - G.e - G.d}" height="${G.h}"/>
    </svg>
    <div class="g-dica" id="gDica"></div>
    ${valores(c.dias, serie).length ? '' : '<p class="met-vazio sob">Sem dados desta métrica no período.</p>'}`;
}

function ligarGrafico(c) {
  const alvo = raiz.querySelector('#gAlvo');
  if (!alvo || !c.eixo.length) return;
  const svg = alvo.ownerSVGElement;
  const { x, y } = escala(c);
  const mira = raiz.querySelector('#gMira');
  const foco = raiz.querySelector('#gFoco');
  const dica = raiz.querySelector('#gDica');
  const nome = SERIES.find((s) => s[0] === serie)[1];
  const postsDia = {};
  for (const p of c.posts) (postsDia[p.dia] = postsDia[p.dia] || []).push(p);
  const mover = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * G.w;
    const i = Math.max(0, Math.min(c.eixo.length - 1, Math.round(((px - G.e) / (G.w - G.e - G.d)) * (c.eixo.length - 1))));
    const dd = c.dias[i];
    const v = dd[serie];
    mira.setAttribute('x1', x(i)); mira.setAttribute('x2', x(i));
    mira.style.opacity = 1;
    if (v != null) { foco.setAttribute('cx', x(i)); foco.setAttribute('cy', y(v)); foco.style.opacity = 1; } else foco.style.opacity = 0;
    const ps = postsDia[dd.d] || [];
    dica.innerHTML = `<b>${dataCurta(dd.d)}</b><span>${nome}: <b>${v == null ? 'sem dado' : n(v)}</b></span>${ps.length ? `<span class="g-dica-post">${ps.length} post${ps.length > 1 ? 's' : ''} publicado${ps.length > 1 ? 's' : ''}</span>` : ''}`;
    dica.style.opacity = 1;
    const fx = (x(i) / G.w) * r.width;
    dica.style.left = `${Math.min(Math.max(fx, 70), r.width - 70)}px`;
  };
  alvo.addEventListener('pointermove', mover);
  alvo.addEventListener('pointerleave', () => { mira.style.opacity = 0; foco.style.opacity = 0; dica.style.opacity = 0; });
}

// ---------------------------------------------------------------------------
// Tabelas

function linhaMedias(posts) {
  const comAlc = posts.filter((p) => p.m.alcance != null);
  return {
    n: posts.length,
    alcance: media(comAlc.map((p) => p.m.alcance)),
    views: media(posts.filter((p) => p.m.views != null).map((p) => p.m.views)),
    inter: media(posts.map((p) => p.inter)),
    salvos: media(posts.filter((p) => p.m.salvos != null).map((p) => p.m.salvos)),
    engaj: media(posts.filter((p) => p.engaj != null).map((p) => p.engaj)),
  };
}

function tabelaNucleos(c) {
  const linhas = [...ORDEM_NUCLEOS, 'sem']
    .map((id) => ({ id, nome: id === 'sem' ? 'Sem vínculo' : NUCLEOS[id].nome, ...linhaMedias(c.posts.filter((p) => p.nucleo === id)) }))
    .filter((l) => l.n);
  if (!linhas.length) return '<p class="met-vazio">Nenhum post no período.</p>';
  const maxAlc = Math.max(1, ...linhas.map((l) => l.alcance || 0));
  return `<div class="tabela-wrap"><table class="tab-texto met-tab">
    <thead><tr><th>Núcleo</th><th class="d">Posts</th><th>Alcance médio</th><th class="d">Visualizações</th><th class="d">Interações</th><th class="d">Salvamentos</th><th class="d">Engajamento</th></tr></thead>
    <tbody>${linhas.map((l) => `<tr class="${l.id === 'sem' ? 'sem' : ''}">
      <td><b>${esc(l.nome)}</b></td><td class="num">${n(l.n)}</td>
      <td class="num barra-c"><span class="met-barra"><i style="width:${((l.alcance || 0) / maxAlc) * 100}%"></i></span>${n(l.alcance)}</td>
      <td class="num">${n(l.views)}</td><td class="num">${n(l.inter)}</td><td class="num">${n(l.salvos)}</td><td class="num">${pct(l.engaj)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

function codigoModelo(nucleo, modeloId) {
  const lista = modelosDo(nucleo);
  const i = lista.findIndex((m) => m.id === modeloId);
  return i < 0 ? { cod: '—', nome: modeloId || '—' } : { cod: `${NUCLEOS[nucleo].sigla.toUpperCase()}-${String(i + 1).padStart(2, '0')}`, nome: lista[i].nome };
}

function tabelaModelos(c) {
  const grupos = {};
  for (const p of c.posts) {
    if (!p.pub?.capa) continue;
    const k = `${p.pub.nucleo}|${p.pub.capa}`;
    (grupos[k] = grupos[k] || []).push(p);
  }
  const linhas = Object.entries(grupos).map(([k, ps]) => {
    const [nucleo, capa] = k.split('|');
    return { nucleo, ...codigoModelo(nucleo, capa), ...linhaMedias(ps) };
  }).sort((a, b) => (b.engaj ?? -1) - (a.engaj ?? -1));
  if (!linhas.length) return '<p class="met-vazio">Ligue posts a publicações do Universo (tabela abaixo) para comparar os modelos de capa.</p>';
  return `<div class="tabela-wrap"><table class="tab-texto met-tab">
    <thead><tr><th>Modelo</th><th>Núcleo</th><th class="d">Posts</th><th class="d">Alcance médio</th><th class="d">Interações</th><th class="d">Salvamentos</th><th class="d">Engajamento</th></tr></thead>
    <tbody>${linhas.map((l) => `<tr>
      <td><span class="met-cod">${esc(l.cod)}</span> ${esc(l.nome)}</td><td>${esc(NUCLEOS[l.nucleo]?.nome || '')}</td>
      <td class="num">${n(l.n)}</td><td class="num">${n(l.alcance)}</td><td class="num">${n(l.inter)}</td><td class="num">${n(l.salvos)}</td><td class="num">${pct(l.engaj)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

const COLS = [
  ['data', 'Data', (p) => p.data],
  ['alcance', 'Alcance', (p) => p.m.alcance],
  ['views', 'Visualiz.', (p) => p.m.views],
  ['inter', 'Interações', (p) => p.inter],
  ['salvos', 'Salvos', (p) => p.m.salvos],
  ['compart', 'Compart.', (p) => p.m.compart],
  ['engaj', 'Engaj.', (p) => p.engaj],
];

function opcoesPub(p) {
  const atual = p.vinc?.pub || '';
  const lista = [...resumos].sort((a, b) => (b.dataPublicacao || b.criado || '').localeCompare(a.dataPublicacao || a.criado || ''));
  const rot = (r) => `${r.dataPublicacao ? dataCurta(r.dataPublicacao) + ' · ' : ''}${NUCLEOS[r.nucleo]?.nome || ''} · ${r.titulo || 'sem título'}`;
  return `<option value="">${p.vinc && !p.vinc.pub ? 'Sem publicação' : '— ligar a uma publicação —'}</option>
    ${p.vinc && !p.vinc.pub ? '' : '<option value="-">Sem publicação</option>'}
    ${lista.map((r) => `<option value="${esc(r.id)}" ${r.id === atual ? 'selected' : ''}>${esc(rot(r))}</option>`).join('')}`;
}

function tabelaPosts(c) {
  if (!c.posts.length) return '<p class="met-vazio">Nenhum post no período.</p>';
  const col = COLS.find((k) => k[0] === ordem.col) || COLS[0];
  const posts = [...c.posts].sort((a, b) => {
    const va = col[2](a); const vb = col[2](b);
    if (va == null) return 1; if (vb == null) return -1;
    return (va < vb ? -1 : va > vb ? 1 : 0) * (ordem.desc ? -1 : 1);
  });
  const th = ([k, r]) => `<th class="ord ${k === 'data' ? '' : 'd'} ${ordem.col === k ? (ordem.desc ? 'desc' : 'asc') : ''}" data-ord="${k}">${r}</th>`;
  return `<div class="tabela-wrap"><table class="tab-texto met-tab met-posts">
    <thead><tr><th></th>${th(COLS[0])}<th>Post</th><th>Publicação do Universo</th>${COLS.slice(1).map(th).join('')}</tr></thead>
    <tbody>${posts.map((p) => `<tr>
      <td class="mini-c"><a href="${esc(p.link)}" target="_blank" rel="noopener" class="met-mini" data-mini="${p.mini ? p.id : ''}"></a></td>
      <td class="dt">${dataCurta(p.dia)}</td>
      <td class="leg"><span class="met-tipo">${esc(p.produto === 'REELS' ? 'Reel' : TIPOS[p.tipo] || p.tipo)}</span> <a href="${esc(p.link)}" target="_blank" rel="noopener">${esc((p.legenda || 'sem legenda').split('\n')[0].slice(0, 90))}</a></td>
      <td class="vinc"><select data-vincular="${p.id}" class="${p.pub ? 'ligado' : ''}">${opcoesPub(p)}</select>${p.vinc?.auto ? '<small class="auto" title="Ligado automaticamente pela data de publicação">auto</small>' : ''}</td>
      <td class="num">${n(p.m.alcance)}</td><td class="num">${n(p.m.views)}</td><td class="num">${n(p.inter)}</td>
      <td class="num">${n(p.m.salvos)}</td><td class="num">${n(p.m.compart)}</td><td class="num">${pct(p.engaj)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

async function carregarMinis() {
  for (const a of raiz.querySelectorAll('[data-mini]')) {
    const id = a.dataset.mini;
    if (!id) continue;
    try {
      if (!minis.has(id)) minis.set(id, await nuvem.igMiniatura(id));
      a.style.backgroundImage = `url(${minis.get(id)})`;
    } catch { /* sem miniatura */ }
  }
}

// ---------------------------------------------------------------------------
// Eventos

function msg(t, erro, id = '#metMsg') {
  const el = raiz.querySelector(id);
  if (el) { el.textContent = t; el.classList.toggle('erro', !!erro); }
}

function ligar() {
  raiz.dataset.ligado = '1';
  raiz.addEventListener('submit', async (e) => {
    if (e.target.id === 'metLogin') {
      e.preventDefault();
      const bt = raiz.querySelector('#metEntrar');
      bt.disabled = true;
      msg('Abrindo o login do Meta…');
      try {
        const { url } = await nuvem.igLogin({
          appId: raiz.querySelector('#metApp').value,
          config: raiz.querySelector('#metConfig').value,
          segredo: raiz.querySelector('#metSegredo').value,
          volta: location.origin + location.pathname,
        });
        location.href = url;
      } catch (err) {
        msg(err.message, true);
        bt.disabled = false;
      }
      return;
    }
    if (e.target.id !== 'metForm') return;
    e.preventDefault();
    const bt = raiz.querySelector('#metConectar');
    bt.disabled = true;
    msg('Conectando e buscando os primeiros números… pode levar alguns segundos.', false, '#metMsgToken');
    try {
      await nuvem.igConectar(raiz.querySelector('#metToken').value);
      await carregar();
    } catch (err) {
      msg(err.message, true, '#metMsgToken');
      bt.disabled = false;
    }
  });
  raiz.addEventListener('click', async (e) => {
    const seg = e.target.closest('.met-seg button');
    if (seg) {
      const grupo = seg.parentElement.dataset.grupo;
      if (grupo === 'periodo') periodo = seg.dataset.v;
      if (grupo === 'serie') serie = seg.dataset.v;
      desenhar();
      return;
    }
    const th = e.target.closest('th[data-ord]');
    if (th) {
      const k = th.dataset.ord;
      ordem = ordem.col === k ? { col: k, desc: !ordem.desc } : { col: k, desc: true };
      desenhar();
      return;
    }
    if (e.target.id === 'metAtualizar') {
      e.target.disabled = true;
      e.target.textContent = 'Atualizando…';
      try { await nuvem.igColetar(); } catch { /* o erro aparece no estado */ }
      await carregar();
      return;
    }
    if (e.target.id === 'metDesconectar') {
      if (!confirm('Desconectar o Instagram? O histórico já coletado continua guardado.')) return;
      await nuvem.igDesconectar();
      await carregar();
    }
  });
  raiz.addEventListener('change', async (e) => {
    const sel = e.target.closest('select[data-vincular]');
    if (!sel) return;
    const id = sel.dataset.vincular;
    const v = sel.value === '-' ? null : sel.value || null;
    if (sel.value === '' ) return;
    sel.disabled = true;
    try {
      await nuvem.igVincular(id, v);
      await carregar();
    } catch (err) {
      sel.disabled = false;
      alert('Não foi possível ligar: ' + err.message);
    }
  });
}
