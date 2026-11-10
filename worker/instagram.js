// Universo — métricas do Instagram (API do Instagram com login do Instagram).
//
// Chaves no KV `UNIVERSO`:
//   ig:token     -> { modo: 'unificado'|'instagram', token, igId, criado, renovado, expira }   (nunca sai pela API)
//   ig:app       -> { appId, segredo, config, volta }   (login unificado; o segredo nunca sai pela API)
//   ig:estado    -> { usuario, nome, foto, seguidores, seguindo, nposts, ultimaColeta, erro }
//   ig:dias      -> { 'AAAA-MM-DD': { alcance, views, contas, interacoes, curtidas, comentarios,
//                                    salvos, compart, toques, novos, seguidores } }
//   ig:posts     -> { <mediaId>: { id, tipo, produto, link, data, dia, legenda, m: {...}, hist: { dia: {...} }, mini } }
//   ig:vinculos  -> { <mediaId>: { pub, auto } }   (post do Instagram ↔ publicação do Universo)
//   igmini:<id>  -> miniatura do post (binário), porque os links do Instagram expiram
//
// A coleta roda todo dia pelo cron (wrangler.toml) e também pelo botão "Atualizar agora".

const API_IG = 'https://graph.instagram.com/v24.0'; // login do Instagram (token IGAA…, apps antigos)
const API_FB = 'https://graph.facebook.com/v24.0';  // login unificado (token de usuário do sistema, apps novos)
const DIALOGO = 'https://www.facebook.com/v24.0/dialog/oauth';
export const RETORNO = 'https://universo-odisse.reservaprojectbasework.workers.dev/api/instagram/retorno';
const VOLTAS = [/^https:\/\/marketing\.odisse\.com\.br\//, /^http:\/\/localhost(:\d+)?\//];
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

/** Cota de chamadas externas compartilhada por toda a execução (perfil, posts, concorrentes…). */
export const novaCota = () => ({ usadas: 0 });

export function cliente(token, base = API_IG, cota = novaCota()) {
  async function get(caminho, params = {}) {
    if (++cota.usadas > LIMITE_CHAMADAS) throw new ErroIG('limite de chamadas desta execução', 'limite');
    const url = caminho.startsWith('http') ? new URL(caminho) : new URL(base + caminho);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (token && !url.searchParams.has('access_token')) url.searchParams.set('access_token', token);
    const res = await fetch(url.toString());
    const corpo = await res.json().catch(() => ({}));
    if (!res.ok || corpo.error) {
      const e = corpo.error || {};
      throw new ErroIG(e.message || `Instagram respondeu ${res.status}`, e.code === 190 ? 'token' : e.code || res.status);
    }
    return corpo;
  }
  return { get, restantes: () => LIMITE_CHAMADAS - cota.usadas, cota };
}

const valorDe = (item) => item?.total_value?.value ?? item?.values?.[0]?.value ?? null;

// ---------------------------------------------------------------------------
// Conexão

/** Cliente e caminho da conta conforme o tipo de token. */
export const acesso = (tk, cota) => (tk.modo === 'unificado'
  ? { ig: cliente(tk.token, API_FB, cota), raiz: `/${tk.igId}` }
  : { ig: cliente(tk.token, API_IG, cota), raiz: '/me' });

/** Conecta com um token colado (IGAA… do login do Instagram ou EAA… de usuário do sistema). */
export async function conectar(env, token, igId) {
  igId = /^\d{5,32}$/.test(String(igId || '').trim()) ? String(igId).trim() : '';
  token = String(token || '').trim();
  if (token.length < 20) throw new ErroIG('Token inválido.', 'token');
  if (/^IG/.test(token)) {
    const eu = await cliente(token, API_IG).get('/me', { fields: 'user_id,username,account_type' });
    if (eu.account_type && !/BUSINESS|MEDIA_CREATOR|CREATOR/i.test(eu.account_type)) {
      throw new ErroIG('A conta precisa ser profissional (empresa ou criador).', 'conta');
    }
    const agora = Date.now();
    await env.UNIVERSO.put('ig:token', JSON.stringify({
      modo: 'instagram', token, igId: eu.user_id || eu.id, criado: agora, renovado: agora, expira: agora + 60 * DIA_MS,
    }));
  } else {
    await guardarUnificado(env, token, null, igId);
  }
  return coletar(env, { inicial: true });
}

/** Descobre a conta do Instagram que o token alcança, por vários caminhos. */
async function acharConta(env, token, igIdDado) {
  const fb = cliente(token, API_FB);
  const tentativas = [];
  if (igIdDado) return { id: igIdDado };
  // 1. usuário do sistema do login unificado
  try {
    const r = await fb.get('/me/assigned_instagram_accounts', { fields: 'id,username' });
    if (r.data?.length) return r.data.find((c) => /odisse/i.test(c.username || '')) || r.data[0];
    tentativas.push('contas atribuídas: nenhuma');
  } catch (e) { if (e.codigo === 'token') throw e; tentativas.push('contas atribuídas: ' + e.message); }
  // 2. permissões concedidas ao token (debug_token lista a conta autorizada)
  const app = await env.UNIVERSO.get('ig:app', 'json');
  if (app?.appId && app?.segredo) {
    try {
      const r = await cliente('', API_FB).get('/debug_token', { input_token: token, access_token: `${app.appId}|${app.segredo}` });
      const ids = new Set();
      for (const g of r.data?.granular_scopes || []) if (/^instagram_/.test(g.scope)) for (const t of g.target_ids || []) ids.add(t);
      for (const id of ids) {
        try { const c = await fb.get(`/${id}`, { fields: 'id,username' }); if (c.username) return { ...c, id }; } catch { /* não é conta do Instagram */ }
      }
      tentativas.push('permissões do token: nenhuma conta');
    } catch (e) { tentativas.push('permissões do token: ' + e.message); }
  }
  // 3. conta ligada a uma Página do Facebook
  try {
    const r = await fb.get('/me/accounts', { fields: 'instagram_business_account{id,username}' });
    const c = (r.data || []).map((p) => p.instagram_business_account).find(Boolean);
    if (c) return c;
    tentativas.push('páginas: nenhuma conta');
  } catch (e) { tentativas.push('páginas: ' + e.message); }
  throw new ErroIG(`Não encontrei a conta do Instagram por este token (${tentativas.join('; ')}). Informe o ID da conta do Instagram no campo opcional — ele aparece no portfólio empresarial, em Contas → Contas do Instagram.`, 'conta');
}

async function guardarUnificado(env, token, expiraEm, igIdDado) {
  const conta = await acharConta(env, token, igIdDado);
  // confere o acesso à conta antes de guardar
  const perfil = await cliente(token, API_FB).get(`/${conta.id}`, { fields: 'id,username' });
  const agora = Date.now();
  await env.UNIVERSO.put('ig:token', JSON.stringify({
    modo: 'unificado', token, igId: perfil.id || conta.id, usuario: perfil.username || conta.username, criado: agora, renovado: agora,
    expira: expiraEm ? agora + expiraEm * 1000 : null,
  }));
}

// ---- Login unificado (Facebook Login for Business com configuração de token de sistema)

async function assinar(env, texto) {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.UNIVERSO_SENHA || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(texto));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Guarda os dados do app e devolve o endereço de login. */
export async function iniciarLogin(env, { appId, segredo, config, volta, igId } = {}) {
  const ant = (await env.UNIVERSO.get('ig:app', 'json')) || {};
  const app = {
    appId: String(appId || ant.appId || '').trim(),
    segredo: String(segredo || ant.segredo || '').trim(),
    config: String(config || ant.config || '').trim(),
    volta: VOLTAS.some((r) => r.test(volta || '')) ? volta : ant.volta || 'https://marketing.odisse.com.br/',
    igId: /^\d{5,32}$/.test(String(igId || '').trim()) ? String(igId).trim() : '',
  };
  if (!/^\d{5,32}$/.test(app.appId)) throw new ErroIG('ID do app inválido (só números).', 'app');
  if (!/^\d{5,32}$/.test(app.config)) throw new ErroIG('ID da configuração inválido (só números).', 'app');
  if (app.segredo.length < 16) throw new ErroIG('Falta a chave secreta do app.', 'app');
  await env.UNIVERSO.put('ig:app', JSON.stringify(app));
  const ts = String(Date.now());
  const url = new URL(DIALOGO);
  url.searchParams.set('client_id', app.appId);
  url.searchParams.set('config_id', app.config);
  url.searchParams.set('redirect_uri', RETORNO);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('override_default_response_type', 'true');
  url.searchParams.set('state', `${ts}.${await assinar(env, ts)}`);
  return { url: url.toString() };
}

/** Retorno do login: troca o código pelo token e volta para o Universo. */
export async function retornoLogin(env, params) {
  const app = (await env.UNIVERSO.get('ig:app', 'json')) || {};
  const volta = (app.volta || 'https://marketing.odisse.com.br/') + '#/metricas';
  const falhar = async (msg) => {
    const est = (await env.UNIVERSO.get('ig:estado', 'json')) || {};
    await env.UNIVERSO.put('ig:estado', JSON.stringify({ ...est, erro: msg }));
    return Response.redirect(volta, 302);
  };
  if (params.get('error')) return falhar(`Login cancelado ou recusado: ${params.get('error_description') || params.get('error')}`);
  const [ts, sig] = String(params.get('state') || '').split('.');
  if (!ts || sig !== (await assinar(env, ts)) || Date.now() - Number(ts) > 30 * 60000) return falhar('Login expirado. Tente de novo.');
  const code = params.get('code');
  if (!code) return falhar('O Meta não devolveu o código de acesso.');
  try {
    const r = await cliente('', API_FB).get('/oauth/access_token', {
      client_id: app.appId, client_secret: app.segredo, redirect_uri: RETORNO, code,
    });
    if (!r.access_token) return falhar('O Meta não devolveu o token.');
    await guardarUnificado(env, r.access_token, r.expires_in, app.igId);
    const res = await coletar(env, { inicial: true });
    if (!res.ok) return falhar(res.erro);
    return Response.redirect(volta, 302);
  } catch (e) {
    return falhar(e.message);
  }
}

export async function desconectar(env) {
  await env.UNIVERSO.delete('ig:token');
  const estado = (await env.UNIVERSO.get('ig:estado', 'json')) || {};
  await env.UNIVERSO.put('ig:estado', JSON.stringify({ ...estado, erro: '' }));
}

export async function estado(env) {
  const [tk, est] = await Promise.all([env.UNIVERSO.get('ig:token', 'json'), env.UNIVERSO.get('ig:estado', 'json')]);
  return { conectado: !!tk, expira: tk?.expira || null, modo: tk?.modo || null, app: await appPublico(env), ...(est || {}) };
}

async function appPublico(env) {
  const app = await env.UNIVERSO.get('ig:app', 'json');
  return app ? { appId: app.appId, config: app.config, igId: app.igId || '', temSegredo: !!app.segredo } : null;
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
  const cota = novaCota();

  try {
    // 1. renova o token uma vez por semana (vale 60 dias; precisa ter mais de 24 h)
    if (tk.modo !== 'unificado' && agora - tk.renovado > 7 * DIA_MS) {
      try {
        const r = await cliente(tk.token, API_IG, cota).get('https://graph.instagram.com/refresh_access_token', { grant_type: 'ig_refresh_token' });
        if (r.access_token) {
          Object.assign(tk, { token: r.access_token, renovado: agora, expira: agora + (r.expires_in || 60 * 86400) * 1000 });
          await kv.put('ig:token', JSON.stringify(tk));
        }
      } catch (e) {
        if (e.codigo === 'token') throw e;
        avisos.push('renovação do token: ' + e.message);
      }
    }
    const { ig, raiz } = acesso(tk, cota);

    // 2. perfil
    const perfil = await ig.get(raiz, { fields: 'username,name,profile_picture_url,followers_count,follows_count,media_count' });
    Object.assign(est, {
      usuario: perfil.username, nome: perfil.name || '', foto: perfil.profile_picture_url || '',
      seguidores: perfil.followers_count ?? null, seguindo: perfil.follows_count ?? null, nposts: perfil.media_count ?? null,
    });

    // 3. métricas diárias da conta (ontem e dias que faltarem na última semana)
    const dias = (await kv.get('ig:dias', 'json')) || {};
    dias[hoje] = { ...(dias[hoje] || {}), seguidores: perfil.followers_count ?? null };
    if (inicial) await historicoInicial(ig, raiz, dias, agora).catch((e) => avisos.push('histórico: ' + e.message));
    for (let i = 7; i >= 1; i--) {
      const d = diaLocal(agora - i * DIA_MS);
      if (dias[d]?.completo && dias[d]?.v >= 2) continue;
      if (ig.restantes() < 24) break;
      try {
        const base = dias[d]?.completo ? {} : await metricasDoDia(ig, raiz, d);
        // os números de ontem ainda mudam; só os de anteontem para trás ficam fechados
        Object.assign((dias[d] = dias[d] || {}), base, await extrasDoDia(ig, raiz, d), { completo: i >= 2, v: 2 });
      } catch (e) {
        if (e.codigo === 'token') throw e;
        avisos.push(`conta ${d}: ${e.message}`);
      }
    }
    await kv.put('ig:dias', JSON.stringify(dias));

    // 4. posts e métricas de cada um
    const posts = (await kv.get('ig:posts', 'json')) || {};
    const lista = await listarPosts(ig, raiz, avisos);
    for (const p of lista) {
      const ant = posts[p.id] || { hist: {} };
      const m = { ...(ant.m || {}), ...p.m };
      const hist = ant.hist || {};
      if (Date.parse(p.data) > agora - HIST_DIAS * DIA_MS) hist[hoje] = m;
      for (const d of Object.keys(hist)) if (Date.parse(d) - Date.parse(p.dia) > HIST_DIAS * DIA_MS) delete hist[d];
      posts[p.id] = { ...ant, ...p, m, hist, atualizado: agora };
    }

    // 5. concorrentes (uma chamada por conta; só no login unificado)
    if (tk.modo === 'unificado') {
      try {
        const { coletarConcorrentes } = await import('./concorrentes.js');
        await coletarConcorrentes(env, ig, tk.igId, avisos);
      } catch (e) { if (e.codigo === 'token') throw e; avisos.push('concorrentes: ' + e.message); }
    }

    // 6. seguidores online por hora, público e stories
    await coletarOnline(kv, ig, raiz, agora).catch((e) => { if (e.codigo === 'token') throw e; avisos.push('horários: ' + e.message); });
    await coletarPublico(kv, ig, raiz, agora, est).catch((e) => { if (e.codigo === 'token') throw e; avisos.push('público: ' + e.message); });
    await coletarStories(kv, ig, raiz, agora).catch((e) => { if (e.codigo === 'token') throw e; avisos.push('stories: ' + e.message); });

    // 7. métricas extras por post (seguidores ganhos, visitas ao perfil, retenção de reels)
    const novosSemMini = lista.filter((p) => !posts[p.id].mini && p.imagem).length;
    await extrasDePosts(ig, posts, agora, est, Math.min(MINIS_POR_COLETA, novosSemMini) + 1)
      .catch((e) => { if (e.codigo === 'token') throw e; avisos.push('extras dos posts: ' + e.message); });

    // 8. miniaturas (os links do Instagram expiram; guardamos uma cópia)
    const semMini = lista.filter((p) => !posts[p.id].mini && p.imagem).slice(0, Math.max(0, Math.min(MINIS_POR_COLETA, ig.restantes() - 1)));
    for (const p of semMini) {
      try {
        cota.usadas++;
        const r = await fetch(p.imagem);
        if (!r.ok) continue;
        const tipo = r.headers.get('content-type') || 'image/jpeg';
        await kv.put(`igmini:${p.id}`, await r.arrayBuffer(), { metadata: { tipo } });
        posts[p.id].mini = true;
      } catch { /* tenta na próxima coleta */ }
    }
    for (const p of Object.values(posts)) delete p.imagem;
    await kv.put('ig:posts', JSON.stringify(posts));

    // 9. vínculo automático com as publicações do Universo (mesma data de publicação)
    await vincularAutomatico(kv, posts, agora).catch((e) => avisos.push('vínculo: ' + e.message));

    Object.assign(est, { ultimaColeta: agora, erro: '', avisos, chamadas: cota.usadas });
    await kv.put('ig:estado', JSON.stringify(est));
    return { ok: true, avisos };
  } catch (e) {
    const msg = e.codigo === 'token'
      ? 'O acesso ao Instagram expirou ou foi revogado. Entre com o Instagram de novo.'
      : e.message;
    Object.assign(est, { erro: msg, ultimaTentativa: agora, avisos });
    await kv.put('ig:estado', JSON.stringify(est));
    return { ok: false, erro: msg };
  }
}

const fatal = (e) => e.codigo === 'token' || e.codigo === 'limite';
const resultados = (item) => item?.total_value?.breakdowns?.[0]?.results || [];

/** Alcance de seguidores × não seguidores, quem seguiu/deixou de seguir e visitas ao perfil. */
async function extrasDoDia(ig, raiz, dia) {
  const params = { period: 'day', metric_type: 'total_value', since: inicioDia(dia), until: inicioDia(dia) + 86400 };
  const out = {};
  const ler = (r) => {
    for (const it of r.data || []) {
      for (const x of resultados(it)) {
        const tipo = x.dimension_values?.[0];
        if (it.name === 'reach') { if (tipo === 'FOLLOWER') out.alcSeg = x.value; if (tipo === 'NON_FOLLOWER') out.alcNao = x.value; }
        if (it.name === 'follows_and_unfollows') { if (tipo === 'FOLLOWER') out.seguiram = x.value; if (tipo === 'NON_FOLLOWER') out.deixaram = x.value; }
      }
      if (it.name === 'profile_views') out.visitas = valorDe(it);
    }
  };
  try {
    ler(await ig.get(`${raiz}/insights`, { ...params, metric: 'reach,follows_and_unfollows', breakdown: 'follow_type' }));
  } catch (e) {
    if (fatal(e)) throw e;
    for (const met of ['reach', 'follows_and_unfollows']) {
      try { ler(await ig.get(`${raiz}/insights`, { ...params, metric: met, breakdown: 'follow_type' })); } catch (e2) { if (fatal(e2)) throw e2; }
    }
  }
  // sem quebra, quem seguiu vem zerado nas contas pequenas: registra 0 em vez de "sem dado"
  if (out.seguiram === undefined && out.deixaram !== undefined) out.seguiram = 0;
  if (out.deixaram === undefined && out.seguiram !== undefined) out.deixaram = 0;
  try { ler(await ig.get(`${raiz}/insights`, { ...params, metric: 'profile_views' })); } catch (e) { if (fatal(e)) throw e; }
  return out;
}

/**
 * Seguidores online por hora. O Instagram entrega cada dia no horário do Pacífico;
 * aqui tudo vira hora de Brasília: ig:online -> { 'AAAA-MM-DD': { '0'..'23': n } }.
 */
async function coletarOnline(kv, ig, raiz, agora) {
  const online = (await kv.get('ig:online', 'json')) || {};
  const ultimo = Object.keys(online).sort().at(-1);
  if (ultimo && ultimo >= diaLocal(agora - 2 * DIA_MS) && online._buscado === diaLocal(agora)) return;
  if (ig.restantes() < 8) return;
  const desde = ultimo ? Math.max(Date.parse(ultimo) - 2 * DIA_MS, agora - 29 * DIA_MS) : agora - 29 * DIA_MS;
  const r = await ig.get(`${raiz}/insights`, {
    metric: 'online_followers', period: 'lifetime',
    since: Math.floor(desde / 1000), until: Math.floor(agora / 1000),
  });
  for (const v of r.data?.[0]?.values || []) {
    if (!v.value || typeof v.value !== 'object' || !Object.keys(v.value).length) continue;
    const inicioPT = Date.parse(v.end_time) - DIA_MS; // meia-noite do dia no Pacífico, em UTC
    for (const [h, n] of Object.entries(v.value)) {
      const t = inicioPT + Number(h) * 3600000 + FUSO_MS; // mesmo instante, em hora de Brasília
      const iso = new Date(t).toISOString();
      const d = iso.slice(0, 10);
      (online[d] = online[d] || {})[String(Number(iso.slice(11, 13)))] = n;
    }
  }
  online._buscado = diaLocal(agora);
  const corte = diaLocal(agora - 180 * DIA_MS);
  for (const d of Object.keys(online)) if (d !== '_buscado' && d < corte) delete online[d];
  await kv.put('ig:online', JSON.stringify(online));
}

const DEMOS = [['follower_demographics', 'seguidores'], ['reached_audience_demographics', 'alcancados'], ['engaged_audience_demographics', 'engajados']];
const QUEBRAS = [['age', 'idade'], ['gender', 'genero'], ['city', 'cidade'], ['country', 'pais']];
const POR_COLETA_PUBLICO = 6;

/** Público por idade, gênero, cidade e país — atualizado uma vez por semana, aos poucos. */
async function coletarPublico(kv, ig, raiz, agora, est) {
  const pub = (await kv.get('ig:publico', 'json')) || {};
  const fila = [];
  for (const [met, grupo] of DEMOS) for (const [qb, campo] of QUEBRAS) {
    const em = pub[grupo]?.em?.[campo] || 0;
    if (agora - em > 6.5 * DIA_MS) fila.push({ met, grupo, qb, campo, em });
  }
  fila.sort((a, b) => a.em - b.em);
  let feitas = 0;
  let mudouSeg = false;
  for (const it of fila) {
    if (feitas >= POR_COLETA_PUBLICO || ig.restantes() < 10) break;
    feitas++;
    const g = (pub[it.grupo] = pub[it.grupo] || { em: {} });
    g.em = g.em || {};
    let r = null;
    for (const tf of ['this_month', 'this_week', null]) {
      const params = { metric: it.met, period: 'lifetime', metric_type: 'total_value', breakdown: it.qb };
      if (tf) params.timeframe = tf;
      try { r = await ig.get(`${raiz}/insights`, params); g.janela = tf; break; } catch (e) {
        if (fatal(e)) throw e;
        g.erro = e.message;
        if (/100 followers|fewer than|menos de 100/i.test(e.message)) break;
      }
    }
    g.em[it.campo] = agora;
    if (!r) continue;
    const valores = {};
    for (const x of resultados(r.data?.[0])) valores[x.dimension_values?.[0]] = x.value;
    g[it.campo] = valores;
    delete g.erro;
    if (it.grupo === 'seguidores') mudouSeg = true;
  }
  if (!feitas) return;
  await kv.put('ig:publico', JSON.stringify(pub));
  // histórico semanal do perfil dos seguidores (idade, gênero e as 10 maiores cidades)
  if (mudouSeg && pub.seguidores?.idade) {
    const hist = (await kv.get('ig:publico-hist', 'json')) || {};
    const top = Object.entries(pub.seguidores.cidade || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
    hist[diaLocal(agora)] = { idade: pub.seguidores.idade, genero: pub.seguidores.genero || {}, cidade: Object.fromEntries(top), total: est.seguidores ?? null };
    const dias = Object.keys(hist).sort();
    for (const d of dias.slice(0, Math.max(0, dias.length - 104))) delete hist[d];
    await kv.put('ig:publico-hist', JSON.stringify(hist));
  }
}

const METRICAS_STORY = ['reach', 'views', 'replies', 'shares', 'total_interactions', 'follows', 'profile_visits'];
const NOME_STORY = { reach: 'alcance', views: 'views', replies: 'respostas', shares: 'compart', total_interactions: 'interacoes', follows: 'seguiu', profile_visits: 'visitas' };

/** Stories só existem por 24 h: cada coleta guarda os que estiverem no ar. */
async function coletarStories(kv, ig, raiz, agora) {
  if (ig.restantes() < 6) return;
  const base = 'id,media_type,timestamp,permalink';
  let r;
  try {
    r = await ig.get(`${raiz}/stories`, { fields: `${base},insights.metric(${METRICAS_STORY.join(',')})` });
  } catch (e) {
    if (fatal(e)) throw e;
    r = await ig.get(`${raiz}/stories`, { fields: `${base},insights.metric(reach,replies)` });
  }
  if (!r.data?.length) return;
  const st = (await kv.get('ig:stories', 'json')) || {};
  for (const it of r.data) {
    const m = { ...(st[it.id]?.m || {}) };
    for (const ins of it.insights?.data || []) m[NOME_STORY[ins.name]] = valorDe(ins);
    st[it.id] = {
      id: it.id, tipo: it.media_type, link: it.permalink, data: it.timestamp, dia: diaLocal(Date.parse(it.timestamp)),
      m, idadeH: Math.round((agora - Date.parse(it.timestamp)) / 3600000),
    };
  }
  const ids = Object.keys(st).sort((a, b) => st[b].data.localeCompare(st[a].data));
  for (const id of ids.slice(400)) delete st[id];
  await kv.put('ig:stories', JSON.stringify(st));
}

/**
 * Métricas que não vêm na listagem: seguidores ganhos e visitas ao perfil (posts do feed)
 * e tempo médio assistido (reels). Prioriza posts recentes e os que nunca foram buscados.
 * O que cada tipo aceita fica em est.suporte para não repetir chamadas que falham.
 */
const EXTRAS = { FEED: ['follows', 'profile_visits'], REELS: ['ig_reels_avg_watch_time', 'follows', 'profile_visits'] };
const NOME_EXTRA = { follows: 'seguiu', profile_visits: 'visitas', ig_reels_avg_watch_time: 'retencao' };

async function extrasDePosts(ig, posts, agora, est, reserva) {
  est.suporte = est.suporte || {};
  const fila = Object.values(posts)
    .filter((p) => EXTRAS[p.produto === 'REELS' ? 'REELS' : 'FEED'])
    .map((p) => {
      const recente = agora - Date.parse(p.data) < 30 * DIA_MS;
      const prazo = recente ? DIA_MS * 0.9 : 30 * DIA_MS;
      return { p, recente, vencido: !p.x || agora - p.x > prazo };
    })
    .filter((x) => x.vencido)
    .sort((a, b) => (b.recente - a.recente) || ((a.p.x || 0) - (b.p.x || 0)) || b.p.data.localeCompare(a.p.data));
  for (const { p } of fila) {
    if (ig.restantes() <= reserva + 1) break;
    const tipo = p.produto === 'REELS' ? 'REELS' : 'FEED';
    let mets = est.suporte[tipo] || EXTRAS[tipo];
    if (!mets.length) { p.x = agora; continue; }
    try {
      const r = await ig.get(`/${p.id}/insights`, { metric: mets.join(',') });
      for (const ins of r.data || []) {
        let v = valorDe(ins);
        if (ins.name === 'ig_reels_avg_watch_time' && v != null) v = Math.round(v / 100) / 10; // ms -> s
        p.m[NOME_EXTRA[ins.name]] = v;
      }
      p.x = agora;
      if (!est.suporte[tipo]) est.suporte[tipo] = mets;
    } catch (e) {
      if (fatal(e)) throw e;
      if (est.suporte[tipo]) { p.x = agora; continue; } // já sabíamos o que funciona: este post não tem os dados
      // descobre, métrica a métrica, o que este tipo de post aceita
      const ok = [];
      for (const met of mets) {
        if (ig.restantes() <= reserva + 1) break;
        try {
          const r = await ig.get(`/${p.id}/insights`, { metric: met });
          let v = valorDe(r.data?.[0]);
          if (met === 'ig_reels_avg_watch_time' && v != null) v = Math.round(v / 100) / 10;
          p.m[NOME_EXTRA[met]] = v;
          ok.push(met);
        } catch (e2) { if (fatal(e2)) throw e2; }
      }
      if (ok.length) est.suporte[tipo] = ok;
      p.x = agora;
    }
  }
}

async function metricasDoDia(ig, raiz, dia) {
  const params = { period: 'day', metric_type: 'total_value', since: inicioDia(dia), until: inicioDia(dia) + 86400 };
  const out = {};
  try {
    const r = await ig.get(`${raiz}/insights`, { ...params, metric: METRICAS_CONTA.join(',') });
    for (const it of r.data || []) out[NOME_CONTA[it.name]] = valorDe(it);
  } catch (e) {
    if (e.codigo === 'token' || e.codigo === 'limite') throw e;
    // alguma métrica não é aceita: pede só as principais, uma a uma
    for (const met of ['reach', 'views', 'accounts_engaged', 'total_interactions']) {
      try {
        const r = await ig.get(`${raiz}/insights`, { ...params, metric: met });
        out[NOME_CONTA[met]] = valorDe(r.data?.[0]);
      } catch (e2) { if (e2.codigo === 'token' || e2.codigo === 'limite') throw e2; }
    }
  }
  return out;
}

/** Na primeira conexão: alcance e novos seguidores dos últimos 30 dias (série diária). */
async function historicoInicial(ig, raiz, dias, agora) {
  const since = inicioDia(diaLocal(agora - 30 * DIA_MS));
  const until = inicioDia(diaLocal(agora));
  for (const [met, campo] of [['reach', 'alcance'], ['follower_count', 'novos']]) {
    try {
      const r = await ig.get(`${raiz}/insights`, { metric: met, period: 'day', since, until });
      for (const v of r.data?.[0]?.values || []) {
        const d = diaLocal(Date.parse(v.end_time) - DIA_MS);
        dias[d] = dias[d] || {};
        if (dias[d][campo] == null) dias[d][campo] = v.value;
      }
    } catch (e) { if (e.codigo === 'token') throw e; }
  }
}

async function listarPosts(ig, raiz, avisos) {
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
        : await ig.get(`${raiz}/media`, { limit: 50, fields: comInsights ? `${base},insights.metric(${METRICAS_POST.join(',')})` : base });
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
  const [est, tk, dias, posts, vinc, publico, publicoHist, online, stories, etiquetas] = await Promise.all([
    kv.get('ig:estado', 'json'), kv.get('ig:token', 'json'), kv.get('ig:dias', 'json'),
    kv.get('ig:posts', 'json'), kv.get('ig:vinculos', 'json'), kv.get('ig:publico', 'json'),
    kv.get('ig:publico-hist', 'json'), kv.get('ig:online', 'json'), kv.get('ig:stories', 'json'),
    kv.get('met:etiquetas', 'json'),
  ]);
  const { listaConcorrentes } = await import('./concorrentes.js');
  const pubs = {};
  await Promise.all([...new Set(Object.values(vinc || {}).map((v) => v.pub))].map(async (id) => {
    const p = await kv.get(`pub:${id}`, 'json');
    if (p) pubs[id] = { id, nucleo: p.nucleo, titulo: p.titulo || p.globais?.projeto || '', ncards: p.cards?.length || 0, capa: p.cards?.[0]?.modelo || '' };
  }));
  return {
    estado: { conectado: !!tk, expira: tk?.expira || null, modo: tk?.modo || null, app: await appPublico(env), ...(est || {}) },
    dias: dias || {},
    posts: Object.values(posts || {}).sort((a, b) => b.data.localeCompare(a.data)),
    vinculos: vinc || {},
    pubs,
    publico: publico || {},
    publicoHist: publicoHist || {},
    online: online || {},
    stories: Object.values(stories || {}).sort((a, b) => b.data.localeCompare(a.data)),
    etiquetas: etiquetas || {},
    concorrentes: await listaConcorrentes(env),
  };
}

/** Tema e objetivo de um post (chave = rede:id, ex. ig:1789…). Vazio apaga. */
export async function etiquetar(env, chave, { tema, objetivo } = {}) {
  const et = (await env.UNIVERSO.get('met:etiquetas', 'json')) || {};
  const limpo = (v) => String(v || '').trim().slice(0, 40);
  const novo = { tema: limpo(tema), objetivo: limpo(objetivo) };
  if (!novo.tema && !novo.objetivo) delete et[chave]; else et[chave] = novo;
  await env.UNIVERSO.put('met:etiquetas', JSON.stringify(et));
  return et[chave] || null;
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
