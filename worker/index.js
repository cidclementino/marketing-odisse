// Universo — API de publicações (Cloudflare Worker + KV)
//
// Binding esperado (wrangler.toml):
//   - KV Namespace `UNIVERSO`
//       pub:<id>     -> publicação completa (JSON)
//       resumo:<id>  -> resumo para o arquivo (JSON, inclui miniatura da capa)
//       img:<ref>    -> imagem original (binário; content-type nos metadados)
//       cfg:<chave>  -> configurações comuns (pin-pastas: pastas do Pinterest; estrategia: grade, fases e
//                       ciclo do plano de publicação; pautas: banco de pautas)
//       pool:<id>    -> item do pool de mídias (JSON; as imagens exportadas ficam em img:<ref>)
//   - Secret `UNIVERSO_SENHA` -> senha compartilhada pela equipe (Authorization: Bearer <senha>)
//
// Rotas (todas exigem a senha):
//   GET    /api/publicacoes          -> lista de resumos
//   GET    /api/publicacoes/:id      -> publicação completa
//   PUT    /api/publicacoes/:id      -> grava publicação (e o resumo)
//   DELETE /api/publicacoes/:id      -> apaga publicação, resumo e imagens que só ela usava (a tela arquiva: `arquivado`)
//   HEAD   /api/imagens/:ref         -> 200 se existe
//   GET    /api/imagens/:ref         -> imagem
//   PUT    /api/imagens/:ref         -> grava imagem (corpo binário)
//   GET    /api/pool                 -> pool de mídias (itens prontos, agendados e publicados)
//   PUT    /api/pool/:id             -> grava o item (e apaga as mídias que ele deixou de usar)
//   DELETE /api/pool/:id             -> apaga o item e as mídias dele
//   GET    /api/config/:chave        -> configuração comum (pin-pastas, estrategia, pautas); null se não existe
//   PUT    /api/config/:chave        -> grava a configuração (JSON, até 64 KB)
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
//   PUT    /api/metricas/etiquetas/:chave   -> { tema, objetivo } de um post (chave = rede:id)
//
//   Concorrentes (ver concorrentes.js):
//   GET    /api/concorrentes                -> { max, contas }
//   POST   /api/concorrentes                -> { usuario } adiciona (até o limite) e já coleta
//   POST   /api/concorrentes/:usuario       -> atualiza a conta agora
//   DELETE /api/concorrentes/:usuario       -> remove a conta e seus dados
//
// Cron diário (wrangler.toml) -> coleta do Instagram.
//
// Ponto de entrada "Universo" (Worker a Worker, sem senha: só outro Worker da mesma conta o alcança):
//   resumo(dia?)            -> publicações de hoje, atrasadas e Instagram de ontem (worker/universo.js)
//   publicar({ tipo, id })  -> confirma uma publicação feita (item do pool ou pauta de reel)
//   periodo(de, ate)        -> KPIs do Universo: Instagram dia a dia e publicações por mês (worker/universo.js)

