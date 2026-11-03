# Auditoria de UI/UX do app (web e celular)

> **Nota (03/11/2026):** auditoria feita sobre o commit `875934b3` e conferida contra a `main` em `78d2664b`. As capturas citadas ficaram fora do git. Itens marcados "Resolvido depois da auditoria" já estavam corrigidos na `main` conferida. O que entra em código está em `auditoria-ui-ux-lote-1.md`.

- **Data:** 03/11/2026
- **Código auditado:** commit `875934b3` (02/11/2026), imagem web local construída a partir dele.
- **Ambiente:** local (`http://localhost:8088`, Caddy na frente da API), contas de demonstração da consultoria SARAIVA TEAM: treinador `saraiva@demo.local` (perfil Administrador) e aluno `aluno@demo.local`. Nenhum dado foi gravado: só navegação, abertura de folhas e envio de formulário vazio (barrado pela validação local).
- **Escopo:** só análise. Nenhum arquivo do app foi alterado.

## Como ler este relatório

**Etiqueta de evidência** (em todo achado):

| Etiqueta | Significa |
| --- | --- |
| **Observado** | Visto na tela rodando (Playwright + Chromium), com captura ou medição do DOM. |
| **Código** | Identificado só lendo o código. A tela não foi vista nesse estado. |
| **Hipótese** | Suspeita que precisa de validação visual ou com usuário antes de virar tarefa. |

**Prioridade:** P0 impede tarefa essencial · P1 dificulta tarefa relevante ou causa erro frequente · P2 clareza, consistência ou eficiência · P3 refinamento.

**Esforço** (estimativa, sem medir o código além do lido): pequeno = até meio dia; médio = 1 a 3 dias; grande = mais de 3 dias ou mexe em várias telas.

**Correções compartilhadas** têm ID `C1…C10` (seção A.4). Nas telas, o relatório cita o ID em vez de repetir a correção. Cada recomendação traz um **critério de aceitação** verificável.

**Método.** Leitura do `AGENTS.md`, de `docs/design-e-front.md` (sistema de design e problemas conhecidos), das rotas em `app/src/app/` e das peças de `app/src/ui/`. Depois, quatro scripts Playwright percorreram as rotas em 390 px (celular), 900 px (tablet, menu em trilho) e 1280 px (PC), medindo no DOM: alvos interativos menores que 44 px, elementos sem nome acessível, campos sem rótulo, texto menor que 12 px, rolagem horizontal, títulos `h1`, imagens sem `alt`, altura da página e erros do console. Uma segunda passada abriu folhas, menus e editores, testou Tab/Esc e o retorno do foco. As capturas ficaram fora do repositório (pasta temporária da sessão), citadas aqui pelo nome do arquivo.

Valores pessoais vistos nas telas de demonstração (CPF, endereço, telefone, peso, fotos, respostas) **não** foram transcritos.

---

## A. Visão geral

### A.1 Diagnóstico

O app está maduro do ponto de vista de sistema de design: as peças compartilhadas (`Cartao`, `Folha`, `Campo`, `Botao` com `motivo`, `Alerta`, `Selo`, `Tabela`, `LinhaDaLista`, `PainelConfirmacao`, `GuardaDeSaida`) são usadas de forma consistente, e as medições automáticas deram resultado limpo na maior parte das telas: **nenhum** elemento interativo sem nome acessível, **nenhum** campo sem rótulo, **nenhuma** rolagem horizontal da página, **nenhum** texto de interface abaixo de 12 px (com uma exceção no gráfico), status sempre com texto e ícone, cor de marca restrita à ação principal.

Os problemas que restam são de **fluxo e de hierarquia**, não de acabamento:

1. No celular do aluno, o fim do treino tem um botão "Concluir treino" que não conclui nada (só volta), e a ordem dos campos troca entre série normal e série Cluster. São as duas falhas com mais chance de gerar registro errado na academia.
2. Para o treinador, as telas mais usadas (Início, ficha do aluno, folha da pasta) são longas e põem antes da dobra coisas que não são a tarefa do dia: dados cadastrais antes das pastas na ficha, "Finalizar pasta" como botão principal na folha da pasta, "Primeiros passos" ocupando a tela inteira do Início no celular.
3. Algumas peças compartilhadas têm defeitos pequenos que se repetem em dezenas de lugares (trilha anunciada como segundo título, botão de ícone com 40 px, folha que não devolve o foco). Corrigidos na peça, somem do app inteiro.

Não foi encontrado nenhum P0: todas as tarefas essenciais vistas (entrar, ver treino, registrar série, cadastrar aluno, abrir pasta, editar modelo, receber inscrição) são possíveis.

### A.2 Pontos positivos (preservar)

- **Botão desabilitado com motivo** (`Botao` com `motivo`): "Cadastrar" diz "Informe o nome do aluno.", "Continuar" na importação diz "Escolha o que vai importar.", "Concluir série" diz "Marque cada bloco como feito ou não feito.", "Criar grupo" explica por que está desligado. Observado. É o melhor padrão do app; manter em tudo.
- **Validação por campo na inscrição pública:** envio vazio marca os dois campos obrigatórios com `aria-invalid`, mostra "Informe seu nome." e "Informe o WhatsApp com DDD." junto do campo e um resumo "Confira os campos destacados." perto do botão. Observado (`inscricao-390-vazio.png`). Serve de modelo para as outras telas públicas (C6).
- **Editor de modelo:** "5 problemas para publicar · ir ao primeiro" leva direto ao erro; selo "SALVO" visível; ações fixas no topo. Observado (`editor-modelo-pc.png`).
- **Folha** fecha com Esc e prende o foco (25 Tabs seguidos ficaram dentro). Observado.
- **Estados vazios com texto útil** ("Seu treinador ainda não publicou a dieta.", "Nada neste período.", "Nenhuma inscrição nesta lista") e **endereço inválido** com mensagem de recuperação ("Não encontramos o que você procura. Confira o endereço ou volte à lista."). Observado.
- **Aluno offline:** selo "SINCRONIZADO" fixo e texto no rodapé da sessão explicando que o registro fica salvo no aparelho. Observado.
- **Formulários:** rótulo sempre visível, "(opcional)" explícito, nota de dado sensível nos campos de saúde (LGPD), máscaras de CPF e telefone. Observado (novo aluno, inscrição).
- **Importação em 5 etapas** com indicador de etapa e "Nada é gravado até…". Observado.
- **Tela de entrar:** foco visível no botão de mostrar senha, links claros ("Esqueci minha senha", "Tenho um convite", "Sou treinador"). Observado.
- Nenhum `Alert.alert`/`confirm()` nativo, nenhum texto em inglês, nenhum emoji usado como ícone. Código.

### A.3 Problemas mais importantes e impacto

| # | Problema | Onde | Evidência | Prioridade | Impacto |
| --- | --- | --- | --- | --- | --- |
| 1 | Com a chave `TREINOS_RETORNO_HABILITADO` desligada (caso do ambiente local), "Concluir treino" no fim do exercício só navega de volta; com 0 de 4 séries feitas o botão cheio diz "Concluir treino". | Aluno › Exercício | Observado + Código | P1 | Aluno acredita que fechou o treino; treinador vê treino incompleto. |
| 2 | ~~Ordem dos campos troca: série normal é **kg, reps, ✓**; bloco Cluster é **reps, kg, ✓**.~~ Resolvido depois da auditoria (Frente G, D12). | Aluno › Exercício | Observado + Código | P1 | Digitar carga no campo de repetições na academia, com uma mão. |
| 3 | Novo aluno e edição de dados saem sem aviso e perdem o que foi digitado. | Treinador › Novo aluno / ficha | Código (C7) | P1 | Retrabalho; dado de cadastro perdido. |
| 4 | Ficha do aluno com 4.360 px (PC) e 6.261 px (celular), dados cadastrais antes das pastas, sem índice de seções. | Treinador › Ficha | Observado | P2 | A tarefa mais comum (abrir a pasta, editar o plano) fica abaixo da dobra. Já decidido em `docs/planos/telas-do-aluno-visual.md` (passo 2 aberto). |
| 5 | Folha da pasta tem "Finalizar pasta" como botão principal e os planos da pasta abaixo da dobra. | Treinador › Folha da pasta | Observado | P2 | Ênfase na ação terminal; risco de finalizar por engano e de não achar o treino. |
| 6 | Início do treinador: 18 botões só de ícone (abrir, atualizar, filtro) nos blocos; no celular, "Primeiros passos" ocupa a primeira tela inteira. | Treinador › Início | Observado | P2 | Significado do "filtro" não é óbvio; o painel não mostra nada útil sem rolar. |
| 7 | Financeiro mostra "Sem acesso a esta tela… Peça a um administrador" **para o próprio administrador** (módulo de pagamentos desligado). | Treinador › Financeiro | Observado (C4) | P2 | Mensagem falsa; o administrador não tem a quem pedir. |
| 8 | "Hoje é dia de descanso." sem ação, enquanto o aluno pode registrar a sessão do dia pelo Treino. | Aluno › Início | Observado | P2 | Aluno que quer treinar fora do dia previsto não acha o caminho. |
| 9 | Biblioteca de exercícios renderiza a lista inteira (≈17.000 px, 187 elementos interativos), sem paginação. | Treinador › Biblioteca | Observado (C8) | P2 | Rolagem longa; vai piorar com o catálogo crescendo. |
| 10 | Abas cortadas no celular sem indicação de que há mais ("Atu…", "Avisaram a…"). | Planejamento, Atualizações, Biblioteca | Observado (C5) | P2 | Abas escondidas parecem não existir. |

