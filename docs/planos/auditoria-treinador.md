# Auditoria de UI/UX, frente Treinador

Situação: Planejando (só o plano; nenhum código ainda) · Onde: branch `auditoria-treinador` (saída da `main` em `3d65e04b`) · Atualizado: 03/11/2026

## Objetivo
Aplicar à tela e ao domínio do treinador os achados da 1ª passada ([auditoria-ui-ux-2026-11-03.md](auditoria-ui-ux-2026-11-03.md): C8, erros engolidos, seção C) e da 2ª passada (N1, N2, N5, N13, N14, N17, N18, N20, N23), sem tocar nos arquivos do PR B, da frente 4 (`app/src/ui`) nem da frente do item 3. Nenhuma migration.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | N14: mês sem lançamento no Financeiro | É R$ 0,00. A API devolve 0 (não `null`) para entradas e saídas avulsas quando o mês não tem lançamento, com teste de integração. O "—" continua só para o que realmente falta (recebido sem nenhuma cobrança paga, e tudo o que o filtro "Meus" não cobre). | Gustavo, 03/11 |
| D2 | Divisão do trabalho | Esta frente trabalha só na branch `auditoria-treinador`, porta de e2e 8104, nome na trava `treinador`. Item que precisa de arquivo de outra frente não é feito: fica marcado "espera o merge de <frente>". | sessão principal, 03/11 |
| D3 | N18 (conferido, só leitura) | Confirmado: a API publica uma versão idêntica (ver "Resultado da conferência do N18"). O botão passa a ficar desabilitado, com motivo, quando não há o que publicar. Plano que não é o ativo do aluno continua publicável, porque republicar é o único jeito de reativá-lo. | Claude (a confirmar na revisão) |
| D4 | C8: forma da paginação | Rota nova `GET /exercicios/pagina` (busca, grupos, `pagina`, `tamanho`=30, resposta `{ itens, total, grupos }`), igual ao padrão de Alunos. `GET /exercicios` (lista inteira) não muda: o editor de treino, a Importação e o Catálogo precisam dela inteira. `grupos` vem da API porque a tela deixa de ter a lista toda para calculá-los. | Claude (a confirmar na revisão; muda contrato, só adiciona) |
| D5 | N1: onde mora o redirecionamento | No `app/treinador/_layout.tsx` (não no `ui/Permitido.tsx`, da frente 4): sem `PAINEL_VER`, abrir `/treinador` redireciona para a primeira tela permitida. O botão "Voltar ao início" da tela "Sem acesso" já aponta para `/treinador`, então passa a cair numa tela que o perfil abre, sem editar a `ui/`. | Claude (a confirmar na revisão) |
| D6 | N23: qual "Limpar filtros" fica | O da barra de filtros (`ui/BarraDeFiltros`, frente 4). O do bloco do vazio sai da lista de alunos. | Claude (a confirmar na revisão) |
| D7 | Biblioteca sem o ícone genérico | O haltere é a caixa reservada de `DemonstracaoDoExercicio` (`reservarEspaco`). Tira-se `reservarEspaco` na linha da Biblioteca: quem tem imagem mostra a miniatura, quem não tem começa pelo nome. Efeito: os títulos de linhas com e sem imagem deixam de alinhar. | Claude (a confirmar na revisão) |
| D8 | Arquivos de outras frentes | `ui/PreferenciasDoApp.tsx` fica com esta frente (N13). `api/rotas.ts`, `api/tipos.ts` e `e2e/api-falsa.ts` também (só esta frente os edita até o merge). Não tocar: `ui/Passeio`, `ui/SeletorDeNota`, `ui/EscalaDeNota`, `treinador/CartaoProgresso`, `dominio/relatorio` (frente Aluno); `ui/Folha`, `ui/Botao`, `tema/tokens`, `treinador/interessados/*` (frente Peças) | sessão principal, 03/11 |
| D9 | N14 na série mês a mês | 0 só nos meses até o corrente sem lançamento; mês futuro continua `null` ("—"); "Meus" continua `null`. Conferir os usos de `serie[]` no Início (`dominio/painelDoInicio`, `treinador/painel/`) antes; se precisar mexer neles, parar e avisar | sessão principal, 03/11 |
| D10 | Aceites de D4 e D5 | D4: `@PreAuthorize` igual ao do `GET /exercicios`, JPQL/`Specification` sem SQL nativo, teste com exercício de outra consultoria fora da lista e do `total`, busca nos mesmos campos e sem acento que o filtro de hoje, `grupos` calculado sem aplicar o próprio filtro de grupo. D5: redireciona só `/treinador` (não as outras rotas do layout); perfil sem nenhuma tela permitida não entra em laço | sessão principal, 03/11 (advisor) |

