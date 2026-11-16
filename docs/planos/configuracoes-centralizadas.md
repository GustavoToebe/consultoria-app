# Configurações centralizadas (hub do treinador)

Situação: Em andamento (passos 1 e 2 entregues na noite de 16/11, commit local `9a9ac459`, sem push; as escolhas H1 a H10 foram pela recomendação do plano, a confirmar pelo Gustavo; faltam 3, 4 e 5) · Onde: `main` (commit local) · Atualizado: 16/11/2026

## Objetivo
Uma tela "Configurações" no app do treinador que junta, num lugar só, tudo o que hoje se configura em telas e abas espalhadas (conta, marca, equipe, questionários, financeiro, importação, auditoria). A tela é um índice: campo "Pesquisar configuração" e cartões agrupados (ícone, título e uma linha de descrição). Cada cartão só leva à tela ou aba que já existe. Nenhuma rota nova na API, nenhuma funcionalidade muda de lugar e o que a pessoa não pode abrir não aparece.

## Travas
- Só o app (`app/`). Nada em `api/` nesta frente.
- Cartão só aponta para rota que existe; `?aba=` só com valor que a tela de destino já lê. Nada de `?secao=` nem rolagem até um bloco: seria comportamento novo na tela de destino.
- Sem permissão, sem a chave da plataforma ou sem a funcionalidade do plano, o cartão some. Grupo sem cartão some. A API continua autorizando cada operação; o hub é só apresentação.
- Sem commit e sem push até o Gustavo revisar.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| H1 | Rota e acesso | `/treinador/configuracoes` (`app/src/app/treinador/configuracoes.tsx`). Abre para todo membro, como Perfil e Ajuda (sempre há cartões pessoais): entra na lista do "sempre" de `podeAcessarTela` (`dominio/permissoes.ts:29`) | Claude (a confirmar) |
| H2 | Regra pura | `dominio/configuracoes.ts`: catálogo `CARTOES_DE_CONFIGURACAO` (`id`, `grupo`, `titulo`, `descricao`, `href`, `palavras`, `permissao?`, `funcionalidade?`, `chave?`), `cartoesVisiveis(contexto)`, `buscarCartoes(texto, cartoes)` e `gruposDeCartoes(cartoes)`. Visível = `podeAcessarTela(caminhoDoHref(href), …)` (a mesma regra do menu e da guarda) **e** `permissao` extra **e** `temFuncionalidade` **e** `chave` ligada. Reaproveita `semAcento`, `caminhoDoHref` (`dominio/telas.ts:86-94`) e `temFuncionalidade`. O ícone não mora no domínio: a tela tem o mapa `id → Icone` (lucide, como `_layout.tsx`) | Claude |
| H3 | Chave da plataforma por cartão | `chave` é o nome de um booleano do `GET /eu` (`recebimentoOnlineHabilitado`, e os novos `emailDominioProprioHabilitado` e `whatsappHabilitado` da frente Contato). `pagamentosHabilitados` continua dentro de `podeAcessarTela`, como hoje. Ausente ou `false` = cartão some | Claude |
| H4 | Busca | Sem acento e sem maiúsculas, no título, na descrição e nas `palavras` (sinônimos, como na busca global); cada palavra digitada precisa aparecer (E). Vazio = todos os cartões agrupados. Sem resultado = estado vazio com "Limpar busca". A busca não muda a ordem dos grupos | Gustavo (título e descrição) / Claude (sinônimos) |
| H5 | Grupos e cartões | A tabela "Cartões" abaixo. Só destinos que existem hoje, mais os três da frente Contato quando as telas dela existirem | Claude (a confirmar) |
| H6 | Menu do usuário | `itensDoMenuDoUsuario` (`dominio/menuDoUsuario.ts`) ganha `configuracoes` como **primeiro** item ("Configurações", `/treinador/configuracoes`). O `CartaoDoUsuario` (PC) e a tela Perfil (celular) usam essa lista e ganham o item sem outra mudança. Os itens de hoje ficam (ninguém perde atalho) | Gustavo (item) / Claude (posição) |
| H7 | Catálogo de telas e busca global | `dominio/telas.ts` ganha `{ id: 'configuracoes', rotulo: 'Configurações', href: '/treinador/configuracoes', palavras: ['ajustes', 'preferencias', 'opcoes', 'configurar'] }`. `MENU_DO_TREINADOR` põe o caminho no `tambem` do Perfil (a busca o mostra em Configurações) e `TELAS_DA_CONTA` o inclui (o botão da conta fica realçado) | Claude |
| H8 | Grupo "Configurações" do menu lateral | **Não muda** nesta frente: o título do grupo continua sem link e Equipe, Importação, Ajuda e Auditoria seguem como atalhos diretos. Motivo: título de grupo clicável é comportamento novo numa peça compartilhada (`ui/Navegacao`), e um item "Configurações" dentro do grupo "Configurações" repete o nome. O hub entra pelo menu do usuário, pelo Perfil (celular) e pela busca global | Claude (a confirmar; pergunta 6 da aprovação) |
| H9 | Tela | `executor-front`, por `docs/design-e-front.md` (P2 e P5 da 4.6; bloco Composição da 6.4): um `h1` ("Configurações"), campo de busca de `ui/` que já existe (o mesmo das listas; sem componente novo), um `Cartao` por grupo com `ListaDeLinhas`/`LinhaDaLista` (ícone, título, descrição, seta), `Grade` em duas colunas no PC, uma no celular; links com `propsDeLink`, navegação com `useSaidaGuardada`, alvos de 44 px, nenhum botão primário. Cor só no ícone neutro: nada de cor de destaque por grupo (regra "Dose de cor") | Gustavo / Claude |
| H10 | Marca: quem vê | Os cartões que levam à Marca seguem a guarda da tela Marca, que hoje é `administrador` (`permissoes.ts:55`), não `MARCA_ALTERAR`. Mantido | Claude (a confirmar; pergunta 2 da aprovação) |

