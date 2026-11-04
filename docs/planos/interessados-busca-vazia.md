# Interessados: busca vazia diz onde há resultado

Situação: Em andamento · Onde: branch `interessados-busca-vazia` · Atualizado: 03/11/2026

## Objetivo
Quando a busca ou o filtro deixa a lista de Interessados vazia mas há inscrições em outra situação (o filtro padrão "Em atendimento" esconde aceitas, recusadas e desistentes), o estado vazio diz onde elas estão e oferece "Ver todas". Sai da pendência "CRM, busca vazia" (ajustes-video-30-10, B8).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Sem chamada nova | Usa as contagens já carregadas (`GET /inscricoes/contagens`), que seguem os mesmos filtros (busca, responsável, origem, datas) menos a situação | Pedido |
| 2 | Texto | "Também há inscrições em: Aceitas (1), Desistiram (2)." (serve no singular, no plural e sem busca; antes era "Encontrada em") no lugar da dica genérica; o título do vazio fica | Confirmado pelo Gustavo em 04/11 |
| 3 | Onde aparece | Em qualquer lista vazia (busca, Meus, filtros, fila), só com situação individual diferente da atual e contagem maior que zero; "Em atendimento" e "Todas" não entram na lista | Confirmado pelo Gustavo em 04/11 |
| 4 | Botão | "Ver todas" troca a situação para Todas e mantém os demais filtros | confirmado pelo Gustavo em 04/11 |
| 5 | Contagem de outra busca | Enquanto as contagens da busca nova carregam, o aviso e o "Ver todas" somem (nada de dica com número de outra busca) | Revisão independente |

## Passos
- [x] 1. Regra pura em `estadoVazio` (`dominio/inscricoes.ts`) com teste jest — commit: ver `git log` da branch
- [x] 2. Ligação em `interessados.tsx` e e2e em `interessados-crm.spec.ts` — commit: ver `git log` da branch
- [x] 3. Pendência tirada do README

## Fora do escopo
- Kanban (não tem estado vazio de lista) e Indicadores.

## O que ficou para trás
- Nada.
