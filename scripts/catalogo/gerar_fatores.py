"""Gera a migration V027 (fatores do catálogo) e o relatório da importação.

Lê o CSV transcrito do Guia Prático e a aba "Tabela FC" da planilha do Cumbaru.
Os originais ficam em dados/fontes/fatores/ e não vão para o git. Valor ausente
continua nulo: nada vira 1.

Uso (na raiz do repositório): python scripts/catalogo/gerar_fatores.py
"""
import csv
import re
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import comum  # noqa: E402

PASTA = comum.RAIZ / "dados/fontes/fatores"
PLANILHA = PASTA / "modelo-ficha-tecnica-cumbaru.xlsx"
PDF = PASTA / "Guia-Pratico-Fator-de-Correcao-e-Coccao.pdf"
GUIA_CSV = PASTA / "guia-pratico.csv"
CUMBARU_CSV = PASTA / "cumbaru.csv"
CORRESPONDENCIA = PASTA / "correspondencia.csv"
SQL = comum.RAIZ / "api/src/main/resources/db/migration/V027__fatores_do_catalogo.sql"
CATALOGO = comum.RAIZ / "api/src/main/resources/db/migration/V002__catalogo_taco.sql"
RELATORIO = comum.RAIZ / "dados/relatorios/fatores-importacao.md"

CITACAO_PDF = ("Oliveira, D. F.; Santos, V. S.; Oliveira, T. C. Guia Prático de Indicadores de "
               "Pré-preparo e Preparo dos Alimentos. São Carlos: Scienza, 2023.")
CITACAO_CUMBARU = "Cumbaru. Tabela FC do modelo de ficha técnica."
FONTE_TACO = "TACO 4ª ed. (2011), NEPA/UNICAMP"

FC_MINIMO, FC_MAXIMO = Decimal("1.00"), Decimal("20.00")
FCC_MINIMO, FCC_MAXIMO = Decimal("0.10"), Decimal("10.00")
DUAS = Decimal("0.01")

# Mesmo alimento, grafia diferente. A revisão (23/10) só aceitou estes.
ALIASES = {
    "arroz, branco, cozido": "Arroz, tipo 1, cozido",
    "ovo de galinha, inteiro": "Ovo, de galinha, inteiro, cru",
    "ovo de galinha, inteiro, cozido": "Ovo, de galinha, inteiro, cozido/10minutos",
    "queijo, mucarela": "Queijo, mozarela",
}

MARCAS_COZIDO = ("cozid", "grelhad", "refogad", "frit", "assad", "omelete")
PALAVRAS_CRU = {"cru", "crua", "fresco", "fresca"}
# Preparo que muda o que se descarta, não o alimento. O fator fica num item novo;
# os nutrientes saem do item cru correspondente.
PREP_DESPERDICIO = (
    "ingrediente como condimento",
    "cortada em rodelas",
    "cortado em rodelas",
    "cortado em tiras grossas",
    "em rodelas",
    "com casca",
    "descascada",
    "descascado",
    "descascadas",
    "descascados",
    "ralada",
    "ralado",
    "fatiada",
    "fatiado",
    "picada",
    "picado",
    "cubos",
)

LINHA_CATALOGO = re.compile(
    r"\(md5\('(?P<chave>[^']+)'\)::uuid, '(?P<nome>(?:[^']|'')*)', (?P<base>[0-9.]+), '(?P<un>[^']+)', "
    r"(?P<kcal>[0-9.]+), (?P<prot>[0-9.]+), (?P<carb>[0-9.]+), (?P<gord>[0-9.]+), (?P<gramas>null|[0-9.]+), "
    r"'(?P<fonte>(?:[^']|'')*)', '(?P<grupo>(?:[^']|'')*)', '(?P<codigo>[^']*)', "
    r"(?P<tracos>null|'(?:[^']|'')*'), '(?P<busca>[^']+)'\)"
)


