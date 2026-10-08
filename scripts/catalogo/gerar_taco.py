"""Gera a migration V007 (catálogo de alimentos da TACO) e o relatório da importação.

Fonte oficial: planilha do NEPA/UNICAMP em dados/fontes/taco/. O PDF da mesma edição só serve para
conferir os valores (seção 5.4 do PLANO-CATALOGO-PUBLICO.md). Valor ausente nunca vira zero: o
alimento sai do catálogo e vai para o relatório. Só `Tr` e `NA` viram 0, e ficam registrados.

Uso (na raiz do repositório): python scripts/catalogo/gerar_taco.py
"""
import re
import shutil
import subprocess
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import comum  # noqa: E402

PLANILHA = comum.RAIZ / "dados/fontes/taco/Taco-4a-Edicao.xlsx"
PDF = comum.RAIZ / "dados/fontes/taco/taco_4_edicao_ampliada_e_revisada.pdf"
SQL = comum.RAIZ / "api/src/main/resources/db/migration/V007__catalogo_taco.sql"
RELATORIO = comum.RAIZ / "dados/relatorios/taco-importacao.md"

FONTE = "TACO 4ª ed. (2011), NEPA/UNICAMP"
CITACAO = ("NEPA/UNICAMP. Tabela Brasileira de Composição de Alimentos – TACO. 4. ed. rev. e ampl. "
           "Campinas: NEPA/UNICAMP, 2011.")

# nutriente -> coluna da planilha (aba "CMVCol taco3"), casas decimais impressas no PDF
NUTRIENTES = {
    "kcal": ("D", 0),
    "proteina": ("F", 1),
    "gordura": ("G", 1),
    "carboidrato": ("I", 1),
}
LIMITE_KCAL = Decimal("950")
LIMITE_MACRO = Decimal("100.05")  # g por 100 g; folga de arredondamento para óleos (100,0)
# O carboidrato da TACO é "por diferença" e sai da conta com resíduo negativo minúsculo (ex.: -0,027), que o
# PDF imprime como 0,0. Resíduo acima disto vira 0; abaixo, o valor é impossível e o alimento é descartado.
RESIDUO_NEGATIVO = Decimal("-0.05")
CASAS = Decimal("0.01")  # numeric(8,2)
# Nº do alimento -> número da nota de rodapé que a planilha colou no fim do nome (ver legenda "Teores alcoólicos").
NOTAS_DE_RODAPE = {472: "1", 474: "2"}


def normalizar_marcador(bruto):
    """Devolve ('numero', Decimal) | ('traco',) | ('na',) | ('ausente', motivo)."""
    if bruto is None:
        return ("ausente", "campo vazio na planilha (análise não solicitada)")
    if isinstance(bruto, float):
        return ("numero", Decimal(repr(bruto)))
    texto = bruto.strip()
    chave = texto.lower()
    if chave == "tr":
        return ("traco",)
    if chave == "na":
        return ("na",)
    if re.fullmatch(r"-?\d+(,\d+)?", texto):
        return ("numero", Decimal(texto.replace(",", ".")))
    if texto == "*":
        return ("ausente", "'*' (análise sendo reavaliada, segundo a legenda)")
    return ("ausente", f"valor não numérico '{texto}'")


def ler_alimentos(linhas):
    """Percorre a planilha e devolve a lista de alimentos com os valores brutos."""
    grupo = None
    alimentos = []
    for numero_linha in sorted(linhas):
        celulas = linhas[numero_linha]
        codigo = celulas.get("A")
        nome = celulas.get("B")
        if isinstance(codigo, float) and float(codigo).is_integer() and isinstance(nome, str):
            nome = re.sub(r"\s+", " ", nome).strip()
            nota = NOTAS_DE_RODAPE.get(int(codigo))
            if nota and nome.endswith(" " + nota):
                nome = nome[: -len(nota)].strip()
            alimentos.append({
                "linha": numero_linha,
                "codigo": int(codigo),
                "nome": nome,
                "grupo": grupo,
                "brutos": {n: celulas.get(col) for n, (col, _) in NUTRIENTES.items()},
            })
        elif isinstance(codigo, str) and nome is None and len(celulas) == 1:
            if not codigo.startswith(("Número", "Alimento")):
                grupo = codigo
    return alimentos


def arredondar(valor):
    return valor.quantize(CASAS, rounding=ROUND_HALF_UP)


