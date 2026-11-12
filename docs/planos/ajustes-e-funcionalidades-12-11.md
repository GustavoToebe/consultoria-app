# Brief de ajustes e funcionalidades (9 frentes, itens 01 a 17 do PDF de 12/11)

Situação: Planejando · Onde: `main` · Atualizado: 12/11/2026

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
- [ ] F01 Início responsivo (`app/treinador/index.tsx`, `CartaoPastas`, `AtividadeRecente`) · sem dependência · `executor-front` · sem rolagem horizontal e sem sobreposição em 1280/1440/1920/390 · commit/run: —
- [ ] F02 Aulões do treinador: editar, excluir, categorias (UI; API já tem PUT/DELETE) · F08 · `executor-front` · persiste após recarregar · commit/run: —
- [ ] F03 Aulões do aluno: coleções por categoria (única mudança na área do aluno, pedida) · F02 · `executor-front` · commit/run: —
- [ ] F04 Biblioteca: Modalidade como seletor fechado (`AbaExercicios`, `EscolhaSuspensa`, `modalidades.ts`) · sem dependência · Sonnet · commit/run: —
- [ ] F05 Lançamentos: máscara R$ no `CampoMoeda` (prop opcional, padrão igual), entrada/saída com texto e cor, filtros em grade · sem dependência · `executor-front` · valores em centavos corretos · commit/run: —
- [ ] F06 Cobranças API: expor ID, datas, CPF do aluno (com a permissão) e os filtros que tenham fonte; sem migration a priori (se uma for inevitável, sobe o total nos dois testes) · sem dependência · `executor` · testes de integração · commit/run: —
- [ ] F07 Cobranças tela: filtros avançados, tabela, detalhe · F06 · `executor-front` · filtros combinados · commit/run: —
- [ ] F09 Registrar pagamentos em lote (API, contrato da decisão 5) · F06 · `executor` · falha parcial, idempotência, autorização, isolamento por consultoria, auditoria · commit/run: —
- [ ] F10 Registrar pagamentos em lote (tela com revisão obrigatória) · F09 · `executor-front` · seleção múltipla; nenhum pagamento real registrado nos testes · commit/run: —
- [ ] F11 Lembretes reorganizado (`AbaLembretes`) · sem dependência · `executor-front` · nenhum lembrete real enviado · commit/run: —
- [ ] F12 Agenda: formulário de novo compromisso · sem dependência · `executor-front` · commit/run: —
- [ ] F13 Agenda: resumo ao clicar no compromisso · F12 (mesmos arquivos) · `executor-front` · commit/run: —
- [ ] F14 Interessados: trocar de aba sem recarregar o link; indicadores 4/2/1 colunas · sem dependência · `executor-front` · commit/run: —
- [ ] F15 Interessados: glossário "Como contamos" e "Limites dos dados" · F14 · `executor-front` · commit/run: —
- [ ] F16 Ajuda: refazer com busca e índice lateral; referências à barra superior e a "Todas as telas" corrigidas · sem dependência · `executor-front` · commit/run: —
- [ ] F17 Ajuda: fonte estruturada de vídeos por tela; guias PDF regenerados ou pendência sinalizada · F16 · `executor-front` + `executor-rapido` (gerador) · commit/run: —
- [ ] F08 Aulões API: normalização da categoria · sem dependência · Sonnet · commit/run: —
- [ ] F18 Revisão independente (API financeira, lote, campos novos) antes do push · F06, F09 · `advisor`/`revisor` · commit/run: —
- [ ] F19 Verificação final: tsc, lint, Jest, e2e, `mvn verify`, conferência local em 1280/1440/1920/390 com menu aberto e recolhido, temas, texto ampliado, nomes longos, vazio/carregando/falha, capturas · commit/run: —

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
- (preencher na entrega; cada sobra também vai para "Pendências soltas" no README)
