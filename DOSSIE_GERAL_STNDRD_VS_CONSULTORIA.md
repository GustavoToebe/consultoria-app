# Dossiê Geral — Análise Completa STNDRD (`uni.cbum`) × `consultoria-app`

**Data:** 2026-11-16  
**Escopo:** Consolidação integral da engenharia reversa estática e ao vivo do app **STNDRD (`uni.cbum` v4.1.65)**, comparação arquitetural e visual com o **`consultoria-app`**, registro de tudo o que já foi implementado e validado hoje no Design System/UI, auditoria das telas restantes e plano prático priorizado de evolução.

---

## 1. Linha do Tempo & Tudo o que Conversamos e Fizemos Hoje

1. **Setup e Validação do Ambiente de Análise (REA + Ferramentas):**
   * Ferramentas validadas: `rea-agents@6.9.0` (`rea`), Node `24.22.3`, ADB `37.0.3-16887417`, `Apktool 3.0.3`, `jadx-headless-mcp 0.7.1`, Java `25.0.4.101`.
2. **Extração dos 4 Split APKs e Análise Estática do STNDRD (`uni.cbum`):**
   * Dispositivo de origem: Samsung Galaxy S25 Ultra (`SM-S938B`, serial `RXCY9071D0F`, Android 17 / SDK 37, `arm64-v8a`, `ro.debuggable=0`).
   * Pacotes extraídos via `adb pull` para `stndrd-rea/apk/`: `base.apk` (127,6 MB), `split_config.arm64_v8a.apk` (51,6 MB), `split_config.pt.apk` (37,2 KB) e `split_config.xxhdpi.apk` (141,2 KB).
   * Evidências REA geradas em `stndrd-rea/rea-evidence/` e descompilação em `stndrd-rea/decompiled/`: Flutter (Dart `3.13.7` AOT em `libapp.so`, Impeller, 1.371 arquivos Dart em `package:stndrd`), assinatura Play App Signing v2/v3 + Source Stamp, Firebase (`stndrd-ea1bf`), 8 serviços Cloud Run, Algolia, RevenueCat + Play Billing `8.3.0` + Stripe (`checkout.stndrd.app`), MLKit OCR, Sentry, AppsFlyer, Mixpanel, Klaviyo, Health Connect e ausência factual de permissões/classes BLE.
3. **Captura ao Vivo via ADB (13 Prints) + Análise das 8 Telas Enviadas pelo Usuário:**
   * **Abas principais (`01`–`04`):** `01_workout_today.png`, `02_dashboard.png`, `03_nutrition_dashboard.png`, `04_more_menu.png`.
   * **Fluxo `View workout` & `Start Workout` (`05`–`13`):** `05_view_workout_overview.png`, `06_view_workout_exercises.png`, `08_start_workout_logger.png`, `09_workout_history.png`, `10_workout_prs.png`, `11_workout_swap_sheet.png`, `12_workout_rest_timer.png`, `13_workout_exit_modal.png` (sessão de teste descartada via `Exit & discard` para não poluir o histórico).
   * **Telas enviadas (`u01`–`u08`):** Dashboard completo (`Active Program`, `Bodyweight` + `Weigh-ins` 30d + `Scale weight`, `Habits` 30d, `Lifetime stats`), `Medals` (`Vaults` + `Milestones` com XP e hexágonos), `Bodyweight -> Edit Entry` (`Progress photo` Front/Back/Side no Firestore/Storage) e card `Upper - Push`.
