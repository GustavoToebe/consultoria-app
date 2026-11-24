# Ficha: folha de Registrar e Editar lesão

Situação: Em andamento (sem commit) · Onde: branch `ficha-24-11` · Atualizado: 24/11/2026

## Objetivo
A folha de lesão fica mais rápida de preencher (atalhos de região e de lado, "Hoje" no início) e mais clara (o que é
obrigatório, o que cada campo guarda e quem vê a observação), sem mudar a API: continua gravando o mesmo texto de região.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Região continua texto livre (até 80, `LesaoRequest.regiao`); chips de região (Ombro, Cotovelo, Punho, Cervical, Lombar, Quadril, Joelho, Tornozelo) e lado (Direito, Esquerdo, Ambos) só preenchem o campo | `dominio/folhaDeLesao.comporRegiao`/`lerRegiao`; lado sem região não preenche; região sem lado é só a região; trocar de chip recompõe com o mesmo lado | Gustavo (pedido de 24/11) |
| 2 | Concordância: "Lombar direita", "Cervical esquerda"; "Ambos" vira "Ombro (ambos os lados)" | Texto escolhido pelo agente; jest pina as 24 combinações | Agente (noite de 24/11) |
| 3 | Rótulos: "Região do corpo (obrigatório)", "O que é (opcional)", "Cuidados no treino (opcional)" | "(obrigatório)" espelha o "(opcional)"; o "*" do app só existe no endereço, com legenda | Agente |
| 4 | Quem vê a observação ("Cuidados no treino") | Só a equipe com `ALUNO_SENSIVEL_LER`: histórico da ficha (Dados) e exportação do aluno; não aparece para o aluno, no Resumo (só a contagem) nem no editor de treino. Texto de apoio no campo diz isso | Agente (conferido no código) |
| 5 | Fim só com a situação "Recuperada"; fora dela o corpo leva `dataFim: null` (o PUT substitui o registro inteiro) | `analisarLesao` | Gustavo |
| 6 | "Hoje" (Brasília, `hojeEmBrasilia`) ao lado do Início, entre os dois campos de data | Início e Fim com o mesmo tamanho lado a lado; empilhados, o Início fica mais estreito (o botão fica na linha dele) | Agente |
| 7 | Salvar apagado diz o que falta pelo `motivo` do `Botao` (P5): "Informe a região do corpo", "Corrija a data de início", "Corrija a data de fim"; fim antes do início = erro no campo Fim ("O fim vem antes do início.", a mesma frase da Copiar pasta) | | Gustavo + agente |
| 8 | "Sair sem salvar?" pelo `useFecharComAviso` (o da Agenda e da Comunidade); só com alteração (Fim escondido não conta) | `lesaoAlterada` | Gustavo |
| 9 | A folha mora em `treinador/FolhaLesao.tsx` (saiu do `CartaoLesoes.tsx`, que é da tabela) | | Agente |

## Passos
- [x] 1. Regra pura `dominio/folhaDeLesao.ts` + jest (24 combinações, limite de 80, fim, corpo, alterado) — commit/run: — (jest verde em 24/11)
- [x] 2. `treinador/FolhaLesao.tsx` com chips, lado, textos, "Hoje", Fim condicional, motivo do Salvar e "Sair sem salvar?" — commit/run: —
- [x] 3. E2e `e2e/ficha-folha-de-lesao.spec.ts` (390 e 1280) e ajuste de `e2e/datas-validas.spec.ts` (o Fim agora pede Recuperada) — commit/run: —
- [x] 4. Capturas em `capturas/24-11/item-6-folha-lesao/` (390 e 1280; escuro, claro, Areia; texto grande) — fora do git

## Fora do escopo
- Colunas "Região", "O que é", "Período", "Situação" e o rótulo "Cuidados no treino" da tabela do Histórico (agente da tabela).
- API: nenhuma mudança.

## O que ficou para trás
- Situação (3 opções) quebra em duas linhas com texto grande no celular: é a `Escolha` compartilhada, não foi mexida.
- Aparelho com fuso atrás de Brasília perto da meia-noite: "Hoje" (Brasília) pode passar do limite do `CampoData` (que usa o dia do aparelho, `hojeIso`) e o campo mostra a faixa. Não tocado: é da peça `CampoData`.
- Cervical e Lombar aceitam o lado "Direito/Esquerdo" (sem lateralidade clínica); o app não interpreta saúde, então não restringe.
