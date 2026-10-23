"""Gera a migration V030 (calorias do Batel Grill) e o relatório da importação.

A transcrição está em dados/fontes/batel/. O PDF original não entra no git.
Nome igual ao do catálogo, já com caloria, não muda. Nome igual sem caloria
recebe só a caloria. Nome novo entra com a caloria e com proteína, carboidrato
e gordura vazios: o PDF não traz esses números, e ausente não vira zero.

Uso (na raiz do repositório): python scripts/catalogo/gerar_batel.py
"""
import csv
import re
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import comum  # noqa: E402

PASTA = comum.RAIZ / "dados/fontes/batel"
CSV = PASTA / "informacoes-nutricionais.csv"
SQL = comum.RAIZ / "api/src/main/resources/db/migration/V030__calorias_batel.sql"
RELATORIO = comum.RAIZ / "dados/relatorios/batel-importacao.md"
CATALOGOS = [
    comum.RAIZ / "api/src/main/resources/db/migration/V002__catalogo_taco.sql",
    comum.RAIZ / "api/src/main/resources/db/migration/V027__fatores_do_catalogo.sql",
]

FONTE = {
    "andrea": "Batel Grill. Tabela de informação nutricional. Andréa Lúcia Tetti, CRN 295, 8ª Região.",
    "juliana": "Batel Grill. Tabela de informação nutricional. Juliana de Oliveira Ferreira, CRN-8 3960.",
}
# O mesmo nome em duas seções de suco precisa do tipo, senão o segundo some.
TIPO_DO_SUCO = {
    "Sucos naturais": "suco natural",
    "Sucos de polpas com água": "suco de polpa com água",
    "Sucos de polpas com leite condensado": "suco de polpa com leite condensado",
}
COPO_ML = Decimal("200")
CASAS = Decimal("0.01")
# A coluna KCAL/100g e a conta da porção podem diferir por arredondamento de 1 kcal.
FOLGA_KCAL = 1

LINHA_CATALOGO = re.compile(
    r"::uuid, '(?P<nome>(?:[^']|'')*)', (?P<base>[0-9.]+), '(?P<un>[^']+)', "
    r"(?P<kcal>null|[0-9.]+), (?P<prot>null|[0-9.]+), (?P<carb>null|[0-9.]+), (?P<gord>null|[0-9.]+), "
    r"(?P<gramas>null|[0-9.]+), '(?P<fonte>(?:[^']|'')*)', '(?P<grupo>(?:[^']|'')*)', "
    r"(?P<codigo>null|'(?:[^']|'')*'), (?P<tracos>null|'(?:[^']|'')*'), '(?P<busca>[^']+)'"
)


def numero(texto):
    if texto is None or str(texto).strip() == "":
        return None
    return Decimal(str(texto).strip().replace(",", "."))


def ler_transcricao(caminho=CSV):
    with open(caminho, encoding="utf-8", newline="") as arquivo:
        return list(csv.DictReader(arquivo))


def ler_catalogo(caminhos=None):
    """nome_busca -> caloria (None quando a coluna está vazia)."""
    catalogo = {}
    for caminho in caminhos or CATALOGOS:
        for linha in Path(caminho).read_text(encoding="utf-8").splitlines():
            achado = LINHA_CATALOGO.search(linha)
            if not achado:
                continue
            kcal = achado.group("kcal")
            catalogo[achado.group("busca")] = None if kcal == "null" else Decimal(kcal)
    return catalogo


def nome_gravado(item, repetidos):
    nome = item["nome"].strip()
    tipo = TIPO_DO_SUCO.get(item["secao"])
    if tipo and comum.normalizar(nome) in repetidos:
        return f"{nome}, {tipo}"
    return nome


def repetidos_de_suco(linhas):
    contagem = {}
    for item in linhas:
        if item["secao"] not in TIPO_DO_SUCO:
            continue
        chave = comum.normalizar(item["nome"])
        contagem[chave] = contagem.get(chave, 0) + 1
    return {chave for chave, total in contagem.items() if total > 1}


