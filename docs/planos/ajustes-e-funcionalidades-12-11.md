# Brief de ajustes e funcionalidades (9 frentes, itens 01 a 17 do PDF de 12/11)

Situação: Publicada em 12/11/2026 (`4eb68bbf`, run 43315925886, `publicar` verde) · Onde: `main` · Atualizado: 12/11/2026

## Objetivo
Executar o brief `brief-ajustes-e-funcionalidades-claude.pdf` (Início responsivo, Aulões, Biblioteca, Lançamentos, Cobranças com registro em lote,
Lembretes, Agenda, Interessados e Ajuda). Autorização do Gustavo (12/11): fazer tudo como está no PDF, commitar, mesclar na `main` e dar push
(sem force). Pendência real (falta algo) fica separada de decisão de apresentação no relatório final.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Escopo | Os 17 itens do PDF; só entra o que for dessas frentes; trabalho alheio preservado | Gustavo (PDF, pág. 18) |
| 2 | Ordem | Bloco 1 (front sem contrato novo) e Bloco 2 (Financeiro, depende do contrato da API) em paralelo, arquivos disjuntos; um responsável por arquivo de escrita | Claude |
| 3 | Vídeos da Ajuda | Fonte estruturada tipada e vazia; sem link inventado; o bloco de vídeo só aparece quando a entrada tem URL (recurso que não existe não aparece); pendência real até o Gustavo enviar as URLs | Claude (o PDF não traz URLs) |
| 4 | Cor de entrada/saída | Texto "Entrada"/"Saída" sempre presente; azul só como sinal, token já existente ou um único token novo em `tokens.ts`, conforme "Dose de cor" | Claude (a confirmar na tela) |
| 5 | Lote de baixa (contrato) | `POST` novo em `/cobrancas`: corpo `{itens:[{cobrancaId, versao}], ...dados da baixa manual}`, sem valor (o servidor decide), no máximo 100 itens; resposta `{resultados:[{cobrancaId, ok, codigo}]}` com `codigo` estável; id inexistente e de outra consultoria dão o MESMO código (não vaza existência); cada item chama `BaixaDeCobranca.baixar` por um bean separado, em transação própria, sem `@Transactional` externo (autochamada viraria uma transação só e mataria a falha parcial); idempotência vem da baixa idempotente + `versao` (sem tabela de chaves); cada baixa ainda gera a próxima cobrança (o teste confere por item); `FINANCEIRO_ALTERAR`; auditoria de resumo fixo por item; a tela mostra revisão obrigatória (lista, total calculado pelo servidor na resposta de revisão ou pela soma dos valores já carregados, confirmação) e depois o resultado por item; só API simulada/local nos testes | Claude (revisar pelo advisor) |
| 6 | Campos da cobrança | Mostrar só o que tem fonte de dado: ID (id da cobrança), Pagamento (data da baixa), CPF (o do aluno, só com `ALUNO_SENSIVEL_LER`, nunca em log/auditoria) e Emissão (só se for `criado_em`, confirmado antes de chamar assim). Sem fonte hoje: CNPJ/CPF de pagador distinto do aluno e Crédito em conta; não se cria coluna/filtro que fique vazio: pendência real para o Gustavo (precisa do provedor/dado) | Claude, regra "recurso que não existe não aparece" |
| 7 | Status | Só os do domínio (`ABERTA`, `PAGA`, `CANCELADA`, `ESTORNADA`, `CONTESTADA`, VENCIDA calculada) com nome em português claro; "Ativo" e "Renegociado" do PDF não existem no domínio: decisão de produto pendente (Gustavo), não entram | Pendência: Gustavo |
| 8 | Categoria de Aulões | Texto livre opcional continua; normalização no servidor (`trim`, vazio vira nulo); "excluir categoria" limpa a categoria das aulas sem apagá-las; sem tabela nova | Claude |

