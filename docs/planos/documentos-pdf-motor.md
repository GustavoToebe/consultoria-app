# Documentos (PDF): temas da consultoria e prévia

Situação: Em andamento. Primeira entrega em 16/11/2026 (temas e prévia, sem gravar). Segunda em 21/11/2026 (`59ce839d`, V096): o tema é gravado e **já vale nos PDFs reais**. **Em 26/11/2026 o Gustavo mudou a direção** para modelos prontos + personalização por opções, no estilo da Nuvemshop (seção "Nova direção"): ela substitui a D2 e a D3 e os passos 1.2, 2.1, 2.2 e 3.2 abertos. O N1 entrou no lote de 26/11 (V107, já na `main`); acertos da galeria no commit local `727957c0` (rodada de 28/11, seção "Rodada de 28/11"); N2 a N4 não começaram · Onde: `main` e branch local `rodada-28-11` · Atualizado: 27/11/2026

Origem: Evolução da decisão 6 de [evolucao-prime.md](evolucao-prime.md) ("Temas (2 ou 3) e prévia própria ficam para depois"). O primeiro desenho deste plano (15/11) era um motor próprio de diagramação em milímetros com prévia em SVG; o Gustavo comparou as duas opções no mesmo dia e escolheu os **temas em CSS sobre os geradores HTML que já existem** (D1). O nome do arquivo ficou o do primeiro desenho.

## Objetivo
O administrador da consultoria escolhe o tema dos documentos (`CLASSICO`, `MINIMALISTA`, `MARCANTE`) e a estrutura das seções (mostrar ou ocultar blocos, quebra por sessão, padrão do PDF da dieta) na tela **Documentos (PDF)** (`/treinador/documentos`), vendo uma **prévia com dados de exemplo** que é o mesmo HTML e o mesmo CSS do PDF final. A configuração vai junto com a `Marca` na sessão e no pacote offline: todo PDF baixado pelo treinador ou pelo aluno (Treino, Dieta, Lista de compras, Mobilidade, Relatório de cargas e Avaliação física, na web ou no celular, inclusive sem internet) sai no tema e na estrutura da consultoria.

