"""Fotos dos exercícios do catálogo (free-exercise-db): baixa, reduz e confere contra o manifesto.

As imagens NÃO entram no git: o Dockerfile da web roda `baixar` na construção (no commit fixo abaixo), o script confere o
sha256 de cada arquivo contra `imagens-exercicios.json` e, se a rede falhar ou um hash for diferente, a construção falha
(nada de pasta pela metade). O manifesto (caminho, sha256, tamanho) e a migration `V020` saem do comando `gerar`.

  python scripts/catalogo/imagens_exercicios.py gerar  --saida <pasta>   (PC do Gustavo, depois de mudar a fonte)
  python scripts/catalogo/imagens_exercicios.py baixar --saida <pasta>   (Dockerfile da web: só o manifesto, sem o dataset)

Precisa do Pillow (versão fixa no Dockerfile). Sem ele o script recusa, em vez de gravar imagem sem redução.
Licença: o free-exercise-db é Unlicense, mas o README de lá não diz nada das imagens à parte (docs/catalogo.md).
"""
import argparse
import hashlib
import io
import json
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import comum  # noqa: E402

REPOSITORIO = "yuhonas/free-exercise-db"
COMMIT = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5"
URL_BASE = f"https://raw.githubusercontent.com/{REPOSITORIO}/{COMMIT}/exercises/"
MAIOR_LADO = 600
QUALIDADE = 75
TENTATIVAS = 4
PARALELO = 8
MANIFESTO = Path(__file__).resolve().parent / "imagens-exercicios.json"
SQL = comum.RAIZ / "api/src/main/resources/db/migration/V020__catalogo_exercicio_imagens.sql"
TAMANHO_MAXIMO_ORIGEM = 5 * 1024 * 1024


class ImagensErro(Exception):
    pass


def _pillow():
    try:
        from PIL import Image
    except ImportError as erro:
        raise ImagensErro("Pillow não instalado (pip install pillow, na versão do Dockerfile)") from erro
    return Image


def reduzir(dados):
    """JPEG com no máximo `MAIOR_LADO` px no maior lado, qualidade `QUALIDADE`, sem metadados. Lança ImagensErro."""
    Image = _pillow()
    try:
        with Image.open(io.BytesIO(dados)) as origem:
            if origem.format != "JPEG":
                raise ImagensErro(f"formato {origem.format}, esperava JPEG")
            imagem = origem.convert("RGB")
    except ImagensErro:
        raise
    except Exception as erro:
        raise ImagensErro(f"imagem ilegível ({type(erro).__name__})") from erro
    imagem.thumbnail((MAIOR_LADO, MAIOR_LADO), Image.Resampling.LANCZOS)
    saida = io.BytesIO()
    imagem.save(saida, format="JPEG", quality=QUALIDADE, optimize=True)
    return saida.getvalue()


def sha256_de(dados):
    return hashlib.sha256(dados).hexdigest()


def baixar_origem(caminho):
    """Bytes do arquivo no commit fixo, com novas tentativas para falha de rede. Lança ImagensErro."""
    url = URL_BASE + caminho
    ultimo = None
    for tentativa in range(TENTATIVAS):
        try:
            pedido = urllib.request.Request(url, headers={"User-Agent": "consultoria-app-catalogo"})
            with urllib.request.urlopen(pedido, timeout=30) as resposta:
                dados = resposta.read(TAMANHO_MAXIMO_ORIGEM + 1)
            if len(dados) > TAMANHO_MAXIMO_ORIGEM:
                raise ImagensErro(f"{caminho}: arquivo de origem grande demais")
            return dados
        except ImagensErro:
            raise
        except urllib.error.HTTPError as erro:
            if erro.code == 404:
                raise ImagensErro(f"{caminho}: não existe no commit fixo") from erro
            ultimo = erro
        except (urllib.error.URLError, TimeoutError, ConnectionError) as erro:
            ultimo = erro
        time.sleep(1 + tentativa * 2)
    raise ImagensErro(f"{caminho}: sem rede ou resposta com erro ({type(ultimo).__name__})")


def processar(caminho):
    """(caminho, bytes reduzidos). Lança ImagensErro com o caminho na mensagem."""
    try:
        return caminho, reduzir(baixar_origem(caminho))
    except ImagensErro as erro:
        raise ImagensErro(str(erro) if str(erro).startswith(caminho) else f"{caminho}: {erro}") from erro


def processar_todos(caminhos):
    with ThreadPoolExecutor(max_workers=PARALELO) as pool:
        return dict(pool.map(processar, caminhos))


def entrada(caminho, dados):
    return {"caminho": caminho, "sha256": sha256_de(dados), "tamanho": len(dados)}


def caminhos_validos(caminhos):
    """O caminho vira arquivo e URL: só `<id>/<0|1>.jpg` com letras, números, `_` e `-`."""
    import re
    padrao = re.compile(r"^[A-Za-z0-9_-]+/[01]\.jpg$")
    ruins = [c for c in caminhos if not padrao.match(c)]
    if ruins:
        raise ImagensErro("caminho fora do padrão <id>/<0|1>.jpg: " + ", ".join(ruins[:5]))


def ler_manifesto(caminho=MANIFESTO):
    manifesto = json.loads(Path(caminho).read_text(encoding="utf-8"))
    if manifesto.get("commit") != COMMIT:
        raise ImagensErro("o manifesto é de outro commit do free-exercise-db; rode `gerar`")
    caminhos_validos([i["caminho"] for i in manifesto["imagens"]])
    return manifesto


