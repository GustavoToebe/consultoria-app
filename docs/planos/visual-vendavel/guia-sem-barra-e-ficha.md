# Guia premium, terceira rodada: sem barra superior, ficha do aluno e Comunidade do treinador (11/11/2026)

O Gustavo mandou a versão de 37 páginas do `guia-premium-telas-restantes.pdf` (fora do repositório) e pediu para aplicar
as novidades, que começam na página 28, e publicar. Esta rodada **substitui** a barra compacta do passo 10
(`guia-telas-restantes.md`): o treinador fica **sem barra superior global**. Branch `sem-barra-e-ficha` (base
`338b9c95`). O texto integral das páginas 28 a 37 está no fim deste arquivo; ele vale sobre qualquer resumo.

## Decisões da sessão principal (11/11)

- **D1. Sem barra superior.** `ui/BarraTopo.tsx` sai da composição do treinador e é apagado, junto da reserva de altura
  e do `contextoDoTopo`. Não fica faixa vazia nem texto genérico no lugar.
- **D2. Busca na lateral.** Menu aberto: linha "Buscar" com o atalho, logo abaixo da identidade, abrindo a busca global
  que já existe (`ui/BuscaGlobal`), com Ctrl/Cmd+K e resultados por permissão. Recolhido e trilho: botão de lupa com nome
  acessível e dica no foco.
- **D3. Conta no rodapé da lateral.** Avatar ou iniciais, nome curto e o menu da conta de hoje (`ui/CartaoDoUsuario`:
  Meus dados, Segurança, Assinatura, Marca, Ajustes e Sair, conforme a permissão). Rodapé fixo: a lista do meio rola sem
  esconder busca e conta. Recolhido: só o avatar, com rótulo acessível.
- **D4. Recolher junto da marca.** O botão de minimizar/expandir sobe para a linha da identidade (só onde o menu recolhe).
- **D5. "Todas as telas" sai por completo.** Some o botão, a entrada do Perfil e a folha (`ui/TodasAsTelas.tsx` é
  apagado). O catálogo de destinos (`dominio/telas`) continua: é ele que sustenta a busca e as permissões.
- **D6. Favoritos continuam, dentro da busca.** A estrela vai para os resultados da busca global; os dados já salvos
  (`treinos:<usuarioId>:favoritos`) são os mesmos. Sem outro catálogo nem tela de atalhos.
- **D7. Celular.** Sem faixa global. A entrada do Perfil que abria "Todas as telas" passa a abrir a busca global. A barra
  inferior e o Perfil continuam como estão.
- **D8. Nativo.** Vale a regra de hoje: busca e conta na lateral só na web; num tablet nativo largo o Perfil continua no
  menu lateral.
- **D9. Resumo do aluno.** A ordem de prioridade de `dominio/resumoDoAluno.ts` não muda. Entram dois atalhos para fluxos
  que já existem: "Abrir acesso ao app" (leva à aba Ficha, no bloco de acesso) e "Abrir rascunho" / "Ver rascunhos"
  (leva à aba Planos). Nenhum atalho envia convite, renova ou publica sozinho.
- **D10. Comunidade.** Corpo de leitura entre 760 e 960 px só na composição do treinador; `LARGURA_LISTA` não muda.
  "Quem publica no mural" vai para um acesso "Configurações do mural" com os mesmos controles. `CartaoDoPost` é
  compartilhado com o aluno: não se altera sem conferir as duas áreas.

## Regras de trabalho

Valem as regras 1, 2 e 4 a 9 de [guia-telas-restantes.md](guia-telas-restantes.md) ("Regras de trabalho"), com estas
diferenças:

- **Fora do escopo:** a área própria do aluno (`app/aluno/**`, `aluno/**`), o Início do treinador, a lista e o cadastro
  do aluno, a pasta e os editores (treino, dieta, mobilidade), e as telas já revisadas que este complemento não cita.
- Os atalhos novos são links para fluxos existentes, com as permissões de hoje e a proteção de saída
  (`useSaidaGuardada`). Sem dado, sem atalho.
- Sem camada de compatibilidade: o que sai é apagado (código, teste e texto de ajuda).
- Regra pura nova entra em `dominio/` com o teste **antes** da tela que a usa.
- `docs/` continua sem edição pelos lotes, menos os trechos de navegação de `docs/design-e-front.md` e
  `app/src/ajuda/conteudo.ts`, que são do lote N.

## Lotes e donos

