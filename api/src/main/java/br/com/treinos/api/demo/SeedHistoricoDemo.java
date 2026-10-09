package br.com.treinos.api.demo;

import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.alunos.ConviteService;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoRequest;
import br.com.treinos.api.atualizacoes.Atualizacao;
import br.com.treinos.api.atualizacoes.AtualizacaoModelo;
import br.com.treinos.api.atualizacoes.AtualizacaoModeloRepository;
import br.com.treinos.api.atualizacoes.AtualizacaoRepository;
import br.com.treinos.api.atualizacoes.ValidadorAtualizacao;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.PlanoDietaService;
import br.com.treinos.api.execucao.ExecucaoUpsert;
import br.com.treinos.api.execucao.RegistroPeso;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.lesoes.LesaoAluno.Situacao;
import br.com.treinos.api.lesoes.LesaoDtos.LesaoRequest;
import br.com.treinos.api.lesoes.LesaoService;
import br.com.treinos.api.mobilidade.PlanoMobilidadeService;
import br.com.treinos.api.pastas.PastaDtos.PastaRequest;
import br.com.treinos.api.pastas.PastaPlano;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.pastas.PastaService;
import br.com.treinos.api.planos.dto.PlanoDtos.CriarPlanoRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.PlanoDetalhe;
import br.com.treinos.api.planos.dto.PlanoDtos.PublicarRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.SalvarRascunhoRequest;
import br.com.treinos.api.receitas.ConteudoMobilidade;
import br.com.treinos.api.receitas.Receita;
import br.com.treinos.api.receitas.ReceitaService;
import br.com.treinos.api.receitas.ReceitaService.ReceitaResponse;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Metodologia;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.treino.PlanoTreinoService;
import br.com.treinos.api.web.Fuso;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Random;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Histórico fictício para a demonstração: dez alunos do Saraiva com cinco pastas de 30 dias cada (quatro concluídas e
 * a atual), treinos e dietas publicados, execuções com carga que sobe, peso semanal, atualizações respondidas e, na
 * pasta atual, uma de cada situação (aberta, aviso, atrasada, para revisar). Usa os mesmos serviços da API, então tudo
 * passa pelas validações normais; só a gravação das execuções é direta ({@link ExecucaoUpsert}), porque a API recusa
 * datas com mais de 60 dias.
 *
 * <p>Parte dos modelos que o {@code scripts/demo/popular-modelos.mjs} cria: sem eles, falha com a lista do que falta.
 * Rodar duas vezes não duplica (o primeiro aluno já existindo encerra). Dados fictícios: nenhum nome, peso ou carga
 * real.</p>
 */
@Service
public class SeedHistoricoDemo {

    private static final Logger log = LoggerFactory.getLogger(SeedHistoricoDemo.class);

    public static final String PRIMEIRO_ALUNO = "aluno01@demo.local";

    private static final String FB = "Full Body (5 treinos)";
    private static final String AB = "AB Superior/Inferior";
    private static final String ABC = "ABC Empurrar/Puxar/Pernas";
    private static final String ABCDE = "ABCDE";
    private static final String PPL1 = "PPL 1";
    private static final String PPL2 = "PPL 2";
    private static final String PPL3 = "PPL 3";
    private static final String PPL4 = "PPL 4";
    private static final String PPL5 = "PPL 5";

    private static final List<String> DIETAS = List.of("1. Base clássica", "2. Carne bovina magra", "3. Peixe branco",
            "4. Suíno e batata-doce", "5. Massa e frango", "6. Mandioca e carne", "7. Fígado bovino",
            "8. Purê e tilápia", "9. Frango e boi", "10. Músculo e batata");

    private static final List<String> METODOLOGIAS = List.of("Séries tradicionais", "Feeder + Working sets",
            "Rest-pause", "Back-off sets", "Drop-set e Cluster");

