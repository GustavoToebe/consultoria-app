# Séries, tipos e técnicas — 22/10/2026 (bloco G: contrato novo)

Os blocos A a F (formato de 22/10, com papéis, regras de faixas e técnicas por série) estão no `origin/main`. O bloco G troca o contrato: tipo por código, carga e esforço separados, seis técnicas dentro da série, grupos de exercícios na sessão e cardio com prescrição própria. Commits locais, sem push: API `16ba37e`, app domínio `cf1f57d`, aluno e PDF `d598a10`, treinador `159849e`. Este documento usa somente exemplos fictícios.

## Antes → agora

| Área | Antes (A–F) | Agora (G) |
| --- | --- | --- |
| Tipo da série | Texto livre (o nome); "Só técnica" permitia série sem tipo | Código estável do tipo (`WARM_UP`, `FEEDER`, `WORKING`, `TOP_SET`, `BACK_OFF`), sempre obrigatório fora do cardio. O nome exibido vem da metodologia e pode mudar sem perder as séries. |
| Carga e esforço | `intensidade` com modo, percentual, RIR e RPE misturados | `carga` (modo, percentual mín./máx., série de referência) e `esforco` (RIR de 0 a 5 ou RPE de 1 a 10, nunca os dois) separados. RPE saiu dos modos de carga. |
| Série de trabalho | `modo == CARGA_TRABALHO`, e uma série em RPE não era de trabalho | Continua `carga.modo == CARGA_TRABALHO`; como o RPE agora é esforço, uma WS em RPE segue sendo de trabalho. |
| Técnica | Três técnicas; rest pause e cluster podiam nascer sem tipo | Seis técnicas (rest pause, cluster, drop set, myo-reps, partial reps com região, forced reps com parceiro), sempre dentro de uma série com tipo, em geral a WS. |
| Back off | Percentual da WS ou acima da anterior | Também "abaixo da referência": redução de 1 a 50% sobre a carga registrada na série de referência escolhida (uma série anterior do exercício). |
| Repetições | Faixa; série sem reps era por tempo | Faixa ou AMRAP explícito; AMRAP nunca vem de campo vazio. Cluster segue com reps iguais à soma dos blocos. |
| Alvo extra | Não existia | Texto curto (até 120 caracteres) lido junto da série. |
| Grupos de exercícios | `juntoComAnterior` e `combinacao` por exercício | `Sessao.grupos` com superset, agonista-antagonista, tri-set, giant set, circuito (com voltas), pré e pós-exaustão. Descanso depois do grupo, exceto pré e pós-exaustão, que mantêm o descanso por série. |
| Cardio | Tipo "Cardio" e texto livre | Exercício de modalidade Cardio, com série de prescrição própria (duração, distância, ritmo, zona, intervalos). O aluno só marca "feito". |
| Metodologia | Tipos com `intensidadePadrao`, três técnicas | Tipos com código, `cargaPadrao`, `esforcoPadrao` e variação por modalidade (peso livre e máquina); seis técnicas e sete combinações com nome e explicação editáveis. |
| RIR 0 | "Até a falha" | "Até a falha técnica" no editor, na tela do aluno, no glossário do PDF e nos guias. Aviso na publicação quando aparece em aquecimento ou preparação. |
| Editor | Chips de tipo, "Só técnica" e campos de intensidade | Seções Tipo, Prescrição, Carga, Esforço, Técnica e Alvo extra; erro no próprio campo; prévia "Para o aluno" com a origem da carga. |
| Histórico | Mostrava o texto gravado no tipo | Mostra o nome do tipo pela metodologia da versão executada, nunca o código. |
| PDF | Glossário de tipos e técnicas usados | Glossário também com grupos, RIR e RPE usados ("RIR 0 = até a falha técnica"); grupos por extenso (ordem, voltas, descanso depois do grupo) e cardio com a prescrição. |
| Ajuda | Texto do formato de A–F | Guias do treinador e do aluno reescritos para o contrato novo (o PDF sai do mesmo `conteudo.ts`). |
| Migrations | 23 (V022 e V023 já no `origin/main`) | 24: a V024 apaga os dados de treino e as receitas no formato anterior e recria as receitas padrão no contrato novo. |

## Decisões e diferenças em relação ao plano

