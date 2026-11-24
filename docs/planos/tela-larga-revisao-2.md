# Tela larga (24/11): revisão 2 do relatório da noite

Situação: Em andamento · Onde: branch `tela-larga-revisao` (worktree `tela-larga-24-11`) · Atualizado: 24/11/2026

Fonte: revisão do Gustavo sobre `capturas/24-11/RELATORIO.md` (24/11/2026), base `82202480` (main; a branch contém a `ficha-24-11`).

## Objetivo
Fechar as decisões do relatório: ficha › Dados em três colunas na ultralarga, Início do aluno sem vãos, mural com feed de leitura e coluna lateral, quatro defeitos pequenos, e registrar as decisões em docs. Depois, fast-forward da `main` e push (só se tudo verde).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Dados na `ultralarga` | 3 colunas independentes: (Identificação › Contato e endereço › Objetivo e observações), (Plano contratado › Histórico de lesões), (Configuração do acompanhamento › Acesso ao app › Anamnese); nenhum campo passa de `LARGURA_EDITOR_DE_CAMPOS` por coluna; normal e larga seguem 3:2 | Gustavo |
| 2 | Início do aluno (larga) | "Hoje" primeiro; pilhas independentes; "Seu ano de treinos" ocupa a largura do cartão | Gustavo |
| 3 | Mural (treinador e aluno) | Feed de ~720 px e coluna fixa à direita a partir de ~1280 de área (treinador: Fixados e Enquetes abertas; aluno: números e conquistas); abaixo disso, a coluna vai ao topo e some vazia; fim do quadro de 3 colunas do aluno | Gustavo |
| 4 | Dados em 1280 | Fica 3:2 (rótulos empilhados na coluna da direita) | Gustavo |
| 5 | Atualização | A situação vence a categoria | Gustavo |
| 6 | Cores (2b) | Contagens genéricas neutras; cor de categoria só quando o cartão representa uma área do app (ex.: Treinos registrados); nada a restaurar | Gustavo |
| 7 | Lesões | Tabela a partir de 760 px | Gustavo |
| 8 | Histórico da importação, Auditoria e Membros | Aceita a sobra na ultralarga (uso raro) | Gustavo |
| 9 | Os "antes" sobrescritos | Não serão refeitos | Gustavo |

## Passos
- [x] 1. Ficha › Dados em 3 colunas na ultralarga (abre pela largura medida da aba, 1 : 1,2 : 1; em 2560 com menu aberto a faixa ainda é `larga`) — commit: `ae339ceb`
- [x] 2. App do aluno › Início na tela larga — commit: `4c5dcb8c`
- [x] 3. Mural (treinador e aluno): feed + coluna lateral — commit: `3c3e2272`
- [ ] 4. Defeitos: `seloDoAcesso` (inativo), selo "Acesso total" da Equipe, captura do `tela-larga.spec.ts`, botão "Histórico de …" duplicado (defeito da tela: ícone e botão rotulado; ficou o botão) — commits: `6e79f200`, `257bf57c` (e2e dos selos)
- [x] 5. Decisões em AGENTS.md, `design-e-front.md` e planos — commits: `4f81a7de` e o de docs desta entrega
- [ ] 6. Guias em PDF, verificações, fast-forward da `main`, push — commit/run: —

## Fora do escopo
- Pós-lançamento (sugestões aceitas, não fazer agora): painel da inscrição em Interessados (IFI-S1); mostrar "Cuidados no treino" das lesões ativas no editor de treino; demais sugestões da seção 8 do relatório. Anotadas em "Pendências soltas" do README.

## O que ficou para trás
- Decisão a confirmar pelo Gustavo: no mural do aluno, abaixo de 1280 px a coluna vira um cartão só "Seus números" no topo (com os dois cartões, o feed ficava abaixo da primeira dobra).
- "Hoje" primeiro vale da faixa `larga` em diante; em 1280 e no celular a ordem segue Dieta › Água › Hoje (specs existentes conferem essa ordem).
- Mural do aluno em 3440: o bloco feed + coluna fica à esquerda dos 1688 centralizados e sobram ~600 px à direita.