    /** Modelos que precisam existir (criados pelo {@code popular-modelos.mjs}), por tipo. */
    public static final Map<Receita.Tipo, List<String>> MODELOS_NECESSARIOS = Map.of(
            Receita.Tipo.PLANO_TREINO, List.of(FB, AB, ABC, ABCDE, PPL1, PPL2, PPL3, PPL4, PPL5),
            Receita.Tipo.PLANO_DIETA, DIETAS,
            Receita.Tipo.METODOLOGIA, METODOLOGIAS,
            Receita.Tipo.MOBILIDADE, List.of("Mobilidade matinal", "Pré-treino de pernas", "Lombar e cadeia posterior",
                    "Pós-treino global"));

    private enum Situacao5 { MEIO, ABERTA, AVISO, ATRASADA, ENVIADA_ONTEM }

    private record Lesao(String regiao, String descricao, int inicioHaDias, Integer fimHaDias, Situacao situacao,
                         String observacao) {
    }

    /**
     * Um aluno: nome, divisão/dieta/metodologia de cada uma das cinco pastas, situação da pasta atual e quantos dias
     * faltam para o fim dela (negativo = já passou).
     */
    private record Perfil(String nome, List<String> semanas, List<Integer> dietas, List<Integer> metodologias, Situacao5 situacao,
                          int fimEmDias, String mobilidade, Lesao lesao) {
    }

    private static final List<Perfil> PERFIS = List.of(
            new Perfil("Ana Ribeiro", List.of(FB, FB, FB, ABC, ABC), List.of(1, 1, 2, 2, 2), List.of(0, 0, 1, 1, 1),
                    Situacao5.MEIO, 12, "Mobilidade matinal", null),
            new Perfil("Bruno Costa", List.of(AB, AB, AB, AB, ABCDE), List.of(2, 2, 3, 3, 3), List.of(1, 1, 1, 3, 3),
                    Situacao5.ABERTA, 1, null, new Lesao("Ombro direito",
                    "Desconforto leve ao elevar o braço acima da cabeça.", 40, null, Situacao.EM_RECUPERACAO,
                    "Evitar desenvolvimento pesado até melhorar.")),
            new Perfil("Carla Mendes", List.of(PPL1, PPL1, PPL2, PPL2, PPL3), List.of(3, 4, 4, 4, 5), List.of(0, 0, 0, 2, 2),
                    Situacao5.AVISO, 3, null, null),
            new Perfil("Diego Alves", List.of(ABCDE, ABCDE, ABCDE, PPL4, PPL4), List.of(4, 5, 5, 6, 6), List.of(1, 1, 3, 3, 3),
                    Situacao5.ATRASADA, -2, "Pré-treino de pernas", null),
            new Perfil("Eduarda Lima", List.of(FB, AB, AB, AB, AB), List.of(5, 6, 6, 7, 7), List.of(0, 0, 1, 1, 1),
                    Situacao5.ENVIADA_ONTEM, 0, null, new Lesao("Joelho esquerdo",
                    "Dor ao agachar fundo, já resolvida.", 150, 90, Situacao.RECUPERADA, "Liberada para treinar normalmente.")),
            new Perfil("Felipe Rocha", List.of(ABC, ABC, ABC, ABC, ABCDE), List.of(6, 7, 7, 8, 8), List.of(2, 2, 2, 4, 4),
                    Situacao5.MEIO, 20, "Lombar e cadeia posterior", null),
            new Perfil("Gabriela Nunes", List.of(PPL2, PPL2, PPL2, FB, FB), List.of(7, 8, 8, 9, 9), List.of(0, 1, 1, 1, 1),
                    Situacao5.ABERTA, 1, null, null),
            new Perfil("Henrique Souza", List.of(AB, ABC, ABC, ABC, ABC), List.of(8, 9, 9, 10, 10), List.of(3, 3, 3, 3, 4),
                    Situacao5.MEIO, 10, null, new Lesao("Lombar", "Incômodo ao fazer terra.", 20, null, Situacao.ATIVA,
                    "Carga reduzida nos exercícios de dobradiça.")),
            new Perfil("Isabela Martins", List.of(FB, FB, PPL5, PPL5, PPL5), List.of(9, 10, 10, 1, 1), List.of(0, 0, 0, 1, 1),
                    Situacao5.MEIO, 16, "Pós-treino global", null),
            new Perfil("João Pereira", List.of(ABCDE, ABCDE, ABC, ABC, ABC), List.of(10, 1, 1, 2, 2), List.of(1, 1, 4, 4, 4),
                    Situacao5.MEIO, 25, null, null));

