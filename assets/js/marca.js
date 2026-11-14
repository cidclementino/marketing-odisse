// Dados institucionais lidos da Marca (marca.odisse.com.br/odisse.json), fonte única do Universo.
// Os contatos dos cards (site, telefone, e-mail) saem daqui, por núcleo — não se digitam mais no editor.
// Sem rede, vale a última cópia guardada no navegador e, na falta dela, a reserva abaixo.

const URL_MARCA = 'https://marca.odisse.com.br/odisse.json';
const CHAVE_CACHE = 'universo-marca';

// Reserva: cópia do odisse.json (11/11/2026), só com o que os cards usam.
const RESERVA = {
  contato: { email: 'contato@odisse.com.br', telefone: '+55 83 99122-3088' },
  sites: {
    institucional: 'https://www.odisse.com.br/',
    projetos: 'https://projetos.odisse.com.br/',
    objetos: 'https://www.odisseobjetos.com/',
  },
  redes: { substack: 'https://odisse.substack.com/' },
  nucleos: [
    { id: 'estudio', sites: [], redes: [] },
    { id: 'arquitetos', sites: ['projetos'], redes: [] },
    { id: 'objetos', sites: ['objetos'], redes: [] },
    { id: 'elaia', sites: [], redes: ['substack'] },
  ],
};

/** Que contatos aparecem no fechamento de cada núcleo (o valor vem da Marca). */
const MOSTRA = {
  estudio: ['site', 'telefone', 'email'],
  arquitetos: ['site', 'telefone', 'email'],
  objetos: ['site', 'email'],
  elaia: ['site'],
};

let dados = RESERVA;
try {
  const c = JSON.parse(localStorage.getItem(CHAVE_CACHE) || 'null');
  if (c?.contato) dados = c;
} catch { /* sem storage */ }

/** Busca a Marca (até 3 s). Não bloqueia além disso: segue com o cache ou a reserva. */
export async function carregarMarca() {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch(URL_MARCA, { signal: ctl.signal, cache: 'no-cache' });
    clearTimeout(timer);
    if (!r.ok) return;
    const j = await r.json();
    if (!j?.contato) return;
    dados = j;
    try { localStorage.setItem(CHAVE_CACHE, JSON.stringify(j)); } catch { /* */ }
  } catch { /* fica com o que há */ }
}

const limparUrl = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');

/** Contatos do núcleo: { site, telefone, email }, vazios quando o núcleo não os mostra. */
export function contatosDe(nucleoId) {
  const nuc = (dados.nucleos || []).find((x) => x.id === nucleoId) || {};
  const site = (nuc.sites || []).map((k) => dados.sites?.[k]).find(Boolean)
    || (nuc.redes || []).map((k) => dados.redes?.[k]).find(Boolean)
    || dados.sites?.institucional;
  const todos = { site: limparUrl(site), telefone: dados.contato?.telefone || '', email: dados.contato?.email || '' };
  const mostra = MOSTRA[nucleoId] || Object.keys(todos);
  return Object.fromEntries(Object.entries(todos).map(([k, v]) => [k, mostra.includes(k) ? v : '']));
}
