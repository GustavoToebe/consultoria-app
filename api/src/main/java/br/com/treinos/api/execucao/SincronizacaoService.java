package br.com.treinos.api.execucao;

import br.com.treinos.api.execucao.dto.ExecucaoDtos.EtapaRegistrada;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.LoteResponse;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.RegistroExecucao;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.ResultadoRegistro;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.Situacao;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Recebe o lote de registros do aparelho. Cada registro é conferido contra a versão publicada que o
 * aluno executou e gravado de forma idempotente. Um registro ruim vira {@code RECUSADO} com motivo, sem derrubar o lote.
 * A consultoria e o aluno vêm sempre da sessão; do cliente, só os uids e os valores digitados.
 *
 * <p>Série com etapas (blocos do Cluster, etapa inicial e retomadas do Rest-pause; {@code docs/series-etapas.md}): a
 * lista {@code etapas} é obrigatória (vazia = nada registrado) e o total e a carga da série são calculados aqui, a
 * partir dela; o que o cliente manda nesses dois campos é ignorado. Assim um envio sem detalhe nunca apaga um detalhe.</p>
 */
@Service
public class SincronizacaoService {

    private static final BigDecimal CARGA_MAXIMA = new BigDecimal("2000");
    private static final int DIAS_PARA_TRAS = 60;
    static final String FEITA = "FEITA";
    static final String NAO_REALIZADA = "NAO_REALIZADA";
    private static final Set<String> SITUACOES_DA_ETAPA = Set.of(FEITA, NAO_REALIZADA);
    private static final Set<String> ORIGENS_DA_REFERENCIA = Set.of("WS_ANTERIOR", "BASE_DO_DIA");

    private final ExecucaoUpsert upsert;
    private final IndicesDeVersao indices;
    private final JsonMapper json;

    public SincronizacaoService(ExecucaoUpsert upsert, IndicesDeVersao indices, JsonMapper json) {
        this.upsert = upsert;
        this.indices = indices;
        this.json = json;
    }

    @Transactional
    public LoteResponse receber(UUID consultoriaId, UUID alunoId, List<RegistroExecucao> registros) {
        Map<UUID, IndiceVersao> versoes = indices.carregar(registros.stream()
                .map(RegistroExecucao::planoVersaoId).filter(Objects::nonNull).distinct().toList());
        Map<UUID, ExecucaoUpsert.Chave> existentes = upsert.existentes(registros.stream()
                .map(RegistroExecucao::id).filter(Objects::nonNull).distinct().toList());
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        Instant limiteFuturo = Instant.now().plus(Duration.ofDays(2));
        List<ResultadoRegistro> resultados = new ArrayList<>();
        for (RegistroExecucao r : registros) {
            String motivo = motivoParaRecusar(r, alunoId, versoes, existentes, hoje, limiteFuturo);
            if (motivo != null) {
                resultados.add(new ResultadoRegistro(r.id(), Situacao.RECUSADO, motivo));
                continue;
            }
            IndiceVersao.LocalSerie serie = versoes.get(r.planoVersaoId()).serie(r.serieUid()).orElseThrow();
            List<EtapaRegistrada> etapas = serie.etapas() == null ? null : emOrdem(r.etapas());
            BigDecimal carga = etapas == null ? r.carga() : cargaComum(etapas);
            Integer repeticoes = etapas == null ? r.repeticoes() : totalDasEtapas(etapas, serie.etapas());
            boolean gravou = upsert.gravar(new ExecucaoUpsert.Linha(r.id(), consultoriaId, alunoId, r.planoVersaoId(),
                    r.sessaoUid(), r.exercicioUid(), r.serieUid(), serie.exercicioId(), serie.trabalho(), r.data(),
                    carga, serie.unidade(), repeticoes, Boolean.TRUE.equals(r.concluida()),
                    limpar(r.observacao()), r.alteradoNoAparelhoEm(), serie.contaNoProgresso(),
                    etapas == null ? null : json.writeValueAsString(etapas), r.referenciaCarga(),
                    r.referenciaCarga() == null ? null : r.referenciaOrigem()));
            existentes.putIfAbsent(r.id(), new ExecucaoUpsert.Chave(alunoId, r.planoVersaoId(), r.serieUid(), r.data()));
            resultados.add(new ResultadoRegistro(r.id(), gravou ? Situacao.ACEITO : Situacao.IGNORADO_ANTIGO, null));
        }
        return new LoteResponse(resultados);
    }