4. **Refatorações de Design System & UI Já Implementadas e Validadas no `consultoria-app/app`:**
   * **Etapa 1 (Engine de Temas, `Marca` e `Ajustes`):**
     * `src/tema/tokens.ts` e `global.css`: hierarquia em 3 níveis (*Fundo → Card Nível 1 `#141416`/`#FFFFFF` → Poço Nível 2 → Pílula Elevada*) nos 4 temas escuros (`ESCURO`, `MEIA_NOITE`, `OCEANO`, `AMEIXA`) e 5 claros (`CLARO`, `AREIA`, `CEU`, `LAVANDA`, `ROSA`), remoção de `Café` dos seletores visíveis (`CODIGOS_PALETAS_VISIVEIS`) com fallback retrocompatível `'CAFE' -> 'ESCURO'`, e adição de `stndrd.neon.{emerald,acidLime,electricBlue,electricPurple,crimson}`, `stndrd.cta` e `stndrd.glass`.
     * `src/tema/TemaProvider.tsx`, `src/dominio/preferencias.ts`, `src/treinador/marca/FormMarca.tsx` (cartão limpo na prévia) e `src/ui/PreferenciasDoApp.tsx` (4 cartões principais + linha de variações de tom).
   * **Etapa 2 (Painel do Treinador + App do Aluno):**
     * **Treinador:** `src/ui/Botao.tsx` (`tipo="cta"`), `src/treinador/painel/BlocoDoPainel.tsx`, `CartaoMini.tsx`, `ProximoPasso.tsx`, `src/treinador/financeiro/VisaoGeral.tsx`, `ResultadoDoMes.tsx` (poços Nível 2 + filetes/badges Neon + CTA alto contraste).
     * **Aluno:** `src/aluno/BadgeNivel.tsx` (`///` Beginner/Intermediate/Advanced + `PilulaStatus`), `CartaoExercicioDoDia.tsx`, `ExercicioAluno.tsx` (série ativa em `electricBlue`, poços nos inputs), `src/app/aluno/sessao/[uid]/index.tsx` (`stndrd.cta`), `AvisoDeRecorde.tsx` (`NEW PR` + `emerald` + `glass`), `BarraDescanso.tsx` (`stndrd.glass`), `src/ui/Navegacao.tsx` (dock inferior do aluno com `stndrd.glass`).
   * **Etapa 3 (Contraste WCAG & Verificação Completa):**
     * Recalibração de `CLARO.sucesso` para `#125C32` em `tokens.ts` / `global.css` (e hash em `src/pdf/temas.test.ts`), fechando `npx tsc --noEmit` com **0 erros** e `npx jest --no-coverage` com **330/330 suítes / 8.106/8.106 testes passando** (e **0** alterações em `api/`).

---

## 2. Matriz Comparativa Completa (`CBUM / STNDRD` × `consultoria-app`)

