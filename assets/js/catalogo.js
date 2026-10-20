import { carregarTudo, carregarJson, dinheiro, referencia, desconto, restantes, faixaMercado, semAcento, el } from './comum.js';

const estado = { categoria: 'todos', busca: '', ordem: 'destaque' };
let dados;
let vendidos = {};

const $ = (seletor) => document.querySelector(seletor);

function nomeCategoria(id) {
  return dados.categorias.find((c) => c.id === id)?.nome || 'Outros';
}

function preencherBazar() {
  const b = dados.bazar;
  document.querySelectorAll('[data-campo]').forEach((no) => {
    const valor = b[no.dataset.campo];
    if (valor) no.textContent = valor;
  });

  const linhas = [
    ['Quando', [b.data, b.horario].filter(Boolean).join(', ') || 'A divulgar'],
    ['Onde', b.local || 'A divulgar'],
    ['Pagamento', b.pagamento || 'Dinheiro, PIX ou cartão'],
    ['Limite', `${dinheiro(b.limitePorCpf)} por CPF`],
    b.instagram && ['Instagram', el('a', { href: `https://instagram.com/${b.instagram.replace('@', '')}`, target: '_blank', rel: 'noopener' }, b.instagram)],
  ].filter(Boolean);
  $('#ficha').replaceChildren(...linhas.map(([k, v]) => el('div', {}, el('dt', {}, k), el('dd', {}, v))));

  $('#nota').textContent =
    'Imagens ilustrativas. O preço riscado é a referência mais baixa entre a média de mercado e a avaliação da Receita Federal. ' +
    'Os preços valem no dia do bazar e a disponibilidade pode mudar durante o evento.';
}

function montarCategorias() {
  const usadas = dados.categorias.filter((c) => dados.produtos.some((p) => p.categoria === c.id));
  const lista = [{ id: 'todos', nome: 'Todos' }, ...usadas];
  $('#categorias').replaceChildren(...lista.map((c) =>
    el('button', { type: 'button', 'aria-pressed': String(estado.categoria === c.id), onclick: () => escolherCategoria(c.id) }, c.nome)));
}

function escolherCategoria(id) {
  estado.categoria = id;
  history.replaceState(null, '', id === 'todos' ? location.pathname : `#${id}`);
  montarCategorias();
  desenhar();
}

function filtrados() {
  const criterio = dados.bazar.descontoSobre;
  const termo = semAcento(estado.busca.trim());
  const lista = dados.produtos
    .map((p, ordem) => ({ p, ordem }))
    .filter(({ p }) => estado.categoria === 'todos' || p.categoria === estado.categoria)
    .filter(({ p }) => !termo || semAcento(`${p.nome} ${p.modelo || ''} ${nomeCategoria(p.categoria)}`).includes(termo));

  const comparar = {
    destaque: (a, b) => a.ordem - b.ordem,
    desconto: (a, b) => desconto(b.p, criterio) - desconto(a.p, criterio),
    menor: (a, b) => a.p.preco - b.p.preco,
    maior: (a, b) => b.p.preco - a.p.preco,
  }[estado.ordem];

  // Esgotado vai para o fim, qualquer que seja a ordem.
  return lista
    .sort((a, b) => (restantes(a.p, vendidos) === 0) - (restantes(b.p, vendidos) === 0) || comparar(a, b))
    .map(({ p }) => p);
}

function textoEstoque(p) {
  const r = restantes(p, vendidos);
  if (r === 0) return 'Esgotado';
  if (r < p.unidades) return r === 1 ? 'Resta 1 unidade' : `Restam ${r.toLocaleString('pt-BR')} unidades`;
  return p.unidades === 1 ? 'Unidade única' : `${p.unidades.toLocaleString('pt-BR')} unidades`;
}

function cartao(p) {
  const criterio = dados.bazar.descontoSobre;
  const pct = desconto(p, criterio);
  const esgotado = restantes(p, vendidos) === 0;

  return el('article', { class: `card${esgotado ? ' card--esgotado' : ''}` },
    el('div', { class: 'card__foto' },
      el('img', { src: p.imagem, alt: '', loading: 'lazy', width: 400, height: 400 }),
      pct > 0 && !esgotado && el('span', { class: 'etiqueta' }, `-${pct}%`),
      esgotado && el('div', { class: 'esgotado' }, el('span', {}, 'Esgotado'))),
    el('div', { class: 'card__corpo' },
      el('p', { class: 'card__cat' }, nomeCategoria(p.categoria)),
      el('h3', { class: 'card__nome' },
        el('button', { type: 'button', class: 'card__abrir', onclick: () => abrir(p) }, p.nome)),
      el('div', { class: 'preco' },
        el('strong', { class: 'preco__por' }, dinheiro(p.preco)),
        pct > 0 && el('s', { class: 'preco__de' }, dinheiro(referencia(p, criterio)))),
      el('p', { class: 'card__estoque' }, textoEstoque(p))));
}

