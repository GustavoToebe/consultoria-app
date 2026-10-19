package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Evolução das respostas numéricas das atualizações na ficha do aluno (especificação do Saraiva: "evolução do aluno",
 * "gráfico das notas", "medidas"). Só devolve o que o aluno respondeu, ponto a ponto: nenhuma média, tendência, meta
 * ou interpretação.
 *
 * <ul>
 *   <li>Lê as últimas {@link #LIMITE} atualizações ENVIADAS ou REVISADAS (a aberta ainda não tem resposta). Por
 *   quantidade e não por período: com ciclo mensal são dois anos, com semanal meio ano, e a resposta tem tamanho
 *   limitado nos dois casos.</li>
 *   <li>Entram as perguntas {@code NOTA} e {@code NUMERO}. {@code PESO} fica de fora porque já tem o cartão Peso (o
 *   registro de peso, de qualquer origem); {@code NOTAS_POR_DIA} também, porque juntar as notas dos dias num número só
 *   seria uma conta nova (média) e esconderia os dias sem resposta.</li>
 *   <li>Série = id da pergunta: o mesmo id em versões diferentes (ou em outro questionário) é a mesma série. Rótulo,
 *   unidade e casas são os da versão mais recente em que o id aparece como pergunta numérica.</li>
 *   <li>Sem resposta (não respondida, escondida por condição, aluno anonimizado) não é ponto: nunca vira zero. Pergunta
 *   sem nenhum ponto não vira série.</li>
 * </ul>
 */
@Service
public class EvolucaoRespostasService {
    /** Quantas atualizações enviadas ou revisadas, das mais recentes, entram na evolução. */
    public static final int LIMITE = 24;
    private static final Set<String> TIPOS = Set.of("NOTA", "NUMERO");

    public record Ponto(UUID atualizacaoId, LocalDate data, BigDecimal valor) { }
    /** {@code pontos} do mais antigo ao mais novo (ordem do eixo do gráfico). */
    public record Serie(String perguntaId, String tipo, String rotulo, String rotuloCurto, String unidade, Integer casas,
            List<Ponto> pontos) { }
    /** {@code atualizacoes}: quantas foram lidas (no máximo {@code limite}). */
    public record Evolucao(int limite, int atualizacoes, List<Serie> series) { }

    private final AtualizacaoRepository atualizacoes;
    private final AlunoRepository alunos;
    private final JsonMapper json;

    public EvolucaoRespostasService(AtualizacaoRepository atualizacoes, AlunoRepository alunos, JsonMapper json) {
        this.atualizacoes = atualizacoes;
        this.alunos = alunos;
        this.json = json;
    }

    /** Aluno de outra consultoria (ou inexistente) = 404; a consulta já filtra a consultoria pelo {@code @TenantId}. */
    @Transactional(readOnly = true)
    public Evolucao doAluno(UUID alunoId) {
        Exigir.existe(alunos.findById(alunoId), () -> new NaoEncontradoException("Aluno não encontrado."));
        // Da mais recente para a mais antiga: a primeira vez que um id aparece define o rótulo da série.
        List<LinhaEvolucao> linhas = atualizacoes.linhasDaEvolucao(alunoId, PageRequest.of(0, LIMITE));
        Map<String, Montagem> series = new LinkedHashMap<>();
        for (LinhaEvolucao linha : linhas) {
            JsonNode respostas = json.readTree(linha.respostas());
            for (var secao : json.readTree(linha.conteudo()).path("secoes")) {
                for (var pergunta : secao.path("perguntas")) {
                    if (!TIPOS.contains(pergunta.path("tipo").asString())) continue;
                    String id = pergunta.path("id").asString();
                    Montagem serie = series.computeIfAbsent(id, k -> new Montagem(pergunta));
                    JsonNode valor = respostas.path(id);
                    if (valor.isNumber()) serie.pontos.add(new Ponto(linha.atualizacaoId(), linha.data(), valor.decimalValue()));
                }
            }
        }
        return new Evolucao(LIMITE, linhas.size(),
                series.entrySet().stream().filter(e -> !e.getValue().pontos.isEmpty()).map(e -> e.getValue().serie(e.getKey())).toList());
    }

    /** Série em montagem: os pontos chegam do mais novo ao mais antigo e são virados no fim. */
    private static final class Montagem {
        private final String tipo;
        private final String rotulo;
        private final String rotuloCurto;
        private final String unidade;
        private final Integer casas;
        private final List<Ponto> pontos = new ArrayList<>();

        Montagem(JsonNode pergunta) {
            tipo = pergunta.path("tipo").asString();
            rotulo = pergunta.path("rotulo").asString();
            rotuloCurto = textoOuNulo(pergunta.path("rotuloCurto"));
            unidade = textoOuNulo(pergunta.path("unidade"));
            casas = pergunta.path("casas").isNumber() ? pergunta.path("casas").asInt() : null;
        }

        Serie serie(String perguntaId) {
            return new Serie(perguntaId, tipo, rotulo, rotuloCurto, unidade, casas, pontos.reversed());
        }

        private static String textoOuNulo(JsonNode no) {
            return no.isString() && !no.asString().isBlank() ? no.asString().strip() : null;
        }
    }
}
