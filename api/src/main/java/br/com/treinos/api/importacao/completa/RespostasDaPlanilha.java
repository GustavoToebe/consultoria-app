package br.com.treinos.api.importacao.completa;

import br.com.plataforma.comum.web.BadRequestException;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * O que o treinador respondeu depois da análise: o tipo de cada aba (trocar ou ignorar), as ligações ambíguas, o destino
 * de cada nome de exercício e de alimento e a classificação de cada nome de suplemento. Tudo opcional: sem resposta vale a
 * regra fixa (ver {@link MontagemDaImportacao}). As prescrições não entendidas sempre vão para a observação do exercício.
 *
 * <p>Nunca é guardado: entra no hash da prévia e só vive na requisição (nomes de medicamento são dado sensível).
 */
public record RespostasDaPlanilha(
        List<TipoDaAba> abas,
        List<LigacaoResolvida> ligacoes,
        List<NomeResolvido> exercicios,
        List<NomeResolvido> alimentos,
        List<SuplementoClassificado> suplementos) {

    /** Teto de itens em cada lista (a planilha inteira tem até 500.000 células). */
    static final int ITENS_MAXIMOS = 5000;
    static final int TEXTO_MAXIMO = 200;

    /** {@code tipo} = um {@link TipoDeAba} ou {@code IGNORAR}. */
    public record TipoDaAba(int indice, String tipo) {
    }

    /** Linha {@code linha} (no arquivo) da aba {@code aba} ligada à linha {@code linhaDaMae} da aba mãe. */
    public record LigacaoResolvida(int aba, int linha, int linhaDaMae) {
    }

    /**
     * {@code acao}: {@code ACEITAR} (a sugestão provável), {@code BIBLIOTECA} (o item {@code id} da biblioteca),
     * {@code CRIAR} (exercício novo na biblioteca; no alimento vale como {@code MANTER}) ou {@code MANTER} (fica com o
     * nome da planilha, sem ligar à biblioteca).
     */
    public record NomeResolvido(String nome, String acao, UUID id) {
    }

    /** {@code destino}: {@code SUPLEMENTO} (Suplementação) ou {@code SENSIVEL} (Medicação e ergogênicos). */
    public record SuplementoClassificado(String nome, String destino) {
    }

    static final Set<String> ACOES = Set.of("ACEITAR", "BIBLIOTECA", "CRIAR", "MANTER");
    static final Set<String> DESTINOS = Set.of("SUPLEMENTO", "SENSIVEL");

    public static final RespostasDaPlanilha VAZIAS = new RespostasDaPlanilha(List.of(), List.of(), List.of(), List.of(), List.of());

    public RespostasDaPlanilha {
        abas = abas == null ? List.of() : List.copyOf(abas);
        ligacoes = ligacoes == null ? List.of() : List.copyOf(ligacoes);
        exercicios = exercicios == null ? List.of() : List.copyOf(exercicios);
        alimentos = alimentos == null ? List.of() : List.copyOf(alimentos);
        suplementos = suplementos == null ? List.of() : List.copyOf(suplementos);
    }

    /** Lê e confere o JSON da parte {@code respostas}. Vazio = sem respostas. Erro com mensagem fixa, sem o conteúdo. */
    static RespostasDaPlanilha ler(String texto, JsonMapper json) {
        if (texto == null || texto.isBlank()) {
            return VAZIAS;
        }
        RespostasDaPlanilha r;
        try {
            r = json.readValue(texto, RespostasDaPlanilha.class);
        } catch (RuntimeException e) {
            throw invalidas();
        }
        if (r == null) {
            return VAZIAS;
        }
        if (r.abas.size() > ITENS_MAXIMOS || r.ligacoes.size() > ITENS_MAXIMOS || r.exercicios.size() > ITENS_MAXIMOS
                || r.alimentos.size() > ITENS_MAXIMOS || r.suplementos.size() > ITENS_MAXIMOS) {
            throw invalidas();
        }
        for (TipoDaAba a : r.abas) {
            if (a == null || a.tipo() == null || (!"IGNORAR".equals(a.tipo()) && !nomeDeTipo(a.tipo()))) {
                throw invalidas();
            }
        }
        for (LigacaoResolvida l : r.ligacoes) {
            if (l == null) {
                throw invalidas();
            }
        }
        for (NomeResolvido n : concat(r.exercicios, r.alimentos)) {
            if (n == null || texto(n.nome()) || n.acao() == null || !ACOES.contains(n.acao())
                    || ("BIBLIOTECA".equals(n.acao()) && n.id() == null)) {
                throw invalidas();
            }
        }
        for (SuplementoClassificado s : r.suplementos) {
            if (s == null || texto(s.nome()) || s.destino() == null || !DESTINOS.contains(s.destino())) {
                throw invalidas();
            }
        }
        return r;
    }

    private static boolean nomeDeTipo(String t) {
        for (TipoDeAba tipo : TipoDeAba.values()) {
            if (tipo.name().equals(t)) {
                return true;
            }
        }
        return false;
    }

    private static boolean texto(String t) {
        return t == null || t.isBlank() || t.length() > TEXTO_MAXIMO;
    }

    private static List<NomeResolvido> concat(List<NomeResolvido> a, List<NomeResolvido> b) {
        return java.util.stream.Stream.concat(a.stream(), b.stream()).toList();
    }

    private static BadRequestException invalidas() {
        return new BadRequestException("As respostas da importação são inválidas.", "RESPOSTAS_INVALIDAS");
    }

    /** O tipo confirmado de cada aba (ignorar = {@code DESCONHECIDA}). */
    Map<Integer, TipoDeAba> tiposDasAbas() {
        return abas.stream().collect(Collectors.toMap(TipoDaAba::indice,
                a -> "IGNORAR".equals(a.tipo()) ? TipoDeAba.DESCONHECIDA : TipoDeAba.valueOf(a.tipo()), (x, y) -> y));
    }

    /** Resposta de cada nome de exercício pela chave do {@link CasamentoDeNomes}; a última repetida vale. */
    Map<String, NomeResolvido> exerciciosPorChave() {
        return porChave(exercicios);
    }

    Map<String, NomeResolvido> alimentosPorChave() {
        return porChave(alimentos);
    }

    /** Destino de cada nome de suplemento pela forma normalizada ({@link MontagemDaImportacao#nomeDeSuplemento}). */
    Map<String, String> suplementosPorNome() {
        return suplementos.stream().collect(Collectors.toMap(s -> MontagemDaImportacao.nomeDeSuplemento(s.nome()),
                SuplementoClassificado::destino, (x, y) -> y));
    }

    /** Linha da mãe escolhida para a linha ambígua: chave "aba:linha". */
    Map<String, Integer> ligacoesPorLinha() {
        return ligacoes.stream().collect(Collectors.toMap(l -> l.aba() + ":" + l.linha(), LigacaoResolvida::linhaDaMae,
                (x, y) -> y));
    }

    private static Map<String, NomeResolvido> porChave(List<NomeResolvido> lista) {
        return lista.stream().collect(Collectors.toMap(n -> CasamentoDeNomes.chave(n.nome()), Function.identity(), (x, y) -> y));
    }

    /** sha256 do arquivo e das respostas (na forma normalizada que o servidor lê), em hexadecimal. */
    static String hash(byte[] arquivo, RespostasDaPlanilha respostas, JsonMapper json) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            sha.update(MessageDigest.getInstance("SHA-256").digest(arquivo));
            sha.update(json.writeValueAsString(respostas).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(sha.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
