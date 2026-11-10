// Universo — API de publicações (Cloudflare Worker + KV)
//
// Binding esperado (wrangler.toml):
//   - KV Namespace `UNIVERSO`
//       pub:<id>     -> publicação completa (JSON)
//       resumo:<id>  -> resumo para o arquivo (JSON, inclui miniatura da capa)
//       img:<ref>    -> imagem original (binário; content-type nos metadados)
//   - Secret `UNIVERSO_SENHA` -> senha compartilhada pela equipe (Authorization: Bearer <senha>)
//
// Rotas (todas exigem a senha):
//   GET    /api/publicacoes          -> lista de resumos
//   GET    /api/publicacoes/:id      -> publicação completa
//   PUT    /api/publicacoes/:id      -> grava publicação (e o resumo)
//   DELETE /api/publicacoes/:id      -> apaga publicação, resumo e imagens que só ela usava
//   HEAD   /api/imagens/:ref         -> 200 se existe
//   GET    /api/imagens/:ref         -> imagem
//   PUT    /api/imagens/:ref         -> grava imagem (corpo binário)
//
//   Instagram (ver instagram.js):
//   GET    /api/instagram/estado            -> conexão, perfil, última coleta
//   POST   /api/instagram/conectar          -> { token } valida, guarda e faz a primeira coleta
//   DELETE /api/instagram/conectar          -> esquece o token
//   POST   /api/instagram/login             -> { appId, segredo, config, volta } guarda o app e devolve o endereço do login unificado
//   GET    /api/instagram/retorno           -> retorno do login do Meta (sem senha; `state` assinado)
//   POST   /api/instagram/coletar           -> coleta agora
//   GET    /api/instagram/metricas          -> tudo para a página de métricas
//   PUT    /api/instagram/vinculos/:media   -> { pub } liga o post a uma publicação (null = sem)
//   GET    /api/instagram/miniaturas/:media -> miniatura guardada do post
//
// Cron diário (wrangler.toml) -> coleta do Instagram.

import * as ig from './instagram.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};
const MAX_IMG = 20 * 1024 * 1024;
const ID = /^[a-z0-9_-]{4,64}$/i;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const erro = (msg, status) => json({ error: msg }, status);

function autorizado(request, env) {
  const senha = env.UNIVERSO_SENHA;
  if (!senha) return false;
  const auth = request.headers.get('Authorization') || '';
  const dada = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (dada.length !== senha.length) return false;
  let dif = 0;
  for (let i = 0; i < senha.length; i++) dif |= dada.charCodeAt(i) ^ senha.charCodeAt(i);
  return dif === 0;
}

async function listar(kv, prefixo) {
  const out = [];
  let cursor;
  do {
    const pagina = await kv.list({ prefix: prefixo, cursor });
    const valores = await Promise.all(pagina.keys.map((k) => kv.get(k.name, 'json')));
    out.push(...valores.filter(Boolean));
    cursor = pagina.list_complete ? undefined : pagina.cursor;
  } while (cursor);
  return out;
}

const refsDe = (pub) => {
  const refs = new Set();
  for (const c of pub?.cards || []) for (const im of Object.values(c.imgs || {})) if (im?.ref) refs.add(im.ref);
  return refs;
};

