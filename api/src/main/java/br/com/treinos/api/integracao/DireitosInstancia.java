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
import java.util.Map;
import java.util.UUID;

/**
 * Snapshot de direitos do contrato (seção 4): sempre o estado completo, nunca uma diferença. Campos que o app não
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
        Instant geradoEm) {

    public record Plano(@NotBlank @Size(max = 60) String codigo, @NotBlank @Size(max = 120) String nome) { }

    /** Linha de {@code direitos_locais} desta consultoria; {@code confirmadoEm} é o instante em que a Central confirmou. */
    public DireitosLocais paraLocal(UUID consultoriaId, Instant confirmadoEm) {
        return new DireitosLocais(consultoriaId, contratacaoId, versao, situacao, acessoLiberado, motivoBloqueio,
                vigenteAte, plano.codigo(), plano.nome(), limites == null ? Map.of() : limites,
                funcionalidades == null ? List.of() : funcionalidades, confirmadoEm);
    }
}
