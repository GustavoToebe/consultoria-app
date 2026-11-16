# Guia Visual de Telas e Componentes — STNDRD (`uni.cbum`) → `consultoria-app`

> **Fonte das evidências:** Capturas reais ao vivo via ADB (`01`–`04`, `05`–`13`) e telas enviadas (`u01`–`u08`), cruzadas com análise estática de `libapp.so` (`stndrd-dart-files.txt`, `libapp-strings.txt`), `PARTE_DOMINIO_UI.md`, `PARTE_API_AUTH.md`, `RELATORIO_STNDRD_REA.md` e estrutura real do `consultoria-app/app`.

---

## 1. Design System & Identidade Visual do STNDRD (`uni.cbum`)

- **Estética:** *Dark Minimalist / Editorial Athletic Brutalism* com superfícies em 3 níveis (`#0B0B0B` fundo → `#141414`/`#18181A` card → `#0B0B0D`/`#222223` poço/pílula), scrims modais `#050505`, bordas finas `#222223`/`#2C2C2E`, texto primário e CTA branco de alto contraste `#FCFCFC` (texto preto `#09090B`), secundários `#878787`/`#747474`/`#BCBBBB`.
- **Liquid Glass:** Barra inferior e docks flutuantes usam `package:liquid_glass_widgets` + shader `assets/shaders/progressive_backdrop_blur.frag` (`GlassAdaptiveScopeData`, `GlassThemeSettings`).
- **Acentos Semânticos:** Azul elétrico (`Live`, série ativa `WRK`, botão `Log It` marcado), âmbar/dourado (`Superset`, `A1`/`A2`, badges XP), gradiente azul profundo (`#091627` → `#091A31` no card Skool) e verde-oliva (`Invite & earn`).

### 1.1. Mapeamento para `app/src/tema/tokens.ts` no `consultoria-app`
- `ESCURO` / `MEIA_NOITE` / `OCEANO` / `AMEIXA` e `CLARO` / `AREIA` / `CEU` / `LAVANDA` / `ROSA` já implementam a hierarquia de 3 níveis + `stndrd.neon.{emerald,acidLime,electricBlue,electricPurple,crimson}`, `stndrd.cta` e `stndrd.glass`.

---

## 2. Abas Principais (`01`–`04` + `u08`)

1. **Workout (`01_workout_today.png`, `u08_upper_push.jpg` — `/workout` → `workout_page.dart`, `BottomNavCubit`):**
   - Header do programa (`active_program_appbar.dart`), meta semanal (`transformation_progress_card.dart`), seletor de semana (`active_program_week_selector.dart` + `active_program_day_strip.dart`), Hero Card (`live_program_featured_day_card.dart` com pill `Live`, `141 completions`, `5 Exercises | 16 Sets | 45 Minutes`, botões `View workout` e `Start Workout`).
   - **No `consultoria-app`:** `src/app/aluno/treino.tsx`, `src/aluno/CartaoHoje.tsx`, `src/aluno/DatasDaDivisao.tsx`, `src/ui/Navegacao.tsx` (barra inferior com `stndrd.glass`).
2. **Nutrition (`03_nutrition_dashboard.png` — `/nutrition` → `nutrition_page.dart`, `NutritionCubit`):**
   - Seletor de data (`nutrition_calendar_bottom_sheet.dart`), barra compacta de macros (`macros_compact_pager_view.dart` + `macro_daily_total_item.dart`), timeline vertical por hora (`DailyNutritionTimelineUpdateCubit`, `SaveTimelineCubit`) e action bar (`bottom_menu_bar.dart`: `Search` via `FatSecretSearchCubit`, `Easy Track` IA + voz, `Scan` `ScannerCubit` + MLKit OCR, `Quick Cals`).
   - **No `consultoria-app`:** evoluir `src/app/aluno/dieta.tsx` com diário alimentar, busca `pg_trgm`, barcode `expo-camera` e parser IA no backend.
3. **More (`04_more_menu.png` — `/accounts` → `accounts_page.dart`, `account_header.dart`, `community_promo_sheet.dart`):**
   - Avatar + `0 XP` (`/gamification`), banner Skool (`#091627` → `#091A31`), `Shop Apparel`, `Referral program` (`Invite & earn` + `stndrd.onelink.me`), `Manage Profile/Notifications/Subscriptions`, `Message Support`.
   - **No `consultoria-app`:** `src/app/aluno/conta.tsx`, `src/aluno/CartaoMeuPerfil.tsx`, `src/aluno/BadgeNivel.tsx` (`PilulaStatus`).

---

## 3. Fluxo `View workout` & `Start Workout` (`05`–`13`)

