# Meus dados do aluno

Situação: Planejando · Onde: `main` (um push só, depois do publicar da correção do ciclo) · Atualizado: 28/10/2026

## Objetivo
Na aba Conta do aluno, logo depois da "Foto de perfil", o cartão "Meus dados": o aluno confere e corrige o próprio
cadastro (telefone, endereço, sexo e, se estiver vazio, CPF). Separado do ciclo: o cartão **não** depende de
`cicloHabilitado`. O sexo deixa o cartão do ciclo e passa a viver aqui.

## Relação com a correção do ciclo (mensagem J)
- A J ainda não foi entregue (28/10/2026, `origin/main` sem o commit dela). Ela termina só os itens 2a (503
  `CICLO_INDISPONIVEL_NO_APP` nunca vira erro; o cartão do ciclo some), 2c (causa do `cicloHabilitado` errado) e 2d. O item
  2b (esconder o `CartaoSexoDaAluna`) **não se faz mais**. A J sai no push dela; a K vem num lote seguinte, sem misturar.
- Se a J tivesse entrado com o 2b, a K traria o sexo de volta dentro do "Meus dados".
- O cartão do ciclo continua dependendo de `cicloHabilitado`.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Só leitura | Nome, e-mail do cadastro e e-mail de acesso. Texto: "Para mudar, fale com o seu treinador." | Gustavo, 28/10 |
| 2 | Editáveis | Telefone, endereço (CEP, logradouro, número, complemento, bairro, cidade, UF) e sexo (Não informado / Masculino / Feminino / Outro) | Gustavo, 28/10 |
| 3 | CPF | O aluno preenche só se estiver vazio; preenchido, fica só leitura (o treinador corrige pela ficha). Motivo: o aluno não pode testar CPFs para descobrir se já são de outro aluno (409 `ALUNO_CPF_EM_USO`) | Gustavo, 28/10 |
| 4 | Efeito | Grava na hora, sem aprovação do treinador; a ficha do treinador mostra o valor novo | Gustavo, 28/10 |
| 5 | Offline | Só com internet (some offline, como os outros cartões da Conta); nada fica no aparelho | Gustavo, 28/10 |
| 6 | Rotas | `GET` e `PUT /aluno/meus-dados`, `hasRole('ALUNO')`, sempre o aluno da sessão (nunca id no caminho ou no corpo). O `PUT` leva `versao`: 409 `CONFLITO_EDICAO` se o treinador salvou antes, e o app recarrega com aviso neutro | Gustavo, 28/10 |
| 7 | Regras reaproveitadas | `Formatos` (telefone, CPF, CEP, UF), endereço "vazio ou completo" com 422 `ALUNO_INVALIDO` por campo, CPF único por consultoria, telefone no `Usuario` (em branco apaga). Mesma normalização do `PUT /alunos/{id}` e da anamnese, sem duplicar | Gustavo, 28/10 |
| 8 | CPF diferente do já preenchido | 409 com código próprio (ex.: `CPF_SO_PELO_TREINADOR`); igual = sem efeito | Gustavo, 28/10 |
| 9 | Aluno inativo ou anonimizado | 409, como nas outras rotas do aluno | Gustavo, 28/10 |
| 10 | Rota antiga | Substitui o `PUT /aluno/sexo`: apagar a rota (sem compatibilidade); o teste dela vira teste da nova. As regras de sexo × ciclo seguem iguais | Gustavo, 28/10 |
| 11 | Auditoria | `ALUNO_DADOS_ALTERADOS_PELO_ALUNO`, ator = o aluno, resumo fixo, só quando algo mudou. **Nunca** valores (telefone, CPF, endereço, sexo) em auditoria, log ou mensagem de erro | Gustavo, 28/10 |

## Passos
- [ ] 0. Esta frente registrada (antes do primeiro commit de código) — commit: —
- [ ] 1. Esperar o publicar verde da J (correção do ciclo) e conferir os minutos do Actions (acima de 90%: deixar pronto e subir a partir de 01/11) — commit/run: —
- [ ] 2. API: `MeusDadosDoAlunoService` + controller, DTOs, `PUT /aluno/sexo` apagado, auditoria, `ArquiteturaTest` e `@PreAuthorize`; conferir que a exportação LGPD já cobre os campos — commit: —
- [ ] 3. `MeusDadosDoAlunoIntegrationTest`: lê e altera só os próprios dados; outro aluno não muda; 422 por campo e endereço parcial; CPF vazio grava; CPF preenchido 409; CPF de outro aluno 409 `ALUNO_CPF_EM_USO`; `versao` velha 409; inativo e anonimizado 409; auditoria sem valores; treinador vê o valor novo em `GET /alunos/{id}` — commit: —
- [ ] 4. App: regras puras em `dominio/meusDados.ts` (o que é editável, corpo do `PUT`, mensagens) com testes unitários — commit: —
- [ ] 5. App: `aluno/CartaoMeusDados` (fora do `CartaoCiclo.tsx`), com `ui/CamposDeEndereco` (busca de CEP), máscaras de `dominio/cadastroDoAluno`, sexo com `Escolha`, leitura primeiro e "Editar", Salvar/Cancelar, erros por campo e `useAviso`; apagar o `CartaoSexoDaAluna` — commit: —
- [ ] 6. e2e (API falsa, 390 e 1280 px): `cicloHabilitado:false` vê "Meus dados" e nada do ciclo, edita telefone e endereço (CEP preenche), troca o sexo; CPF preenchido só leitura; `cicloHabilitado:true` e Feminino mantém o cartão do ciclo — commit: —
- [ ] 7. Ajuda: `ajuda/conteudo.ts` (guia do aluno) e regenerar os PDFs dos guias; `AGENTS.md` com o item novo "Meus dados" e o ajuste no item do ciclo (o sexo saiu do cartão do ciclo) — commit: —
- [ ] 8. `mvn verify`, `npm run typecheck`, lint, test, o e2e novo e `npx expo export --platform android` verdes; um push na `main`; "em produção" só com o publicar verde — commit/run: —

## Fora do escopo
- Aluno mudar nome ou e-mail (fica com o treinador).
- Aprovação do treinador para as mudanças (decisão: grava na hora).
- Uso offline do cartão.

## O que ficou para trás
- A web recebe a mudança no publicar; o celular só num APK novo (entra em "Pendências soltas" do README quando a frente for entregue).
