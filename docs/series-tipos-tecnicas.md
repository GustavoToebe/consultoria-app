# Séries, tipos e técnicas — 22/10/2026

Implementado nos blocos A, B, C, D e F, junto do Planejamento por coleção (E). Os commits permanecem locais. Este documento usa somente exemplos fictícios.

## Antes → agora

| Área | Antes | Agora |
| --- | --- | --- |
| Metodologia | Tipos e regras em estruturas separadas | Cada tipo reúne papel, repetições, intensidade, variações por modalidade, regra de faixas e explicação. Técnicas têm cartões próprios. |
| Intensidade | Percentual único e alvo livre em texto | Percentual mínimo/máximo, RIR, mesma carga da WS e aumento sobre a série anterior. Duração fica na observação do exercício. |
| Preparação | Percentuais únicos | Regra por quantidade: três FS recebem 50%, 70% e 85–90% da WS. |
| Editor | Tipo e técnica pouco explícitos | Chips de tipo, opção Só técnica, técnica visível e prévia Para o aluno. |
| Rest pause | Representações em texto e retomadas | Técnica com quantidade de pausas. Três micro-séries são duas pausas. |
| Cluster | Blocos iguais e repetições separadas | Blocos como 4+2; total calculado e validado no servidor. Pausa em segundos, respirações ou ambos. |
| Aluno | Referência de carga pouco explícita | Mesma carga da WS vem preenchida, permite edição e é gravada no registro. Toque no tipo/técnica abre a explicação. |
| RIR 0 | Número técnico | Até a falha na tela do aluno e no PDF. |
| PDF | Instruções gerais | Glossário apenas dos tipos e técnicas usados, faixas e pausas por extenso. Fundo branco também no tema escuro. |
| Offline | Pacote anterior poderia quebrar a leitura | Pacote que não respeita o formato atual é descartado e baixado de novo; a fila de registros é preservada. |
| Importação | Alvo em texto e metodologia anterior | Mesmo formato da API e do app, contagem de técnicas e aviso de Top set sem percentual. |
| Planejamento | Lista de modelos | Modelos agrupados por coleção, busca em todas e Sem coleção por último. |

## Decisões e diferenças em relação ao plano

- Todos os percentuais de preparação e pós-trabalho se referem à carga da WS. O modo acima da anterior usa somente a série imediatamente anterior registrada hoje; sem referência, a sugestão fica vazia.
- A referência da WS é a última série de carga de trabalho registrada hoje; sem registro, usa a carga de trabalho informada para o dia. Uma faixa sugere pelo mínimo, com o arredondamento da metodologia.
- O papel organiza as opções do editor, mas não impede um modo que a API permite. O tipo TypeScript chama-se `PapelDaSerie`, para não conflitar com o papel de acesso do usuário.
- O padrão de rest pause segue provisoriamente uma pausa de 20 segundos, sem repetições por retomada. A confirmação do Saraiva ainda está pendente. Três micro-séries usam duas pausas.
- A tabela tem onze casos quando WS livre e WS máquina são contados separadamente; o plano de exemplos contém os onze. O seed preserva Plano 16 como plano ativo inicial.
- As explicações de FS, WS e técnicas ficam nos tipos e no glossário. As instruções gerais do Plano 16 ficaram curtas, evitando a repetição dessas explicações.
- Os dois conversores compartilham `scripts/importacao/metodologia-padrao.json`, com teste de igualdade em relação à configuração do app. Top set sem percentual explícito ou modalidade não recebe número inventado e entra no relatório para revisão.
- O código anterior do bloco A já incluía V023 para recriar metodologias padrão após V022. Os testes de migração esperam 23 versões. No bloco D, apenas o comentário da V022 foi corrigido: autorização e backup são condições futuras, ainda não confirmadas.
- A conferência integrada local usou o compose em `http://localhost:8088`, com API real e aluno de demonstração. A exportação Android também é verificada. Teste em aparelho Android/iOS físico continua pendente.

