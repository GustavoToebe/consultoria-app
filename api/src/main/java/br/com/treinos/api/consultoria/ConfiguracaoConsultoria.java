package br.com.treinos.api.consultoria;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.Intensidade;
import br.com.treinos.api.treino.ConteudoTreino.Tecnica;
import br.com.treinos.api.web.Buscas;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Metodologia: as regras de série de um plano de treino (modelo {@code METODOLOGIA}, copiada em
 * {@code ConteudoTreino.metodologia}). Cada tipo de série tem um papel fixo (aquecimento, preparação, trabalho,
 * pós-trabalho ou outro) e carrega as próprias regras: faixa de repetições, intensidade padrão (com variação para
 * exercício livre ou de máquina), a regra de percentuais por quantidade (só preparação: 3 FS = 50/70/85–90) e a
 * explicação que o aluno lê. As técnicas (rest pause, cluster, drop-set) são fixas; a metodologia dá a cada uma o nome
 * exibido, a explicação e os valores padrão. A metodologia só preenche padrões no editor (ao criar a série ou trocar o
 * tipo): o aluno, o PDF e o validador leem os números gravados na série e usam a metodologia só para nomes e
 * explicações. Percentual é sempre da carga da série de trabalho (WS); 1RM não existe.
 */
public record ConfiguracaoConsultoria(
        List<TipoDeSerie> tipos,
        List<TecnicaDaMetodologia> tecnicas,
        BigDecimal arredondamentoKg,
        String instrucoesTreino,
        String rodapePdf
) {

    /** Para que a série serve. Decide a intensidade sugerida no editor e qual tipo dá nome ao "% da WS". */
    public enum Papel { AQUECIMENTO, PREPARACAO, TRABALHO, POS_TRABALHO, OUTRO }

    /** Faixa de repetições de um tipo de série (mínima e máxima; iguais = número fixo, como "3x3"). */
    public record Repeticoes(Integer min, Integer max) { }

    /** Faixa de percentual da WS; máximo nulo = valor único ("85%"), senão "85 a 90%". */
    public record Faixa(Integer min, Integer max) { }

    /**
     * Um tipo de série. {@code intensidadePadrao} é o que o editor sugere ao criar a série; {@code intensidadePorModalidade}
     * troca a sugestão para exercício {@code LIVRE} ou {@code MAQUINA} (as outras modalidades caem no padrão).
     * {@code regraPercentuais} (só {@code PREPARACAO}): chave = quantas séries de preparação há no exercício ("1" a
     * "10"), valor = o percentual de cada uma, em ordem. {@code explicacao} é o que o aluno lê ao tocar no tipo.
     */
    public record TipoDeSerie(String nome, Papel papel, Repeticoes repeticoes, Intensidade intensidadePadrao,
                              Map<String, Intensidade> intensidadePorModalidade,
                              Map<String, List<Faixa>> regraPercentuais, String explicacao) { }

    /** O que a metodologia diz de uma técnica fixa: nome exibido ("Muscle Round"), explicação e padrão parcial. */
    public record TecnicaDaMetodologia(String tipo, String nome, String explicacao, Tecnica padrao) { }

    public static final String LIVRE = "LIVRE";
    public static final String MAQUINA = "MAQUINA";
    private static final Set<String> MODALIDADES_COM_PADRAO = Set.of(LIVRE, MAQUINA);

    public ConfiguracaoConsultoria {
        tipos = tipos == null ? List.of() : tipos;
        tecnicas = tecnicas == null ? List.of() : tecnicas;
    }

    private static final Set<BigDecimal> ARREDONDAMENTOS = Set.of(new BigDecimal("0.25"), new BigDecimal("0.5"),
            BigDecimal.ONE, new BigDecimal("2.5"));

    /** Nomes que são técnica, não tipo de série, na forma de {@link #chaveDeTipo}. Espelho em {@code dominio/tiposDeSerie.ts}. */
    public static final Set<String> NOMES_DE_TECNICA = Set.of("cluster", "rest pause", "restpause", "drop set", "dropset");

    /** Nome do primeiro tipo de trabalho: dá nome ao "% da WS" no editor e no painel do aluno. */
    public String tipoTrabalho() {
        return tipos.stream().filter(t -> t != null && t.papel() == Papel.TRABALHO && t.nome() != null)
                .map(t -> t.nome().trim()).findFirst().orElse(null);
    }

    /** Tipo pelo nome (sem espaços nas pontas), ou {@code null}. */
    public TipoDeSerie tipo(String nome) {
        if (nome == null) {
            return null;
        }
        String procurado = nome.trim();
        return tipos.stream().filter(t -> t != null && t.nome() != null && t.nome().trim().equals(procurado))
                .findFirst().orElse(null);
    }

    /** O que a metodologia diz da técnica ({@code REST_PAUSE}, {@code CLUSTER} ou {@code DROP_SET}), ou {@code null}. */
    public TecnicaDaMetodologia tecnica(String tipo) {
        return tecnicas.stream().filter(t -> t != null && t.tipo() != null && t.tipo().equals(tipo)).findFirst()
                .orElse(null);
    }

    /** A mesma metodologia com outras instruções do treino. */
    public ConfiguracaoConsultoria comInstrucoes(String instrucoes) {
        return new ConfiguracaoConsultoria(tipos, tecnicas, arredondamentoKg, instrucoes, rodapePdf);
    }

    /** Chave de comparação de um nome de tipo: sem acento, minúsculas, hífen/travessão/NBSP viram espaço, espaços colapsados. */
    public static String chaveDeTipo(String tipo) {
        return Buscas.semAcento(tipo == null ? "" : tipo.replaceAll("[\\-–— ]", " "));
    }

    /**
     * Regra da lista de tipos da consultoria (receita METODOLOGIA): além de {@link #validar}, nome de técnica (fixo ou o
     * nome exibido configurado) não entra como tipo. A cópia dentro do plano passa só por {@link #validar}: o tipo da
     * série é texto livre, e a lista fica onde o treinador a edita.
     */
    public static void validarComoMetodologia(ConfiguracaoConsultoria c) {
        validar(c);
        Set<String> nomesDeTecnica = new HashSet<>(NOMES_DE_TECNICA);
        for (TecnicaDaMetodologia t : c.tecnicas()) {
            nomesDeTecnica.add(chaveDeTipo(t.nome()));
        }
        for (TipoDeSerie t : c.tipos()) {
            if (nomesDeTecnica.contains(chaveDeTipo(t.nome()))) {
                throw new BadRequestException("\"" + t.nome().trim()
                        + "\" é uma técnica, não um tipo de série: escolha a técnica na própria série.");
            }
        }
    }

    /** "Cluster", "Rest-pause", "DROP SET"… são técnicas da série, não tipos. */
    public static boolean nomeDeTecnica(String tipo) {
        return NOMES_DE_TECNICA.contains(chaveDeTipo(tipo));
    }

    /**
     * Valores de um plano sem metodologia vinculada e da metodologia criada com a consultoria (as regras do Saraiva).
     * Espelho em {@code dominio/metodologiaPadrao.ts}: mudou um, mude o outro.
     */
    public static ConfiguracaoConsultoria padrao() {
        Map<String, List<Faixa>> regra = new LinkedHashMap<>();
        regra.put("1", List.of(new Faixa(85, null)));
        regra.put("2", List.of(new Faixa(70, null), new Faixa(85, 90)));
        regra.put("3", List.of(new Faixa(50, null), new Faixa(70, null), new Faixa(85, 90)));
        List<TipoDeSerie> tipos = List.of(
                new TipoDeSerie("Aquecimento", Papel.AQUECIMENTO, new Repeticoes(10, 15), null, null, null,
                        "Série leve, só para preparar o movimento. Fica longe da falha."),
                new TipoDeSerie("FS", Papel.PREPARACAO, new Repeticoes(3, 3), percentual(85, null), null, regra,
                        "Feeder set: série de reconhecimento. Aumente a carga a cada série, dentro das repetições, "
                                + "para chegar à carga da série de trabalho. Não chega na falha."),
                new TipoDeSerie("WS", Papel.TRABALHO, new Repeticoes(3, 6), cargaDeTrabalho(1),
                        Map.of(LIVRE, cargaDeTrabalho(1), MAQUINA, cargaDeTrabalho(0)), null,
                        "Working set: a série de trabalho, com a carga máxima do dia nas repetições propostas. Peso "
                                + "livre: 1 repetição na reserva. Máquina: até a falha. Se passar das repetições, "
                                + "aumente a carga na semana seguinte."),
                new TipoDeSerie("Top set", Papel.TRABALHO, null, acimaDaAnterior(1, 5),
                        Map.of(LIVRE, acimaDaAnterior(1, 5), MAQUINA, acimaDaAnterior(5, 10)), null,
                        "Uma série mais pesada que a anterior: suba a carga de 1 a 5% no peso livre ou de 5 a 10% na "
                                + "máquina."),
                new TipoDeSerie("Back off", Papel.POS_TRABALHO, new Repeticoes(6, 8), percentual(85, null), null, null,
                        "Depois da série de trabalho, com 85% da carga dela."),
                new TipoDeSerie("Cardio", Papel.OUTRO, null, null, null, null,
                        "Cardio por tempo, sem carga. O tempo e o ritmo ficam na observação do exercício."));
        List<TecnicaDaMetodologia> tecnicas = List.of(
                new TecnicaDaMetodologia(ConteudoTreino.REST_PAUSE, "Rest pause",
                        "Faça a série, pause 20 segundos e continue com a mesma carga até a falha.",
                        new Tecnica(ConteudoTreino.REST_PAUSE, 20, null, 1, null, null, null, null)),
                new TecnicaDaMetodologia(ConteudoTreino.CLUSTER, "Cluster",
                        "Muscle Round: a série é dividida em blocos de repetições com uma pausa curta entre eles, com a "
                                + "mesma carga.",
                        new Tecnica(ConteudoTreino.CLUSTER, 15, null, null, null, null, null, null)),
                new TecnicaDaMetodologia(ConteudoTreino.DROP_SET, "Drop-set",
                        "Ao terminar a série, reduza a carga e continue sem descanso.",
                        new Tecnica(ConteudoTreino.DROP_SET, null, null, null, null, 1, null, null)));
        return new ConfiguracaoConsultoria(tipos, tecnicas, new BigDecimal("0.5"), "", "");
    }

    private static Intensidade percentual(int min, Integer max) {
        return new Intensidade(ConteudoTreino.PERCENTUAL_WS, BigDecimal.valueOf(min),
                max == null ? null : BigDecimal.valueOf(max), null, null);
    }

    private static Intensidade cargaDeTrabalho(int rir) {
        return new Intensidade(ConteudoTreino.CARGA_TRABALHO, null, null, null, rir);
    }

    private static Intensidade acimaDaAnterior(int min, int max) {
        return new Intensidade(ConteudoTreino.ACIMA_DA_ANTERIOR, BigDecimal.valueOf(min), BigDecimal.valueOf(max), null,
                null);
    }

    /** Chave da regra de percentuais: a quantidade de séries, "1" a "10", sem zero à esquerda nem sinal. */
    private static final Pattern CHAVE_DA_REGRA = Pattern.compile("10|[1-9]");

    public static void validar(ConfiguracaoConsultoria c) {
        if (c == null || c.tipos().isEmpty() || c.tipos().size() > 20) {
            throw new BadRequestException("Informe de 1 a 20 tipos de série.");
        }
        Set<String> nomes = new HashSet<>();
        boolean temTrabalho = false;
        for (TipoDeSerie t : c.tipos()) {
            if (t == null || t.nome() == null || t.nome().isBlank() || t.nome().length() > 30
                    || !nomes.add(chaveDeTipo(t.nome()))) {
                throw new BadRequestException("Tipos de série: sem nomes vazios, repetidos (mesmo com outra caixa, acento ou hífen) ou com mais de 30 letras.");
            }
            String nome = t.nome().trim();
            if (t.papel() == null) {
                throw new BadRequestException("O tipo \"" + nome
                        + "\" precisa de um papel: aquecimento, preparação, trabalho, pós-trabalho ou outro.");
            }
            temTrabalho |= t.papel() == Papel.TRABALHO;
            Repeticoes r = t.repeticoes();
            if (r != null && (r.min() == null || r.max() == null || r.min() < 0 || r.max() > 500 || r.max() < r.min())) {
                throw new BadRequestException("Repetições de " + nome
                        + ": informe mínima e máxima de 0 a 500, com a máxima maior ou igual à mínima.");
            }
            intensidade(nome, t.intensidadePadrao());
            if (t.intensidadePorModalidade() != null) {
                for (Map.Entry<String, Intensidade> e : t.intensidadePorModalidade().entrySet()) {
                    if (!MODALIDADES_COM_PADRAO.contains(e.getKey()) || e.getValue() == null) {
                        throw new BadRequestException("Intensidade por modalidade de " + nome
                                + ": só LIVRE e MAQUINA, cada uma com a intensidade.");
                    }
                    intensidade(nome, e.getValue());
                }
            }
            regra(t, nome);
            if (t.explicacao() != null && t.explicacao().length() > 500) {
                throw new BadRequestException("Explicação de " + nome + " com no máximo 500 caracteres.");
            }
        }
        if (!temTrabalho) {
            throw new BadRequestException("A metodologia precisa de pelo menos um tipo de série de trabalho.");
        }
        tecnicas(c.tecnicas());
        if (c.arredondamentoKg() == null || ARREDONDAMENTOS.stream().noneMatch(a -> a.compareTo(c.arredondamentoKg()) == 0)) {
            throw new BadRequestException("Arredondamento precisa ser 0,25, 0,5, 1 ou 2,5 kg.");
        }
        if (c.instrucoesTreino() != null && c.instrucoesTreino().length() > 20000) {
            throw new BadRequestException("Instruções do treino com no máximo 20.000 caracteres.");
        }
        if (c.rodapePdf() != null && c.rodapePdf().length() > 500) {
            throw new BadRequestException("Rodapé do PDF com no máximo 500 caracteres.");
        }
    }

    private static void intensidade(String nome, Intensidade i) {
        if (i == null) {
            return;
        }
        Map<String, String> problemas = i.problemas();
        if (!problemas.isEmpty()) {
            throw new BadRequestException("Intensidade padrão de " + nome + ": " + problemas.values().iterator().next());
        }
    }

    /** Regra de percentuais: só em tipo de preparação; "n" séries pedem n faixas de 1 a 200 (máximo ≥ mínimo). */
    private static void regra(TipoDeSerie t, String nome) {
        Map<String, List<Faixa>> regra = t.regraPercentuais();
        if (regra == null || regra.isEmpty()) {
            return;
        }
        if (t.papel() != Papel.PREPARACAO) {
            throw new BadRequestException("Regra de percentuais só em tipo de preparação (" + nome + ").");
        }
        for (Map.Entry<String, List<Faixa>> e : regra.entrySet()) {
            if (e.getKey() == null || !CHAVE_DA_REGRA.matcher(e.getKey()).matches()) {
                throw new BadRequestException("Regra de " + nome + ": a chave é a quantidade de séries (1 a 10).");
            }
            int quantidade = Integer.parseInt(e.getKey());
            List<Faixa> faixas = e.getValue();
            if (faixas == null || faixas.size() != quantidade
                    || faixas.stream().anyMatch(f -> !faixaValida(f))) {
                throw new BadRequestException("Regra de " + nome + ": " + e.getKey() + " série(s) precisam de "
                        + e.getKey() + " percentual(is) de 1 a 200, com o máximo maior ou igual ao mínimo.");
            }
        }
    }

    private static boolean faixaValida(Faixa f) {
        return f != null && f.min() != null && f.min() >= 1 && f.min() <= 200
                && (f.max() == null || (f.max() >= f.min() && f.max() <= 200));
    }

    /** As três técnicas, uma de cada, com nome exibido e padrão (parcial) do próprio tipo. */
    private static void tecnicas(List<TecnicaDaMetodologia> tecnicas) {
        Set<String> vistas = new HashSet<>();
        for (TecnicaDaMetodologia t : tecnicas) {
            if (t == null || t.tipo() == null || !ConteudoTreino.TECNICAS.contains(t.tipo()) || !vistas.add(t.tipo())) {
                throw new BadRequestException("Técnicas: uma de cada (rest pause, cluster e drop-set), sem repetir.");
            }
            if (t.nome() == null || t.nome().isBlank() || t.nome().length() > 30) {
                throw new BadRequestException("Nome da técnica " + t.tipo() + ": de 1 a 30 letras.");
            }
            if (t.explicacao() != null && t.explicacao().length() > 500) {
                throw new BadRequestException("Explicação da técnica " + t.nome().trim() + " com no máximo 500 caracteres.");
            }
            if (t.padrao() != null) {
                if (!t.tipo().equals(t.padrao().tipo())) {
                    throw new BadRequestException("Padrão da técnica " + t.nome().trim() + ": é de outra técnica.");
                }
                Map<String, String> problemas = t.padrao().problemasDosValores();
                if (!problemas.isEmpty()) {
                    throw new BadRequestException("Padrão da técnica " + t.nome().trim() + ": "
                            + problemas.values().iterator().next());
                }
            }
        }
        if (vistas.size() != ConteudoTreino.TECNICAS.size()) {
            throw new BadRequestException("Técnicas: a metodologia precisa das três (rest pause, cluster e drop-set).");
        }
    }
}
