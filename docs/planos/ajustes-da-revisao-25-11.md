# Ajustes da revisão de 25/11 (13 itens) e pendências

Situação: Entregue em 25/11/2026 (commits `443b9065`, `9b4c29c2`, `56e0319c`, `64c1ee40`; CI `45678011298` verde; VPS no `64c1ee40dff4`) · Onde: main (a partir de `6890ee44`) · Atualizado: 25/11/2026

## Objetivo
Aplicar os 13 ajustes da revisão do Gustavo de 25/11: contagens e "Próximo passo" do Início do treinador, cores do financeiro, fonte mono só em números, menu lateral, Vitrine, editor de questionário em tela larga, Início/Treino do aluno e o fallback do Turnstile em navegadores de dentro de apps. Push autorizado se ficar verde.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Redesenho da tela do exercício do aluno | Salvo na branch local `treino-academia` (`318ff475`), sem push nem merge; este lote parte da `main` sem esses arquivos; Gustavo testa no Android | Gustavo |
| D2 | "Copiar link" do convite da Equipe | NÃO entra; o "Renovar" resolve | Gustavo, em 25/11 (fecha o D2 de [ajustes-de-layout-25-11.md](ajustes-de-layout-25-11.md)) |
| D3 | Turnstile | Não desligar; se a verificação falhar em navegador de dentro de app, mostrar "Abra no navegador para entrar" com "Copiar link" e, no Android, atalho para o Chrome | Gustavo |

## Passos (um dono por arquivo por onda)
Evidência de cada passo: verificações por frente rodadas pelo agente; commit e CI só depois do push (a preencher na entrega, sem inventar).
- [x] T-001 Início do treinador e financeiro (itens 1, 2, 3): contagens só de alunos com acesso (`PainelService`, `AtualizacaoRepository.linhasDoPainel`), "N alunos ainda não têm acesso" + "Enviar convites", sem ressalva de histórico parcial, financeiro sem azul/roxo (`corDaEntradaAvulsa`), gráfico do primeiro mês com dado (mín. 3) — executor
- [x] T-002 Fonte mono só em números (item 4): `Texto numerico` parte o texto (`ui/numerosNoTexto`); varredura de treinador e aluno — executor
- [x] T-003 Menu lateral em até 2 linhas, Vitrine "N item(ns) · até 30", editor de questionário em tela larga (itens 5, 6, 7) — executor
- [x] T-004 Início e Treino do aluno (itens 9 a 12): "Hoje" neutro, mapa em verde de treino, logo só no menu no PC, Orientações recolhidas com seções — executor
- [x] T-005 Turnstile em navegador embutido (item 13): "Abra no navegador para entrar" (`dominio/navegadorEmbutido`, `ui/AbraNoNavegador`); **não testado em WhatsApp/Instagram reais** — executor
- [x] T-006 Correção da `ListaDeDados` (valor com largura mínima, ação desce, motivo em linha de ajuda) — executor
- [x] T-008 Cores e gráfico do Financeiro (Visão geral), mono em ajustes finos — executor
- [x] T-009 ⓘ "Sobre esta tela" em todas as telas principais do treinador (`dominio/ajudaDaTela`, `CabecalhoDaFicha`, editores) — executor
- [x] T-011 Aparência e preferências em 5 seções (`ui/LinhaDeConfiguracao`, `ui/Alvenaria`) — executor-front
- [x] T-012 Início em edição estilo widgets (`treinador/painel/edicao/*`) e bloco Aniversários (`BlocoAniversarios`, opção do bloco, migração de `diasAniversario`) — executor-front
- [x] T-013 `Alvenaria` única — executor
- [x] Integração final: guias PDF, `tsc`, lint, jest, e2e completa (peças compartilhadas), `mvn verify`, revisão independente, commits por caminho (T-006 separado), push se verde — commits `443b9065`, `9b4c29c2`, `56e0319c`, `64c1ee40`; CI run `45678011298` verde
- [x] Passo 0 e item 8 (decisão D2)
- Branch `treino-academia` (local, sem push, **fora deste lote**): `318ff475` redesenho do exercício, `576dab01` série pintada com faixa lateral reta, `55bfaeda` T-010 (séries pintadas no editor, preferência "Cor das séries"). Só sobe quando o Gustavo avisar do teste no Android; conflitos esperados com este lote em `PreferenciasDoApp`, `TelaDoEditor`, `EditorDeTreino`, `EditorDeDieta`, `EditorQuestionario`; a linha "Cor das séries" entra depois no layout novo de 5 seções.

## Pendências e decisões em aberto
- Aniversários nasce Médio e fica sozinho na última linha em 1920 px (menu aberto, 4 colunas): decisão do Gustavo.
- "Planejamento" do ⓘ aponta para a seção `planos` da Ajuda (decisão da sessão).
- Números (`NumerosService`) ainda conta atrasadas de alunos sem acesso; o Início não.
- Turnstile em WhatsApp/Instagram reais no Android (roteiro em `docs/turnstile.md`).
- Defeitos 3a/3b do editor de treino (cabeçalho da série aberta e barra fixa): não reproduzidos, causas da mesma família corrigidas na branch `treino-academia`; confirmar com captura.
- `Botao` perde `accessibilityHint` quando o motivo vai para a linha de ajuda (`ListaDeDados`).
- Guarda de saída da edição do Início só testada via Cancelar (não pelo menu lateral); nativo, Areia e contraste alto não conferidos.

## Para o próximo lote (pedido do Gustavo, 25/11 à tarde; não entra neste push)
- ⓘ do cabeçalho (`ui/AjudaDoCabecalho`): o balão fica no DOM com `role="dialog"` e `display:none` quando fechado. Montar só quando aberto (ou tirar o `role` enquanto oculto) e, se não for mais preciso, reverter o remendo do `algoPorCima` em `app/treinador/agenda.tsx` (só diálogos visíveis) e o `getByRole('dialog')` em `e2e/folha-foco.spec.ts`.
- Toast no celular (`ui/Aviso.tsx:79`): não pode cobrir botão de ação; posicionar acima de qualquer rodapé fixo e da área segura; toast persistente com botão de fechar. Teste: `migracao-assistida-amostra:219` em 390 (falha igual na cópia limpa, defeito antigo).
- `filtros-laterais-entrada:58` (1280, movimento normal): o spec não observa `translateX` diferente de 0 a caminho de zero; falha também na cópia limpa. **Só registrar** (causa não investigada).

## Fora do escopo
- Redesenho do exercício do aluno (branch `treino-academia`).
- "Copiar link" do convite da Equipe.