def duas_casas(valor):
    """Decimal com no máximo duas casas, ou None se a fonte trouxe mais."""
    if valor is None:
        return None
    if not isinstance(valor, Decimal):
        valor = Decimal(str(valor))
    quantizado = valor.quantize(DUAS)
    if quantizado != valor:
        return None
    return quantizado


def fora_da_faixa(valor, minimo, maximo):
    if valor is None:
        return None
    preciso = duas_casas(valor)
    if preciso is None:
        return "mais de duas casas decimais"
    if preciso < minimo or preciso > maximo:
        return f"fora da faixa {minimo} a {maximo}"
    return None


def eh_cozido(nome):
    busca = comum.normalizar(nome)
    return any(marca in busca for marca in MARCAS_COZIDO)


def sem_cru(nome_busca):
    partes = [p.strip() for p in nome_busca.split(",") if p.strip()]
    while partes and partes[-1] in PALAVRAS_CRU:
        partes.pop()
    return ", ".join(partes)


def sem_desperdicio(nome_busca):
    texto = nome_busca
    for preparo in sorted(PREP_DESPERDICIO, key=len, reverse=True):
        texto = texto.replace(comum.normalizar(preparo), " ")
    texto = re.sub(r"[,/]+", ", ", texto)
    texto = re.sub(r"\s+", " ", texto).strip(" ,")
    texto = re.sub(r"(, )+", ", ", texto).strip(" ,")
    return texto


def ler_catalogo(caminho=CATALOGO):
    itens = []
    for linha in Path(caminho).read_text(encoding="utf-8").splitlines():
        achado = LINHA_CATALOGO.search(linha)
        if not achado:
            continue
        tracos = achado.group("tracos")
        if tracos == "null":
            tracos = None
        else:
            tracos = tracos[1:-1].replace("''", "'")
        gramas = achado.group("gramas")
        itens.append({
            "nome": achado.group("nome").replace("''", "'"),
            "nome_busca": achado.group("busca"),
            "grupo": achado.group("grupo").replace("''", "'"),
            "base": achado.group("base"),
            "unidade": achado.group("un"),
            "kcal": achado.group("kcal"),
            "proteina": achado.group("prot"),
            "carboidrato": achado.group("carb"),
            "gordura": achado.group("gord"),
            "gramas": None if gramas == "null" else gramas,
            "tracos": tracos,
        })
    return itens


def indice_por_nome(catalogo):
    return {item["nome"]: item for item in catalogo}


def indice_por_busca(catalogo):
    return {item["nome_busca"]: item for item in catalogo}


def solto(texto):
    """Vírgula e barra não separam o alimento: 'abobrinha italiana' = 'abobrinha, italiana'."""
    return re.sub(r"\s+", " ", re.sub(r"[,/]+", " ", texto)).strip()


def base_por_nome_cru(catalogo, nucleo):
    """Itens crus cujo nome, sem o 'cru', é exatamente o núcleo (vírgula não conta)."""
    alvo = solto(nucleo)
    return [item for item in catalogo
            if solto(sem_cru(item["nome_busca"])) == alvo and not eh_cozido(item["nome"])]


