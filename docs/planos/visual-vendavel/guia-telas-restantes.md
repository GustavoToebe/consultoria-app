# Guia premium: telas restantes + cabeçalho e menu do treinador (11/11/2026)

O Gustavo mandou o PDF `guia-premium-telas-restantes.pdf` (31 páginas, fora do repositório) e pediu: extrair tudo,
comparar com o que existe hoje e, onde estiver diferente, corrigir **seguindo exatamente o que está escrito**. Pediu
também o cabeçalho e o menu lateral do treinador "igual ao da prévia" (páginas 28 a 31 e a recomendação abaixo).
Branch `visual-premium-comunidade` (base `6dca4d9f`, estado local, sem commit). O texto integral do PDF está no fim
deste arquivo; ele vale sobre qualquer resumo.

Recomendação aceita pelo Gustavo para o cabeçalho e o menu (texto dele, junto do `Documento sem título (3).pdf`):
- Topo compacto e útil: controle do menu e localização da tela à esquerda; busca e conta à direita.
- Busca preservada: pode ficar mais discreta, mantendo acesso visível e atalho.
- Identidade compacta na lateral: logo e nome alinhados, como na prévia, reduzindo o espaço acima da navegação.
- Menu com hierarquia mais leve: grupos discretos, ícones consistentes e seleção evidente.
- Conteúdo começando mais cedo: reduzir espaçamentos repetidos entre cabeçalho, título e primeira seção, mantendo a
  legibilidade.

## Regras de trabalho (valem para todos os lotes)

1. **Reconciliar antes de editar** (página 24): abrir a tela atual, comparar com o capítulo e classificar **cada
   orientação** como `já atendido`, `falta local` ou `sem evidência` (depende de estado que não dá para conferir no
   código). Só edita o que for `falta local`. Orientação já atendida não se refaz. Os prints do PDF são anteriores ao
   guia: não provam nada sobre a árvore de hoje.
2. **Exatamente o PDF**: os textos entre aspas são exemplos de redação a seguir quando o estado existir; não criam
   regra de negócio, dado, cálculo, rota, permissão nem recurso. Sem dado é "—". Não inventar porcentagem, prazo,
   taxa, ranking ou tendência.
3. **Fora do escopo** (não tocar): telas do aluno, Comunidade, Início do treinador, lista, cadastro e ficha do aluno,
   pasta, editores de treino, dieta e mobilidade, editor de modelo do Planejamento, Ajustes, as três telas de entrada
   (`/entrar`, `/aluno/entrar`, `/treinador/entrar`), comparação de fotos, rodapé das folhas, filtros de data e menu
   "Mover para" dos Interessados, módulo Financeiro ativo.
4. **Fundação**: ler `docs/design-e-front.md` (seções 4.1 a 4.6) e `guia-premium-no-app.md` (nesta pasta) antes de
   editar. Três famílias de cor (marca, situação, categoria); seleção e números neutros; cor sempre com texto ou forma
   junto; Geist; contorno discreto em contêiner e forte em campo, foco e seleção. Reutilizar as peças de `app/src/ui/`
   (abas, campos, filtros, folha, `Tabela`, `ListaDeLinhas`, `Selo`, `Escolha`...); **não criar segunda implementação**.
5. **Um dono por arquivo**: outros agentes editam a mesma árvore ao mesmo tempo. Edite só os arquivos do seu lote.
   Peça compartilhada de `app/src/ui/` que não é do seu lote **não se edita**: componha na tela ou devolva o pedido no
   relatório. Ninguém edita `docs/`, `AGENTS.md` nem `app/src/ajuda/conteudo.ts` (só o lote da Ajuda): devolva a regra
   ou o texto que ficou desatualizado no relatório.
6. **Proibido**: commit, push, stash, checkout, reset, rebase; rodar e2e, `expo export`, docker ou servidor (a árvore
   está em movimento: a sessão principal roda os e2e no fim); tirar print; abrir `Desktop/Print sistema` ou
   `Documents/Icondev`; `alert()`/`confirm()`; dado real (só fictício); trocar o nome do produto; ler ou exibir `.env`.
7. **Verificações do lote** (em `app/`): `npx tsc --noEmit` (erro em arquivo de outro lote só se relata),
   `npx eslint <seus arquivos>`, `npx jest <suas pastas>`. Atualize, sem rodar, as specs de `app/e2e/` cujo assunto é
   a sua tela (texto, papel ou estrutura que mudou) e crie caso novo só para comportamento novo.
8. **Conferência pedida pelo PDF** (página 24), feita por leitura do código: 1280 px e 390 px, claro e escuro, conteúdo
   longo, texto ampliado; estados vazio real, sem resultado, carregando, erro, sem conexão, seleção, foco, envio e sem
   permissão. Estado de rede não pode parecer ausência definitiva de dados.
9. **Relatório** (português, curto): tabela de reconciliação por orientação (`orientação | classificação | o que foi
   feito, arquivo:linha`); arquivos alterados; verificações com o resultado; specs e2e ajustadas e as que a sessão
   principal deve rodar; pedidos a peças compartilhadas; texto da Ajuda ou regra de `docs/design-e-front.md` que
   precisa de atualização; o que não foi conferido.

## Lotes e donos

| Lote | Telas (páginas do PDF) | Arquivos do lote |
| --- | --- | --- |
| N | Cabeçalho e menu lateral do treinador (28 a 31) | `ui/BarraTopo.tsx`, `ui/Navegacao.tsx`, `ui/MarcaTitulo.tsx`, `ui/Cabecalho.tsx`, `ui/CartaoDoUsuario.tsx`, `ui/BuscaGlobal.tsx`, `ui/TodasAsTelas.tsx`, `ui/Tela.tsx` (só a entrada do conteúdo do treinador), `app/treinador/_layout.tsx`, `dominio/gruposDoMenu.ts`; e2e `menu-do-treinador`, `links-do-menu` |
| A | Atualizações, detalhe, Agenda (4 a 6) | `app/treinador/atualizacoes/**`, `app/treinador/agenda.tsx`, `treinador/agenda/**`, peças da atualização em `treinador/` usadas só por essas telas |
| B | Biblioteca, Planejamento, Questionários (7 a 9) | `app/treinador/biblioteca.tsx`, `treinador/biblioteca/**`, `app/treinador/planejamento/index.tsx`, `treinador/planejamento/**` (menos o editor de modelo), `treinador/questionarios/**`, `app/treinador/planejamento/questionario/**` |
| C | Interessados, Números, Equipe, Auditoria (10, 11, 13, 15) | `app/treinador/interessados.tsx`, `treinador/interessados/**`, `app/treinador/numeros.tsx`, `app/treinador/equipe.tsx`, `treinador/equipe/**`, `app/treinador/auditoria.tsx` |
| D | Importação, Montador (14, 23) | `treinador/importacao/**`, `app/treinador/importacao/**`, `app/montador/**`, `montador/**` |
| E | Assinatura e Financeiro indisponível, Marca, Perfil e Meus dados, Segurança, Ajuda e Termos do treinador (12, 16 a 19) | `app/treinador/minha-conta.tsx`, `app/treinador/financeiro.tsx` (só o estado indisponível), `treinador/conta/**`, `app/treinador/marca.tsx`, `treinador/marca/**`, `app/treinador/perfil.tsx`, `app/treinador/meus-dados.tsx`, `app/treinador/seguranca.tsx`, `treinador/seguranca/**`, `app/treinador/ajuda.tsx`, `ajuda/**`, `app/treinador/termos.tsx` |
| F | Recuperação de senha, convites, cadastro do treinador, inscrição pública, privacidade, termos e exclusão (19 a 22) | `ui/TelaPublica.tsx`, `app/esqueci-senha.tsx`, `app/redefinir-senha.tsx`, `app/convite-equipe.tsx`, `app/convite.tsx`, `app/cadastro.tsx`, `app/inscricao/**`, `app/privacidade.tsx`, `app/termos-de-uso.tsx`, `app/excluir-conta.tsx` |