### Cartões
Condição = além de `podeAcessarTela` do destino. "—" = nenhuma extra.

| Grupo | Cartão | Destino | Condição extra |
| --- | --- | --- | --- |
| Sua conta | Meus dados | `/treinador/meus-dados` | — |
| Sua conta | Segurança | `/treinador/seguranca` | — |
| Sua conta | Aparência e preferências | `/treinador/ajustes` | — |
| Sua conta | Assinatura e faturas | `/treinador/minha-conta` | — (`CONTA_LER` já está na guarda) |
| Consultoria | Marca | `/treinador/marca` | — (administrador, pela guarda) |
| Consultoria | Contato da consultoria (WhatsApp e remetente dos e-mails) | `/treinador/marca` | — (frente Contato, N1) |
| Consultoria | Domínio de e-mail próprio | `/treinador/marca/dominio-de-email` | chave `emailDominioProprioHabilitado` (frente Contato, N2) |
| Consultoria | Avisos pelo WhatsApp | `/treinador/whatsapp` | chave `whatsappHabilitado` + `WHATSAPP_ALTERAR` (frente Contato, N2) |
| Equipe | Membros e convites | `/treinador/equipe?aba=membros` | — (`EQUIPE_LER` na guarda) |
| Equipe | Perfis e permissões | `/treinador/equipe?aba=perfis` | — |
| Equipe | Auditoria | `/treinador/auditoria` | — (`AUDITORIA_LER` na guarda) |
| Alunos e atendimento | Questionários de atualização | `/treinador/planejamento?aba=atualizacao` | `QUESTIONARIO_LER` |
| Alunos e atendimento | Anamneses | `/treinador/planejamento?aba=anamnese` | `QUESTIONARIO_LER` |
| Alunos e atendimento | Perguntas da inscrição | `/treinador/planejamento?aba=inscricao` | `QUESTIONARIO_LER` |
| Alunos e atendimento | Link de inscrição e respostas prontas | `/treinador/interessados` | — (`INSCRICAO_LER` na guarda) |
| Alunos e atendimento | Metodologias | `/treinador/planejamento?tipo=…` (o valor que `tipoDoPlanejamento` já aceita para Metodologias) | `MODELO_LER` |
| Financeiro | Planos comerciais | `/treinador/financeiro?aba=planos` | — (`pagamentosHabilitados` + `FINANCEIRO_LER` na guarda) |
| Financeiro | Lembretes de cobrança | `/treinador/financeiro?aba=lembretes` | — |
| Financeiro | Recebimento online | `/treinador/financeiro?aba=recebimento` | chave `recebimentoOnlineHabilitado` |
| Dados | Importação | `/treinador/importacao` | — |
| Dados | Importar planilha completa | `/treinador/importacao/planilha-completa` | — (`ALUNO_ALTERAR` na guarda) |
| Ajuda | Ajuda | `/treinador/ajuda` | — |
| Ajuda | Termos e privacidade | `/treinador/termos` | — |

