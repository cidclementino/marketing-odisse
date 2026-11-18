// Plano de publicação: grade semanal por fase da escalada, banco de pautas e ciclo de produção.
// Fonte: odisse-estrategia-instagram.pdf (out. 2026), seções 02 (grade), 03 (escalada e horários),
// 04/05 (modelos de reel e formatos), 06 (da obra à mídia: pautas) e 07 (calendário de produção).
// Guardado na nuvem em cfg:estrategia (grade, fases, início do ciclo) e cfg:pautas (banco de pautas).

import * as local from './store.js';
import * as nuvem from './nuvem.js';
import * as pool from './pool.js';
import { segundaDe, somarDias, dataDe, hoje, isoDia } from './pool.js';

// ---------------------------------------------------------------------------
// Formatos e modelos (seção 05)

export const POST_DE = {
  arquitetos: 'Carrossel de projeto',
  objetos: 'Ensaio de peças',
  elaia: 'Carrossel resumo',
  estudio: 'Fotografias',
};
export const REELS = {
  E1: ['elaia', 'Book Phrase'], E2: ['arquitetos', 'Antes & Depois'], E3: ['arquitetos', 'Tour + Voiceover'],
  E4: ['arquitetos', 'Spatial Glitch'], E5: ['arquitetos', 'Materiais'], E6: ['elaia', 'Cortes'],
  E7: ['objetos', 'Unboxing'], E8: ['objetos', 'Compilação de materiais'], E9: ['estudio', 'Pure Edit'], E10: ['estudio', 'Creation Takes'],
};
export const rotuloDe = (e) => (e.formato === 'reel' ? `Reel ${e.rotulo}${REELS[e.rotulo] ? ` · ${REELS[e.rotulo][1]}` : ''}` : `Post · ${e.rotulo || POST_DE[e.nucleo] || ''}`);

// ---------------------------------------------------------------------------
// Grade semanal (seções 02 e 03). Dias de segunda (0) a domingo (6); em cada dia, a ordem de publicação.
// Fases 1 a 4 têm uma semana só; a fase 5 alterna semana A (1 e 3 do ciclo) e semana B (2 e 4).

const P = (nucleo) => ({ nucleo, formato: 'post', rotulo: POST_DE[nucleo] });
const R = (nucleo, e) => ({ nucleo, formato: 'reel', rotulo: e });
const [ARQ, OBJ, EL, EST] = ['arquitetos', 'objetos', 'elaia', 'estudio'];
const F3 = [[R(ARQ, 'E2'), P(OBJ)], [P(ARQ), R(EL, 'E6')], [R(ARQ, 'E3'), P(OBJ)], [P(ARQ), P(EL)], [P(EST)], [P(ARQ)], [P(EL)]];
export const GRADE_PADRAO = {
  1: { A: [[P(OBJ)], [P(ARQ)], [P(OBJ)], [P(EL), P(ARQ)], [P(EST)], [P(ARQ)], [P(EL)]], B: null },
  2: { A: [[R(ARQ, 'E2'), P(OBJ)], [P(ARQ)], [P(OBJ), R(ARQ, 'E3')], [P(EL), P(ARQ)], [P(EST)], [P(ARQ)], [P(EL)]], B: null },
  3: { A: F3, B: null },
  4: { A: F3.map((d, i) => (i === 4 ? [R(ARQ, 'E4'), P(EST)] : d)), B: null },
  5: {
    A: [[P(OBJ), R(ARQ, 'E2')], [R(EL, 'E6'), P(ARQ)], [P(OBJ), R(ARQ, 'E3')], [P(EL), P(ARQ), R(EST, 'E10')], [R(ARQ, 'E4'), P(EST)], [P(ARQ), R(EL, 'E1')], [R(EST, 'E9'), P(EL)]],
    B: [[R(ARQ, 'E2'), P(OBJ)], [P(ARQ), R(EL, 'E6')], [R(ARQ, 'E3'), P(OBJ)], [P(ARQ), P(EL), R(ARQ, 'E5')], [P(EST), R(ARQ, 'E4')], [R(OBJ, 'E7'), P(ARQ)], [R(OBJ, 'E8'), P(EL)]],
  },
};
export const FASES = [1, 2, 3, 4, 5];
export const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

