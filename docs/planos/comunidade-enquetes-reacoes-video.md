# Comunidade: enquetes, reações melhores, capas e player de vídeo

Situação: Planejando, aguardando 4 regras das enquetes (D1 a D4) · Onde: `main`, commits locais, sem push · Atualizado: 13/11/2026

## Objetivo
Frente C do PDF `guia-cores-painel-e-comunidade.pdf` (P2 enquetes e reações, P3 capas e player de vídeo, mais as cores da Comunidade de D12 de `cores-de-destaque.md`): enquete votável no mural, reação com mais de uma opção e "você reagiu" evidente, capa nos vídeos e reprodução integrada com a alternativa de abrir fora do app. Funcionalidade completa, com permissões, isolamento por consultoria, exportação LGPD e anonimização.

## Mapa do que existe (13/11, explorador, base local)
- API em `api/.../comunidade/`: reação só no mural (`comunidade_mural_reacao`, UNIQUE `(consultoria_id, post_id, usuario_id, emoji)`, alterna sem lista de emojis: qualquer texto até 16 caracteres; "curtida única ❤️" é só convenção do app, `dominio/comunidade.ts:9`), só o aluno reage (`POST /aluno/comunidade/mural/{id}/reacoes`); vídeo = `videoUrl` https (post `VIDEO` só da equipe e aulão) abre fora do app por `abrirLinkExterno`; capa só existe no aulão (`miniaturaUrl`, sem renderização encontrada); sem enquete, sem duração, sem provedor.
- CSP local (`deploy-local/Caddyfile`): `img-src 'self' data: blob:` (capa remota não passa) e `frame-src` só Cloudflare (player embutido seria bloqueado). A CSP de produção vive no `central-api-back` (fora deste repositório).
- Última migration V071; esta frente usa **V072** e sobe o total para 72 em `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest`.
- Exportação (`ComunidadeService.exportarDoAluno`) e anonimização já tratam reação, post, comentário, foto e denúncia; voto entra igual.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | **Quem pode votar** na enquete | Em aberto (recomendação: só alunos ativos da consultoria que veem o post; equipe não vota, para não distorcer) | Gustavo |
| D2 | **Quem vê a identidade de quem votou** | Em aberto (recomendação: ninguém; só totais e o "seu voto"; identidade de voto é dado pessoal e não precisa existir para a enquete servir) | Gustavo |
| D3 | **Quem cria enquete** | Em aberto (recomendação: só a equipe com `COMUNIDADE_MODERAR`, como `AVISO` e `VIDEO`; abrir para o aluno é decisão de moderação) | Gustavo |
| D4 | **A equipe pode reagir?** | Em aberto (recomendação: sim, com `COMUNIDADE_MODERAR`; reação é só contagem, sem identidade) | Gustavo |
| D5 | Enquete é um post de `tipo = ENQUETE` com 2 a 6 opções (texto até 80), escolha única, fechamento opcional por data e resultado só depois de votar ou de fechar (a equipe vê sempre). Voto = linha `(consultoria_id, enquete_id, usuario_id)` única; trocar o voto enquanto aberta é permitido; nunca editar opções depois do primeiro voto | Mapa: nada existe; formato mínimo que cobre o PDF | Sessão principal (rotina) |
| D6 | Reação passa a ter **lista fechada** no servidor (`CURTIR ❤️, FORCA 💪, FOGO 🔥, PALMAS 👏, RISO 😂`; coluna `emoji` continua, validada contra a lista; 422 fora dela). Uma pessoa pode ter várias reações no mesmo post (a UNIQUE já permite). "Você reagiu" = contorno e preenchimento no botão, com texto acessível, além da cor (violeta como indicador? não: seleção usa contorno próprio, D9 de `cores-de-destaque.md`) | Mapa: hoje aceita qualquer texto; PDF pede reações melhores | Sessão principal (rotina) |
| D7 | **Capa do vídeo enviada pela equipe e guardada no banco** (como a foto do mural: JPEG sem metadados, 1600 px, 300 KB, servida só pela API com `no-store`), sem imagem remota, para não mudar a CSP nem expor o espectador a terceiro. Vale para post `VIDEO` e aulão (o `miniaturaUrl` externo some, sem compatibilidade) | Mapa: `img-src 'self'` bloqueia capa remota | Sessão principal (rotina) |
| D8 | **Player integrado** só para provedores de uma lista fechada (YouTube pelo domínio de privacidade reforçada e Vimeo) por `<iframe>` na web e `WebView` no celular, sem token nem cookie nosso, com o botão "Abrir no navegador" sempre presente e como único caminho para qualquer outro endereço. Local: `frame-src` do `Caddyfile` ganha esses hosts. **Produção: a mesma linha precisa entrar na CSP do `central-api-back` antes de publicar** (pendência com o Gustavo; sem ela o player falha e fica só o botão externo) | Pedido do Gustavo: reprodução integrada com alternativa externa; AGENTS: link de vídeo abre fora do app, sem token (o embed não leva token) | Sessão principal (rotina), a confirmar na entrega |
| D9 | Cores da Comunidade (D12): tipo de publicação segue neutro, exceto `AVISO` âmbar; resultado da enquete em azul/ciano/violeta por indicador (nunca verde/vermelho como "certo/errado"); voto do próprio aluno e "você reagiu" por contorno e marca, não só por cor | `cores-de-destaque.md` D5, D9, D12 | Gustavo, 13/11 |

