# Roteiro de teste local do lote de 13/11

Situação: Para testar (Gustavo, à mão) · Onde: `main`, publicado (`e4adc9af`, 13/11/2026) · Atualizado: 15/11/2026

## Objetivo
Conferir na tela, antes do push, o que o lote mudou: capas, reações, enquetes e player da Comunidade; Financeiro (nulo, zero e ressalva); cores de destaque; filtros laterais; Início editável. Só dados fictícios da demonstração: nenhum aluno real, nenhuma planilha, nenhum print do Saraiva.

## Matriz (enxuta)
- **Padrão de cada item:** tema **claro** em **1280** (PC) e tema **escuro** em **390** (celular).
- **Areia:** só no **Início** e no **Financeiro**, em 1280.
- Linha com outra largura ou tema diz isso no próprio item. "Falha" = anote item, tema, largura e o que viu (sem print com dado real).

## Antes de começar
Estado real do ambiente local em 13/11: imagens reconstruídas, API saudável, Flyway na versão 73 com a V072 e a V073 aplicadas.
- [ ] **Chaves no `.env` local** (só nome = valor; conferidas no contêiner e no `GET /eu`):
  - `TREINOS_PAGAMENTOS_HABILITADO=true`: Financeiro, filtros de Cobranças e Lançamentos, bloco do Início e cartão da ficha.
  - `TREINOS_RETORNO_HABILITADO=true`: recordes, "Bom trabalho!", mapa de treinos e "Visto pelo treinador".
  - `TREINOS_UNIDADE_CARGA_HABILITADA=true`: **libras** em Preferências (aluno e treinador); a carga mostra a unidade escolhida e volta igual. Olhar de passagem, sem bloco próprio.
  - `TREINOS_EMAIL_HABILITADO=true` com `TREINOS_EMAIL_PROVEDOR=log` (nada sai de verdade: o provedor só registra o envio): valem os **lembretes de cobrança por e-mail** (Financeiro › aba Lembretes; "Receber lembretes" no cartão "Meu plano" do aluno) e "Esqueci a senha". O remetente local é fictício (`TREINOS_EMAIL_REMETENTE`): o módulo de e-mail não sobe sem ele.
  - `TREINOS_MIGRACAO_ASSISTIDA_HABILITADA=true`: a importação assistida fica visível; a IA segue desligada (`TREINOS_IA_ENVIAR_DADOS_AO_PROVEDOR` fora), então nada vai a provedor externo.
  - `TREINOS_FOTOS_HABILITADO=true` (perfis `demo,fotos`, como antes).
  - **`TREINOS_CICLO_HABILITADO=false` de propósito:** o ciclo menstrual fica **fora deste teste (ciclo desligado)**. Nenhum bloco abaixo depende dele.
  - Continuam desligadas: Turnstile, InfinitePay, integração com a Central, MFA, push, IA da importação e `TREINOS_PLANO_APLICAR`.
- [ ] Entrar com o **treinador demo** `saraiva@demo.local` (consultoria "SARAIVA TEAM" local, **sem** a ressalva financeira) e com o **aluno demo** `aluno@demo.local`. A senha vem do `DEMO_SENHA` do seu `.env`. Trocar o tema em Preferências.
- [ ] Para o item "Ressalva ligada" do bloco 5, entrar com `exemplo@demo.local` ("Consultoria Exemplo"): `historico_financeiro_parcial` já está `true` **só no banco local** dela.
- [ ] Ter à mão: uma imagem JPEG fictícia (qualquer foto sem pessoa) e um link público qualquer do YouTube.

## 1. Capas dos vídeos (equipe cria, aluno vê)
- [ ] Nova publicação **Vídeo** com link do YouTube **sem capa**: sai o quadro neutro, e o aluno vê "Assistir aqui".
- [ ] Mesma publicação **com capa** (JPEG fictício): a capa aparece na equipe e no aluno. Imagem grande é reduzida ou recusada com mensagem (nunca erro genérico).
- [ ] **Aulão** novo e aulão editado com capa: a capa aparece na lista do aluno e nas coleções por categoria.
- [ ] Link que **não** é do YouTube: mostra a capa e só o "Abrir vídeo" (abre fora do app, sem player).
- [ ] Capa só enviada e **não** salva no post: o aluno não a vê.
- [ ] Excluir o post: a capa some junto.

## 2. Player do YouTube
- [ ] Antes do toque aparece a nossa capa; o player **não** monta sozinho.
- [ ] "Assistir aqui": o vídeo toca dentro da página (endereço `youtube-nocookie.com`). Console do navegador sem erro de CSP (`frame-src`).
- [ ] "Abrir no YouTube" abre `youtube.com/watch?v=<id>` em outra aba.
- [ ] Voltar à lista e abrir **outro** vídeo: volta à capa, o player só monta com novo toque.
- [ ] Em 390 o player cabe na largura, sem rolagem horizontal.

## 3. Reações
- [ ] Aluno: as cinco reações aparecem (coração, força, fogo, palmas, riso); mais de uma no mesmo post; tocar de novo remove.
- [ ] "Você reagiu" se vê por **contorno e marca**, não só por cor, nos dois temas.
- [ ] Recarregar a página mantém as reações e as contagens.
- [ ] Equipe com moderação reage (só contagem, sem nomes); equipe sem moderação não vê o botão de reagir.

