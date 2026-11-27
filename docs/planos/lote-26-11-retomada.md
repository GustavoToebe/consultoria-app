# Lote de 26/11 (três frentes): registro retomável

Estado em **26/11/2026, ~17h**. Branch `lote-tres-frentes-26-11`, worktree `C:\Users\gusta\Documents\consultoria-app-lote-26-11`, base `main` 2e2e8852.
**Nada commitado neste worktree.** A pasta principal `consultoria-app` tem ~70 arquivos de outra frente (acesso pausado,
configurações, conta do aluno): não commitar, não usar stash, não descartar. Validade: vale enquanto a base e os arquivos
abaixo não mudarem; antes de reutilizar, conferir `git status` e `git log`.

Planos de origem: [aluno-web-layout.md](aluno-web-layout.md), [atualizacao-pasta-e-questionarios.md](atualizacao-pasta-e-questionarios.md),
[documentos-pdf-motor.md](documentos-pdf-motor.md) (Nova direção), [orientacoes-de-design-26-11.md](orientacoes-de-design-26-11.md).
Aprovação de textos e perguntas: [lote-26-11-textos-e-perguntas.md](lote-26-11-textos-e-perguntas.md).

## Decisões do Gustavo (26/11), valem como especificação
- Níveis de validação: rodada focal da API é `mvn -Dtest='A,B' test` (nunca `verify`); `mvn verify` completo continua obrigatório no lote final integrado que altera a API. Já commitado nas pastas `consultoria-app-docs-validacao` (ab2091af) e `central-docs-validacao` (bd99c8e), branch `docs-niveis-validacao`, sem push.
- Teto do aluno: 1312 centralizado, título na borda esquerda do contêiner, em todas as telas (Conta 984 e Comunidade 1092 começam nessa borda). Início pode subir para 1688 depois (não implementado).
- Histórico: abas Treinos | Corpo | Atualizações com `?aba=`. Dieta: refeições sempre numa coluna. Exercício: Próximo secundário.
- Bloco E: aviso ao aluno também na publicação sem data, caixa "Avisar o aluno" marcada por padrão; `aviso_plano_liberado` entra na exportação LGPD e é apagado na anonimização; o vigente sai de "terminando" se o sucessor agendado for liberado até o dia seguinte ao fim do vigente (senão continua listado); NÃO criar "Cancelar agendamento" (pendência).
- Bloco A: tratar teclado cobrindo o campo e toque no rótulo focando o campo. Bloco F: "Ordem sugerida" sai da folha e vai para o ⓘ.
- PDF: token da mesa da prévia (cinza neutro igual em todos os temas, exceção na 4.10); limitação aceita "Personalize numa tela maior" abaixo da área mínima; corrigir os 4 defeitos de contraste inclusive no Clássico (4,5:1, D7) e testar `#FFEB3B` em todos os modelos.
- `ListaDeDados` ganha prop de arranjo e a leitura do B volta a usá-la; Selo: usar o neutro existente, sem variante nova.
- Commits: um por frente (aluno web; atualização/pasta/questionários; PDF) na branch `lote-tres-frentes-26-11`, `git add` por caminho, CRLF normalizado para LF, só depois de typecheck, lint, jest e e2e (regra do AGENTS.md) passarem; sem push. O Gustavo leva para a `main` com `git merge --ff-only`; se a `main` tiver andado, perguntar antes de qualquer rebase.

