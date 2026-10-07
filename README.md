# Log de Treino - Metodologia Saraiva Team

## Visão Geral
Aplicativo mobile focado em hipertrofia e Progressive Overload baseado na metodologia Saraiva Team.
Plataforma alvo inicial: **Android** (Offline-First).

## Estrutura do Repositório
- `/mobile`: Aplicação React Native (Expo) + TypeScript + NativeWind + WatermelonDB.
- `/backend`: API Java 21 + Spring Boot + Spring Security + PostgreSQL.
- `/docs`: Documentação técnica, especificações de negócio e referências CSV.

## Design System (Premium Bodybuilding)
- Background: `#0B0B0D`
- Surface: `#161619`
- Surface 2: `#202024`
- Primary: `#C62828` / `#D32F2F` (Uso moderado em CTAs, checks e destaques de carga)
- Text Primary: `#F5F5F5`
- Text Secondary: `#9E9EA4`

## Lógica Matemática (Offline-First Engine)
- **Aquecimento**: 30% (`0.3`) do Working Set (10-15 reps)
- **Feeder Set 1**: 50% (`0.5`) do Working Set (3-5 reps)
- **Feeder Set 2**: 70% (`0.7`) do Working Set (3 reps)
- **Feeder Set 3**: 85% (`0.85`) do Working Set (3 reps)
- **Working Set**: 100% (`1.0`) do Working Set (Livre = 1 RIR / Máquina = Falha)
- **Back-off Set**: 85% (`0.85`) ou 90% (`0.90`) do Working Set (aumento de reps)
