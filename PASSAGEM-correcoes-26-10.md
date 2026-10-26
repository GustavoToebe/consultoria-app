# Passagem: correções da análise de 26/10

Branch `correcoes-26-10`, a partir de `origin/main` (30b641f). Nada disto está na `main` do remoto. **Um push na `main`
dispara o `deploy.yml` e publica em produção**: só com o "pode subir" do Gustavo, e depois do checklist abaixo.

Os arquivos de origem (`analise-26-10-pontos-criticos.md` e `checklist-antes-de-subir-para-producao.md`) ficam no
computador do Gustavo, fora do repositório. Este arquivo resume o que importa. Apague-o antes do merge na `main`.

## O que já foi feito (8 commits, cada achado com teste que falhou antes e passou depois)

| Commit | Assunto |
| --- | --- |
| f516a26 | C1: foto, logo, imagem do exercício e importação no celular (o `fetch` do Expo 57 recusa Blob de ArrayBuffer e `{uri,name,type}`). Helper `app/src/api/anexarArquivoDoAparelho.ts` |
| 1d3a7c9 | CSV com aspas: quebra de linha dentro de campo; aspas sem fechar = 422 |
| 73e8e96 | C2: `LeitorDePlanilha` com limite de coluna (256), de células (500.000) e de texto (4.000) |
| a6062b2 | Ciclo no app: fases, "hoje" de Brasília, menstruação esquecida (15 dias), "Mostrar fases" |
| 86db6f4 | Importação (C3 e outros): situação pelas regras do cadastro com `ALUNO_SITUACAO` só de quem mudou, CPF repetido, COMPLETAR, endereço em bloco, "Outros" por variante |
| d0caccc | Importação: "1.500" recusado, trava da consultoria, limite do plano sem 500, `nome_arquivo` só com a extensão |
| 8a052d9 | Ciclo na API: apagar com qualquer sexo, `gravarDia` confere o dono, `PUT /alunos/{id}` sem `sexo` não apaga o sexo, `PUT /aluno/sexo` sem 500 |
| a66633f | Comparação de fotos: limite fora da transação contando falhas, S3 e Java2D fora de transação, uma decodificação por foto com subamostragem, `ImageIO.setUseCache(false)`, anamnese só com `ANAMNESE_LER` |

Cada commit rodou só os testes da sua área. **Não rodou** o `mvn verify` completo, o e2e completo nem a suíte inteira do app.

## O que falta (nesta ordem)

1. **Revisão do conjunto** pelo `advisor` (ou agente `revisor`): são vários módulos, segurança, permissões e regra de negócio.
2. **Checklist da seção 2, uma vez, no estado final**:
   - `cd api && mvn verify` (JDK 25 e Docker; JaCoCo exige 70%). Maven sempre serial.
   - `cd app && npm run typecheck && npm run lint && npm test`.
   - `cd app && npm run e2e` (Playwright 1.56.1; localmente o Gustavo usa `PW_CHROMIUM` apontando para um chromium já instalado, não baixar browser novo).
   - `node --test scripts/importacao/*.test.mjs`, `node --test scripts/questionario/*.test.mjs`, `python -m unittest scripts/catalogo/test_catalogo.py`.
   - `git diff origin/main..HEAD --stat`, varredura de segredos, confirmar que não há migration nova (esperado: nenhuma). Se `conteudo.ts` mudar, `node scripts/guias/gerar.mjs`.
3. **APK de teste para o C1** (`docs/build-celular.md`, seção 2): `cd app; npx eas-cli build --profile preview --platform android`. O EAS do Gustavo está logado na máquina dele, então isto é melhor feito por ele. O perfil `preview` aponta para a API de produção: foto de atualização/anamnese só funciona lá se `TREINOS_FOTOS_HABILITADO` estiver ligado, e as correções da API só valem depois do deploy. A conferir no aparelho: foto da atualização, anamnese, foto de perfil, imagem do questionário, logo da marca, imagem do exercício e importação de planilha (nenhuma pode mostrar "sem conexão").
4. **Relatório** no formato da seção 4 do checklist, e esperar o "pode subir". Sem push na `main` antes disso.

