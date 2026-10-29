# Ajustes da evolução

Situação: Concluída em 29/10/2026 (PR 15, merge 6becaa4, com a V041) · Onde: `main` · Atualizado: 29/10/2026

## Objetivo
Fechar as decisões que ficaram abertas na frente "Evolução" ([evolucao-prime.md](evolucao-prime.md)), já em produção desde o merge
457c152: a lista de compras sai na ordem do mercado, o aluno baixa o PDF do comparativo da avaliação física, o aluno desliga os
lembretes de cobrança só para ele e o PDF com marca clara fica legível.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Ordem da lista de compras | Grupos do catálogo numa ordem fixa de percurso de mercado (tabela abaixo); grupos do treinador depois, em ordem alfabética; "Outros itens" e "Adicionados por você" no fim. Vale na tela do aluno, na prévia do treinador, no PDF da lista e no PDF Detalhado da dieta (todos passam por `agruparLista`). Item manual da dieta e avulso do aluno continuam sem grupo. Nomes comparados sem acento e sem caixa | Gustavo, 29/10 |
| 2 | PDF do comparativo para o aluno | "Baixar comparativo" no `CartaoAvaliacaoFisica` do Histórico do aluno, com o mesmo `pdf/pdfAvaliacaoFisica.ts`, só com `PDF` no plano (`NoPlano`), com os dados de `GET /aluno/avaliacoes-fisicas` e a marca/logo da sessão; sem internet o botão não aparece. Gráfico das medidas: **fora** | Gustavo, 29/10 |
| 3 | Lembretes de cobrança desligados pelo aluno | Coluna `aluno.lembretes_cobranca_desligados_em` (V041; nulo = recebe), `GET`/`PUT /aluno/lembretes-de-cobranca {receber}`, job e planejamento pulam o aluno (motivo `ALUNO_DESLIGOU`), a folha da cobrança mostra "O aluno desligou os lembretes por e-mail" (WhatsApp manual segue), auditoria `LEMBRETES_DE_COBRANCA_DO_ALUNO_ALTERADOS` só quando muda, exportação em `financeiro`, anonimização zera, interruptor no cartão "Meu plano" (só com o financeiro ligado e com internet) | Gustavo, 29/10 |
| 4 | PDF com marca clara | Título e títulos de seção na cor da marca escurecida até 4,5:1 sobre o branco, pela função `marcaParaTexto` do app (importada, não copiada); a faixa do topo mantém a cor original e o texto `textoSobre` | Gustavo, 29/10 |
| 5 | Cabeçalho de tabela e links do PDF (extensão do item 4) | O `th` passa a usar `textoSobre(marca)` (era branco fixo, ilegível em amarelo) e os links usam a cor de texto escurecida. Mesmo defeito do item 4; fora do que foi pedido | Claude, 29/10; aprovada pelo Gustavo em 29/10 |
| 6 | Migration | V041 (a agenda usa V042 e V043); total de migrations 41 nos dois testes | Gustavo, 29/10 |

### Ordem do mercado (grupos reais do catálogo: 14 do TACO e 13 do Batel Grill)
1. Hortifrúti: `Verduras, hortaliças e derivados`, `Frutas e derivados`
2. Carnes e ovos: `Carnes e derivados`, `Carnes` (Batel), `Ovos e derivados`
3. Pescados: `Pescados e frutos do mar`
4. Leite e derivados: `Leite e derivados`, `Queijos` (Batel)
5. Cereais, pães e massas: `Cereais e derivados`
6. Leguminosas: `Leguminosas e derivados`
7. Óleos e gorduras: `Gorduras e óleos`
8. Açúcares e doces: `Produtos açucarados`
9. Bebidas: `Bebidas (alcoólicas e não alcoólicas)`, `Sucos naturais`, `Sucos de polpas com água`, `Sucos de polpas com leite condensado`
10. Resto da mercearia: `Nozes e sementes`, `Miscelâneas`, `Outros alimentos industrializados` e, por último, os pratos prontos do Batel: `Molhos frios`, `Massas com molhos`, `Polentas com molhos`, `Risotos`, `Saladas`, `Pratos quentes e acompanhamentos`, `Sushis e yakissoba`, `Sobremesas`

Depois: grupos do treinador (fora do catálogo), alfabética; "Outros itens"; "Adicionados por você". Um grupo novo no catálogo,
enquanto não entrar em `GRUPOS_DO_CATALOGO_NA_ORDEM_DO_MERCADO` (`dominio/gruposDaLista.ts`), sai junto dos grupos do treinador.

## Passos
- [x] 0. Plano e índice — este arquivo
- [x] 1. Lista na ordem do mercado (`gruposDaLista.ts`, testes, `e2e/lista-de-compras.spec.ts`) — commit/run: a99ab50
- [x] 2. PDF do comparativo para o aluno (`CartaoAvaliacaoFisica`, `podeBaixarComparativo`, `e2e/avaliacao-fisica.spec.ts` em 390 e 1280) — commit/run: 24743fe
- [x] 3. Lembretes de cobrança desligados pelo aluno: API V041 e testes de integração — commit/run: 50569e9
- [x] 4. Lembretes: interruptor no app, folha da cobrança, `e2e/financeiro.spec.ts` — commit/run: 0851e5b
- [x] 5. Contraste do PDF com marca clara (`pdf/html.ts`, `pdf/pdf.test.ts`) — commit/run: 75451e5
- [x] 6. Ajuda, `AGENTS.md` e guias PDF regerados — commit/run: dbe1fb9 (guias gerados com o Chrome: o Edge falhou no gerador; o `guia-aluno.pdf` caiu de 178 KB para 110 KB, causa não investigada, conferir a olho)
- [x] 7. Conferência — resultado: `mvn clean verify` 1551 testes, 0 falhas, JaCoCo ok (41 migrations nos dois testes); `typecheck`, `lint` e `npm test` ok (172 suítes, 2338 testes); e2e `lista-de-compras` 8/8, `avaliacao-fisica` 8/8 e `financeiro` 42/42 (390 e 1280). Na primeira rodada falhou `AvaliacaoFisicaIntegrationTest.recusaDadosInvalidosComOCampoCerto` (o `timestamp` da resposta, como `…24.9…`, continha `4.9`; teste instável desde a V035, corrigido em c5e12d8) e o caso offline de `avaliacao-fisica` (o NetInfo da web não percebe a volta da rede no Chromium emulado; o spec passou a disparar o evento)

## Fora do escopo
- Gráfico das medidas da avaliação física (decisão 2).
- Voltar ao plano de quem religar o lembrete já cancelado: o lembrete cancelado com `ALUNO_DESLIGOU` não é recriado (mesma regra do `NAO_E_MAIS_DEVIDO`); o que já foi enviado não volta.

## O que ficou para trás
- Os pratos prontos do Batel (`Saladas`, `Sobremesas`, `Massas com molhos`, `Risotos`…) ficaram no fim da mercearia; se o Gustavo quiser, `Saladas` vai para hortifrúti, `Sobremesas` para doces e `Massas com molhos`/`Risotos` para cereais.
- Mapeamento por nome dos grupos `Carnes`, `Queijos` e `Sucos…` do Batel (carnes e ovos, leite, bebidas): conferir.