## Travas desta frente
- **Ordem:** a implementação só começa depois de o lote de 15/11 e o P1.5 ([saida-e-tempo-minimo.md](saida-e-tempo-minimo.md), `V074`) estarem commitados. A migration desta frente pega o próximo número livre **na ordem do push** (o Flyway recusa número menor que um já aplicado); [contato-da-consultoria.md](contato-da-consultoria.md) e [vitrine-e-loja.md](vitrine-e-loja.md) disputam a mesma faixa.
- **Os geradores HTML ficam:** `app/src/pdf/html.ts`, os 6 geradores, `imprimir.ts` e `imprimir.web.ts` continuam sendo a saída. Nada de motor de diagramação, de medir texto nem de SVG por página.
- **Sanitizador e testes de injeção ficam como estão** (`montarCorpo` em `imprimir.web.ts`, `pdf/injecao.test.ts`, `pdf/imprimir.web.dom.test.ts`): só se acrescentam casos para os temas novos. Nenhuma regra é afrouxada, nenhum elemento ou esquema novo entra na lista permitida.
- **Tema é lista fechada:** o CSS de cada tema vem só do código. O treinador nunca escreve CSS, classe, cor livre nem HTML; `temaPdf` é conferido contra a lista nos dois lados e valor desconhecido cai em `CLASSICO`. O único texto livre da configuração é o rodapé, que passa por `esc()`.
- **Prévia sem `iframe` na web, sem `innerHTML` e sem mudar a CSP.** Se alguma coisa exigir mexer na CSP, avisar o Gustavo antes.
- **LGPD:** a prévia desta entrega só usa dados de exemplo fictícios, montados no app, sem consultar o banco. Nada de dado de aluno em log, auditoria ou mensagem de erro.
- **Permissão:** gravar exige `MARCA_ALTERAR` e administrador, como a Marca hoje. Tudo isolado por `consultoria_id`.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Opção de arquitetura | **(b) temas em CSS sobre os geradores HTML atuais**, escolhidos por `temaPdf` em `cssBase`/`cabecalhoDoPdf` (`pdf/html.ts`). O motor próprio (a) foi descartado: reescreveria a pasta `pdf/` inteira (6 geradores, 965 linhas, e quatro arquivos de teste que afirmam sobre HTML) e dependeria de medir texto sem métricas de fonte (o PDF usa a fonte do sistema, que muda por aparelho); no celular o `expo-print` só recebe HTML de qualquer forma | Gustavo, 15/11 |
| D2 | Temas | Três, fechados e testados: `CLASSICO` (o visual de hoje: faixa da marca no alto, cabeçalho de tabela cheio), `MINIMALISTA` (fundo limpo, divisórias finas na cor da marca, cabeçalhos leves) e `MARCANTE` (topo destacado na cor da marca, blocos em cartões de borda suave). Guardado em `consultoria.tema_pdf`, padrão `CLASSICO` | Gustavo (pedido) |
| D3 | Estrutura (`config_pdf`) | Coluna `config_pdf jsonb not null default '{}'` em `consultoria`, só com chaves conhecidas: **Treino** `mostrarSemana`, `mostrarGlossario`, `mostrarInstrucoes`, `quebrarPorSessao`; **Dieta** `modoPadrao` e `mostrarPesos`; `rodapePadrao` opcional. **Simples e Detalhado ficam com o sentido de hoje:** Simples = só a dieta; Detalhado = dieta + lista de compras. **Nada de omitir macros por item.** A configuração define só o **padrão** (para o aluno e para o treinador): a `FolhaPdfDieta` abre com ele marcado e o treinador continua escolhendo a cada download | Gustavo, 15/11 |
| D4 | Como chega ao aluno | `temaPdf` e `configPdf` entram em `MarcaPublica` (API) e em `Marca` (`app/src/api/tipos.ts`): chegam no `POST /auth/login`, no `GET /eu` e no `GET /aluno/painel` (pacote offline). `mesmaMarca` (`dominio/marcaDaSessao.ts`) passa a comparar os dois: mudou no treinador, atualiza no aluno | Primeiro desenho, mantida |
| D5 | Onde grava | No **`PUT /consultoria/marca` que já existe**, sem rota nova: `MARCA_ALTERAR` + `exigirAdministrador`, `versao` obrigatória e 409 `CONFLITO_EDICAO`. A auditoria é a `MARCA_ALTERADA` que o `MarcaService` já grava (resumo fixo). **O que foi feito em 21/11 é diferente (ver "Segunda entrega"):** rota própria `PUT /consultoria/tema-pdf`, sem `versao` (vale a última escrita); o `PUT /consultoria/marca` também aceita `temaPdf` (nulo mantém). Falta decidir se o `config_pdf` vai pela rota própria ou pela da marca | Gustavo, 15/11 |
| D6 | Cabeçalho obrigatório | O `cabecalhoDoPdf` (faixa com logo e nome da consultoria, tipo do documento, título com `(vN)` ou `(RASCUNHO, não publicado)`, Aluno, Período e Emitido em) existe nos três temas e não tem interruptor | Regra de produto |
| D7 | Contraste 4,5:1 | Todo tema usa as funções que já existem: `corDaMarca` (fundo e linha, com texto em `textoSobre`) e `corDeTextoDaMarca` (texto sobre o branco, escurecida até 4,5:1). Marca amarela nunca gera texto ilegível em nenhum tema; teste com `#FFEB3B` nos três | Regra D15 de `evolucao-prime.md` |
| D8 | Áreas clicáveis na prévia | **Fora do escopo.** É um limite da opção (b): a prévia é HTML higienizado (web) e WebView sem JavaScript (celular), então tocar numa seção da folha não destaca nada no painel | Gustavo, 15/11 |
| D9 | Dados da prévia | Só **"Dados de exemplo"** nesta entrega. "Testar com aluno" foi para as Pendências soltas do [README](README.md), com as permissões e o que falta | Gustavo, 15/11 |
| D10 | Como é a prévia | O **mesmo HTML já higienizado** do PDF. **Web:** `montarCorpo(d.corpo)` dentro de um contêiner com o CSS do `.doc` num `<style>` montado em tempo de execução (como a impressão já faz). **Celular:** `react-native-webview` com `source={{ html }}` (`documentoCompleto`), JavaScript desligado e toda navegação recusada. É uma **folha contínua em largura A4**: as quebras de página só existem na impressão, então não há "Página 1 de N"; a quebra por sessão aparece como marca tracejada só na prévia | Gustavo, 15/11 |
| D11 | Divisão do `cssBase` | Duas partes: as regras globais (`@page`, `html, body`), que só a impressão e o `documentoCompleto` usam, e as do `.doc`, que também servem à prévia. Assim a prévia não pinta a página do app | Gustavo, 15/11 |
| D12 | Saída do PDF | Não muda: web por `window.print` no bloco só de impressão; celular por `expo-print` + `expo-sharing`, com o arquivo na pasta de temporários | Consequência da D1 |
| D13 | Navegação | Tela `/treinador/documentos`, item `documentos-pdf` em `dominio/telas.ts` (`funcionalidade: 'PDF'`, administrador com `MARCA_ALTERAR`), ligada no Perfil junto de Marca e, quando o hub existir ([configuracoes-centralizadas.md](configuracoes-centralizadas.md)), com um cartão nele | Primeiro desenho, mantida |

