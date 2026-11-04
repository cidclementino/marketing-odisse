// Persistência local (IndexedDB). Guarda o estado do editor, inclusive as imagens,
// no navegador de quem usa. Nada sai da máquina.

const BANCO = 'universo-odisse';
const LOJA = 'estado';

function abrir() {
  return new Promise((ok, erro) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}

export async function ler(chave) {
  try {
    const db = await abrir();
    return await new Promise((ok, erro) => {
      const r = db.transaction(LOJA).objectStore(LOJA).get(chave);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => erro(r.error);
    });
  } catch (e) {
    console.warn('[universo] leitura falhou', e);
    return undefined;
  }
}

export async function gravar(chave, valor) {
  try {
    const db = await abrir();
    await new Promise((ok, erro) => {
      const tx = db.transaction(LOJA, 'readwrite');
      tx.objectStore(LOJA).put(valor, chave);
      tx.oncomplete = ok;
      tx.onerror = () => erro(tx.error);
    });
  } catch (e) {
    console.warn('[universo] gravação falhou', e);
  }
}
