package br.com.treinos.api.conta;

import br.com.treinos.api.conta.MinhaContaDto.ClienteDto;
import br.com.treinos.api.conta.MinhaContaDto.ContratacaoDto;

/** Linha de {@code conta_comercial_local} já lida do JSON do contrato. */
public record ContaComercialLocal(ClienteDto cliente, ContratacaoDto contratacao) {
}
