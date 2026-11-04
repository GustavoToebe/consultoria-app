# Foco do leitor de tela ao fechar a Folha no celular

Situação: Código e testes prontos; falta conferir no aparelho (Gustavo) · Onde: branch `foco-da-folha-nativo` (saída da `main` `56fa9f15`) · Atualizado: 03/11/2026

## Objetivo
Ao fechar a `Folha` no Android e no iOS com o leitor de tela ligado (TalkBack/VoiceOver), o foco volta ao controle que a
abriu, como já acontece na web (C3 e D4 de [auditoria-pecas.md](auditoria-pecas.md)). Sem mexer nas cerca de 90 chamadas
da `Folha`: o gatilho é pego sozinho.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Como pegar o gatilho | `onClickCapture` na raiz do app (`app/_layout.tsx`) e no painel da `Folha`: a hipótese é que o clique de acessibilidade (duplo toque do TalkBack/VoiceOver) chegue ao `Pressable` como `onClick` com o nó do próprio controle como `target` (é o que o `Pressability` do RN prevê no código); **não comprovado, quem decide é o aparelho** (se o duplo toque não gerar `onClick`, o foco não volta e não há erro). O último nó fica em `ui/focoDaFolha.ts`; a `Folha` lê no primeiro render do painel (como a web lê `document.activeElement`). Cliques com `pointerType` (toque comum) são ignorados: sem leitor de tela não há foco a devolver, e o alvo do toque seria o filho mais fundo, não o controle | pointerType: confirmado pelo Gustavo em 04/11; o resto (a hipótese do `onClickCapture`), decidido pelo Claude em 03/11, conferir com o Gustavo |
| D2 | API do RN | `AccessibilityInfo.sendAccessibilityEvent(no, 'focus')` com o nó (instância do host), não `setAccessibilityFocus(reactTag)`: no RN 0.86 (Fabric) o `setAccessibilityFocus` está marcado como obsoleto e usa o caminho antigo por número | confirmado pelo Gustavo em 04/11 |
| D3 | Quando restaura | Só com `AccessibilityInfo.isScreenReaderEnabled()` verdadeiro, 400 ms depois de o painel sair (a camada do `Modal` precisa ter ido), só se o gatilho ainda está na tela (`isConnected`) e só se o clique foi até 2 s antes de a Folha abrir (Folha aberta sem clique, por exemplo depois de uma consulta demorada, não manda o foco para um controle antigo). Se outra Folha abriu desde o fechar (contador `quantasFolhasJaAbriramNoNativo`, ex.: "Criar e abrir" que fecha a Folha e abre a guarda "Sair sem salvar?" na Folha de baixo), desiste. Qualquer falha é engolida: nunca quebra o fechar | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D4 | Folha dentro de Folha | Cada painel guarda o seu gatilho ao abrir: fechar a de cima devolve o foco ao botão dentro da de baixo; fechar a de baixo, ao botão da tela | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D6 | Limites conhecidos (não tratados) | (a) o `PainelConfirmacao` (diálogo) aberto no lugar do fechar e (b) a navegação para outra tela (ex.: abrir o editor) não são vistos pelo contador: se o gatilho ainda estiver montado atrás, o foco pode ir para ele; (c) o `onClickCapture` fica na raiz e também no painel da Folha porque não deu para confirmar sem aparelho que o clique atravessa o `Modal` até a raiz; o `_layout.tsx` não tem teste de render (a Folha tem: `Folha.foco.test.tsx`); (d) o gatilho é zerado ao ser lido, então a Folha aberta sem clique não herda o anterior | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D5 | Regra pura | `dominio/focoDaFolha.ts` (com jest): quando o clique ainda vale e quando restaurar | pedido do Gustavo, 03/11 |
| D7 | Tipos do clique | As props do clique (`onClickCapture`) vão por um objeto com cast, porque os tipos do RN não trazem `onClickCapture` | confirmado pelo Gustavo em 04/11 |

## Passos
- [x] 1. **Regra pura em `dominio/focoDaFolha.ts` + jest** — commit/run: —
- [x] 2. **Mecanismo central** (`ui/focoDaFolha.ts`, `ui/Folha.tsx`, `app/_layout.tsx`) com jest do caminho nativo (ios e android: leitor ativo restaura, sem leitor não faz nada, sem gatilho não quebra, Folha dentro de Folha) — commit/run: —
- [ ] 3. **Conferir no aparelho** (Gustavo, TalkBack e VoiceOver) — roteiro abaixo
- [x] 4. Verificações: typecheck, lint, jest completo, e2e `folha-foco` e `cadastro-aluno` (porta 8102) — commit/run: —

### Roteiro para o aparelho (Gustavo)
1. Ligue o TalkBack (Android) ou o VoiceOver (iPhone). Abra o app (tela de alunos do treinador).
2. Toque no botão que abre uma Folha (ex.: "Novo aluno"), com duplo toque. Feche pelo "Fechar" (X): o foco do leitor tem de voltar a "Novo aluno".
3. Repita fechando por "Fechar painel" (fora da folha) e pelo voltar do Android (gesto/botão).
4. Folha dentro de Folha (ex.: na ficha, abrir uma folha e dela outra, se houver): fechar a de cima devolve o foco ao botão da de baixo.
5. Fechar uma Folha que abre outra ou navega (ex.: "Criar e abrir" na pasta do aluno, que abre a guarda "Sair sem salvar?" ou o editor): o foco não deve pular para o botão escondido atrás.
6. Com o leitor desligado nada muda. Se algum caminho não devolver o foco, anotar **qual sistema (Android ou iOS)**, o aparelho e a tela.

## Fora do escopo
- Web (já feita no C3) e `PainelConfirmacao`.
- Conferir no aparelho: pendência do Gustavo (README, "Pendências soltas").

## O que ficou para trás
- Conferir no aparelho real (roteiro acima): Gustavo.