def decidir(alimento, fc, fcc, catalogo, por_busca, por_nome):
    """Devolve acao, nome_no_catalogo, base_taco, fc, fcc, observacao.

    Fator ausente permanece None. Faixa inválida vira IGNORAR e não vira 1.
    FCc nunca vai para um item cru.
    """
    busca = comum.normalizar(alimento)
    motivo_fc = fora_da_faixa(fc, FC_MINIMO, FC_MAXIMO)
    motivo_fcc = fora_da_faixa(fcc, FCC_MINIMO, FCC_MAXIMO)
    if motivo_fc or motivo_fcc:
        qual = "FC" if motivo_fc else "FCc"
        return "IGNORAR", "", "", None, None, f"{qual} {motivo_fc or motivo_fcc}"

    exato = por_busca.get(busca)
    if exato is not None:
        if fcc is not None and not eh_cozido(exato["nome"]):
            return "IGNORAR", "", exato["nome"], None, None, "FCc não vai para o item cru do catálogo"
        return "FATOR_NO_CATALOGO", exato["nome"], exato["nome"], fc, fcc, ""

    alias = ALIASES.get(busca)
    if alias:
        item = por_nome[alias]
        if fcc is not None and not eh_cozido(item["nome"]):
            return "IGNORAR", "", item["nome"], None, None, "FCc não vai para o item cru do catálogo"
        return ("FATOR_NO_CATALOGO", item["nome"], item["nome"], fc, fcc,
                "mesmo alimento, grafia diferente na revisão")

    if fcc is not None:
        return "NOVO", "", "", fc, fcc, "cozido sem o mesmo item no catálogo; sem base para não copiar nutriente cru"

    crus = base_por_nome_cru(catalogo, busca)
    if len(crus) == 1:
        return "FATOR_NO_CATALOGO", crus[0]["nome"], crus[0]["nome"], fc, fcc, "o catálogo traz o mesmo alimento cru"
    if len(crus) > 1:
        return "NOVO", "", "", fc, fcc, "há mais de um item cru no catálogo; sem base para não escolher um"

    nucleo = sem_desperdicio(busca)
    if nucleo and nucleo != busca:
        bases = base_por_nome_cru(catalogo, nucleo)
        if len(bases) == 1:
            return ("NOVO", "", bases[0]["nome"], fc, fcc,
                    "preparo diferente; nutrientes da base crua, o fator não vai para ela")
        if len(bases) > 1:
            return "NOVO", "", "", fc, fcc, "preparo diferente e mais de uma base crua possível"
    return "NOVO", "", "", fc, fcc, "sem base TACO do mesmo alimento"


def pdf_vence(fatores_pdf, fatores_planilha):
    """O PDF fica com o fator que os dois trazem. A planilha só preenche o que falta.

    Devolve fc, fcc e a lista de conflitos (texto). Ausente continua None.
    """
    fc, fcc = fatores_pdf.get("fc"), fatores_pdf.get("fcc")
    conflitos = []
    for campo, nome in (("fc", "FC"), ("fcc", "FCc")):
        outro = fatores_planilha.get(campo)
        if outro is None:
            continue
        atual = fc if campo == "fc" else fcc
        if atual is None:
            if campo == "fc":
                fc = outro
            else:
                fcc = outro
        elif atual != outro:
            conflitos.append(f"{nome}: PDF {atual} permanece; planilha tinha {outro}")
    return fc, fcc, conflitos


def ler_guia(caminho=GUIA_CSV):
    linhas = []
    with open(caminho, encoding="utf-8", newline="") as arquivo:
        for linha in csv.DictReader(arquivo):
            linhas.append({
                "fonte": "guia",
                "alimento": linha["alimento"],
                "capitulo": linha["capitulo"],
                "pagina": linha["pagina"],
                "fc": duas_casas(linha["fc"]) if linha["fc"] else None,
                "fcc": duas_casas(linha["fcc"]) if linha["fcc"] else None,
            })
    return linhas


def aba_tabela_fc(caminho):
    import zipfile
    import xml.etree.ElementTree as ET
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(caminho) as arquivo:
        raiz = ET.fromstring(arquivo.read("xl/workbook.xml"))
    for indice, aba in enumerate(raiz.findall("m:sheets/m:sheet", ns)):
        if aba.get("name") == "Tabela FC":
            return indice
    raise SystemExit("A planilha não tem a aba Tabela FC.")


