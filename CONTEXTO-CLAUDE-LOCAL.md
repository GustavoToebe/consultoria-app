# Contexto para o Claude local (09/10/2026)

Leia o `AGENTS.md` antes de tudo. Este arquivo diz **onde o projeto está** e **o que falta até a demonstração**: domingo
11/10/2026 às 16:30, para o Saraiva.

## 1. Onde está

- **`main` no GitHub:** commit `d2f37aa` ou mais novo. Tem tudo:
  - catálogo TACO + exercícios em português;
  - partes visuais A, B e C (Reusables, movimento, descanso);
  - hierarquia visual e personalização (`PLANO-HIERARQUIA-VISUAL.md`);
  - pastas, lesões, mobilidade, peso com gráfico;
  - seletor de planos do aluno (`GET /aluno/pastas`, `/aluno/pastas/{id}`);
  - correção do PDF no Expo Go.
- **Migrations até a `V016`** (`V016__fontes_da_marca.sql`). O `FlywayMigrationIntegrationTest` espera 16. Migration nova
  é a `V017`, e as antigas nunca se editam.
- **Etiquetas de plano B:**
  - `antes-hierarquia`: antes da hierarquia e da personalização;
  - `demo-parte-a`: antes das partes visuais B e C.
- **Revisão no GitHub em 09/10:**
  - `mvn verify` com 88 testes, ArchUnit e cobertura;
  - app: typecheck, lint e 167 testes (28 suítes);
  - repositório privado;
  - `scripts/importacao/dados/` sem dado de aluno, só os modelos de treino do Saraiva Team;
  - rotas novas do aluno com o aluno vindo sempre da sessão, e pasta de outro aluno = 404.
- **Mudança da revisão (`d2f37aa`):** consultoria nova não recebe mais o modelo "Semana Saraiva". Agora ele se chama
  "Semana 5 treinos + 2 off ativos". Só vale para consultorias criadas depois, e o banco local só muda ao ser zerado.

## 2. Primeiro passo nesta sessão

```bash
git status                          # se houver alteração local, pare e mostre ao Gustavo
git switch main
git pull --ff-only origin main
git log --oneline -1                # d2f37aa ou mais novo
```

Trabalha-se direto na `main` (decisão do Gustavo, está no `AGENTS.md`). A branch local `visual/hierarquia` já está dentro
da `main` e pode ser apagada (`git branch -d visual/hierarquia`) se o Gustavo concordar.

## 3. Deixar o banco pronto para domingo

Faça só quando o Gustavo pedir. Apaga os dados locais, mas eles são só de demonstração.

```bash
docker compose down -v
docker compose up -d --build        # --build: a API mudou (seed) desde o último build
# esperar api "healthy": docker compose ps
node scripts/importacao/importar.mjs --simular   # confere o que vai importar
node scripts/importacao/importar.mjs             # vídeos, 8 semanas de treino e 2 modelos de mobilidade
```

A senha vem de `DEMO_SENHA` (ou `IMPORT_SENHA`) do ambiente. **Nunca** imprima nem copie o `.env`.

## 4. Pendências (por prioridade)

1. **Teste no celular (Expo Go, SDK 57), sábado.** É o único item do roteiro ainda ❌. Com `aluno@demo.local`:
   - [ ] **passo 6 do roteiro:** abrir um dia pelos chips → marcar séries → modo avião → marcar mais → fechar e abrir o
     app ("salvo no aparelho") → tirar do modo avião → "Sincronizado";
   - [ ] vibração ao marcar série (leve; "sucesso" na última do exercício) e no fim do descanso;
   - [ ] descanso manual (60 s), trocar de tela, segundo plano por 30 s, ±15 s e Pular;
   - [ ] arrastar a folha pelo cabeçalho para fechar;
   - [ ] **PDF** do treino e da dieta pelo compartilhar (a correção do Expo Go nunca rodou em aparelho);
   - [ ] **seletor de planos:** trocar para uma pasta concluída, ver treino e dieta mudarem juntos e voltar para a
     atual;
   - [ ] **preferências:** texto "Extra" sem cortar botão nem chip; "Reduzir animações"; vibração desligada não vibra;
     tema "Igual ao aparelho";
   - [ ] tema claro e conta `aluno2@demo.local` (outra marca).
   - Se algo falhar e não der para corrigir com segurança até sábado à noite, o Gustavo decide entre corrigir ou usar
     a etiqueta `antes-hierarquia`.
2. **Antes de mostrar a criação de consultoria nova (passo 9):** zerar o banco (seção 3), para pegar o nome neutro do
   modelo.
3. **Aviso "Publicado v2" por cima do campo de vídeo** por alguns segundos. É estético e pode ficar para depois.
4. **Cor da marca:** hoje bloqueia qualquer cor em que o texto branco fique ilegível. Isso impede marca clara (amarelo,
   verde-limão, azul-claro) com texto preto, que antes funcionava. Para o Saraiva (vermelho) não muda nada. Decisão do
   Gustavo para depois da demonstração.
5. **Limite de login:** 10 tentativas por conta a cada 10 minutos. Depois de muitos testes, esperar antes de entrar.
6. **Depois da demonstração:**
   - apagar no GitHub as branches `visual/rnr` e `visual/movimento`, que já estão dentro da `main`;
   - parte do código das partes B e C está muito compactado (várias instruções numa linha). Formatar quando mexer
     nesses arquivos.

## 5. Regras que valem sempre

- Não opinar sobre saúde, suplementos ou protocolos. Não inventar carga, repetição nem valor nutricional: ausência = "—".
- Dado de aluno (peso, dieta, suplementação, observações, lesões) é sensível pela LGPD: nunca no git, em log ou em
  outro serviço. Seed e testes só com dados fictícios. Capturas de tela com dados reais ficam fora do repositório.
- Segredos só em variável de ambiente, sem valor padrão. O `.env` nunca vai para o git nem para o chat.
- Treinador nunca vê outra consultoria; aluno só vê os próprios dados (404 para o resto).
- Não apagar `backend/` nem `mobile/`.
- **Antes de cada commit:**
  - app: `cd app && npm run typecheck && npm run lint && npm test`;
  - API: `cd api && mvn verify`.
- **Push** só com o Gustavo autorizando, sem `--force`. Depois de cada sessão de trabalho, confirmar que está tudo no
  GitHub (`git status` e `git log origin/main..main` vazio).
- **Relatório ao Gustavo:** o que foi feito, o que foi testado, com ✅/❌, e o que ficou pendente.
