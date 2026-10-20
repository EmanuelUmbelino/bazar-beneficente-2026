import { carregarJson, dinheiro, semAcento, el } from './comum.js';

// A tela grava data/vendidos.json no repositório pela API do GitHub, com o token de quem
// está usando (guardado só neste navegador). O site público lê o mesmo arquivo.
const CHAVE_TOKEN = 'bazar-token-github';
const ARQUIVO = 'data/vendidos.json';

let dados;
let salvos = {};      // o que está no repositório
let atuais = {};      // o que está na tela
let busca = '';

const $ = (seletor) => document.querySelector(seletor);
const token = () => localStorage.getItem(CHAVE_TOKEN);

function api(caminho, opcoes = {}) {
  const { dono, repo } = dados.github;
  return fetch(`https://api.github.com/repos/${dono}/${repo}${caminho}`, {
    ...opcoes,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opcoes.headers || {}),
    },
  });
}

const paraBase64 = (texto) => btoa(String.fromCharCode(...new TextEncoder().encode(texto)));
const deBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

async function lerDoRepositorio() {
  const resposta = await api(`/contents/${ARQUIVO}?ref=${dados.github.branch}`);
  if (resposta.status === 404) return { sha: null, conteudo: { vendidos: {} } };
  if (!resposta.ok) throw await erroDaApi(resposta);
  const json = await resposta.json();
  return { sha: json.sha, conteudo: JSON.parse(deBase64(json.content)) };
}

async function erroDaApi(resposta) {
  const corpo = await resposta.json().catch(() => ({}));
  const motivos = {
    401: 'Token inválido ou expirado. Gere outro em Acesso.',
    403: 'O token não tem permissão de escrita (Contents: Read and write) neste repositório.',
    404: 'Repositório não encontrado para este token. Confira se ele inclui o repositório do bazar.',
    409: 'Alguém salvou ao mesmo tempo. Tente salvar de novo.',
  };
  return new Error(motivos[resposta.status] || corpo.message || `Erro ${resposta.status}`);
}

function aviso(texto, erro = false) {
  const t = $('#toast');
  t.textContent = texto;
  t.className = `aviso-flutuante${erro ? ' erro' : ''}`;
  t.hidden = false;
  clearTimeout(aviso.timer);
  aviso.timer = setTimeout(() => { t.hidden = true; }, erro ? 7000 : 4000);
}

function alterados() {
  return dados.produtos.filter((p) => (atuais[p.id] || 0) !== (salvos[p.id] || 0));
}

function definir(produto, valor) {
  const n = Math.max(0, Math.min(produto.unidades, Math.round(Number(valor) || 0)));
  atuais[produto.id] = n;
  desenhar();
}

function desenharResumo() {
  let unidades = 0;
  let receita = 0;
  let esgotados = 0;
  let total = 0;
  for (const p of dados.produtos) {
    const v = atuais[p.id] || 0;
    unidades += v;
    receita += v * p.preco;
    total += p.unidades;
    if (v >= p.unidades) esgotados += 1;
  }
  const linhas = [
    ['Unidades vendidas', `${unidades.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`],
    ['Arrecadado', dinheiro(Math.round(receita * 100) / 100)],
    ['Produtos esgotados', `${esgotados} de ${dados.produtos.length}`],
    ['Ainda à venda', dinheiro(Math.round(dados.produtos.reduce((s, p) => s + (p.unidades - (atuais[p.id] || 0)) * p.preco, 0) * 100) / 100)],
  ];
  $('#resumo').replaceChildren(...linhas.map(([k, v]) => el('div', {}, el('dt', {}, k), el('dd', {}, v))));
}

function linha(p) {
  const v = atuais[p.id] || 0;
  const mudou = v !== (salvos[p.id] || 0);
  const fim = v >= p.unidades;
  const estado = fim
    ? el('span', { class: 'linha__estado linha__estado--fim' }, 'Esgotado')
    : v > 0 && el('span', { class: 'linha__estado linha__estado--parcial' }, `Restam ${(p.unidades - v).toLocaleString('pt-BR')}`);

  const entrada = el('input', {
    type: 'number', min: 0, max: p.unidades, value: v, inputmode: 'numeric', 'aria-label': `Vendidos de ${p.nome}`,
    onchange: (e) => definir(p, e.target.value),
  });

  return el('article', { class: `linha${mudou ? ' linha--mudou' : ''}${fim ? ' linha--fim' : ''}` },
    el('img', { src: p.imagem, alt: '', loading: 'lazy' }),
    el('div', {},
      el('p', { class: 'linha__nome' }, p.nome, estado),
      el('p', { class: 'linha__meta' }, el('b', {}, dinheiro(p.preco)), ` · ${p.unidades.toLocaleString('pt-BR')} ${p.unidades === 1 ? 'unidade' : 'unidades'} no total`)),
    el('div', { class: 'controle' },
      el('div', { class: 'passo' },
        el('button', { type: 'button', 'aria-label': 'Um a menos', disabled: v <= 0, onclick: () => definir(p, v - 1) }, '−'),
        entrada,
        el('button', { type: 'button', 'aria-label': 'Um vendido', disabled: fim, onclick: () => definir(p, v + 1) }, '+')),
      el('span', { class: 'controle__de' }, `de ${p.unidades.toLocaleString('pt-BR')}`),
      fim
        ? el('button', { type: 'button', class: 'botao-mini', onclick: () => definir(p, 0) }, 'Repor')
        : el('button', { type: 'button', class: 'botao-mini', onclick: () => definir(p, p.unidades) }, 'Esgotar')));
}