def montar(alimentos):
    """Aplica as regras da seção 5.3. Devolve (aceitos, descartados, contagem de marcadores)."""
    aceitos, descartados = [], []
    vistos = {}
    contagem = {"traco": {n: 0 for n in NUTRIENTES}, "na": {n: 0 for n in NUTRIENTES}}
    for a in alimentos:
        valores, tracos, nas, motivos, residuos = {}, [], [], [], []
        if len(re.sub(r"[^\w]", "", a["nome"])) < 3:
            motivos.append(f"nome inválido na planilha ('{a['nome']}'); conferir o PDF")
        for nome_nutriente, bruto in a["brutos"].items():
            lido = normalizar_marcador(bruto)
            tipo = lido[0]
            if tipo == "numero":
                valor = lido[1]
                limite = LIMITE_KCAL if nome_nutriente == "kcal" else LIMITE_MACRO
                if RESIDUO_NEGATIVO < valor < 0:
                    valores[nome_nutriente] = Decimal("0.00")
                    residuos.append(f"{nome_nutriente} {valor.quantize(Decimal('0.0001'))}")
                elif valor < 0 or valor > limite:
                    motivos.append(f"{nome_nutriente}: valor fora do possível ({valor.quantize(Decimal('0.01'))})")
                else:
                    valores[nome_nutriente] = arredondar(valor)
            elif tipo == "traco":
                valores[nome_nutriente] = Decimal("0.00")
                tracos.append(nome_nutriente)
            elif tipo == "na":
                valores[nome_nutriente] = Decimal("0.00")
                nas.append(nome_nutriente)
            else:
                motivos.append(f"{nome_nutriente}: {lido[1]}")
        if motivos:
            descartados.append({**a, "motivo": "; ".join(motivos)})
            continue
        chave = comum.normalizar(a["nome"])
        if chave in vistos:
            descartados.append({**a, "motivo": f"nome duplicado do alimento {vistos[chave]}"})
            continue
        vistos[chave] = a["codigo"]
        for n in tracos:
            contagem["traco"][n] += 1
        for n in nas:
            contagem["na"][n] += 1
        aceitos.append({**a, "valores": valores, "tracos": tracos, "nas": nas, "residuos": residuos})
    return aceitos, descartados, contagem


def gerar_sql(aceitos, sha):
    linhas = [
        "-- Catálogo público de alimentos: TACO 4ª edição (seção 5 do PLANO-CATALOGO-PUBLICO.md).",
        f"-- GERADO por scripts/catalogo/gerar_taco.py a partir de dados/fontes/taco/{PLANILHA.name}",
        f"-- (sha256 {sha}). Não editar à mão.",
        f"-- Fonte: {CITACAO}",
        "-- Valores por 100 g de parte comestível. `Tr` e `NA` da tabela viram 0 (o nutriente `Tr` fica em `tracos`).",
        "-- Alimento com valor sem análise não entra (ver dados/relatorios/taco-importacao.md).",
        "",
        "alter table catalogo_alimento add column grupo varchar(80);",
        "alter table catalogo_alimento add column codigo_fonte varchar(20);",
        "alter table catalogo_alimento add column tracos varchar(60);",
        "alter table catalogo_alimento add column nome_busca varchar(200);",
        "",
        "-- Os 9 itens de demonstração saem do catálogo; as cópias já importadas ficam na biblioteca de cada treinador.",
        "delete from catalogo_alimento where fonte like 'Valores de demonstração%';",
        "",
    ]
    for bloco in comum.blocos(aceitos, 200):
        linhas.append("insert into catalogo_alimento (id, nome, base_quantidade, base_unidade, kcal, proteina, "
                      "carboidrato, gordura, gramas_por_unidade, fonte, grupo, codigo_fonte, tracos, nome_busca) values")
        valores = []
        for a in bloco:
            v = a["valores"]
            tracos = ",".join(a["tracos"]) if a["tracos"] else None
            valores.append(
                f"  (md5('catalogo-alimento:taco:{a['codigo']}')::uuid, {comum.sql_texto(a['nome'])}, 100, 'g', "
                f"{v['kcal']}, {v['proteina']}, {v['carboidrato']}, {v['gordura']}, null, {comum.sql_texto(FONTE)}, "
                f"{comum.sql_texto(a['grupo'])}, {comum.sql_texto(str(a['codigo']))}, {comum.sql_texto(tracos)}, "
                f"{comum.sql_texto(comum.normalizar(a['nome']))})")
        linhas.append(",\n".join(valores) + ";")
        linhas.append("")
    linhas += [
        "alter table catalogo_alimento alter column nome_busca set not null;",
        "create index ix_catalogo_alimento_nome_busca on catalogo_alimento (nome_busca);",
        "",
    ]
    return "\n".join(linhas)


