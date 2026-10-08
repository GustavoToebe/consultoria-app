# Direcionamento inicial - plataforma de treinos e consultorias

Data: 07/10/2026. Análise de contexto e código; nenhuma implementação ou alteração nos repositórios.

## 1. Material analisado e limites

- As seis páginas de `C:/Users/ICONDESKTOP_02/Desktop/Saraiva.pdf`, renderizadas porque o PDF contém screenshots, sem texto extraível.
- As sete imagens em `C:/Users/ICONDESKTOP_02/Desktop/Nova pasta (3)`.
- Quadros distribuídos ao longo dos 122,85 segundos de `C:/Users/ICONDESKTOP_02/Downloads/WhatsApp Video 2026-10-07 at 15.50.34.mp4`. Revisão visual; o áudio não foi transcrito/analisado.
- Código do protótipo em `C:/Users/ICONDESKTOP_02/Documents/log-de-treino`, incluindo app, armazenamento, calendário, regras, API e relatórios.
- Código e contrato de integração da Central, especialmente Produto, IntegracaoProperties, AplicativoHttp, AGENTS.md e docs/contrato-integracao-v1.md.
- Verificação executada: `mobile/node_modules/.bin/tsc.cmd --noEmit`, aprovada. Não executei o app em dispositivo nem uma bateria funcional da API; aparência em screenshots não comprova funcionamento completo.

## 2. O produto sugerido pelo contexto

A conversa descreve uma plataforma utilizável por vários treinadores/consultorias, com gestão de alunos, montagem de treinos, planos alimentares fornecidos pelos profissionais, visualização no celular e exportação PDF. O Saraiva menciona simplicidade, flexibilidade das metodologias, opção de tema claro/escuro, divulgação e uma possível parceria comercial.

São interesses e propostas presentes na conversa, ainda não um contrato ou especificação fechada. Valores, porcentagens, investimento, titularidade do produto e divisão de responsabilidades precisam ser definidos antes de uma proposta comercial. As referências a concorrentes e seus preços são relatos da conversa, não informações verificadas nesta análise.

Direção proposta: software de gestão da consultoria para o treinador, conectado a uma experiência simples para o aluno. A metodologia Saraiva pode ser um modelo configurável, sem determinar a estrutura inteira do produto.

## 3. O que aproveitar do protótipo

- Experiência de consultar dias e exercícios, editar pesos/repetições e marcar séries.
- Conceito de carga base e séries com multiplicadores.
- Calendário de ciclos de treino.
- Links de vídeo por exercício.
- Conceito de registrar histórico e gerar relatórios.
- Referência visual escura com destaques vermelhos.

O TypeScript passa, mas isso valida tipos, não segurança, sincronização, isolamento de dados ou fidelidade das regras.

## 4. Gaps concretos no código