| Lote | Páginas | Arquivos do lote |
| --- | --- | --- |
| N | 28, 29 e 37 (navegação) | `ui/BarraTopo.tsx` (apagar), `ui/TodasAsTelas.tsx` (apagar), `ui/Navegacao.tsx`, `ui/BuscaGlobal.tsx`, `ui/CartaoDoUsuario.tsx`, `ui/useFavoritos.ts`, `ui/MarcaTitulo.tsx`, `ui/Cabecalho.tsx` e `ui/Tela.tsx` (só a entrada do conteúdo do treinador), `app/treinador/_layout.tsx`, `app/treinador/perfil.tsx`, `dominio/gruposDoMenu.ts`, `dominio/telas.ts`, `tema/coresFixas.test.ts`, `ajuda/conteudo.ts`, trechos de navegação de `docs/design-e-front.md`; e2e `menu-do-treinador`, `links-do-menu` e as specs que usam a barra, a busca ou "Todas as telas" |
| R | 30 a 32 e 34 (Resumo e aba Ficha) | `app/treinador/alunos/[id].tsx`, `treinador/ResumoDoAluno.tsx`, `treinador/AtividadeRecente.tsx`, `treinador/PesoELesoesNoResumo.tsx`, `treinador/FotoDePerfilEditavel.tsx`, `treinador/CartaoAcesso.tsx`, `treinador/CartaoLesoes.tsx`, `treinador/anamnese/CartaoAnamnese.tsx`, `treinador/financeiro/CartaoPlanoContratado.tsx`, `dominio/resumoDoAluno.ts`, `dominio/fichaDoAluno.ts`; e2e `ficha-em-abas` e as do Resumo e do acesso |
| V | 33 e 34 (abas Planos, Acompanhamento e Evolução) | `treinador/CartaoPastas.tsx` (só a lista e o cabeçalho da aba), `treinador/CartaoFrequencia.tsx`, `treinador/CartaoMobilidade.tsx`, `treinador/CartaoAgua.tsx`, `treinador/CartaoTreinosConcluidos.tsx`, `treinador/CartaoRecordesDaSemana.tsx`, `treinador/CartaoEvolucaoRespostas.tsx`, `treinador/CartaoProgresso.tsx`, `treinador/CartaoPeso.tsx`, `treinador/CartaoAvaliacaoFisica.tsx`; e2e dessas peças |
| C | 35 e 36 (Comunidade do treinador) | `app/treinador/comunidade.tsx`, `treinador/comunidade/**`; e2e `comunidade` (parte do treinador) |

Caminhos relativos a `app/src/`. A grade da aba Acompanhamento (`estilos.contagens` em `[id].tsx`) é do lote R; o lote
V devolve no relatório o que precisar dela. `useAcompanhamentoDoAluno` (em `CartaoFrequencia.tsx`) é do lote V e o lote
R só lê. `ui/Cabecalho.tsx` já tem o espaço `antesDoTitulo` (posto pela sessão principal antes dos lotes): o lote R usa
para a foto menor ao lado do nome; o lote N não o remove. `app/src/comunidade/**` é compartilhado com o aluno: o lote C
só o altera se a mudança valer igual nas duas áreas e diz isso no relatório.

## Resultado

Integrado em 11/11/2026 na branch `sem-barra-e-ficha` (base `338b9c95`). Os quatro lotes foram do `executor-front`, um
dono por arquivo; a sessão principal integrou, testou e publicou. **Nada foi visto renderizado** (capturas dispensadas
pelo Gustavo): o que só a tela mostra está em "A conferir na tela".

### O que entrou

- **Lote N (navegação).** `ui/BarraTopo.tsx` e `ui/TodasAsTelas.tsx` apagados, com `contextoDoTopo`, `agruparPorSecao` e
  `ORDEM_DAS_SECOES`. Menu do treinador: recolher na linha da identidade, "Buscar" logo abaixo (lupa com dica no
  recolhido), conta no rodapé fixo (`ui/CartaoDoUsuario`, rótulo `Conta de <nome>`, menu para cima ou para o lado). A
  busca global (`ui/BuscaGlobal`) é uma `Folha` "Buscar" com Ctrl/Cmd+K, estrela de favorito de 44 px nos resultados e,
  com o campo vazio, os favoritos ou os atalhos. No Perfil do celular, "Buscar telas" abre a mesma busca. Ajuda
  (`ajuda/conteudo.ts`, passos `menu:busca` e `menu:conta`) e `docs/design-e-front.md` acompanham.
- **Lote R (Resumo e aba Ficha).** `dominio/resumoDoAluno.ts`: `proximoPassoDoAluno` com a situação de cada fonte
  (nunca "Tudo em dia" enquanto carrega ou depois de falhar), ação nova `acesso`, `planejamentoDoResumo` e
  `treinosDoResumo`. `treinador/ResumoDoAluno.tsx` reescrito: próximo passo primeiro, Planejamento e Última medição lado
  a lado no PC, treinos como linha de apoio quando não há registro. Foto do aluno menor ao lado do nome
  (`antesDoTitulo` do `Cabecalho`, 56/44 px, o círculo é o botão e abre a Folha "Foto de perfil"). Aba Ficha: Dados e
  contato, Acesso ao app (`?secao=acesso`), Configuração do acompanhamento.
- **Lote V (Planos, Acompanhamento e Evolução).** `dominio/pastaEmRascunho.ts` (`pastaSoComRascunho`); lista de pastas
  com o selo "Rascunho" e "Período: Não definido"; vazios compactos em Frequência, Mobilidade, Água, Treinos concluídos,
  Recordes da semana, Evolução das respostas, Progresso e Peso da ficha.
