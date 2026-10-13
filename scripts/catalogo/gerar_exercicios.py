"""Gera `V003__catalogo_exercicios_ptbr.sql` a partir do exercicios-bd-ptbr e dos exercícios próprios (docs/catalogo.md).

Entrada: `exercises-ptbr-partial-translation.json` e, se existir, `dados/curadoria/exercicios-nomes.csv`
(`id;nome_final`, só as linhas que a revisão mudou). Rodar: `PYTHONUTF8=1 python scripts/catalogo/gerar_exercicios.py`.
"""
import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import comum  # noqa: E402

JSON = comum.RAIZ / "dados/fontes/exercicios-bd-ptbr/exercises/exercises-ptbr-partial-translation.json"
CURADORIA = comum.RAIZ / "dados/curadoria/exercicios-nomes.csv"
PROPRIOS = comum.RAIZ / "dados/fontes/proprio/exercicios-proprios.csv"
SQL = comum.RAIZ / "api/src/main/resources/db/migration/V003__catalogo_exercicios_ptbr.sql"
RELATORIO = comum.RAIZ / "dados/relatorios/exercicios-importacao.md"

FONTE = "exercicios-bd-ptbr (CC0), tradução do free-exercise-db (Unlicense)"
FONTE_PROPRIA = "Catálogo próprio"
LIMITE_NOME = 120
LIMITE_INSTRUCOES = 4000

MODALIDADE = {"barbell": "LIVRE", "dumbbell": "LIVRE", "kettlebells": "LIVRE", "e-z curl bar": "LIVRE",
              "machine": "MAQUINA", "cable": "MAQUINA", "bands": "ELASTICO", "body only": "PESO_CORPORAL"}
EQUIPAMENTO = {"barbell": "Barra", "dumbbell": "Halteres", "kettlebells": "Kettlebell", "e-z curl bar": "Barra W",
               "machine": "Máquina", "cable": "Polia", "bands": "Elástico", "body only": "Peso corporal",
               "medicine ball": "Medicine ball", "exercise ball": "Bola suíça", "foam roll": "Rolo de liberação"}
GRUPO = {"chest": "Peito", "lats": "Costas", "middle back": "Costas", "lower back": "Costas", "traps": "Trapézio",
         "shoulders": "Ombros", "biceps": "Bíceps", "triceps": "Tríceps", "forearms": "Antebraço",
         "quadriceps": "Quadríceps", "hamstrings": "Posterior", "glutes": "Glúteos", "abductors": "Abdutores",
         "adductors": "Adutores", "calves": "Panturrilha", "abdominals": "Abdômen", "neck": "Pescoço"}
CATEGORIAS_FORA = {"strongman"}
# Nomes próprios e termos que mantêm a maiúscula quando o nome do dataset (todo em Title Case) é ajustado.
PRESERVAR = {"Arnold", "Atlas", "Bosu", "Bradford", "Conan", "Cuban", "Frankenstein", "Gironda", "Jefferson",
             "Janda", "Otis-Up", "Pallof", "Rocky", "Scott", "Smith", "Svend", "Tate", "Zercher", "Zottman",
             "Turkish", "Londres", "Worlds", "Rickshaw", "Prowler", "T", "V", "W", "T-Bar"}


def frase(nome):
    """Primeira letra maiúscula, resto minúsculo, menos nomes próprios e siglas."""
    palavras = re.sub(r"\s+", " ", nome).strip().split(" ")
    saida = []
    for i, p in enumerate(palavras):
        if p in PRESERVAR or sum(1 for c in p if c.isupper()) >= 2 and p.upper() == p:
            saida.append(p)
        else:
            saida.append(p.lower())
    texto = " ".join(saida)
    return texto[:1].upper() + texto[1:]


def ler_nomes_curados(caminho):
    """`{id: nome_final}` do CSV da revisão. Lança ValueError com todos os problemas de formato."""
    if not Path(caminho).exists():
        return {}
    erros, curados = [], {}
    with open(caminho, encoding="utf-8", newline="") as f:
        leitor = csv.reader(f, delimiter=";")
        cabecalho = next(leitor, None)
        if cabecalho is None or [c.strip() for c in cabecalho][:2] != ["id", "nome_final"]:
            raise ValueError(f"{Path(caminho).name}: o cabeçalho deve ser 'id;nome_final'")
        for numero, linha in enumerate(leitor, start=2):
            if not any(c.strip() for c in linha):
                continue
            if len(linha) != 2:
                erros.append(f"linha {numero}: esperava 2 colunas (id;nome_final), veio {len(linha)}")
                continue
            id_, nome = linha[0].strip(), re.sub(r"\s+", " ", linha[1]).strip()
            if not id_ or not nome:
                erros.append(f"linha {numero}: id ou nome_final vazio")
            elif id_ in curados:
                erros.append(f"linha {numero}: id repetido ({id_})")
            else:
                curados[id_] = nome
    if erros:
        raise ValueError("\n".join(erros))
    return curados


