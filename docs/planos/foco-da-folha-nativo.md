# Foco do leitor de tela ao fechar a Folha no celular

Situação: Em andamento · Onde: branch `foco-da-folha-nativo` (saída da `main` `56fa9f15`) · Atualizado: 03/11/2026

## Objetivo
Ao fechar a `Folha` no Android e no iOS com o leitor de tela ligado (TalkBack/VoiceOver), o foco volta ao controle que a
abriu, como já acontece na web (C3 e D4 de [auditoria-pecas.md](auditoria-pecas.md)). Sem mexer nas cerca de 90 chamadas
da `Folha`: o gatilho é pego sozinho.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Como pegar o gatilho | `onClickCapture` na raiz do app (`app/_layout.tsx`) e no painel da `Folha`: o clique de acessibilidade (duplo toque do TalkBack/VoiceOver) chega ao `Pressable` como `onClick` com o nó do próprio controle como `target` (é o que o `Pressability` do RN usa). O último nó fica em `ui/focoDaFolha.ts`; a `Folha` lê no primeiro render do painel (como a web lê `document.activeElement`). Cliques com `pointerType` (toque comum) são ignorados: sem leitor de tela não há foco a devolver, e o alvo do toque seria o filho mais fundo, não o controle | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D2 | API do RN | `AccessibilityInfo.sendAccessibilityEvent(no, 'focus')` com o nó (instância do host), não `setAccessibilityFocus(reactTag)`: no RN 0.86 (Fabric) o `setAccessibilityFocus` está marcado como obsoleto e usa o caminho antigo por número | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D3 | Quando restaura | Só com `AccessibilityInfo.isScreenReaderEnabled()` verdadeiro, 400 ms depois de o painel sair (a camada do `Modal` precisa ter ido), só se o gatilho ainda está na tela (`isConnected`) e só se o clique foi até 2 s antes de a Folha abrir (Folha aberta sem clique, por exemplo depois de uma consulta demorada, não manda o foco para um controle antigo). Qualquer falha é engolida: nunca quebra o fechar | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D4 | Folha dentro de Folha | Cada painel guarda o seu gatilho ao abrir: fechar a de cima devolve o foco ao botão dentro da de baixo; fechar a de baixo, ao botão da tela | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D5 | Regra pura | `dominio/focoDaFolha.ts` (com jest): quando o clique ainda vale e quando restaurar | pedido do Gustavo, 03/11 |

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
5. Com o leitor desligado nada muda. Se algum caminho não devolver o foco, anotar qual tela e qual aparelho.

## Fora do escopo
- Web (já feita no C3) e `PainelConfirmacao`.
- Conferir no aparelho: pendência do Gustavo (README, "Pendências soltas").

## O que ficou para trás
- Conferir no aparelho real (roteiro acima): Gustavo.