## Estado por frente
**Aluno web (`aluno-web-layout.md`)**: Início, Dieta, Histórico, Treino, Exercício, Comunidade/Conta com relatórios entregues ou em segunda rodada (Exercício: usar props novas do `PrincipalComApoio`; Comunidade: colunas Colegas/Vídeos e borda comum; Treino: Mobilidade para a coluna principal; Histórico: abas; Dieta: coluna única). `ui/PrincipalComApoio`, `dominio/arranjoPrincipalComApoio.ts` e `telaLargaDoAluno.ts` são minhas. Pendente minha: alinhar o padrão do apoio ao teto (880 + 32 + 400): `larguraDoApoioPorArea` dá 360 dentro de 1312, deixando a principal em 920; usar 400 a partir de área de 1312.
**Atualização/pasta/questionários**: A feito (Tela, Folha, RolagemComTopo, Campo). B feito (leitura única; `FormularioAtualizacao` corrigido com a prop `travado`). C-API: tipo `ITENS_DO_PLANO` com validação e testes; falta o patch de config da pergunta (autorizado ao agente) e corrigir `escolherDaPasta` (`liberarEm` nulo). E (API): V106 (era V105 antes do merge) e rotas prontos; segunda rodada (LGPD, painel "terminando", aviso sem data). E-app (treinador): em andamento. D (revisão do treinador): em andamento. Faltam C-app (espelho de `ITENS_DO_PLANO` no app), C2 (script `atualizacao-saraiva.mjs`, simulação por padrão, mostrar a lista ao Gustavo), F (folha da pasta, depois do E-app) e G (editor de questionários, depois do C-app).
**PDF (`documentos-pdf-motor.md`)**: N1 pronto no motor e nas opções (V107, era V106 antes do merge; API, `cssDasOpcoes`, geradores, prévia, galeria, editor `/treinador/documentos/personalizar`); correção dos 4 defeitos de contraste em andamento; token da mesa da prévia em andamento. N2 a N4 não começaram.

## O que falta para commitar (ordem fixa, uma verificação pesada por vez)
1. Esperar os relatórios restantes e integrar (colagens minhas: constantes na 4.10 e em `tema/tokens.ts`, nota de migrations 103 para 105 no AGENTS.md, índice e pendências em `docs/planos/README.md`).
2. Baseline: rodar `aluno-clareza`, `treino-do-aluno-lacunas` e `concluir-treino` sobre a `main` SEM o lote (worktree temporário a partir de 2e2e8852) antes de atribuir qualquer falha desses specs a outro agente.
3. Atualizar `tela-larga-app-do-aluno.spec.ts` para o teto de 1312 (13 falhas conhecidas por assertivas de 1688 e grades antigas).
4. typecheck, lint, jest completos; e2e completa (regra do AGENTS.md: contrato de API, peça compartilhada e lote grande); depois `mvn verify` SOZINHO, sem e2e em paralelo; reexecutar `InscricoesIntegrationTest` (OOM antes).
5. Revisão independente (E, PDF, segurança); normalizar CRLF; commits por frente; relatório.

## Pendências registradas
- "Cancelar agendamento" separado (E): não criado por decisão; publicar de novo ou "Alterar data" cobrem. Próximo responsável: Gustavo.
- Editor do PDF abaixo da área mínima: "Personalize numa tela maior" (limitação aceita; não mexer no layout do treinador).
- Início a 1688 depois, se ficar vazio no monitor grande.
- Teclado: a recomendação foi conferida na documentação oficial (WebFetch) e NÃO foi conferida no aparelho. A doc do Expo recomenda `react-native-keyboard-controller` (`KeyboardAwareScrollView`) para formulários longos; `KeyboardAvoidingView` com `behavior="padding"` é a opção de protótipo; no Android com edge-to-edge a janela não redimensiona (não combinar `softwareKeyboardLayoutMode: pan` com `padding`); nenhuma página oficial cobre react-native-web. O changelog do SDK 57 não foi lido. Ajustar o KAV de `TelaDoEditor.tsx:77` conforme isso.
- Comandos focais da documentação (`mvn -Dtest='A,B' test`, `npm test -- --include`): verificação em andamento; registrar o resultado.
- Chromium: o caminho `chromium-1248` das instruções do e2e não existe nesta máquina; usar `chromium-1243`. Registrar nas instruções do e2e.
- Não conferidos nas telas do aluno e do PDF: tema Areia, app nativo, tablet e larguras 1536, 2560 e 3440 em parte das telas.
- `ItensDoPlanoService` deve usar a versão liberada (`versaoLiberadaDaPasta`), não a última publicada (autorizado ao agente do C-API).

