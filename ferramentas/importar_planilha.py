"""Atualiza data/produtos.json a partir da planilha de produtos do bazar.

Uso:  python ferramentas/importar_planilha.py

Casa cada linha da planilha com um produto pelo campo "nomePlanilha" e atualiza unidades,
avaliação da Receita, faixa de mercado e preço. Nome de exibição, categoria, descrição e foto
ficam como estão. Linha nova entra no fim com categoria "outros" e sem foto: complete à mão.
"""
import csv
import io
import json
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

PLANILHA = '1uaAvno3Ocw79j11AjuoMqlgEW89tV5w3HbkPCH8VfU8'
URL = f'https://docs.google.com/spreadsheets/d/{PLANILHA}/export?format=csv&gid=0'
ARQUIVO = Path(__file__).resolve().parent.parent / 'data' / 'produtos.json'


def numero(texto):
    """'R$ 2.000,00' -> 2000.0"""
    limpo = re.sub(r'[^\d,]', '', texto or '').replace(',', '.')
    return float(limpo) if limpo else None


def faixa(texto):
    """'~R$ 2.800–3.200' -> [2800, 3200]; '~R$ 1.500' -> [1500, 1500]"""
    partes = [numero(p) for p in re.split(r'[–-]', texto or '') if numero(p)]
    if not partes:
        return None
    return [partes[0], partes[-1]]


def inteiro_se_der(valor):
    return int(valor) if valor is not None and float(valor).is_integer() else valor


def slug(texto):
    texto = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', texto.lower()).strip('-')


def main():
    with urllib.request.urlopen(URL) as resposta:
        linhas = list(csv.DictReader(io.StringIO(resposta.read().decode('utf-8'))))

    dados = json.loads(ARQUIVO.read_text(encoding='utf-8'))
    por_nome = {p['nomePlanilha']: p for p in dados['produtos']}
    vistos, novos, mudados = set(), [], []

    for linha in linhas:
        nome = (linha.get('Produto') or '').strip()
        if not nome:
            continue  # linha de total
        unidades = int(numero(linha.get('Unidades')) or 0)
        campos = {
            'unidades': unidades,
            'valorRfb': inteiro_se_der(numero(linha.get('Valor Unitário'))),
            'mercado': [inteiro_se_der(v) for v in (faixa(linha.get('Valor Médio Mercado')) or [])],
            'preco': inteiro_se_der(numero(linha.get('Valor Bazar'))),
        }
        vistos.add(nome)
        produto = por_nome.get(nome)
        if produto is None:
            produto = {'id': slug(nome), 'nomePlanilha': nome, 'nome': nome, 'categoria': 'outros',
                       'modelo': '', 'descricao': '', 'imagem': 'assets/img/sem-foto.svg', **campos}
            dados['produtos'].append(produto)
            novos.append(nome)
            continue
        diferencas = [k for k, v in campos.items() if produto.get(k) != v]
        if diferencas:
            produto.update(campos)
            mudados.append(f'{nome} ({", ".join(diferencas)})')

    sumidos = [p['nomePlanilha'] for p in dados['produtos'] if p['nomePlanilha'] not in vistos]

    if novos and not any(c['id'] == 'outros' for c in dados['categorias']):
        dados['categorias'].append({'id': 'outros', 'nome': 'Outros'})

    if novos or mudados:
        ARQUIVO.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print(f'{len(vistos)} produtos na planilha.')
    for titulo, lista in (('Novos (complete nome, categoria, descrição e foto)', novos),
                          ('Atualizados', mudados),
                          ('No site mas fora da planilha (apague à mão se saíram)', sumidos)):
        if lista:
            print(f'\n{titulo}:')
            for item in lista:
                print(f'  - {item}')
    if not (novos or mudados or sumidos):
        print('Nada mudou.')


if __name__ == '__main__':
    sys.exit(main())
