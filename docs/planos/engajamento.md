# Comunidade, Aulões & Gamificação (antigo Engajamento — C81 / N45)

Situação: Etapa 0 concluída em produção (V039/V040); Comunidade, Aulões & Gamificação planejada para pós-piloto · Onde: `main` · Atualizado: 09/11/2026

## Objetivo
Transformar a consultoria em uma verdadeira comunidade viva dentro do próprio aplicativo, evitando que o aluno treine em uma "ilha solitária" e aumentando substancialmente a consistência de treinos, a taxa de retenção e a renovação de ciclos. 

A proposta combina o efeito social e a celebração de superação pessoal do **Hevy** (PRs, troféus de constância e feed do time) com o valor educacional e o senso de pertencimento de plataformas de comunidade como **Circle/Hotmart** (aulões ao vivo/gravados e comunicados do treinador), com isolamento estrito por consultoria e blindagem total de dados sensíveis (LGPD).

---

## Diagnóstico da Mudança (Reunião de 08/11, 1:24:25–1:26:07, N45)
O plano original de engajamento tratava gamificação e comunidade como apêndices distantes, priorizando métricas isoladas. Na reunião de 08/11 com o Saraiva, ficou evidente que:
1. **O aluno precisa de pertencimento**: O que segura o aluno na consultoria a médio e longo prazo não é apenas uma planilha ou lista estática de séries, mas sentir que faz parte de um time (o "Saraiva Team") com outros alunos na mesma jornada.
2. **Dispersão de ferramentas**: Hoje treinadores precisam criar grupos de WhatsApp barulhentos, assinar plataformas externas (Circle) ou usar áreas de membros (Hotmart) para transmitir aulões mensais e postar comunicados. Trazer isso para dentro do app unifica a experiência sob a marca do treinador.
3. **Reconhecimento sem comparação tóxica**: A comemoração deve premiar a **constância** e a **superação pessoal** (bater os próprios recordes), nunca comparação corporal ou exposição de dados clínicos.

---

## O Que Já Foi Entregue (Etapa 0 — Em Produção)
A base do retorno imediato foi entregue na Etapa 0, testada com sucesso e colocada em produção sob a chave `TREINOS_RETORNO_HABILITADO=true` (V039 e V040):
1. **Concluir Treino (`sessao_concluida`, V039)**:
   - Botão "Concluir treino" no app com declaração de duração e percepção do treino ("Como foi seu treino?").
   - Faixa de treino ao vivo (`FaixaDoTreino.tsx`): Duração cronometrada em tempo real, volume da sessão em kg e contador de séries feitas.
   - Coluna "Anterior" no cartão de cada série: exibição da carga e repetições realizadas na última execução daquela série.
2. **Recordes Pessoais (`RecordesPessoais.java` e `recordesPessoais.ts`)**:
   - Detecção instantânea e offline de 3 tipos de PRs em séries simples: Maior Carga, Mais Repetições com a mesma carga e Maior Volume da série.
   - Miniatura do exercício e aviso sonoro/visual no topo ao marcar a série.
3. **Tela "Bom trabalho!" & Cartão para Stories (`concluido.tsx` e `CartaoDoTreino.tsx`)**:
   - Tela comemorativa com contagem cumulativa de treinos ("Este é o seu 12º treino"), resumo da sessão e PRs batidos no dia.
   - Exportação de imagem SVG/PNG em 1080×1920 para Stories do Instagram com calendário mensal dos dias treinados e identidade visual da consultoria.
4. **Reação do Treinador ("Visto", V040)**:
   - Tabela `sessao_concluida_visto` com permissão `REGISTRO_REAGIR`.
   - Treinador visualiza treinos concluídos recentes na ficha do aluno e marca como "Visto".
   - Aluno recebe o selo "Visto pelo treinador" no app.

---

## O Novo Desenho em 3 Pilares (Pós-Piloto)

### Pilar 1 — Aulões Mensais & Avisos do Treinador (Substituindo Circle/Hotmart)
- **Aulões ao Vivo e Gravados**:
  - Treinador cadastra o aulão mensal com data/hora, tema, descrição e link do YouTube (live ou vídeo não-listado).
  - Aluno assiste à aula diretamente dentro do app (player seguro, sem expor tokens ou dados de navegação).
  - Seção de Dúvidas/Comentários por aula: alunos enviam perguntas e treinadores respondem com selo visual de "Resposta do Treinador".
- **Quadro de Avisos da Consultoria**:
  - Posts e comunicados oficiais fixados no topo (recados operacionais, abertura de novos ciclos, dicas nutricionais gerais).

### Pilar 2 — Mural do Time / Feed Social Interno (Opt-in Estrito)
- **Compartilhamento Espontâneo ao Concluir**:
  - Na tela `"Bom trabalho!"`, interruptor opcional: *"Compartilhar no Mural do Time"*.
  - O aluno escolhe se quer publicar aquele treino para os colegas de consultoria verem.
  - O post exibe: nome/foto de perfil do aluno, treino concluído (ex.: *"Segunda - Costas"*), duração, volume total e medalhas de PRs batidos no dia. Foto opcional (apenas se o aluno desejar anexar foto do treino, com consentimento prévio de uso de imagem).
