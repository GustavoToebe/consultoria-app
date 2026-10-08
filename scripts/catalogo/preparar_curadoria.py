"""Gera o arquivo que a pessoa revisora recebe: `dados/curadoria/exercicios-para-revisar.csv`.

A revisão devolve só as linhas que mudou (`id;nome_final`) em `dados/curadoria/exercicios-nomes.csv`.
"""
import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import comum  # noqa: E402

TRADUCAO = comum.RAIZ / "dados/fontes/exercicios-bd-ptbr/exercises/exercises-ptbr-partial-translation.json"
SAIDA = comum.RAIZ / "dados/curadoria/exercicios-para-revisar.csv"
LOTE = 120


def ler_exercicios():
    dados = json.loads(TRADUCAO.read_text(encoding="utf-8"))
    return sorted(dados, key=lambda e: e["id"])


def linhas(exercicios):
    repetidos = Counter(comum.normalizar(e["name"]) for e in exercicios)
    for e in exercicios:
        yield {
            "id": e["id"],
            "original_en": re.sub(r"[_]+", " ", e["id"]),
            "nome_atual": e["name"],
            "categoria": e["category"],
            "equipamento": e["equipment"] or "",
            "alerta": "nome repetido" if repetidos[comum.normalizar(e["name"])] > 1 else "",
        }


def main():
    todas = list(linhas(ler_exercicios()))
    campos = list(todas[0])
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=campos, delimiter=";", lineterminator="\n")
        w.writeheader()
        w.writerows(todas)
    # Pedaços prontos para colar na outra IA.
    pasta = SAIDA.parent / "lotes"
    pasta.mkdir(exist_ok=True)
    for antigo in pasta.glob("lote-*.csv"):
        antigo.unlink()
    for i, parte in enumerate(comum.blocos(todas, LOTE), 1):
        with open(pasta / f"lote-{i:02d}.csv", "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=campos, delimiter=";", lineterminator="\n")
            w.writeheader()
            w.writerows(parte)
    print(f"{len(todas)} exercícios, {sum(1 for t in todas if t['alerta'])} com nome repetido, "
          f"{(len(todas) + LOTE - 1) // LOTE} lotes")


if __name__ == "__main__":
    main()