- Tipo é sempre obrigatório (a técnica nunca o substitui). Rest pause, cluster e as demais entram na própria série WS, como nos exemplos do guia de métodos; some o "Só técnica" e a série `MESMA_CARGA` sem tipo.
- RIR 0 significa até a falha técnica. RIR e RPE não aparecem juntos (erro na publicação). RIR 0 em aquecimento ou preparação só avisa.
- AMRAP é um marcador explícito da série. Cadência e isometria continuam por exercício; "alongada" é a região do Partial reps, não uma técnica à parte.
- Top set usa carga "acima da anterior"; Back off vem no padrão com 85% da WS e aceita "abaixo da referência". A série de referência nasce apontando a última série de trabalho; sem registro dela, o aluno fica sem sugestão de carga.
- Percentuais de preparação e de back off continuam sendo da WS. A referência da WS é a última série de trabalho registrada hoje; sem registro, a carga de trabalho informada para o dia. Faixa sugere pelo mínimo, com o arredondamento da metodologia.
- Grupos: mínimos de 2 (superset, agonista-antagonista, pré e pós-exaustão, estes exatamente 2), 3 (tri-set e circuito) e 4 (giant set), até 6 exercícios. Com descanso depois do grupo, o descanso por série dos membros não vale e o contador do aluno começa ao fechar a volta. Em pré e pós-exaustão cada série mantém o seu descanso e `descansoAposSegundos` não se aplica. Mover ou remover um exercício mantém o grupo contíguo e desfaz o que cair abaixo do mínimo.
- Cardio sai dos tipos da metodologia padrão (cinco tipos). O cardio é decidido pelo exercício (modalidade Cardio), não pelo tipo; trocar de e para cardio apaga as séries, com opção de desfazer.
- Tipo fora da metodologia do plano continua sendo só aviso (receitas aplicadas a plano com outra metodologia); a tela mostra o nome da metodologia da versão e cai no código.
- Alterar a metodologia depois de publicar não muda a ficha antiga: a cópia na versão é imutável.
- A tabela de exemplos do PDF e o seed demonstrativo, os conversores de importação e o `metodologia-padrao.json` acompanham o contrato novo em outro bloco do plano (bloco 5); confira no fecho.
- A V022 e a V023 já estão no `origin/main` e não foram editadas; a V024 é nova. A conferência integrada do bloco anterior usou o compose em `http://localhost:8088`; a deste contrato fica para o fecho.

## Roteiro de conferência

1. Em Treino › Metodologias, crie um tipo (nome livre, papel Trabalho). Confira que o código é gerado do nome e aparece só para leitura. Renomeie o tipo e confirme que as séries já gravadas continuam com o nome novo.
2. Confira os cartões de técnica (seis) e de combinação (sete): nome exibido, explicação e padrões. Salve pela barra do modelo e reabra.
3. Em um modelo de séries, adicione WS com rest pause: tipo WS, carga de trabalho e a técnica na mesma série. Troque para cluster 4+2 e confira que as repetições são a soma. Repita com myo-reps, partial reps (região alongada) e forced reps (aviso de parceiro).
4. Confira carga e esforço separados: tente RIR e RPE juntos (o editor troca de forma e a API recusa os dois) e RIR 0 (aparece "até a falha técnica"). Marque AMRAP e confira que as repetições somem. Escreva um alvo extra e veja a prévia "Para o aluno".
5. Monte Top set (acima da anterior) e Back off "abaixo da referência" apontando o Top set. No aluno demo, registre o Top set e confira a carga sugerida do Back off; sem registro, a sugestão fica vazia.
6. Na sessão, crie um superset com dois exercícios e um circuito com 3 e voltas. Confira o descanso depois do grupo e que o descanso por série dos membros não aparece. Crie uma pré-exaustão: sem campo de descanso do grupo, cada série mantém o seu.
7. Adicione um exercício de modalidade Cardio: só a prescrição de cardio. No aluno, a série mostra a prescrição e um único botão "feito".
8. Publique, depois altere a metodologia (renomeie um tipo): o plano publicado e o PDF dele não mudam.
9. No aluno, toque em tipo, técnica e grupo para ler as explicações; confira o contador de descanso ao fechar a volta do superset. No Histórico, o tipo aparece pelo nome, nunca pelo código.
10. Baixe o PDF (inclusive no tema escuro): glossário só com o que o plano usa (tipos, técnicas, grupos, RIR e RPE), grupos por extenso, cardio com a prescrição. Abra os dois guias em Ajuda e confira os textos novos.
11. Com pacote antigo armazenado, reconecte: o app descarta o pacote incompatível e baixa o atual sem converter; a fila de registros é preservada.

