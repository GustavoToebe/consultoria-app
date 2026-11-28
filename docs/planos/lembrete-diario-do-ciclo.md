# Lembrete diário de registro (ciclo)

Situação: Planejando (congelado até 01/12, decisão do Gustavo de 28/11) · Onde: nada no código · Atualizado: 28/11/2026

Fonte: decisão do Gustavo de 27/11 ("Ciclo menstrual: pode ficar ligado, mas o push para a aluna é genérico ('Lembrete: registre seu dia no app'), sem mencionar ciclo. A aluna desliga em Conta › Notificações."). Base conferida em 28/11 no worktree leva-3, sem commit. **Invalida este desenho:** mudança em `ck_push_envio_tipo`, em `PushRepositorio`/`PushDoExpo`, na tabela `ciclo_dia` ou o uso de um número de migration já ocupado.

## Objetivo
A aluna que usa o acompanhamento do ciclo e ainda não registrou o dia recebe às 20h de Brasília um único push genérico, "Lembrete: registre seu dia no app". O push não diz nada sobre ciclo nem sobre saúde. Ela pode desligar o lembrete sem perder o aviso de compromisso.

## Situação em 28/11 (conferida)
- Não existe push nem lembrete de ciclo. `TipoDePush` só tem `COMPROMISSO`, `PLANO_LIBERADO` e `ATUALIZACAO_ATENCAO`, e o `PushUnitarioTest.nenhumTextoDePushFalaDeCiclo` vale para todos os tipos.
- A tela "Conta › Notificações" não existe. O aviso no celular da aluna é o cartão "Avisos no celular", em Conta › Aparência e preferências (`app/src/aluno/conta/TelaDaConta.tsx` → `app/src/aluno/push/InterruptorDeAvisoNoCelular.tsx`).
- Esse cartão só registra ou apaga o token. A marca `avisoNoCelular` fica no aparelho e não é por tipo de push, então desligá-lo corta também o aviso de compromisso.
- O lado da aluna agora tem teste: `app/src/aluno/push/InterruptorDeAvisoNoCelular.test.tsx`, com 5 casos, verde em 28/11.
- A única preferência de push do servidor é `usuario.push_atencao`, que é do membro da equipe. A aluna não tem nenhuma.
- O ciclo é ligado só pela chave global `TREINOS_CICLO_HABILITADO`; não há ligação por consultoria. Para cada aluna, "ciclo ativo" quer dizer `aluno.sexo = 'FEMININO'` e `aluno.ciclo_ativado_em` preenchido.
- "Registrar o dia" é gravar uma linha em `ciclo_dia` com aquela data (`UNIQUE (aluno_id, data)`), por `PUT` do dia em `CicloMenstrualService.gravarDia`.
- **É preciso migration.** O CHECK `ck_push_envio_tipo` (V112) só aceita os três tipos atuais, e não existe caminho limpo sem mudá-lo:
  - reaproveitar um tipo existente mandaria o push com o título e o texto errados;
  - mandar direto ao Expo, sem a fila, perderia a chave natural que garante um envio só.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| L1 | Texto do push | título "Lembrete diário", corpo exato "Lembrete: registre seu dia no app", `data.tipo = "registro"` | Gustavo (texto), coordenação (título e código) |
| L2 | Nome do tipo na fila | `LEMBRETE_DIARIO` (genérico: a linha da fila e o log nunca dizem do que é o registro) | coordenação, 28/11 |
| L3 | Preferência da aluna | coluna nova `usuario.push_lembrete_diario boolean NOT NULL DEFAULT true`; `push_atencao` não é reaproveitada | coordenação, 28/11 |
| L4 | Horário | 20:00 de Brasília, fixo, numa constante única com `shortcut:` | pedido da coordenação |
| L5 | Onde fica o interruptor | segundo interruptor, "Lembrete diário de registro", no cartão "Avisos no celular" (Conta › Aparência e preferências), porque "Notificações" não existe | coordenação |
| L6 | Migration | número provisório **V198**, renumerado no merge para o próximo livre (a V117 é da leva 4) | coordenação |
| L7 | Auditoria da preferência | não audita. Como no registro do token, a linha diria "usa o ciclo" | proposta, a confirmar |

## Desenho

