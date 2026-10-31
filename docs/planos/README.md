# Planos e pendências

Toda frente nova ganha um arquivo nesta pasta **antes do primeiro commit de código**. Aqui fica o que está aberto, o que
foi decidido e o que ficou para trás. Push só de `docs/` não roda a CI.

## Regras

1. **Frente nova** (funcionalidade, correção grande, teste com alunos, mudança de infraestrutura): copie `MODELO.md` para
   `docs/planos/<assunto>.md`, preencha objetivo, decisões e passos, e acrescente uma linha em "Frentes" abaixo.
2. **A cada entrega:** marque o passo, escreva o commit (ou o run do deploy) e mova para "Pendências soltas" o que ficou
   de fora. Nada que sobrou fica só na conversa.
3. **Frente terminada:** situação "Concluída" com a data; o arquivo fica como histórico.
4. **Pendência pequena sem frente própria:** vai para "Pendências soltas", com quem faz.
5. Nada de dado pessoal, segredo ou conteúdo de `.env` nestes arquivos.

## Frentes

| Frente | Arquivo | Onde | Situação | Atualizado |
| --- | --- | --- | --- | --- |
| Teste com 5 alunos | [teste-5-alunos.md](teste-5-alunos.md) | produção | Preparando | 27/10/2026 |
| Anamnese ao aceitar a inscrição | [anamnese-no-aceite.md](anamnese-no-aceite.md) | `main` | Concluída em 27/10/2026 | 27/10/2026 |
| Listas padronizadas no treinador | [listas-padronizadas.md](listas-padronizadas.md) | `main` | Concluída em 27/10/2026 | 27/10/2026 |
| Engajamento (retorno, conquistas, mural) | [engajamento.md](engajamento.md) | branch `gamificacao` | Etapa 0 em andamento | 27/10/2026 |
| Revisão de segurança de 28/10 | [revisao-seguranca-28-10.md](revisao-seguranca-28-10.md) | `main` | Publicada em 28/10/2026 (run 40719287212); falta provar o reenvio do Mercado Pago | 28/10/2026 |
| PDFs menores e mais rápidos | [pdfs-otimizacao.md](pdfs-otimizacao.md) | `main` | Publicada em 28/10/2026 (run 40719287212); item 4 e conferência no APK pendentes | 28/10/2026 |
| Proteção contra robôs (Cloudflare + Turnstile) | [cloudflare-turnstile.md](cloudflare-turnstile.md) | Cloudflare e VPS | Concluída em 28/10/2026 (Turnstile ligado em produção; falta só o teste no iPhone nativo) | 28/10/2026 |
| Central: lote de segurança de 28/10 | [central-seguranca-28-10.md](central-seguranca-28-10.md) | Central, branch `seguranca-lote-28-10` (um PR) | Concluída | 28/10/2026 |
| Dependabot de 28/10 (Central, Servirea e consultoria) | [dependabot-28-10.md](dependabot-28-10.md) | Central (#27) e Servirea (#16) mesclados, publicar verde; lote do consultoria publicado (aa81c38, run 40753524829); falta a revisão de 14/11 | Em andamento | 28/10/2026 |
| Ciclo desligado: nada do ciclo na tela (J) | [ciclo-desligado-no-app.md](ciclo-desligado-no-app.md) | `main` (f72d173, run 40751695095) | Concluída em 28/10/2026 (web no ar; celular só num APK novo) | 28/10/2026 |
| Meus dados do aluno (cartão na aba Conta) | [meus-dados-do-aluno.md](meus-dados-do-aluno.md) | `main` (um push) | Concluída em 28/10/2026 (run 40760401698 verde; celular só num APK novo) | 28/10/2026 |
| Evolução (referências da Prime: lista de compras, receitas, PDFs, avaliação física, agenda, lembretes) | [evolucao-prime.md](evolucao-prime.md) | `main` (457c152) | Concluída em 28/10/2026; decisões abertas fechadas em 29/10 | 29/10/2026 |
| Ajustes da evolução (lista na ordem do mercado, PDF do comparativo para o aluno, aluno desliga lembretes, contraste do PDF) | [ajustes-evolucao.md](ajustes-evolucao.md) | `main` (6becaa4, PR 15) | Concluída em 29/10/2026 (V041 na `main`) | 29/10/2026 |
| Agenda no estilo do Google Agenda (Dia/Semana/Mês/Ano, agendas com cor, evento sem aluno, recorrência) e compromisso com vários alunos, aviso no app e lembrete no celular | [agenda-calendario.md](agenda-calendario.md) | `main` (f95aacf, PR 16) | Concluída em 29/10/2026 | 29/10/2026 |
| Interessados: correções e CRM | [interessados-crm.md](interessados-crm.md) | `main` (f95aacf, PR 16) | Concluída em 29/10/2026; falta a conferência do Gustavo | 29/10/2026 |
| Clareza do treinador (reunião de 29/10: pasta, aplicar modelo, hierarquia visual, importação em etapas) | [clareza-do-treinador.md](clareza-do-treinador.md) | PR para a `main` (30/10) | Pronta: lotes A, B e C, importação com correção na tabela, avisos de atenção | 30/10/2026 |
| Editor de treino: visual do protótipo de 30/10 (fundo quase branco, bordas, cantos, selos, numeração, uma série aberta) | [editor-de-treino-visual.md](editor-de-treino-visual.md) | branch (30/10) | Em andamento | 30/10/2026 |
| Telas do aluno no estilo novo (lista em grupos, ficha, novo aluno) | [telas-do-aluno-visual.md](telas-do-aluno-visual.md) | branch (30/10), Claude local | Planejando: protótipo aprovado em `docs/prototipos/alunos.html` | 30/10/2026 |
| Atualização visual do app inteiro e pendências da análise de 29/10 (painel novo, A01, A02, A06, A12, cabeçalho da importação, rótulos da lista de compras) | [atualizacao-visual-app-full.md](atualizacao-visual-app-full.md) | branch `atualizacao-visual-app-full`, Claude local | Planejando | 30/10/2026 |
| Importar plano de treino (e dieta) de PDF ou Google Docs (A02) | [importar-plano-de-documento.md](importar-plano-de-documento.md) | branch `atualizacao-visual-app-full` | Planejando: só o plano escrito, sem código; perguntas para o Gustavo | 30/10/2026 |
| Água do aluno (marcar os copos do dia contra a "Água por dia" da dieta) | [agua-do-aluno.md](agua-do-aluno.md) | PR para a `main` (30/10), junto da clareza | Pronta | 30/10/2026 |
| "Quero ser aluno" com as perguntas do treinador (questionário de inscrição) | [inscricao-com-perguntas-proprias.md](inscricao-com-perguntas-proprias.md) | — | Planejando, decisões fechadas: começa depois de `ajustes-video-30-10` e das pendências do painel | 31/10/2026 |

## Pendências soltas

| Pendência | Quem | Origem |
| --- | --- | --- |
| Início, Primeiros passos: "Abrir Metodologias" leva à Biblioteca sem abrir o chip de metodologias | Claude, quando o Gustavo pedir | atualizacao-visual-app-full (passo 9) |
| Início: `/treinador/alunos` ignora `?meus=`; o cartão do bloco Alunos em "Meus" abre a lista sem o filtro | Claude, quando o Gustavo pedir | atualizacao-visual-app-full (passo 8) |
| Início: conferir no seed o texto de exemplo "3 semanas e 2 dietas" do item de modelos dos Primeiros passos | Claude | atualizacao-visual-app-full (passo 9) |
| Início, revisão do PR `painel-novo` (não bloqueiam): (a) `releer` do foco que responde depois de um toque desfaz o toque na tela até o próximo foco (`usePrimeirosPassosGuardados`, contador de geração); (b) ao trocar o N do "Sem registro" a Folha mostra os números do N anterior até a resposta (`useCarregar` devolve os dados da chave antiga como prontos); (c) tocar um cartão de Folha antes do `/painel` responder abre a Folha com o alerta de erro (distinguir carregando de falhou); (d) a Ajuda diz "Eles já estão no Início" para perfil sem nenhum item dos Primeiros passos; (e) no Início sem alunos as consultas dos blocos saem à toa; (f) `useFontesDoPainel.recarregar` casa duas listas pela ordem; (g) o X da linha "Concluídos" sem `moldura` | Claude, quando o Gustavo pedir | atualizacao-visual-app-full (passos 8 e 9) |
| e2e `lista-alunos-grupos.spec.ts` (1280, lápis ao lado): oscilou uma vez com altura 39,99997 px contra o mínimo de 40 (arredondamento de subpixel; passou ao rodar de novo); tolerância de 0,5 px no `toBeGreaterThanOrEqual` | Claude | e2e do PR `painel-novo` |
| Arrastar no Kanban de interessados: testar no celular (toque longo) | Gustavo | interessados-crm |
| Conferir que a "Anamnese Saraiva Team" está publicada em Planejamento › Anamnese | Gustavo | anamnese |
| Ver no celular se os títulos das seções do editor de séries (caixa alta 12 px) ficaram bons | Gustavo | editor de séries (5d353d0) |
| Gerar APK novo (`npx eas-cli build --profile preview --platform android`) e repetir o roteiro de `docs/build-celular.md` | Gustavo | etapas, cronômetro, editor |
| Teste manual na web do roteiro de Cluster e Rest-pause com um aluno de teste | Gustavo | etapas |
| Apagar a branch `etapas-por-bloco` (nada fora da `main`) | Gustavo | limpeza |
| Lembrar o que era a alteração revertida no `psql` de 26/10 (~12:20, banco `consultoria`) | Gustavo | banco |
| Central: copiar as 3 linhas novas do `roles-banco.sql` para `central-api-back/deploy/postgres/banco-app.sql.modelo` (CRLF), na próxima mudança da Central. **Commit `a2892c0` na branch `banco-idle-in-transaction` da Central, PR #28 aberto, CI verde** (`postgres.test.sh` passou; idêntico ao do consultoria, ignorando as quebras de linha). Nada aplicado na VPS | Gustavo (merge do PR #28) | travas do banco (865b9ca) |
| Dependabot `node-forge`, `decode-uri-component`, `uuid`: aceitos até 14/11 (só build do Expo / DoS no navegador), registro e revisão em [dependabot-28-10.md](dependabot-28-10.md); olhar ao gerar o próximo APK | Claude | Dependabot |
| Link de vídeo da técnica (Rest-pause, Cluster) quando houver vídeo aprovado do Saraiva | Gustavo | análise 2 (A8) |
| Ciclo menstrual: expansão como projeto separado | Gustavo decide | ciclo |
| Evolução: `mvn verify` com Docker na branch `atualizacao-visual-app-full` antes de qualquer PR (testes de integração novos de avaliação, agenda, lembretes, grupo do alimento, dieta e limite do CPF não rodaram no ambiente sem Docker) | Gustavo (PC) | evolucao-prime |
| Agenda calendário, o que a tela do lote 2 não conferiu: setas do teclado dentro do menu "Criar"; janela de 1024 a 1100 px; teclado virtual em aparelho (roteiro 22a/22b de `docs/build-celular.md`); o aviso de sobreposição de evento ignora a repetição; se o `replace` do filtro não chegar ao endereço, o filtro escolhido numa Folha fica só na tela até recarregar | Claude, junto do lote A da rodada visual (`atualizacao-visual-app-full`), para não haver dois agentes na agenda | [agenda-calendario.md](agenda-calendario.md) |
| Agenda: push do servidor para compromisso marcado, remarcado ou cancelado (app fechado) fica com a decisão de push da frente de engajamento (item "Push do servidor", Etapa 3) | Gustavo decide | [agenda-calendario.md](agenda-calendario.md), [engajamento.md](engajamento.md) |
| Aviso de desenvolvimento "Received `false` for a non-boolean attribute" aparece em todas as telas na web (já existia antes do passo 1): achar a peça que passa `false` a um atributo do DOM | Claude, quando o Gustavo pedir | atualizacao-visual-app-full (capturas do passo 1) |
| Importação de CSV: o separador (`;` ou `,`) é decidido pela primeira linha do arquivo; com um título que tenha vírgula acima do cabeçalho (passo 7, `linhaDoCabecalho`), a leitura se confunde. Escolher o separador pela linha do cabeçalho | Claude, quando o Gustavo pedir | atualizacao-visual-app-full (passo 7) |
| Teste de `scripts/importacao` ("os 12 modelos versionados são o que o script gera") falha no Windows por 4 bytes em `app/public/modelos/importacao/alimentos.csv`: no índice é LF e a cópia local sai CRLF (`core.autocrlf=true`, conferido em 30/10). Provável solução: `*.csv text eol=lf` (ou só os modelos) no `.gitattributes` | Claude, quando o Gustavo pedir | atualizacao-visual-app-full (passo 6) |
| `lock_timeout` no módulo auth: no consultoria foi pela URL de migração (`?options=-c%20lock_timeout%3D60s` na `plataforma.auth.migracao.url`, 30/10, provado no `PapeisBancoIntegrationTest`), sem mexer na `plataforma`. A mesma linha vai para a URL de migração do Servirea e da Central na próxima mudança de cada um (lá também a URL de base não pode ter `?`) | Claude, na próxima mudança de cada app | travas do banco |
| Mercado Pago: provar com um reenvio real se o `ts` muda; se repetir, rever a janela de 5 min do webhook da Central | Gustavo/Claude | revisão de segurança 28/10, item 1 |
| CI: Trivy reprovou a imagem da web por `go-jose` 4.1.5 (CVE-2026-116587) no `caddy:2-alpine`; exceção até 14/11 no `.trivyignore`. Até 14/11: ver se o Caddy já traz go-jose 4.1.6, Go 1.26.10 e x/net 0.60.0 e apagar as exceções | Gustavo | run 40714486714 |
| Trivy, mesma exceção no Servirea: pronta na branch `deps-front-28-10` (116587 e 111943 no `.trivyignore` do front; brotli e curl por `apk upgrade` na imagem), PR #16 aberto, CI verde, aguarda o merge; ver [dependabot-28-10.md](dependabot-28-10.md). Os `.trivyignore-terceiros` do Servirea seguem com o próximo lote dele | Claude | run 40714486714 |
| PDF no celular: copiar o arquivo do `expo-print` em vez de passar o PDF todo em base64 (`pdf/imprimir.ts`). Só provando no APK, Android e iPhone | Gustavo (aparelho) | PDFs, item 4 |
| Conferir no APK que a logo grande sai reduzida no PDF do aluno e do treinador | Gustavo | PDFs, item 2 |
| `imprimir.web.ts` sem `innerHTML`: não recomendado agora (a trava de teste cobre); Gustavo pode reabrir | Gustavo decide | revisão de segurança 28/10, item 3 |
| Cloudflare: a regra "Bloqueio por pais (Fase 6B)" (`adfb3957…`) bloqueia tudo fora do Brasil. Decisão do Gustavo (28/10): por enquanto **fica**. O que ela libera e bloqueia hoje: `cloudflare-regras.md` na Central (PR #25) | Gustavo decide | cloudflare-turnstile |
| **Exceção obrigatória da regra de país (a):** antes de mandar o app para revisão da Apple/Google (TestFlight ou Play Store), liberar a revisão na regra `adfb3957…`, porque os revisores acessam de fora do Brasil (login e API falhariam). Ver também se `/.well-known/` precisa ser liberado | Gustavo (Cloudflare) | cloudflare-turnstile |
| **Exceção obrigatória da regra de país (b):** antes de ligar a InfinitePay no consultoria, liberar `/api/publico/pagamentos/` na regra `adfb3957…` (o webhook dele não fica em `/webhooks/`, que é o que a regra libera hoje) | Gustavo (Cloudflare) | cloudflare-turnstile |
| **Exceção obrigatória da regra de país (c):** antes de ligar links universais (iOS) ou App Links (Android), liberar `/.well-known/` de fora do Brasil na regra `adfb3957…`, porque a Apple e o Google buscam esses arquivos de servidores no exterior | Gustavo (Cloudflare) | cloudflare-turnstile |
| **Consequência aceita da regra de país (d)** (decisão do Gustavo, 28/10/2026): aluno ou treinador fora do Brasil não acessa o app nem a API. Se for preciso, a saída é liberar `/api/` e manter só o limite de requisições | Gustavo decide | cloudflare-turnstile |
| Próximo lote do consultoria: o trecho "VPS" do `AGENTS.md` passa a só apontar para o `AGENTS.md` da Central, para não haver duas versões da regra | Claude | acesso à VPS |
| Proxy, conferido em 30/10 (só leitura): na VPS o bloco vivo é `extras/consultoria.caddy` (o Caddyfile importa `extras/*.caddy`; o Caddy subiu depois da última mudança dos arquivos). As diretivas são iguais às do `.modelo`, inclusive o CSP e o `connect-src`; só dois comentários do vivo estão velhos (a receita com `caddy reload`, que não existe com `admin off`, e o "aberto só até a primeira conta" do cadastro). Copiar o `.modelo` por cima na próxima recriação do proxy | Gustavo decide (ok para mexer na VPS) | cloudflare-turnstile |
| Turnstile: testar o app nativo do iPhone (WKWebView) antes do TestFlight; roteiro em `docs/build-celular.md` seção 5 | Gustavo (aparelho) | cloudflare-turnstile |
| Filtro de servidor `GET /alunos?grupo=` (ex.: "Sem pasta com período"), para o cartão do painel abrir a lista já filtrada; hoje abre a lista sem filtro, que é paginada, e o grupo aparece lá | Gustavo decide quando | `atualizacao-visual-app-full.md`, passo 8 (30/10) |

## Limitações aceitas (não são pendência)

- WS em "% da WS" fica fora da coluna de cargas por divisão (`docs/series-etapas.md`).
- Exercício sem carga aparece como "Sem carga" no relatório de cargas.
- Listas em linha (ver `listas-padronizadas.md`): rótulos acessíveis dos botões "Editar"/"Aplicar ao aluno"/"Ver produto" e do link do aluno, contraste do selo esmaecido no Catálogo, regra dos questionários para `dominio/` com teste, e2e do Catálogo/Questionários/Modelos.
