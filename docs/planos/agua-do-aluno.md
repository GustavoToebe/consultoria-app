# Água do aluno: marcar o que bebeu no dia

Situação: Feita na branch, falta publicar · Onde: branch `agua-do-aluno` (para entrar com a clareza do treinador) · Atualizado: 30/10/2026

## Objetivo
O aluno marca a água que tomou no dia, em copos de 250 ml, e vê quanto falta da "Água por dia" que o treinador escreveu
na dieta. O treinador vê na ficha quantos dias o aluno registrou e quanto foi em cada dia. É o passo 1.2 de
`engajamento.md`, só a parte da água.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | O que se marca | Copos de 250 ml (+/−); o servidor guarda mililitros (0 a 20.000), para um dia aceitar valor livre sem migration | Gustavo, 27/10 |
| D2 | Quando aparece | Só com dieta publicada em uso que tenha "Água por dia"; sem chave de ambiente (o treinador liga escrevendo a meta) | Gustavo, 30/10 |
| D3 | Dias | Na tela, hoje e até 6 dias para trás (Brasília). O servidor recusa dia futuro e dia anterior a hoje − 60 | Gustavo, 27/10 |
| D4 | Nada calculado | "1,5 L de 3,0 L" e uma barra; sem cor de alerta, sem "bateu a meta", sem meta calculada | Regra do projeto |
| D5 | Sensível | Dado de dieta: o treinador lê com `REGISTRO_LER` + `ALUNO_SENSIVEL_LER`; exportação com a permissão sensível; anonimização e "Excluir minha conta" apagam | Gustavo, 27/10 |
| D6 | "Como foi seguir o plano hoje?" | Fora desta frente (continua no passo 1.2 do engajamento) | Gustavo, 30/10 |
| D7 | Início × Dieta | No Início o cartão é compacto (só hoje, botões na linha dos números) para o "Ver meu treino" seguir na primeira tela do celular; na aba Dieta, o cartão inteiro com os 7 dias | Claude, 30/10 |
| D8 | Meta no treinador | A ficha usa a "Água por dia" da dieta publicada ativa (precisa de `DIETA_LER`); sem ela, as linhas saem sem a meta | Claude, 30/10 |

## Passos
- [x] 1. API (V046 `agua_do_dia`, rotas do aluno e do treinador, exportação, anonimização), app do aluno (Início compacto e Dieta com os 7 dias, fila offline), cartão na ficha, ajuda e guias — commit/run: o commit desta frente na branch `agua-do-aluno` (`AguaDoDiaIntegrationTest` 10, Jest 2589, e2e completo 337 em 390 e 1280)
- [ ] 2. Publicar junto com a clareza do treinador (PR para a `main`) — commit/run: —

## Fora do escopo
- Adesão ao plano ("Como foi seguir o plano hoje?"): `engajamento.md`, passo 1.2.
- Lembrete de beber água (notificação): não pedido.

## O que ficou para trás
- (nada ainda)
