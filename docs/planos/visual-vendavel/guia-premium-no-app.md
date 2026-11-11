# Guia visual premium no app (11/11/2026)

O Gustavo viu a prévia (`docs/prototipos/visual-vendavel/`, gostou do `treinador-treino.html`) e mandou o PDF
`guia-visual-premium-consultoria.pdf` (18 páginas, fora do repositório) com os ajustes, para aplicar **no app** (web do
treinador, web do aluno e app do aluno), "seguir exatamente o que está escrito". Sem prints. Branch
`visual-premium-comunidade`, sem commit até ele testar.

**Alvo = a prévia + o PDF.** Onde o PDF e o plano (`../visual-vendavel.md`) discordam, vale o PDF.

## Onde o PDF muda o plano
| Ponto | Plano ("Menos variáveis") | PDF (vale) |
| --- | --- | --- |
| Fileira de números grandes | na cor da marca | número geral em texto principal (42, 82%); "1 atrasada" em perigo; zero em cinza legível; hover do indicador clicável fica |
| Número de ordem / série selecionada | na cor da marca | texto neutro; a linha em edição se mostra por contorno + marcador "EDITANDO" |
| Botão principal | (discutiu-se neutro) | **na cor da marca**; o branco não vira opção |

## Três famílias de cor
- **Marca:** logo, pequeno indicador do item ativo, ação principal.
- **Situação:** revisar, atraso, erro, confirmação; sempre com texto e, quando útil, ícone.
- **Categoria:** Aquecimento ciano, FS azul, WS índigo, Top set violeta, Back off magenta; iguais na ficha, no editor e
  na visão do aluno.

## Paleta de partida do escuro
| Papel | Valor |
| --- | --- |
| fundo | `#0A0A0C` |
| painel de conteúdo | `#101013` |
| cartão | `#18181B` |
| superfície elevada | `#222226` |
| seleção neutra | `#2C2C31` |
| divisor / contorno discreto | `#36363C` |
| borda de campo | `#82828C` |
| texto principal | `#F4F4F5` |
| texto secundário | `#B5B5BE` |
| sucesso (texto sobre fundo) | `#4ADE80` sobre `#143222` |
| atenção | `#FBBF24` sobre `#352915` |
| perigo | `#FB7185` sobre `#3B1C26` |
| botão da marca | `#FFFFFF` sobre `#C62828` (5,62:1) |

No tema claro, pares próprios mais escuros (os de hoje, conferidos por teste). As outras paletas escuras seguem os
mesmos papéis, com os tons delas; o contraste de cada combinação continua conferido em `tema/tokens.test.ts`.

## Regras por lugar
- **Ação principal por tela:** "Novo aluno" na lista, "Cadastrar" no cadastro, "Publicar" nos editores; "Salvar
  rascunho", "PDF" e "Validar" secundários; botão indisponível explica o motivo.
- **Indicadores (Início e ficha):** número geral em texto principal, atraso em perigo, zero em cinza legível. Na ficha:
  peso, data e "2 de 3 treinos" em texto claro; "Pasta vencida" em selo de perigo.
- **Lista de alunos:** busca numa linha; filtros Todos / Para revisar / Atrasados + "Mais filtros" (responsável, acesso
  etc.), com a quantidade de filtros ativos e "Limpar filtros"; no celular os filtros rolam ou abrem folha; nome e
  situação mais próximos na tabela do PC.
- **Cadastro:** rótulo permanente acima do campo; erro com mensagem + destaque; anel de foco visível; botão
  indisponível diz o que falta.
- **Pasta:** dois níveis: "Vigente" no cabeçalho e "Alterações não publicadas" junto à dieta (ou ao plano que mudou);
  "Publicar dieta" / "Publicar alterações da pasta"; "Dieta publicada" só depois da confirmação real da API.
- **Editor de treino:** cor = categoria; contorno + marcador "EDITANDO" = linha em edição; número da série selecionada
  em texto neutro; erro local "Falta a carga" no campo e no exercício.
- **Editor de dieta:** total e macros em número claro com pequena marca de cor por categoria (proteína, carboidrato,
  gordura), sempre com o nome; opção A/B com seleção neutra; "Sem quantidade" junto ao alimento; tabela com nomes à
  esquerda, quantidades à direita, unidades visíveis, casas decimais consistentes, total separado, linha em edição
  realçada, divisórias suaves.
- **Acabamento:** título de página 24–28, seção 18–20, leitura 15–16, metadados 13–14; espaços 8 / 12 / 16–24 / 24–32;
  raio 8 nos controles e 12 nos cartões; cartão com contorno discreto e campo com borda mais evidente; transições de
  120–220 ms, retorno imediato ao clique, movimento reduzido respeitado, nada depende de hover no celular; alvo de toque
  44–48.
- **Próxima rodada (pág. 18), que entra agora:** contornos com pesos diferentes (contêiner discreto; campo, foco e
  seleção fortes); nome e situação próximos na lista; nome do item do menu no hover/foco, rótulos acessíveis e opção de
  expandir o menu. Manter as cores das séries, a organização da ficha e os pares próprios de cada modo.

