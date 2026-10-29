package br.com.treinos.api.inscricoes;

import br.com.treinos.api.inscricoes.Crm.MotivoEncerramento;
import br.com.treinos.api.inscricoes.Crm.TipoEvento;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Histórico e atividade da inscrição, sempre dentro da transação de quem age. Evento = quem, quando e o que mudou, com
 * resumo curto (nada de texto de mensagem). Atividade que não altera a inscrição (nota, retorno, mensagem preparada)
 * grava só a {@code ultima_atividade_em} por UPDATE na linha, sem subir a versão: trava a linha até o fim da transação,
 * e a retenção (que apaga pela mesma linha) espera e confere de novo.
 */
@Component
class HistoricoDaInscricao {

    private final InscricaoEventoRepository eventos;
    private final InscricaoRepository inscricoes;

    HistoricoDaInscricao(InscricaoEventoRepository eventos, InscricaoRepository inscricoes) {
        this.eventos = eventos;
        this.inscricoes = inscricoes;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    void registrar(Inscricao i, TipoEvento tipo, String de, String para, String detalhe, UUID autor) {
        eventos.save(new InscricaoEvento(i, tipo, de, para, null, detalhe, autor));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    void encerramento(Inscricao i, String de, MotivoEncerramento motivo, String detalhe, UUID autor) {
        eventos.save(new InscricaoEvento(i, TipoEvento.ENCERRADA, de, i.getSituacao().name(), motivo.name(), detalhe, autor));
    }

    /** Atividade sem alterar a inscrição; 404 se ela não existe nesta consultoria (ou a retenção acabou de apagar). */
    @Transactional(propagation = Propagation.MANDATORY)
    void atividade(UUID inscricaoId) {
        if (inscricoes.registrarAtividade(TenantContext.get(), inscricaoId, Instant.now()) == 0) {
            throw new NaoEncontradoException("Inscrição não encontrada.");
        }
    }
}
