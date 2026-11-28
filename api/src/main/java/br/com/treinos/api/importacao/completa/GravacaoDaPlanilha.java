package br.com.treinos.api.importacao.completa;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.LimiteDoTreinador;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.biblioteca.Alimento;
import br.com.treinos.api.biblioteca.AlimentoRepository;
import br.com.treinos.api.biblioteca.Ergogenico;
import br.com.treinos.api.biblioteca.ErgogenicoRepository;
import br.com.treinos.api.biblioteca.Exercicio;
import br.com.treinos.api.biblioteca.ExercicioRepository;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.conta.PlanoDaConsultoria;
import br.com.treinos.api.conta.PlanoException;
import br.com.treinos.api.conta.RecursosDoApp;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.PlanoDieta;
import br.com.treinos.api.dieta.PlanoDietaRepository;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.execucao.RegistroPeso;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.importacao.Importacao;
import br.com.treinos.api.importacao.ImportacaoDtos.Erro;
import br.com.treinos.api.importacao.ImportacaoRepository;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.AlimentoDaBiblioteca;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.AlunoExistente;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.AlunoNovo;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Contexto;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Dono;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.ExercicioDaBiblioteca;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.ExercicioNovo;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Montagem;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Permissoes;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.PesoNovo;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.PlanosDoAluno;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Confirmacao;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Criacao;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Previa;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Problema;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Validacao;
import br.com.treinos.api.pastas.PastaPlano;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.receitas.ReceitaService;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.PlanoTreino;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import br.com.treinos.api.treino.ValidadorTreino;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import br.com.treinos.api.web.VideoUrls;
import jakarta.persistence.EntityManager;
import org.hibernate.Session;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Prévia e confirmação da planilha completa. A prévia só monta ({@link MontagemDaImportacao}) e conta; a confirmação
 * relê o arquivo, confere o hash (arquivo + respostas), trava a consultoria e grava tudo numa transação: alunos sem
 * convite (vaga do plano conferida por aluno ativo novo), pesos, exercícios novos, e por aluno uma pasta com o treino e a
 * dieta <b>em rascunho</b>. Nada é publicado. Toda linha criada leva o {@code importacao_id} (V049), que o "Desfazer"
 * usa. Um único evento de auditoria ({@code IMPORTACAO_CONCLUIDA}, resumo fixo), como a importação de uma aba; os
 * serviços com {@code @Auditar} não são chamados.
 *
 * <p>Cada parte exige a permissão dela (conferida antes de qualquer efeito, porque a montagem já a deixa de fora):
 * pesos {@code ALUNO_SENSIVEL_ALTERAR}; objetivo e observações do aluno também; exercícios {@code BIBLIOTECA_ALTERAR};
 * treino {@code PASTA_ALTERAR} + {@code TREINO_ALTERAR}; dieta {@code PASTA_ALTERAR} + {@code DIETA_ALTERAR}; medicação e
 * ergogênicos {@code ERGOGENICO_ALTERAR}. A rota exige {@code ALUNO_ALTERAR}.
 */
@Service
public class GravacaoDaPlanilha {

    public static final String DESTINO = "planilha-completa";
    private static final int ERROS_GUARDADOS = 1000;
    private static final int TITULO = 120;
    /** Linhas por lote de INSERT na confirmação, o mesmo da importação de uma aba. */
    private static final int LOTE = 500;

    private final ExercicioRepository exercicios;
    private final AlimentoRepository alimentos;
    private final ErgogenicoRepository ergogenicos;
    private final AlunoRepository alunos;
    private final RegistroPesoRepository pesos;
    private final PastaRepository pastas;
    private final PlanoTreinoRepository treinos;
    private final PlanoDietaRepository dietas;
    private final ImportacaoRepository importacoes;
    private final ReceitaService receitas;
    private final PlanoDaConsultoria plano;
    private final LimiteDoTreinador limiteDoTreinador;
    private final ConsultoriaRepository consultorias;
    private final Auditoria auditoria;
    private final VideoUrls videos;
    private final ValidadorTreino validador;
    private final JsonMapper json;
    private final GuardaDasRespostas guarda;
    private final LinhasDaImportacao linhas;
    private final EntityManager entityManager;
    private final TransactionTemplate leituraDaConsultoria;
    private final TransactionTemplate gravacao;