def conferir(manifesto, arquivos):
    """Compara `{caminho: bytes}` com o manifesto. Lança ImagensErro com o que difere (nada é gravado antes)."""
    esperado = {i["caminho"]: i for i in manifesto["imagens"]}
    problemas = []
    for caminho in sorted(set(esperado) - set(arquivos)):
        problemas.append(f"{caminho}: faltou")
    for caminho in sorted(set(arquivos) - set(esperado)):
        problemas.append(f"{caminho}: fora do manifesto")
    for caminho in sorted(set(esperado) & set(arquivos)):
        dados = arquivos[caminho]
        if sha256_de(dados) != esperado[caminho]["sha256"] or len(dados) != esperado[caminho]["tamanho"]:
            problemas.append(f"{caminho}: sha256 ou tamanho diferente do manifesto")
    if problemas:
        raise ImagensErro(f"{len(problemas)} problema(s):\n" + "\n".join(problemas[:20]))


def gravar_tudo_ou_nada(saida, arquivos):
    """Grava numa pasta temporária ao lado e só depois troca; a pasta final nunca fica pela metade."""
    saida = Path(saida)
    saida.parent.mkdir(parents=True, exist_ok=True)
    temporaria = Path(tempfile.mkdtemp(prefix=saida.name + ".", dir=saida.parent))
    try:
        for caminho, dados in arquivos.items():
            destino = temporaria / caminho
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_bytes(dados)
        if saida.exists():
            shutil.rmtree(saida)
        temporaria.rename(saida)
    except BaseException:
        shutil.rmtree(temporaria, ignore_errors=True)
        raise


def caminhos_do_catalogo():
    """Os caminhos `images` dos exercícios aceitos no catálogo, na ordem do catálogo."""
    import gerar_exercicios
    exercicios = gerar_exercicios.ler_exercicios()
    proprios = gerar_exercicios.ler_proprios()
    curados = gerar_exercicios.ler_nomes_curados(gerar_exercicios.CURADORIA)
    aceitos, _, _ = gerar_exercicios.montar(exercicios, curados, [p["nome"] for p in proprios])
    por_id = {e["id"]: e for e in exercicios}
    return [(a["id"], list(por_id[a["id"]].get("images") or [])) for a in aceitos]


def gerar_sql(por_exercicio):
    """Migration: coluna `imagens` e uma linha por exercício com os caminhos (ordem 0 = início, 1 = fim)."""
    linhas = [
        "-- Fotos dos exercícios do catálogo (free-exercise-db, commit fixo em scripts/catalogo/imagens_exercicios.py).",
        "-- GERADO por scripts/catalogo/imagens_exercicios.py a partir de scripts/catalogo/imagens-exercicios.json.",
        "-- Não editar à mão. Só os caminhos relativos ficam no banco; os arquivos são baixados na construção da web.",
        "",
        "alter table catalogo_exercicio add column imagens text[] not null default '{}';",
        "",
    ]
    for bloco in comum.blocos(por_exercicio, 200):
        linhas.append("update catalogo_exercicio c set imagens = v.imagens from (values")
        linhas.append(",\n".join(
            f"  (md5('catalogo-exercicio:fedb:' || {comum.sql_texto(id_)})::uuid, "
            f"array[{', '.join(comum.sql_texto(c) for c in caminhos)}]::text[])"
            for id_, caminhos in bloco))
        linhas.append(") as v(id, imagens) where c.id = v.id;")
        linhas.append("")
    return "\n".join(linhas)


def comando_gerar(saida):
    pares = [(id_, caminhos) for id_, caminhos in caminhos_do_catalogo() if caminhos]
    todos = sorted({c for _, caminhos in pares for c in caminhos})
    caminhos_validos(todos)
    print(f"{len(pares)} exercícios, {len(todos)} imagens para baixar de {REPOSITORIO}@{COMMIT[:12]}")
    arquivos = processar_todos(todos)
    _pillow()
    from PIL import __version__ as versao
    manifesto = {
        "fonte": REPOSITORIO, "commit": COMMIT, "maiorLado": MAIOR_LADO, "qualidade": QUALIDADE, "pillow": versao,
        "imagens": [entrada(c, arquivos[c]) for c in todos],
    }
    comum.escrever(MANIFESTO, json.dumps(manifesto, indent=1, ensure_ascii=False) + "\n")
    comum.escrever(SQL, gerar_sql(pares))
    if saida:
        gravar_tudo_ou_nada(saida, arquivos)
    peso = sum(len(d) for d in arquivos.values())
    print(f"manifesto e {SQL.name} gravados; {len(todos)} imagens, {peso / 1024 / 1024:.1f} MiB")


def comando_baixar(saida):
    manifesto = ler_manifesto()
    caminhos = [i["caminho"] for i in manifesto["imagens"]]
    arquivos = processar_todos(caminhos)
    conferir(manifesto, arquivos)
    gravar_tudo_ou_nada(saida, arquivos)
    peso = sum(len(d) for d in arquivos.values())
    print(f"{len(arquivos)} imagens conferidas contra o manifesto, {peso / 1024 / 1024:.1f} MiB")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("comando", choices=["gerar", "baixar"])
    p.add_argument("--saida", help="pasta de destino das imagens (obrigatória no `baixar`)")
    args = p.parse_args(argv)
    try:
        if args.comando == "baixar":
            if not args.saida:
                p.error("`baixar` precisa de --saida")
            comando_baixar(args.saida)
        else:
            comando_gerar(args.saida)
    except ImagensErro as erro:
        print(f"ERRO: {erro}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
