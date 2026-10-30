# Importar plano de treino (e dieta) de um PDF ou Google Docs

Situação: Planejando · Onde: branch `atualizacao-visual-app-full` · Atualizado: 30/10/2026

## Objetivo
O treinador já tem planos prontos em PDF ou em Google Docs. Hoje ele precisa digitar tudo de novo no editor. A ideia
(item A02 da análise de 29/10) é ele trazer esse documento e o app montar um **rascunho** do plano, que ele confere e
corrige antes de usar. Este arquivo só compara os caminhos e traz as perguntas para o Gustavo decidir. **Nenhum código
nesta rodada** (decisão D5 de `atualizacao-visual-app-full.md`).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Nesta rodada | Só o plano escrito (opções, riscos de LGPD, o que fica no servidor); sem código até o Gustavo decidir | Gustavo, 30/10 |
| 2 | Tudo o mais | Aberto: ver "Perguntas para o Gustavo decidir" | — |

## Como é hoje

**A importação que já existe** (tela Importação, `/treinador/importacao`):
- Aceita planilha `.xlsx` ou `.csv` de **alunos, pesos, exercícios, alimentos, suplementos e "outros"**. Não aceita plano
  de treino nem de dieta.
- Funciona em etapas: arquivo, configuração, mapeamento das colunas, **prévia que não grava nada**, confirmação. O
  treinador pode corrigir células na tabela antes de confirmar.
- O arquivo **não é guardado**: o servidor o lê de novo na confirmação. Do arquivo fica só a extensão (nunca o nome). O
  histórico guarda contagens e um resumo fixo ("Importou dados de ..."); nada do conteúdo vai a log.
- O envio tem limite de 1 MiB, limite de uso por pessoa e exige a permissão do destino no servidor.
- Plano de treino e de dieta só entram por um **script de migração** (`scripts/importacao/converter-planos.mjs` e
  `importar-planos.mjs`), feito para a planilha do Saraiva, rodado por quem tem acesso e com arquivos fora do
  repositório. Ele grava **rascunho, nunca publicado**; o que falta fica em branco ("—"); o exercício só é ligado à
  biblioteca se o treinador confirmar a sugestão. Esse é o jeito de trabalhar que vale aqui também.

**O formato do plano de treino** (`ConteudoTreino`), só o que importa para o encaixe:
- Objetivo e orientações (texto livre), até 20 sessões (nome, dia da semana, observação).
- Cada sessão tem até 40 exercícios: nome, ligação opcional com a biblioteca, modalidade, vídeo, observação.
- Cada exercício tem até 30 séries: **tipo** (um código da metodologia da consultoria, como "Aquecimento", "FS", "WS"),
  repetições (mínimo e máximo, ou AMRAP), carga (por exemplo, percentual da carga de trabalho), esforço (RIR ou RPE),
  descanso e técnica.
- A **metodologia** (tipos, técnicas, combinações) é da consultoria e vai copiada dentro do plano.
- O rascunho aceita plano incompleto; só a publicação valida e recusa o que falta (por exemplo, "Série sem tipo").
- Regra permanente do produto: **nunca inventar carga, repetição ou valor**; ausência de dado é "—".
- O plano de dieta tem refeições com itens (alimento, quantidade, unidade), opções A/B, modo de preparo, água e
  suplementação. Reconhecer dieta é mais difícil que treino (alimento e quantidade são texto livre).

**O que o app já faz no sentido contrário:** gera o PDF do plano no próprio aparelho. Ler PDF é novidade; não existe
nenhuma biblioteca de leitura de PDF ou de DOCX na API hoje.

**Onde isso se encaixa:** um "reconhecedor" transforma o texto do documento em um `ConteudoTreino` parcial; a prévia
mostra o que foi reconhecido ao lado do texto original; o que o treinador confirmar vira rascunho pelas rotas de rascunho
que já existem. Publicar e aplicar a aluno continuam sendo ações dele, no fluxo de sempre. Siglas do texto ("FS", "WS")
só viram o **código de um tipo que já existe** na metodologia da consultoria; o reconhecedor nunca cria tipo novo, e o
que não casar fica sem tipo (a publicação depois avisa).