Caminhos relativos a `app/src/`. Regra pura de `dominio/` e teste dela seguem a tela que a usa.

## Resultado (11/11/2026, branch `visual-premium-comunidade`)

Nada foi visto renderizado (pedido do Gustavo: sem prints). A evidência é typecheck, lint, Jest e os testes de tela (e2e, API falsa).

| Tela | O que faltava e foi corrigido | Sem evidência ou de fora |
| --- | --- | --- |
| Cabeçalho e menu (pág. 28 a 31) | Barra ~66 → ~53 px com o botão de recolher e o contexto à esquerda; identidade 96 → 68 px; contagem neutra; grupos discretos | Subtítulo da identidade (sem dado real); dica no botão só-ícone |
| Atualizações (lista) | Subtítulo curto, vazio próprio por aba, vazio de busca com o termo; "Revisada" neutra para o treinador | — |
| Detalhe da atualização | Cartão do motivo sem depender de `ATUALIZACAO_RESPONDER`; pergunta em peso médio e resposta na largura de leitura | Nome e período da pasta (a API não traz) |
| Agenda | Item com fundo neutro, cor da agenda só na faixa de 8 px, aberto em `superficie3` + `bordaCampo`; "Revisada" continua com o ✓ | Tipo do compromisso (a API não traz) |
| Biblioteca | Escolha neutra em Alimentos/Suplementos; catálogo sem opacidade, ✓ neutro e motivo; as cinco abas em superfície comum com divisórias (`ListaDeLinhas divisorias`) | A aba Outros perdeu o cabeçalho de colunas do PC (mostra "Concentração · Apresentação" na segunda linha) |
| Planejamento | Busca, "Organizar coleções" e "Nova…" numa fileira | — |
| Questionários | "Publicar questionário/anamnese/perguntas"; secundário quando não há nada novo | `proximoQuestionarioCodigo` (pendência D4 de `formularios-unificados.md`) |
| Interessados | Etapas abertas neutras; cartão do link; quadro Kanban | — |
| Números | "Equipe hoje", legenda e número neutro | — |
| Equipe | Motivo de não poder editar o perfil; motivo no "Salvar seus dados" | — |
| Auditoria | Erro da lista de pessoas dentro do próprio filtro; linhas sem selo de rotina (nome em peso médio, data e resumo em texto secundário) | — |
| Importação | Um primário; validação com Total, Novos, Atualizados, "Já existem (ficam como estão)" e "Com erro (ficam de fora)"; selo "Concluída com erros"; "Tentar de novo" | Alerta "preenchido automaticamente" segue em `sucesso` |
| Montador de dieta | Contorno `divisor` na prancheta e no catálogo | — |
| Assinatura e conta | Cobrança com competência e valor primeiro, vencimento e situação juntos, valor neutro; texto do consumo | — |
| Marca | Grupo "Aparência", prévia ao lado a partir de 880 px, "Tema padrão da consultoria", erro da logo no campo, cor só com nome e amostra | — |
| Perfil | "Minha conta" e "Consultoria"; "Sair" à parte | — |
| Segurança | Estados da verificação em duas etapas (carregando, erro, offline) | — |
| Ajuda | "Começar a usar" e "Consultar", 720 px; textos novos do menu, da importação e de Atualizações; guias em PDF regenerados | — |
| Fluxos públicos | Esqueci a senha, convite do aluno, convite de equipe e cadastro | — |
| Termos | Já atendido | Índice de âncoras ("pode ser avaliado") |

Decisões da integração: o selo "Rascunho em revisão" continua `atencao` (o PDF dá Termos como atendido); "Não informado" continua "—" (regra do `AGENTS.md`); `ui/Campo` com 2 px no foco e no erro fica como está.

## Texto integral do PDF

Extraído com `pdftotext -layout`. "T" e "P" são pastas de prints fora do repositório (`Desktop/Print sistema`), que
**não podem ser abertas**. Nomes de pessoas nos exemplos são fictícios.

