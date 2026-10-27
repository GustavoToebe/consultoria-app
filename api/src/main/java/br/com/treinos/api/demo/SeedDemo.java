package br.com.treinos.api.demo;

import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.alunos.ConviteService;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoRequest;
import br.com.treinos.api.auth.CriacaoDeConta;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.dto.CadastroTreinadorRequest;
import br.com.treinos.api.biblioteca.BibliotecaService;
import br.com.treinos.api.biblioteca.Exercicio;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.AlimentoRequest;
import br.com.treinos.api.biblioteca.dto.BibliotecaDtos.ExercicioRequest;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.MarcaService;
import br.com.treinos.api.consultoria.MarcaService.MarcaRequest;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.PlanoDietaService;
import br.com.treinos.api.execucao.PesoService;
import br.com.treinos.api.execucao.SincronizacaoService;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PesoRequest;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.RegistroExecucao;
import br.com.treinos.api.pastas.PastaDtos.PastaRequest;
import br.com.treinos.api.pastas.PastaService;
import br.com.treinos.api.planos.dto.PlanoDtos.CriarPlanoRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.PlanoDetalhe;
import br.com.treinos.api.planos.dto.PlanoDtos.PublicarRequest;
import br.com.treinos.api.planos.dto.PlanoDtos.SalvarRascunhoRequest;
import br.com.treinos.api.receitas.Receita;
import br.com.treinos.api.receitas.ReceitaService;
import br.com.treinos.api.receitas.ReceitaService.ReceitaRequest;
import br.com.treinos.api.receitas.ReceitaService.ReceitaResponse;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Carga;
import br.com.treinos.api.treino.ConteudoTreino.Esforco;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.treino.ConteudoTreino.Tecnica;
import br.com.treinos.api.treino.PlanoTreinoService;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Dados de demonstração: duas consultorias, para mostrar vários treinadores isolados. Tudo
 * fictício: nenhum nome, peso ou protocolo real dos PDFs. Usa os mesmos serviços da API, então os dados passam pelas
 * mesmas validações do uso normal. Quem chama ({@link SeedDemoRunner}) garante que o banco está vazio.
 */
@Service
public class SeedDemo {

    public static final String SARAIVA = "saraiva@demo.local";
    public static final String ALUNO = "aluno@demo.local";
    public static final String EXEMPLO = "exemplo@demo.local";
    public static final String ALUNO2 = "aluno2@demo.local";

    private static final String FONTE_ALIMENTOS = "Plano do treinador (exemplo)";

    /** Vídeos de exemplo; o service recusa link que não seja https. */
    private static final Map<String, String> VIDEOS = Map.ofEntries(
            Map.entry("Remada baixa na polia unilateral", "https://youtu.be/vOmSaZeqA84"),
            Map.entry("Puxada alta com pegada romana (neutra)", "https://youtu.be/AQmHe1vjs-A"),
            Map.entry("Remada na máquina com pegada neutra (unilateral)", "https://youtu.be/gnKmUlTOaCw"),
            Map.entry("Elevação lateral com halteres", "https://www.youtube.com/watch?v=CpDBdo3U-dI"),
            Map.entry("Supino reto na máquina (sentado)", "https://youtu.be/6Cpf8SBfHqs"),
            Map.entry("Supino inclinado na máquina", "https://www.youtube.com/watch?v=TrTSvn5-MTk"),
            Map.entry("Desenvolvimento na máquina articulada (pegada neutra)", "https://www.youtube.com/watch?v=WvLMauqrnK8"),
            Map.entry("Tríceps na polia com corda", "https://www.youtube.com/watch?v=wQdCw93LkcI"),
            Map.entry("Tríceps cruzado na polia (unilateral)", "https://youtu.be/IIQMw5Up1Ws"),
            Map.entry("Clamshell (com band)", "https://www.youtube.com/watch?v=rrJIyZGlK8c"),
            Map.entry("Mesa flexora", "https://www.youtube.com/watch?v=P9zH7iHsfE8"),
            Map.entry("Cadeira flexora", "https://www.youtube.com/shorts/wqVoX6lbYf8"),
            Map.entry("Leg press horizontal", "https://youtu.be/hYKoCUczAY4"),
            Map.entry("Elevação pélvica na máquina ou com barra", "https://www.youtube.com/watch?v=ZSPmIyX9RZs"),
            Map.entry("Remada na máquina articulada (pegada pronada simultâneo)", "https://youtu.be/3n1nOfkO-Eg"),
            Map.entry("Supino inclinado no smith (banco em 30º)", "https://www.youtube.com/shorts/-kqeSi8iHBs"),
            Map.entry("High row (unilateral)", "https://youtu.be/PN95TKHkDqE"),
            Map.entry("Elevação lateral na máquina", "https://youtu.be/BH9jVp2cx3w"),
            Map.entry("Stiff com barra livre", "https://www.youtube.com/shorts/tX__cAsyj30"),
            Map.entry("Leg press 45º", "https://youtu.be/hYKoCUczAY4"),
            Map.entry("Abdução de quadril na polia", "https://youtu.be/nQwNcD7CKKY"));

