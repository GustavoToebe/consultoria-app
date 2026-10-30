# Atualização visual do app inteiro e pendências da análise de 29/10

Situação: Planejando (o Claude local implementa) · Onde: branch `atualizacao-visual-app-full` (renomeada da `claude/saraiva-api-direcionamento-treinos-dv10io`) · Atualizado: 30/10/2026

## Objetivo
Levar todas as telas do app (treinador, aluno e públicas) para o estilo do editor de treino (`docs/design-e-front.md`,
seção 4.1) e fechar as pendências da análise do vídeo de 29/10 que ficaram fora da frente
[clareza-do-treinador.md](clareza-do-treinador.md). O editor de treino ([editor-de-treino-visual.md](editor-de-treino-visual.md))
e as telas de aluno do treinador ([telas-do-aluno-visual.md](telas-do-aluno-visual.md)) têm frente própria e ficam fora daqui.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Nome da branch | `atualizacao-visual-app-full` (sem acento nem espaço); a antiga só é apagada depois de o Claude da nuvem conferir | Gustavo, 30/10 |
| D2 | Como levar o estilo às telas | Primeiro pelas peças comuns de `app/src/ui/` (vale para todas as telas de uma vez); depois tela por tela, só arrumação (blocos, faixas, selos com ícone, ações na faixa). Nenhuma regra, rota, permissão ou texto de negócio muda por causa do visual | Gustavo, 30/10 |
| D3 | Telas novas de desenho (painel novo e orientação do primeiro uso) | Protótipo em HTML em `docs/prototipos/` (dados fictícios) aprovado pelo Gustavo antes do código, como foi com o editor e os alunos | Gustavo, 30/10 |
| D4 | A12, categorias dos suplementos | Migration nova troca "Suplementos / X" por "X" só onde a categoria ainda é exatamente a do catálogo padrão (o que o treinador editou fica); o `heavysuppz.json` passa a vir sem o prefixo para as consultorias novas | Análise de 29/10 |
| D5 | A02, importar plano de PDF ou Google Docs | Nesta rodada só o plano escrito (opções, riscos de LGPD, o que fica no servidor); sem código até o Gustavo decidir | Gustavo, 30/10 |
| D6 | Passo 7, formato da configuração | Só o formato novo `linhaDoCabecalho` (`2d31c558`), sem ler o antigo `cabecalho`: a SARAIVA TEAM é o primeiro treinador (piloto), mas ainda não conta como o "primeiro cliente" da regra de compatibilidade; vai para a `main` junto com o resto | Gustavo, 30/10 |
| D7 | Passo 8, painel novo do Início | Painel em blocos; cada bloco com faixa de título e três ícones (abrir a tela, atualizar, filtro Todos/Meus); dentro, mini-cartões com número grande e cor com significado (vermelho problema, âmbar atenção, verde positivo), cada um abre a lista filtrada; embaixo, linha "nos próximos 7 dias" em cor neutra. Blocos: Atualizações (para revisar, atrasadas, próximos 7 dias), Interessados (novos, em contato ou negociação, retornos atrasados ou de hoje), Treinos (concluídos na semana, sem registro há N dias, recordes da semana), Pastas (a renovar em 7 dias, sem pasta com período), Agenda (hoje, próximos 7 dias), Financeiro só com o financeiro ligado e a permissão (vencidas em R$, vencendo, recebido no mês), gráficos (rosca dos alunos por situação, barras do recebido × lançamentos por mês). Só contagens, sem nome de aluno, cada bloco com a permissão dele. "Editar" (escolher e ordenar blocos) salvo no aparelho, nas preferências. Só rotas que já existem: bloco que precisar de rota nova volta ao Gustavo antes. Protótipo `docs/prototipos/painel.html` antes do código. A referência foi um print de outro sistema, que não entra no repositório | Gustavo, 30/10 |
| D8 | Passo 9, primeiros passos (respostas ao `primeiro-uso.html`) | Cartão "Primeiros passos" vira bloco do painel (D7), no topo, enquanto não estiver concluído. Aberto, toma o lugar do "Próximo passo" sem repetir item nem botão; dispensado ou concluído, o Próximo passo volta. Progresso "3 de 6". Dispensar com painel de confirmação. Concluído vira linha "Concluídos", que dá para fechar. O passeio pelo menu abre antes, sozinho, como hoje, com um passo novo no fim apontando a lista. Metodologia e modelos ficam como itens com "Já conferi". Início sem alunos: enxuto, só uma frase, sem contadores zerados. "Já conferi", "Agora não" do link, dispensado e concluído ficam no aparelho, por usuário, como o `passeioVisto` (sobrevivem ao Sair), sem API nova; trocar de computador e a lista voltar é aceito (os itens automáticos continuam certos). "Agora não" do link de inscrição conta como resolvido e mostra "Deixado para depois", com desfazer. Membro com perfil restrito só vê os itens que pode fazer. Consulta que falhou deixa o item "Sem informação", nunca "Feito" | Gustavo, 30/10 |