    public GravacaoDaPlanilha(ExercicioRepository exercicios, AlimentoRepository alimentos,
                              ErgogenicoRepository ergogenicos, AlunoRepository alunos,
                              RegistroPesoRepository pesos, PastaRepository pastas, PlanoTreinoRepository treinos,
                              PlanoDietaRepository dietas, ImportacaoRepository importacoes, ReceitaService receitas,
                              PlanoDaConsultoria plano, ConsultoriaRepository consultorias, Auditoria auditoria,
                              VideoUrls videos, ValidadorTreino validador, JsonMapper json, GuardaDasRespostas guarda,
                              LimiteDoTreinador limiteDoTreinador, LinhasDaImportacao linhas, EntityManager entityManager,
                              PlatformTransactionManager transacoes) {
        this.limiteDoTreinador = limiteDoTreinador;
        this.linhas = linhas;
        this.entityManager = entityManager;
        this.leituraDaConsultoria = new TransactionTemplate(transacoes);
        this.leituraDaConsultoria.setReadOnly(true);
        this.gravacao = new TransactionTemplate(transacoes);
        this.exercicios = exercicios;
        this.alimentos = alimentos;
        this.ergogenicos = ergogenicos;
        this.alunos = alunos;
        this.pesos = pesos;
        this.pastas = pastas;
        this.treinos = treinos;
        this.dietas = dietas;
        this.importacoes = importacoes;
        this.receitas = receitas;
        this.plano = plano;
        this.consultorias = consultorias;
        this.auditoria = auditoria;
        this.videos = videos;
        this.validador = validador;
        this.json = json;
        this.guarda = guarda;
    }

    /** A planilha é lida e montada fora de transação; só a leitura da consultoria ({@link #contexto}) abre uma, curta. */
    public Previa previa(UUID importador, String nomeDoArquivo, byte[] bytes, String respostasJson) {
        RespostasDaPlanilha respostas = RespostasDaPlanilha.ler(respostasJson, json);
        LeituraDasAbas.Leitura leitura = LeituraDasAbas.ler(nomeDoArquivo, bytes);
        Contexto contexto = leituraDaConsultoria.execute(s -> contexto(importador));
        Montagem m = MontagemDaImportacao.montar(leitura, respostas, contexto);
        List<Problema> problemas = m.problemas();
        int mostrados = Math.min(AnaliseDaPlanilha.PROBLEMAS_NA_RESPOSTA, problemas.size());
        return new Previa(RespostasDaPlanilha.hash(bytes, respostas, json), criacao(m), m.partesPuladas(), m.pendencias(),
                validacao(m), List.copyOf(problemas.subList(0, mostrados)), problemas.size() - mostrados,
                porTipo(problemas));
    }

    /** Migração assistida, fase 2: o que a confirmação gravaria para alguns alunos. Só lê, como a prévia; devolve o mesmo {@code hash}. */
    public AmostraDaPlanilha.Amostra amostra(UUID importador, String nomeDoArquivo, byte[] bytes, String respostasJson,
                                             int inicio) {
        RespostasDaPlanilha respostas = RespostasDaPlanilha.ler(respostasJson, json);
        LeituraDasAbas.Leitura leitura = LeituraDasAbas.ler(nomeDoArquivo, bytes);
        Contexto contexto = leituraDaConsultoria.execute(s -> contexto(importador));
        Montagem m = MontagemDaImportacao.montar(leitura, respostas, contexto);
        return AmostraDaPlanilha.de(m, RespostasDaPlanilha.hash(bytes, respostas, json), inicio, contexto.alunos());
    }

    /**
     * {@code chavesIgnoradas} = a {@code chave} (da amostra) de cada aluno que o treinador desmarcou: ficam fora de tudo o que
     * é gravado. Vão pela chave, e não pela posição, porque a posição muda se alguém é criado entre a amostra e a
     * confirmação; e fora do {@code hash} de propósito: marcar ou desmarcar um aluno não invalida a prévia. Chave que não
     * está mais na planilha é 422 {@code ALUNO_IGNORADO_INVALIDO}.
     */
    public Confirmacao confirmar(UsuarioAutenticado eu, String nomeDoArquivo, byte[] bytes, String respostasJson,
                                 String hash, Set<String> chavesIgnoradas) {
        RespostasDaPlanilha respostas = RespostasDaPlanilha.ler(respostasJson, json);
        // Todas as abas lidas antes de abrir a transação: a leitura do arquivo não segura conexão nem a trava da consultoria.
        LeituraDasAbas.Leitura leitura = LeituraDasAbas.ler(nomeDoArquivo, bytes);
        String calculado = RespostasDaPlanilha.hash(bytes, respostas, json);
        if (hash == null || !MessageDigest.isEqual(calculado.getBytes(StandardCharsets.UTF_8),
                hash.getBytes(StandardCharsets.UTF_8))) {
            throw new ConflictException("Algo mudou desde a prévia. Gere a prévia de novo.", "PREVIA_DESATUALIZADA");
        }
        return gravacao.execute(s -> gravar(eu, nomeDoArquivo, bytes, respostas, leitura, calculado, chavesIgnoradas));
    }