- **Lote C (Comunidade do treinador).** Coluna de leitura de **800 px** (constante local; D10 dava 760 a 960), a ação da
  aba no cabeçalho ("Novo aulão" ou "Nova publicação"), "Configurações do mural" numa Folha
  (`treinador/comunidade/FolhaConfiguracoesDoMural.tsx`, os dois `Interruptor` com mudança otimista e a recusa da API num
  `Alerta` dentro da Folha), "Abrir vídeo" e comentários no rodapé do aulão. Nenhuma peça de `app/src/comunidade/**`
  mudou.

### Ajustes da sessão principal

- **D9 corrigida: rascunho com fonte real.** O lote R deixou "Abrir pasta" porque o Resumo não sabia o que havia na
  pasta. `ResumoDoAluno` passou a ler os planos da primeira pasta aberta (`usePlanosDaPasta`) e
  `planejamentoDoResumo(pasta, pastas, rascunhos)` só diz "em rascunho" com certeza: uma pasta → "1 pasta em rascunho ·
  Sem período definido" e "Abrir rascunho"; todas → "Ver rascunhos"; mistas → "N pastas abertas · M em rascunho"; lista
  que falhou ou ainda não chegou continua "aberta". Teste "rascunho só com certeza" e caso novo em
  `e2e/ficha-em-abas.spec.ts`.
- `ui/Cabecalho.tsx`: espaço `antesDoTitulo`. `ui/Cartao.tsx`: cartão com faixa e sem corpo não desenha a borda dupla.
- `treinador/CartaoPastas.tsx`: a folha da pasta diz "Período: Não definido", como a lista.
- `ui/useComMouse.ts` apagado (ficou sem uso). `AGENTS.md`, `tema/tokens.ts` (comentário) e a lista de larguras de
  `docs/design-e-front.md` atualizados. Guias em PDF regenerados (`scripts/guias/gerar.mjs`).
- **`ui/SelecaoMultiplaSuspensa.tsx` (defeito que a tela sem barra expôs).** Com o conteúdo 52 px mais alto, o filtro
  "Origem" dos Interessados passou a ter pouco mais que o corte antigo de 280 px embaixo: a lista abria para baixo sem
  caber e a última opção ficava fora da janela. Passou a usar `dominio/escolhaSuspensa.posicaoDaLista`, a mesma regra da
  `EscolhaSuspensa` (abre do lado em que cabe e a lista nunca passa do espaço desse lado). Vale para todas as telas com
  esse filtro (Agenda, Atualizações, Auditoria, Interessados, Biblioteca, Equipe, Financeiro e lista de alunos).
- Specs: três casos conferiam "nenhum pedido além de GET" sem descontar o `POST /auth/refresh` da abertura da sessão, e
  o caso do menu media o Início com a lista já rolada até o item ativo (a Ajuda). Acertados nas specs; o app não mudou.
  `peso-historico-aluno.spec.ts` (390 px) tinha uma corrida antiga, 1 falha em 24: a `Tabela` troca de papel depois de
  se medir e o navegador recria o elemento; a spec agora espera as linhas antes de rolar (40 de 40).

### Verificações (11/11, estado local sem commit na hora da medição)

- `npx tsc --noEmit`: 0 erros. `npm run lint`: 0 erros (11 avisos em arquivos de teste que já existiam).
- Jest: 298 suítes, 6467 testes, todos passaram.
- E2e das telas mexidas (11 specs): 255 de 255 depois do acerto das specs. Conjunto inteiro, primeira rodada: 1297 de
  1310, 10 pulados e 3 falhas (o filtro dos Interessados, corrigido no app; a corrida do peso, corrigida na spec; e
  `agenda-calendario.spec.ts:596`, corrida da spec: com a confirmação aberta o fundo some da árvore de acessibilidade e
  a conferência do DELETE corria antes de o pedido chegar; agora espera, 30 de 30). Rodada final, depois da correção da
  lista suspensa: **1299 de 1310**, 10 pulados e 1 falha instável (`agenda-calendario.spec.ts:243`, o menu de visões
  depois da tecla `m`; passou 12 de 12 sozinho e 39 de 39 na spec inteira; está em Pendências soltas). Typecheck, lint e
  Jest repetidos depois da última mudança no app, com o mesmo resultado.

### Passada de 12/11 (conferência visual e ajustes; estado local sem commit, base `7611f497`)

Ordem pedida pelo Gustavo: conferir em 1280×720, 1440×900 e 390 px; compactar onde a conferência mostrasse necessidade
(na peça compartilhada, só no treinador); rever; mexer em "Fixado" e redações só com benefício claro.

