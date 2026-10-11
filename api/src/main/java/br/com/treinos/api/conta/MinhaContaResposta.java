package br.com.treinos.api.conta;

import br.com.treinos.api.conta.MinhaContaDto.CobrancaDto;
import br.com.treinos.api.conta.MinhaContaDto.ClienteDto;
import br.com.treinos.api.conta.MinhaContaDto.ContratacaoDto;

import java.util.List;

/**
 * Resposta de {@code GET /minha-conta}: o {@link MinhaContaDto} mais {@code previa}, que é {@code true} enquanto os
 * dados vêm das tabelas locais de demonstração (a tela mostra o aviso "PRÉVIA"). Com a Central como fonte, vira {@code false}.
 */
public record MinhaContaResposta(ClienteDto cliente, ContratacaoDto contratacao, List<CobrancaDto> cobrancas,
                                 boolean previa) {

    public static MinhaContaResposta de(MinhaContaDto dto, boolean previa) {
        return new MinhaContaResposta(dto.cliente(), dto.contratacao(), dto.cobrancas(), previa);
    }
}
