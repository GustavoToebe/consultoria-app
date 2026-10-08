# Plataforma de treinos e dieta

Plataforma para vários treinadores (cada um com a sua consultoria isolada) montarem treino e dieta dos alunos.
O aluno vê o plano no celular ou na web e registra cargas e repetições, inclusive sem internet. O Saraiva
(Saraiva Team) é o primeiro treinador.

- Plano de execução: [PLANO-IMPLEMENTACAO.md](PLANO-IMPLEMENTACAO.md). Regras para quem mexe no código: [AGENTS.md](AGENTS.md).
- `api/` — backend (Java 21, Spring Boot 4.1.1, PostgreSQL 17). `app/` — app Expo (web, Android e iOS).
- `backend/` e `mobile/` — protótipo antigo, só como referência.

## Como rodar (local, Docker)

```bash
cp .env.example .env    # preencher POSTGRES_PASSWORD, TREINOS_JWT_SEGREDO (openssl rand -base64 48) e DEMO_SENHA
docker compose up -d --build
# Web (treinador e aluno): http://localhost:8088   (na rede: http://IP-DO-PC:8088)
```

No Windows: Docker Desktop; `ipconfig` mostra o IP do PC; liberar a porta 8088 no firewall para o celular.
O banco começa com os dados de demonstração (só quando está vazio). Para recomeçar do zero:
`docker compose down -v && docker compose up -d --build`.

Testes da API: `cd api && mvn verify` (precisa do Docker ligado, para o Testcontainers).

## Contas de demonstração

Senha de todas: o valor de `DEMO_SENHA` no `.env`. Todos os dados são fictícios.

| Conta | Papel | Consultoria |
|---|---|---|
| `saraiva@demo.local` | Treinador | Saraiva Team (fonte Metal, tema escuro) |
| `aluno@demo.local` | Aluno | Saraiva Team (Plano 16 publicado, dieta, histórico de 2 semanas) |
| `exemplo@demo.local` | Treinador | Consultoria Exemplo (tema claro) |
| `aluno2@demo.local` | Aluno | Consultoria Exemplo (plano ABC) |

## Pendências e decisões

Decisões tomadas onde o plano não fechava; conferir com o Gustavo ou com o Saraiva.

- **Dieta de demonstração reconstruída.** O PDF da dieta do Saraiva não está no repositório: a dieta do seed usa os
  9 alimentos e valores por 100 g da seção 13.1 do plano, com quantidades de exemplo (5 refeições, opções A/B no
  almoço e no jantar). Ajustar no editor quando houver o PDF. O `mobile/src/database/seed_diet.ts` antigo não foi usado:
  não bate com o PDF descrito e traz medicamentos, que não podem ir para o seed.
- **Instruções do PDF do treino** vêm de `docs/Instruções e Regras.csv` (FS, cálculo, WS) mais as regras citadas no
  plano; o texto completo do PDF do Plano 16 pode substituir na tela Marca.
- `login_tentativa` segue a V016 real da Central (uma linha por chave), não o esboço da seção 6 do plano.
- **Offline do aluno em AsyncStorage**, no celular e na web (o plano prevê expo-sqlite no nativo e aceita
  AsyncStorage para a demonstração). A interface `offline/armazenamento.ts` permite trocar sem mexer no resto.
  Na web o app não abre sem servidor (não há service worker); sem internet no meio do uso, continua funcionando.
- `execucao_serie.serie_trabalho` (não está no esboço): marca a série de trabalho, vinda da versão do plano.
- Ambiguidades dos PDFs para mostrar ao Saraiva (seção 19 do plano): Off ativo na quarta ou na quinta (o seed usa
  quinta); back off sobre "carga da WS" ou "maior peso do exercício" (o app usa o maior peso registrado na WS do dia);
  cardio todo dia ou só nos dias Off; "Refeição 2 — ALMOÇO" com frutas; ovo 3 un/180 g com 133 kcal; legumes com
  45 kcal e macros zerados; variação de peso −1 onde a conta dá −1,5.
