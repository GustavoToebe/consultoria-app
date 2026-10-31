# Importação em tela inteira e ajustes da planilha real

Situação: Concluída em 31/10/2026 · Onde: `main` (c7d1b2b, PR 24) · Atualizado: 31/10/2026

## Objetivo
Ajuste da reunião de 30/10: a importação travou na planilha real do Saraiva. O assistente vira uma tela inteira (na Folha
cabiam quatro colunas), o "x" que o treinador usa para vazio deixa de derrubar a linha, erro de fórmula da planilha vira
erro claro e o resultado mostra os erros agrupados em vez de uma linha por erro.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Onde | Tela própria `/treinador/importacao/nova`, com etapas no topo e Voltar/Validar na base, presos; histórico continua em Importação | Gustavo, 31/10 |
| D2 | Marcadores de vazio | `x`, `-`, `–`, `—` sozinhos na célula = vazio (também na correção da tabela) | Gustavo, 31/10 |
| D3 | Erro de fórmula | `#ERROR!`, `#N/A`, `#REF!`, `#VALOR!` e parecidos = célula com erro, com texto fixo que diz o que fazer | Gustavo, 31/10 |
| D4 | Título com cara de dado | Aviso na Configuração e no Mapeamento, sem repetir o texto (pode ser dado de pessoa) | Gustavo, 31/10 |
| D5 | Resultado | Título "Importação de <destino>" (o nome do arquivo não fica guardado); erros agrupados por campo e motivo | Gustavo, 31/10 |
| D6 | Sair no meio | Pergunta "Sair sem salvar?" (guarda dos editores), porque nada da tela fica guardado | Claude |

## Passos
- [x] 1. API: `Celula.deTextoLido` no leitor (CSV, xlsx e correção da tabela), `CELULA_COM_ERRO`, testes do leitor — commit: c7d1b2b
- [x] 2. App: rota `/treinador/importacao/nova`, `AssistenteDaImportacao` em `TelaDoEditor` com `rodape`, tabela com cabeçalho parado, guarda de saída, aviso de título, erros agrupados, título do resultado — commit: c7d1b2b
- [x] 3. Ajuda, guia do treinador, AGENTS.md e e2e `importacao.spec.ts` (390 e 1280) — commit: c7d1b2b

## Fora do escopo
- Importar a planilha inteira de uma vez (alunos, pesos, dietas, treinos): frente própria, `importacao-planilha-completa` (em andamento na nuvem, só a API por enquanto).
- Coluna do número da linha presa ao rolar para o lado.

## O que ficou para trás
- (nada ainda)
