import { carregarTudo, carregarJson, dinheiro, referencia, desconto, restantes, faixaMercado, el } from './comum.js';

const estado = { categoria: 'todos' };
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

  const info = $('#info');
  const itens = [
    b.data && ['calendario', [b.data, b.horario].filter(Boolean).join(', ')],
    b.local && ['local', b.local],
    b.instagram && ['instagram', b.instagram],
  ].filter(Boolean);
  if (!itens.length) itens.push(['calendario', 'Data, horário e local serão divulgados em breve']);
  const icones = {
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    local: '<path d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>',
  };
  info.replaceChildren(...itens.map(([icone, texto]) => {
    const conteudo = icone === 'instagram'
      ? el('a', { href: `https://instagram.com/${texto.replace('@', '')}`, target: '_blank', rel: 'noopener' }, texto)
      : texto;
    return el('li', {}, el('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', html: icones[icone] }), conteudo);
  }));

  $('#nota').textContent =
    'Imagens ilustrativas. O desconto é calculado sobre o menor valor de referência entre a média de mercado e a avaliação da Receita Federal. ' +
    'Os preços valem no dia do bazar e a disponibilidade pode mudar durante o evento.';
}

function preencherNumeros() {
  const criterio = dados.bazar.descontoSobre;
  const disponiveis = dados.produtos.reduce((soma, p) => soma + restantes(p, vendidos), 0);
  const maior = Math.max(...dados.produtos.map((p) => desconto(p, criterio)));
  const linhas = [
    [dados.produtos.length, 'produtos'],
    [disponiveis.toLocaleString('pt-BR'), 'unidades disponíveis'],
    [`até ${maior}%`, 'abaixo da referência'],
  ];
  $('#numeros').replaceChildren(...linhas.map(([valor, rotulo]) =>
    el('div', {}, el('dt', {}, rotulo), el('dd', {}, valor))));
}

function montarVitrine() {
  const criterio = dados.bazar.descontoSobre;
  // O mais valioso de cada categoria, para a vitrine não repetir produto parecido.
  const porCategoria = new Map();
  for (const p of dados.produtos) {
    if (restantes(p, vendidos) === 0) continue;
    const atual = porCategoria.get(p.categoria);
    if (!atual || p.preco > atual.preco) porCategoria.set(p.categoria, p);
  }
  const destaques = [...porCategoria.values()].sort((a, b) => b.preco - a.preco).slice(0, 3);
  $('#vitrine').replaceChildren(...destaques.map((p) => {
    const pct = desconto(p, criterio);
    return el('figure', {}, el('img', { src: p.imagem, alt: '' }), pct > 0 && el('span', {}, `-${pct}%`));
  }));
}

function montarCategorias() {
  const contagem = (id) => dados.produtos.filter((p) => id === 'todos' || p.categoria === id).length;
  const lista = [{ id: 'todos', nome: 'Todos' }, ...dados.categorias.filter((c) => contagem(c.id) > 0)];
  $('#categorias').replaceChildren(...lista.map((c) =>
    el('button', {
      class: 'aba',
      role: 'tab',
      type: 'button',
      'aria-selected': String(estado.categoria === c.id),
      onclick: () => escolherCategoria(c.id),
    }, c.nome, el('span', { class: 'aba__n' }, contagem(c.id)))));
}

function escolherCategoria(id) {
  estado.categoria = id;
  history.replaceState(null, '', id === 'todos' ? location.pathname : `#${id}`);
  montarCategorias();
  desenhar();
}

function filtrados() {
  // Ordem do produtos.json; esgotado vai para o fim.
  return dados.produtos
    .filter((p) => estado.categoria === 'todos' || p.categoria === estado.categoria)
    .map((p, ordem) => ({ p, ordem }))
    .sort((a, b) => (restantes(a.p, vendidos) === 0) - (restantes(b.p, vendidos) === 0) || a.ordem - b.ordem)
    .map(({ p }) => p);
}

