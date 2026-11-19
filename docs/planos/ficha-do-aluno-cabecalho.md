# Ficha do aluno: contato, voltar da edição e cabeçalho

Situação: Em andamento · Onde: main (API e telas prontas sem commit, exceto o hook `usePassoNoHistorico`, `677f8c7d`) · Atualizado: 18/11/2026

Fonte: pedido do Gustavo em 18/11/2026 (conversa). Base: `main` em `1af8c940`. Validade: vale enquanto `treinador/DadosDoAluno.tsx`, `app/src/app/treinador/alunos/[id].tsx`, `treinador/FotoDePerfilEditavel` e `alunos/AlunoDetalhe` (API) não mudarem; se mudarem, refazer "Conferido no código". Sem migration.

## Objetivo
Na ficha do aluno: copiar telefone e e-mail e abrir o WhatsApp a partir de Dados do aluno; o "voltar" depois de "Editar dados" voltar à leitura da ficha (e não à lista); e um cabeçalho redesenhado, com voltar sem moldura, foto, nome, linha de datas (cadastro alterado, último acesso/login, último plano publicado), selo da situação e ⋯.

## Conferido no código (18/11/2026)
- Resolvido na execução de 18/11 (sem commit): o módulo de sessão não expõe o último uso, então `ultimoAcesso` é só LOGIN (D1). Os demais pontos foram conferidos na implementação.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Contrato novo no `AlunoDetalhe` (`GET /alunos/{id}`, `ALUNO_LER`) | `cadastroAlteradoEm` (instante ou nulo); `ultimoAcesso {tipo: ACESSO\|LOGIN, em}` ou nulo (`LOGIN` se o módulo de sessão não expõe o último uso; nunca chamar de "acesso" o que é login); `ultimoPlanoPublicado {em, porNome}` ou nulo, `porNome` nulo se não houver autor gravado, e o bloco só vem para quem lê o tipo do plano (`TREINO_LER` ou `DIETA_LER`) | Sessão principal, a partir do pedido |
| D2 | Contato | "Copiar telefone", "Abrir WhatsApp" (`wa.me/55…`, fora do app, sem token e sem texto pronto) e "Copiar e-mail"; sem valor o botão não aparece; reaproveitar a montagem do número que já existe | Gustavo, 18/11 |
| D3 | Voltar da edição | Entrar na edição cria o passo no histórico (também sem alteração pendente); voltar do navegador e seta do cabeçalho saem da edição para a leitura, na mesma aba; com alteração pendente vale o "Sair sem salvar?" (`useGuardaDeSaida`) | Gustavo, 18/11 |
| D4 | Selo de câmera da foto | Some no estado normal e aparece no hover e no foco da foto (que segue sendo o botão "Trocar foto"); "Trocar foto" também entra no ⋯; muda a regra do guia de 11/11 (`AGENTS.md`, item "Foto de perfil do aluno", e `design-e-front.md`) | Gustavo, 18/11 |
| D5 | Borda esquerda | Uma só para foto, abas e cartões | Gustavo, 18/11 |
| D6 | Entrega | Sem commit e sem push até o Gustavo pedir | Gustavo, 18/11 |
| D7 | Decisões tomadas na execução de 18/11 (a confirmar pelo Gustavo) | Nome do autor da publicação na exportação LGPD; lugar do cabeçalho (`CabecalhoDaFicha`, §4.9 do design) | Sessão principal |

## Passos
- [x] 0. Plano e índice — sessão principal — commit: — (sem commit, estado local em 18/11/2026)
- [x] 1. API: `cadastroAlteradoEm`, `ultimoAcesso` e `ultimoPlanoPublicado` no `AlunoDetalhe` (worktree isolada, patch aplicado pela sessão principal; `mvn` e testes) — executor — commit: — (sem commit, estado local em 18/11/2026)
- [x] 2. App: contato em Dados do aluno, voltar da edição e cabeçalho (um só dono de todos os arquivos da ficha), e2e com o comentário "cabeçalho do aluno (18/11)", `design-e-front.md` — executor-front — commit: 677f8c7d (só o hook `usePassoNoHistorico`); o restante, sem commit (estado local em 18/11/2026)
- [ ] 3. `AGENTS.md` (Foto de perfil do aluno, `AlunoDetalhe`) — sessão principal (depois do agente da fibra, dono atual do arquivo) — commit: —

## Critérios de aceite
- Copiar telefone/e-mail avisa por `useAviso`; WhatsApp abre fora do app; sem valor não há botão; nomes acessíveis "Copiar telefone de <nome>", alvo de 44 px.
- Editar dados cria passo no histórico; voltar sai da edição para a leitura; com alteração pendente aparece o "Sair sem salvar?" (e2e dos dois casos).
- Cabeçalho em 1280 e 390 px, claro e escuro, em todas as paletas, com o contraste de sempre; só aparece o que tem valor.
- Selo da situação pela tabela 4.5 do `design-e-front.md`.

## Fora do escopo
- Qualquer mudança que precise de migration.

## O que ficou para trás
- Confirmar: `ultimoAcesso` só LOGIN, nome do autor na exportação LGPD e lugar do cabeçalho (D1 e D7).
