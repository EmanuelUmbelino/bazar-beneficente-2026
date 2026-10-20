// O que o catálogo e a tela de controle dividem: carregar os dados, calcular desconto, formatar.

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCurto = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function dinheiro(valor) {
  return Number.isInteger(valor) ? brlCurto.format(valor) : brl.format(valor);
}

export async function carregarJson(caminho) {
  const resposta = await fetch(`${caminho}?t=${Date.now()}`, { cache: 'no-store' });
  if (!resposta.ok) throw new Error(`Não consegui ler ${caminho} (${resposta.status})`);
  return resposta.json();
}

export async function carregarTudo() {
  const [dados, estoque] = await Promise.all([
    carregarJson('data/produtos.json'),
    carregarJson('data/vendidos.json').catch(() => ({ vendidos: {} })),
  ]);
  return { dados, estoque };
}

// Referência do desconto: "menor" usa o menor valor entre a média de mercado e a avaliação
// da Receita (o mais conservador); "mercado" ou "rfb" usam só um deles.
export function referencia(produto, criterio = 'menor') {
  const mercado = produto.mercado?.[0];
  const rfb = produto.valorRfb;
  if (criterio === 'mercado') return mercado;
  if (criterio === 'rfb') return rfb;
  return Math.min(...[mercado, rfb].filter((v) => v > 0));
}

export function desconto(produto, criterio) {
  const ref = referencia(produto, criterio);
  if (!ref || ref <= produto.preco) return 0;
  return Math.round((1 - produto.preco / ref) * 100);
}

export function restantes(produto, vendidos) {
  return Math.max(0, produto.unidades - (vendidos?.[produto.id] || 0));
}

export function faixaMercado(produto) {
  const [min, max] = produto.mercado || [];
  if (!min) return null;
  return max && max !== min ? `${dinheiro(min)} a ${dinheiro(max)}` : dinheiro(min);
}

export function semAcento(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function el(tag, atributos = {}, ...filhos) {
  const no = tag === 'svg' ? document.createElementNS('http://www.w3.org/2000/svg', 'svg') : document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (valor === false || valor == null) continue;
    if (chave === 'class') no.className = valor;
    else if (chave.startsWith('on')) no.addEventListener(chave.slice(2), valor);
    else if (chave === 'html') no.innerHTML = valor;
    else no.setAttribute(chave, valor === true ? '' : valor);
  }
  for (const filho of filhos.flat()) {
    if (filho == null || filho === false) continue;
    no.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return no;
}
