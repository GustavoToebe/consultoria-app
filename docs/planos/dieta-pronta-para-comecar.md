# Dieta pronta para o Saraiva começar a usar

Situação: Rascunho (reunião de 15/11/2026) · Onde: ainda não está em docs/planos · Atualizado: 16/11/2026 · Base: 61dc3a5a

## Objetivo
O Saraiva só começa a usar o app (ele e uns 5 alunos) quando o Gustavo avisar que a dieta está arrumada; prometido até
terça, 17/11 (prioridade 1, só o que é pequeno). Ao fim: a caloria do alimento sai dos macros (P×4 + C×4 + G×9), a
refeição sem nome vira "Refeição N", o modelo não pede "Data de início", a lista de alimentos passa dos 80 primeiros, e
a caloria do item e o botão "Adicionar refeição" colado na borda ficam reproduzidos e consertados.
**Prazo, com franqueza:** até 17/11 cabem os passos 1 a 8; o 9 ("Trocar alimento") só se sobrar tempo; os passos 10 a 12
(subtotal e "Total do dia" maior, cor, sugestão de profissional) vêm depois, e o Saraiva deve ser avisado. Dia da semana
(C64/C65) é outro plano.

## Itens da reunião cobertos
| ID | Pedido | Situação hoje | Tipo de mudança | Passo |
| --- | --- | --- | --- | --- |
| R1115-C48 | Caloria do alimento sai dos macros; tirar o campo de kcal digitado | Falta | contrato (regra no servidor, DTO sem mudar de forma), sem migration | 3, 4 |
| R1115-C49 | Caloria do item na ficha da dieta não aparece ou não bate | Testar de novo | comportamento; só se reproduzir | 1, 2 |
| R1115-C50 | Opção "Sem valor" para fator de correção e de cocção | Parcial | texto (rótulo) | 7 |
| R1115-C55 | Busca de alimento com "mostrar mais" além dos 80 resultados | Parcial | comportamento (cliente) | 8 |
| R1115-C56 | Trocar o alimento de um item sem apagar e adicionar de novo | Falta | comportamento/apresentação | 9 |
| R1115-C57 | Nome vazio da refeição vira "Refeição N" | Parcial (a tela mostra "Refeição N", mas publicar falha com "Refeição sem nome") | comportamento | 6 |
| R1115-C58 | "Profissional" do modelo com sugestão dos nomes da equipe | Falta | apresentação (opcional) | 12 |
| R1115-C59 | Tirar "Data de início" do modelo de dieta | Falta | apresentação (esconder) | 5 |
| R1115-C60 | "Total do dia" com números grandes | Parcial | apresentação | 10 |
| R1115-C61 | "Adicionar refeição" no limite da tela, página não desce | Testar de novo | apresentação; só se reproduzir | 1, 2 |
| R1115-C63 | Dieta com as "corzinhas" do treino | Parcial | apresentação | 11 |
| R1115-C66 | Subtotal de kcal e macros no cabeçalho da refeição | Parcial | apresentação | 10 |
| R1115-C68 | "Não somar ao vivo" (PC fraco) | Respondido (o código já soma ao vivo e fica) | registro, sem código | 13 |
| R1115-C95 | Cartões de alimento escuros: mais contraste e letra maior | Para decidir | apresentação (mínimo) | 11 |

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Ordem de trabalho | 1) reproduzir C49 e C61; 2) C48; 3) lote pequeno (C59, C57, C50, C55); 4) C56; 5) C66+C60; 6) C63+C95; 7) C58 por último | recomendação da análise de 16/11 (o Gustavo confirma) |
| D2 | Reprodução antes do conserto | C49 e C61 só viram conserto se reproduzirem, local, com Playwright, a 1280 e a 390 px, num modelo de dieta novo | recomendação da análise de 16/11 (o Gustavo confirma) |
| D3 | C59 | esconder "Data de início" no modelo de dieta; o campo continua no contrato (dieta do aluno, PDF e tela do aluno usam) | reunião 15/11 |
| D4 | C57 | gravar "Refeição N" quando o nome fica vazio (o Saraiva aceitou na reunião) | reunião 15/11 |
| D5 | C50 | rótulo "Sem valor (1,00)" nos fatores (texto final a confirmar com o Saraiva, decisão 4); zero literal não existe (FC mínimo 1, FCc mínimo 0,1, FCc é divisor da lista de compras) | regra do projeto (`app/src/dominio/fatoresDoAlimento.ts:35-52`, `listaDeCompras.ts:84-97`) |
| D6 | C55 | "mostrar mais" como um padrão só nos quatro lugares do corte `slice(0, 80)` | recomendação da análise de 16/11 (o Gustavo confirma) |
| D7 | C56 | "Trocar alimento" no item, reaproveitando a folha de alimentos e mantendo posição e quantidade | recomendação da análise de 16/11 (o Gustavo confirma) |
| D8 | C66 + C60 | subtotal com kcal e macros no cabeçalho também com a refeição aberta; "Total do dia" com números maiores | recomendação da análise de 16/11 (o Gustavo confirma) |
| D9 | C68 | a soma ao vivo já existe (`TotalDoDia.tsx:25`, `CartaoRefeicao.tsx:44,246`) e fica; hipótese, não confirmada: a fala da reunião era sobre o concorrente | recomendação da análise de 16/11 (o Gustavo confirma) |
| D10 | C63 + C95, mínimo | barra lateral na cor da refeição no cartão do editor (como o aluno já vê) e um passo a mais na letra do nome; sem token novo | recomendação da análise de 16/11 (o Gustavo confirma) |
| D11 | Dose de cor | cor é sinal; a cor da refeição só na barra lateral de 6 px, horário e quantidade neutros; marca só na lista fechada | regra do projeto (`docs/planos/visual-vendavel.md:53-65`, `docs/design-e-front.md:269-280`) |
| D12 | Sem camada de compatibilidade | nada de flag nem leitura de formato velho; o produto não tem cliente em uso | regra do projeto (`AGENTS.md:52-54`) |
| D13 | C58 | passo opcional, no fim (ainda sem aceite do Saraiva) | recomendação da análise de 16/11 (o Gustavo confirma) |