def gerar_cumbaru_csv(caminho_xlsx=PLANILHA, destino=CUMBARU_CSV):
    linhas = comum.ler_planilha(caminho_xlsx, aba_tabela_fc(caminho_xlsx))
    registros = []
    for numero in sorted(linhas):
        if numero == 1:
            continue
        celulas = linhas[numero]
        alimento = celulas.get("A")
        if not isinstance(alimento, str) or not alimento.strip():
            continue
        fc = celulas.get("C")
        if isinstance(fc, float):
            fc = duas_casas(Decimal(str(fc)))
        elif isinstance(fc, str) and fc.strip():
            fc = duas_casas(Decimal(fc.strip().replace(",", ".")))
        else:
            fc = None
        categoria = celulas.get("B")
        registros.append({
            "linha": numero,
            "categoria": categoria.strip() if isinstance(categoria, str) else "",
            "alimento": re.sub(r"\s+", " ", alimento).strip(),
            "fc": fc,
        })
    with open(destino, "w", encoding="utf-8", newline="\n") as arquivo:
        escritor = csv.writer(arquivo)
        escritor.writerow(["linha", "categoria", "alimento", "fc"])
        for registro in registros:
            escritor.writerow([
                registro["linha"], registro["categoria"], registro["alimento"],
                "" if registro["fc"] is None else format(registro["fc"], "f"),
            ])
    return registros


def ler_cumbaru(caminho=CUMBARU_CSV):
    linhas = []
    with open(caminho, encoding="utf-8", newline="") as arquivo:
        for linha in csv.DictReader(arquivo):
            linhas.append({
                "fonte": "cumbaru",
                "alimento": linha["alimento"],
                "linha": linha["linha"],
                "categoria": linha["categoria"],
                "fc": duas_casas(linha["fc"]) if linha["fc"] else None,
                "fcc": None,
            })
    return linhas


def ler_correspondencia_anterior(caminho=CORRESPONDENCIA):
    if not Path(caminho).exists():
        return {}
    guardadas = {}
    with open(caminho, encoding="utf-8", newline="") as arquivo:
        for linha in csv.DictReader(arquivo):
            if linha["acao"].strip():
                guardadas[(linha["fonte"], linha["alimento_fonte"])] = linha
    return guardadas


def montar_correspondencia(guia, cumbaru, catalogo, anterior):
    por_busca = indice_por_busca(catalogo)
    por_nome = indice_por_nome(catalogo)
    linhas = []
    for origem in guia + cumbaru:
        chave = (origem["fonte"], origem["alimento"])
        if chave in anterior:
            guardada = anterior[chave]
            linhas.append({
                "fonte": origem["fonte"],
                "alimento_fonte": origem["alimento"],
                "acao": guardada["acao"],
                "nome_no_catalogo": guardada["nome_no_catalogo"],
                "base_taco": guardada["base_taco"],
                "fc": guardada["fc"],
                "fcc": guardada["fcc"],
                "observacao": guardada["observacao"],
            })
            continue
        acao, nome, base, fc, fcc, observacao = decidir(
            origem["alimento"], origem["fc"], origem["fcc"], catalogo, por_busca, por_nome)
        linhas.append({
            "fonte": origem["fonte"],
            "alimento_fonte": origem["alimento"],
            "acao": acao,
            "nome_no_catalogo": nome,
            "base_taco": base,
            "fc": "" if fc is None else format(fc, "f"),
            "fcc": "" if fcc is None else format(fcc, "f"),
            "observacao": observacao,
        })
    return linhas


def escrever_correspondencia(linhas, caminho=CORRESPONDENCIA):
    with open(caminho, "w", encoding="utf-8", newline="\n") as arquivo:
        escritor = csv.DictWriter(arquivo, fieldnames=[
            "fonte", "alimento_fonte", "acao", "nome_no_catalogo", "base_taco", "fc", "fcc", "observacao"])
        escritor.writeheader()
        escritor.writerows(linhas)


def _decimal_csv(texto):
    return duas_casas(texto) if texto else None