## Decisões do Gustavo (já tomadas, não reabrir)

- C3: gravar `ALUNO_SITUACAO` só de quem mudou; `IMPORTACAO_CONCLUIDA` continua único por confirmação.
- CSV: número ambíguo (ponto + exatamente 3 dígitos, sem vírgula) vira erro da linha.
- Sem migration; `nome_arquivo` guarda só a extensão. Sem compatibilidade com legado (ainda não há cliente).

## Pontos para o relatório e para a revisão

- **Mudanças de comportamento a avisar:**
  - Importação: linha de "Outros" só com o nome, diante de item que tem concentração, agora cria variante; endereço parcial vira erro da linha.
  - Os dois 422 do nome do arquivo (vazio e acima de 200) deixaram de existir.
  - A tela de importação ainda mostra a coluna "Arquivo" e tem busca por nome do arquivo, que agora só mostra `.xlsx`/`.csv` (`TelaImportacao.tsx`, `ImportacaoRepository.buscar`). Decidir se tira.
  - `FormAluno.tsx` sempre manda `sexo`; "Não informado" vira `null`, que agora não altera nada: o treinador não consegue mais limpar o sexo pelo formulário (só a aluna, por `PUT /aluno/sexo`). Era também o que apagava o sexo de quem editava sem `ALUNO_LER`.
  - Comparação de fotos: o limite de 60/h agora conta tentativas que falham (429 mais cedo); foto de anamnese sem `ANAMNESE_LER` dá 404.
  - Ciclo no app: com o registro aberto há mais de 15 dias, "Minha menstruação começou hoje" some até a aluna informar o fim; a folha "Editar ciclo" não valida `fim ≤ início + 15` no app (a API devolve 422).
- **Riscos conhecidos:**
  - Possível deadlock (40P01): a confirmação da importação trava a consultoria e depois os alunos, e a reativação individual trava o aluno e depois a consultoria.
  - O teto de 500.000 células recusa planilha densa de 5.000 × 256; aspas sem fechar recusam o arquivo inteiro.
  - `ImageIO.setUseCache(false)` vale para a JVM inteira.
  - A rede de segurança do CPF no gravador (409 `ALUNO_CPF_EM_USO` volta a confirmação inteira) não tem teste.
  - Linhas antigas de `importacao` mantêm o nome completo do arquivo.
  - Outra consultoria usando o `id` de um dia do ciclo de outra dá 500 genérico (nada é alterado); o `gravarRegistro` tem o mesmo comportamento.
  - Não medi diferença visual da subamostragem em foto real.
- **Itens de achados que NÃO se confirmaram (nada foi mexido):** reativar aluno anonimizado pela planilha (já era erro de linha), troca A↔B de CPF (já não gerava 500), `ALUNO_SENSIVEL_LER` no peso (o catálogo de permissões já impede o perfil sem ele), reordenar a reserva de vaga (o "Informe o nome" é inalcançável antes dela), "1.234,5" e "1,234" (já davam "Valor inválido").
- **Não tratados (fora do lote, por decisão do Gustavo):** EXIF no cache do celular, download cancelado no Safari/Firefox, texto duplicado do descanso do Cluster, "não informado" → "—", termos/advogado, assinatura dos commits antigos.

## Regras que valem

- Commits em português, autor `Claude <noreply@anthropic.com>`, com as linhas `Co-Authored-By` e `Claude-Session` no fim. Nunca `--force`, rebase nem `[skip ci]`. Nenhum nome de modelo de IA em código, comentário ou documento.
- LGPD: só dados fictícios em teste, log, relatório e chat. Sem acesso à produção (nem SSH nem SQL).
- Minutos do Actions: testar tudo local ou aqui, um push por lote, nunca disparar nem reexecutar workflow à mão.
