package br.com.treinos.api.importacao.completa;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.Papel;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria.TipoDeSerie;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;
import br.com.treinos.api.importacao.completa.CasamentoDeNomes.Nivel;
import br.com.treinos.api.importacao.completa.CasamentoDeNomes.Resultado;
import br.com.treinos.api.importacao.completa.LeitorDePrescricao.Prescricao;
import br.com.treinos.api.importacao.completa.LeituraDasAbas.AbaLida;
import br.com.treinos.api.importacao.completa.LeituraDasAbas.Leitura;
import br.com.treinos.api.importacao.completa.LigacaoDeAbas.AbaReconhecida;
import br.com.treinos.api.importacao.completa.LigacaoDeAbas.Ligacao;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.PartePulada;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Pendencias;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Problema;
import br.com.treinos.api.importacao.completa.RespostasDaPlanilha.NomeResolvido;
import br.com.treinos.api.importacao.completa.ReconhecimentoDeAbas.Reconhecimento;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.Carga;
import br.com.treinos.api.treino.ConteudoTreino.Esforco;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.web.Emails;
import br.com.treinos.api.web.Formatos;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Monta, sem banco e sem gravar nada, o que a importação da planilha completa vai criar: alunos novos, pesos, exercícios
 * novos na biblioteca e, por aluno, uma pasta com o treino e a dieta em <b>rascunho</b> (formato exato de
 * {@link ConteudoTreino} e {@link ConteudoDieta}). A prévia e a confirmação chamam a mesma montagem; a confirmação a roda
 * de novo depois de criar os exercícios, para os planos ligarem aos ids novos.
 *
 * <p>Regras que valem para tudo (as mesmas do {@code planos-lib.mjs}): valor ausente é nulo, nunca zero; nada é
 * inventado (série sem quantidade não nasce, carga em kg e técnica escrita ficam na observação com o texto da planilha);
 * nada some calado: o que ficou de fora, foi cortado ou não foi entendido vira um problema com aba, linha, campo e tipo,
 * nunca o valor. A tabela de alimentos de terceiros não é usada.
 *
 * <p>Sem resposta do treinador: exercício e alimento ligam à biblioteca só quando o casamento é {@code CERTO}; o
 * provável fica com o nome da planilha (pendência); suplemento que a biblioteca de suplementos reconhece vai para a
 * Suplementação, o que a de ergogênicos reconhece ou nenhuma reconhece vai para Medicação e ergogênicos (o conservador,
 * como no script); a ligação ambígua não liga (pendência).
 */
public final class MontagemDaImportacao {

    public static final String TITULO_PASTA = "Importada da planilha (rascunho)";
    private static final int NOME_ALUNO = 120;
    private static final int OBJETIVO = 200;
    private static final int OBSERVACOES_ALUNO = 4000;
    private static final int OBS_PESO = 300;
    private static final int SESSOES = 20;
    private static final int SESSAO_NOME = 80;
    private static final int EXERCICIOS_POR_SESSAO = 40;
    private static final int EXERCICIO_NOME = 120;
    private static final int EXERCICIO_OBS = 1000;
    private static final int ORIENTACOES_TREINO = 8000;
    private static final int GRUPO = 60;
    private static final int REFEICOES = 12;
    private static final int REFEICAO_NOME = 80;
    private static final int REFEICAO_OBS = 1000;
    private static final int OPCOES = 6;
    private static final int ROTULO = 10;
    private static final int ITENS = 40;
    private static final int ITEM_NOME = 160;
    private static final int ORIENTACOES = 30;
    private static final int ORIENTACAO_TITULO = 80;
    private static final int ORIENTACAO_TEXTO = 2000;
    private static final int OBSERVACOES_DIETA = 8000;
    private static final int SUPLEMENTOS = 40;
    private static final int CAMPO_SUPLEMENTO = 120;
    private static final int OBS_SUPLEMENTO = 500;
    private static final BigDecimal NUTRIENTE_MAXIMO = new BigDecimal("99999");
    private static final Pattern DIAS = Pattern.compile("^(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?![a-z])");
    private static final Map<String, Integer> NUMERO_DO_DIA = Map.of("segunda", 1, "terca", 2, "quarta", 3, "quinta", 4,
            "sexta", 5, "sabado", 6, "domingo", 7);
    private static final Pattern DOSE = Pattern.compile("\\b\\d+(?:[.,]\\d+)*\\s*(?:mg|mcg|ug|g|kg|ml|l|ui|iu|kcal|cap|caps|"
            + "capsulas?|cps|comp|comprimidos?|tab|tabs|tabletes?|scoops?|doses?|gotas?|saches?|porcoes?|unid|unidades?|un|x)\\b");
    /** Colunas que identificam a linha (código, aluno, situação e data) e não viram texto de orientação. */
    private static final Set<Campo> IDENTIFICACAO = EnumSet.of(Campo.CODIGO, Campo.ALUNO_CODIGO, Campo.PLANO_CODIGO,
            Campo.ROTINA_CODIGO, Campo.ALUNO, Campo.ATIVO, Campo.STATUS, Campo.DATA, Campo.DATA_INICIO, Campo.TITULO);

    public record ExercicioDaBiblioteca(UUID id, String nome, String modalidade, String videoUrl) {
    }

    public record AlimentoDaBiblioteca(UUID id, String nome) {
    }

    /** Aluno que já existe na consultoria, com as datas que já têm peso (o peso de uma data nunca é sobrescrito). */
    public record AlunoExistente(UUID id, String nome, String email, boolean anonimizado, Set<LocalDate> datasDePeso) {
    }

    public record Permissoes(boolean sensivel, boolean biblioteca, boolean treino, boolean dieta, boolean ergogenicos) {
    }

    /**
     * O que a montagem precisa saber da consultoria. {@code metodologia} = a padrão (nula = a de série do sistema, só para
     * os códigos dos tipos); {@code vagas} = vagas de aluno ativo livres (nulo = sem limite).
     */
    public record Contexto(List<ExercicioDaBiblioteca> exercicios, List<AlimentoDaBiblioteca> alimentos,
                           List<String> suplementos, List<String> ergogenicos, List<AlunoExistente> alunos,
                           ConteudoTreino.Metodologia metodologia, Long vagas, Permissoes permissoes, LocalDate hoje,
                           Predicate<String> videoValido) {
    }

    /** Dono das linhas: o aluno novo (linha na aba de alunos) ou o que já existe. */
    public record Dono(Integer linha, UUID existente) {
    }

    public record AlunoNovo(int linha, String nome, String email, String telefone, String objetivo, String observacoes,
                            boolean ativo) {
        @Override
        public String toString() {
            return "AlunoNovo[linha=" + linha + "]"; // nunca o nome, o e-mail nem o telefone
        }
    }

    public record PesoNovo(Dono dono, LocalDate data, BigDecimal kg, String observacao) {
        @Override
        public String toString() {
            return "PesoNovo"; // peso é dado sensível
        }
    }

    public record ExercicioNovo(String nome, String grupo, String videoUrl) {
    }

    public record PlanosDoAluno(Dono dono, String nome, ConteudoTreino treino, ConteudoDieta dieta) {
        @Override
        public String toString() {
            return "PlanosDoAluno"; // dieta e treino são do aluno
        }
    }

    public record Montagem(List<AlunoNovo> alunosNovos, int alunosReaproveitados, List<PesoNovo> pesos, int pesosIniciais,
                           int pesosJaRegistrados, List<ExercicioNovo> exerciciosNovos, List<PlanosDoAluno> planos,
                           int suplementosSensiveisPulados, int faixasRecuperadasDeData, List<Problema> problemas, int linhas,
                           List<PartePulada> partesPuladas, Pendencias pendencias) {
        @Override
        public String toString() {
            return "Montagem"; // só contagens saem daqui por texto
        }
    }

    private MontagemDaImportacao() {
    }

    public static Montagem montar(Leitura leitura, RespostasDaPlanilha respostas, Contexto contexto) {
        return new Execucao(leitura, respostas, contexto).executar();
    }

    /**
     * Nome de suplemento comparável, como o {@code nomeDeSuplementoNormalizado} do script: sem acento, minúsculo, sem o
     * que está entre parênteses e sem dose ou unidade ("Creatina (5g) - 5 g" = "creatina").
     */
    public static String nomeDeSuplemento(String nome) {
        String t = Normalizacao.semAcento(nome == null ? "" : nome).toLowerCase(Locale.ROOT);
        t = t.replaceAll("\\([^)]*(?:\\)|$)", " ");
        t = DOSE.matcher(t).replaceAll(" ");
        return t.replaceAll("[^a-z0-9]+", " ").strip();
    }