def preparar(linhas):
    """Devolve a lista pronta para comparar, com a caloria que será gravada."""
    repetidos = repetidos_de_suco(linhas)
    prontos = []
    for item in linhas:
        nome = nome_gravado(item, repetidos)
        kcal_100g = numero(item.get("kcal_100g"))
        kcal_porcao = numero(item.get("kcal_porcao"))
        peso = numero(item.get("peso_g"))
        if kcal_100g is None and kcal_porcao is None:
            raise ValueError(f"{nome}: a transcrição não tem caloria")
        if item["nutricionista"] not in FONTE:
            raise ValueError(f"{nome}: nutricionista desconhecida")
        if kcal_100g is None:
            base, unidade, kcal = COPO_ML, "ml", kcal_porcao
        else:
            base, unidade, kcal = Decimal("100"), "g", kcal_100g
        prontos.append({
            "secao": item["secao"].strip(),
            "nome": nome,
            "nome_pdf": item["nome"].strip(),
            "busca": comum.normalizar(nome),
            "peso": peso,
            "kcal_porcao": kcal_porcao,
            "kcal_100g": kcal_100g,
            "base": base,
            "unidade": unidade,
            "kcal": kcal.quantize(CASAS),
            "fonte": FONTE[item["nutricionista"]],
        })
    return prontos


def divergencias(itens):
    """Porção e KCAL/100g que não fecham. O número gravado continua o da coluna."""
    achados = []
    for item in itens:
        if item["peso"] is None or item["kcal_porcao"] is None or item["kcal_100g"] is None:
            continue
        if item["peso"] <= 0:
            continue
        esperado = (item["kcal_porcao"] * Decimal(100) / item["peso"]).quantize(Decimal("1"))
        if abs(esperado - item["kcal_100g"]) > FOLGA_KCAL:
            achados.append({**item, "esperado": esperado})
    return achados


def classificar(itens, catalogo):
    """Separa novos, os que já têm caloria e os que só precisam da caloria.

    `catalogo` é nome_busca -> caloria ou None. Não é alterado.
    """
    novos, ja_tinham, so_caloria = [], [], []
    vistos = set()
    for item in itens:
        busca = item["busca"]
        if busca in vistos:
            raise ValueError(f"nome repetido na transcrição: {item['nome']}")
        vistos.add(busca)
        if len(item["nome"]) > 160 or len(busca) > 200 or len(item["secao"]) > 80 or len(item["fonte"]) > 400:
            raise ValueError(f"texto longo demais: {item['nome']}")
        if busca in catalogo:
            if catalogo[busca] is None:
                so_caloria.append(item)
            else:
                ja_tinham.append(item)
        else:
            novos.append(item)
    return novos, ja_tinham, so_caloria


