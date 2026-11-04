# Copiar período na pasta nova

Situação: Em andamento · Onde: branch `copiar-periodo-na-pasta` · Atualizado: 04/11/2026

## Objetivo
Na "Nova pasta", o treinador pode copiar treino e dieta de um período já concluído, sem abrir a pasta de origem.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | O campo "Copiar de" só aparece com mais de uma pasta e pelo menos uma finalizada | Só pastas com `concluidaEm`; pasta aberta não entra. Uma pasta só, mesmo concluída, não mostra o campo | Gustavo, 04/11 |
| 2 | Copiar usa o replicar que já existe | Rascunho dos planos publicados; o período sugerido é o ciclo seguinte da origem | Gustavo, 04/11 |

## Passos
- [ ] 1. Campo na Nova pasta, regra e e2e — commit: —

## Fora do escopo
- A API não muda: continua `POST /pastas/{id}/replicar`.
- "Copiar para outro período" na folha da pasta continua como está.

## O que ficou para trás
- Nada.