def juntar(linhas, por_nome):
    """Uma entrada por alimento de destino. PDF vence; item novo sem base fica de fora."""
    destinos = {}
    sem_base = []
    conflitos = []
    for linha in linhas:
        if linha["acao"] == "IGNORAR":
            continue
        fc, fcc = _decimal_csv(linha["fc"]), _decimal_csv(linha["fcc"])
        if linha["acao"] == "NOVO" and not linha["base_taco"]:
            sem_base.append((linha, fc, fcc))
            continue
        if linha["acao"] == "FATOR_NO_CATALOGO":
            chave = ("fator", linha["nome_no_catalogo"])
            nome = linha["nome_no_catalogo"]
            base = por_nome[nome]
        else:
            chave = ("novo", comum.normalizar(linha["alimento_fonte"]))
            nome = linha["alimento_fonte"]
            base = por_nome[linha["base_taco"]]
        citacao = CITACAO_PDF if linha["fonte"] == "guia" else CITACAO_CUMBARU
        if chave not in destinos:
            destinos[chave] = {
                "acao": linha["acao"], "nome": nome, "base": base,
                "fc": None, "fcc": None, "citacoes": [], "obs": [],
            }
        destino = destinos[chave]
        for campo, valor in (("fc", fc), ("fcc", fcc)):
            if valor is None:
                continue
            atual = destino[campo]
            if atual is None:
                destino[campo] = valor
                if citacao not in destino["citacoes"]:
                    destino["citacoes"].append(citacao)
            elif atual != valor:
                if linha["fonte"] == "guia":
                    conflitos.append(f"{nome}: {campo.upper()} do PDF ({valor}) substitui {atual}")
                    destino[campo] = valor
                    if citacao not in destino["citacoes"]:
                        destino["citacoes"].insert(0, citacao)
                else:
                    conflitos.append(f"{nome}: {campo.upper()} da planilha ({valor}) ignorado; fica {atual}")
        destino["obs"].append(linha["observacao"])
    fora = []
    for linha, fc, fcc in sem_base:
        chave = ("novo", comum.normalizar(linha["alimento_fonte"]))
        destino = destinos.get(chave)
        if destino is None:
            fora.append(linha)
            continue
        citacao = CITACAO_PDF if linha["fonte"] == "guia" else CITACAO_CUMBARU
        for campo, valor in (("fc", fc), ("fcc", fcc)):
            if valor is None or destino[campo] is not None:
                continue
            destino[campo] = valor
            if citacao not in destino["citacoes"]:
                destino["citacoes"].append(citacao)
    return list(destinos.values()), fora, conflitos


def nome_livre(nome, ocupados):
    if nome not in ocupados:
        return nome
    candidato = nome + " (fator)"
    if candidato not in ocupados:
        return candidato
    raise SystemExit(f"Nome já existe mesmo com o sufixo: {nome}")


def fonte_do_item(base_nome, citacoes):
    texto = f"TACO (nutrientes de {base_nome}); fatores: {' '.join(citacoes)}"
    if len(texto) > 400:
        raise SystemExit(f"fonte passa de 400 caracteres: {texto}")
    return texto


def fonte_fatores(citacoes):
    texto = " ".join(citacoes)
    if len(texto) > 300:
        raise SystemExit(f"fonte_fatores passa de 300 caracteres: {texto}")
    return texto