    /** Dia da semana só quando o nome do treino começa por ele ("Segunda - Costas"); senão nulo (sem dia fixo). */
    static Integer diaDaSemana(String nome) {
        Matcher m = DIAS.matcher(Normalizacao.chaveDoNome(nome));
        return m.find() ? NUMERO_DO_DIA.get(m.group(1)) : null;
    }

    /** Uma montagem: o estado de uma chamada. */
    private static final class Execucao {
        private final Leitura leitura;
        private final RespostasDaPlanilha respostas;
        private final Contexto ctx;
        private final List<Problema> problemas = new ArrayList<>();
        private final List<AbaReconhecida> abas;
        private final Map<Integer, Ligacao> porFilha = new HashMap<>();
        private final Map<Integer, Map<Integer, Linha>> linhasPorNumero = new HashMap<>();
        private final Map<Integer, Dono> alunosPorLinha = new HashMap<>();
        private final Map<Dono, String> nomes = new HashMap<>();
        private final Map<Dono, Object[]> pesoInicial = new HashMap<>();
        private final Map<Integer, Set<Integer>> cabecalhosEscolhidos = new HashMap<>();
        private final Map<String, Integer> respostasDeLigacao;
        private final Map<String, NomeResolvido> respostasDeExercicio;
        private final Map<String, NomeResolvido> respostasDeAlimento;
        private final Map<String, String> respostasDeSuplemento;
        private final CasamentoDeNomes.Indice bibliotecaDeExercicios;
        private final Map<String, ExercicioDaBiblioteca> exercicioPorNome = new HashMap<>();
        private final Map<UUID, ExercicioDaBiblioteca> exercicioPorId = new HashMap<>();
        private final CasamentoDeNomes.Indice bibliotecaDeAlimentos;
        private final Map<String, AlimentoDaBiblioteca> alimentoPorNome = new HashMap<>();
        private final Map<UUID, AlimentoDaBiblioteca> alimentoPorId = new HashMap<>();
        private final ConfiguracaoConsultoria metodologia;
        private final Set<String> exerciciosProvaveis = new HashSet<>();
        private final Set<String> alimentosProvaveis = new HashSet<>();
        private final Set<String> suplementosPendentes = new HashSet<>();
        private final Map<String, ExercicioNovo> exerciciosNovos = new LinkedHashMap<>();
        private int ligacoesAmbiguas;
        private int faixasDeData;
        private int sensiveisPulados;
        private int alunosAbaIndice = -1;

        Execucao(Leitura leitura, RespostasDaPlanilha respostas, Contexto ctx) {
            this.leitura = leitura;
            this.respostas = respostas;
            this.ctx = ctx;
            this.abas = AnaliseDaPlanilha.reconhecerAbas(leitura, respostas.tiposDasAbas());
            LigacaoDeAbas.ligarTodas(abas).forEach(l -> porFilha.put(l.filha(), l));
            for (AbaReconhecida a : abas) {
                Map<Integer, Linha> porNumero = new HashMap<>();
                a.dados().forEach(l -> porNumero.put(l.numero(), l));
                linhasPorNumero.put(a.indice(), porNumero);
            }
            this.respostasDeLigacao = respostas.ligacoesPorLinha();
            this.respostasDeExercicio = respostas.exerciciosPorChave();
            this.respostasDeAlimento = respostas.alimentosPorChave();
            this.respostasDeSuplemento = respostas.suplementosPorNome();
            this.bibliotecaDeExercicios = new CasamentoDeNomes.Indice(ctx.exercicios().stream().map(ExercicioDaBiblioteca::nome).toList());
            for (ExercicioDaBiblioteca e : ctx.exercicios()) {
                exercicioPorNome.putIfAbsent(e.nome(), e);
                exercicioPorId.put(e.id(), e);
            }
            this.bibliotecaDeAlimentos = new CasamentoDeNomes.Indice(ctx.alimentos().stream().map(AlimentoDaBiblioteca::nome).toList());
            for (AlimentoDaBiblioteca a : ctx.alimentos()) {
                alimentoPorNome.putIfAbsent(a.nome(), a);
                alimentoPorId.put(a.id(), a);
            }
            this.metodologia = ctx.metodologia() != null ? ctx.metodologia().configuracao() : ConfiguracaoConsultoria.padrao();
        }

        Montagem executar() {
            List<AlunoNovo> novos = new ArrayList<>();
            int reaproveitados = alunos(novos);
            List<PartePulada> puladas = new ArrayList<>();
            boolean temSensivel = abas.stream().anyMatch(a -> a.indice() == alunosAbaIndice
                    && (a.reconhecimento().tem(Campo.OBJETIVO) || a.reconhecimento().tem(Campo.OBSERVACAO)));
            if (temSensivel && !ctx.permissoes().sensivel()) {
                puladas.add(new PartePulada("OBJETIVO_E_OBSERVACOES", "ALUNO_SENSIVEL_ALTERAR"));
            }

            List<PesoNovo> pesos = new ArrayList<>();
            int[] iniciaisEJa = {0, 0};
            boolean temPesos = abas.stream().anyMatch(a -> a.tipo() == TipoDeAba.PESOS && !a.dados().isEmpty())
                    || !pesoInicial.isEmpty();
            if (temPesos && !ctx.permissoes().sensivel()) {
                puladas.add(new PartePulada("PESOS", "ALUNO_SENSIVEL_ALTERAR"));
            } else if (temPesos) {
                iniciaisEJa = pesos(pesos);
            }

            listaDeExercicios(puladas);

            Map<Dono, ConteudoTreino> treinos = new LinkedHashMap<>();
            boolean temTreino = abas.stream().anyMatch(a -> a.tipo() == TipoDeAba.TREINO && !a.dados().isEmpty());
            if (temTreino && !ctx.permissoes().treino()) {
                puladas.add(new PartePulada("TREINO", "PASTA_ALTERAR e TREINO_ALTERAR"));
            } else if (temTreino) {
                treinos(treinos);
            }
            Map<Dono, ConteudoDieta> dietas = new LinkedHashMap<>();
            boolean temDieta = abas.stream().anyMatch(a -> (a.tipo() == TipoDeAba.DIETA || a.tipo() == TipoDeAba.SUPLEMENTOS)
                    && !a.dados().isEmpty());
            if (temDieta && !ctx.permissoes().dieta()) {
                puladas.add(new PartePulada("DIETA", "PASTA_ALTERAR e DIETA_ALTERAR"));
            } else if (temDieta) {
                dietas(dietas);
                if (sensiveisPulados > 0) {
                    puladas.add(new PartePulada("MEDICACAO_E_ERGOGENICOS", "ERGOGENICO_ALTERAR"));
                }
            }
            List<PlanosDoAluno> planos = new ArrayList<>();
            Set<Dono> donos = new java.util.LinkedHashSet<>(treinos.keySet());
            donos.addAll(dietas.keySet());
            for (Dono d : donos) {
                planos.add(new PlanosDoAluno(d, nomes.get(d), treinos.get(d), dietas.get(d)));
            }
            int linhas = abas.stream().filter(a -> a.tipo() != TipoDeAba.DESCONHECIDA).mapToInt(a -> a.dados().size()).sum();
            Pendencias pendencias = new Pendencias(exerciciosProvaveis.size(), alimentosProvaveis.size(), ligacoesAmbiguas,
                    suplementosPendentes.size());
            return new Montagem(List.copyOf(novos), reaproveitados, List.copyOf(pesos), iniciaisEJa[0], iniciaisEJa[1],
                    List.copyOf(exerciciosNovos.values()), List.copyOf(planos), sensiveisPulados, faixasDeData,
                    List.copyOf(problemas), linhas, List.copyOf(puladas), pendencias);
        }

        private void problema(AbaReconhecida aba, int linha, Campo campo, String tipo) {
            problemas.add(new Problema(aba.nome(), linha, campo == null ? null : campo.name(), tipo));
        }

        // ------------------------------------------------------------------------------------------------ alunos