### A.4 Problemas recorrentes: correções compartilhadas (peça/design system)

Cada item é corrigido **uma vez** na peça e resolve todas as telas que a usam.

**C1. Trilha anunciada como segundo título.** `app/src/ui/Cabecalho.tsx:73` põe `accessibilityRole="header"` na trilha ("Você está em: Alunos › Aluno Demonstração"). Em ≥768 px a página fica com dois títulos de nível 1 (medido: ficha, novo aluno, editor de modelo, aluno inexistente). Observado + Código. **P2, pequeno.**
- Recomendação: tirar o papel de título da trilha; usar papel de navegação com rótulo "Trilha" (no web, `<nav aria-label="Trilha">`), mantendo o `h1` único no título da tela.
- Aceitação: em qualquer tela com trilha, `document.querySelectorAll('[role=heading][aria-level="1"], h1').length === 1`; o leitor de tela anuncia a trilha como navegação.

**C2. Botão de ícone com moldura tem 40×40 px.** `app/src/ui/IconeBotao.tsx:45` (`moldura: { width: 40, height: 40 }`); o comentário da linha 19 conta com `hitSlop` para chegar a 44. Medido 40×40 em 1280 e 390 px em: Voltar do cabeçalho, "Mais ações do aluno", "Mais ações de (nome do modelo)" (8 no Planejamento), lápis "Editar cadastro de…" na lista de alunos, setas e "Nova agenda" da Agenda, "Recolher os primeiros passos". Observado. No web o `hitSlop` não completa nada: o `Pressable` do react-native-web não trata essa propriedade (em `node_modules/react-native-web/dist/` ela só aparece no `Touchable` antigo). Código. No app nativo o `hitSlop` funciona, então o problema é do web e do PWA. O mesmo vale para o modo `compacto` (`IconeBotao.tsx:15` e `:34`, `hitSlop` 6), que não apareceu nas medições: conferir onde é usado. **P2, pequeno.**
- Recomendação: caixa de 44×44 com o desenho da moldura de 40 centralizado (preenchimento transparente de 2 px), sem depender de `hitSlop`.
- Aceitação: `getBoundingClientRect()` de todo `IconeBotao` com moldura ≥ 44×44 em 390 e 1280 px; o desenho visual não muda.

**C3. Folha: dois diálogos, foco inicial e retorno do foco.** Ao abrir a folha da pasta há dois `role=dialog` aninhados (o `Modal` externo sem nome e a Folha com nome "teste"); o foco inicial cai no primeiro controle, que é "Finalizar pasta"; depois do Esc o foco vai para `BODY` em vez de voltar à linha que abriu a folha. Observado (`checagens.mjs`). `PainelConfirmacao.tsx:50` já devolve o foco: é o padrão a copiar. **P2, pequeno a médio.**
- Recomendação: um único `role=dialog` com `aria-modal` e nome; foco inicial no título da folha (ou no "Fechar"), nunca numa ação destrutiva/terminal; ao fechar, devolver o foco ao elemento que abriu.
- Aceitação: abrir a folha da pasta pelo teclado → `activeElement` é o título ou "Fechar"; Esc → `activeElement` é a linha da pasta; só um `[role=dialog]` no DOM.

**C4. Tela "Sem acesso" sem título e com causa errada.** `app/src/ui/Estados.tsx:39-47` (`SemPermissao`) não tem título de nível 1; `Permitido.tsx:12-17` mostra a mesma tela quando o **módulo está desligado** (`pagamentosHabilitados` falso), e o texto culpa a permissão. Observado em Financeiro com Administrador. **P2, pequeno.**
- Recomendação: título `h1` na tela; separar dois casos. Sem permissão: "Sem acesso a esta tela" / "Seu perfil não tem permissão para abrir esta tela. Peça a um administrador da consultoria." Módulo desligado: "Financeiro indisponível" / "Os pagamentos não estão ativos nesta instalação do app." (o liga/desliga é a variável `TREINOS_PAGAMENTOS_HABILITADO` do servidor, `api/.../pagamentos/ExigePagamentos.java`; o administrador da consultoria não tem como ativar, então o texto não deve mandar ninguém pedir).
- Aceitação: administrador em consultoria sem pagamentos vê o texto de módulo desligado; membro sem permissão vê o texto de permissão; as duas telas têm exatamente um `h1`.

**C5. Faixa de abas cortada no celular.** Planejamento (7 abas, a 4ª aparece como "Atu…"), Atualizações ("Avisaram a…") e Biblioteca, em 390 px. A faixa de chips já tem degradê na borda; a de abas não. Observado. **P2, pequeno.**
- Recomendação: mesmo degradê da faixa de chips na borda direita; rolar a aba ativa para dentro da vista; com mais de 4 abas no celular, considerar `EscolhaSuspensa` ("Mostrar: Treino ▾").
- Aceitação: em 390 px, nenhuma aba aparece com reticências sem indicação visual de rolagem; ao abrir uma aba fora da vista por link, ela aparece inteira.

**C6. Formulários públicos validam só no topo.** Entrar (envio vazio → alerta "Informe e-mail e senha." no topo, campos sem marcação, Observado, `entrar.tsx:43`); convite (`convite.tsx:72,81-83`), convite de equipe (`convite-equipe.tsx:53-55`), esqueci a senha (`esqueci-senha.tsx:35`) e redefinir senha (`redefinir-senha.tsx:42-45`) seguem o mesmo padrão (Código). A inscrição pública já faz certo. **P2, pequeno.**
- Recomendação: usar `erro` do `Campo` em cada campo obrigatório ("Informe o e-mail.", "Informe a senha.") e manter o alerta do topo só para erro do servidor ("E-mail ou senha incorretos.").
- Aceitação: envio vazio em cada tela pública marca cada campo vazio com `aria-invalid=true` e mensagem junto do campo; o foco vai para o primeiro campo inválido.

**C7. Guarda de saída ausente no cadastro do aluno.** `FormAluno` (`app/src/treinador/FormAluno.tsx`) não usa `useGuardaDeSaida`; busca por `useGuardaDeSaida|useSaidaGuardada` em `FormAluno.tsx` e `app/src/app/treinador/alunos/*.tsx` não encontrou nada. Os editores de plano usam (`treinador/plano/usePlanoEditor.ts:151`, `ui/GuardaDeSaida.tsx`). Código. **P1, pequeno** (a peça existe). Encaixa no passo 3 de `docs/planos/telas-do-aluno-visual.md` (D7, novo aluno e edição), que já vai mexer no `FormAluno` e não cita a guarda.
- Recomendação: ligar a guarda quando qualquer campo diferir do valor inicial; liberar depois de salvar.
- Aceitação: em Novo aluno, digitar um nome e tocar em Voltar (ou em outro item do menu) abre o aviso de saída; depois de "Cadastrar" com sucesso, sair não pergunta nada. Mesmo comportamento na edição dos dados na ficha.

**C8. Listas longas renderizadas inteiras.** Biblioteca › Exercícios: ≈17.064 px em 1280 e ≈19.790 px em 390, 187 elementos interativos (Observado). Atualizações carrega a lista inteira e o "Próxima ›" do detalhe também (`treinador/atualizacoes/index.tsx:51`, `atualizacoes/[id].tsx:129-141`, Código). Alunos, Interessados e Auditoria já paginam de 30. **P2, médio.**
- Recomendação: mesma paginação de Alunos (30 por página, "Mostrar mais" ou páginas) na Biblioteca e em Atualizações; a busca continua filtrando no servidor.
- Aceitação: Biblioteca com o catálogo atual abre com no máximo 30 linhas e altura < 3.000 px em 1280; buscar um exercício que está na página 3 o encontra.

**C9. Texto de 11 px no gráfico.** `app/src/treinador/painel/RoscaDosAlunos.tsx:38` (`fontSize={11}` no rótulo "Alunos" no centro da rosca). Observado no Início. Único texto abaixo do mínimo de 12 px do app. **P3, pequeno.**
- Aceitação: rótulo com 12 px ou mais; medição de texto < 12 px no Início dá zero.

**C10. Passeio guiado volta em cada navegador novo e bloqueia a tela.** A marca de "já viu" fica no aparelho (`app/src/ui/Passeio.tsx:36`); o treinador que entra no PC do escritório e no notebook vê o passeio de novo, e o cartão bloqueia cliques até "Pular". Observado (aparece segundos depois do login, sobre o conteúdo). **P3, médio** (precisa guardar no servidor).
- Recomendação: guardar a marca no perfil do usuário (servidor) e manter a do aparelho como cache.
- Aceitação: quem pulou ou terminou o passeio num navegador não o vê ao entrar em outro.

