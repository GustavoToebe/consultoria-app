# Termos e privacidade: contato da consultoria, rascunho e notas só da equipe, página nova

Situação: Em andamento · Onde: worktree leva 3 (base `4dc1cbc9`, sem commit) · Atualizado: 28/11/2026

## Objetivo
O aluno lê e aceita o termo de uso e o aviso de privacidade sem nenhum colchete de modelo nem aviso de rascunho, com o
contato da própria consultoria. A equipe relê os dois documentos numa página com abas, índice "Nesta página", versão com
a data do aceite, "Baixar PDF" e, só para ela, o selo de rascunho e as notas para a revisão do advogado.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Onde montar o contato | No servidor: `{{CONTATO_DA_CONSULTORIA}}` nos `.md`, trocado por `ContatoDosTermos.montar(nome, WhatsApp, "Responder para")` da consultoria da sessão (`TenantContext`). Sem WhatsApp nem e-mail: o nome e "Fale com o seu treinador pelo app.". `/publico/termos` só leva "Fale com o seu treinador pelo app." (nunca WhatsApp nem e-mail) | Gustavo (pedido), sessão (mecanismo) |
| D2 | Contato de privacidade do aviso (era `[CONTATO DO ENCARREGADO — PREENCHER]`) | O mesmo marcador do contato da consultoria. **PRECISA DA CONFIRMAÇÃO DO ADVOGADO DO CLIENTE** (quem é o encarregado e qual contato vale para assuntos de privacidade) antes de sair do rascunho | Gustavo, 28/11 |
| D3 | Aviso de rascunho | Sai do texto (a linha `RASCUNHO [REVISAR COM ADVOGADO]` foi tirada dos `.md`). O rascunho fica só no campo `rascunho` da API, mostrado como selo "Rascunho em revisão" apenas na página da equipe. Aluno, aceite, página pública e PDF não o mostram | Gustavo, 28/11 |
| D4 | `[REVISAR COM ADVOGADO: base legal da transferência internacional]` | Nota interna: continua no `.md`, mas `Termos` a tira do texto servido e a devolve em `notasInternas` só ao papel `TREINADOR`. O aluno recebe a lista vazia; o público e o PDF não a têm. A equipe vê o bloco "Notas para a revisão do advogado" junto do selo. O texto jurídico em volta não muda | Gustavo, 28/11 |
| D5 | Versão do aceite | `Termos.VERSAO = "2026-10-26"` não muda: o aceite guarda só a versão (sem hash nem texto), então trocar marcador, tirar a linha de rascunho e a nota não pedem reaceite | Gustavo e sessão, 28/11 |
| D6 | Data do aceite | Campo novo `aceitoEm` no `GET /termos` e no `POST /termos/aceite` (lido por consulta escalar). A tela mostra "Versão de 26/10/2026 · aceita por você em <data de Brasília>" | Gustavo (pedido) |
| D7 | Índice "Nesta página" | Só com pelo menos 932 px de área (640 de texto + vão + índice); some no celular e na coluna estreita de Configurações em 1280 | Gustavo, 28/11 (aprovado) |
| D8 | PDF dos termos | Os dois documentos, a versão e a data do aceite, montados do texto que a API serviu. Sem nota interna e sem selo. Não depende da funcionalidade `PDF` do plano (é registro do aceite, como o comprovante do contrato) | Sessão |
| D9 | Guarda contra colchete | Teste falha se o texto servido tiver `[...PREENCHER/REVISAR/CONTATO...]` ou `{{` não resolvido (`ContatoDosTermosTest`, `TermosIntegrationTest`); os fixtures do e2e leem os `.md` reais e repetem a mesma checagem na tela | Gustavo, 28/11 |

## Passos
- [x] 1. API: marcador do contato, linha de rascunho fora, notas internas só para a equipe, `aceitoEm` — commit/run: — (sem commit). Evidência: `mvn -o -Dtest=TermosIntegrationTest,ContatoDosTermosTest,ArquiteturaTest test` em 28/11: 37 testes (8 + 8 + 21), 0 falhas
- [x] 2. App: página com abas, índice, versão com o aceite, "Baixar PDF", selo e notas só da equipe; aceite e páginas públicas sem selo — commit/run: — (sem commit). Evidência em 28/11: tsc e eslint sem erro nos arquivos da frente; jest de `src/ui`, `src/pdf` e `src/dominio/termos.test.ts`, 67 suítes e 6.106 testes, 0 falhas
- [ ] 3. E2e `e2e/termos.spec.ts` e `e2e/paginas-publicas.spec.ts` (390, 1280 e 1920) — escritos, não rodados (máquina ocupada); roda o coordenador
- [ ] 4. Capturas `e2e/zz-capturas-termos.spec.ts` com `E2E_CAPTURAS` (1920 e 390, claro e escuro: as duas abas da equipe com selo e nota, aceite do aluno com contato e sem rascunho nem nota) — escritas, não rodadas
- [ ] 5. `mvn verify` completo antes do push — com o coordenador
- [ ] 6. Confirmação do advogado do cliente sobre D2 (contato de privacidade) e D4 (base legal da transferência internacional) antes de trocar `Termos.RASCUNHO` para `false` e a versão

## Fora do escopo
- Revisão jurídica do texto (com o advogado do cliente).
- Aba no endereço (`?aba=`): ficou em estado local.

## O que ficou para trás
- Nada foi visto renderizado nesta sessão: o índice parado ao rolar, a seção destacada, a quebra em 390 px e o tema escuro dependem dos passos 3 e 4.
- No aviso de privacidade, o contato entra como itens logo abaixo do item "Contato para assuntos de privacidade:" (o rótulo fica sozinho na linha); conferir na captura se basta.
