package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.importacao.assistida.BlocoTexto;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.web.Buscas;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Roteador dos interpretadores de IA: seleciona o provedor configurado (Gemini / Claude / Regras)
 * e garante fallback determinístico transparente para regras caso as chaves não estejam disponíveis,
 * o envio esteja desligado ou a chamada externa falhe. Documento grande (resposta cortada, ou texto acima de
 * {@link #CARACTERES_PARA_DIVIDIR_NA_IDA}) é lido em partes, em série, e os grupos do mesmo aluno se juntam.
 * Cada arquivo deixa uma linha de log de uso, sem conteúdo, nome de arquivo nem nome de aluno.
 */
@Component
public class RoteadorInterpretadorIa {

    private static final Logger log = LoggerFactory.getLogger(RoteadorInterpretadorIa.class);

    /** Uma chamada e, só se a falha for passageira, mais uma (por parte). */
    static final int TENTATIVAS = 2;
    static final Duration ESPERA_ENTRE_TENTATIVAS = Duration.ofSeconds(2);
    /** Acima disto o documento já vai em partes, sem tentar inteiro (a resposta cortaria). */
    static final int CARACTERES_PARA_DIVIDIR_NA_IDA = 250_000;
    /** Tamanho de cada parte: seções inteiras (aba, página) até este total. */
    static final int CARACTERES_POR_PARTE = 60_000;
    /** Acima disto as partes crescem em vez de se multiplicar (o extrator do PDF para em 500.000 caracteres). */
    static final int MAXIMO_DE_PARTES = 8;
    /**
     * Tempo da IA num arquivo (decisão do Gustavo, 27/11): toda chamada ao provedor recebe como prazo o que sobra dele (no
     * máximo o tempo de uma chamada), a nova tentativa só sai se ainda couber, e a parte que não couber vai às regras
     * fixas com {@link #AVISO_TEMPO_ESGOTADO}. O corte da sessão é rodadas × este orçamento + folga
     * ({@code ProcessamentoAssincronoImportacao.limiteDaSessaoEmSegundos}): nenhum outro número fixo.
     */
    public static final Duration ORCAMENTO_POR_ARQUIVO = Duration.ofMinutes(15);
    /** Com menos que isto do orçamento nenhuma chamada nova começa (o provedor não leria uma parte a tempo). */
    static final Duration MINIMO_PARA_UMA_CHAMADA = Duration.ofSeconds(30);
    /** Aviso fixo do grupo quando o orçamento acabou antes de a IA ler tudo (nada do documento). */
    static final String AVISO_TEMPO_ESGOTADO =
            "O tempo de leitura com IA acabou: parte do documento foi lida pelas regras fixas. Confira com atenção.";
    private static final java.util.regex.Pattern STATUS_HTTP = java.util.regex.Pattern.compile("\\(HTTP (\\d{3})\\)");

    /** Teto do arquivo entregue ao Claude (o limite de uma imagem lá; o envio já para em 900 KB). */
    static final int BYTES_MAXIMOS_DO_ARQUIVO = 5 * 1024 * 1024;
    private static final Set<String> COBERTURAS_COM_ARQUIVO = Set.of("SEM_TEXTO", "PARCIAL");

    /** {@code enviadoComoArquivo}: a leitura pela IA que valeu levou o PDF ou a imagem (a tela diz "Lido pela imagem"). */
    public record ExecucaoInterpretacao(ResultadoInterpretacao resultado, String modoEfetivo,
                                        String provedorConfigurado, boolean fallbackParaRegras,
                                        String motivoFallback, boolean enviadoComoArquivo) {
        public ExecucaoInterpretacao(ResultadoInterpretacao resultado, String modoEfetivo, String provedorConfigurado,
                                     boolean fallbackParaRegras, String motivoFallback) {
            this(resultado, modoEfetivo, provedorConfigurado, fallbackParaRegras, motivoFallback, false);
        }
    }

    private final ConfiguracaoIaImportacao config;
    private final InterpretadorGemini gemini;
    private final InterpretadorClaude claude;
    private final InterpretadorPorRegras regras;
    // Só o teste mexe: sem espera de verdade entre as tentativas e um orçamento curto.
    Duration espera = ESPERA_ENTRE_TENTATIVAS;
    Duration orcamento = ORCAMENTO_POR_ARQUIVO;
    Duration minimoParaUmaChamada = MINIMO_PARA_UMA_CHAMADA;

    public RoteadorInterpretadorIa(ConfiguracaoIaImportacao config,
                                  InterpretadorGemini gemini,
                                  InterpretadorClaude claude,
                                  InterpretadorPorRegras regras) {
        this.config = config;
        this.gemini = gemini;
        this.claude = claude;
        this.regras = regras;
    }

    public ResultadoInterpretacao interpretar(ContextoIa contexto) {
        return interpretarComModo(contexto).resultado();
    }

    /** O envio aceita JPG e PNG e o PDF sem texto vai inteiro ao Claude (o {@code GET /eu} mostra isto ao app). */
    public boolean arquivoVaiAoProvedor() {
        return config.arquivoVaiAoProvedor();
    }

    /**
     * O único portão do arquivo (D1): os bytes só entram no contexto com {@link #arquivoVaiAoProvedor()}, cobertura do
     * texto {@code SEM_TEXTO} ou {@code PARCIAL}, formato PDF, JPG ou PNG e até {@link #BYTES_MAXIMOS_DO_ARQUIVO}. Em
     * qualquer outro caso o contexto segue como veio, sem arquivo.
     */
    public ContextoIa comArquivoSeCouber(ContextoIa contexto, byte[] bytes, String cobertura) {
        String midia = contexto.formato() == null ? null : switch (contexto.formato()) {
            case "PDF" -> "application/pdf";
            case "JPG" -> "image/jpeg";
            case "PNG" -> "image/png";
            default -> null;
        };
        if (!config.arquivoVaiAoProvedor() || midia == null || bytes == null || bytes.length == 0
                || bytes.length > BYTES_MAXIMOS_DO_ARQUIVO || cobertura == null
                || !COBERTURAS_COM_ARQUIVO.contains(cobertura)) {
            return contexto.semArquivo();
        }
        return contexto.comArquivo(new ContextoIa.ArquivoOriginal(midia, Base64.getEncoder().encodeToString(bytes)));
    }

    public ExecucaoInterpretacao interpretarComModo(ContextoIa contexto) {
        return interpretarComModo(contexto, null);
    }

    /** Como {@link #interpretarComModo(ContextoIa)}, com a sessão na linha de log de uso. */
    public ExecucaoInterpretacao interpretarComModo(ContextoIa contexto, UUID sessaoId) {
        Registro registro = new Registro(orcamento);
        ExecucaoInterpretacao exec = escolher(contexto, registro);
        registro.escrever(sessaoId, exec);
        return exec;
    }

    private ExecucaoInterpretacao escolher(ContextoIa contexto, Registro registro) {
        String provedor = config.getProvedor();
        // Fail-closed (LGPD): sem a chave explícita nada sai do servidor, mesmo com provedor e chave de API.
        if (!config.isEnviarDadosAoProvedor()) {
            String motivo = "regras".equals(provedor) ? null : "ENVIO_DESLIGADO";
            return new ExecucaoInterpretacao(regras.interpretar(contexto), "REGRAS", provedor, false, motivo);
        }

        // O Gemini nunca recebe o arquivo; o Claude só com a chave do arquivo (conferida de novo aqui).
        if ("gemini".equals(provedor)) {
            return viaIa(contexto.semArquivo(), provedor, config.temChaveGemini(), gemini, registro);
        }

        if ("claude".equals(provedor)) {
            return viaIa(config.arquivoVaiAoProvedor() ? contexto : contexto.semArquivo(), provedor,
                    config.temChaveClaude(), claude, registro);
        }

        // Padrão determinístico: regras locais
        return new ExecucaoInterpretacao(regras.interpretar(contexto), "REGRAS", provedor, false, null);
    }

    private ExecucaoInterpretacao viaIa(ContextoIa contexto, String provedor, boolean temChave, InterpretadorIa conector,
                                        Registro registro) {
        if (!temChave) {
            return porRegras(contexto, provedor, "CHAVE_AUSENTE");
        }
        String texto = contexto.textoParaProvedor();
        try {
            // Só aqui (depois do fail-closed) a biblioteca vai junto: a IA devolve o nome que já existe nela. Dentro do
            // try: falha ao ler a biblioteca cai nas regras como qualquer outra.
            ContextoIa paraIa = contexto.comBiblioteca(regras.nomesDeExercicios(), regras.nomesDeAlimentos());
            // Em partes o arquivo não vai: seria mandado inteiro a cada parte (custo e o mesmo aluno N vezes).
            if (texto != null && texto.length() > CARACTERES_PARA_DIVIDIR_NA_IDA) {
                return emPartes(contexto, paraIa.semArquivo(), texto, provedor, conector, registro);
            }
            try {
                ResultadoInterpretacao r = comNovaTentativa(() -> conector.interpretar(paraIa), registro);
                return new ExecucaoInterpretacao(regras.comDuvidasDaBiblioteca(r, contexto), "IA", provedor, false, null,
                        paraIa.arquivo() != null);
            } catch (DecodificadorDaProposta.RespostaCortada e) {
                registro.paradas.add("max_tokens");
                return emPartes(contexto, paraIa.semArquivo(), texto, provedor, conector, registro);
            }
        } catch (Exception e) {
            return depoisDaFalha(contexto, provedor, e);
        }
    }

    private ExecucaoInterpretacao depoisDaFalha(ContextoIa contexto, String provedor, Exception e) {
        if (e instanceof InterruptedException) {
            Thread.currentThread().interrupt();
        }
        if (e instanceof TempoEsgotado) {
            return comAviso(porRegras(contexto, provedor, "TEMPO_ESGOTADO"));
        }
        return porRegras(contexto, provedor, e instanceof DecodificadorDaProposta.RespostaCortada
                ? "RESPOSTA_CORTADA" : "ERRO_PROVEDOR");
    }

    /** Todos os grupos do arquivo com {@link #AVISO_TEMPO_ESGOTADO} (o resto da execução não muda). */
    private static ExecucaoInterpretacao comAviso(ExecucaoInterpretacao exec) {
        ResultadoInterpretacao r = exec.resultado();
        List<ResultadoInterpretacao.PropostaGrupo> grupos = r.grupos().stream()
                .map(g -> juntar(g, null, List.of(AVISO_TEMPO_ESGOTADO))).toList();
        return new ExecucaoInterpretacao(new ResultadoInterpretacao(grupos, r.duvidas(), r.uso()), exec.modoEfetivo(),
                exec.provedorConfigurado(), exec.fallbackParaRegras(), exec.motivoFallback(), exec.enviadoComoArquivo());
    }

    private ExecucaoInterpretacao porRegras(ContextoIa contexto, String provedor, String motivo) {
        return new ExecucaoInterpretacao(regras.interpretar(contexto), "REGRAS", provedor, true, motivo);
    }

    /**
     * Uma chamada por parte, em série (o mesmo {@code system} fica no cache). A parte que ainda corta ou falha vai às
     * regras, só com os blocos dela; nenhuma lida pela IA = o arquivo inteiro pelas regras, como antes.
     */
    private ExecucaoInterpretacao emPartes(ContextoIa contexto, ContextoIa paraIa, String texto, String provedor,
                                           InterpretadorIa conector, Registro registro) throws InterruptedException {
        List<String> partes = dividir(texto, limiteDaParte(texto.length()));
        if (partes.size() < 2) {
            throw new DecodificadorDaProposta.RespostaCortada(conector.nomeProvedor());
        }
        registro.partes = partes.size();
        List<ResultadoInterpretacao.PropostaGrupo> grupos = new ArrayList<>();
        Set<BlocoTexto> usados = Collections.newSetFromMap(new IdentityHashMap<>());
        String motivo = null;
        boolean algumaPelaIa = false;
        boolean semTempo = false;
        for (String parte : partes) {
            try {
                grupos.addAll(comNovaTentativa(() -> conector.interpretarTrecho(paraIa, parte), registro).grupos());
                algumaPelaIa = true;
                continue;
            } catch (DecodificadorDaProposta.RespostaCortada e) {
                registro.paradas.add("max_tokens");
                motivo = motivo == null ? "RESPOSTA_CORTADA" : motivo;
            } catch (TempoEsgotado e) {
                semTempo = true; // as partes seguintes também não cabem: vão direto às regras
                motivo = motivo == null ? "TEMPO_ESGOTADO" : motivo;
            } catch (RuntimeException e) {
                if (Thread.currentThread().isInterrupted()) {
                    throw new InterruptedException("Leitura interrompida.");
                }
                motivo = motivo == null ? "ERRO_PROVEDOR" : motivo;
            }
            grupos.addAll(regrasDaParte(contexto, parte, usados));
        }
        if (!algumaPelaIa) {
            ExecucaoInterpretacao todas = porRegras(contexto, provedor, motivo);
            return semTempo ? comAviso(todas) : todas;
        }
        ResultadoInterpretacao junto = new ResultadoInterpretacao(juntarPorNome(grupos, partes.size()), List.of());
        // As dúvidas de todas as partes (IA e regras) saem da mesma conta contra a biblioteca.
        ExecucaoInterpretacao exec = new ExecucaoInterpretacao(regras.comDuvidasDaBiblioteca(junto, contexto), "IA",
                provedor, motivo != null, motivo);
        return semTempo ? comAviso(exec) : exec;
    }

    /**
     * Partes de até {@link #CARACTERES_POR_PARTE}, e pelo menos duas (55% do texto: duas seções de tamanho parecido cabem
     * uma em cada parte sem a sobra virar parte própria); nunca mais de ~{@link #MAXIMO_DE_PARTES}.
     */
    static int limiteDaParte(int tamanho) {
        int poucoMaisDaMetade = (int) (tamanho * 55L / 100) + 1;
        return Math.max(Math.min(CARACTERES_POR_PARTE, poucoMaisDaMetade), (tamanho + MAXIMO_DE_PARTES - 1) / MAXIMO_DE_PARTES);
    }

    /**
     * Divide pelas marcas dos extratores ({@code === ABA: ... ===}, {@code === PÁGINA n ===}) juntando seções inteiras até
     * o limite. Seção maior que o limite (ou texto sem marca) é cortada por linha, repetindo no começo de cada pedaço a
     * marca e a linha "Colunas:" dela.
     */
    static List<String> dividir(String texto, int limite) {
        List<String> partes = new ArrayList<>();
        StringBuilder atual = new StringBuilder();
        for (String secao : texto.split("(?m)(?=^=== (?:ABA: |PÁGINA \\d+ ===))")) {
            for (String pedaco : secao.length() > limite ? fatiar(secao, limite) : List.of(secao)) {
                if (!atual.isEmpty() && atual.length() + pedaco.length() > limite) {
                    partes.add(atual.toString());
                    atual.setLength(0);
                }
                atual.append(pedaco);
            }
        }
        if (!atual.toString().isBlank()) {
            partes.add(atual.toString());
        }
        return partes;
    }

    private static List<String> fatiar(String secao, int limite) {
        String[] linhas = secao.split("(?<=\n)");
        String marca = linhas[0].startsWith("=== ") ? linhas[0] : "";
        String colunas = Arrays.stream(linhas).filter(l -> l.startsWith("Colunas: ")).findFirst().orElse("");
        String repetir = marca + colunas;
        List<String> pedacos = new ArrayList<>();
        StringBuilder pedaco = new StringBuilder();
        int inicioDoConteudo = 0;
        for (String linha : linhas) {
            if (pedaco.length() > inicioDoConteudo && pedaco.length() + linha.length() > limite) {
                pedacos.add(pedaco.toString());
                pedaco.setLength(0);
                pedaco.append(repetir);
                inicioDoConteudo = repetir.length();
            }
            pedaco.append(linha);
        }
        String resto = pedaco.substring(inicioDoConteudo);
        if (!pedacos.isEmpty() && resto.isBlank()) {
            pedacos.set(pedacos.size() - 1, pedacos.getLast() + resto); // só a quebra de linha do fim: não vira pedaço
        } else {
            pedacos.add(pedaco.toString());
        }
        return pedacos;
    }

    /**
     * O que a parte traz, lido pelas regras: o bloco inteiro quando está todo nela (página, parágrafo, aba pequena; uma
     * vez só); a aba fatiada ({@code === ABA: ... ===} repetida no começo de cada pedaço) vira um bloco só com o pedaço
     * desta parte, para as regras não relerem o pedaço que a IA já leu noutra parte.
     */
    private List<ResultadoInterpretacao.PropostaGrupo> regrasDaParte(ContextoIa contexto, String parte,
                                                                    Set<BlocoTexto> usados) {
        List<BlocoTexto> daParte = new ArrayList<>();
        for (BlocoTexto b : contexto.blocos() == null ? List.<BlocoTexto>of() : contexto.blocos()) {
            String conteudo = b.conteudo() == null ? "" : b.conteudo().strip();
            if (conteudo.isEmpty()) {
                continue;
            }
            if (parte.contains(conteudo)) {
                if (usados.add(b)) {
                    daParte.add(b);
                }
                continue;
            }
            String marca = conteudo.lines().findFirst().orElse("");
            if (!marca.startsWith("=== ")) {
                continue;
            }
            for (int i = parte.indexOf(marca); i >= 0; i = parte.indexOf(marca, i + marca.length())) {
                int fim = parte.indexOf("\n=== ", i + marca.length());
                daParte.add(new BlocoTexto(b.titulo(), parte.substring(i, fim < 0 ? parte.length() : fim),
                        b.identificadorOrigem(), b.linhaOuPagina()));
            }
        }
        return daParte.isEmpty() ? List.of() : regras.interpretar(contexto, daParte).grupos();
    }

    /**
     * Mesmo nome lido do conteúdo (sem acento, caixa nem espaço sobrando) = o mesmo aluno (D6); grupo sem nome lido
     * (origem fora de {@code CONTEUDO}) nunca junta, nem com outro sem nome. Todos ganham o aviso das partes.
     */
    static List<ResultadoInterpretacao.PropostaGrupo> juntarPorNome(List<ResultadoInterpretacao.PropostaGrupo> grupos,
                                                                   int partes) {
        Map<String, ResultadoInterpretacao.PropostaGrupo> porNome = new LinkedHashMap<>();
        int semNome = 0;
        for (ResultadoInterpretacao.PropostaGrupo g : grupos) {
            String chave = g.origemDoNome() == ResultadoInterpretacao.OrigemDoNome.CONTEUDO
                    ? "nome:" + Buscas.semAcento(g.nomeAluno()) : "sem-nome:" + semNome++;
            porNome.merge(chave, g, (a, b) -> juntar(a, b, List.of()));
        }
        String aviso = "Documento grande: lido em " + partes + " partes.";
        return porNome.values().stream().map(g -> juntar(g, null, List.of(aviso))).toList();
    }

    /** Junta {@code b} (pode ser nulo) em {@code a}; o que passa dos tetos do plano sai e vira aviso. */
    private static ResultadoInterpretacao.PropostaGrupo juntar(ResultadoInterpretacao.PropostaGrupo a,
                                                                ResultadoInterpretacao.PropostaGrupo b,
                                                                List<String> avisosNovos) {
        Set<String> avisos = new LinkedHashSet<>(a.avisos());
        List<ResultadoInterpretacao.PropostaPeso> pesos = new ArrayList<>(a.pesos() == null ? List.of() : a.pesos());
        ConteudoTreino treino = a.treino();
        ConteudoDieta dieta = a.dieta();
        if (b != null) {
            avisos.addAll(b.avisos());
            if (b.pesos() != null) {
                b.pesos().stream().filter(p -> !pesos.contains(p)).forEach(pesos::add);
            }
            treino = juntar(treino, b.treino(), avisos);
            dieta = juntar(dieta, b.dieta(), avisos);
        }
        avisos.addAll(avisosNovos);
        return new ResultadoInterpretacao.PropostaGrupo(a.identificadorOrigem(), a.nomeAluno(),
                primeiro(a.email(), b == null ? null : b.email()), primeiro(a.telefone(), b == null ? null : b.telefone()),
                primeiro(a.objetivo(), b == null ? null : b.objetivo()),
                primeiro(a.observacoes(), b == null ? null : b.observacoes()), List.copyOf(pesos), treino, dieta,
                List.copyOf(avisos), a.origemDoNome());
    }

    /** Também o "Juntar as N partes" da revisão ({@code ImportacaoAssistidaService.juntarGrupos}). */
    public static ConteudoTreino juntar(ConteudoTreino a, ConteudoTreino b, Set<String> avisos) {
        if (a == null || b == null) {
            return a == null ? b : a;
        }
        return new ConteudoTreino(primeiro(a.objetivo(), b.objetivo()), primeiro(a.orientacoes(), b.orientacoes()),
                ate(a.sessoes(), b.sessoes(), 20, avisos, "Treino: só as 20 primeiras divisões entraram."), a.metodologia());
    }

    public static ConteudoDieta juntar(ConteudoDieta a, ConteudoDieta b, Set<String> avisos) {
        if (a == null || b == null) {
            return a == null ? b : a;
        }
        return new ConteudoDieta(primeiro(a.objetivo(), b.objetivo()), primeiro(a.dataInicio(), b.dataInicio()),
                primeiro(a.profissional(), b.profissional()),
                ate(a.refeicoes(), b.refeicoes(), 12, avisos, "Dieta: só as 12 primeiras refeições entraram."),
                ate(a.orientacoes(), b.orientacoes(), 30, avisos, "Dieta: só as 30 primeiras orientações entraram."),
                primeiro(a.observacoes(), b.observacoes()),
                ate(a.suplementacao(), b.suplementacao(), 40, avisos, "Dieta: só os 40 primeiros suplementos entraram."),
                ate(a.ergogenicos(), b.ergogenicos(), 40, avisos, "Dieta: só as 40 primeiras medicações entraram."),
                primeiro(a.aguaLitros(), b.aguaLitros()), a.variacoes().isEmpty() ? b.variacoes() : a.variacoes());
    }

    private static <T> List<T> ate(List<T> a, List<T> b, int teto, Set<String> avisos, String aviso) {
        List<T> todos = Stream.concat(a == null ? Stream.empty() : a.stream(), b == null ? Stream.empty() : b.stream())
                .toList();
        if (todos.size() > teto) {
            avisos.add(aviso);
            return todos.subList(0, teto);
        }
        return todos;
    }

    private static <T> T primeiro(T a, T b) {
        return a != null ? a : b;
    }

    @FunctionalInterface
    private interface Chamada {
        ResultadoInterpretacao chamar();
    }

    /** O orçamento do arquivo acabou antes desta chamada (ou no meio dela): não é falha passageira, não tenta de novo. */
    static final class TempoEsgotado extends IllegalStateException {
        private static final long serialVersionUID = 1L;

        TempoEsgotado() {
            super("Tempo de leitura do arquivo esgotado.");
        }
    }

    /**
     * Cada chamada tem como prazo o que sobra do orçamento; sem o mínimo para uma chamada, nem começa. A nova tentativa
     * (só em falha passageira) sai só se, depois da pausa, ainda sobrar esse mínimo.
     */
    private ResultadoInterpretacao comNovaTentativa(Chamada chamada, Registro registro) throws InterruptedException {
        for (int tentativa = 1; ; tentativa++) {
            Duration prazo = registro.restante();
            if (!prazo.isPositive() || prazo.compareTo(minimoParaUmaChamada) < 0) {
                throw new TempoEsgotado();
            }
            registro.tentativas++;
            try {
                ResultadoInterpretacao r = noPrazo(chamada, prazo);
                registro.somar(r == null ? null : r.uso());
                return r;
            } catch (FalhaPassageiraDoProvedor e) {
                registro.falhou(e);
                Duration pausa = e.esperaPedida() != null ? e.esperaPedida() : espera;
                if (tentativa >= TENTATIVAS || registro.restante().minus(pausa).compareTo(minimoParaUmaChamada) < 0) {
                    throw e;
                }
                Thread.sleep(pausa); // interrompida (sessão cortada): sai sem tentar de novo
            } catch (RuntimeException e) {
                registro.falhou(e);
                throw e;
            }
        }
    }

    /**
     * A chamada numa thread virtual, esperada até {@code prazo}: passou, ela é interrompida (o {@code HttpClient} cancela
     * o pedido) e sai {@link TempoEsgotado}. Vale para qualquer conector, mesmo o que não conhece o orçamento.
     */
    private static ResultadoInterpretacao noPrazo(Chamada chamada, Duration prazo) throws InterruptedException {
        java.util.concurrent.FutureTask<ResultadoInterpretacao> tarefa = new java.util.concurrent.FutureTask<>(chamada::chamar);
        Thread.ofVirtual().start(tarefa);
        try {
            return tarefa.get(prazo.toNanos(), java.util.concurrent.TimeUnit.NANOSECONDS);
        } catch (java.util.concurrent.TimeoutException e) {
            tarefa.cancel(true);
            throw new TempoEsgotado();
        } catch (InterruptedException e) {
            tarefa.cancel(true);
            throw e;
        } catch (java.util.concurrent.ExecutionException e) {
            if (e.getCause() instanceof RuntimeException r) {
                throw r;
            }
            if (e.getCause() instanceof Error erro) {
                throw erro;
            }
            throw new IllegalStateException("Falha na chamada ao provedor.");
        }
    }

    /** O que vai na linha de log de um arquivo: só números e códigos (status HTTP e tipo do erro, nunca a mensagem). */
    private static final class Registro {
        private final long inicio = System.nanoTime();
        private final Duration orcamento;
        private final List<String> paradas = new ArrayList<>();
        private int tentativas;
        private int partes = 1;
        private String modelo;
        private long entrada;
        private long saida;
        private long cacheLido;
        private long cacheGravado;
        private String erro;
        private String statusHttp;

        Registro(Duration orcamento) {
            this.orcamento = orcamento;
        }

        Duration restante() {
            return orcamento.minus(Duration.ofNanos(System.nanoTime() - inicio));
        }

        /** Só o nome da classe e os três dígitos do "(HTTP nnn)" da mensagem fixa: a mensagem em si não vai ao log. */
        void falhou(RuntimeException e) {
            erro = e.getClass().getSimpleName();
            java.util.regex.Matcher m = STATUS_HTTP.matcher(String.valueOf(e.getMessage()));
            statusHttp = m.find() ? m.group(1) : statusHttp;
        }

        void somar(ResultadoInterpretacao.Uso uso) {
            if (uso == null) {
                return;
            }
            modelo = uso.modelo();
            paradas.add(uso.parada());
            entrada += uso.tokensEntrada();
            saida += uso.tokensSaida();
            cacheLido += uso.cacheLido();
            cacheGravado += uso.cacheGravado();
        }

        void escrever(UUID sessaoId, ExecucaoInterpretacao exec) {
            log.info("Leitura da importação assistida: consultoria={} sessao={} provedor={} modelo={} duracaoMs={} "
                            + "paradas={} tokensEntrada={} tokensSaida={} cacheLido={} cacheGravado={} modo={} "
                            + "motivoFallback={} tentativas={} partes={} erro={} statusHttp={}",
                    TenantContext.get(), sessaoId, exec.provedorConfigurado(), modelo,
                    Duration.ofNanos(System.nanoTime() - inicio).toMillis(), String.join(",", paradas), entrada, saida,
                    cacheLido, cacheGravado, exec.modoEfetivo(), exec.motivoFallback(), tentativas, partes, erro,
                    statusHttp);
        }
    }
}
