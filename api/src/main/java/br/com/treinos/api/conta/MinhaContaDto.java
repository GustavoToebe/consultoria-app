package br.com.treinos.api.conta;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Dados comerciais da consultoria, com os mesmos campos do {@code MinhaContaDto} da Central (contrato-integracao-v1,
 * seção 6.3). Documento, CEP e telefone já vêm formatados; a tela mostra como veio. Na integração a
 * {@code FonteDaContaCentral} devolve este mesmo tipo.
 */
public record MinhaContaDto(ClienteDto cliente, ContratacaoDto contratacao, List<CobrancaDto> cobrancas) {

    public record ClienteDto(String nome, String documento, EnderecoDto endereco, List<ContatoDto> contatos) {
    }

    public record EnderecoDto(String logradouro, String numero, String complemento, String bairro, String cidade,
                              String uf, String cep) {
    }

    public record ContatoDto(String nome, String email, String telefone, boolean principal) {
    }

    public record ContratacaoDto(String planoNome, Periodicidade periodicidade, BigDecimal valor, int diaVencimento,
                                 LocalDate inicio, LocalDate vigenteAte, SituacaoComercial situacaoComercial,
                                 String nomeInstancia, List<AdicionalDto> adicionais) {
    }

    public record AdicionalDto(String nome, BigDecimal quantidade) {
    }

    public record CobrancaDto(UUID id, LocalDate competenciaInicio, LocalDate competenciaFim, LocalDate vencimento,
                              BigDecimal valor, String situacao, boolean vencida, LocalDate pagoEm) {
    }
}
