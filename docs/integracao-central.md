# Integração com a Central — o que está pronto e o que falta

Estado em 11/10/2026. A Minha conta e o consumo do plano já funcionam com **dados de demonstração** gravados no próprio
banco. Nada aqui fala com a Central. Quando a integração entrar, só a **fonte dos dados** muda: a tela, as rotas e as
permissões ficam como estão.

Referência (somente leitura, não alterar lá): `central/central-api-back/docs/contrato-integracao-v1.md`, seções 2 (HMAC),
4 (snapshot de direitos), 5.3 (webhook), 6.1 (sincronização), 6.3 (Minha conta), 7 (tabelas de apoio) e 8 (checklist).
O Servirea (`minha-conta.service.ts`, `CotasService.java`) é a referência de como um app consome isso; é Angular + Spring,
então copiar a ideia, não o código.

## 1. O que existe hoje

| Peça | Onde | Observação |
|---|---|---|
| Tabelas `direitos_locais`, `conta_comercial_local`, `cobranca_local` | migration `V021__conta_local.sql` | Globais (sem `@TenantId`), como no Servirea. Toda consulta filtra `consultoria_id`. |
| `ContaLocalRepositorio` | `api/.../conta/` | JDBC; é a única classe com SQL dessas tabelas (liberada no `ArquiteturaTest`). |
| Contrato de dados | `MinhaContaDto`, `ConsumoPlanoDto` | `MinhaContaDto` tem os mesmos campos da seção 6.3 do contrato. |
| Porta | `FonteDaConta` | Interface: `minhaConta(consultoriaId)` e `previa()`. Hoje implementada por `FonteDaContaLocal`. |
| Serviço e rotas | `ContaService`, `ContaController` | `GET /minha-conta` e `GET /minha-conta/consumo`, só com `CONTA_LER`. |
| Consumo | `ContaService.consumo()` + `RecursosDoApp` | Conta alunos ativos e membros da equipe de verdade e compara com `direitos_locais.limites`. |
| Dados de demonstração | `SeedContaDemo` / `demo/SeedContaDemoRunner` | Plano Profissional (150 alunos, 5 membros) e seis cobranças fictícias. Idempotente. |
| Tela | `app/src/app/treinador/minha-conta.tsx` | Mostra o aviso "Prévia" enquanto `previa` for `true`. |

O consumo **não bloqueia nada**: só informa. Nenhuma regra de negócio olha o limite hoje.

## 2. O que muda na integração

1. **`FonteDaContaCentral`** (nova): implementa `FonteDaConta` chamando
   `GET /integracao/v1/produtos/{produto}/instancias/{idExterno}/minha-conta` (contrato 6.3), assinado com HMAC (seção 2),
   corpo vazio. `idExterno` é o id da consultoria. Devolve o mesmo `MinhaContaDto`; `previa()` passa a ser `false`.
   - `404` da Central → `ContaNaoEncontradaException` (já vira `404 CONTA_NAO_ENCONTRADA`).
   - Central fora do ar, `5xx` ou assinatura recusada → `502 CENTRAL_INDISPONIVEL` (erro novo; hoje não existe).
   - Integração sem chave configurada → `503 INTEGRACAO_NAO_CONFIGURADA` (erro novo).
2. **Escolha da fonte** por configuração: com a integração ligada usa a Central; senão `FonteDaContaLocal`. Só um
   `@Component` ativo de `FonteDaConta` por vez.
3. **Direitos** (`direitos_locais`) passam a ser escritos pela integração, não pelo seed:
   - webhook `PUT /integracao/v1/instancias/{tenantId}/direitos` (5.3): aplica só versão maior; versão igual só
     atualiza `confirmado_em`;
   - sincronização `GET /integracao/v1/produtos/{produto}/direitos` a cada 8 h e na subida da API (6.1), com nova
     tentativa a cada 30 min se falhar;
   - `ContaLocalRepositorio.gravarDireitos` já faz o upsert; falta regra "só versão maior".
4. **Seed**: `SeedContaDemoRunner` deve ficar **desligado** quando a integração estiver ligada (senão gravaria dado
   fictício por cima do real). Hoje ele só cria o que falta; ainda assim, desligar por configuração.
5. **Aviso "Prévia"**: some sozinho, porque vem de `previa()`.

## 3. O que ainda não existe e o contrato pede

- Assinador e validador HMAC (seção 2), nonce e janela de horário, com os vetores de teste da 2.5.
- Cadeia de segurança própria para `/integracao/**` (sem JWT de usuário, sem CSRF, sem sessão).
- Tabelas `integracao_operacao` e `integracao_nonce` (seção 7). Não foram criadas: sem webhook não há o que guardar.
- Provisionamento de instância (5.1) e código de suporte (5.4): fora do escopo da Minha conta.
- Regra de acesso por direitos: `liberado = acessoLiberado E (agora − confirmadoEm) ≤ 72 h`. **Não aplicada.** Hoje
  `acesso_liberado` e `situacao` só são exibidos. Aplicar bloqueio é decisão de produto separada.
- Aplicação dos `limites` e das `funcionalidades` (o contrato chama de "aplicação futura"). Os códigos de
  `RecursosDoApp` (`alunos_ativos`, `membros_equipe`, `CHECKIN`, `MOBILIDADE`, `PDF`, `EQUIPE`) precisam ser combinados com
  a Central antes de ela cadastrar o produto.

## 4. Variáveis de ambiente (propostas, sem valor padrão)

Seguem o padrão da seção 2.1, trocando o prefixo. Só em variável de ambiente; nunca no git nem no `.env.example` com valor.

| Variável | Conteúdo |
|---|---|
| `TREINOS_INTEGRACAO_CHAVES_ENTRADA` | `id:segredoBase64[,id:segredoBase64]` (chaves que a Central usa para assinar) |
| `TREINOS_INTEGRACAO_CHAVE_SAIDA_ID` / `..._SEGREDO` | chave com que o app assina as chamadas à Central |
| `TREINOS_INTEGRACAO_CENTRAL_URL` | URL base da Central |
| `TREINOS_INTEGRACAO_PRODUTO` | código do produto na Central |
| `TREINOS_INTEGRACAO_TOLERANCIA_HORAS` | tolerância técnica (contrato: 72) |

## 5. Como trocar, na prática

1. Combinar com a Central o código do produto, os códigos de `limites`/`funcionalidades` e a chave por direção.
2. Criar `FonteDaContaCentral` e o cliente HMAC; testar com os vetores da 2.5 e com um servidor falso.
3. Criar a migration das tabelas de apoio que faltarem (próxima depois de V021) e subir o total em
   `FlywayMigrationIntegrationTest`.
4. Ligar webhook e sincronização gravando em `direitos_locais`.
5. Escolher a fonte por configuração e desligar o `SeedContaDemoRunner` nesse ambiente.
6. Revisar `GET /minha-conta` e `/minha-conta/consumo` com dados reais: o formato não deve mudar.

## 6. Cuidados

- Dados comerciais da consultoria não são clínicos, mas continuam sem log de conteúdo e sem ir para outro serviço além da Central.
- `consultoria_id` vem sempre de `TenantContext` (banco), nunca de parâmetro. A rota nova de integração, por ser de
  sistema para sistema, é a única que recebe o id da instância, e só depois de validar a assinatura.
- O `SeedContaDemo` usa só dados fictícios (documento `00.000.000/0001-00`, e-mail `.invalid`). Não substituir por dado real.