/** Horário pela posição no dia, não pelo tipo (seção 03). */
export function horarios(n) {
  if (n <= 1) return ['11h–13h'];
  if (n === 2) return ['11h–13h', '20h–22h'];
  if (n === 3) return ['11h–13h', '15h–17h', '20h–22h'];
  return Array.from({ length: n }, (_, i) => (i === 0 ? '11h–13h' : i === n - 1 ? '20h–22h' : '15h–17h'));
}

// ---------------------------------------------------------------------------
// Estratégia guardada: { grade, fases: [{ fase, desde }], cicloInicio }

const CHAVE_EST = 'estrategia';
let est = null;
const padraoEst = () => ({ grade: structuredClone(GRADE_PADRAO), fases: [{ fase: 1, desde: '2000-01-03' }], cicloInicio: segundaDe(hoje()) });

export const estrategia = () => est || padraoEst();

export async function carregarEstrategia() {
  if (!est) est = (await local.lerMeta(CHAVE_EST)) || null;
  if (est && !est.grade) est = null;
  try {
    const r = await nuvem.lerConfig(CHAVE_EST);
    const valida = r?.grade && Array.isArray(r.fases);
    if (valida && JSON.stringify(r) !== JSON.stringify(est)) { est = r; await local.gravarMeta(CHAVE_EST, est); return true; }
  } catch (e) { console.warn('[plano] estratégia da nuvem', e); }
  if (!est) est = padraoEst();
  return false;
}
export async function gravarEstrategia(nova) {
  est = nova;
  await local.gravarMeta(CHAVE_EST, est);
  await nuvem.gravarConfig(CHAVE_EST, est);
}

/** Fase da escalada valendo num dia (a fase muda a partir da segunda-feira em que foi trocada). */
export function faseEm(dia) {
  const fs = [...(estrategia().fases || [])].sort((a, b) => a.desde.localeCompare(b.desde));
  let f = 1; // antes da primeira troca registrada, fase 1
  for (const x of fs) if (x.desde <= dia) f = x.fase;
  return f;
}
export const faseAtual = () => faseEm(hoje());

// ---------------------------------------------------------------------------
// Ciclo de 4 semanas (seção 07)

export function semanaDoCiclo(dia) {
  const ini = estrategia().cicloInicio || segundaDe(hoje());
  const seg = segundaDe(dia);
  const k = Math.round((dataDe(seg) - dataDe(ini)) / (7 * 864e5));
  const n = ((k % 4) + 4) % 4 + 1;
  return { n, ab: n % 2 ? 'A' : 'B', inicio: somarDias(seg, -(n - 1) * 7), seg };
}

/** Grade de um dia da semana (0 = segunda) numa fase e semana. */
export function gradeDia(fase, ab, dow) {
  const g = estrategia().grade?.[fase] || GRADE_PADRAO[fase];
  const sem = ab === 'B' && g.B ? g.B : g.A;
  return sem?.[dow] || [];
}

/** Encaixes previstos num dia: [{ pos, nucleo, formato, rotulo, horario }]. */
export function encaixesDoDia(dia) {
  const dow = (dataDe(dia).getDay() + 6) % 7;
  const lista = gradeDia(faseEm(dia), semanaDoCiclo(dia).ab, dow);
  const hs = horarios(lista.length);
  return lista.map((e, pos) => ({ ...e, pos, horario: hs[pos] }));
}

/**
 * Prazos que caem numa semana de trabalho (antecedências da seção 07):
 * pautas do ciclo 3 semanas antes; captação 2 a 3 semanas antes; textos 2; design 1;
 * revisão e agendamento até a sexta anterior; revisão das métricas na última semana do ciclo.
 */
