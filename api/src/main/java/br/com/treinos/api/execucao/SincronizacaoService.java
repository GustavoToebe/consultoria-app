package br.com.treinos.api.execucao;

import br.com.treinos.api.execucao.dto.ExecucaoDtos.LoteResponse;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.RegistroExecucao;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.ResultadoRegistro;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.Situacao;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Recebe o lote de registros do aparelho. Cada registro é conferido contra a versão publicada que o
 * aluno executou e gravado de forma idempotente. Um registro ruim vira {@code RECUSADO} com motivo, sem derrubar o lote.
 * A consultoria e o aluno vêm sempre da sessão; do cliente, só os uids e os valores digitados.
 */
@Service
public class SincronizacaoService {

    private static final BigDecimal CARGA_MAXIMA = new BigDecimal("2000");
    private static final int DIAS_PARA_TRAS = 60;

    private final ExecucaoUpsert upsert;
    private final IndicesDeVersao indices;

    public SincronizacaoService(ExecucaoUpsert upsert, IndicesDeVersao indices) {
        this.upsert = upsert;
        this.indices = indices;
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
            boolean gravou = upsert.gravar(new ExecucaoUpsert.Linha(r.id(), consultoriaId, alunoId, r.planoVersaoId(),
                    r.sessaoUid(), r.exercicioUid(), r.serieUid(), serie.exercicioId(), serie.trabalho(), r.data(),
                    r.carga(), serie.unidade(), r.repeticoes(), Boolean.TRUE.equals(r.concluida()),
                    limpar(r.observacao()), r.alteradoNoAparelhoEm()));
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
        if (r.carga() != null && (r.carga().signum() < 0 || r.carga().compareTo(CARGA_MAXIMA) > 0
                || r.carga().stripTrailingZeros().scale() > 2)) {
            return "Carga precisa ficar entre 0 e 2000, com até 2 casas decimais.";
        }
        if (r.repeticoes() != null && (r.repeticoes() < 0 || r.repeticoes() > 500)) {
            return "Repetições precisam ficar entre 0 e 500.";
        }
        if (r.observacao() != null && r.observacao().length() > 500) {
            return "Observação com mais de 500 caracteres.";
        }
        ExecucaoUpsert.Chave existente = existentes.get(r.id());
        if (existente != null
                && !existente.equals(new ExecucaoUpsert.Chave(alunoId, r.planoVersaoId(), r.serieUid(), r.data()))) {
            return "Identificador já usado por outro registro.";
        }
        return null;
    }

    private static String limpar(String texto) {
        return texto == null || texto.isBlank() ? null : texto.trim();
    }
}