    private static final double[] ESCALA = {0.8, 1.1, 0.7, 1.2, 0.65, 1.0, 0.75, 1.15, 0.7, 0.95};
    private static final double[] PESO_BASE = {72.4, 64.8, 58.6, 83.2, 61.0, 78.4, 66.2, 88.6, 57.8, 75.0};

    private static final List<String> FEEDBACKS = List.of(
            "Cargas subiram em quase todos os exercícios; seguimos para a próxima pasta.",
            "Semana com poucos treinos registrados; vamos manter a mesma divisão.",
            "Boa evolução de carga e peso estável. Mantemos o ritmo no próximo ciclo.",
            "Treinos consistentes. Vamos ajustar a dieta e subir a carga com cuidado.");

    private static final Pattern SEM_CARGA = Pattern.compile(
            "(?i)(barra fixa|paralela|mergulho|sissy|prancha|abdominal|flexão de braço|elevação de pernas)");

    private final AlunoService alunos;
    private final ConviteService convites;
    private final PastaService pastas;
    private final PastaRepository pastaRepo;
    private final PlanoTreinoService treinos;
    private final PlanoDietaService dietas;
    private final PlanoMobilidadeService mobilidades;
    private final ReceitaService receitas;
    private final LesaoService lesoes;
    private final UsuarioRepository usuarios;
    private final RegistroPesoRepository pesoRepo;
    private final AtualizacaoRepository atualizacaoRepo;
    private final AtualizacaoModeloRepository modeloRepo;
    private final ValidadorAtualizacao validadorAtualizacao;
    private final ExecucaoUpsert execucoes;
    private final TransactionTemplate tx;
    private final JsonMapper json;

    public SeedHistoricoDemo(AlunoService alunos, ConviteService convites, PastaService pastas, PastaRepository pastaRepo,
                             PlanoTreinoService treinos, PlanoDietaService dietas, PlanoMobilidadeService mobilidades,
                             ReceitaService receitas, LesaoService lesoes, UsuarioRepository usuarios,
                             RegistroPesoRepository pesoRepo, AtualizacaoRepository atualizacaoRepo,
                             AtualizacaoModeloRepository modeloRepo, ValidadorAtualizacao validadorAtualizacao,
                             ExecucaoUpsert execucoes, TransactionTemplate tx, JsonMapper json) {
        this.alunos = alunos;
        this.convites = convites;
        this.pastas = pastas;
        this.pastaRepo = pastaRepo;
        this.treinos = treinos;
        this.dietas = dietas;
        this.mobilidades = mobilidades;
        this.receitas = receitas;
        this.lesoes = lesoes;
        this.usuarios = usuarios;
        this.pesoRepo = pesoRepo;
        this.atualizacaoRepo = atualizacaoRepo;
        this.modeloRepo = modeloRepo;
        this.validadorAtualizacao = validadorAtualizacao;
        this.execucoes = execucoes;
        this.tx = tx;
        this.json = json;
    }

    /** O que foi criado, para o log e o teste. */
    public record Resultado(int alunos, int pastas, int execucoes, int pesos, int atualizacoes) {
    }

    /** Modelos já escolhidos por nome (id e conteúdo), por tipo. */
    private record Modelos(Map<Receita.Tipo, Map<String, ReceitaResponse>> porTipo) {
        ReceitaResponse de(Receita.Tipo tipo, String nome) {
            return porTipo.get(tipo).get(nome);
        }
    }