import { WorkerEntrypoint } from 'cloudflare:workers';
import * as ig from './instagram.js';
import * as conc from './concorrentes.js';
import * as universo from './universo.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};
const MAX_IMG = 20 * 1024 * 1024;
const ID = /^[a-z0-9_-]{4,64}$/i;
// configurações comuns e o tamanho máximo de cada uma
const CONFIGS = new Map([['pin-pastas', 64 * 1024], ['estrategia', 128 * 1024], ['pautas', 1024 * 1024], ['padroes-cards', 64 * 1024]]);

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
    formato: pub.formato || '3x4',
    titulo: pub.titulo || pub.globais?.projeto || '',
    ncards: pub.cards?.length || 0,
    criado: pub.criado,
    atualizado: pub.atualizado,
    salvoEm: pub.salvoEm || '',
    enviadoEm: pub.enviadoEm || '',
    arquivado: !!pub.arquivado,
    // data escolhida à mão nas publicações antigas (o campo saiu do editor; serve só ao vínculo com o Instagram)
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
    if (partes[1] === 'concorrentes') return concorrentes(request, env, partes[2]);
    if (partes[1] === 'metricas' && partes[2] === 'etiquetas' && partes[3] && request.method === 'PUT') {
      const chave = decodeURIComponent(partes[3]);
      if (!/^[a-z]{2}:[\w-]{3,64}$/.test(chave)) return erro('chave inválida', 400);
      let corpo;
      try { corpo = await request.json(); } catch { return erro('JSON inválido', 400); }
      return json(await ig.etiquetar(env, chave, corpo || {}));
    }
    const [, recurso, id] = partes;
    if (id && !ID.test(id)) return erro('id inválido', 400);

    // pool de mídias: o que foi exportado para publicar, com dia e situação
    if (recurso === 'pool') {
      const refs = (it) => new Set((it?.imagens || []).map((m) => m.ref).filter(Boolean));
      if (!id && request.method === 'GET') return json(await listar(kv, 'pool:'));
      if (id && request.method === 'PUT') {
        let item;
        try { item = await request.json(); } catch { return erro('JSON inválido', 400); }
        if (item?.id !== id || !Array.isArray(item.imagens)) return erro('item inválido', 400);
        const ant = await kv.get(`pool:${id}`, 'json');
        await kv.put(`pool:${id}`, JSON.stringify(item));
        const novas = refs(item);
        await Promise.all([...refs(ant)].filter((r) => !novas.has(r)).map((r) => kv.delete(`img:${r}`)));
        return json({ ok: true });
      }
      if (id && request.method === 'DELETE') {
        const ant = await kv.get(`pool:${id}`, 'json');
        await kv.delete(`pool:${id}`);
        await Promise.all([...refs(ant)].map((r) => kv.delete(`img:${r}`)));
        return json({ ok: true });
      }
    }

    // configurações comuns a todos os computadores (ex.: pastas do Pinterest)
    if (recurso === 'config' && id) {
      if (!CONFIGS.has(id)) return erro('configuração desconhecida', 404);
      if (request.method === 'GET') return json(await kv.get(`cfg:${id}`, 'json'));
      if (request.method === 'PUT') {
        let corpo;
        try { corpo = await request.json(); } catch { return erro('JSON inválido', 400); }
        const txt = JSON.stringify(corpo);
        if (txt.length > CONFIGS.get(id)) return erro('configuração grande demais', 413);
        await kv.put(`cfg:${id}`, txt);
        return json({ ok: true });
      }
    }

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
      const r = await ig.conectar(env, corpo?.token, corpo?.igId);
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

async function concorrentes(request, env, usuario) {
  const m = request.method;
  try {
    if (!usuario && m === 'GET') return json(await conc.listaConcorrentes(env));
    if (!usuario && m === 'POST') {
      let corpo;
      try { corpo = await request.json(); } catch { return erro('JSON inválido', 400); }
      return json(await conc.adicionar(env, corpo?.usuario));
    }
    if (usuario && m === 'DELETE') return json(await conc.remover(env, decodeURIComponent(usuario)));
    if (usuario && m === 'POST') return json(await conc.atualizar(env, decodeURIComponent(usuario)));
  } catch (e) {
    return erro(e.message || 'erro nos concorrentes', ['token', 'conta'].includes(e.codigo) ? 400 : 502);
  }
  return erro('rota não encontrada', 404);
}

// ---------------------------------------------------------------- Universo (Worker a Worker)
// Início do Universo (Cid, 19/11). Ligação no universo-hub: [[services]] MARKETING → universo-odisse,
// entrypoint "Universo".
export class Universo extends WorkerEntrypoint {
  async resumo(dia) { return universo.resumo(this.env, dia); }
  async publicar(alvo, dia) { return universo.publicar(this.env, alvo, dia); }
  async periodo(de, ate) { return universo.periodo(this.env, de, ate); }
}
