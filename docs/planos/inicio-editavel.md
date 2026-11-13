# Início editável: arrastar, redimensionar, adicionar e ocultar blocos

Situação: Planejando · Onde: `main`, commits locais, sem push · Atualizado: 13/11/2026

## Objetivo
O treinador monta o Início do jeito dele: arrasta os blocos de lugar, escolhe o tamanho, oculta e volta a mostrar, salva ou cancela a edição e restaura o padrão, no PC e no celular, sem perder o que já escolheu e sem depender do mouse (há alternativa por teclado e por botões). Fonte: PDF `guia-cores-painel-e-comunidade.pdf` (13/11/2026), frente P1; pedido do Gustavo de 13/11.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Onde fica a preferência: **só no aparelho**, como hoje (`Preferencias.painelDoInicio`, AsyncStorage `treinos:<usuarioId>:preferencias`), sem API nem migration. Sincronizar entre aparelhos é melhoria futura (pendência registrada) | Mapa do painel de 13/11: não há endpoint nem tabela; manter evita contrato novo e mudança de banco | Sessão principal (decisão de rotina), a confirmar |
| D2 | Formato novo, compatível com o atual: `PainelDoInicioPreferido = { ordem, escondidos, meus, tamanhos }` com `tamanhos?: Partial<Record<BlocoDoPainelId, 1 \| 2 \| 3>>` (largura em colunas da grade; ausente = a largura padrão de `larguraDoBloco`). `painelDoInicioDe` normaliza (ids conhecidos, valor fora de 1 a 3 descartado) e continua tolerando o formato sem `tamanhos` (quem já tem a preferência salva não perde nada). Em 1 coluna o tamanho é ignorado | Mapa: a largura hoje é fixa em `grade.ts:30` e a preferência não guarda tamanho | Sessão principal |
| D3 | "Adicionar" = mostrar um bloco que estava oculto (os 8 ids são fixos, não há bloco novo). A bandeja de blocos ocultos fica visível na edição | Mapa: `BLOCOS_DO_PAINEL` fixo | Sessão principal |
| D4 | Salvar grava a preferência; Cancelar descarta tudo (inclusive o que foi arrastado); Restaurar padrão volta ordem, ocultos, tamanhos e "Meus/Todos" ao padrão (como o "Voltar ao padrão" de hoje) e só vale ao Salvar | `EditarPainel.tsx` já trabalha com rascunho | Sessão principal |
| D5 | Alternativa ao arraste, obrigatória: botões Subir/Descer (já existem), controle de tamanho (`Escolha`: Pequeno, Médio, Grande) e interruptor de ocultar, tudo operável por teclado e com rótulo que diz a posição; o arraste (gesture-handler + reanimated, já instalados) é um reforço, nunca o único caminho | PDF e pedido do Gustavo de 13/11 | Gustavo |
| D6 | Blocos que a pessoa não pode ver por permissão não aparecem nem na edição (`blocosPermitidos`); ocultar não muda a permissão nem a consulta que o bloco faz: bloco oculto não busca dado (verificar se hoje busca) | Mapa: `blocoDisponivel` | Sessão principal |
| D7 | As cores e os significados da frente de cores valem: bloco em edição usa contorno e marca de seleção próprios, nunca cor de situação (D9 de `cores-de-destaque.md`) | Plano de cores | Gustavo, 13/11 |

## Passos
- [ ] 1. Preferência: `tamanhos` em `PainelDoInicioPreferido`, `painelDoInicioDe`, `grade.ts` (`larguraDoBloco` lê o tamanho), regras puras em `dominio/painelDoInicio.ts` (`moverBloco`, `redimensionarBloco`, `restaurarPadrao`) com testes Jest — responsável: executor-front (tela e regra pura do painel) — commit: —
- [ ] 2. Modo de edição no Início (`app/src/app/treinador/index.tsx`, `treinador/painel/EditarPainel.tsx` e peças novas em `treinador/painel/`): arrastar, tamanho, ocultar e mostrar, Salvar, Cancelar e Restaurar padrão, com teclado e botões — responsável: executor-front — commit: —
- [ ] 3. Verificação: e2e do painel (`app/e2e/painel.spec.ts`: salvar, cancelar, restaurar, persistir ao recarregar, compatibilidade com a preferência antiga, teclado), 390/768/1280/1920, claro e escuro, texto ampliado, offline (Editar desabilitado) — responsável: executor-front, revisão independente (`revisor`) da persistência — commit: —
- [ ] 4. Documentação: `docs/design-e-front.md` (painel editável), Ajuda do app se descrever o Início — responsável: executor — commit: —

## Responsabilidade por arquivo (um dono por arquivo, 13/11)
- Frente B (executor-front do Início): `app/src/app/treinador/index.tsx`, `app/src/treinador/painel/*`, `app/src/dominio/painelDoInicio.ts`, `painelBlocos.ts`, `app/src/dominio/preferencias.ts` (só o campo `painelDoInicio`), `app/e2e/painel.spec.ts`.
- Frente A (cores e estados): nada deste conjunto. `CartaoRecordesDaSemana` (usado no Início) já está commitado; qualquer mudança nele passa pelo dono da frente A e avisa a B.
- Compartilhados (`tema/tokens.ts`, `ui/Selo`, `ui/NumeroDeDestaque`): sessão principal.

## Estado em 13/11 (para retomar)
- Plano e contratos prontos (`157a3a58`, `bb10455a`). Passos 1 a 3 em execução pelo executor-front (porta e2e 8125, sem commit); falta: revisar o diff, conferir capturas em `scratchpad\inicio-editavel\`, `revisor` na persistência, commitar por frente, passo 4 (docs) ao executor. Se a sessão cair sem o relatório: `git status` mostra os arquivos do conjunto "Frente B" acima; nada está commitado.

## Fora do escopo
- Sincronizar o painel entre aparelhos e guardá-lo no servidor (pendência abaixo).
- Blocos novos (gráficos, listas) além dos 8 existentes.
- Mexer na API ou no banco.

## O que ficou para trás
- (preencher ao entregar; cada sobra também vai para "Pendências soltas" no README)
- Sincronizar o painel entre aparelhos (a preferência é só do aparelho; trocar de navegador perde a organização). Responsável: Gustavo (priorizar) e executor.