## Passos (ID · dependência · responsável · aceitação)
- [x] F01 Início responsivo (`app/treinador/index.tsx`, `CartaoPastas`, `AtividadeRecente`) · sem dependência · `executor-front` · sem rolagem horizontal e sem sobreposição em 1280/1440/1920/390 · feito (local, 12/11): coluna mínima = título + 3 ícones + moldura, escalada pelo texto ampliado (`painel/grade.ts` `colunasDaGrade(largura, fatorTexto)`: 3 em 1280/1440 com menu aberto, 4 em 1440 recolhido e 1920, 2 em 1280 com texto extra, 1 no celular), faixa com título no topo e ícones juntos, blocos com a própria altura; `CartaoPastas` e `AtividadeRecente` são da ficha do aluno, não do Início, e não mudaram · evidência: `painel/grade.test.ts`, `e2e/painel.spec.ts` (grade em 390/1280/1280 recolhido/1440/1440 recolhido/1920 e texto extra) · commit `73c77c7f` (publicado no run 43315925886, 12/11)
- [x] F02 Aulões do treinador: editar, excluir, categorias (UI; API já tem PUT/DELETE) · F08 · `executor-front` · persiste após recarregar · commit `91cf58a9` (publicado no run 43315925886, 12/11)
- [x] F03 Aulões do aluno: coleções por categoria (única mudança na área do aluno, pedida) · F02 · `executor-front` · commit `91cf58a9` (publicado no run 43315925886, 12/11)
- [x] F04 Biblioteca: Modalidade como seletor fechado (`AbaExercicios`, `EscolhaSuspensa`, `modalidades.ts`) · sem dependência · Sonnet · commit `538bf8bc` (publicado no run 43315925886, 12/11)
- [x] F05 Lançamentos: máscara R$ no `CampoMoeda` (prop opcional, padrão igual), entrada/saída com texto e cor, filtros em grade · sem dependência · `executor-front` · valores em centavos corretos · commit `85c773ef` (publicado no run 43315925886, 12/11)
- [x] F06 Cobranças API: expor ID, datas, CPF do aluno (com a permissão) e os filtros que tenham fonte; sem migration a priori (se uma for inevitável, sobe o total nos dois testes) · sem dependência · `executor` · testes de integração · commit `bc1f67df` (publicado no run 43315925886, 12/11)
- [x] F07 Cobranças tela: filtros avançados, tabela, detalhe · F06 · `executor-front` · filtros combinados · commit `85c773ef` (publicado no run 43315925886, 12/11)
- [x] F09 Registrar pagamentos em lote (API, contrato da decisão 5) · F06 · `executor` · falha parcial, idempotência, autorização, isolamento por consultoria, auditoria · commit `bc1f67df` (publicado no run 43315925886, 12/11)
- [x] F10 Registrar pagamentos em lote (tela com revisão obrigatória) · F09 · `executor-front` · seleção múltipla; nenhum pagamento real registrado nos testes · commit `85c773ef` (publicado no run 43315925886, 12/11)
- [x] F11 Lembretes reorganizado (`AbaLembretes`) · sem dependência · `executor-front` · nenhum lembrete real enviado · commit `85c773ef` (publicado no run 43315925886, 12/11)
- [x] F12 Agenda: formulário de novo compromisso · sem dependência · `executor-front` · commit `abfebea6` (publicado no run 43315925886, 12/11)
- [x] F13 Agenda: resumo ao clicar no compromisso · F12 (mesmos arquivos) · `executor-front` · commit `abfebea6` (publicado no run 43315925886, 12/11)
- [x] F14 Interessados: trocar de aba sem recarregar o link; indicadores 4/2/1 colunas · sem dependência · `executor-front` · causa: `router.push`/`replace` na troca de visão montava a tela de novo (o link e `/responsaveis` eram lidos a cada aba); a rota `/inscricoes/configuracao` existe na API. Agora `router.setParams` (como a Agenda: o voltar sai da tela em vez de voltar aba por aba); indicadores pela regra `dominio/grade.colunasDosIndicadores` (4, 2 ou 1, nunca 3) com a prop opcional `colunas` da `ui/Grade` · evidência: `e2e/interessados-indicadores.spec.ts`, `dominio/grade.test.ts` · commit `73c77c7f` (publicado no run 43315925886, 12/11)
- [x] F15 Interessados: glossário "Como contamos" e "Limites dos dados" · F14 · `executor-front` · feito (local, 12/11): termo e explicação em 2 colunas no PC e 1 no celular, conferidos com `IndicadoresDeInscricoes`; "Limites dos dados" com retenção de 180 dias, origem como registrada hoje, datas de Brasília e o "—"; Perdas e Origens lado a lado sem esticar o vazio (prop opcional `alinhar` da `ui/Grade`) · evidência: `e2e/interessados-indicadores.spec.ts` · commit `73c77c7f` (publicado no run 43315925886, 12/11)
- [x] F16 Ajuda: refazer com busca e índice lateral; referências à barra superior e a "Todas as telas" corrigidas · sem dependência · `executor-front` · commit `d6d807ab` (publicado no run 43315925886, 12/11)
- [x] F17 Ajuda: fonte estruturada de vídeos por tela; guias PDF regenerados ou pendência sinalizada · F16 · `executor-front` + `executor-rapido` (gerador) · commit `d6d807ab` (publicado no run 43315925886, 12/11) · vídeos: fonte `videos.ts` tipada e vazia (pendência real: URLs do Gustavo); guias PDF regenerados pelo gerador
- [x] F20 Agenda: lateral interna compacta no PC (mini calendário nas proporções do Google Agenda, lateral de 240 a 280 px, semanas mais baixas, menos moldura, setas leves; grade principal ganha o espaço; sem zoom nem redução geral de fonte; alvos de toque confortáveis; celular tratado à parte; conferir com nomes reais e o mesmo zoom do navegador; `Calendario` compartilhado só por prop opcional) · F12/F13 (mesmos arquivos) · `executor-front` · pedido do Gustavo em 12/11 (após o PDF) · commit `abfebea6` (publicado no run 43315925886, 12/11)
- [x] F08 Aulões API: normalização da categoria · sem dependência · Sonnet · commit `de40b1fd` (publicado no run 43315925886, 12/11)
- [x] F18 Revisão independente (API financeira, lote, campos novos) antes do push · F06, F09 · `advisor`/`revisor` · feito (revisor independente, 12/11): achados tratados (`JA_ESTAVA_PAGA` explícito, `ok` só quando gravou); sobras em "O que ficou para trás"
- [x] F19 Verificação final: tsc, lint, Jest, e2e, `mvn verify`, conferência local em 1280/1440/1920/390 com menu aberto e recolhido, temas, texto ampliado, nomes longos, vazio/carregando/falha, capturas · feito (12/11, árvore igual à commitada): `npm run typecheck` 0 erros; `npm run lint` 0 erros (11 avisos antigos); `npm test` 301 suítes e 6516 testes; e2e completo com API simulada 1435 passaram, 10 pulados, 0 falhas; `mvn verify` completo com Docker: 2337 testes, 0 falhas, 1 pulado (BUILD SUCCESS), sem migration nova (total segue 71); capturas nas pastas do scratchpad da sessão

