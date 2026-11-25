package br.com.treinos.api.pagamentos;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

/** Com o financeiro desligado não há como encerrar o contrato, então o contrato fechado não pode travar a inativação. */
class PagamentosDoAlunoContratoFechadoTest {

    @Test
    void financeiroDesligadoNaoBloqueiaNemLeAContratacao() {
        ContratacaoAlunoRepository contratacoes = mock(ContratacaoAlunoRepository.class);
        var pagamentos = new PagamentosDoAluno(contratacoes, null, null, null, null, null,
                new PagamentosProperties(false, null, null, false, false), null, null, null);

        assertThat(pagamentos.temContratoFechadoVigente(UUID.randomUUID())).isFalse();
        verifyNoInteractions(contratacoes);
    }
}
