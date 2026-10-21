# Fontes dos catálogos públicos

Arquivos originais, como baixados. Os scripts de `scripts/catalogo/` leem daqui; nada neste diretório é editado à mão.
Baixados em 08/10/2026 pelo Gustavo.

## TACO — alimentos

- Arquivo: `taco/Taco-4a-Edicao.xlsx` (SHA-256 `a66b8ec528daeabc63bc2b015fc9bd8c6d76b941c2fc0ed93a4311d449302d14`).
- Origem: planilha oficial do NEPA/UNICAMP, TACO 4ª edição revisada e ampliada (2011). Abas: `CMVCol taco3`
  (composição centesimal, valores por 100 g de parte comestível), `AGtaco3` (ácidos graxos) e `Aminoácidos TACO3`.
  Só a primeira aba é usada.
- Legenda da própria planilha: `NA` = não aplicável; `Tr` = traço (valor arredondado entre 0 e o limite, ou abaixo do
  limite de quantificação).
- Licença: a publicação permite reprodução total ou parcial **citando a fonte**. A licença não menciona uso comercial.
  Decisão do Gustavo (08/10/2026): não consultar a UNICAMP; seguir com a citação da fonte em cada alimento e na tela.
- Citação: NEPA/UNICAMP. Tabela Brasileira de Composição de Alimentos – TACO. 4. ed. rev. e ampl. Campinas:
  NEPA/UNICAMP, 2011.
- Conferência: `taco/taco_4_edicao_ampliada_e_revisada.pdf` (SHA-256 `2002aec5615b5b1395aaa8fa675635bbb7f712c33f278af5e332f1cac8f108c8`),
  PDF da mesma edição, baixado em 08/10/2026. **Não vai para o git** (`*.pdf` é ignorado): quem rodar o script sem o
  arquivo recebe no relatório "conferência não feita". Serve só para comparar valores, nunca como fonte.

## exercicios-bd-ptbr — exercícios

- Arquivos: `exercicios-bd-ptbr/exercises/*.json`, `LICENSE`, `README.md` (do zip `exercicios-bd-ptbr-main.zip`,
  SHA-256 `5a3addf0b4475d47b82904394792396e2839dfce8fabe3e7284c780685781c14`). Usado: `exercises-ptbr-partial-translation.json`
  (873 exercícios).
- Origem: <https://github.com/joao-gugel/exercicios-bd-ptbr>, tradução do `yuhonas/free-exercise-db`.
- Licença: CC0 1.0 (domínio público); a base original é Unlicense (domínio público).

## free-exercise-db — fotos dos exercícios

- Origem: <https://github.com/yuhonas/free-exercise-db>, pasta `exercises/<id>/0.jpg` e `1.jpg`, fixada no commit
  `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`. Nada é guardado aqui: o manifesto (`scripts/catalogo/imagens-exercicios.json`,
  com o sha256 de cada foto já reduzida) é o registro, e a web baixa e confere na construção.
- Licença: o repositório é Unlicense (domínio público), mas o README **não declara a licença das imagens separadamente**.
  Decisão do Gustavo em 21/10: usar as imagens dessa base. Se algum dia o autor ou um titular pedir a retirada, tirar o
  `gerar` do fluxo, regenerar o manifesto sem elas e subir uma migration que zere `catalogo_exercicio.imagens`.
