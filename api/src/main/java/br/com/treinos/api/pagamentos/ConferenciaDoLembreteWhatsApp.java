package br.com.treinos.api.pagamentos;

import br.com.treinos.api.whatsapp.ConferenciaDoAviso;
import br.com.treinos.api.whatsapp.TipoDeAviso;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * A porta do WhatsApp para os pagamentos ({@link ConferenciaDoAviso}): logo antes do envio, o lembrete pelo WhatsApp passa pelas
 * mesmas conferências do e-mail ({@link PreparoDoLembrete}): financeiro ligado, cobrança ainda ABERTA e de mensalidade, a regra
 * ainda diz que este tipo é devido hoje e a contratação está ATIVA. Só o que o aviso diz (valor e vencimento) sai daqui; nome, aluno,
 * telefone e texto são do módulo do WhatsApp. Roda dentro da consultoria do aviso. Pagamento atrasado nunca bloqueia nada do aluno:
 * aqui só se decide se o lembrete ainda faz sentido.
 */
@Service
class ConferenciaDoLembreteWhatsApp implements ConferenciaDoAviso {

    static final String FINANCEIRO_DESLIGADO = "FINANCEIRO_DESLIGADO";

    private static final DateTimeFormatter DIA_MES = DateTimeFormatter.ofPattern("dd/MM", Locale.ROOT);

    private final CobrancaAlunoRepository cobrancas;
    private final ContratacaoAlunoRepository contratacoes;
    private final ConfiguracaoDeLembretesRepository configuracoes;
    private final PagamentosProperties pagamentos;

    ConferenciaDoLembreteWhatsApp(CobrancaAlunoRepository cobrancas, ContratacaoAlunoRepository contratacoes,
                                  ConfiguracaoDeLembretesRepository configuracoes, PagamentosProperties pagamentos) {
        this.cobrancas = cobrancas;
        this.contratacoes = contratacoes;
        this.configuracoes = configuracoes;
        this.pagamentos = pagamentos;
    }

    @Override
    @Transactional(readOnly = true)
    public Conferido conferirLembrete(UUID cobrancaId, TipoDeAviso tipo, LocalDate hoje) {
        if (!pagamentos.habilitado()) {
            return Conferido.cancelar(FINANCEIRO_DESLIGADO);
        }
        Optional<CobrancaAluno> achada = cobrancas.findById(cobrancaId);
        if (achada.isEmpty() || achada.get().getSituacao() != CobrancaAluno.Situacao.ABERTA) {
            return Conferido.cancelar(PreparoDoLembrete.COBRANCA_NAO_ABERTA);
        }
        CobrancaAluno cobranca = achada.get();
        if (cobranca.getTipo() != CobrancaAluno.Tipo.MENSALIDADE) {
            return Conferido.cancelar(PreparoDoLembrete.NAO_E_MENSALIDADE);
        }
        RegraDosLembretes.Configuracao configuracao = configuracoes.daConsultoria()
                .map(ConfiguracaoDeLembretes::configuracao).orElse(RegraDosLembretes.Configuracao.PADRAO);
        if (!tipo.ehLembrete() || RegraDosLembretes.devido(hoje, cobranca.getVencimento(), configuracao)
                .filter(devido -> devido.name().equals(tipo.name())).isEmpty()) {
            return Conferido.cancelar(PreparoDoLembrete.NAO_E_MAIS_DEVIDO);
        }
        boolean ativa = contratacoes.findById(cobranca.getContratacaoId())
                .map(c -> c.getSituacao() == ContratacaoAluno.Situacao.ATIVA).orElse(false);
        if (!ativa) {
            return Conferido.cancelar(PreparoDoLembrete.CONTRATACAO_NAO_ATIVA);
        }
        return Conferido.enviar(TextoDoLembrete.valor(cobranca.getValorCentavos()), DIA_MES.format(cobranca.getVencimento()));
    }
}