## Opções

### (a) Colar o texto do documento; o app reconhece por regras
- **O treinador faz:** abre o plano no Google Docs (ou no PDF), seleciona tudo, copia, cola numa caixa de texto do app,
  vê a prévia ao lado do texto, corrige e cria o rascunho.
- **Roda no servidor:** nada novo. O reconhecimento é uma regra pura no próprio app (com teste), como as outras regras
  de `dominio/`. O servidor só recebe o rascunho já pronto, pela rota de sempre.
- **Fica guardado:** só o rascunho. O texto colado fica na memória da tela e some ao fechar (nada em disco, fila,
  log ou outro serviço).
- **Esforço:** M para treino; dieta soma mais M ou G.
- **Riscos:** cada treinador escreve de um jeito ("4x8-10", "4 séries de 8 a 10", "Supino reto - 4 x 12 - 60s");
  tabela colada vira texto desalinhado; no começo reconhece menos. Por isso a prévia, a correção e o "—" são parte do
  desenho. Não lê PDF nem DOCX: o treinador cola o texto.

### (b) Enviar um PDF; o servidor extrai o texto e aplica as mesmas regras
- **O treinador faz:** escolhe o arquivo PDF no app, vê a prévia, corrige e cria o rascunho.
- **Roda no servidor:** uma biblioteca de leitura de PDF (dependência nova: entra em Dependabot e Trivy e pede revisão
  de segurança), lendo **só em memória**, com limites de tamanho, páginas e tempo; devolve o texto reconhecido. As
  regras de reconhecimento seriam as mesmas da opção (a).
- **Fica guardado:** nada além do resultado (rascunho). Sem arquivo, sem texto, sem nome do arquivo, sem log.
- **Esforço:** G (parser, limites, testes com PDF malformado, revisão de segurança), mais o M da opção (a).
- **Riscos:** PDF malicioso ou gigante; PDF protegido por senha; PDF escaneado (é imagem, não tem texto: só com OCR,
  que fica fora); texto de tabela sai fora de ordem. O limite de 1 MiB do corpo pode ser pequeno para PDF com logo e
  fotos.

### (c) Google Docs
- **(c1) Sem integração: baixar o Docs como DOCX ou PDF, ou copiar e colar.**
  - O treinador usa "Arquivo > Fazer download" no Docs e envia o arquivo ao app (ou copia e cola, que é a opção (a)).
  - O DOCX conserva tabelas e listas melhor que o PDF, então extrai melhor. Ele é um arquivo compactado de XML: a
    leitura precisa de limite de tamanho já descompactado, de número de itens e de proibição de entidades externas no
    XML. Na API já existe leitura de `.xlsx` (também um zip de XML), então há o que aproveitar do cuidado.
  - Servidor, guardado e riscos: os mesmos da opção (b). Esforço: M a mais sobre (b).
  - Nenhum dado nosso vai ao Google.
- **(c2) Integração com a API do Google (OAuth).**
  - O treinador entra com a conta Google, escolhe o documento dentro do app e o servidor o lê.
  - Servidor: guarda o token de acesso (segredo, cifrado, com revogação); fluxo de login diferente na web e no celular;
    a política de segurança de conteúdo do app hoje só fala com a própria API e teria de abrir exceção.
  - Escopos: o mais estreito (acesso só ao arquivo que o treinador escolher no seletor do Google) é o menos exigente; os
    de leitura de todos os documentos são "sensíveis" ou "restritos" e o Google pode exigir verificação do aplicativo e
    até avaliação de segurança. **Conferir as regras vigentes do Google antes de decidir**; não foram verificadas aqui.
  - Fica guardado: o token enquanto o treinador estiver conectado (e o rascunho).
  - Esforço: G. Risco extra: nova relação com um terceiro (termos de uso de dados da API do Google) e mais uma coisa
    para o aviso de privacidade. Na leitura o plano vem **do** Google para cá; se um dia o app gravasse de volta, aí
    seria envio para outro serviço.