    private static String motivoParaRecusar(RegistroExecucao r, UUID alunoId, Map<UUID, IndiceVersao> versoes,
                                            Map<UUID, ExecucaoUpsert.Chave> existentes, LocalDate hoje,
                                            Instant limiteFuturo) {
        if (r.id() == null || r.planoVersaoId() == null || r.sessaoUid() == null || r.exercicioUid() == null
                || r.serieUid() == null || r.data() == null || r.alteradoNoAparelhoEm() == null) {
            return "Registro incompleto.";
        }
        IndiceVersao versao = versoes.get(r.planoVersaoId());
        if (versao == null || !alunoId.equals(versao.alunoId())) {
            return "Plano não encontrado para este aluno.";
        }
        Optional<IndiceVersao.LocalSerie> serie = versao.serie(r.serieUid());
        if (serie.isEmpty() || !serie.get().sessaoUid().equals(r.sessaoUid())
                || !serie.get().exercicioUid().equals(r.exercicioUid())) {
            return "Série não existe nesta versão do plano.";
        }
        if (r.data().isBefore(hoje.minusDays(DIAS_PARA_TRAS)) || r.data().isAfter(hoje.plusDays(DIAS_PARA_TRAS))) {
            return "Data fora do período aceito (60 dias para trás ou para frente).";
        }
        if (r.alteradoNoAparelhoEm().isAfter(limiteFuturo)) {
            return "Horário do aparelho inválido.";
        }
        if (r.carga() != null && !cargaValida(r.carga())) {
            return "Carga precisa ficar entre 0 e 2000, com até 2 casas decimais.";
        }
        if (r.repeticoes() != null && (r.repeticoes() < 0 || r.repeticoes() > 500)) {
            return "Repetições precisam ficar entre 0 e 500.";
        }
        if (r.observacao() != null && r.observacao().length() > 500) {
            return "Observação com mais de 500 caracteres.";
        }
        String etapas = motivoDasEtapas(r, serie.get().etapas());
        if (etapas != null) {
            return etapas;
        }
        if ((r.referenciaCarga() == null) != (r.referenciaOrigem() == null)) {
            return "Referência da carga incompleta.";
        }
        if (r.referenciaCarga() != null && (!cargaValida(r.referenciaCarga()) || !ORIGENS_DA_REFERENCIA.contains(r.referenciaOrigem()))) {
            return "Referência da carga inválida.";
        }
        ExecucaoUpsert.Chave existente = existentes.get(r.id());
        if (existente != null
                && !existente.equals(new ExecucaoUpsert.Chave(alunoId, r.planoVersaoId(), r.serieUid(), r.data()))) {
            return "Identificador já usado por outro registro.";
        }
        return null;
    }

    private static boolean cargaValida(BigDecimal carga) {
        return carga.signum() >= 0 && carga.compareTo(CARGA_MAXIMA) <= 0 && carga.stripTrailingZeros().scale() <= 2;
    }

    /**
     * Confere as etapas contra a série da versão: obrigatórias (lista, mesmo vazia) quando a série tem etapas e proibidas
     * quando não tem; posição de 1 a N sem repetir; situação conhecida; etapa não realizada sem números; repetições de 0 a
     * 500 (sem recusar quem passou da meta) e carga como a da série. Concluída exige todas as posições.
     */
    private static String motivoDasEtapas(RegistroExecucao r, Integer quantas) {
        List<EtapaRegistrada> etapas = r.etapas();
        if (quantas == null) {
            return etapas == null || etapas.isEmpty() ? null : "Esta série não é registrada por etapas.";
        }
        if (etapas == null) {
            return "Registre esta série etapa por etapa (atualize o app).";
        }
        Set<Integer> posicoes = new HashSet<>();
        for (EtapaRegistrada e : etapas) {
            if (e == null || e.posicao() == null || e.posicao() < 1 || e.posicao() > quantas || !posicoes.add(e.posicao())) {
                return "Etapa fora da série ou repetida.";
            }
            if (e.situacao() == null || !SITUACOES_DA_ETAPA.contains(e.situacao())) {
                return "Situação da etapa desconhecida.";
            }
            if (NAO_REALIZADA.equals(e.situacao()) && (e.repeticoes() != null || e.carga() != null)) {
                return "Etapa não realizada não leva repetições nem carga.";
            }
            if (e.repeticoes() != null && (e.repeticoes() < 0 || e.repeticoes() > 500)) {
                return "Repetições da etapa precisam ficar entre 0 e 500.";
            }
            if (e.carga() != null && !cargaValida(e.carga())) {
                return "Carga da etapa precisa ficar entre 0 e 2000, com até 2 casas decimais.";
            }
        }
        if (Boolean.TRUE.equals(r.concluida()) && posicoes.size() != quantas) {
            return "Série concluída com etapas pendentes.";
        }
        return null;
    }

    private static List<EtapaRegistrada> emOrdem(List<EtapaRegistrada> etapas) {
        return etapas.stream().sorted(Comparator.comparing(EtapaRegistrada::posicao)).toList();
    }

    /**
     * Total da série = soma das repetições das etapas feitas, só quando nenhuma está pendente e toda feita tem
     * repetições; senão nulo (parcial: a soma de uma parte não é o total). Sem etapa feita, nulo.
     */
    static Integer totalDasEtapas(List<EtapaRegistrada> etapas, int quantas) {
        List<EtapaRegistrada> feitas = etapas.stream().filter(e -> FEITA.equals(e.situacao())).toList();
        if (etapas.size() != quantas || feitas.isEmpty() || feitas.stream().anyMatch(e -> e.repeticoes() == null)) {
            return null;
        }
        int total = feitas.stream().mapToInt(EtapaRegistrada::repeticoes).sum();
        return total > 500 ? null : total;
    }

    /**
     * Carga da série = a carga comum das etapas feitas. Com cargas diferentes (ou alguma sem carga) fica nula, "carga
     * variável": nunca a maior nem a última como se fosse a da série inteira.
     */
    static BigDecimal cargaComum(List<EtapaRegistrada> etapas) {
        List<BigDecimal> cargas = etapas.stream().filter(e -> FEITA.equals(e.situacao())).map(EtapaRegistrada::carga).toList();
        if (cargas.isEmpty() || cargas.stream().anyMatch(Objects::isNull)) {
            return null;
        }
        BigDecimal primeira = cargas.get(0);
        return cargas.stream().allMatch(c -> c.compareTo(primeira) == 0) ? primeira : null;
    }

    private static String limpar(String texto) {
        return texto == null || texto.isBlank() ? null : texto.trim();
    }
}