**Outros achados de código, menores (P3, pequeno, todos Código):**
- Erros engolidos sem aviso: `treinador/atualizacoes/index.tsx:57` (responsáveis → lista vazia), `treinador/auditoria.tsx:48`, `treinador/perfil.tsx:36-37` (contagem), `convite-equipe.tsx:42-45` (descarta o código do erro), `atualizacoes/[id].tsx:99` (retorno silencioso). Aceitação: falha de rede em cada ponto mostra `MensagemErro` com "Tentar de novo".
- Montador: "Copiado" aparece mesmo quando a cópia falha (`montador/index.tsx:205-216`); falha de `localStorage` silenciosa (`:54-56`, `:126-128`).
- Treino e Mobilidade do aluno sem estado de carregamento/erro quando o pacote ainda não chegou (`app/aluno/treino.tsx:82`, `app/aluno/mobilidade.tsx:43`): a tela fica em branco. **Hipótese** de quanto tempo isso aparece na prática.
- "Ver vídeo" na Mobilidade usa `Linking.openURL` e a Dieta usa `abrirLinkExterno` (`mobilidade.tsx:89-91` × `dieta.tsx:202`): comportamento diferente para o mesmo tipo de link.
- `CampoFotos` com `minWidth/minHeight: 28` (`aluno/atualizacao/fotos/CampoFotos.tsx:173`): se for o botão de remover foto, fica abaixo de 44 px. **Hipótese** (tela não vista com foto).
- `QuadroKanban` anima sem respeitar movimento reduzido (`treinador/interessados/QuadroKanban.tsx:210,225`); o resto do app usa `useMovimentoReduzido`.
- Símbolo "✓" dentro de texto (`aluno/ExercicioAluno.tsx:401`, `ajuda/conteudo.ts:355`): leitor de tela lê "marca de seleção". Preferir texto ("feito").
- Cores fixas fora do tema: `ui/Folha.tsx:161` (`rgba` do fundo) e `ui/Botao.tsx:42` (`#FFFFFF`). Conferir no tema claro areia e no contraste alto (não vistos).
- Logos da marca sem `alt` estão dentro de um elemento com `aria-label="SARAIVA TEAM"`, então são anunciados corretamente. Dar `alt=""` ou `aria-hidden` à imagem só limpa a árvore. Observado.

---

## B. Cobertura

Legenda do método: **PW** = Playwright com captura e medição do DOM; **PW+I** = também interação (abrir folha/menu, teclado, envio vazio); **Cód** = só código. Larguras: 390 (celular), 900 (tablet), 1280 (PC).

### B.1 Públicas (sem login)

| Tela | Rota | Perfil | Estados avaliados | Método | Limitações |
| --- | --- | --- | --- | --- | --- |
| Início público | `/` | Visitante | Redireciona para entrar | PW 390/1280 | — |
| Entrar | `/entrar` | Visitante | Padrão, foco por teclado, envio vazio | PW+I 390/1280 | Erro de senha errada não testado (evitar bloqueio por tentativas). |
| Criar conta (treinador) | `/cadastro` | Visitante | Padrão | PW 390/1280 | Não enviado (criaria conta). |
| Esqueci a senha | `/esqueci-senha` | Visitante | Padrão | PW 390/1280 | Não enviado (dispararia e-mail). Validação: Cód. |
| Redefinir senha | `/redefinir-senha` | Visitante | Sem token ("Link inválido ou vencido") | PW 390/1280 | Formulário com token válido: só Cód. |
| Convite do aluno | `/convite` | Visitante | Sem código | PW 390/1280 | Convite válido: só Cód. |
| Convite de equipe | `/convite-equipe` | Visitante | Sem código | PW 390/1280 | Convite válido: só Cód. |
| Inscrição | `/inscricao/[codigo]` | Visitante | Código inválido; código real em 390: padrão e envio vazio | PW+I 390/1280 | Envio preenchido não feito (criaria interessado). Tela de sucesso: Cód. |
| Montador | `/montador` | Visitante | "Página não encontrada" (não liberado no build) | PW 390/1280 | Editor do montador: só Cód. |
| Página inexistente | qualquer | Visitante | Não encontrada | PW 390/1280 | — |
| Rota protegida sem login | `/treinador/alunos` | Visitante | Redireciona para `/entrar` | PW 390/1280 | — |

### B.2 Aluno (celular é o uso principal)

| Tela | Rota | Perfil | Estados avaliados | Método | Limitações |
| --- | --- | --- | --- | --- | --- |
| Início | `/aluno` | Aluno | Dia de descanso, sem dieta, semana 0 de 1, passeio (6 passos) | PW 390/1280 | Dia com treino previsto não visto. Execução em 1280 parcialmente contaminada por limite de login (ver Limitações). |
| Treino | `/aluno/treino` | Aluno | Plano com 1 divisão | PW 390/1280 | Plano com várias semanas, troca de plano, PDF baixado: não testados. |
| Sessão | `/aluno/sessao/[uid]` | Aluno | Sessão com 1 exercício, nada registrado; sessão inexistente | PW 390/1280 | Sessão parcialmente registrada não vista. |
| Exercício | `/aluno/sessao/[uid]/[exercicio]` | Aluno | Série normal e Cluster, nada marcado, rolado até o fim | PW+I 390 | Nada foi marcado (evitar gravar). Cronômetro e vídeo não abertos. Registro offline: Cód. |
| Treino concluído | `/aluno/sessao/[uid]/concluido` | Aluno | — | Cód | Não visto: a chave `TREINOS_RETORNO_HABILITADO` estava desligada no ambiente local e concluir exigiria gravar. |
| Dieta | `/aluno/dieta` | Aluno | Vazio | PW 390/1280 | Dieta publicada: só Cód. |
| Lista de compras | `/aluno/lista-de-compras` | Aluno | Vazio | PW 390/1280 | Idem. |
| Mobilidade | `/aluno/mobilidade` | Aluno | Vazio | PW 390/1280 | Com rotina: só Cód. |
| Anamnese | `/aluno/anamnese` | Aluno | "Sem anamnese" | PW 390/1280 | Questionário respondível: só Cód. |
| Atualização | `/aluno/atualizacao` | Aluno | Bloqueada até a data | PW 390/1280 | Envio com fotos e peso: só Cód (não gravado). |
| Ciclo | `/aluno/ciclo` | Aluno | Redireciona para Conta (recurso desligado para este aluno) | PW 390/1280 | Tela do ciclo: só Cód. |
| Histórico | `/aluno/historico` | Aluno | Com fotos e atualizações | PW 390/1280 | Comparar fotos não aberto. |
| Conta | `/aluno/conta` | Aluno | Padrão | PW 390/1280 | Troca de senha/foto não enviada. |
| Ajuda | `/aluno/ajuda` | Aluno | Padrão | PW 390/1280 | — |
| Termos | `/aluno/termos` | Aluno | Já aceitos | PW 390/1280 | Primeiro aceite não visto. |

### B.3 Treinador (PC é o uso principal)

| Tela | Rota | Perfil | Estados avaliados | Método | Limitações |
| --- | --- | --- | --- | --- | --- |
| Início (painel) | `/treinador` | Administrador | Primeiros passos 4 de 6, blocos com zeros, passeio | PW 390/900/1280 | Painel com muitos alunos/pendências não visto. |
| Alunos | `/treinador/alunos` | Administrador | Lista agrupada por situação, filtros (folha no celular) | PW+I 390/1280 | Seleção em lote não exercitada. |
| Novo aluno | `/treinador/alunos/novo` | Administrador | Vazio, botão desabilitado com motivo | PW 390/1280 | Envio não feito; clique no botão abaixo da dobra falhou sem efeito visível. Perfil sem permissão de dado sensível: Cód. |
| Ficha do aluno | `/treinador/alunos/[id]` | Administrador | Completa (rolada em 5 alturas), aluno inexistente | PW+I 390/1280 | `?aba=` é ignorado (não há abas); 9 capturas idênticas. |
| Folha da pasta | (folha sobre a ficha) | Administrador | Aberta, teclado (Tab, Esc), foco | PW+I 1280 | Finalizar/Copiar/Renovar não executados. |
| Editar dados do aluno | (na ficha) | Administrador | — | Cód | Não aberto em modo edição. |
| Atualizações | `/treinador/atualizacoes` | Administrador | Vazio nas três abas | PW 390/1280 | Detalhe `/treinador/atualizacoes/[id]` (revisão, feedback, "Próxima ›"): só Cód, não havia atualização para revisar. |
| Agenda | `/treinador/agenda` | Administrador | Semana vazia (PC), lista (celular) | PW 390/1280 | Criar evento não testado. |
| Interessados | `/treinador/interessados` | Administrador | Lista vazia, link de inscrição | PW 390/1280 | Kanban e Indicadores não abertos com dados. |
| Números | `/treinador/numeros` | Administrador | Padrão | PW 390/1280 | Não inspecionado em profundidade. |
| Biblioteca | `/treinador/biblioteca` | Administrador | Exercícios (lista completa) | PW 390/1280 | Edição de exercício e outras abas não abertas. |
| Planejamento | `/treinador/planejamento` | Administrador | Treino › Semanas de treino, menu ⋯ do modelo | PW+I 390/1280 | Outras abas (Dieta, Pacotes…) só na faixa. |
| Editor de modelo | `/treinador/planejamento/modelo/[id]` | Administrador | Aberto, rolado, com problemas para publicar | PW 1280 | Não salvo. Celular não visto. |
| Editor de questionário | `/treinador/planejamento/questionario/[id]` | Administrador | — | Cód | Não aberto. |
| Editores de plano do aluno | `/treinador/treinos/[id]`, `/dietas/[id]`, `/mobilidades/[id]` | Administrador | Só id inválido ("Não encontramos…") | PW 390/1280 | Editor com plano real: só Cód (reexportam os editores; visto o de modelo). |
| Receitas | `/treinador/receitas` | Administrador | Redireciona ao Planejamento | PW 1280 | — |
| Importação | `/treinador/importacao`, `/nova`, `/planilha-completa` | Administrador | Lista, etapa 1 do assistente | PW 390/1280 | Etapas 2–5 com arquivo: só Cód. |
| Financeiro | `/treinador/financeiro` | Administrador | Bloqueado (módulo desligado) | PW 390/1280 | Tela real de financeiro: só Cód. |
| Equipe | `/treinador/equipe` | Administrador | Padrão | PW 390/1280 | Convite e papéis não exercitados. |
| Auditoria | `/treinador/auditoria` | Administrador | Padrão | PW 390/1280 | Não inspecionado em profundidade. |
| Marca | `/treinador/marca` | Administrador | Padrão | PW 390/1280 | Troca de tema/cor não feita (alteraria a marca). |
| Meus dados, Segurança, Minha conta, Ajustes | `/treinador/meus-dados`, `/seguranca`, `/minha-conta`, `/ajustes` | Administrador | Padrão | PW 390/1280 | Não inspecionadas em profundidade. |
| Perfil (celular) | `/treinador/perfil` | Administrador | Padrão | PW 390 | — |
| Ajuda, Termos | `/treinador/ajuda`, `/treinador/termos` | Administrador | Padrão | PW 390/1280 | — |