| Módulo / Capacidade | CBUM / STNDRD (`uni.cbum`) | `consultoria-app` (Estado Atual) | Veredito / Ação |
|---|---|---|---|
| **Design System & Hierarquia** | Dark `#0B0B0B` → `#141414`/`#18181A` → `#222223`, CTA `#FCFCFC`, Liquid Glass shader | **Já implementado na base** (`tokens.ts`, `TemaProvider`, `VisaoGeral`, `ExercicioAluno`, `Navegacao`) | Expandir para as telas restantes de `treinador/`, `aluno/` e `comunidade/` |
| **`View workout` vs `Start Workout`** | `/workoutOverviewPage` (leitura) vs `/executeWorkoutPage` (timer + SQLite) | `sessao/[uid]/index.tsx` + `[exercicio].tsx` + `inicio_do_treino` | Adicionar `ResumeWorkoutBanner` no Início e botão de download offline no preview |
| **Logger de Séries** | Tabela `Set \| Reps \| Weight \| Rest \| Log It`, badge `WRK` azul, inputs em poços | `ExercicioAluno.tsx` já com `electricBlue` + poços; `PartesDaSerie.tsx` ainda antigo | Migrar `PartesDaSerie.tsx`, `CartaoSerieComEtapas.tsx` e `ConcluirTreino.tsx` (`tipo="cta"`) |
| **Rest Timer** | Faixa inline `Rest 28 sec` com `-15s`/`+15s` + notificação `rest_timer_complete` | `BarraDescanso.tsx` (já com `stndrd.glass`) | Garantir cálculo por `restEndTimestamp` (`Date.now()`) + `expo-notifications` exata |
| **Troca de Exercício (`Swap`)** | `/updatedReplaceExercisePage` via Algolia (`Swap here` / `Swap all`) | Não existe para o aluno na sessão | Criar `SwapExerciseSheet` gravando só na sessão (sem mutar plano publicado) |
| **Histórico & PRs por Exercício** | Bottom sheet `In program \| Lifetime` (`History` e `PRs`) | `recordesPessoais.ts` + `AvisoDeRecorde.tsx` + `RecordesPessoais.java` | Criar sheet por exercício, histórico de PRs (`V079`) e endpoint batch `ultimos-logs` |
| **Peso + 4 Fotos de Progresso** | `WeightLog` (`Front/Back/Side/Side`), Firestore + Storage, sparkline 7d + matriz 30d | `CartaoPeso.tsx`, `atualizacao/fotos/CampoFotos.tsx` (sem comparador 4 ângulos) | Evoluir comparador lado a lado `Front/Back/Side` + sparkline e matriz 30d |
| **Hábitos & Heatmaps 30d** | `Habits` (`Food Logged`, `Workouts Completed`) em matriz `7×5` 30 dias | `CartaoAguaDoDia.tsx` (`agua_do_dia` no SQLite) | Generalizar para Hábitos por pilares (`V078` + `banco.ts` v6) e heatmaps 30d |
| **Gamificação, Vaults, Milestones & XP** | `Medals` (`Vaults` por programa + `Milestones` em hexágonos + XP + `Lifetime stats`) | `conquista_aluno` (`V065`), sem tela dedicada nem `lifetimeStats` | Criar `estatisticas_acumuladas_aluno` (`V079`), `MedalsVault` e bloco `lifetimeStats` no perfil |
| **Nutrição, Scanner, OCR, IA & Voz** | Diário horário, FatSecret, barcode, MLKit OCR, `nutrition-scanner-api`, `speech_to_text` | `DietaDoAluno.tsx` (prescrição estática), `treinos.importacao.ia` no backend | Criar diário (`V082`), busca `pg_trgm`, barcode (`expo-camera`) e scan OCR/IA/voz via backend |
| **Comunidade & Pods** | Skool externo + `feature/pods/` no código | Mural, enquetes, comentários, aulas (`V065`–`V072`, mas `stndrd=0` na UI) | Modernizar UI de `src/comunidade/` e adicionar **Pods** (`V080`) dentro da consultoria |
| **Referrals (Indicações)** | `Referral program` (`Invite & earn`) + AppsFlyer OneLink (`stndrd.onelink.me`) | `src/app/convite.tsx` (convite básico) | Adicionar `indicacao_codigo` / `indicacao_conversao` (`V081`) + `expo-linking` |
| **Mídia HLS & Cache Offline** | `media.cdn.stndrd.app` HLS `.m3u8` + ExoPlayer + `DownloadWorkoutCubit` | `video.ts` (YouTube) + AWS S3 SDK (`pom.xml` → Cloudflare R2) | Pipeline HLS `.m3u8` no Cloudflare R2 + `expo-video` + cache `expo-file-system` |
| **Assinaturas** | Híbrido: RevenueCat + Play Billing `8.3.0` + Stripe (`checkout.stndrd.app`) | `DireitosService` (Central B2B) + InfinitePay + `vitrine/` sem checkout | Unificar em `V083` (`AcessoConsolidadoService`: Central B2B + Web + `react-native-purchases`) |

---

## 3. App do Aluno — O que Colocar, Melhorias e Correções

### 3.1 Funcionalidades do CBUM que Valem Ouro no Aluno
1. **Fluxo de Execução Contínuo:** `ResumeWorkoutBanner` (lendo `inicio_do_treino` no `banco.ts`), `expo-keep-awake` durante o treino, `SwapExerciseSheet` (`Swap here`), Rest Timer por timestamp absoluto + `expo-notifications`, e dicionário inline de técnicas (Drop-Set, Cluster, Rest-Pause).
2. **Dashboard Pessoal & `Lifetime stats`:** Card de resumo no perfil/início (treinos concluídos, tonelagem total movida em kg, dias de dieta/hábito e maior streak), matriz `7×5` de 30 dias para Treinos/Hábitos/Pesagens e bottom sheet `History | PRs` por exercício.
3. **Cofre de Medalhas (`MedalsVault`) & Milestones:** Expor `conquista_aluno` (`V065`) em tela gamificada com abas `Desafios/Programas` e `Marcos` (XP, hexágonos SVG locais).
4. **Diário Alimentar + Scanner:** Marcar refeições do plano ou registrar extras via busca rápida, código de barras (`expo-camera`) e foto/voz com parser IA no backend (sempre com aviso de estimativa e confirmação manual).