    /** Valores por 100 g. Ovo e legumes ficam como itens manuais na dieta. */
    private record AlimentoDemo(String nome, String kcal, String proteina, String carboidrato, String gordura) {
    }

    private static final List<AlimentoDemo> ALIMENTOS = List.of(
            new AlimentoDemo("Pão de forma branco", "266", "8.4", "49.6", "3.2"),
            new AlimentoDemo("Semente de chia", "500", "16", "42", "30"),
            new AlimentoDemo("Frutas (mamão, abacaxi, melão, morango, maçã ou kiwi)", "40", "0.53", "10", "0"),
            new AlimentoDemo("Iogurte desnatado", "36", "3.53", "5", "0.13"),
            new AlimentoDemo("Aveia em flocos", "393.3", "14", "66.67", "8.33"),
            new AlimentoDemo("Banana prata", "98", "1.3", "25.7", "0.1"),
            new AlimentoDemo("Arroz branco cozido", "127.8", "2.5", "28.1", "0.22"),
            new AlimentoDemo("Peito de frango grelhado", "159", "32", "0", "2.7"),
            new AlimentoDemo("Batata inglesa cozida", "80", "1.2", "20", "0.12"));

    private final CriacaoDeConta criacaoDeConta;
    private final ReceitaService receitas;
    private final MarcaService marcas;
    private final JsonMapper json;
    private final BibliotecaService biblioteca;
    private final AlunoService alunos;
    private final ConviteService convites;
    private final PlanoTreinoService treinos;
    private final PlanoDietaService dietas;
    private final SincronizacaoService sincronizacao;
    private final PesoService pesos;
    private final PastaService pastas;

    public SeedDemo(CriacaoDeConta criacaoDeConta, ReceitaService receitas, MarcaService marcas,
                    BibliotecaService biblioteca, AlunoService alunos, ConviteService convites,
                    PlanoTreinoService treinos, PlanoDietaService dietas, SincronizacaoService sincronizacao,
                    PesoService pesos, PastaService pastas, JsonMapper json) {
        this.pastas = pastas;
        this.criacaoDeConta = criacaoDeConta;
        this.receitas = receitas;
        this.marcas = marcas;
        this.json = json;
        this.biblioteca = biblioteca;
        this.alunos = alunos;
        this.convites = convites;
        this.treinos = treinos;
        this.dietas = dietas;
        this.sincronizacao = sincronizacao;
        this.pesos = pesos;
    }

    public void criar(String senha) {
        if (senha == null || senha.length() < 8) {
            throw new IllegalStateException("DEMO_SENHA precisa ter pelo menos 8 caracteres.");
        }
        AcessoAtual.comoSistema(() -> {
            criarSaraiva(senha);
            criarExemplo(senha);
            return null;
        });
    }

