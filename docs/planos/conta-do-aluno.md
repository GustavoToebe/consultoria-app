# Conta do aluno reorganizada

Situação: Entregue sem commit · Onde: main (working tree) · Atualizado: 23/11/2026

## Objetivo
A Conta do aluno passa de uma pilha de cartões a um cabeçalho de perfil (foto, nome como os colegas veem, e-mail de acesso
e selo do plano) e seções agrupadas no estilo lista de ajustes, com os formulários em folhas de detalhe. Só organização e
apresentação: dados, rotas, permissões e regras continuam as de antes.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Ordem | Cabeçalho · Meu plano · Perfil na Comunidade · Meus dados · Ciclo menstrual (só quando existe) · Convidar um amigo · Privacidade · Segurança · App · Excluir minha conta (separado) | Gustavo (pedido de 23/11); o ciclo, que o pedido não citava, fica depois de Meus dados (o sexo mora lá) |
| D2 | Detalhes | `Folha lateral`: painel à direita no PC, folha de baixo na largura toda no celular (é o que a Conta já usava em "Aparência e preferências"); sem rota nova | executor-front, leitura de "sub-tela no celular" |
| D3 | Web | Duas colunas com a área medida (`useFaixaDeLargura`, faixa normal ou maior): à esquerda 320 px fixos ao rolar (cabeçalho + índice), à direita as seções em `LARGURA_FORMULARIO`; abaixo disso, uma coluna | Gustavo |
| D4 | Uma regra de salvar por tela | Interruptores salvam na hora; Meu perfil, Meus dados e Trocar senha usam o rodapé da folha ("Tudo salvo" / "Alterações não salvas" + Descartar + Salvar) | Gustavo |
| D5 | Meu perfil | Apelido entra no mesmo Salvar do perfil (duas rotas: apelido primeiro, depois o perfil; falha parcial grava o que deu); somem "Salvar apelido", "Remover apelido" (apagar = deixar o campo vazio e salvar) e a frase que mandava ao "cartão Comunidade" | Gustavo |
| D6 | Convite | O link não aparece na tela; só "Copiar link" e "Compartilhar"; se a cópia falhar, o link aparece selecionável para copiar à mão | Gustavo; a reserva é do executor-front |
| D7 | CPF | Mascarado (`***.456.789-**`) com "Mostrar CPF" (alternar, nome fixo); a regra de quem edita não muda | Gustavo |
| D8 | Dados lidos uma vez | `GET /aluno/meus-dados`, `/aluno/comunidade/perfil` e `/aluno/indicacao` são lidos pela tela e passados às peças (antes eram 3 leituras de meus-dados) | executor-front |
| D9 | "Trocar foto" | Desabilitado sem internet, com o motivo (antes falhava ao enviar) | executor-front |

## Passos
- [x] 1. Regras puras (`dominio/contaDoAluno.ts`) e textos (`meusDados`, `perfilDaComunidade`) com jest — commit/run: sem commit; `npx jest` local verde (395 suítes, 9380 testes), 23/11
- [x] 2. Tela e peças (`app/aluno/conta.tsx`, `aluno/conta/`) — commit/run: sem commit; `tsc --noEmit` limpo, `npm run lint` 0 erros, 23/11
- [x] 3. e2e ajustados e novos (`e2e/conta-do-aluno.spec.ts`), comentário "conta do aluno reorganizada (23/11)" — commit/run: sem commit; e2e local na porta 8166 verde nas specs da Conta (conta-do-aluno, auditoria-aluno, comunidade, convidar-amigo, meus-dados-aluno e perfil-comunidade: 268 passaram na última rodada; unidade-de-carga e as vizinhas em rodadas anteriores), 23/11
- [x] 4. Capturas 390 e 1280, escuro e claro (fora do repositório) — commit/run: sem commit; capturas no scratchpad da sessão, 23/11

## Fora do escopo
- Subir a `BarraDeSalvar` de `treinador/financeiro/AjustesDaAba` para `ui/` (sugestão para o design system).
- Texto da Ajuda (`ajuda/conteudo.ts`, "Apelido e meu perfil") e PDFs dos guias: com o coordenador.

## O que ficou para trás
- Commit do bloco (sessão principal). Base: working tree local de 23/11, sem commit; revalidar se `aluno/` ou `e2e/` da Conta mudarem antes do commit.
- `e2e/financeiro.spec.ts`: 4 falhas na folha "Cobrança de saída" do treinador (arquivo alterado por outra frente; não toca a Conta).
- Não conferido: nativo (Android/iOS), leitor de tela, temas Areia e alto contraste, setas nos grupos de rádio (cor e moldura não têm foco itinerante, como o `OpcaoCartao`).
- Ajuda (`ajuda/conteudo.ts:544` ainda fala do "cartão Comunidade") e PDFs dos guias; comentário em `ui/contrasteDasPecas.test.ts:225` cita peça removida.
- `AGENTS.md` e `docs/design-e-front.md` citam `CartaoFotoDePerfil`, `CartaoMeusDados`, `CartaoApelido` e `CartaoMeuPerfil`, agora em `aluno/conta/*`.
