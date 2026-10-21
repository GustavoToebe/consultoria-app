package br.com.treinos.api.treino;

import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Intensidade;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.web.VideoUrls;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Regras de publicação do treino. O app mostra o mesmo resultado antes de publicar. Não opina sobre
 * carga nem volume: só confere que o plano é executável e coerente. O tipo da série é nome livre: fora da lista da
 * metodologia copiada no plano vira aviso, nunca erro.
 */
@Component
public class ValidadorTreino {

    private static final BigDecimal MEIO = new BigDecimal("0.5");
    /** Cadência em 4 partes (descida-pausa embaixo-subida-pausa em cima), cada uma 0 a 9 segundos ou X (explosivo). */
    private static final Pattern CADENCIA = Pattern.compile("[0-9X](-[0-9X]){3}");
    /** Bi-set, tri-set ou circuito: até 6 exercícios feitos em sequência. */
    static final int MAXIMO_POR_GRUPO = 6;

    private final VideoUrls videoUrls;

    public ValidadorTreino(VideoUrls videoUrls) {
        this.videoUrls = videoUrls;
    }

    public ResultadoValidacao validar(ConteudoTreino conteudo, LocalDate inicio, LocalDate fim) {
        ResultadoValidacao.Coletor c = new ResultadoValidacao.Coletor();
        Set<UUID> uids = new HashSet<>();
        Map<Integer, Integer> sessoesPorDia = new HashMap<>();
        boolean temDescanso = false;
        Set<String> tiposDaMetodologia = tiposDaMetodologia(conteudo);
        List<Sessao> sessoes = conteudo.sessoesOuVazio();
        if (sessoes.isEmpty()) {
            c.erro("sessoes", "O plano não tem nenhuma sessão.");
        }
        for (int i = 0; i < sessoes.size(); i++) {
            Sessao s = sessoes.get(i);
            String cs = "sessoes[" + i + "]";
            uid(c, uids, s.uid(), cs);
            if (vazio(s.nome())) {
                c.erro(cs + ".nome", "Sessão sem nome.");
            }
            if (!ConteudoTreino.TIPOS_SESSAO.contains(s.tipo())) {
                c.erro(cs + ".tipo", "Tipo de sessão inválido.");
            }
            if (ConteudoTreino.DESCANSO.equals(s.tipo()) || ConteudoTreino.DESCANSO_ATIVO.equals(s.tipo())) {
                temDescanso = true;
            }
            if (s.diaSemana() != null) {
                if (s.diaSemana() < 1 || s.diaSemana() > 7) {
                    c.erro(cs + ".diaSemana", "Dia da semana precisa ser de 1 (segunda) a 7 (domingo).");
                } else if (sessoesPorDia.merge(s.diaSemana(), 1, Integer::sum) == 2) {
                    c.aviso(cs + ".diaSemana", "Duas sessões no mesmo dia da semana.");
                }
            }
            if (s.frequenciaSemanal() != null && (s.frequenciaSemanal() < 1 || s.frequenciaSemanal() > 7)) {
                c.erro(cs + ".frequenciaSemanal", "Frequência semanal precisa ser de 1 a 7.");
            }
            if (ConteudoTreino.TREINO.equals(s.tipo()) && s.exerciciosOuVazio().isEmpty()) {
                c.erro(cs + ".exercicios", "Sessão de treino sem exercício.");
            }
            List<ExercicioPlano> exercicios = s.exerciciosOuVazio();
            for (int j = 0; j < exercicios.size(); j++) {
                exercicio(c, uids, exercicios.get(j), cs + ".exercicios[" + j + "]", tiposDaMetodologia);
            }
            agrupamento(c, exercicios, cs);
        }
        if (!sessoes.isEmpty() && !temDescanso) {
            c.aviso("sessoes", "O plano não tem dia de descanso.");
        }
        if (inicio != null && fim != null && fim.isBefore(inicio)) {
            c.aviso("fim", "O fim do período é antes do início.");
        }
        return c.resultado();
    }

    /** Tipos da metodologia copiada no plano (sem espaços nas pontas), ou {@code null} quando o plano não tem metodologia. */
    private static Set<String> tiposDaMetodologia(ConteudoTreino conteudo) {
        if (conteudo.metodologia() == null || conteudo.metodologia().configuracao() == null
                || conteudo.metodologia().configuracao().tiposSerie() == null) {
            return null;
        }
        Set<String> tipos = new LinkedHashSet<>();
        for (String t : conteudo.metodologia().configuracao().tiposSerie()) {
            if (t != null) {
                tipos.add(t.trim());
            }
        }
        return tipos;
    }