## Resultado da conferência do N18 (código; sem teste executado)
- **Plano de treino, dieta e mobilidade:** `PlanoServiceBase.publicar` (`api/.../planos/PlanoServiceBase.java:179-203`) valida, grava `versao = versaoPublicada + 1` com a cópia do rascunho, desativa os outros planos do aluno e marca o plano como publicado e ativo. **Não compara com a versão anterior.** Publicar duas vezes seguidas sem editar cria a v2 idêntica à v1, troca `publicadoEm` e grava um evento de auditoria `PLANO_PUBLICADO`.
- **Questionário:** `QuestionarioService.publicar` (`api/.../questionarios/QuestionarioService.java:152-172`) faz o mesmo (n+1, sem comparar).
- **Tela:** `treinador/plano/TopoPlano.tsx:171` e `treinador/questionarios/EditorQuestionario.tsx:127` desenham "Publicar" sempre habilitado; só "Salvar rascunho" é desabilitado por `situacao === 'salvo'`.
- **Sinal disponível:** o plano traz `ativo`, `versaoPublicada` e `rascunhoAlteradoDepoisDePublicar`; o questionário traz `alteradoDesdePublicacao` (o editor já soma `editor.pendente` no selo).
- **Regra proposta:** "Publicar" desabilitado, com `motivo` "Nada mudou desde a v{N} publicada.", quando `versaoPublicada > 0` e o plano está ativo e o rascunho não mudou desde a publicação e não há alteração por salvar. Plano inativo (outro foi publicado depois) segue habilitado. A API não é alterada (não é preciso contrato novo; um 409 no servidor seria decisão de regra de negócio, fica como pendência).

## Passos
Cada passo diz o aceite. Marcar com o commit quando entregar. "Espera" = depende de arquivo de outra frente, não será feito aqui.