function desenhar() {
  const lista = filtrados();
  $('#grade').replaceChildren(...lista.map(cartao));
  $('#vazio').hidden = lista.length > 0;
  const onde = estado.categoria === 'todos' ? '' : ` em ${nomeCategoria(estado.categoria)}`;
  $('#contagem').textContent = `${lista.length} ${lista.length === 1 ? 'produto' : 'produtos'}${onde}`;
}

function abrir(p) {
  const b = dados.bazar;
  const pct = desconto(p, b.descontoSobre);
  const ref = referencia(p, b.descontoSobre);
  const esgotado = restantes(p, vendidos) === 0;
  const faixa = faixaMercado(p);

  const linhas = [
    faixa && ['Média de mercado', faixa],
    p.valorRfb && ['Avaliação da Receita Federal', dinheiro(p.valorRfb)],
    ['Disponibilidade', textoEstoque(p)],
  ].filter(Boolean);

  $('#detalhe-conteudo').replaceChildren(
    el('button', { class: 'detalhe__fechar', type: 'button', 'aria-label': 'Fechar', onclick: fechar },
      el('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', html: '<path d="M6 6l12 12M18 6 6 18"/>' })),
    el('div', { class: 'detalhe__foto' },
      el('img', { src: p.imagem, alt: p.nome }),
      pct > 0 && !esgotado && el('span', { class: 'etiqueta' }, `-${pct}%`),
      el('span', { class: 'detalhe__ilustrativa' }, 'Imagem ilustrativa')),
    el('div', { class: 'detalhe__info' },
      el('p', { class: 'card__cat' }, nomeCategoria(p.categoria)),
      el('h2', { id: 'detalhe-nome' }, p.nome),
      p.modelo && el('p', { class: 'detalhe__modelo' }, `Modelo ${p.modelo}`),
      el('div', { class: 'detalhe__preco' },
        el('strong', { class: 'preco__por' }, dinheiro(p.preco)),
        el('p', {}, pct > 0
          ? ['Referência ', el('s', {}, dinheiro(ref)), '. Economia de ', el('b', {}, dinheiro(Math.round((ref - p.preco) * 100) / 100)), ' por unidade.']
          : 'Preço por unidade.')),
      p.descricao && el('p', { class: 'detalhe__descricao' }, p.descricao),
      el('dl', { class: 'detalhe__tabela' }, ...linhas.map(([k, v]) => el('div', {}, el('dt', {}, k), el('dd', {}, v)))),
      p.preco > b.limitePorCpf && el('p', { class: 'detalhe__alerta' },
        `Acima de ${dinheiro(b.limitePorCpf)} por unidade: só pode ser comprado isoladamente, sem somar outros itens na mesma compra.`),
      el('a', { class: 'detalhe__regras', href: 'regras.html' }, 'Ver as regras de compra')));

  $('#detalhe').showModal();
}

function fechar() {
  $('#detalhe').close();
}

async function atualizarVendidos() {
  try {
    const estoque = await carregarJson('data/vendidos.json');
    const novo = estoque.vendidos || {};
    if (JSON.stringify(novo) !== JSON.stringify(vendidos)) {
      vendidos = novo;
      desenhar();
    }
  } catch { /* sem rede: segue com o que tem */ }
}

async function iniciar() {
  try {
    const tudo = await carregarTudo();
    dados = tudo.dados;
    vendidos = tudo.estoque.vendidos || {};
  } catch (erro) {
    $('#grade').replaceChildren(el('p', { class: 'vazio' }, 'Não foi possível carregar o catálogo. Recarregue a página.'));
    console.error(erro);
    return;
  }

  const inicial = location.hash.slice(1);
  if (dados.categorias.some((c) => c.id === inicial)) estado.categoria = inicial;

  preencherBazar();
  montarCategorias();
  desenhar();

  $('#busca').addEventListener('input', (e) => { estado.busca = e.target.value; desenhar(); });
  $('#ordem').addEventListener('change', (e) => { estado.ordem = e.target.value; desenhar(); });
  $('#detalhe').addEventListener('click', (e) => { if (e.target.id === 'detalhe') fechar(); });

  // Durante o bazar, o estoque muda: confere a cada minuto com a aba aberta.
  setInterval(() => { if (!document.hidden) atualizarVendidos(); }, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizarVendidos(); });
}

iniciar();