    private Confirmacao gravar(UsuarioAutenticado eu, String nomeDoArquivo, byte[] bytes, RespostasDaPlanilha respostas,
                               LeituraDasAbas.Leitura leitura, String calculado, Set<String> chavesIgnoradas) {
        // Antes de ler alunos e contar vagas: duas confirmações na mesma consultoria não correm por e-mail ou vaga.
        Exigir.existe(consultorias.travar(TenantContext.get()), () -> new NaoEncontradoException("Importação não encontrada."));
        // Depois da trava: duas confirmações simultâneas se enfileiram, e a segunda já enxerga a primeira.
        exigirAindaNaoConfirmada(calculado);

        Montagem completa = MontagemDaImportacao.montar(leitura, respostas, contexto(eu.usuarioId()));
        Set<Dono> ignorados = donosIgnorados(completa, chavesIgnoradas);
        Montagem antes = completa.semDonos(ignorados);
        Criacao criacao = criacao(antes);
        int total = criacao.alunosNovos() + criacao.pesos() + criacao.exercicios() + criacao.pastas();
        String situacao = total == 0 ? "FALHOU" : antes.problemas().isEmpty() ? "CONCLUIDA" : "CONCLUIDA_COM_ERROS";
        Importacao importacao = importacoes.saveAndFlush(new Importacao(DESTINO, extensao(nomeDoArquivo, bytes),
                eu.usuarioId(), antes.linhas(), total, antes.alunosReaproveitados(), 0, antes.problemas().size(), situacao,
                json.writeValueAsString(configuracao(respostas, antes, criacao, calculado)), json.writeValueAsString(erros(antes))));
        UUID id = importacao.getId();

        // Tudo sai em lotes de LOTE (ids UUID do Java) e um flush só no fim, como a importação de uma aba: cada tipo é
        // salvo de uma vez, sem intercalar, para o lote não quebrar a cada troca de tabela.
        Session sessao = entityManager.unwrap(Session.class);
        sessao.setJdbcBatchSize(LOTE);
        Montagem m;
        try {
            // Os exercícios primeiro, num lote; a montagem roda de novo para os treinos ligarem aos ids novos.
            for (ExercicioNovo e : antes.exerciciosNovos()) {
                Exercicio criado = new Exercicio(e.nome(), e.grupo(), null, Exercicio.Modalidade.MAQUINA, e.videoUrl(), null,
                        Exercicio.Origem.IMPORTACAO);
                criado.marcarImportacao(id);
                exercicios.save(criado);
            }
            if (!antes.exerciciosNovos().isEmpty()) {
                descarregar();
            }
            m = antes.exerciciosNovos().isEmpty() ? antes
                    : MontagemDaImportacao.montar(leitura, respostas, contexto(eu.usuarioId())).semDonos(ignorados);

            // Uma conferência para todos, antes de salvar (consulta no meio das linhas descarregaria o lote a cada aluno).
            // Rede de segurança: a montagem já reservou as vagas sob a mesma trava da consultoria. Não captura: a 409
            // LIMITE_DO_PLANO ou LIMITE_DO_TREINADOR desfaz a confirmação inteira.
            long ativos = m.alunosNovos().stream().filter(AlunoNovo::ativo).count();
            if (ativos > 0) {
                Long vagas = plano.vagasDeAluno();
                if (vagas != null && ativos > vagas) {
                    throw PlanoException.limite(RecursosDoApp.LIMITE_ALUNOS_ATIVOS,
                            "Seu plano não tem vaga para todos os alunos ativos desta planilha.");
                }
                // O importador é o responsável de todo aluno novo.
                limiteDoTreinador.exigirVaga(eu.usuarioId(), ativos, null);
            }

            Map<Dono, UUID> novos = new HashMap<>();
            for (AlunoNovo a : m.alunosNovos()) {
                Aluno aluno = new Aluno(a.nome(), a.email(), a.objetivo(), a.observacoes(), null);
                aluno.alterarSituacao(a.ativo(), Instant.now());
                aluno.alterarResponsavel(eu.usuarioId());
                aluno.guardarTelefoneSemAcesso(a.telefone()); // sem acesso: o telefone fica no cadastro (V048)
                aluno.marcarImportacao(id);
                alunos.save(aluno);
                novos.put(a.dono(), aluno.getId());
            }
            for (PesoNovo p : m.pesos()) {
                RegistroPeso peso = new RegistroPeso(alunoDe(p.dono(), novos), p.data(), p.kg(), p.observacao(), eu.usuarioId());
                peso.marcarImportacao(id);
                pesos.save(peso);
            }
            List<PlanoTreino> treinosNovos = new ArrayList<>();
            List<PlanoDieta> dietasNovas = new ArrayList<>();
            for (PlanosDoAluno p : m.planos()) {
                UUID alunoId = alunoDe(p.dono(), novos);
                PastaPlano pasta = new PastaPlano(alunoId, MontagemDaImportacao.TITULO_PASTA, null, null);
                pasta.marcarImportacao(id);
                pastas.save(pasta);
                if (p.treino() != null) {
                    PlanoTreino t = new PlanoTreino(alunoId, titulo("Treino de ", p.nome()), null, null,
                            json.writeValueAsString(p.treino()));
                    t.definirPasta(pasta.getId());
                    t.marcarImportacao(id);
                    treinosNovos.add(t);
                }
                if (p.dieta() != null) {
                    PlanoDieta d = new PlanoDieta(alunoId, titulo("Dieta de ", p.nome()), null, null,
                            json.writeValueAsString(p.dieta()));
                    d.definirPasta(pasta.getId());
                    d.marcarImportacao(id);
                    dietasNovas.add(d);
                }
            }
            treinos.saveAll(treinosNovos);
            dietas.saveAll(dietasNovas);
            descarregar();
        } finally {
            sessao.setJdbcBatchSize(null);
        }
        // As respostas ficam guardadas na consultoria e voltam marcadas na próxima análise (as de suplemento, só com a
        // dieta, como na análise). Na mesma transação: se a confirmação desfaz, elas também.
        guarda.guardar(respostas, leitura, AcessoAtual.pode("PASTA_ALTERAR") && AcessoAtual.pode("DIETA_ALTERAR"));
        auditoria.registrarEvento("IMPORTACAO_CONCLUIDA", "IMPORTACAO", id, "Importou dados de planilha completa.");
        return new Confirmacao(id, situacao, criacao(m, criacao.exercicios()), m.partesPuladas(), validacao(m),
                m.problemas().size(), porTipo(m.problemas()));
    }

