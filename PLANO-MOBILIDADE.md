# Plano: mobilidade dentro da pasta (como treino e dieta)

Pedido do Gustavo em 09/10/2026. Hoje a mobilidade é só **modelo** do Planejamento (receita `MOBILIDADE`, V013): não
existe nada por aluno nem por pasta, e o aluno não vê mobilidade. Este plano cria o **plano de mobilidade** da pasta.

Leia o `AGENTS.md` antes. Um bloco por sessão (M1, depois M2…), cada item com teste que falha antes e passa depois,
`mvn verify` + `npm run typecheck && npm run lint && npm test` antes de cada commit, push na `main` só com o Gustavo
autorizando, relatório com ✅/❌.

## Decisões (Gustavo, 09/10/2026)

1. **Como treino e dieta:** plano de mobilidade dentro da pasta, com rascunho e **versão publicada imutável**; nasce do
   zero ou de um modelo de mobilidade do Planejamento; usa o período da pasta; replicar a pasta copia junto; excluir a
   pasta arquiva junto. Um plano de mobilidade **ativo** por aluno (como a dieta).
2. **Aluno:** tela própria **"Mobilidade"** no menu do aluno (ao lado de Treino e Dieta), funciona **sem internet**.
3. **Sem registro:** o aluno só consulta (nome, prescrição, vídeo). Nada de marcar como feito nesta versão.
4. **Permissões:** as **mesmas do treino** (`TREINO_LER`, `TREINO_ALTERAR`, `TREINO_PUBLICAR`). Nenhum código novo no
   catálogo; perfis existentes não mudam (a Nutricionista não vê mobilidade, o Assistente vê como vê o treino).

## Andamento (09/10/2026)

M1 a M5 feitos e enviados; M6 (roteiro e documentação) no fim desta sessão. Correções em relação ao texto abaixo:
a Nutricionista **tem** `TREINO_LER` (V018), então lê a mobilidade como o treino (só não cria nem publica); a aba Dieta do
aluno não era condicional, então a condição da aba Mobilidade foi escrita do zero (`temAbaMobilidade`); `GET /aluno/mobilidade`
devolve `{ mobilidade }` e 404 sem plano.

## Regras que não podem quebrar

- Mesmo isolamento do resto: `@TenantId` nas duas entidades; plano/versão de outra consultoria ou de outro aluno = 404.
- Publicado é imutável; mudar o período da pasta mexe só no rascunho (igual dieta).
- Link de vídeo abre **fora do app, sem token** (`VideoUrls`/`erroDoVideo`, como no treino).
- Não opinar sobre saúde; ausência de dado é "—"; recurso que não existe não aparece (ex.: sem PDF de mobilidade, o
  botão PDF não aparece para ela).
- **Nada de cair em "dieta" por omissão.** Hoje vários pontos são binários (`tipo === 'treino' ? … : dieta`). Todo ponto
  que ganhar o terceiro tipo vira `switch`/mapa exaustivo (TypeScript `Record<TipoPlano, …>`, Java `switch` sem default),
  para o compilador apontar o que faltou.

## M1 — Banco e API do plano de mobilidade

- **V019** (`V019__plano_mobilidade.sql`): `plano_mobilidade` e `plano_mobilidade_versao` com as mesmas colunas de
  `plano_dieta`/`plano_dieta_versao` (V004) + `pasta_id` (FK `pasta_plano`, como V009) + `arquivado` (como V012); índice
  único parcial `(aluno_id) where ativo`, índices por aluno e por pasta, `unique(plano_id, numero)` na versão.
  `FlywayMigrationIntegrationTest` passa a esperar **19**.
- `receitas/ConteudoMobilidade`: `uid` obrigatório em seção e item na **publicação** (validador) e `comUidsNovos()`
  (replicar e criar a partir de modelo geram uids novos). Corrigir `ReceitaService` linhas ~162-164, que chama
  `videoUrls.normalizar` e descarta o retorno (conferir a assinatura antes).
- Pacote `mobilidade/`: `PlanoMobilidade`, `PlanoMobilidadeVersao`, repositórios (`PlanoRepositorio`/`VersaoRepositorio`),
  `PlanoMobilidadeService extends PlanoServiceBase<…, ConteudoMobilidade>` (só os hooks: novoPlano, novaVersao, vazio,
  comUidsNovos, daReceita → receita `MOBILIDADE`, validar; `nomeDoPlano` = "Plano de mobilidade" para o 404 dizer
  "Plano de mobilidade não encontrado."), `ValidadorMobilidade` (erros: sem seção, seção sem item,
  item sem nome, uid ausente/repetido, vídeo inválido; aviso: seção sem título) e `PlanoMobilidadeController` com as
  rotas da dieta trocando o prefixo por `planos-mobilidade` e as permissões por `PERM_TREINO_*`
  (`salvar-como-receita` = `TREINO_LER` + `MODELO_ALTERAR`, gravando receita `MOBILIDADE`).
- `auditoria/Auditoria.registrar`: hoje "não é treino ⇒ dieta". Trocar por `switch` no tipo do conteúdo e acrescentar
  `MOBILIDADE_PUBLICADA` / entidade `MOBILIDADE`, resumo fixo.
- Testes (`MobilidadeIntegrationTest`, no molde do `DietaIntegrationTest`): criar a partir de modelo `MOBILIDADE` com
  `pastaId` (herda período), salvar rascunho com lock (409), validar (422 com `fieldErrors`), publicar v1 e v2 (v1
  imutável), outra consultoria 404, membro com perfil Nutricionista 403 e Assistente (`TREINO_LER`) 200 na leitura e 403
  ao publicar, auditoria grava `MOBILIDADE_PUBLICADA`.