## Specs e2e que o lote quebra e precisam de atualização (relatórios dos agentes, 26/11)
Nenhum foi editado ainda; conferir cada um sobre a `main` sem o lote antes de atribuir (ver "O que falta para commitar").
- Histórico em abas (agora com `push`; abrir `/aluno/historico?aba=corpo` ou `?aba=atualizacoes` a partir de 768): `peso-historico-aluno` (7 casos em 1280), `cor-da-variacao-do-peso` (1280, CLARO/ESCURO/AREIA), `cores-historico-dieta` (1280), `avaliacao-fisica` (6 casos do aluno), `comparacao-de-fotos` (1280 e 3440), `aluno-clareza` A11/B6, `tela-larga-app-do-aluno` ("2560: Histórico em duas colunas").
- Dieta em uma coluna com apoio: `aluno-dieta-complementos` (1920, cartões empilhados no apoio), `tela-larga-app-do-aluno` (linhas 133, 146, 369), `aluno-clareza` A10/A12/:88 (cabeçalho "12:00 · Almoço" na web larga; o :88 passa por engano antes da medida).
- `tela-larga-app-do-aluno`: ainda esperam teto 1688 e grades antigas.

## Decisões a registrar (vindas dos relatórios)
- Histórico: abas com `?aba=` e `router.push` (regra do AGENTS.md; o agente tinha usado `setParams` por engano e foi mandado corrigir).
- Dieta: cabeçalho "12:00 · Almoço" na web larga desfaz a A12 só nesse arranjo (celular e prévia mantêm); reversível num ternário em `CartaoRefeicaoAluno`.
- Nativo: a orientação 0.2 manda empilhar sempre, mas `PrincipalComApoio` decide pela área (tablet paisagem ≥ 952 abre lado a lado, sem fixar ao rolar). Pendente.
- Apoio da peça: agora 360 abaixo de 1312 e 400 a partir de 1312 (`larguraDoApoioPorArea`); a regra local da dieta saiu.
- P5: miniatura da galeria usa `superficie2`; avaliar `MESA_DA_PREVIA` (`#7A7F87`).
- Histórico: gráficos de Peso/Avaliação (280 a 320) e Fotos (grade 200 px 3:4) ficam dentro de cartões compartilhados, não editados; "Ainda não enviados" sem e2e.
- `ui/Abas`: painel sem `role="tabpanel"`/`aria-controls` (lacuna compartilhada).
- Treino (relatório da rodada 2): `tela-larga-app-do-aluno` :88, :97, :112, :125; `treino-do-aluno-lacunas:139` (orientações agora nascem abertas da faixa normal, orientação 1.2; conferir sobre a main antes de atribuir); `concluir-treino` "data futura" passou por corrida (pode ficar instável em 1280). As 3 falhas "lista ≤ 880" (1920/2560/3440) dependem do apoio de 400 da peça (ajustado, ainda sem e2e).
- Trava: a fila do `lock-pesado` atrasou e2e de vários agentes por mais de 1 h; as rodadas finais por frente ainda não rodaram. Servidor antigo na porta 8131 (PID 17852, `dist-antes`) contamina quem a reaproveita.
- B (rodada 2, entregue): `ui/ListaDeDados` ganhou a prop opcional `arranjo` (`dominio/listaDeDados.ts` `arranjoDaLista`; sem a prop, idêntico ao de antes, provado em teste) e a leitura voltou a usá-la. Peça compartilhada alterada: a e2e COMPLETA é obrigatória (regra do AGENTS.md). Rodada de 40 specs do B: 926 testes, 68 falhas, NÃO atribuídas (tela-larga-ficha 24, tela-larga-equipe-ajuda-ajustes 11, tags-de-aluno 16, redes-sociais 7, documentos-pdf 8, cor-da-variacao-do-peso 3, comparacao-de-fotos 2; parte por processo morto por memória, 3221225794); reexecutar isoladas e sobre a main. Jest: 19 falhas só em `paridadeQuestionario` (espelho do ITENS_DO_PLANO, C-app).
- Pendências do B: Sim/Não com `Selo` neutro sai em 12 px suave (mais fraco que a pergunta; decisão do Gustavo); vão pergunta/resposta empilhadas 2 px (a seção 2.1 pede 4); "O que mudou: Não encontrado." no spec do B é do bloco D (rota nova sem simulação).