        /** Alunos da primeira aba de alunos (a mãe das ligações). Devolve quantos já existiam e foram reaproveitados. */
        private int alunos(List<AlunoNovo> novos) {
            AbaReconhecida aba = abas.stream().filter(a -> a.tipo() == TipoDeAba.ALUNOS).findFirst().orElse(null);
            if (aba == null) {
                return 0;
            }
            alunosAbaIndice = aba.indice();
            Reconhecimento r = aba.reconhecimento();
            int cCodigo = r.coluna(Campo.CODIGO);
            Set<String> codigos = new HashSet<>();
            Map<String, AlunoExistente> porEmail = new HashMap<>();
            Map<String, List<AlunoExistente>> porNome = new HashMap<>();
            for (AlunoExistente e : ctx.alunos()) {
                if (e.email() != null && !e.email().isBlank()) {
                    porEmail.putIfAbsent(Emails.normalizar(e.email()), e);
                }
                porNome.computeIfAbsent(Normalizacao.chaveDoNome(e.nome()), k -> new ArrayList<>()).add(e);
            }
            Long vagas = ctx.vagas();
            int reaproveitados = 0;
            for (Linha l : aba.dados()) {
                String codigo = AnaliseDaPlanilha.texto(l, cCodigo).toLowerCase(Locale.ROOT);
                if (cCodigo >= 0 && codigo.isEmpty()) {
                    problema(aba, l.numero(), Campo.CODIGO, "ALUNO_SEM_CODIGO");
                    continue;
                }
                if (cCodigo >= 0 && !codigos.add(codigo)) {
                    problema(aba, l.numero(), Campo.CODIGO, "CODIGO_REPETIDO");
                    continue;
                }
                String nome = linhaUnica(AnaliseDaPlanilha.texto(l, r.coluna(Campo.ALUNO)));
                if (nome.isEmpty()) {
                    problema(aba, l.numero(), Campo.ALUNO, "ALUNO_SEM_NOME");
                    continue;
                }
                if (nome.length() > NOME_ALUNO) {
                    problema(aba, l.numero(), Campo.ALUNO, "NOME_LONGO_DEMAIS");
                    continue;
                }
                String email = AnaliseDaPlanilha.texto(l, r.coluna(Campo.EMAIL)).toLowerCase(Locale.ROOT);
                if (AnaliseDaPlanilha.SEM_EMAIL.contains(email)) {
                    email = "";
                }
                if (!email.isEmpty() && (!AnaliseDaPlanilha.EMAIL.matcher(email).matches() || email.length() > 254)) {
                    problema(aba, l.numero(), Campo.EMAIL, "EMAIL_INVALIDO");
                    email = "";
                }
                AlunoExistente existente = email.isEmpty() ? null : porEmail.get(Emails.normalizar(email));
                if (existente == null) {
                    List<AlunoExistente> mesmos = porNome.getOrDefault(Normalizacao.chaveDoNome(nome), List.of());
                    if (mesmos.size() > 1) {
                        problema(aba, l.numero(), Campo.ALUNO, "ALUNO_EXISTENTE_AMBIGUO");
                        continue;
                    }
                    existente = mesmos.isEmpty() ? null : mesmos.getFirst();
                }
                if (existente != null && existente.anonimizado()) {
                    problema(aba, l.numero(), Campo.ALUNO, "ALUNO_ANONIMIZADO");
                    continue;
                }
                Dono dono;
                if (existente != null) {
                    dono = new Dono(null, existente.id());
                    reaproveitados++;
                } else {
                    String status = Normalizacao.chaveDoNome(AnaliseDaPlanilha.texto(l, r.coluna(Campo.STATUS)));
                    boolean ativo = status.isEmpty() || AnaliseDaPlanilha.ATIVO.matcher(status).matches();
                    if (ativo && vagas != null) {
                        if (vagas <= 0) {
                            problema(aba, l.numero(), Campo.ALUNO, "LIMITE_DO_PLANO");
                            continue;
                        }
                        vagas--;
                    }
                    novos.add(new AlunoNovo(l.numero(), nome, email.isEmpty() ? null : email, telefone(aba, l),
                            sensivel(aba, l, Campo.OBJETIVO, OBJETIVO), sensivel(aba, l, Campo.OBSERVACAO, OBSERVACOES_ALUNO),
                            ativo));
                    dono = new Dono(l.numero(), null);
                }
                alunosPorLinha.put(l.numero(), dono);
                nomes.put(dono, nome);
                guardarPesoInicial(aba, l, dono);
            }
            return reaproveitados;
        }

        private String telefone(AbaReconhecida aba, Linha l) {
            String t = AnaliseDaPlanilha.texto(l, aba.reconhecimento().coluna(Campo.TELEFONE));
            if (t.isEmpty()) {
                return null;
            }
            try {
                return Formatos.telefone(t);
            } catch (BadRequestException e) {
                problema(aba, l.numero(), Campo.TELEFONE, "TELEFONE_INVALIDO");
                return null;
            }
        }

        /** Objetivo e observações do aluno: só com ALUNO_SENSIVEL_ALTERAR (sem ela ficam fora, sem problema por linha). */
        private String sensivel(AbaReconhecida aba, Linha l, Campo campo, int maximo) {
            if (!ctx.permissoes().sensivel()) {
                return null;
            }
            String t = bloco(AnaliseDaPlanilha.texto(l, aba.reconhecimento().coluna(campo)));
            if (t.length() > maximo) {
                problema(aba, l.numero(), campo, "TEXTO_LONGO_DEMAIS");
                return null;
            }
            return t.isEmpty() ? null : t;
        }

        private void guardarPesoInicial(AbaReconhecida aba, Linha l, Dono dono) {
            Reconhecimento r = aba.reconhecimento();
            Celula peso = LigacaoDeAbas.celula(l, r.coluna(Campo.PESO_INICIAL));
            if (ReconhecimentoDeAbas.vazia(peso)) {
                return;
            }
            Celula inicio = LigacaoDeAbas.celula(l, r.coluna(Campo.DATA_INICIO));
            BigDecimal kg = AnaliseDaPlanilha.pesoKg(peso);
            LocalDate data = ReconhecimentoDeAbas.vazia(inicio) ? null : AnaliseDaPlanilha.data(inicio, leitura.data1904());
            if (kg == null) {
                problema(aba, l.numero(), Campo.PESO_INICIAL, "PESO_INICIAL_INVALIDO");
            } else if (ReconhecimentoDeAbas.vazia(inicio)) {
                problema(aba, l.numero(), Campo.DATA_INICIO, "PESO_INICIAL_SEM_DATA");
            } else if (data == null) {
                problema(aba, l.numero(), Campo.DATA_INICIO, "DATA_INICIO_INVALIDA");
            } else if (data.isAfter(ctx.hoje())) {
                problema(aba, l.numero(), Campo.DATA_INICIO, "DATA_INICIO_NO_FUTURO");
            } else {
                pesoInicial.put(dono, new Object[] {data, kg});
            }
        }

        // ------------------------------------------------------------------------------------- dono de cada linha

        private record Achado(Dono dono, String motivo) {
        }

        /** O aluno dono de uma linha, seguindo as ligações (linha de treino → rotina → aluno); sem dono, o motivo. */
        private Achado dono(int abaIndice, Linha l) {
            if (abaIndice == alunosAbaIndice) {
                Dono d = alunosPorLinha.get(l.numero());
                return d == null ? new Achado(null, "ALUNO_FORA") : new Achado(d, null);
            }
            Ligacao lg = porFilha.get(abaIndice);
            if (lg == null) {
                return new Achado(null, "ABA_SEM_LIGACAO");
            }
            if (AnaliseDaPlanilha.texto(l, lg.colunaFilha()).isEmpty()) {
                return new Achado(null, "SEM_REFERENCIA");
            }
            Integer mae = lg.maes().get(l.numero());
            if (mae == null) {
                List<Integer> candidatas = lg.candidatas().get(l.numero());
                if (candidatas == null) {
                    return new Achado(null, "LINHA_SEM_LIGACAO");
                }
                Integer escolhida = respostasDeLigacao.get(abaIndice + ":" + l.numero());
                if (escolhida == null || !candidatas.contains(escolhida)) {
                    return new Achado(null, "LIGACAO_AMBIGUA");
                }
                mae = escolhida;
            }
            AbaReconhecida abaMae = abas.get(lg.mae());
            if (abaMae.tipo() == TipoDeAba.ALUNOS) {
                Dono d = abaMae.indice() == alunosAbaIndice ? alunosPorLinha.get(mae) : null;
                return d == null ? new Achado(null, "ALUNO_FORA") : new Achado(d, null);
            }
            if (!escolhidos(abaMae).contains(mae)) {
                return new Achado(null, "CABECALHO_NAO_USADO");
            }
            return dono(abaMae.indice(), linhasPorNumero.get(abaMae.indice()).get(mae));
        }

