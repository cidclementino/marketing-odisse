// Universo — métricas do Instagram (API do Instagram com login do Instagram).
//
// Chaves no KV `UNIVERSO`:
//   ig:token     -> { token, usuarioId, criado, renovado, expira }   (nunca sai pela API)
//   ig:estado    -> { usuario, nome, foto, seguidores, seguindo, nposts, ultimaColeta, erro }
//   ig:dias      -> { 'AAAA-MM-DD': { alcance, views, contas, interacoes, curtidas, comentarios,
//                                    salvos, compart, toques, novos, seguidores } }
//   ig:posts     -> { <mediaId>: { id, tipo, produto, link, data, dia, legenda, m: {...}, hist: { dia: {...} }, mini } }
//   ig:vinculos  -> { <mediaId>: { pub, auto } }   (post do Instagram ↔ publicação do Universo)
//   igmini:<id>  -> miniatura do post (binário), porque os links do Instagram expiram
//
// A coleta roda todo dia pelo cron (wrangler.toml) e também pelo botão "Atualizar agora".

const API = 'https://graph.instagram.com/v24.0';
const DIA_MS = 86400000;
const FUSO_MS = -3 * 3600000; // Brasília, sem horário de verão
const HIST_DIAS = 90;          // histórico diário de cada post nos primeiros 90 dias
const MINIS_POR_COLETA = 12;
const LIMITE_CHAMADAS = 42;    // o plano gratuito do Worker aceita 50 chamadas externas por execução

const METRICAS_POST = ['reach', 'views', 'saved', 'shares', 'total_interactions', 'likes', 'comments'];
const NOME_POST = { reach: 'alcance', views: 'views', saved: 'salvos', shares: 'compart', total_interactions: 'interacoes', likes: 'curtidas', comments: 'comentarios' };
const METRICAS_CONTA = ['reach', 'views', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'saves', 'shares', 'profile_links_taps'];
const NOME_CONTA = { reach: 'alcance', views: 'views', accounts_engaged: 'contas', total_interactions: 'interacoes', likes: 'curtidas', comments: 'comentarios', saves: 'salvos', shares: 'compart', profile_links_taps: 'toques' };

/** Data local (Brasília) no formato AAAA-MM-DD. */
export const diaLocal = (ms) => new Date(ms + FUSO_MS).toISOString().slice(0, 10);
/** Início do dia local em segundos UNIX. */
const inicioDia = (dia) => Math.floor((Date.parse(dia + 'T00:00:00Z') - FUSO_MS) / 1000);

class ErroIG extends Error {
  constructor(msg, codigo) { super(msg); this.codigo = codigo; }
}

function cliente(token) {
  let chamadas = 0;
  async function get(caminho, params = {}) {
    if (++chamadas > LIMITE_CHAMADAS) throw new ErroIG('limite de chamadas desta execução', 'limite');
    const url = caminho.startsWith('http') ? new URL(caminho) : new URL(API + caminho);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (!url.searchParams.has('access_token')) url.searchParams.set('access_token', token);
    const res = await fetch(url.toString());
    const corpo = await res.json().catch(() => ({}));
    if (!res.ok || corpo.error) {
      const e = corpo.error || {};
      throw new ErroIG(e.message || `Instagram respondeu ${res.status}`, e.code === 190 ? 'token' : e.code || res.status);
    }
    return corpo;
  }
  return { get, restantes: () => LIMITE_CHAMADAS - chamadas };
}

const valorDe = (item) => item?.total_value?.value ?? item?.values?.[0]?.value ?? null;

// ---------------------------------------------------------------------------
// Conexão

export async function conectar(env, token) {
  token = String(token || '').trim();
  if (token.length < 20) throw new ErroIG('Token inválido.', 'token');
  const ig = cliente(token);
  const eu = await ig.get('/me', { fields: 'user_id,username,account_type' });
  if (eu.account_type && !/BUSINESS|MEDIA_CREATOR|CREATOR/i.test(eu.account_type)) {
    throw new ErroIG('A conta precisa ser profissional (empresa ou criador).', 'conta');
  }
  const agora = Date.now();
  await env.UNIVERSO.put('ig:token', JSON.stringify({
    token, usuarioId: eu.user_id || eu.id, criado: agora, renovado: agora, expira: agora + 60 * DIA_MS,
  }));
  return coletar(env, { inicial: true });
}