- [ ] 1. **N18**: "Publicar" desabilitado sem alteração, com o motivo. Regra pura em `dominio/barraDoEditor.ts` com teste. Aceite: versão publicada, ativa e sem alteração mostra "Publicar" desabilitado com o motivo; editar (ou nunca ter publicado, ou plano inativo) o habilita. O editor de **questionário espera o PR B** (`EditorQuestionario.tsx`). — commit/run: —
- [ ] 2. **N1**: perfil sem o Início entra na primeira tela permitida. Regra pura nova `dominio/primeiraTela.ts` com teste (usa `telasPermitidas`/`TELAS` só importando). Aceite: perfil sem `PAINEL_VER` que abre `/treinador` cai na primeira tela do menu que pode abrir; em "Sem acesso" o botão leva a uma tela aberta. — commit/run: —
- [ ] 3. **N2**: sem `REGISTRO_LER` a coluna "Último registro" some (e a linha do celular não diz "Nunca registrou"); quem não é responsável de ninguém e abre em "Meus alunos" vê "Você não é responsável por nenhum aluno" no vazio. Regra em `dominio/gruposDeAlunos.ts` com teste. — commit/run: —
- [ ] 4. **N23**: um só "Limpar filtros" no vazio da lista de alunos (D6). — commit/run: —
- [ ] 5. **N14** (D1): API devolve 0 para entradas e saídas sem lançamento no `resultadoDoMes` e na `serie` (fora do filtro "Meus"); testes de integração atualizados e um novo; a tela mostra R$ 0,00. `mvn verify` pela trava. — commit/run: —
- [ ] 6. **N5**: o cartão "Resultado do mês" diz que é sempre o mês de hoje, com o mês, e que não acompanha o período da Visão geral. (A descrição "Mês de nov/2026" já existe desde 20/10; o texto atual não diz que ignora o período.) — commit/run: —
- [ ] 7. **C8**: paginação da Biblioteca › Exercícios (D4): rota nova + teste de integração na API (`mvn verify` pela trava), `listarExercicios` paginado no app, "Anterior / Próxima / Página x de y · N exercícios" como em Alunos, busca e grupo filtram no servidor. Aceite: abre com no máximo 30 linhas e menos de 3.000 px em 1280; buscar o exercício da página 3 o encontra. Mexe só em `treinador/biblioteca/AbaExercicios.tsx` (a tela `biblioteca.tsx` é do PR B e não muda). — commit/run: —
- [ ] 8. **Biblioteca sem o ícone genérico** (D7): linha do exercício começa pelo nome. — commit/run: —
- [ ] 9. **Editor de modelo** (todos em `treino/CartaoSessao.tsx`): "Adicionar exercício" é o primeiro controle da linha de adição; "Remover sessão" vai para um ⋯ da sessão (`FolhaDeAcoes`, mesmo comportamento: remove com "Desfazer"); "Salvar como dia de treino" passa a ter borda (botão secundário). Aceite: nenhum controle destrutivo solto no corpo do cartão. — commit/run: —
- [ ] 10. **Agenda**: "Hoje" e as setas alinhados em 390 px (medir primeiro: o `IconeBotao` já foi para 44 px no PR A, pode estar resolvido) e **N20**: na Semana o nome inteiro do compromisso fica visível num rótulo ao passar o mouse ou focar. — commit/run: —
- [ ] 11. **Importação**: o aviso "Nada é gravado…" uma vez por etapa (sai a descrição repetida do cartão da etapa 1; o subtítulo do cabeçalho fica). — commit/run: —
- [ ] 12. **N17**: "1 treino registrado no período (≈0,2 por semana)" na revisão da atualização. Regra pura em `dominio/atualizacao.ts` com teste. — commit/run: —
- [ ] 13. **Erros engolidos**: falha de rede mostra `MensagemErro` com "Tentar de novo" em `atualizacoes/index.tsx` (responsáveis) e `perfil.tsx` (contagem de inscrições); `atualizacoes/[id].tsx` (envio do feedback sem versão ou sem texto volta calado) passa a avisar. `auditoria.tsx` já trata o erro das pessoas (`erroPessoas`): só conferir. — commit/run: —
- [ ] 14. **N13**: texto do "Desligado" nos Ajustes (`ui/PreferenciasDoApp.tsx`, exceção ao escopo: a frente 4 não toca nele, D8). — commit/run: —
- [ ] 15. **Erro engolido do `convite-equipe.tsx`** — espera o merge do PR B.
- [ ] 16. **Montador: "Copiado" só quando a cópia der certo** — a tela `montador/index.tsx` não existe na `main` (está na branch `montador-de-telas`, fora do alcance): espera o merge dessa branch.
- [ ] 17. e2e em 390 e 1280 px (porta 8104, pela trava), `npm run typecheck`, `lint`, `npm test` e `mvn verify` (2 vagas). — commit/run: —

## Fora do escopo
- Paginação de Atualizações (C8, segunda metade): a 2ª passada diz que não é urgente (3 atualizações em produção). Vai para Pendências soltas.
- 409 no servidor ao publicar versão idêntica: o N18 é resolvido só na tela.
- Texto de Ajuda e guias (PDF): estão no PR B.
- Outros "Desligado, …" iguais ao do N13 (`AbaLembretes`, `CartaoLinkInscricao`, `CamposDaPrescricao`): só o Ajustes foi pedido.

## O que ficou para trás
- (preencher ao entregar; o que espera outra frente: passos 14 a 16 e o editor de questionário do passo 1)