        /**
         * Linhas de rotina (ou de plano de dieta) que valem: uma por aluno. Com a coluna "Ativo", só as ativas; mais de uma
         * para o mesmo aluno = nenhuma (nunca escolhe), como o {@code ativosPorAluno} do script.
         */
        private Set<Integer> escolhidos(AbaReconhecida aba) {
            Set<Integer> pronto = cabecalhosEscolhidos.get(aba.indice());
            if (pronto != null) {
                return pronto;
            }
            Set<Integer> escolhidos = new HashSet<>();
            cabecalhosEscolhidos.put(aba.indice(), escolhidos);
            int cAtivo = aba.reconhecimento().coluna(Campo.ATIVO);
            Map<Dono, List<Integer>> porDono = new LinkedHashMap<>();
            for (Linha l : aba.dados()) {
                Achado a = dono(aba.indice(), l);
                if (a.dono() == null) {
                    problema(aba, l.numero(), null, a.motivo());
                    continue;
                }
                if (cAtivo >= 0 && MontagemDeSeries.logico(LigacaoDeAbas.celula(l, cAtivo)) != MontagemDeSeries.Logico.SIM) {
                    problema(aba, l.numero(), Campo.ATIVO, "INATIVO_IGNORADO");
                    continue;
                }
                porDono.computeIfAbsent(a.dono(), k -> new ArrayList<>()).add(l.numero());
            }
            porDono.forEach((d, linhas) -> {
                if (linhas.size() == 1) {
                    escolhidos.add(linhas.getFirst());
                } else {
                    linhas.forEach(n -> problema(aba, n, Campo.ATIVO, "MAIS_DE_UM_ATIVO_PARA_O_ALUNO"));
                }
            });
            return escolhidos;
        }

        /** Linhas das abas do tipo, por dono (na ordem das abas e das linhas); a linha sem dono vira problema. */
        private Map<Dono, List<Object[]>> linhasPorDono(TipoDeAba tipo) {
            Map<Dono, List<Object[]>> porDono = new LinkedHashMap<>();
            for (AbaReconhecida aba : abas) {
                if (aba.tipo() != tipo) {
                    continue;
                }
                for (Linha l : aba.dados()) {
                    Achado a = dono(aba.indice(), l);
                    if (a.dono() == null) {
                        if ("LIGACAO_AMBIGUA".equals(a.motivo())) {
                            ligacoesAmbiguas++;
                        }
                        if (!"CABECALHO_NAO_USADO".equals(a.motivo())) {
                            problema(aba, l.numero(), null, a.motivo());
                        }
                        continue;
                    }
                    porDono.computeIfAbsent(a.dono(), k -> new ArrayList<>()).add(new Object[] {aba, l});
                }
            }
            return porDono;
        }

        // ------------------------------------------------------------------------------------------------- pesos

        private int[] pesos(List<PesoNovo> pesos) {
            Map<UUID, AlunoExistente> existentes = new HashMap<>();
            ctx.alunos().forEach(e -> existentes.put(e.id(), e));
            Set<String> vistos = new HashSet<>();
            int ja = 0;
            for (Map.Entry<Dono, List<Object[]>> e : linhasPorDono(TipoDeAba.PESOS).entrySet()) {
                Dono dono = e.getKey();
                for (Object[] par : e.getValue()) {
                    AbaReconhecida aba = (AbaReconhecida) par[0];
                    Linha l = (Linha) par[1];
                    Reconhecimento r = aba.reconhecimento();
                    Celula data = LigacaoDeAbas.celula(l, r.coluna(Campo.DATA));
                    Celula peso = LigacaoDeAbas.celula(l, r.coluna(Campo.PESO));
                    LocalDate dia = ReconhecimentoDeAbas.vazia(data) ? null : AnaliseDaPlanilha.data(data, leitura.data1904());
                    BigDecimal kg = ReconhecimentoDeAbas.vazia(peso) ? null : AnaliseDaPlanilha.pesoKg(peso);
                    if (ReconhecimentoDeAbas.vazia(data)) {
                        problema(aba, l.numero(), Campo.DATA, "SEM_DATA");
                    } else if (dia == null) {
                        problema(aba, l.numero(), Campo.DATA, "DATA_INVALIDA");
                    } else if (dia.isAfter(ctx.hoje())) {
                        problema(aba, l.numero(), Campo.DATA, "DATA_NO_FUTURO");
                    } else if (ReconhecimentoDeAbas.vazia(peso)) {
                        problema(aba, l.numero(), Campo.PESO, "SEM_PESO");
                    } else if (kg == null) {
                        problema(aba, l.numero(), Campo.PESO, "PESO_INVALIDO");
                    } else if (!vistos.add(dono + "|" + dia)) {
                        problema(aba, l.numero(), Campo.DATA, "PESO_REPETIDO");
                    } else if (dono.existente() != null && existentes.get(dono.existente()).datasDePeso().contains(dia)) {
                        ja++;
                    } else {
                        String obs = linhaUnica(AnaliseDaPlanilha.texto(l, r.coluna(Campo.OBSERVACAO)));
                        if (obs.length() > OBS_PESO) {
                            problema(aba, l.numero(), Campo.OBSERVACAO, "OBSERVACAO_LONGA_DEMAIS");
                            obs = "";
                        }
                        pesos.add(new PesoNovo(dono, dia, kg, obs.isEmpty() ? null : obs));
                    }
                }
            }
            int iniciais = 0;
            for (Map.Entry<Dono, Object[]> e : pesoInicial.entrySet()) {
                LocalDate dia = (LocalDate) e.getValue()[0];
                Dono dono = e.getKey();
                boolean jaTem = dono.existente() != null && existentes.get(dono.existente()).datasDePeso().contains(dia);
                if (vistos.add(dono + "|" + dia) && !jaTem) {
                    pesos.add(new PesoNovo(dono, dia, (BigDecimal) e.getValue()[1], null));
                    iniciais++;
                }
            }
            return new int[] {iniciais, ja};
        }

        // -------------------------------------------------------------------------------------------- exercícios

        /**
         * Exercícios novos na biblioteca: os da aba de lista que a biblioteca não tem (pelo casamento certo) e os nomes de
         * treino respondidos com "criar". Sem BIBLIOTECA_ALTERAR, nenhum (e a parte aparece como pulada).
         */
        private void listaDeExercicios(List<PartePulada> puladas) {
            List<String[]> candidatos = new ArrayList<>();
            for (AbaReconhecida aba : abas) {
                if (aba.tipo() != TipoDeAba.LISTA_DE_EXERCICIOS) {
                    continue;
                }
                Reconhecimento r = aba.reconhecimento();
                for (Linha l : aba.dados()) {
                    String nome = linhaUnica(AnaliseDaPlanilha.texto(l, r.coluna(Campo.EXERCICIO)));
                    if (nome.isEmpty()) {
                        continue;
                    }
                    if (nome.length() > EXERCICIO_NOME) {
                        problema(aba, l.numero(), Campo.EXERCICIO, "NOME_DO_EXERCICIO_LONGO_DEMAIS");
                        continue;
                    }
                    String grupo = linhaUnica(AnaliseDaPlanilha.texto(l, r.coluna(Campo.GRUPO_MUSCULAR)));
                    if (grupo.length() > GRUPO) {
                        problema(aba, l.numero(), Campo.GRUPO_MUSCULAR, "TEXTO_LONGO_DEMAIS");
                        grupo = "";
                    }
                    String video = AnaliseDaPlanilha.texto(l, r.coluna(Campo.VIDEO));
                    if (!video.isEmpty() && !ctx.videoValido().test(video)) {
                        problema(aba, l.numero(), Campo.VIDEO, "VIDEO_NAO_ACEITO");
                        video = "";
                    }
                    candidatos.add(new String[] {nome, grupo.isEmpty() ? null : grupo, video.isEmpty() ? null : video});
                }
            }
            for (NomeResolvido n : respostas.exercicios()) {
                if ("CRIAR".equals(n.acao()) && linhaUnica(n.nome()).length() <= EXERCICIO_NOME) {
                    candidatos.add(new String[] {linhaUnica(n.nome()), null, null});
                }
            }
            List<ExercicioNovo> novos = new ArrayList<>();
            Set<String> chaves = new HashSet<>();
            for (String[] c : candidatos) {
                String k = semOrdem(c[0]);
                if (k.isEmpty() || bibliotecaDeExercicios.casar(c[0]).nivel() == Nivel.CERTO || !chaves.add(k)) {
                    continue;
                }
                novos.add(new ExercicioNovo(c[0], c[1], c[2]));
            }
            if (novos.isEmpty()) {
                return;
            }
            if (!ctx.permissoes().biblioteca()) {
                puladas.add(new PartePulada("EXERCICIOS", "BIBLIOTECA_ALTERAR"));
                return;
            }
            novos.forEach(e -> exerciciosNovos.put(semOrdem(e.nome()), e));
        }