| Prioridade | Evidência | Consequência / direção |
|---|---|---|
| Alta | `mobile/App.tsx`, handlePickPdf: seleciona arquivo e guarda o nome; não extrai conteúdo. `pdf_plan_parser.ts` é uma constante preenchida manualmente. | Não apresentar como importação real de PDF. Para demonstração, usar dados identificados como exemplo. Importação futura deve ter formatos aceitos e revisão antes de publicar. |
| Alta | Calendário usa SARAIVA_PDF_SCHEDULE para todos os planos; dieta vem de seed_diet.ts. | Criar planos próprios por aluno, com estrutura editável e publicação de versão. |
| Alta | API sem dependência/configuração de autenticação identificada; listarPlanos usa findAll; logs não possuem aluno/consultoria; busca da última carga filtra apenas nome do exercício. | Implementar autenticação e autorização, isolamento por consultoria e vínculo do aluno em toda leitura/escrita. Não expor a API atual como produto comercial. |
| Alta | storage.ts usa data + nome do exercício e deduplica logs sem folderId. | Planos sobrepostos e exercícios homônimos podem compartilhar/sobrescrever registros. Usar IDs de aluno, sessão, exercício do plano e série. |
| Alta | isSynced fica falso; não encontrei chamadas do app para o endpoint de sync. O servidor salva entidades recebidas em lote. | Sincronização efetiva ainda precisa de fila, IDs estáveis, idempotência, autorização e conflitos definidos. |
| Alta | App.tsx presume repetições quando não preenchidas; remove caracteres não numéricos da faixa antes de parseInt. | Uma meta como 3-6 pode virar 36. Separar meta de resultado realizado; ausência de preenchimento não deve inventar execução. |
| Média | Pastas ficam em useState; criação usa daysCount fixo e mesmo plano de exemplo. | Persistir planos/ciclos e calcular duração corretamente; não tratar nome de arquivo como conteúdo importado. |
| Média | README cita WatermelonDB, NativeWind e Spring Security; dependências/código examinados não implementam esses componentes. | Atualizar documentação para refletir o estado real, com lista explícita de funcionalidades simuladas. |
| Média | App.tsx concentra aproximadamente 2.091 linhas. | Separar telas, componentes, navegação, armazenamento e casos de uso. |
| Média | Backend configurado para H2 com ddl-auto=update e console habilitado; CORS aceita qualquer origem. | Definir ambientes, migrations, banco de produção, origens e tratamento de erros próprios do novo produto. |

Não recomendo simplesmente copiar o Servirea inteiro nem jogar fora o protótipo. Aproveitar os conceitos e componentes úteis, mantendo uma base de produto específica e auditável.

## 5. Primeiro escopo proposto

Decisão do usuário em 07/10/2026: **painel do treinador + acesso do aluno juntos na primeira versão**. O fluxo mínimo é montar, publicar, consultar, registrar execução e acompanhar o retorno. Ambos os lados pertencem à entrega. Android e iOS são obrigatórios, com identidade do treinador e publicação nas lojas. Offline entra desde a primeira versão para consultar treinos já baixados e registrar execuções/cargas.

### Treinador / consultoria

1. Conta do treinador individual e ambiente próprio; equipe com vários treinadores fica para evolução.
2. Alunos ativos/inativos e cadastro simples.
3. Biblioteca de exercícios com equipamento, observações e vídeo.
4. Modelos de treino reutilizáveis.
5. Editor de treino por aluno: exercícios, séries, repetições, intervalos, técnicas e multiplicadores definidos pelo profissional.
6. Publicação de versões: alterações futuras não reescrevem o histórico executado.
7. PDF de treino e relatório, com opção de impressão clara.

### Aluno

1. Convite/acesso à própria conta.
2. Treino do dia e instruções.
3. Registro real de carga/repetições por série e observações.
4. Histórico simples e funcionamento offline para treino e registro de cargas/execução, com sincronização ao reconectar. Primeiro acesso e download inicial exigem internet; vídeos externos não entram no offline inicial.

### Nutrição

Nutrição está confirmada na primeira entrega. Começar por cadastro de refeições/opções, observações e PDF do plano fornecido pelo profissional, ajustando o detalhamento após receber as planilhas reais de treino e nutrição. Offline de nutrição não foi solicitado nesta fase. Cálculo com tabelas alimentares, substituições, prescrições e revisão exige especificação própria; não tratar o seed atual como um módulo completo. O sistema registra e apresenta o plano aprovado, sem inventar orientação clínica ou alimentar.

Deixar para evoluções: fotos e avaliações detalhadas, chat, notificações, financeiro da consultoria, cobranças dos alunos, integrações externas e importação ampla de documentos. Nome, logo, cores e configuração da marca individual fazem parte da primeira versão. Sem IA nesta fase proposta.

## 6. Como usar a Central

