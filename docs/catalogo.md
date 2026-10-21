# Catálogo público (alimentos e exercícios)

O treinador importa itens do catálogo para a própria biblioteca (aba **Catálogo** em Biblioteca; rotas
`GET /catalogo/exercicios|alimentos` e `POST /exercicios|alimentos/importar-catalogo`). O catálogo é global, sem
`@TenantId`, só leitura pela API.

## Fontes e licenças

| Catálogo | Fonte | Licença |
|---|---|---|
| Alimentos | TACO 4ª edição (NEPA/UNICAMP), valores por 100 g | Reprodução permitida **citando a fonte**; a licença não fala de uso comercial. Pergunta enviada a `taco@unicamp.br`. |
| Exercícios | Os exercícios próprios do app mais o `exercicios-bd-ptbr` (`joao-gugel/exercicios-bd-ptbr`, tradução do `yuhonas/free-exercise-db`) | CC0 e Unlicense (domínio público) |

| Fotos dos exercícios | `yuhonas/free-exercise-db`, pasta `exercises/<id>/0.jpg` e `1.jpg`, fixado no commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5` | Unlicense (domínio público) para a base; **o README de lá não diz nada das imagens à parte**. Decisão do Gustavo (21/10): usar mesmo assim. |

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
7. Fator de correção e de cocção (lista de compras) **não** vêm do catálogo nem da importação por CSV: são dado de cada
   consultoria, digitados pelo treinador no alimento. Nenhuma tabela de fatores de terceiros (livros, planilhas) entra
   no repositório, em seed ou em migration.

## Fotos dos exercícios

Cada exercício do catálogo pode ter duas fotos (início e fim do movimento). As imagens **não ficam no git**:

- `scripts/catalogo/imagens_exercicios.py gerar` baixa só as fotos dos exercícios aceitos, no commit fixo, reduz a 600 px
  no maior lado, regrava em JPEG qualidade 75 sem metadados e escreve o manifesto `scripts/catalogo/imagens-exercicios.json`
  (caminho, sha256, tamanho; no git) e a migration `V020` (coluna `catalogo_exercicio.imagens`, só os caminhos). O mesmo
  Pillow (versão fixa) dá o mesmo sha256 em qualquer máquina.
- O `app/Dockerfile` da web roda `baixar` na construção: baixa, reduz, confere o sha256 contra o manifesto e copia para
  `/srv/catalogo/exercicios`. Sem rede ou com hash diferente, **a construção falha** (nada de pasta pela metade). O
  `docker-compose.yml` e o `deploy.yml` passam `scripts/catalogo` como contexto extra (`catalogo`).
- O Caddy serve `/catalogo/exercicios/*` com `Cache-Control: public, max-age=2592000`, sem o fallback da SPA (arquivo
  inexistente = 404, não o `index.html`). O Caddy de produção (`central-api-back/deploy`) precisa da mesma regra.
- A API só devolve os **caminhos** (`imagens` no exercício do catálogo e no da biblioteca, via `exercicio.catalogo_id`);
  ela nunca chama o GitHub em execução, e o app nunca baixa de lá.
- Trocar a fonte ou o commit: mudar `COMMIT` no script, rodar `gerar`, versionar manifesto e migration nova (a `V020`
  não se edita depois de publicada).
- O app pode guardar essas fotos no cache de disco do `expo-image`: são públicas e iguais para todos. A imagem própria do
  treinador não (ver `AGENTS.md`).

## Como gerar

Scripts em `scripts/catalogo/` (`gerar_taco.py`, `gerar_exercicios.py`); relatórios em `dados/relatorios/`; fontes em
`dados/fontes/`; curadoria dos nomes em `dados/curadoria/`. Teste: `python -m unittest scripts/catalogo/test_catalogo.py`.

O schema fica em `V001__inicial.sql` (à mão). Os dados são gerados: `gerar_taco.py` escreve `V002__catalogo_taco.sql` e
`gerar_exercicios.py` escreve `V003__catalogo_exercicios_ptbr.sql`, só com `insert`. Os 52 exercícios próprios estão em
`dados/fontes/proprio/exercicios-proprios.csv` (`nome;grupo_muscular;equipamento;modalidade`) e entram no início do V003.