        /**
         * O exercício da biblioteca de um nome do treino: resposta "biblioteca" (o id) ou "manter" vencem; depois o
         * casamento certo; a sugestão provável só com "aceitar". "Criar" liga quando o exercício já existe (na
         * confirmação, depois de criado).
         */
        private ExercicioDaBiblioteca exercicio(String nome) {
            String k = CasamentoDeNomes.chave(nome);
            NomeResolvido r = respostasDeExercicio.get(k);
            if (r != null && "BIBLIOTECA".equals(r.acao())) {
                return exercicioPorId.get(r.id());
            }
            if (r != null && "MANTER".equals(r.acao())) {
                return null;
            }
            Resultado c = bibliotecaDeExercicios.casar(nome);
            if (c.nivel() == Nivel.CERTO) {
                return exercicioPorNome.get(c.candidato());
            }
            if (c.nivel() == Nivel.PROVAVEL) {
                if (r != null && "ACEITAR".equals(r.acao())) {
                    return exercicioPorNome.get(c.candidato());
                }
                if (r == null && !exerciciosNovos.containsKey(semOrdem(nome))) {
                    exerciciosProvaveis.add(k);
                }
            }
            return null;
        }

        private AlimentoDaBiblioteca alimento(String nome) {
            String k = CasamentoDeNomes.chave(nome);
            NomeResolvido r = respostasDeAlimento.get(k);
            if (r != null && "BIBLIOTECA".equals(r.acao())) {
                return alimentoPorId.get(r.id());
            }
            if (r != null && ("MANTER".equals(r.acao()) || "CRIAR".equals(r.acao()))) {
                return null;
            }
            Resultado c = bibliotecaDeAlimentos.casar(nome);
            if (c.nivel() == Nivel.CERTO) {
                return alimentoPorNome.get(c.candidato());
            }
            if (c.nivel() == Nivel.PROVAVEL) {
                if (r != null && "ACEITAR".equals(r.acao())) {
                    return alimentoPorNome.get(c.candidato());
                }
                if (r == null) {
                    alimentosProvaveis.add(k);
                }
            }
            return null;
        }

        // ------------------------------------------------------------------------------------------------ treino

        private void treinos(Map<Dono, ConteudoTreino> saida) {
            for (Map.Entry<Dono, List<Object[]>> e : linhasPorDono(TipoDeAba.TREINO).entrySet()) {
                List<Object[]> linhas = e.getValue();
                AbaReconhecida primeiraAba = (AbaReconhecida) linhas.getFirst()[0];
                Map<String, List<Object[]>> porTreino = new LinkedHashMap<>();
                for (Object[] par : linhas) {
                    AbaReconhecida aba = (AbaReconhecida) par[0];
                    Linha l = (Linha) par[1];
                    Reconhecimento r = aba.reconhecimento();
                    String letra = linhaUnica(AnaliseDaPlanilha.texto(l, r.coluna(Campo.LETRA_TREINO))).toUpperCase(Locale.ROOT);
                    String nomeTreino = linhaUnica(AnaliseDaPlanilha.texto(l, r.coluna(Campo.NOME_TREINO)));
                    if (r.tem(Campo.LETRA_TREINO) && letra.isEmpty()) {
                        problema(aba, l.numero(), Campo.LETRA_TREINO, "EXERCICIO_SEM_LETRA_DO_TREINO");
                        continue;
                    }
                    String chave = r.tem(Campo.LETRA_TREINO) ? letra : nomeTreino.toLowerCase(Locale.ROOT);
                    porTreino.computeIfAbsent(chave, k -> new ArrayList<>()).add(par);
                }
                List<String> ordemDasChaves = new ArrayList<>(porTreino.keySet());
                if (primeiraAba.reconhecimento().tem(Campo.LETRA_TREINO)) {
                    ordemDasChaves.sort(Comparator.naturalOrder());
                }
                List<Sessao> sessoes = new ArrayList<>();
                for (String chave : ordemDasChaves) {
                    List<Object[]> doTreino = porTreino.get(chave);
                    AbaReconhecida aba = (AbaReconhecida) doTreino.getFirst()[0];
                    Linha primeira = (Linha) doTreino.getFirst()[1];
                    if (sessoes.size() == SESSOES) {
                        problema(aba, primeira.numero(), null, "TREINOS_DEMAIS");
                        break;
                    }
                    Sessao s = sessao(chave, doTreino);
                    if (s != null) {
                        sessoes.add(s);
                    }
                }
                if (sessoes.isEmpty()) {
                    continue;
                }
                ConteudoTreino conteudo = new ConteudoTreino(null, orientacoesDaRotina(e.getKey()), List.copyOf(sessoes),
                        ctx.metodologia());
                saida.put(e.getKey(), conteudo);
            }
        }

        private Sessao sessao(String chave, List<Object[]> doTreino) {
            AbaReconhecida aba = (AbaReconhecida) doTreino.getFirst()[0];
            Linha primeira = (Linha) doTreino.getFirst()[1];
            Reconhecimento r = aba.reconhecimento();
            String nome = linhaUnica(AnaliseDaPlanilha.texto(primeira, r.coluna(Campo.NOME_TREINO)));
            if (nome.isEmpty()) {
                nome = chave.isEmpty() ? "Treino" : "Treino " + chave;
                if (r.tem(Campo.NOME_TREINO) || r.tem(Campo.LETRA_TREINO)) {
                    problema(aba, primeira.numero(), Campo.NOME_TREINO, "TREINO_SEM_NOME");
                }
            }
            nome = cortar(aba, primeira.numero(), Campo.NOME_TREINO, nome, SESSAO_NOME);
            List<Object[]> ordenados = new ArrayList<>(doTreino);
            ordenados.sort(Comparator.comparing((Object[] p) -> {
                Reconhecimento rr = ((AbaReconhecida) p[0]).reconhecimento();
                MontagemDeSeries.Numero n = MontagemDeSeries.numero(LigacaoDeAbas.celula((Linha) p[1], rr.coluna(Campo.ORDEM)));
                return n.valor() == null ? BigDecimal.valueOf(Long.MAX_VALUE) : n.valor();
            }));
            List<ExercicioPlano> exercicios = new ArrayList<>();
            for (Object[] par : ordenados) {
                AbaReconhecida a = (AbaReconhecida) par[0];
                Linha l = (Linha) par[1];
                if (exercicios.size() == EXERCICIOS_POR_SESSAO) {
                    problema(a, l.numero(), null, "EXERCICIOS_DEMAIS_NO_TREINO");
                    break;
                }
                ExercicioPlano ex = exercicioDaLinha(a, l);
                if (ex != null) {
                    exercicios.add(ex);
                }
            }
            if (exercicios.isEmpty()) {
                return null;
            }
            return new Sessao(UUID.randomUUID(), nome, diaDaSemana(nome), ConteudoTreino.TREINO, null, null, null,
                    List.copyOf(exercicios), List.of());
        }

        private ExercicioPlano exercicioDaLinha(AbaReconhecida aba, Linha l) {
            Reconhecimento r = aba.reconhecimento();
            String completo = linhaUnica(AnaliseDaPlanilha.texto(l, r.coluna(Campo.EXERCICIO)));
            if (completo.isEmpty()) {
                problema(aba, l.numero(), Campo.EXERCICIO, "EXERCICIO_SEM_NOME");
                return null;
            }
            List<String> obs = new ArrayList<>();
            String nome = completo;
            if (completo.length() > EXERCICIO_NOME) {
                // O nome inteiro não cabe; o começo vira o nome e o inteiro fica na observação (nada se perde).
                problema(aba, l.numero(), Campo.EXERCICIO, "NOME_DO_EXERCICIO_CORTADO");
                nome = completo.substring(0, EXERCICIO_NOME).strip();
                obs.add("Nome completo: " + completo);
            }
            String observacao = bloco(AnaliseDaPlanilha.texto(l, r.coluna(Campo.OBSERVACAO)));
            if (!observacao.isEmpty()) {
                obs.add(observacao);
            }
            String video = AnaliseDaPlanilha.texto(l, r.coluna(Campo.VIDEO));
            if (!video.isEmpty() && !ctx.videoValido().test(video)) {
                problema(aba, l.numero(), Campo.VIDEO, "VIDEO_NAO_ACEITO");
                video = "";
            }
            boolean formatoDeContagem = r.tem(Campo.SERIES_TRABALHO) || r.tem(Campo.SERIES_PREPARACAO)
                    || r.tem(Campo.TOP_SET) || r.tem(Campo.BACK_OFF);
            List<Serie> series = formatoDeContagem ? seriesPorContagem(aba, l) : seriesPorPrescricao(aba, l, obs);
            String descanso = linhaUnica(AnaliseDaPlanilha.texto(l, r.coluna(Campo.DESCANSO)));
            if (!descanso.isEmpty()) {
                obs.add("Descanso: " + descanso);
            }
            if (series.isEmpty()) {
                problema(aba, l.numero(), null, "EXERCICIO_SEM_SERIE");
            }
            String texto = String.join("\n", obs);
            if (texto.length() > EXERCICIO_OBS) {
                problema(aba, l.numero(), Campo.OBSERVACAO, "OBSERVACAO_CORTADA");
                texto = texto.substring(0, EXERCICIO_OBS).strip();
            }
            ExercicioDaBiblioteca par = exercicio(nome);
            String modalidade = par == null || ConteudoTreino.CARDIO.equals(par.modalidade()) ? null : par.modalidade();
            String videoUrl = !video.isEmpty() ? video : par == null ? null : par.videoUrl();
            return new ExercicioPlano(UUID.randomUUID(), par == null ? null : par.id(), nome, modalidade, videoUrl,
                    texto.isEmpty() ? null : texto, true, "kg", List.copyOf(series), null, null, null);
        }