def ler_exercicios(caminho=JSON):
    return json.loads(Path(caminho).read_text(encoding="utf-8"))


def ler_proprios(caminho=PROPRIOS):
    """Os exercícios escritos à mão: `nome;grupo_muscular;equipamento;modalidade`, com cabeçalho."""
    with open(caminho, encoding="utf-8", newline="") as f:
        return [{"nome": l["nome"], "grupo": l["grupo_muscular"], "equipamento": l["equipamento"],
                 "modalidade": l["modalidade"]} for l in csv.DictReader(f, delimiter=";")]


def grupo_de(e):
    if e["category"] == "cardio":
        return "Cardio"
    musculos = e.get("primaryMuscles") or []
    return GRUPO.get(musculos[0]) if musculos else None


def instrucoes_de(e):
    """Itens unidos por \\n. Devolve (texto ou None, cortado)."""
    itens = [i.strip() for i in (e.get("instructions") or []) if i and i.strip()]
    if not itens:
        return None, False
    texto = "\n".join(itens)
    if len(texto) <= LIMITE_INSTRUCOES:
        return texto, False
    while itens and len("\n".join(itens)) > LIMITE_INSTRUCOES:
        itens.pop()
    return ("\n".join(itens) or None), True


def montar(exercicios, curados, existentes):
    """Devolve (aceitos, descartados, avisos). `existentes` = nomes dos exercícios próprios."""
    ids = {e["id"] for e in exercicios}
    desconhecidos = sorted(set(curados) - ids)
    if desconhecidos:
        raise ValueError("ids da revisão que não existem no dataset: " + ", ".join(desconhecidos[:10]))
    vistos = {comum.normalizar(n): "um dos 52 exercícios do catálogo próprio" for n in existentes}
    aceitos, descartados, avisos = [], [], []
    for e in sorted(exercicios, key=lambda x: x["id"]):
        if e["category"] in CATEGORIAS_FORA:
            descartados.append((e["id"], e["name"], f"categoria {e['category']} (equipamento que academia comum não tem)"))
            continue
        origem = "revisado" if e["id"] in curados else "dataset"
        nome = curados[e["id"]] if origem == "revisado" else frase(e["name"])
        if len(nome) > LIMITE_NOME:
            descartados.append((e["id"], nome, f"nome com mais de {LIMITE_NOME} caracteres"))
            continue
        if len(re.sub(r"[^\w]", "", nome)) < 3:
            descartados.append((e["id"], nome, "nome inválido (menos de 3 letras)"))
            continue
        chave = comum.normalizar(nome)
        if chave in vistos:
            descartados.append((e["id"], nome, f"nome repetido de {vistos[chave]}"))
            continue
        vistos[chave] = f"{e['id']}"
        instrucoes, cortado = instrucoes_de(e)
        if cortado:
            avisos.append((e["id"], nome, "instruções cortadas no último item inteiro (4.000 caracteres)"))
        aceitos.append({
            "id": e["id"], "nome": nome, "origem": origem, "original": e["name"],
            "grupo": grupo_de(e), "equipamento": EQUIPAMENTO.get(e["equipment"]),
            "modalidade": "CARDIO" if e["category"] == "cardio" else MODALIDADE.get(e["equipment"], "OUTRO"),
            "instrucoes": instrucoes, "categoria": e["category"],
        })
    aceitos.sort(key=lambda a: (comum.normalizar(a["nome"]), a["id"]))
    return aceitos, descartados, avisos


