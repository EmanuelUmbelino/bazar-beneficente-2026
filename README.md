# Bazar da União do Vegetal

Site de vitrine do bazar beneficente da União do Vegetal (sábado, 14/11/2026), com mercadorias apreendidas e doadas pela Receita Federal. Só exibe os produtos: não há compra pelo site.

Publicado em: https://emanuelumbelino.github.io/bazar-beneficente-2026/

## Páginas

| Página | O que é |
|---|---|
| `index.html` | Catálogo: categorias, busca, ordenação, desconto em destaque e detalhe de cada produto |
| `regras.html` | Regras de compra do bazar |
| `admin.html` | Controle de vendas: marca quantas unidades de cada produto já saíram (não aparece no menu nem em buscador) |

HTML, CSS e JavaScript puros, sem build. O GitHub Pages serve direto da branch `main`.

## Dados

- `data/produtos.json`: dados do bazar (nome, data, local, Instagram, aviso), categorias e produtos.
- `data/vendidos.json`: unidades vendidas por produto. Quem grava é a tela de controle.
- `img/produtos/`: fotos (quadradas, fundo branco, `.webp`). São ilustrativas.

**Data, horário, local e Instagram:** preencha os campos em `bazar` no `produtos.json`. Enquanto estiverem vazios, o site diz que serão divulgados em breve.

**Desconto:** `bazar.descontoSobre` escolhe a referência.
- `menor` (padrão): o menor valor entre a média de mercado e a avaliação da Receita. É o mais conservador.
- `mercado`: só a média de mercado (limite de baixo da faixa).
- `rfb`: só a avaliação da Receita.

Se o preço do bazar não fica abaixo da referência, o produto aparece sem selo de desconto.

**Preço de mercado:** conferido em 21/10/2026 na página de cada loja; fontes em `data/fontes-de-preco.md` e no detalhe de cada produto no site.

**Atualizar pela planilha:** `python ferramentas/importar_planilha.py` lê a planilha de produtos e atualiza unidades, valores e preço. Nome de exibição, categoria, descrição e foto continuam como estão, e a média de mercado também, nos produtos marcados com `mercadoConferido`. Produto novo entra sem foto e na categoria "Outros": complete à mão.

## Controle de vendas

Abra `admin.html` no celular ou no computador. Na primeira vez, conecte um token do GitHub:

1. Em https://github.com/settings/personal-access-tokens/new, crie um token *fine-grained*.
2. **Repository access:** só este repositório.
3. **Permissions → Contents:** Read and write.
4. Cole o token na tela. Ele fica salvo só naquele navegador.

Cada salvamento vira um commit em `data/vendidos.json`, então o histórico fica no git. O site público confere o estoque a cada minuto; a publicação pelo Pages leva cerca de 1 minuto. Se duas pessoas salvam ao mesmo tempo, a tela lê a versão mais nova antes de gravar e só muda os produtos que ela alterou.

## Rodar local

```
python -m http.server 8000
```

e abra http://localhost:8000.
