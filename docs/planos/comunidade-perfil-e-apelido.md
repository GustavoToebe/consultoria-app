# Comunidade: perfil do aluno, apelido e moderação própria

Situação: Em andamento · Onde: `main` · Atualizado: 09/11/2026

## Objetivo
O aluno pode ter um apelido (vulgo, como no Discord) e os colegas podem abrir o perfil dele a partir do mural (como no Steam). A moderação da comunidade passa a ter permissão própria. A página pública de inscrição deixa de guardar no aparelho mais do que o contato.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Nome no mural | Continua nome e sobrenome; o apelido é opcional e aparece ao lado, nunca no lugar | Gustavo (09/11) |
| 2 | Perfil do colega | Abre pelo mural; mostra só nome, apelido, treinos concluídos e conquistas (sem foto, peso, medidas, dieta nem dado de saúde) | Claude, a confirmar (foto fica para depois) |
| 3 | Permissão de moderar | `COMUNIDADE_MODERAR`, própria; quem tinha `TREINO_ALTERAR` a recebe na migration, para ninguém perder o que já faz | Gustavo (09/11, recomendação aceita) |
| 4 | `sessionStorage` da inscrição | Só nome, WhatsApp e e-mail; respostas das perguntas nunca; limpo ao enviar; comentário corrigido | Gustavo (09/11, recomendação aceita) |
| 5 | Lote C | Barra de 6 px, "Pausa (s)" e sugestão no campo de peso ficam como estão | Gustavo (09/11, recomendação aceita) |
| 6 | Apelido: regras | 2 a 24 caracteres, letras, números, espaço e `_ . -`; sem link; vazio apaga; repetido pode; não sai em log nem auditoria | Claude |
| 7 | Moderar apelido | Quem tem `COMUNIDADE_MODERAR` pode limpar o apelido de um aluno; o aluno pode pôr outro depois | Claude |

## Passos
- [x] 1. API (V069: permissão, coluna `aluno.apelido`, rotas, exportação LGPD e anonimização) — evidência: testes locais verdes em 09/11 (`ComunidadeApelidoIntegrationTest`, `ApelidoDoAlunoServiceTest`, `ComunidadeModerarMigrationTest`, Flyway 69); correções do revisor (A–D: `@OptimisticLock(excluded = true)` no apelido, recusa de preenchimentos Hangul e de apelido sem letra/dígito, link conferido em NFKC, comentário do ranking) e `autorEhAluno` no mural e nos comentários (só aluno ativo abre perfil) aplicados em 09/11 e testados; sem commit ainda
- [x] 2. App (apelido na Conta, apelido no mural, perfil do colega, permissão no app, `sessionStorage`) — evidência: `npm run typecheck`, `npm run lint` (0 erros), `npx jest` (283 suítes, 6096 testes) e e2e `comunidade`, `inscricao`, `inscricao-perguntas`, `meus-dados-aluno`, `biblioteca-catalogo`, `entrar-perfil`, `supervisao-da-equipe` (113 verdes) em 09/11; commit/run: —
- [x] 2b. Folha "Editar alimento" reorganizada (4 cartões, chips que não passam da borda; pedido do Gustavo de 09/11) — `AbaAlimentos.tsx`, textos de `AJUDA_FC`/`AJUDA_FCC` em `dominio/fatoresDoAlimento.ts` e e2e em `biblioteca-catalogo.spec.ts`; commit/run: —
- [ ] 3. Revisão independente (permissão, LGPD, migration) — evidência: —
- [ ] 4. `mvn verify`, `jest`, e2e e push na `main` — commit/run: —

## Fora do escopo
- Foto do colega no perfil (decisão 2) e perfil de membro da equipe.
- Apelido único por consultoria.

## O que ficou para trás
- (cada sobra também vai para "Pendências soltas" no README)
