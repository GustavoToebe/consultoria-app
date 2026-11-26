# Auditoria dos pedidos de 24 e 25/11

Situação: Em verificação em 25/11/2026 (todos os itens conferidos no código; I2 parcial) · Onde: branch `lote-26-11` (sem commit nem push deste lote) · Atualizado: 25/11/2026

## Objetivo
Conferir no código cada pedido dos dias 24 e 25/11 (A1 a I) e fechar o que faltava no app do aluno, para o Gustavo saber o que está feito, onde mora e o que só ele consegue ver (aparelho Android, nativo).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Lista de compras do aluno em linhas, com `ui/CaixaRedonda` (nova), períodos "7 dias · 14 dias · 30 dias" e título "Lista de N dias"; comprado riscado e no fim do grupo na tela (`gruposDaTelaDoAluno`), sem o selo "Comprado"; o PDF mantém `gruposDoAluno` e o título "Lista de compras — N dias" | A7; ver `Evolucao-lista-de-compras.md`, decisão 7 | Gustavo, 25/11 |
| 2 | Cartão Dieta do Início sem o bloco "Água do dia": uma fileira (ícone, "Dieta … Ver dieta →", refeições). `dietaNoInicio` não traz mais água (campo morto removido) | A água tem o cartão próprio "Água de hoje" | Gustavo, 25/11 |
| 3 | `CartaoAguaDoDia` sempre empilhado (título, números e barra em cima; −1 e 1 copo embaixo) | Qualquer largura | Gustavo, 25/11 |
| 4 | `Folha` usa a área segura inferior em todas as plataformas (Android incluído) | Teste `ui/Folha.areaSegura.test.tsx`; sem aparelho Android para ver | Gustavo, 25/11 |
| 5 | O ⓘ "Sobre esta tela" ganhou spec das 6 rotas que faltavam (ajuda, importação nova, planilha completa, editor de dieta, atualização, modelo): 37 telas cobertas | `e2e/ajuda-do-cabecalho.spec.ts` | Gustavo, 25/11 |

