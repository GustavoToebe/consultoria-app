"""Utilitários dos geradores do catálogo público (só biblioteca padrão)."""
import hashlib
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def normalizar(texto):
    """Sem acento e em minúsculas, igual ao `nome_busca` do banco."""
    decomposto = unicodedata.normalize("NFD", texto)
    sem_marcas = "".join(c for c in decomposto if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", sem_marcas).strip().lower()


def uuid_deterministico(chave):
    """Mesmo valor de `md5(chave)::uuid` do PostgreSQL."""
    h = hashlib.md5(chave.encode("utf-8")).hexdigest()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:]}"


def sql_texto(valor):
    """Literal SQL de texto (aspas simples dobradas) ou null."""
    if valor is None:
        return "null"
    return "'" + valor.replace("'", "''") + "'"


def sql_numero(valor):
    return "null" if valor is None else str(valor)


def sha256(caminho):
    return hashlib.sha256(Path(caminho).read_bytes()).hexdigest()


def escrever(caminho, conteudo):
    """UTF-8 com \\n, para que rodar de novo gere exatamente o mesmo arquivo."""
    caminho = Path(caminho)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    with open(caminho, "w", encoding="utf-8", newline="\n") as f:
        f.write(conteudo)


def blocos(itens, tamanho):
    for i in range(0, len(itens), tamanho):
        yield itens[i:i + tamanho]


def _coluna(ref):
    return re.match(r"[A-Z]+", ref).group(0)


def ler_planilha(caminho, indice_aba=0):
    """Lê uma aba de .xlsx e devolve `{linha: {coluna: valor}}`.

    Valor numérico vira float; texto fica texto; célula vazia não aparece.
    """
    with zipfile.ZipFile(caminho) as z:
        compartilhadas = []
        if "xl/sharedStrings.xml" in z.namelist():
            raiz = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in raiz.findall("m:si", NS):
                compartilhadas.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))
        pasta = ET.fromstring(z.read("xl/workbook.xml"))
        aba = pasta.findall("m:sheets/m:sheet", NS)[indice_aba]
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        alvo = next(r.get("Target") for r in rels if r.get("Id") == aba.get(NS_REL))
        alvo = alvo.lstrip("/")
        if not alvo.startswith("xl/"):
            alvo = "xl/" + alvo
        planilha = ET.fromstring(z.read(alvo))
    linhas = {}
    for linha in planilha.findall(".//m:row", NS):
        celulas = {}
        for c in linha.findall("m:c", NS):
            v = c.find("m:v", NS)
            tipo = c.get("t")
            if tipo == "inlineStr":
                texto = "".join(t.text or "" for t in c.iter("{%s}t" % NS["m"]))
                valor = texto
            elif v is None or v.text is None:
                continue
            elif tipo == "s":
                valor = compartilhadas[int(v.text)]
            elif tipo in ("str", "e"):
                valor = v.text
            elif tipo == "b":
                valor = float(v.text)
            else:
                valor = float(v.text)
            if isinstance(valor, str):
                valor = valor.strip()
                if valor == "":
                    continue
            celulas[_coluna(c.get("r"))] = valor
        if celulas:
            linhas[int(linha.get("r"))] = celulas
    return linhas
