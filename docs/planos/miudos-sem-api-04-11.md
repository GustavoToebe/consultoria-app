# Miúdos do app sem API (04/11)

Situação: Código pronto para revisão · Onde: branch `miudos-sem-api` (worktree `wt-04-11-B`, saída da `origin/main` em `f4f824ee`) · Atualizado: 04/11/2026

## Objetivo
Fechar as pendências soltas do app que não pedem API: a revisão do Início (painel-novo), os casos de cor fora da tabela
da seção 4.5, as cores fixas que viram tokens, o e2e do chip de Metodologias, o texto do gráfico do peso, a trava do
`tsconfig` e a confirmação das paletas.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Selo de cobrança | Só com texto, sem ícone e sem mudar o desenho do `Selo` | Gustavo, 04/11 |
| D2 | Paletas | A Brisa fica fora; o `faixaForte` das escuras é a faixa + 0,03 (conferido canal a canal: `mix(cartão, branco, t_faixa + 0,03)` nas quatro) | Gustavo, 04/11 |
| D3 | Início sem alunos | A primeira carga ainda busca os blocos junto (não atrasa o Início de quem tem alunos); sabido que não há aluno, voltar à tela e recarregar não buscam mais os blocos, até a resposta do painel trazer um aluno. Na web o Início é desmontado ao abrir outra tela, então o "sem alunos" fica na memória do módulo, por usuário (só um sim/não, não é limpo no Sair; recarregar a página apaga) | Claude, 04/11 (diferente do portão de mão única sugerido na revisão, para não somar uma ida à API para todos) |
| D4 | Casos fora da tabela | "Aguardando primeiro acesso" passa de `atencao` a `neutro` (o aluno age, o treinador espera); pagamento `AGUARDANDO` da inscrição, cobrança `CONTESTADA` e o consumo da conta ficam como estavam (exceção da cobrança e quem decide é o administrador) | Claude, 04/11 (pede o aceite do Gustavo) |
| D5 | `Switch` desligado | Trilho `bordaCampo` e botão `superficie` (antes `borda` e branco fixo, 1,95:1 no claro); ligado segue a seleção invertida | Claude, 04/11 |
| D6 | Sombra dos painéis flutuantes | Um token só, `SOMBRA_FLUTUANTE` (`0 8px 24px` a 35%); o `Calendario` estava em 45% e passou a 35% | Claude, 04/11 |

**Aceite (Gustavo, 04/11):** D3 a D6 aceitas como foram feitas (D3 o carregamento do Início, D4 o "Aguardando primeiro acesso" neutro, D5 as cores do `Switch`, D6 a sombra de 0,35 do `Calendario`).

## Passos
- [x] 1. Início, revisão do painel-novo: (a) leitura do aparelho que responde depois de um toque não desfaz o toque (contador de geração por usuário em `usePrimeirosPassosGuardados`, teste `usePrimeirosPassosGuardados.test.tsx`); (d) a Ajuda não mostra o cartão dos Primeiros passos a quem não tem item nenhum (`dominio/primeirosPassos.temPrimeirosPassos`); (e) Início sem alunos não busca os blocos de novo (D3; e2e dos dois caminhos: continua sem alunos, e cadastrou o primeiro e os blocos voltam); (f) `recarregar` usa as vagas atuais por ref, sem casar listas pela ordem — commit/run: —
- [x] 2. Casos de cor fora da tabela (`CartaoAcesso`, pagamento da inscrição `AGUARDANDO`, cobrança `CONTESTADA`, consumo da conta): uma linha cada na seção 4.5 e o código igual (D4); `seloDoAcesso` foi para `dominio/cadastroDoAluno`; teste em `corPorSituacao.test.ts` — commit/run: —
- [x] 3. Cores fixas viram tokens: `Passeio` e `alert-dialog` com o `VEU`, `switch` com tokens do tema (`ui/interruptor.coresDoInterruptor`, D5), sombras dos painéis suspensos em `SOMBRA_FLUTUANTE` (D6); contraste do `Switch` em `contrasteDasPecas.test.ts` e trava `tema/coresFixas.test.ts` — commit/run: —
- [x] 4. e2e "Abrir Metodologias" confere o chip selecionado (`e2e/painel.spec.ts`) — commit/run: —
- [x] 5. `avisoDoGrafico` com o texto do histórico vazio (`TEXTO_GRAFICOS_DESLIGADOS` e a versão do aluno, de `dominio/relatorio`) — commit/run: —
- [x] 6. Teste que falha se o `expo start` reescrever o `app/tsconfig.json` (`src/tsconfig.test.ts`, com a própria função do `@expo/cli`; o `include` perdeu `.expo/types` e `expo-env.d.ts`, que o Expo tirava com `typedRoutes` desligado) — commit/run: —
- [x] 7. Paletas: Brisa fora e `faixaForte` = faixa + 0,03, só confirmação (`paletas-da-marca.md`; nenhum token mudou) — commit/run: —

## Fora do escopo
- Editor de treino (frente A, em paralelo).
- `docs/planos/README.md` e `AGENTS.md`: só o coordenador.

## O que ficou para trás
- `docs/design-e-front.md` 4.1 ainda diz "Status sempre com texto e ícone"; a 4.5 (e D1) diz só texto no selo de cobrança. Fora da seção desta frente.
- `docs/design-e-front.md` diz "sem sombra" (flat), mas os painéis flutuantes têm `SOMBRA_FLUTUANTE`: escrever a exceção ou tirar a sombra é decisão de desenho.
- `paletas-da-marca.md`: a passada local com capturas nas 10 paletas e o passo 7 (revisão) continuam abertos.