## Decisões que faltam antes de começar
1. **C48, derivar a caloria no servidor? (Gustavo; trava os passos 3 e 4.)** Recomendado: sim, só ao criar ou editar
   alimento da consultoria, sem recalcular em massa, porque é o que o Saraiva pediu e a planilha dele já faz ("o certo
   seria 124, o 128 é aproximado").
   - Regra: catálogo que só tem kcal (sem macros) mantém o kcal da fonte; o campo sai do formulário e vira leitura;
     `AlimentoResponse.kcal` continua.
   - Risco, com evidência (calculado por mim sobre `V002__catalogo_taco.sql`, 591 itens, sem rodar o app): o kcal
     derivado difere do da fonte em mais de 2% em 455 itens, mais de 5% em 239 e mais de 10% em 166; média 6,9%, mediana
     3,8%; em 165 dos 166 maiores desvios o derivado é **maior** (hipótese, não confirmada: o TACO usa fatores próprios
     para fibra; confirmaria a nota metodológica do TACO). Extremos: fermento em pó 89,7 → 178,2; "Pão, glúten, forma"
     252,99 → 248,8. **Editar** um alimento do TACO e salvar muda o kcal dele; o não editado e as dietas já montadas
     (guardam o valor gravado) não mudam.
   - Perfil de cocção: só 8 dos 591 itens trocam de lado nos cortes de 250/300 kcal (`FatoresDeRendimento.java:131-152`),
     nenhum com nome de arroz, massa ou leguminosa (únicos perfis que usam o corte), e `completar` só preenche fator
     nulo (hipótese, não confirmada: o teste do passo 3 confirmaria). Os 244 itens do Batel (`V030`) só têm kcal e ficam.
   - A folha de alimento (`AbaAlimentos.tsx:245`) é só de alimento; o suplemento tem a sua (`AbaSuplementos.tsx:118`) e
     mantém o campo de kcal.
2. **C48, item manual da dieta (Gustavo; não trava nenhum passo).** Recomendado: manter o kcal digitado no item manual
   neste lote (`ValidadorDieta.java:151` exige kcal do manual; rótulo de embalagem raramente bate com 4/4/9). Alternativa:
   derivar também, mudando só o app e o validador, depois.
3. **C48, importação por planilha (Gustavo; não trava nenhum passo).** Recomendado: a importação (`alimentos.csv/.xlsx`,
   `ImportacaoService.java:67,75`) continua gravando o kcal informado, porque é a fonte do Saraiva; só tela e API derivam.
4. **C50, "Sem valor" é o mesmo que "sem perda"? (Saraiva; para o passo 7.)** Recomendado: sim, é só o rótulo do perfil de
   1,00. Os dois perfis de 1,00 (FC "Sem perda" e FCc "Cru / Pronto") passam a "Sem valor (1,00)" por **renomear, não
   acrescentar**: `perfilFcDoValor` pega o primeiro perfil com o valor, então duas entradas de 1,00 se atropelam
   (`fatoresDoAlimento.ts:112,117`). Se "sem valor" tiver de significar "não estimar pelo nome", é contrato (nulo sem
   `completar`) e vira outro passo.
5. **C56, quando o novo alimento tem outra base (Gustavo; para o passo 9).** Recomendado: manter quantidade e unidade; se não
   converter (ex.: "un" sem gramas por unidade), o item mostra "—" e o aviso de item sem valor que já existe
   (`dieta.ts:219,231`) cuida do resto.
6. **C60, ordem dos blocos (Gustavo/Saraiva; para o passo 10).** Recomendado: manter "Total do dia" acima das refeições,
   como está, só com números maiores; os dias da semana ficam para o plano C64.
7. **C63/C95, o que o Saraiva chamou de "corzinhas" e "balão" (Saraiva; para o passo 11, só o que passar do mínimo).**
   Recomendado: perguntar mostrando a barra lateral da refeição; "balão" verde ou azul não cabe (verde é situação) e "mais
   claro que o fundo" no escuro exige subir `superficie2`, que é token de design system.
8. **C58, quem aparece na sugestão (Saraiva/Gustavo; para o passo 12).** Recomendado: nomes da equipe e aceitar também texto
   digitado (a pessoa que prescreve pode ser externa; `EscolhaSuspensa` já tem `digitado`).

## Passos
- [x] 1. Reproduzir C49 e C61 no local, a 1280 e 390 px, num modelo de dieta novo — executor: Gustavo / sessão principal · tamanho: P · mudança: nenhuma (diagnóstico) — commit: sem commit (diagnóstico, 16/11): C49 reproduziu só o aviso na linha; C61 não reproduz a folga, reproduz a rolagem até o item novo; capturas no scratchpad da sessão
  - Ambiente: o repositório local tem arquivos alterados de outro trabalho; usar uma cópia limpa do commit atual da `main` (worktree). Subir como no `AGENTS.md:101` (web em `:8088`, Caddy) e abrir com o Playwright já instalado (`PW_CHROMIUM`, `AGENTS.md:324`), dados fictícios, senha só na linha do comando.
  - C49: criar um alimento "Pão de forma (teste)" (a) com kcal 150 e 100 g de cada macro (o caso da reunião) e (b) sem "gramas por unidade"; usar cada um num modelo com unidade "g" e "un". Conferir o que `LinhaItem` mostra (`CartaoRefeicao.tsx:305`) e o `item.kcal` gravado. Hipóteses, não confirmadas: (1) unidade sem conversão devolve nulo e a tela mostra "—" (`dieta.ts:17-24,29-42`); (2) o número mostrado é o kcal digitado, que não bate com os macros (isso é C48 e o passo 3 resolve).
  - C61: modelo novo vazio e com 1 e 3 refeições; janelas 1280×720 e 390×844; rolar ao fim e medir a distância de "Adicionar refeição" até a borda de baixo e a altura da rolagem (`TelaDoEditor.tsx`, `RolagemComTopo`). Hipótese, não confirmada: falta folga inferior na rolagem ou na coluna da lista (280 px, `EditorDeDieta.tsx:344`). Guardar capturas e anotar o que reproduziu e o que não.
- [x] 2. Consertar só o que o passo 1 reproduziu — executor: sessão principal (C61) / executor (C49) · tamanho: P · mudança: apresentação (C61) / comportamento (C49) — commit: `dc0b0294` (C49) e `76fe0239` (C61)
  - C61: folga inferior no contêiner de rolagem de `TelaDoEditor.tsx`. `BlocoAdicionar` e `TelaDoEditor` também servem treino e mobilidade: conferir os três editores. Sem reprodução, não mexer: registrar em "O que ficou para trás".
  - C49: se for unidade sem conversão, avisar/pedir "gramas por unidade" ao escolher o alimento; se for kcal incoerente, o passo 3 resolve. Reconferir C49 depois do passo 4.
- [x] 3. C48: regra pura e servidor — executor: executor · tamanho: M · mudança: contrato (comportamento da API; sem migration; DTO com a mesma forma; tipos do app sem mudança; sem fila offline; sem PDF; APK não se aplica, sem módulo nativo, ver `docs/build-celular.md`) — commit: `0fa84b91` (junto com o passo 4; `mvn verify` 2493 testes, BUILD SUCCESS em 16/11)
  - Regra pura primeiro: `kcalDosMacros(p, c, g)` em `app/src/dominio/dieta.ts` (ou arquivo vizinho) com teste em `dieta.test.ts`; mesma conta em `BibliotecaService.valores` (`api/.../biblioteca/BibliotecaService.java:361-373`). Macros têm até 2 casas, então a conta é exata em 2 casas.
  - `exigirNutricaoDeAlimento` (`:410-423`) deixa de exigir kcal em alimento; o servidor calcula e ignora o kcal do corpo para `ALIMENTO` (criar e editar). `AlimentoRequest.kcal` **fica** no DTO (`BibliotecaDtos.java:58-78`) porque o suplemento usa (`valoresDeSuplemento`, `:379-400`, mantém o kcal gravado quando não há macros). Catálogo importado (`importarCatalogoAlimentos`, `:341-359`) não muda.
  - Não quebrar: `FatoresDeRendimento.completar` recebe o kcal derivado (`:361-373`); item, total, PDF, aluno e lista de compras seguem lendo `AlimentoResponse.kcal`. Seeds (`SeedDemo`), `DietasPadrao`, V060/V062 e importação por planilha não mudam.
  - Testes de API a ajustar ou escrever: `BibliotecaIntegrationTest`, `SuplementoIntegrationTest`, `GrupoDoAlimentoIntegrationTest`, `FatoresDosAlimentosIntegrationTest`, `DietaIntegrationTest` (kcal enviado que não bate com os macros é ignorado; editar item do catálogo recalcula; suplemento sem macros mantém). `mvn verify` completo: a saída grande vai ao `executor-rapido` para filtrar.
- [x] 4. C48: formulário de alimento — executor: sessão principal · tamanho: P · mudança: apresentação (tipos e importadores não mudam) — commit: `0fa84b91`
  - `app/src/treinador/biblioteca/AbaAlimentos.tsx:257,284,385` (folha só de alimento; o suplemento, `AbaSuplementos.tsx:118`, não muda): o `CampoNumerico` "Kcal" vira valor calculado de leitura ("Kcal (calculada)", mostra "—" até os três macros), sai do estado `kcal` e da pendência "Preencha kcal, proteína…". O kcal que alimenta `estimarFatoresDoAlimento` (`:277`) passa a ser o derivado.
  - Ajustar `app/e2e/biblioteca-alimentos-macros.spec.ts` e `biblioteca-catalogo.spec.ts` (campo Kcal). Conferir a folha em 390 e 1280 px.
- [x] 5. C59: esconder "Data de início" no modelo de dieta — executor: sessão principal · tamanho: P · mudança: apresentação — commit: `6e261b89` (junto com o passo 6)
  - `CamposDaDieta` (`EditorDeDieta.tsx:300-325`) ganha `modelo` (hoje só o `ConfiguracaoDoPlano` o recebe, `:165-171`) e não desenha `CampoData`; o `profissional` fica.
  - Para o modelo não carregar data antiga ao ser aplicado: o normalizador passado a `usePlanoEditor` (`EditorDeDieta.tsx:56`) zera `dataInicio` quando `modelo`. A dieta do aluno mantém o campo; `ConteudoDieta`, `ValidadorDieta`, PDF e aluno não mudam.
  - Teste: e2e do modelo (sem o campo) e da dieta do aluno (com o campo), 390 e 1280.
- [x] 6. C57: gravar "Refeição N" quando o nome fica vazio — executor: executor · tamanho: P · mudança: comportamento (sem contrato) — commit: `6e261b89`
  - Regra pura `comNomesPadrao(conteudo)` em `app/src/dominio/dieta.ts` (N = posição + 1, como `tituloDaRefeicao`, `CartaoRefeicao.tsx:38-40`) com teste. Usar ao sair do campo Nome (`Campo` repassa `onBlur`, `ui/Campo.tsx:73`) e no normalizador do editor, para a publicação não recusar "Refeição sem nome" (`ValidadorDieta.java:50-51`, só em validar/publicar; o rascunho salva: não conferido, o passo 6 confirma).
  - Precedente do mesmo texto: `planilhaCompleta.ts:532` e `InterpretadorPorRegras.java:260`. Aluno e PDF passam a ler o nome gravado.
  - Teste: criar refeição, não digitar nome, validar e publicar sem erro, aluno vendo "Refeição 1". Ajustar `app/e2e/editor-inspetor-sobras.spec.ts:168` se o rótulo mudar.
- [x] 7. C50: rótulo "Sem valor (1,00)" nos fatores — executor: sessão principal · tamanho: P · mudança: texto — commit: `f761ca5c`
  - `PERFIS_FC` e `PERFIS_FCC` (`fatoresDoAlimento.ts:35-52`): trocar o `rotulo` dos dois perfis de 1,00, mantendo `codigo` e `valor`; frase curta de ajuda dizendo que "Sem valor" não corrige nem converte (`AJUDA_FC`, `AJUDA_FCC`, `:12-13`). Não zerar nada.
  - Ajustar `app/e2e/biblioteca-catalogo.spec.ts:231,269,276,371` (hoje procura "Sem perda (1,00)"); conferir os testes de `fatoresDoAlimento`. Texto final depende da decisão 4.
- [x] 8. C55: "mostrar mais" além de 80 resultados — executor: executor · tamanho: P · mudança: comportamento (cliente; `GET /alimentos` já devolve a lista inteira, `BibliotecaService.java:240-250`) — commit: `c41afaa3`
  - Um padrão só (peça pequena reutilizável: contagem que cresce de 80 em 80, texto "Mostrando 80 de N" e botão "Mostrar mais", contagem volta a 80 quando o texto da busca muda; `dominio/catalogo.ts:34` já tem um texto parecido). Usos do corte: `app/src/treinador/dieta/FolhaAlimentos.tsx:35`, `FolhaSuplementos.tsx:44`, `FolhaErgogenicos.tsx:48` (corte por categoria) e `app/src/treinador/treino/FolhaBiblioteca.tsx:101` (também alimenta "marcar os visíveis").
  - Teste: unidade da regra de contagem; e2e com 200 itens fictícios (80 → 160 → 200). Medição: abrir a folha com cerca de 1.200 alimentos fictícios com a CPU do Chromium reduzida (o receio do Gustavo é PC fraco); hipótese, não medida: o filtro no cliente aguenta.
  - **Fim do que cabe até 17/11.**
- [ ] 9. C56: "Trocar alimento" no item — executor: executor-front · tamanho: M · mudança: comportamento/apresentação (sem contrato) — commit/run: —
  - `LinhaItem` (`CartaoRefeicao.tsx:257-319`): botão de ícone com nome acessível "Trocar alimento" ao lado de ↑↓ e da lixeira, só em item da biblioteca (o manual tem campo de nome). Abre `FolhaAlimentos` (nova variante em `FolhaDaDieta`, `FolhasDaDieta.tsx:22`, com o `uid` do item). Ao escolher, substitui `alimentoId` e `nome`, mantém `uid`, posição, quantidade e unidade e recalcula com `recalcularItem` (`dieta.ts:29-42`).
  - Não quebrar: adicionar alimento (continua entrando no fim), `CartaoRefeicao` do modelo de uma refeição, "Desfazer". Teste: `CartaoRefeicao.test.tsx` (as peças vêm de `jest.mock`; incluir o ícone) e e2e novo: trocar o 2º item de 3 e ver a mesma posição e quantidade, em 390 e 1280.
- [ ] 10. C66 + C60: subtotal no cabeçalho e "Total do dia" maior — executor: executor-front · tamanho: M · mudança: apresentação (sem contrato) — commit/run: —
  - `CartaoRefeicao.tsx:107`: o resumo só aparece com a refeição fechada (`p.aberta ? undefined : …`) e só traz kcal (`:43-47`); mostrar kcal e P/C/G (`ValoresDaDieta`, `ui/ValoresDaDieta.tsx`) também aberta. `CabecalhoDoItem` é de seis telas (`dieta`, `mobilidade`, `EditorModelo`, `questionarios`): não mudar o que é de texto (`resumo: string`), só acrescentar o que a dieta precisa. `resumoDaRefeicao` também alimenta a lista do inspetor (280 px, `EditorDeDieta.tsx:234`): lá fica curto.
  - `TotalDoDia.tsx`: números maiores com as variantes de `Texto` que já existem (sem token nem tipografia nova); a ordem dos blocos segue a decisão 6. Aluno e PDF têm cartão próprio e não mudam.
- [ ] 11. C63 + C95: cor mínima na dieta do editor — executor: executor-front · tamanho: M · mudança: apresentação (sem token novo) — commit/run: —
  - Barra lateral de 6 px na cor da refeição no cartão do editor: `useTema().identificacao[corDaRefeicao(indice)]` (`corDaSerie.ts:57`, hoje só o aluno chama, `DietaDoAluno.tsx:198-206`); a lista do inspetor fica neutra (Dose de cor, `visual-vendavel.md:60`, vale mais que o S7). Um passo na letra do nome do alimento (`estilos.nomeItem`, `CartaoRefeicao.tsx:253`).
  - Cuidado: a paleta de refeição e a dos macros são a mesma (ciano, azul, violeta): a barra da 1ª refeição é ciano como a marca de proteína. O aluno já convive com isso; conferir se no editor confunde. Sem "balão", sem trocar `superficie2`.
  - Verificar 390 e 1280 px nos temas claro, Areia e escuro, com contraste dos tokens existentes.
- [ ] 12. C58 (opcional): sugestão dos nomes da equipe em "Profissional" — executor: sessão principal · tamanho: P · mudança: apresentação (sem contrato; PDF não muda) — commit/run: —
  - `CamposDaDieta` (`EditorDeDieta.tsx:318-320`): trocar o `Campo` por `EscolhaSuspensa` com `digitado` (já usada para o grupo do alimento), fonte `responsaveisEquipe` (`app/src/api/rotas.ts:198`, `GET /responsaveis` pede `ALUNO_LER` ou `INSCRICAO_LER`, `EquipeController.java:35`). Sem a permissão, cair no texto livre (`.catch(() => [])`, como `treinador/alunos/index.tsx:72`). Guardar só o texto (máx. 120).
- [ ] 13. Fechar: registro e documentação — executor: executor-rapido (sessão principal revisa) · tamanho: P · mudança: documentação — commit: parcial (AGENTS.md atualizado dentro do `0fa84b91`; este plano e o README no commit de docs de 16/11; guia PDF não conferido)
  - Atualizar `AGENTS.md` (alimento com kcal derivado; modelo sem data de início), `docs/planos/README.md` e este plano com commit/run reais, "Pendências soltas" com o que sobrou (origem e próximo responsável) e C68 registrado como "a soma ao vivo fica". Ver se algum guia PDF cita o campo kcal ou a data de início e regenerar pelo gerador (nunca editar o PDF).

## Critérios de aceite
- [ ] C48: cadastrar alimento com 100 g de proteína, 0 de carbo e 0 de gordura mostra 400 kcal; não há campo para digitar kcal; editar um alimento importado do TACO grava o kcal derivado; alimento de catálogo só com kcal continua com o da fonte; suplemento sem macros mantém o kcal.
- [ ] Um item na dieta mostra a kcal que bate com os macros do alimento; dietas já montadas não mudam de valor.
- [ ] C49 e C61: reproduzidos ou registrados como "não reproduz"; o que reproduziu está consertado e reconferido; "Adicionar refeição" fica com folga visível abaixo e a página rola até o fim (também treino e mobilidade).
- [ ] C57: refeição sem nome é gravada como "Refeição N", publica sem o erro "Refeição sem nome" e o aluno vê o mesmo nome.
- [ ] C59: modelo de dieta sem "Data de início"; dieta do aluno com o campo; modelo aplicado não leva data antiga.
- [ ] C50: os dois perfis de 1,00 dizem "Sem valor (1,00)"; a lista de compras segue igual.
- [ ] C55: nas quatro listas há "Mostrando N de M" e "Mostrar mais"; a lista com ~1.200 alimentos abre e filtra sem travar.
- [ ] (Passos 9 a 12, quando feitos) trocar alimento mantém posição e quantidade; subtotal com kcal e P/C/G visível também com a refeição aberta; barra de cor no cartão da refeição; sugestão de profissional.
- [ ] Tudo conferido a 390 px e a 1280 px, na web, nos temas claro, Areia e escuro (`docs/design-e-front.md:357`). APK: não se aplica a este lote (telas do treinador, só TSX e API, sem módulo nativo; o aluno não muda); conferir a 390 px na web. Se sai por OTA ou exige build, conferir `docs/build-celular.md` antes de avisar o Saraiva.
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, os e2e das telas mexidas e `mvn verify` (passo 3) verdes; saída grande filtrada pelo `executor-rapido`.
- [ ] O Saraiva consegue dizer "resolvido" quando: cadastra um alimento só com macros e vê a caloria sozinha; monta uma dieta sem nomear refeição e ela fica "Refeição 1, 2…"; abre um modelo sem "Data de início"; e acha qualquer alimento da biblioteca na lista.

## Riscos e revisão
- Dado: editar alimento do catálogo muda o kcal dele (decisão 1, com números); as dietas antigas não mudam porque guardam o valor gravado (`dieta.ts:5-8`). Banco do Saraiva pode ser resetado, sem migration.
- Teste: ~5 testes de API e ~14 specs citam kcal; a regra de "ignorar o kcal do corpo" esconde erros de quem ainda manda o número (importadores, seeds).
- Compartilhados: `BlocoAdicionar`/`TelaDoEditor` (treino e mobilidade), `CabecalhoDoItem` (seis telas), `CamposDaDieta`, `PERFIS_FC/FCC` (formulário, lista de compras, importação).
- Revisão: o passo 3 muda regra de dado e contrato de API: pede revisão independente do diff (revisor ou advisor), não o trio. Passos 4 a 8: revisão do diff pela sessão principal. Passos 9 a 11: revisão visual com capturas.

## Fora do escopo
- C64/C65 (dieta por dia da semana, duplicar variação): plano próprio `dieta-por-dia-da-semana.md`; muda o modelo da dieta (tamanho G).
- C62 (arrastar alimentos): o treino também só tem ↑↓ (`CartaoExercicio.tsx:196-197`); arrastar é componente novo (M a G).
- C69 (anel de refeições feitas): funcionalidade nova (aluno marca refeição; M a G).
- C94 (cor dos botões "Adicionar refeição" e "Modelos prontos"): vai no plano de Areia e cor; laranja e vermelho não cabem na regra de cor (`docs/design-e-front.md:243,269-280`).
- Trocar `superficie2` ou outro token do tema escuro: é design system, só com decisão.
- Kcal derivado no item manual e na importação por planilha (decisões 2 e 3).

## O que ficou para trás
—

## Linha sugerida para docs/planos/README.md
| Dieta pronta para o Saraiva começar (kcal pelos macros, "Refeição N", modelo sem data de início, "mostrar mais", trocar alimento; C48, C49, C50, C55 a C61, C63, C66, C68, C95 da reunião de 15/11) | [dieta-pronta-para-comecar.md](dieta-pronta-para-comecar.md) | `main` | Planejando: prazo prometido ao Saraiva, 17/11/2026 | 16/11/2026 |

## Mensagem pronta para a IA que vai implementar
```
Frente "Dieta pronta para o Saraiva começar a usar" (reunião de 15/11/2026), repositório consultoria-app. Leia primeiro
AGENTS.md, docs/design-e-front.md (cor e componentes) e docs/planos/dieta-pronta-para-comecar.md (copie do rascunho para
docs/planos/ e acrescente a linha ao README antes do primeiro commit). Responda em português. Sem camada de compatibilidade
(AGENTS.md:52). Não faça commit nem push sem o Gustavo pedir. Subagentes não fazem commit/push.

Objetivo: o Saraiva só começa a usar o app (ele e ~5 alunos) quando a dieta estiver arrumada; prazo prometido: terça 17/11.
Prioridade 1, só o que é pequeno. Fora: variação por dia da semana (C64/C65), arrastar (C62), anel (C69), cor dos botões (C94).

RECOMENDAÇÕES DA ANÁLISE DE 16/11 (o Gustavo confirma antes de executar; só estão fechados os pontos que a reunião de 15/11, uma regra do projeto ou o código já fixam): ordem 1) reproduzir C49 e C61 antes de mexer; 2) C48; 3) lote pequeno; 4) C56;
5) C66+C60; 6) C63+C95; 7) C58 por último. C59 esconde "Data de início" no modelo (o campo fica no contrato); C57 grava
"Refeição N" quando o nome fica vazio; C50 rótulo "Sem valor (1,00)", texto final a confirmar com o Saraiva (renomear os dois perfis de 1,00, não acrescentar;
zero literal não existe); C55 "mostrar mais" como um padrão só; C56 "Trocar alimento" mantendo posição e quantidade; C68: a
soma ao vivo já existe e fica; cor: só barra lateral de 6 px da cor da refeição, sem token novo, sem "balão" (Dose de cor,
docs/planos/visual-vendavel.md:53-65).
C48 (recomendação, confirmar com o Gustavo antes do passo 3): o servidor calcula kcal = P×4 + C×4 + G×9 ao criar/editar
alimento da consultoria; o campo sai do formulário e vira leitura; AlimentoResponse.kcal continua; AlimentoRequest.kcal
fica no DTO (o suplemento usa); catálogo só com kcal e suplemento sem macros mantêm o kcal; não recalcular em massa;
item manual da dieta e importação por planilha continuam como estão. Risco: editar item do TACO muda o kcal (derivado
costuma ser maior: 165 dos 166 desvios acima de 10%).

SESSÃO 1 (até 17/11), passos 1 a 8, nesta ordem:
1. Reproduzir C49 e C61 (sessão principal/Gustavo): cópia limpa do commit atual da main (a cópia local tem alterações de
   outro trabalho), web local em :8088, Playwright com PW_CHROMIUM, dados fictícios, 1280 e 390 px, modelo de dieta novo.
   C49: alimento com 150 kcal e 100 g de cada macro, e outro sem "gramas por unidade", unidades g e un; ver LinhaItem
   (CartaoRefeicao.tsx:305) e item.kcal. C61: modelo vazio e com 1 e 3 refeições, 1280×720 e 390×844, medir a folga de
   "Adicionar refeição" (EditorDeDieta.tsx:122-125) e a rolagem (TelaDoEditor). Só vira conserto o que reproduzir.
2. (sessão principal; executor se for lógica do C49) Consertar o que reproduziu: C61 = folga inferior em TelaDoEditor (conferir treino e mobilidade); C49 = unidade sem
   conversão avisa/pede gramas por unidade (dieta.ts:17-24,29-42). Reconferir C49 depois do passo 4.
3. C48 servidor (executor): kcalDosMacros em app/src/dominio/dieta.ts com teste + BibliotecaService.valores (:361-373);
   exigirNutricaoDeAlimento (:410-423) deixa de exigir kcal; ignora kcal do corpo para ALIMENTO. Testes de API:
   BibliotecaIntegrationTest, SuplementoIntegrationTest, GrupoDoAlimentoIntegrationTest, FatoresDosAlimentosIntegrationTest,
   DietaIntegrationTest. Sem migration. mvn verify; a saída grande vai ao executor-rapido filtrar (falha, arquivo:linha).
4. (sessão principal) C48 formulário (AbaAlimentos.tsx:257,284,385; só alimento, suplemento não muda): Kcal vira cálculo de leitura; o kcal de estimarFatoresDoAlimento (:277)
   é o derivado; ajustar e2e biblioteca-alimentos-macros e biblioteca-catalogo.
5. (sessão principal) C59: CamposDaDieta (EditorDeDieta.tsx:300-325) recebe `modelo` e esconde CampoData; o normalizador do usePlanoEditor
   (EditorDeDieta.tsx:56) zera dataInicio no modelo; dieta do aluno mantém o campo.
6. (executor) C57: comNomesPadrao em dominio/dieta.ts (N = posição+1) com teste; usar ao sair do campo Nome e no normalizador; a
   publicação não pode mais dar "Refeição sem nome"; conferir e2e editor-inspetor-sobras.spec.ts:168.
7. (sessão principal) C50: trocar o rótulo dos dois perfis de 1,00 em fatoresDoAlimento.ts:35-52 (códigos e valores intactos) e a ajuda;
   ajustar biblioteca-catalogo.spec.ts:231,269,276,371. Texto final: confirmar com o Saraiva.
8. (executor) C55: uma peça de "Mostrando N de M / Mostrar mais" (80 em 80, volta a 80 quando a busca muda) nos quatro cortes:
   FolhaAlimentos.tsx:35, FolhaSuplementos.tsx:44, FolhaErgogenicos.tsx:48, treino/FolhaBiblioteca.tsx:101. Medir com ~1.200
   alimentos fictícios e CPU reduzida.
Corte: pare aqui, rode as verificações e entregue o relatório (✅/❌, lacunas, arquivos de docs/planos atualizados).

SESSÃO 2 (só se pedirem): passo 9, C56, executor-front: botão "Trocar alimento" em LinhaItem (CartaoRefeicao.tsx:257-319),
nova variante de folha em FolhasDaDieta.tsx:22 reaproveitando FolhaAlimentos; mantém uid, posição, quantidade e unidade;
recalcularItem (dieta.ts:29-42); CartaoRefeicao.test.tsx e e2e novo.
SESSÃO 3 (depois de 17/11): passos 10 (C66+C60: subtotal com kcal e P/C/G no cabeçalho aberto, CartaoRefeicao.tsx:107, e
"Total do dia" maior em TotalDoDia.tsx com variantes de Texto existentes), 11 (C63+C95: barra de 6 px da cor da
refeição via identificacao[corDaRefeicao(i)], letra do nome um passo maior, sem token novo) e 12 opcional (C58:
EscolhaSuspensa com `digitado` e responsaveisEquipe, caindo no texto livre sem permissão), todos com executor-front
(exceto o 12); depois o passo 13 (AGENTS.md, README de planos, plano, C68 registrado).

Não quebrar: AlimentoResponse.kcal; item/total/PDF/aluno/lista de compras; suplemento sem macros; CabecalhoDoItem,
BlocoAdicionar e TelaDoEditor (treino, mobilidade, questionários); PERFIS_FC/FCC (formulário, lista de compras, importação).
Verificar: npm run typecheck, npm run lint, npm test, e2e das telas mexidas, mvn verify (passo 3). Conferir a 390 e 1280 px,
na web, nos temas claro, Areia e escuro (docs/design-e-front.md:357). Passo 3 pede revisão independente do diff.
Aceite: ver "Critérios de aceite" do plano; o Saraiva diz "resolvido" quando a caloria sai sozinha dos macros, a refeição
sem nome vira "Refeição N", o modelo não pede data de início e qualquer alimento aparece na lista.
```

## Entrega de 16/11/2026 (sem push; base HEAD `76fe0239` + C48)
- Feitos: passos 1 a 8 (commits nos próprios passos). Não feitos: passos 9 a 12 (C56 trocar alimento, C66+C60 subtotal e Total do dia, C63+C95 cor, C58 sugestão de profissional): vão para "Pendências soltas" do README e a mensagem ao Saraiva está no relatório.
- C68: "a soma ao vivo fica" (já existe em `TotalDoDia.tsx` e `CartaoRefeicao.tsx`); nenhum código.
- C49: consertado só o aviso na linha ("Informe gramas por unidade no alimento"); converter a quantidade ao trocar a unidade (g para un) ficou como pergunta ao Gustavo.
- C61: a hipótese de falta de folga não reproduziu; consertada a rolagem até o item novo, **testada só na web**; o `rolarAte` no nativo fica para o próximo APK (responsável: Gustavo).
- C48 menor: ao apagar um macro de alimento só com caloria (Batel Grill) o rótulo "Kcal (da fonte)" não foi conferido em todos os estados.
- Verificações: C48 `mvn verify` 2493 testes verdes; passos de app com typecheck, lint, test e e2e das telas mexidas (390 e 1280) rodados pelos agentes e repetidos antes de cada commit.
