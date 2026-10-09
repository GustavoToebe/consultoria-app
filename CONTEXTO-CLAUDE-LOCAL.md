# Contexto para o Claude local (09/10/2026, depois do check-in e da equipe)

Leia o `AGENTS.md` antes de tudo. Este arquivo diz **onde o projeto está** e **o que falta até a demonstração**: domingo
11/10/2026 às 16:30, para o Saraiva.

## 1. Onde está

- **`main` no GitHub:** commit `1d73bbd` ou mais novo. Tem tudo de antes, e agora também:
  - **check-in** (`PLANO-CHECKIN.md`, C1–C11): atualização do aluno, feedback do treinador e lembretes locais;
  - **equipe** (`PLANO-EQUIPE.md`, E1–E7): usuários, perfis, permissões, convite de equipe, auditoria, responsável e
    filtro "Meus alunos";
  - o restante, já existente antes:
    - catálogo TACO + exercícios em português;
    - partes visuais A, B e C;
    - hierarquia visual e personalização;
    - pastas, lesões, mobilidade, peso com gráfico;
    - seletor de planos do aluno.
- **Migrations até a `V018`** (`V017__atualizacoes.sql`, `V018__equipe.sql`). O `FlywayMigrationIntegrationTest`
  espera 18. Migration nova é a `V019`, e as antigas nunca se editam.
- **Testes em 09/10:**
  - API: `mvn verify` com 131 testes, cobertura de 91,9%;
  - app: typecheck, lint e 201 testes em 34 suítes.
- **`CORRECOES-CHECKIN-EQUIPE.md`, Parte A: feita** (A1–A6, mais as telas da equipe com o mesmo teto da API). O ambiente
  local já foi recompilado (`up -d --build`, sem `down -v`) e o banco local está na V018.
- **`PLANO-ACOMPANHAMENTO.md`: ainda não começou.** Só começa depois da Parte A de `CORRECOES-CHECKIN-EQUIPE.md`, um
  bloco por sessão (Q, depois P…), e só com o Gustavo pedindo.
- **Etiquetas de plano B:**
  - `antes-hierarquia`;
  - `demo-parte-a`.

  Nenhuma das duas tem o check-in nem a equipe.

## 2. Primeiro passo nesta sessão

```bash
git status                          # se houver alteração local, pare e mostre ao Gustavo
git switch main
git pull --ff-only origin main
git log --oneline -1                # 1d73bbd ou mais novo
```

Trabalha-se direto na `main` (decisão do Gustavo, está no `AGENTS.md`). Codex e Claude **nunca** trabalham na mesma pasta
ao mesmo tempo. Quem começa sempre dá pull antes.

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

1. **Preparar a demonstração (só com o Gustavo pedindo):**
   - conferir se a conta do treinador aparece como **Administrador** em Equipe;
   - ajustar o fim da pasta do `aluno@demo.local` para **segunda, 12/10**, para o formulário de atualização estar aberto
     no domingo;
   - não zerar o banco sem ele pedir.
2. **Teste no celular (Expo Go, SDK 57), sábado.** Com `aluno@demo.local`:
   - [ ] **passo 6 do roteiro:** abrir um dia pelos chips → marcar séries → modo avião → marcar mais → fechar e abrir o
     app ("salvo no aparelho") → tirar do modo avião → "Sincronizado";
   - [ ] vibração, descanso (60 s, segundo plano, ±15 s, Pular) e arrastar a folha pelo cabeçalho;
   - [ ] **PDF** do treino e da dieta pelo compartilhar;
   - [ ] seletor de planos (pasta concluída e voltar);
   - [ ] preferências (texto "Extra", reduzir animações, vibração desligada, tema do aparelho), tema claro e
     `aluno2@demo.local`;
   - [ ] **check-in:**
     - cartão na tela inicial;
     - formulário em caixas;
     - rascunho mantido ao fechar o app;
     - enviar;
     - peso aparece na ficha;
     - "Vou atrasar";
     - campo de foto mostra "ainda não implementado";
     - **lembrete local** chega (pedir a permissão pelo painel);
   - [ ] **feedback:** o treinador escreve na web e o aluno vê no celular;
   - [ ] **correções da Parte A:**
     - "Vou atrasar": o cartão continua e depois aparece Responder;
     - enviar em modo avião e reenviar;
     - atualização antiga pelo histórico abre só para leitura;
     - membro que não é administrador não vê o perfil Administrador nas opções;
   - [ ] **equipe:**
     - convidar um membro (Treinador e Assistente);
     - aceitar o convite;
     - o Assistente não vê peso, objetivo nem observações;
     - desativar o membro derruba a sessão dele.
   - Se algo falhar e não der para corrigir com segurança até sábado à noite, o Gustavo decide entre corrigir ou não
     mostrar aquela parte.
3. **Antes de mostrar a criação de consultoria nova (passo 9):** zerar o banco (seção 3), para pegar o nome neutro do
   modelo.
4. **`CORRECOES-CHECKIN-EQUIPE.md`, Partes B e C:** depois da demonstração.
5. **Pendências antigas:**
   - aviso "Publicado v2" por cima do campo de vídeo (estético);
   - cor da marca clara com texto preto (decisão do Gustavo);
   - limite de login: 10 tentativas por conta a cada 10 minutos.
6. **Depois da demonstração:**
   - apagar no GitHub as branches `visual/rnr` e `visual/movimento`;
   - formatar o código muito compactado das partes B e C e da equipe (Parte C das correções).

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