    /**
     * Os donos das chaves ignoradas ({@link Dono#chaveEstavel()}, as mesmas da amostra). Chave que não está na planilha é 422;
     * ignorar todos (nada sobra para gravar) também. Repetida conta uma vez.
     */
    static Set<Dono> donosIgnorados(Montagem m, Set<String> chaves) {
        if (chaves == null || chaves.isEmpty()) {
            return Set.of();
        }
        List<Dono> ordem = AmostraDaPlanilha.ordemDosDonos(m);
        Set<Dono> ignorados = new HashSet<>();
        Set<String> achadas = new HashSet<>();
        for (Dono d : ordem) {
            if (chaves.contains(d.chaveEstavel())) {
                ignorados.add(d);
                achadas.add(d.chaveEstavel());
            }
        }
        if (!achadas.containsAll(chaves)) {
            throw new ValidacaoException("Um aluno marcado para ignorar não está mais na planilha. Gere a prévia de novo.",
                    "ALUNO_IGNORADO_INVALIDO", List.of());
        }
        if (ignorados.size() == ordem.size()) {
            throw new ValidacaoException("Marque pelo menos um aluno para importar.", "NENHUM_ALUNO_MARCADO", List.of());
        }
        return ignorados;
    }

    /**
     * A mesma planilha (mesmo {@code hash}: arquivo e respostas) não entra duas vezes na consultoria: reenviar depois de
     * perder a resposta daria outra pasta por aluno e exercícios "criar" repetidos. Vale só enquanto a importação anterior
     * ainda tem o que criou; depois de um "Desfazer" completo, dá para importar de novo.
     * shortcut: lê as importações da planilha completa da consultoria e compara o hash em memória (são poucas), trocar por
     * coluna própria se passarem de algumas centenas.
     */
    private void exigirAindaNaoConfirmada(String hash) {
        var anteriores = importacoes.buscar(List.of(DESTINO),
                br.com.treinos.api.importacao.ImportacaoService.SituacaoDaImportacao.todas(), "", Instant.EPOCH,
                Instant.parse("9999-12-31T00:00:00Z"), org.springframework.data.domain.Pageable.unpaged());
        for (Importacao i : anteriores) {
            if (hash.equals(json.readTree(i.getConfiguracao()).path("hash").asString(""))
                    && (!linhas.pastas(i.getId()).isEmpty() || !linhas.alunos(i.getId()).isEmpty()
                    || !linhas.exercicios(i.getId()).isEmpty() || !linhas.pesos(i.getId()).isEmpty())) {
                throw new ConflictException("Esta planilha já foi importada. Veja o histórico; se for importar de novo, "
                        + "desfaça a importação anterior antes.", "IMPORTACAO_JA_CONFIRMADA");
            }
        }
    }

