package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.biblioteca.Alimento;
import br.com.treinos.api.biblioteca.AlimentoRepository;
import br.com.treinos.api.biblioteca.Exercicio;
import br.com.treinos.api.biblioteca.ExercicioRepository;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.importacao.assistida.BlocoTexto;
import br.com.treinos.api.importacao.assistida.PistaDeIdentidade;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.web.Buscas;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Interpretador determinístico por regras e heurísticas (fallback offline sem custo e sem API key).
 * Reconhece divisões de treino (A, B, C, dias da semana), prescrições de séries (3x10, 4x8-12),
 * refeições (Café, Almoço, Jantar) e alimentos com porções (g, ml, un).
 */
@Component
public class InterpretadorPorRegras implements InterpretadorIa {

    private static final Pattern DIVISAO_REGEX = Pattern.compile(
            "(?im)^(?:treino\\s+([a-z0-9]+)|([a-z0-9]+)\\s*[-–—]\\s*(?:superior|inferior|push|pull|legs|costas|peito|pernas|ombros|bracos)|(segunda|ter[çc]a|quarta|quinta|sexta|s[aá]bado|domingo))");

    private static final Pattern SERIE_REGEX = Pattern.compile(
            "([0-9]{1,2})\\s*[xX*]\\s*([0-9]{1,2}(?:\\s*[-–—aA]\\s*[0-9]{1,2})?)");

    private static final Pattern REFEICAO_REGEX = Pattern.compile(
            "(?im)^(?:refei[çc][aã]o\\s*([0-9]+)|caf[eé]\\s*(?:da\\s*manh[aã])?|almo[çc]o|jantar|lanche(?:\\s*[0-9]+)?|ceia|pr[eé][- ]treino|p[oó]s[- ]treino)");

    private static final Pattern ALIMENTO_REGEX = Pattern.compile(
            "([0-9]+(?:[.,][0-9]+)?)\\s*(g|gr|gramas|kg|ml|l|un|unidades?|colheres?|fatias?|scoop|doses?)\\s+(?:de\\s+)?([A-Za-zÀ-ÖØ-öø-ÿ0-9\\s()\\-]+)");

    private static final Pattern PESO_REGEX = Pattern.compile(
            "(?i)(?:peso|balanca|massa)\\s*[:=-]?\\s*([0-9]{2,3}(?:[.,][0-9]+)?)\\s*(?:kg|quilos)?");

    // dd/mm/aaaa ou aaaa-mm-dd
    private static final Pattern DATA_REGEX = Pattern.compile(
            "\\b(?:(\\d{1,2})/(\\d{1,2})/(\\d{4})|(\\d{4})-(\\d{2})-(\\d{2}))\\b");

    // Títulos de coluna de tabela de PDF: sozinhos (ou só eles na linha) não são exercício nem alimento.
    private static final java.util.Set<String> CABECALHOS = java.util.Set.of(
            "exercicio", "exercicios", "series", "serie", "reps", "repeticoes", "descanso", "carga", "observacao",
            "observacoes", "obs", "alimento", "alimentos", "quantidade", "refeicao", "refeicoes", "tecnica",
            "intervalo", "tempo", "ordem", "grupo", "musculo", "dia", "horario");

    // Dose de substância (protocolo de medicação): fora do treino e da dieta; a importação de medicação é de outra parte.
    private static final Pattern DOSE_REGEX = Pattern.compile(
            "(?i)\\b\\d+(?:[.,]\\d+)?\\s*(?:mg|mcg|[uµ]g|ui|iu)\\b|/\\s*sem\\b|\\b(?:ampolas?|comprimidos?|c[aá]psulas?)\\b");

    private static final Pattern FRASE_REGEX = Pattern.compile("[.!?]\\s+\\p{L}");

    private static final int NOME_MAXIMO_DE_SESSAO = 60;

    private final ExercicioRepository exercicios;
    private final AlimentoRepository alimentos;

    @Autowired
    public InterpretadorPorRegras(ExercicioRepository exercicios, AlimentoRepository alimentos) {
        this.exercicios = exercicios;
        this.alimentos = alimentos;
    }

    public InterpretadorPorRegras() {
        this(null, null);
    }