    private void exercicio(ResultadoValidacao.Coletor c, Set<UUID> uids, ExercicioPlano e, String ce,
                           Set<String> tiposDaMetodologia) {
        uid(c, uids, e.uid(), ce);
        if (vazio(e.nome())) {
            c.erro(ce + ".nome", "Exercício sem nome.");
        }
        if (e.videoUrl() != null && !e.videoUrl().isBlank() && !videoUrls.valida(e.videoUrl())) {
            c.erro(ce + ".videoUrl", "Link de vídeo não aceito (só https do YouTube).");
        }
        if (e.unidade() != null && !"kg".equals(e.unidade()) && !"nenhuma".equals(e.unidade())) {
            c.erro(ce + ".unidade", "Unidade precisa ser kg ou nenhuma.");
        }
        if (e.cadencia() != null && !e.cadencia().isBlank() && !CADENCIA.matcher(e.cadencia()).matches()) {
            c.erro(ce + ".cadencia", "Cadência em 4 partes separadas por hífen, cada uma de 0 a 9 ou X (ex.: 3-1-1-0).");
        }
        if (e.isometriaSegundos() != null) {
            faixa(c, e.isometriaSegundos(), 1, 120, ce + ".isometriaSegundos", "Isometria de 1 a 120 segundos.");
        }
        if (e.combinacao() != null && !ConteudoTreino.SUPERSERIE.equals(e.combinacao())) {
            c.erro(ce + ".combinacao", "Nome do grupo inválido: use bi-set ou supersérie.");
        }
        List<Serie> series = e.seriesOuVazio();
        if (series.isEmpty()) {
            c.erro(ce + ".series", "Exercício sem série.");
        }
        boolean temTrabalho = series.stream().anyMatch(Serie::deTrabalho);
        boolean temPercentual = false;
        Set<String> tiposAvisados = new HashSet<>();
        for (int k = 0; k < series.size(); k++) {
            Serie x = series.get(k);
            String cx = ce + ".series[" + k + "]";
            uid(c, uids, x.uid(), cx);
            serie(c, x, cx);
            tipoForaDaMetodologia(c, x, cx, tiposDaMetodologia, tiposAvisados);
            temPercentual |= ConteudoTreino.PERCENTUAL_WS.equals(x.modo());
        }
        if (temPercentual && !temTrabalho) {
            c.aviso(ce + ".series", "Há série em % da WS sem série de trabalho: a referência será a carga de trabalho "
                    + "que o aluno digitar.");
        }
        if (Boolean.FALSE.equals(e.progressao()) && temTrabalho) {
            c.aviso(ce + ".progressao", "Exercício sem progressão de carga, mas com série de trabalho.");
        }
    }

    /**
     * Exercícios ligados por {@code juntoComAnterior} formam um grupo feito em sequência (bi-set, tri-set, circuito). O
     * primeiro da sessão não tem anterior e o grupo vai até {@link #MAXIMO_POR_GRUPO}; o erro aponta o exercício que
     * passou do limite. O nome do grupo ({@code combinacao}) só conta no primeiro de um grupo de 2: nos outros é ignorado.
     */
    private static void agrupamento(ResultadoValidacao.Coletor c, List<ExercicioPlano> exercicios, String cs) {
        int tamanho = 0;
        for (int j = 0; j < exercicios.size(); j++) {
            ExercicioPlano e = exercicios.get(j);
            if (j == 0 && e.junto()) {
                c.erro(cs + ".exercicios[0].juntoComAnterior",
                        "O primeiro exercício da sessão não tem um anterior para fazer junto.");
            }
            tamanho = j > 0 && e.junto() ? tamanho + 1 : 1;
            if (tamanho == MAXIMO_POR_GRUPO + 1) {
                c.erro(cs + ".exercicios[" + j + "].juntoComAnterior",
                        "Um grupo de exercícios feitos juntos vai até " + MAXIMO_POR_GRUPO + " exercícios.");
            }
        }
    }

    /** Cluster: 2 a 10 blocos, 1 a 50 repetições por bloco e 5 a 600 s entre blocos. Rest pause: 5 a 600 s de pausa,
     * 1 a 5 retomadas e, se informadas, 1 a 50 repetições por retomada (vazio = até a falha). Drop-set: 1 a 5 quedas
     * e, se informadas, 5% a 50% de redução e 1 a 50 repetições por queda (vazio = até a falha). Campos de outra técnica
     * são ignorados. */
    private static void tecnica(ResultadoValidacao.Coletor c, ConteudoTreino.Tecnica t, String ct) {
        if (ConteudoTreino.CLUSTER.equals(t.tipo())) {
            faixa(c, t.blocos(), 2, 10, ct + ".blocos", "Blocos do cluster entre 2 e 10.");
            faixa(c, t.repsPorBloco(), 1, 50, ct + ".repsPorBloco", "Repetições por bloco entre 1 e 50.");
            faixa(c, t.pausaSegundos(), 5, 600, ct + ".pausaSegundos", "Pausa entre blocos de 5 a 600 segundos.");
        } else if (ConteudoTreino.REST_PAUSE.equals(t.tipo())) {
            faixa(c, t.pausaSegundos(), 5, 600, ct + ".pausaSegundos", "Pausa do rest pause de 5 a 600 segundos.");
            faixa(c, t.retomadas(), 1, 5, ct + ".retomadas", "Retomadas do rest pause entre 1 e 5.");
            if (t.repsPorRetomada() != null) {
                faixa(c, t.repsPorRetomada(), 1, 50, ct + ".repsPorRetomada",
                        "Repetições por retomada entre 1 e 50 (ou vazio, até a falha).");
            }
        } else if (ConteudoTreino.DROP_SET.equals(t.tipo())) {
            faixa(c, t.quedas(), 1, 5, ct + ".quedas", "Quedas do drop-set entre 1 e 5.");
            if (t.reducaoPercentual() != null) {
                faixa(c, t.reducaoPercentual(), 5, 50, ct + ".reducaoPercentual",
                        "Redução da carga entre 5% e 50% (ou vazio, sem fixar).");
            }
            if (t.repsPorQueda() != null) {
                faixa(c, t.repsPorQueda(), 1, 50, ct + ".repsPorQueda",
                        "Repetições por queda entre 1 e 50 (ou vazio, até a falha).");
            }
        } else {
            c.erro(ct + ".tipo", "Técnica desconhecida: use cluster, rest pause ou drop-set.");
        }
    }

