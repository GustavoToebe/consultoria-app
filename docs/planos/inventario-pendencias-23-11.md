# Inventário consolidado de planos e pendências (23/11/2026)

- **Data do levantamento:** 23/11/2026
- **Branch de transferência:** `origin/handoff-23-11` (12 commits locais da `main` até `64d53f30`, sem tocar `origin/main`)
- **Total de arquivos `.md` varridos em `docs/planos/`:** 168
  - **100% fechados/concluídos/auxiliares:** 80 arquivos (74 planos fechados + 6 guias/modelos/mensagens auxiliares)
  - **Com algum passo `[ ]` ou situação em aberto:** 88 arquivos (68 com checkboxes `- [ ]` + 20 com `Situação:` aberta/em andamento/planejando)

---

## Atualização de 23/11 (outro PC, depois do push)

Fonte: `git`/`gh` só leitura na `main` em `193e96bd` mais a inspeção do PC antigo. Vale até a próxima mudança nas branches remotas.

- **Bloco 0:** `"temaPdf"` no teste (`193e96bd`). Testes restantes da API (inscricoes, tenant, termos, treino, unidadecarga, vitrine, web, whatsapp) 328/328. `npm test` 385 suítes, 9.212 testes. Push da `main` feito (`3b600afb..193e96bd`) e este inventário trazido por cherry-pick. **Falta:** e2e `comunidade.spec.ts`, APK preview, apagar `origin/handoff-23-11`.
- **Itens "abertos" que eram só branch já entregue (fechar no plano de cada um quando for mexer nele):** agenda-calendario (#16), atualizacao-visual-app-full (#18), clareza-do-treinador (#17), historico-ajustes-g (#51), cupom-suplemento (#52), ver-como-aluno (#53), interessados-busca-vazia (#73), foco-da-folha-nativo (#75, falta só o aparelho), auditorias (#54, #55, #63, #64, #67, #68, #70), paginas-publicas (#95), miudos-sem-api (entrou no #96 `lote-04-11-b`), copiar-periodo-na-pasta (#92 fechado, conteúdo na `main`), agua-do-aluno (V046 na `main`). Prováveis, sem conferir a ponta: `evo-*` (via #13) e `wt-editores-revisao-2`.
- **infra-04-11:** mesclada na Central (#35) e no Servirea (#17). No consultoria-app nunca houve branch.
- **grupos-do-menu:** o código está na `main`. Faltam só PDFs, Ajuda e docs.
- **Descartadas sem merge:** `pendencias-04-11-b` (detalhe em [pendencias-04-11.md](pendencias-04-11.md)) e `foto-no-circulo` (#90 fechado, a `main` tem outra implementação).
- **Branches remotas já na `main` (podem ser apagadas):** biblioteca-unificada, dietas-padrao, modelos-padrao, correcoes-lote-04-11-b, escolha-receita, pendencias-04-11-a/c, editor-treino-alinhamento, editor-treino-inspetor, inscricao-saraiva, libras-fase-2, migracao-assistida-fase-2, lote-04-11, lote-04-11-b, pos-lote-04-11, miudos-com-api, paginas-publicas, top-set-restaurado. Sem PR ou com PR fechado (criar tag `arquivo/<nome>` antes de apagar): paletas-previa, copiar-periodo-na-pasta, montador-de-telas, grupos-do-menu, nome-overtraining, cores-por-tipo-previa, foto-no-circulo.
- **PC antigo:** nenhum commit fora dos remotos além de `f638a1f7` (`noite-n2`, já integrado em `0b1064d6`). A `main` de lá (`aa0861aa`) diverge da `origin/main`: rodar `git fetch` e depois `git reset --hard origin/main`. O arquivo não rastreado `docs/teste-infinitepay-16-11-2026.md` continua só lá.
- Os planos individuais acima **não** foram atualizados, exceto `pendencias-04-11.md`.

---

## Bloco 0 — Bloqueio imediato para subir `main`

1. **Corrigir `InscricoesIntegrationTest.java:163`:** o método `paginaPublicaMostraAMarcaEOTextoEFechadoOuDesconhecidoDa404` espera exatamente `["id", "nome", "corPrimaria", "fonteTitulo", "temaPadrao", "logoUrl"]` na `marca` pública, mas `MarcaPublica` passou a expor `"temaPdf"` (`V096`). Adicionar `"temaPdf"` na asserção.
2. **Rodar os testes restantes na `main`:**
   - `mvn -f api/pom.xml verify` (cobrindo `InscricoesIntegrationTest`, `treino/`, `vitrine/`, `whatsapp/`, `FlywayMigrationIntegrationTest`, `PapeisBancoIntegrationTest`).
   - `npm --prefix app run test` e `app/e2e/comunidade.spec.ts` (confirmar remoção do `test.fail` da barra 390 px com `"Mural"`).
3. **Publicar e limpar:**
   - `git push origin main` (apenas após `mvn verify` e suíte do `app/` 100% verdes).
   - Apagar a branch temporária: `git push origin --delete handoff-23-11`.
   - Gerar APK `preview` no EAS (`app/`): `npx eas-cli build --profile preview --platform android --non-interactive --no-wait`.

---

## Bloco 1 — Financeiro, Pagamentos, Cobrança, Vitrine/Loja e Central

| Arquivo / Frente | Situação atual | O que falta (`[ ]` / Fase futura / Pendência) |
|---|---|---|
| `financeiro-em-fases.md` | Fase 1 concluída (`V087`); F1–F5 (`V090`–`V094`) e Kiwify F7 (`V095`) na `main` | **Fase 2:** `2.1` Extrato de entradas e saídas (não iniciado), `2.4` "Continuar incluindo" no lançamento (**feito em 23/11**, `d003c28e` e `5cc1e87c`), `F6` (**fechado em 23/11**, ver o plano), `F7` (revisão/docs Kiwify). **Depois da N2:** `N.1` validar lembrete WhatsApp em número real. **Fase 3 (opcional):** `3.1` taxa por forma de pagamento ("líquido estimado"), `3.2` Eduzz e Inter automáticos. **Pendências de negócio/UX:** multa/juros automáticos, entrada e rascunho de acordo, editar valor por parcela (`README.md:258`), campos escondidos (CNPJ, pagador diferente, crédito, CPF, `README.md:288`), `AbaLembretes` piscando em coluna única (`README.md:293`), `R1121-C03` (entrada/saldo no acordo) e `R1121-C06` (destaque visual de atraso). |
| `planos-ativos-do-aluno.md` | API (`V091`) e telas na `main` | Passo `3` **fechado em 23/11** (os testes, o `AGENTS.md` e a Ajuda já estavam na `main` desde `812448ff`; 8 testes verdes). Decisão em aberto (`README.md:257`): esconder ou não do aluno itens fora do plano contratado. |
| `saida-e-tempo-minimo.md` | API (`V074`) e telas na `main` | Pendência P4 (`README.md:273,277`): inativação em lote e importação inativam sem aviso do que fica em aberto/mínimo perdido; reavaliar tempo mínimo para planos não-mensais se houver caso. |
| `lembretes-de-cobranca.md` | Código na `main` | **Fechado em 23/11**: `mvn verify` completo e e2e do financeiro verdes; o caso do `VisaoGeralComMeusIntegrationTest` já estava na `main` (`cea539a8`). |
| `mercado-pago-roteiro-04-11.md` | Roteiro pronto (Central) | Aguarda teste manual do Gustavo na Central (`ts` / webhook). |
| `vitrine-e-loja.md` | F1 (`V075`), F2a (`V077`), F3 API (`V079`) na `main` (flags `false`) | **F2b inteira em aberto** (`F2b.1`–`F2b.4`: checkout/pedido público `pedido_da_loja`, `PedidosDaLojaController`, entrega de planilha/modelo); **F3.2–F3.3** (falta rota/tela `/consultorias` no app + e2e + revisão); **F1.4 / F2a.3** (fechamento/guias). **Pendência jurídico/fiscal (`README.md:271`):** comissão, NF, CDC 7 dias, menor de idade, regras Apple/Google. |
| `cupom-suplemento.md` | Branch/PR `cupom-suplemento` | Aguarda merge/revisão (conforme status do plano). |
| `cobrancas-acumuladas.md` | Substituído | Substituído por `financeiro-em-fases.md` (5 checkboxes antigos descartados). |
| Teste manual InfinitePay | Parcial (`README.md:267`) | Falta concluir roteiro R$ 1,00 (InfiniteTag, PIX, mesmo link 2x, 2 parcelas, estorno, baixa automática na mesma API). |

---

## Bloco 2 — Todas as demais áreas (todos os arquivos abertos)

### Domínio, Produção, Infra, Segurança e LGPD
- `dominio-overtraining-app.md`: faltam registro DS na GoDaddy, chave/remetente `overtraining.app` no Resend da VPS, merge do PR Central #39 e conferência dos URLs na Central.
- `cloudflare-turnstile.md`: ligado em produção; falta teste no iPhone nativo antes do TestFlight.
- `infra-04-11.md`: pendências de infraestrutura nas branches `infra-04-11` (consultoria-app, Servirea e Central).
- `dependabot-28-10.md`: próxima revisão de dependências em 28/11 (`decode-uri-component` aguarda SDK 58; `uuid` só no prebuild Xcode).
- `revisao-seguranca-28-10.md`: 1 item aberto de revisão de segurança na `main`.
- `teste-5-alunos.md`: 7 itens de preparação do piloto em produção.
- *Pendências soltas de Infra/LGPD (`README.md`):* revisão jurídica de menores de idade nos Termos/Anamnese + responsável financeiro (`L325`), revisão LGPD de "Hormonizado ou natural" na inscrição pública (`L326`), trocar `TREINOS_EMAIL_NOME_APP`/`REMETENTE` de "Consultoria" para "Overtraining" na VPS (`L324`), ligar `TREINOS_RETORNO_HABILITADO=true` na VPS (`L300`), dividir `AGENTS.md` (`L297`), índices/otimização de `findTop300ByAlunoIdIn` quando crescer (`L298`).

### Contato, WhatsApp e E-mail
- `contato-da-consultoria.md`: N2 WhatsApp Meta (`V097`) portado e integrado na `main` (`0b1064d6`); faltam **B5–B6** (domínio próprio de e-mail via Resend), **B4** (conferência final no hub), **B11–B13** (guias/e2e/revisão N2 e teste real na Meta).
- `libras.md`: Fase 1 e 2 na `main`; conferir comportamento em produção conforme uso.

### Mobile, Push e iOS
- `foco-da-folha-nativo.md`: código/testes prontos na branch; falta conferir em aparelho nativo.
- `expo-sdk-58.md`: 7 passos planejados para atualização futura ao SDK 58.
- *Pendências soltas Mobile/iOS (`README.md:275`):* credenciais FCM (`google-services.json`) e APNs para push real; teste em iPhone físico (Turnstile no WKWebView, player YouTube no WebView, módulo Swift `excluir-do-backup`).

### Documentos PDF
- `documentos-pdf-motor.md`: `V096` persiste `temaPdf`; faltam **0.1** prova no WebView Android/iOS, **1.2** interruptores de estrutura (`mostrarSemana`, `mostrarGlossario`, `mostrarInstrucoes`, `quebrarPorSessao`, `mostrarPesos`, `rodapePadrao`), **2.1/2.2** `config_pdf` jsonb + propagação completa, **3.2/3.3** e2e/revisão, e "Testar com aluno" na prévia (`README.md:270`).
- `pdfs-otimizacao.md`: item 4 e conferência no APK pendentes.

### Comunidade e Engajamento
- `comunidade-19-11.md`: barra 390 px fechada (`"Mural"`, `64d53f30`); falta testar "Sair sem salvar?" das folhas em APK nativo e decidir limpeza de fotos pendentes ao descartar (`README.md:253–255`).
- `comunidade-playlists.md`: C36 (até 4 fotos), C25 (capa YouTube) e C39 (abas Avisos/Alunos) com partes pendentes de integração/commit; passo 12 pendente.
- `comunidade-enquetes-reacoes-video.md`: 4 passos em aberto (app após API); decidir push de Aviso (`README.md:296`).
- `filtro-de-conteudo-comunidade.md`: aguardando fechamento/validação da onda.
- `nome-no-mural.md`: 2 itens abertos (decisão sobre aluno inativo com apelido).
- `perfil-estilo-steam.md`: sobras registradas no `README.md:302` (foto buscada 2x, lista de colegas em memória, conferência nativo/libra).
- `pods-da-comunidade.md`: 4 itens abertos aguardando decisão do Gustavo.
- `xp-e-niveis.md`: planejando (aguarda decisões do Gustavo; nenhum código).
- `video-hls.md`: 9 passos abertos (planejando; aguarda decisão de fornecedor e orçamento; nenhum código).

### Treino, Dieta, Editor, Agenda e Ficha do Aluno
- `agenda-calendario.md` / `agenda-presencial.md`: pendências antigas de integração/branch (`evo-agenda`, `agenda-calendario`) + `README.md:285` (resumo junto ao evento / criar clicando no horário vazio).
- `agua-do-aluno.md`: passo final de publicação (branch `agua-do-aluno`).
- `aniversarios.md`: fechamento/push da Onda 2F.
- `avaliacao-fisica.md`: 1 passo aberto (rodar `mvn verify` / juntar branch `evo-avaliacao`).
- `dieta-por-dia-da-semana.md`: falta passo 7 (revisão final + APK novo).
- `dieta-pronta-para-comecar.md`: 13 abertos (passos 9–12: subtotal/Total do dia, cor mínima, sugestão profissional; rolagem C61 no APK; decisão C49 conversão g→un).
- `dieta-tabela-e-arrastar.md`: parte 1 em curso (1280 e `"Trocar alimento"` fechados em `64d53f30`).
- `fibra-do-alimento.md`: passo 6 (demais nutrientes ficam para depois).
- `editor-de-mobilidade-no-padrao-do-editor.md`: pendente de fechamento/commit final de docs.
- `editor-de-series-rir-e-carga-fixa.md`: passo 5b (Gustavo).
- `editor-de-treino-reorganizado.md`: falta atualizar `docs/design-e-front.md` (passo 4).
- `editor-de-treino-visual.md`: 1 item aberto (branch `atualizacao-visual-app-full`).
- `editor-e-modelos-achar-as-coisas.md`: 12 itens abertos (planejando; aguarda confirmação do Gustavo; nenhum código).
- `editores-revisao.md`: 1 item aberto (worktree `wt-editores-revisao-2` / limpeza de branch).
- `evolucao-dieta-e-pdfs.md`: 1 item aberto (Docker `mvn verify` / merge da `evo-dieta-pdf`).
- `evolucao-lista-de-compras.md`: 1 item aberto (merge/publicação de `evo-compras` e `evo-categorias`).
- `evolucao-prime.md`: 1 item residual pós-merge.
- `fatores-de-alimento-nativos.md`: 1 item aberto (conferência visual pós-deploy da V060).
- `ficha-do-aluno-cabecalho.md`: 1 item aberto (`AGENTS.md` / revisão).
- `ficha-do-aluno-em-abas.md`: 1 item aberto (planejando).
- `fotos-guiadas.md`: 2 itens abertos (verificação completa/e2e).
- `inicio-e-agenda.md`: 12 itens abertos (planejando; aguarda confirmação; nenhum código).
- `inicio-editavel.md`: 3 itens abertos (decisões/evoluções após P1).
- `interessados-busca-vazia.md`: pendência na branch `interessados-busca-vazia`.
- `lembretes-do-compromisso.md`: 1 item aberto (gerar APK novo para notificação local).
- `receitas-em-blocos.md`: 5 itens abertos (planejando; aguarda lista do treinador).
- `series-redesenho.md`: 1 item aberto (migration única de receitas para PRD).
- `tags-de-aluno.md`: 2 itens abertos (revisão independente e fechamento de docs).
- `treino-do-aluno-lacunas-cbum.md`: 2 itens abertos (validação final em integração/aparelho).
- `trocar-exercicio.md`: 3 itens abertos (planejando/fechamento de decisões).

### Importação
- `importacao-modal.md`: pronto localmente sem commit específico registrado no índice (tela já na `main`).
- `importar-plano-de-documento.md`: 3 itens abertos (aceitação real do texto do Plano 15.2 em produção, `README.md:308`).
- *(Nota: `importacao-assistida-ia.md` e `importacao-guiada.md` estão implementados e endurecidos em `5d375812`, atrás das flags `TREINOS_MIGRACAO_ASSISTIDA_HABILITADA=false` e `TREINOS_IA_ENVIAR_DADOS_AO_PROVEDOR=false`.)*

### Visual, Auditoria UI/UX, Configurações e Rotinas
- `areia-contraste-e-cor.md`: passos 7 a 10 em aberto (1–6 substituídos por `hierarquia-visual-tres-temas.md`).
- `arrastar-com-copia-translucida.md`: fechadas decisões na web (`64d53f30`); falta conferir toque longo no aparelho, areia e alto contraste.
- `atualizacao-visual-app-full.md`: 5 itens abertos (branch `atualizacao-visual-app-full`).
- `auditoria-aluno.md`, `auditoria-cores.md`, `auditoria-ficha.md`, `auditoria-treinador.md`, `auditoria-ui-ux-lote-1.md`: itens residuais/revisões em branches antigas de auditoria.
- `clareza-do-treinador.md`: aguardando fechamento/merge de branch antiga.
- `composicao-visual.md`: passos 5 e 6 abertos.
- `configuracoes-centralizadas.md`: passos 3, 4 e 5 em aberto (confirmação H1–H10, Ajuda e `AGENTS.md`).
- `copiar-periodo-na-pasta.md`: pronta para revisão na branch `copiar-periodo-na-pasta`.
- `cores-de-destaque.md`: 3 itens abertos (definição de cobertura de nulo nos indicadores, passo 8).
- `hierarquia-visual-tres-temas.md`: falta prancha e conferência visual do Gustavo + APK novo (`expo-blur`).
- `historico-ajustes-g.md`: ajustes pendentes na branch `historico-ajustes-g`.
- `limpeza-do-estudo-stndrd.md`: 3 itens abertos (limpeza de arquivos/referências do estudo).
- `menu-grupos-recolhiveis.md`: 1 item aberto (fechamento final).
- `miudos-sem-api-04-11.md`: código pronto para revisão na branch `miudos-sem-api`.
- `nulo-e-cobertura.md`: passos 4 e 5 pendentes (contrato `cobertura` e revisão).
- `paginas-publicas.md`: aguardando revisão/merge na branch `paginas-publicas`.
- `paletas-da-marca.md`: falta passada local com capturas (passo 6) e revisão (passo 7).
- `pendencias-04-11.md`: 3 itens abertos nas branches `pendencias-04-11-*`.
- `roteiro-teste-lote-13-11.md`: 60 itens de teste manual do Gustavo.
- `secoes-nascem-fechadas.md`: 2 itens abertos (menu lateral aguarda confirmação D7, `AGENTS.md`).
- `telas-do-aluno-visual.md`: 3 itens abertos (branch `atualizacao-visual-app-full`).
- `ver-como-aluno.md`: aguardando revisão/merge (PR #53).

---

## Bloco 3 — Decisões de negócio / Reuniões de 18/11 e 21/11

1. **Piloto com 5 alunos + 10 PDFs reais:** validar importação assistida (decidir ligar `TREINOS_MIGRACAO_ASSISTIDA_HABILITADA` e provedor de IA `TREINOS_IA_PROVEDOR` / `TREINOS_IA_ENVIAR_DADOS_AO_PROVEDOR` na VPS).
2. **Apple Developer / iOS:** contratar/renovar conta Apple Developer para gerar builds TestFlight, configurar APNs e validar WKWebView/iCloud backup no iPhone físico.
3. **Lucas / NSG:** alinhamento comercial/técnico pendente fora do código.
4. **Oferta comercial e pré-contrato:** definir estrutura dos planos por módulo (hoje `TREINOS_PLANO_APLICAR=false`, suportando `MOBILIDADE`, `PDF`, `EQUIPE`) e pré-contrato/termos para consultorias e alunos menores de idade.
5. **Onboarding:** gravar vídeos curtos e preencher `app/src/ajuda/videos.ts` (`VIDEOS_DA_AJUDA` hoje está vazio).
6. **Ficha curta WhatsApp (`R1030-C62`):** definir formato resumido para envio rápido via WhatsApp.
7. **Métrica "Pagou" (`R1121-C04`):** definir critério exato no painel financeiro (competência vs data de pagamento/baixa).
8. **Bug meia tela (`R1115-C130`):** reproduzir e corrigir layout em largura intermediária reportado na reunião.

---

## Bloco 4 — Referência rápida dos planos 100% fechados (74 planos + 6 auxiliares = 80)

- **Planos fechados (74):** `agenda-estilo-google.md`, `ajustes-do-back.md`, `ajustes-e-funcionalidades-12-11.md`, `ajustes-evolucao.md`, `ajustes-menu-rolagem-whatsapp.md`, `ajustes-video-30-10.md`, `alertas-de-troca.md`, `anamnese-no-aceite.md`, `areia-do-saraiva.md`, `auditoria-pecas.md`, `auditoria-ui-ux-2026-11-03.md`, `avaliacao-fisica-visual.md`, `biblioteca-unificada-alimentos-suplementos.md`, `central-seguranca-28-10.md`, `ciclo-desligado-no-app.md`, `composicao-de-telas-12-11.md`, `comunidade-organizada-e-mapa.md`, `comunidade-perfil-e-apelido.md`, `conferencia-pendencias-04-11.md`, `cor-da-variacao-do-peso.md`, `cores-por-tipo-de-serie.md`, `datas-validas.md`, `docs-pendencias-03-11.md`, `editar-alimento-macros-e-cor-da-fibra.md`, `editor-de-treino-series-no-padrao-da-dieta.md`, `editor-treino-inspetor.md`, `engajamento.md`, `entrada-por-publico.md`, `execucao-referencia-e-progressao.md`, `ficha-dados-do-aluno-em-secoes.md`, `filtros-da-lista-de-alunos.md`, `filtros-laterais.md`, `filtros-nas-listas.md`, `financeiro-numeros-19-11.md`, `formularios-unificados.md`, `historico-peso-do-aluno.md`, `importacao-assistida-ia.md`, `importacao-guiada.md`, `importacao-planilha-completa.md`, `importacao-tela-inteira.md`, `impressao-sem-innerhtml.md`, `indicacao-de-alunos.md`, `inscricao-com-perguntas-proprias.md`, `inscricao-saraiva.md`, `interessados-crm.md`, `larguras-ajustes-novo-aluno.md`, `larguras-das-telas.md`, `listas-padronizadas.md`, `meus-dados-do-aluno.md`, `migracao-assistida.md`, `miudezas-03-11.md`, `miudos-com-api-04-11.md`, `modelos-padrao-do-sistema.md`, `montador-de-telas.md`, `pasta-publicar-copiar-finalizar.md`, `peso-visual.md`, `push-do-expo.md`, `relatorio-biblioteca.md`, `revisao-07-09-11.md`, `saida-e-tempo-minimo.md`, `superficies-das-paletas-claras.md`, `supervisao-da-equipe.md`, `tela-larga.md`, `visual-vendavel.md`, `visual-vendavel/back.md`, `visual-vendavel/guia-premium-no-app.md`, `visual-vendavel/guia-telas-restantes.md`, `visual-vendavel/S1-marca-em-rampa.md`, `visual-vendavel/S2-cor-de-identificacao.md`, `visual-vendavel/S3-hierarquia.md`, `visual-vendavel/S4-inicio-do-treinador.md`, `visual-vendavel/S6-aluno-inicio-e-treino.md`, `visual-vendavel/S7-dieta.md`, `visual-vendavel/S8-mobilidade.md`.
- **Auxiliares / modelos / guias (6):** `README.md`, `MODELO.md`, `mensagem-claude-local-alunos.md`, `mensagem-claude-local-app-full.md`, `mensagem-claude-local-editor.md`, `visual-vendavel/guia-sem-barra-e-ficha.md`, `visual-vendavel/S5-lista-e-ficha-do-aluno.md` *(nota: contando `README.md` + `MODELO.md` + 3 `mensagem-*` + 2 de `visual-vendavel/` = 7 arquivos auxiliares/não-plano; somados aos 88 abertos + 73/74 fechados fecham os 168 totais)*.
