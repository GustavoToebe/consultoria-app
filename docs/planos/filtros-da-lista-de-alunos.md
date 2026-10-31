# Filtros avançados da lista de alunos

Situação: Pronta na branch (falta o `mvn verify` com Docker e o merge) · Onde: branch `worktree-agent-a2aaa2df55b4fdccf` (31/10) · Atualizado: 31/10/2026

## Objetivo
Na lista de alunos do treinador, achar quem precisa de atenção sem rolar a lista inteira: busca, um botão "Filtros" que
abre o painel "Filtros avançados" (seletores múltiplos, como na Central e no app em que o Gustavo trabalha) e a linha
"Filtrado por" com chips que se tiram um a um. Os cartões do Início passam a abrir a lista já filtrada.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Rota | A mesma `GET /alunos`, com parâmetros novos opcionais; E entre filtros, OU dentro de um filtro de várias opções; a resposta (`PaginaAlunos`/`AlunoResumo`) não muda | Gustavo (31/10) |
| D2 | `responsavel` | Repetível: id de membro ou `nenhum`. Com `meus=true` = 400 `FILTRO_INVALIDO` (como `GET /atualizacoes`); membro de outra consultoria ou id desconhecido = 404 | Gustavo (31/10) |
| D3 | `acesso` | Repetível: `COM` (tem usuário, inclui quem ainda não trocou a senha provisória), `SEM` (sem usuário), `AGUARDANDO` (tem usuário com a senha provisória, a mesma definição do `aguardandoPrimeiroAcesso` da ficha) | Gustavo (31/10) |
| D4 | `atualizacao` | Repetível: os nomes reais das fases de `RegrasAtualizacao` (`NENHUMA`, `AVISO`, `ABERTA`, `ATRASADA`, `ENVIADA`, `REVISADA`) e `SEM_PASTA` (sem linha em `linhasDosAlunos`, o grupo "Sem pasta com período"; inativo cai aqui, como na lista). Exige `ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER` (403 sem elas). No app: Para revisar (`ENVIADA`), Atrasada, Liberada ao aluno (`ABERTA`, a data é hoje ou amanhã), Em até 3 dias (`AVISO`), Daqui a mais de 3 dias (`NENHUMA`), Revisada e Sem pasta com período | Claude (nomes), Gustavo (regra) |
| D5 | `plano` e `pasta` | `plano=COM|SEM` (plano de treino ativo) e `pasta=A_RENOVAR` (a mesma consulta `PastaRepository.aRenovar` do painel, fim até hoje + 7). Os dois exigem `TREINO_LER` | Gustavo (31/10) |
| D6 | `registro` | `NUNCA`, `HA_MAIS_DE_7`, `HA_MAIS_DE_14`, `HA_MAIS_DE_30` (dias de Brasília, a conta do "sem registro há N dias" do painel: último registro antes de hoje − N). `HA_MAIS_DE_N` **não** inclui quem nunca registrou: isso é `NUNCA`, à parte. Exige `REGISTRO_LER` | Claude, pela sugestão do Gustavo |
| D7 | Valor desconhecido | 400 `FILTRO_INVALIDO`, a mensagem cita só o nome do parâmetro, nunca o valor (vale também para `situacao`) | Gustavo (31/10) |
| D8 | Implementação | Sem SQL nativo: busca, situação, responsável, acesso e plano numa `Specification` (Criteria; `@TenantId` vale). Os calculados (atualização, pasta a renovar, registro) em memória sobre os candidatos do escopo, depois a página (ordem por nome; `total` = quem passou em tudo). Sem filtro calculado, a página continua saindo do banco | Gustavo (31/10) |
| D9 | App | Peça reaproveitável `ui/BarraDeFiltros` (busca, "Filtros" com a contagem, "Limpar filtros", "Filtrado por" com ✕): no PC (≥ 768) painel logo abaixo, com cada escolha valendo na hora; no celular uma `Folha` com rascunho, gravado ao fechar (`depoisDeFecharAsFolhas`). Filtro sem a permissão some (o app nunca manda um filtro que daria 403). Filtros no endereço sem empilhar histórico, voltam à página 1 e limpam a seleção em lote | Gustavo (31/10) |
| D10 | Troca do endereço | `router.setParams` (chave que sai vai como `undefined`), não `router.replace`: medido no e2e, o `replace` troca a rota inteira e a tela perdia a busca digitada e o painel aberto. Também sem passo novo no histórico (o voltar sai da tela, provado no e2e) | Claude (31/10) |
| D11 | Responsável no endereço | `meus=true` = só os meus; `meus=false` = todos; `responsavel=<id>,nenhum` (e `meus` junto de pessoas); sem nada disso vale o padrão do perfil, como antes (quem não tem acesso total abre nos seus). Meus junto de outras pessoas vai à API como o id do usuário em `responsavel`. O Início manda sempre `meus=true` ou `meus=false`, para o Todos do bloco valer também para quem começa em Meus. Os chips mostram "Responsável: Meus alunos" também quando é o padrão do perfil, e "Limpar filtros" deixa todos os ativos | Claude (31/10) |
| D12 | Início | A rosca do bloco Alunos vira links (Ativos com acesso → `acesso=COM`, Ativos sem acesso → `acesso=SEM`, Inativos → `situacao=INATIVO`); "Sem pasta com período" → `atualizacao=SEM_PASTA` só para quem vê atualizações (sem elas, a lista sem esse filtro); "Concluídos" continua na lista sem filtro (não há filtro equivalente) | Claude (31/10) |

## Passos
- [x] 1. API: parâmetros novos em `GET /alunos` e `AlunoFiltrosIntegrationTest` — commit: cef843c (o teste de integração compila; não rodou aqui, sem Docker)
- [x] 2. App: `dominio/filtrosDeAlunos.ts`, `ui/BarraDeFiltros`, tela de alunos com os filtros no endereço — commit: c8e8ce2
- [x] 3. Início: cartões e rosca do bloco Alunos abrem a lista filtrada (com `meus=true` em Meus) — commit: c8e8ce2
- [x] 4. e2e `lista-alunos-filtros.spec.ts` (c8e8ce2), Ajuda, guia do treinador e `AGENTS.md` — commit: o seguinte a c8e8ce2

## Fora do escopo
- Usar a `ui/BarraDeFiltros` em Interessados, Atualizações e Financeiro (a peça já nasce para isso).
- Filtro por responsável na Agenda ou no Financeiro.

## O que ficou para trás
- `mvn verify` com Docker para rodar o `AlunoFiltrosIntegrationTest` (aqui só compilou). Também em Pendências soltas.
- Levar a `ui/BarraDeFiltros` a Interessados, Atualizações e Financeiro (fora do escopo; a peça já é genérica).