function textoEstoque(p) {
  const r = restantes(p, vendidos);
  if (r === 0) return 'Esgotado';
  if (r < p.unidades) return r === 1 ? 'Resta 1 unidade' : `Restam ${r.toLocaleString('pt-BR')} unidades`;
  return p.unidades === 1 ? 'Única unidade' : `${p.unidades.toLocaleString('pt-BR')} unidades`;
}

function cartao(p) {
  const criterio = dados.bazar.descontoSobre;
  const pct = desconto(p, criterio);
  const ref = referencia(p, criterio);
  const esgotado = restantes(p, vendidos) === 0;

  return el('article', { class: `card${esgotado ? ' card--esgotado' : ''}` },
    el('div', { class: 'card__foto' },
      el('img', { src: p.imagem, alt: '', loading: 'lazy', width: 400, height: 400 }),
      pct > 0 && !esgotado && el('span', { class: 'selo' }, `-${pct}%`),
      esgotado && el('span', { class: 'tarja' }, 'Esgotado')),
    el('div', { class: 'card__corpo' },
      el('p', { class: 'card__cat' }, nomeCategoria(p.categoria)),
      el('h3', { class: 'card__nome' },
        el('button', { type: 'button', class: 'card__abrir', onclick: () => abrir(p) }, p.nome)),
      el('div', { class: 'preco' },
        pct > 0 && el('s', { class: 'preco__de' }, dinheiro(ref)),
        el('strong', { class: 'preco__por' }, dinheiro(p.preco))),
      pct > 0 && el('p', { class: 'card__economia' }, `Economia de ${dinheiro(Math.round((ref - p.preco) * 100) / 100)}`),
      el('p', { class: `card__estoque${esgotado ? ' card__estoque--fim' : ''}` }, textoEstoque(p))));
}

function desenhar() {
  const lista = filtrados();
  $('#grade').replaceChildren(...lista.map(cartao));
  $('#vazio').hidden = lista.length > 0;
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

  const caixa = $('#detalhe-conteudo');
  caixa.replaceChildren(
    el('button', { class: 'detalhe__fechar', type: 'button', 'aria-label': 'Fechar', onclick: fechar },
      el('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', html: '<path d="M6 6l12 12M18 6 6 18"/>' })),
    el('div', { class: 'detalhe__foto' },
      el('img', { src: p.imagem, alt: p.nome }),
      el('span', { class: 'detalhe__ilustrativa' }, 'Imagem ilustrativa')),
    el('div', { class: 'detalhe__info' },
      el('p', { class: 'card__cat' }, nomeCategoria(p.categoria)),
      el('h2', { id: 'detalhe-nome' }, p.nome),
      p.modelo && el('p', { class: 'detalhe__modelo' }, `Modelo ${p.modelo}`),
      el('div', { class: 'detalhe__preco' },
        el('div', {},
          pct > 0 && el('s', { class: 'preco__de' }, dinheiro(ref)),
          el('strong', { class: 'preco__por' }, dinheiro(p.preco)),
          el('span', { class: 'detalhe__un' }, 'por unidade')),
        pct > 0 && !esgotado && el('span', { class: 'selo selo--grande' }, `-${pct}%`)),
      p.descricao && el('p', { class: 'detalhe__descricao' }, p.descricao),
      el('dl', { class: 'detalhe__tabela' }, ...linhas.map(([k, v]) => el('div', {}, el('dt', {}, k), el('dd', {}, v)))),
      p.preco > b.limitePorCpf && el('p', { class: 'detalhe__alerta' },
        `Acima de ${dinheiro(b.limitePorCpf)} por unidade: só pode ser comprado isoladamente, sem somar outros itens na mesma compra.`),
      el('a', { class: 'detalhe__regras', href: 'regras.html' }, 'Ver as regras de compra')));

  const dialogo = $('#detalhe');
  dialogo.showModal();
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
      preencherNumeros();
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
  preencherNumeros();
  montarVitrine();
  montarCategorias();
  desenhar();

  $('#detalhe').addEventListener('click', (e) => { if (e.target.id === 'detalhe') fechar(); });

  // Durante o bazar, o estoque muda: confere a cada minuto com a aba aberta.
  setInterval(() => { if (!document.hidden) atualizarVendidos(); }, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizarVendidos(); });
}

iniciar();