export async function desconectar(env) {
  await env.UNIVERSO.delete('ig:token');
  const estado = (await env.UNIVERSO.get('ig:estado', 'json')) || {};
  await env.UNIVERSO.put('ig:estado', JSON.stringify({ ...estado, erro: '' }));
}

export async function estado(env) {
  const [tk, est] = await Promise.all([env.UNIVERSO.get('ig:token', 'json'), env.UNIVERSO.get('ig:estado', 'json')]);
  return { conectado: !!tk, expira: tk?.expira || null, ...(est || {}) };
}

// ---------------------------------------------------------------------------
// Coleta

export async function coletar(env, { inicial = false } = {}) {
  const kv = env.UNIVERSO;
  const tk = await kv.get('ig:token', 'json');
  if (!tk) return { ok: false, erro: 'Instagram não conectado.' };
  const est = (await kv.get('ig:estado', 'json')) || {};
  const agora = Date.now();
  const hoje = diaLocal(agora);
  const avisos = [];

  try {
    // 1. renova o token uma vez por semana (vale 60 dias; precisa ter mais de 24 h)
    if (agora - tk.renovado > 7 * DIA_MS) {
      try {
        const r = await cliente(tk.token).get('https://graph.instagram.com/refresh_access_token', { grant_type: 'ig_refresh_token' });
        if (r.access_token) {
          Object.assign(tk, { token: r.access_token, renovado: agora, expira: agora + (r.expires_in || 60 * 86400) * 1000 });
          await kv.put('ig:token', JSON.stringify(tk));
        }
      } catch (e) {
        if (e.codigo === 'token') throw e;
        avisos.push('renovação do token: ' + e.message);
      }
    }
    const ig = cliente(tk.token);

    // 2. perfil
    const perfil = await ig.get('/me', { fields: 'username,name,profile_picture_url,followers_count,follows_count,media_count' });
    Object.assign(est, {
      usuario: perfil.username, nome: perfil.name || '', foto: perfil.profile_picture_url || '',
      seguidores: perfil.followers_count ?? null, seguindo: perfil.follows_count ?? null, nposts: perfil.media_count ?? null,
    });

    // 3. métricas diárias da conta (ontem e dias que faltarem na última semana)
    const dias = (await kv.get('ig:dias', 'json')) || {};
    dias[hoje] = { ...(dias[hoje] || {}), seguidores: perfil.followers_count ?? null };
    if (inicial) await historicoInicial(ig, dias, agora).catch((e) => avisos.push('histórico: ' + e.message));
    for (let i = 7; i >= 1; i--) {
      const d = diaLocal(agora - i * DIA_MS);
      if (dias[d]?.completo) continue;
      if (ig.restantes() < 20) break;
      try {
        // os números de ontem ainda mudam; só os de anteontem para trás ficam fechados
        Object.assign((dias[d] = dias[d] || {}), await metricasDoDia(ig, d), { completo: i >= 2 });
      } catch (e) {
        if (e.codigo === 'token') throw e;
        avisos.push(`conta ${d}: ${e.message}`);
      }
    }
    await kv.put('ig:dias', JSON.stringify(dias));

    // 4. posts e métricas de cada um
    const posts = (await kv.get('ig:posts', 'json')) || {};
    const lista = await listarPosts(ig, avisos);
    for (const p of lista) {
      const ant = posts[p.id] || { hist: {} };
      const m = { ...(ant.m || {}), ...p.m };
      const hist = ant.hist || {};
      if (Date.parse(p.data) > agora - HIST_DIAS * DIA_MS) hist[hoje] = m;
      for (const d of Object.keys(hist)) if (Date.parse(d) - Date.parse(p.dia) > HIST_DIAS * DIA_MS) delete hist[d];
      posts[p.id] = { ...ant, ...p, m, hist, atualizado: agora };
    }

    // 5. miniaturas (os links do Instagram expiram; guardamos uma cópia)
    const semMini = lista.filter((p) => !posts[p.id].mini && p.imagem).slice(0, Math.min(MINIS_POR_COLETA, ig.restantes() - 2));
    for (const p of semMini) {
      try {
        const r = await fetch(p.imagem);
        if (!r.ok) continue;
        const tipo = r.headers.get('content-type') || 'image/jpeg';
        await kv.put(`igmini:${p.id}`, await r.arrayBuffer(), { metadata: { tipo } });
        posts[p.id].mini = true;
      } catch { /* tenta na próxima coleta */ }
    }
    for (const p of Object.values(posts)) delete p.imagem;
    await kv.put('ig:posts', JSON.stringify(posts));

    // 6. vínculo automático com as publicações do Universo (mesma data de publicação)
    await vincularAutomatico(kv, posts, agora).catch((e) => avisos.push('vínculo: ' + e.message));

    Object.assign(est, { ultimaColeta: agora, erro: '', avisos });
    await kv.put('ig:estado', JSON.stringify(est));
    return { ok: true, avisos };
  } catch (e) {
    const msg = e.codigo === 'token'
      ? 'O token do Instagram expirou ou foi revogado. Gere um novo e conecte de novo.'
      : e.message;
    Object.assign(est, { erro: msg, ultimaTentativa: agora, avisos });
    await kv.put('ig:estado', JSON.stringify(est));
    return { ok: false, erro: msg };
  }
}