### (d) Extração assistida por um modelo de IA externo
- **O treinador faz:** o mesmo que em (b) ou (c1); o app devolve o plano já mais completo.
- **Roda no servidor:** extrai o texto como em (b) e **envia o texto para o serviço do modelo**; recebe o plano em
  formato fixo e o valida (o validador de treino e uma conferência de que cada número devolvido existe no texto).
- **Fica guardado:** de nossa parte, nada além do rascunho. No serviço externo, o que o contrato permitir (retenção,
  uso para treinar modelo): ainda não se sabe.
- **Esforço:** G, mais custo por uso, chave de acesso como segredo, limite por consultoria e chave de liga/desliga
  desligada por padrão, como as outras integrações.
- **Riscos:** o plano de aluno é dado sensível e iria para **outro serviço** (ver a próxima seção); o modelo pode
  **inventar** carga ou repetição, o que contraria a regra permanente; texto malicioso dentro do documento pode tentar
  enganar o modelo; dependência e custo. Uma variante com modelo próprio na VPS evita o terceiro, mas exige máquina
  maior e é projeto à parte.

## LGPD e segurança
- **Plano de aluno é dado sensível** (AGENTS.md: nunca em log, no git ou em outro serviço). Todo o desenho abaixo parte
  disso.
- **Mandar conteúdo para um serviço externo é "outro serviço"**: vale para a IA (d) e deve ser tratado do mesmo jeito
  para a integração com o Google (c2). Antes de qualquer código das duas, o Gustavo decide e é definida a **base legal**,
  o contrato (sem guardar e sem treinar com o conteúdo), onde o dado fica, e o texto do aviso de privacidade e do termo
  de uso é revisado (a revisão jurídica deles já está pendente). Sem isso, (c2) e (d) ficam fechadas.
- **Upload de arquivo (b e c1):**
  - Tipo conferido pelos bytes do arquivo, nunca pela extensão ou pelo nome.
  - Teto de tamanho, de páginas e de tempo de leitura; PDF com senha e PDF sem texto recusados com mensagem clara.
  - Leitura só em memória; nada escrito em disco; links e anexos do PDF nunca abertos.
  - O limite de corpo é 1 MiB hoje na API. Se for preciso mais para PDF, o aumento vale **só para essa rota** e com
    teto; se aumentar, conferir também o proxy.
  - Limite de uso por pessoa (como o da prévia da importação), permissão checada no servidor e consultoria sempre a da
    sessão.
- **Nada gravado além do resultado:** nem o arquivo, nem o texto extraído, nem o nome do arquivo; nada em log, nem em
  erro. O histórico e a auditoria guardam só um resumo fixo.
- **O resultado nunca publica sozinho e nunca chega a um aluno sozinho.** Se entrar na pasta de um aluno, é rascunho. Se
  entrar como modelo (recomendado na pergunta 3), fica salvo no Planejamento e não chega a aluno nenhum: "Aplicar ao
  aluno" cria o rascunho e publicar continua manual.
- **Por quanto tempo fica guardado** (vale para todas as opções): o rascunho ou o modelo fica até o treinador apagar. No
  aluno, a anonimização e o "Excluir minha conta" o limpam; no modelo, nada limpa sozinho. Se o envio de arquivo
  reaproveitar o histórico de importação, a linha (só extensão e contagens) e o evento de auditoria ficam 1 ano, como
  hoje. O arquivo e o texto extraído não ficam em lugar nenhum.
- **Nunca inventar carga ou repetição:** só entra o que aparece no texto; o que não for reconhecido fica "—". A prévia
  mostra o original ao lado, para o treinador conferir.
- **Texto livre do documento** (orientações, observações, nome de aluno no cabeçalho): pode ter dado pessoal. Se o
  resultado virar **modelo**, o texto livre não é anonimizado depois (a anonimização do aluno não mexe em modelo). Por
  isso, por padrão, o texto livre não é importado; o treinador marca na prévia o que quer levar.
- **Não é um caminho para criar aluno ou dado cadastral:** só o plano; nome, e-mail e telefone do documento são
  ignorados.

