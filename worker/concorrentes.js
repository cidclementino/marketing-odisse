// Universo — concorrentes no Instagram (Business Discovery da API do Meta).
//
// Só dados públicos de contas profissionais (empresa ou criador): perfil, seguidores e,
// de cada post, legenda, data, formato, curtidas, comentários e visualizações (vídeos).
// Alcance, salvamentos e público de outras contas não existem na API.
//
// Chaves no KV `UNIVERSO`:
//   conc:lista       -> [{ usuario, desde }]                    (ordem de inclusão)
//   conc:<usuario>   -> { usuario, perfil: {...}, fotos: { dia: seguidores }, posts: { id: {...} }, atualizado, erro }
//
// Uma chamada por conta em cada coleta diária (dentro da cota do Instagram).

import { novaCota, acesso, diaLocal, ErroIG } from './instagram.js';

export const MAX_CONCORRENTES = 6; // trava: aumentar aqui quando quiser acompanhar mais contas
const MAX_POSTS = 300;
const USUARIO = /^[a-z0-9._]{1,30}$/;

const CAMPOS_POST = 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,view_count';
const CAMPOS_POST_MIN = 'id,caption,media_type,permalink,timestamp,like_count,comments_count';
const CAMPOS_PERFIL = 'username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count';

/** Aceita @usuario, usuario ou o link do perfil. */
export function normalizarUsuario(txt) {
  let u = String(txt || '').trim().toLowerCase();
  const m = u.match(/instagram\.com\/([^/?#]+)/);
  if (m) u = m[1];
  u = u.replace(/^@/, '').replace(/\/+$/, '');
  return USUARIO.test(u) ? u : null;
}

async function consultar(ig, igId, usuario) {
  const pedir = (perfil, post, limite) => ig.get(`/${igId}`, {
    fields: `business_discovery.username(${usuario}){${perfil},media.limit(${limite}){${post}}}`,
  });
  try {
    return (await pedir(CAMPOS_PERFIL, CAMPOS_POST, 30)).business_discovery;
  } catch (e) {
    if (e.codigo === 'token' || e.codigo === 'limite') throw e;
    if (/does not exist|cannot be found|not found|invalid user|2207013/i.test(e.message)) {
      throw new ErroIG(`@${usuario}: conta não encontrada ou não é profissional (empresa/criador). O Instagram só mostra dados de contas profissionais.`, 'conta');
    }
    // algum campo não é aceito para esta conta: tenta o mínimo
    try {
      return (await pedir('username,name,profile_picture_url,followers_count,media_count', CAMPOS_POST_MIN, 30)).business_discovery;
    } catch (e2) {
      if (e2.codigo === 'token' || e2.codigo === 'limite') throw e2;
      throw new ErroIG(`@${usuario}: ${e2.message}`, e2.codigo);
    }
  }
}

function guardar(ant, bd, agora) {
  const c = ant || { usuario: bd.username, fotos: {}, posts: {} };
  c.usuario = (bd.username || c.usuario).toLowerCase();
  c.perfil = {
    nome: bd.name || '', bio: String(bd.biography || '').slice(0, 300), site: bd.website || '',
    foto: bd.profile_picture_url || '', seguidores: bd.followers_count ?? null,
    seguindo: bd.follows_count ?? null, nposts: bd.media_count ?? null,
  };
  if (bd.followers_count != null) c.fotos[diaLocal(agora)] = bd.followers_count;
  for (const it of bd.media?.data || []) {
    c.posts[it.id] = {
      id: it.id, tipo: it.media_type, produto: it.media_product_type || '', link: it.permalink,
      data: it.timestamp, dia: diaLocal(Date.parse(it.timestamp)), legenda: String(it.caption || '').slice(0, 300),
      // curtidas ocultas pelo dono vêm ausentes (ou 0): ficam como "sem dado"
      curtidas: it.like_count || null, comentarios: it.comments_count ?? null, views: it.view_count ?? null,
    };
  }
  const ids = Object.keys(c.posts).sort((a, b) => c.posts[b].data.localeCompare(c.posts[a].data));
  for (const id of ids.slice(MAX_POSTS)) delete c.posts[id];
  const dias = Object.keys(c.fotos).sort();
  for (const d of dias.slice(0, Math.max(0, dias.length - 730))) delete c.fotos[d];
  c.atualizado = agora;
  c.erro = '';
  return c;
}

/** Coleta diária: chamada dentro de coletar() do Instagram, com o mesmo cliente e a mesma cota. */
export async function coletarConcorrentes(env, ig, igId, avisos) {
  const kv = env.UNIVERSO;
  const lista = (await kv.get('conc:lista', 'json')) || [];
  const agora = Date.now();
  for (const { usuario } of lista) {
    if (ig.restantes() < 12) { avisos.push('concorrentes: parte fica para a próxima coleta'); break; }
    const ant = await kv.get(`conc:${usuario}`, 'json');
    if (ant?.atualizado && diaLocal(ant.atualizado) === diaLocal(agora) && !ant.erro) continue;
    try {
      const bd = await consultar(ig, igId, usuario);
      await kv.put(`conc:${usuario}`, JSON.stringify(guardar(ant, bd, agora)));
    } catch (e) {
      if (e.codigo === 'token' || e.codigo === 'limite') throw e;
      await kv.put(`conc:${usuario}`, JSON.stringify({ ...(ant || { usuario, fotos: {}, posts: {} }), erro: e.message, tentativa: agora }));
    }
  }
}

async function tokenUnificado(env) {
  const tk = await env.UNIVERSO.get('ig:token', 'json');
  if (!tk) throw new ErroIG('Conecte o Instagram do Odisse antes de adicionar concorrentes.', 'conta');
  if (tk.modo !== 'unificado') throw new ErroIG('Concorrentes exigem a conexão pelo login unificado do Meta (página Conexões).', 'conta');
  return tk;
}

export async function listaConcorrentes(env) {
  const kv = env.UNIVERSO;
  const lista = (await kv.get('conc:lista', 'json')) || [];
  const contas = await Promise.all(lista.map(async ({ usuario, desde }) => {
    const c = (await kv.get(`conc:${usuario}`, 'json')) || { usuario, fotos: {}, posts: {} };
    return { ...c, desde, posts: Object.values(c.posts || {}).sort((a, b) => b.data.localeCompare(a.data)) };
  }));
  return { max: MAX_CONCORRENTES, contas };
}

export async function adicionar(env, texto) {
  const usuario = normalizarUsuario(texto);
  if (!usuario) throw new ErroIG('Usuário inválido. Use o @ ou o link do perfil.', 'conta');
  const kv = env.UNIVERSO;
  const lista = (await kv.get('conc:lista', 'json')) || [];
  if (lista.some((c) => c.usuario === usuario)) throw new ErroIG(`@${usuario} já está na lista.`, 'conta');
  if (lista.length >= MAX_CONCORRENTES) {
    throw new ErroIG(`Limite de ${MAX_CONCORRENTES} contas atingido. Remova uma para adicionar outra.`, 'conta');
  }
  const tk = await tokenUnificado(env);
  if (usuario === String(tk.usuario || '').toLowerCase()) throw new ErroIG('Essa é a própria conta do Odisse.', 'conta');
  const { ig } = acesso(tk, novaCota());
  const bd = await consultar(ig, tk.igId, usuario);
  const conta = guardar(null, bd, Date.now());
  await kv.put(`conc:${conta.usuario}`, JSON.stringify(conta));
  lista.push({ usuario: conta.usuario, desde: Date.now() });
  await kv.put('conc:lista', JSON.stringify(lista));
  return listaConcorrentes(env);
}

export async function remover(env, usuario) {
  const u = normalizarUsuario(usuario);
  const kv = env.UNIVERSO;
  const lista = ((await kv.get('conc:lista', 'json')) || []).filter((c) => c.usuario !== u);
  await kv.put('conc:lista', JSON.stringify(lista));
  if (u) await kv.delete(`conc:${u}`);
  return listaConcorrentes(env);
}

/** Atualiza uma conta agora (botão na página). */
export async function atualizar(env, usuario) {
  const u = normalizarUsuario(usuario);
  const kv = env.UNIVERSO;
  const tk = await tokenUnificado(env);
  const ant = await kv.get(`conc:${u}`, 'json');
  if (!ant) throw new ErroIG('Conta não está na lista.', 'conta');
  const { ig } = acesso(tk, novaCota());
  await kv.put(`conc:${u}`, JSON.stringify(guardar(ant, await consultar(ig, tk.igId, u), Date.now())));
  return listaConcorrentes(env);
}