function desenhar() {
  const termo = semAcento(busca.trim());
  const lista = dados.produtos.filter((p) => !termo || semAcento(`${p.nome} ${p.modelo || ''}`).includes(termo));
  $('#linhas').replaceChildren(...lista.map(linha));
  desenharResumo();

  const mudados = alterados();
  $('#salvar').hidden = mudados.length === 0;
  $('#salvar-texto').textContent = mudados.length === 1 ? '1 produto alterado, ainda não salvo' : `${mudados.length} produtos alterados, ainda não salvos`;
}

async function salvar() {
  if (!token()) {
    abrirAcesso();
    aviso('Conecte um token do GitHub para salvar.', true);
    return;
  }
  const botao = $('#gravar');
  botao.disabled = true;
  botao.textContent = 'Salvando...';
  try {
    const mudados = alterados();
    // Lê a versão mais nova antes de gravar: se outra pessoa salvou outro produto, mantém o dela.
    const { sha, conteudo } = await lerDoRepositorio();
    const vendidos = { ...(conteudo.vendidos || {}) };
    for (const p of mudados) {
      if (atuais[p.id]) vendidos[p.id] = atuais[p.id];
      else delete vendidos[p.id];
    }
    const novo = { atualizado: new Date().toISOString(), vendidos };
    const mensagem = `Vendidos: ${mudados.map((p) => `${p.nome} ${atuais[p.id] || 0}/${p.unidades}`).join('; ')}`;

    const resposta = await api(`/contents/${ARQUIVO}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: mensagem.slice(0, 300),
        content: paraBase64(`${JSON.stringify(novo, null, 2)}\n`),
        branch: dados.github.branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!resposta.ok) throw await erroDaApi(resposta);

    salvos = { ...vendidos };
    atuais = { ...vendidos };
    desenhar();
    $('#fonte').textContent = `Salvo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`;
    aviso('Salvo. O site público atualiza em cerca de 1 minuto.');
  } catch (erro) {
    aviso(erro.message, true);
  } finally {
    botao.disabled = false;
    botao.textContent = 'Salvar';
  }
}

async function recarregar() {
  if (token()) {
    try {
      const { conteudo } = await lerDoRepositorio();
      salvos = { ...(conteudo.vendidos || {}) };
      $('#fonte').textContent = 'Lido direto do repositório.';
    } catch (erro) {
      aviso(erro.message, true);
      const estoque = await carregarJson(ARQUIVO).catch(() => ({ vendidos: {} }));
      salvos = { ...(estoque.vendidos || {}) };
      $('#fonte').textContent = 'Lido do site publicado (pode ter até 1 minuto de atraso).';
    }
  } else {
    const estoque = await carregarJson(ARQUIVO).catch(() => ({ vendidos: {} }));
    salvos = { ...(estoque.vendidos || {}) };
    $('#fonte').textContent = 'Sem token: dá para conferir, mas não para salvar.';
  }
  atuais = { ...salvos };
  desenhar();
}

function abrirAcesso() {
  const secao = $('#acesso');
  secao.hidden = false;
  $('#sair-linha').hidden = !token();
  $('#form-token').hidden = !!token();
  secao.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function conectar(evento) {
  evento.preventDefault();
  const valor = $('#token').value.trim();
  const msg = $('#acesso-msg');
  if (!valor) return;
  localStorage.setItem(CHAVE_TOKEN, valor);
  msg.className = 'acesso__msg';
  msg.textContent = 'Conferindo...';
  try {
    const { dono, repo } = dados.github;
    const resposta = await api('');
    if (!resposta.ok) throw await erroDaApi(resposta);
    const info = await resposta.json();
    if (info.permissions && !info.permissions.push) throw new Error('O token lê o repositório, mas não tem permissão de escrita.');
    msg.className = 'acesso__msg ok';
    msg.textContent = `Conectado ao ${dono}/${repo}.`;
    $('#token').value = '';
    $('#form-token').hidden = true;
    $('#sair-linha').hidden = false;
    await recarregar();
    setTimeout(() => { $('#acesso').hidden = true; }, 1500);
  } catch (erro) {
    localStorage.removeItem(CHAVE_TOKEN);
    msg.className = 'acesso__msg erro';
    msg.textContent = erro.message;
  }
}

async function iniciar() {
  dados = await carregarJson('data/produtos.json');
  $('#nome-repo').textContent = `${dados.github.dono}/${dados.github.repo}`;

  $('#busca').addEventListener('input', (e) => { busca = e.target.value; desenhar(); });
  $('#gravar').addEventListener('click', salvar);
  $('#desfazer').addEventListener('click', () => { atuais = { ...salvos }; desenhar(); });
  $('#abrir-acesso').addEventListener('click', () => ($('#acesso').hidden ? abrirAcesso() : ($('#acesso').hidden = true)));
  $('#form-token').addEventListener('submit', conectar);
  $('#sair').addEventListener('click', () => {
    localStorage.removeItem(CHAVE_TOKEN);
    $('#acesso-msg').textContent = '';
    abrirAcesso();
    recarregar();
  });
  window.addEventListener('beforeunload', (e) => { if (alterados().length) e.preventDefault(); });

  if (!token()) abrirAcesso();
  await recarregar();
}

iniciar();