    /** Nomes dos exercícios ativos da biblioteca (para a IA preferir o nome que já existe). Vazio sem repositório. */
    public List<String> nomesDeExercicios() {
        return exercicios == null ? List.of() : exercicios.todosAtivos().stream().map(Exercicio::getNome).toList();
    }

    /** Nomes dos alimentos ativos da biblioteca (para a IA preferir o nome que já existe). Vazio sem repositório. */
    public List<String> nomesDeAlimentos() {
        return alimentos == null ? List.of() : alimentos.buscarAtivos("%").stream().map(Alimento::getNome).toList();
    }

    @Override
    public String nomeProvedor() {
        return "regras";
    }

    @Override
    public ResultadoInterpretacao interpretar(ContextoIa contexto) {
        return interpretar(contexto, contexto.blocos());
    }

    /** Só estes blocos do arquivo: a parte de um documento grande que a IA não conseguiu ler. */
    public ResultadoInterpretacao interpretar(ContextoIa contexto, List<BlocoTexto> blocos) {
        String textoCompleto = extrairTextoCompleto(blocos);
        // Só o cabeçalho do documento dá nome; sem ele fica nulo e o substituto para a tela é do serviço.
        String doCabecalho = PistaDeIdentidade.extrairDoCabecalho(textoCompleto);
        String nomeAluno = doCabecalho.isEmpty() ? null : doCabecalho;
        ResultadoInterpretacao.OrigemDoNome origem = nomeAluno != null ? ResultadoInterpretacao.OrigemDoNome.CONTEUDO
                : ResultadoInterpretacao.OrigemDoNome.semNomeNoConteudo(contexto.nomeArquivo(), contexto.formato());

        List<ResultadoInterpretacao.PropostaPeso> pesos = extrairPesos(textoCompleto);
        ConteudoTreino treino = extrairTreino(blocos, contexto);
        ConteudoDieta dieta = extrairDieta(blocos);

        List<ResultadoInterpretacao.PropostaDuvida> duvidas = new ArrayList<>();
        // Gera dúvidas para termos com abreviações não resolvidas
        verificarDuvidasExercicios(treino, contexto, duvidas);
        verificarDuvidasAlimentos(dieta, contexto, duvidas);

        ResultadoInterpretacao.PropostaGrupo grupo = new ResultadoInterpretacao.PropostaGrupo(
                contexto.nomeArquivo(),
                nomeAluno,
                null,
                null,
                null,
                null,
                pesos,
                treino,
                dieta,
                List.of(),
                origem
        );

        return new ResultadoInterpretacao(List.of(grupo), List.copyOf(duvidas));
    }

    /**
     * Mesmo resultado com as dúvidas calculadas aqui, contra a biblioteca, para cada grupo: usado no resultado da IA,
     * cujas dúvidas não traziam as ocorrências que a tela corrige.
     */
    public ResultadoInterpretacao comDuvidasDaBiblioteca(ResultadoInterpretacao resultado, ContextoIa contexto) {
        List<ResultadoInterpretacao.PropostaDuvida> duvidas = new ArrayList<>();
        for (ResultadoInterpretacao.PropostaGrupo g : resultado.grupos()) {
            verificarDuvidasExercicios(g.treino(), contexto, duvidas);
            verificarDuvidasAlimentos(g.dieta(), contexto, duvidas);
        }
        return new ResultadoInterpretacao(resultado.grupos(), List.copyOf(duvidas), resultado.uso());
    }

    private String extrairTextoCompleto(List<BlocoTexto> blocos) {
        StringBuilder sb = new StringBuilder();
        if (blocos != null) {
            for (BlocoTexto b : blocos) {
                sb.append(b.conteudo()).append('\n');
            }
        }
        return sb.toString();
    }

    private List<ResultadoInterpretacao.PropostaPeso> extrairPesos(String texto) {
        List<ResultadoInterpretacao.PropostaPeso> lista = new ArrayList<>();
        Matcher m = PESO_REGEX.matcher(texto);
        while (m.find()) {
            try {
                BigDecimal kg = new BigDecimal(m.group(1).replace(',', '.'));
                // Data só se vier escrita na mesma linha; sem ela o peso segue sem data e o service não o grava.
                lista.add(new ResultadoInterpretacao.PropostaPeso(dataDaLinha(texto, m.start()), kg, null));
            } catch (NumberFormatException ignored) {
                // Formato de número inválido ignorado
            }
        }
        return List.copyOf(lista);
    }