def gerar_sql(aceitos, sha, proprios=()):
    linhas = [
        "-- Catálogo público de exercícios: os próprios e o exercicios-bd-ptbr.",
        f"-- GERADO por scripts/catalogo/gerar_exercicios.py a partir de dados/fontes/exercicios-bd-ptbr/ (sha256 {sha})",
        "-- e dos nomes revisados em dados/curadoria/exercicios-nomes.csv. Não editar à mão.",
        f"-- Fonte: {FONTE}.",
        "-- Os exercícios próprios vêm de dados/fontes/proprio/exercicios-proprios.csv (fonte 'Catálogo próprio').",
        "",
    ]
    if proprios:
        linhas.append("insert into catalogo_exercicio (id, nome, grupo_muscular, equipamento, modalidade, fonte, "
                      "nome_busca) values")
        linhas.append(",\n".join(
            f"  (md5('catalogo-exercicio:' || {comum.sql_texto(p['nome'])})::uuid, {comum.sql_texto(p['nome'])}, "
            f"{comum.sql_texto(p['grupo'])}, {comum.sql_texto(p['equipamento'])}, {comum.sql_texto(p['modalidade'])}, "
            f"{comum.sql_texto(FONTE_PROPRIA)}, {comum.sql_texto(comum.normalizar(p['nome']))})"
            for p in proprios) + ";")
        linhas.append("")
    for bloco in comum.blocos(aceitos, 200):
        linhas.append("insert into catalogo_exercicio (id, nome, grupo_muscular, equipamento, modalidade, "
                      "instrucoes, fonte, nome_busca) values")
        valores = []
        for a in bloco:
            valores.append(
                f"  (md5('catalogo-exercicio:fedb:' || {comum.sql_texto(a['id'])})::uuid, {comum.sql_texto(a['nome'])}, "
                f"{comum.sql_texto(a['grupo'])}, {comum.sql_texto(a['equipamento'])}, {comum.sql_texto(a['modalidade'])}, "
                f"{comum.sql_texto(a['instrucoes'])}, {comum.sql_texto(FONTE)}, "
                f"{comum.sql_texto(comum.normalizar(a['nome']))})")
        linhas.append(",\n".join(valores) + ";")
        linhas.append("")
    return "\n".join(linhas)


def _tabela(cabecalho, linhas):
    saida = ["| " + " | ".join(cabecalho) + " |", "|" + "---|" * len(cabecalho)]
    for linha in linhas:
        saida.append("| " + " | ".join(str(c).replace("|", "\\|") for c in linha) + " |")
    return "\n".join(saida) + "\n"


def gerar_relatorio(exercicios, aceitos, descartados, avisos, curados, sha):
    por_origem = Counter(a["origem"] for a in aceitos)
    r = [
        "# Importação dos exercícios — relatório",
        "",
        "GERADO por `scripts/catalogo/gerar_exercicios.py`. Não editar à mão.",
        "",
        f"- Fonte: {FONTE}.",
        f"- Arquivo: `exercises-ptbr-partial-translation.json` (sha256 `{sha}`).",
        f"- Exercícios no dataset: **{len(exercicios)}**. Entram no catálogo: **{len(aceitos)}**. "
        f"Descartados: **{len(descartados)}**.",
        f"- Nomes: **{por_origem['revisado']}** vêm da revisão (`dados/curadoria/exercicios-nomes.csv`, "
        f"{len(curados)} linhas); **{por_origem['dataset']}** são o nome do dataset com a caixa ajustada "
        "(primeira letra maiúscula).",
        "",
        "## Por categoria",
        "",
        _tabela(["Categoria", "Entram"], sorted(Counter(a["categoria"] for a in aceitos).items())),
        "## Por grupo muscular",
        "",
        _tabela(["Grupo", "Entram"], sorted(Counter(a["grupo"] or "(sem grupo)" for a in aceitos).items())),
        "## Por modalidade",
        "",
        _tabela(["Modalidade", "Entram"], sorted(Counter(a["modalidade"] for a in aceitos).items())),
    ]
    if descartados:
        r += ["## Descartados", "", _tabela(["Id", "Nome", "Motivo"], descartados)]
    if avisos:
        r += ["## Avisos", "", _tabela(["Id", "Nome", "Aviso"], avisos)]
    sem_instrucao = [a for a in aceitos if not a["instrucoes"]]
    r += [f"Exercícios sem instruções: **{len(sem_instrucao)}**.", ""]
    return "\n".join(r)


def main():
    exercicios = ler_exercicios()
    curados = ler_nomes_curados(CURADORIA)
    proprios = ler_proprios()
    aceitos, descartados, avisos = montar(exercicios, curados, [p["nome"] for p in proprios])
    sha = comum.sha256(JSON)
    comum.escrever(SQL, gerar_sql(aceitos, sha, proprios))
    comum.escrever(RELATORIO, gerar_relatorio(exercicios, aceitos, descartados, avisos, curados, sha))
    print(f"{len(exercicios)} no dataset, {len(aceitos)} no catálogo, {len(descartados)} descartados, "
          f"{len(curados)} nomes revisados")


if __name__ == "__main__":
    main()
