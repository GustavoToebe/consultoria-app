# Entrega de 26/10/2026 — metodologia e ciclo menstrual

Publicado em produção em `consultoria.servirea.com.br`.

| | |
| --- | --- |
| Commit | `0d9776cc3f42` |
| Branch | `main` |
| Anterior | `13cc4b6` |
| Workflow | [Testar e publicar #40377353738](https://github.com/GustavoToebe/consultoria-app/actions/runs/40377353738) |
| Imagens | `ghcr.io/gustavotoebe/consultoria-api:0d9776cc3f42` e `ghcr.io/gustavotoebe/consultoria-web:0d9776cc3f42` |

A `main` já continha a primeira leva da metodologia (`f11f88d` e `bf601a4`). Este commit junta o que ainda estava só na máquina: o lote de sexo e ciclo menstrual e o fechamento do editor de séries (F1–F7 e R1–R4).

## O que já estava na main

`f11f88d` deixou o Cluster explícito na série: blocos, pausa interna e descanso final separados. `bf601a4` acrescentou os dois exemplos de montagem e as duas formas de Rest-pause, com a mesma leitura do Cluster para a aluna e para o PDF.

Cluster continua técnica de uma série de trabalho. Não há tipo `CLUSTER`, não há migration de séries e a carga de trabalho continua saindo da carga do dia. Os padrões globais seguem FS 3 e WS 3–6. FS 10–15, WS 6–8 e Cluster 4×4 são exemplos editáveis.

## Sexo e ciclo menstrual

Acompanhamento opcional. Só existe quando o sexo do cadastro é Feminino. Só a aluna liga, grava e apaga. O treinador lê, e só com acesso a dados sensíveis. A fase é estimativa calculada no app. A API guarda datas, fluxo, cólica, sintomas e observação. Ela não calcula fase, não avisa e não muda treino nem dieta.

Detalhe de comportamento: `docs/ciclo-menstrual.md`.

- Sexo `MASCULINO`, `FEMININO` ou `OUTRO`. Vazio significa não informado. A aluna grava o próprio em `PUT /aluno/sexo`. A equipe lê com `ALUNO_LER` e grava com `ALUNO_ALTERAR`. A lista de alunos não ganhou coluna nem filtro de sexo.
- A inscrição pode trazer o sexo. O aceite copia o campo e não liga o ciclo.
- A anamnese pode preencher o sexo só numa escolha única, com `valorNoCadastro` na opção. Aplicar um sexo que não é Feminino desliga o ciclo. A anamnese do Saraiva não ganhou pergunta de sexo.
- A aluna ativa o acompanhamento em `/aluno/ciclo`, com a versão de consentimento. Ela configura duração habitual, registra inícios e dias, e pode apagar tudo. Sem internet a tela diz que precisa de conexão e os botões somem. Nada do ciclo fica no aparelho.
- `GET /alunos/{id}/ciclo` exige `ALUNO_LER` e `ALUNO_SENSIVEL_LER`. Desligado, ou sexo que não é Feminino, a resposta é `{ativo:false, registros:[], dias:[]}`, sem histórico. Sem a permissão sensível, a ficha não mostra o cartão.
- Sintomas saem de uma lista fixa, sem interpretação e sem gráfico. Textos das fases ficam em Marca › Acompanhamento.
- Se o acompanhamento está ligado e não há início nos últimos 35 dias, o formulário de atualização mostra “Confira se sua última menstruação está registrada”. Isso não bloqueia o envio e não dispara sozinho.
- Sem registro há mais de 60 dias, a tela diz “Sem registro recente”. Com “Mostrar fases estimadas” desligado, aparecem só a menstruação registrada e o dia do ciclo. Sem dado, o texto é “—”.
- Exportação LGPD leva a seção `cicloMenstrual`. Anonimização e “Excluir minha conta” apagam o acompanhamento. Auditoria: `CICLO_ACOMPANHAMENTO_ATIVADO`, `CICLO_ACOMPANHAMENTO_DESATIVADO` e `CICLO_REGISTROS_APAGADOS`, sem datas.
- Migration `V032__sexo_e_ciclo_menstrual.sql`. O aviso de privacidade e a versão dos termos passaram a `2026-10-26`.

Ficou de fora, por decisão: lembrete ou notificação da menstruação prevista, o treinador gravar data ou sintoma, gráfico de sintomas, relação automática entre sintoma e fase, uso offline e qualquer ajuste de treino ou dieta por fase.

## Metodologia no app, neste commit

A apresentação que já estava na `main` foi fechada no editor, na leitura da aluna, no PDF e na ajuda. As correções F1–F7 e o complemento R1–R4 entram aqui.

| Ponto | O que o app faz agora |
| --- | --- |
| F1 | Quantidade, repetição ou bloco inválido deixa de publicar o total antigo. Campo vazio continua sendo ausência deliberada. |
| R1 | Um decimal visível continua inválido quando outro campo é editado. O número antigo que ficou por baixo não volta para a lista. Corrigir o próprio campo grava o que está na tela. |
| R2 | Converter para blocos iguais, ou adotar uma notação igual, sincroniza os campos individuais. Voltar para “Blocos diferentes” mostra a lista atual. |
| F2 | “Rest-pause na última série” altera só a última série do único cartão de trabalho aberto. Dois cartões abertos desabilitam o botão. “Nova WS com Rest-pause” só acrescenta uma série. |
| F3 | Quando o descanso do grupo vale depois da volta, a leitura omite o descanso individual. Pré-exaustão e pós-exaustão mantêm a frase. A pausa interna do Cluster continua. |
| F4 | Atalhos de exemplo e de Rest-pause procuram a técnica pelo identificador da metodologia. Técnica ausente desabilita o botão. Técnica renomeada continua valendo. |
| F5 | Exercício sem carga omite a frase da carga do dia. O valor guardado não é apagado. |
| F6 | A frase de esforço usa o nome real do tipo. |
| R3 | A origem só é marcada quando a troca aplica o esforço de um tipo da metodologia. Código sem padrão, como `LEGADO`, mantém o esforço manual e a revisão neutra. A opção de editar um código que já está na série permanece. |
| R4 | A marca fica só em memória e guarda esforço e tipo. Recarga ou desfazer que mudem esforço ou tipo apagam a marca. Voltar ao mesmo número não recria a afirmação. |
| F7 | A comparação de assinatura continua como proteção. A marca apagada não volta sozinha. |

A tela de metodologia mantém a simplificação já escolhida: atalhos que rolam na mesma página, sem prévia lateral. A regra percentual continua visível. Contador e blocos ficam nas seções atuais.

Também ficou de fora, até decisão de produto: herdar carga automaticamente, mudar os padrões globais e criar tipo ou migration novos.

## Documentos usados

Estes arquivos orientaram o trabalho. Ficam fora do repositório, em `C:\Users\GustavoToebe\Documents\Codex\2026-10-24\a\outputs\`, com cópia da análise também citada em `Desktop\Analise`.

| Arquivo | Papel |
| --- | --- |
| `analise-metodologia.md` | Especificação da metodologia. Seção 13 é o briefing seguido na implementação. Cluster como técnica, exemplos editáveis, padrões globais e carga do dia vêm daqui. |
| `analise-metodologia.pdf` | A mesma análise, 11 páginas, para leitura. O `LEIA-ME.md` da mesma pasta manda usar o PDF junto do Markdown. |
| `LEIA-ME.md` | Como usar a análise, o PDF e o protótipo HTML. Não é especificação de comportamento. |
| `revisao-implementacao-metodologia-2026-10-26.md` | Revisão que abriu F1–F7. Os pontos já corretos foram preservados. |
| `revalidacao-metodologia-2026-10-26.md` | Complemento que abriu R1–R4 e confirmou F2–F5 e o nome do tipo em F6. |
| `parecer-final-editor-metodologia.md` | Parecer posterior às correções R1–R4. Confirma o editor nos cenários reportados e lista a integração que ainda não foi executada ponta a ponta. Não foi usado para reimplementar o que já estava certo. |

O protótipo `prototipo-metodologia.html` e as capturas `previa-metodologia-desktop.png` e `previa-metodologia-celular.png`, citados no `LEIA-ME.md`, serviram de comparação visual. Não são Markdown nem PDF.

`docs/series-tipos-tecnicas.md`, dentro deste repositório, aparece na análise como histórico de decisões. Não foi a especificação desta entrega.

O ciclo menstrual não teve um Markdown externo de especificação. O escopo veio do pedido de implementação e o comportamento ficou registrado em `docs/ciclo-menstrual.md`.

## Documentos do repositório nesta entrega

| Arquivo | O que aconteceu |
| --- | --- |
| `docs/ciclo-menstrual.md` | Criado. Descreve o acompanhamento, a estimativa de fase e o que fica de fora. |
| `docs/entrega-2026-10-26-metodologia-e-ciclo.md` | Este registro. |
| `api/src/main/resources/termos/aviso-de-privacidade.md` | Atualizado para citar o ciclo. A versão dos termos subiu para `2026-10-26`. |
| `AGENTS.md` | Atualizado com a regra do ciclo e com o comportamento do editor de séries. |
| `app/public/guias/guia-aluno.pdf` | Gerado de novo a partir de `app/src/ajuda/conteudo.ts`. |
| `app/public/guias/guia-treinador.pdf` | Gerado de novo a partir do mesmo texto de ajuda. |

Os PDFs em `Codex\2026-10-24\a\work\revisao-web*\guias\` são cópias de inspeção da revisão. Não entram no aplicativo.

## Verificação antes de publicar

- `mvn verify` na API, com Postgres 18: passou localmente, e de novo no workflow (5 min 32 s).
- `npm run typecheck`, `npm run lint` e `npm test`: 136 suítes e 1.860 testes, localmente e de novo no workflow.
- E2E com API simulada: metodologia, séries, editor e exercício da aluna, 28 testes, em 390 e 1280 px. O ciclo tem `app/e2e/ciclo-menstrual.spec.ts` na suíte do app.

O workflow construiu as duas imagens, passou na varredura e publicou a API e a web na VPS.

## O que esta publicação não executou ponta a ponta

O parecer final deixa estes percursos para uma conferência integrada, com dados fictícios. A regra de domínio da carga já está coberta nos testes unitários.

- Publicar versões do plano e copiar metodologia, conferindo que a versão anterior permanece.
- Executar offline, reenviar e associar o registro à versão executada.
- Histórico, progresso e PDF com API e banco reais.
- Carga do dia de 40 kg com a WS anterior registrada em 42 kg, no percurso completo.
- Isolamento entre consultorias nesses mesmos percursos.
- Interações no app nativo e validação completa por teclado.