### 3.2 Correções Visuais/UX nas Telas Restantes (`src/aluno/` e `src/comunidade/`)
Conforme auditoria de código (`#39`), apenas 5 de 97 arquivos em `src/aluno/` e 0 de 20 em `src/comunidade/` já usam os novos tokens `stndrd.*`:
* **Início & Progresso:** `CartaoHoje.tsx`, `CabecalhoDoInicio.tsx`, `ProgressoSemana.tsx`, `MapaDeTreinos.tsx`, `CartaoAguaDoDia.tsx`, `PainelDoCheck.tsx`, `CartaoCompromissos.tsx`, `CartaoVitrineDoInicio.tsx` (aplicar poços `superficie2`, `BadgeNivel`/`PilulaStatus` e `tipo="cta"`).
* **Dieta:** `CartaoDietaDoInicio.tsx`, `DietaDoAluno.tsx`, `ListaDeComprasDoAluno.tsx`, `ModoDePreparo.tsx` (poços `superficie2` para totais de macros e badges Neon).
* **Execução & Perfil:** `PartesDaSerie.tsx` (ainda usa `NumeroDeDestaque` antigo), `CartaoSerieComEtapas.tsx`, `CartaoSerieDeCardio.tsx`, `ConcluirTreino.tsx` (trocar CTA para `tipo="cta"`), `atualizacao/fotos/CampoFotos.tsx`, `CartaoMeuPerfil.tsx`, `CartaoMeusDados.tsx`, `financeiro/CartaoMeuPlano.tsx`.
* **Comunidade (`src/comunidade/`):** `BlocoDaEnquete.tsx` (usa `NumeroDeDestaque` antigo), `CartaoDoPost.tsx`, `BarraDoMural.tsx`, `FolhaComentarios.tsx`, `FolhaNovaPublicacao.tsx`, `BotoesDeReacao.tsx`.

---

## 4. Painel do Treinador — O que Colocar, Melhorias e Correções

### 4.1 Ferramentas de Alto Valor Inspiradas no CBUM
1. **Comparador de 4 Fotos (`Front / Back / Side / Side`):** Evoluir `atualizacoes/` e `CampoFotos.tsx` para comparar lado a lado duas datas de check-in do aluno com peso e delta corporal.
2. **Radar de Retenção pelos Heatmaps 30d:** Exibir na ficha do aluno (`CartaoFrequencia.tsx` e `painel/`) a matriz 30 dias de treinos concluídos e hábitos, destacando queda de adesão sem punir o usuário.
3. **Alerta de `Swap` Recorrente:** Sinalizar para o treinador quando o aluno substitui repetidamente o mesmo exercício (ex.: dor ou falta de equipamento na academia) para ajuste definitivo no próximo ciclo.
4. **Criação de Desafios / `Vaults` da Consultoria:** Permitir que o treinador crie desafios de 4–8 semanas com medalhas/conquistas próprias e **Pods** (turmas/subgrupos).
5. **Prescrição de `Tempo` (Cadência) e Equipamentos:** Adicionar campo estruturado de cadência (ex.: `3/0/1/0`) e filtro por equipamento na `biblioteca/` e no editor `treinador/treino/`.