### B.4 Folhas e diálogos

O app usa `Folha` (e `PainelConfirmacao`) em cerca de 90 arquivos. A maioria **não foi aberta**: está listada para deixar claro que a análise dela é só a da peça compartilhada (C3), não de cada conteúdo.

| Folha / diálogo | Onde abre | Método |
| --- | --- | --- |
| Pasta (período, planos, Finalizar/Editar/Copiar) | Ficha › Pastas de plano | PW+I 1280 (teclado, Esc, foco) |
| Filtros da lista de alunos | Alunos (celular) | PW 390 |
| Mais ações do modelo (⋯) | Planejamento | PW+I 1280 (Tab ×25, Esc) |
| Passeio guiado (`ajuda/TutorialGuiado`, `ui/Passeio`) | Primeiro acesso, aluno e treinador | PW 390/1280 (só "Pular") |
| Mais ações do aluno (`FolhaDeAcoes`), Nova pasta, Usar pacote / Salvar pasta como pacote, Registrar peso, Avaliação física, Lesões, Enviar anamnese, Acesso ao app, Copiar para outro aluno | Ficha do aluno | Cód |
| Aplicar ao aluno, Organizar coleções, Renomear/mudar de coleção, Vincular metodologia, Novo modelo | Planejamento | Cód |
| Escolher da biblioteca, Criar grupo de exercícios, Receitas, Salvar como dia de treino/refeição, Escolher alimento/suplemento, Lista de compras, PDF da dieta | Editores de treino e dieta | Cód |
| Configurar o link de inscrição, Respostas prontas, Responder com modelo, Inscrição (aceitar), Semelhantes | Interessados | Cód |
| Nova/Editar agenda, Agendas e filtros, Compromisso, Evento | Agenda | Cód |
| Editar o Início, bloco do painel | Início do treinador | Cód |
| Ações em lote | Alunos (Selecionar) | Cód |
| Convidar/Editar membro, Novo/Editar perfil | Equipe | Cód |
| Lançamento, Plano, Cobrança, Exportar CSV, Pagamento para conferir, Contratar plano | Financeiro (desligado) | Cód |
| Catálogo (tipos, técnicas, combinações), Gerar imagem/carrossel | Marca | Cód |
| Todas as telas, Aparência e preferências | Menu / barra do topo | Cód |
| Confirmar saída (`ConfirmarSaida`) | Editores com guarda | Cód |
| Concluir treino, Iniciar descanso, Trocar de plano, explicação do tipo de série e do selo, Vou atrasar, Foto de perfil, Excluir conta, Ciclo, Lista de compras, fotos da atualização | Telas do aluno | Cód |
| Exportar rascunho, Modelos de planilha | Montador, Importação | Cód |

**Perfis não cobertos visualmente:** membros da equipe sem acesso total (as telas variam por permissão: `ui/Permitido.tsx`, `dominio/permissoes.ts`); só o Administrador foi usado. As variações de permissão estão analisadas **por código**.
**Temas:** vistos o escuro da marca SARAIVA TEAM (telas logadas) e o claro (telas públicas). Claro areia e contraste alto **não** foram vistos.

---

## C. Análise tela por tela

Formato de cada problema: a primeira linha traz o problema, a etiqueta e o local; os subitens seguem sempre a ordem **impacto → recomendação → prioridade · esforço · dependências → critério de aceitação**. As capturas citadas estão na pasta temporária da auditoria (ver Limitações).

### C.1 Aluno

#### Aluno › Início (`/aluno`)
**Finalidade:** dizer ao aluno o que fazer hoje (treino, dieta, atualização) e levar até lá.
**Preservar:** cartão "Hoje" no topo; anel "Sua semana" com texto ("0 de 1"); selo de sincronização fixo; estado vazio da dieta que diz de quem depende ("Seu treinador ainda não publicou um plano alimentar").

1. **Dia de descanso sem saída.** Observado (`aluno-390/01`) + Código (`aluno/CartaoHoje.tsx:44-55`): lua + "Hoje é dia de descanso." e nada mais. O mesmo aluno consegue registrar a sessão "Segunda" hoje pelo Treino (cartão "Outras datas" da sessão).
   - Quem treina fora do dia previsto (comum) não acha o caminho a partir da tela inicial.
   - Acrescentar um link secundário abaixo do texto: **"Treinar mesmo assim"** (abre `/aluno/treino`).
   - **P2 · pequeno** · nenhuma.
   - Aceitação: no dia de descanso, o cartão "Hoje" tem um link "Treinar mesmo assim" que abre a lista de divisões.
2. **Passeio cobre o selo de sincronização.** Observado (390): o cartão "1 de 6" do passeio fica sobre o selo "SINCRONIZADO".
   - Durante o passeio o aluno não vê o estado de sincronização.
   - Posicionar o cartão acima do selo (somar a altura do rodapé ao deslocamento).
   - **P3 · pequeno.**
   - Aceitação: em 390 px, o cartão do passeio não sobrepõe o selo nem a barra inferior.

*Sugestão adicional (não é correção):* em dia de descanso com dieta vazia a tela fica quase vazia; um cartão "Próximo treino: Segunda" daria direção. Validar com o Saraiva.

#### Aluno › Treino (`/aluno/treino`)
**Finalidade:** ver o plano em uso e escolher a divisão.
**Preservar:** seletor do plano com período ("teste · 27/10 a 15/11"), linha da divisão com letra, dia e número de exercícios; "Baixar PDF do treino".
Nenhum problema observado no estado visto. Estado de carregamento/erro: ver A.4, "Outros achados de código" (tela em branco enquanto o pacote não chega; Código, P3).

#### Aluno › Sessão (`/aluno/sessao/[uid]`)
**Finalidade:** ver os exercícios da divisão e começar o registro.
**Preservar:** cartão "HOJE · data · 0 de 4 séries feitas"; cartão do exercício com equipamento, técnica ("Cluster na série 4"), última carga e progresso "0/4 SÉRIES"; texto do rodapé dizendo que o registro fica salvo no aparelho.

1. **"Outras datas" acima da ação principal.** Observado (`aluno-390/13`): o cartão com datas passadas e futuras aparece antes do botão "Começar treino".
   - A ação de todo dia fica abaixo de uma escolha que quase nunca é usada.
   - Mover "Começar treino" para logo abaixo do cartão "HOJE" e recolher "Outras datas" numa linha ("Registrar em outra data ›").
   - **P2 · pequeno.**
   - Aceitação: em 390×844, "Começar treino" aparece sem rolar; as outras datas abrem com um toque.
2. **Sessão inexistente sem botão.** Observado (`aluno-390/15`): "Esta sessão não está mais no seu plano. Volte para ver o treino atual." sem ação.
   - Beco sem saída se o aluno chegou por link antigo ou notificação.
   - Botão **"Ver meu treino"** (abre `/aluno/treino`).
   - **P3 · pequeno.**
   - Aceitação: a tela de sessão inexistente tem um botão que leva ao treino atual.

#### Aluno › Exercício (`/aluno/sessao/[uid]/[exercicio]`)
**Finalidade:** registrar carga e repetições de cada série, na academia, com uma mão.
**Preservar:** botões −/+ de 52 px na carga de trabalho; "Sugerido: 25 kg · 50% da base do dia"; "Concluir série" desabilitado com motivo; campo de repetições vazio com "—" em vez de zero falso; botão de voltar ao topo; conteúdo não fica escondido atrás da barra inferior.

1. **"Concluir treino" que não conclui.** Observado (`checagens/exercicio-fim-390.png`: "0 de 4 séries feitas neste treino." + botão cheio "Concluir treino") + Código (`app/aluno/sessao/[uid]/[exercicio].tsx:183`: com a conclusão desligada, o botão só faz `router.replace(voltar)`).
   - O aluno toca achando que encerrou e salvou o treino. Botão cheio, cor de marca e verbo de encerramento indicam ação terminal.
   - Com a conclusão desligada, trocar por botão **secundário "Voltar à lista do dia"**. Com ela ligada, manter "Concluir treino" e, se houver séries sem registro, confirmar: "Concluir com 2 séries sem registro?".
   - **P1 · pequeno** · a conclusão depende da chave `TREINOS_RETORNO_HABILITADO`, desligada no ambiente local. `docs/planos/engajamento.md` (item 0.1 e tela "Bom trabalho!") já usa "Voltar à lista do dia" quando a chave está desligada; o botão do fim do exercício ficou de fora dessa regra.
   - Aceitação: com a conclusão desligada, o último botão da tela diz "Voltar à lista do dia" e não é primário; com ela ligada, concluir com séries pendentes pede confirmação.