## Auditoria (conferida no código pela sessão principal)
| Item | Status | Onde | O que falta |
| --- | --- | --- | --- |
| A1 Folha com área segura inferior | Feito | `ui/Folha.tsx`, `ui/Folha.areaSegura.test.tsx` | Ver num aparelho Android (sem aparelho aqui) |
| A2 Período do Progresso por exercício ("Todas as pastas · 12 meses") | Feito | `dominio/historicoDoAluno.ts`, spec `cores-historico-dieta` | Nada |
| A3 Cartão Dieta do Início sem a água | Feito | `aluno/CartaoDietaDoInicio.tsx`, `dominio/inicioDoAluno.ts` | Nada |
| A4 Água de hoje empilhada | Feito | `aluno/CartaoAguaDoDia.tsx` | Nada |
| A5 "Nova publicação" em largura total no celular | Feito | `app/aluno/comunidade.tsx` | Nada |
| A6 Fibra na dieta do aluno ("Fibra —") | Feito | `ui/ValoresDaDieta.tsx`, `aluno/DietaDoAluno.tsx`, `e2e/fibra-do-alimento.spec.ts` | Nada |
| A7 Lista de compras do aluno em linhas | Feito | `aluno/ListaDeComprasDoAluno.tsx`, `ui/CaixaRedonda.tsx`, `dominio/listaDeComprasDoAluno.gruposDaTelaDoAluno` | Nada |
| B1 Frequência do treinador (marcador de cor) | Feito | `treinador/CartaoFrequencia.tsx`, `corDoMarcador` | Nada |
| B2 Selo da cobrança na tabela | Feito | `dominio/financeiro.seloDaCobrancaNaTabela`, `treinador/financeiro/AbaCobrancas.tsx` | Nada |
| B3 Editor do questionário em tela larga | Feito | `dominio/indiceDoQuestionario.ts` (1000/1440), `LARGURA_EDITOR_DE_CAMPOS` 1400, prévia 560 | Nada |
| B4 Distância sob a barra do editor | Feito | `TelaDoEditor.tsx` (`mostrarAbaixoDaBarra` mede a distância; ~96 px é o valor típico, sem constante) | Nada |
| B5 Sem `alturaDoConteudo` | Feito | nenhuma ocorrência no código | Nada |
| B6 Seletor de categoria | Feito | `treinador/SeletorDeCategoria.tsx` (Biblioteca › Outros e Vitrine) | Nada |
| B7 Selos e tags da linha, com Enter e Espaço | Feito | `treinador/SelosETagsDaLinha.tsx`, `e2e/lista-alunos-selos.spec.ts:74` | Nada |
| C1 Cor das séries no cartão da série | Feito | `ui/CamadaDaSerie.tsx` em `aluno/CartaoDaSerie.tsx`, specs `cor-das-series` e `cores-execucao` | Nada |
| C2 Tabela de blocos do treino | Feito | `treinador/treino/TabelaDeBlocos.tsx` | Nada |
| C3 Preferência `corDasSeries` | Feito | `ui/PreferenciasDoApp.tsx` | Nada |
| C4 Sem sobreposição em 390 e 1280 | Feito | `e2e/cor-das-series.spec.ts` | Nada |
| C5 Barra medida | Feito | `e2e/cor-das-series.spec.ts` | Nada |
| D ⓘ "Sobre esta tela" | Feito | 37 telas com ⓘ; `e2e/ajuda-do-cabecalho.spec.ts` agora cobre as 6 rotas que faltavam | Nada |
| E Aparência e preferências | Feito | `ui/PreferenciasDoApp.tsx`, `e2e/aparencia-e-preferencias.spec.ts` | Nada |
| F1 Aniversários no Início do treinador | Feito | `treinador/painel/BlocoAniversarios.tsx` | Nada |
| F2 Edição do Início | Feito | `treinador/painel/edicao/*`, integrado em `app/treinador/index.tsx` | Nada |
| G1 Dados do aluno: teto só com 3 colunas | Feito | `DadosDoAluno.tsx` | Nada |
| G2 Selo do acesso desativado âmbar com ● | Feito (em 26/11 mudou para neutro com ●, T-301 de [ajustes-de-26-11.md](ajustes-de-26-11.md)) | `seloDoAcesso` | Nada |
| G3 Redes só na Conta | Feito (em 26/11 as redes viraram a peça `ui/RedesSociais`, T-306 de [ajustes-de-26-11.md](ajustes-de-26-11.md); as da consultoria seguem só na Conta do aluno) | `FileiraDeRedes` | Nada |
| G4 Instagram na Inscrição | Feito | V102, `AvisoDePerguntaDoInstagram` | Nada |
| G5 Rodapé fixo da página | Feito | `rodapeFixoDaPagina.ts`, `TelaDoEditor` | Nada |
| G6 Foco ao entrar | Feito | `useFocoAoEntrar` | Nada |
| G7 `emailEnviado` na troca de e-mail | Feito | API e `CartaoAcesso` | Nada |
| G8 Plural | Feito | `ConfiguracaoConsultoria.java` | Nada |
| G9 `AlunoProvider` | Feito | `offline/AlunoProvider.tsx` | Nada |
| G10 `afterAll` da tela larga | Feito | `e2e/tela-larga.spec.ts` | Nada |
| G11 README | Feito | `docs/planos/README.md` | Nada |
| H1 Colunas da dieta | Feito | `colunasDaDieta.ts` | Nada |
| H2 Total do dia e por refeição | Feito | `TotalDoDia.tsx`, `PorRefeicao.tsx` | Nada |
| H3 Abas de opção | Feito | `AbasDeOpcao.tsx` | Nada |
| H4 Variações da dieta | Feito | `VariacoesDaDieta.tsx` | Nada |
| H5 Faixa da semana | Feito | `FaixaDaSemana.tsx` | Nada |
| H6 Ação na refeição | Feito | `CartaoRefeicao.tsx` | Nada |
| I1 Balão do ⓘ montado só aberto | Feito | `AjudaDoCabecalho.tsx` | Nada |
| I2 Toast acima das camadas | Parcial | toast acima de `TelaDoEditor` e `BarraDaEdicao` registrados | `Folha` no nativo ainda pode ser coberta pelo toast; pendência no README, sem aparelho para ver |

## Passos
- [x] 1. Auditar A1 a I no código — commit/run: — (lote sem commit)
- [x] 2. Fechar A1 a A5 e A7 no app do aluno e a spec do ⓘ — commit/run: —
- [x] 3. Docs: Ajuda do app (`ajuda/conteudo.ts`), `AGENTS.md`, `docs/design-e-front.md`, esta página e `Evolucao-lista-de-compras.md` — commit/run: —
- [ ] 4. Ver `Folha` (A1) e o toast (I2) num aparelho Android/iOS — commit/run: —

## Fora do escopo
- Aparelho Android e iOS: nada aqui foi visto no nativo.

## O que ficou para trás
- I2: `Folha` no nativo coberta pelo toast (já em "Pendências soltas" do README; quem: Gustavo, com aparelho).
- A1: conferir a área segura da `Folha` no Android real.
