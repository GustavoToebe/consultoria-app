# Comunidade: perfil do aluno, apelido e moderação própria

Situação: Publicada · Onde: `main` · Atualizado: 09/11/2026

## Objetivo
O aluno pode ter um apelido (vulgo, como no Discord) e os colegas podem abrir o perfil dele a partir do mural (como no Steam). A moderação da comunidade passa a ter permissão própria. A página pública de inscrição deixa de guardar no aparelho mais do que o contato.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Nome no mural | Continua nome e sobrenome; o apelido é opcional e aparece ao lado, nunca no lugar | Gustavo (09/11) |
| 2 | Perfil do colega | Abre pelo mural; mostra só nome, apelido, treinos concluídos e conquistas (sem foto, peso, medidas, dieta nem dado de saúde) | Claude, a confirmar. **Substituída em 10/11 por `perfil-estilo-steam.md`** (Gustavo decidiu: estilo Steam, com foto) |
| 3 | Permissão de moderar | `COMUNIDADE_MODERAR`, própria; quem tinha `TREINO_ALTERAR` a recebe na migration, para ninguém perder o que já faz | Gustavo (09/11, recomendação aceita) |
| 4 | `sessionStorage` da inscrição | Só nome, WhatsApp e e-mail; respostas das perguntas nunca; limpo ao enviar; comentário corrigido | Gustavo (09/11, recomendação aceita) |
| 5 | Lote C | Barra de 6 px, "Pausa (s)" e sugestão no campo de peso ficam como estão | Gustavo (09/11, recomendação aceita) |
| 6 | Apelido: regras | 2 a 24 caracteres, letras, números, espaço e `_ . -`; sem link; vazio apaga; repetido pode; não sai em log nem auditoria | Claude |
| 7 | Moderar apelido | Quem tem `COMUNIDADE_MODERAR` pode limpar o apelido de um aluno; o aluno pode pôr outro depois | Claude |

## Passos
- [x] 1. API (V069: permissão, coluna `aluno.apelido`, rotas, exportação LGPD e anonimização) — evidência: testes locais verdes em 09/11 (`ComunidadeApelidoIntegrationTest`, `ApelidoDoAlunoServiceTest`, `ComunidadeModerarMigrationTest`, Flyway 69); correções do revisor (A–D: `@OptimisticLock(excluded = true)` no apelido, recusa de preenchimentos Hangul e de apelido sem letra/dígito, link conferido em NFKC, comentário do ranking) e `autorEhAluno` no mural e nos comentários (só aluno ativo abre perfil) aplicados em 09/11 e testados; commit `aff3f594`
- [x] 2. App (apelido na Conta, apelido no mural, perfil do colega, permissão no app, `sessionStorage`) — evidência: `npm run typecheck`, `npm run lint` (0 erros), `npx jest` (283 suítes, 6096 testes) e e2e `comunidade`, `inscricao`, `inscricao-perguntas`, `meus-dados-aluno`, `biblioteca-catalogo`, `entrar-perfil`, `supervisao-da-equipe` (113 verdes) em 09/11, depois das correções da revisão 88 verdes (`comunidade`, `inscricao`, `inscricao-perguntas`, `meus-dados-aluno`); commit `aff3f594`
- [x] 2b. Folha "Editar alimento" reorganizada (4 cartões, chips que não passam da borda; pedido do Gustavo de 09/11) — `AbaAlimentos.tsx`, textos de `AJUDA_FC`/`AJUDA_FCC` em `dominio/fatoresDoAlimento.ts` e e2e em `biblioteca-catalogo.spec.ts`; commit `aff3f594`
- [x] 3. Revisão independente (permissão, LGPD, migration) — evidência: revisor da API achou A–D (aplicados); revisor do app achou os itens 1–6 (1–5 corrigidos: reabrir o perfil busca de novo, 404 na moderação recarrega o mural, `sessionStorage` com `try/catch`, seletores, comentário) e concluiu "pode subir"; o item 6 (o cartão do apelido refaz `GET /aluno/meus-dados`) ficou de fora
- [x] 4. `mvn verify`, `jest`, e2e e push na `main` — `mvn verify` completo (2247 testes, 0 falhas, cobertura ok), `typecheck`, `lint` (0 erros), `jest` (283 suítes, 6098 testes) em 09/11; commit `aff3f594` na `main`; run do deploy: 42742734020 (resultado abaixo)
- [x] 5. Comentários do mural no app e `links-do-menu` (pedidos do Gustavo de 09/11 e 10/11) — rota nova de equipe `GET /comunidade/mural/{id}/comentarios` (`TREINO_LER`, mesmo serviço da rota do aluno, teste em `ComunidadeIntegrationTest`), `app/src/comunidade/FolhaComentarios.tsx` (aluno lê e comenta só com internet; equipe lê e, com `COMUNIDADE_MODERAR`, remove com confirmação; equipe não comenta), regra `comentarioParaEnviar`/`erroDoComentario` (2000 unidades UTF-16, como o `@Size` da API) em `dominio/comunidade.ts`; e2e do Ctrl+clique corrigido (o popup nasce navegado e nem `request` nem `route` veem o documento: o teste lê o `PerformanceNavigationTiming` da guia). Evidência em 10/11: jest 283 suítes/6101 testes, typecheck, lint (0 erros), e2e `comunidade` + `links-do-menu` 85 verdes; `mvn verify` completo 2248 testes, 0 falhas, cobertura ok; commit `d3ef4e8d`, run 42809233359 verde (`publicar` ok, health `UP`)

## Fora do escopo
- Foto do colega no perfil (agora em `perfil-estilo-steam.md`) e perfil de membro da equipe.
- Apelido único por consultoria.

## O que ficou para trás
- (cada sobra também vai para "Pendências soltas" no README)
- Revisor do app, item 6: o cartão do apelido refaz `GET /aluno/meus-dados`.
- V069 só foi testada em banco novo; o gatilho sob o papel `consultoria_app` e os dados reais da produção não foram provados.
- ~~Comentários das **aulas** ainda não têm tela no app e a lista de comentários não pagina~~ (feito em 10/11 no lote do perfil estilo Steam: `FolhaComentarios` com o alvo aula, paginação de 30 e limite de 280; ver `perfil-estilo-steam.md`, passos 11 e 12); folha dentro de folha, teclado com o campo no rodapé e leitor de tela não foram testados no iOS/Android.
- Foto do colega no perfil: decidida em 10/11, plano em `perfil-estilo-steam.md`.
- Padrão `FaixaDeChips quebrar` em volta de um único `Escolha` ainda existe em `treinador/alunos/index.tsx`, `planejamento/index.tsx`, `montador/catalogo.tsx` e `catalogoDeComponentes.tsx`.
- Textos de ajuda de FC/FCc foram encurtados (perdeu "abaixo de 1, encolhe").
- Temas areia e contraste alto da Conta e do treinador, app nativo (Android e iOS) e web real em `:8088` não foram conferidos.
