// Cliente da API do Universo (Cloudflare Worker + KV — ver worker/).
// Endereço e senha ficam no navegador de quem usa (localStorage).

const CHAVE = 'universo-nuvem';
export const URL_PADRAO = (() => {
  try { return localStorage.getItem('universo-api') || 'https://universo-odisse.reservaprojectbasework.workers.dev'; } catch { return 'https://universo-odisse.reservaprojectbasework.workers.dev'; }
})();

export function config() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || 'null');
  } catch {
    return null;
  }
}
export function salvarConfig(c) {
  try {
    if (c) localStorage.setItem(CHAVE, JSON.stringify(c));
    else localStorage.removeItem(CHAVE);
  } catch { /* navegador sem armazenamento */ }
}
export const ativa = () => !!config()?.senha;

async function req(caminho, opc = {}) {
  const c = { url: URL_PADRAO, ...config() };
  if (!c.senha) throw new Error('senha incorreta');
  const res = await fetch(c.url.replace(/\/$/, '') + caminho, {
    ...opc,
    headers: { Authorization: `Bearer ${c.senha}`, ...(opc.headers || {}) },
  });
  if (res.status === 401) throw new Error('senha incorreta');
  if (!res.ok) throw new Error(`erro ${res.status}`);
  return res;
}

export async function testar(c) {
  const res = await fetch(c.url.replace(/\/$/, '') + '/api/publicacoes', { headers: { Authorization: `Bearer ${c.senha}` } });
  if (res.status === 401) throw new Error('Senha incorreta.');
  if (!res.ok) throw new Error(`O servidor respondeu ${res.status}.`);
  return true;
}

export const listar = async () => (await req('/api/publicacoes')).json();
export const ler = async (id) => (await req(`/api/publicacoes/${encodeURIComponent(id)}`)).json();
export const gravar = (pub) =>
  req(`/api/publicacoes/${encodeURIComponent(pub.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pub),
  });
export const apagar = (id) => req(`/api/publicacoes/${encodeURIComponent(id)}`, { method: 'DELETE' });

export async function enviarImg(ref, dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  await req(`/api/imagens/${encodeURIComponent(ref)}`, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });
}
export async function existeImg(ref) {
  try {
    await req(`/api/imagens/${encodeURIComponent(ref)}`, { method: 'HEAD' });
    return true;
  } catch {
    return false;
  }
}
export async function baixarImg(ref) {
  const blob = await (await req(`/api/imagens/${encodeURIComponent(ref)}`)).blob();
  return new Promise((ok) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result);
    fr.readAsDataURL(blob);
  });
}