    /**
     * Cria os dez alunos na consultoria do treinador. Devolve {@code null} se o histórico já existe.
     *
     * @throws IllegalStateException se o treinador não existe ou falta algum modelo do guia
     */
    public Resultado criar(String emailDoTreinador, String senha) {
        if (senha == null || senha.length() < 8) {
            throw new IllegalStateException("A senha dos alunos de demonstração precisa ter pelo menos 8 caracteres.");
        }
        Usuario treinador = usuarios.buscarPorEmail(emailDoTreinador.toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new IllegalStateException("Treinador " + emailDoTreinador + " não existe."));
        if (usuarios.buscarPorEmail(PRIMEIRO_ALUNO).filter(u -> treinador.getConsultoriaId().equals(u.getConsultoriaId())).isPresent()) {
            log.info("Histórico de demonstração já existe; nada a fazer.");
            return null;
        }
        UUID consultoria = treinador.getConsultoriaId();
        return TenantContext.executarComo(consultoria, () -> {
            Modelos modelos = carregarModelos();
            LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
            AtualizacaoModelo modeloAtualizacao = modeloRepo.findFirstByOrderByVersaoDesc()
                    .orElseThrow(() -> new IllegalStateException("Modelo de atualização não encontrado."));
            int[] total = new int[3];
            for (int i = 0; i < PERFIS.size(); i++) {
                int[] parcial = criarAluno(i, PERFIS.get(i), consultoria, treinador.getId(), senha, hoje, modelos,
                        modeloAtualizacao);
                for (int k = 0; k < total.length; k++) {
                    total[k] += parcial[k];
                }
            }
            return new Resultado(PERFIS.size(), PERFIS.size() * 5, total[0], total[1], total[2]);
        });
    }

    // ---- Modelos ----

    private Modelos carregarModelos() {
        Map<Receita.Tipo, Map<String, ReceitaResponse>> porTipo = new HashMap<>();
        List<String> faltando = new ArrayList<>();
        MODELOS_NECESSARIOS.forEach((tipo, nomes) -> {
            Map<String, ReceitaResponse> existentes = new HashMap<>();
            for (ReceitaResponse r : receitas.listar(tipo)) {
                existentes.put(r.nome(), r);
            }
            for (String nome : nomes) {
                if (!existentes.containsKey(nome)) {
                    faltando.add(tipo + " \"" + nome + "\"");
                }
            }
            porTipo.put(tipo, existentes);
        });
        if (!faltando.isEmpty()) {
            throw new IllegalStateException("Faltam modelos do guia (rode scripts/demo/popular-modelos.mjs antes): "
                    + String.join("; ", faltando));
        }
        return new Modelos(porTipo);
    }

    // ---- Um aluno ----