async function metricasDoDia(ig, dia) {
  const params = { period: 'day', metric_type: 'total_value', since: inicioDia(dia), until: inicioDia(dia) + 86400 };
  const out = {};
  try {
    const r = await ig.get('/me/insights', { ...params, metric: METRICAS_CONTA.join(',') });
    for (const it of r.data || []) out[NOME_CONTA[it.name]] = valorDe(it);
  } catch (e) {
    if (e.codigo === 'token' || e.codigo === 'limite') throw e;
    // alguma métrica não é aceita: pede só as principais, uma a uma
    for (const met of ['reach', 'views', 'accounts_engaged', 'total_interactions']) {
      try {
        const r = await ig.get('/me/insights', { ...params, metric: met });
        out[NOME_CONTA[met]] = valorDe(r.data?.[0]);
      } catch (e2) { if (e2.codigo === 'token' || e2.codigo === 'limite') throw e2; }
    }
  }
  return out;
}

/** Na primeira conexão: alcance e novos seguidores dos últimos 30 dias (série diária). */
async function historicoInicial(ig, dias, agora) {
  const since = inicioDia(diaLocal(agora - 30 * DIA_MS));
  const until = inicioDia(diaLocal(agora));
  for (const [met, campo] of [['reach', 'alcance'], ['follower_count', 'novos']]) {
    try {
      const r = await ig.get('/me/insights', { metric: met, period: 'day', since, until });
      for (const v of r.data?.[0]?.values || []) {
        const d = diaLocal(Date.parse(v.end_time) - DIA_MS);
        dias[d] = dias[d] || {};
        if (dias[d][campo] == null) dias[d][campo] = v.value;
      }
    } catch (e) { if (e.codigo === 'token') throw e; }
  }
}

async function listarPosts(ig, avisos) {
  const base = 'id,caption,media_type,media_product_type,permalink,timestamp,media_url,thumbnail_url,like_count,comments_count';
  const out = [];
  let comInsights = true;
  let prox = null;
  for (let pag = 0; pag < 10; pag++) {
    if (ig.restantes() < 4) { avisos.push('posts mais antigos ficam para a próxima coleta'); break; }
    let r;
    try {
      r = prox
        ? await ig.get(prox)
        : await ig.get('/me/media', { limit: 50, fields: comInsights ? `${base},insights.metric(${METRICAS_POST.join(',')})` : base });
    } catch (e) {
      if (e.codigo === 'token' || pag > 0 || !comInsights) throw e;
      comInsights = false; // algum post não aceita as métricas em lote: lista sem elas e pede uma a uma
      pag--; continue;
    }
    for (const it of r.data || []) {
      const m = { curtidas: it.like_count ?? null, comentarios: it.comments_count ?? null };
      for (const ins of it.insights?.data || []) m[NOME_POST[ins.name]] = valorDe(ins);
      out.push({
        id: it.id, tipo: it.media_type, produto: it.media_product_type || '', link: it.permalink,
        data: it.timestamp, dia: diaLocal(Date.parse(it.timestamp)), legenda: String(it.caption || '').slice(0, 400),
        imagem: it.media_type === 'VIDEO' ? it.thumbnail_url : it.media_url, m,
      });
    }
    prox = r.paging?.next;
    if (!prox) break;
  }
  if (!comInsights) {
    // pede métricas só dos posts mais recentes, dentro do limite de chamadas
    for (const p of out) {
      if (ig.restantes() < MINIS_POR_COLETA / 2) break;
      try {
        const r = await ig.get(`/${p.id}/insights`, { metric: METRICAS_POST.filter((x) => x !== 'likes' && x !== 'comments').join(',') });
        for (const ins of r.data || []) p.m[NOME_POST[ins.name]] = valorDe(ins);
      } catch (e) { if (e.codigo === 'token') throw e; }
    }
  }
  return out;
}

