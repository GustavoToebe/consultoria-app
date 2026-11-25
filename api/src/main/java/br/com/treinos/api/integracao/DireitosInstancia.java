package br.com.treinos.api.integracao;

import br.com.treinos.api.conta.DireitosLocais;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Snapshot de direitos do contrato: sempre o estado completo, nunca uma diferença. Campos que o app não
 * conhece são ignorados (mudanças da v1 são só aditivas).
 */
public record DireitosInstancia(
        @NotNull UUID contratacaoId,
        UUID clienteId,
        @NotBlank @Size(max = 40) String produto,
        UUID tenantId,
        @NotNull @Min(0) Long versao,
        @NotNull @Pattern(regexp = "TRIAL|ATIVA|INADIMPLENTE|BLOQUEADA|CANCELADA") String situacao,
        @NotNull Boolean acessoLiberado,
        @Size(max = 300) String motivoBloqueio,
        LocalDate vigenteAte,
        @NotNull @Valid Plano plano,
        Map<String, Long> limites,
        List<String> funcionalidades,
        Instant geradoEm,
        PoliticaSplitDto politicaSplit) {

    private static final Set<String> MODOS_SPLIT_VALIDOS = Set.of(
            "ISENTO", "TAXA_PLATAFORMA", "TAXA_PERCENTUAL", "ABATER_MENSALIDADE");

    public DireitosInstancia(UUID contratacaoId, UUID clienteId, String produto, UUID tenantId, Long versao,
                             String situacao, Boolean acessoLiberado, String motivoBloqueio, LocalDate vigenteAte,
                             Plano plano, Map<String, Long> limites, List<String> funcionalidades, Instant geradoEm) {
        this(contratacaoId, clienteId, produto, tenantId, versao, situacao, acessoLiberado, motivoBloqueio,
                vigenteAte, plano, limites, funcionalidades, geradoEm, null);
    }

    public record Plano(@NotBlank @Size(max = 60) String codigo, @NotBlank @Size(max = 120) String nome) { }

    public record PoliticaSplitDto(
            String modo,
            Integer percentualBps,
            Long metaMensalCentavos,
            Long abatidoMesCentavos,
            Long restanteAbaterCentavos,
            UUID cobrancaCentralId) { }

    /** Linha de {@code direitos_locais} desta consultoria; {@code confirmadoEm} é o instante em que a Central confirmou. */
    public DireitosLocais paraLocal(UUID consultoriaId, Instant confirmadoEm) {
        String splitModo = "ISENTO";
        int splitPercentualBps = 0;
        long saldoAbaterCentavos = 0L;
        long metaMensalCentavos = 0L;
        UUID cobrancaCentralId = null;

        if (politicaSplit != null) {
            splitModo = normalizarModoSplit(politicaSplit.modo());
            splitPercentualBps = politicaSplit.percentualBps() == null ? 0 : Math.max(0, politicaSplit.percentualBps());
            metaMensalCentavos = politicaSplit.metaMensalCentavos() == null ? 0L : Math.max(0L, politicaSplit.metaMensalCentavos());
            if (politicaSplit.restanteAbaterCentavos() != null) {
                saldoAbaterCentavos = Math.max(0L, politicaSplit.restanteAbaterCentavos());
            } else if (politicaSplit.metaMensalCentavos() != null && politicaSplit.abatidoMesCentavos() != null) {
                saldoAbaterCentavos = Math.max(0L, politicaSplit.metaMensalCentavos() - politicaSplit.abatidoMesCentavos());
            }
            cobrancaCentralId = politicaSplit.cobrancaCentralId();
        }

        return new DireitosLocais(consultoriaId, contratacaoId, versao, situacao, acessoLiberado, motivoBloqueio,
                vigenteAte, plano.codigo(), plano.nome(), limites == null ? Map.of() : limites,
                funcionalidades == null ? List.of() : funcionalidades, confirmadoEm,
                splitModo, splitPercentualBps, saldoAbaterCentavos, metaMensalCentavos, cobrancaCentralId);
    }

    private static String normalizarModoSplit(String modo) {
        if (modo == null || modo.isBlank()) {
            return "ISENTO";
        }
        String normalizado = modo.trim().toUpperCase(Locale.ROOT);
        return MODOS_SPLIT_VALIDOS.contains(normalizado) ? normalizado : "ISENTO";
    }
}