    private int[] criarAluno(int idx, Perfil p, UUID consultoria, UUID treinador, String senha, LocalDate hoje,
                             Modelos modelos, AtualizacaoModelo modeloAtualizacao) {
        String email = String.format("aluno%02d@demo.local", idx + 1);
        UUID aluno = alunos.criar(new AlunoRequest(p.nome(), email, "Melhorar composição corporal", null, null, 30)).id();
        String codigo = convites.gerar(aluno).codigo();
        convites.aceitar(ConviteService.hash(codigo), email, senha);

        LocalDate fim5 = hoje.plusDays(p.fimEmDias());
        List<LocalDate> fins = new ArrayList<>();
        for (int k = 0; k < 5; k++) {
            fins.add(fim5.minusDays(30L * (4 - k)));
        }
        Random rnd = new Random(1000L + idx);
        LocalDate primeiroDia = fins.get(0).minusDays(29);
        Set<Long> semanasFracas = semanasFracas(rnd, primeiroDia, hoje);

        Map<String, double[]> cargas = new HashMap<>();
        int execucoesGravadas = 0;
        List<UUID> pastasIds = new ArrayList<>();
        for (int k = 0; k < 5; k++) {
            LocalDate fim = fins.get(k);
            LocalDate inicio = fim.minusDays(29);
            UUID pasta = pastas.criar(aluno, new PastaRequest("Ciclo " + (k + 1), inicio, fim)).id();
            pastasIds.add(pasta);
            ReceitaResponse semana = modelos.de(Receita.Tipo.PLANO_TREINO, p.semanas().get(k));
            ReceitaResponse met = modelos.de(Receita.Tipo.METODOLOGIA, METODOLOGIAS.get(p.metodologias().get(k)));
            PlanoDetalhe<ConteudoTreino> treino = publicarTreino(aluno, pasta, "Treino " + p.semanas().get(k), inicio,
                    fim, semana, met, treinador);
            ReceitaResponse dieta = modelos.de(Receita.Tipo.PLANO_DIETA, DIETAS.get(p.dietas().get(k) - 1));
            publicarDieta(aluno, pasta, dieta, inicio, treinador);
            if (k == 4 && p.mobilidade() != null) {
                publicarMobilidade(aluno, pasta, modelos.de(Receita.Tipo.MOBILIDADE, p.mobilidade()), treinador);
            }
            UUID versaoId = treino.versoes().get(treino.versoes().size() - 1).id();
            execucoesGravadas += gravarExecucoes(consultoria, aluno, versaoId, treino.rascunho(), inicio,
                    fim.isBefore(hoje) ? fim : hoje.minusDays(1), primeiroDia, idx, rnd, semanasFracas, cargas);
        }
        if (p.lesao() != null) {
            Lesao l = p.lesao();
            lesoes.criar(aluno, new LesaoRequest(l.regiao(), l.descricao(), hoje.minusDays(l.inicioHaDias()),
                    l.fimHaDias() == null ? null : hoje.minusDays(l.fimHaDias()), l.situacao(), l.observacao()), treinador);
        }
        NavigableMap<LocalDate, BigDecimal> pesos = pesoSemanal(idx, fins.get(0).minusDays(29), hoje, fins);
        int atualizacoes = fecharPastas(idx, p, aluno, pastasIds, fins, hoje, pesos, treinador, modeloAtualizacao);
        for (Map.Entry<LocalDate, BigDecimal> e : pesos.entrySet()) {
            String obs = fins.subList(0, 4).contains(e.getKey()) ? "Peso de fechamento do ciclo." : null;
            pesoRepo.saveAndFlush(new RegistroPeso(aluno, e.getKey(), e.getValue(), obs, treinador));
        }
        log.info("Histórico de demonstração: {} criado ({} execuções).", p.nome(), execucoesGravadas);
        return new int[]{execucoesGravadas, pesos.size(), atualizacoes};
    }

    // ---- Planos ----

    private PlanoDetalhe<ConteudoTreino> publicarTreino(UUID aluno, UUID pasta, String titulo, LocalDate inicio,
                                                        LocalDate fim, ReceitaResponse semana, ReceitaResponse met,
                                                        UUID treinador) {
        PlanoDetalhe<ConteudoTreino> criado = treinos.criar(aluno,
                new CriarPlanoRequest(titulo, inicio, fim, semana.id(), null, pasta));
        ConfiguracaoConsultoria cfg = json.treeToValue(met.conteudo(), ConfiguracaoConsultoria.class);
        ConteudoTreino base = criado.rascunho();
        // A série de trabalho do guia vem como "WS"; com outra metodologia ela passa a ter o nome de trabalho dela.
        List<Sessao> sessoes = base.sessoesOuVazio().stream().map(s -> new Sessao(s.uid(), s.nome(), s.diaSemana(),
                s.tipo(), s.frequenciaSemanal(), s.observacao(), s.cardio(),
                s.exerciciosOuVazio().stream().map(e -> new ExercicioPlano(e.uid(), e.exercicioId(), e.nome(),
                        e.modalidade(), e.videoUrl(), e.observacao(), e.progressao(), e.unidade(),
                        e.seriesOuVazio().stream().map(x -> x.deTrabalho()
                                ? new Serie(x.uid(), cfg.tipoTrabalho(), x.repsMin(), x.repsMax(), x.alvoTexto(),
                                x.intensidade(), x.descansoSegundos()) : x).toList())).toList())).toList();
        ConteudoTreino conteudo = new ConteudoTreino(base.objetivo(), base.orientacoes(), sessoes,
                new Metodologia(met.id(), met.nome(), cfg));
        PlanoDetalhe<ConteudoTreino> salvo = treinos.salvarRascunho(criado.plano().id(),
                new SalvarRascunhoRequest<>(titulo, inicio, fim, conteudo, criado.plano().versao()));
        return treinos.publicar(salvo.plano().id(), new PublicarRequest(salvo.plano().versao(), true), treinador);
    }