    private static LocalDate dataDaLinha(String texto, int posicao) {
        int ini = texto.lastIndexOf('\n', posicao) + 1;
        int fim = texto.indexOf('\n', posicao);
        Matcher d = DATA_REGEX.matcher(texto.substring(ini, fim < 0 ? texto.length() : fim));
        if (!d.find()) {
            return null;
        }
        try {
            if (d.group(1) != null) {
                return LocalDate.of(Integer.parseInt(d.group(3)), Integer.parseInt(d.group(2)), Integer.parseInt(d.group(1)));
            }
            return LocalDate.of(Integer.parseInt(d.group(4)), Integer.parseInt(d.group(5)), Integer.parseInt(d.group(6)));
        } catch (java.time.DateTimeException e) {
            return null;
        }
    }

    private ConteudoTreino extrairTreino(List<BlocoTexto> blocos, ContextoIa contexto) {
        if (blocos == null || blocos.isEmpty()) {
            return null;
        }

        List<ConteudoTreino.Sessao> sessoes = new ArrayList<>();
        ConteudoTreino.Sessao sessaoAtual = null;
        List<ConteudoTreino.ExercicioPlano> exerciciosDaSessao = new ArrayList<>();

        for (BlocoTexto b : blocos) {
            String[] linhas = b.conteudo().split("\\R");
            for (String l : linhas) {
                String limpa = l.strip();
                if (limpa.isBlank() || DOSE_REGEX.matcher(limpa).find()) continue;

                Matcher mDiv = DIVISAO_REGEX.matcher(limpa);
                if (mDiv.find() && pareceNomeDeSessao(limpa)) {
                    if (sessaoAtual != null && !exerciciosDaSessao.isEmpty()) {
                        sessoes.add(new ConteudoTreino.Sessao(UUID.randomUUID(), sessaoAtual.nome(), sessaoAtual.diaSemana(),
                                null, null, sessaoAtual.observacao(), null, List.copyOf(exerciciosDaSessao)));
                        exerciciosDaSessao.clear();
                    }
                    sessaoAtual = new ConteudoTreino.Sessao(UUID.randomUUID(), limpa, deduzirDiaSemana(limpa), null, null, null, null, List.of());
                    continue;
                }

                Matcher mSerie = SERIE_REGEX.matcher(limpa);
                if (mSerie.find()) {
                    if (sessaoAtual == null) {
                        sessaoAtual = new ConteudoTreino.Sessao(UUID.randomUUID(), "Treino Principal", null, null, null, null, null, List.of());
                    }
                    int qtdSeries = Integer.parseInt(mSerie.group(1));
                    String repsStr = mSerie.group(2);
                    String nomeExercicio = extrairNomeExercicio(limpa, mSerie.start());
                    if (qtdSeries == 0 || ehCabecalho(nomeExercicio) || ehFrase(nomeExercicio)) continue;

                    // Aplica abreviação se houver
                    String normalizado = nomeExercicio.toLowerCase(Locale.ROOT);
                    if (contexto.apelidosConhecidos().containsKey(normalizado)) {
                        nomeExercicio = contexto.apelidosConhecidos().get(normalizado);
                    }

                    List<ConteudoTreino.Serie> series = new ArrayList<>();
                    int repMin = 8;
                    int repMax = 12;
                    try {
                        if (repsStr.contains("-")) {
                            String[] partes = repsStr.split("-");
                            repMin = Integer.parseInt(partes[0].strip());
                            repMax = Integer.parseInt(partes[1].strip());
                        } else {
                            repMin = Integer.parseInt(repsStr.strip());
                            repMax = repMin;
                        }
                    } catch (Exception ignored) {
                        // Formato de repetição inválido ignorado
                    }

                    for (int s = 1; s <= Math.min(qtdSeries, 10); s++) {
                        series.add(new ConteudoTreino.Serie(UUID.randomUUID(), "WS", repMin, repMax, null, null, null, 60, null, null, null));
                    }

                    exerciciosDaSessao.add(new ConteudoTreino.ExercicioPlano(UUID.randomUUID(), null, nomeExercicio,
                            "MAQUINA", null, null, null, null, List.copyOf(series)));
                } else if (!exerciciosDaSessao.isEmpty() && ehContinuacaoDeNome(limpa, exerciciosDaSessao.getLast().nome())) {
                    // Nome quebrado em duas linhas pela tabela do PDF: junta em vez de criar outro exercício.
                    ConteudoTreino.ExercicioPlano ex = exerciciosDaSessao.removeLast();
                    exerciciosDaSessao.add(new ConteudoTreino.ExercicioPlano(ex.uid(), ex.exercicioId(), ex.nome() + " " + limpa,
                            ex.modalidade(), ex.videoUrl(), ex.observacao(), ex.progressao(), ex.unidade(), ex.series()));
                }
            }
        }

        if (sessaoAtual != null && !exerciciosDaSessao.isEmpty()) {
            sessoes.add(new ConteudoTreino.Sessao(UUID.randomUUID(), sessaoAtual.nome(), sessaoAtual.diaSemana(),
                    null, null, sessaoAtual.observacao(), null, List.copyOf(exerciciosDaSessao)));
        }

        if (sessoes.isEmpty()) {
            return null;
        }

        return new ConteudoTreino("Treino Importado", "Plano importado via reconhecimento de documento",
                List.copyOf(sessoes));
    }