## Decisões do Gustavo (26/11, noite) e escopo congelado
Escopo congelado: NÃO começam F (folha da pasta), G (editor de questionários), UI de `ITENS_DO_PLANO` (aluno, editor, prévia), aviso "Seu novo plano está disponível" no Início, "Cancelar agendamento" e PDFs N2 a N4. Fechar o que está em andamento, validar, juntar com a main e subir (push só com ordem dele).
- Pergunta 6 (dia mais desgastante): motivo OBRIGATÓRIO (como no script do Saraiva).
- Média de dias de treino: a API não muda; mostrar a média calculada na leitura das respostas (regra em `dominio/` com teste); sem caminho limpo, tirar e registrar pendência.
- Lista do Saraiva (3b) e textos das seções 1 e 2: aprovados pelo Gustavo em 27/11/2026 (motivo do dia desgastante opcional, rótulos aprovados, sem a média na escolha única; ver [lote-26-11-textos-e-perguntas.md](lote-26-11-textos-e-perguntas.md)). Nenhum `--gravar` em produção sem um ok explícito dele.
- Início empilhado (Dieta sob o Hoje, Água sob as pendências): APROVADO.
- "12:00 · Almoço": voltar para a A12 em todo lugar, inclusive web larga; conciliar no merge com a "opção A no aluno e PDF" da main.
- Tablet/nativo: a Dieta sempre empilha por `Platform` dentro de `DietaDoAluno`; não mexer no `PrincipalComApoio`.
- Leitura Sim/Não: resposta não pode ficar mais fraca que a pergunta; vão pergunta/resposta empilhadas 4 px.
- "Avisar o aluno": envio implícito (ausente = true), registrado em comentário no app.
- Cartões compartilhados do Histórico: não mexer; pendência para rodada própria com a lista das telas afetadas. Vídeos 2+2+2+1 em 1280: aceitos.
- Porta 8131 (PID 17852): o Gustavo encerra; depois rodar de novo o e2e do E-app em porta livre e conferir que o servidor serve as fontes atuais.
- Ordem: fechar relatórios (E API, D, P5, E-app, Início, Histórico) → separar falha do lote × falha que já existia na main (`aluno-clareza`, `treino-do-aluno-lacunas`, `concluir-treino` sobre a main sem o lote; reexecutar isoladas as 68 falhas do B) → merge com a main renumerando para V106 e V107 → validar no nível completo (mvn verify, Jest e e2e completos, uma verificação pesada por vez, com tempos) → docs (constantes na 4.10 e em `tema/tokens.ts`, README, chromium-1243).