Os testes de tela simulam a API e usam apenas dados fictícios, em 390 e 1280 px. Nenhuma importação real foi executada.

## Comandos de verificação

```powershell
cd api
mvn verify
cd ../app
npm run typecheck
npm run lint
npm test -- --runInBand
$env:PW_CHROMIUM = "$env:LOCALAPPDATA\ms-playwright\chromium-1194\chrome-win\chrome.exe"
npm run e2e -- --workers=2
cd ..
node --test scripts/importacao/importar.test.mjs scripts/importacao/planos.test.mjs
$env:NAVEGADOR_PDF = "$env:PW_CHROMIUM"
node scripts/guias/gerar.mjs
```

Neste Windows, o Maven precisou de `-Djdk.net.unixdomain.tmpdir=C:/Users/GustavoToebe/Documents/consultoria-app/api/target/tmp` para os sockets locais do JDK (o caminho longo do temporário padrão fazia os testes falharem antes da aplicação). Nenhuma configuração global foi alterada e nenhum teste foi excluído.

Resultado final: a preencher no fecho (Bloco 6): API (`mvn verify`, testes e cobertura), app (typecheck, lint, suítes e testes), Playwright, importadores e exportação Android. Já medido no bloco de documentação: o guia do treinador gerado a partir do `conteudo.ts` novo tem 12 páginas e o do aluno, 6; o teste `app/src/ajuda/conteudo.test.ts` cobre os termos do contrato anterior e a presença dos itens novos. O Chromium configurado por `NAVEGADOR_PDF` gera os guias nesta máquina (o Edge não gerou).

## Publicação e pendências

**Nenhum push está autorizado.** Push na `main` publica em produção, e a API e o app mudam o contrato juntos: os seis commits locais à frente do `origin/main` (incluindo os de API e app do contrato novo) precisam entrar no mesmo push.

Três migrations apagam dados, em **todas as consultorias**:

- V022 (já no `origin/main`): registros de execução, treinos e suas versões, modelos de treino, séries e metodologia, e pacotes (que levam dieta junto). Mantém pastas dos alunos, dietas independentes, mobilidade e outros modelos.
- V023 (já no `origin/main`): recria as metodologias padrão; não recupera o conteúdo apagado.
- V024 (nova, só local): apaga de novo `execucao_serie`, as versões e os planos de treino e as receitas dos tipos metodologia, séries, dia de treino, semana e pacote, e recria as receitas padrão no contrato novo. O que for criado depois da V022 e da V023 também se perde. Não foi verificado aqui se a produção já aplicou a V022 e a V023 (sem acesso à VPS).

Antes de qualquer push, Gustavo precisa confirmar que não há nada a guardar e alguém precisa conferir que o backup do dia rodou. Sem isso, o lote permanece local. A importação real de treinos e dietas do Saraiva só acontece **depois do contrato novo em produção**. Alunos e pesos podem ser importados antes, em operação separada e autorizada.

Riscos do lote: perda de conteúdo coberta pela V022 e pela V024, incompatibilidade de app antigo com o contrato novo (a whitelist do pacote offline mudou), necessidade de conexão para baixar de novo um pacote descartado e Top sets importados que precisam de revisão quando faltam dados.

Pendências:

- Confirmação do padrão de rest pause pelo Saraiva (hoje uma pausa de 20 segundos, sem repetições por retomada; três micro-séries são duas pausas).
- Teste em aparelho Android e iOS físico.
- `Sessao.cardio` (texto livre) continua no contrato, mas a tela o esconde nas sessões novas (só aparece em sessão que já o tem); o cardio novo é um exercício de modalidade Cardio.
- O `codigo` do tipo é imutável só por regra de UI: a API aceita a mudança e não vigia o que as séries gravaram. Se isso virar risco, a trava passa para o servidor.
- Números finais dos testes e a conferência no compose (porta 8088, Playwright, 390 e 1280 px): a preencher no fecho (Bloco 6).

Nenhum workflow foi disparado ou reexecutado, e não houve acesso à VPS.