    private static String chaveSemAcento(String texto) {
        return Buscas.semAcento(texto).toLowerCase(Locale.ROOT).strip();
    }

    private static boolean ehCabecalho(String nome) {
        String[] palavras = chaveSemAcento(nome).replaceAll("[^a-z0-9\\s]", " ").strip().split("\\s+");
        return java.util.Arrays.stream(palavras).allMatch(p -> p.isEmpty() || CABECALHOS.contains(p));
    }

    private static boolean ehFrase(String nome) {
        return nome.length() > 80 || FRASE_REGEX.matcher(nome).find();
    }

    private static boolean pareceNomeDeSessao(String linha) {
        return linha.length() <= NOME_MAXIMO_DE_SESSAO && !FRASE_REGEX.matcher(linha).find();
    }

    private static boolean ehContinuacaoDeNome(String linha, String nomeAnterior) {
        if (nomeAnterior == null || linha.length() > 40 || linha.matches(".*[0-9:].*") || ehCabecalho(linha)) {
            return false;
        }
        if (nomeAnterior.length() + 1 + linha.length() > 120 || DIVISAO_REGEX.matcher(linha).find()) {
            return false;
        }
        String[] palavras = chaveSemAcento(nomeAnterior).split("\\s+");
        String ultima = palavras[palavras.length - 1];
        boolean terminaEmLigacao = java.util.Set.of("no", "na", "nos", "nas", "com", "de", "do", "da", "e", "em", "ou").contains(ultima);
        boolean parentesAberto = nomeAnterior.chars().filter(c -> c == '(').count() > nomeAnterior.chars().filter(c -> c == ')').count();
        return terminaEmLigacao || parentesAberto;
    }

    private String extrairNomeExercicio(String linha, int posSerie) {
        String antes = linha.substring(0, posSerie).strip();
        if (antes.endsWith("-") || antes.endsWith(":") || antes.endsWith("–") || antes.endsWith("—")) {
            antes = antes.substring(0, antes.length() - 1).strip();
        }
        // Remove número de ordem no início "1. ", "1 - "
        antes = antes.replaceAll("^[0-9]+[.\\-–—:]*\\s*", "");
        return antes.isBlank() ? "Exercício" : antes;
    }

    private Integer deduzirDiaSemana(String texto) {
        String min = texto.toLowerCase(Locale.ROOT);
        if (min.contains("segunda")) return 1;
        if (min.contains("terca") || min.contains("terça")) return 2;
        if (min.contains("quarta")) return 3;
        if (min.contains("quinta")) return 4;
        if (min.contains("sexta")) return 5;
        if (min.contains("sabado") || min.contains("sábado")) return 6;
        if (min.contains("domingo")) return 7;
        return null;
    }

