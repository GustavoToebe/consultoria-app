# Documentos (PDF): temas da consultoria e prévia

Situação: Planejando (opção (b) escolhida pelo Gustavo em 15/11/2026; nada implementado) · Onde: `main`, só este plano · Atualizado: 15/11/2026

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
| D5 | Onde grava | No **`PUT /consultoria/marca` que já existe**, sem rota nova: `MARCA_ALTERAR` + `exigirAdministrador`, `versao` obrigatória e 409 `CONFLITO_EDICAO`. A auditoria é a `MARCA_ALTERADA` que o `MarcaService` já grava (resumo fixo) | Gustavo, 15/11 |
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

## Passos

### Fase 0. Conferência que falta
- [ ] 0.1 Prova no celular: um `react-native-webview` com `source={{ html }}` de um `documentoCompleto` de exemplo, JavaScript desligado e navegação recusada, em Android e iPhone. Confere largura A4 com zoom para caber em 390 px, a logo em data URI e a cor de fundo da faixa. Se não servir, parar e avisar o Gustavo antes de seguir para a Fase 3 — commit: —

### Fase 1. Temas e estrutura nos geradores (`app/`, regra pura, sem API)
- [ ] 1.1 `pdf/html.ts`: dividir o `cssBase` em regras globais e regras do `.doc` (D11); `cssBase` e `cabecalhoDoPdf` recebem o tema; CSS do `MINIMALISTA` e do `MARCANTE` (o `CLASSICO` é o de hoje, sem mudar um pixel). Os 6 geradores passam o tema. Testes: casos por tema em `pdf/pdf.test.ts` e `pdfAvaliacaoFisica.test.ts`, contraste com `#FFEB3B` nos três temas, tema desconhecido cai em `CLASSICO`, e casos novos em `injecao.test.ts` e `imprimir.web.dom.test.ts` rodando os mesmos ataques em cada tema — commit: —
- [ ] 1.2 Estrutura: os geradores de treino e dieta respeitam `mostrarSemana`, `mostrarGlossario`, `mostrarInstrucoes`, `quebrarPorSessao`, `mostrarPesos` e `rodapePadrao` (com `esc()`); sem a chave vale o comportamento de hoje. `FolhaPdfDieta` abre com `modoPadrao` marcado. Testes de cada interruptor ligado e desligado — commit: —

### Fase 2. API e contrato
- [ ] 2.1 Migration `V07X__documentos_pdf_da_consultoria.sql` (`tema_pdf varchar(20) not null default 'CLASSICO'` com CHECK e `config_pdf jsonb not null default '{}'`); `Consultoria`, `ConfiguracaoPdf` (record validado: só as chaves da D3, booleanos, enum e rodapé com limite de tamanho; JSON desconhecido é recusado com 422 no campo), `MarcaPublica`, `MarcaRequest` e `MarcaService` no `PUT /consultoria/marca`. Totais em `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest`; casos no teste de integração da marca: salvar e ler, 403 de quem não é administrador, 409 de versão, chave desconhecida recusada, presença no `/auth/login`, `/eu` e `/aluno/painel`, outra consultoria não é tocada — commit: —
- [ ] 2.2 App: `Marca` em `api/tipos.ts`, `mesmaMarca`, e os pontos de chamada do aluno (`treino.tsx`, `dieta.tsx`, `mobilidade.tsx`, `lista-de-compras.tsx`, `historico.tsx`, `DietaDoAluno.tsx`) e do treinador (`gerarPdf.ts`, `CartaoAvaliacaoFisica.tsx`, `CargasPorDivisao.tsx`, `FolhaListaDeCompras.tsx`) passando a marca com tema e configuração — commit: —

### Fase 3. Prévia e tela `/treinador/documentos`
- [ ] 3.1 `pdf/exemplos.ts` (treino e dieta fictícios completos) e o componente de prévia nas duas plataformas (D10) — commit: —
- [ ] 3.2 Tela (pelo `executor-front`): abas Treino e Dieta, escolha dos 3 temas, interruptores da estrutura, prévia, "Baixar PDF de exemplo" e "Salvar alterações" (409 recarrega). `dominio/telas.ts`, `permissoes.ts`, Perfil e hub. E2e `e2e/documentos-pdf.spec.ts` em 390 e 1280 px, claro, areia e escuro — commit: —
- [ ] 3.3 Fechamento: `AGENTS.md`, `docs/design-e-front.md`, Ajuda e guias em PDF; `mvn verify`, `npm run typecheck`, `npm run lint`, `npm test` e o e2e da tela; revisão do `revisor` (permissão, validação do `config_pdf`, injeção) — commit: —

## Fora do escopo
- Motor próprio de diagramação, prévia paginada ("Página 1 de N") e SVG por página (opção (a), descartada na D1). Se a prévia paginada virar requisito, o primeiro passo é uma prova isolada de fonte embutida com métricas, antes de reescrever qualquer gerador.
- Áreas clicáveis na prévia (D8).
- "Testar com aluno" (D9): está nas Pendências soltas.
- Ordem das seções escolhida pelo treinador (`ordemSecoes` do primeiro desenho): exige montar cada documento como lista de seções; entra depois, se alguém pedir.
- Omitir macros por item na dieta; editor livre de posição, fontes fora das do sistema, mais de 3 temas.
- Módulo Java de documentos na biblioteca `plataforma` para a Central.

## O que ficou para trás
- A CSP foi conferida no modelo do repositório da Central, não no arquivo aplicado na VPS.
- Conferir no celular físico (APK Android e iPhone) o PDF de cada tema e a prévia em 390 px (passo 0.1 e fechamento).
