# Areia do Saraiva: paleta "Claro areia" mais escura

Situação: Aprovada pelo Gustavo, publicada em 14/11/2026 (aprovação do Saraiva pendente) · Onde: `main` · Atualizado: 14/11/2026

## Objetivo
O Saraiva vai usar só o tema "Claro areia" e aprovou um exemplo (montado no Gemini): areia mais escura e acinzentada, cartões em branco quente e faixas de título um tom abaixo. A paleta `AREIA` de `app/src/tema/tokens.ts` passa a seguir esse exemplo sem afrouxar nenhum teste de contraste. É mudança de valor de token (design system): afeta quem escolher "Claro areia" nas Preferências e as consultorias que escolheram Areia na Marca (`PALETAS.AREIA` de `dominio/paletas.ts`). Claro e Escuro não mudam; a cor da marca (vermelho do Saraiva) não muda.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Só a `AREIA` de `tokens.ts` muda; `global.css` só espelha claro e escuro (a Areia é aplicada em runtime), então não muda | Pedido do Gustavo | Gustavo |
| D2 | Valores do exemplo são aproximados (imagem comprimida): ajusta-se o mínimo para passar no contraste e relata-se cada desvio | Pedido do Gustavo | Gustavo |
| D3 | Seleção e interruptor desligado usam tokens que já existem (`superficie3`, `bordaCampo`); nenhum token novo | Pedido do Gustavo | Gustavo |
| D4 | Cores fixas fora de `Cores` (agenda, perfil, identificação, destaque) ganham a coluna `areia`; `escuro: boolean` vira `VarianteDoTema` (`'claro' \| 'areia' \| 'escuro'`) vinda de `useTema().variante`; os testes de contraste cobrem as três variantes com os mesmos pisos | Gustavo ("Opção 1", 14/11) | Gustavo |
| D5 | Contraste alto: `coresComContraste` calcula o `textoSuave` do claro para valer 7:1 em fundo, painel, `superficie`, `superficie2`, `superficie3` e `faixaForte`; o Claro continua com `#3F3F46` (dois testes novos em `dominio/preferencias.test.ts`) | Gustavo (14/11) | Gustavo |

## Valores finais (AREIA, antes → depois)
| Token | Antes | Depois | Observação |
| --- | --- | --- | --- |
| fundo / painel | `#F3F1EB` | `#CDCAC3` | exemplo `#CAC7C0`; Âmbar e Verde da Marca precisam de 3:1 da página (`paletas.test.ts`) |
| superficie (cartão) | `#FFFFFF` | `#E6E5E1` | do exemplo |
| superficie2 | `#F9F7F2` | `#D9D6CF` | o `#D9D6CF` do exemplo, entre cartão e faixa |
| superficie3 | `#E7E3DB` | `#D7D4CD` | exemplo `#D9D6CF`; 1,1:1 da página |
| faixaForte | `#DDD6CA` | `#CCC9C1` | |
| campo | `#FFFFFF` | `#F4F3F0` | mais claro que o cartão |
| divisor / borda / bordaCampo | `#DDD8CF` / `#B9B3A9` / `#77736B` | `#B0ACA2` / `#8E8A80` / `#625E56` | interruptor desligado = `bordaCampo` |
| textoSuave | `#52525B` (herdado) | `#4C4C54` | 4,2:1 sobre a série feita no herdado |
| sucesso / atenção / perigo / neutro | `#176E3C` / `#875710` / `#B71C1C` / `#616169` (herdados do claro) | `#125830` / `#6C460D` / `#961717` / `#4D4D53` | mínimo para 4,5:1 sobre as superfícies novas |
| fase1 a fase4 | herdadas do claro | `#AC5E76` `#537E79` `#957029` `#6973A9` | 3:1 sobre o cartão novo |

Cores fixas só da Areia: agenda AZUL `#1B6FD6` → `#1B6ED4`, TURQUESA `#0B7F8A` → `#0B7C87`, OLIVA `#758418` → `#697716`, TERRA `#A64F43` → `#A25346` (a 22,6 do `perigo` escurecido, piso 25); perfil LARANJA `#D15700` → `#BC4E00`; identificação CIANO `#00698A` → `#006483`, AZUL `#1A5CBA` → `#1959B4`; destaque azul `#1D4ED8` → `#173EAB`, ciano `#0E7490` → `#0B5D73`, violeta `#6D28D9` → `#6A27D2` (o azul fica mais escuro que o ciano e o violeta, já no limite de 4,5:1, para o par de barras manter 1,2:1).

## Passos
- [x] A1. `tokens.ts` (AREIA, `VarianteDoTema`, tabelas fixas), `preferencias.ts`, `TemaProvider` e os quatro componentes que liam `modo` — responsável: sessão principal — evidência: `tsc`, `lint` e `jest` (314 suítes, 7550 testes) verdes
- [x] A2. Testes de agenda, perfil, identificação, destaque e enquete nas três variantes; dois testes do contraste alto — evidência: `tokens.test.ts`, `contrasteDasPecas.test.ts`, `contrasteDaAgenda.test.ts`, `coresDaEnquete.test.ts`, `preferencias.test.ts`
- [x] A3. `AGENTS.md` (Níveis, Preferências pessoais) e `docs/design-e-front.md` — evidência: este commit
- [x] A4. Capturas em Claro areia antes e depois (390 e 1280), fora do git — aprovado pelo Gustavo em 14/11/2026 pelas capturas e pelo teste local. A aprovação do Saraiva continua pendente: se ele pedir outro tom, vira ajuste novo

## Telas e peças afetadas
Tudo que usa `fundo`, `painel`, `superficie`, `superficie2`, `superficie3`, `faixaForte`, `campo`, `divisor`, `borda`, `bordaCampo`, `textoSuave` e os status no tema Claro areia: `Cartao` e sua faixa, `CabecalhoDeGrupo`, `Tabela`, `Folha`, `OpcaoCartao` (seleção), `ui/interruptor.ts`, chips e escolhas, `Selo`, `Alerta`, `Botao` (perigo), séries do aluno, fases do ciclo, agenda (marcadores), perfil da Comunidade (anel e amostras), cores de identificação (tipo de série, divisão, refeição) e números e gráficos de destaque (Financeiro, peso, avaliação, enquete). Também `PALETAS.AREIA` da Marca (consultorias que escolheram Areia).

## O que ficou para trás
- Alto contraste e bordas reforçadas na Areia passam nos testes de contraste, mas só foram vistos renderizados nas capturas padrão.
- O Saraiva ainda não aprovou as capturas; a marca do Saraiva só foi conferida por `avaliarMarca`/`marcaParaTexto`, não em todas as telas.