function resumo(pub) {
  return {
    id: pub.id,
    nucleo: pub.nucleo,
    titulo: pub.titulo || pub.globais?.projeto || '',
    ncards: pub.cards?.length || 0,
    criado: pub.criado,
    atualizado: pub.atualizado,
    dataPublicacao: pub.globais?.dataPublicacao || '',
    capa: typeof pub.capa === 'string' && pub.capa.length < 400000 ? pub.capa : '',
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const partes = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean); // ['api', 'publicacoes', id?]
    if (partes[0] !== 'api') return erro('rota não encontrada', 404);
    // retorno do login unificado do Meta: vem do navegador, sem senha; protegido pelo `state` assinado
    if (partes[1] === 'instagram' && partes[2] === 'retorno' && request.method === 'GET') return ig.retornoLogin(env, url.searchParams);
    if (!autorizado(request, env)) return erro('não autorizado', 401);
    const kv = env.UNIVERSO;
    if (partes[1] === 'instagram') return instagram(request, env, partes.slice(2));
    const [, recurso, id] = partes;
    if (id && !ID.test(id)) return erro('id inválido', 400);

    if (recurso === 'publicacoes') {
      if (!id && request.method === 'GET') {
        const lista = await listar(kv, 'resumo:');
        lista.sort((a, b) => (b.atualizado || '').localeCompare(a.atualizado || ''));
        return json(lista);
      }
      if (id && request.method === 'GET') {
        const pub = await kv.get(`pub:${id}`, 'json');
        return pub ? json(pub) : erro('não encontrada', 404);
      }
      if (id && request.method === 'PUT') {
        let pub;
        try { pub = await request.json(); } catch { return erro('JSON inválido', 400); }
        if (pub?.id !== id || !Array.isArray(pub.cards)) return erro('publicação inválida', 400);
        await kv.put(`pub:${id}`, JSON.stringify(pub));
        await kv.put(`resumo:${id}`, JSON.stringify(resumo(pub)));
        return json({ ok: true, atualizado: pub.atualizado });
      }
      if (id && request.method === 'DELETE') {
        const pub = await kv.get(`pub:${id}`, 'json');
        await kv.delete(`pub:${id}`);
        await kv.delete(`resumo:${id}`);
        // apaga imagens que nenhuma outra publicação usa
        const minhas = refsDe(pub);
        if (minhas.size) {
          const outras = new Set();
          for (const r of await listar(kv, 'resumo:')) {
            const p = await kv.get(`pub:${r.id}`, 'json');
            for (const ref of refsDe(p)) outras.add(ref);
          }
          await Promise.all([...minhas].filter((r) => !outras.has(r)).map((r) => kv.delete(`img:${r}`)));
        }
        return json({ ok: true });
      }
    }

    if (recurso === 'imagens' && id) {
      if (request.method === 'GET' || request.method === 'HEAD') {
        const { value, metadata } = await kv.getWithMetadata(`img:${id}`, 'arrayBuffer');
        if (!value) return erro('não encontrada', 404);
        const headers = { 'Content-Type': metadata?.tipo || 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable', ...CORS };
        return new Response(request.method === 'HEAD' ? null : value, { headers });
      }
      if (request.method === 'PUT') {
        const tipo = request.headers.get('Content-Type') || 'image/jpeg';
        if (!tipo.startsWith('image/')) return erro('só imagens', 415);
        const corpo = await request.arrayBuffer();
        if (corpo.byteLength > MAX_IMG) return erro('imagem grande demais', 413);
        await kv.put(`img:${id}`, corpo, { metadata: { tipo } });
        return json({ ok: true });
      }
    }

    return erro('rota não encontrada', 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(ig.coletar(env));
  },
};

async function instagram(request, env, [acao, id]) {
  const m = request.method;
  try {
    if (acao === 'estado' && m === 'GET') return json(await ig.estado(env));
    if (acao === 'metricas' && m === 'GET') return json(await ig.metricas(env));
    if (acao === 'coletar' && m === 'POST') return json(await ig.coletar(env));
    if (acao === 'conectar' && m === 'POST') {
      let corpo;
      try { corpo = await request.json(); } catch { return erro('JSON inválido', 400); }
      const r = await ig.conectar(env, corpo?.token);
      return r.ok ? json(r) : erro(r.erro, 502);
    }
    if (acao === 'login' && m === 'POST') {
      let corpo;
      try { corpo = await request.json(); } catch { return erro('JSON inválido', 400); }
      return json(await ig.iniciarLogin(env, corpo));
    }
    if (acao === 'conectar' && m === 'DELETE') { await ig.desconectar(env); return json({ ok: true }); }
    if (acao === 'vinculos' && id && /^\d{5,32}$/.test(id) && m === 'PUT') {
      let corpo;
      try { corpo = await request.json(); } catch { return erro('JSON inválido', 400); }
      const pub = corpo?.pub || null;
      if (pub && !ID.test(pub)) return erro('publicação inválida', 400);
      return json(await ig.vincular(env, id, pub));
    }
    if (acao === 'miniaturas' && id && /^\d{5,32}$/.test(id) && m === 'GET') {
      const { value, metadata } = await env.UNIVERSO.getWithMetadata(`igmini:${id}`, 'arrayBuffer');
      if (!value) return erro('não encontrada', 404);
      return new Response(value, { headers: { 'Content-Type': metadata?.tipo || 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable', ...CORS } });
    }
  } catch (e) {
    return erro(e.message || 'erro no Instagram', ['token', 'conta', 'app'].includes(e.codigo) ? 400 : 502);
  }
  return erro('rota não encontrada', 404);
}