2. **Ordem dos campos inverte no Cluster.** **Resolvido depois da auditoria:** na main, o `CartaoSerieComEtapas` já mostra o peso antes das repetições (Frente G, D12); o lote 1 só confirma com o e2e `exercicio-aluno`. Observado (`checagens/exercicio-meio-390.png`) + Código: série normal kg → reps → ✓ (`aluno/ExercicioAluno.tsx:375` e `:385`); bloco Cluster reps → kg → ✓ (`aluno/CartaoSerieComEtapas.tsx:204` e `:208`).
   - Erro por memória motora: o aluno digita a carga no campo de repetições.
   - Mesma ordem nos dois: **kg, reps, ✓**.
   - **P1 · pequeno** · se o passo 4 de `docs/planos/cores-por-tipo-de-serie.md` (Cluster/Rest-pause como bloco único) for feito logo, corrigir junto, porque mexe no mesmo cartão; se não, corrigir antes, sozinho.
   - Aceitação: em qualquer série (normal, Cluster e demais técnicas com etapas), o primeiro campo é a carga e o segundo as repetições.
3. **Vídeo e cronômetro só com ícone no cabeçalho.** Observado. Têm nome acessível, mas nenhum texto visível.
   - Aluno novo não sabe o que fazem.
   - Rótulo curto abaixo do ícone ("Vídeo", "Descanso").
   - **P3 · pequeno.**
   - Aceitação: os dois botões têm texto visível em 390 px.
4. **Explicação da carga de trabalho com jargão.** Observado: "WS" e "% da WS" no texto do cartão.
   - Aluno leigo não entende de onde vem a carga sugerida.
   - Texto proposto: **"Carga de trabalho: a carga das séries principais de hoje. As outras séries são calculadas a partir dela."** e "% da carga de trabalho" no lugar de "% da WS".
   - **P2 · pequeno** · sobrepõe `docs/planos/editor-de-series-rir-e-carga-fixa.md` D8 (C03, "% da WS" nas etapas): incluir o texto do cartão de carga de trabalho no passo 4 desse plano em vez de abrir tarefa nova.
   - Aceitação: a sigla "WS" não aparece sem explicação em nenhuma tela do aluno.
5. **"Não fiz" com aparência de texto.** Observado (`CartaoSerieComEtapas.tsx:217`, botão fantasma).
   - A ação necessária para liberar "Concluir série" passa despercebida.
   - Botão secundário com borda, mesma altura dos campos.
   - **P3 · pequeno.**
   - Aceitação: "Não fiz" tem borda visível e alvo ≥ 44 px.
6. **Selo "AINDA NÃO REGISTRADO" repetido em cada série.** Observado.
   - Ruído; o estado vazio já se vê pelos campos.
   - Mostrar selo só nas séries registradas ("FEITA" / "NÃO FEITA").
   - **P3 · pequeno.**
   - Aceitação: série sem registro não tem selo.

#### Aluno › Dieta, Lista de compras, Mobilidade, Anamnese
**Finalidade:** consultar plano alimentar, lista, rotina de mobilidade e responder a anamnese.
**Preservar:** estados vazios que dizem de quem depende ("Seu treinador ainda não publicou a dieta.").
Só o estado vazio foi visto. Achados de código (P3): Mobilidade sem carregamento/erro (`app/aluno/mobilidade.tsx:43`); "Ver vídeo" abre link de forma diferente da Dieta (`mobilidade.tsx:89-91` × `dieta.tsx:202`). **Hipótese:** com dieta publicada a tela fica longa no celular; validar com uma dieta real.

#### Aluno › Atualização (`/aluno/atualizacao`)
**Finalidade:** enviar peso, fotos e respostas no fim do período.
**Preservar:** data de liberação clara ("Disponível a partir de 14/11/2026") e selo com contagem ("SUA ATUALIZAÇÃO É EM 12 DIAS").

1. **Palavra repetida.** Observado: cartão "Atualização" com campo "Atualização", na tela "Atualização".
   - Leitura confusa.
   - Título do cartão **"Seu envio"** e o campo com o nome do que pede.
   - **P3 · pequeno.**
   - Aceitação: a palavra "Atualização" aparece só no título da tela.
2. **Botão de remover foto com 28 px.** Hipótese (Código, `CampoFotos.tsx:173`). Validar com uma foto adicionada; se confirmado, vira P2 (uso com uma mão).

#### Aluno › Histórico (`/aluno/historico`)
**Preservar:** fotos agrupadas por data com Lista/Comparar; selo "REVISADA" nas atualizações.

1. **Link sublinhado dentro de cartão com borda.** Observado.
   - Dupla indicação de clique e área de toque ambígua (o cartão todo ou só o texto?).
   - Linha inteira tocável (`LinhaDaLista` com chevron), sem sublinhado.
   - **P3 · pequeno.**
   - Aceitação: tocar em qualquer ponto da linha abre a atualização.

#### Aluno › Conta (`/aluno/conta`)
**Preservar:** foto de perfil e dados agrupados.

1. **"E-mail do cadastro" e "E-mail de acesso" lado a lado.** Observado.
   - O aluno não sabe qual deles muda o login.
   - Mostrar só "E-mail de acesso" e, se o do cadastro for diferente, uma nota: "Seu treinador usa outro e-mail no seu cadastro."
   - **P3 · pequeno** · confirmar a regra no domínio.
   - Aceitação: a tela mostra um único e-mail como principal.

### C.2 Treinador

#### Treinador › Início (`/treinador`)
**Finalidade:** mostrar o que pede atenção hoje (atualizações, interessados, alunos sem registro, renovações).
**Preservar:** blocos por assunto com número e cor semântica (âmbar em "Sem registro há 7 dias 1" e "A renovar em 7 dias 1"); "Primeiros passos" com ação direta e "Já conferi".

1. **18 botões só de ícone nos blocos.** Observado (`treinador-1280/01`, `interacoes/inicio-pc-y600.png`): cada bloco tem abrir, atualizar e filtro.
   - O "filtro" de um painel não diz o que filtra; três ícones por bloco competem com o número.
   - No cabeçalho de cada bloco, só o link **"Ver todos ›"**; um único "Atualizar" no topo da página; filtro no ⋯ do bloco ou retirado.
   - **P2 · médio** · conversa com o item 5.6 de `docs/design-e-front.md` (painel em blocos).
   - Aceitação: cada bloco tem no máximo uma ação visível, com texto; o painel tem no máximo um botão "Atualizar".
2. **No celular, "Primeiros passos" ocupa a primeira tela.** Observado (`treinador-390/01`).
   - O painel não mostra nenhum número sem rolar.
   - No celular, recolher para uma linha: "Primeiros passos · 4 de 6 ›".
   - **P2 · pequeno.**
   - Aceitação: em 390×844 o primeiro bloco do painel aparece sem rolar.
3. **Números em lugares diferentes.** Observado: alguns à direita da linha ("Nos próximos 7 dias 0"), outros em caixa cinza.
   - Leitura mais lenta.
   - Um padrão só: rótulo à esquerda, número à direita, zero em cinza.
   - **P3 · pequeno.**
   - Aceitação: todos os blocos usam a mesma disposição rótulo/número.
4. **Bloco Agenda alto e vazio.** Observado.
   - Ocupa espaço sem informação.
   - Vazio em uma linha ("Nada na agenda nos próximos 7 dias.").
   - **P3 · pequeno.**
   - Aceitação: sem eventos, o bloco tem a altura de uma linha de texto.
5. **Rótulo de 11 px na rosca.** C9.
6. **Tablet (900 px): trilho de 14 ícones sem rótulo.** Observado (`treinador-900/01`, `interacoes/inicio-900.png`). Os nomes aparecem só com mouse em cima ou foco.
   - Em tablet de toque não existe "mouse em cima".
   - Rótulo curto abaixo do ícone (como na barra inferior) ou botão "Expandir menu".
   - **P2 · médio.**
   - Aceitação: em 900 px todo item do menu tem texto visível ou o menu tem botão para expandir.

#### Treinador › Alunos (`/treinador/alunos`)
**Finalidade:** achar um aluno e ver quem precisa de atenção.
**Preservar:** grupos por situação ("Em dia", "Sem pasta com período"), colunas Plano em uso / Atualização / Último registro / Responsável, paginação de 30, filtros em folha no celular.

1. **Dois alvos na mesma linha.** Observado: lápis "Editar cadastro de…" (40 px, C2) e a linha que abre a ficha.
   - No celular, toque errado entre os dois.
   - Tirar o lápis da linha (a edição está na ficha) e deixar um só alvo.
   - **P3 · pequeno.**
   - Aceitação: cada linha da lista tem um único alvo de toque.
2. **"Ver alunos" na folha de filtros.** Observado (`interacoes/alunos-filtros-cel.png`).
   - Não diz quantos vão aparecer e não há como limpar tudo de uma vez.
   - **"Ver 12 alunos"** (contagem real) e "Limpar filtros" secundário.
   - **P3 · pequeno.**
   - Aceitação: o botão mostra a contagem com os filtros atuais; "Limpar filtros" volta ao estado inicial.

