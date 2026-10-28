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
| Meus dados do aluno (cartão na aba Conta) | [meus-dados-do-aluno.md](meus-dados-do-aluno.md) | `main` (um push) | Em andamento (código pronto; falta o push) | 28/10/2026 |
| Dieta: modo de preparo, opções lado a lado e PDFs com a logo | [evolucao-dieta-e-pdfs.md](evolucao-dieta-e-pdfs.md) | branch `evo-dieta-pdf` | Em andamento (código pronto; falta o teste de integração com Docker) | 28/10/2026 |

## Pendências soltas

| Pendência | Quem | Origem |
| --- | --- | --- |
| Conferir que a "Anamnese Saraiva Team" está publicada em Planejamento › Anamnese | Gustavo | anamnese |
| Ver no celular se os títulos das seções do editor de séries (caixa alta 12 px) ficaram bons | Gustavo | editor de séries (5d353d0) |
| Meus dados do aluno: decidir se a rota `PUT /aluno/meus-dados` ganha limite de tentativas (`LimiteTentativas`, por usuário) contra teste de CPFs pelo 409 `ALUNO_CPF_EM_USO`; e se o aluno inativo deve dar 409 em vez do 401 que já recebe | Gustavo | meus-dados-do-aluno |
| Gerar APK novo (`npx eas-cli build --profile preview --platform android`) e repetir o roteiro de `docs/build-celular.md` | Gustavo | etapas, cronômetro, editor |
| Teste manual na web do roteiro de Cluster e Rest-pause com um aluno de teste | Gustavo | etapas |
| Apagar a branch `etapas-por-bloco` (nada fora da `main`) | Gustavo | limpeza |
| Lembrar o que era a alteração revertida no `psql` de 26/10 (~12:20, banco `consultoria`) | Gustavo | banco |
| Central: copiar as 3 linhas novas do `roles-banco.sql` para `central-api-back/deploy/postgres/banco-app.sql.modelo` (CRLF), na próxima mudança da Central | Claude | travas do banco (865b9ca) |
| Texto dos % no editor: "Os % usam a carga de trabalho do dia, fixada quando o aluno registra a primeira etapa." | Claude | editor de séries, junto da próxima mudança nele |
| Os cinco e2e de `series-metodologia` rodarem também a 390 px | Claude | editor de séries |
| Dependabot `node-forge`, `decode-uri-component`, `uuid`: aceitos até 14/11 (só build do Expo / DoS no navegador), registro e revisão em [dependabot-28-10.md](dependabot-28-10.md); olhar ao gerar o próximo APK | Claude | Dependabot |
| Link de vídeo da técnica (Rest-pause, Cluster) quando houver vídeo aprovado do Saraiva | Gustavo | análise 2 (A8) |
| `lock_timeout` no Flyway do módulo auth (exige mudar a biblioteca `plataforma`) | Claude | travas do banco |
| Ciclo menstrual: expansão como projeto separado | Gustavo decide | ciclo |
| O perfil do aluno não recarrega o `/eu` durante a sessão (`recarregarPerfil` sai cedo). `funcionalidadesDoPlano`, `pagarNoIos`/`pagarNoAndroid` e `pagamentosHabilitados` também só se atualizam ao reabrir o app. Avaliar antes de ligar pagamentos ou o plano aplicado | Claude | frente J (ciclo desligado) |
| `AnamneseService.atribuir`: conferir o nome da restrição antes de virar `ANAMNESE_PENDENTE` em `DataIntegrityViolationException` | Claude | anamnese no aceite (1f1aa20) |
| Aceite de inscrição já aceita com questionário arquivado: devolver `INSCRICAO_JA_ACEITA` antes de `QUESTIONARIO_INDISPONIVEL` (só UX) | Claude | anamnese no aceite (1f1aa20) |

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
| Proxy: o `consultoria.servirea.com.br` responde em produção, mas não há bloco dele no Caddyfile vivo do repositório da Central (só o `.modelo`); conferir o arquivo da VPS antes de mexer no `connect-src` | Claude | cloudflare-turnstile |
| Turnstile: testar o app nativo do iPhone (WKWebView) antes do TestFlight; roteiro em `docs/build-celular.md` seção 5 | Gustavo (aparelho) | cloudflare-turnstile |

## Limitações aceitas (não são pendência)

- WS em "% da WS" fica fora da coluna de cargas por divisão (`docs/series-etapas.md`).
- Exercício sem carga aparece como "Sem carga" no relatório de cargas.
- Listas em linha (ver `listas-padronizadas.md`): rótulos acessíveis dos botões "Editar"/"Aplicar ao aluno"/"Ver produto" e do link do aluno, contraste do selo esmaecido no Catálogo, regra dos questionários para `dominio/` com teste, e2e do Catálogo/Questionários/Modelos.