| Tela Capturada | Rota / Arquivos Reais em `libapp.so` | Mecanismo & Equivalente no `consultoria-app` |
|---|---|---|
| **`05`–`06` View workout** | `/workoutOverviewPage` (`workout_overview_page.dart`, `workout_overview_flexible_spacebar.dart`, `workout_overview_actions.dart`, `workout_overview_scroll_body.dart`, `workout_equipments_view.dart`) | Modo leitura: hero com `Live`, tags musculares, ações `Save`/`Schedule`/`History`/`Mark Off`, blocos `A1/A2 Superset`, `B/C/D SERIES`, `Tempo: 3/0/1/0` e `Equipment List (5)`. No `consultoria-app`: `src/app/aluno/sessao/[uid]/index.tsx` + `CartaoExercicioDoDia.tsx`. |
| **`08` Start Workout Logger** | `/executeWorkoutPage` (`execute_workout_page.dart`, `ExecuteWorkoutCubit`, `ExecutionTimerCubit`, `SessionLogsCubit`, `ResumeWorkoutRepository`) | Header fixo (`00:02 \| Set 1/16 \| End workout`), barra de progresso no topo, pílulas `History`, `PRs`, `Swap`, `Rearrange Series` (`/rearrangeCircuitsPage`), tabela `Set \| Reps \| Weight \| Rest \| Log It`, badge `WRK` azul elétrico na série ativa, inputs em poços rebaixados, pílula `Video view` (HLS `.m3u8`) e dock de mídia no rodapé. No `consultoria-app`: `src/app/aluno/sessao/[uid]/[exercicio].tsx` + `ExercicioAluno.tsx`. |
| **`09` History & `10` PRs** | `exercise_history_bottom_sheet.dart` (`exercise_in_program_history_view.dart`, `exercise_lifetime_history_view.dart`) | Bottom sheet por exercício com abas `In program \| Lifetime` para histórico e recordes pessoais. No `consultoria-app`: `src/dominio/recordesPessoais.ts` + `AvisoDeRecorde.tsx`. |
| **`11` Swap Exercise** | `/updatedReplaceExercisePage` (`swap_exercise_page.dart`, `ExerciseSwapCubit`, `AlgoliaService` índice `exercises_name`) | Preview em vídeo, tags musculares, busca Algolia + filtro por equipamento, abas `Library \| Custom`, `Recommendations` e ações `Swap here` / `Swap all`. |
| **`12` Rest Timer Inline** | `animated_rest_tile.dart`, `rest_adjust_button.dart`, `RestTimerCubit` | Ao marcar `Log It` (✓ azul preenchido), abre faixa inline `Rest 28 sec` com `-15s` / `+15s` entre as séries + notificação local `rest_timer_complete`. No `consultoria-app`: `src/aluno/BarraDescanso.tsx` (`stndrd.glass`). |
| **`13` Finish & Log Modal** | `finish_and_log_bottom_sheet.dart` | Bottom sheet sobre scrim `#050505` com resumo (`1 min 18 sec \| 1 set`) e botões `Exit & discard` / `Log workout` (`#FCFCFC`). No `consultoria-app`: `src/aluno/ConcluirTreino.tsx`. |

---

## 4. Dashboard, Medals & Bodyweight (`u01`–`u07`)

1. **Dashboard Completo (`02_dashboard.png`, `u01`–`u03`, `/dashboard` — `dashboard_page.dart`):**
   - `active_program_top_view.dart` + `program_total_weight_set_view.dart` (`Total weight lifted`, `Total sets logged`).
   - `Bodyweight`: `weight_log_card_widget.dart`, `weigh_in_stats_view.dart` (matriz `7×5` 30 dias), `weight_progress_chart.dart` (`fl_chart` últimas 7 entradas).
   - `Habits`: `habits_stats_view.dart` + `daily_activity_chart.dart` (`Food Logged` e `Workouts Completed` 30 dias).
   - `Lifetime stats`: `lifetime_stats_view.dart` + `LifetimeStatsApiService` (Cloud Function `lifetimeStats` → `LifetimeStatsModel`: `workoutsCompleted`, `daysFoodLogged`, `timeTrainedInSec`, `programsCompleted`, `totalVolume`).
2. **Medals (`u04`–`u05`, `/medalViewPage` — `medals_page.dart`, `Medal`, `UserAchievement`):**
   - Aba `Vaults` (`medal_vaults_view.dart` → `/programVaultPage`): grid 2 colunas de vaults de programas com `medals_horizontal_stack.dart` e pill `+4`/`+3`.
   - Aba `Milestones` (`milestone_medals_view.dart`): `Mindset Medals` (`50 XP`, `250 XP`, `500 XP`) e `Workout Medals` em hexágonos (`25 XP`, `125 XP`, `250 XP`), renderizados via SVGs em `assets/medals/active/*.svg` e `assets/medals/inactive/*.svg`.
3. **Bodyweight — `Edit Entry` (`u06`–`u07`, `/logBodyWeightPage` — `log_body_weight_page.dart`, `progress_photos_viewer.dart`):**
   - Modelo `WeightLog` (`weight`, `createdAt`, `frontImage`, `backImage`, `leftImage`, `rightImage` exibidos como `Front`, `Back`, `Side`, `Side`), persistido na coleção Firestore `weightLogs` com upload para Firebase Storage em `weightLogs/` via `image_picker` (`Camera | Gallery`).