def sql_do_item(destino, ocupados):
    fatores = fonte_fatores(destino["citacoes"])
    fc = comum.sql_numero(destino["fc"])
    fcc = comum.sql_numero(destino["fcc"])
    if destino["acao"] == "FATOR_NO_CATALOGO":
        return (
            f"update catalogo_alimento set fator_correcao = {fc}, fator_coccao = {fcc}, "
            f"fonte_fatores = {comum.sql_texto(fatores)} "
            f"where nome = {comum.sql_texto(destino['nome'])};"
        )
    base = destino["base"]
    nome = nome_livre(destino["nome"], ocupados)
    ocupados.add(nome)
    tracos = "null" if base["tracos"] is None else comum.sql_texto(base["tracos"])
    gramas = "null" if base["gramas"] is None else base["gramas"]
    chave = "catalogo-alimento:fator:" + nome
    return (
        "insert into catalogo_alimento (id, nome, base_quantidade, base_unidade, kcal, proteina, carboidrato, "
        "gordura, gramas_por_unidade, fonte, grupo, codigo_fonte, tracos, nome_busca, fator_correcao, "
        "fator_coccao, fonte_fatores) values\n"
        f"  (md5({comum.sql_texto(chave)})::uuid, {comum.sql_texto(nome)}, {base['base']}, "
        f"{comum.sql_texto(base['unidade'])}, {base['kcal']}, {base['proteina']}, {base['carboidrato']}, "
        f"{base['gordura']}, {gramas}, {comum.sql_texto(fonte_do_item(base['nome'], destino['citacoes']))}, "
        f"{comum.sql_texto(base['grupo'])}, null, {tracos}, {comum.sql_texto(comum.normalizar(nome))}, "
        f"{fc}, {fcc}, {comum.sql_texto(fatores)});"
    )


def gerar_sql(destinos, catalogo):
    ocupados = {item["nome"] for item in catalogo}
    comandos = [sql_do_item(destino, ocupados) for destino in destinos]
    cabecalho = "\n".join([
        "-- Fatores de correção e cocção no catálogo público de alimentos.",
        "-- GERADO por scripts/catalogo/gerar_fatores.py. Não editar à mão.",
        f"-- PDF sha256 {comum.sha256(PDF) if PDF.exists() else 'ausente'}.",
        f"-- Planilha sha256 {comum.sha256(PLANILHA) if PLANILHA.exists() else 'ausente'}.",
        "-- Decisão do Gustavo em 23/10, com consulta jurídica pendente. Remoção em dados/fontes/README.md.",
        "-- Fator ausente fica nulo. A migration não sobrescreve fator que o treinador já digitou.",
        "",
        "ALTER TABLE catalogo_alimento ALTER COLUMN fonte TYPE varchar(400);",
        "ALTER TABLE alimento ALTER COLUMN fonte TYPE varchar(400);",
        "ALTER TABLE catalogo_alimento ADD COLUMN fator_correcao numeric(5,2)",
        "    CONSTRAINT catalogo_alimento_fator_correcao_check CHECK (fator_correcao BETWEEN 1.00 AND 20.00);",
        "ALTER TABLE catalogo_alimento ADD COLUMN fator_coccao numeric(5,2)",
        "    CONSTRAINT catalogo_alimento_fator_coccao_check CHECK (fator_coccao BETWEEN 0.10 AND 10.00);",
        "ALTER TABLE catalogo_alimento ADD COLUMN fonte_fatores varchar(300);",
        "ALTER TABLE alimento ADD COLUMN fatores_do_catalogo boolean;",
        "",
    ])
    atualiza_biblioteca = "\n".join([
        "",
        "update alimento as a",
        "set fator_correcao = case when a.fator_correcao is null then c.fator_correcao else a.fator_correcao end,",
        "    fator_coccao = case when a.fator_coccao is null then c.fator_coccao else a.fator_coccao end,",
        "    fatores_do_catalogo = true",
        "from catalogo_alimento as c",
        "where a.consultoria_id is not null",
        "  and a.origem = 'CATALOGO'",
        "  and lower(a.nome) = lower(c.nome)",
        "  and ((a.fator_correcao is null and c.fator_correcao is not null)",
        "    or (a.fator_coccao is null and c.fator_coccao is not null));",
        "",
    ])
    return cabecalho + "\n".join(comandos) + atualiza_biblioteca