        /** O formato com colunas de contagem (WS, FS, TS, BO): o {@code montarSeries} do script. */
        private List<Serie> seriesPorContagem(AbaReconhecida aba, Linha l) {
            Reconhecimento r = aba.reconhecimento();
            MontagemDeSeries.Entrada entrada = new MontagemDeSeries.Entrada(
                    MontagemDeSeries.numero(LigacaoDeAbas.celula(l, r.coluna(Campo.SERIES_TRABALHO))),
                    MontagemDeSeries.numero(LigacaoDeAbas.celula(l, r.coluna(Campo.SERIES_PREPARACAO))),
                    MontagemDeSeries.logico(LigacaoDeAbas.celula(l, r.coluna(Campo.TOP_SET))),
                    MontagemDeSeries.logico(LigacaoDeAbas.celula(l, r.coluna(Campo.BACK_OFF))),
                    MontagemDeSeries.numero(LigacaoDeAbas.celula(l, r.coluna(Campo.BACK_OFF_PERCENTUAL))),
                    LeitorDePrescricao.faixaDeRepeticoes(LigacaoDeAbas.celula(l, r.coluna(Campo.REPETICOES)), leitura.data1904()));
            MontagemDeSeries.Resultado res = MontagemDeSeries.montar(entrada, metodologia);
            res.avisos().forEach(a -> problema(aba, l.numero(), null, a));
            if (res.faixaRecuperada()) {
                faixasDeData++;
            }
            return res.series();
        }

        /**
         * Formato livre (uma coluna de prescrição, ou séries e repetições separadas): só nasce série quando a quantidade de
         * séries está escrita; todas do tipo de trabalho da metodologia, com as repetições entendidas (ou sem elas), AMRAP
         * só quando escrito e "até a falha" como RIR 0. O texto original da prescrição vai para a observação sempre que
         * algo dele não coube nas séries (carga em kg, técnica, sobra ou repetição sem quantidade de séries).
         */
        private List<Serie> seriesPorPrescricao(AbaReconhecida aba, Linha l, List<String> obs) {
            Reconhecimento r = aba.reconhecimento();
            Integer quantidade = null;
            Integer min = null;
            Integer max = null;
            boolean amrap = false;
            boolean falha = false;
            List<String> foraDasSeries = new ArrayList<>();
            for (Campo campo : List.of(Campo.SERIES, Campo.PRESCRICAO, Campo.REPETICOES, Campo.CARGA)) {
                Celula c = LigacaoDeAbas.celula(l, r.coluna(campo));
                if (ReconhecimentoDeAbas.vazia(c) || c.erro()) {
                    continue;
                }
                if (campo == Campo.SERIES && c.numero()) {
                    MontagemDeSeries.Numero n = MontagemDeSeries.numero(c);
                    boolean ok = n.valor() != null && n.valor().stripTrailingZeros().scale() <= 0
                            && n.valor().compareTo(BigDecimal.ONE) >= 0
                            && n.valor().compareTo(BigDecimal.valueOf(LeitorDePrescricao.SERIES_MAXIMAS)) <= 0;
                    if (ok && quantidade == null) {
                        quantidade = n.valor().intValueExact();
                    } else if (!ok) {
                        foraDasSeries.add(c.texto());
                    }
                    continue;
                }
                Prescricao p = LeitorDePrescricao.ler(c, leitura.data1904());
                if (p.faixaDeData()) {
                    faixasDeData++;
                }
                if (quantidade == null && p.series() != null) {
                    quantidade = p.series();
                }
                if (min == null && p.repsMin() != null) {
                    min = p.repsMin();
                    max = p.repsMax();
                }
                amrap |= p.amrap();
                falha |= p.ateAFalha();
                boolean tudoNasSeries = p.cargaKg() == null && p.tecnicas().isEmpty() && p.sobra().isEmpty();
                if (!tudoNasSeries && !c.numero()) {
                    foraDasSeries.add(linhaUnica(c.texto()));
                }
            }
            List<Serie> series = new ArrayList<>();
            TipoDeSerie trabalho = MontagemDeSeries.tipo(metodologia, "WORKING", Papel.TRABALHO, ConteudoTreino.CARGA_TRABALHO);
            if (quantidade != null && trabalho == null) {
                problema(aba, l.numero(), null, "TIPO_FORA_DA_METODOLOGIA");
            } else if (quantidade != null) {
                for (int i = 0; i < quantidade; i++) {
                    series.add(new Serie(UUID.randomUUID(), trabalho.codigo().trim(), amrap ? null : min, amrap ? null : max,
                            amrap ? Boolean.TRUE : null, Carga.de(ConteudoTreino.CARGA_TRABALHO), falha ? Esforco.deRir(0) : null,
                            null, null, null, null));
                }
            }
            if (quantidade == null && (min != null || amrap || falha)) {
                Celula c = LigacaoDeAbas.celula(l, r.coluna(Campo.REPETICOES));
                String reps = ReconhecimentoDeAbas.vazia(c) ? "" : c.numero()
                        ? (min.equals(max) ? String.valueOf(min) : min + " a " + max) : linhaUnica(c.texto());
                if (!reps.isEmpty() && !foraDasSeries.contains(reps)) {
                    foraDasSeries.add(reps);
                }
            }
            if (!foraDasSeries.isEmpty()) {
                obs.add("Prescrição na planilha: " + String.join("; ", foraDasSeries));
            }
            return series;
        }

        /** Orientações do treino: as colunas de texto da linha da rotina que não são identificação, com o título. */
        private String orientacoesDaRotina(Dono dono) {
            for (AbaReconhecida aba : abas) {
                if (aba.tipo() != TipoDeAba.ROTINAS) {
                    continue;
                }
                for (Integer n : escolhidos(aba)) {
                    Linha l = linhasPorNumero.get(aba.indice()).get(n);
                    if (dono.equals(dono(aba.indice(), l).dono())) {
                        String texto = String.join("\n\n", textosLivres(aba, l, IDENTIFICACAO));
                        return texto.isEmpty() ? null : cortar(aba, n, null, texto, ORIENTACOES_TREINO);
                    }
                }
            }
            return null;
        }

        /** "Título da coluna: texto" de cada célula de texto da linha fora das colunas {@code fora}. */
        private List<String> textosLivres(AbaReconhecida aba, Linha l, Set<Campo> fora) {
            List<String> cabecalho = cabecalho(aba);
            Set<Integer> excluidas = new HashSet<>();
            aba.reconhecimento().campos().forEach((campo, col) -> {
                if (fora.contains(campo)) {
                    excluidas.add(col);
                }
            });
            List<String> saida = new ArrayList<>();
            for (int i = 0; i < l.celulas().size(); i++) {
                Celula c = l.celulas().get(i);
                if (excluidas.contains(i) || c.numero() || c.erro() || c.texto().isBlank()
                        || "verdadeiro".equals(c.texto()) || "falso".equals(c.texto())) {
                    continue;
                }
                String titulo = i < cabecalho.size() ? cabecalho.get(i) : "";
                String texto = bloco(c.texto());
                saida.add(titulo.isEmpty() ? texto : titulo + ": " + texto);
            }
            return saida;
        }

        private List<String> cabecalho(AbaReconhecida aba) {
            int posicao = aba.reconhecimento().posicaoDoCabecalho();
            if (posicao < 0) {
                return List.of();
            }
            AbaLida lida = leitura.abas().get(aba.indice());
            return lida.linhas().get(posicao).celulas().stream().map(c -> c.numero() ? "" : linhaUnica(c.texto())).toList();
        }

        // ------------------------------------------------------------------------------------------------- dieta