#### Treinador › Novo aluno (`/treinador/alunos/novo`) e edição dos dados
**Finalidade:** cadastrar o aluno para depois convidar e montar o plano.
**Preservar:** largura de formulário (640 px), seções Cadastro / Dados pessoais / Acompanhamento, "(opcional)", nota de dado sensível, "Cadastrar" desabilitado com motivo.

1. **Sair perde o que foi digitado.** C7 (P1).
2. **Dois títulos de nível 1.** C1.
3. **Ajuda longa no campo de dias.** Código (`FormAluno.tsx:145`).
   - Três linhas de ajuda no celular para um campo opcional.
   - "Vazio usa o padrão da consultoria. Define o fim do período das novas pastas."
   - **P3 · pequeno.**
   - Aceitação: a ajuda cabe em duas linhas em 390 px.

#### Treinador › Ficha do aluno (`/treinador/alunos/[id]`)
**Finalidade:** ver a situação do aluno e chegar ao plano em uso (pasta) para editar ou renovar.
**Preservar:** resumo no topo (Pasta vigente, Atualização, Esta semana, Último registro) e "Próximo passo: Tudo em dia."; um cartão por assunto; ⋯ com as ações do aluno.

1. **Página longa, sem índice, dados cadastrais antes das pastas.** Observado (`interacoes/ficha-pc-y700…y3500.png`, `ficha-cel*.png`): 4.360 px no PC e 6.261 px no celular, 13 cartões em sequência (Dados do aluno, Pastas de plano, Frequência, Mobilidade, Água, Progresso por exercício, Peso, Avaliação física, Fotos, Evolução das respostas, Histórico de lesões, Anamnese, Boas-vindas). O comentário em `app/treinador/alunos/[id].tsx:52` registra que a ordem dados → pastas é proposital.
   - A tarefa mais frequente na ficha (abrir a pasta, editar ou renovar o plano) fica abaixo de um cartão de cadastro que quase não muda.
   - (a) **Pastas de plano logo abaixo do resumo**; (b) "Dados do aluno" recolhido numa linha que abre a edição; (c) índice de seções fixo no PC (âncoras: Plano, Treino, Corpo, Respostas) e "Ir para ▾" no celular.
   - **P2 · médio** · **já decidido** em `docs/planos/telas-do-aluno-visual.md`: D4 (atalhos das seções) e D5 (Resumo → Pastas → …), passo 2 ainda aberto. O comentário da linha 52 ficou desatualizado em relação a esse plano. Não abrir tarefa nova: este achado reforça a prioridade do passo 2.
   - Aceitação: em 1280×800 a lista de pastas aparece sem rolar; qualquer seção é alcançada com um clique a partir do topo.
2. **Cartão Água com sete linhas de "—".** Observado.
   - Ruído quando não há dado.
   - Vazio em uma linha ("Sem registro de água nesta semana.").
   - **P3 · pequeno.**
   - Aceitação: sem dado, o cartão tem uma linha de texto.
3. **`?aba=` não faz nada.** Observado: as nove variações deram a mesma tela.
   - Link antigo ou de notificação com `?aba=` não leva à seção.
   - Se o item 1(c) for feito, aceitar `?secao=pastas` como âncora; se não, ignorar este item.
   - **P3 · pequeno** · depende de 1(c).
   - Aceitação: `/treinador/alunos/<id>?secao=pastas` abre rolado na seção Pastas.
4. Trilha como segundo título (C1) e botões de 40 px (C2).

#### Treinador › Folha da pasta (sobre a ficha)
**Finalidade:** ver e editar os planos de um período (treinos, dieta, mobilidade, atualização do período).
**Preservar:** período no topo; "Ordem sugerida para renovar o ciclo"; seção "PLANOS DESTA PASTA" com "+ Novo treino".

1. **Ação terminal como principal e planos abaixo da dobra.** Observado (`interacoes/ficha-folha-pasta-pc.png`): "Finalizar pasta" é o botão primário, ao lado de "Editar" e "Copiar para outro período"; os treinos da pasta só aparecem rolando; o foco inicial também cai em "Finalizar pasta" (C3).
   - Finalizar por engano encerra o período do aluno; a tarefa diária (abrir o treino) exige rolar.
   - "Finalizar pasta" vira secundário, no fim da folha ou no ⋯ (com a confirmação que já existe); "PLANOS DESTA PASTA" sobe para logo abaixo do período. Perto do fim do período, destacar "Renovar".
   - **P2 · pequeno** · validar com o Saraiva (a ênfase atual pode ter sido decidida para o fluxo de renovação).
   - Aceitação: ao abrir a folha em 1280×800, a lista de treinos aparece sem rolar e nenhuma ação terminal é o botão primário.
2. **Título da folha é só o nome da pasta ("teste").** Observado.
   - Sem contexto de que é uma pasta e de qual aluno.
   - Título "Pasta teste" e subtítulo com aluno e período.
   - **P3 · pequeno.**
   - Aceitação: o título da folha identifica pasta, aluno e período.
3. Dois diálogos, foco inicial e retorno do foco: C3.

#### Treinador › Atualizações (`/treinador/atualizacoes`) e detalhe (`/[id]`)
**Finalidade:** revisar o que os alunos enviaram e dar retorno.
**Preservar:** três abas por situação; estado vazio claro.

1. Abas cortadas no celular: C5. Lista e "Próxima ›" carregam tudo: C8 (Código).
2. **Detalhe da atualização:** só Código. Retorno silencioso em `atualizacoes/[id].tsx:99` (ver A.4). **Hipótese:** com muitas fotos e respostas, a revisão fica longa; validar com uma atualização real antes de propor mudança de leiaute.

#### Treinador › Agenda (`/treinador/agenda`)
**Finalidade:** ver e marcar compromissos.
**Preservar:** visões Dia/Semana/Mês/Ano; modo lista no celular; "Agendas e filtros" em folha.

1. **"Hoje" desabilitado com a ajuda "Hoje já está na tela."** **Resolvido depois da auditoria:** saiu com a agenda no estilo Google. Observado.
   - Um botão desligado que explica que não é necessário.
   - "Hoje" sempre ativo; quando o período já contém hoje, sem efeito e sem ajuda.
   - **P3 · pequeno.**
   - Aceitação: "Hoje" nunca aparece desabilitado.
2. **Setas e "Nova agenda" com 40 px.** C2.
3. **No celular, "Hoje" e as setas desalinhados.** Observado (`treinador-390`, agenda).
   - Aparência de erro.
   - Mesma linha de base e mesma altura (44 px).
   - **P3 · pequeno.**
   - Aceitação: em 390 px os três controles têm o mesmo topo e a mesma altura.

*Sugestão adicional:* no PC, "Nada neste período." e a grade vazia embaixo dizem a mesma coisa; a grade pode ser mais baixa quando vazia.

#### Treinador › Interessados (`/treinador/interessados`)
**Finalidade:** receber inscrições e transformar em aluno.
**Preservar:** cartão do link com estado ("RECEBENDO INSCRIÇÕES"), "Copiar link", "Configurar"; abas Lista/Kanban/Indicadores; "Respostas prontas".

1. **Kanban anima sem respeitar movimento reduzido.** Código (`QuadroKanban.tsx:210,225`).
   - Desconforto para quem desliga animações no sistema.
   - Usar `useMovimentoReduzido` como o resto do app.
   - **P3 · pequeno.**
   - Aceitação: com "reduzir movimento" ligado, mover um cartão não anima.

#### Treinador › Biblioteca (`/treinador/biblioteca`)
**Finalidade:** cadastrar exercícios, alimentos e suplementos usados nos planos.
**Preservar:** abas por tipo; "Novo exercício" como primário.

1. **Lista inteira na tela.** C8.
2. **Duas entradas de importação com nomes parecidos.** Observado: link "Importar planilha" acima das abas e aba "Importar do catálogo".
   - O treinador não sabe qual usar.
   - **"Importar da sua planilha"** (leva à Importação) e **"Copiar do catálogo pronto"** (aba).
   - **P2 · pequeno.**
   - Aceitação: os dois rótulos dizem de onde vêm os itens.
3. **Mesmo ícone genérico em todas as linhas.** Observado.
   - Não diferencia nada e ocupa largura.
   - Retirar.
   - **P3 · pequeno.**
   - Aceitação: a linha começa pelo nome do exercício.

#### Treinador › Planejamento (`/treinador/planejamento`)
**Finalidade:** guardar modelos (semanas, dias, receitas de séries, metodologias, dietas, pacotes, questionários) para aplicar aos alunos.
**Preservar:** "Aplicar ao aluno" direto na linha do modelo; coleções; busca.

1. **Metodologias no segundo nível.** Observado: 7 abas + 4 chips na aba Treino; Metodologias é um chip, mas "Primeiros passos" no Início manda "Conferir a metodologia".
   - Achar Metodologias por conta própria exige saber que fica em Treino › chips.
   - Garantir que "Abrir Metodologias" do Início abre direto no chip certo; avaliar Metodologias como aba própria.
   - **P2 · pequeno** · **Hipótese** sobre a frequência de uso (validar com o Saraiva).
   - Aceitação: "Abrir Metodologias" no Início abre o Planejamento com Metodologias selecionado.
2. 8 botões ⋯ com 40 px (C2); abas cortadas no celular (C5).

#### Treinador › Editor de modelo (`/treinador/planejamento/modelo/[id]`) e editores de plano
**Finalidade:** montar semanas de treino com sessões e exercícios.
**Preservar:** ações fixas no topo ("Aplicar ao aluno", "Salvar modelo" primário), selo "SALVO", "N problemas para publicar · ir ao primeiro", sessões em chips com "+ Sessão", guarda de saída.

