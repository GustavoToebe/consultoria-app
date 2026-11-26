# Contrato digital: plano de tela do passo 2 (app, núcleo)

Situação: Em andamento · Onde: `main` · Atualizado: 26/11/2026 · Frente: [contrato-digital.md](contrato-digital.md)

Escrito pelo `plano-front` em 26/11, sobre o código da API já implementada (`api/.../contratos/`). Só o signatário ALUNO e
só modelo: PDF próprio, link do responsável, prazo, tela de bloqueio e Ajuda ficam para os passos 3 a 6.

## Decisões da tela

| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| T1 | O comprovante depende da funcionalidade `PDF` do plano? | Não: é evidência do aceite, não o PDF de treino | Claude, a confirmar |
| T2 | Contrato pendente acende o ponto da aba Início do aluno? | Sim: é a única pendência que pode travar (D3) e já entra na contagem | Claude, a confirmar |
| T3 | Prorrogar | Painel mínimo com 7, 15 e 30 dias. Só aparece com `prazoAte`, que fica nulo até o passo 5 (só o e2e o exercita) | Claude |
| T4 | `dominio/telas.ts` | Fica de fora: `telasPermitidas` não conhece a chave e a tela apareceria na busca com ela desligada (como o WhatsApp oficial). A busca do hub acha "Contratos" | Claude |
| T5 | Lista dos 12 campos | Espelhada no app (`CAMPOS_DO_CONTRATO`) com teste de paridade lendo `CamposDoContrato.java` (como `catalogoDePermissoesParidade.test.ts`) | Claude |

## Lacunas da API (nenhuma impede a tela)
1. A prévia do modelo só existe para modelo salvo (`POST /contratos/modelos/{id}/previa`, `CONTRATO_ALTERAR`). Com alteração
   pendente a aba Prévia mostra a versão salva e avisa; modelo novo diz "Salve o modelo para ver a prévia"; quem só tem
   `CONTRATO_LER` não tem a aba (vê o texto cru com os `{campos}`).
2. Não há rota com a lista dos campos (T5).
3. Prorrogar só vale com prazo (T3).
4. Não há desarquivar e a lista traz os arquivados: seção "Arquivados (N)" recolhida, só leitura, fora da escolha do "Gerar";
   o painel de arquivar diz que não há volta.
5. O detalhe da equipe traz `assinatura.ip`, `assinatura.agente` e `geradoPorNome`; o do aluno só nome digitado e data e hora.
   IP e aparelho podem vir `""`: ausente some do comprovante, vazio sai "Não registrado". `ContratoResumo` não tem texto nem
   hash: o comprovante da lista busca `GET /contratos/{id}` antes.
6. Sem `FINANCEIRO_LER`, as faltas de responsável, plano, valor, parcelas e vigência aparecem mesmo quando o dado existe: o
   app acrescenta a `notaDasFaltas`.
7. A prévia do aluno não confere aluno inativo: o app desabilita "Gerar contrato" com o motivo antes do 409.

## Ordem e responsáveis
1. `executor`: contrato da API no app (`api/contratos.ts`; em `api/tipos.ts` só `contratosHabilitados?` no `EuResponse`;
   `dominio/perfilDaSessao.ts` e `sessao/SessaoProvider.tsx` expõem a chave), regras puras com teste e o comprovante em PDF.
2. `executor-front`: telas e e2e, consumindo as regras prontas.

## Regras puras (`dominio/contratos.ts`, com teste)
- `CAMPOS_DO_CONTRATO` `{codigo, rotulo, grupo}`: Aluno (`aluno_nome` "Nome do aluno", `aluno_cpf` "CPF do aluno",
  `aluno_endereco` "Endereço do aluno"); Responsável (`responsavel_nome` "Nome do responsável", `responsavel_cpf` "CPF do
  responsável"); Contratação (`plano` "Plano", `valor_total` "Valor total", `parcelas` "Parcelas", `vigencia_inicio`
  "Início da vigência", `vigencia_fim` "Fim da vigência"); Outros (`consultoria` "Consultoria", `data` "Data de geração").
  Padrão do campo `\{([A-Za-z0-9_]+)\}`.