### Migration (V198 provisória)
```sql
ALTER TABLE usuario ADD COLUMN push_lembrete_diario boolean NOT NULL DEFAULT true;
ALTER TABLE push_envio DROP CONSTRAINT ck_push_envio_tipo;
ALTER TABLE push_envio ADD CONSTRAINT ck_push_envio_tipo
    CHECK (tipo IN ('COMPROMISSO', 'PLANO_LIBERADO', 'ATUALIZACAO_ATENCAO', 'LEMBRETE_DIARIO')) NOT VALID;
ALTER TABLE push_envio VALIDATE CONSTRAINT ck_push_envio_tipo;
```
`LEMBRETE_DIARIO` tem 15 caracteres e cabe no `varchar(20)`. Junto com a migration: subir o total em `FlywayMigrationIntegrationTest` e em `PapeisBancoIntegrationTest` (115 → 116) e criar `PushLembreteDiarioMigrationTest`, que confere o CHECK e o padrão da coluna.

### API (`push/`)
- **Tipo:** `TipoDePush.LEMBRETE_DIARIO("Lembrete diário", "Lembrete: registre seu dia no app", "registro")`.
- **Entidade:** `Usuario.pushLembreteDiario`, com valor inicial `true` (o Hibernate insere a coluna).
- **Rotina:** `LembreteDiario`, um componente novo em `push/`.
  - Agenda: `@Scheduled(cron = HORARIO, zone = Fuso.ID)`, com `static final String HORARIO = "0 0 20 * * *"` e o comentário `// shortcut: horário fixo para todas, trocar quando houver horário por aluna`.
  - Só roda com `PushProperties.habilitado()`, `envioAgendado()` e `CicloProperties.habilitado()`. Os testes chamam `rodar(LocalDate hoje)`.
  - Para cada consultoria (`select id from consultoria`), abre uma transação e chama `PushRepositorio.enfileirarLembretes(consultoriaId, hoje, inicioDoDia, fimDoDia)`, com o dia de Brasília.
  - O log leva só a contagem.
- **Quem recebe** (SQL nativo em `PushRepositorio`, com `consultoria_id` explícito; já liberado no `ArquiteturaTest`):
  - aluno ativo, não anonimizado e sem acesso desativado (`acesso_desativado_em is null`);
  - usuário ativo e com `push_lembrete_diario` ligado;
  - `sexo = 'FEMININO'` e `ciclo_ativado_em` preenchido;
  - nenhuma linha em `ciclo_dia` com a data de hoje;
  - pelo menos um `push_token`.
- **Um por aluna e por dia**, nesta ordem:
  1. `select pg_advisory_xact_lock(hashtextextended('lembrete-diario:' || ?::text, 0))` por consultoria: duas rodadas ao mesmo tempo (instâncias duplicadas) ficam em fila, e a segunda já vê o que a primeira gravou.
  2. `insert … select gen_random_uuid(), … where … and not exists (envio LEMBRETE_DIARIO da usuária com criado_em em [início, fim) do dia de Brasília, em qualquer situação)`.
  3. `on conflict (consultoria_id, usuario_id, tipo) where situacao = 'PENDENTE' do nothing`.

  O índice parcial sozinho não basta: o job passa a linha a ENVIADO em cerca de 30 s. A limpeza só apaga linha concluída depois de 7 dias, e o PENDENTE vencido vira CANCELADO EXPIRADO sem sumir.
- **Na hora do envio** (`PushDoExpo.situacao`), para `LEMBRETE_DIARIO`:
  - `elegivel` falso dá INATIVO, como os outros tipos do aluno;
  - se ela registrou o dia, desligou o lembrete ou desligou o ciclo depois de entrar na fila (`PushRepositorio.lembreteAindaVale`, mesma condição, data de hoje), dá NAO_RECEBE: CANCELADO sem apagar os tokens.
- **Rota da aluna** (`AlunoPushTokenController`, `@PreAuthorize("hasRole('ALUNO')")`, sempre o usuário da sessão, `no-store`):
  - `GET /aluno/preferencias-de-push` → `{lembreteDiario, lembreteDisponivel}`, onde `lembreteDisponivel` = chave do ciclo ligada + FEMININO + ciclo ativo;
  - `PUT /aluno/preferencias-de-push {lembreteDiario}` (`@NotNull`); mesmo valor não grava.
  - Desligado o push, o `PUT` dá 503 pelo `@ExigePush`, e o `GET` vale sempre.