### 4.2 Correções Visuais/UX nas Telas Restantes (`src/treinador/`)
Apenas 4 de 228 arquivos em `src/treinador/` foram migrados na Etapa 2:
* **KPIs ainda em `NumeroDeDestaque` antigo (migrar para poço `superficie2` + filete `stndrd.neon`):** `ResumoDoAluno.tsx`, `CartaoFrequencia.tsx`, `CartaoPeso.tsx`, `CartaoEvolucaoRespostas.tsx`, `CartaoRecordesDaSemana.tsx`, `peso/ResumoDoPeso.tsx`, `avaliacao/CompararAvaliacoes.tsx`, `EvolucaoDaMedida.tsx`, `interessados/Indicadores.tsx`, e gráficos `painel/BarrasDoRecebido.tsx` / `RoscaDosAlunos.tsx` (trocar `useDestaques()` por `stndrd.neon`).
* **Sub-abas do Financeiro:** `AbaLancamentos.tsx`, `AbaCobrancas.tsx`, `AbaPlanos.tsx`, `AbaLembretes.tsx`, `AbaRecebimentoOnline.tsx`.
* **Módulos completos ainda sem `stndrd.*` / `tipo="cta"`:** `agenda/` (19 arquivos), `biblioteca/` (8), `planejamento/` (3) + `plano/` (17), `treino/` (30), `dieta/` (10), `vitrine/` (4), `equipe/` (5), `documentos/` (3), e rotas `alunos/`, `atualizacoes/`, `numeros.tsx`, `comunidade.tsx`.

---

## 5. O que NÃO Copiar do CBUM (Filtro YAGNI / Arquitetura Pragmática)

* **Não migrar para Firebase / Firestore / 8+ Cloud Run:** O `consultoria-app` já tem **Spring Boot 4.1.1 + PostgreSQL + Flyway**, com transações ACID, multi-tenancy nativo (`consultoria_id`), custo previsível e zero *vendor lock-in*.
* **Não contratar Algolia:** PostgreSQL com **`pg_trgm` + `unaccent` + índice GIN** entrega busca instantânea (< 30 ms) em exercícios e alimentos sem custo mensal extra nem sincronização de índice externo.
* **Não multiplicar SDKs de analytics/CRM (AppsFlyer + Mixpanel + Klaviyo + Beacon + Slack Notifier):** Manter `@sentry/react-native` + `plataforma-comum-monitoramento` e uma fila leve de eventos de funil no próprio SQLite → `POST /telemetria/eventos` (conformidade LGPD).
* **Não pedir permissões Bluetooth/Nearby Devices sem uso real:** Como verificado estaticamente no APK do STNDRD, ele não usa `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT` nem `BluetoothGatt`; manter o `consultoria-app` limpo até existir integração real de cinta cardíaca BLE.
* **Não usar chave de IA no app mobile:** Reaproveitar `treinos.importacao.ia` (Gemini/Claude) exclusivamente no backend `treinos-api`.

---

## 6. Roadmap Priorizado (Curto, Médio e Longo Prazo)

| Prazo | Foco | Entregas Concretas |
|---|---|---|
| **Curto Prazo (Quick Wins)** | Fechar paridade visual + fluidez imediata na academia | Migrar telas restantes de `aluno/`, `treinador/` e `comunidade/` para `superficie2` + `stndrd.neon` + `tipo="cta"`; implementar `ResumeWorkoutBanner` (`inicio_do_treino`), `expo-keep-awake`, Rest Timer por timestamp absoluto + `expo-notifications`, auto-sync com `NetInfo`, `@sentry/react-native` e build `.aab` (Hermes + R8). |
| **Médio Prazo (Core Retenção & Valor)** | Engajamento diário, nutrição ativa e ferramentas do treinador | Migrations `V078`–`V082` + `banco.ts` v6: `SwapExerciseSheet` + alerta de swap para treinador, `History \| PRs` por exercício, Hábitos por pilares + Heatmaps 30d, `lifetimeStats` + `MedalsVault`, comparador de 4 fotos (`Front/Back/Side`), Diário Alimentar + busca `pg_trgm` + Barcode (`expo-camera`) + Scanner OCR/IA/Voz (`treinos.importacao.ia`), Pods (`V080`) e Referrals (`V081`). |
| **Longo Prazo (Escala & Ecossistema)** | Mídia própria, monetização híbrida e wearables | Pipeline de vídeos HLS (`.m3u8`) no Cloudflare R2 + `expo-video` + download offline de treinos; `V083` (`AcessoConsolidadoService` unificando Central B2B + Web Checkout + `react-native-purchases`/RevenueCat); Health Connect / Apple Health (opt-in) e futura interface `MonitorCardiacoService` (BLE). |