## M2 — Pasta e modelos

- `PastaService`: `atualizar` aplica o período também à mobilidade; `replicar` copia a mobilidade; `excluir` arquiva a
  mobilidade. Teste em `PastasIntegrationTest` para os três.
- Modelo de pasta: `ConteudoPastaModelo.Plano` ganha `mobilidade`; a regra "treino XOR dieta" vira "exatamente um de
  treino/dieta/mobilidade"; `AplicarModeloService` cria a mobilidade na pasta; "salvar pasta como modelo" leva o
  rascunho da mobilidade. `AplicarModeloService` passa a aceitar receita `MOBILIDADE` (cria plano de mobilidade na pasta
  escolhida); no Planejamento o cartão de Mobilidade (hoje "peça": Editar + ⋯) ganha "Aplicar ao aluno" como primário. Teste em
  `PlanejamentoIntegrationTest`.

## M3 — API do aluno

- `GET /aluno/mobilidade` (versão publicada do plano ativo, 404 sem plano), no `AlunoAppController` (`hasRole('ALUNO')`).
- `PastaDoAluno` ganha `temMobilidade`; `PlanosDaPasta` ganha `mobilidade`; `planosDaPasta` só dá 404 se a pasta não
  tiver nenhum dos três publicado; `atual` considera também a mobilidade vigente.
- Testes em `AlunoPastasIntegrationTest`: aluno vê só a própria (404 para outra), rascunho não aparece, versão nova
  aparece depois de publicar.

## M4 — App do treinador

- `api/tipos.ts`: `TipoPlano = 'treino' | 'dieta' | 'mobilidade'`; `PastaDoAluno.temMobilidade?`,
  `PlanosDaPasta.mobilidade?` (opcionais: pacote/servidor antigo).
- `api/rotas.ts`: `prefixo(tipo)` vira mapa exaustivo (`planos-treino`/`planos-dieta`/`planos-mobilidade`).
- Permissões por tipo num mapa só (ex.: `PERMISSOES_DO_PLANO: Record<TipoPlano, {ler, alterar, publicar}>`), usado por
  `CartaoPlanos`, `TopoPlano` e `dominio/permissoes.ts` (rota `/treinador/mobilidades` exige `TREINO_LER` e
  `TREINO_ALTERAR`). Teste em `permissoes.test.ts`.
- `CartaoPastas`: terceiro `CartaoPlanos tipo="mobilidade"` ("Mobilidade", depois de Treinos e Dietas), com
  `Permitido codigo="TREINO_LER"`; `FolhaNovoPlano` oferece os modelos `MOBILIDADE`.
- Editor: extrair o editor de seções/itens de `planejamento/EditorModelo.tsx` para `treinador/mobilidade/EditorDeMobilidade`
  (o modelo passa a usá-lo também) e criar a rota `app/treinador/mobilidades/[id].tsx` com `usePlanoEditor` + `TopoPlano`
  (rascunho salvo em 1,5 s, 409 → recarregar, publicar com erros/avisos da API). Regras puras em `dominio/mobilidade.ts`
  (já existe), com teste.
- PDF: **fora desta versão**; `BotaoPdf` e `gerarPdfDoPlano` não aparecem/não aceitam `mobilidade` (mapa exaustivo).

## M5 — App do aluno

- Nova aba **Mobilidade** em `app/aluno/_layout.tsx` (ícone neutro), **só quando há plano de mobilidade publicado**
  (recurso que não existe não aparece); sem conexão, decide pelo último documento salvo. Conferir no celular se 5 abas
  cabem; se não, Mobilidade entra antes de Histórico e o rótulo encurta.
- `app/aluno/mobilidade.tsx` no molde de `app/aluno/dieta.tsx`: lê `/aluno/mobilidade`, guarda no `RepositorioLocal`
  (`lerMobilidade`/`salvarMobilidade`, documento `kv` `mobilidade` como a dieta, **sem** mudar `VERSAO_ESQUEMA`), abre
  offline com o último salvo; com pasta escolhida no `SeletorPlano`, usa `escolhida.planos.mobilidade`.
  Seções em `CabecalhoDeGrupo`, itens com nome, prescrição ("—" se vazia) e "Ver vídeo" (`LinkTexto`, abre fora).
- `SeletorPlano`: chip "Mobilidade" por `temMobilidade`; texto "A troca vale para treino, dieta e mobilidade".
- Testes: bateria do `offline.test.ts` (mobilidade volta igual nas duas implementações **e o `kv` `mobilidade` some no
  `apagarTudo` do logout**, no SQLite e no chave-valor), domínio da tela.

## M6 — Fechamento

- `AGENTS.md`: uma linha em API (plano de mobilidade = padrão da dieta, permissões do treino, `MOBILIDADE_PUBLICADA`) e
  uma em App (aba do aluno, cache `kv`).
- Roteiro no navegador: criar mobilidade na pasta a partir de modelo, publicar, aluno vê na aba (online e em modo
  avião), replicar a pasta, Assistente lê e não publica, Nutricionista não vê.
- Opcional: `SeedDemo` com um plano de mobilidade fictício para o `aluno@demo.local`.

## Fora do escopo (anotar, não fazer)

Registro de mobilidade feita, PDF de mobilidade, mobilidade dentro do "Treino de hoje", permissões próprias de
mobilidade.
