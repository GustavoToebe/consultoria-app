# Ficha do aluno › Dados: Acesso ao app, Plano contratado e Histórico de lesões

Situação: Entregue (commit `7a13c561`, publicado no run 45310566613) · Onde: main · Atualizado: 23/11/2026

## Objetivo
Reorganizar a aba Ficha do aluno para o treinador ler o plano, o acesso e as lesões sem rolar nem caçar: duas colunas no
PC largo, uma coluna na ordem de importância no celular, plano com valor e vigência à vista e lesões ativas destacadas.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Layout | Faixa `normal` ou maior (área de conteúdo ≥ 1024 px, `useFaixaDeLargura`): Plano 2fr à esquerda, Acesso e Anamnese empilhados 1fr à direita (sem o Plano, os dois dividem a linha); Histórico de lesões na largura toda, abaixo. Numa coluna: Lesões ativas › Plano › Acesso › Anamnese › Histórico (as recuperadas). Peça `treinador/BlocosDaFicha`. Em 1280 px com o menu aberto a área fica abaixo de 1024: uma coluna (regra mantida) | Gustavo (pedido de 23/11) |
| D2 | Último acesso | Só existe `ultimoAcesso` do tipo `LOGIN` hoje: a tela diz "Último login: há N dias" (login nunca é chamado de acesso, AGENTS.md); "Último acesso ao app" só para `ACESSO`. Data exata na dica (web) e no nome acessível. Dias em Brasília | Regra do projeto |
| D3 | Vigência | Os dias restantes são os da API (`diasRestantesVigencia`); ≤ 15 dias âmbar, vencida vermelha, senão neutra (`dominio/fichaDados.vigenciaDaContratacao`). A renovação pelo WhatsApp segue a janela de 40 dias da API | Gustavo (pedido de 23/11) |
| D4 | Cobranças na ficha | As 3 mais recentes por vencimento; "Ver todas no Financeiro" com `?aba=cobrancas&alunoId=` | Gustavo (pedido de 23/11) |
| D5 | Lesão | Não há campo "título": a coluna principal é a Região (obrigatória) e a segunda, a Descrição (com a observação embaixo). Ativa = não recuperada (ver D8); "Recuperada" neutra | Regra do projeto (dados existentes) |
| D6 | Tingido das ativas | `ui/superficiePintada` (do cartão de indicador pintado), fundo liso `forte` e borda na cor, texto em `texto`/`textoSuave` (contraste travado em `tema/tokens.test.ts`) | Gustavo (pedido de 23/11) |
| D8 | "Em recuperação" conta como ativa | Aprovado: âmbar, tingida e no topo, como no aviso do Resumo | Gustavo, 23/11 |
| D9 | Plano MENSAL sem vigência | A ficha não mostra barra, dias restantes, Início/Término nem a cor de vigência no mensal (`dominio/fichaDados.mostraVigencia`); trimestral, semestral e anual seguem com a barra e o `terminoVigencia`/`diasRestantesVigencia` da API (que passa a calcular o término por ciclo; contrato JSON igual) | Gustavo, 23/11 |
| D10 | Vigência só na contratação ATIVA | Pausada e encerrada não mostram barra, dias restantes nem Início/Término (o término que a API devolve para elas vem da âncora antiga); continuam nome, selo, valor, "Vence todo dia N", cobranças e responsável. Regra única: `mostraVigencia(periodicidade, situacao)` = ATIVA e período maior que um mês | Gustavo, 23/11 |
| D7 | Tabela das lesões | Peça própria (`TabelaDeLesoes` em `treinador/CartaoLesoes`): a `ui/Tabela` não pinta uma linha e mudar a peça compartilhada mexeria nas outras telas | Executor-front |

## Passos
- [x] 1. Regras puras e jest (`app/src/dominio/fichaDados.ts`, `linhaDoResponsavel` em `responsavelFinanceiro.ts`) — commit/run: —
- [x] 2. Acesso ao app compacto, Plano contratado, Responsável financeiro, Lesões e o arranjo da aba — commit/run: —
- [x] 3. E2e novos (`app/e2e/ficha-dados.spec.ts`) e os antigos ajustados (`acesso-aluno`, `financeiro-responsavel`) — commit/run: —
- [x] 4. Verificações (23/11, antes do commit `7a13c561`): `npx tsc --noEmit` sem erro nos arquivos da frente; `npm run lint` com os 11 avisos antigos; `npm test` 388 suítes, 9312 testes; e2e (porta 8163, Chromium 1243) da ficha, acesso, anamnese, responsável, planos ativos, cadastro, datas válidas, financeiro e filtros laterais: 287 passaram na primeira rodada e 6 falharam (1 era a tolerância do teste novo de 1920; 3 eram o link renomeado para "Ver todas no Financeiro" em `filtros-laterais`; 2 eram do `ficha-em-abas:363`, em 1280 e 390, por causa do ponto tirado do `NumeroDeDestaque` por outra frente, e passaram depois). Rodada final só de `ficha-dados`, `ficha-em-abas`, `filtros-laterais`, `acesso-aluno` e `financeiro-responsavel`: 132 de 132 verdes. `financeiro`, `planos-ativos`, `cadastro-aluno`, `datas-validas`, `anamnese` e `ficha-cabecalho` ficaram verdes na primeira rodada e não rodaram de novo depois dos ajustes finais de espaçamento (vão das cobranças, largura do Período e limite das colunas das lesões) — commit/run: —
- [x] 5. Ajuste D9 (mensal sem barra), com jest e e2e (`ficha-dados`: caso mensal; 15 dias e vencida no trimestral) — commit/run: —
- [x] 6. Ajuste D10 (pausada e encerrada sem barra), com jest e e2e (`ficha-dados`: caso pausado e encerrado) — commit/run: —
- [ ] 7. Commit e conferência do Gustavo — commit/run: —

## Evidências
- Capturas (fora do repositório, sem dado real): 1920, 1280 e 390 px, escuro e claro, aluno com plano ativo, 2 cobranças, uma lesão ativa e uma recuperada, e aluno sem plano e sem lesões. Em 1920 px (menu aberto) a aba fica em duas colunas; em 1280 px com o menu aberto a área é menor que 1024 e a aba fica numa coluna (regra D1).
- Não conferido: Areia e contraste alto renderizados (o contraste do tingido está travado no `tokens.test.ts` do helper), app nativo, leitor de tela.

## Fora do escopo
- Mudar o Financeiro, a API ou a peça `ui/Tabela`.
- Texto da Ajuda: continua certo (não cita os ícones nem o "Usuário no app").

## O que ficou para trás
- `AGENTS.md` (item "Ficha do aluno (treinador)") ainda diz "Acesso e Lesões (lado a lado a partir de 1.100 px) e Anamnese depois"; atualizar junto do commit.