## Conferências feitas antes de implementar
- **CSP para o `<style>` da prévia web (15/11):** o modelo de produção (`central-api-back/deploy/proxy/extras/consultoria.caddy.modelo`, linha 23) e o local (`deploy-local/Caddyfile`, linha 13) trazem `style-src 'self' 'unsafe-inline'`. O `<style>` montado em tempo de execução passa, e é o mesmo recurso que a impressão usa hoje. **Não precisa mexer na CSP.** Conferido no modelo do repositório, não no arquivo aplicado na VPS.
- **Prévia no WebView do celular:** **ainda não conferida** (é o passo 0.1).

## Primeira entrega (noite de 16/11/2026)
Pedido do Gustavo para a noite: "3 temas de CSS e prévia em `/treinador/documentos` só com Dados de exemplo", sem migration nova sem necessidade real. Recorte **decidido pelo Claude em 16/11, a confirmar pelo Gustavo**:
- Entram: passo 1.1 (temas nos geradores), 3.1 (`pdf/exemplos.ts` e a prévia) e a tela do 3.2 só com a escolha do tema para a prévia e "Baixar PDF de exemplo".
- Ficam para depois: a Fase 2 inteira (migration `tema_pdf`/`config_pdf`, `PUT /consultoria/marca`, `MarcaPublica`), o "Salvar alterações" e os interruptores da estrutura (1.2). Sem a Fase 2 o tema escolhido **não é gravado**: todo PDF real continua saindo no `CLASSICO`, e a tela diz isso.
- `Marca` no app ganha só o campo opcional `temaPdf` (a API ainda não o envia), para os geradores já lerem o tema de onde a D4 manda.
- Passo 0.1 (prova no celular) **não foi feito**: sem aparelho na noite. A prévia do celular segue o desenho da D10 (WebView sem JavaScript, navegação recusada), **sem conferência em aparelho**; conferir no APK antes de ligar a tela para o celular.
- **Entregue no commit `eafa0046` (só app, sem push):** `pdf/temas.ts` e `pdf/cssDosTemas.ts` (os temas só acrescentam regras no fim do CSS do `.doc`; o `CLASSICO` não muda um caractere, e há teste que compara com o CSS de antes), `pdf/exemplos.ts` (treino e dieta fictícios), `cssDaPrevia` em `pdf/html.ts`, a tela `/treinador/documentos` (`treinador/documentos/`: abas Treino e Dieta, os 3 temas, prévia e "Baixar PDF de exemplo"; administrador com `MARCA_ALTERAR` e plano com `PDF`), o cartão "Documentos (PDF)" no hub e o e2e `e2e/documentos-pdf.spec.ts` (390 e 1280). O `imprimir.web.ts` (sanitizador) não foi tocado. Da tela do 3.2 faltam os interruptores da estrutura, o "Salvar alterações" e o tema areia no e2e; por isso o 3.2 continua aberto.
- **Testes:** ✅ `tsc`; ✅ jest de `src/pdf`, `src/dominio` e `src/treinador` (265 suítes, 5176 testes); ✅ e2e `documentos-pdf` e `configuracoes` (31 casos, 390 e 1280).
- **Decisões de tela (Claude, a confirmar):** a escolha do tema não vai para o endereço; os três temas em coluna única ao lado da prévia a partir de 760 px; aviso neutro "Esta escolha não é gravada"; no `MINIMALISTA` a marca aparece só numa linha fina por seção e no `MARCANTE` no topo cheio e no texto dos títulos (cabeçalho de tabela neutro nos dois), para a cor ficar contida.
- **Achados no `CLASSICO`, não corrigidos (a regra da entrega era não mudar o visual de hoje; decidir com o Gustavo):** com marca amarela (`#FFEB3B`), o texto na cor crua da marca sobre o branco em cargas e dieta fica ilegível; `.doc table.dark th` fica escuro sobre escuro; na opção A da dieta sai texto branco sobre a marca; e `.item .macros` tem 4,48:1 (abaixo de 4,5:1). Os dois temas novos usam `corDeTextoDaMarca` e passam no teste de contraste.
- **Revisão independente (`revisor`, 16/11, depois do commit; sem bloqueio) e correções no commit `74fae8e0` (local, sem push):** (1) a prévia do celular abria link no navegador do sistema: com a lista de origens restrita, o `react-native-webview` 13.16.1 chama `Linking.openURL` para o que está fora dela sem consultar o filtro; agora a lista é `['*']` e o `onShouldStartLoadWithRequest` (só `about:blank`) é o único filtro. (2) o CSS da prévia vazava para o bloco de impressão e vice-versa quando os dois estavam na página com temas diferentes: toda regra do `.doc` da prévia agora nasce presa a `.previa-pdf` (teste em `pdf/exemplos.dom.test.ts`). Jest de `src/pdf` ✅ (674 testes) e eslint ✅. **Ficou sem fazer:** teste nativo do filtro da WebView; teste jsdom da prévia e da impressão juntas com temas diferentes; a origem do hash do CSS de antes, em `pdf/temas.test.ts`, não foi reconferida contra `eafa0046^`.
- **Decidido pelo Claude em 16/11, a confirmar pelo Gustavo:** a tela e o cartão do hub aparecem também no app de celular, sem a prova em aparelho do passo 0.1 (o revisor apontou; a alternativa é esconder os dois no nativo até o 0.1, uma condição em `dominio/telas.ts`).
- **Não conferido:** WebView no Android e no iPhone (inclusive se a carga inicial é mesmo `about:blank` nas duas plataformas, condição do `onShouldStartLoadWithRequest`); PDFs de cargas, mobilidade e avaliação física nos temas novos (só o contraste por teste); temas areia e contraste alto da tela.

