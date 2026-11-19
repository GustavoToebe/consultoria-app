# Importação guiada (evolução da importação assistida para o piloto)

Situação: Em andamento · Onde: `main` · Atualizado: 19/11/2026

## Objetivo
Evoluir `importacao/assistida/` para entregar uma importação guiada confiável para o piloto inicial de 5 alunos, com arquitetura enxuta e mantendo todas as garantias de segurança, rastreabilidade e idempotência.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Base arquitetural | Evoluir o módulo `importacao/assistida/` (`V066`) em vez de criar 15 tabelas novas, S3 dedicado ou fila distribuída com lease/fencing | Coordenador / Plano |
| 2 | Manual e planilha completa | A importação manual (`TelaImportacao`) e a `planilha-completa` ficam deixadas de lado por enquanto (mantidas intactas, fora do escopo do piloto; eventual unificação só após validação do piloto) | Coordenador / Plano |
| 3 | Extração de PDF | Extração de PDF textual via Apache PDFBox com diagnóstico explícito de páginas lidas vs. sem texto/digitalizadas (sem OCR por enquanto) | Coordenador / Plano |
| 4 | Ocorrências, perguntas e respostas | Ocorrências com ID estável + origem; perguntas com alvos explícitos; alterar/revogar resposta reconstrói a partir do extraído (sem `replace` cego); candidatos reais da biblioteca (sem sugestões/confianças hardcoded) | Coordenador / Plano |
| 5 | Confirmação segura | Confirmação travada em `hashPrevia`, seleção explícita (`gruposIds` obrigatório, vazio recusado) e `chaveIdempotencia`, mantendo 1 transação por grupo e planos sempre em rascunho | Coordenador / Plano |
| 6 | Permissões conservadoras | Permissões restritas na entrada/leitura de sessões mistas (política conservadora para o piloto) | Coordenador / Plano |
| 7 | Processamento assíncrono leve | `POST /processar` com `202` + estado `PROCESSANDO` + polling com timeout | Coordenador / Plano |
| 8 | Retenção dos bytes | Reter `conteudo_bytes` em `importacao_arquivo` durante a revisão até conclusão integral ou expiração (7 dias), respeitando teto de tamanho, permissões e anonimização | Coordenador / Plano |

## Passos
- [x] 1. Bloco 1: Extração PDFBox + cobertura/diagnóstico + `modoProcessamento` + retenção de bytes durante revisão — commit/run: local sem commit (`mvn -f api/pom.xml test -Dtest="br.com.treinos.api.importacao.assistida.**"`: 40 testes, 0 falhas)
- [x] 2. Bloco 2: Ocorrências estáveis + perguntas/respostas com alteração/revogação + remoção de sugestões/confianças hardcoded — commit/run: local sem commit (`mvn -f api/pom.xml test -Dtest="br.com.treinos.api.importacao.assistida.**"`: 44 testes, 0 falhas)
- [x] 3. Bloco 3: Confirmação (`hashPrevia`, `gruposIds` obrigatório, `chaveIdempotencia`) + matriz de permissões + listagem/cancelamento de sessões + processamento assíncrono leve — commit/run: local sem commit (`mvn -f api/pom.xml test -Dtest="br.com.treinos.api.importacao.assistida.**"`: 44 testes, 0 falhas)
- [x] 4. Bloco 4: App (`app/`): retomada de sessões, modo efetivo, diagnóstico de leitura, editar/revogar respostas, seleção explícita, atalho em `Primeiros passos` e `acoesAuditoria.ts` — commit/run: local sem commit (`npm run typecheck`, `npm run lint`, `npm test`: 372 suítes / 8.892 testes verdes)
- [ ] 5. Bloco 5: Verificação completa (`mvn verify`, `npm run typecheck && npm run lint && npm test`) e revisão técnica final — commit/run: —

## Fora do escopo
- Unificação da importação manual (`TelaImportacao`) e `planilha-completa` (deixadas de lado por enquanto, mantidas intactas).
- Storage S3 dedicado / GC de órfãos.
- Fila distribuída (lease/fencing).
- OCR.
- Conectores externos além do já existente.
- Reconciliação incremental 3-vias (F6–F12).

## O que ficou para trás
- (nenhum item ainda)
