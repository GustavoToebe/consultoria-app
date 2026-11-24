# Relatório da noite de 24/11/2026

Projeto consultoria-app. Para o Gustavo revisar; este arquivo fica fora do git (cópia versionada em `docs/planos/ficha-24-11.md`). Fontes: relatórios dos itens em
`capturas\24-11\item-*-relatorio.md` e `capturas\24-11\tela-larga\*-relatorio.md`, planos em `docs/planos/` das duas worktrees e
`git log` das duas branches. O que a fonte não diz está como "não registrado". 

Branches e worktrees (sem push, sem merge na `main` nesta noite):
- `ficha-24-11` em `.claude\worktrees\ficha-24-11` (itens 1 a 6, base `82202480`).
- `tela-larga-revisao` em `.claude\worktrees\tela-larga-24-11` (varredura de tela larga; contém a `ficha-24-11` por merge `bc12d415`, mais a varredura das abas da ficha).

---

## 0. Resumo

1. Os 3 commits de antes da noite (`25dd0fa9`, `529bbceb`, `28d3e1a5`) e o commit de docs `82202480` foram publicados juntos; run `45321495418` concluído com sucesso (a sessão principal confirma).
2. Ficha (`ficha-24-11`): 8 commits locais cobrem os itens 1, 2, 2b, 3, 4, 5, 6 e 6b, mais docs e os ajustes da revisão independente (`9db0bfc6`).
3. Peça nova `ui/ListaDeDados` (item 4) sustenta Dados do aluno, Plano contratado, Conta › Meus dados e o Acesso ao app (item 5); as duas colunas independentes 3:2 (item 1) dependem dela e foram para o mesmo commit.
4. `ui/Tabela` ganhou `tingida` (item 3); o Histórico de lesões usa a peça, com a folha Registrar/Editar nova (item 6) e colunas "O que é" e "Cuidados no treino" (6b).
5. O Resumo da ficha virou três `CartaoDeIndicador` (item 2); a auditoria 2b não restaurou nenhuma cor, mas a conclusão depende de uma premissa que só o Gustavo decide (seção 9).
6. Revisão independente da ficha: 7 correções entraram no `9db0bfc6`; 7 pontos foram descartados ou ficaram para o Gustavo (seção 5).
7. Tela larga (`tela-larga-revisao`): 6 commits de grupos de telas (Início/Alunos/Atualizações/Números; Agenda/Vídeos/Vitrine; Biblioteca/Planejamento; Interessados/Financeiro/Importação; Configurações/Equipe/WhatsApp/Ajustes/Ajuda; app do aluno). A base 7a já estava no `origin/main`.
8. Ficam ❌ ou ⚠ nas larguras 2560/3440: Mural, Vitrine, Interessados Lista e Kanban, Histórico da importação, Auditoria, Números (3440), Alunos com um grupo só. Todos pedem decisão de produto (painel ao lado ou outro arranjo).
9. Varredura das abas da ficha em tela larga (`e1fbc1f0`), revisão independente da tela larga e rodada final de verificação das duas branches: feitas, resultados nas seções 5, 6 e 8.
10. Depende do Gustavo antes de qualquer push na `main` (publica web e API): decisões S1.., 1280 dos Dados, cor da Atualização, premissa da 2b.

---

## 1. Push dos 3 commits antes de começar

| Commit | Assunto |
| --- | --- |
| `25dd0fa9` | feito (assunto não registrado nas fontes lidas) |
| `529bbceb` | Barra inferior (24/11): com texto grande o rótulo não corta mais ("Históri…" em 390 px) |
| `28d3e1a5` | Spec do hub de Configurações (24/11): confere os cartões pelo nome e destino, não pela contagem |
| `82202480` | Docs (24/11): pendências dos e2e instáveis e da barra inferior com texto grande (publicado junto) |

- Publicados juntos; run `45321495418` concluído com sucesso (confirmação da sessão principal).
- **Sem push nem merge na `main` desta noite.** Tudo abaixo está só nas branches locais.

---

## 2. Por item

Ordem: 4, 5, 1, 2 e 2b, 3, 6 (com 6b). Todos os critérios copiados dos relatórios dos itens.

### Item 4: Ficha › Dados: lista de dados com divisões (peça compartilhada)
Commit `8d094399` (itens 4 e 1 juntos: `DadosDoAluno.tsx` e `ficha-dados.spec.ts` têm mudanças dos dois entrelaçadas e o patch do item 4 sozinho não compila sem o `BlocosDaFicha` do item 1).

**O que mudou**
- Peça nova `ui/ListaDeDados` (`ListaDeDados`, `LinhaDeDado`, `SubtituloDeDados`): rótulo `textoSuave` em coluna de 200 px (× tamanho do texto), valor, nota, ações à direita centralizadas, 48 px mínimos, fio `divisor` só entre linhas. A lista mede a própria largura e empilha todas as linhas juntas abaixo de rótulo + 16 + 200.
- Regra pura `dominio/listaDeDados.ts` (`larguraDoRotulo`, `empilhaDados`, `partesNumericas`) com teste.
- Dados do aluno (Identificação, Contato e endereço, Configuração do acompanhamento com subtítulos ACOMPANHAMENTO, PLANO e COMUNIDADE, Objetivo e observações) na lista; "Ver no Financeiro" na coluna de ações de "Planos ativos"; "Grupo da comunidade" no mesmo formato; linha do ciclo menstrual na lista.
- Plano contratado: Vencimento, Periodicidade, Tempo mínimo e Motivo do valor viraram linhas.
- Conta do aluno › Meus dados em duas listas (Nome e E-mail; Telefone, Sexo, CPF, Endereço).
- Fonte numérica só nos números (data, CPF, telefone, o "15" de "15 dias").

**Arquivos principais:** `app/src/ui/ListaDeDados.tsx`, `app/src/dominio/listaDeDados.ts` (+ teste), `app/src/treinador/DadosDoAluno.tsx` (compartilhado com o item 1), `app/src/treinador/financeiro/CartaoPlanoContratado.tsx`, `app/src/treinador/ciclo/CicloNaFicha.tsx`, `app/src/treinador/comunidade/GrupoDoAlunoNaFicha.tsx`, `app/src/aluno/conta/DetalheMeusDados.tsx`, e2e `ciclo-menstrual`, `pods-da-comunidade`, `financeiro`, `ficha-dados`, plano `docs/planos/ficha-lista-de-dados.md`.

**Critérios**
- ✅ Peça em `ui/` usada nos quatro cartões da aba Dados, no Plano contratado e em Conta › Meus dados.
- ✅ Rótulo à esquerda em `textoSuave`, coluna fixa de 200 px (cresce no texto grande).
- ⚠️ "Questionário de atualização" na coluna de 200 px em 1280: **não acontece** com o arranjo do item 1. A linha está na Configuração do acompanhamento, que em 1280 com o menu aberto fica na coluna 2fr (~350 px úteis); a lista empilha e o rótulo vai em cima, numa linha só. Em 1920 fica lado a lado. Para valer em 1280 seria preciso mudar a proporção do item 1 (decisão do Gustavo).
- ✅ Valor em texto; ações à direita centralizadas (copiar, WhatsApp, Ver no Financeiro, Mudar grupo, Ver ciclo, Mostrar CPF).
- ✅ Fio `divisor` só entre linhas; 48 px mínimos e respiro de 8 px; a ação de 44 px não estica a linha.
- ✅ "Grupo da comunidade" no mesmo formato ("Sem grupo" como valor, "Mudar grupo" nas ações).
- ✅ "Ver no Financeiro" na coluna de ações de "Planos ativos".
- ✅ Subtítulos ACOMPANHAMENTO, PLANO e COMUNIDADE.
- ✅ Fonte numérica só nos números.
- ✅ Em largura estreita o rótulo vai para cima em todas as linhas juntas; ações continuam à direita.
- ✅ Acessibilidade: grupo `role="list"`, linha `listitem` com `term`/`definition`, nome "Rótulo: valor" no par, ações fora dele. O react-native-web 0.21.3 só gera `ul`/`li`, não `dl`/`dt`/`dd`.
- ✅ Regra pura com jest e comentário "ficha: lista de dados (24/11)".