- **Capturas feitas, por tema e estado** (Chromium, API simulada, relógio fixo em 12/11; pares "antes" e "depois" só nas telas do guia, o menu só tem "depois"):
  - Telas do guia (Resumo, Planos, Acompanhamento, Evolução, Ficha, Comunidade em aulões e mural, menu da conta), em
    **tema escuro**, em 1280×720, 1440×900 e 390×844, vazias e, onde cabe, com dados (Acompanhamento e Evolução).
  - Histórico do aluno (Avaliação física), em **tema claro**, nas três larguras.
  - Topo da lateral, primeira rodada: em **tema claro**, **sem logo** (inicial da marca), nome curto e longo, em 1280×720,
    1440×900 e 900×700 (trilho de 88 px); menu minimizado e a dica, só em 1280 e 1440. Só o recorte do topo, não a tela.
  - **Tela inteira com o menu novo, em tema escuro, com logo de imagem** (o ícone do próprio produto, `assets/images/icon.png`,
    servido como logo; não é a logo de uma consultoria), em 1280×720 e 1440×900, nome curto e nome longo, menu aberto e
    minimizado, cada um com a lista no topo e rolada até o fim. Marca, Buscar, recolher, rolagem e conta no rodapé
    couberam juntos e inteiros na janela em todas as situações (conferido por captura e por asserção de viewport).
- **Frequência e mobilidade** num cartão só na aba Acompanhamento (`treinador/CartaoFrequencia`, que agora busca a
  mobilidade; `CartaoMobilidade` apagado). Formato, rótulo da pasta e frases em `dominio/frequencia.resumoDaFrequencia`;
  a linha só aparece com `mostraMobilidade` (`dominio/fichaDoAluno`: `REGISTRO_LER` + `TREINO_LER`, mobilidade publicada e
  ativa na pasta vigente). Grade com `role` de tabela; em 390 px "Nenhum registro" cabe numa linha.
- **Avaliação física vazia**, só no treinador (`daEquipe`): descrição com "Nenhuma avaliação registrada.", sem o painel de
  confirmação vazio e sem a pílula do período. O ramo do aluno (Histórico) e o cartão com dados saíram idênticos ao antes,
  conferido por captura nas três larguras.
- **Topo da lateral** (`ui/Navegacao`, `ui/BuscaGlobal`): marca numa linha só dela (nome até duas linhas); na seguinte,
  Buscar com o botão de recolher ao lado. Busca mais leve (só o contorno `divisor`, sem fundo de campo) e sem o selo
  "Ctrl K": o atalho segue no `Ctrl+K`, no nome acessível e na dica (agora também no menu aberto). Minimizado: lupa e
  seta empilhadas e centralizadas, nomes acessíveis. A marca perdeu o `flex: 1`, que a esticava na vertical.
- **Sem mudança, por decisão do Gustavo:** "Fixado" (sem colisão em 390 px); selo do Aviso em âmbar (V071 intacta);
  "Buscar nas publicações" e "Ver N comentários" são exemplos de redação; rótulos visíveis no trilho de 88 px.
- **Verificações:** `tsc` 0 erros; `lint` 0 erros (11 avisos já existentes, em arquivos de teste e `CartaoSerieComEtapas`);
  Jest `frequencia`, `fichaDoAluno` e `ajuda`: 51 de 51; e2e `ficha-em-abas`, `avaliacao-fisica`, `agua-do-aluno`,
  `mobilidade-aluno`, `aluno-clareza` e `peso-historico-aluno`: 75 de 75; e2e `menu-do-treinador` e `painel`: 30 de 30.

### Não feito / sem conferir

- Peso: vazio sem compactar (fora da ordem do Gustavo).
- "Nova avaliação" em 390 px segue numa linha própria no vazio da equipe: decisão do Gustavo, não forçar na mesma linha.
- Temas areia e contraste alto, teclado aberto, texto ampliado e dados reais: não capturados em tela nenhuma. Tema claro:
  só o Histórico do aluno e o topo da lateral sem logo. Tema escuro: as telas do guia e a tela inteira do menu com logo.
- Topo da lateral: não capturado em escuro sem logo, nem com logo no trilho de 900 px, nem com logo larga (mais de 1,5
  vez a altura, que fica sozinha sem o nome) e nem com a logo de uma consultoria real; o ícone preto do produto quase some
  no fundo escuro, o que é do arquivo, não do menu. Em 390 px não há lateral.
- Em 390 px "Nova avaliação" fica numa linha própria no vazio da equipe (limite do `Cartao`, compartilhado) e o corpo do
  cartão aparece por trás do modal ao abri-lo.