    private ConteudoDieta extrairDieta(List<BlocoTexto> blocos) {
        if (blocos == null || blocos.isEmpty()) {
            return null;
        }

        List<ConteudoDieta.Refeicao> refeicoes = new ArrayList<>();
        ConteudoDieta.Refeicao refeicaoAtual = null;
        List<ConteudoDieta.Item> itensDaRefeicao = new ArrayList<>();

        for (BlocoTexto b : blocos) {
            String[] linhas = b.conteudo().split("\\R");
            for (String l : linhas) {
                String limpa = l.strip();
                if (limpa.isBlank() || DOSE_REGEX.matcher(limpa).find()) continue;

                Matcher mRef = REFEICAO_REGEX.matcher(limpa);
                if (mRef.find()) {
                    if (refeicaoAtual != null && !itensDaRefeicao.isEmpty()) {
                        ConteudoDieta.Opcao opcao = new ConteudoDieta.Opcao(UUID.randomUUID(), "Opção Principal", List.copyOf(itensDaRefeicao));
                        refeicoes.add(new ConteudoDieta.Refeicao(UUID.randomUUID(), refeicaoAtual.nome(), refeicaoAtual.horario(),
                                refeicaoAtual.observacao(), List.of(opcao)));
                        itensDaRefeicao.clear();
                    }
                    refeicaoAtual = new ConteudoDieta.Refeicao(UUID.randomUUID(), limpa, null, null, List.of());
                    continue;
                }

                Matcher mAli = ALIMENTO_REGEX.matcher(limpa);
                if (mAli.find()) {
                    if (refeicaoAtual == null) {
                        refeicaoAtual = new ConteudoDieta.Refeicao(UUID.randomUUID(), "Refeição 1", null, null, List.of());
                    }
                    String qtdStr = mAli.group(1).replace(',', '.');
                    String unid = mAli.group(2).toLowerCase(Locale.ROOT);
                    String nomeAlimento = mAli.group(3).strip();
                    // Só número, sinal ou pontuação (ou título de coluna) não é alimento.
                    if (!nomeAlimento.matches(".*\\p{L}.*") || ehCabecalho(nomeAlimento)) continue;

                    BigDecimal qtd = new BigDecimal(qtdStr);
                    itensDaRefeicao.add(new ConteudoDieta.Item(UUID.randomUUID(), null, nomeAlimento, qtd, unid,
                            null, null, null, null, true));
                }
            }
        }

        if (refeicaoAtual != null && !itensDaRefeicao.isEmpty()) {
            ConteudoDieta.Opcao opcao = new ConteudoDieta.Opcao(UUID.randomUUID(), "Opção Principal", List.copyOf(itensDaRefeicao));
            refeicoes.add(new ConteudoDieta.Refeicao(UUID.randomUUID(), refeicaoAtual.nome(), refeicaoAtual.horario(),
                    refeicaoAtual.observacao(), List.of(opcao)));
        }

        if (refeicoes.isEmpty()) {
            return null;
        }

        return new ConteudoDieta("Dieta Importada", null, "IA",
                List.copyOf(refeicoes), List.of(), "Plano nutricional importado via reconhecimento de documento", List.of());
    }

    private void verificarDuvidasExercicios(ConteudoTreino treino, ContextoIa contexto,
                                           List<ResultadoInterpretacao.PropostaDuvida> duvidas) {
        if (treino == null || treino.sessoes() == null) return;
        List<Exercicio> ativos = exercicios != null ? exercicios.todosAtivos() : null;
        Map<String, List<String>> ocorrenciasPorTermo = new LinkedHashMap<>();
        Map<String, String> originalPorChave = new LinkedHashMap<>();
        Map<String, String> trechoPorChave = new LinkedHashMap<>();

        for (ConteudoTreino.Sessao s : treino.sessoes()) {
            if (s.exercicios() == null) continue;
            for (ConteudoTreino.ExercicioPlano ex : s.exercicios()) {
                String nome = ex.nome();
                if (nome == null || nome.isBlank() || ex.uid() == null) continue;
                String chave = Buscas.semAcento(nome);
                boolean ambiguo = nome.length() < 4 || nome.contains("/");
                boolean semMatchExato = ativos != null && ativos.stream().noneMatch(e -> Buscas.semAcento(e.getNome()).equals(chave));
                if (ambiguo || semMatchExato) {
                    ocorrenciasPorTermo.computeIfAbsent(chave, k -> new ArrayList<>()).add(ex.uid().toString());
                    originalPorChave.putIfAbsent(chave, nome);
                    trechoPorChave.putIfAbsent(chave, "Na sessão '" + s.nome() + "': " + nome);
                }
            }
        }

        for (Map.Entry<String, List<String>> entry : ocorrenciasPorTermo.entrySet()) {
            String chave = entry.getKey();
            List<ResultadoInterpretacao.PropostaSugestao> sugestoes = ativos == null
                    ? List.of()
                    : sugerirExercicios(chave, ativos);
            duvidas.add(new ResultadoInterpretacao.PropostaDuvida(
                    "EXERCICIO_NAO_RECONHECIDO",
                    originalPorChave.get(chave),
                    trechoPorChave.get(chave),
                    contexto.nomeArquivo(),
                    sugestoes,
                    List.copyOf(entry.getValue())
            ));
        }
    }