1. **"Salvar como dia de treino" parece texto.** Observado (`interacoes/editor-modelo-pc-y700.png`).
   - Ação útil passa despercebida.
   - Botão secundário com borda.
   - **P3 · pequeno.**
   - Aceitação: o controle tem borda e altura de botão.
2. **"Adicionar exercício" no extremo direito.** Observado: na linha "Adicionar próximo exercício", o botão principal vem depois de "Modelos prontos" e "Criar grupo" (desabilitado).
   - No PC largo o olho não chega lá.
   - "Adicionar exercício" primeiro, à esquerda.
   - **P3 · pequeno.**
   - Aceitação: na linha de adição, o primeiro controle é "Adicionar exercício".
3. **"Remover sessão" em texto vermelho solto.** Observado.
   - Ação destrutiva sem separação das demais.
   - Levar para o ⋯ da sessão, mantendo a confirmação.
   - **P3 · pequeno.**
   - Aceitação: nenhum controle destrutivo fica solto no corpo do cartão da sessão.
4. Dois títulos de nível 1 (C1). Editores de treino, dieta e mobilidade do aluno e de questionário: **só Código**, não abertos com dado real. O de dieta remove itens com "Desfazer" em vez de confirmação (`EditorDeDieta.tsx:215,253,302`): padrão aceitável, sem ação.

#### Treinador › Importação (`/treinador/importacao`, `/nova`, `/planilha-completa`)
**Finalidade:** trazer alunos, pesos e catálogo de planilhas.
**Preservar:** etapas numeradas, blocos de destino, "Continuar" desabilitado com motivo.

1. **Aviso "Nada é gravado…" repetido na etapa 1.** Observado (`interacoes/importacao-nova-pc.png`).
   - Ruído.
   - Uma vez só, perto de "Continuar".
   - **P3 · pequeno.**
   - Aceitação: o aviso aparece uma vez por etapa.

Etapas 2–5: só Código.

#### Treinador › Financeiro (`/treinador/financeiro`)
Administrador vê "Sem acesso": C4. O item está escondido no menu, mas a rota abre por link direto (se a busca de telas também a lista não foi conferido), então a mensagem precisa estar certa.

#### Treinador › Perfil (celular, `/treinador/perfil`) e Minha conta
**Preservar:** "Buscar telas"; "Sair" separado e em vermelho.

1. **"Minha conta" e "Meus dados" lado a lado.** Observado (`interacoes/perfil-cel.png`).
   - Nomes quase iguais para coisas diferentes (assinatura do app × dados pessoais).
   - Renomear "Minha conta" para **"Assinatura e faturas"**.
   - **P2 · pequeno.**
   - Aceitação: no Perfil, nenhum par de itens tem nomes sinônimos.
2. **"Central de contratação" em Minha conta.** Código.
   - Jargão interno.
   - "Para mudar de plano, fale com a gente pelo WhatsApp." (ou o canal real).
   - **P3 · pequeno.**
   - Aceitação: o texto não usa "central de contratação".

#### Treinador › Equipe, Números, Auditoria, Marca, Meus dados, Segurança, Ajustes, Ajuda, Termos
Visitadas em 390 e 1280: um título de nível 1, sem rolagem horizontal, sem elemento sem nome; alvos pequenos só os de C2. Não inspecionadas em profundidade (ver Limitações). Erros silenciados em Auditoria e Perfil: A.4, "Outros achados de código".

#### Treinador › Endereços inválidos
Aluno inexistente ("Aluno não encontrado.") e plano com id inválido ("Não encontramos o que você procura. Confira o endereço ou volte à lista."). Observado. Bom texto; falta o botão.
- Recomendação: botão **"Voltar à lista"**. **P3 · pequeno.**
- Aceitação: as duas telas têm um botão que leva à lista correspondente.

### C.3 Públicas

#### Entrar (`/entrar`)
**Preservar:** marca no topo, cartão simples, mostrar senha com foco visível, links de ajuda.
1. Erro só no topo: C6.

#### Criar conta, Esqueci a senha, Redefinir senha, Convite, Convite de equipe
1. Validação só no topo: C6 (Código).
2. **Redefinir sem token** mostra "Link inválido ou vencido" sem ação. Observado.
   - O usuário precisa adivinhar o caminho.
   - Botão **"Pedir um link novo"** (abre `/esqueci-senha`).
   - **P3 · pequeno.**
   - Aceitação: a tela de link inválido leva à recuperação com um toque.

#### Inscrição (`/inscricao/[codigo]`)
**Preservar:** tudo o que está em A.2; escolhas em chips com "Não informar" pré-selecionado; "Não precisa criar conta."

1. **Mensagem duplicada no link inválido.** Observado: "Link de inscrição inválido ou encerrado. Peça o link atual à consultoria." e, logo abaixo, "Confira o link com a consultoria. Já é aluno? Entre no app."
   - A mesma ideia duas vezes.
   - Título "Este link de inscrição não está ativo" e texto "Peça o link atual à consultoria. Já é aluno? **Entrar no app**".
   - **P3 · pequeno.**
   - Aceitação: a orientação aparece uma vez.

*Sugestão adicional:* o formulário tem 2.034 px no celular, com quatro grupos de chips opcionais. Mover os opcionais para depois do envio ("Quer contar mais?") encurta a captação; afeta a qualidade do contato, então validar com o Saraiva.

#### Montador (`/montador`)
"Página não encontrada" (não liberado neste build). Achados de código em A.4.

---

## D. Fluxos entre telas

### D.1 Aluno registra o treino do dia (o fluxo mais importante do app)
**Percurso visto:** Início → Treino (aba) → divisão → Sessão → "Começar treino" → Exercício → séries → fim da tela → "Concluir treino" → volta à sessão. Três toques até a primeira série: bom.
**Problemas no caminho:**
- Em dia de descanso, o Início não leva a lugar nenhum (C.1, Início, item 1). Observado.
- Na Sessão, a escolha de data vem antes do botão de começar (C.1, Sessão, item 1). Observado.
- No exercício, a ordem dos campos muda no Cluster (P1) e o "Concluir treino" no fim não conclui (P1). Observado + Código.
- Passar ao próximo exercício: o botão "Lista do dia"/próximo só aparece quando há próximo ou com a chave de retorno ligada (comentário em `[exercicio].tsx:192`). Com a chave desligada e no último exercício, o aluno só tem o "Concluir treino" que volta. Código + Observado.
**Sequência recomendada:** Início ("Hoje" com "Começar treino" ou, no descanso, "Treinar mesmo assim") → Sessão (começar no topo) → Exercício (kg, reps, ✓ sempre) → "Próximo exercício ›" → no último: "Concluir treino" real (chave ligada, com confirmação se faltar série) ou "Voltar à lista do dia" (chave desligada).
**Abandono provável:** no fim do treino, por não saber se salvou. O selo "SINCRONIZADO" ajuda, mas fica longe do botão.

### D.2 Primeiro acesso do aluno
**Percurso:** convite → definir senha → termos → passeio (6 passos) → Início. Visto só o passeio (os termos já estavam aceitos e o convite não foi gerado para não disparar e-mail). O passeio tem "Pular", "Anterior" e "Próximo" e mostra "1 de 6". Sem problema observado além de cobrir o selo de sincronização (C.1, Início, item 2). **Hipótese:** 6 passos antes do primeiro treino é muito para quem está na academia; validar com um aluno real.

### D.3 Treinador monta ou ajusta o plano de um aluno
**Percurso visto:** Alunos → linha do aluno → Ficha → rolar até "Pastas de plano" (abaixo de "Dados do aluno") → abrir a pasta (folha) → rolar até "PLANOS DESTA PASTA" → treino → editor → salvar/publicar. Caminho alternativo: Planejamento → modelo → "Aplicar ao aluno".
**Problemas:** duas rolagens obrigatórias antes de chegar ao plano (ficha e folha), e a única ação primária no caminho é "Finalizar pasta". Observado.
**Sequência recomendada:** Ficha com Pastas logo abaixo do resumo (já decidido, `telas-do-aluno-visual.md` D5) → folha com os planos no topo e "Finalizar" fora do destaque → editor. Resultado: da lista de alunos ao editor em 3 cliques sem rolar.
**Falta de feedback:** depois de "Aplicar ao aluno" no Planejamento, para onde o app leva e o que confirma não foi verificado (não se gravou nada). Hipótese a validar.

### D.4 Treinador cadastra um aluno
**Percurso:** Início ("Novo aluno") ou Alunos ("Novo aluno") → formulário → "Cadastrar" → (destino não verificado, não se gravou). Duas portas de entrada para a mesma tarefa: bom.
**Problema:** sair no meio perde tudo (C7, P1). Código.

### D.5 Treinador revisa atualizações
**Percurso (Código):** Início (bloco Atualizações) ou menu → Atualizações → "Para revisar" → detalhe → retorno → "Próxima ›". Não havia atualização para revisar no ambiente local.
**Riscos:** lista e "Próxima ›" carregam tudo (C8); no celular as abas aparecem cortadas (C5, Observado); erro silencioso no detalhe (`atualizacoes/[id].tsx:99`). A sequência "revisar e ir para a próxima" é boa e deve ser preservada.