- `camposDesconhecidos(texto)`; `inserirCampo(texto, selecao, codigo)` → texto novo e cursor depois do campo.
- `seloDoContrato` (equipe): PENDENTE vencido "Prazo vencido" (perigo); PENDENTE com prazo "Pendente · até dd/mm"
  (atencao); PENDENTE "Pendente" (atencao); ASSINADO "Assinado" (sucesso); CANCELADO "Cancelado" (neutro).
  `seloDoContratoDoAluno`: vencido "Prazo terminou" (perigo), com prazo "Assine até dd/mm" (atencao), sem prazo
  "Para assinar" (atencao), assinado "Assinado" (sucesso).
- `acoesDoContrato`: "Baixar comprovante" (ASSINADO, `CONTRATO_LER`), "Prorrogar prazo" (PENDENTE com `prazoAte` e
  ALTERAR), "Cancelar contrato" (perigo; PENDENTE e ALTERAR).
- `notaDasFaltas`: "Plano, valor, parcelas, vigência e responsável precisam do Financeiro, que não está disponível para o
  seu perfil."
- `rotuloDaContratacao`; `contratacoesParaEscolher` (ATIVA e PAUSADA; padrão = a única ATIVA).
- `linhasDeEvidencia` (ausente some, `""` = "Não registrado"); `instanteDeBrasilia` ("dd/mm/aaaa às HH:MM:SS");
  `htmlDoTextoFormatado` (usa `dominio/textoFormatado` e `esc()`).
- `itemDoContrato(lista)` em `dominio/paraFazer.ts`: título "Assinar contrato" (2 ou mais: "Assinar 2 contratos"),
  detalhe = título do mais urgente (+ " e mais N"), selo vencido "Prazo terminou" (perigo) / com prazo "Até dd/mm"
  (atencao) / sem prazo "Para assinar" (atencao), href do mais urgente (vencido, depois menor prazo, depois o mais antigo).
- Seção `contratos` em `dominio/contaDoAluno.ts` (depois de `plano`; visível com a chave, online e ao menos um contrato).
- Bloco `contratos` em `dominio/fichaDoAluno.ts` (`visivel: contratosHabilitados && pode('CONTRATO_LER')`) e
  `dominio/colunasDaFicha.ts` (esquerda depois de `planoContratado`; três colunas, a do meio depois de `planoContratado`;
  uma coluna, depois de `planoContratado`).
