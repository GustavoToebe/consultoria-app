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

## Fatores de correção e cocção

Decisão do Gustavo em 23/10: o catálogo público de alimentos passa a trazer fator de correção (FC) e fator de cocção (FCc)
de duas fontes, com consulta jurídica pendente. O PDF diz “Todos os direitos reservados”. Tem de ser fácil de tirar.

- Oliveira, D. F.; Santos, V. S.; Oliveira, T. C. *Guia Prático de Indicadores de Pré-preparo e Preparo dos Alimentos*.
  São Carlos: Scienza, 2023. ISBN 978-65-5668-104-7.
  SHA-256 `b7f6b4d00bf9c87adabc4f197b4c6e8cf2eebd317176fdcbe10e8a92ad778b98`.
- Cumbaru. Tabela FC do modelo de ficha técnica (`modelo-ficha-tecnica-cumbaru.xlsx`, aba “Tabela FC”).
  SHA-256 `2671e095f86c4fa70904dadd05009450a28b0b83dd7cfd95a77f6aced35cbf72`.

Os originais não vão para o git; os CSVs são transcrição. Quando o PDF e a planilha divergem no mesmo alimento, fica o
número do PDF e a diferença entra em `dados/relatorios/fatores-importacao.md`. Feijão preto com FC 0,90 fica de fora
(a faixa do banco é 1,00 a 20,00); o valor não foi trocado por 1.

Remoção, se a consulta jurídica pedir (ainda não executada): uma migration zera `fator_correcao`, `fator_coccao` e
`fonte_fatores` do catálogo; apaga os itens novos cuja `fonte` cita os fatores; zera os fatores do alimento só onde
`fatores_do_catalogo` é verdadeiro e o valor ainda é igual ao do catálogo; apaga os CSVs e `scripts/catalogo/gerar_fatores.py`;
reverte o trecho do `AGENTS.md`. Dieta já publicada guarda os fatores na versão imutável e não é reescrita.

## Batel Grill — calorias

- Arquivo: `batel/informacoes-nutricionais.csv` (SHA-256 `b78f260a0bf29cc531ca0d253545ee1e3b2ca861990346c9e12d2e36b2351484`).
  Transcrição; o PDF não vai para o git.
- Origem: tabela de informação nutricional do Batel Grill. A maior parte das linhas é de Andréa Lúcia Tetti, CRN 295,
  8ª Região. Cheesecake, Torta Banoffi e Sorvete de queijo com calda de goiaba são de Juliana de Oliveira Ferreira,
  CRN-8 3960.
- Data: transcrição em 23/10/2026.
- A V030 grava o nome e a caloria. Proteína, carboidrato e gordura ficam vazios: a tabela não traz esses números, e
  ausente não vira zero. Nome igual ao do catálogo e que já tem caloria (o Tabule da TACO) não muda. Suco entra por
  copo de 200 ml; o restante, por 100 g, com o KCAL/100g impresso.
- Relatório: `dados/relatorios/batel-importacao.md`.

## Heavy Suppz — suplementos

- Arquivo: `api/src/main/resources/suplementos/heavysuppz.json` (22 itens).
- Origem: páginas públicas de produto em heavysuppz.com. Só nome, marca, categoria, porção como no rótulo publicado,
  sabores e link. Sem preço, descrição ou tabela nutricional. Porção que a página não publica fica nula.
- Data: coletado em 21/10/2026.
- A V028 entrega esses itens a cada consultoria que já existe, pelo nome, sem alterar o que o treinador já digitou.
  Consultoria nova recebe a mesma lista. Outra marca entra como outro arquivo e outra migration.