## Próximo lote (registrado, não feito)
F (folha da pasta, "Ordem sugerida" no ⓘ), G (editor de questionários), UI de `ITENS_DO_PLANO` (campo do aluno, controles do editor, prévia, leitura; o tipo está oculto do menu do editor até lá: `OCULTOS_NO_MENU` em `dominio/editorQuestionario.ts`; sincronizar séries antes do check-in ou tratar o 422 de DIAS_TREINADOS), aviso "Seu novo plano está disponível" no Início, "Cancelar agendamento", PDFs N2 a N4, cartões compartilhados do Histórico (rodada própria), Início a 1688, dívidas pequenas (`FOLGA_DO_BOTAO` duplicada no Exercício, `role="tabpanel"` e `aria-controls` do `ui/Abas`, selo da linha da pasta), `npm ci` no `central-api-front` para o focal da Central, script `atualizacao-saraiva.mjs` pronto mas sem `--gravar` até aprovação.
Acrescentados em 26/11 (noite, respostas do Gustavo): três colunas da revisão da atualização (D) em tela ultralarga (hoje o apoio fica em 440); **mostrar a prescrição da época da resposta** na revisão (hoje o cartão "Prescrição atual" mostra a versão de hoje); colunas da galeria de PDF duplicadas (`dominio/configuracaoPdf.colunasDaGaleria` × `galeria/regras.colunasDaGaleria`, trocar a antiga); "Personalizar este modelo" abrir o editor com a configuração gravada (P6 lê sem `?modelo=`); modo resposta do aluno ainda ligado a `ajudaAutomatica: MEDIA_DIAS_TREINO`; item "Quer trocar" do `ITENS_DO_PLANO` fora do "O que mudou"; cobertura e2e de "Ainda não enviados" no Histórico; `PrincipalComApoio` a 1312 pede apoio de 400 no Histórico (1.7).

## Decisões de 26/11 (noite, segunda rodada)
- Porta 8131: o Gustavo disse ter encerrado, mas o PID 17852 (node) ainda escutava em 127.0.0.1:8131 quando conferi; os agentes usam portas próprias.
- Seção 2 de `lote-26-11-textos-e-perguntas.md`: completar com D, E-app, P5 e Dieta e avisar o Gustavo; ele lê as seções 1 e 2 de uma vez. Lista 3b: ele lê; nenhum `--gravar` sem a ordem dele.
- Miniatura do P5 sem `MESA_DA_PREVIA`: aceito; registrado na 3.1 de `orientacoes-de-design-26-11.md`.
- Revisão (D): cartão "Prescrição atual" (versão de hoje), registrado na 2.2 da orientação; três colunas e prescrição da época ficam para o próximo lote.
- Migrations: V106 (liberação de plano) e V107 (documentos PDF), confirmadas no merge depois do `git fetch`; o Overtraining Pay fica com a V108.

## Estado de entrega (26/11, fim da noite) — branch `lote-tres-frentes-26-11`, local, sem push

- **Contido:** `origin/main` (`fef5f250`, pintura lisa) está na branch (merge `03a128cf`; conflitos em `BarraDescanso`, `ExercicioAluno` e `tokens.test.ts`, resolvidos com a estrutura do lote + as linhas da main). Migrations: V106 liberação de plano e V107 documentos PDF (106 no total; a V078 nunca existiu).
- **Correções das revisões (E e PDF)** em `f15dfb5f` (rotina de liberação de hora em hora, falha isolada por consultoria, `desativarOutros` zera `liberarEm`, ordem estável, painel sem sucessor falso) e `a366c207` (PUT documentos-pdf com `@ExigeFuncionalidade`, editor sem perder mudança durante o salvar, comprovante do contrato neutro). Os arquivos das revisões chegaram vazios ao executor da API: o item 2 da revisão E foi inferido (cenários de plano desativado com agendamento pendente); **pede conferência na revisão da CI**.
- **Validação** (último estado): `mvn clean verify` 3649 testes, 0 falhas, JaCoCo ok (27 min 47 s); jest 479 suítes/13962 testes; typecheck e lint limpos (10 avisos antigos); e2e das áreas afetadas (exercício, Início, atualização, cores por situação, documentos PDF, liberação agendada, ficha, financeiro visão geral, tela larga) verde. O e2e completo (3554 passou, 8 falhas, 326 puladas) valeu para o estado **antes** do merge e das correções.
- **Pendências soltas** novas no README: Publicar tudo × liberação agendada, paridade Java×TS dos modelos de PDF, `@Version` compartilhado Marca/Documentos, prova do PDF no celular e fontes.