        private void dietas(Map<Dono, ConteudoDieta> saida) {
            Map<Dono, List<Object[]>> itens = linhasPorDono(TipoDeAba.DIETA);
            Map<Dono, List<Object[]>> suplementos = linhasPorDono(TipoDeAba.SUPLEMENTOS);
            Set<Dono> donos = new java.util.LinkedHashSet<>(itens.keySet());
            donos.addAll(suplementos.keySet());
            for (Dono d : donos) {
                List<ConteudoDieta.Refeicao> refeicoes = refeicoes(itens.getOrDefault(d, List.of()));
                List<ConteudoDieta.Suplemento> suplementacao = new ArrayList<>();
                List<ConteudoDieta.Ergogenico> ergogenicos = new ArrayList<>();
                suplementos(suplementos.getOrDefault(d, List.of()), suplementacao, ergogenicos);
                if (refeicoes.isEmpty() && suplementacao.isEmpty() && ergogenicos.isEmpty()) {
                    continue;
                }
                List<ConteudoDieta.Orientacao> orientacoes = new ArrayList<>();
                String observacoes = cabecalhoDoPlano(d, orientacoes);
                saida.put(d, new ConteudoDieta(null, null, null, List.copyOf(refeicoes), List.copyOf(orientacoes), observacoes,
                        List.copyOf(suplementacao), ergogenicos.isEmpty() ? null : List.copyOf(ergogenicos), null));
            }
        }

        /** Orientações (colunas de texto do plano) e observações gerais (a coluna de observação) da linha do plano. */
        private String cabecalhoDoPlano(Dono dono, List<ConteudoDieta.Orientacao> orientacoes) {
            for (AbaReconhecida aba : abas) {
                if (aba.tipo() != TipoDeAba.PLANOS_DE_DIETA) {
                    continue;
                }
                for (Integer n : escolhidos(aba)) {
                    Linha l = linhasPorNumero.get(aba.indice()).get(n);
                    if (!dono.equals(dono(aba.indice(), l).dono())) {
                        continue;
                    }
                    Set<Campo> fora = EnumSet.copyOf(IDENTIFICACAO);
                    fora.add(Campo.OBSERVACAO);
                    for (String t : textosLivres(aba, l, fora)) {
                        if (orientacoes.size() == ORIENTACOES) {
                            problema(aba, n, null, "ORIENTACOES_DEMAIS");
                            break;
                        }
                        int dois = t.indexOf(": ");
                        String titulo = dois > 0 ? t.substring(0, dois) : "Orientação";
                        String texto = dois > 0 ? t.substring(dois + 2) : t;
                        orientacoes.add(new ConteudoDieta.Orientacao(cortar(aba, n, null, titulo, ORIENTACAO_TITULO),
                                cortar(aba, n, null, texto, ORIENTACAO_TEXTO)));
                    }
                    String obs = bloco(AnaliseDaPlanilha.texto(l, aba.reconhecimento().coluna(Campo.OBSERVACAO)));
                    return obs.isEmpty() ? null : cortar(aba, n, Campo.OBSERVACAO, obs, OBSERVACOES_DIETA);
                }
            }
            return null;
        }

        private List<ConteudoDieta.Refeicao> refeicoes(List<Object[]> linhas) {
            Map<String, List<Object[]>> porRefeicao = new LinkedHashMap<>();
            Map<String, Integer> numeroDaRefeicao = new HashMap<>();
            for (Object[] par : linhas) {
                AbaReconhecida aba = (AbaReconhecida) par[0];
                Linha l = (Linha) par[1];
                Reconhecimento r = aba.reconhecimento();
                Celula ref = LigacaoDeAbas.celula(l, r.coluna(Campo.REFEICAO));
                String chave;
                if (!r.tem(Campo.REFEICAO)) {
                    chave = linhaUnica(AnaliseDaPlanilha.texto(l, r.coluna(Campo.TITULO))).toLowerCase(Locale.ROOT);
                } else if (ReconhecimentoDeAbas.vazia(ref)) {
                    problema(aba, l.numero(), Campo.REFEICAO, "ITEM_SEM_REFEICAO");
                    continue;
                } else {
                    MontagemDeSeries.Numero n = MontagemDeSeries.numero(ref);
                    boolean inteiro = n.valor() != null && n.valor().stripTrailingZeros().scale() <= 0;
                    chave = inteiro ? "#" + n.valor().intValue() : linhaUnica(ref.texto()).toLowerCase(Locale.ROOT);
                    if (inteiro) {
                        numeroDaRefeicao.put(chave, n.valor().intValue());
                    }
                }
                porRefeicao.computeIfAbsent(chave, k -> new ArrayList<>()).add(par);
            }
            List<String> chaves = new ArrayList<>(porRefeicao.keySet());
            chaves.sort(Comparator.comparing((String k) -> numeroDaRefeicao.getOrDefault(k, Integer.MAX_VALUE)));
            List<ConteudoDieta.Refeicao> refeicoes = new ArrayList<>();
            for (String chave : chaves) {
                List<Object[]> daRefeicao = porRefeicao.get(chave);
                AbaReconhecida aba = (AbaReconhecida) daRefeicao.getFirst()[0];
                Linha primeira = (Linha) daRefeicao.getFirst()[1];
                if (refeicoes.size() == REFEICOES) {
                    problema(aba, primeira.numero(), null, "REFEICOES_DEMAIS");
                    break;
                }
                ConteudoDieta.Refeicao refeicao = refeicao(chave, numeroDaRefeicao.get(chave), daRefeicao);
                if (refeicao != null) {
                    refeicoes.add(refeicao);
                }
            }
            return refeicoes;
        }

        private ConteudoDieta.Refeicao refeicao(String chave, Integer numero, List<Object[]> linhas) {
            AbaReconhecida aba = (AbaReconhecida) linhas.getFirst()[0];
            Linha primeira = (Linha) linhas.getFirst()[1];
            Reconhecimento r = aba.reconhecimento();
            Set<String> rotulos = new HashSet<>();
            for (Object[] par : linhas) {
                Reconhecimento rr = ((AbaReconhecida) par[0]).reconhecimento();
                String rot = linhaUnica(AnaliseDaPlanilha.texto((Linha) par[1], rr.coluna(Campo.OPCAO)));
                if (!rot.isEmpty()) {
                    rotulos.add(rot);
                }
            }
            Map<String, List<Object[]>> porOpcao = new java.util.TreeMap<>();
            List<String> dicas = new ArrayList<>();
            for (Object[] par : linhas) {
                AbaReconhecida a = (AbaReconhecida) par[0];
                Linha l = (Linha) par[1];
                Reconhecimento rr = a.reconhecimento();
                String alimento = linhaUnica(AnaliseDaPlanilha.texto(l, rr.coluna(Campo.ALIMENTO)));
                if (alimento.isEmpty()) {
                    problema(a, l.numero(), Campo.ALIMENTO, "ITEM_SEM_ALIMENTO");
                    continue;
                }
                String rotulo = linhaUnica(AnaliseDaPlanilha.texto(l, rr.coluna(Campo.OPCAO)));
                if (rotulo.isEmpty()) {
                    if (!rotulos.isEmpty()) {
                        problema(a, l.numero(), Campo.OPCAO, "ITEM_SEM_OPCAO");
                        continue;
                    }
                    rotulo = "A";
                }
                rotulo = cortar(a, l.numero(), Campo.OPCAO, rotulo, ROTULO);
                porOpcao.computeIfAbsent(rotulo, k -> new ArrayList<>()).add(par);
                String dica = linhaUnica(AnaliseDaPlanilha.texto(l, rr.coluna(Campo.OBSERVACAO)));
                if (!dica.isEmpty()) {
                    dicas.add(cortar(a, l.numero(), Campo.ALIMENTO, alimento, ITEM_NOME) + ": " + dica);
                }
            }
            if (porOpcao.isEmpty()) {
                return null;
            }
            List<ConteudoDieta.Opcao> opcoes = new ArrayList<>();
            for (Map.Entry<String, List<Object[]>> e : porOpcao.entrySet()) {
                if (opcoes.size() == OPCOES) {
                    problema(aba, primeira.numero(), Campo.OPCAO, "OPCOES_DEMAIS");
                    break;
                }
                List<Object[]> ordenados = new ArrayList<>(e.getValue());
                ordenados.sort(Comparator.comparing((Object[] p) -> {
                    Reconhecimento rr = ((AbaReconhecida) p[0]).reconhecimento();
                    MontagemDeSeries.Numero n = MontagemDeSeries.numero(LigacaoDeAbas.celula((Linha) p[1], rr.coluna(Campo.ORDEM)));
                    return n.valor() == null ? BigDecimal.valueOf(Long.MAX_VALUE) : n.valor();
                }));
                List<ConteudoDieta.Item> itens = new ArrayList<>();
                for (Object[] par : ordenados) {
                    if (itens.size() == ITENS) {
                        problema((AbaReconhecida) par[0], ((Linha) par[1]).numero(), null, "ITENS_DEMAIS_NA_OPCAO");
                        break;
                    }
                    itens.add(item((AbaReconhecida) par[0], (Linha) par[1]));
                }
                opcoes.add(new ConteudoDieta.Opcao(UUID.randomUUID(), e.getKey(), List.copyOf(itens)));
            }
            String titulo = linhaUnica(AnaliseDaPlanilha.texto(primeira, r.coluna(Campo.TITULO)));
            if (titulo.isEmpty() && numero == null && !chave.isEmpty()) {
                titulo = linhaUnica(AnaliseDaPlanilha.texto(primeira, r.coluna(Campo.REFEICAO)));
            }
            if (titulo.isEmpty()) {
                titulo = numero != null ? "Refeição " + numero : "Refeição";
                problema(aba, primeira.numero(), Campo.TITULO, "REFEICAO_SEM_TITULO");
            }
            String obs = String.join("\n", dicas);
            return new ConteudoDieta.Refeicao(UUID.randomUUID(), cortar(aba, primeira.numero(), Campo.TITULO, titulo, REFEICAO_NOME),
                    null, obs.isEmpty() ? null : cortar(aba, primeira.numero(), Campo.OBSERVACAO, obs, REFEICAO_OBS),
                    List.copyOf(opcoes));
        }