async function vincularAutomatico(kv, posts, agora) {
  const vinc = (await kv.get('ig:vinculos', 'json')) || {};
  const soltos = Object.values(posts).filter((p) => !vinc[p.id] && Date.parse(p.data) > agora - 120 * DIA_MS);
  if (!soltos.length) return;
  const usadas = new Set(Object.values(vinc).map((v) => v.pub));
  const porDia = {};
  let cursor;
  do {
    const pag = await kv.list({ prefix: 'resumo:', cursor });
    for (const k of pag.keys) {
      const id = k.name.slice(7);
      if (usadas.has(id)) continue;
      const r = await kv.get(k.name, 'json');
      let dia = r?.dataPublicacao;
      if (dia === undefined) dia = (await kv.get(`pub:${id}`, 'json'))?.globais?.dataPublicacao;
      if (dia) (porDia[dia] = porDia[dia] || []).push(id);
    }
    cursor = pag.list_complete ? undefined : pag.cursor;
  } while (cursor);
  let mudou = false;
  for (const p of soltos) {
    const cands = porDia[p.dia] || [];
    const doDia = soltos.filter((q) => q.dia === p.dia);
    if (cands.length === 1 && doDia.length === 1) {
      vinc[p.id] = { pub: cands[0], auto: true };
      mudou = true;
    }
  }
  if (mudou) await kv.put('ig:vinculos', JSON.stringify(vinc));
}

// ---------------------------------------------------------------------------
// Leitura para a página de métricas

export async function metricas(env) {
  const kv = env.UNIVERSO;
  const [est, tk, dias, posts, vinc] = await Promise.all([
    kv.get('ig:estado', 'json'), kv.get('ig:token', 'json'), kv.get('ig:dias', 'json'),
    kv.get('ig:posts', 'json'), kv.get('ig:vinculos', 'json'),
  ]);
  const pubs = {};
  await Promise.all([...new Set(Object.values(vinc || {}).map((v) => v.pub))].map(async (id) => {
    const p = await kv.get(`pub:${id}`, 'json');
    if (p) pubs[id] = { id, nucleo: p.nucleo, titulo: p.titulo || p.globais?.projeto || '', ncards: p.cards?.length || 0, capa: p.cards?.[0]?.modelo || '' };
  }));
  return {
    estado: { conectado: !!tk, expira: tk?.expira || null, ...(est || {}) },
    dias: dias || {},
    posts: Object.values(posts || {}).sort((a, b) => b.data.localeCompare(a.data)),
    vinculos: vinc || {},
    pubs,
  };
}

export async function vincular(env, mediaId, pubId) {
  const vinc = (await env.UNIVERSO.get('ig:vinculos', 'json')) || {};
  if (pubId) {
    for (const [k, v] of Object.entries(vinc)) if (v.pub === pubId && k !== mediaId) delete vinc[k];
    vinc[mediaId] = { pub: pubId, auto: false };
  } else {
    vinc[mediaId] = { pub: null, auto: false }; // "sem publicação" explícito: o automático não mexe mais
  }
  await env.UNIVERSO.put('ig:vinculos', JSON.stringify(vinc));
  return vinc[mediaId];
}

export { ErroIG };