# ---- conferência com o PDF (seção 5.4) ----

_TOKEN = r"(?:\d+(?:,\d+)?[a-z]?|Tr|NA|\*)"
_LINHA_PDF = re.compile(rf"^\s*(\d{{1,3}})\s+([^\W\d].*?)\s+({_TOKEN}(?:\s+{_TOKEN})*)\s*$")


def ler_pdf(caminho):
    """Texto do PDF por `pdftotext -raw` (uma linha por alimento). Devolve {codigo: (nome, [tokens])} ou None."""
    if not shutil.which("pdftotext") or not Path(caminho).exists():
        return None
    saida = subprocess.run(
        ["pdftotext", "-enc", "UTF-8", "-raw", "-f", "29", "-l", "68", str(caminho), "-"],
        capture_output=True, check=True).stdout.decode("utf-8", errors="replace")
    achados = {}
    for linha in saida.splitlines():
        m = _LINHA_PDF.match(linha)
        if m:
            achados.setdefault(int(m.group(1)), (m.group(2).strip(), m.group(3).split()))
    return achados


def _mostrar(bruto):
    return f"{bruto:.4f}" if isinstance(bruto, float) else bruto


def conferir(alimentos, pdf):
    """Compara os 4 valores e o nome. Devolve (divergencias, nomes_diferentes, nao_conferidos, conferidos)."""
    divergencias, nomes, nao_conferidos, conferidos = [], [], [], 0
    for a in alimentos:
        achado = pdf.get(a["codigo"])
        if achado is None:
            nao_conferidos.append((a, "linha não encontrada no PDF"))
            continue
        nome_pdf, tokens = achado
        nota = NOTAS_DE_RODAPE.get(a["codigo"])
        if nota and tokens and tokens[0] == nota:
            tokens = tokens[1:]  # a nota de rodapé do nome, lida como se fosse uma coluna
        if comum.normalizar(nome_pdf) != comum.normalizar(a["nome"]):
            nomes.append((a["codigo"], a["nome"], nome_pdf))
        # linha completa: umidade, kcal, kJ, proteína, lipídeos, colesterol, carboidrato, ...
        if len(tokens) < 11:
            nao_conferidos.append((a, "linha do PDF com colunas em branco; posição dos valores incerta"))
            continue
        pdf_valores = {"kcal": tokens[1], "proteina": tokens[3], "gordura": tokens[4], "carboidrato": tokens[6]}
        conferidos += 1
        for nutriente, (_, casas) in NUTRIENTES.items():
            bruto = a["brutos"][nutriente]
            lido = normalizar_marcador(bruto)
            esperado = pdf_valores[nutriente]
            if lido[0] == "numero":
                if not re.fullmatch(r"\d+(,\d+)?", esperado):
                    divergencias.append((a["codigo"], a["nome"], nutriente, _mostrar(bruto), esperado))
                    continue
                unidade = Decimal(1).scaleb(-casas)
                arredondado = lido[1].quantize(unidade, rounding=ROUND_HALF_UP)
                if arredondado != Decimal(esperado.replace(",", ".")):
                    divergencias.append((a["codigo"], a["nome"], nutriente, _mostrar(bruto), esperado))
            else:
                esperado_marca = {"traco": "Tr", "na": "NA"}.get(lido[0], "*")
                if esperado != esperado_marca:
                    divergencias.append((a["codigo"], a["nome"], nutriente, _mostrar(bruto), esperado))
    return divergencias, nomes, nao_conferidos, conferidos


def _tabela(cabecalho, linhas):
    if not linhas:
        return "_Nenhum._\n"
    saida = ["| " + " | ".join(cabecalho) + " |", "|" + "---|" * len(cabecalho)]
    for linha in linhas:
        saida.append("| " + " | ".join(str(c).replace("|", "\\|") for c in linha) + " |")
    return "\n".join(saida) + "\n"