- Item `contratos` do hub em `dominio/configuracoes.ts` (grupo "Alunos e atendimento", "Contratos", "Modelos de contrato
  que o aluno assina no app.", `href` `/treinador/contratos`, palavras `contrato, assinatura, assinar, aceite, modelo de
  contrato, prestacao de servico, termo`, `chave: 'contratosHabilitados'`), `rotasDasConfiguracoes.ts` (abre dentro) e
  `permissoes.ts` (`/treinador/contratos` → `CONTRATO_LER`).

## Comprovante (`pdf/pdfContrato.ts`, com teste e um caso em `pdf/injecao.test.ts`)
`cabecalhoDoPdf`, o texto (`**x**` → `<strong>`, `__x__` → `<u>`, tudo por `esc()`) e a página "Evidências da assinatura":
assinado por (nome digitado), data e hora de Brasília com segundos e "(horário de Brasília)", IP e aparelho (só na versão
da equipe), quem gerou (equipe) e o código de verificação SHA-256 inteiro. O app **nunca calcula o hash**: imprime o que a
API devolveu. Nome do arquivo "Comprovante do contrato". Não depende da funcionalidade `PDF` (T1).

## Telas

### A. Configurações › Contratos
- Item embutido `/treinador/configuracoes/contratos` e rota inteira `/treinador/contratos` (`app/treinador/contratos.tsx`
  monta `treinador/contratos/TelaContratos`), como `TelaTagsDosAlunos`/`TelaDocumentos`.
- `Cabecalho` "Contratos", `descricao` "Modelos de contrato que você gera para o aluno assinar no app. Os campos entre
  chaves são preenchidos com os dados de cada aluno.", ação "Novo modelo" (`acao`, só ALTERAR).
- Ativos em `ListaDeLinhas`/`LinhaDaLista`: nome, "Atualizado em dd/mm/aaaa", "Editar" (`secundario`; sem ALTERAR, "Ver")
  e ⋯ (`FolhaDeAcoes`: "Ver prévia", "Arquivar modelo" `perigo`). "Arquivados (N)" em `CabecalhoDeGrupo` recolhível
  (`useSecoesAbertas`), selo neutro "Arquivado", só "Ver". Lista em `LARGURA_FORMULARIO` no PC.
- `FolhaModeloDeContrato` (`LARGURA_FOLHA_LARGA`, `telaCheiaNoCelular`; títulos "Novo modelo de contrato" / "Editar
  modelo de contrato" / "Modelo de contrato"): `Campo` "Nome do modelo" (80); `Abas` "Texto" | "Prévia" (Prévia só com
  ALTERAR). Texto: "Inserir campo" com chips (`FaixaDeChips`, `quebrar` no PC) em 4 grupos com subtítulo `secao`; `Campo`
  multilinha "Texto do contrato" (mín. ~360 px; no PC altura máxima com rolagem); ajuda "Use **negrito** e __sublinhado__.
  Toque num campo para inseri-lo onde está o cursor."; contador "N de 50.000"; nota "Plano, valor, parcelas e vigência vêm
  da contratação escolhida ao gerar.". Prévia: título e `TextoFormatado` num papel (`superficie2`, borda `divisor`) e
  "Dados de exemplo, nenhum dado de aluno."; pendente: `Alerta atencao` "A prévia mostra a versão salva. Salve para ver as
  alterações."; novo: "Salve o modelo para ver a prévia com dados de exemplo.". Rodapé "Tudo salvo"/"Alterações não
  salvas" + "Descartar" + "Salvar modelo" (primário), como `DetalheMeusDados`; depois de salvar a folha fica aberta como
  "Editar" e avisa "Modelo salvo."; sair com pendência pergunta "Sair sem salvar?" (`comunidade/useFecharComAviso`).
  Inserir campo usa `onSelectionChange`; o foco volta ao texto com o cursor depois do campo (no nativo, conferir
  `selection` no Context7; no pior caso, vai para o fim).
- Estados: chave desligada ou 503 `CONTRATOS_INDISPONIVEL` = `Vazio` "Contratos não estão ativos" / "O contrato digital
  não está ativo nesta instalação do app." sem chamar a API; carregando `Esqueleto` (3 linhas); vazio com ALTERAR "Nenhum
  modelo de contrato" / "Crie o modelo com o seu texto e os campos que o app preenche para cada aluno." + "Novo modelo";
  vazio sem ALTERAR "Ainda não há modelo de contrato. Peça a quem administra a consultoria."; erro `MensagemErro` + "Tentar
  de novo"; campo desconhecido antes de enviar "Campos desconhecidos: {x}, {y}. Use só os da lista."; 422
  `CONTRATO_MODELO_INVALIDO` no campo; 409 `CONTRATO_MODELO_NOME_EM_USO` "Já existe um modelo ativo com este nome."; 409
  `CONFLITO_EDICAO` "Outra pessoa alterou este modelo. Recarregue para ver a versão atual." + "Recarregar"; 409
  `CONTRATO_MODELO_ARQUIVADO` "Este modelo foi arquivado e não pode mais ser editado." (folha vira leitura); sem internet
  "Confira a internet e tente de novo." (rascunho fica). Arquivar: painel "Arquivar o modelo?" / "Ele sai da escolha ao
  gerar contrato. Os contratos já gerados com ele não mudam. Não há como desarquivar." / "Arquivar"; sucesso "Modelo
  arquivado.".

### B. Ficha › aba Ficha, cartão "Contratos" (`treinador/contratos/CartaoContratos`)
- Faixa com "Gerar contrato" (`acao`, ALTERAR e não anonimizado; inativo: desabilitado, motivo "Aluno inativo. Reative
  para gerar um contrato."). `ListaDeLinhas`: título, "Gerado em dd/mm/aaaa" e "Assinado em"/"Cancelado em", selo, "Ver"
  (`secundario`) e ⋯ com `acoesDoContrato` (sem ação, sem ⋯). Vazio "Nenhum contrato gerado."; 503 só o vazio.
- `FolhaDoContrato` ("Ver", `GET /contratos/{id}`): `ListaDeDados` com Situação, Gerado em (dd/mm/aaaa às HH:MM) e "por
  <geradoPorNome>", Prazo para assinar, Cancelado em e Motivo; assinado: bloco "Evidências da assinatura" (Nome digitado,
  Data e hora (Brasília), IP, Aparelho, Código de verificação em mono selecionável) + "Baixar comprovante"; depois o texto
  (`TextoFormatado selecionavel`) no papel.
- `FolhaGerarContrato` (`LARGURA_FOLHA_LARGA`, `telaCheiaNoCelular`; `pedidoId = novoUid()` ao abrir, reenviado na
  mesma abertura, como `FolhaDaCobrancaAvulsa`): "Modelo" (`Escolha`, `EscolhaEmFolha` acima de 8; um só já escolhido);
  "Contratação" só com `pagamentosHabilitados && FINANCEIRO_LER` ("Nenhuma" + ATIVA/PAUSADA de
  `listarContratacoesDoAluno`, só leitura de `api/rotas.ts`; falha = erro pequeno com "Tentar de novo" e prévia com
  "Nenhuma"); "Prévia" por `useCarregar` com a chave `${modeloId}:${contratacaoId ?? ''}` (`Esqueleto`; faltas em
  `Alerta perigo` "Falta preencher antes de gerar" com uma linha por falta, região viva, e a `notaDasFaltas` quando for o
  caso; com `ALUNO_SENSIVEL_ALTERAR` e falta de CPF/endereço, link "Completar o cadastro do aluno" que fecha a folha e,
  em `depoisDeFecharAsFolhas`, `setParams({editar:'1', aba:'ficha'})`); nota "O aluno vê o contrato no app assim que você
  gerar e assina com o nome completo e o aceite.". Rodapé "Cancelar" + "Gerar contrato" (primário; motivos "Escolha o
  modelo.", "Aguarde a prévia.", "Faltam dados: veja a lista acima."). Sucesso fecha, avisa "Contrato gerado. O aluno já
  pode assinar no app." e recarrega. Sem modelo ativo: `Vazio` "Nenhum modelo de contrato ativo." + "Criar modelo". Erros:
  422 `CONTRATO_INCOMPLETO` busca a prévia de novo; 422 `CONTRATO_INVALIDO` mensagem do campo; 409
  `CONTRATO_MODELO_ARQUIVADO` recarrega modelos e diz "Este modelo foi arquivado. Escolha outro."; 409
  `ALUNO_INATIVO`/`ALUNO_ANONIMIZADO`, 403 e 503 `FINANCEIRO_INDISPONIVEL` com a mensagem da API; 409 `PEDIDO_JA_USADO`
  "Não foi possível gerar. Feche e abra de novo."; 404 "A contratação ou o aluno não foi encontrado. Escolha de novo.";
  503 `CONTRATOS_INDISPONIVEL` fecha sem erro; rede "Confira a internet e tente de novo." (mesmo `pedidoId`).
- Cancelar: `PainelConfirmacao perigo` "Cancelar este contrato?" / "O aluno deixa de ver o contrato e não pode mais
  assiná-lo. Para valer de novo, gere outro contrato." com `Campo` "Motivo (só a equipe vê)" (300, contador),
  "Cancelar contrato"/"Voltar", sem motivo desabilitado ("Escreva o motivo."). 409 `CONTRATO_ASSINADO` "O aluno assinou
  antes do cancelamento. Contrato assinado não se cancela." e recarrega; `CONFLITO_EDICAO`, `CONTRATO_SEM_PRAZO`,
  `CONTRATO_NAO_PENDENTE` com a mensagem da API e recarrega; sucesso "Contrato cancelado.".
- Prorrogar: `Escolha` 7/15/30 dias, "Prorrogar", aviso "Prazo prorrogado até dd/mm/aaaa.".

### C. Aluno
- `aluno/contratos/ContratosDoAlunoProvider` (molde do `CompromissosDoAlunoProvider`, no `app/aluno/_layout.tsx` dentro do
  `AlunoProvider`): `GET /aluno/contratos` só com a chave e online; recarrega ao focar, na volta da internet e depois de
  assinar; 503 = lista vazia; nada no aparelho. O ponto do Início ganha `|| contratoPendente` (T2).
- `ParaFazer`: `itemDoContrato` como **primeiro** item (`ItemDeLista`, ícone de contrato do lucide instalado).
- `/aluno/contrato/[id]` (`aluno/contratos/TelaDoContrato`): `Cabecalho` com o título (h1) e a seta. Pendente: "Enviado
  em dd/mm/aaaa" + selo; h2 "Texto do contrato" (`TextoFormatado selecionavel`, `LARGURA_TEXTO_CORRIDO`); h2 "Assinatura":
  `Campo` "Seu nome completo" (`autoComplete="name"`, ajuda "Como no seu cadastro: <nome>"), `CaixaSelecao` "Li o
  contrato e concordo com os termos.", nota "Ao assinar, guardamos a data e a hora, o aparelho e um código que identifica
  este texto.", `primario` "Assinar contrato" (`cheio` no celular; sem internet, motivo "Sem internet: conecte-se para
  assinar."); confere vazio e aceite antes (`focarPrimeiroComErro`) e manda `{sha256 do detalhe, nome, aceite:true}`.
  Assinado: selo "Assinado", `ListaDeDados` (Assinado por, Data e hora "dd/mm/aaaa às HH:MM:SS (horário de Brasília)",
  Código de verificação), `primario` "Baixar comprovante" e o texto. Estados: sem internet `Incompleto` "Sem internet" /
  "O contrato só abre com conexão." + "Tentar de novo"; 404 e 503 `Vazio` "Contrato indisponível" / "Este contrato não
  está mais disponível. Fale com o seu treinador." + "Voltar ao início" (recarrega o provedor); 409 `CONTRATO_ALTERADO`
  recarrega, mantém o nome, desmarca o aceite, rola ao topo e mostra `Alerta atencao` "O contrato mudou desde que você
  abriu. Leia de novo antes de assinar." com o foco nele; 409 `CONTRATO_SIGNATARIO` mensagem da API e o formulário some;
  409 `CONFLITO_EDICAO` recarrega; 422 `ASSINATURA_INVALIDA` nos campos; sucesso troca para assinado, aviso "Contrato
  assinado.", foco no selo, recarrega o provedor.
- Conta › "Meus contratos" (seção depois de "Meu plano"): uma `LinhaDaConta` por contrato ("Assinado em dd/mm/aaaa",
  "Para assinar · até dd/mm" ou "Para assinar"), `href` para a tela.

## Acessibilidade e e2e
- Nomes: "Inserir campo Nome do aluno", "Ver contrato <título>", "Mais ações do contrato <título>", "Gerar contrato",
  "Assinar contrato", "Baixar comprovante", "Seu nome completo", "Li o contrato e concordo com os termos.". Um h1 por tela;
  alvos de 44 px; sem movimento. Foco volta a quem abriu; gerar com sucesso volta ao "Gerar contrato".
- `e2e/contratos.spec.ts` (390 e 1280, `naoTratadas` vazio): hub com a chave ligada e desligada (sem chamada a
  `/contratos*`); novo modelo com chip, campo desconhecido sem chamar a API, salvar, prévia, arquivar; gerar com falta
  (botão desabilitado), gerar com 500 e reenvio do **mesmo `pedidoId`**, selo "Pendente", sem `FINANCEIRO_LER` sem
  contratação e com a nota; cancelar (motivo vazio trava; 409 `CONTRATO_ASSINADO`); prorrogar com e sem `prazoAte`;
  só `CONTRATO_LER` sem "Gerar"/"Cancelar" e sem `CONTRATO_LER` sem cartão; comprovante no `#treinos-impressao` com
  "Evidências da assinatura" e o hash inteiro; aluno: pendência e ponto, aceite vazio, 422 do nome, 409 com aceite
  desmarcado e nome mantido, sucesso, Conta › Meus contratos, 404, offline. Mais `TELAS` em
  `e2e/ajuda-do-cabecalho.spec.ts` (seção `null`) e o caso em `e2e/configuracoes.spec.ts`.
- Aceitação: typecheck, lint, jest; e2e `contratos`, `configuracoes`, `ajuda-do-cabecalho`, `ficha-dados`,
  `conta-do-aluno` e `inicio-aluno` em 390 e 1280; capturas de Configurações › Contratos e da ficha em 1280 e 1920, da tela
  do aluno (pendente e assinado) em 390 e 1280 e do PDF.

## Limites
Não tocar em `api/rotas.ts` (só chamar `listarContratacoesDoAluno`), em `api/tipos.ts` além do campo, em importação, em
`api/cliente.ts`, em `ui/`, em tokens, na API Java nem no `AGENTS.md`. Nada de dado pessoal em log nem no nome do arquivo.

## Riscos
Prorrogar só pelo e2e até o passo 5; espelho dos 12 campos; texto de 100.000 caracteres no `TextoFormatado`; inserir no
cursor no nativo; uma chamada a mais ao abrir a área do aluno (só com a chave ligada e online).