    // ---- Consultoria 1: Saraiva Team (piloto) ----

    private void criarSaraiva(String senha) {
        Usuario treinador = criacaoDeConta.criarTreinador(
                new CadastroTreinadorRequest("SARAIVA TEAM", "Saraiva", SARAIVA, senha, null));
        UUID consultoria = treinador.getConsultoriaId();
        TenantContext.executarComo(consultoria, () -> {
            receitas.garantirPadrao();
            marca(consultoria, "SARAIVA TEAM", "#C62828", Consultoria.Fonte.METAL, Consultoria.Tema.ESCURO);
            instrucoesDoPlano16NaMetodologiaPadrao();

            Map<String, UUID> exercicios = bibliotecaDoPlano16();
            Map<String, UUID> alimentos = new HashMap<>();
            for (AlimentoDemo a : ALIMENTOS) {
                alimentos.put(a.nome(), biblioteca.criarAlimento(new AlimentoRequest(a.nome(), new BigDecimal("100"),
                        "g", new BigDecimal(a.kcal()), new BigDecimal(a.proteina()), new BigDecimal(a.carboidrato()),
                        new BigDecimal(a.gordura()), null, FONTE_ALIMENTOS, null, null)).id());
            }

            UUID aluno = alunos.criar(new AlunoRequest("Aluno Demonstração", ALUNO, "Melhorar o físico (secar e crescer)",
                    null, null)).id();
            darAcesso(aluno, ALUNO, senha);

            LocalDate segunda = LocalDate.now(Fuso.BRASILIA).with(DayOfWeek.MONDAY);
            Plano16.Dia exemplos = Plano16.exemplos();
            UUID pastaExemplos = pastas.criar(aluno, new PastaRequest("Exemplos do PDF (22/10)", segunda, segunda.plusDays(15))).id();
            publicarTreino(aluno, pastaExemplos, "Exemplos do PDF (22/10)", segunda, segunda.plusDays(15),
                    new ConteudoTreino(null, null, List.of(new Sessao(UUID.randomUUID(), exemplos.nome(), 1, "TREINO", null,
                            null, null, exemplos.exercicios().stream().map(e -> exercicio(e, exercicios)).toList()))), treinador.getId());
            ConteudoTreino plano16 = plano16(exercicios);
            UUID pasta = pastas.criar(aluno, new PastaRequest("Plano 16", segunda, segunda.plusDays(15))).id();
            PlanoDetalhe<ConteudoTreino> publicado = publicarTreino(aluno, pasta, "Plano 16", segunda,
                    segunda.plusDays(15), plano16, treinador.getId());
            execucoesFicticias(consultoria, aluno, publicado.versoes().get(0).id(), plano16, segunda);

            publicarDieta(aluno, pasta, segunda, segunda.plusDays(15), dieta(alimentos), treinador.getId());

            LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
            String[] kg = {"82.0", "81.4", "81.1", "81.3"};
            for (int i = 0; i < kg.length; i++) {
                pesos.registrar(aluno, new PesoRequest(hoje.minusDays(21L - 7L * i), new BigDecimal(kg[i]), null),
                        treinador.getId());
            }
            return null;
        });
    }

    /** A metodologia padrão do Saraiva leva as instruções do Plano 16; todo plano novo copia essa metodologia. */
    private void instrucoesDoPlano16NaMetodologiaPadrao() {
        ReceitaResponse padrao = receitas.listar(Receita.Tipo.METODOLOGIA).get(0);
        ConfiguracaoConsultoria base = json.treeToValue(padrao.conteudo(), ConfiguracaoConsultoria.class);
        ConfiguracaoConsultoria comInstrucoes = base.comInstrucoes(Plano16.INSTRUCOES);
        receitas.alterar(padrao.id(), new ReceitaRequest(Receita.Tipo.METODOLOGIA, padrao.nome(), padrao.descricao(),
                json.valueToTree(comInstrucoes), null, padrao.versao()));
    }