## Recomendação
**Começar pela opção (a), só treino:** colar o texto, reconhecer por regras no próprio app, mostrar a prévia e criar um
**rascunho**. Não abre nada novo no servidor, não manda dado a terceiro, não guarda arquivo e já atende o Google Docs
(copiar e colar). Também mostra, com documentos reais, o quanto as regras reconhecem antes de investir em PDF.
Depois, se valer, acrescentar o envio de DOCX/PDF (b e c1) reaproveitando as mesmas regras.

**Fica de fora por enquanto:** IA externa (d), integração OAuth com o Google (c2), OCR de PDF escaneado, dieta (a decidir
na pergunta 2), mobilidade, vários documentos de uma vez, publicar ou aplicar a aluno automaticamente.

## Perguntas para o Gustavo decidir
1. **Por onde começar?** Colar o texto (a), recomendada. Alternativas: já com envio de PDF/DOCX (b, c1); IA (d).
2. **O que importar primeiro?** Só treino, recomendada. Alternativa: treino e dieta juntos (a dieta é bem mais difícil
   de reconhecer).
3. **Onde o resultado entra?** Como modelo no Planejamento, recomendada (sem aluno; depois o treinador usa "Aplicar ao
   aluno" como já faz). Alternativa: rascunho dentro da pasta de um aluno escolhido.
4. **Como conhecer os formatos reais?** Você (ou o Saraiva) escreve 2 ou 3 exemplos **fictícios que imitam o jeito real
   de escrever** (ou manda um modelo em branco, sem aluno nenhum), recomendada. O documento real fica com você: plano de
   aluno é dado sensível, mesmo sem o nome. Alternativa: documento real com tudo o que identifica apagado por você,
   guardado fora do repositório (com esse risco).
5. **O texto livre (orientações, observações) entra?** Não por padrão, só se o treinador marcar na prévia, recomendada.
   Alternativa: importar tudo.
6. **Se houver envio de arquivo depois: qual o limite?** Até 3 MiB, 20 páginas e só nessa rota, recomendada.
   Alternativa: manter 1 MiB.
7. **PDF escaneado (só imagem)?** Recusar com mensagem, recomendada. Alternativa: avaliar OCR depois.
8. **Google Docs?** Sem integração: o treinador copia o texto ou baixa como DOCX/PDF, recomendada. Alternativa:
   integração OAuth com o Google (esforço G, verificação do Google, aviso de privacidade).
9. **IA externa?** Não por enquanto, recomendada. Alternativa: avaliar depois, junto da revisão jurídica (base legal,
   contrato sem retenção e sem treino, aviso de privacidade).

## Passos propostos
- [ ] 1. Gustavo: responder as perguntas acima e, se puder, escrever 2 ou 3 exemplos fictícios no formato real — commit/run: —
- [ ] 2. Listar os formatos que aparecem nos exemplos fictícios (quais jeitos de escrever sessão, exercício, séries e repetições) — commit/run: —
- [ ] 3. Regra pura de reconhecimento de treino em `dominio/`, com teste e só dados fictícios ("—" no que não reconhecer) — commit/run: —
- [ ] 4. Protótipo da tela "Importar de texto" (texto ao lado do plano reconhecido, correção, texto livre opcional) e aprovação, como foi com o editor — commit/run: —
- [ ] 5. Tela e criação do modelo (ou do rascunho, conforme a pergunta 3) pelas rotas existentes; sugestão de exercício da biblioteca só com confirmação do treinador — commit/run: —
- [ ] 6. Ajuda, `AGENTS.md`, e2e em 390 e 1280 — commit/run: —
- [ ] 7. Só se decidido: envio de DOCX/PDF, com plano de segurança revisto antes do código (parser, limites, rota própria) — commit/run: —
- [ ] 8. Só se decidido: dieta — commit/run: —

## Fora do escopo
- IA externa, integração OAuth com o Google, OCR, mobilidade, vários documentos de uma vez, publicar ou aplicar a aluno
  automaticamente: ficam anotados aqui e voltam só se o Gustavo pedir.
- Importação de planilha (alunos, pesos, exercícios, alimentos, suplementos): já existe; não muda.

## O que ficou para trás
- Tudo acima está em aberto; nada foi implementado. Cada sobra futura vai também para "Pendências soltas" do README.