**Capturas:** `capturas\24-11\item-4-lista-de-dados\` (`ficha-com-plano-{1280,390}-{escuro,claro,areia}`, `...-claro-texto-grande`, `ficha-sem-plano-{1280,390}-claro`, `plano-contratado-{1280,390}-escuro`, `meus-dados-{1280,390}-{escuro,claro,areia}`). Todas abertas e conferidas depois da build limpa.

### Item 5: Ficha › Acesso ao app na lista de dados
Commit `bbc11b24`.

**O que mudou:** cabeçalho só com o título; corpo numa `ListaDeDados` com Situação (selo), Convite (só sem conta), E-mail de acesso (copiar), Último login e Senha (`••••••` com "Definir nova senha" / "Definir outra senha" / "Definir e-mail e senha"); a frase "Entra com …" saiu; regra pura nova `dominio/acessoAoApp.ultimoLoginNaLinha` (Hoje/Ontem HH:MM ou dd/mm HH:MM em Brasília).

**Arquivos principais:** `app/src/treinador/CartaoAcesso.tsx`, `app/src/dominio/acessoAoApp.ts` (+ teste), e2e `acesso-aluno`, `cadastro-aluno` (uma linha), `ficha-dados`, plano `docs/planos/ficha-acesso-ao-app.md`.

**Critérios**
- ✅ Cabeçalho só com o título.
- ✅ Situação com o selo dos estados que existem.
- ✅ E-mail de acesso com "Copiar" na coluna de ações.
- ✅ Último login "Ontem, 18:38" (Brasília), data completa na dica, "—" sem login.
- ✅ Senha "••••••" com "Definir nova senha" nas ações, secundário.
- ✅ "Entra com …" sumiu.
- ✅ Sem acesso: linha Senha vira "Definir e-mail e senha"; convite com linha própria.
- ✅ Outros estados no novo formato, com comportamento e `ALUNO_CONVITE` mantidos (tabela de estados no relatório do item).
- ✅ Mudanças só em `CartaoAcesso.tsx` e no que é dele.

**Capturas:** `capturas\24-11\item-5-acesso\` (`acesso-com-acesso-{1280,390}-{escuro,claro,areia}`, `...-claro-texto-grande`, `acesso-sem-acesso-*`, `acesso-sem-acesso-com-convite-*`, `acesso-aguardando-*`, `acesso-inativo-*`, `ficha-acesso-{1280,390}-escuro`, `ficha-acesso-390-claro-texto-{grande,extra}-pagina`). Conferidas na build limpa.

### Item 1: Ficha › Dados com colunas independentes
Commit `8d094399` (junto do item 4).

**O que mudou:** a partir da faixa `normal`, duas colunas independentes 3:2 (esquerda: Identificação › Contato e endereço › Plano contratado › Histórico de lesões; direita: Configuração do acompanhamento › Objetivo e observações › Acesso ao app › Anamnese), vão de 24 px; abaixo da `normal`, coluna única; na `ultralarga`, aba com teto `LARGURA_EDITOR_DE_CAMPOS` (1400 px) à esquerda; editando, formulário em cima e colunas embaixo sem remontar; seções em `h2` em duas colunas.

**Arquivos principais:** `app/src/app/treinador/alunos/[id].tsx`, `app/src/treinador/BlocosDaFicha.tsx`, `app/src/treinador/DadosDoAluno.tsx` (fora da lista original; ver decisões), `app/src/dominio/colunasDaFicha.ts` (+ teste), e2e `ficha-dados`, `acesso-aluno`, plano `docs/planos/ficha-dados-colunas-independentes.md`.

**Critérios**
- ✅ Duas colunas independentes a partir da faixa normal, vão de 24 px medido em 1280 e 1920.
- ✅ Uma proporção para a página: 1,50 (581/387 em 1280; 965/643 em 1920; 826/550 na ultralarga).
- ✅ Ordem de cada coluna como pedido; diferença de altura só no fim da mais curta.
- ✅ Colunas começam no mesmo topo (y igual ao pixel).
- ✅ "Histórico de lesões" no fim da coluna esquerda (em 1280 a coluna de ~581 px cai no empilhado do `CartaoLesoes`; em 1920 é tabela).
- ✅ Abaixo da faixa normal: coluna única na ordem do celular (conferido em 390 e 1200).
- ✅ Ultralarga: aba em 1400 px alinhada à esquerda (2700 px conferido).
- ✅ Regra pura `dominio/colunasDaFicha.ts` com jest (6 testes).
- ✅ E2e em 1280 e 1920 (topo, ordem, vão, razão ~3:2, anamnese buscada uma vez) e em 390 e 1200 (coluna única).
- ✅ Só tokens e peças existentes.
- ⚠️ Capturas: as 18 foram geradas na build limpa, mas só 6 da versão final foram abertas. **Não abertas:** `1920-escuro-A`, `1920-claro-A`, `1280-claro-A`, `1280-areia-A`, `390-escuro-A`, `390-claro-A`, `390-areia-A`, `1920-claro-B`, `1280-escuro-B`, `1280-claro-texto-grande`, `2700-ultralarga`, `1280-erro-no-plano`.

**Capturas:** `capturas\24-11\item-1-colunas\` (18 imagens; `1920|1280|390-{escuro,claro,areia}-aluno-A`, `aluno-B`, texto grande, `2700-escuro-aluno-A-ultralarga`, `1200-claro-aluno-A-compacta-larga`, `1280-claro-aluno-A-erro-no-plano`, `1280-escuro-aluno-A-editando`). Anteriores à integração dos itens 4 e 5 na aba.

### Item 2: Ficha › Resumo › "Próximo passo"
Commit `86a91545`.

**O que mudou:** Atualização, Treinos registrados e Último registro viram três `CartaoDeIndicador` filhos diretos de uma `GradeDeIndicadores` (mesma altura em 1280; uma coluna em 390). Treinos em azul de destaque como categoria (zero neutro); Atualização com a cor da situação (âmbar, vermelho, verde) ou, sem situação, o ciano de destaque; "Sem atualização pendente" no lugar do "—"; Último registro neutro em fonte normal com o escopo embaixo. `CartaoDeIndicador` ganhou a prop `textual`.

**Arquivos principais:** `app/src/dominio/resumoDoAluno.ts` (+ teste), `app/src/ui/CartaoDeIndicador.tsx`, `app/src/treinador/ResumoDoAluno.tsx`, `app/src/ui/contrasteDasPecas.test.ts`, e2e `ficha-resumo-em-cartoes` (novo) e `ficha-em-abas`, plano `docs/planos/ficha-resumo-em-cartoes.md`.

**Critérios**
1. ✅ Arqueologia com arquivo:linha: "Treinos registrados" perdeu o azul no commit `328df011` pela regra de 23/11 (cor de indicador = medida sem juízo), não por contraste.
2. ✅ Treinos pintado na cor de categoria (valor na cor só se passa 4,5:1); zero neutro.
3. ✅ Três cartões na mesma grade, mesma altura e mesma linha em 1280 (e2e mede); em 390 uma coluna.
4. ✅ Atualização: valor é o estado que o app já mostrava; "—" virou "Sem atualização pendente"; sem dado, neutro.
5. ✅ Último registro neutro, "Hoje/Ontem" em fonte normal com o escopo embaixo.
6. ✅ Regras puras em `dominio/` com jest.
7. ✅ `contrasteDasPecas.test.ts` e `tokens.test.ts` verdes nos 9 temas.
8. ✅ Capturas abertas e conferidas.
9. ✅ Texto grande em 1280 com `minimo={211}` na grade: 3 colunas sem corte.
10. n.a. Nativo fora do escopo (degradê no Android e iOS não visto).

**Capturas:** `capturas\24-11\item-2-resumo\` (recortes do cartão, dpr 2, `<largura>-<cenario>-<tema>[-textogrande].png`; cenários pendente, sem, semdado, atrasada, proxima, semregistro).

### Item 2b: Auditoria dos cartões que perderam cor
Commit `19188e4f` (só docs: `docs/planos/cartoes-cores-restauradas.md`, uma linha no `docs/planos/README.md`). Nenhum código mudou; sem capturas; sem rodada de tsc/lint/jest/e2e.

**Conclusão do relatório:** nada a restaurar. Toda cor que sumiu no `328df011` era "medida" (azul, ciano, violeta de `dominio/destaque`), nunca situação nem categoria. Tabela do que ficou neutro: Treinos registrados (resolvido no item 2), Entradas, Pessoas, Conversão das entradas, Dias até o aceite (mediana) e Reaberturas em Interessados › Indicadores; "Nos próximos 7 dias" e "Novos" no Início; Peso: último registro; ponto da série sem cor de identificação. Aceites segue `sucesso`.

**Ressalva importante:** a conclusão vale pela regra de 23/11 (azul/ciano = medida sem juízo). Com a premissa "azul = categoria" (que o item 2 usou para Treinos), a conclusão muda para Entradas, Pessoas, Conversão e Mediana dos Interessados, "Nos próximos 7 dias" e "Novos" do Início, e Peso. Ressalva registrada no plano `cartoes-cores-restauradas.md` pelo `9db0bfc6`. Decisão do Gustavo (seção 9).

Critérios: o relatório não traz critérios ✅/❌; a verificação foi só a tabela por `git show 328df011` e `git log 328df011..HEAD`.

### Item 3: Tabela › linha tingida (Histórico de lesões)
Commit `4c557476` (só a Tabela). O `CartaoLesoes` do item 3 foi no `f0c903c5`, junto do item 6.

**O que mudou:** a tabela das lesões deixa de ser peça própria e usa a `ui/Tabela`, que ganhou `tingida?: (linha) => boolean`. Na tabela larga a linha tingida não leva borda própria (era o defeito: borda quadrada dobrava a da caixa); o fio entre linhas é o de baixo da linha de cima, na cor da tinta se alguma das duas é tingida; a última não tem fio. No cartão empilhado, fundo `forte` e borda `borda` da tinta. ⋯ alinhado à primeira linha de texto (margem só no `CartaoLesoes`). Observação dentro da célula "Descrição".

**Arquivos principais:** `app/src/ui/Tabela.tsx` (+ teste), `app/src/treinador/CartaoLesoes.tsx`, e2e `ficha-lesoes-tabela` (novo) e `ficha-dados`, `app/e2e/lesoes-falsas.ts`, plano `docs/planos/tabela-linha-tingida.md`.

**Critérios**
- ✅ Recorte do fundo pelo raio nos cantos (web; nativo não testado em aparelho).
- ✅ Nada vaza da tabela (foco, menu ⋯, dicas).
- ✅ Borda tingida não soma com a da caixa (jest e e2e).
- ✅ Ativa no meio: a borda não dobra a lateral (e2e em 1920).
- ✅ ⋯ alinhado à primeira linha de texto (desvio ≤ 4 px nos 3 cenários).
- ✅ Corrigido na peça compartilhada (`Tabela.tingida`; o ⋯ ficou local).
- ✅ Outras tabelas com o mesmo defeito: nenhuma (nenhuma outra tela usa linha tingida ou selecionada na `Tabela`).
- ✅ Capturas antes/depois (1280 e 390; escuro, claro, Areia; texto grande; zoom dos cantos).

**Capturas:** `capturas\24-11\item-3-tabela\` (`antes-*`, `depois-*`, `outras-cobrancas-selecionada-*`). A tabela em colunas só aparece em 1920; em 1280 e 390 a lista vira cartões. As "antes" foram refeitas já com o código do item 6b.

### Item 6 (com 6b): Folha Registrar/Editar lesão e colunas do Histórico
Commit `f0c903c5` (itens 6 e 6b, com o `CartaoLesoes` do item 3).

**O que mudou (6):** região do corpo obrigatória, campo livre (até 80) com chips de atalho (Ombro, Cotovelo, Punho, Cervical, Lombar, Quadril, Joelho, Tornozelo) e lado (Direito, Esquerdo, Ambos); "O que é (opcional)" e "Cuidados no treino (opcional)"; Início com "Hoje" (Brasília); Fim só com a situação "Recuperada"; Salvar apagado diz o que falta; "Sair sem salvar?" só com alteração. A folha saiu para `treinador/FolhaLesao.tsx`.
**O que mudou (6b):** colunas da tabela "Região", "O que é", "Período", "Situação"; a observação aparece como "Cuidados no treino" em negrito abaixo do "O que é" (tabela e cartão).

**Arquivos principais:** `app/src/dominio/folhaDeLesao.ts` (+ teste, 17), `app/src/treinador/FolhaLesao.tsx`, `app/src/treinador/CartaoLesoes.tsx`, e2e `ficha-folha-de-lesao` (14 casos), `ficha-lesoes-tabela` (+2 do 6b), `datas-validas`, `ficha-dados`, planos `docs/planos/ficha-folha-de-lesao.md` e `tabela-linha-tingida.md`.

**Critérios (6)**
- ✅ Chips de região e lado preenchem o campo; editável à mão depois.
- ✅ Lado sem região não preenche; região sem lado é só a região; trocar de chip não duplica o lado.
- ✅ Região marcada como obrigatória no rótulo.
- ✅ Limite de 80 respeitado, sem mudança de API.
- ✅ "O que é (opcional)" e "Cuidados no treino (opcional)" com placeholders e texto de apoio de quem vê.
- ✅ "Hoje" com o dia de Brasília.
- ✅ Fim só com "Recuperada"; fora dela o corpo leva `dataFim: null`.
- ✅ Salvar apagado com o motivo embaixo.
- ✅ Fim antes do início: erro em vermelho no campo.
- ✅ "Sair sem salvar?" só com alteração.
- ✅ Tokens do tema, sem hex, sem `useMemo`/`useCallback`/`React.memo`.
- ✅ Jest novo e e2e novo em 390 e 1280.
- ⚠️ Cada data com o mesmo tamanho: ✅ lado a lado (1280); empilhadas (390) o Início fica mais estreito que o Fim, porque o "Hoje" mora na linha dele.

**Critérios (6b)**
- ✅ Colunas "Região", "O que é", "Período", "Situação" (e2e 1920).
- ✅ "Cuidados no treino" com rótulo embaixo do "O que é" (e2e de posição, tabela e cartão).
- ✅ Nome acessível acompanha o rótulo.
- ✅ Nada do "Observação" antigo na tabela (e2e e grep).
- ✅ Capturas 1280, 390 e 1920; escuro, claro, Areia; texto grande (1920 sem Areia nem texto grande, cobertos em 1280/390).

**Capturas:** `capturas\24-11\item-6-folha-lesao\` (60 PNG: 390 e 1280; escuro, claro, areia, `escuro-texto-grande`, `areia-texto-grande`; cenas `1-vazia` a `6-edicao`) e `capturas\24-11\item-6b-colunas\`.

### Docs e ajustes da ficha
- `6c5c95de`: AGENTS.md, `docs/design-e-front.md` e `docs/planos/README.md` com ListaDeDados, colunas independentes, linha tingida, folha de lesão e Resumo em cartões.
- `9db0bfc6`: ajustes da revisão independente (seção 5).

---

## 3. Decisões que tomei

**Ficha, em geral**
- Treinos registrados em azul de destaque como categoria, apesar de o design listá-lo como neutro (a regra de 23/11 chamava as cores de indicador de "medida sem juízo"; a tela usa o azul como categoria por precedente de `ResultadoDoMes`, Entradas avulsas). Não existe token de categoria "treino" nem "atualização"; usei as cores de destaque de indicador.
- Atualização: a **situação vence a categoria** (âmbar, vermelho, verde, como Início, Números e a lista de alunos); sem situação entra o ciano de categoria. Treinos em 0 fica neutro.
- Aluno sem nenhum registro: a grade fica só com o cartão Atualização em largura total, mais a linha de apoio dos treinos (dúvida: é um cartão sozinho na linha).
- Itens 4 e 1 num commit só (`8d094399`): `DadosDoAluno.tsx` e `ficha-dados.spec.ts` entrelaçados e o item 4 não compila sem o `BlocosDaFicha` do item 1.
- Texto grande nas grades do Resumo: `minimo={211}`; "Sem atualização pendente" quebra em duas linhas.

**Item 1:** `DadosDoAluno.tsx` editado fora da lista; faixa vem de `useFaixaDaTela()` e não do `useFaixaDeLargura` (em 1280 com menu aberto a área tem 1040 px = `normal`, o recuo deixa 1008 = `compacta`); `useFaixaDeLargura` só como "já mediu"; ultralarga com teto 1400 na aba inteira alinhada à esquerda (há um salto ao passar de `larga` para `ultralarga`); faixa compacta toda em coluna única; títulos em `h2` nas duas colunas; sem embrulho em volta dos blocos.

**Item 4:** a lista mede a **própria** largura; coluna do rótulo cresce com o texto (250 px no "Grande"); "Mudar grupo" perdeu o ícone e virou secundário simples (o `Botao` não tem tamanho pequeno; criar um seria mexer no design system); ciclo menstrual por último no grupo Acompanhamento; "Tempo mínimo: Nenhum"; Meus dados mantém "—" no vazio; sem `aria-labelledby` no valor (dava dois elementos em `getByLabel('Nome')`); PLANO e COMUNIDADE como `role="heading"` `aria-level=4`.

**Item 5:** "Gerar convite" deixou de ser `primario`; "Copiar" é o botão de ícone com moldura; último login em Brasília via regra nova (o `instanteRelativo` usa o fuso do aparelho); "E-mail de acesso" e "Último login" aparecem também sem conta, com "—"; nome acessível da senha diz "definida" ou "provisória".

**Item 3:** migrar a tabela das lesões para a `Tabela` em vez de só consertar a peça própria; "sem borda própria + fio único"; não mudar o `alinharLinhas="topo"` global; `tingida` booleano e sempre `atencao`; cartão empilhado sem `role="listitem"` (como já era).

**Item 6/6b:** "(obrigatório)" no rótulo; concordância ("Lombar direita", "Ambos" = "Ombro (ambos os lados)"); atalho tocado substitui o texto; "Hoje" entre as datas com espaçador invisível; Fim escondido não vai no corpo nem conta para o "Sair sem salvar?"; "Sair sem salvar?" pelo `useFecharComAviso`; rótulo "Cuidados no treino" também no cartão do celular.

**Tela larga (resumo por grupo; detalhes nos planos `tela-larga-revisao-*.md`)**
- Início: teto da faixa `larga` sobe de 5 para 6 colunas; Alunos decide por largura medida, não pela faixa; Números alinhado pelo teto de 1800 e não esticado.
- Agenda: Ano com o maior divisor de 12 que cabe; Dia com blocos até `LARGURA_TEXTO_CORRIDO`; Vídeos com 5 colunas a partir de 2000 px e 6 a partir de 2400; Vitrine em duas colunas na faixa larga (1fr página pública, 2fr itens); Mural sem mudança (D5 de 19/11).
- Biblioteca/Planejamento: lista em colunas lidas de cima para baixo (`treinador/ListaEmColunas`, fora de `ui/`), mínimos 560 e 720 px, teto de 3; busca do Planejamento em 480 px.
- Interessados/Financeiro/Importação: oito indicadores numa linha a partir de 1840 px; coluna de apoio na Visão geral só quando o contêiner passa de 1800 + 16 + 480; Planos com 5 e 6 colunas; assistentes da Importação em 1400 px à esquerda (menos o Mapeamento).
- Configurações/Equipe/WhatsApp/Ajustes/Ajuda: hub em colunas de 508 px até 4; Membros em `Tabela` só da faixa larga em diante; cartões de Membros e Perfis com teto de 1800; Ajustes centrado em 1464 px; Ajuda abre 3 colunas pela largura medida (≥ 1880).
- App do aluno: teto 1688 (três faixas de 552) da `larga` em diante, nunca quatro; arranjo largo por prop `largo`, nunca por contexto (a folha "Ver como o aluno" não muda); Conta sem mudança.

---

## 4. Encontrado e não mexido

**Ficha**
- **Auditoria 2b:** não achou cartões a restaurar pela regra de 23/11, mas com a premissa "azul = categoria" a conclusão muda para Entradas, Pessoas, Conversão e Mediana dos Interessados, "Nos próximos 7 dias" e "Novos" do Início, Peso. O comentário de `ResultadoDoMes.tsx` e o plano `cartao-de-indicador-pintado.md` (D4) não citam o Início nem o `CartaoMini`, onde a regra só existe no comentário de `corDoCartao`.
- **Dados em 1280:** a coluna direita empilha o rótulo, inclusive "Questionário de atualização", porque o 3fr/2fr deixa ~350 px (conflito entre os itens 1 e 4; mantido o 3:2 pedido).
- `dl`/`dt`/`dd` viram `ul`/`li` no react-native-web 0.21.3 (`term` e `definition` saem só como atributo `role`).
- `SubtituloDeDados` com `aria-level` 4 (PLANO e COMUNIDADE sob o título do cartão; em duas colunas as seções são `h2`, então há salto de nível: leitura minha cruzando os itens 1 e 4).
- `maisNoTopo` supõe linha de 22 px (apontado na revisão independente; não está nos relatórios dos itens).
- Capturas de `item-1-colunas` são anteriores à integração dos itens 4 e 5 na aba Dados; 12 das 18 nunca foram abertas na versão final.
- Item 1: `GET /alunos/{id}/contratacoes` sai duas vezes em toda largura (vem do cartão do plano); `ficha-dados.spec.ts` não simula `GET /responsaveis` nem `GET /questionarios/opcoes` (a linha "Treinador responsável" mostra "Não encontrado." nesses testes); o spec do item 3 em 1280 esperava `role=table` (resolvido: geometria da tabela medida em 1920).
- Item 4: outros pares rótulo–valor não migraram (`CampoLeitura` em Interessados, Vitrine, Agenda, Financeiro, Equipe, `CartaoMeuPlano`, `treinador/meus-dados`); `ResponsavelFinanceiro` é bloco de texto; em texto grande a 1280 o CEP quebra no hífen (vem de `enderecoParaLeitura`).
- Item 5: aluno inativo com conta continua com o selo "Com acesso" (`seloDoAcesso` não olha `ativo`); `ultimoAcessoNaFicha` ficou sem uso (removido depois no `9db0bfc6`).
- Item 2: `ficha-cabecalho.spec.ts` "editar cria um passo no histórico; o voltar do navegador sai para a leitura" (390 e 1280) falhou com `getByLabel('Nome')` com contagem 1 (esperava 0); considerado fora do Resumo; o `9db0bfc6` mexeu no filtro do botão de contato desse spec, mas esta noite não há registro de que a falha tenha sido a mesma.
- Item 3: cartão empilhado da `Tabela` sem `role="listitem"` dentro do `role="list"` (antigo, todas as tabelas); `app/src/uniwind-types.d.ts` aparece modificado (gerado por `expo export`): não commitar (ainda aparece modificado nas duas worktrees).
- Item 6: `CampoData` valida a faixa REGISTRO com o dia do aparelho e o "Hoje" usa Brasília (perto da meia-noite num aparelho atrás de Brasília o "Hoje" pode cair "no futuro"); a `Escolha` da Situação quebra em duas linhas no celular com texto grande (peça compartilhada).
- Item 6b: `PesoELesoesNoResumo.tsx` pode ainda dizer "Observação"/"Descrição" (não conferido).
- Todos os itens: o `expo export` do Playwright reaproveita o cache do Metro compartilhado com outros checkouts (junção do `node_modules`); rodadas antigas podem ter testado código alheio. Tudo foi refeito com `--clear`, `TEMP` próprio e servidor à mão.

**Tela larga**
- Início/Alunos/Atualizações/Números: indicadores de Números (e de outras telas com `GradeDeIndicadores`) ficam largos com pouco conteúdo em 1920+ (peça compartilhada); no Início em 2560 alguns rótulos quebram em duas linhas; na Areia desta build a página aparece bege e os cartões cremes, diferente da escada da 4.3 (não investigado).
- Agenda/Vídeos/Vitrine: Mês da Agenda sobra altura abaixo da grade em 1440 px de altura (não é critério de largura); o `colunasDosVideos` é usado também por `aluno/ColecoesDeAuloes` (pode dar 5 ou 6 colunas ao aluno se a área passar de 2000/2400 px); pastas de captura `vitrine/`, `vitrine-poucos/` e `comunidade-mural/` (sem prefixo) são cópias das `treinador-*`.
- Biblioteca/Planejamento: abas de questionário do Planejamento (Atualização, Anamnese, Inscrição) não capturadas; linha do modelo sem descrição mostra "—"; bandas do editor de dieta (2560) e a sobra à direita do painel na mobilidade e no treino não mudaram.
- Interessados/Financeiro/Importação: Lançamentos e Cobranças sem teto (decisão de 23/11); frases soltas da planilha completa passam de 72ch dentro do teto de 1400; Planos em 1920 com menu aberto fica com teto 3 (grade ~1590 px); Areia em 390 na planilha completa tem barra e rodapé claros sobre o fundo areia (já era assim, peça compartilhada); Validação (etapa 4) num cartão que agora para em 1400.
- Equipe/Ajuda/Ajustes: o selo "Acesso total · perfil do sistema" aparece em todo perfil `sistema: true`, inclusive Treinador, Nutricionista e Assistente (texto; deveria depender de `acessoTotal`); `TelaConfiguracoes.tsx` já usava `useMemo`; Marca › Contato em 3440 tem campos de ~1000 px ao lado do WhatsApp de ~280; a Ajuda do aluno (`/aluno/ajuda`) usa o mesmo `TelaAjuda.tsx` e também abre 3 colunas a partir de 1880 px (conferida em 2200 e 2560).
- App do aluno: `comunidade/CartaoDoPost` sem limite de 72ch; `treinador/CargasPorDivisao` (4 colunas numa coluna de ~1100 px, compartilhada com a ficha).
- `e2e/tela-larga.spec.ts` grava as capturas num caminho fixo de outra máquina sem `CAPTURAS_TELA_LARGA` (EPERM) e o caso "capturas visuais" estoura 60 s sob carga.
- O grupo do app do aluno **sobrescreveu os "antes"** de `inicio` e `comunidade-videos` (1920, 2560 e 3440), ver seção 8.

---

## 5. Resultado da revisão independente da ficha-24-11 (12 achados)

A numeração original dos 12 achados não foi repassada a este rascunho; a tabela abaixo é por assunto (algumas linhas agrupam ou desdobram achados).

| Achado | Decisão | Onde / motivo |
| --- | --- | --- |
| Remontagem na primeira medida (`BlocosDaFicha` esperava a própria medida e as seções montavam numa coluna para remontar em duas) | **Corrigido** | `9db0bfc6`: a faixa da `Tela` já decide o arranjo; `BlocosDaFicha` não espera mais a medida |
| "Período" do Histórico de lesões com fonte mono no texto todo | **Corrigido** | `9db0bfc6`: só os números em mono (`ValorEmTexto`, exportado da `ListaDeDados`) |
| Rótulo "Região do corpo (obrigatória)" | **Corrigido** | `9db0bfc6` (o relatório do item 6 dizia "(obrigatório)"; specs acompanharam) |
| "Ver cuidados inteiros" (o nome não acompanhava "Cuidados no treino") | **Corrigido** | `9db0bfc6` |
| Índice como chave na `ListaDeDados` (linha condicional remontava a seguinte) | **Corrigido** | `9db0bfc6`: chave do elemento |
| Código morto `ultimoAcessoNaFicha` (e teste) | **Corrigido** | `9db0bfc6`: removido de `fichaDados.ts` e `fichaDados.test.ts` |
| Docs da `ListaDeDados` e da linha tingida não registrados | **Corrigido** | `6c5c95de` (AGENTS.md, `design-e-front.md`, índice de planos) |
| Auditoria 2b sem a ressalva da premissa | **Corrigido** | `9db0bfc6`: ressalva em `docs/planos/cartoes-cores-restauradas.md` |
| Item 1 sem rodada e2e verde da árvore final | **Descartado** | Resolvida pela rodada final: 319 e2e passaram na build limpa, sem falha (seção 6) |
| 1280 empilhando a coluna direita dos Dados | **Para o Gustavo** | Conflito entre os itens 1 e 4; mantido o 3:2 pedido |
| Teto em 2560 com menu aberto | **Descartado** | Resolvido na varredura das abas da ficha (`e1fbc1f0`): Dados no teto de 1400 em toda faixa com duas colunas (seção 8) |
| Cor da Atualização (situação vence a categoria) | **Para o Gustavo** | Decisão de produto; trocar `fatoDaAtualizacao` para devolver `'ciano'` sempre é uma linha |
| Botão Convite / "pequeno" | **Descartado** | Não existe `Botao` pequeno; criar um é mexer no design system (D5) |
| `aria-level` do `SubtituloDeDados` e `dl`/`dt`/`dd` | **Descartado** | O react-native-web 0.21 só gera `ul`/`li`; papéis `term`/`definition` ficam como atributo; título de 4º nível mantido |
| Capturas de dieta e mobilidade da Tabela | **Para o Gustavo** | Só Cobranças foi conferida com linha selecionada (nenhuma outra tela usa `tingida`) |

### Revisão independente da tela larga (14 achados; agente `revisor`, só leitura)

| Achado | Decisão | Onde / motivo |
| --- | --- | --- |
| Ficha do aluno fora da varredura | **Corrigido** | Varredura das cinco abas feita depois (`e1fbc1f0`) |
| Mural do aluno em quadro de 3 colunas (decisão de produto) enquanto o do treinador ficou como sugestão | **Para o Gustavo** | Incoerência registrada; ACV-S2 e AL-1 decidem os dois juntos |
| Interessados › Lista, Importação › Histórico e Auditoria (3440) esticados enquanto Membros recebeu teto | **Para o Gustavo** | Teto sozinho deixa mais de 1/3 vazio; os grupos preferiram a sugestão de painel (IFI-S1, IFI-S3, EAA-S1) |
| Texto "telas do aluno 720" desatualizado (4.10 e `larguraDoConteudo.ts`) | **Corrigido** | `cc7e6d9d` |
| Início do aluno com a 3ª coluna vazia (dependia de `retornoHabilitado`) | **Corrigido** | `bda976cd`: `faixasDoInicio` conta o que aparece; sem nível nem vitrine fica em duas colunas |
| Hub de Configurações em 3440 com cartões esticados na altura | **Corrigido em parte** | `cc7e6d9d`: `alinhar="inicio"` com 3 e 4 colunas; em 2 colunas fica a mesma altura por linha (P3 de `configuracoes-centralizadas`, testada) |
| Ajuda do aluno mudou sem conferência | **Corrigido** | `cc7e6d9d`: `/aluno/ajuda` capturada em 390, 1280, 1920 e 2560, sem regressão |
| Valores fixos duplicados (`2 * 720`, 560 inline, 480, vão 16) | **Corrigido em parte** | `cc7e6d9d`: `LARGURA_DA_COLUNA` exportada e `CELULA_DO_PERFIL`; o 480 do Planejamento e o `VAO = 16` de `colunasDaVisaoGeral` e `colunasDaListaDeAtualizacoes` ficam como estão (dívida pequena) |
| Atualizações em `Grade` por linha (zigue-zague no Tab) e `ListaEmColunas` remontando linhas ao redimensionar | **Para o Gustavo** | Decisão D4 do plano de Atualizações; redimensionar a janela é raro |
| 1280 e 390 só rodavam com `CAPTURAS_TELA_LARGA*` em Agenda, Biblioteca e Equipe | **Para o Gustavo** | O spec do aluno ganhou casos sempre ativos (`bda976cd`); os demais seguem só em captura |
| Espera por tempo nos specs | **Descartado** | Só dentro de blocos de captura que pulam por padrão; a geometria usa `toPass`/`poll` |
| Início do aluno ✅ com o mapa de treinos esticado | **Corrigido** | `bda976cd`: passo do dia de 18 para 24 px, a grade ocupa ~78% do cartão em 3440 |
| Dieta "3 + 3" verificada só com 5 refeições | **Corrigido** | `bda976cd`: e2e confere 6 refeições |
| Plano do aluno "Em andamento" | **Corrigido** | `bda976cd`: Concluída |

---

## 6. Verificação

Números dos relatórios dos agentes (histórico), sempre em build limpa (`expo export --clear`, `TEMP` próprio). Onde falta a rodada final, está marcado.

### Branch `ficha-24-11`
A rodada final foi feita no HEAD `9db0bfc6` (o commit com este relatório vem depois e só mexe em `docs/planos/`).
| Verificação | Histórico (relatórios) | Rodada final |
| --- | --- | --- |
| typecheck (`npx tsc --noEmit`) | ✅ sem erro nas últimas rodadas dos itens 1 a 6b (erros intermediários vieram de arquivos de outros agentes em edição) | ✅ sem erro (HEAD `9db0bfc6`) |
| lint (`npm run lint`) | ✅ 0 erros, 11 avisos `no-unused-vars` fora do escopo (`CartaoSerieComEtapas.tsx`, `editorTreino.test.ts`, `metodologia.test.ts`) | ✅ 0 erros, 11 avisos |
| jest | ✅ 400 suítes, 9464 testes (itens 1, 4, 5, 6b; item 2: 399/9459; item 3 antes do 6b: 398/9453) | ✅ 400 suítes, 9461 testes |
| e2e (passaram / falharam / pulados) | ver abaixo | ✅ 319 passaram, 0 falharam, 0 pulados (22 specs da ficha, conta do aluno e tabelas tocadas, build limpa na porta 8232; os instáveis conhecidos não falharam) |

E2e por item (histórico):
- Item 4 (build só do item 4): 388 passaram, 4 falharam, 0 pulados; as 4 são os testes reescritos para o item 5 (`cadastro-aluno.spec.ts:337` em 390 e 1280; `ficha-dados.spec.ts:134` em 390 e 1280), de propósito contra a build do item 4. Passam na build do item 5. Lote `financeiro-*` à parte: 13 passaram.
- Item 5 (árvore inteira): 94 passaram, 0 falharam, 0 pulados (`acesso-aluno`, `ficha-dados`, `cadastro-aluno`, `senha-provisoria`, `ficha-em-abas`).
- Item 1 (build com `CartaoAcesso.tsx` anterior): 204 passaram, 8 falharam (todos do cartão Acesso: `acesso-aluno` e `ficha-dados` "acesso em lista", código do item 5 ainda em edição), 1 pulado (`filtros-laterais-entrada`, só com `CAPTURAS_FILTROS`).
- Item 2: 146 passaram (inclui `ficha-resumo-em-cartoes` 7 testes); `ficha-cabecalho`: 2 falhas (editar, 390 e 1280), nenhuma pulada.
- Item 3: 141 passaram numa rodada; numa segunda, `ficha-lesoes-tabela` 5 passaram e 2 de `ficha-dados` ("acesso em lista…", 390 e 1280) falharam, do bloco do item 5 então em edição.
- Item 6: `ficha-folha-de-lesao` 14/14, `datas-validas` 6/6, `ficha-dados -g lesões` 6/6.
- Item 6b: `ficha-lesoes-tabela` 5 testes passaram; `ficha-dados` com as 2 falhas do acesso (item 5 em edição).
- Se já falhavam na `main`: não registrado para as falhas da ficha (todas atribuídas a trabalho em andamento de outro item).

### Branch `tela-larga-revisao`
| Verificação | Histórico (relatórios) | Rodada final |
| --- | --- | --- |
| typecheck | ✅ limpo nas rodadas finais dos 6 grupos (erros intermediários vinham de `zz-capturas-*` de outros agentes) | ✅ sem erro (HEAD `605fb0fe`) |
| lint | ✅ 0 erros, 11 avisos (em `metodologia.test.ts` e arquivos de outros agentes) | ✅ 0 erros, 11 avisos |
| jest | ✅ 403 suítes, 9429 testes (todos os grupos reportaram o mesmo total) | ✅ 407 suítes, 9504 testes |
| e2e | ver abaixo | ✅ 459 passaram, 0 falharam, 64 pulados (28 specs: todos os `tela-larga-*`, ficha, conta do aluno, configurações, ajuda, menu, painel, números, vitrine, início e dieta do aluno; build limpa na porta 8233). Uma primeira tentativa caiu com "worker process exited unexpectedly" e não se repetiu |

E2e por grupo (histórico, build limpa):
- Início/Alunos/Atualizações/Números: `tela-larga-inicio-alunos` 16 casos (depois 18) passaram; vizinhos 209 passaram, 2 pulados (`menu-do-treinador` "capturas do menu"), 1 falha `financeiro-tela-larga.spec.ts:165` (Planos esperava 5 colunas e recebeu 4), que passou rodando sozinho; não conferido na `main`.
- Agenda/Vídeos/Vitrine: spec novo 20 de geometria + 9 de captura + 8 de conferência passaram; rodada final 174 passaram, 0 falharam (rodada anterior de vizinhos: 271 passaram, 8 falharam, 25 pulados; as falhas eram 2 de arrastar em `comunidade-videos-19-11`, que passaram sozinhas, e 6 de `tela-larga.spec.ts` por caminho fixo).
- Biblioteca/Planejamento: spec novo 7 passaram (16 de captura pulados sem `CAPTURAS_TELA_LARGA_BP`); vizinhos 103 passaram, 2 falharam, que falham também sozinhas e **não foram conferidas na `main`**: `editor-mobilidade` "vídeo: vazio com o placeholder…" (1280, corrida do popup) e `tela-larga.spec.ts` "capturas visuais em 1920 px… e 3440 px (Limitada)" (estouro de 60 s).
- Interessados/Financeiro/Importação: 142 passaram, 8 pulados, 7 falharam em grupo; sozinhas, 34 de 34 passaram (6 de `tela-larga.spec.ts` por EPERM sem `CAPTURAS_TELA_LARGA`; 1 de `larguras-ajustes-cadastro-lembretes.spec.ts:125`).
- Equipe/Ajuda/Ajustes: spec do grupo 6 passaram; vizinhos 171 passaram, 2 pulados (já existiam), 1 falhou (`tela-larga` › capturas visuais, tempo esgotado sob carga; sozinho passou).
- App do aluno: spec novo 9/9; vizinhos passaram (340 + 216 na rodada de Comunidade), exceto **`treino-do-aluno-lacunas`: 5 falhas** (histórico do exercício, "strict mode violation": o botão "Histórico de Supino de teste" resolve para 2 elementos), que **já falhavam no HEAD limpo `bf60dd22`**, sem as edições do grupo. Retomada (base `01b88adc`): `tela-larga-app-do-aluno` e `comunidade-colecoes-aluno` 25/25; o Chromium `chromium-1248` não existe mais na máquina, usou-se o Chromium padrão já instalado.

Notas da rodada final: `e2e/tela-larga.spec.ts` não entrou (grava num caminho fixo de outra máquina sem `CAPTURAS_TELA_LARGA`); na rodada da ficha o `ficha-cabecalho.spec.ts:175` foi corrigido (o regex do botão de contato pegava "Copiar e-mail de acesso") e passou.

### Instáveis conhecidos
- `painel.spec.ts:391`, `financeiro.spec.ts:657`, `links-do-menu.spec.ts:20` (lista informada pelo coordenador; só o `links-do-menu.spec.ts:20` aparece nos relatórios: falhou na rodada antiga do grupo Interessados e passou na build limpa; Ctrl+clique abre aba nova, falhou também sob carga e passou sozinho no grupo Equipe).
- `tela-larga.spec.ts`: grava capturas num caminho fixo de outra máquina sem `CAPTURAS_TELA_LARGA` (EPERM); o caso "capturas visuais" estoura 60 s sob carga (e, no grupo Biblioteca, falha no editor de treino).
- `treino-do-aluno-lacunas`: 5 falhas por strict mode que já falhavam no HEAD anterior.
- Outros que passaram sozinhos: `financeiro-tela-larga.spec.ts:165`, `larguras-ajustes-cadastro-lembretes.spec.ts:125`, `comunidade-videos-19-11` (arrastar).

---

## 7. Commits das duas branches

### `ficha-24-11` (`git log --oneline main..ficha-24-11`, do mais antigo ao mais novo)
| # | Commit | Hora | Uma linha |
| --- | --- | --- | --- |
| 1 | `86a91545` | 01:11 | Ficha › Resumo: Próximo passo em três cartões de indicador, com treinos em azul de destaque (item 2) |
| 2 | `8d094399` | 02:39 | Ficha › Dados: lista de dados compartilhada e duas colunas independentes (itens 4 e 1) |
| 3 | `bbc11b24` | 02:39 | Ficha › Acesso ao app: mesma lista de dados, sem a frase "Entra com …" (item 5) |
| 4 | `4c557476` | 02:39 | Tabela: linha tingida sem dobrar a borda da caixa (item 3) |
| 5 | `f0c903c5` | 02:39 | Ficha › Histórico de lesões: folha Registrar/Editar lesão e colunas da tabela (itens 6 e 3b) |
| 6 | `19188e4f` | 02:39 | Docs: auditoria dos cartões que perderam cor no cartão pintado (item 2b) |
| 7 | `6c5c95de` | 03:22 | Docs: ListaDeDados, colunas independentes, linha tingida, folha de lesão e Resumo em cartões no AGENTS.md, no design e no índice de planos |
| 8 | `9db0bfc6` | 04:01 | Ajustes da revisão: sem remontar as colunas na primeira medida, Período só com números em mono, rótulos e chaves |

### `tela-larga-revisao` (`git log --oneline 82202480..tela-larga-revisao`, do mais antigo ao mais novo)
| # | Commit | Hora | Uma linha |
| --- | --- | --- | --- |
| 1 | `86a91545` | 01:11 | (da ficha) Resumo em três cartões |
| 2 | `bf60dd22` | 01:54 | Tela larga: Início, Alunos, Atualizações e Números ganham colunas com o espaço |
| 3 | `f4281f90` | 02:16 | Tela larga: Agenda, Comunidade › Vídeos e Vitrine ganham colunas com o espaço |
| 4 | `7b492aa3` | 02:29 | Tela larga: Biblioteca e Planejamento em colunas, com busca e campos que não esticam |
| 5 | `95d7a3ce` | 02:37 | Tela larga: Interessados, Financeiro e Importação ganham colunas e param onde o campo não cresce |
| 6 | `01b88adc` | 02:39 | Tela larga: Configurações, Equipe, WhatsApp, Ajustes e Ajuda usam a largura em colunas |
| 7 a 11 | `8d094399`, `bbc11b24`, `4c557476`, `f0c903c5`, `19188e4f` | 02:39 | (da ficha) itens 4+1, 5, 3, 6+6b e docs 2b |
| 12 | `6c5c95de` | 03:22 | (da ficha) Docs da ficha |
| 13 | `7b9d9a46` | 03:26 | Tela larga: app do aluno na web usa a largura em colunas (Início, Treino, Dieta, Comunidade, Histórico) |
| 14 | `9db0bfc6` | | (da ficha) Ajustes da revisão |
| 15 | `bc12d415` | | Merge da `ficha-24-11` na `tela-larga-revisao`, para a varredura de tela larga das abas da ficha |
| 16 | `b6206ee9` | | Docs: regras da revisão de tela larga no AGENTS.md, na 4.10 e no índice de planos |
| 17 | `cc7e6d9d` | | Ajustes da revisão: hub de Configurações com altura própria em 3 e 4 colunas, constantes nomeadas e tetos do aluno nos docs |
| 18 | `bda976cd` | | Ajustes da revisão: Início do aluno só abre a terceira coluna quando ela tem conteúdo; mapa de treinos maior |
| 19 | `e1fbc1f0` | | Tela larga: abas da ficha do aluno (Resumo, Planos, Acompanhamento, Evolução e Dados) |
| 20 | `605fb0fe` | | Docs: ficha do aluno em tela larga no AGENTS.md, na 4.10 e no índice de planos |

Estado da árvore em `tela-larga-24-11` no fim: só `app/src/uniwind-types.d.ts` modificado (gerado pelo export, não commitar).

---

## 8. Tela larga

### 7a (base já no `origin/main`)
`ebbe2a8b` (limite de 1400 e constantes de largura), `9250719c` e `b76bb7f2` (docs das faixas e da régua única), merge `5d44cd91`/`b27e731b`; `LARGURA_EDITOR_DE_CAMPOS = 1400`. Plano `docs/planos/tela-larga.md` (concluído em 19/11). **Nenhum merge necessário.**

### Tabela tela × largura (estado depois da revisão)
Legenda: ✅ sem defeito de tela larga (ou corrigido; "era ❌" = corrigido nesta revisão); ⚠ ✅ com ressalva registrada nos relatórios; ❌ defeito que ficou (motivo na coluna; sugestão correspondente na lista abaixo). Colunas de grupos (Início…) vêm dos relatórios dos grupos.

| Tela | 1920 | 2560 | 3440 | Observação |
| --- | --- | --- | --- | --- |
| Início | ✅ | ✅ (era ❌) | ✅ | 6 colunas a partir de ~1916 px de painel; ver IA-S1 (Agenda "Pequeno") |
| Alunos | ✅ | ✅ (era ❌); ⚠ um grupo só | ✅ (era ❌); ⚠ um grupo só | Grupos em duas colunas com ≥ 1000 px por metade; IA-S4 |
| Ficha › Resumo | ✅ | ✅ (era ❌) | ✅ | Atividade recente como 3ª coluna quando cabem três de 640 px |
| Ficha › Planos | ✅ (era ❌) | ✅ (era ❌) | ✅ (era ❌) | Pastas em `ListaEmColunas` (2 e 3 colunas) |
| Ficha › Acompanhamento | ✅ | ✅ (era ❌) | ⚠ (era ❌) | Duas pilhas 1:1 a partir de 1000 px cada; FI-S2 |
| Ficha › Evolução | ✅ (era ⚠) | ✅ (era ❌) | ⚠ (era ❌) | Duas pilhas; campo "Medida" até 640 px; FI-S2 |
| Ficha › Ficha do aluno (Dados) | ✅ (era ⚠) | ✅ (era ❌) | ✅ | Duas colunas 3:2 até 1400, à esquerda; sobra à direita (FI-S1) |
| Atualizações | ✅ (era ❌) | ✅ (era ❌); ⚠ poucos itens | ✅ (era ❌); ⚠ poucos itens | Grade de colunas iguais (3, 4 e 6) |
| Agenda › Dia | ✅ | ✅ | ✅ | Pista dos blocos em `LARGURA_TEXTO_CORRIDO`; vazio à direita é a grade de horários (ACV-S1) |
| Agenda › Semana | ✅ | ✅ | ✅ | Sem mudança |
| Agenda › Mês | ✅ | ✅ | ✅ | Sem mudança |
| Agenda › Ano | ✅ | ✅ (era ❌) | ✅ (era ❌) | 4 × 3 em 2560, 6 × 2 em 3440; sobra ~32% e ~28% |
| Comunidade › Vídeos | ✅ | ✅ (era ❌) | ✅ (era ❌) | 5 colunas a partir de 2000 px, 6 a partir de 2400 |
| Comunidade › Mural | ✅ | ❌ | ❌ | Sobram ~1000 px e ~1700 px; ACV-S2 |
| Biblioteca (Exercícios, Alimentos, Suplementos, Outros, Catálogo) | ✅ (era ❌) | ✅ (era ❌) | ✅ (era ❌) | Linhas em 2 ou 3 colunas |
| Planejamento › Treino | ✅ (era ❌) | ✅ (era ❌) | ✅ (era ❌) | Busca em 480 px; modelos em colunas |
| Planejamento › Dieta | ✅ (era ❌) | ✅ (era ❌) | ✅ (era ❌) | Idem; editor do modelo com nome até 1040 |
| Planejamento › Mobilidade | ✅ (era ❌) | ✅ (era ❌) | ✅ (era ❌) | Idem; "Sobre o modelo" até 1040 |
| Planejamento › Pacotes | ✅ (era ❌) | ✅ (era ❌) | ✅ (era ❌) | Editor do pacote: coluna de 1040 com ~1000 px vazios de cada lado (BP-1) |
| Interessados › Lista | ✅ | ❌ | ❌ | Tabela de 5 colunas esticada até ~3100 px; IFI-S1 |
| Interessados › Kanban | ✅ | ❌ | ❌ | Três colunas de ~1000 px; IFI-S1 ou IFI-S2 |
| Interessados › Indicadores | ✅ | ✅ | ✅ | Oito números numa linha a partir de ~1840 px |
| Financeiro › Visão geral | ✅ | ✅ | ✅ | Coluna de apoio em 3440 |
| Financeiro › Cobranças | ✅ | ✅ | ✅ | Sem mudança (painel de 480 px da ultralarga, 23/11) |
| Financeiro › Planos | ✅ | ✅ | ✅ | 5 e 6 colunas |
| Financeiro › Lançamentos | ✅ | ✅ | ✅ | Sem mudança (decisão de 23/11) |
| Financeiro › Lembretes | ✅ | ✅ | ✅ | Sobra à direita esperada; IFI-S4 |
| Financeiro › Recebimento | ✅ | ✅ | ✅ | Idem; IFI-S4 |
| Vitrine | ✅ (era ❌) | ❌ sobra (~870 px, ~38%) | ❌ sobra (~1700 px, ~55%) | Esticado corrigido; ACV-S3 |
| Números | ✅ | ✅ (sobram ~450 px) | ⚠ (sobram ~1300 px, mais de 1/3) | Bordas alinhadas no teto de 1800; IA-S3 |
| Equipe › Membros | ✅ (era ❌) | ✅ (era ❌) | ✅ (era ❌), sobra à direita | `Tabela` da faixa larga em diante; EAA-S1 |
| Equipe › Perfis | ✅ (era ❌) | ✅ (era ❌) | ✅ (era ❌), sobra à direita | Grade de 2 ou 3 colunas; EAA-S1 |
| Importação › Histórico | ✅ | ❌ | ❌ | Tabela de 4 colunas esticada; IFI-S3 |
| Importação › Nova importação | ✅ | ✅ | ✅ | Em 1400 px à esquerda |
| Importação › Planilha completa | ✅ | ✅ | ✅ | Em 1400 px; busca dos nomes em 640 |
| Importação › Assistida | ✅ | ✅ | ✅ | Em 1400 px |
| Ajuda | ✅ | ✅ (era ❌) | ✅ | 3 colunas pela largura medida (≥ 1880); EAA-S5 |
| Ajustes | ✅ | ✅ (era ❌) | ✅ (era ❌) | Teto de 1464 px, centrado; EAA-S4 |
| Configurações (hub) | ✅ | ✅ (era ❌) | ✅ (era ❌) | 4 colunas de 508 px; EAA-S2 |
| WhatsApp oficial | ✅ (era ❌) | ✅ (era ❌) | ✅ (era ❌) | Conexão em 640 + Modelos em grade |
| Auditoria | ✅ | ✅ | ❌ | Tabela com teto de 1800; sobram ~40%; EAA-S1 |
| Marca, Assinatura e faturas, Tags | ✅ | ✅ | ✅ | Teto próprio de 1040 (regra); EAA-S3 |
| App do aluno › Início | ✅ | ✅ | ✅ | 3 colunas, teto 1688; AL-3, AL-4 |
| App do aluno › Treino (lista e sessão) | ✅ | ✅ | ✅ | Divisões 3 + 2; coluna lateral de 400 na sessão |
| App do aluno › Dieta | ✅ | ✅ | ✅ | Resumo de 400 + refeições em colunas (3 + 3 conferido com 6 refeições) |
| App do aluno › Comunidade (mural, vídeos, conquistas) | ✅ | ✅ | ✅ | Mural em quadro; AL-1 e AL-2 |
| App do aluno › Histórico | ✅ | ✅ | ✅ | Duas colunas |
| App do aluno › Conta | ✅ | ✅ | ✅ | Sem mudança (320 + 640, regra de formulário) |

Em 3440 o app do aluno deixa ~708 px (22%) de cada lado, de propósito (D1 do grupo).

### Sugestões que dependem do Gustavo
Numeração própria de cada relatório (todas começam em S1): prefixei pelo grupo. Capturas em `capturas\24-11\tela-larga\`.

| Id | Sugestão | Captura |
| --- | --- | --- |
| IA-S1 | Agenda "Pequeno" de fábrica no Início (hoje nasce Médio; em 1920 fecha linhas de 4 numa grade de 5) | `inicio\depois\1920.png`, `2560.png` |
| IA-S2 | Painel de detalhe ao lado (aluno em Alunos, atualização em Atualizações) na `ultralarga` | ideia, sem captura própria |
| IA-S3 | Números em 3440: ~1300 px vazios (gráfico mês a mês ou "Como contamos" em 3ª coluna) | `numeros\depois\3440.png` |
| IA-S4 | Alunos com um grupo só em 2560/3440 (tabela de 5 colunas a ~3100 px) | `alunos\depois\3440-um-grupo.png` |
| ACV-S1 | Agenda › Dia com lista do dia ou resumo do compromisso ao lado (~2000 px de grade vazia em 3440) | `agenda-dia\depois\3440.png` |
| ACV-S2 | Comunidade › Mural na tela larga: "Avisos" e "Alunos" lado a lado, ou centralizar (a D5 de 19/11 escolheu o contrário) | `treinador-comunidade-mural\antes\2560.png`, `3440.png` |
| ACV-S3 | Vitrine em 3440: itens em cartões com mais por linha, ou prévia "o que o aluno vê" como 3ª coluna | `treinador-vitrine\depois\3440.png` |
| BP-1 | Editor do pacote (e metodologia e séries) em 2560/3440: ~1000 px vazios de cada lado; painel novo | `editor-modelo-pacote\depois\3440.png` |
| BP-2 | Texto corrido acima de 72ch nas descrições de `ui/Cartao` e no subtítulo de `ui/Cabecalho` (peças compartilhadas) | `biblioteca-outros\antes\2560.png` |
| BP-3 | Coleção/categoria com poucos itens em 3440: vagas vazias; alternativa de cartões de coleção lado a lado | `planejamento-treino\depois\3440.png` |
| IFI-S1 | Painel fixo da inscrição na ultralarga (Interessados Lista e Kanban), como o `PainelDaCobranca` | `interessados-lista\antes\3440.png`, `interessados-kanban\antes\3440.png` |
| IFI-S2 | Kanban com as encerradas abertas na ultralarga (muda o "Mostrar encerradas") | idem |
| IFI-S3 | Painel do detalhe da importação (Histórico) na ultralarga, ou mais contagens na tabela | `importacao-lista\antes\3440.png` |
| IFI-S4 | Lembretes e Recebimento ocupam ~1300 de 3100 px em 3440 (esperado pela 4.10); cartão da InfinitePay ao lado do de formas | `financeiro-lembretes\antes\3440.png`, `financeiro-recebimento\antes\3440.png` |
| EAA-S1 | Auditoria (e Membros e Perfis) em 3440: painel de filtros fixo ou painel de detalhe do evento | `auditoria\antes\3440.png`, `equipe-membros\depois\3440.png` |
| EAA-S2 | Hub de Configurações em mais colunas (sobrescreve o H9 de `configuracoes-centralizadas.md` nas faixas larga e ultralarga) | `configuracoes\depois\3440.png` |
| EAA-S3 | Marca, Assinatura e faturas e Tags em 3440 (Acompanhamento e Contato como 3ª coluna; redesenho do formulário) | `marca\antes\3440.png` |
| EAA-S4 | `PreferenciasDoApp` com 3ª coluna na ultralarga; rótulo "Variações de tom" duplicado | `ajustes\antes\1920.png` |
| EAA-S5 | `Cabecalho` limitando o subtítulo a `LARGURA_TEXTO_CORRIDO` (a Ajuda passa de 72ch em 2560 e 3440) | `ajuda\depois\2560.png` |
| AL-1 | Mural do aluno com coluna ao lado (feed de ~680 px + painel "Seus números/conquistas") | `aluno-comunidade\depois\1920.png` |
| AL-2 | Texto do post em 72ch também em 1280 (`comunidade/CartaoDoPost`, peça compartilhada) | `aluno-comunidade\antes\1920.png` |
| AL-3 | Mapa de treinos: resolvido (passo máximo 24 px); em 3440 sem nível nem vitrine as laterais ficam com ~32% de cada lado | `aluno-inicio\depois\3440.png` |
| AL-4 | Início do aluno sem retorno nem vitrine fica em duas colunas, teto de 1120 (outro bloco na 3ª coluna?) | `aluno-inicio\depois\3440-sem-retorno.png` |
| FI-S1 | Dados da ficha: sobra à direita (~870 px em 2560, ~1700 px em 3440); ocupar pede painel novo | `ficha\ficha\depois\2560.png`, `3440.png` |
| FI-S2 | Ficha › Acompanhamento e Evolução em 3440: cada pilha com ~1530 px, a tabela do peso e a lista de Treinos concluídos voltam a ~1500 px | `ficha\acompanhamento\depois\3440.png` |
| FI-S3 | Água: dentro do cartão os dias ficam em 4 colunas com o valor longe da data (regra interna do `CartaoAgua`) | `ficha\acompanhamento\depois\3440.png` |
| FI-D2 | Lesões com mínimo de 760 px para a tabela: o nome da região quebra em duas linhas e "Cuidados no treino" em até quatro; voltar a 800 deixa cartões de 1920 em diante | `ficha\ficha\depois\2560.png`, `2560-texto-extra.png` |

### Onde estão as capturas
`capturas\24-11\tela-larga\<tela>\{antes,depois}\<largura>.png` (1920, 2560, 3440; menu aberto, tema escuro, "Largura do conteúdo" Automática), mais `<tela>\conferencia\` (1280, 390; escuro, claro, Areia; texto grande ou Extra) e sufixos `-poucos`, `-alta` (página inteira), `-texto-extra`. Prefixos: `aluno-` (app do aluno) e `treinador-` (Comunidade e Vitrine do treinador, para não colidir). Pastas: agenda-{dia,semana,mes,ano}, ajuda, ajuda-aluno, ajuda-secao-aberta, ajustes, alunos, atualizacoes, auditoria, biblioteca-{alimentos,catalogo,exercicios,outros,suplementos}, configuracoes, editor-modelo-{dieta,mobilidade,pacote,treino}, equipe-{membros,perfis}, `ficha\{resumo,planos,acompanhamento,evolucao,ficha}` (`antes` e `depois`), financeiro-*, importacao-*, inicio, interessados-*, marca, minha-conta-*, numeros, planejamento-*, tags, treinador-comunidade-*, treinador-vitrine*, whatsapp, aluno-*.

### Aviso: "antes" sobrescritos
O grupo do app do aluno gravou por engano em `inicio\antes` e `comunidade-videos\antes` (1920, 2560 e 3440), sobrescrevendo as capturas dos grupos Início e Comunidade do treinador (00:54). As capturas do aluno foram movidas para `aluno-*` e as duas pastas têm `LEIA-sobrescrito.txt`. **Esses grupos precisam capturar de novo os "antes"** (a partir da `main` em `82202480`, antes das edições). Não há registro nos relatórios de que as duas pastas tenham sido refeitas depois. A pasta `comunidade-videos\` sem prefixo contém hoje telas do aluno em parte; as telas do treinador estão em `treinador-comunidade-videos`.

---

## 9. O que precisa de mim amanhã

- **Decisões de produto das sugestões** (seção 8, IA-S1.. AL-4): Mural, Vitrine, Números 3440, Alunos com um grupo só, Auditoria/Membros, hub de Configurações, Marca, `PreferenciasDoApp`, mapa de treinos.
- **Painel da inscrição em Interessados** (IFI-S1; resolve Lista e Kanban em 2560/3440; painel novo, a folha tem ~650 linhas).
- **Painel de detalhe do Histórico da importação** (IFI-S3).
- **1280 dos Dados** (itens 1 e 4): manter 3:2 e a coluna direita empilhada (~350 px), ou mudar a proporção para o "Questionário de atualização" caber lado a lado.
- **Cor da Atualização** no Resumo: situação vence a categoria (hoje) ou sempre ciano.
- **Premissa da auditoria 2b:** "azul = categoria" ou "azul = medida sem juízo" (muda Entradas, Pessoas, Conversão, Mediana, Nos próximos 7 dias, Novos, Peso).
- **Revisar e autorizar o push/merge na `main`** (publica web e API; CI e deploy contam minutos; um push por lote, testes locais antes).
- **Recapturar os "antes"** de `inicio` e `comunidade-videos` (seção 8) e abrir as 12 capturas do item 1 nunca vistas.
- **Lesões em 760 px** (FI-D2): manter a tabela mínima ou voltar a 800 (cartões).
- **Mural do aluno em quadro × Mural do treinador**: decidir os dois juntos (ACV-S2, AL-1).
- **Deletar `C:\w` vazia à mão.**
- **Conferir à mão o que não foi testado:** texto grande e nativo (Android e iOS: degradê, recorte de cantos da `Tabela`, folha de lesão), contraste alto, menu recolhido, Limitada em quase todas as telas de tela larga, leitor de tela real; a skill `web-design-guidelines` não rodou no grupo do app do aluno.
- **Rodar o PDF dos guias se necessário** (AGENTS.md: gerar os guias em PDF uma vez no fim do lote, antes do PR/push).

---