    private void publicarDieta(UUID aluno, UUID pasta, ReceitaResponse modelo, LocalDate inicio, UUID treinador) {
        PlanoDetalhe<ConteudoDieta> criado = dietas.criar(aluno,
                new CriarPlanoRequest("Dieta " + modelo.nome(), null, null, modelo.id(), null, pasta));
        ConteudoDieta c = criado.rascunho();
        ConteudoDieta comData = new ConteudoDieta(c.objetivo(), inicio.toString(), c.profissional(), c.refeicoes(),
                c.orientacoes(), c.observacoes(), c.suplementacao());
        PlanoDetalhe<ConteudoDieta> salvo = dietas.salvarRascunho(criado.plano().id(),
                new SalvarRascunhoRequest<>("Dieta " + modelo.nome(), null, null, comData, criado.plano().versao()));
        dietas.publicar(salvo.plano().id(), new PublicarRequest(salvo.plano().versao(), true), treinador);
    }

    private void publicarMobilidade(UUID aluno, UUID pasta, ReceitaResponse modelo, UUID treinador) {
        PlanoDetalhe<ConteudoMobilidade> criado = mobilidades.criar(aluno,
                new CriarPlanoRequest(modelo.nome(), null, null, modelo.id(), null, pasta));
        mobilidades.publicar(criado.plano().id(), new PublicarRequest(criado.plano().versao(), true), treinador);
    }

    // ---- Execuções ----

    /** Uma ou duas semanas "fracas" (só segunda e terça), para o histórico não ficar perfeito. */
    private static Set<Long> semanasFracas(Random rnd, LocalDate primeiroDia, LocalDate hoje) {
        long semanas = Math.max(8, ChronoUnit.WEEKS.between(primeiroDia, hoje));
        Set<Long> fracas = new HashSet<>();
        int quantas = 1 + rnd.nextInt(2);
        while (fracas.size() < quantas) {
            fracas.add(2 + (long) rnd.nextInt((int) semanas - 3));
        }
        return fracas;
    }

    private int gravarExecucoes(UUID consultoria, UUID aluno, UUID versaoId, ConteudoTreino conteudo, LocalDate de,
                                LocalDate ate, LocalDate primeiroDia, int idx, Random rnd,
                                Set<Long> semanasFracas, Map<String, double[]> cargas) {
        int gravadas = 0;
        for (LocalDate d = de; !d.isAfter(ate); d = d.plusDays(1)) {
            int diaSemana = d.getDayOfWeek().getValue();
            long semana = ChronoUnit.WEEKS.between(primeiroDia, d);
            for (Sessao s : conteudo.sessoesOuVazio()) {
                if (!ConteudoTreino.TREINO.equals(s.tipo()) || s.diaSemana() == null || s.diaSemana() != diaSemana) {
                    continue;
                }
                boolean fraca = semanasFracas.contains(semana) && diaSemana > 2;
                boolean faltou = conteudo.sessoesOuVazio().stream()
                        .filter(x -> ConteudoTreino.TREINO.equals(x.tipo())).count() >= 5 && rnd.nextInt(6) == 0;
                if (fraca || faltou) {
                    continue;
                }
                gravadas += gravarSessao(consultoria, aluno, versaoId, s, d, idx, rnd, cargas);
            }
        }
        return gravadas;
    }