    /** O que a montagem precisa da consultoria, lido pelos repositórios (já filtrados pelo {@code @TenantId}). */
    private Contexto contexto(UUID importador) {
        List<ExercicioDaBiblioteca> daBiblioteca = exercicios.buscarAtivos("%").stream()
                .map(e -> new ExercicioDaBiblioteca(e.getId(), e.getNome(),
                        e.getModalidade() == null ? null : e.getModalidade().name(), e.getVideoUrl()))
                .toList();
        List<AlimentoDaBiblioteca> alimentosDaBiblioteca = alimentos.buscarAtivos("%").stream()
                .map((Alimento a) -> new AlimentoDaBiblioteca(a.getId(), a.getNome())).toList();
        List<String> nomesDeSuplementos = alimentos.findAll().stream()
                .filter(a -> a.getTipo() == Alimento.Tipo.SUPLEMENTO).map(Alimento::getNome).toList();
        List<String> nomesDeErgogenicos = ergogenicos.findAll().stream().map(Ergogenico::getNome).toList();
        Map<UUID, Set<LocalDate>> datas = new HashMap<>();
        for (Object[] p : linhas.datasDosPesos()) {
            datas.computeIfAbsent((UUID) p[0], k -> new HashSet<>()).add((LocalDate) p[1]);
        }
        List<AlunoExistente> existentes = alunos.findAll().stream()
                .map(a -> new AlunoExistente(a.getId(), a.getNome(), a.getEmail(), a.isAnonimizado(),
                        datas.getOrDefault(a.getId(), Set.of())))
                .toList();
        boolean pasta = AcessoAtual.pode("PASTA_ALTERAR");
        Permissoes permissoes = new Permissoes(AcessoAtual.pode("ALUNO_SENSIVEL_ALTERAR"),
                AcessoAtual.pode("BIBLIOTECA_ALTERAR"), pasta && AcessoAtual.pode("TREINO_ALTERAR"),
                pasta && AcessoAtual.pode("DIETA_ALTERAR"), AcessoAtual.pode("ERGOGENICO_ALTERAR"));
        return new Contexto(daBiblioteca, alimentosDaBiblioteca, nomesDeSuplementos, nomesDeErgogenicos, existentes,
                receitas.metodologiaPadrao().orElse(null), plano.vagasDeAluno(), limiteDoTreinador.vagas(importador, null), permissoes, LocalDate.now(Fuso.BRASILIA),
                videos::valida);
    }

    /**
     * Grava o que ficou pendente (em lotes). Violação de restrição aqui só vem de gravação que correu por fora da trava da
     * consultoria: 409 em vez de 500, e a confirmação inteira recua, como na importação de uma aba.
     */
    private void descarregar() {
        try {
            alunos.flush();
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("Os dados mudaram durante a importação. Gere a prévia de novo.",
                    "CONFLITO_NA_IMPORTACAO");
        }
    }

    private static UUID alunoDe(Dono dono, Map<Dono, UUID> novos) {
        UUID id = dono.existente() != null ? dono.existente() : novos.get(dono);
        if (id == null) {
            throw new IllegalStateException("Dono sem aluno gravado.");
        }
        return id;
    }

    private static String titulo(String prefixo, String nome) {
        String t = prefixo + (nome == null ? "" : nome);
        return t.length() <= TITULO ? t : t.substring(0, TITULO).strip();
    }

    private static Criacao criacao(Montagem m) {
        return criacao(m, m.exerciciosNovos().size());
    }

