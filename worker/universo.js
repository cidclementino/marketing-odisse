// Início do Universo (Cid, 19/11): o que o hub pede ao marketing, Worker a Worker.
//
//   resumo(env, dia)            -> publicações de hoje (encaixes da Estratégia + pool), atrasadas e o
//                                  Instagram do dia anterior (números fechados, 00:00–23:59 de Brasília)
//   publicar(env, alvo, dia)    -> confirma uma publicação: item do pool vira "publicado" (e a pauta do
//                                  encaixe vira "publicada"), ou uma pauta de reel vira "publicada"
//
// As regras são as mesmas do Calendário (assets/js/pagina-calendario.js › sincronizarPauta) e os encaixes
// vêm de assets/js/grade.js, o mesmo código da página. Ligação no universo-hub: [[services]] MARKETING →
// universo-odisse (este Worker), entrypoint "Universo".

import { encaixesNaEstrategia, segundaDeG, somarDiasG, rotuloDe } from '../assets/js/grade.js';
import { diaLocal } from './instagram.js';

const padraoEst = (hoje) => ({ grade: null, fases: [{ fase: 1, desde: '2000-01-03' }], cicloInicio: segundaDeG(hoje) });

async function listarPool(kv) {
  const out = [];
  let cursor;
  do {
    const pagina = await kv.list({ prefix: 'pool:', cursor });
    out.push(...(await Promise.all(pagina.keys.map((k) => kv.get(k.name, 'json')))).filter(Boolean));
    cursor = pagina.list_complete ? undefined : pagina.cursor;
  } while (cursor);
  return out;
}

const leve = (it) => ({
  id: it.id, rede: it.rede, formato: it.formato, nucleo: it.nucleo, titulo: it.titulo || it.projeto || '',
  projeto: it.projeto || '', status: it.status, dia: it.dia || '', pos: it.pos ?? null,
  miniatura: typeof it.miniatura === 'string' && it.miniatura.length < 60000 ? it.miniatura : '',
  nimagens: it.imagens?.length || 0, pasta: it.pin?.pastaNome || '',
});

/** Linhas do dia, só o que ainda não foi publicado; e as contagens. */
export function montarDia({ est, pautas, pool, hoje }) {
  const encaixes = encaixesNaEstrategia(est || padraoEst(hoje), hoje, hoje);
  const doDia = pool.filter((x) => x.dia === hoje);
  const usados = new Set();
  const linhas = [];
  let publicadas = 0;

  // Instagram: um encaixe da grade por linha (item do pool, pauta ou lacuna)
  for (const e of encaixes) {
    const item = doDia.find((x) => x.rede === 'instagram' && x.pos === e.pos) || null;
    const pauta = pautas.find((p) => p.formato !== 'pin' && p.dia === hoje && p.pos === e.pos) || null;
    if (item) usados.add(item.id);
    const feito = item ? item.status === 'publicado' : pauta?.status === 'publicada';
    if (feito) { publicadas++; continue; }
    const base = { rede: 'instagram', pos: e.pos, horario: e.horario, nucleo: item?.nucleo || pauta?.nucleo || e.nucleo, encaixe: rotuloDe(e), formato: e.formato };
    if (item) linhas.push({ ...base, tipo: 'item', ...leve(item), confirma: true });
    else if (pauta) linhas.push({ ...base, tipo: 'pauta', id: pauta.id, titulo: [pauta.obra, pauta.angulo].filter(Boolean).join(' — '), situacao: pauta.status, confirma: e.formato === 'reel' && pauta.status === 'pronta' });
    else linhas.push({ ...base, tipo: 'lacuna', confirma: false });
  }

  // o resto do pool agendado para hoje (pins e o que estiver fora dos encaixes)
  for (const it of doDia) {
    if (usados.has(it.id)) continue;
    if (it.status === 'publicado') { publicadas++; continue; }
    linhas.push({ tipo: 'item', ...leve(it), encaixe: it.rede === 'pinterest' ? 'Pin' : 'Fora da grade', confirma: true });
  }

  const atrasadas = pool.filter((x) => x.status === 'agendado' && x.dia && x.dia < hoje).length;
  return { linhas, publicadas, atrasadas };
}

/** Instagram do dia fechado (ontem) e do anterior, para a variação. */
export function instagramDoDia(dias, estado, hoje) {
  const ontem = somarDiasG(hoje, -1);
  const antes = somarDiasG(hoje, -2);
  const pega = (d) => {
    const x = dias?.[d];
    if (!x) return null;
    return {
      alcance: x.alcance ?? null, interacoes: x.interacoes ?? null, visitas: x.visitas ?? null,
      toques: x.toques ?? null, novos: x.seguiram ?? x.novos ?? null,
    };
  };
  return {
    dia: ontem,
    atual: pega(ontem),
    anterior: pega(antes),
    // seguidores no fim de ontem = o retrato tirado na coleta de hoje (06h17); sem ele, o último conhecido
    seguidores: dias?.[hoje]?.seguidores ?? estado?.seguidores ?? null,
    seguidoresAntes: dias?.[ontem]?.seguidores ?? null,
    ultimaColeta: estado?.ultimaColeta || null,
  };
}

export async function resumo(env, dia) {
  const kv = env.UNIVERSO;
  const hoje = /^\d{4}-\d{2}-\d{2}$/.test(dia || '') ? dia : diaLocal(Date.now());
  const [est, pautas, pool, dias, estado, token] = await Promise.all([
    kv.get('cfg:estrategia', 'json'), kv.get('cfg:pautas', 'json'), listarPool(kv),
    kv.get('ig:dias', 'json'), kv.get('ig:estado', 'json'), kv.get('ig:token', 'json'),
  ]);
  return {
    hoje,
    ...montarDia({ est: est?.grade ? est : null, pautas: Array.isArray(pautas) ? pautas : [], pool, hoje }),
    instagram: token ? instagramDoDia(dias, estado, hoje) : null,
  };
}

/** alvo = { tipo: 'item' | 'pauta', id }. */
export async function publicar(env, alvo, dia) {
  const kv = env.UNIVERSO;
  const hoje = /^\d{4}-\d{2}-\d{2}$/.test(dia || '') ? dia : diaLocal(Date.now());
  const id = String(alvo?.id || '');
  if (!/^[a-z0-9_-]{4,64}$/i.test(id)) return { ok: false, erro: 'id inválido' };
  const pautas = (await kv.get('cfg:pautas', 'json')) || [];

  if (alvo.tipo === 'pauta') {
    const p = pautas.find((x) => x.id === id);
    if (!p) return { ok: false, erro: 'pauta não encontrada' };
    if (p.status !== 'publicada') { p.status = 'publicada'; await kv.put('cfg:pautas', JSON.stringify(pautas)); }
    return { ok: true };
  }

  const it = await kv.get(`pool:${id}`, 'json');
  if (!it) return { ok: false, erro: 'publicação não encontrada no pool' };
  if (it.status !== 'publicado') {
    it.status = 'publicado';
    if (!it.dia) it.dia = hoje;
    it.publicadoEm = it.dia;
    await kv.put(`pool:${id}`, JSON.stringify(it));
  }
  // a pauta do encaixe acompanha o item (sincronizarPauta, no Calendário)
  if (it.rede === 'instagram' && it.dia && it.pos != null) {
    const p = pautas.find((x) => x.formato !== 'pin' && x.dia === it.dia && x.pos === it.pos);
    if (p && p.status !== 'publicada') { p.status = 'publicada'; await kv.put('cfg:pautas', JSON.stringify(pautas)); }
  }
  return { ok: true };
}