```text
CONSULTORIA / DIREÇÃO VISUAL                                          NOVEMBRO 2026

COMPLEMENTO / NOVEMBRO DE 2026

O mesmo padrão,
nas telas restantes

Overtraining • Guia de composição para gestão, apoio e fluxos públicos. Complementa o PDF anterior sem
reabrir as telas já revisadas.

A base aprovada continua: fundos e superfícies neutros, contraste de leitura, ação principal bem definida e
cores com papéis estáveis. Nesta rodada, o ganho vem de organizar o conteúdo de cada tarefa, reduzir
repetição e dar contexto aos estados.

TELAS RESTANTES

Encontrar. Entender. Agir.

ACOMPANHAMENTO                              GESTÃO                    ACESSO

Atualizações e agenda                       Conteúdo, equipe e conta  Convites e inscrição

Leitura recomendada

Escopo e método: páginas 2 e 3. Orientações por tela: páginas 4 a 23. Ordem de aplicação e conferência:
página 24. Mapa das evidências e referências: páginas 25 a 27. Novo complemento sobre cabeçalho e menu
lateral: páginas 28 a 31.

    Recorte confirmado: excluir telas do aluno e Comunidade. Preservar o Início e os seis fluxos do treinador já cobertos
    pelo guia anterior. Este novo documento contém orientações; nenhuma tela do app foi alterada por esta análise.

Base consultada: branch local visual-premium-comunidade, HEAD 6dca4d9f com alterações em andamento, em 11/11/2026. Os prints
locais são referências anteriores à aplicação integral do guia.

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS                                                  01 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

01 / ESCOPO

O que entra e o que fica pronto

Não confundir herança de cores e componentes com uma revisão específica de composição da tela.

Preservar: guia anterior

Início do treinador; lista, cadastro e ficha do aluno; pasta; editores de treino e dieta. O editor de mobilidade
também está no lote atual da prévia e dos componentes compartilhados.

Preservar: confirmação do usuário

Todas as telas do aluno e a Comunidade ficam fora. Não há uma nova rodada de recomendações para
essas áreas neste PDF.

Preservar: revisões já registradas

Comparação de fotos e exportação de imagem; rodapé das folhas; filtros de data e menu Mover para dos
Interessados. Planos locais registram trabalho já feito. Não refazer essas partes.

Aplicar apenas às lacunas

Agenda, Biblioteca, Marca e outras áreas já receberam ajustes de peças ou tokens. Este guia trata da
composição que não teve revisão específica registrada. Se uma orientação já estiver atendida na árvore
atual do Claude, apenas conferir e marcar como atendida.

Tratamento limitado

Financeiro: avaliar somente o estado indisponível capturado. Editor de modelo: herdar os editores já
revisados, sem capítulo de redesenho. Ajustes e login: preservar base compartilhada; abordar apenas os
fluxos públicos restantes. Montador: apêndice interno.

    Os registros do plano ajudam a delimitar o escopo, mas não são uma validação visual feita nesta sessão. A árvore está
    em andamento. A lista deste PDF é uma orientação para o próximo lote, não um pedido para repetir tudo.

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  02 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

02 / COMO INTERPRETAR

Referência, evidência e proposta

Cada capítulo identifica o que foi observado, qual ajuste é sugerido e como conferir o resultado.

    Print de referência: imagem local do sistema de demonstração. Mostra composição e conteúdo daquele
    estado; não representa automaticamente a versão atual da branch.

    Código consultado: confirma comportamentos e peças existentes. Não comprova que o layout atual foi
    renderizado ou testado nesta análise.

    Proposta: decisão de apresentação a aplicar somente onde ainda faltar. Exemplos de texto e dados
    ilustrativos não são novas regras de negócio.

Padrão que continua valendo

    Marca: ação principal e identidade, com indicadores ativos pequenos; não usar para colorir todos os
    números.

    Situação: atenção, erro e confirmação têm significado constante e texto junto. Estado normal pode ficar
    neutro.

    Categoria: cor identifica o tipo; seleção é neutra com marcador/contorno. Não usar a categoria para dizer
    se algo está errado.

    Estrutura: Geist, superfícies por nível, contorno discreto em contêiner e forte onde identifica campo, foco
    ou seleção. Reutilizar os tokens e componentes já alterados.

    Exceção pública já existente: sem consultoria reconhecida, a ação usa o contraste neutro do produto; com a marca
    conhecida, usa a marca fornecida pelo fluxo. Isso não cria uma preferência de botão branco no painel do treinador.

Referências internas: guia-premium-no-app.md; design-e-front.md, seções 4.1-4.6; ui/TelaPublica.tsx. A cor precisa de outra pista de
significado [R1].

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  03 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

03 / ORIENTAÇÃO POR TELA

Atualizações: chegar à pendência

T08 / Lista, abas, busca e estados vazios. A lista é uma fila de trabalho, não um painel de indicadores.

PRINT DE REFERÊNCIA • A captura disponível mostra a fila vazia; não comprova como as linhas preenchidas ficam hoje.

Leitura: O topo usa uma explicação longa antes da busca. No celular, a combinação de descrição, busca e
abas afasta o conteúdo. As quatro situações já existem e devem continuar distinguíveis.

    Encurtar a entrada. Usar uma linha como “Revise os envios e acompanhe os prazos”. Deixar a
    explicação completa na Ajuda. Manter as quatro abas, com contagens neutras; não criar outro conjunto
    de filtros para as mesmas situações.

    Distinguir os vazios. Na fila realmente vazia, explicar a situação escolhida. Sem resultado de busca,
    mostrar o termo e “Limpar filtros”. Erro de carga deve ter retorno próprio, sem parecer zero atualizações.

    Com itens. Conferir nome, pasta/período, data e situação em uma linha no PC. No celular, nome primeiro
    e contexto abaixo. A linha abre o detalhe; não repetir um botão vermelho em todos os alunos.

    No seu contexto: Exemplo de texto, sem alterar a regra da fila: “Nenhuma atualização para revisar agora.” Na aba de
    atrasadas: “Nenhuma atualização atrasada nesta lista.”

Conferir: Conferir lista vazia, filtro sem resultado e pelo menos dois envios fictícios. As contagens devem continuar
representando os mesmos filtros da lista.
Código de referência: app/src/app/treinador/atualizacoes/index.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  04 / 31
CONSULTORIA / DIREÇÃO VISUAL                                                            NOVEMBRO 2026

04 / ORIENTAÇÃO POR TELA

Revisar sem perder o contexto

T09 / Detalhe da atualização. O resumo orienta a leitura; o feedback encerra a tarefa.

PRINT DE REFERÊNCIA • Resumo e feedback já aparecem em colunas. Preservar essa estrutura.

Leitura: O código atual já coloca o feedback ao lado do resumo no PC e logo depois dele no celular. A
oportunidade está no peso das informações, não em inventar um segundo layout.

    Cabeçalho preciso. Aluno, data e pasta devem ser reconhecidos antes das respostas. Versão do
    questionário fica em apoio. “Revisada” é estado informativo; “Para revisar” sinaliza a tarefa pendente.

    Respostas legíveis. Pergunta em peso médio; resposta com largura de leitura; informação ausente como
    “Não informado” quando esse for o significado real. Não transformar ausência de resposta opcional em
    erro.

    Ação contextual. Na edição, dar prioridade a “Enviar feedback”; após o envio, o retorno confirma o que
    ocorreu. Manter “Abrir pasta”, “Próxima” e “Editar feedback” no contexto existente, sem duplicar a ação no
    cabeçalho e no rodapé.

    No seu contexto: Exemplo de hierarquia: “Marina · Atualização 10/11” → “Pasta de novembro” → resumo → respostas.
    A observação de saúde é conteúdo do profissional; o redesenho não deve reinterpretá-la.

Conferir: Conferir feedback longo, falta de permissão para responder e estado revisado. Preservar qualquer regra
existente de comparação com meta; não inventar julgamento positivo/negativo pela cor.
Código de referência: app/src/app/treinador/atualizacoes/[id].tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS                                              05 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

05 / ORIENTAÇÃO POR TELA

Agenda: destacar o compromisso

T10 / Dia, semana, mês e agenda no celular. Cor de agenda identifica a origem; situação continua separada.

PRINT DE REFERÊNCIA • No celular, dias vazios têm caixas de peso semelhante ao dia com compromisso. Recorte em duas partes:
superior à esquerda, continuação à direita.

Leitura: A visão móvel já é uma lista por dia. No print, vários cartões de “Nada marcado” competem com o
compromisso. No PC, a grade continua necessária para localizar horários.

    Dias vazios mais leves. Apresentar data e “Nada marcado” como linha compacta com divisor discreto.
    Manter um bloco mais definido para o dia que possui compromissos, sem ocultar datas da semana.

    Cor em pequenas áreas. Preferir faixa ou ponto da agenda e fundo neutro no compromisso. Nome,
    horário e local vêm antes da situação. Hoje, dia selecionado e evento escolhido precisam de pistas
    distintas.

    Preservar o que já funciona. Agendas e filtros já ficam em uma folha no celular. A rolagem inicial do PC
    já existe no código; testar sua posição, sem implementar outra rolagem automática que puxe a tela a cada
    atualização.

    No seu contexto: Proposta de linha vazia: “Quinta, 12/11 · Nada marcado”. Com evento: “18:00-19:00 · Avaliação
    presencial” e, abaixo, aluno e local. O detalhe completo continua no fluxo atual.

Conferir: Conferir dois eventos sobrepostos, nome longo, semana sem eventos e retorno à tela. O destaque de “Hoje” não
pode se confundir com o evento selecionado.

Código de referência: app/src/treinador/agenda/GradeDeHorarios.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  06 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

06 / ORIENTAÇÃO POR TELA

Biblioteca: uma lista fácil de ler

T11 / Exercícios, alimentos, suplementos, Outros e catálogo. Informação de consulta não precisa parecer
campo editável.

PRINT DE REFERÊNCIA • As linhas de alimento acumulam nome, composição, fatores e explicação na mesma área.

Leitura: Os registros aparecem como cartões individuais dentro de outro cartão. A própria tela já tem busca,
filtros, paginação e edição. O objetivo é melhorar a leitura desses recursos existentes.

    Menos caixas por registro. Usar uma superfície comum com linhas e divisores suaves. Realçar apenas
    hover, foco ou item aberto. Nome e ação de editar permanecem fáceis de localizar.

    Detalhes por prioridade. Nome primeiro; porção/unidade e composição em segundo nível. Fatores e
    instruções ficam em uma região de apoio ou detalhe acessível, sem apagar informação necessária para
    escolher o item.

    Catálogo com seleção clara. Reutilizar a seleção neutra e a contagem real de itens escolhidos. “Já na
    biblioteca” permanece legível e não selecionável. Manter a busca e o resumo da seleção próximos à ação
    de importar.

    No seu contexto: Exemplo de estrutura: “Nome do alimento” → “Porção de referência · kcal · P / C / G” → “Detalhes de
    preparo e compra”. Usar os valores cadastrados; a composição visual não recalcula nada.

Conferir: Conferir nome longo, ausência de vídeo, categoria vazia e item já importado. No celular, lápis e linha não podem
criar alvos sobrepostos.
Código de referência: app/src/app/treinador/biblioteca.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  07 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

07 / ORIENTAÇÃO POR TELA

Planejamento: encontrar o modelo

T12 / Coleções, tipos e questionários. Os editores de treino e dieta já revisados não entram novamente.

PRINT DE REFERÊNCIA • Duas faixas de navegação e um grande cabeçalho antecedem os primeiros modelos. Recorte em duas
partes: superior à esquerda, continuação à direita.

Leitura: A página possui grupos, tipos e coleções. Esse vocabulário faz parte do produto. A aparência deve
mostrar a diferença entre trocar o grupo, filtrar o tipo e abrir uma coleção.

    Três níveis reconhecíveis. Abas para o grupo; seleção neutra para o tipo; título e contagem para a
    coleção. Evitar que todas as opções tenham a mesma aparência de botão principal.

    Primeiro modelo mais cedo. Diminuir explicações repetidas entre subtítulo e cartão. Posicionar busca e
    criação na mesma região. Manter a descrição completa do tipo acessível como apoio.

    Ações por modelo. Nome, resumo e ações com alinhamento estável. “Aplicar ao aluno” continua criando
    uma cópia; “Editar” continua abrindo o modelo. Organizar coleções já existe: preservar o fluxo e não criar
    outro organizador.

    No seu contexto: Proposta de leitura: “Treino” → “Semanas de treino” → “Coleção X · 32 modelos” → nome do modelo
    e resumo. O editor compartilhado recebe o padrão já implementado, sem uma segunda reforma.

Conferir: Conferir busca em coleções recolhidas, coleção vazia e tipo sem “Aplicar ao aluno”. Se uma aba some por
permissão, o restante continua alinhado.
Código de referência: app/src/app/treinador/planejamento/index.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  08 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

08 / ORIENTAÇÃO POR TELA

Questionários: editar por contexto

T14 / Atualização, anamnese e inscrição. Manter o modelo de rascunho, prévia e versão publicada.

PRINT DE REFERÊNCIA • As perguntas já são recolhíveis. Refinar seção, pergunta e ação de edição.

Leitura: O print de anamnese contém 57 perguntas. Abertura por pergunta, prévia e abertura automática dos
erros já existem no código; não são recursos novos a solicitar.

    Seção discreta, pergunta clara. Dar ao título da seção e à contagem uma faixa compacta. A pergunta
    fechada mostra texto, tipo e obrigatoriedade; propriedades só aparecem quando abertas.

    Ações de risco separadas. Setas de ordem e abrir devem ser fáceis de reconhecer. Manter excluir em
    posição consistente, com nome acessível e confirmação existente. Não transformar todas as lixeiras em
    destaques vermelhos permanentes.

    Publicação compreensível. Nomear o alcance da ação, como “Publicar questionário”. “Salvar rascunho”
    permanece secundário. Preservar o aviso de que a versão respondida não muda e as mensagens de
    conflito entre abas.

    No seu contexto: Proposta de linha: “Como foi sua rotina nesta semana?” → “Texto longo · opcional”. Ao abrir, a
    superfície e o contorno identificam a pergunta em edição; o número da pergunta continua neutro.

Conferir: Conferir uma pergunta longa, várias seções abertas e erro de publicação. Na inscrição pública, preservar os
tipos de pergunta permitidos; aparência não amplia a coleta.
Código de referência: app/src/treinador/questionarios/EditorQuestionario.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS                                                        09 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

09 / ORIENTAÇÃO POR TELA

Interessados: priorizar o atendimento

T16 / Lista, Kanban e link de inscrição. Os filtros de datas e o menu “Mover para” já foram revisados.

PRINT DE REFERÊNCIA • No print móvel, a configuração do link ocupa bastante espaço antes da primeira pessoa. Recorte em duas
partes: superior à esquerda, continuação à direita.

Leitura: O objetivo cotidiano é encontrar quem precisa de retorno. A configuração do link é importante, mas
não precisa ter o mesmo peso visual do trabalho de atendimento.

    Link de inscrição compacto. Manter situação, “Copiar link” e “Configurar” numa faixa curta. Detalhes
    continuam na folha já existente. No celular, dar espaço para busca e primeira pessoa aparecerem mais
    cedo.

    Situação junto do nome. Mostrar nome e etapa próximos. Retorno agendado ou vencido recebe
    destaque de situação apenas pela regra atual. “Nova” identifica etapa; não transformar todas as entradas
    novas em erro.

    Kanban sem arco-íris. Colunas neutras com título e contagem; cor apenas para exceções. Preservar
    arrastar e “Mover para”, já existentes. Não refazer a composição do menu de movimentação nem dos
    filtros de data.

    No seu contexto: Exemplo de ordem num cartão: nome → etapa → próximo retorno → responsável. Ações de
    conversar e aceitar continuam diferentes: abrir o WhatsApp não equivale a enviar mensagem ou cadastrar aluno.

Conferir: Conferir nomes longos, coluna vazia e atendimento encerrado. As visões devem continuar apresentando as
mesmas pessoas sob os mesmos filtros.

Código de referência: app/src/app/treinador/interessados.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS                                                              10 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

10 / ORIENTAÇÃO POR TELA

Números: comparação sem enfeite

T17 / Contagens mensais e carga da equipe. A tela pode ser premium sem ganhar gráficos novos.

PRINT DE REFERÊNCIA • Meses e valores já formam uma tabela útil. O mês atual tem contexto parcial.

Leitura: A leitura depende de comparar colunas. Números gerais devem continuar neutros, com unidades e
períodos explícitos. Dado indisponível e valor zero não são a mesma coisa.

    Colunas estáveis. Alinhar valores à direita e manter números tabulares. Deixar o mês à esquerda.
    Cabeçalho e linhas precisam de contraste de leitura, sem uma moldura forte em cada célula.

    Dar contexto ao período. Manter “até hoje” junto ao mês corrente. A tabela da equipe descreve a
    situação de hoje, não o histórico mensal. Separar os títulos e explicar essa diferença numa frase curta.

    Exceção localizada. Usar destaque de situação somente no valor ou selo que representa atraso/limite
    pela regra existente. “—” continua indicando dado indisponível; zero permanece visível em tom
    secundário.

    No seu contexto: Exemplo de legenda: “Mês atual: dados até hoje. — = indisponível.” Não criar taxa de crescimento,
    ranking ou tendência com base em números que a API não fornece.

Conferir: Conferir mês sem dados, zeros, número grande e conta sem permissão de equipe. No celular, cada cartão
mensal deve repetir os rótulos necessários para comparar.
Código de referência: app/src/app/treinador/numeros.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS                                                     11 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

11 / ORIENTAÇÃO POR TELA

Assinatura não é financeiro do aluno

T18 + T25 / Duas áreas com finalidades diferentes. O financeiro ativo não está documentado visualmente
nesta rodada.

PRINT DE REFERÊNCIA • A captura de faturas é demonstrativa. Preservar a indicação de prévia.

Leitura: Assinatura e faturas mostra a relação da consultoria com o sistema. O print de Financeiro mostra
apenas “indisponível”; não há base para desenhar suas abas ativas como se tivessem sido avaliadas.

    Leitura de fatura. Competência e valor primeiro; vencimento e situação juntos; pagamento em apoio.
    Manter valores neutros e destacar a exceção vencida no selo, sem pintar o cartão inteiro.

    Demonstrativo explícito. A faixa de prévia precisa continuar visível e legível. Não sugerir que um
    pagamento pode ser feito quando o dado é demonstrativo ou a ação não está liberada.

    Indisponível não é falha. No financeiro desligado, usar mensagem neutra e retorno ao Início. Não
    acrescentar “Ativar”, “Contratar” ou “Tentar novamente” sem esses caminhos existirem. O desenho do
    módulo ativo fica para outra evidência.

    No seu contexto: Proposta de registro: “Novembro/2026 · R$ …” → “Vencimento: … · Vencida”. A disponibilidade de
    “Pagar” continua vindo do fluxo existente, sem mudanças por motivo estético.

Conferir: Conferir prévia, fatura paga, vencida, ausência de limite e módulo desligado. Não prometer que consumo “só
informa” se a configuração real pode limitar novas operações.
Código de referência: app/src/app/treinador/minha-conta.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  12 / 31
CONSULTORIA / DIREÇÃO VISUAL                                                     NOVEMBRO 2026

12 / ORIENTAÇÃO POR TELA

Equipe: pessoas e acessos claros

T20 / Membros e perfis. Refinar apresentação sem alterar quem pode fazer o quê.

PRINT DE REFERÊNCIA • Cada membro ocupa um cartão com faixa, detalhes e ação. Há espaço para compactar no PC.

Leitura: Nome, perfil e situação são os dados de decisão. E-mail, último acesso e limite são contexto.
Colocar tudo no mesmo peso dificulta encontrar rapidamente a pessoa certa.

    Hierarquia por pessoa. Nome em destaque, perfil logo abaixo ou ao lado, situação próxima. No desktop,
    comparar membros por linhas; no celular, preservar um bloco compacto por pessoa.

    Perfis com linguagem de tarefa. Mostrar nome e descrição antes das ações. “Perfil do sistema” deve
    ser texto claro. Não usar aparência desabilitada para esconder o motivo de um perfil não poder ser
    editado.

    Mudanças com consequência visível. Ao trocar perfil ou desativar, manter a confirmação e o efeito
    sobre sessões conforme a regra existente. Ação destrutiva precisa de verbo explícito; “Editar” não deve
    parecer um aviso.

    No seu contexto: Exemplo fictício: “Marina Costa” → “Treinadora · Ativa” → “Último acesso … · Limite …”. “Convidar
    membro” é a ação principal da lista; cada membro não precisa de outro botão preenchido.

Conferir: Conferir perfil do sistema, falta de permissão, nome longo e último acesso ausente. Não alterar limites,
permissões nem as proteções do último administrador.
Código de referência: app/src/app/treinador/equipe.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS                                       13 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

13 / ORIENTAÇÃO POR TELA

Importação: reduzir a incerteza

T21 / Histórico, destino, planilha completa e importação assistida. O usuário precisa saber o que será
gravado.

PRINT DE REFERÊNCIA • A primeira etapa já separa destino, arquivo e continuidade. Etapas posteriores não têm captura suficiente.

Leitura: Há vários caminhos de importação. O refinamento deve explicar a diferença entre eles sem
aumentar o número de botões principais ou prometer processamento que não foi concluído.

    Entrada por tarefa. No histórico, destacar um caminho principal para começar e manter os outros
    claramente descritos: planilha por destino, planilha completa e documentos. Reaproveitar os caminhos
    existentes.

    Etapa reconhecível. Manter número e nome da etapa em texto neutro. No celular, uma linha como
    “Etapa 1 de 5 · Destino e arquivo” é suficiente; não comprimir cinco rótulos na largura da tela.

    Resultado honesto. Na validação e no resultado, diferenciar pronto, com problema e ignorado usando
    texto e contagem reais. “Concluída com erros” não pode parecer sucesso total. A confirmação final
    continua separada da prévia.

    No seu contexto: Exemplo ilustrativo de resumo: “12 registros prontos · 2 precisam de revisão”. Só mostrar esse
    resumo se os valores já vierem do resultado real. O PDF não propõe alterar regras de importação.

Conferir: Conferir arquivo ausente, nome longo, validação parcial e conexão perdida. Etapas sem prints devem ser
inspecionadas antes de receber ajustes específicos. Não inventar porcentagem de processamento.
Código de referência: app/src/treinador/importacao/TelaImportacao.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS                                                              14 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

14 / ORIENTAÇÃO POR TELA

Auditoria: ler o acontecimento

T22 / Quem, quando e qual ação. A qualidade está na precisão e na facilidade de localizar um evento.

PRINT DE REFERÊNCIA • Esta imagem mostra a lista carregada; o README da pasta descreve um erro de uma captura anterior.

Leitura: Há muitos eventos repetidos de acesso. A tela precisa permitir leitura rápida sem destacar cada
login como novidade. O texto do evento deve permanecer fiel ao registro.

    Evento antes de decoração. Data/hora tabular, pessoa, ação e resumo em colunas estáveis. Nome com
    peso médio e texto secundário para metadados. Evitar selo colorido em cada linha de rotina.

    Filtros com contexto. Preservar pessoa, ação e período existentes. Exibir os filtros aplicados usando a
    peça compartilhada já atualizada. Não adicionar um buscador que a fonte de dados não suporta.

    Estados localizados. Se falhar a lista, o erro pertence à lista. Se falhar um filtro, o erro fica no controle
    correspondente; não repetir o mesmo alerta global duas vezes. O print carregado não prova como esses
    erros ficam hoje.

    No seu contexto: Proposta de leitura: “10/11, 16:20 · Marina · Plano publicado”. O resumo continua sendo a descrição
    já registrada, sem acrescentar valores de saúde ou conteúdo da alteração.

Conferir: Conferir resumo longo, autor Sistema, paginação e filtro sem resultado. A organização visual não deve esconder
eventos, mudar retenção ou acrescentar dados ao registro.
Código de referência: app/src/app/treinador/auditoria.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  15 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

15 / ORIENTAÇÃO POR TELA

Marca: ver o efeito da escolha

T23 / Identidade da consultoria. A tela deve ensinar a diferença entre marca, paleta e preferência pessoal.

PRINT DE REFERÊNCIA • Amostras de cor com nome e seleção. O texto “Inter” de outra região já foi trocado por “Geist” no código.

Leitura: A prévia e as opções já existem. Em um formulário longo, a pessoa pode mudar a cor longe da
região que mostra o resultado. A oportunidade é aproximar causa e efeito.

    Prévia perto do ajuste. No PC, avaliar prévia ao lado dos grupos de aparência, sem prender o restante
    do formulário. No celular, mostrar uma prévia compacta perto desses grupos, sem duplicar longos
    cartões.

    Nomes que explicam. Separar “Cor da marca” de “Tema padrão da consultoria”. Usar nomes e
    amostras, evitando descrever cores como garantia de emoção ou resultado. Seleção tem marca de
    confirmação, não só contorno colorido.

    Identidade e rotina separadas. Nome, logo, cor e fonte formam o grupo de aparência. Configurações de
    acompanhamento ficam em outro grupo. Preservar todas as paletas, cores e fontes já disponíveis,
    inclusive Metal Mania.

    No seu contexto: Texto de apoio proposto: “A marca aparece nas ações principais e na identidade. O tema define
    fundos e superfícies. Cada pessoa pode escolher sua aparência em Ajustes.”

Conferir: Conferir logo larga, nome longo, cor personalizada e tema claro. Se o upload falhar, manter o contexto do campo
e a prévia válida, sem simular salvamento concluído.

Código de referência: app/src/treinador/marca/FormMarca.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  16 / 31
CONSULTORIA / DIREÇÃO VISUAL                                                              NOVEMBRO 2026

16 / ORIENTAÇÃO POR TELA

Perfil e dados: orientação simples

T24 + T26 / Conta pessoal e atalhos. Não reabrir o redesenho dos Ajustes compartilhados.

PRINT DE REFERÊNCIA • O Perfil reúne acessos da conta e atalhos de gestão. Sua função é orientar, não resumir todos os dados.

Leitura: As linhas de acesso já são reconhecíveis. Os grupos podem comunicar melhor o que afeta a
pessoa e o que afeta a consultoria, mantendo os destinos atuais.

    Agrupar pelo alcance. Distinguir dados pessoais e segurança de marca e assinatura da consultoria.
    Manter apenas os acessos que a pessoa pode usar. “Sair” fica visualmente separado da navegação
    habitual.

    Dado só leitura não é campo. Em Meus dados, e-mail de entrada e perfil aparecem como informação.
    Nome e telefone mantêm campos identificáveis. Não desenhar um campo desabilitado para algo que
    nunca é editável ali.

    Salvar no bloco correto. “Salvar seus dados” pertence ao formulário de dados; “Trocar senha” pertence
    ao bloco da senha. A regra de uma ação principal não deve juntar duas operações independentes num
    botão “Salvar tudo”.

    No seu contexto: Proposta de grupos: “Minha conta” e “Consultoria”, com os mesmos destinos existentes. É uma
    organização visual; não muda permissões, rotas ou o que cada ação grava.

Conferir: Conferir falha da contagem de interessados sem bloquear os atalhos, teclado no telefone e erro no bloco da
senha. A mensagem de um formulário não deve parecer erro do outro.

Código de referência: app/src/app/treinador/perfil.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS                                                17 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

17 / ORIENTAÇÃO POR TELA

Segurança: uma etapa por vez

T27 / Apresentação da verificação em duas etapas. Nenhuma mudança no protocolo ou nos requisitos de
autenticação.

PRINT DE REFERÊNCIA • Estado inicial disponível no desktop. O print móvel mostra apenas cabeçalho e falta de conexão.

Leitura: O código já separa senha, configuração e recuperação. Também retorna conteúdo vazio quando
está offline. Aqui existe uma lacuna visual concreta: dizer por que não há ação disponível.

    Explicar indisponibilidade. No lugar da área vazia offline, mostrar um estado neutro e curto indicando
    que a configuração precisa de conexão. Não apresentar a falta de conexão como MFA desativado.

    Preservar as etapas. Senha, leitura pelo autenticador, confirmação e guarda de códigos seguem o fluxo
    atual. Títulos curtos e ação principal da etapa evitam que todos os passos pareçam simultâneos.

    Ação sensível identificável. “Ativar” e “Desativar” devem dizer o alcance. Manter os avisos e
    confirmações existentes. A mensagem de sucesso só aparece após a confirmação real, nunca ao apenas
    abrir a configuração.

    No seu contexto: Texto proposto para o estado vazio: “Conecte-se à internet para consultar e alterar a verificação em
    duas etapas.” Não incluir QR code, segredo ou código real em mockups ou documentação.

Conferir: Conferir offline, erro de carga e avanço de etapas com dados de teste. Não mudar exigência de senha/código,
encerramento de sessões ou políticas da conta para simplificar o visual.
Código de referência: app/src/treinador/seguranca/VerificacaoEmDuasEtapas.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  18 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

18 / ORIENTAÇÃO POR TELA

Ajuda e textos: leitura confortável

T28 + T30 e P10-P12 / Ajuda, termos, privacidade e instruções de exclusão. O trabalho aqui é editorial e
visual.

PRINT DE REFERÊNCIA • Tutorial, primeiros passos, PDF e assuntos estão disponíveis. Refinar a prioridade entre eles.

Leitura: O topo da Ajuda reúne vários blocos antes dos assuntos. Já os textos legais são longos e precisam
de uma largura de leitura estável. Essas áreas não precisam de cores extras.

    Ajuda por intenção. Distinguir “Estou começando” de “Quero consultar um assunto”, com os mesmos
    recursos atuais. Dar ao tutorial uma ação clara e ao PDF um acesso secundário. Não criar busca nova só
    para preencher o topo.

    Texto em coluna legível. Usar títulos de seção, espaçamento de parágrafos e largura moderada. Um
    índice de âncoras pode ser avaliado para textos longos, preservando o conteúdo completo e a ordem de
    leitura.

    Versão e consequência visíveis. Manter versão/data e estado de revisão dos documentos. Na página
    de exclusão, separar instruções de uma ação executável. O texto legal e as regras de exclusão não são
    reescritos por este guia.

    No seu contexto: Exemplo de hierarquia na Ajuda: “Começar a usar” → tutorial / conhecer menu; “Consultar” →
    assuntos / guia em PDF. Não destacar todas as opções como ações principais.

Conferir: Conferir leitura ampliada, links e ausência de recurso. Uma seção que depende de recurso indisponível deve
seguir o comportamento atual do produto. Ajuste visual não equivale a revisão jurídica.

Código de referência: app/src/app/treinador/ajuda.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  19 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

19 / ORIENTAÇÃO POR TELA

Recuperação: explicar o próximo passo

P04-P05 / Esqueci minha senha e redefinição. A casca de entrada já existe; não redesenhar o login.

PRINT DE REFERÊNCIA • Link inválido: a ação de pedir outro link já existe e deve continuar evidente.

Leitura: A coluna pública é compartilhada e tem 440 px no código. As capturas altas acentuam o vazio
superior por centralização; isso sozinho não comprova problema em uma janela normal.

    Uma mensagem por estado. Separar solicitação do link, confirmação de solicitação, link inválido e
    senha alterada. Cada estado mantém título, explicação breve e a próxima ação já existente.

    Erros junto do campo. E-mail e senha continuam com rótulos permanentes. Se houver vários erros, um
    resumo pode orientar até o primeiro campo; não depender apenas de borda vermelha. Preservar as
    regras atuais de validação.

    Manter a identidade correta. Sem consultoria reconhecida, usar a identidade do produto e a ação neutra
    existente. Com uma consultoria conhecida, seguir a identidade que o fluxo já fornece. Não inventar marca
    por tentativa de e-mail.

    No seu contexto: Na confirmação de solicitação, preservar a mensagem condicional que não revela se existe uma
    conta. “Link solicitado” não deve virar “E-mail entregue”, pois a tela não comprova a entrega.

Conferir: Conferir janela de altura normal, teclado aberto, erros longos e retorno para entrar. Não alterar validade do link,
autenticação ou conteúdo das respostas do servidor.
Código de referência: app/src/ui/TelaPublica.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  20 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

20 / ORIENTAÇÃO POR TELA

Convites: deixar claro quem entra

P06-P08 / Convite de aluno, convite de equipe e cadastro público do treinador. São fluxos diferentes.

PRINT DE REFERÊNCIA • Convite de equipe: código e senha. Não confundir com inscrição de interessado.

Leitura: Os formulários já compartilham a base pública. O refinamento mais útil é preservar o contexto ao
reconhecer o convite, validar campos ou mostrar erro, sem transformar etapas diferentes numa tela
genérica.

    Título com papel explícito. “Convite para a equipe” e “Criar meu acesso” devem refletir o fluxo. A marca
    da consultoria aparece quando reconhecida; enquanto carrega, manter a estrutura estável.

    Código com origem clara. Quando o código já veio pelo link, manter a indicação e “Usar outro código”
    existentes. Não pedir que a pessoa redigite algo já reconhecido apenas para preencher um formulário
    simétrico.

    Cadastro com limite de escopo. No cadastro do treinador, preservar a ordem e os campos atuais. O
    fluxo só deve ser oferecido quando o cadastro público estiver habilitado. Não adicionar esse convite
    comercial às telas por motivo visual.

    No seu contexto: Proposta de leitura: identidade reconhecida → “Convite para a equipe” → campos necessários →
    “Criar meu acesso à equipe”. Links “Sou aluno” e “Já tenho conta” ficam secundários e legíveis.

Conferir: Conferir convite inválido, carregamento, senhas diferentes e envio em andamento. O botão mantém dimensão
estável. A revisão não muda a resposta de erro nem as proteções dos convites.

Código de referência: app/src/app/convite-equipe.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS                                                             21 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

21 / ORIENTAÇÃO POR TELA

Inscrição: curta e acolhedora

P09 / Formulário público da consultoria. Inscrever-se demonstra interesse; não significa já ter acesso ao app.

PRINT DE REFERÊNCIA • Contato e continuação já estão separados. Preservar essa simplicidade.

Leitura: O formulário pode ter uma ou duas partes, conforme os campos configurados. A tela deve mostrar o
caminho real sem forçar uma segunda etapa vazia ou insinuar que a inscrição já foi aceita.

    Orientação por etapa. Manter “Seu contato” e “Sobre você” quando houver duas partes. Uma linha
    discreta mostra progresso; não usar uma grande barra colorida competindo com a ação principal.

    Escolhas fáceis de comparar. Nas perguntas rápidas, conservar seleção neutra e marca de
    confirmação. No celular, opções quebram de forma previsível, com área de toque confortável. Campos
    opcionais continuam claramente opcionais.

    Envio com desfecho honesto. O botão indica envio em andamento. Depois, confirmar que a inscrição
    foi recebida, com a orientação de contato aprovada pelo produto. Não prometer prazo de resposta nem
    criar acesso automaticamente.

    No seu contexto: Exemplo de mensagem visual: “Inscrição enviada” e uma frase sobre o próximo contato, somente
    conforme a resposta real do fluxo. A ação principal continua na marca da consultoria reconhecida.

Conferir: Conferir voltar sem perder dados, ausência de perguntas extras, texto de ciência longo e mudança do formulário
durante preenchimento. Não retirar campos obrigatórios ou avisos para encurtar a tela.
Código de referência: app/src/app/inscricao/[codigo].tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  22 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

22 / ORIENTAÇÃO POR TELA

Montador: ferramenta de apoio

P13 / Apêndice interno, prioridade baixa. Não faz parte da experiência cotidiana do treinador ou do aluno.

PRINT DE REFERÊNCIA • Blocos, prancheta e propriedades já estão separados. Preservar as três funções.

Leitura: O montador pode ajudar a manter o padrão se os exemplos refletirem os componentes atuais. Ele
não deve ser tratado como uma tela comercial nem como motivo para reabrir o design system.

    Separar editor e prévia. A seleção do bloco pertence à ferramenta; botões, abas e estados dentro da
    prancheta pertencem à interface simulada. As duas seleções não podem parecer a mesma coisa.

    Controles de autoria discretos. Mover, duplicar, remover e inserir ficam associados ao bloco
    selecionado. O inspetor mostra o nome desse bloco; evitar uma fileira de ferramentas pesada em todos
    os blocos ao mesmo tempo.

    Catálogo como referência. Conferir exemplos de estado normal, erro, foco e seleção com as peças
    atuais. Reaproveitar o catálogo existente; não criar outra biblioteca de componentes no montador.

    No seu contexto: Proposta de prioridade: prancheta no centro; paleta à esquerda; propriedades à direita. No celular,
    preservar as abas existentes Blocos / Tela / Propriedades, em vez de apertar três colunas.

Conferir: Conferir bloco selecionado, nenhum selecionado, rascunho vazio e exportação existente. Manter a restrição de
disponibilidade do montador; este capítulo não autoriza publicá-lo.
Código de referência: app/src/app/montador/index.tsx

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  23 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

23 / ENTREGA AO IMPLEMENTADOR

Aplicar uma vez, conferir por tarefa

Ordem sugerida para o Claude: trabalhar nas lacunas locais e preservar o que já foi concluído.

1. Reconciliar antes de editar

Abrir a tela atual e comparar com o capítulo. Classificar cada item como já atendido, falta local ou depende
de estado sem evidência. O print antigo não é prova de regressão na branch.

2. Priorizar a rotina

Começar por Atualizações, detalhe, Agenda, Biblioteca, Planejamento e questionários. Depois, Interessados,
Números, Equipe e Importação. Conta, marca e fluxos públicos vêm no lote seguinte. O montador fica por
último.

3. Reutilizar a fundação

Usar os componentes e tokens existentes. Se o ajuste for comum, verificar quem já está trabalhando nessa
peça antes de alterá-la. Evitar uma segunda implementação de abas, campos, filtros ou folha.

4. Conferir nos dois tamanhos

PC de 1280 px e celular de 390 px, com altura normal e teclado aberto quando houver campos. Testar tema
claro, escuro e ao menos uma combinação de paleta/marca diferente. Conteúdo longo e tamanho de texto
ampliado precisam caber.

5. Conferir estados

Vazio real, sem resultado, carregamento, erro, sem conexão, seleção, foco e envio. Conferir também perfil
sem permissão. Um estado de rede não deve parecer ausência definitiva de dados.

    Critério de entrega: a próxima ação está clara; o conteúdo principal aparece cedo; a cor tem significado; o controle
    selecionado é reconhecível sem depender apenas da cor; mensagens correspondem ao estado real. Não criar dados,
    cálculos ou recursos para completar um mockup.

Validação nesta sessão: leitura de prints e código, geração e inspeção do documento. Não foram executados testes do app nem
alterados arquivos do repositório.

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  24 / 31
CONSULTORIA / DIREÇÃO VISUAL                     NOVEMBRO 2026

24 / RASTREABILIDADE

Mapa das telas do treinador

T = pasta em Desktop/Print sistema/Treinador. As páginas indicadas contêm orientação específica ou
escopo limitado.

T08 + T09  Atualizações e detalhe                4-5

T10        Agenda                                6

T11        Biblioteca e catálogo                 7

T12        Planejamento e coleções               8

T14        Editor de questionário                9

T16        Interessados: composição restante     10

T17        Números                               11

T18 + T25  Financeiro indisponível / assinatura  12

T20        Equipe e perfis                       13

T21        Importação e caminhos existentes      14

T22        Auditoria                             15

T23        Marca                                 16

T24 + T26  Meus dados e Perfil                   17

T27        Segurança: apresentação de estados    18

T28 + T30  Termos e Ajuda                        19

Fora do novo lote: T01-T07; T13 (editor compartilhado); T19 (Comunidade); T29 (Ajustes compartilhados); T31
(comparação já revisada); T32 (prévia do aluno). O catálogo local não possui pasta T15; não foi inventada uma tela para
preencher a numeração.

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS       25 / 31
CONSULTORIA / DIREÇÃO VISUAL                           NOVEMBRO 2026

25 / RASTREABILIDADE

Fluxos públicos e limites da análise

P = pasta em Desktop/Print sistema/Publicas. A área pública usa a mesma linguagem visual, com identidade
adequada ao contexto.

P04-P05  Recuperação e redefinição de senha            20

P06-P08  Convites e cadastro do treinador              21

P09      Inscrição pelo link                           22

P10-P12  Privacidade, termos e instruções de exclusão  19

P13      Montador: apêndice interno                    23

Já existente: P01-P03

Escolha de entrada, login do aluno e login do treinador permanecem na casca atual e na referência de
entrar.html. Não há pedido de redesenho dessas telas. Convites e recuperação são orientados apenas nos
estados que ainda precisam de composição e clareza.

O que foi observado diretamente

Foram inspecionadas as capturas principais das 35 famílias candidatas de treinador e públicas, antes de
excluir partes já cobertas. Houve leitura adicional de variantes de biblioteca, questionários, Kanban,
assinatura e montador e de 12 capturas móveis. Os capítulos usam recortes identificados, não novas
renderizações da branch.

Onde há incerteza

Os READMEs de Marca, Auditoria e Segurança descrevem erros antigos, enquanto algumas imagens
desktop já mostram conteúdo carregado. O estado da própria imagem prevalece na análise visual. Etapas
sem captura, financeiro ativo, teclado real e comportamento atual renderizado continuam sem validação
nesta sessão.

    Se uma tela mudou depois desta leitura, comparar a orientação com a versão atual antes de editar. “Ainda não
    analisado” não significa “nada foi alterado”: componentes compartilhados já propagam parte do padrão.

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS             26 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

26 / REFERÊNCIAS

Base consultada e referências úteis

A direção estética vem do padrão aprovado do projeto. As referências externas sustentam pontos
específicos de legibilidade e comunicação.

Guia anterior, 18 páginas

guia-visual-premium-consultoria.pdf: fundamento de cor, hierarquia e acabamento; páginas 15-18 incorporam a
gravação.

Prévia aprovada

docs/prototipos/visual-vendavel/treinador-inicio.html e peças base.css/base.js: referência de linguagem. O novo PDF
não propõe reescrever essa prévia.

Aplicação na branch

docs/planos/visual-vendavel.md e visual-vendavel/guia-premium-no-app.md: escopo, lotes já registrados e prevalência
do guia anterior.

Padrões de composição

docs/design-e-front.md e docs/planos/composicao-visual.md: peças, hierarquia, rodapés, filtros e comparação de fotos.
Diferenciar Peça existe, Proposto e Verificado.

Limites de escopo

docs/planos/comunidade-organizada-e-mapa.md e confirmação do usuário: excluir Comunidade e telas do aluno desta
rodada.

R1 / W3C: cor acompanhada de outra pista
Usar texto, forma ou marcador junto da cor. Relevante para situação, seleção e categorias.

R2 / W3C: retorno de formulários
Mensagens de erro e sucesso claras, associadas aos campos e ao resultado do envio. Apoia os capítulos de formulários.

R3 / Radix: cores por função
Referência para separar fundo, hover, seleção, contorno e texto. Não implica substituir a paleta ou a biblioteca atual.

Referências externas consultadas em 11/11/2026. Exemplos são propostas visuais; imagens são do material de demonstração
fornecido. Nenhuma medição de contraste da branch foi refeita para este complemento.

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  27 / 31
CONSULTORIA / DIREÇÃO VISUAL                                             NOVEMBRO 2026

27 / COMPLEMENTO SOLICITADO

Mais espaço para o trabalho

Cabeçalho e menu lateral do treinador. A referência é a composição da prévia, preservando os recursos da
versão atual.

Hoje, no material enviado • busca, acesso a todas as telas e conta no topo.

Prévia escolhida • identidade compacta e cabeçalho integrado ao painel.

Minha recomendação é aproveitar essa organização: marca concentrada na lateral, topo curto e funcional e
conteúdo começando sem uma sequência de espaços repetidos. O menu aberto melhora a orientação; o
recolhido continua útil quando a tarefa exige largura.

    Escopo deste acréscimo: ajustar a estrutura de navegação do treinador. O conteúdo do Início, as telas já revisadas, a
    área do aluno e a Comunidade continuam fora de uma nova reforma. A presença de um destino no menu não reabre o
    desenho dessa tela.

Fonte visual: Documento sem título (3).pdf, páginas 1 e 3. As marcações vermelhas são anotações do comparativo. As capturas têm
escalas e estados de menu diferentes; não permitem medir o ganho de espaço diretamente.

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS                               28 / 31
CONSULTORIA / DIREÇÃO VISUAL                                                            NOVEMBRO 2026

28 / EXEMPLO DE COMPOSIÇÃO

Um topo com função clara

Esquema proposto para o desktop. Proporções ilustrativas; as medidas de implementação estão na página
seguinte.

           Studio Forja       ||  Acompanhamento                         Buscar Ctrl K  Todas as telas  MC
 SF Consultoria de treino
                              Atualizações
    Início
                              Revise os envios e acompanhe os prazos.
ACOMPANHAMENTO
                                  Buscar aluno nesta lista               Filtros
    Alunos
    Atualizações              Para revisar 2                Atrasadas 1
    Agenda
    Comunidade                Marina Costa                                              Para revisar
                                                                                        Para revisar
CONTEÚDO                      Pasta de novembro · enviada hoje

    Biblioteca                Caio Mendes
    Planejamento
                              Pasta de novembro · enviada ontem
NEGÓCIO

    Interessados
    Financeiro
    Números

CONFIGURAÇÕES

    Equipe
    Importação
    Ajuda
    Auditoria

PROPOSTA ILUSTRATIVA • dados fictícios. Os ícones quadrados só marcam posições. Destinos, permissões, contagens e
disponibilidade continuam vindo do app.

    Topo global: controle do menu, contexto curto, busca global, Todas as telas e conta. Se o controle de
    recolher vier para o topo, retirar sua cópia do rodapé. Com pouca largura, compactar os controles com
    rótulo acessível.

    Cabeçalho da tarefa: um título principal e, quando necessário, uma frase curta. “Novo aluno” fica junto
    de Alunos; “Publicar” fica no editor. A barra global não deve virar uma fila de ações diferentes em cada
    página.

    Identidade na lateral: logo e nome numa linha quando isso for legível. A marca real continua intacta; um
    símbolo complexo pode precisar de um bloco próprio. O exemplo SF não substitui a logo da consultoria.

    Busca global e busca da lista têm escopos diferentes. O rótulo deve deixar isso claro. Se o topo mostrar a trilha
    completa, retirar a cópia dessa trilha acima do título; preservar os destinos e a proteção contra sair com alterações
    pendentes.

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS                                                              29 / 31
CONSULTORIA / DIREÇÃO VISUAL                        NOVEMBRO 2026

29 / MEDIDAS PARA TESTAR

Compactar com critério

Valores de partida para o treinador no desktop. São propostas de composição, não uma medição das
capturas.

Barra superior                52-56 px

A prévia usa mínimo de 52 px; o app, 64 px. Ajustar também os espaçamentos internos, preservando os alvos de 44
px.

Menu aberto                   240 px

Já existe no app. Preservar a largura inicialmente: o ganho prioritário é na organização vertical, sem cortar os nomes.

Menu recolhido                72 px / 88 px

Manter os modos atuais: 72 px no desktop recolhido e 88 px no intervalo com rótulos abaixo dos ícones.

Identidade lateral            64-72 px no conjunto

Testar logo compacta e nome ao lado. Permitir mais altura quando necessário para a marca real continuar
reconhecível.

Itens e grupos                44 px / 12-16 px

Manter a altura de toque dos itens. Usar títulos de grupo discretos e reduzir folgas repetidas entre grupos.

Entrada do conteúdo           16-24 px

Espaço do topo até o título e do cabeçalho até filtros/lista. Não somar margens de contêiner e de página sem
necessidade.

O ganho real precisa ser medido

Reduzir uma barra de 64 para 52 px representa 12 px de diferença nominal. O ganho renderizado pode ser
menor ou inexistente se os controles e o padding impuserem outra altura. Isso exige verificar busca, conta,
foco e texto ampliado juntos.

Abrir um menu de 240 px no lugar do recolhido de 72 px usa 168 px adicionais de largura. Portanto, a prévia
com menu aberto não garante mais área de conteúdo: ela oferece melhor orientação. Manter a opção de
recolher dá espaço aos editores quando necessário.

Não diminuir tudo: priorizar espaços redundantes, títulos repetidos e a altura do bloco de identidade. Campos, áreas
de toque e texto continuam legíveis. A rolagem do menu é válida quando a altura da janela não comporta todos os
destinos.

Evidência lida em 11/11/2026: ui/BarraTopo.tsx (minHeight 64); ui/Navegacao.tsx (240/72/88); ui/MarcaTitulo.tsx; prévia/base.css
(.painel-cab: 52 px; .menu-item: mínimo 44 px). São valores declarados, não medições de tela.

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS                                                                    30 / 31
CONSULTORIA / DIREÇÃO VISUAL                NOVEMBRO 2026

30 / APLICAÇÃO E CONFERÊNCIA

Ajustar a estrutura uma vez

Orientação para o Claude: concentrar a mudança no cabeçalho e na navegação do treinador, mantendo os
fluxos existentes.

1. Organizar a barra atual

Partir de BarraTopo.tsx, mantendo BuscaGlobal, TodasAsTelas e CartaoDoUsuario. Avaliar contexto e
controle de recolher na mesma faixa. Uma nova barra acima da atual anularia o objetivo de recuperar altura.

2. Refinar a lateral

Em Navegacao.tsx, alinhar identidade, grupos, itens e rodapé. Preservar todas as rotas permitidas, inclusive
Importação e Auditoria, ausentes do recorte simplificado da prévia. Não esconder destinos só para o menu
caber sem rolagem.

3. Evitar efeitos fora do escopo

MarcaTitulo e Cabecalho são compartilhados. Usar uma composição ou variante específica do treinador
quando necessário. Não reduzir globalmente a logo das telas públicas nem mudar a navegação do aluno.
Conferir efeitos indiretos sobre áreas já prontas.

4. Tratar larguras menores

No celular, preservar a navegação móvel atual. No tablet, manter o trilho existente. No desktop estreito,
compactar busca e conta de forma progressiva; não comprimir texto e controles até ficarem impraticáveis.

5. Validar o conjunto

Comparar antes/depois em 1280 × 720 e 1440 × 900, com zoom de 100% e os mesmos dados. Conferir
também 390 px, temas claro/escuro, nome longo, logo complexa, texto ampliado e conta com menos
permissões.

    Como comprovar o resultado: medir do topo da área útil até a primeira linha da lista, cartão ou editor; registrar altura
    da barra e largura disponível. Conferir teclado, foco visível, Ctrl/Cmd+K, abertura da conta, Todas as telas e
    recolher/expandir. Um topo mais curto não compensa controles inacessíveis ou conteúdo cortado.

Origem do acréscimo: Documento sem título (3).pdf, páginas 1-4, e confirmação do usuário. Esquema da página 29 criado para
explicar a proposta. Inspeção do código somente leitura; nenhuma mudança aplicada ao app nesta entrega.

GUIA DE RECOMENDAÇÕES • ANÁLISE E EXEMPLOS  31 / 31
```
