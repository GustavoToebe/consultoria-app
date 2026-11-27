# Ajustes de tela larga e páginas públicas (27/11)

Situação: Entregue na branch `leva-1` (27/11), aguardando verificação final e push; pendências abaixo · Onde: `leva-1` · Atualizado: 27/11/2026

## Objetivo
Cinco frentes pedidas pelo Gustavo em 27/11: aba Mobilidade na prévia dos PDFs, Personalizar documentos em tela larga com
miniaturas dos modelos, Configurações › Marca enxuta com prévia grande, Auditoria com painel de detalhe e resumo útil, e
sugestão de planos nas páginas públicas "Quero ser aluno" e Ficha rápida com layout de computador e celular.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Auditoria: a API passa a devolver `objetoNome` e `origem` (sem sensível); antes/depois não existem na API e ficam fora | decidido no briefing | Gustavo (pedido) e sessão (contrato) |
| D2 | Inscrição: `planoComercialId` e `mostrarPrecoDosPlanos` (desligado por padrão), preço só com a opção ligada | decidido no briefing | Gustavo (pedido) e sessão (nomes) |
| D3 | Marca: "Contato" e "Padrões do acompanhamento" saem do formulário da Marca e viram telas próprias do hub | decidido no briefing | Gustavo |
| D4 | Auditoria: o evento ganhou `usuarioPerfil` (nome do perfil atual do autor, sem permissões; nulo para o Sistema, autor sem perfil ou fora da consultoria; membro desativado mantém o perfil); o detalhe mostra "Nome · Perfil" e a lista fica só com o nome | pedido (auditoria 27/11) | Gustavo (pedido) e sessão |
| D5 | App do aluno no PC: sem teto próprio; Início e Dieta em colunas pela altura medida (`ColunasMedidas`); mapa e vitrine lado a lado em 2560/3440; Água, Semana e Nível sem apoio fixo; sem o marco `complementary` no Início largo | decisões do Gustavo de 27/11 (sticky/apoio) e da sessão (colunas medidas) | Gustavo e sessão |
| D6 | Inscrição: o degradê do painel só no escuro (regra de 26/11); "Outro" na página completa só avisa (texto livre depende de API nova) | sessão; texto de "Outro" fica para a leva 2 | sessão |

## Passos
- [x] 1. Aba Mobilidade na prévia (exemplo fictício pelo gerador real, e2e em 4 combinações) — commit: fb57efa9 (já no origin/main)
- [x] 2. Personalizar documentos: tela larga, miniaturas, barra de estado e toast — feito, sem commit ainda (27/11)
- [x] 3. Marca compacta, Contato e Padrões do acompanhamento — feito na leva 1; auditoria de 27/11: tudo ok, exceto a prévia ao lado só com área ≥ 1280 medida (em 3440 a prévia fica limitada a 360 px) — commit: leva 1 (hash no relatório da leva)
- [x] 4. Auditoria: API (`objetoNome`, `origem`, `usuarioPerfil`) e tela (painel, dia, categoria, chips; "Nome · Perfil" no detalhe; atalho Alunos com 64 ações) — feito na leva 1; mvn direcionado e e2e (9) ok no relato da entrega; antes/depois e aparelho seguem fora (D1) — commit: leva 1 (hash no relatório da leva)
- [x] 5. Inscrição pública: planos, opção de preço, layout compartilhado (migration V111, API e app) — feito na leva 1: rótulo "Qual plano combinou?", aviso no "Outro", seções das perguntas do treinador sem cartão dentro de cartão (`cascaDaSecao`); relato da entrega: typecheck e lint ok, jest 14575 ok, e2e `inscricao*` 56 e anamnese/pasta 51 ok; capturas em `capturas/27-11-inscricao`. Fica: texto de "Outro" na página completa (API), degradê só no escuro (decisão), capturas da completa com 1 plano, sem planos e com preço ligado — commit: leva 1 (hash no relatório da leva)
- [x] 6. App do aluno no PC — feito na leva 1: sem teto (vitrine, ciclo, lista de compras e concluído também), Início e Dieta em colunas medidas (vão de 65/34 px em 1920/2560 e 0 a 6 px em 3440), apoio 380/420/440 nas demais telas; relato da entrega: tsc e lint ok, jest 489, e2e 132 ok, `tela-larga-app-do-aluno.spec.ts` 4/4 ok. Fica: Conta com `ColunasEquilibradas` local e sem Grade de indicadores, Mobilidade fora do apoio em 3440 (40%), Treino do dia sem próximo/histórico, Histórico parcial, lado a lado com o treinador, suíte completa — commit: leva 1 (hash no relatório da leva)
- [x] 7. Água do aluno e outros itens de 27/11 — feito na leva 1: pedido 20, itens 1 a 6 e capturas; fica o item 7 (botões −/+ só com borda azul e ícone neutro). Pedido 23 (Usar receita): ok, exceto a aba "Minhas" (a API não tem origem) e o Desfazer em faixa (`BarraDesfazer`), não em toast. `ui/folgaDoBotao` unificou `FOLGA_DO_BOTAO` (RolagemComTopo e colunasDoExercicio) — commit: leva 1 (hash no relatório da leva)

Capturas: `capturas/27-11-*`.

## Fora do escopo
- Antes/depois e aparelho na auditoria: a API não guarda; fica como pendência se o Gustavo quiser.

## O que ficou para trás
- Verificação final da leva 1 (mvn verify, e2e completa) e o push: ver `liberacao-01-12.md`.
- Texto de "Outro" na inscrição completa (precisa de API: campo próprio com migration ou aceitar `plano_comercial` sem pergunta), buracos restantes do app do aluno e botões da água: README, Pendências soltas.