export function prazosDaSemana(seg) {
  const out = [];
  const c3 = semanaDoCiclo(somarDias(seg, 21));
  if (c3.n === 1) out.push({ k: 'pautas', rot: 'Pautas do ciclo', alvo: c3.seg, dia: seg });
  out.push({ k: 'captacao', rot: 'Captação de reels', alvo: somarDias(seg, 14), ate: somarDias(seg, 21), dia: seg });
  out.push({ k: 'textos', rot: 'Textos e roteiros', alvo: somarDias(seg, 14), dia: seg });
  out.push({ k: 'design', rot: 'Design e edição', alvo: somarDias(seg, 7), dia: seg });
  out.push({ k: 'agendar', rot: 'Revisão e agendamento', alvo: somarDias(seg, 7), dia: somarDias(seg, 4) });
  if (semanaDoCiclo(seg).n === 4) out.push({ k: 'metricas', rot: 'Revisão das métricas do ciclo', alvo: '', dia: seg });
  return out;
}

// ---------------------------------------------------------------------------
// Banco de pautas (seção 06): cada fonte com os ângulos ainda não publicados.

export const FONTES = [
  ['projeto', 'Projeto de arquitetura', 'arquitetos', ['Macroconceito', 'Uma solução técnica', 'Um material', 'O território e a história', 'O antes e depois', 'O percurso']],
  ['objeto', 'Objeto', 'objetos', ['A peça inteira', 'O material', 'O encaixe ou detalhe construtivo', 'O uso', 'O processo de fabricação']],
  ['ensaio', 'Ensaio da Elaia', 'elaia', ['Argumento do ensaio', 'Uma citação', 'Corte do Matéria Bruta', 'Derivação do artigo']],
  ['rotina', 'Rotina do estúdio', 'estudio', ['Pessoas', 'Obra em andamento', 'Dia de trabalho', 'Processo de criação']],
];
export const FONTE_POR_ID = Object.fromEntries(FONTES.map((f) => [f[0], f]));
export const STATUS_PAUTA = [['pauta', 'Pauta'], ['producao', 'Em produção'], ['pronta', 'Pronta'], ['publicada', 'Publicada']];
export const FORMATOS_PAUTA = [['post', 'Post'], ['reel', 'Reel'], ['pin', 'Pin']];

const CHAVE_PAUTAS = 'pautas';
let pautas = null;
export const listaPautas = () => pautas || [];
export const pauta = (id) => listaPautas().find((p) => p.id === id) || null;

export async function carregarPautas() {
  if (!pautas) pautas = (await local.lerMeta(CHAVE_PAUTAS)) || [];
  try {
    const r = await nuvem.lerConfig(CHAVE_PAUTAS);
    if (Array.isArray(r) && JSON.stringify(r) !== JSON.stringify(pautas)) { pautas = r; await local.gravarMeta(CHAVE_PAUTAS, pautas); return true; }
  } catch (e) { console.warn('[plano] pautas da nuvem', e); }
  return false;
}
let timerPautas;
/** Grava as pautas (na hora no navegador; na nuvem logo depois, juntando as mudanças seguidas). */
export function gravarPautas(lista) {
  pautas = lista;
  local.gravarMeta(CHAVE_PAUTAS, pautas);
  clearTimeout(timerPautas);
  return new Promise((ok) => {
    timerPautas = setTimeout(() => nuvem.gravarConfig(CHAVE_PAUTAS, pautas).then(() => ok(true), () => ok(false)), 500);
  });
}
export function novaPauta(dados = {}) {
  const f = FONTE_POR_ID[dados.fonte || 'projeto'];
  return {
    id: 'pt' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    fonte: f[0], obra: '', nucleo: f[2], angulo: '', formato: 'post', modelo: '', status: 'pauta', dia: '', pos: null, notas: '',
    criado: new Date().toISOString(), ...dados,
  };
}

// ---------------------------------------------------------------------------
// Conferências do plano

/**
 * Sequência da semana (segunda a domingo) com o núcleo efetivo de cada encaixe (o do item ou da pauta
 * no encaixe, ou o previsto) e os conflitos: núcleo repetido em publicações seguidas, Estúdio ao lado de Objetos.
 * `ocupacao(dia, pos)` devolve { nucleo } do que estiver no encaixe.
 */