## Detalhes do PDF que não podem faltar (releitura de 11/11)
- **Situação (pág. 4):** rascunho sem erro é neutro; âmbar só quando há decisão pendente ("Para revisar", "Falta a
  carga"). Verde de sucesso em selo discreto, nunca a linha inteira. Ação destrutiva ("Excluir aluno") leva verbo
  explícito e ícone, não só outro tom de vermelho. A série mantém a cor da categoria mesmo com o treino atrasado: o
  atraso vai em outro selo, no contexto do plano.
- **Lista (pág. 7):** linha "Filtrando: … • Limpar filtros" abaixo dos chips quando há filtro; compactar filtro não
  reduz a área de toque; o primeiro aluno aparece cedo no celular. Zero em tom secundário legível, sem parecer
  controle desativado.
- **Cadastro (pág. 8):** exemplo e ajuda abaixo do campo; placeholder nunca substitui o rótulo; foco, hover e seleção
  distinguíveis e iguais em todo o app.
- **Pasta (pág. 8):** "Editar treino" e "Editar dieta" são acessos secundários.
- **Editor de treino (págs. 9 e 17):** linha da série com faixa lateral e nome do tipo na cor da categoria; a linha
  em edição tem contorno contrastante e "EDITANDO"; na lista de exercícios o ativo recebe superfície ou marcador
  neutro; no celular o detalhe abre em folha ou logo abaixo da série escolhida. Tema claro com as versões escuras das
  cores das séries (nunca o violeta claro sobre branco).
- **Editor de dieta (pág. 10):** marca de cor por macro como na ilustração (proteína ciano, carboidrato azul, gordura
  violeta), pelos tokens que já existem, repetida no resumo e na tabela, sempre com o nome. Dizer por texto se a
  opção B substitui a refeição e quais opções entram na soma do dia. Total calórico nunca fica vermelho por ser alto.
  No celular, alimento e quantidade primeiro; macros numa segunda linha ou painel.
- **Tipografia (pág. 11):** peso médio para hierarquia; negrito em nomes, números centrais e ações.
- **Bordas (pág. 18):** contêiner discreto, campo, foco e seleção fortes; "não suavize tudo de uma vez".
- **Menu (pág. 18):** nome do item no hover e no foco do teclado, rótulo acessível e a opção de expandir (já existe
  em `ui/Navegacao.tsx`, conferir).
- **Botão principal (págs. 6 e 18):** o PDF mostra o branco como alternativa, mas a orientação final dele é manter a
  cor da marca. Fica a marca; não se cria opção de botão branco.
- **O que o PDF manda preservar (págs. 2, 15 e 18):** organização em áreas, tons escuros, rótulos e cores das séries,
  organização da ficha (treino, semana, atividade recente com linha do tempo), hover do indicador clicável e os pares
  de cor próprios de cada modo.

## Segunda releitura, página a página (11/11)
O que ainda não estava escrito acima. Vale como o resto: é o PDF ao pé da letra.

- **Pág. 2 (preservar):** a separação entre paleta e marca e a mesma experiência no computador e no celular.
- **Pág. 3:** base predominantemente neutra, com pequenas áreas coloridas; julgar a tela inteira, não a peça isolada;
  cinzas medidos por contraste, não copiados de outro produto.
- **Pág. 4:** "uma troca de marca não deve mudar o significado de um atraso": as cores de situação nunca derivam da
  cor da marca. Uma única cor não resume condições diferentes.
- **Pág. 5 (uso de cada superfície):** elevada = menus, apoio e hover; seleção neutra = fundo do item selecionado;
  painel = separação discreta entre menu e conteúdo. Cartão só de informação pode se apoiar no fundo, sem contorno
  forte. A tabela da paleta é a partida do escuro, não uma obrigação para as outras nove paletas.
- **Pág. 6 (botões):** o texto do botão principal é conferido em cada uma das 12 cores da marca. Botão indisponível
  diz o motivo **e deixa por perto a próxima ação útil**. "Publicar" só é o principal quando há versão pronta para
  publicar. O rótulo diz o alcance também dentro do editor: **"Publicar treino"**, **"Publicar dieta"**,
  "Publicar mobilidade" (hoje `treinador/plano/TopoPlano.tsx` diz "Publicar" / "Publicar para o aluno"; o e2e
  `editor-inspetor.spec.ts` cita o texto e acompanha a troca).
- **Pág. 7 (lista):** cada chip leva a contagem ("Todos 48", "Para revisar 3", "Atrasados 1") e a busca diz
  "Buscar nome do aluno" (hoje "Nome do aluno"). O filtro já existe na API (`atualizacao=ENVIADA` e `ATRASADA`, em
  `dominio/filtrosDeAlunos.ts`). O número vem do total da própria lista com aquele filtro (o mesmo que o clique
  mostra), nunca de conta feita na tela; sem permissão de ver atualizações, os chips "Para revisar" e "Atrasados"
  não aparecem; se o total não puder ser lido, o chip fica sem número. Se faltar algo na API, volta ao executor.
- **Pág. 8 (cadastro):** erro = ícone + mensagem + borda de perigo, os três juntos; "Cancelar" é ação secundária em
  texto, ao lado do principal.
- **Pág. 9 (editor de treino):** cabeçalho de colunas estável (Série, Tipo, Carga, Reps); o nome do tipo sempre
  escrito e na mesma posição; "Falta a carga" em âmbar (é decisão pendente, não erro vermelho); o desenho da linha
  não muda quando se troca de exercício.
- **Pág. 10 (editor de dieta):** "Total do dia" grande e neutro, com a unidade pequena; a marca de cor da macro
  nunca usa o verde nem o vermelho de situação (não sugere "bom" ou "ruim"); conferir com nome longo de alimento e
  número real (quatro dígitos, casas decimais).
- **Pág. 11 (acabamento):** texto secundário perde peso, não contraste; cadastro e acompanhamento com separação
  maior entre blocos; sombras, contornos e raios iguais em todas as telas.
- **Pág. 12 (medidas):** texto ≥ 4,5:1; controles e estados (borda de campo, foco, seleção, ícone que informa)
  ≥ 3:1 contra as cores vizinhas; divisória só decorativa fica dispensada. Vale para os pares reais de todas as
  paletas, incluindo hover, seleção, foco, sobreposição e o modo claro. Pares medidos do PDF: texto secundário sobre
  superfície elevada 7,79:1; borda de campo sobre cartão 4,66:1. Mora em `tema/tokens.test.ts`.
- **Pág. 13 (papéis e verificação):** papéis explícitos: fundo, superfície, texto, texto secundário, borda, foco,
  ação principal, texto da ação, situações, categorias. "A paleta escolhe as superfícies; o modo define pares
  legíveis; a marca mantém sua identidade." Conferir cada tela com nome longo, descrição, número grande e ausência
  de dado; toque, teclado, foco visível e retorno de erro e de sucesso; 390 px e PC, teclado aberto e texto
  ampliado; marca vermelha e outras, escuro, claro e superfície selecionada. Prioridade: texto e estados, depois
  bordas, filtros e espaçamento, por último movimento. Não migrar para shadcn/ui; conferir no código atual antes de
  aplicar.
- **Pág. 15:** a ficha e o editor da prévia são a referência de consistência das outras telas; o contorno de
  seleção é neutro, igual em qualquer cor de marca.
- **Pág. 16 (Início e ficha):** o perigo tem o mesmo significado no indicador, no rótulo e na lista de pendências;
  muda a hierarquia sem mudar o conteúdo (os subtextos ficam). Na ficha, "Atualização pendente" é selo de situação
  junto ao contexto; data do último treino e número de sessões em texto neutro.
- **Pág. 17:** a etiqueta do tipo da série é pílula escura com o texto na cor da categoria; o número da série em
  negrito neutro.
- **Pág. 18:** a moldura externa do conteúdo também é discreta; na lista, pasta, último treino e frequência seguem
  em colunas estáveis (aproximar nome e situação não é comprimir a linha toda); nomes explícitos separam "Publicar"
  de ação destrutiva.
- **Não dá para cumprir daqui (fica para o teste do Gustavo):** conferir com pessoas de percepções de cor diferentes
  e o toque num celular de verdade (pág. 13).

## Ordem (pág. 13)
1. Papéis de cor em `tema/`.
2. Peças compartilhadas (botão, campo, cartão, selo, filtro, item selecionável); nenhum HEX espalhado por tela.
3. Os seis fluxos: lista, cadastro, ficha, pasta, treino, dieta. Primeiro neutralizar indicadores e o número da série;
   depois bordas e colunas; por fim os nomes do menu.
4. Verificar: nomes longos, teclado, 390 px e PC, temas e marcas.

## O que vem da prévia (aprovada) além do PDF
Fonte Geist (decisão de 11/11), contorno de 1 px (2 px só com "bordas reforçadas"), raio 8 e 12, seleção neutra, menu
no tom do fundo e conteúdo em painel destacado, selo em pílula de contorno com ponto, sobretítulo de seção, ✓ neutro
para feito e verde só no que a pessoa acabou de marcar, faixa de chips que rola de lado no celular, alvo de 44 px na
migalha. Ficam as 10 paletas, as 12 cores da marca, o tema Areia, "bordas reforçadas" e a Metal Mania do nome.

## Quem mexe em quê (um dono por pasta)
| Lote | Dono | Pastas |
| --- | --- | --- |
| Fundação | executor-front | `app/src/tema/`, `app/src/ui/`, `app/src/components/ui/`, fonte, `docs/design-e-front.md` |
| Lista, cadastro, ficha, Início do treinador | executor-front | `app/src/treinador/` (menos `plano/`), rotas `app/src/app/treinador/` correspondentes |
| Pasta e editores (treino, dieta, mobilidade) | executor-front | `app/src/treinador/plano/` e os editores |
| Aluno (web e app) | executor-front | `app/src/aluno/`, `app/src/app/aluno/` |
| Comunidade | executor-front | `app/src/comunidade/`, `app/src/app/*/comunidade.tsx` |