    private int gravarSessao(UUID consultoria, UUID aluno, UUID versaoId, Sessao s, LocalDate d, int idx, Random rnd,
                             Map<String, double[]> cargas) {
        int gravadas = 0;
        Instant quando = ZonedDateTime.of(d, LocalTime.of(19, 0), Fuso.BRASILIA).toInstant();
        for (ExercicioPlano e : s.exerciciosOuVazio()) {
            boolean semCarga = SEM_CARGA.matcher(e.nome() == null ? "" : e.nome()).find();
            BigDecimal ws = semCarga ? null : cargaDe(e.nome(), d, idx, cargas);
            for (Serie x : e.seriesOuVazio()) {
                BigDecimal carga = null;
                if (ws != null) {
                    carga = "PERCENTUAL_WS".equals(x.modo()) && x.intensidade().percentual() != null
                            ? arredondar(ws.doubleValue() * x.intensidade().percentual().doubleValue() / 100, ws.doubleValue())
                            : ws;
                }
                int max = x.repsMax() != null ? x.repsMax() : 10;
                int min = x.repsMin() != null ? x.repsMin() : max;
                int reps = Math.max(min, max - rnd.nextInt(3));
                boolean concluida = rnd.nextInt(50) != 0;
                if (execucoes.gravar(new ExecucaoUpsert.Linha(UUID.randomUUID(), consultoria, aluno, versaoId, s.uid(),
                        e.uid(), x.uid(), e.exercicioId(), x.deTrabalho(), d, carga, carga == null ? "nenhuma" : "kg",
                        reps, concluida, null, quando))) {
                    gravadas++;
                }
            }
        }
        return gravadas;
    }

    /** Carga de trabalho do exercício no dia: parte de um valor típico e sobe um degrau a cada 2 a 3 semanas. */
    private static BigDecimal cargaDe(String nome, LocalDate d, int idx, Map<String, double[]> cargas) {
        double[] estado = cargas.computeIfAbsent(nome == null ? "?" : nome,
                k -> new double[]{d.toEpochDay(), base(k) * ESCALA[idx], 14 + Math.floorMod(k.hashCode(), 8)});
        double base = estado[1];
        double degrau = base < 20 ? 1.0 : 2.5;
        long passos = (long) ((d.toEpochDay() - estado[0]) / estado[2]);
        return arredondar(base + degrau * passos, base);
    }

    private static BigDecimal arredondar(double valor, double base) {
        double passo = base < 20 ? 0.5 : 2.5;
        double r = Math.max(passo, Math.round(valor / passo) * passo);
        return BigDecimal.valueOf(r).setScale(1, RoundingMode.HALF_UP);
    }

    private static double base(String nome) {
        String n = nome.toLowerCase(Locale.ROOT);
        if (n.contains("leg press") || n.contains("hack")) return 140;
        if (n.contains("terra") || n.contains("agachamento")) return 80;
        if (n.contains("stiff") || n.contains("rdl")) return 60;
        if (n.contains("supino")) return n.contains("halter") ? 24 : 60;
        if (n.contains("remada")) return 50;
        if (n.contains("puxada") || n.contains("pulldown")) return 50;
        if (n.contains("desenvolvimento")) return 30;
        if (n.contains("elevação") || n.contains("crucifixo") || n.contains("voador")) return 10;
        if (n.contains("panturrilha")) return 70;
        if (n.contains("extensora") || n.contains("flexora")) return 45;
        if (n.contains("rosca") || n.contains("bíceps")) return 20;
        if (n.contains("tríceps")) return 30;
        if (n.contains("encolhimento")) return 40;
        return 30;
    }

    // ---- Peso e atualizações ----

    /** Peso semanal desde o começo do primeiro ciclo, mais o do fechamento de cada ciclo concluído. */
    private static NavigableMap<LocalDate, BigDecimal> pesoSemanal(int idx, LocalDate inicio, LocalDate hoje,
                                                          List<LocalDate> fins) {
        NavigableMap<LocalDate, BigDecimal> mapa = new TreeMap<>();
        double inclinacao = (idx % 2 == 0 ? -1 : 1) * (0.12 + 0.013 * idx);
        for (LocalDate d = inicio; d.isBefore(hoje); d = d.plusDays(7)) {
            mapa.put(d, pesoEm(idx, inclinacao, ChronoUnit.WEEKS.between(inicio, d)));
        }
        for (LocalDate f : fins.subList(0, 4)) {
            mapa.put(f, pesoEm(idx, inclinacao, ChronoUnit.DAYS.between(inicio, f) / 7));
        }
        return mapa;
    }

