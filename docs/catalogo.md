# Catálogo público (alimentos e exercícios)

O treinador importa itens do catálogo para a própria biblioteca (aba **Catálogo** em Biblioteca; rotas
`GET /catalogo/exercicios|alimentos` e `POST /exercicios|alimentos/importar-catalogo`). O catálogo é global, sem
`@TenantId`, só leitura pela API.

## Fontes e licenças

| Catálogo | Fonte | Licença |
|---|---|---|
| Alimentos | TACO 4ª edição (NEPA/UNICAMP), valores por 100 g | Reprodução permitida **citando a fonte**; a licença não fala de uso comercial. Pergunta enviada a `taco@unicamp.br`. |
| Exercícios | Os exercícios próprios do app mais o `exercicios-bd-ptbr` (`joao-gugel/exercicios-bd-ptbr`, tradução do `yuhonas/free-exercise-db`) | CC0 e Unlicense (domínio público) |

Não usar: TBCA/USP (CC BY-NC-ND), ExerciseDB (proíbe guardar dados), FatSecret e APIs de texto livre (mandariam dado
de aluno para fora). Não consultar nenhuma API ao vivo.

## Regras

1. **Nunca inventar valor nutricional.** Valor ausente ou "em análise" não vira zero: o alimento fica fora do catálogo
   e entra no relatório de descartados. `Tr`/`NA` viram 0 com marca em `tracos`.
2. A fonte oficial é a planilha do NEPA. O PDF e dados convertidos pela comunidade servem só para conferir.
3. Citar a fonte em todo alimento (`fonte`) e na tela (créditos): é condição da licença da TACO.
4. O SQL é **gerado por script** a partir de `dados/fontes/`, com ordem estável e UUIDs determinísticos. Ninguém
   edita o SQL gerado à mão; fonte nova ou corrigida regenera o arquivo.
5. A busca usa `nome_busca` (sem acento), calculada igual no Python e em `Buscas.semAcento`.
6. Sem dado pessoal: as bases são públicas.

## Como gerar

Scripts em `scripts/catalogo/` (`gerar_taco.py`, `gerar_exercicios.py`); relatórios em `dados/relatorios/`; fontes em
`dados/fontes/`; curadoria dos nomes em `dados/curadoria/`. Teste: `python -m unittest scripts/catalogo/test_catalogo.py`.
