# Tela larga: revisão de Equipe, Ajuda e Ajustes (7b)

Situação: Concluída em 24/11/2026 (sem commit; a sessão principal commita) · Onde: branch `tela-larga-revisao` (worktree `tela-larga-24-11`, sem commit) · Atualizado: 24/11/2026

## Objetivo
Conferir em 1920, 2560 e 3440 px (menu aberto, tema escuro) as telas de Equipe, Ajuda e Configurações e consertar o que
estica ou deixa vão grande, pela 4.10 de `docs/design-e-front.md`: o espaço extra vira colunas, nunca elementos esticados.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Telas com teto próprio abaixo de 1800 (Marca 1040, Assinatura e faturas 1040, Tags 1040) | Ficam como estão: a 4.10 manda manter o teto próprio; o vão de ~31% de cada lado em 3440 fica abaixo de 1/3 | Claude (noite de 24/11) |
| D2 | Hub de Configurações | De 2 até 4 colunas de ~508 px conforme a largura, bloco centrado; colunas contadas pelos grupos que o perfil vê (não pela busca) e sem deixar um cartão sozinho na última linha quando der; em 1280 continua em 2 colunas. Sobrescreve o H9 de `configuracoes-centralizadas.md` ("duas colunas no PC") nas faixas larga e ultralarga | Claude (noite de 24/11), a confirmar pelo Gustavo |
| D3 | Equipe › Membros | Na faixa larga e ultralarga a lista vira `Tabela` (colunas Membro, Perfil, Situação, Último acesso, Limite e Ações), no cartão com teto de `LARGURA_MAXIMA` como a Auditoria; abaixo continua a `ListaDeLinhas` de antes | Claude (noite de 24/11) |
| D4 | Equipe › Perfis | Cartões dos perfis em `Grade` (células de pelo menos 560 px), no cartão com teto de `LARGURA_MAXIMA`: 2 por linha em 1920, 3 em 2560 e 3440; em 1280 continua uma coluna | Claude (noite de 24/11) |
| D5 | WhatsApp oficial | Quando a área cabe Conexão (640) + vão + Modelos em 2 colunas + recuo do cartão, lado a lado; os modelos numa `Grade` (1, 2 ou 3 colunas pela largura) | Claude (noite de 24/11) |
| D6 | Ajustes | Conteúdo centrado com teto de 1464 px (as duas colunas de 720 da `PreferenciasDoApp`, que não muda) | Claude (noite de 24/11) |
| D7 | Ajuda | A 3ª coluna (Consultar) abre quando o bloco de três cabe na largura medida (1880 px), não só na faixa `ultralarga`: em 2560 com o menu aberto (área de 2320) já abre | Claude (noite de 24/11) |
| D8 | Auditoria | Sem mudança: a tabela segue com teto de 1800 px; usar a sobra pede painel de filtros fixo ou de detalhe (decisão de produto / peça compartilhada) | Claude (noite de 24/11), sugestão ao Gustavo |

## Passos
- [x] 1. Capturas "antes" em 1920, 2560 e 3440 — `capturas/24-11/tela-larga/<tela>/antes/` (fora do git)
- [x] 2. Hub de Configurações (D2), regra pura `dominio/colunasPorCelula.ts` e teste — commit: — (sem commit, worktree)
- [x] 3. Equipe › Membros e Perfis (D3, D4) — commit: —
- [x] 4. WhatsApp oficial (D5) — commit: —
- [x] 5. Ajustes (D6) — commit: —
- [x] 6. Ajuda (D7) — commit: —
- [x] 7. Capturas "antes" e "depois" refeitas com build limpa (Metro com `TEMP` próprio e `--clear`), 1280 e 390 nos temas; e2e `tela-larga-equipe-ajuda-ajustes.spec.ts` (6 passaram; a geometria falha na build "antes", como esperado); typecheck, lint e jest — evidência no relatório `capturas/24-11/tela-larga/equipe-ajuda-ajustes-relatorio.md`

## Fora do escopo
- Editor de perfil em matriz (folha), modais e folhas.
- Peças compartilhadas (`ui/*`): sugestões no relatório do grupo.

## O que ficou para trás
- Ver o relatório `capturas/24-11/tela-larga/equipe-ajuda-ajustes-relatorio.md` (sugestões e achados).