def gerar_relatorio(alimentos, aceitos, descartados, contagem, sha, conferencia, sha_pdf):
    r = [
        "# Importação da TACO — relatório",
        "",
        "GERADO por `scripts/catalogo/gerar_taco.py`. Não editar à mão.",
        "",
        f"- Fonte: {CITACAO}",
        f"- Planilha: `dados/fontes/taco/{PLANILHA.name}` (sha256 `{sha}`).",
        f"- Alimentos na planilha: **{len(alimentos)}**. Entram no catálogo: **{len(aceitos)}**. "
        f"Descartados: **{len(descartados)}**.",
        "",
        "## Marcadores gravados como 0",
        "",
        "`Tr` (traço) e `NA` (não aplicável) viram 0; `Tr` fica registrado em `tracos` e a tela mostra \"Tr\".",
        "",
        _tabela(["Nutriente", "Tr", "NA"], [(n, contagem["traco"][n], contagem["na"][n]) for n in NUTRIENTES]),
    ]
    na_kcal = [a for a in aceitos if "kcal" in a["nas"]]
    if na_kcal:
        r += ["Alimentos com a energia `NA` (gravada como 0 kcal, conforme a legenda da planilha): "
              + ", ".join(f"{a['codigo']} {a['nome']}" for a in na_kcal) + ".", ""]
    com_residuo = [a for a in aceitos if a["residuos"]]
    r += ["## Resíduos negativos gravados como 0", "",
          "O carboidrato é calculado por diferença e, em alguns alimentos, sobra um resíduo negativo minúsculo "
          "(até -0,05 g). O PDF imprime 0,0; gravamos 0. Abaixo de -0,05 o alimento seria descartado.", "",
          _tabela(["Nº", "Alimento", "Valor na planilha"],
                  [(a["codigo"], a["nome"], ", ".join(a["residuos"])) for a in com_residuo]),
          "## Descartados", "",
          "Valor sem análise, em branco ou impossível: o alimento fica fora do catálogo (nunca vira zero).", "",
          _tabela(["Nº", "Alimento", "Grupo", "Motivo"],
                  [(a["codigo"], a["nome"], a["grupo"], a["motivo"]) for a in descartados])]
    r += ["## Conferência com o PDF oficial", ""]
    if conferencia is None:
        r += ["**Não feita**: `pdftotext` ou o PDF (`dados/fontes/taco/taco_4_edicao_ampliada_e_revisada.pdf`) "
              "não estavam disponíveis. A planilha oficial vale; nenhum valor foi comparado.", ""]
    else:
        divergencias, nomes, nao_conferidos, conferidos = conferencia
        r += [f"PDF: sha256 `{sha_pdf}` (TACO 4ª ed., 2011, Tabela 1). Compara energia, proteína, lipídeos e "
              "carboidrato de cada alimento: o valor da planilha, arredondado como o PDF imprime (kcal inteiro, "
              "gramas com 1 casa), precisa ser igual ao impresso; `Tr`/`NA`/`*` precisam coincidir. "
              "Nada foi corrigido: a planilha oficial vale e o Gustavo decide.", "",
              f"- Alimentos com a linha inteira lida do PDF e conferidos: **{conferidos}**.",
              f"- Divergências: **{len(divergencias)}**.",
              f"- Não conferidos por leitura do PDF: **{len(nao_conferidos)}** (ver abaixo).",
              f"- Nomes diferentes entre planilha e PDF: **{len(nomes)}**.", "",
              "### Divergências", "",
              _tabela(["Nº", "Alimento", "Nutriente", "Planilha", "PDF"], divergencias),
              "### Nomes diferentes", "",
              _tabela(["Nº", "Planilha", "PDF"], nomes),
              "### Não conferidos", "",
              _tabela(["Nº", "Alimento", "Motivo"], [(a["codigo"], a["nome"], m) for a, m in nao_conferidos])]
    return "\n".join(r) + "\n"


def main():
    linhas = comum.ler_planilha(PLANILHA, 0)
    alimentos = ler_alimentos(linhas)
    aceitos, descartados, contagem = montar(alimentos)
    sha = comum.sha256(PLANILHA)
    comum.escrever(SQL, gerar_sql(aceitos, sha))
    pdf = ler_pdf(PDF)
    conferencia = conferir(alimentos, pdf) if pdf else None
    sha_pdf = comum.sha256(PDF) if pdf else None
    comum.escrever(RELATORIO, gerar_relatorio(alimentos, aceitos, descartados, contagem, sha, conferencia, sha_pdf))
    print(f"{len(alimentos)} na planilha, {len(aceitos)} no catálogo, {len(descartados)} descartados")
    if conferencia:
        print(f"conferência: {conferencia[3]} conferidos, {len(conferencia[0])} divergências, "
              f"{len(conferencia[2])} não conferidos, {len(conferencia[1])} nomes diferentes")


if __name__ == "__main__":
    main()
