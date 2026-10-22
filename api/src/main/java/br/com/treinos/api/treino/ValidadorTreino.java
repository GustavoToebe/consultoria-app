package br.com.treinos.api.treino;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Intensidade;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.web.VideoUrls;
import org.springframework.stereotype.Component;

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
 * metodologia copiada no plano vira aviso, nunca erro. As faixas de intensidade e de técnica ficam nos próprios records
 * ({@code Intensidade.problemas}, {@code Tecnica.problemas}); aqui entram as regras que dependem da posição da série
 * no exercício (mesma carga da WS, acima da anterior) e as repetições do cluster.
 */
@Component
public class ValidadorTreino {

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

    /** Nomes dos tipos da metodologia copiada no plano (sem espaços nas pontas), ou {@code null} sem metodologia. */
    private static Set<String> tiposDaMetodologia(ConteudoTreino conteudo) {
        if (conteudo.metodologia() == null || conteudo.metodologia().configuracao() == null) {
            return null;
        }
        Set<String> tipos = new LinkedHashSet<>();
        for (ConfiguracaoConsultoria.TipoDeSerie t : conteudo.metodologia().configuracao().tipos()) {
            if (t != null && t.nome() != null) {
                tipos.add(t.nome().trim());
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
        if (e.isometriaSegundos() != null && (e.isometriaSegundos() < 1 || e.isometriaSegundos() > 120)) {
            c.erro(ce + ".isometriaSegundos", "Isometria de 1 a 120 segundos.");
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
        boolean trabalhoAntes = false;
        Set<String> tiposAvisados = new HashSet<>();
        for (int k = 0; k < series.size(); k++) {
            Serie x = series.get(k);
            String cx = ce + ".series[" + k + "]";
            uid(c, uids, x.uid(), cx);
            serie(c, x, cx);
            tipoForaDaMetodologia(c, x, cx, tiposDaMetodologia, tiposAvisados);
            String modo = x.modo();
            temPercentual |= ConteudoTreino.PERCENTUAL_WS.equals(modo);
            if (ConteudoTreino.MESMA_CARGA.equals(modo) && !trabalhoAntes) {
                c.erro(cx + ".intensidade.modo",
                        "Mesma carga da WS: precisa de uma série de trabalho antes, no mesmo exercício.");
            }
            if (ConteudoTreino.ACIMA_DA_ANTERIOR.equals(modo) && k == 0) {
                c.aviso(cx + ".intensidade.modo",
                        "Acima da anterior na primeira série do exercício: o aluno não terá carga anterior de referência.");
            }
            trabalhoAntes |= x.deTrabalho();
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

    /** Um aviso por tipo desconhecido em cada exercício (na primeira série que o usa), não um por série. */
    private static void tipoForaDaMetodologia(ResultadoValidacao.Coletor c, Serie x, String cx,
                                              Set<String> tiposDaMetodologia, Set<String> tiposAvisados) {
        if (tiposDaMetodologia == null || x.semTipo()) {
            return;
        }
        String tipo = x.tipo().trim();
        if (!tiposDaMetodologia.contains(tipo) && tiposAvisados.add(tipo)) {
            c.aviso(cx + ".tipo", "O tipo \"" + tipo + "\" não está na metodologia do plano ("
                    + String.join(", ", tiposDaMetodologia) + "). A série continua válida.");
        }
    }

    /**
     * Série sem tipo só com técnica. Repetições mínima e máxima juntas (ou nenhuma, série por tempo); no cluster são a
     * soma dos blocos. Faixas da intensidade e da técnica vêm dos records, com o caminho do campo.
     */
    private static void serie(ResultadoValidacao.Coletor c, Serie x, String cx) {
        if (x.semTipo() && x.tecnica() == null) {
            c.erro(cx + ".tipo", "Série sem tipo nem técnica.");
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
            x.tecnica().problemas().forEach((campo, mensagem) -> c.erro(cx + ".tecnica." + campo, mensagem));
            Integer soma = x.tecnica().somaDosBlocos();
            if (soma != null && (!soma.equals(x.repsMin()) || !soma.equals(x.repsMax()))) {
                c.erro(cx + ".repsMin", "Cluster: as repetições são a soma dos blocos (" + soma + ").");
            }
        }
        Intensidade i = x.intensidade();
        if (i != null) {
            i.problemas().forEach((campo, mensagem) -> c.erro(cx + ".intensidade." + campo, mensagem));
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