    private Map<String, UUID> bibliotecaDoPlano16() {
        Map<String, UUID> ids = new HashMap<>();
        List<Plano16.Ex> todos = new ArrayList<>();
        Plano16.dias().forEach(d -> todos.addAll(d.exercicios()));
        todos.add(Plano16.abdominal());
        for (Plano16.Ex e : todos) {
            if (!ids.containsKey(e.nome())) {
                ids.put(e.nome(), biblioteca.criarExercicio(new ExercicioRequest(e.nome(), null, null, e.modalidade(),
                        VIDEOS.get(e.nome()), null)).id());
            }
        }
        return ids;
    }

    private static ConteudoTreino plano16(Map<String, UUID> exercicios) {
        List<Sessao> sessoes = new ArrayList<>();
        for (Plano16.Dia d : Plano16.dias()) {
            sessoes.add(new Sessao(UUID.randomUUID(), d.nome(), d.diaSemana(), d.tipo(), null, null, d.cardio(),
                    d.exercicios().stream().map(e -> exercicio(e, exercicios)).toList()));
        }
        sessoes.add(new Sessao(UUID.randomUUID(), "Acessórios (2x na semana, no final do treino)", null, "ACESSORIOS",
                2, null, null, List.of(exercicio(Plano16.abdominal(), exercicios))));
        return new ConteudoTreino("Melhorar o físico (secar e crescer)", null, sessoes);
    }

    private static ExercicioPlano exercicio(Plano16.Ex e, Map<String, UUID> ids) {
        List<String> obs = new ArrayList<>();
        if (e.observacao() != null) {
            obs.add(e.observacao());
        }
        Integer rir = e.limite() == Plano16.Limite.FALHA ? Integer.valueOf(0) : e.limite() == Plano16.Limite.UM_RIR ? Integer.valueOf(1) : null;
        return new ExercicioPlano(UUID.randomUUID(), ids.get(e.nome()), e.nome(), e.modalidade().name(),
                VIDEOS.get(e.nome()), obs.isEmpty() ? null : String.join(" ", obs), e.progressao(), e.unidade(),
                e.series().stream().map(SeedDemo::serie)
                        .map(serie -> rir != null && serie.deTrabalho() ? serie.comEsforco(Esforco.deRir(rir)) : serie)
                        .toList());
    }