## Segunda entrega (21/11/2026, `59ce839d`, na `origin/main`)
Registro feito em 26/11, a partir do commit e do código; o plano não foi atualizado na hora. A "Primeira entrega" acima descreve o estado de 16/11 ("o tema não é gravado"), que deixou de valer.
- **API:** migration `V096__tema_pdf_consultoria.sql` (`consultoria.tema_pdf varchar(20) not null default 'CLASSICO'`, CHECK `consultoria_tema_pdf_check` com os três temas; o `config_pdf` **não** entrou). `Consultoria.TemaPdf` (enum, igual a `pdf/temas.ts`). Rota `PUT /consultoria/tema-pdf {temaPdf}` (`MARCA_ALTERAR` + `exigirAdministrador`; `@NotNull`, valor fora do enum recusado pela leitura do JSON; **sem `versao`**, sem 409), auditoria `MARCA_ALTERADA` com resumo fixo "Alterou o tema dos PDFs da consultoria.". O `PUT /consultoria/marca` também aceita `temaPdf` (nulo mantém o gravado). `MarcaPublica.temaPdf` sai no login, no `GET /eu`, no `GET /aluno/painel` e no `GET /consultoria`. Teste: casos novos em `MarcaELogoIntegrationTest`.
- **App:** `alterarTemaPdf` em `api/rotas.ts`; a `TelaDocumentos` lê o tema gravado, mostra "Salvar tema" (só habilitado com mudança) e, ao salvar, atualiza a marca da sessão (`atualizarMarca`) e avisa "Tema dos PDFs salvo."; o aviso "Esta escolha não é gravada" saiu.
- **Como chega aos PDFs reais (conferido lendo o código em 26/11, não rodando):** os seis geradores leem `d.marca.temaPdf` (`temaValido` ou `cssBase`); o treinador passa a marca do `GET /consultoria` (`treinador/gerarPdf.ts`) e o aluno a da sessão, que vem da API. `mesmaMarca` (`dominio/marcaDaSessao.ts`) compara o JSON inteiro, então o tema novo chega ao aluno na próxima recarga do perfil (até 5 min com o app aberto, ou ao voltar ao app).
- **Não conferido:** PDF real de cada tema baixado pelo aluno no celular (APK) e na web depois de trocar o tema; troca do tema por dois administradores ao mesmo tempo (sem `versao`, vale o último).

## Nova direção (26/11/2026): modelos prontos + personalização
Pedido do Gustavo, a partir da tela "Layouts de cobrança" da Icondev (editor livre com régua em mm, blocos posicionados e campos ligados a dados): "algo intermediário" entre o tema só e o editor livre, como a Nuvemshop, que oferece **modelos prontos** e depois **personalização manual por opções**, com prévia ao lado. Proposta da sessão aceita pelo Gustavo no mesmo dia; os detalhes de tela ainda passam pelo `plano-front`.

### Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D14 | Nível de personalização | Intermediário: galeria de modelos prontos + painel de opções com prévia ao vivo. **Sem** régua, milímetros, posição livre, campos arrastáveis, imagem enviada além da logo e CSS avançado (pediriam o motor descartado na D1, ou abririam upload e injeção) | Gustavo, 26/11 |
| D15 | Modelo pronto | 6 a 8 modelos com miniatura (os três temas de hoje viram modelos, mais Esportivo, Compacto, Elegante…). Um modelo é **só um conjunto de valores** das opções da D16, sem código próprio: modelo novo não mexe nos geradores. "Usar este modelo" aplica e abre a personalização; "Restaurar o modelo" volta aos valores dele. Substitui a D2 | Proposta aceita, 26/11 |
| D16 | Opções (todas listas fechadas no código, mapeadas para trechos de CSS fixos) | **Cores:** principal = a da marca; destaque e fundo do cabeçalho de uma paleta restrita, contraste conferido (`avaliarMarca`, 4,5:1 no texto). **Texto:** estilo da fonte (sem serifa, serifada, condensada; só fontes do sistema) e tamanho P/M/G. **Cabeçalho:** faixa cheia, linha fina ou cartão; logo à esquerda ou centralizada, pequena/média/grande; mostrar o nome da consultoria. **Tabelas:** linhas, listrada ou cartões; densidade compacta/normal/espaçosa. **Rodapé:** texto próprio (escapado), data de emissão, WhatsApp e redes da consultoria (dados que já existem) | Proposta aceita, 26/11 |
| D17 | Seções por tipo de documento | Lista das seções que o gerador já sabe montar, com interruptor e arrastar para ordenar (`ui/ArrasteDaLista`, com Subir/Descer para teclado). Treino: semana, sessões, glossário, instruções, "nova página por sessão". Dieta: modo Simples/Detalhado (padrão do download, que continua escolhível) e pesos. Bloco extra de **texto livre** (`**negrito**`, escapado). O cabeçalho continua obrigatório (D6). Substitui a D3 e tira `ordemSecoes` do "Fora do escopo" | Proposta aceita, 26/11 |
| D18 | Escopo da configuração | **Um estilo só para todos os documentos** (cores, texto, cabeçalho, tabelas, rodapé) + **seções por tipo**, como o tema da loja e as seções de cada página na Nuvemshop. Sem lista de vários layouts por tipo nem layout por aluno; entram depois se fizerem falta | Proposta aceita, 26/11 |
| D19 | Como chega ao PDF | A configuração é dado (JSON só com chaves conhecidas, validado nos dois lados; valor desconhecido = o do modelo), nunca HTML nem CSS: o sanitizador e os testes de injeção não mudam. Vai com a marca (`MarcaPublica`, login, `/eu`, pacote offline do aluno), como o `temaPdf` hoje; a coluna `tema_pdf` da V096 vira o modelo escolhido | Proposta aceita, 26/11 |
| D20 | Onde se edita | Editor só no PC (a partir de 1024 px de área), em tela inteira com a guarda "Sair sem salvar?" e desfazer; no celular, no máximo a escolha do modelo | Proposta aceita, 26/11 |

### Ordem sugerida (passos a detalhar depois do `plano-front`)
- [x] N1 Modelos prontos com as opções de **cores, cabeçalho, tabelas e texto** (o que mais muda a cara do PDF; quase tudo CSS sobre o que já existe), gravação e chegada ao aluno — commit: lote de 26/11 (V107, na `main`; registro em [lote-26-11-retomada.md](lote-26-11-retomada.md)); acertos da galeria em `727957c0` (local, abaixo)
- [ ] N2 **Seções e rodapé** do treino e da dieta (inclui o texto livre) — commit: —
- [ ] N3 Os outros quatro documentos (mobilidade, lista de compras, cargas, avaliação física) — commit: —
- [ ] N4 Fechamento: prova no celular (passo 0.1), Ajuda e guias, `AGENTS.md`, `docs/design-e-front.md`, revisão independente (validação do JSON, injeção, permissão) — commit: —

### Rodada de 28/11 (commit local `727957c0`, branch `rodada-28-11`, sem push)
- **"Personalizar este modelo" abre a configuração gravada:** o link e o toque no modelo em uso vão ao editor **sem**
  `?modelo=` (`treinador/documentos/TelaDocumentos.tsx`; com `?modelo=` o editor trocaria de modelo e zeraria as
  personalizações); um modelo diferente continua indo com `?modelo=ID` (`galeria/regras.enderecoDoEditor`, testado em
  `galeria/regras.test.ts`; e2e `e2e/documentos-pdf.spec.ts`).
