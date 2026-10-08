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

### Celular (Android/iOS) pelo Expo Go

Com o Docker rodando, no mesmo Wi-Fi do PC:

```bash
cd app
npm ci                   # só na primeira vez (Node 24.21.0, ver app/.nvmrc)
npx expo start           # ler o QR code com o Expo Go (SDK 57)
```

O app acha a API sozinho em `http://IP-DO-PC:8088/api` (pelo endereço do Metro). Se não achar, rodar com
`EXPO_PUBLIC_API_URL=http://IP-DO-PC:8088/api npx expo start`. Sem o mesmo Wi-Fi: `npx expo start --tunnel`.

### Verificações

- API: `cd api && mvn verify` (Error Prone, ArchUnit, JaCoCo ≥ 70%; precisa do Docker para o Testcontainers).
- App: `cd app && npm run typecheck && npm run lint && npm test`; bundle nativo: `npx expo export --platform android`.

## Roteiro da demonstração

Antes do ensaio, recomeçar do zero: `docker compose down -v && docker compose up -d --build`.

1. PC, `http://IP:8088`: entrar como `saraiva@demo.local` → marca SARAIVA TEAM (fonte Metal); Perfil → tema claro e
   voltar.
2. Marca: enviar a logo do Saraiva (PNG/JPEG até 512 KB) e ver a prévia nos dois temas.
3. Alunos → Aluno Demonstração → Treino “Plano 16” → Abrir → Segunda - Costas → Remada baixa → “Usar receita de
   séries” → mudar FS de 3 para 2 (os percentuais viram 70/85) → Validar → Publicar (confirmar os avisos) → v2.
4. Ficha → Replicar (o próximo ciclo já vem sugerido) → o plano novo abre como rascunho, igual ao anterior.
5. PDF do treino e da dieta (botão PDF na ficha ou no editor; na web abre “Salvar como PDF”).
6. Celular (Expo Go), `aluno@demo.local`: Começar treino → marcar séries → modo avião → marcar mais → fechar e abrir
   o app (“salvo no aparelho”) → tirar do modo avião → “Sincronizado”.
7. PC: ficha do aluno → Registros dos últimos 14 dias e Progresso mostram o que foi feito.
8. `exemplo@demo.local`: outra marca e tema claro; nada do Saraiva aparece.
9. Sair → “Sou treinador, criar conta” → consultoria nova, já com as receitas prontas.

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
- **PDF na web sem iframe.** A CSP do Caddy tem `frame-src 'none'`; o PDF entra num bloco só de impressão da própria
  página e abre o “Imprimir / Salvar como PDF” do navegador. No celular gera o arquivo e abre o compartilhar.
- **Item “Ovo inteiro, 3 un” do seed só tem kcal (133).** Sem proteína, carboidrato e gordura, os totais de macros do
  café e do dia aparecem como “—” (o sistema não inventa valor nutricional). Preencher no editor de dieta com os
  valores que o Saraiva usar.
- **Logs sem dado pessoal:** erro inesperado vai para o log só com as classes e os pontos do código, e o driver do
  Postgres não inclui o “Detalhe” (que traria e-mail ou peso) nas exceções.
- `execucao_serie.serie_trabalho` (não está no esboço): marca a série de trabalho, vinda da versão do plano.
- Ambiguidades dos PDFs para mostrar ao Saraiva (seção 19 do plano): Off ativo na quarta ou na quinta (o seed usa
  quinta); back off sobre "carga da WS" ou "maior peso do exercício" (o app usa o maior peso registrado na WS do dia);
  cardio todo dia ou só nos dias Off; "Refeição 2 — ALMOÇO" com frutas; ovo 3 un/180 g com 133 kcal; legumes com
  45 kcal e macros zerados; variação de peso −1 onde a conta dá −1,5.
