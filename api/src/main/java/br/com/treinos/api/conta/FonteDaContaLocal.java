package br.com.treinos.api.conta;

import br.com.treinos.api.conta.MinhaContaDto.CobrancaDto;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/**
 * Lê {@code conta_comercial_local} e {@code cobranca_local}. {@code vencida} é calculada aqui, a cada leitura: cobrança
 * aberta com vencimento antes de hoje (fuso de Brasília), como a Central faz.
 */
@Component
public class FonteDaContaLocal implements FonteDaConta {

    private final ContaLocalRepositorio contas;

    public FonteDaContaLocal(ContaLocalRepositorio contas) {
        this.contas = contas;
    }

    @Override
    public Optional<MinhaContaDto> minhaConta(UUID consultoriaId) {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        return contas.contaComercial(consultoriaId).map(c -> new MinhaContaDto(c.cliente(), c.contratacao(),
                contas.cobrancas(consultoriaId).stream()
                        .map(b -> new CobrancaDto(b.id(), b.competenciaInicio(), b.competenciaFim(), b.vencimento(),
                                b.valor(), b.situacao(), b.vencida(hoje), b.pagoEm()))
                        .toList()));
    }

    @Override
    public boolean previa() {
        return true;
    }
}