- **Regra de colunas uma só:** `galeria/regras.colunasDaGaleria` saiu; a galeria usa `dominio/configuracaoPdf.colunasDaGaleria`
  e `larguraMaximaDaGaleria` (`configuracaoPdf.test.ts`).
- Verificação relatada da onda 1: `typecheck` limpo, `lint` 0 erros, jest 486 suítes, e2e 1225 passaram e 1 falhou
  (`filtros-laterais` B3, de outra área), 238 pulados.
- Fica para o Gustavo: a cor da miniatura da galeria. Fora da rodada: N2 a N4.

### Em aberto
- ~~Gravar pela rota própria ou junto com a Marca~~ · decidido na D25: rota própria, com versão.
- Fontes serifada e condensada no PDF dependem das fontes do aparelho; conferir no Android e no iPhone antes de oferecer.
- Quais modelos além dos três de hoje, e a miniatura de cada um (gerada da prévia ou imagem fixa).

### Plano de tela (`plano-front`, 26/11/2026; decisões de tela a confirmar pelo Gustavo)
**Descobertas que mudam o desenho:**
- Duas prévias na mesma página brigam pelo CSS: `cssDaPrevia` (`pdf/html.ts`) prende tudo a `.previa-pdf .doc` e cada `PreviaDoDocumento.web.tsx` põe um `<style>`; com várias miniaturas vence a última. Precisa de chave por instância (`.previa-pdf[data-previa="k"] .doc`), sem tocar o sanitizador. **Vem antes da galeria.**
- `avaliarMarca` mede contra os fundos do tema do app, não contra o papel branco: a paleta de destaque fica fixa no código, travada por teste contra `#FFFFFF`.
- A coluna da direita de Configurações tem ~700 px em 1280; folha A4 (794) + painel (~360) não cabem.

**Decisões de tela (D-F):**
- D-F1 Galeria continua em Configurações (`documentos-pdf`) e em `/treinador/documentos`; o **editor** é rota nova em tela inteira, `/treinador/documentos/personalizar`, sobre `TelaDoEditor`.
- D-F2 Toda escolha navega para o editor (`?modelo=ID`, consumido na chegada). O editor decide pela própria faixa: `normal` ou maior = editor; `compacta` (celular, janela estreita, 1024 com menu aberto) = só confirmar o modelo com `PainelConfirmacao` (o que o celular já faz hoje) ou "Personalize numa tela maior".
  - **Limitação aceita (Gustavo, 26/11):** o menu do treinador continua à vista no editor (escondê-lo pediria mexer no layout do treinador, fora do escopo), e o arranjo vem da **área** de conteúdo. Por isso uma janela de 1024, com o menu aberto (~784 de área) ou minimizado (~952), fica abaixo de 1024 e mostra "Personalize numa tela maior"; 1280 com o menu aberto (~1040) já abre o editor. Regra em `dominio/editorDoPdf.arranjoDoEditor`; e2e `documentos-pdf-editor.spec.ts`.
- D-F3 Nada grava antes do "Salvar"; trocar modelo e "Restaurar o modelo" mexem no rascunho com `BarraDesfazer`, sem pergunta; guarda de saída ligada.
- D-F4 Miniaturas na web pelo gerador real (cabeçalho e uma tabela, com a marca da consultoria, `aria-hidden`); no nativo, sem miniatura.
- D-F5 Painel em duas partes: "Estilo de todos os documentos" (Cores, Texto, Cabeçalho, Tabelas; Rodapé no N2) e "Seções do <tipo>" (N2). Nada de "em breve" na tela.
- D-F6 Só peças existentes (`LinhaDeConfiguracao`, `Escolha`, `Interruptor`, `OpcaoCartao`+`GradeDeOpcoes` para a cor, `Cartao recolhivel` com `resumo`, `Abas`, `ui/Grade`, `Folha`, `BarraDesfazer`, `RodapeDeAcoes`); nenhum componente novo em `ui/`.
- D-F7 Prévia ao vivo sem atraso (só o texto do rodapé, no N2, com 300 ms).
- D-F8 Cor principal só leitura no editor, com "Alterar na Marca".

