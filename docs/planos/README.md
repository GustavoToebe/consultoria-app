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

## Pendências soltas

| Pendência | Quem | Origem |
| --- | --- | --- |
| Conferir que a "Anamnese Saraiva Team" está publicada em Planejamento › Anamnese | Gustavo | anamnese |
| Ver no celular se os títulos das seções do editor de séries (caixa alta 12 px) ficaram bons | Gustavo | editor de séries (5d353d0) |
| Gerar APK novo (`npx eas-cli build --profile preview --platform android`) e repetir o roteiro de `docs/build-celular.md` | Gustavo | etapas, cronômetro, editor |
| Teste manual na web do roteiro de Cluster e Rest-pause com um aluno de teste | Gustavo | etapas |
| Dispensar o alerta do Dependabot do `braces` ("Inaccurate") | Gustavo | Dependabot |
| Apagar a branch `etapas-por-bloco` (nada fora da `main`) | Gustavo | limpeza |
| Lembrar o que era a alteração revertida no `psql` de 26/10 (~12:20, banco `consultoria`) | Gustavo | banco |
| Central: copiar as 3 linhas novas do `roles-banco.sql` para `central-api-back/deploy/postgres/banco-app.sql.modelo` (CRLF), na próxima mudança da Central | Claude | travas do banco (865b9ca) |
| Texto dos % no editor: "Os % usam a carga de trabalho do dia, fixada quando o aluno registra a primeira etapa." | Claude | editor de séries, junto da próxima mudança nele |
| Os cinco e2e de `series-metodologia` rodarem também a 390 px | Claude | editor de séries |
| Dependabot `node-forge`, `decode-uri-component`, `uuid`: esperar atualização do Expo; olhar ao gerar o próximo APK | Claude | Dependabot |
| Link de vídeo da técnica (Rest-pause, Cluster) quando houver vídeo aprovado do Saraiva | Gustavo | análise 2 (A8) |
| `lock_timeout` no Flyway do módulo auth (exige mudar a biblioteca `plataforma`) | Claude | travas do banco |
| Ciclo menstrual: expansão como projeto separado | Gustavo decide | ciclo |
| `AnamneseService.atribuir`: conferir o nome da restrição antes de virar `ANAMNESE_PENDENTE` em `DataIntegrityViolationException` | Claude | anamnese no aceite (1f1aa20) |
| Aceite de inscrição já aceita com questionário arquivado: devolver `INSCRICAO_JA_ACEITA` antes de `QUESTIONARIO_INDISPONIVEL` (só UX) | Claude | anamnese no aceite (1f1aa20) |

| Mercado Pago: provar com um reenvio real se o `ts` muda; se repetir, rever a janela de 5 min do webhook da Central | Gustavo/Claude | revisão de segurança 28/10, item 1 |
| CI: Trivy reprovou a imagem da web por `go-jose` 4.1.5 (CVE-2026-116587) no `caddy:2-alpine`; exceção até 14/11 no `.trivyignore`. Até 14/11: ver se o Caddy já traz go-jose 4.1.6, Go 1.26.10 e x/net 0.60.0 e apagar as exceções | Gustavo | run 40714486714 |
| Trivy, mesma exceção no Servirea (`.trivyignore` do front e dos terceiros: 116587, 111943, 111497 e 92392 até 14/11), no próximo lote dele; a Central já está feita ([central-seguranca-28-10.md](central-seguranca-28-10.md)) | Claude | run 40714486714 |
| PDF no celular: copiar o arquivo do `expo-print` em vez de passar o PDF todo em base64 (`pdf/imprimir.ts`). Só provando no APK, Android e iPhone | Gustavo (aparelho) | PDFs, item 4 |
| Conferir no APK que a logo grande sai reduzida no PDF do aluno e do treinador | Gustavo | PDFs, item 2 |
| `imprimir.web.ts` sem `innerHTML`: não recomendado agora (a trava de teste cobre); Gustavo pode reabrir | Gustavo decide | revisão de segurança 28/10, item 3 |
| Cloudflare: a regra "Bloqueio por pais (Fase 6B)" (`adfb3957…`) bloqueia tudo fora do Brasil; manter ou tirar | Gustavo decide | cloudflare-turnstile |
| Proxy: o `consultoria.servirea.com.br` responde em produção, mas não há bloco dele no Caddyfile vivo do repositório da Central (só o `.modelo`); conferir o arquivo da VPS antes de mexer no `connect-src` | Claude | cloudflare-turnstile |
| Turnstile: testar o app nativo do iPhone (WKWebView) antes do TestFlight; roteiro em `docs/build-celular.md` seção 5 | Gustavo (aparelho) | cloudflare-turnstile |

## Limitações aceitas (não são pendência)

- WS em "% da WS" fica fora da coluna de cargas por divisão (`docs/series-etapas.md`).
- Exercício sem carga aparece como "Sem carga" no relatório de cargas.
- Listas em linha (ver `listas-padronizadas.md`): rótulos acessíveis dos botões "Editar"/"Aplicar ao aluno"/"Ver produto" e do link do aluno, contraste do selo esmaecido no Catálogo, regra dos questionários para `dominio/` com teste, e2e do Catálogo/Questionários/Modelos.
