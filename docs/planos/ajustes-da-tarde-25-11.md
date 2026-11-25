# Ajustes do documento de 25/11 (tarde): ficha, importação, endereço, acesso, dieta e redes

Situação: Em andamento · Onde: main (a partir de `64c1ee40`) · Atualizado: 25/11/2026

## Objetivo
Aplicar o lote do Gustavo de 25/11 à tarde (monitor 24" 16:9, 1920×1080, zoom 100%): ficha do aluno e importação assistida aproveitando a largura, endereço com preenchimento automático do Chrome, acesso ao app (alterar e-mail, desativar/reativar), dieta (opções A/B, "+ Opção", Fibras e tamanho dos campos, investigação do ovo), redes sociais da consultoria e do aluno, e os dois itens que sobraram do lote da manhã (balão do ⓘ, toast no celular). Mexe na API (V100 e V101): `mvn verify` e e2e completa antes do push.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Ficha em 1920 | Tira o teto de 1400 das duas colunas (normal e larga); a preferência "Largura do conteúdo" vale; ultralarga continua com 3 colunas; plano vazio pode deixar espaço embaixo do "Plano contratado" | Gustavo |
| D2 | Importação assistida em 1920 | Conteúdo na largura toda; a partir de 1600, coluna lateral de ~360 px fixa ao rolar com o resumo e a próxima etapa; "Termos para conferir" em tabela compacta | Gustavo |
| D3 | Desativar acesso | Não apaga nada; colunas novas em `aluno` (`acesso_desativado_em`, `acesso_desativado_motivo`, hoje só `MANUAL`); é a base da Fase 2 (pausar por atraso); não é o mesmo que inativar o aluno | Gustavo (pedido), sessão (modelo) |
| D4 | Balão do ⓘ e toast | Balão montado só quando aberto; toast acima de qualquer rodapé fixo e da área segura; o botão de fechar já existe no persistente; `filtros-laterais-entrada:58` só registrar | Gustavo, em 25/11 |
| D5 | Ícones das redes | SVG inline do simple-icons (CC0), como o do WhatsApp; sem dependência nova | sessão |

## Passos (um dono por arquivo por onda)
- [x] T-101 API: V100 acesso (desativar/reativar, alterar e-mail, e-mail de aviso, auditoria) e V101 redes (consultoria e aluno, `/eu`, Meus dados, LGPD) — executor — commit `84f85122`; `mvn verify` na integração
- [x] T-102 Ficha do aluno em 1920 (`colunasDaFicha`, `BlocosDaFicha`) — executor-front — commit `36bf8fb1`
- [x] T-103 Importação assistida: coluna lateral, tabela de termos, termo vazio (API `DecodificadorDaProposta` e app) — executor-front — commit `36bf8fb1`
- [x] T-104 Endereço: separar número da rua, autofill do Chrome limpa os erros, atributos `autocomplete` — executor — commit `36bf8fb1`
- [x] T-105 Acesso ao app no app: Alterar e-mail, Desativar/Reativar acesso — executor-front — commit `36bf8fb1`
- [x] T-106 Dieta: "+ Opção" `acao`, opções A/B com círculo, Fibras (cabeçalho em uma linha) e campos do item manual — executor-front — commit `36bf8fb1`
- [x] T-107 Redes sociais no app (Contato, Conta e Início do aluno, Meus dados, cadastro e ficha) — executor-front — commit `36bf8fb1`
- [x] T-108 Balão do ⓘ só aberto e toast sobre rodapé fixo — executor — commit `36bf8fb1`
- [x] T-109 Investigação do ovo (só relatório, nenhum dado de cliente corrigido) — explorador — relatório no fim da sessão (origem MANUAL "Plano do treinador" de 29/10; alimento corrigido na produção por ele; dietas antigas mantêm os valores)
- [x] T-110 Dieta: campo Quantidade do item manual alinhado ao nome e unidade como segmento interno do contorno (`CampoDaQuantidade`, `CartaoRefeicao`) — executor-front; commit `36bf8fb1`; `dieta-tabela.spec.ts` 8/8
- [ ] Integração final: `tsc`, lint, jest, e2e completa, `mvn verify`, guias PDF se a Ajuda mudar, commits por caminho, push se verde

## Pendências e decisões em aberto
- Ovo: o nome "Ovo inteiro cozido ou frito (grande)" não está nas migrations nem no seed do repositório; a origem real está no banco do Gustavo (ver relatório).
- Instagram da Inscrição preenchendo o do aluno: a Inscrição não tem campo Instagram hoje (só a origem `INSTAGRAM` do CRM); ver relatório.

## Fora do escopo
- Fase 2 (pausar acesso por atraso): só a base (motivo como campo).
- Corrigir dado de cliente (alimentos) sozinho.
