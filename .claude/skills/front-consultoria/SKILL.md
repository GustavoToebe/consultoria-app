---
name: front-consultoria
description: Lista de conferência das telas do consultoria-app (app/src/aluno, treinador e ui; Expo/React Native web). Use ao criar, redesenhar, revisar ou ajustar tela, modal, formulário, filtro, lista, selo, cor ou componente de ui/, e antes de conferir a tela renderizada.
---
# Front do consultoria-app: lista de conferência

O `docs/design-e-front.md` e o `AGENTS.md` são a fonte e vencem esta lista. Aqui fica só o que mais se erra; o porquê
da cor está na seção 10 da skill `referencias-front`.

Skill de site institucional (`design-taste-frontend`) não entra em tela de `aluno/`, `treinador/` ou `ui/`: ela traz
direção de arte própria e aqui a identidade é a do projeto.

## Composição (4.6 do documento de design)
Tela com modal, formulário, filtro, opções, prévia de mídia, aviso ou motivo de ação indisponível segue os padrões
P1 a P5 de `docs/design-e-front.md` 4.6; as regras ficam lá.
1. Identifique o padrão aplicável e diga qual na resposta. Leia o status dele: **Proposto** não é regra aprovada nem
   está verificado; **Peça existe** foi só lida no código.
2. Reutilize a peça de `ui/` que o padrão indica. Se o problema aparece em mais de uma tela, corrija a peça (é mudança
   de componente compartilhado: liste as telas afetadas); nunca margem isolada por tela.
3. Confira na tela, em 390 e 1280 px, o bloco "Composição" da 6.4, comparando com uma tela equivalente.
4. Exceção ao padrão: justifique na resposta pelo benefício ao usuário. Ao verificar, atualize o status na 4.6 e as
   capturas em `docs/planos/composicao-visual.md`; sem captura, o status não sobe para **Verificado**.

## Cor como sinal (4.1 a 4.5; guia de 11/11/2026)
Antes de usar uma cor, decida se é **ação** (marca), **situação** (verde, âmbar, vermelho) ou **categoria** (paleta de
identificação); se não for nenhuma, é neutro.
- **Marca:** um `Botao primario` por tela ou área e o indicador pequeno do item ativo. Nada mais, sem decisão nova.
- **Situação:** `Selo` em pílula com ponto. Âmbar = pendência ou decisão de alguém ("Para revisar", "Falta a carga");
  vermelho = atraso, erro, valor inválido ou ação destrutiva; rascunho sem erro e quem só espera = `neutro`.
- **Categoria:** `Selo categoria` (pílula escura, texto na cor) e as marcas de macro; nunca verde nem vermelho.
- **Neutro por padrão:** número de indicador e de total (`ui/indicador.corDoNumero`), número da série, seleção
  (`ui/selecao.coresDaSelecao`: `superficie3` + `bordaCampo` + ✓; item em edição ganha contorno e "EDITANDO"), ✓ do
  que já foi feito (verde só no recém-marcado, `aluno/useMarcadoAgora`).
- **Contorno com peso:** contêiner em `divisor` de 1 px; campo, foco e selecionado em `bordaCampo` (3:1). Nada de
  borda de 2 px escrita na tela: a preferência "bordas reforçadas" é quem engrossa (`bordas.bloco`).
- **Superfície:** `fundo` → `painel` → `superficie` → `superficie2` (elevada, hover, menu) → `superficie3` (seleção),
  sem sombra; quem pinta o fundo da tela usa `useFundoDaArea()`.
- **Campo:** rótulo sempre visível, ajuda abaixo, erro com ícone + mensagem + borda (`MensagemDeErro`).
- **Medidas:** texto 4,5:1 e contorno 3:1 também no hover, na seleção e no foco, nas dez paletas e doze marcas; peça
  ou par de cor novo entra em `tema/tokens.test.ts` ou `ui/contrasteDasPecas.test.ts`.
- **Guia ao pé da letra:** quando o pedido traz um guia (PDF, prévia aprovada), responda item a item (feito / onde /
  ficou de fora e por quê). Onde a prévia e o guia discordam, vale o guia; divergência nunca passa em silêncio.

## Código da tela (seções 2, 3 e 6 do documento de design)
O método geral está em `referencias-front` (`references/oficio-visual.md` e `references/engenharia-front.md`); aqui
fica o que é deste app.
- **Camadas:** rota em `app/src/app/` só monta a tela; peça da área em `treinador/` ou `aluno/`; peça compartilhada
  em `ui/` (adapta a base de `components/ui/`); regra em `dominio/`, pura e com teste.
- **Dados da tela** por `ui/useCarregar` (chave → busca), HTTP só por `api/cliente.ts` e `api/rotas.ts`. Nunca buscar
  em `useEffect` com `setState` (o documento de design diz que o lint recusa).
- **React Compiler ligado:** sem `React.memo`, `useMemo` nem `useCallback` à mão.
- **Estilo:** `StyleSheet` + tokens (`espaco(n)` na grade de 8, `RAIO`, `RAIO_CONTROLE`, `ALVO_TOQUE`, `LARGURA_*`).
  Uniwind só nas peças-base de `components/ui/`.
- **Sem biblioteca nova** de UI, de gráfico ou de estado global; gráfico é o SVG próprio (`GraficoLinha`,
  `GraficoBarras`). Dependência do Expo só com `npx expo install`.
- **Peças de comportamento que já existem:** `ui/Esqueleto` (primeira carga), `ui/useMovimentoReduzido`,
  `focarPrimeiroComErro` (`ui/erros.ts`), `GuardaDeSaida` (sair com alteração pendente), `useAviso` (`ui/Aviso.tsx`).
- **Peso:** lista que pode passar de algumas centenas de itens pagina (a API já pagina alunos, interessados e
  auditoria); o pacote da web é um arquivo só, então tela do aluno não importa código pesado do treinador.
- **e2e por papel e rótulo** (`getByRole`, `getByLabel`): o nome acessível da peça é contrato do teste. Mudou o
  rótulo, mude o teste junto.
- **Mudança visual separada de mudança de comportamento** (6.1), para cada uma ser revisada pelo que é.
- **API do Expo ou do React Native:** Context7 na versão do `package.json` antes de usar (o `app/AGENTS.md` manda não
  confiar na memória).

## Sempre
- Cor só por token (`app/src/tema/tokens.ts`, `variaveis.ts`), nunca hex. Nada de `alert()`, `confirm()` ou
  `Alert.alert`: confirmação é `PainelConfirmacao`.
- Regra de validação ou de cálculo mora em `app/src/dominio/` com teste, antes da tela.
- Recurso desligado (503 da chave) ou fora do plano some da tela, nunca vira erro. Ausência de dado é "—".

## Antes de entregar
Lista da 6.4 do documento de design e as verificações da skill `verificacoes-consultoria` (typecheck, lint, jest e o
e2e da tela em 390 e 1280 px).