- **Interação Positiva entre Alunos**:
  - Reações rápidas de incentivo: 🔥 (Fogo), 💪 (Força), 👏 (Palmas).
  - Comentários de apoio entre alunos e treinadores da mesma consultoria.
- **Blindagem LGPD Estrita**:
  - O mural **NUNCA** exibe peso corporal, percentual de gordura, fotos de avaliação física, dieta, gramas de alimentos, suplementos/ergogênicos ou anamnese.
  - Moderação ativa: treinadores com autoridade `MURAL_MODERAR` podem excluir comentários ou ocultar posts a qualquer momento.

### Pilar 3 — Galeria de Conquistas Permanentes (`conquista_aluno`) & Ranking do Time
- **Banco de Conquistas Permanentes (`conquista_aluno`)**:
  - Em vez de medalhas voláteis de sessão, gravação no banco de conquistas desbloqueadas:
    - *Primeiro Treino Concluído*
    - *Marcos de Constância*: 10, 25, 50, 100, 250 treinos concluídos
    - *Semana Perfeita*: 100% dos treinos programados da semana realizados
    - *Mês Impecável*: 4 semanas consecutivas sem faltar nenhum treino
    - *Mestre da Carga*: 5, 10, 25 recordes pessoais batidos
    - *Guerreiro de Fim de Semana*: treinos realizados em sábado/domingo
  - Galeria/Vitrine de Troféus visível no perfil do aluno e na ficha do treinador.
- **Ranking da Consultoria (Duas Abas)**:
  1. **Aba Constância & Superação no Mês** (Inclusiva para todos):
     - Pontuação baseada em assiduidade no plano prescrito e superação das próprias marcas (PRs pessoais). Alunos iniciantes competem em pé de igualdade com avançados.
  2. **Aba Força por Exercício (Opt-in)**:
     - Ranking de carga nos grandes movimentos (Supino, Agachamento/Leg Press, Stiff/Levantamento Terra). Apenas alunos que marcarem a opção *"Participar do ranking de força"* aparecem na listagem.

---

## Decisões de Arquitetura

| # | Decisão | Detalhe |
|---|---|---|
| D1 | **Isolamento por Consultoria** | Todo post de mural, aula, comentário e ranking possui `@TenantId` rigoroso. Alunos do Saraiva Team nunca veem conteúdos nem alunos de outra consultoria. |
| D2 | **Opt-in em Todas as Camadas Sociais** | Nenhum treino vai automaticamente para o mural; o aluno precisa marcar voluntariamente a opção de compartilhar no fim da sessão. |
| D3 | **Blindagem de Dados Clínicos (LGPD)** | Separação física e lógica total entre feed social e dados clínicos. O feed consome apenas a projeção de conclusão esportiva (`sessao_concluida` + `exercicio.nome` + carga da série), nunca entidades de saúde. |
| D4 | **Player Incorporado** | Aulões utilizam player embed padronizado sem coleta de cookies invasivos de terceiros, preservando a performance do app. |

---

## Passos Planejados (Para Implementação Pós-Piloto)

- [ ] 1. **Banco e Migrations (Flyway)**:
  - Criar tabelas `aula_comunidade` e `aula_comentario` para os aulões e dúvidas.
  - Criar tabelas `post_mural`, `reacao_mural` e `comentario_mural` com índices por `consultoria_id` e data.
  - Criar tabela `conquista_aluno` e catálogo de conquistas (`codigo`, `nome`, `icone`, `categoria`).
- [ ] 2. **API — Endpoints e Regras**:
  - Gestão de Aulões: rotas de criação/edição pelo treinador e listagem/comentários pelos alunos.
  - Mural Social: publicação com validação de opt-in, listagem paginada, reações e comentários.
  - Motor de Conquistas: listener assíncrono ao concluir sessão que avalia e grava conquistas em `conquista_aluno`.
  - Ranking Mensal: serviço com consulta agregada mensal de constância e PRs.
- [ ] 3. **App — Aba Comunidade & Aulões (Aluno e Treinador)**:
  - Nova aba ou seção "Comunidade" no app com duas visões: "Aulões & Avisos" e "Mural do Time".
  - Player de vídeo de aula com caixa de perguntas abaixo.
  - Feed do mural com cards elegantes de treino concluído, botões de reação rápida e comentários.
- [ ] 4. **App — Galeria de Conquistas e Vitrine de Troféus**:
  - Seção "Minhas Conquistas" no perfil do aluno com troféus coloridos desbloqueados e silhuetas dos próximos a conquistar.
  - Notificação comemorativa especial ao desbloquear uma nova conquista.
- [ ] 5. **E2E e Testes de Carga**:
  - Testes cobrindo fluxo completo: concluir treino → publicar no mural → outro aluno reagir/comentar → moderação pelo treinador.
  - Garantia de isolamento multi-tenant nos feeds e rankings.

---

## Fora do Escopo
- Chat direto 1:1 privado entre alunos (comunicação privada é exclusiva do aluno com seu treinador/equipe).
- Transmissão de vídeo ao vivo hospedada pelo próprio servidor (transmissões usam a infraestrutura do YouTube/Vimeo).
- Comparação ou exibição de peso corporal, fotos de avaliação física ou dietas em rankings.
