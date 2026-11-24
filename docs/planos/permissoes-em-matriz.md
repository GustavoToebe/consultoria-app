# Permissões em matriz (Equipe › Editar perfil)

Situação: Entregue (commit `67a661e5`, só local; sem push) · Onde: main · Atualizado: 23/11/2026

## Objetivo
O editor de perfil de acesso deixa de ser uma lista longa de caixas com texto comprido e vira uma matriz por seção:
uma linha por recurso, colunas Ver | Criar e editar | Publicar | Outras, com contagem por seção, filtro, resumo vivo e
dependências visíveis (caixa travada com o motivo). Só app; o contrato da API não muda.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Origem da matriz | Função pura `dominio/matrizDePermissoes.montarMatriz` sobre o catálogo da API (`GET /permissoes/catalogo`): seção = `secao`, recurso = `modulo`, coluna pelo sufixo do código (`_LER`/`_VER` Ver, `_ALTERAR` Criar e editar, `_PUBLICAR` Publicar), o resto em Outras com o verbo antes dos dois-pontos da descrição. Célula fixa ocupada = Outras (código novo nunca some). | Gustavo (pedido de 23/11) + executor-front |
| D2 | Ajustes por código | `ERGOGENICO_*` em linha própria "Medicação e ergogênicos"; `USUARIO_ALTERAR` = Outras "Convidar e editar membros" e `PERFIL_ALTERAR` = Outras "Criar e editar perfis", com dicas próprias (a API dava aos dois "Criar e editar: equipe."; corrigido em 23/11 em `CatalogoPermissoes`: "Criar e editar: membros da equipe." e "Criar e editar: perfis de acesso."; os ajustes por código ficam, agora só redundantes na descrição). | executor-front |
| D3 | Casos ambíguos que ficam em Criar e editar (texto longo vira dica) | Interessados (atender, aceitar e recusar), Agenda (marcar, remarcar e cancelar), Anamnese (enviar, dispensar e marcar revisada), Questionários (criar, editar e publicar), Financeiro (criar, editar e registrar pagamento), Vitrine (criar, editar, ordenar e apagar), WhatsApp (configurar). Check-in "Enviar e editar feedback" fica em Outras. | executor-front |
| D4 | Dado sensível | Selo "Dado sensível" (atenção, ícone de escudo) na célula do recurso se alguma permissão dele for sensível; cada caixa sensível leva "Dado sensível." na descrição acessível (PC). Resumo conta permissões, não recursos. | executor-front |
| D5 | Travada | Marcada e exigida diretamente por outra marcada = travada com "Necessária para <recurso: ação>[, … e …]." (ordem do catálogo); desmarcar a que depende libera. Acima do teto = travada com "Você não tem esta permissão: só quem a tem pode dá-la a um perfil." Travada fica no Tab (foco mostra o motivo), Espaço não muda. | Gustavo (pedido) + executor-front |
| D6 | Teto | Antes as permissões acima do teto sumiam; agora aparecem travadas com o motivo (sumida parecia "ação que não existe" na matriz). "N de M" e "Marcar toda a seção" contam só o que quem edita pode atribuir; seção sem nada atribuível diz "Nada que você possa atribuir", sem a caixa. | executor-front |
| D7 | "Marcar toda a seção" | Caixa com estado parcial (`aria-checked="mixed"`). Vazia ou parcial marca tudo o que se pode (e o que isso exige); cheia desmarca, mas o que outra seção exige fica marcado e travado (a seção volta parcial). | executor-front |
| D8 | Folha | 900 px no PC (constante da tela); no celular tela cheia (`Folha telaCheiaNoCelular`, opcional, nenhuma outra tela muda). | Gustavo (pedido) |
| D9 | Seções | Nascem fechadas (4.8); o filtro abre as que têm resultado e limpar volta ao de antes (`useSecoesAbertas`). | regra 4.8 |
| D10 | Dica | PC: balão (superfície + borda) no mouse e no foco, acima da caixa (abaixo na primeira linha ou perto do topo da janela); `aria-describedby` na web, `accessibilityHint` no nativo. Celular: escrita embaixo da ação. Dica que só repete recurso e coluna ("Consultar: cadastro.") não aparece. | executor-front |
| D11 | Barra de salvar | Rodapé da folha: Cancelar + "Salvar perfil" (sem nome: desabilitado com motivo); status "Alterações não salvas" ou o erro do servidor (409/403) no rodapé; fechar com alteração pergunta "Sair sem salvar?" (`useFecharComAviso`). O corpo enviado continua `{nome, descricao, permissoes: string[], ativo, versao}`. | Gustavo (pedido) |

## Passos
- [x] 1. Espelho das dependências: faltavam `ERGOGENICO_LER → BIBLIOTECA_LER` e `ERGOGENICO_ALTERAR → ERGOGENICO_LER` (marcar só os ergogênicos dava 400); paridade com o Java em `catalogoDePermissoesParidade.test.ts` — commit: —
- [x] 2. `dominio/matrizDePermissoes.ts` + teste (matriz, travas, seção, resumo, filtro, alteração) — commit: —
- [x] 3. Tela: `treinador/equipe/EditorDePerfil.tsx`, `SecaoDePermissoes.tsx`, `CaixaDePermissao.tsx`; `PerfisEquipe.tsx` usa o editor novo; `ui/Folha` ganha `telaCheiaNoCelular` — commit: —
- [x] 4. E2e `app/e2e/permissoes-em-matriz.spec.ts` (390 e 1280) e capturas 1280/390, escuro e claro, fora do repositório — commit: —

## Fora do escopo
- Corrigir a descrição de `PERFIL_ALTERAR` na API (`CatalogoPermissoes.java`, hoje igual à de `USUARIO_ALTERAR`): o app já mostra o nome certo pela D2; corrigir lá é da frente da API.
- Temas Areia e contraste alto, app nativo, leitor de tela real: não conferidos.

## O que ficou para trás
- API: dar a `PERFIL_ALTERAR` a descrição "Criar, editar, duplicar e excluir: perfis de acesso." (e a `USUARIO_ALTERAR` "Convidar, editar e desativar: membros da equipe."), mantendo a cópia em `app/src/dominio/catalogoDePermissoes.exemplo.ts` (o teste de paridade acusa).