**Ordem (N1):** (0) contrato na sessão principal, depois de a outra sessão sair de `api/rotas.ts`/`tipos.ts`: rota, `versao` ou não, migration que amplia o CHECK de `tema_pdf` para os modelos e grava o JSON de opções, `MarcaPublica`/`Marca`, revisão; (1) `executor`: `dominio/configuracaoPdf.ts` (modelos, normalizar, resolver, personalizado, restaurar, trocar, contagem, resumo, paleta, colunas da galeria) com teste, inclusive contraste com `#FFEB3B`; (2) `executor`: chave por instância na prévia e `cssDasOpcoes(valores)`; Clássico sem diferenças idêntico ao de hoje; injeção por modelo; jsdom com duas prévias; (3) `executor-front`: CSS de cada opção (Minimalista e Marcante reproduzem a saída de hoje); (4) `executor`: `api/`, `mesmaMarca`, rota em `dominio/telas.ts` e `permissoes.ts` (fora da busca); (5) e (6) `executor-front`: galeria e editor, com os e2e `documentos-pdf.spec.ts` (atualizado) e `documentos-pdf-editor.spec.ts` (novo) em 390, 1024, 1280 e 1920, claro, areia e escuro; (7) textos do hub e do cabeçalho.

**Riscos:** serifada/condensada dependem das fontes do aparelho; peso de 6 a 8 miniaturas (usar exemplo curto); paridade de Minimalista e Marcante para quem já os escolheu; sem `versao`, vale o último; celular sem a prova 0.1; janela de 1024 com o menu aberto cai em "tela pequena".

**Respostas do Gustavo (26/11/2026):**
- D21 Modelos: **6**, Clássico, Minimalista, Marcante, Compacto, Elegante e Esportivo.
- D22 Fontes: sem serifa, serifada **e condensada já no N1**, com o risco aceito de o PDF do celular sair diferente da prévia até a prova 0.1 (conferir no APK no N4).
- D23 Paleta de destaque: **8 cores**, Cor da marca, Grafite e 6 da `PALETAS` (Azul, Índigo, Verde, Turquesa, Magenta, Bronze).
- D24 Celular: **escolhe e grava o modelo** (como hoje); personalizar só no PC.
- "Fundo do cabeçalho" = topo do documento (recomendação do `plano-front`, não perguntada; as tabelas seguem o estilo de tabela).
- D25 Contrato: **rota própria, com `versao`** (a evolução do `PUT /consultoria/tema-pdf` da V096, gravando modelo + opções; versão diferente = 409 `CONFLITO_EDICAO`, e o editor mostra "Recarregar"). A `MarcaPublica` continua levando o resultado ao aluno (D19).

## Passos
Os passos 1.2, 2.1, 2.2 e 3.2 abaixo são do desenho de 15/11 e foram **substituídos pela "Nova direção"** (N1 a N4); ficam como histórico do que já foi feito.

### Fase 0. Conferência que falta
- [ ] 0.1 Prova no celular: um `react-native-webview` com `source={{ html }}` de um `documentoCompleto` de exemplo, JavaScript desligado e navegação recusada, em Android e iPhone. Confere largura A4 com zoom para caber em 390 px, a logo em data URI e a cor de fundo da faixa. Se não servir, parar e avisar o Gustavo antes de seguir para a Fase 3 — commit: —

### Fase 1. Temas e estrutura nos geradores (`app/`, regra pura, sem API)
- [x] 1.1 `pdf/html.ts`: dividir o `cssBase` em regras globais e regras do `.doc` (D11); `cssBase` e `cabecalhoDoPdf` recebem o tema; CSS do `MINIMALISTA` e do `MARCANTE` (o `CLASSICO` é o de hoje, sem mudar um pixel). Os 6 geradores passam o tema. Testes: casos por tema em `pdf/pdf.test.ts` e `pdfAvaliacaoFisica.test.ts`, contraste com `#FFEB3B` nos três temas, tema desconhecido cai em `CLASSICO`, e casos novos em `injecao.test.ts` e `imprimir.web.dom.test.ts` rodando os mesmos ataques em cada tema — commit: `eafa0046` (noite de 16/11; ✅ jest de `src/pdf`)
- [ ] 1.2 Estrutura: os geradores de treino e dieta respeitam `mostrarSemana`, `mostrarGlossario`, `mostrarInstrucoes`, `quebrarPorSessao`, `mostrarPesos` e `rodapePadrao` (com `esc()`); sem a chave vale o comportamento de hoje. `FolhaPdfDieta` abre com `modoPadrao` marcado. Testes de cada interruptor ligado e desligado — commit: —