    private static BigDecimal pesoEm(int idx, double inclinacao, long semanas) {
        double v = PESO_BASE[idx] + inclinacao * semanas + 0.3 * Math.sin(semanas * 1.7 + idx);
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP);
    }

    /**
     * Fecha os quatro primeiros ciclos (atualização enviada e respondida, peso, pasta concluída) e deixa a pasta atual
     * na situação do perfil.
     */
    private int fecharPastas(int idx, Perfil p, UUID aluno, List<UUID> pastasIds, List<LocalDate> fins, LocalDate hoje,
                             NavigableMap<LocalDate, BigDecimal> pesos, UUID treinador, AtualizacaoModelo modelo) {
        JsonNode modeloJson = json.readTree(modelo.getConteudo());
        int criadas = 0;
        for (int k = 0; k < 5; k++) {
            LocalDate fim = fins.get(k);
            boolean concluida = k < 4;
            boolean atualAberta = k == 4 && p.situacao() == Situacao5.ENVIADA_ONTEM;
            if (!concluida && !atualAberta) {
                continue;
            }
            final int ciclo = k;
            Instant enviadaEm = instante(fim.plusDays(atrasoDoEnvio(idx, k)), 8);
            if (atualAberta) {
                enviadaEm = instante(hoje.minusDays(1), 8);
                pesos.put(fim, pesos.lowerEntry(fim).getValue());
            }
            Instant envio = enviadaEm;
            tx.executeWithoutResult(s -> {
                Atualizacao a = new Atualizacao(aluno, pastasIds.get(ciclo), fim, modelo.getVersao());
                if (idx == 7 && ciclo == 2) {
                    a.avisarAtraso(fim.plusDays(4), "Viagem a trabalho; envio no retorno.", instante(fim.minusDays(1), 18));
                }
                a.enviar(respostas(modeloJson, idx, ciclo, pesos.get(fim)), envio);
                if (ciclo < 4) {
                    a.responder(FEEDBACKS.get((idx + ciclo) % FEEDBACKS.size()), treinador, envio.plus(26, ChronoUnit.HOURS));
                }
                atualizacaoRepo.saveAndFlush(a);
                if (ciclo < 3) {
                    atualizacaoRepo.marcarFeedbackVisto(a.getId(), aluno, envio.plus(30, ChronoUnit.HOURS));
                }
                if (ciclo < 4) {
                    PastaPlano pasta = pastaRepo.findById(pastasIds.get(ciclo)).orElseThrow();
                    pasta.concluir(instante(fim.plusDays(1), 12));
                    pastaRepo.saveAndFlush(pasta);
                }
            });
            criadas++;
        }
        return criadas;
    }

    /** Quantos dias depois do fim do ciclo a atualização foi enviada (a maioria no dia; alguns atrasos). */
    private static int atrasoDoEnvio(int idx, int ciclo) {
        if (idx == 5 && ciclo == 1) return 3;
        if (idx == 8 && ciclo == 0) return 4;
        if (idx == 7 && ciclo == 2) return 4;
        return 0;
    }

    private String respostas(JsonNode modelo, int idx, int ciclo, BigDecimal peso) {
        ObjectNode r = json.createObjectNode();
        r.put("peso", peso);
        r.put("sono", 6 + (idx + ciclo) % 4);
        r.put("alim_desempenho", 7 + (idx + 2 * ciclo) % 4);
        r.put("treino_desempenho", 6 + (idx * 3 + ciclo) % 5);
        r.put("treino_dias", ((idx + ciclo) % 3 == 0) ? "4 dias por semana" : "5 dias por semana");
        r.put("psicologico", "Mês tranquilo, com boa disposição para treinar.");
        r.put("treino_acrescentar", "Sem observações.");
        return json.writeValueAsString(validadorAtualizacao.validar(modelo, r));
    }

    private static Instant instante(LocalDate dia, int hora) {
        return ZonedDateTime.of(dia, LocalTime.of(hora, 0), Fuso.BRASILIA).toInstant();
    }
}