        private ConteudoDieta.Item item(AbaReconhecida aba, Linha l) {
            Reconhecimento r = aba.reconhecimento();
            String nome = cortar(aba, l.numero(), Campo.ALIMENTO, linhaUnica(AnaliseDaPlanilha.texto(l, r.coluna(Campo.ALIMENTO))), ITEM_NOME);
            MontagemDeSeries.Numero q = MontagemDeSeries.numero(LigacaoDeAbas.celula(l, r.coluna(Campo.QUANTIDADE)));
            BigDecimal quantidade = q.valor() != null && q.valor().signum() > 0 ? q.valor() : null;
            if (quantidade == null) {
                problema(aba, l.numero(), Campo.QUANTIDADE, "QUANTIDADE_AUSENTE_OU_INVALIDA");
            }
            String modo = Normalizacao.chaveDoNome(AnaliseDaPlanilha.texto(l, r.coluna(Campo.UNIDADE)));
            String unidade = Set.of("g", "ml", "un").contains(modo) ? modo : "g";
            if (!modo.isEmpty() && !unidade.equals(modo)) {
                problema(aba, l.numero(), Campo.UNIDADE, "UNIDADE_DESCONHECIDA");
            }
            BigDecimal kcal = nutriente(aba, l, Campo.KCAL);
            if (kcal == null) {
                problema(aba, l.numero(), Campo.KCAL, "ITEM_SEM_KCAL");
            }
            AlimentoDaBiblioteca par = alimento(nome);
            return new ConteudoDieta.Item(UUID.randomUUID(), par == null ? null : par.id(), nome, quantidade, unidade, kcal,
                    nutriente(aba, l, Campo.PROTEINA), nutriente(aba, l, Campo.CARBOIDRATO), nutriente(aba, l, Campo.GORDURA),
                    par == null);
        }

        /** Valor nutricional como está na planilha (0 a 99999); ausente fica nulo, nunca zero. */
        private BigDecimal nutriente(AbaReconhecida aba, Linha l, Campo campo) {
            int col = aba.reconhecimento().coluna(campo);
            MontagemDeSeries.Numero n = MontagemDeSeries.numero(LigacaoDeAbas.celula(l, col));
            if (!n.presente()) {
                return null;
            }
            if (n.valor() == null || n.valor().signum() < 0 || n.valor().compareTo(NUTRIENTE_MAXIMO) > 0) {
                problema(aba, l.numero(), campo, "VALOR_NUTRICIONAL_INVALIDO");
                return null;
            }
            return n.valor();
        }

        private void suplementos(List<Object[]> linhas, List<ConteudoDieta.Suplemento> suplementacao,
                                 List<ConteudoDieta.Ergogenico> ergogenicos) {
            for (Object[] par : linhas) {
                AbaReconhecida aba = (AbaReconhecida) par[0];
                Linha l = (Linha) par[1];
                Reconhecimento r = aba.reconhecimento();
                String nome = linhaUnica(AnaliseDaPlanilha.texto(l, r.coluna(Campo.SUPLEMENTO)));
                if (nome.isEmpty()) {
                    problema(aba, l.numero(), Campo.SUPLEMENTO, "SUPLEMENTO_SEM_NOME");
                    continue;
                }
                String dose = textoOuNulo(aba, l, Campo.DOSE, CAMPO_SUPLEMENTO);
                String horario = textoOuNulo(aba, l, Campo.HORARIO, CAMPO_SUPLEMENTO);
                String obs = textoOuNulo(aba, l, Campo.OBSERVACAO, OBS_SUPLEMENTO);
                String cortado = cortar(aba, l.numero(), Campo.SUPLEMENTO, nome, CAMPO_SUPLEMENTO);
                if ("SUPLEMENTO".equals(destino(nome))) {
                    if (suplementacao.size() == SUPLEMENTOS) {
                        problema(aba, l.numero(), Campo.SUPLEMENTO, "SUPLEMENTOS_DEMAIS");
                        continue;
                    }
                    suplementacao.add(new ConteudoDieta.Suplemento(UUID.randomUUID(), cortado, dose, horario, obs, null));
                } else if (!ctx.permissoes().ergogenicos()) {
                    sensiveisPulados++;
                } else if (ergogenicos.size() == SUPLEMENTOS) {
                    problema(aba, l.numero(), Campo.SUPLEMENTO, "MEDICACAO_DEMAIS");
                } else {
                    ergogenicos.add(new ConteudoDieta.Ergogenico(UUID.randomUUID(), cortado, null, null, dose, horario, obs, null));
                }
            }
        }

        /**
         * Para onde vai um nome da aba de suplementos: a resposta do treinador; senão o que a biblioteca de ergogênicos
         * reconhece (por palavras contidas, a de ergogênicos sempre na frente), depois a de suplementos; o que nenhuma
         * reconhece vai para a lista sensível e fica pendente.
         */
        private String destino(String nome) {
            String k = nomeDeSuplemento(nome);
            String resposta = respostasDeSuplemento.get(k);
            if (resposta != null) {
                return resposta;
            }
            if (ctx.ergogenicos().stream().anyMatch(r -> parecido(k, nomeDeSuplemento(r)))) {
                return "SENSIVEL";
            }
            if (ctx.suplementos().stream().anyMatch(r -> parecido(k, nomeDeSuplemento(r)))) {
                return "SUPLEMENTO";
            }
            suplementosPendentes.add(k);
            return "SENSIVEL";
        }

        private String textoOuNulo(AbaReconhecida aba, Linha l, Campo campo, int maximo) {
            String t = linhaUnica(AnaliseDaPlanilha.texto(l, aba.reconhecimento().coluna(campo)));
            return t.isEmpty() ? null : cortar(aba, l.numero(), campo, t, maximo);
        }

        private String cortar(AbaReconhecida aba, int linha, Campo campo, String valor, int maximo) {
            if (valor.length() <= maximo) {
                return valor;
            }
            problema(aba, linha, campo, "TEXTO_CORTADO");
            return valor.substring(0, maximo).strip();
        }
    }

    /** Uma lista de palavras dentro da outra (em qualquer posição), como o {@code parecido} do script. */
    static boolean parecido(String a, String b) {
        List<String> pa = a.isEmpty() ? List.of() : List.of(a.split(" "));
        List<String> pb = b.isEmpty() ? List.of() : List.of(b.split(" "));
        return (!pa.isEmpty() && pb.containsAll(pa)) || (!pb.isEmpty() && pa.containsAll(pb));
    }

    private static String semOrdem(String nome) {
        String k = CasamentoDeNomes.chave(nome);
        if (k.isEmpty()) {
            return k;
        }
        String[] p = k.split(" ");
        java.util.Arrays.sort(p);
        return String.join(" ", p);
    }

    private static String linhaUnica(String t) {
        return t == null ? "" : t.replaceAll("\\s+", " ").strip();
    }

    private static String bloco(String t) {
        if (t == null) {
            return "";
        }
        return t.replaceAll("\\r\\n?", "\n").replaceAll("[ \\t]+", " ").replaceAll(" ?\\n ?", "\n")
                .replaceAll("\\n{3,}", "\n\n").strip();
    }
}