### Fase 2. API e contrato
- [ ] 2.1 **Parcial:** o tema entrou na V096 com rota própria (`59ce839d`, ver "Segunda entrega"); falta o `config_pdf` (migration nova, record validado, testes abaixo). Desenho original: Migration `V07X__documentos_pdf_da_consultoria.sql` (`tema_pdf varchar(20) not null default 'CLASSICO'` com CHECK e `config_pdf jsonb not null default '{}'`); `Consultoria`, `ConfiguracaoPdf` (record validado: só as chaves da D3, booleanos, enum e rodapé com limite de tamanho; JSON desconhecido é recusado com 422 no campo), `MarcaPublica`, `MarcaRequest` e `MarcaService` no `PUT /consultoria/marca`. Totais em `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest`; casos no teste de integração da marca: salvar e ler, 403 de quem não é administrador, 409 de versão, chave desconhecida recusada, presença no `/auth/login`, `/eu` e `/aluno/painel`, outra consultoria não é tocada — commit: —
- [ ] 2.2 **Parcial:** o tema já chega a todos os PDFs pela marca da sessão e do `GET /consultoria` (`59ce839d`); falta o mesmo caminho para o `config_pdf`. Desenho original: App: `Marca` em `api/tipos.ts`, `mesmaMarca`, e os pontos de chamada do aluno (`treino.tsx`, `dieta.tsx`, `mobilidade.tsx`, `lista-de-compras.tsx`, `historico.tsx`, `DietaDoAluno.tsx`) e do treinador (`gerarPdf.ts`, `CartaoAvaliacaoFisica.tsx`, `CargasPorDivisao.tsx`, `FolhaListaDeCompras.tsx`) passando a marca com tema e configuração — commit: —

### Fase 3. Prévia e tela `/treinador/documentos`
- [x] 3.1 `pdf/exemplos.ts` (treino e dieta fictícios completos) e o componente de prévia nas duas plataformas (D10) — commit: `eafa0046` (noite de 16/11; prévia na web conferida no e2e, a do celular sem aparelho)
- [ ] 3.2 **Parcial:** abas, temas, prévia, "Baixar PDF de exemplo" e "Salvar tema" (`eafa0046`, `59ce839d`); faltam os interruptores da estrutura, o "Salvar alterações" com 409 (depende do `config_pdf`) e o tema areia no e2e. Desenho original: Tela (pelo `executor-front`): abas Treino e Dieta, escolha dos 3 temas, interruptores da estrutura, prévia, "Baixar PDF de exemplo" e "Salvar alterações" (409 recarrega). `dominio/telas.ts`, `permissoes.ts`, Perfil e hub. E2e `e2e/documentos-pdf.spec.ts` em 390 e 1280 px, claro, areia e escuro — commit: —
- [ ] 3.3 Fechamento: `AGENTS.md`, `docs/design-e-front.md`, Ajuda e guias em PDF; `mvn verify`, `npm run typecheck`, `npm run lint`, `npm test` e o e2e da tela; revisão do `revisor` (permissão, validação do `config_pdf`, injeção) — commit: —

## Fora do escopo
- Motor próprio de diagramação, prévia paginada ("Página 1 de N") e SVG por página (opção (a), descartada na D1). Se a prévia paginada virar requisito, o primeiro passo é uma prova isolada de fonte embutida com métricas, antes de reescrever qualquer gerador.
- Áreas clicáveis na prévia (D8).
- "Testar com aluno" (D9): está nas Pendências soltas.
- ~~Ordem das seções escolhida pelo treinador (`ordemSecoes` do primeiro desenho)~~ · entrou na Nova direção (D17, 26/11).
- Omitir macros por item na dieta; editor livre de posição, fontes fora das do sistema, mais de 3 temas.
- Módulo Java de documentos na biblioteca `plataforma` para a Central.

## O que ficou para trás
- A CSP foi conferida no modelo do repositório da Central, não no arquivo aplicado na VPS.
- Achados no `CLASSICO` com marca clara (seção "Primeira entrega"): continuam sem correção; agora que o tema é escolhido e vale nos PDFs reais, a consultoria com marca amarela que fica no Clássico ainda recebe texto ilegível em cargas e dieta. Decisão do Gustavo.
- A tela e o cartão do hub seguem visíveis no app do celular sem o passo 0.1 (decisão de 16/11 ainda a confirmar).
- Conferir no celular físico (APK Android e iPhone) o PDF de cada tema e a prévia em 390 px (passo 0.1 e fechamento).