    /**
     * Notação do Plano 16 e dos exemplos: A aquecimento, F feeder, W working, B back off, T top set (acima da anterior),
     * R pausas, C blocos desiguais, M blocos iguais. R, C e M são a própria série de trabalho com a técnica; {@code +R}
     * acrescenta o rest pause à série anterior da notação.
     */
    static Serie serie(String spec) {
        if (spec.contains("+R")) {
            int i = spec.indexOf("+R");
            return serie(spec.substring(0, i)).comTecnica(serie(spec.substring(i + 1)).tecnica());
        }
        char tipo = spec.charAt(0);
        String[] partes = spec.substring(1).split("@", 2);
        String valor = partes[0];
        String parametro = partes.length > 1 ? partes[1] : "";
        if (tipo == 'R') {
            String[] repsEPausas = valor.split(":", 2);
            Integer reps = repsEPausas.length > 1 ? Integer.valueOf(repsEPausas[0]) : null;
            int pausas = repsEPausas.length > 1 ? Integer.parseInt(repsEPausas[1]) : valor.isEmpty() ? 1 : Integer.parseInt(valor);
            return trabalho(reps, reps).comTecnica(
                    Tecnica.restPause(parametro.isEmpty() ? 20 : Integer.valueOf(parametro), null, pausas));
        }
        if (tipo == 'C' || tipo == 'M') {
            List<Integer> blocos;
            Integer respiracoes = null;
            Integer segundos;
            if (tipo == 'M') {
                String[] quantidade = valor.split("x");
                blocos = java.util.Collections.nCopies(Integer.parseInt(quantidade[0]), Integer.valueOf(quantidade[1]));
                String[] pausa = parametro.split("r/", 2);
                respiracoes = Integer.valueOf(pausa[0]);
                segundos = Integer.valueOf(pausa[1]);
            } else {
                blocos = java.util.Arrays.stream(valor.split("\\+")).map(Integer::valueOf).toList();
                segundos = parametro.isEmpty() ? null : Integer.valueOf(parametro);
            }
            int soma = blocos.stream().mapToInt(Integer::intValue).sum();
            return trabalho(soma, soma).comTecnica(Tecnica.cluster(blocos, segundos, respiracoes));
        }
        String[] percentuais = parametro.split("-", 2);
        int percentualMin = parametro.isEmpty() ? 0 : Integer.parseInt(percentuais[0]);
        Integer percentualMax = percentuais.length > 1 ? Integer.valueOf(percentuais[1]) : null;
        if (tipo == 'T') {
            return Serie.de(UUID.randomUUID(), "TOP_SET", null, null,
                    Carga.percentual("ACIMA_DA_ANTERIOR", percentualMin, percentualMax));
        }
        String[] reps = valor.split("-", 2);
        int min = Integer.parseInt(reps[0]);
        int max = reps.length > 1 ? Integer.parseInt(reps[1]) : min;
        String codigo = switch (tipo) { case 'A' -> "WARM_UP"; case 'F' -> "FEEDER"; case 'W' -> "WORKING"; case 'B' -> "BACK_OFF";
            default -> throw new IllegalArgumentException("Tipo de série desconhecido."); };
        Carga carga = tipo == 'A' ? Carga.de("NENHUMA") : tipo == 'W' ? Carga.de("CARGA_TRABALHO")
                : Carga.percentual("PERCENTUAL_WS", percentualMin, percentualMax);
        return Serie.de(UUID.randomUUID(), codigo, min, max, carga);
    }

    /** Série de trabalho (WS) com a carga de trabalho; rest pause e cluster entram nela como técnica. */
    private static Serie trabalho(Integer repsMin, Integer repsMax) {
        return Serie.de(UUID.randomUUID(), "WORKING", repsMin, repsMax, Carga.de("CARGA_TRABALHO"));
    }

    /**
     * Registros FICTÍCIOS das duas semanas anteriores em 6 exercícios, para o histórico e o progresso aparecerem na
     * demonstração. Cargas inventadas para o exemplo; não são de ninguém.
     */
    private void execucoesFicticias(UUID consultoria, UUID aluno, UUID versaoId, ConteudoTreino plano,
                                    LocalDate segundaAtual) {
        record Ficticio(String sessao, String exercicio, String cargaSemana1, String cargaSemana2) {
        }
        List<Ficticio> lista = List.of(
                new Ficticio("Segunda - Costas", "Remada baixa na polia unilateral", "40", "42.5"),
                new Ficticio("Segunda - Costas", "Puxada alta com pegada romana (neutra)", "50", "52.5"),
                new Ficticio("Terça - Peito+Ombros", "Supino reto na máquina (sentado)", "60", "62.5"),
                new Ficticio("Terça - Peito+Ombros", "Desenvolvimento na máquina articulada (pegada neutra)", "35", "37.5"),
                new Ficticio("Quarta - Pernas", "Leg press horizontal", "120", "130"),
                new Ficticio("Quarta - Pernas", "Mesa flexora", "35", "37.5"));
        List<RegistroExecucao> registros = new ArrayList<>();
        for (Ficticio f : lista) {
            Sessao sessao = plano.sessoes().stream().filter(s -> s.nome().equals(f.sessao())).findFirst().orElseThrow();
            ExercicioPlano ex = sessao.exercicios().stream().filter(e -> e.nome().equals(f.exercicio()))
                    .findFirst().orElseThrow();
            int semana = 0;
            for (String carga : List.of(f.cargaSemana1(), f.cargaSemana2())) {
                LocalDate data = segundaAtual.minusWeeks(2L - semana).plusDays(sessao.diaSemana() - 1L);
                registros.addAll(registrosDoDia(versaoId, sessao, ex, new BigDecimal(carga), 5 + semana, data));
                semana++;
            }
        }
        sincronizacao.receber(consultoria, aluno, registros);
    }

