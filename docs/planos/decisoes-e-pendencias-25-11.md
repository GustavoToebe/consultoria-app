# Decisões e pendências do lote de 25/11 (noite): largura da edição, acesso, redes, Inscrição, toast e pendências

Situação: Em andamento · Onde: branch `lote-26-11` (cópia `wtm`, saída de `8d8b5b17`), entra na `main` por fast-forward · Atualizado: 25/11/2026

## Objetivo
Aplicar as decisões do Gustavo sobre as quatro dúvidas abertas do lote da tarde ([ajustes-da-tarde-25-11.md](ajustes-da-tarde-25-11.md)) e fazer as pendências soltas que ele mandou fazer agora. Push autorizado se ficar verde; mexe na API → `mvn verify`; toca `Folha`, toast ou `Tela` → suíte e2e completa.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Formulário de edição da ficha (`DadosDoAluno`) e `ListaEmColunas` | Sem o teto de 1400 nas faixas normal e larga, igual à ficha de leitura (respeita "Largura do conteúdo"); ler e editar ficam com a mesma largura | Gustavo, 25/11 |
| D2 | Selo de acesso desativado | Com o "●", no padrão dos outros selos de situação | Gustavo, 25/11 |
| D3 | Redes da consultoria | Só na Conta do aluno; não aparecem no Início | Gustavo, 25/11 |
| D4 | Inscrição e Instagram | Campo fixo opcional "Instagram (opcional)" depois dos campos de contato, que preenche as redes do aluno ao virar aluno; aviso no editor das Perguntas da inscrição quando existir pergunta personalizada com "instagram" no texto: "Já existe o campo fixo Instagram. Quer remover esta pergunta?"; nunca remove sozinho | Gustavo, 25/11 |

## Passos (um dono por arquivo por onda)
- [ ] T-201 Edição da ficha e `ListaEmColunas` sem teto de 1400 em 1920 (D1) — executor-front
- [ ] T-202 Selo de acesso desativado com "●" (D2) — executor-front
- [ ] T-203 Redes só na Conta do aluno, fora do Início (D3) — executor-front
- [ ] T-204 Inscrição: campo Instagram (migration V102, API, formulário público, detalhe, aceite → aluno) e aviso no editor das Perguntas (D4) — executor (API) e executor-front (app)
- [ ] T-205 Toast no nativo e na `TelaDoEditor` (acima do rodapé fixo e da área segura, sem cobrir botões) — executor-front
- [ ] T-206 Importação assistida: ao entrar, foco no título da tela (ou na primeira ação pendente) — executor-front
- [ ] T-207 API: troca de e-mail de acesso devolve `emailEnviado`; o app mostra "Avisamos o aluno no e-mail novo" só com `true` e, senão, "O envio de e-mails está desligado; avise o aluno" — executor
- [ ] T-208 API: plural de verdade em `ConfiguracaoConsultoria.java` ("série(s)" e "percentual(is)") — sessão principal
- [ ] T-209 Início do aluno: `GET /aluno/sessoes-concluidas` uma vez só em 1280 — executor
- [ ] T-210 `e2e/tela-larga.spec.ts` apaga a pasta temporária das capturas ao fim — sessão principal
- [ ] T-211 `filtros-laterais-entrada.spec.ts:58`: investigar a causa (até 30 min); spec com defeito se corrige, defeito do app (o painel não anima no web) se registra e segue — executor
- [ ] T-212 Editor de dieta: 3 colunas em ≥ 1600 (editor flexível, Total do dia ~400 px na larga e ~460 px na ultralarga, fixo ao rolar) e Total do dia com 4 macros numa linha, seção "Por refeição" e rótulo "Água por dia, em litros (opcional)" — executor-front
- [ ] T-213 Opções da refeição como abas (círculo, kcal ou "vazia", "+ Nova opção" tracejada, ⋯ com excluir e Desfazer, total da opção, aluno sem o "+") e "Adicionar alimento" em `acao` — executor-front
- [ ] T-214 Variações por dia como abas com faixa da semana (7 botões com o número da variação), nome com contador 0/40, Duplicar, Usar em todos os dias e Excluir — executor-front
- [ ] T-215 Editor de treino: ≥ 1600 com inspetor flexível sem faixa vazia à direita; conferir "Adicionar exercício" em `acao` — executor-front
- [ ] T-216 Editor de dieta › Complementos num cartão com abas (Orientações, Observações, Suplementação): orientações em lista compacta reordenável, observações em largura de leitura, suplementação em tabela com cabeçalho uma vez, selo de aviso na aba — executor-front
- [ ] T-217 API: ao publicar plano de dieta ou de treino, tira "(rascunho)" do título e troca o nome padrão da importação por "Dieta de <aluno>" ou "Treino de <aluno>" — executor
- [ ] T-218 App do aluno › Dieta: fibra nos itens, nas refeições, na opção e no Total do dia; Medicação e ergogênicos e Suplementação agrupadas por horário, dose em pílula, lado a lado na tela larga; sem o nome técnico do plano sob o título — executor-front (começa quando a T-213 liberar `DietaDoAluno.tsx`)
- [ ] Integração final: `tsc`, lint, jest, e2e completa, `mvn verify`, Ajuda e guias PDF se o texto mudar, capturas em 1920 (escuro e claro) de edição da ficha, Acesso ao app desativado, Conta do aluno com as redes e editor da Inscrição com o aviso, commits por caminho, push se verde

## Pendências e decisões em aberto
- Continuam pendentes por decisão do Gustavo (não fazer agora): `Tela` expor "ainda não mediu" e as sugestões pós-lançamento de 24/11.

## Segundo pedido da noite (editores)
Editores de dieta e de treino: tela larga, opções da refeição e variações por dia (T-212 a T-218); push autorizado se ficar verde; no e2e, specs dos editores de dieta e de treino e da dieta do aluno, mais a suíte completa por tocar toast e peça compartilhada do primeiro pedido.

## Fora do escopo
- Fase 2 (pausar acesso por atraso).
- Remover sozinho a pergunta personalizada parecida com o Instagram.