def relatorio(guia, cumbaru, linhas, sem_base, conflitos):
    from collections import Counter
    por_fonte = Counter(linha["fonte"] for linha in linhas)
    por_acao = Counter(linha["acao"] for linha in linhas)
    capitulos = Counter(linha["capitulo"] for linha in guia)
    blocos = [
        "# Fatores de correção e cocção",
        "",
        "## O que está no sistema local (23/10)",
        "",
        "Os FC e FCc da planilha do Cumbaru e do Guia Prático estão cadastrados como padrão do catálogo de alimentos. "
        "Na base local, depois da V027, o catálogo tem 89 alimentos com FC e 8 com FCc.",
        "",
        "A tela Alimentos da demonstração mostra nove alimentos digitados à mão (arroz branco cozido, banana prata, "
        "aveia, frango grelhado e os outros). Esses nomes não são os da planilha nem os da TACO, então o fator deles "
        "continua vazio. Comida com outro nome não herda o fator.",
        "",
        "Para ver o padrão: Biblioteca, Importar do catálogo, Alimentos. Exemplos: Abobrinha, italiana, crua (FC 1,27), "
        "Arroz, tipo 1, cozido (FCc 2,86), Kiwi, cru (FC 1,30), Batata, inglesa, cozida (FCc 0,97). "
        "Importar um item grava o fator na biblioteca.",
        "",
        f"{len(sem_base)} linhas da planilha e do PDF ficaram de fora: não existe o mesmo alimento na TACO, e cadastrar "
        "exigiria inventar caloria e macros. A lista está na seção \"NOVO sem base TACO\". "
        "Feijão preto (FC 0,90) também ficou de fora, abaixo de 1,00.",
        "",
        f"Guia Prático: {len(guia)} linhas.",
    ]
    for capitulo, total in capitulos.items():
        blocos.append(f"- {capitulo}: {total}")
    blocos.append(f"Cumbaru: {len(cumbaru)} linhas.")
    blocos.append("")
    blocos.append("Correspondência:")
    for acao in ("FATOR_NO_CATALOGO", "NOVO", "IGNORAR"):
        blocos.append(f"- {acao}: {por_acao[acao]}")
    blocos.append(f"- por fonte: guia {por_fonte['guia']}, cumbaru {por_fonte['cumbaru']}")
    blocos.append("")
    blocos.append("## Conflitos entre o PDF e a planilha")
    blocos.append("")
    blocos.extend(conflitos or ["Nenhum."])
    blocos.append("")
    blocos.append("## Ignorados")
    blocos.append("")
    ignorados = [linha for linha in linhas if linha["acao"] == "IGNORAR"]
    blocos.extend(
        f"- {linha['fonte']}: {linha['alimento_fonte']} — {linha['observacao']}" for linha in ignorados
    )
    blocos.append("")
    blocos.append("## NOVO sem base TACO (não entram no catálogo)")
    blocos.append("")
    blocos.extend(
        f"- {linha['fonte']}: {linha['alimento_fonte']} — {linha['observacao']}" for linha in sem_base
    )
    blocos.append("")
    return "\n".join(blocos)


def main():
    if not PLANILHA.exists() or not PDF.exists():
        raise SystemExit("Faltam os originais em dados/fontes/fatores/. Peça os arquivos ao Gustavo.")
    gerar_cumbaru_csv()
    cumbaru = ler_cumbaru()
    guia = ler_guia()
    catalogo = ler_catalogo()
    if not catalogo:
        raise SystemExit("Não leu o catálogo da V002.")
    anterior = ler_correspondencia_anterior()
    linhas = montar_correspondencia(guia, cumbaru, catalogo, anterior)
    escrever_correspondencia(linhas)
    destinos, sem_base, conflitos = juntar(linhas, indice_por_nome(catalogo))
    comum.escrever(SQL, gerar_sql(destinos, catalogo))
    comum.escrever(RELATORIO, relatorio(guia, cumbaru, linhas, sem_base, conflitos))
    print(f"correspondência {len(linhas)}; destinos {len(destinos)}; sem base {len(sem_base)}")


if __name__ == "__main__":
    main()