## Contratos (para a revisão prévia do `revisor`)
- **V072**: `comunidade_mural_post.tipo` aceita `ENQUETE` (refaz o CHECK); `comunidade_enquete` (`id`, `consultoria_id`, `post_id`, `encerra_em` nulo, `criado_em`; UNIQUE `(consultoria_id, post_id)`, FK composta); `comunidade_enquete_opcao` (`id`, `consultoria_id`, `enquete_id`, `texto` varchar 80, `ordem`); `comunidade_enquete_voto` (`id`, `consultoria_id`, `enquete_id`, `opcao_id`, `usuario_id`, `votado_em`; UNIQUE `(consultoria_id, enquete_id, usuario_id)`, FKs compostas); `comunidade_mural_reacao.emoji` com CHECK da lista (D6, `NOT VALID`); `comunidade_capa` (`id`, `consultoria_id`, bytes, tipo JPEG, tamanho, `criado_em`) e colunas `capa_id` em post e aulão (FK composta, sem remover `miniatura_url` do contrato antigo além do que a sua remoção exige).
- Rotas novas (todas com `@PreAuthorize`; fora da consultoria ou do alvo = 404): `POST /comunidade/mural` aceita `tipo=ENQUETE` com `opcoes[]` e `encerraEm?` (D3); `POST /aluno/comunidade/mural/{id}/votos {opcaoId}` (aluno, D1; troca o voto; 409 `ENQUETE_ENCERRADA`; passa por `LimiteTentativas.comunidade`); `GET` do mural traz `enquete {opcoes:[{id,texto,votos?}], meuVoto?, encerrada, totalDeVotos}` (votos por opção só depois de votar, de encerrar ou para a equipe, D5; identidade de quem votou conforme D2: por padrão nunca); `POST /comunidade/mural/{id}/reacoes` para a equipe se D4; `POST /comunidade/capas` e `GET /comunidade/capas/{id}` (equipe) e leitura para o aluno só de capa de conteúdo que ele vê; `GET /aluno/comunidade/capas/{id}`.
- Exportação do aluno: `votos` (enquete, opção, data) e reações com a lista nova; anonimização e "Excluir minha conta" apagam voto e reação (identidade de voto nunca fica); equipe nunca recebe `usuario_id` de voto (se D2 mudar, é decisão registrada aqui e na política de privacidade).
- App: `dominio/comunidade.ts` (lista de reações, regras de enquete e de provedor do player), `comunidade/CartaoDoPost.tsx`, `FolhaNovaPublicacao.tsx`, peças novas (`BlocoDaEnquete`, `BotoesDeReacao`, `CapaDoVideo`, `PlayerDeVideo`), `aluno/ColecoesDeAuloes.tsx`, `treinador/comunidade/FolhaDoAulao.tsx`.

## Passos
- [ ] 1. Gustavo decide D1 a D4 (uma pergunta, com recomendação) — responsável: Gustavo — evidência: —
- [ ] 2. Revisão prévia dos contratos (V072, rotas, privacidade do voto, CSP) — responsável: `revisor` — evidência: —
- [ ] 3. API: V072, enquete, votos, reações com lista, capas, exportação e anonimização, testes de integração (isolamento por consultoria, permissões, 404/409/422, limite) — responsável: executor — commit: —
- [ ] 4. App: reações, enquete, capa e player, cores de D9, e2e (`e2e/comunidade.spec.ts`), capturas 390/1280 claro/escuro — responsável: executor-front (depois do passo 3 para os contratos reais; reações e player podem começar com o contrato já fechado) — commit: —
- [ ] 5. Documentação: `AGENTS.md` (Comunidade, link de vídeo, CSP local), `docs/design-e-front.md`, Ajuda do app — responsável: executor — commit: —
- [ ] 6. Revisão independente final (permissões, isolamento, persistência, privacidade do voto, CSP) — responsável: `revisor` — evidência: —

## Responsabilidade por arquivo (um dono por arquivo)
- API (`api/.../comunidade/*`, `db/migration/V072*`, testes, os dois totais de migrations): executor.
- App da Comunidade (`app/src/comunidade/*`, `app/src/app/aluno/comunidade.tsx`, `app/src/app/treinador/comunidade*`, `aluno/ColecoesDeAuloes.tsx`, `dominio/comunidade*.ts`, `api/comunidade*.ts`, e2e da Comunidade): executor-front, só depois de o contrato estar fechado.
- `deploy-local/Caddyfile` (CSP local): sessão principal. Compartilhados (`tema/tokens.ts`, `ui/Selo`, `ui/NumeroDeDestaque`): sessão principal.
- Não tocar: Início editável (frente B) nem Agenda/Evolução/editores (frente A).

## Fora do escopo
- Enquete com várias respostas, enquete anônima por criptografia, ranking de votantes, vídeo hospedado por nós, transcodificação.
- Comentários em enquete além do que o post já tem.
- Mudar a CSP de produção (repo `central-api-back`).

## O que ficou para trás
- (preencher ao entregar; cada sobra também vai para "Pendências soltas" no README)
- CSP de produção com `frame-src` do player (D8): Gustavo/central.