| Conceito | Correspondência inicial proposta |
|---|---|
| Produto | Plataforma interna de treinos com código técnico; sem marca própria apresentada aos alunos. Uma configuração de marca por treinador não exige um produto comercial novo na Central. |
| Cliente | Treinador individual contratante do software. |
| Contratação | Assinatura desse contratante. |
| Instância no novo app | Ambiente do treinador, com marca e alunos próprios. |
| Funcionalidades | TREINOS, RELATORIOS, NUTRICAO e outras conforme escopo aprovado. |
| Limites | Alunos ativos (decisão confirmada) e armazenamento. Definir janela de medição, inativação/reativação e tratamento de excedentes; colaboradores ficam para evolução. |

A Central controla comercialmente o produto: contratação, plano, cobrança, adicionais, direitos e consumo agregado. O novo app guarda os dados de negócio: alunos, treinos, histórico, avaliações e refeições. Não enviar planos, fotos, dados clínicos ou credenciais de alunos para a Central.

O contrato atual já prevê outros produtos, HMAC, nonce, provisionamento idempotente e direitos. Ainda será necessário implementar o lado do novo app, configurar credenciais e testar provisionamento, reconciliação, direitos e medição de consumo. Cadastro do produto sozinho não completa a integração.

Separar a assinatura do software vendida ao treinador de qualquer cobrança da consultoria aos seus alunos e de eventual repasse entre parceiros. São fluxos comerciais diferentes.

## 7. Estrutura técnica proposta, ainda sujeita ao escopo

- API própria, com módulos de identidade/consultoria, alunos, exercícios, planos, execuções, relatórios e integração Central.
- Painel web do treinador, reutilizando convenções de desenvolvimento do ecossistema quando fizer sentido.
- App do aluno em Android e iOS: aproveitar React Native/Expo, com uma base de código comum e configuração de marca por treinador. Identificadores, assinatura, ficha das lojas e versões são próprios de cada app publicado; não duplicar repositórios por cliente.
- Banco remoto próprio do produto, com separação de dados por consultoria e migrations reproduzíveis.
- Banco local estruturado e fila durável desde a primeira entrega para treinos e execuções; regras de publicação/conflito explícitas. Guardar a versão baixada, manter registros após fechar o app e reenviar com idempotência; limpar/separar dados na troca de conta e impedir acesso entre alunos. Apenas AsyncStorage e um booleano isSynced não bastam.
- Para Expo SDK 57, a documentação oficial confirma expo-sqlite como banco persistente entre reinícios: https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/. Proposta de escolha, não componente instalado ou sincronização automática.
- IDs estáveis para consultoria, aluno, plano/versão, sessão, exercício e série. Histórico ligado à versão efetivamente executada.
- Sessões protegidas, arquivos privados e autorização no servidor; não confiar em IDs recebidos no body.

Não cravar datas, custos de infraestrutura ou prazo de lojas sem fechar o escopo e a forma de distribuição.

## 8. Ordem sugerida

A sequência abaixo é de desenvolvimento interno; painel e acesso do aluno serão entregues juntos.

1. Definir responsabilidades comerciais e obter planilhas reais; comprador confirmado como treinador individual. Validar o fluxo completo com Saraiva e a estratégia de publicação nas lojas.
2. Montar demonstração honesta: aluno, treino editável, versão publicada e PDF; identificar simulações.
3. Construir autenticação, isolamento de consultorias e cadastro de alunos.
4. Implementar editor, modelos e publicação de treinos.
5. Conectar contratação, direitos e limites à Central.
6. Finalizar o acesso do aluno e o histórico junto ao painel; testar o fluxo completo de publicação e execução. Offline e sincronização de treinos/execuções fazem parte desta entrega, incluindo testes de reconexão, reinício e repetição de envio.
7. Entregar nutrição junto ao primeiro lançamento, com funções delimitadas pelas planilhas aprovadas; testar Android, iOS e publicação de uma marca piloto antes de ampliar o catálogo.

A ordem é proposta de trabalho, não autorização para implementar ou fazer deploy.

## 9. Decisões confirmadas em 07/10/2026