### D.6 Captação: link de inscrição → interessado → aluno
**Percurso visto:** Interessados → "Copiar link" → (visitante) inscrição → envio vazio barrado com erro por campo. Envio real e "aceitar interessado" não feitos (criariam dados).
**Bom:** link e estado ("RECEBENDO INSCRIÇÕES") no topo da tela de Interessados; o formulário público explica que não precisa criar conta.
**Problemas:** formulário de 2.034 px no celular (sugestão adicional em C.3); link inválido com texto duplicado (P3).

### D.7 Importação de planilha
**Percurso:** Biblioteca ("Importar planilha") ou menu → Importação → "Nova" → 5 etapas. Visto até a etapa 1.
**Problemas:** duas portas com nomes que se confundem com "Importar do catálogo" (C.2, Biblioteca, item 2); aviso repetido na etapa 1 (P3). As etapas 2–5 não foram vistas.

### D.8 Recuperação de senha e convites
**Percurso:** Entrar → "Esqueci minha senha" → e-mail → link → Redefinir → Entrar. Visto: entrar, esqueci (sem enviar) e redefinir **sem** token.
**Problemas:** erro só no topo nos formulários (C6); link vencido sem caminho de volta ("Pedir um link novo", P3).

### D.9 Tela bloqueada
Administrador que abre Financeiro com pagamentos desligados vê "Peça a um administrador" (C4). Membro sem permissão: mesma tela, texto correto (Código).

---

## E. Plano de execução

### E.1 Antes de abrir tarefas: o que já está planejado

Estes achados **já têm decisão** em `docs/planos/`. Não duplicar no backlog; anexar a evidência deste relatório ao passo existente.

| Achado | Plano e passo | O que acrescentar ao passo |
| --- | --- | --- |
| Ficha longa, Pastas abaixo de Dados, sem índice | `telas-do-aluno-visual.md` passo 2 (D4, D5) | Critério de aceitação de C.2 Ficha, item 1; atualizar o comentário de `alunos/[id].tsx:52`. |
| Guarda de saída no cadastro (C7) | `telas-do-aluno-visual.md` passo 3 (D7) | Incluir `useGuardaDeSaida` no `FormAluno`. |
| Texto "WS" / "% da WS" para o aluno | `editor-de-series-rir-e-carga-fixa.md` passo 4 (D8) | Incluir o texto do cartão de carga de trabalho do aluno. |
| Cluster com ordem de campos invertida | `cores-por-tipo-de-serie.md` passo 4 | Só se esse passo for feito logo; senão, corrigir antes (quick win 1). |
| Painel do Início | `atualizacao-visual-app-full.md` passo 8 (feito) e `design-e-front.md` 5.6 | Os itens de C.2 Início entram como ajuste do painel novo, não como redesenho. |

### E.2 Quick wins (pequenos, alto retorno, sem decisão de produto)

Ordem sugerida. Entre parênteses, o executor conforme as regras do repositório.

1. **Ordem kg → reps → ✓ no Cluster** (P1) — resolvido depois da auditoria (Frente G, D12) — `CartaoSerieComEtapas.tsx` (Sonnet).
2. **"Concluir treino" com a chave desligada vira "Voltar à lista do dia" secundário** (P1) — `[exercicio].tsx:183` (Sonnet).
3. **C7 guarda de saída no `FormAluno`** (P1) — se o passo 3 de `telas-do-aluno-visual.md` não for agora (Sonnet).
4. **C1 trilha sem papel de título** (P2) — `Cabecalho.tsx:73` (Sonnet).
5. **C2 `IconeBotao` com moldura em 44 px** (P2) — `IconeBotao.tsx:45`; conferir capturas do editor e da ficha depois (Sonnet).
6. **C4 tela de módulo desligado** (P2) — `Estados.tsx`, `Permitido.tsx` (Sonnet).
7. **C6 erro por campo nas telas públicas** (P2) — 5 telas, mesmo padrão da inscrição (executor-rapido, copiando `inscricao/[codigo].tsx`).
8. **C5 degradê nas abas** (P2) — peça de abas, copiar o da faixa de chips (Sonnet).
9. **C9 rosca em 12 px** (P3) — uma linha (Sonnet).
10. **Textos** (P2/P3) — executor-rapido, um lote só:
    - Início do aluno: "Treinar mesmo assim";
    - Sessão inexistente: "Ver meu treino";
    - Biblioteca: "Importar da sua planilha" / "Copiar do catálogo pronto";
    - Perfil: "Minha conta" → "Assinatura e faturas";
    - Redefinir senha: "Pedir um link novo";
    - Inscrição inválida: título e texto únicos;
    - Endereço inválido: "Voltar à lista";
    - Atualização do aluno: "Seu envio".

### E.3 Correções compartilhadas de médio porte

- **C3 Folha** (foco inicial, retorno do foco, um só diálogo) — afeta todas as folhas; e2e de teclado em uma folha (Sonnet; advisor revisa por ser peça usada em todo o app).
- **C8 paginação** na Biblioteca e em Atualizações — mexe em consulta da API (executor).
- **C10 passeio guardado no servidor** — novo campo no perfil (executor; migration).
- Erros engolidos (A.4) — um lote com `MensagemErro` + "Tentar de novo" (Sonnet).

### E.4 Ajustes estruturais por tela (depois dos quick wins; validar com o Saraiva os marcados com *)

1. Ficha do aluno — já planejado (E.1).
2. Folha da pasta* — planos no topo, "Finalizar" fora do destaque (executor-front).
3. Sessão do aluno — "Começar treino" acima de "Outras datas" (Sonnet).
4. Início do treinador — ações dos blocos ("Ver todos ›"), "Primeiros passos" recolhido no celular (executor-front).
5. Menu em trilho no tablet — rótulos ou expandir (executor-front).
6. Editor de modelo — ordem da linha de adição, "Remover sessão" no ⋯, "Salvar como dia de treino" com borda (Sonnet).
7. Exercício do aluno — rótulos em vídeo/cronômetro, "Não fiz" com borda, selos só nas séries registradas (executor-front, junto do passo 4 de `cores-por-tipo-de-serie.md`).

### E.5 Novas funcionalidades (não são correções; decidir antes)

- Cartão "Próximo treino" no Início do aluno em dia de descanso.
- Metodologias como aba própria no Planejamento*.
- Inscrição em duas partes (obrigatórios antes, opcionais depois)*.
- `?secao=` na ficha como âncora (só se o índice de seções for feito).

### E.6 Validações pendentes (Hipóteses que viram tarefa só se confirmadas)

- Botão de remover foto com 28 px (`CampoFotos.tsx:173`).
- Telas em branco no Treino e na Mobilidade enquanto o pacote não chega.
- Detalhe de atualização longo com muitas fotos.
- Temas claro areia e contraste alto (cores fixas em `Folha.tsx:161` e `Botao.tsx:42`).
- Passeio de 6 passos no primeiro acesso do aluno.

---

## Limitações da análise

- **Ambiente:** local, commit `875934b3`, imagem web construída pouco antes da auditoria (presumida igual ao commit). Nada foi visto em produção nem em aparelho físico: o "celular" é o Chromium em 390×844 com toque emulado. Gestos nativos, teclado do celular, vibração, área segura do iPhone e desempenho real não foram avaliados.
- **Chaves de recurso:** `TREINOS_RETORNO_HABILITADO` (conclusão do treino, recordes, "Bom trabalho!") e `TREINOS_PAGAMENTOS_HABILITADO` (financeiro) estavam desligadas no ambiente local. O fluxo real de conclusão do treino e o financeiro não foram vistos; o P1 do "Concluir treino" vale onde a chave de retorno estiver desligada. Como está no piloto não foi conferido.
- **Uma consultoria só, um perfil de equipe só:** SARAIVA TEAM (tema escuro) e Administrador. Variações por permissão foram lidas no código, não vistas. Temas claro areia e contraste alto não foram vistos.
- **Sem gravar dados:** nada foi salvo, enviado ou finalizado. Por isso não foram vistos: tela de treino concluído, envio de atualização, revisão de atualização, aceitar interessado, etapas 2–5 da importação, destino depois de cadastrar aluno e de aplicar modelo, convites válidos.
- **Dados de demonstração escassos:** dieta, lista de compras, mobilidade, anamnese e agenda só no estado vazio; nenhuma atualização para revisar; financeiro desligado.
- **Limite de tentativas de login:** logins repetidos dos scripts deram 429/401. A execução do treinador em 900 px ficou sem a ficha e a do aluno em 1280 px mostrou um erro de dieta que, reconferido, era efeito do bloqueio (a API respondeu 200). Esses dois resultados foram descartados ou refeitos.
- **Medidas de tempo** dos scripts não servem como medida de desempenho (incluem esperas fixas); nenhum achado de desempenho foi baseado nelas. O tamanho do bundle web e a falta de divisão por rota já estão registrados em `docs/design-e-front.md` seção 6 e não foram remedidos.
- **Leitores de tela reais** (NVDA, TalkBack, VoiceOver) não foram usados; a acessibilidade foi medida pela árvore do DOM (papéis, nomes, `aria-invalid`, foco).
- **Contraste** não foi medido cor a cor; nada pareceu abaixo do esperado nas capturas, mas isso não substitui a medição (o repositório tem teste de contraste em `tema/tokens.test.ts`).
- **Capturas:** ficaram fora do repositório, na pasta temporária da sessão (`scratchpad/auditoria/saida/`), e podem ser apagadas pelo sistema. Contêm dados de demonstração; não foram copiadas para `docs/`.