## Roteiro de conferência

1. Em Planejamento, abra cada aba e busque modelos de coleções diferentes. Confira a ordem das coleções, o recolhimento, o lápis de renomear e Sem coleção por último.
2. Em Treino › Metodologias, crie um modelo. Adicione um tipo com papel Preparação, regra para uma série (80–90%) e explicação. Altere o padrão de uma técnica e salve. Reabra para conferir os valores.
3. Em um modelo de séries, adicione FS e aumente para três. Confira 50%, 70% e 85–90%, junto da prévia Para o aluno. Adicione WS e depois Só técnica › Rest pause; confira mesma carga da WS.
4. Troque a técnica para cluster 4+2. Confira que não há campos separados de repetições e que o total salvo é seis. Teste pausa só em respirações e depois também em segundos.
5. No aluno demo, abra Exemplos do PDF (22/10). Informe a carga do dia, confira o preenchimento no rest pause/cluster, edite e marque a série. Reabra e confira o registro. Sem carga/repetições informadas, a leitura fica —.
6. Toque nos nomes de tipo e técnica para ler as explicações. Confira até a falha no exemplo de WS máquina. O cronômetro de pausa só aparece quando há segundos.
7. Baixe o PDF no tema escuro. Confira fundo branco, percentuais em faixa, duas pausas nas três micro-séries e glossário só com os tipos/técnicas usados. Confira também os dois guias em Ajuda.
8. Com pacote antigo armazenado, reconecte: o app descarta o pacote incompatível e baixa o atual sem converter o anterior. Os testes de repositório verificam a preservação da fila.

Os testes de tela simulam a API e usam apenas dados fictícios, em 390 e 1280 px. A conferência adicional no compose usa o aluno de demonstração e dados fictícios. Nenhuma importação real foi executada.

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

Neste Windows, o Maven precisou de `-Djdk.net.unixdomain.tmpdir=C:/Users/GustavoToebe/Documents/consultoria-app/api/target/tmp` para os sockets locais do JDK. O caminho longo do temporário padrão fazia os testes falharem antes da aplicação. Não houve alteração de configuração global nem exclusão de testes.

Resultado final local em 22/10: API com 1.223 testes e cobertura aprovada; app com typecheck/lint aprovados e 119 suítes/1.539 testes; Playwright com 107 testes; importadores com 67 testes; exportação Android concluída. PDFs renderizados e conferidos: guia do treinador com 12 páginas, guia do aluno com 5 e treino de exemplos com 2. O Edge não gerou o guia nesta máquina; o Chromium configurado por `NAVEGADOR_PDF` gerou os arquivos corretamente.

## Publicação e pendências

**Nenhum push está autorizado.** Push na main publica em produção. API e app mudam o contrato juntos: A–D precisam entrar no mesmo push, incluindo B, C e D. F pode acompanhar esse lote.

A V022 apaga, em **todas as consultorias**, registros de execução, treinos e suas versões, modelos de treino, séries e metodologia, e pacotes (que levam dieta junto). Mantém pastas dos alunos, dietas independentes, mobilidade e outros modelos. A V023 recria metodologias padrão; não recupera o conteúdo apagado.

Antes de qualquer push, Gustavo precisa confirmar que não há nada a guardar e alguém precisa conferir o backup do dia. Sem isso, o lote permanece local. A importação real de treinos e dietas do Saraiva só acontece **depois de A–D em produção**. Alunos e pesos podem ser importados antes, em operação separada e autorizada.

Riscos do lote: perda de conteúdo coberta pela V022, incompatibilidade de app antigo com o contrato novo, necessidade de conexão para baixar novamente um pacote descartado e Top sets importados que precisam de revisão quando faltam dados. Ainda faltam a confirmação do padrão de rest pause pelo Saraiva e a conferência em aparelhos físicos. Nenhum workflow foi disparado ou reexecutado, e não houve acesso à VPS.