1. White label: cada treinador usa seu nome/logo/lema, por exemplo “Básico sem Frescura”; objetivo de app próprio na App Store e Google Play, sem marca própria visível da plataforma.
2. Comprador inicial: treinador individual.
3. Painel do treinador e acesso do aluno entregues juntos, com treino e nutrição na primeira versão. O usuário fornecerá os modelos das duas planilhas.
4. Android e iOS obrigatórios. Offline inicialmente limitado à consulta dos treinos baixados e registro de treinos/cargas.
5. Regra comercial baseada em alunos ativos.
6. Parceria ainda não definida; o usuário precisa de orientação e conversará melhor com Saraiva.

### 9.1 Atualização (documento "Saraiva 1", 07/10/2026)

As decisões da seção 1.2 do [PLANO-IMPLEMENTACAO.md](PLANO-IMPLEMENTACAO.md) substituem as desta seção onde conflitam:

- **Item 1 (white label):** agora é **app único**. A marca do treinador (logo, cor, nome, fonte Metal) entra depois do
  login ou ao abrir o convite. App próprio de cada treinador nas lojas fica para depois, como adicional, e a seção 10
  abaixo continua valendo para essa etapa.
- **Item 4 (offline):** além de consultar o plano baixado, o aluno registra carga e repetições sem internet e o app
  envia ao reconectar (implementado na fase 6).
- **Item 5 (regra comercial):** a cobrança fica para depois. Não há integração com a Central, gateway ou split nesta
  entrega; a definição de "aluno ativo" para cobrança continua na seção 12.
- Arquitetura: monolito modular (uma API Spring Boot + um PostgreSQL), isolamento por consultoria como no Servirea e
  um único app Expo (web, Android e iOS) para treinador e aluno.

## 10. Publicação white label e operação

Manter uma base de código e infraestrutura do produto, com isolamento dos dados de cada treinador. Configurações de marca geram os aplicativos correspondentes; cada publicação exige controle de versão, certificados, identificadores, materiais das lojas e manutenção. O painel web pode compartilhar a mesma aplicação com a identidade definida após o acesso. A Central controla a assinatura do treinador e consumo agregado; a API do produto controla alunos e dados.

Há uma restrição importante: publicar vários apps apenas trocando nome e logo não garante aprovação. A Apple exige, na regra 4.2.6, que apps de serviços de templates sejam submetidos diretamente pelo fornecedor do conteúdo; também limita duplicação na regra 4.3. O Google Play proíbe conteúdo repetitivo que ofereça apenas a mesma experiência de outros apps. Uma conta por treinador, sozinha, não resolve a análise de qualidade e repetição.