export function conflitosDaSemana(seg, ocupacao) {
  const seq = [];
  for (let i = 0; i < 7; i++) {
    const dia = somarDias(seg, i);
    for (const e of encaixesDoDia(dia)) seq.push({ dia, pos: e.pos, nucleo: ocupacao(dia, e.pos)?.nucleo || e.nucleo });
  }
  const out = new Map();
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1], b = seq[i];
    let msg = '';
    if (a.nucleo === b.nucleo) msg = 'Mesmo núcleo em publicações seguidas';
    else if ([a.nucleo, b.nucleo].sort().join() === 'estudio,objetos') msg = 'Estúdio encostado em Objetos';
    if (msg) out.set(`${b.dia}:${b.pos}`, msg);
  }
  return out;
}

/** Posts da grade numa semana da fase atual (a reserva é uma semana completa de posts prontos). */
export function postsPorSemana(fase = faseAtual()) {
  const g = estrategia().grade?.[fase] || GRADE_PADRAO[fase];
  const conta = (sem) => (sem || []).flat().filter((e) => e.formato === 'post').length;
  return Math.max(conta(g.A), conta(g.B || g.A));
}

/**
 * Semanas seguidas cumpridas, da última semana fechada para trás: todo encaixe de post com publicação
 * publicada e todo encaixe de reel com pauta publicada. `publicados(dia)` → { posts, reels }.
 */
export function semanasCumpridas(publicados, limite = 12) {
  let seg = somarDias(segundaDe(hoje()), -7), n = 0;
  while (n < limite) {
    let ok = true;
    for (let i = 0; i < 7 && ok; i++) {
      const dia = somarDias(seg, i);
      const enc = encaixesDoDia(dia);
      const p = publicados(dia);
      if (p.posts < enc.filter((e) => e.formato === 'post').length || p.reels < enc.filter((e) => e.formato === 'reel').length) ok = false;
    }
    if (!ok) break;
    n++;
    seg = somarDias(seg, -7);
  }
  return n;
}

/** O que ocupa um encaixe do Instagram: o item do pool e a pauta. */
export function ocupantes(dia, pos) {
  return {
    item: pool.lista().find((x) => x.rede === 'instagram' && x.dia === dia && x.pos === pos) || null,
    pauta: listaPautas().find((p) => p.formato !== 'pin' && p.dia === dia && p.pos === pos) || null,
  };
}
/** Núcleo efetivo do encaixe: o do item, o da pauta ou nenhum. */
export const ocupacao = (dia, pos) => { const o = ocupantes(dia, pos); return o.item || o.pauta || null; };

/** Publicado num dia: posts (itens do Instagram publicados, ou pautas de post publicadas sem item) e reels (pautas). */
export function publicadosNoDia(dia) {
  const itens = pool.lista().filter((x) => x.rede === 'instagram' && x.dia === dia && x.status === 'publicado');
  const pts = listaPautas().filter((p) => p.dia === dia && p.status === 'publicada');
  const postsPauta = pts.filter((p) => p.formato === 'post' && !itens.some((i) => i.pos === p.pos && p.pos != null)).length;
  return { posts: itens.length + postsPauta, reels: pts.filter((p) => p.formato === 'reel').length };
}

/** Reserva: carrosséis prontos no pool, sem dia, contra uma semana de posts da fase atual. */
export function reserva() {
  return { prontos: pool.lista().filter((x) => x.rede === 'instagram' && x.status === 'pronto').length, precisa: postsPorSemana() };
}

/** A escalada avança com a reserva formada e 4 semanas cumpridas sem falhas (seção 03). */
export function escalada() {
  const fase = faseAtual();
  const r = reserva();
  const cumpridas = semanasCumpridas(publicadosNoDia);
  return { fase, ...r, cumpridas, pode: fase < 5 && r.prontos >= r.precisa && cumpridas >= 4 };
}

export { isoDia };