def gerar_sql(novos, so_caloria, sha):
    linhas = [
        "-- Calorias do Batel Grill no catálogo público.",
        f"-- GERADO por scripts/catalogo/gerar_batel.py a partir de dados/fontes/batel/{CSV.name}",
        f"-- (sha256 {sha}). Não editar à mão.",
        "-- Proteína, carboidrato e gordura ficam vazios: a tabela só publica a caloria.",
        "-- Nome que já existe e já tem caloria não é alterado.",
        "-- Nome que já existe sem caloria recebe só a caloria.",
        "",
        "alter table catalogo_alimento alter column proteina drop not null;",
        "alter table catalogo_alimento alter column carboidrato drop not null;",
        "alter table catalogo_alimento alter column gordura drop not null;",
        "alter table alimento alter column proteina drop not null;",
        "alter table alimento alter column carboidrato drop not null;",
        "alter table alimento alter column gordura drop not null;",
        "",
    ]
    if not so_caloria:
        linhas.append("-- A comparação não achou alimento do catálogo com o mesmo nome e sem caloria.")
        linhas.append("")
    for item in so_caloria:
        linhas.append(
            "update catalogo_alimento set kcal = "
            f"{item['kcal']} where nome_busca = {comum.sql_texto(item['busca'])} and kcal is null;"
        )
    if so_caloria:
        linhas.append("")
    for bloco in comum.blocos(novos, 40):
        linhas.append(
            "insert into catalogo_alimento (id, nome, base_quantidade, base_unidade, kcal, proteina, "
            "carboidrato, gordura, gramas_por_unidade, fonte, grupo, codigo_fonte, tracos, nome_busca) "
            "select * from (values"
        )
        valores = []
        for item in bloco:
            valores.append(
                f"  (md5('catalogo-alimento:batel:{item['nome']}')::uuid, {comum.sql_texto(item['nome'])}, "
                f"{item['base']}, '{item['unidade']}', {item['kcal']}, null::numeric, null::numeric, null::numeric, "
                f"null::numeric, {comum.sql_texto(item['fonte'])}, {comum.sql_texto(item['secao'])}, "
                f"null::varchar, null::varchar, {comum.sql_texto(item['busca'])})"
            )
        linhas.append(",\n".join(valores))
        linhas.append(") as entrada(id, nome, base_quantidade, base_unidade, kcal, proteina, carboidrato, gordura, "
                      "gramas_por_unidade, fonte, grupo, codigo_fonte, tracos, nome_busca)")
        linhas.append("where not exists (select 1 from catalogo_alimento c where c.nome_busca = entrada.nome_busca);")
        linhas.append("")
    return "\n".join(linhas).rstrip() + "\n"


def relatorio(novos, ja_tinham, so_caloria, fora_da_conta):
    blocos = [
        "# Calorias do Batel Grill",
        "",
        "Transcrição de `dados/fontes/batel/informacoes-nutricionais.csv`. O PDF não entra no git.",
        "A comparação é pelo nome, sem acento e sem diferença de maiúscula. "
        "“Arroz branco” não é “Arroz, tipo 1, cozido”.",
        "",
        f"- Novos, só com nome e caloria: {len(novos)}.",
        f"- Já estavam no catálogo e já tinham caloria (não mudaram): {len(ja_tinham)}.",
        f"- Já estavam no catálogo sem caloria (só a caloria foi gravada): {len(so_caloria)}.",
        "",
        "Proteína, carboidrato e gordura ficam vazios. O PDF não traz esses números, e ausente não vira zero.",
        "Comida com a coluna KCAL/100g entra por 100 g, com o número impresso. "
        "Suco entra por 200 ml, com a caloria do copo.",
        "O mesmo nome em duas seções de suco leva o tipo do suco no nome.",
        "",
        "## Porção e KCAL/100g que não fecham",
        "",
        "O número gravado continua o da coluna KCAL/100g. A conta da porção fica aqui só para conferir.",
        "",
    ]
    if not fora_da_conta:
        blocos.append("Nenhuma.")
    for item in fora_da_conta:
        blocos.append(
            f"- {item['nome_pdf']}: porção de {item['peso']} g com {item['kcal_porcao']} kcal "
            f"daria {item['esperado']} kcal/100 g; a coluna traz {item['kcal_100g']}."
        )
    if ja_tinham:
        blocos.extend(["", "## Já tinham caloria", ""])
        blocos.extend(f"- {item['nome']}" for item in ja_tinham)
    if so_caloria:
        blocos.extend(["", "## Só a caloria foi gravada", ""])
        blocos.extend(f"- {item['nome']}: {item['kcal']} kcal" for item in so_caloria)
    blocos.append("")
    return "\n".join(blocos)


def main():
    linhas = preparar(ler_transcricao())
    catalogo = ler_catalogo()
    novos, ja_tinham, so_caloria = classificar(linhas, catalogo)
    fora = divergencias(linhas)
    sha = comum.sha256(CSV)
    comum.escrever(SQL, gerar_sql(novos, so_caloria, sha))
    comum.escrever(RELATORIO, relatorio(novos, ja_tinham, so_caloria, fora))
    print(f"novos={len(novos)} ja_tinham={len(ja_tinham)} so_caloria={len(so_caloria)} divergencias={len(fora)}")


if __name__ == "__main__":
    main()