Fontes oficiais consultadas em 07/10/2026:
- [Apple — regras 4.2.6 e 4.3](https://developer.apple.com/app-store/review/guidelines/).
- [Google Play — conteúdo repetitivo](https://support.google.com/googleplay/android-developer/answer/9899034?hl=en-GB).

Recomendação operacional: avaliar publicação pela conta do próprio treinador, com permissões delegadas compatíveis com o tipo de conta, sem compartilhar senhas. Preparar uma marca piloto com serviço e conteúdo efetivamente próprios e validar a submissão antes de prometer publicação em escala. Esta é uma recomendação de implementação, não garantia de aprovação ou decisão comercial já aceita.

## 11. Direção comercial para a parceria

Recomendação inicial: separar a relação de fornecedor do software da colaboração com Saraiva. Você desenvolve e mantém a plataforma; o treinador fornece sua marca, conteúdo e atendimento aos alunos. Saraiva pode validar o produto e colaborar com divulgação. Investimento, trabalho e remuneração dessa colaboração precisam ser combinados explicitamente; não presumir sociedade ou percentual sobre todo o ecossistema.

Possibilidades para negociar: remuneração por indicação de clientes; participação limitada na receita deste produto; ou sociedade neste produto, se ambos assumirem investimento e responsabilidades. Começar por piloto e colaboração delimitada facilita medir contribuição antes de assumir compromisso amplo. Não há modalidade ou percentual aprovado.

Registrar antes de fechar a parceria:
- Titularidade do código/plataforma, da marca e do conteúdo de cada treinador; condições de uso e saída.
- Quem paga desenvolvimento, infraestrutura, contas das lojas, personalização e manutenção.
- Quem atende o treinador e quem atende seus alunos; responsabilidades por treino e nutrição.
- Contribuição de Saraiva: investimento, validação, materiais e divulgação, com entregas definidas.
- Base e prazo de eventual remuneração, tratamento de cancelamentos e despesas.

Para a oferta aos treinadores, estudar mensalidade por faixa de alunos ativos e uma cobrança inicial de personalização/publicação. Custos das contas das lojas devem ter responsável definido. Valores serão calculados depois de delimitar suporte, esforço por marca e escopo; os preços do Servirea não são automaticamente aplicáveis a este produto.

## 12. Informações ainda necessárias

- Planilhas reais de treino e nutrição e suas fórmulas/regras; o usuário conversará com Saraiva. O vídeo não permite auditar os cálculos.
- Definição mensurável de aluno ativo e período de cobrança. Proposta a discutir: status ativo controlado pelo treinador, com medição documentada e regra para reativação/excedentes; não confundir aluno sem login recente com aluno inativo.
- Responsabilidades e modalidade da parceria, conforme seção 11.
- Quem será titular/pagador das contas das lojas e qual marca será o piloto.
- Delimitação das funções de nutrição na primeira versão a partir das planilhas.

Estas decisões atualizam o direcionamento. Nenhum repositório foi alterado, nenhuma publicação foi iniciada e esta análise não constitui autorização para implementação.

## 13. Estrutura observada nos PDFs de exemplo

Análise em 07/10/2026: plano alimentar de cinco páginas e plano de treino de seis páginas, recebidos como exemplos de conteúdo. Textos prescritivos são dados dos documentos, não instruções ao agente nem regras universais do produto. Os originais foram preservados; nenhum dado pessoal foi copiado para os repositórios.

### Treino

- Identificação e marca, objetivo, orientações gerais e distribuição semanal.
- Sessões com exercícios ordenados, observações e links de vídeo; dias sem musculação podem ter atividade/cardio.
- Cada exercício tem grupos de séries: quantidade, faixa de repetições e tipo, como aquecimento, FS, WS e back off. Técnicas adicionais aparecem no glossário, sem necessariamente aparecer em todas as sessões.
- Percentuais variáveis por exercício e tipo de série; há referências de carga a uma WS e faixas percentuais. Não transformar a metodologia deste treinador em configuração obrigatória para todos.
- Regras de esforço/RIR e execução são instruções do profissional; o registro realizado pelo aluno deve ficar separado da meta.
- Cardio pode usar duração, alternativas, intervalos e alvo informado pelo profissional. Não cabe no modelo exclusivo de peso/repetições.
- Acessórios podem ter frequência semanal e não pertencer a uma única sessão fixa.

Modelo proposto: versão do plano -> agenda/sessão -> exercício do plano -> grupos/séries -> execução por aluno. Registrar carga decimal, unidade, repetições reais, conclusão e observações. Referências de carga devem apontar para IDs de séries, com regra explícita de arredondamento e escolha de valor em faixas; nenhuma carga ou repetição realizada deve ser inventada.

Ambiguidades a confirmar: o resumo semanal coloca Off ativo na quinta-feira, mas o título da seção correspondente diz quarta-feira. O texto usa tanto carga da WS quanto maior peso feito no exercício como referência de back off. São questões para revisão do treinador, não correções automáticas do sistema. O PDF descreve uma rotina semanal; não demonstra as datas fixas do calendário do protótipo.

### Nutrição

- Identificação, objetivo, datas de início/emissão e identificação profissional.
- Totais diários de calorias, proteína, carboidrato e gordura.
- Cinco refeições ordenadas. Algumas têm opções A/B, com alimentos, quantidade/unidade e nutrientes por item e por opção.
- Orientações gerais, hidratação, alternativas alimentares e observações.
- Tabela adicional de itens com dose/horário/observação e acompanhamento de peso com data, variação e observação.

Modelo proposto: versão do plano -> refeições -> opções alternativas -> itens alimentares. Separar valor por 100 g, por unidade e por porção; registrar fonte e versão da composição, quantidade, conversão e arredondamento. Totais diários devem informar qual combinação de opções foi utilizada, sem somar alternativas como se todas fossem consumidas. Permitir modo manual explicitamente identificado quando os valores forem fornecidos pelo profissional sem uma base auditável.

Pontos para validar na planilha: as opções A exibidas somam 2.237 kcal, enquanto o cabeçalho mostra 2.236 kcal; isso pode decorrer de arredondamento, mas o PDF não prova a fórmula. Há item com quantidade em unidades e gramas cuja base dos nutrientes precisa ser confirmada. Dois blocos têm o mesmo nome de refeição, portanto o nome não deve servir de identificador único. No histórico de peso, uma variação exibida não coincide com a subtração simples dos pesos apresentados. Não concluir correção nutricional ou clínica a partir desses exemplos.

A tabela adicional mistura suplementação com medicamentos e há conteúdo hormonal nas observações. Não classificá-la automaticamente como uma lista comum de suplementos, nem implementar recomendação ou cálculo automático de doses. A inclusão de um fluxo clínico específico exigiria definição separada de autoria, permissões e responsabilidades; não está fechada no escopo do treinador individual.

### Exportação e experiência

O PDF alimentar quebra a tabela de totais entre páginas, deixa um trecho de observações isolado e termina com uma página quase vazia. O de treino separa alguns títulos das respectivas tabelas. Gerar PDF a partir dos dados estruturados, mantendo títulos com conteúdo, cabeçalhos repetidos e marca configurável. No celular, apresentar cartões de sessão/exercício e refeição/opção, em vez de reproduzir páginas do PDF como interface principal.

### O que estes arquivos resolvem e o que falta

Os exemplos esclarecem campos, hierarquia e exportações. Não fornecem as fórmulas originais, tabelas alimentares, conversões de porções ou automações da planilha. A próxima análise depende das planilhas reais e da confirmação das ambiguidades acima. Receber PDF não autoriza implementar importação automática de PDF; essa funcionalidade continua separada do editor estruturado e fora do primeiro escopo fechado.

## 14. Recomendações para a experiência e a primeira versão

Recomendações acrescentadas em 07/10/2026 a pedido do usuário. São propostas para detalhar e validar o produto; a inclusão neste documento não representa implementação realizada nem autorização para ampliar automaticamente o escopo.

1. **Publicação de planos com histórico.** O treinador monta um rascunho, revisa e publica. Alterações posteriores geram uma nova versão, preservando o plano e as metas vinculados à execução anterior do aluno.
2. **Modelos reutilizáveis.** Permitir duplicar treino, semana e plano alimentar e ajustar para cada aluno. A edição de uma cópia não altera planos já publicados para outros alunos.
3. **Bibliotecas configuráveis.** Exercícios, vídeos, alimentos e técnicas próprios de cada treinador. FS, WS e outras regras funcionam como modelos configuráveis; não obrigar todos a seguir a metodologia Saraiva.
4. **Registro rápido durante o treino.** Mostrar a última carga registrada para o mesmo aluno e exercício correspondente; permitir preencher carga/repetições com poucos toques e incluir cronômetro de descanso. Sugestões de carga ficam separadas dos resultados realizados. Não marcar uma série como executada apenas porque existe uma meta.
5. **Sincronização visível.** Mostrar os estados “salvo neste aparelho”, “aguardando envio” e “sincronizado”. Queda de conexão ou fechamento do app não pode apagar registros locais. Reenvios não podem duplicar execuções; falhas precisam de indicação e possibilidade de nova tentativa.
6. **Revisão antes de publicar.** Apontar exercícios sem séries, referências de carga inválidas, refeições sem quantidade e totais inconsistentes. Distinguir erros que impedem a publicação de avisos que exigem confirmação. O treinador confirma as escolhas; o sistema não inventa valores.
7. **Painel simples de acompanhamento.** Exibir últimas execuções, evolução das cargas e alunos sem registros recentes. Ausência de registro não significa automaticamente ausência de treino. Não incluir ranking público ou competição entre alunos como consequência dessa proposta.
8. **Prévia da marca.** Permitir visualizar nome, logo, cores e aparência antes da publicação. Definir limites de personalização para manter legibilidade, acessibilidade e manutenção compartilhada dos apps. Mudanças que exigem nova versão nas lojas devem ser identificadas no fluxo.

## 15. Recomendações para operação e segurança

- **Aluno ativo e cobrança.** Definir regra objetiva de contagem, período de medição, inativação, reativação e excedentes. Não usar ausência de login como sinônimo automático de aluno inativo. A regra deve ser compreensível ao treinador e consistente com o consumo enviado à Central.
- **Suporte.** Separar atendimento a problemas do software, sob sua responsabilidade operacional, de dúvidas sobre treino e nutrição, atendidas pelo profissional. Definir canais, horários e condições de atendimento na oferta.
- **Dados e acesso.** Cada aluno acessa somente os próprios dados; cada treinador acessa somente seu ambiente. Autorizar leituras e escritas no servidor. Troca de conta no aparelho deve limpar ou tornar inacessíveis os dados da conta anterior, incluindo caches e arquivos locais, com tratamento explícito de registros ainda não enviados.
- **Publicação por marca.** Definir titular e pagador das contas das lojas, custos de publicação, manutenção, atualizações, certificados e o procedimento de cancelamento. A estratégia continua sujeita às políticas e aprovação das lojas descritas na seção 10.
- **Exportação e recuperação.** Definir exportação autorizada dos dados, tratamento da saída do cliente e backups. Testar restauração antes de atender clientes; existência de um backup não comprova recuperação. Os dados de negócio ficam no novo produto, sem serem enviados à Central como conteúdo pessoal.

## 16. Próximo passo recomendado: validar quatro telas e um fluxo completo

Desenhar e validar com Saraiva, usando os exemplos recebidos:

1. **Alunos:** cadastro, situação ativa/inativa, vínculo aos planos e acesso ao histórico.
2. **Editor de treino:** modelos, agenda, exercícios, grupos de séries, referências de carga, revisão e publicação.
3. **Editor alimentar:** refeições, alternativas, quantidades, unidades, composição, observações, revisão e publicação; fórmulas detalhadas após receber as planilhas.
4. **Execução do aluno:** treino publicado, última carga, registro real, descanso e estado de sincronização.

Fluxo a validar: treinador cadastra aluno -> monta e revisa os planos -> publica -> aluno acessa sua versão -> baixa o treino -> registra execução sem internet -> reconecta -> treinador consulta os registros sincronizados. Também validar a consulta do plano alimentar, inicialmente online, e a geração do PDF com a marca correta.

As telas e o fluxo são a proposta do próximo trabalho, não telas já construídas. A validação deve anteceder módulos adicionais e usar exemplos identificados, sem expor dados pessoais entre treinadores.

## 17. Piloto e parceria recomendados

Começar com um piloto de escopo e responsabilidades definidos. Medir o esforço real de desenvolvimento, suporte, personalização e publicação antes de combinar preço definitivo ou participação comercial.

O piloto deve registrar o que será entregue, quem valida treino/nutrição, quem fornece marca e materiais, quem atende alunos, quais aparelhos serão testados e quem assume custos e contas das lojas. Avaliar o fluxo completo, isolamento dos dados, preservação dos registros offline, exportações e recuperação.

A recomendação complementa a seção 11. Não há porcentagem, sociedade, exclusividade ou valor fechado; nenhum desses compromissos deve ser presumido a partir das conversas ou dos exemplos enviados.
