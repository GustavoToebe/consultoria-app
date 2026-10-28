# Evolução a partir das referências da Prime Coaching

Situação: Em andamento · Onde: branch `claude/saraiva-api-direcionamento-treinos-dv10io` (frentes em branches locais `evo-*`, juntadas nela) · Atualizado: 28/10/2026

## Objetivo
Aproveitar o que o app já tem e cobrir o que falta nas sete imagens da Prime Coaching (briefing "Evolução do
consultoria-app", 28/10/2026): receitas, substituições, lista de compras, PDFs com a marca, avaliação física, agenda
presencial e lembretes de cobrança. As imagens são referência de funcionalidade, não de layout nem de marca.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Onde | Branch `claude/saraiva-api-direcionamento-treinos-dv10io` recriada da `main` (3c0c2cc); nada na `main` sem o Gustavo | Gustavo, 28/10 |
| 2 | Ordem | Correção do link da Minha conta → lista de compras, PDFs, evolução, receitas → agenda → lembretes | Gustavo, 28/10 (recomendação do Claude) |
| 3 | Lista de compras | 14 dias além de 7 e 30; "comprado", item avulso e ajuste de quantidade só no aparelho (sai no "Sair"), nunca mexem na dieta | Gustavo, 28/10 |
| 4 | Receitas | A refeição pronta (`REFEICAO`) continua; ganha só "Modo de preparo" opcional em texto. Sem rendimento, porções ou conversão | Gustavo, 28/10 |
| 5 | Substituições | Só apresentação das opções que o treinador cadastra (lado a lado, "escolha uma"); nada de equivalência calculada nem a palavra "equivalente" | Gustavo, 28/10 |
| 6 | PDFs | Logo na faixa da marca e cabeçalho uniforme. Temas (2 ou 3) e prévia própria ficam para depois | Gustavo, 28/10 |
| 7 | Avaliação física | Data, circunferências em cm e observação; peso vem do registro de peso da data; sem dobras, % de gordura ou classificação; só a equipe registra (permissões do peso); comparar 2 a 4 datas e PDF | Gustavo, 28/10 |
| 8 | Agenda presencial | Só a equipe marca; um responsável, duração, local em texto, sem recorrência; sem dois atendimentos do mesmo responsável no mesmo horário (servidor); AGENDADO/REALIZADO/CANCELADO/FALTOU; junto da agenda de atualizações | Gustavo, 28/10 |
| 9 | Lembretes de cobrança | Só e-mail (Resend do app), desligado por padrão, 3 dias antes / no dia / 3 depois configuráveis, param quando paga/cancela; WhatsApp só o botão manual com a mensagem pronta | Gustavo, 28/10 |
| 10 | Fora | Chat, IA de recuperação de vendas e pagamentos combinados (dois cartões, Pix + cartão, Apple/Google Pay) | Gustavo, 28/10 |
| 11 | Migrations | V035 avaliação física, V036 agenda, V037 lembretes. A branch `gamificacao` também usa V035: quem chegar à `main` depois renumera | Claude, 28/10 |

## Passos
- [x] 1. Minha conta aceita o checkout da InfinitePay devolvido pela Central (`FonteDaContaCentral.HOSTS_DE_CHECKOUT`, `FonteDaContaCentralTest` 15/15) — commit: dc4d738
- [ ] 2. Lista de compras: 14 dias, comprado, avulso, ajuste — plano [evolucao-lista-de-compras.md](evolucao-lista-de-compras.md) — commit: —
- [ ] 3. Receitas (modo de preparo), substituições e PDFs com a marca — plano [evolucao-dieta-e-pdfs.md](evolucao-dieta-e-pdfs.md) — commit: —
- [ ] 4. Avaliação física (V035) — plano [avaliacao-fisica.md](avaliacao-fisica.md) — commit: —
- [ ] 5. Agenda presencial (V036) — plano [agenda-presencial.md](agenda-presencial.md) — commit: —
- [ ] 6. Lembretes de cobrança (V037) — plano [lembretes-de-cobranca.md](lembretes-de-cobranca.md) — commit: —
- [ ] 7. Juntar as frentes, acertar totais de migration e `AGENTS.md`, regerar os guias PDF, `mvn verify` (precisa de Docker: PC do Gustavo), e2e, e decidir PR/push com o Gustavo

## Fora do escopo
- Chat aluno-treinador, IA de recuperação de vendas, pagamentos combinados e carteiras digitais (decisão 10).
- Temas de documento e editor de PDF; autoagendamento pelo aluno; lembretes de consulta; envio automático por WhatsApp.

## O que ficou para trás
- Sem Docker nesta máquina: os testes de integração das frentes foram escritos, mas só rodam no `mvn verify` do PC do Gustavo.