    private void verificarDuvidasAlimentos(ConteudoDieta dieta, ContextoIa contexto,
                                          List<ResultadoInterpretacao.PropostaDuvida> duvidas) {
        if (dieta == null || dieta.refeicoes() == null) return;
        List<Alimento> ativos = alimentos != null ? alimentos.buscarAtivos("%") : null;
        Map<String, List<String>> ocorrenciasPorTermo = new LinkedHashMap<>();
        Map<String, String> originalPorChave = new LinkedHashMap<>();
        Map<String, String> trechoPorChave = new LinkedHashMap<>();

        for (ConteudoDieta.Refeicao r : dieta.refeicoes()) {
            if (r.opcoes() == null) continue;
            for (ConteudoDieta.Opcao op : r.opcoes()) {
                if (op.itens() == null) continue;
                for (ConteudoDieta.Item item : op.itens()) {
                    String nome = item.nome();
                    if (nome == null || nome.isBlank() || item.uid() == null) continue;
                    String chave = Buscas.semAcento(nome);
                    boolean ambiguo = nome.length() < 3 || nome.equalsIgnoreCase("whey");
                    boolean semMatchExato = ativos != null && ativos.stream().noneMatch(a -> Buscas.semAcento(a.getNome()).equals(chave));
                    if (ambiguo || semMatchExato) {
                        ocorrenciasPorTermo.computeIfAbsent(chave, k -> new ArrayList<>()).add(item.uid().toString());
                        originalPorChave.putIfAbsent(chave, nome);
                        trechoPorChave.putIfAbsent(chave, "Na refeição '" + r.nome() + "': " + item.quantidade() + item.unidade() + " " + nome);
                    }
                }
            }
        }

        for (Map.Entry<String, List<String>> entry : ocorrenciasPorTermo.entrySet()) {
            String chave = entry.getKey();
            List<ResultadoInterpretacao.PropostaSugestao> sugestoes = ativos == null
                    ? List.of()
                    : sugerirAlimentos(chave, ativos);
            duvidas.add(new ResultadoInterpretacao.PropostaDuvida(
                    "ALIMENTO_NAO_RECONHECIDO",
                    originalPorChave.get(chave),
                    trechoPorChave.get(chave),
                    contexto.nomeArquivo(),
                    sugestoes,
                    List.copyOf(entry.getValue())
            ));
        }
    }

    private static List<ResultadoInterpretacao.PropostaSugestao> sugerirExercicios(String chave, List<Exercicio> ativos) {
        String[] tokens = tokens(chave);
        return ativos.stream()
                .filter(e -> casaComTokens(Buscas.semAcento(e.getNome()), chave, tokens))
                .limit(5)
                .map(e -> new ResultadoInterpretacao.PropostaSugestao(e.getNome(), e.getId(), null))
                .toList();
    }

    private static List<ResultadoInterpretacao.PropostaSugestao> sugerirAlimentos(String chave, List<Alimento> ativos) {
        String[] tokens = tokens(chave);
        return ativos.stream()
                .filter(a -> casaComTokens(Buscas.semAcento(a.getNome()), chave, tokens))
                .limit(5)
                .map(a -> new ResultadoInterpretacao.PropostaSugestao(a.getNome(), a.getId(), null))
                .toList();
    }

    private static String[] tokens(String chave) {
        if (chave == null || chave.isBlank()) {
            return new String[0];
        }
        return java.util.Arrays.stream(chave.split("\\s+"))
                .filter(t -> t.length() >= 3)
                .toArray(String[]::new);
    }

    private static boolean casaComTokens(String candidato, String chave, String[] tokens) {
        if (candidato.contains(chave) || chave.contains(candidato)) {
            return true;
        }
        for (String t : tokens) {
            if (candidato.contains(t)) {
                return true;
            }
        }
        return false;
    }
}