- **LGPD:** nada de dado de saúde no tipo, no título, no corpo, no `data`, no log nem na auditoria. A simples existência da linha na fila diz "usa o ciclo" e some em 7 dias pela limpeza.

### App (`app/src/aluno/push/`)
- `dominio/pushDoAluno.ts`: `ROTULO_DO_LEMBRETE_DIARIO = 'Lembrete diário de registro'` e uma ajuda curta sem palavra de saúde (ex.: "Às 20h, se você ainda não registrou o dia.").
- No cartão "Avisos no celular" do `InterruptorDeAvisoNoCelular`, um segundo `Interruptor`.
  - Aparece só com `oferecerAvisoNoCelular`, o aviso no celular ligado e `lembreteDisponivel`. Some se o ciclo não está ligado para ela.
  - O valor vem do `GET`; mudar chama o `PUT` e, se falhar, volta ao valor anterior e avisa.
  - Chamadas novas em `api/rotas`.

### Testes
- **Java, `LembreteDiarioIntegrationTest`** (Expo de mentira, só sobre o que o teste criou):
  - recebe: aluna com ciclo, token e sem o dia;
  - não recebe:
    - já registrou hoje;
    - chave do ciclo desligada;
    - sem ciclo ativo, ou sexo diferente;
    - preferência desligada pelo `PUT` (prova que desligar impede o envio);
    - sem token;
    - aluno inativo, anonimizado ou com acesso pausado;
  - rotina repetida no mesmo dia, e também depois de o job enviar, não duplica;
  - isolamento: cada envio leva o `consultoria_id` da própria aluna;
  - texto e `data` fixos na chamada ao Expo;
  - registrar o dia depois da fila cancela o envio.
- **`PushUnitarioTest`:** texto exato, e nenhuma palavra de saúde no nome, no título, no corpo nem no código.
- **jest:** o interruptor novo (aparece e some, liga, desliga, falha volta ao valor anterior).

## Passos
- [x] 0. Teste do lado da aluna do interruptor de hoje (`InterruptorDeAvisoNoCelular.test.tsx`, 5 casos): commit/run: — (sem commit, leva 3)
- [ ] 1. Migration V198 (provisória) + contagens + `PushLembreteDiarioMigrationTest` — commit/run: —
- [ ] 2. API: tipo, rotina, rota da preferência, conferência no envio e testes — commit/run: —
- [ ] 3. App: interruptor "Lembrete diário de registro" e jest — commit/run: —
- [ ] 4. Ajuda (aluno) e AGENTS.md (textos abaixo) — commit/run: —

## Textos prontos (para depois da implementação)
- **Ajuda (aluno):** "Lembrete diário: se você usa o acompanhamento do ciclo e ainda não registrou o dia, o app manda às 20h um aviso no celular: 'Lembrete: registre seu dia no app'. O aviso não diz nada sobre o que você registra. Para desligar: Conta › Aparência e preferências › Avisos no celular › Lembrete diário de registro."
- **AGENTS.md:** a frase "Não existe push nem lembrete de ciclo" vale até a implementação. Depois, trocar por: "Lembrete diário (`LEMBRETE_DIARIO`, V1xx, `push/LembreteDiario`): às 20h de Brasília, um por aluna por dia (trava por consultoria + `not exists` do dia + `on conflict` do PENDENTE), só para quem tem o ciclo ligado, `usuario.push_lembrete_diario`, token e ainda não registrou o dia; reconferido no envio; texto fixo genérico ('Lembrete: registre seu dia no app', `data.tipo = registro`), sem dado de saúde no tipo, texto, `data`, log ou auditoria; a aluna desliga em `GET|PUT /aluno/preferencias-de-push` (cartão Avisos no celular)."

## Fora do escopo
- Horário escolhido pela aluna, lembrete por tipo de registro e tela "Notificações" própria.

## O que ficou para trás
- A frente inteira está congelada até 01/12 (Gustavo, 28/11). A entrada em "Pendências soltas" é do coordenador.