## Donos de arquivo e ondas (no máximo 3 agentes em paralelo)
- Dono único do Financeiro no app (`treinador/financeiro/*`, `comum.tsx`, `dominio/financeiro.ts`, `ListaOuTabela`): um `executor-front`, em sequência F05, F11, F07, F10, contra o contrato da decisão 5 em `e2e/api-falsa.ts`.
- Dono único da Agenda (F12 e F13): um `executor-front`. Dono único da Ajuda (F16, F17), de Interessados (F14, F15, que começa conferindo se o app chama a rota removida `configuracaoInscricao()` em vez de `/questionarios/{id}/link`: se sim, é correção do cliente da API) e de Início (F01).
- Arquivos compartilhados (`api/tipos.ts`, `api/rotas.ts`, `e2e/api-falsa.ts`, `tokens.ts`, `ajuda/conteudo.ts`): edições só aditivas; quem precisar de mudança não aditiva avisa a sessão principal.
- Onda 1: `executor` (API: F06, F09) + `executor-front` Financeiro + `executor-front` Interessados e Início. Onda 2: Agenda, Aulões e Ajuda. A sessão principal faz F04 e F08 nos intervalos.
- Documentar em `AGENTS.md` a rota de lote e os campos novos da cobrança; token novo de cor (decisão 4), se houver, entra no relatório como acréscimo ao design system com as telas afetadas.

## Limites
- Nada de pagamento ou lembrete real; produção nunca serve para conferir tela; distinguir API simulada de integração real e demo de dado real no relatório.
- Peças compartilhadas só mudam por prop opcional com padrão igual; área do aluno preservada (exceto F03).
- Pagamento atrasado nunca bloqueia o aluno; CPF/CNPJ nunca em log nem auditoria.

## Fora do escopo
- Editor de vídeos da Ajuda e links reais (aguardam as URLs do Gustavo).
- Renovações em "Meus" no Financeiro (registrada em `composicao-de-telas-12-11.md`).

## O que ficou para trás
**Pendência real (falta algo que só o Gustavo tem ou que o domínio não tem):**
- Vídeos da Ajuda: `app/src/ajuda/videos.ts` está vazio; falta o Gustavo passar as URLs https (por tela e público).
- Cobranças: CNPJ e pagador diferente do aluno, crédito em conta, status "Ativo" e "Renegociado" e busca por CPF não têm fonte de dado e não aparecem (regra "recurso que não existe não aparece").
- Guias PDF: regenerados pelo gerador; o APK não foi regenerado.

**Decisão de apresentação / conferência que não foi feita:**
- "Emissão" = `criado_em` (momento em que o sistema gerou a cobrança); a tela diz "Criada em" onde coube. Falta confirmar se o Gustavo quer outro nome.
- Cor de entrada/saída: seguiu "Dose de cor"; o conflito com o documento de design (se houver) fica para o Gustavo decidir.
- Agenda D4: rótulos sempre visíveis no painel rápido não foram feitos.
- Ajuda: o destaque do tópico no índice não acompanha a rolagem feita à mão (só o último escolhido); a fonte injetada de vídeos só é testada no Jest.
- Aulões: renomear/excluir categoria em lote não existe (cada aulão muda a própria categoria); grafias diferentes da mesma categoria aparecem em chips separados.
- Visual: temas areia e contraste alto, texto ampliado fora do EXTRA, leitor de tela, barra de rolagem do Windows e app nativo (Android/iOS) não foram conferidos; `CabecalhoDeGrupo` segue sem `aria-expanded`; `ui/Selo` conferido só na Comunidade.
- Lote de baixa com mais de 100 itens só está coberto no Jest.

**Observações do revisor que ficaram abertas (não bloqueiam):** teste de emissão que diferencie UTC de Brasília (linha às 23h30); testes de `ALUNO_INATIVO`/`ALUNO_ANONIMIZADO` no lote, `ERRO_INESPERADO`, concorrência e `alunoCpf` nulo; mensagem de data futura para data anterior a 2000; mensagem de `PERIODO_INVALIDO` sem citar o filtro; sem índice em `criado_em` (sem migration neste lote).

**Sugestões para o design system (não alteradas):** props `colunas`/`alinhar` de `ui/Grade`, `PeriodoDoFiltro`, máscara de moeda e `cpfMascarado`.