    private static List<RegistroExecucao> registrosDoDia(UUID versaoId, Sessao sessao, ExercicioPlano ex,
                                                         BigDecimal cargaTrabalho, int repsTrabalho, LocalDate data) {
        List<RegistroExecucao> lista = new ArrayList<>();
        var quando = data.atTime(LocalTime.of(19, 0)).atZone(Fuso.BRASILIA).toInstant();
        for (Serie s : ex.series()) {
            if (s.etapas() != null) {
                // Cluster e Rest-pause se registram etapa por etapa: a demonstração não inventa as etapas.
                continue;
            }
            BigDecimal carga;
            Integer reps;
            switch (s.modo()) {
                case "CARGA_TRABALHO" -> {
                    carga = cargaTrabalho;
                    reps = repsTrabalho;
                }
                case "PERCENTUAL_WS" -> {
                    carga = arredondar(cargaTrabalho.multiply(s.carga().percentualMin())
                            .divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP));
                    reps = s.repsMax();
                }
                default -> {
                    continue;
                }
            }
            lista.add(new RegistroExecucao(UUID.randomUUID(), versaoId, sessao.uid(), ex.uid(), s.uid(), data, carga,
                    reps, true, null, quando));
        }
        return lista;
    }

    /** Múltiplo de 0,5 kg mais próximo (arredondamento padrão da configuração). */
    private static BigDecimal arredondar(BigDecimal valor) {
        return valor.multiply(new BigDecimal("2")).setScale(0, RoundingMode.HALF_UP)
                .divide(new BigDecimal("2"), 1, RoundingMode.UNNECESSARY);
    }

    /**
     * Dieta de demonstração no formato do PDF do Saraiva (5 refeições, opções A/B no almoço e no jantar), montada com
     * os alimentos de exemplo. O PDF original não está no repositório: quantidades de exemplo, para o Gustavo
     * ajustar no editor. Ovo e legumes são itens manuais (o PDF tem valores inconsistentes para eles). Suplementação
     * vazia, sem protocolo.
     */
    private static ConteudoDieta dieta(Map<String, UUID> alimentos) {
        ItemFabrica f = new ItemFabrica(alimentos);
        ConteudoDieta.Item ovo = new ConteudoDieta.Item(UUID.randomUUID(), null, "Ovo inteiro", new BigDecimal("3"), "un",
                new BigDecimal("133"), null, null, null, true);
        List<ConteudoDieta.Refeicao> refeicoes = List.of(
                refeicao("Café da manhã", "07:00", List.of(opcao("A",
                        f.item("Pão de forma branco", "50"), ovo, f.item("Frutas (mamão, abacaxi, melão, morango, maçã ou kiwi)", "100")))),
                refeicao("Lanche da manhã", "10:00", List.of(opcao("A",
                        f.item("Iogurte desnatado", "170"), f.item("Aveia em flocos", "30"),
                        f.item("Semente de chia", "10"), f.item("Frutas (mamão, abacaxi, melão, morango, maçã ou kiwi)", "100")))),
                refeicao("Almoço", "12:30", List.of(
                        opcao("A", f.item("Arroz branco cozido", "150"), f.item("Peito de frango grelhado", "150"), legumes()),
                        opcao("B", f.item("Batata inglesa cozida", "250"), f.item("Peito de frango grelhado", "150"), legumes()))),
                refeicao("Lanche da tarde", "16:00", List.of(opcao("A",
                        f.item("Banana prata", "100"), f.item("Aveia em flocos", "30"), f.item("Iogurte desnatado", "170")))),
                refeicao("Jantar", "20:00", List.of(
                        opcao("A", f.item("Arroz branco cozido", "150"), f.item("Peito de frango grelhado", "150"), legumes()),
                        opcao("B", f.item("Batata inglesa cozida", "250"), f.item("Peito de frango grelhado", "150"), legumes()))));
        List<ConteudoDieta.Orientacao> orientacoes = List.of(
                new ConteudoDieta.Orientacao("Hidratação", "3 a 4 litros de água"),
                new ConteudoDieta.Orientacao("Refeição livre", "Sem refeição livre até a próxima atualização."));
        String observacoes = "Salada à vontade. Pelo menos 100 g de legumes nas principais refeições. "
                + "O frango pode ser trocado por outra carne magra.";
        return new ConteudoDieta("Construção muscular", null, "Saraiva Team", refeicoes, orientacoes, observacoes, List.of());
    }

    private static ConteudoDieta.Item legumes() {
        return new ConteudoDieta.Item(UUID.randomUUID(), null, "Legumes", new BigDecimal("100"), "g",
                new BigDecimal("45"), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, true);
    }

    private static ConteudoDieta.Refeicao refeicao(String nome, String horario, List<ConteudoDieta.Opcao> opcoes) {
        return new ConteudoDieta.Refeicao(UUID.randomUUID(), nome, horario, null, opcoes);
    }

    private static ConteudoDieta.Opcao opcao(String rotulo, ConteudoDieta.Item... itens) {
        return new ConteudoDieta.Opcao(UUID.randomUUID(), rotulo, List.of(itens));
    }

    /** Item calculado da biblioteca: valor por 100 g × quantidade (como o app faz ao editar). */
    private record ItemFabrica(Map<String, UUID> ids) {
        ConteudoDieta.Item item(String nome, String gramas) {
            AlimentoDemo a = ALIMENTOS.stream().filter(x -> x.nome().equals(nome)).findFirst().orElseThrow();
            BigDecimal q = new BigDecimal(gramas);
            return new ConteudoDieta.Item(UUID.randomUUID(), ids.get(nome), nome, q, "g", porcao(a.kcal(), q),
                    porcao(a.proteina(), q), porcao(a.carboidrato(), q), porcao(a.gordura(), q), false);
        }

        private static BigDecimal porcao(String por100, BigDecimal gramas) {
            return new BigDecimal(por100).multiply(gramas).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        }
    }

    // ---- Consultoria 2: prova de vários treinadores ----

    private void criarExemplo(String senha) {
        Usuario treinador = criacaoDeConta.criarTreinador(
                new CadastroTreinadorRequest("Consultoria Exemplo", "Treinador Exemplo", EXEMPLO, senha, null));
        UUID consultoria = treinador.getConsultoriaId();
        TenantContext.executarComo(consultoria, () -> {
            receitas.garantirPadrao();
            marca(consultoria, "Consultoria Exemplo", "#2563EB", Consultoria.Fonte.PADRAO, Consultoria.Tema.CLARO);
            Map<String, UUID> ids = new LinkedHashMap<>();
            for (String nome : List.of("Supino reto com barra", "Desenvolvimento com halteres", "Remada curvada com barra",
                    "Rosca direta com barra", "Agachamento livre", "Cadeira extensora")) {
                Exercicio.Modalidade m = nome.equals("Cadeira extensora") ? Exercicio.Modalidade.MAQUINA
                        : Exercicio.Modalidade.LIVRE;
                ids.put(nome, biblioteca.criarExercicio(new ExercicioRequest(nome, null, null, m, null, null)).id());
            }
            UUID aluno = alunos.criar(new AlunoRequest("Aluno Exemplo", ALUNO2, null, null, null)).id();
            darAcesso(aluno, ALUNO2, senha);
            List<String> nomes = new ArrayList<>(ids.keySet());
            ConteudoTreino abc = new ConteudoTreino(null, null, List.of(
                    sessaoSimples("Treino A", 1, ids, nomes.subList(0, 2)),
                    sessaoSimples("Treino B", 3, ids, nomes.subList(2, 4)),
                    sessaoSimples("Treino C", 5, ids, nomes.subList(4, 6)),
                    new Sessao(UUID.randomUUID(), "Descanso", 7, "DESCANSO", null, null, null, List.of())));
            LocalDate segunda = LocalDate.now(Fuso.BRASILIA).with(DayOfWeek.MONDAY);
            publicarTreino(aluno, null, "ABC", segunda, segunda.plusDays(27), abc, treinador.getId());
            return null;
        });
    }

    /** "Séries simples 3x8-12" (receita padrão), para quem não usa FS/WS. */
    private static Sessao sessaoSimples(String nome, int dia, Map<String, UUID> ids, List<String> exercicios) {
        return new Sessao(UUID.randomUUID(), nome, dia, "TREINO", null, null, null, exercicios.stream()
                .map(e -> new ExercicioPlano(UUID.randomUUID(), ids.get(e), e, null, null, null, true, "kg",
                        List.of(simples(), simples(), simples())))
                .toList());
    }

    private static Serie simples() {
        return trabalho(8, 12).comEsforco(Esforco.deRir(2));
    }

    // ---- Comum ----

    private void marca(UUID consultoria, String nome, String cor, Consultoria.Fonte fonte, Consultoria.Tema tema) {
        Long versao = marcas.consultoria(consultoria).versao();
        marcas.alterarMarca(consultoria, new MarcaRequest(nome, cor, fonte, tema, versao));
    }

    /** Mesmo caminho do convite real: gera o código e aceita com o e-mail da demo. */
    private void darAcesso(UUID aluno, String email, String senha) {
        String codigo = convites.gerar(aluno).codigo();
        convites.aceitar(ConviteService.hash(codigo), email, senha);
    }

    private PlanoDetalhe<ConteudoTreino> publicarTreino(UUID aluno, UUID pasta, String titulo, LocalDate inicio, LocalDate fim,
                                                        ConteudoTreino conteudo, UUID treinador) {
        PlanoDetalhe<ConteudoTreino> criado = treinos.criar(aluno, new CriarPlanoRequest(titulo, inicio, fim, null, null, pasta));
        PlanoDetalhe<ConteudoTreino> salvo = treinos.salvarRascunho(criado.plano().id(),
                new SalvarRascunhoRequest<>(titulo, inicio, fim, conteudo, criado.plano().versao()));
        return treinos.publicar(salvo.plano().id(), new PublicarRequest(salvo.plano().versao(), true), treinador);
    }

    private void publicarDieta(UUID aluno, UUID pasta, LocalDate inicio, LocalDate fim, ConteudoDieta conteudo,
                               UUID treinador) {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        ConteudoDieta comData = new ConteudoDieta(conteudo.objetivo(), hoje.with(DayOfWeek.MONDAY).toString(),
                conteudo.profissional(), conteudo.refeicoes(), conteudo.orientacoes(), conteudo.observacoes(),
                conteudo.suplementacao());
        PlanoDetalhe<ConteudoDieta> criado = dietas.criar(aluno, new CriarPlanoRequest("Plano alimentar", inicio, fim,
                null, null, pasta));
        PlanoDetalhe<ConteudoDieta> salvo = dietas.salvarRascunho(criado.plano().id(),
                new SalvarRascunhoRequest<>("Plano alimentar", inicio, fim, comData, criado.plano().versao()));
        dietas.publicar(salvo.plano().id(), new PublicarRequest(salvo.plano().versao(), true), treinador);
    }
}
