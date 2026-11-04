// Padrões do sistema Odisse: estilos de texto e espaçamentos.
// Fonte única para todos os modelos e para todos os formatos (Post 3:4, Stories 9:16…).
// Medidas em px sobre a largura de 1080, comum a todos os formatos; o que é vertical
// é medido a partir do topo ou da base do card, nunca de uma altura fixa.

export const FORMATOS = [
  { id: '3x4', nome: 'Post 3:4', larg: 1080, alt: 1440, ativo: true },
  { id: '9x16', nome: 'Stories 9:16', larg: 1080, alt: 1920, ativo: false },
];

/**
 * Estilos de texto. `tamanho` é um número (corpo fixo) ou [mín, máx]: estilos com faixa
 * ajustam o corpo para caber na área do modelo, começando pelo máximo.
 */
export const TEXTO = [
  { id: 'capa', nome: 'Capa', classe: 't-capa', peso: 700, tamanho: [80, 120], entrelinha: 0.94, tracking: -0.04,
    uso: 'Título da capa e nome do projeto.' },
  { id: 'titulo', nome: 'Título', classe: 't-titulo', peso: 700, tamanho: [64, 104], entrelinha: 0.96, tracking: -0.035,
    uso: 'Título dos cards de corpo e dos posts únicos.' },
  { id: 'chamada', nome: 'Chamada', classe: 't-chamada', peso: 700, tamanho: 72, entrelinha: 0.98, tracking: -0.03,
    uso: 'Chamada do fechamento, subtítulos e numeração de etapas (01, 02, 03).' },
  { id: 'citacao', nome: 'Citação', classe: 't-citacao', peso: 480, tamanho: [52, 70], entrelinha: 1.1, tracking: -0.025,
    uso: 'Citações em destaque.' },
  { id: 'texto', nome: 'Texto', classe: 't-texto', peso: 400, tamanho: 29, entrelinha: 1.34, tracking: -0.01,
    uso: 'Texto de apoio, colunas de texto, valores da ficha e contatos.' },
  { id: 'legenda', nome: 'Legenda', classe: 't-legenda', peso: 400, tamanho: 24, entrelinha: 1.3, tracking: 0,
    uso: 'Legendas de imagem, créditos, subtítulo de capa e colunas curtas.' },
  { id: 'rotulo', nome: 'Rótulo', classe: 't-rotulo', peso: 600, tamanho: 20, entrelinha: 1.2, tracking: 0.08, caixaAlta: true,
    uso: 'Cabeçalho do card, rótulos, assinatura, rótulos da ficha e rodapés.' },
];

export const TEXTO_POR_CLASSE = Object.fromEntries(TEXTO.map((t) => [t.classe, t]));
export const corpoMax = (t) => (Array.isArray(t.tamanho) ? t.tamanho[1] : t.tamanho);
export const corpoMin = (t) => (Array.isArray(t.tamanho) ? t.tamanho[0] : t.tamanho);

/** Espaçamentos. Grupo `grid` organiza o plano; `ritmo` separa elementos; `posicao` fixa topo e base. */
export const ESPACO = [
  { id: 'margem', nome: 'Margem lateral', grupo: 'grid', v: 52, uso: 'Da borda do card ao conteúdo, à esquerda e à direita. Grid de 12 colunas.' },
  { id: 'gutter', nome: 'Entre colunas', grupo: 'grid', v: 16, uso: 'Espaço entre as 12 colunas do grid.' },
  { id: 'corte', nome: 'Corte', grupo: 'grid', v: 8, uso: 'Corte entre imagens vizinhas, no meio do espaço entre colunas.' },

  { id: 'justo', nome: 'Justo', grupo: 'ritmo', v: 8, uso: 'Dentro de uma mesma peça: rótulo → legenda, rótulo → valor na ficha empilhada.' },
  { id: 'proximo', nome: 'Próximo', grupo: 'ritmo', v: 16, uso: 'Elementos ligados: rótulo → título, rótulo → texto, título → subtítulo, número → rótulo, imagem → rótulo da imagem.' },
  { id: 'filete', nome: 'Filete', grupo: 'ritmo', v: 20, uso: 'Do filete ao conteúdo, acima e abaixo; linhas da ficha.' },
  { id: 'assinatura', nome: 'Assinatura', grupo: 'ritmo', v: 32, uso: 'Título ou imagens → assinatura e autoria.' },
  { id: 'bloco', nome: 'Bloco', grupo: 'ritmo', v: 48, uso: 'Entre blocos, sempre o mesmo valor: título → texto, texto → imagem, imagem → texto, texto → ficha, texto → borda do painel.' },

  { id: 'cabecalho', nome: 'Cabeçalho', grupo: 'posicao', v: 38, uso: 'Do topo do card ao cabeçalho (estilo Rótulo).' },
  { id: 'topo', nome: 'Início do conteúdo', grupo: 'posicao', v: 128, uso: 'Do topo do card ao primeiro texto, quando não há imagem no alto.' },
  { id: 'selo', nome: 'Selo do rodapé', grupo: 'posicao', v: 66, uso: 'Da base do card ao centro do selo.' },
  { id: 'ponto', nome: 'Pontos laterais', grupo: 'posicao', v: 10, uso: 'Diâmetro dos 6 pontos, centrados na margem (26 px da borda), na altura do cabeçalho, do meio do card e do selo.' },
];

export const GRUPOS_ESPACO = [
  ['ritmo', 'Ritmo vertical', 'Distâncias entre elementos. São as que mais aparecem nos modelos.'],
  ['grid', 'Grid', 'Organização horizontal do plano.'],
  ['posicao', 'Posições fixas', 'Medidas a partir do topo ou da base, iguais em qualquer formato.'],
];

/** Valores numéricos por id: E.bloco, E.proximo… */
export const E = Object.fromEntries(ESPACO.map((e) => [e.id, e.v]));

/** CSS gerado a partir dos padrões; instalado uma vez no documento. */
export function cssDosPadroes() {
  const tipos = TEXTO.map((t) => `.card .${t.classe}{font-size:${corpoMax(t)}px;font-weight:${t.peso};line-height:${t.entrelinha};letter-spacing:${t.tracking}em;${t.caixaAlta ? 'text-transform:uppercase;' : ''}}`).join('\n');
  const vars = ESPACO.map((e) => `--e-${e.id}:${e.v}px;`).join('');
  return `.card{${vars}}\n${tipos}`;
}

export function instalarPadroes() {
  if (document.getElementById('padroes-css')) return;
  const st = document.createElement('style');
  st.id = 'padroes-css';
  st.textContent = cssDosPadroes();
  document.head.prepend(st);
}
