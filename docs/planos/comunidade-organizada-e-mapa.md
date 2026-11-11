# Comunidade organizada e mapa de treinos

Situação: Em andamento · Onde: branch `visual-premium-comunidade` (estado local, sem commit; base `6dca4d9f`) · Atualizado: 11/11/2026

## Objetivo
A comunidade deixa de ser um mural único: cada publicação tem tipo, dá para filtrar e buscar, o aviso é da equipe e
fica no topo, vídeo entra por link, o aluno publica foto e tira dúvida. E o aluno passa a ver o próprio ano de treinos
num mapa (estilo contribuições do GitHub). Pedido do Gustavo em 11/11 ("quero que você faça o que você me recomendou
sobre a comunidade e do mapa"), sem compatibilidade com o que existe (ainda não há cliente).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| C1 | Tipos de publicação (lista fechada) | `AVISO`, `VIDEO`, `DUVIDA`, `RESULTADO` e `CONVERSA` (o padrão, para o post sem assunto; acrescentado pela sessão) | Gustavo aceitou a recomendação; `CONVERSA` é da sessão, confirmar |
| C2 | Quem publica o quê | `AVISO` e `VIDEO` só a equipe (`COMUNIDADE_MODERAR`); aluno publica `CONVERSA`, `DUVIDA` e `RESULTADO`. Tipo fora do permitido = 422 `POST_INVALIDO` no campo `tipo` | recomendação aceita |
| C3 | Aviso | nasce fixado; a lista ordena fixados primeiro, depois os mais novos; a equipe desafixa pela rota que já existe | recomendação aceita |
| C4 | Vídeo | publicação da equipe com `videoUrl` (https, por `LinksExternos`); o texto é o título; abre fora do app, sem token; miniatura pela mesma regra dos Aulões. Aluno não envia vídeo (corpo limitado a 1 MiB); só link no texto não vira cartão | recomendação aceita |
| C5 | Filtro e busca | `tipo` e `busca` (texto sem acento) nos dois `GET` do mural; `busca` nos `GET` de aulas | recomendação aceita |
| C6 | Dúvida | a equipe passa a comentar no mural (`COMUNIDADE_MODERAR`); comentário traz `daEquipe`; no post `DUVIDA` os da equipe vêm primeiro; o post traz `respondida` | recomendação aceita |
| C7 | Foto no post do aluno | 1 a 4 por post; só JPEG, regravado sem metadados (`JpegSemMetadados`, 1600 px, 300 KB, como a imagem do questionário); guardada no banco (não depende do bucket); uma foto por requisição, pendente até o post; órfã com mais de 24 h sai; 20 por usuário em 24 h; bytes só pela API, `no-store` | recomendação aceita |
| C8 | Foto de aluno menor | desligada até a revisão jurídica: só anexa quem tem data de nascimento e 18 anos ou mais (sem data = não anexa, como o perfil reservado) | recomendação aceita; "sem data = não" é da sessão, confirmar |
| C9 | Chaves do treinador | `alunosPublicam` e `alunosAnexamFotos` na consultoria (padrão ligadas), em `GET`/`PUT /comunidade/configuracao` (`COMUNIDADE_MODERAR`); desligada, o aluno recebe 403 `PUBLICACAO_DESLIGADA` ou `FOTO_NAO_PERMITIDA`; comentar e reagir continuam | recomendação aceita |
| C10 | Denunciar | aluno denuncia post (motivo de lista fechada, uma vez por post); a equipe vê a contagem, filtra os denunciados e dispensa ou remove | recomendação aceita |
| C11 | Publicar resultado com um toque | botão "Publicar na comunidade" na tela "Bom trabalho!" abre a publicação `RESULTADO` com o texto pronto e editável; nada vai sozinho | recomendação aceita |
| M1 | Mapa: onde | Início do aluno, abaixo de "Sua semana", e no topo do próprio perfil | recomendação aceita |
| M2 | Mapa: dados | `GET /aluno/sessoes-concluidas?de=&ate=` (já aceita 366 dias); sem rota nova; só aparece com `retornoHabilitado` | código |
| M3 | Mapa: tons | vazio = sem treino; médio = "Fiz em parte" (`PARCIAL`); cheio = "Fiz tudo" (`COMPLETA`); cor da marca, nunca verde; legenda com texto | recomendação aceita |
| M4 | Mapa: tamanho | celular: últimos meses com rolagem lateral, começando no mais recente; PC: o ano inteiro; tocar no dia mostra a data, o treino e o resultado | recomendação aceita |
| M5 | Perfil do colega | continua com os últimos 30 dias | recomendação aceita |

## Passos
- [x] 1. API: V071 (tipo, vídeo, busca, fotos, denúncias, chaves), rotas, exportação LGPD, anonimização, testes; tipos e regras puras no app (`api/comunidadeTipos.ts`, `dominio/comunidade.ts`) — executor — commit/run: sem commit (estado local); `mvn -o verify` em `api/` 2305 testes, 0 falhas, JaCoCo ok, em 11/11; `npm test -- comunidade acoesAuditoria` 59 de 59, `npm run typecheck` e eslint limpos
- [x] 2. Regra pura do mapa (`dominio/mapaDeTreinos.ts` + teste, e o hook `aluno/useMapaDeTreinos.ts`) — executor — commit/run: sem commit (estado local); `npm test -- mapaDeTreinos` 10 de 10, typecheck e eslint limpos em 11/11
- [x] 3. Telas da comunidade (aluno e treinador): tipos, filtro, busca, aviso fixado, vídeo, dúvida, fotos, denúncia, chaves — executor-front — commit/run: sem commit (estado local, 11/11): `comunidade/CartaoDoPost`, `BarraDoMural`, `FolhaNovaPublicacao`, `PainelDeDenuncia`, `fotosDoMural.ts`; wrappers novos `alternarFixadoDoPost` e `removerPostDoMural` em `api/comunidade.ts`. Vídeo sem miniatura e foto sem ampliar (não pedidos). Nada visto renderizado (o Gustavo dispensou capturas)
- [x] 4. Mapa de treinos no Início e no perfil do aluno — executor-front — commit/run: sem commit (estado local, 11/11): `aluno/MapaDeTreinos.tsx` no Início, abaixo de "Sua semana", e no topo da `FolhaPerfilDoColega` quando é o próprio aluno; só com `retornoHabilitado`
- [x] 5. "Publicar na comunidade" na tela "Bom trabalho!" — executor-front — commit/run: sem commit (estado local, 11/11): botão secundário com `publicar=RESULTADO` e `texto` de `dominio/publicarResultado.ts`, desabilitado sem internet com motivo; a comunidade abre a publicação com o texto editável, limpa o endereço e nunca publica sozinha. A conferir: com a chave "alunos publicam" desligada, a folha pode abrir sozinha se a configuração recarregar ligada (não publica)
- [x] 6. Revisão independente (migration, isolamento, LGPD, foto) e verificações locais — revisor — commit/run: revisão da API feita pelo revisor em 11/11 (achados corrigidos; o que ficou para depois está em Pendências soltas do índice); `mvn -o verify` da branch inteira em 11/11: 2328 testes, 0 falhas, cobertura atendida, BUILD SUCCESS (sem commit, branch local); app: typecheck e lint limpos, Jest 296 suítes / 6772 testes, e2e `comunidade`, `bom-trabalho`, `inicio-aluno`, `perfil-do-colega` e `perfil-comunidade` verdes. As telas não tiveram revisor nem foram vistas renderizadas
- [x] 7. `AGENTS.md` (item Comunidade e contagem de migrations) e espelhos (`acoesAuditoria.ts`) — commit/run: sem commit (branch local): item "Comunidade organizada (V071)" e contagem 71 no `AGENTS.md`; `COMUNIDADE_CONFIGURACAO_ALTERADA` e `COMUNIDADE_DENUNCIAS_DISPENSADAS` espelhadas em `acoesAuditoria.ts`; `FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest` verdes no verify; guias em PDF da Ajuda gerados de novo

- [ ] 8. Na subida para produção: ligar `TREINOS_RETORNO_HABILITADO=true` no `consultoria.env` da VPS e conferir que o compose de produção (`central-api-back/deploy`) repassa a variável à API; sem ela o mapa e o "Publicar na comunidade" não aparecem — sessão principal — commit/run: — (autorizado pelo Gustavo em 11/11: "Quando subir pra prd pode ligar tbm"; a alteração na VPS pede o ok dele na hora, como toda mudança lá)

## Fora do escopo
- Vídeo enviado pelo aluno (só se o uso pedir).
- Push quando sai um Aviso (o push está desligado e hoje só fala de compromisso): fica em "Pendências soltas".
- Denúncia de comentário (só de post).
- Mapa do ano no perfil do colega.

## O que ficou para trás
- Revisão independente da API (11/11, só leitura): nada que bloqueie. Corrigido em seguida (executor, sem commit): o teto de 20 fotos em 24 h virou o balde `foto-mural` do `LimiteTentativas` (apagar não devolve cota, envio inválido não gasta, continua 422 `FOTOS_LIMITE_DIARIO`; janela fixa de 24 h a partir do primeiro envio) e o `texto_busca` é cortado em 2000; `mvn -o test` das quatro classes da comunidade e do `ArquiteturaTest`: 67 testes, 0 falhas. Para depois:
  - limpeza da foto pendente com mais de 24 h só roda no próximo envio da mesma consultoria (`shortcut:` no código); pendurar no job `FotosManutencao`;
  - duas consultas por post na lista do mural (`findByPostId` e `countByPostIdAndOcultoFalse`), que já existiam antes da V071; agrupar quando o mural crescer;
  - posts anteriores à V071 ficam fora da busca (`texto_busca` vazio; sem compatibilidade, decisão);
  - o teste não cobre envios em paralelo contra o teto, foto enviada com `alunosPublicam` desligado nem o `UPDATE` de `da_equipe` nos comentários de aula antigos.