- Erro de `confirmarRemoverPost` e `removerApelido` ainda vai ao aviso atrás do `PainelConfirmacao`.
- Guias em PDF não regenerados (`node scripts/guias/gerar.mjs`, no fim do lote) e APK não regenerado.
- Menu da conta ao lado, foto de 56 px alinhada ao título no PC e quebras em 390 px (faixa de fatos, "ou / Definir
  e-mail e senha", ações da Comunidade, linha da pasta com três selos): vistas nas capturas, sem defeito percebido.

## Texto integral das páginas 28 a 37

Extraído com `pypdf`. Nomes de pessoas nos exemplos são fictícios. As pastas de prints citadas ficam fora do
repositório e **não podem ser abertas**.

```text
===== PÁGINA 28 =====
CONSULTORIA / DIREÇÃO VISUAL
NOVEMBRO 2026
27 / DIREÇÃO ATUALIZADA
Sem barra superior global
Decisão solicitada: busca na lateral, conta no rodapé do menu e retirada de “Todas as telas”. O conteúdo
começa pela própria página.
SF
Studio Forja
Consultoria de treino
«
Buscar
Ctrl K
Início
Acompanhamento
Alunos
Atualizações
Agenda
Comunidade
Conteúdo
Biblioteca
Planejamento
Negócio
Interessados
Financeiro
Números
Configurações
Equipe
Importação
Ajuda
Auditoria
MC
Minha conta
Treinador  ·  abrir menu
Alunos  ›  Ficha
Marina Costa
Resumo     Planos     Acompanhamento     Evolução     Ficha do aluno
PRÓXIMO PASSO
Acesso ao app pendente
Abra os dados de acesso para preparar o convite.
Abrir acesso ao app
Planejamento
1 pasta em rascunho
Acompanhamento
Ainda sem registros de treino
PROPOSTA ILUSTRATIVA • nome e dados fictícios; ícones esquemáticos. Não há faixa vazia, linha de cabeçalho global ou botão
Todas as telas acima do conteúdo.
Busca: um acesso permanente abaixo da marca abre a busca global existente. Manter Ctrl/Cmd+K e
resultados por permissão. A busca de cada lista continua perto dos filtros dessa lista.
Conta: fica no rodapé fixo da lateral, com os destinos atuais. A lista central do menu rola sem esconder
conta e busca. O botão de recolher fica junto da marca, sem consumir uma linha no conteúdo.
Esta direção substitui a sugestão anterior de apenas diminuir o topo para 52-56 px. O novo escopo inclui a ficha do aluno
vista pelo treinador e a Comunidade do treinador. A área própria do aluno continua fora.
GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS
28 / 37


===== PÁGINA 29 =====
CONSULTORIA / DIREÇÃO VISUAL
NOVEMBRO 2026
28 / NAVEGAÇÃO E ESPAÇO
Retirar a faixa, manter os caminhos
A mudança é no lugar das funções e no espaço reservado a elas. “Todas as telas” deve sair da interface,
sem reaparecer com outro nome.
Busca acessível em todos os modos
Menu aberto: linha Buscar + atalho abaixo da identidade. Recolhido: botão de lupa com nome acessível e
dica no foco. No celular, reaproveitar a entrada de busca do Perfil ou um acesso no menu móvel, sem
adicionar uma faixa global permanente.
Conta sempre encontrável
Rodapé do menu com avatar/iniciais, nome curto e acesso ao menu da conta. Preservar Meus dados,
Segurança, Assinatura, Marca, Ajustes e Sair conforme permissões. No menu recolhido, avatar com rótulo
acessível; no celular, manter Perfil.
Remover Todas as telas por completo
Além da barra, há uma entrada dessa folha no Perfil. A proposta remove as duas entradas e a folha da
navegação visível. O catálogo de destinos continua sustentando a busca; removê-lo quebraria navegação e
permissões.
Resolver os favoritos dentro da busca
A busca já mostra favoritos, mas a edição por estrela fica na folha Todas as telas. Se favoritos continuarem
no produto, mover a estrela para os resultados da busca. Preservar os dados já salvos, sem criar outro
catálogo ou uma nova tela de atalhos.
Começo da página
Trilha curta quando necessária, um único título, ações da tarefa e abas. Não manter o texto genérico
Acompanhamento numa faixa só para ocupar o lugar da barra removida. A divisória abaixo das abas
continua separando navegação local de conteúdo.
Medidas iniciais: manter menu aberto em 240 px e recolhido em 72 px; preservar o trilho de 88 px no intervalo atual.
Itens com alvo de 44 px. Começar o conteúdo com 16-24 px de respiro. São valores de partida; verificar nomes longos,
foco e zoom ampliado.
Código lido: ui/BarraTopo.tsx; ui/Navegacao.tsx; ui/BuscaGlobal.tsx; ui/TodasAsTelas.tsx; ui/useFavoritos.ts; app/treinador/perfil.tsx. A
altura recuperada deve ser medida na versão atual; os prints não permitem quantificá-la com precisão.
GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS
29 / 37


===== PÁGINA 30 =====
CONSULTORIA / DIREÇÃO VISUAL
NOVEMBRO 2026
29 / FICHA DO ALUNO NO TREINADOR
Por que o Resumo parece fraco
O problema principal é a hierarquia de decisão: muito espaço para ausência de dados e pouca indicação de
como avançar.
PRINT FORNECIDO • Recorte da aba Resumo. A identidade nominal ficou fora do recorte; as informações pertencem ao material
enviado.
A próxima ação fica no meio. O aviso de acesso aparece depois de avatar e quatro fatos pouco
informativos. A frase manda procurar outra área, mas não oferece um caminho direto. Eu colocaria essa
tarefa antes dos indicadores, com “Abrir acesso ao app”.
Sem pasta vigente não é sem planejamento. Outro print mostra uma pasta importada em rascunho e
sem período. O resumo deveria distinguir “Nenhuma pasta vigente” de “1 rascunho disponível”,
oferecendo “Abrir rascunho” quando o dado e a permissão existirem.
A coluna vazia recebe destaque demais. Atividade recente tem um cartão próprio com apenas uma
mensagem vazia. Sem eventos, usar uma linha de apoio; com eventos, a lista volta a ocupar espaço. A
ausência de atividade recente não significa que o aluno não tenha histórico.
O peso é informação de apoio. Há peso cadastrado mesmo sem registros de treino. Mostrá-lo com data
e acesso à Evolução, em um bloco proporcional ao conteúdo. Não chamar o peso antigo de “peso atual”
nem preencher um gráfico só para ocupar espaço.
Direção: o Resumo deve responder “qual é a situação?”, “o que devo fazer agora?” e “onde vejo os detalhes?”. O
espaço que sobrar pode continuar vazio; adicionar gráficos e números sem dados só aumentaria o ruído.
Evidências: prints das abas Resumo e Planos; treinador/ResumoDoAluno.tsx; treinador/AtividadeRecente.tsx;
dominio/resumoDoAluno.ts. Novos botões propostos são atalhos para fluxos existentes; não executam convite, renovação ou
publicação automaticamente.
GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS
30 / 37


===== PÁGINA 31 =====
CONSULTORIA / DIREÇÃO VISUAL
NOVEMBRO 2026
30 / EXEMPLO DO NOVO RESUMO
Quando o aluno ainda está começando
Layout proposto para o caso mostrado: acesso ainda pendente, planejamento em rascunho e pouco
acompanhamento registrado.
PRÓXIMO PASSO
Preparar o acesso ao app
Abra a seção de acesso e escolha como convidar o aluno.
Abrir acesso ao app
Planejamento
Última medição
1 pasta em rascunho
Sem período definido
Abrir rascunho  ›
64,8 kg
Registrado em 03/11/2026
Ver evolução  ›
Treinos: ainda sem registros neste período.
Atividade recente: nenhum evento disponível.
PROPOSTA ILUSTRATIVA • peso, data e contagem fictícios. O esquema mostra a ordem e o peso visual dos blocos, não altera
dados nem prioridade de negócio.
Primeiro, destravar: uma ação clara no bloco de próximo passo. Abrir acesso ao app leva à seção
correspondente, com contexto e permissões; não gera nem envia um convite por conta própria.
Depois, mostrar o que já existe: rascunho e medição têm valor mesmo sem treino registrado. O
rascunho só aparece com fonte real; se houver vários, mostrar a contagem e “Ver rascunhos”, sem
escolher um arbitrariamente.
Vazios proporcionais: sem eventos, uma linha discreta. Não repetir caixas para “nenhuma atualização”,
“nenhum treino”, “nenhum registro” e “nenhuma atividade” se todas descrevem o mesmo início de uso.
Avatar menor junto ao nome da página, mantendo a ação de editar foto, é suficiente. Um avatar grande no centro do
resumo não ajuda a decidir o próximo passo. No celular: tarefa, planejamento, medição e histórico, em uma coluna.
GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS
31 / 37


===== PÁGINA 32 =====
CONSULTORIA / DIREÇÃO VISUAL
NOVEMBRO 2026
31 / RESUMO COM DADOS
A mesma estrutura, outra prioridade
Quando o acompanhamento já está acontecendo, o resumo deve evidenciar exceções e oferecer acesso
rápido aos detalhes.
PRÓXIMO PASSO
Uma atualização aguarda sua revisão
 Revisar atualização
Pasta vigente
Novembro
Treinos registrados
3 nesta semana
Último registro
Ontem
PROPOSTA ILUSTRATIVA • dados fictícios. “3 nesta semana” é contagem; não é uma taxa de adesão nem prova de realização de
todo o plano.
Respeitar a prioridade existente
O código prioriza aluno anonimizado/inativo, atualização enviada, atualização atrasada, renovação, primeira
pasta e falta de acesso. Reutilizar essa decisão na nova apresentação. Mudar a ordem é uma decisão de
produto separada.
Fatos em uma faixa curta
Pasta, período e contagem de treinos com rótulos explícitos. Não transformar cada fato num grande cartão.
Último registro deve dizer seu escopo: desta pasta, desta semana ou geral, conforme a fonte.
Histórico recente quando existe
Mostrar até os cinco eventos já fornecidos, com data e destino quando houver. Exemplo: plano publicado →
abrir pasta. Não criar um feed de informações clínicas nem inventar destino para evento sem link.
Dados que não chegaram
Carregando, falha, sem permissão e nenhum registro precisam de apresentações diferentes. Não mostrar
“Tudo em dia” como conclusão geral enquanto fontes necessárias estiverem indisponíveis; sinalizar o que
ainda não pôde ser verificado.
Código: dominio/resumoDoAluno.ts (prioridade e renovação); treinador/ResumoDoAluno.tsx (ações atuais: revisar e renovar);
treinador/AtividadeRecente.tsx (até 5 eventos). A disponibilidade dos novos atalhos precisa ser implementada respeitando permissões
e proteção de saída.
GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS
32 / 37


===== PÁGINA 33 =====
CONSULTORIA / DIREÇÃO VISUAL
NOVEMBRO 2026
32 / OUTRAS ABAS DA FICHA
Planos e Acompanhamento
Preservar as abas, mas reduzir caixas que apenas repetem que não há registros. A leitura deve acompanhar
o estado real do aluno.
PRINT FORNECIDO • A altura do cartão Água empurra os demais blocos; várias linhas mostram apenas ausência de registro.
Planos: o rascunho precisa falar por si. Título, selo Rascunho e período “Não definido” na mesma linha
de leitura. “Nova pasta” continua principal; “Usar pacote”, secundário. A explicação sobre pasta pode ficar
em uma frase curta de apoio, sem ocupar um cabeçalho alto.
Acompanhamento: reduzir a cascata de vazios. Frequência e mobilidade cabem num resumo
compacto. Se não há dados de água, substituir sete linhas com traços por uma mensagem localizada.
Treinos, recordes e respostas numéricas vazios podem ficar em seções curtas, expansíveis se isso
ajudar.
Sem meta não equivale a não cumpriu. Separar meta de água não configurada de meta configurada
sem registro. O primeiro pede contexto de configuração; o segundo apenas informa ausência de
marcação. Não derivar avaliação de comportamento dessas ausências.
Com registros, mostrar conteúdo. Treinos com data e acesso ao registro; água com unidade e período;
recordes com seu contexto. Não manter alturas fixas herdadas do estado vazio. No PC, alinhar os blocos
pelo topo; no celular, usar uma sequência única.
O conteúdo principal deve aparecer cedo, mas sem impor “tudo acima da dobra”. Ações, explicações essenciais e dados
reais têm prioridade. Se uma seção for recolhida, seu título e estado continuam visíveis; erros não desaparecem junto
com o conteúdo.
Evidências: prints das abas Planos e Acompanhamento, incluindo a continuação com treinos, recordes e respostas vazios. Os
períodos atuais das métricas devem permanecer explícitos e não ser uniformizados por aparência.
GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS
33 / 37


===== PÁGINA 34 =====
CONSULTORIA / DIREÇÃO VISUAL
NOVEMBRO 2026
33 / OUTRAS ABAS DA FICHA
Evolução e Ficha do aluno
A evolução responde o que mudou. A ficha guarda cadastro, acesso e contexto. A aparência precisa deixar
essas funções claras.
PRINT FORNECIDO • A legenda informa que as cores de variação seguem a meta de reduzir o peso. Esse contexto é importante.
Evolução: dados disponíveis primeiro. Neste caso há peso cadastrado, mas não há progresso por
exercício. Dar mais presença à série de peso e reduzir o vazio de exercícios. Preferir uma regra estável:
seções preenchidas em destaque e ausências em linhas compactas, sem saltos a cada carregamento.
Peso: manter data, sinal e meta. A cor já segue a meta efetiva no código. Não trocar por uma regra
universal de “perder peso é bom”. Colocar a legenda da meta perto do título ou da tabela; sem meta,
variação neutra. Lista e gráfico já existem: refiná-los, não pedir um gráfico novo.
Ficha: organizar por assunto. Separar Dados e contato, Acesso ao app e Configuração do
acompanhamento. O bloco de acesso deve agrupar estado, conta vinculada e ações; hoje essas peças
ficam espalhadas pela largura. “Editar” continua associado ao cadastro.
Duas formas de acesso, hierarquia clara. Dar destaque ao convite quando esse for o caminho
escolhido pelo produto; manter definir e-mail/senha como alternativa explícita no mesmo bloco. Não fundir
as ações. Os campos e exigências de segurança continuam sendo os existentes.
Anamnese, plano comercial e lesões. Manter separados e proporcionais ao conteúdo. Um plano
comercial ausente não é o mesmo que ausência de pasta de treino. Anamnese opcional não é alerta
obrigatório. “Nenhuma lesão registrada” não deve virar “Sem lesões”.
Objetivo e observações podem conter informações sensíveis. Mostrar apenas no contexto e para as permissões já
previstas, sem copiá-los para busca global, cards da Comunidade ou um novo resumo público.
Evidências: prints Evolução/Ficha; treinador/CartaoPeso.tsx; dominio/corDaVariacaoDoPeso.ts; dominio/fichaDoAluno.ts. Revisão de
apresentação, sem interpretação clínica ou alteração de metas.
GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS
34 / 37


===== PÁGINA 35 =====
CONSULTORIA / DIREÇÃO VISUAL
NOVEMBRO 2026
34 / COMUNIDADE DO TREINADOR
Organizar publicação e leitura
Análise do código atual e dos prints locais. O site solicitado abriu o login; o usuário autorizou seguir com as
evidências locais.
PRINT DE REFERÊNCIA • Captura antiga da aba Aulões. Não representa uma validação visual da versão publicada atual.
O código atual já tem Aulões e Mural, criação em folha, busca e filtros do mural, fixados, denúncias e
comentários. O print antigo do Mural ainda mostra um formulário grande na página; não uso essa captura
para afirmar que o formulário continua assim.
Título e ação na mesma região. “Comunidade” com Aulões/Mural logo abaixo. Novo aulão ou Nova
publicação acompanha a aba ativa, na área do cabeçalho local. Isso evita uma linha isolada de botão
entre abas e conteúdo.
Aulões com informação útil. Título primeiro, categoria e estado discretos, descrição como apoio, Abrir
vídeo e comentários no rodapé. Se título e descrição repetem o mesmo texto, a publicação precisa de
revisão editorial; não excluir silenciosamente conteúdo gravado.
Uma lista de leitura, não um painel vazio. A largura máxima declarada hoje é 1800 px. Testar corpo de
leitura em torno de 760-960 px para publicações, com limites responsivos. Não esticar parágrafos por
toda a tela nem preencher o espaço restante com métricas inventadas.
A proposta mantém vídeo externo e os recursos existentes. Não depende de buscar miniaturas de terceiros nem de criar
recomendações, rankings ou contagens de engajamento que o produto não fornece.
Fontes: app/treinador/comunidade.tsx; comunidade/CartaoDoPost.tsx; tema/tokens.ts (LARGURA_LISTA = 1800); pasta local
Treinador/19-comunidade. Endereço solicitado: https://overtraining.app/treinador/comunidade.
GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS
35 / 37


===== PÁGINA 36 =====
CONSULTORIA / DIREÇÃO VISUAL
NOVEMBRO 2026
35 / EXEMPLO DO MURAL
O conteúdo vem antes da configuração
A equipe publica, acompanha conversas e modera. Ajustes permanentes podem ficar numa área secundária,
sempre acessível.
Comunidade
Nova publicação
Aulões
Mural
Configurações do mural
Buscar nas publicações
Todas   Avisos   Dúvidas   Vídeos
Denunciados
Equipe  ·  Hoje, 09:00
Fixado
Aviso
Encontro do time no sábado
Confira o horário e as orientações no recado da equipe.
Ver 3 comentários
PROPOSTA ILUSTRATIVA • publicação e contagem fictícias; filtros exemplificados, não lista completa. Usar os tipos e permissões
reais do produto.
Configurações fora do caminho de leitura. O código coloca “Quem publica no mural” antes da criação
e dos filtros. Proponho um acesso Configurações do mural que abre os controles existentes. A mudança é
de posição; não altera quem pode publicar, anexar fotos ou moderar.
Feed com uma hierarquia previsível. Autor e data → tipo/fixado → texto ou vídeo → comentários.
Fixados são identificados com texto/ícone, sem transformar todos em grandes faixas. Cor de perigo fica
nas denúncias; tipo de post não vira alerta por padrão.
Moderação localizada. Manter ações no menu do post e confirmações existentes. “Respondida” só
quando o estado real disser isso. Reação não deve aparecer como ação da equipe, pois o componente
atual não oferece curtida ao treinador.
CartaoDoPost é compartilhado com a área do aluno. Aplicar ajustes específicos de gestão na composição do treinador;
qualquer alteração compartilhada precisa ser conferida nas duas áreas, sem reabrir o redesign do app do aluno.
GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS
36 / 37


===== PÁGINA 37 =====
CONSULTORIA / DIREÇÃO VISUAL
NOVEMBRO 2026
36 / ENTREGA AO IMPLEMENTADOR
Aplicar a direção mais recente
Este complemento prevalece sobre a proposta anterior de manter uma barra compacta. As orientações das
páginas 4-23 continuam válidas onde ainda faltarem.
Primeiro: liberar o topo
Retirar BarraTopo da composição desktop do treinador e sua reserva de altura. Reposicionar busca, conta e
recolher na lateral. Remover entradas de Todas as telas também no Perfil e resolver edição de favoritos na
busca, se forem mantidos.
Depois: fortalecer o Resumo
Reorganizar prioridade, fatos e histórico. Acrescentar atalhos para acesso e rascunhos com permissões e
destinos existentes. Conferir estados: sem acesso, com rascunho, atualização a revisar, atraso, inativo,
anonimizado e falha parcial.
Em seguida: ajustar as abas
Compactar vazios de Acompanhamento, destacar a informação disponível em Evolução e agrupar acesso na
Ficha. Preservar regras, períodos, dados e o trabalho já concluído nos editores.
Por fim: Comunidade
Rever cabeçalho local, largura de leitura e posição das configurações. Preservar criação em folha, filtros,
comentários, fixados, moderação e permissões já implementados. Conferir a versão publicada quando
houver sessão disponível.
Verificação do resultado
Comparar antes/depois com a mesma resolução e dados: 1280 × 720, 1440 × 900 e celular de 390 px. Medir
o início do conteúdo e largura útil. Testar menu aberto/recolhido, foco, Ctrl/Cmd+K, conta, nomes longos,
claro/escuro e texto ampliado.
Recorte final: estrutura do treinador, ficha do aluno dentro do painel do treinador e Comunidade do treinador foram
incluídas por pedido posterior. As demais telas da área própria do aluno continuam excluídas. Este documento entrega
orientações e exemplos; nenhum arquivo do app foi alterado.
Evidências novas: Documento sem título (3).pdf; nove prints anexados da ficha; código local em visual-premium-comunidade; prints
antigos locais da Comunidade. A página online redirecionou ao login e não foi avaliada autenticada. Esquemas com dados fictícios nas
páginas 28, 31, 32 e 36.
GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS
37 / 37


```