## Rotas do painel (D7, conferido em 30/10)
Já existem, com contagem ou `total`:
- Atualizações: `GET /painel` (`atualizacoesParaRevisar`, `atualizacoesAtrasadas`, `atualizacoesProximas`), com `meus`; abre `/treinador/atualizacoes?situacao=…`; a linha "nos próximos 7 dias" abre `?situacao=PROXIMAS`, não a Agenda (Gustavo, 30/10).
- Interessados: `GET /inscricoes/contagens` (`porSituacao.NOVA`, `EM_CONTATO`, `EM_NEGOCIACAO`, `retornosAtrasados`, `retornosHoje`), com `meus`.
- Recordes da semana: `GET /recordes/semana?meus=` (só com o retorno ligado).
- Agenda: `GET /agenda/resumo?de=&ate=&responsavel=` (soma de `dias[].compromissos` no app).
- Financeiro: `GET /financeiro/painel` (`cartoes.emAtraso`, `proximosRecebimentos.em7Dias`, `cartoes.recebidoCentavos`, `serie[]`), com `meus`; ligado por `GET /eu` `pagamentosHabilitados` e `FINANCEIRO_LER`.
- Alunos por situação: `GET /alunos?situacao=ATIVO|INATIVO` (`total`), com `meus`.

Não existem como contagem (pedem rota nova ou ficam de fora; decisão do Gustavo):
- Treinos concluídos na semana (hoje só por aluno).
- Pastas a renovar em 7 dias (só há `planosTerminando` do `/painel`, que é de plano, tem teto de 20 e traz nomes).
- Alunos sem pasta com período (só contando no app a lista inteira de alunos).
- Alunos "sem acesso" para a rosca (só no item da lista).
- "Sem registro há N dias": existe no `/painel`, mas é lista com nomes e teto de 20; a contagem passa de 20 errada.

## Passos
- [x] 0. Renomear a branch (D1) e atualizar o "Onde" dos planos que citam a antiga — commit/run: push da branch nova em 30/10 (os "Onde" vão no próximo commit)
- [x] 1. Peças comuns no estilo novo (`Cartao`, `Tabela`, `LinhaDaLista`, `ItemDeLista`, `Abas`, `FaixaDeChips`, `Campo`, `EscolhaEmFolha`, `Folha`, `PainelConfirmacao`, `Estados`, `Cabecalho`), com capturas antes e depois — commit/run: `bc33fc6b` (com o ⋯ de mais ações em moldura e o `bordaCampo` do escuro em `#707078`, aprovados em 30/10; lista em linha de tabela `33e4d888`; jest, lint, typecheck e e2e completo, 359, passaram)
- [ ] 2. Telas do treinador (lista na mensagem), em lotes paralelos — commit/run: —
- [ ] 3. Telas do aluno e telas públicas, em lotes paralelos — commit/run: —
- [ ] 4. A06: textos da dieta (modelo × plano do aluno, nome dos complementos) — commit/run: —
- [ ] 5. Lista de compras: rótulos "Conforme a dieta" e "Estimativa para compra" (D7 de clareza-do-treinador, que ficou só nos selos) — commit/run: —
- [x] 6. A12: migration das categorias dos suplementos (D4), com teste de integração — commit/run: `faca6070` (V047)
- [x] 7. Importação: escolher a linha do cabeçalho (API, tela e testes) — commit/run: `2d31c558` (só o formato novo `linhaDoCabecalho`, sem transição: app antigo que manda `cabecalho` recebe 422)
- [ ] 8. Painel novo do Início do treinador (D7), junto com o bloco de primeiros passos: protótipo `docs/prototipos/painel.html`, aprovação, código — commit/run: —
- [ ] 9. A01: orientação guiada no primeiro uso (D8): protótipo atualizado com as respostas, aprovação, código (junto do passo 8) — commit/run: —
- [x] 10. A02: plano escrito em `docs/planos/importar-plano-de-documento.md` (D5) — commit/run: — (perguntas para o Gustavo no próprio plano)
- [ ] 11. Ajuda, guias PDF, AGENTS.md, Jest, lint, typecheck, `mvn verify` (passos 6 e 7), e2e completo em 390 e 1280 — commit/run: —

## Fora do escopo
- Editor de treino e telas de aluno do treinador (frentes próprias).
- Comunidade, ranking e XP.
- A04 (falha da planilha na reunião): espera os nomes das colunas e abas.

## O que ficou para trás
- (nada ainda)