Ficam de fora por não terem destino próprio (a regra "recurso que não existe não aparece"): Acompanhamento da Marca e textos das fases do ciclo (são blocos da tela Marca, sem aba; entram como sinônimos do cartão Marca), questionário padrão (ação dentro da lista de questionários; sinônimo dos três cartões de questionário), respostas prontas do CRM (folha aberta por botão em Interessados, sem parâmetro; dividem o cartão com o link de inscrição), campos ocultos da inscrição (dentro do editor do questionário) e "configurações do mural" (a Comunidade não tem tela de configuração, só moderação nas próprias listas).

## Passos
- [x] 1. Regra pura e teste (`executor`): `dominio/configuracoes.ts` + `configuracoes.test.ts` (perfil com tudo vê tudo; sem permissão some o cartão; chave desligada some; funcionalidade fora do plano some; grupo vazio some; busca sem acento por título, descrição e sinônimo; busca sem resultado; todo `href` do catálogo é aceito por `podeAcessarTela` com acesso total e todas as chaves, para cartão nenhum nascer inalcançável); `permissoes.ts` (rota nova), `telas.ts`, `gruposDoMenu.ts` (`tambem` e `TELAS_DA_CONTA`), `menuDoUsuario.ts` e os testes deles (`gruposDoMenu.test.ts`, `telas.test.ts`) — commit/run: `9a9ac459` (local, 16/11); jest `dominio/configuracoes` 20 testes
- [x] 2. Tela e e2e (`executor-front`, depois do 1): `app/treinador/configuracoes.tsx` e `e2e/configuracoes.spec.ts` em 390 e 1280, temas claro, areia e escuro: acesso total vê tudo; perfil restrito não vê os cartões sem permissão; chave desligada esconde o cartão; a busca filtra e mostra o vazio; cada cartão abre o destino certo (inclusive a aba); item "Configurações" no menu do usuário (PC) e no Perfil (390); sem rolagem lateral — commit/run: `9a9ac459` (local, 16/11); e2e `configuracoes` e `abas-foco` em 390 e 1280: 33 passaram; typecheck do app sem erro. Exceção à H9: a linha é `ItemDeLista` (alvo inteiro, como o Perfil), não `LinhaDaLista`
- [ ] 3. Cartões da frente Contato: entram no catálogo junto com cada tela dela (passos B3, B6 e B9 de `contato-da-consultoria.md`), com o caso do e2e de chave desligada — commit/run: —
- [ ] 4. Ajuda (`ajuda/conteudo.ts`: onde ficam as Configurações), guias em PDF regerados pelo gerador do projeto, `AGENTS.md` (um parágrafo) — commit/run: —
- [ ] 5. Verificações do lote: `npm run typecheck`, `npm run lint`, `npm test` e os e2e `configuracoes`, `abas-foco` e os de menu/Perfil que já existem — commit/run: —

## Fora do escopo
- Mover, fundir ou renomear telas existentes; trocar a guarda da Marca; tirar itens do menu do usuário ou do menu lateral.
- Abas ou âncoras novas em telas existentes (Marca por seções, respostas prontas por parâmetro).
- Favoritos, "recentes" e contadores nos cartões.
- Hub para o aluno (a Conta do aluno já é a tela única dele).

## O que ficou para trás
- Não conferido no código (o `executor` confirma no passo 1 antes de escrever o catálogo): o valor de `?tipo=` das Metodologias, a condição exata de cada aba do Financeiro para quem só tem `FINANCEIRO_LER`, as guardas das subrotas de Importação e o nome do componente de busca de `ui/`.
- Se o Gustavo quiser a Marca em seções endereçáveis (para "Acompanhamento" e "Contato" terem cartão próprio que abre no bloco certo), vira ajuste da tela Marca em outra frente.

## Fonte e validade
Mapa do `explorador` e leitura da sessão principal em 15/11/2026, sobre a base `5bc44c9f` mais o estado local sem commit (lote de 15/11, Financeiro "meus", P1.5). Vale enquanto `dominio/telas.ts`, `gruposDoMenu.ts`, `permissoes.ts` e `menuDoUsuario.ts` não mudarem de forma; se mudarem, reler antes de executar.