    private static void faixa(ResultadoValidacao.Coletor c, Integer valor, int min, int max, String caminho,
                              String mensagem) {
        if (valor == null || valor < min || valor > max) {
            c.erro(caminho, mensagem);
        }
    }

    /** Um aviso por tipo desconhecido em cada exercício (na primeira série que o usa), não um por série. */
    private static void tipoForaDaMetodologia(ResultadoValidacao.Coletor c, Serie x, String cx,
                                              Set<String> tiposDaMetodologia, Set<String> tiposAvisados) {
        if (tiposDaMetodologia == null || vazio(x.tipo())) {
            return;
        }
        String tipo = x.tipo().trim();
        if (!tiposDaMetodologia.contains(tipo) && tiposAvisados.add(tipo)) {
            c.aviso(cx + ".tipo", "O tipo \"" + tipo + "\" não está na metodologia do plano ("
                    + String.join(", ", tiposDaMetodologia) + "). A série continua válida.");
        }
    }

    private static void serie(ResultadoValidacao.Coletor c, Serie x, String cx) {
        if (vazio(x.tipo())) {
            c.erro(cx + ".tipo", "Série sem tipo.");
        }
        if ((x.repsMin() == null) != (x.repsMax() == null)) {
            c.erro(cx + ".repsMax", "Informe repetições mínima e máxima, ou nenhuma (série por tempo).");
        } else if (x.repsMin() != null) {
            if (x.repsMin() < 0 || x.repsMax() > 500) {
                c.erro(cx + ".repsMin", "Repetições precisam ficar entre 0 e 500.");
            } else if (x.repsMax() < x.repsMin()) {
                c.erro(cx + ".repsMax", "Repetição máxima menor que a mínima.");
            }
        }
        if (x.descansoSegundos() != null && (x.descansoSegundos() < 0 || x.descansoSegundos() > 3600)) {
            c.erro(cx + ".descansoSegundos", "Descanso precisa ficar entre 0 e 3600 segundos.");
        }
        if (x.tecnica() != null) {
            tecnica(c, x.tecnica(), cx + ".tecnica");
        }
        Intensidade i = x.intensidade();
        String modo = x.modo();
        if (!ConteudoTreino.MODOS.contains(modo)) {
            c.erro(cx + ".intensidade.modo", "Forma de intensidade inválida.");
            return;
        }
        switch (modo) {
            case ConteudoTreino.PERCENTUAL_WS -> {
                if (i.percentual() == null || i.percentual().compareTo(BigDecimal.ONE) < 0
                        || i.percentual().compareTo(new BigDecimal("200")) > 0) {
                    c.erro(cx + ".intensidade.percentual", "Percentual precisa ficar entre 1 e 200.");
                }
            }
            case "RIR" -> {
                if (i.rir() == null || i.rir() < 0 || i.rir() > 10) {
                    c.erro(cx + ".intensidade.rir", "RIR precisa ficar entre 0 e 10.");
                }
            }
            case "RPE" -> {
                if (i.rpe() == null || i.rpe().compareTo(BigDecimal.ONE) < 0
                        || i.rpe().compareTo(BigDecimal.TEN) > 0
                        || i.rpe().remainder(MEIO).signum() != 0) {
                    c.erro(cx + ".intensidade.rpe", "RPE precisa ficar entre 1 e 10, de meio em meio.");
                }
            }
            case "LIVRE" -> {
                if (vazio(i.texto())) {
                    c.erro(cx + ".intensidade.texto", "Escreva a intensidade.");
                }
            }
            default -> {
                // CARGA_TRABALHO e NENHUMA não têm parâmetro.
            }
        }
    }

    private static void uid(ResultadoValidacao.Coletor c, Set<UUID> uids, UUID uid, String caminho) {
        if (uid == null) {
            c.erro(caminho + ".uid", "Item sem identificador.");
        } else if (!uids.add(uid)) {
            c.erro(caminho + ".uid", "Identificador repetido.");
        }
    }

    private static boolean vazio(String texto) {
        return texto == null || texto.isBlank();
    }
}
