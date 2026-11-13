# Ficha do aluno › Dados do aluno em quatro seções

Situação: Feito na árvore local, aguardando commit · Onde: main (sem commit; base = `main` local de 12/11/2026) · Atualizado: 12/11/2026

## Objetivo
Trocar o cartão único de "Dados do aluno" (duas listas distantes na leitura; campos curtos esticados na edição) por quatro
seções com título próprio, iguais na consulta e na edição, no padrão das seções do "Editar alimento"
(`treinador/biblioteca/AbaAlimentos.tsx`). Pedido do Gustavo de 12/11/2026, com capturas do tema escuro no PC.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Seções e ordem (leitura e edição) | 1. Identificação (nome, nascimento, sexo, CPF); 2. Contato e endereço (e-mail, telefone, endereço); 3. Configuração do acompanhamento (responsável, questionário, intervalo); 4. Objetivo e observações (objetivo, meta, observações) | Gustavo |
| 2 | Dado ausente | "Não informado" em todos os pares da ficha; herdado (intervalo, questionário, meta) = "Padrão da consultoria" (com "(N dias)" quando o padrão é conhecido); sem responsável = "Sem responsável" (o mesmo texto da opção na edição); id de quem saiu da equipe = "Membro inativo". É exceção ao "—" do `AGENTS.md` e do `design-e-front.md`, registrada nos dois | Gustavo / Claude |
| 3 | Permissões | CPF, endereço e a seção 4 inteira só com `ALUNO_SENSIVEL_LER` (leitura) / `ALUNO_SENSIVEL_ALTERAR` (edição); seção sem campo some, sem título vazio | regra existente |
| 4 | Responsável na edição | seletor `EscolhaEmFolha` (busca acima de 8 pessoas; "Sem responsável" primeira opção; `rotuloDoValor` "Membro inativo"), no lugar da fileira de botões. `EscolhaEmFolha` e não `EscolhaSuspensa`: é a peça que já mostra um valor fora da lista e a que a `FolhaDaInscricao` usa para o responsável | Gustavo / Claude |
| 5 | Ações da edição | um "Editar dados" na faixa do cartão; Cancelar e Salvar numa barra no fim do formulário, no fluxo (não fixa): nunca cobre o último campo e não disputa o canto com o "Voltar ao início" | Gustavo / Claude |
| 7 | Colunas | duas colunas fixas (1 e 2 à esquerda, 3 e 4 à direita), base 420 px e `flexWrap`: descem abaixo de ~864 px úteis, na ordem 1-2-3-4; mesma árvore em qualquer largura. Não a `Grade`: com 3 colunas a ordem de leitura se perdia e sobrava vão sob a seção curta | Claude |
| 8 | Leitura | par rótulo + valor: rótulo em coluna de 168 px a partir de 768 px (valores alinhados), empilhado abaixo; valor com até 640 px e quebra natural; altura pelo conteúdo | Claude |
| 6 | Novo aluno | o mesmo `FormAluno`, com as mesmas quatro seções (substitui Cadastro / Dados pessoais / Acompanhamento da frente `larguras-ajustes-novo-aluno.md`) | Claude (o formulário é um só) |

## Passos
- [x] 1. Plano e índice — commit: — (sem commit)
- [x] 2. Leitura em quatro seções (`treinador/DadosDoAluno.tsx`, novo; sai a função de `[id].tsx` e o `equipe/ResponsavelAluno.tsx`) — commit: —
- [x] 3. Edição nas mesmas seções (`treinador/FormAluno.tsx`, prop `colunas` trocada por `nivel`) e Novo aluno (`alunos/novo.tsx`) — commit: —
- [x] 4. Testes e capturas — commit: —. Evidência (12/11, árvore local): `tsc` ok; eslint nos tocados ok; `npm test` 302 suítes / 6528 testes (a suíte a mais é `painelDeFiltros.test.ts`, de outra frente); e2e `cadastro-aluno`, `meus-dados-aluno`, `ficha-em-abas`, `larguras-ajustes-cadastro-lembretes`, `cor-da-variacao-do-peso` e `lista-alunos-grupos`: 107 passaram antes do último ajuste do `FormAluno`; depois dele, 106 e 1 falha em "Financeiro › Lembretes 1920 px" (campo com 790 px > 560), tela que esta frente não toca, depois de a frente `filtros-laterais` mexer em `FiltrosEmGrade`, `BarraDeFiltros` e `Folha` entre as duas rodadas; Jest e e2e rodaram numa árvore com essa outra frente em andamento; o caso "ficha em 1280/390 px" de `cadastro-aluno.spec.ts` trava a ordem das quatro seções na leitura e na edição, "Não informado" e "Padrão da consultoria". Capturas antes/depois (1440, 1280, 390; claro e escuro; vazio, sem sensível, sem acesso) ficaram no scratchpad da sessão, fora do repositório.

## Composição (4.6 / 6.4)
- Padrão P2 (formulário). Status da 4.6 **não** sobe: capturas fora de `docs/planos/composicao-visual.md`. Exceção: campos em `linha` própria com `flexWrap` e larguras pela resposta (pedido "larguras proporcionais"), não `CamposEmLinha` com número fixo de colunas.
- Conferido em 1440, 1280 e 390 px, no claro e no escuro. **Não** conferidos: o claro areia e o contraste alto.

## Fora do escopo
- "Acesso ao app" (bloco próprio, sem mudança).
- Regras de salvamento, contrato da API e permissões (sem mudança).

## O que ficou para trás
- `ui/CamposDeEndereco` (peça compartilhada): o CEP ainda ocupa a largura toda da seção (até 560 px). CEP curto pede mexer na peça, que também serve à anamnese e aos Meus dados do aluno: sugestão para o design system, fora deste pedido.
- O seletor do questionário (`SeletorDeQuestionario`) segue com a largura do conteúdo e o do responsável com a da coluna; igualar pede uma prop de estilo na peça do questionário.