    static Criacao criacao(Montagem m, int exerciciosNovos) {
        int treinos = 0;
        int sessoes = 0;
        int exerciciosNosTreinos = 0;
        int ligados = 0;
        int series = 0;
        int dietas = 0;
        int refeicoes = 0;
        int itens = 0;
        int itensLigados = 0;
        int suplementos = 0;
        int ergogenicos = 0;
        for (PlanosDoAluno p : m.planos()) {
            if (p.treino() != null) {
                treinos++;
                for (ConteudoTreino.Sessao s : p.treino().sessoes()) {
                    sessoes++;
                    for (ConteudoTreino.ExercicioPlano e : s.exercicios()) {
                        exerciciosNosTreinos++;
                        ligados += e.exercicioId() == null ? 0 : 1;
                        series += e.series() == null ? 0 : e.series().size();
                    }
                }
            }
            if (p.dieta() != null) {
                ConteudoDieta d = p.dieta();
                dietas++;
                for (ConteudoDieta.Refeicao r : d.refeicoes()) {
                    refeicoes++;
                    for (ConteudoDieta.Opcao o : r.opcoes()) {
                        for (ConteudoDieta.Item i : o.itens()) {
                            itens++;
                            itensLigados += i.alimentoId() == null ? 0 : 1;
                        }
                    }
                }
                suplementos += d.suplementacao() == null ? 0 : d.suplementacao().size();
                ergogenicos += d.ergogenicos() == null ? 0 : d.ergogenicos().size();
            }
        }
        int inativos = (int) m.alunosNovos().stream().filter(a -> !a.ativo()).count();
        return new Criacao(m.alunosNovos().size(), inativos, m.alunosReaproveitados(), m.pesos().size(), m.pesosIniciais(),
                m.pesosJaRegistrados(), exerciciosNovos, m.planos().size(), treinos, sessoes, exerciciosNosTreinos, ligados,
                series, dietas, refeicoes, itens, itensLigados, suplementos, ergogenicos, m.suplementosSensiveisPulados(),
                m.faixasRecuperadasDeData());
    }

    /** Erros e avisos que a publicação apontaria nos treinos (só contados; o rascunho entra de qualquer forma). */
    private Validacao validacao(Montagem m) {
        int erros = 0;
        int avisos = 0;
        for (PlanosDoAluno p : m.planos()) {
            if (p.treino() != null) {
                ResultadoValidacao r = validador.validar(p.treino(), null, null);
                erros += r.erros().size();
                avisos += r.avisos().size();
            }
        }
        return new Validacao(erros, avisos);
    }

    private static Map<String, Integer> porTipo(List<Problema> problemas) {
        Map<String, Integer> contagem = new LinkedHashMap<>();
        problemas.forEach(p -> contagem.merge(p.tipo(), 1, Integer::sum));
        return contagem;
    }

    /**
     * Histórico: aba e linha, campo e o código do problema; nunca o valor da célula. A aba é sempre "Aba N" (o nome dela pode
     * ser o de um aluno e o histórico fica um ano).
     */
    static List<Erro> erros(Montagem m) {
        List<Erro> erros = new ArrayList<>();
        for (Problema p : m.problemas()) {
            if (erros.size() == ERROS_GUARDADOS) {
                break;
            }
            String aba = m.abasComNomeDeAluno().getOrDefault(p.aba(), "Aba");
            erros.add(new Erro(p.linha(), p.campo() == null ? "" : p.campo(), aba + ": " + p.tipo()));
        }
        return erros;
    }

    /** A configuração guardada: tipos confirmados das abas, partes puladas e contagens. Sem nomes nem respostas de nomes. */
    private static Map<String, Object> configuracao(RespostasDaPlanilha respostas, Montagem m, Criacao criacao, String hash) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("hash", hash); // o da prévia (arquivo + respostas): a confirmação repetida é recusada por ele
        Map<String, String> abas = new LinkedHashMap<>();
        respostas.abas().forEach(a -> abas.put(String.valueOf(a.indice()), a.tipo()));
        c.put("tiposDasAbas", abas);
        c.put("partesPuladas", m.partesPuladas());
        c.put("criacao", criacao);
        return c;
    }

    /** Só a extensão (LGPD: o nome do arquivo costuma ter o nome do aluno ou do treinador). */
    private static String extensao(String nome, byte[] bytes) {
        String limpo = nome == null ? "" : nome.toLowerCase(java.util.Locale.ROOT).trim();
        boolean zip = bytes != null && bytes.length >= 2 && bytes[0] == 'P' && bytes[1] == 'K';
        return limpo.endsWith(".xlsx") || zip ? ".xlsx" : ".csv";
    }
}