## 4. Enquetes
- [ ] Equipe cria enquete: pergunta, 2 a 6 opções (1 a 80 caracteres), uma ou várias respostas, "encerra em" opcional. Aparece o aviso **"O voto é identificado: não pergunte sobre saúde, lesão, peso ou dieta."**
- [ ] O aluno **não** consegue criar enquete (o tipo não aparece).
- [ ] Aluno vê o aviso de voto identificado **antes** de votar; vota, muda o voto; em "várias respostas" marca mais de uma.
- [ ] Barras, contagem de votos, mini-fotos (iniciais quando não há foto) e "minhas opções" marcadas com texto e contorno.
- [ ] "Mostrar votos": painel à direita em 1280; folha em 390. Mostra a pergunta, as opções e quem votou; nada de dado de saúde.
- [ ] Enquete **encerrada**: não aceita voto, resultado continua visível.
- [ ] Cores da enquete (azul, ciano, violeta): nunca verde ou vermelho como "certo e errado".
- [ ] Ocultar a enquete (moderação): some para o aluno.

## 5. Financeiro: nulo, zero e ressalva (`TREINOS_PAGAMENTOS_HABILITADO=true`)
Claro 1280 e escuro 390; **areia 1280 também**.
- [ ] Visão geral: a frase "Os valores consideram os registros disponíveis no sistema." aparece **uma vez** na Visão geral e uma vez em Lançamentos.
- [ ] **Zero de verdade** mostra "R$ 0" e o traço, **sem barra**; **sem dado** mostra "—" e nenhuma barra. "Resultado" fica "—" se faltar entrada ou saída.
- [ ] Sem a ressalva (consultoria demo normal): nenhum aviso de histórico parcial em nenhuma aba.
- [ ] **Ressalva ligada** (com `exemplo@demo.local`: `historico_financeiro_parcial` já está ligado só no banco **local** da "Consultoria Exemplo"; a V073 só liga a do Saraiva real, então a SARAIVA TEAM local não a mostra): o texto "Parte do histórico financeiro foi removida em uma limpeza anterior…" aparece em **todas as abas** do Financeiro.
- [ ] Exportar: a folha explica a coluna `historico_financeiro_parcial` (só com a ressalva ligada). O CSV baixado tem 11 colunas, a última `historico_financeiro_parcial` (`true` ou `false` em todas as linhas), e nenhuma frase dentro do arquivo.
- [ ] Desligar a chave e reabrir: a tela diz **"Recurso desativado"**, sem alerta vermelho e sem "Tentar de novo".

## 6. Cores de destaque
Cor é **sinal** (marca, situação, categoria); seleção e números neutros ficam neutros. Confira contraste do número destacado.
- [ ] **Início**: cartões mini e "próximo passo". Também em **areia** (1280).
- [ ] **Interessados**: indicadores por situação.
- [ ] **Financeiro** (Visão geral): recebido, em atraso e resultado. Também em **areia** (1280).
- [ ] **Resumo do aluno** (ficha): destaques do questionário e do peso.
- [ ] **Lista de alunos**: selo de situação; linha selecionada neutra.
- [ ] **Pastas**: status Ativa e Concluída.
- [ ] **P/C/G da dieta** (proteína, carboidrato, gordura): três cores distinguíveis; totais legíveis.
- [ ] **Tipos de série** (editor de treino e tela do aluno): cada tipo com cor e rótulo em texto.
- [ ] **Recordes** (`TREINOS_RETORNO_HABILITADO=true`): recordes da semana (ficha e Início) e medalha no aluno.
- [ ] **Gráfico da medida** (Avaliação física › Evolução por medida): linha e ponto visíveis; uma data só aparece como ponto.
- [ ] **"Hoje" na Agenda**: marca do dia atual visível e que não se confunde com seleção.

## 7. Filtros laterais
Em 1280 o painel abre **à direita**; em 390 abre **como folha**. Em cada lista: abrir, aplicar, limpar, fechar, contador de filtros ativos.
- [ ] Lista de alunos.
- [ ] Financeiro: Cobranças e Lançamentos (o painel não atrapalha a leitura do cartão).
- [ ] Interessados, Atualizações, Auditoria (o número da lista bate com o dos filtros).
- [ ] Comunidade (mural: tipo e "Só denunciadas" combinam).
- [ ] Ficha do aluno e Histórico (o filtro de uma aba não vaza para outra).
- [ ] Biblioteca (alimentos, exercícios, suplementos, outros).

## 8. Início editável
Em 1280: claro e **areia**; em 390: escuro. A edição é feita **na própria grade** (não é mais uma folha).
- [ ] **Editar** liga o modo de edição. Fica **desabilitado** só sem alunos ("O painel aparece quando houver alunos."); sem internet continua liberado (mudança de 15/11, ainda sem commit).
- [ ] Cada bloco mostra faixa do título, **tamanho**, **Subir** e **Descer** ("Já é o primeiro." e "Já é o último." nas pontas) e o interruptor **"Aparece no Início"**.
- [ ] **Arrastar** (1280): segurar a faixa do título (cerca de 0,25 s) e soltar no outro cartão troca a ordem. Em 390 na web, com uma coluna, **não há arraste**: só Subir e Descer.
- [ ] Ocultar um bloco o manda para a bandeja dos ocultos; **Adicionar** o traz de volta.
- [ ] **Restaurar padrão** volta tamanho, ordem e ocultos ao de fábrica, mas só no rascunho (nada grava até o Salvar).
- [ ] **Cancelar** descarta tudo e volta ao que estava salvo.
- [ ] **Salvar** grava; **recarregar a página** mantém tamanho, ordem e ocultos. A preferência é **só deste aparelho**: outro navegador ou perfil começa no padrão.
- [ ] O bloco "Primeiros passos" (quando aberto) fica fora do Editar.

## Ao terminar
- [ ] Falhas anotadas (item, tema, largura, o que viu) e passadas para a sessão, sem dado real.
- [ ] Só depois disso o Gustavo decide o push do lote.
