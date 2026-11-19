package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ConflictException;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * A mensalidade cobrada pela Kiwify (D18): MENSALIDADE de contratação cujo plano tem {@code kiwifyAssinatura}, valendo SÓ com a
 * chave {@code TREINOS_PAGAMENTOS_KIWIFY_HABILITADO} ligada E a credencial da consultoria configurada (no molde do
 * {@code pagamentoOnline}: "configurado e ligado"). Sem uma das duas, a mensalidade volta a ser comum, com as formas de
 * pagamento e os lembretes de sempre. Calculado na leitura, nunca gravado. A cobrança automática continua gerada todo mês
 * (D1), e baixa manual, desfazer a manual e cancelar valem como em qualquer cobrança; só link, Pix, forma de pagamento do
 * aluno e lembrete por e-mail saem. Roda dentro da consultoria da requisição ({@code @TenantId}).
 */
@Component
class CobrancaAutomatica {

    /** O texto do campo {@code cobrancaAutomatica} das respostas. */
    static final String KIWIFY = "KIWIFY";

    private final KiwifyProperties kiwify;
    private final CredencialKiwifyRepository credenciais;
    private final PlanoComercialRepository planos;

    CobrancaAutomatica(KiwifyProperties kiwify, CredencialKiwifyRepository credenciais, PlanoComercialRepository planos) {
        this.kiwify = kiwify;
        this.credenciais = credenciais;
        this.planos = planos;
    }

    /** Chave ligada e credencial da consultoria configurada. */
    boolean ativa() {
        return kiwify.habilitado() && credenciais.configurada();
    }

    /**
     * As contratações destas cobranças que são de plano com assinatura pela Kiwify, ou vazio se a Kiwify não está ativa. Uma
     * consulta só para a página inteira; a mensalidade automática é a MENSALIDADE cuja contratação está no conjunto devolvido
     * ({@link #eh}).
     */
    Set<UUID> contratacoesAutomaticas(Collection<CobrancaAluno> cobrancas) {
        Set<UUID> ids = new HashSet<>();
        for (CobrancaAluno c : cobrancas) {
            if (c.getTipo() == CobrancaAluno.Tipo.MENSALIDADE && c.getContratacaoId() != null) {
                ids.add(c.getContratacaoId());
            }
        }
        if (ids.isEmpty() || !ativa()) {
            return Set.of();
        }
        return Set.copyOf(planos.contratacoesComAssinaturaDaKiwify(ids));
    }

    static boolean eh(CobrancaAluno c, Set<UUID> automaticas) {
        return c.getTipo() == CobrancaAluno.Tipo.MENSALIDADE && c.getContratacaoId() != null
                && automaticas.contains(c.getContratacaoId());
    }

    /** Esta cobrança, sozinha. */
    boolean eh(CobrancaAluno c) {
        return eh(c, contratacoesAutomaticas(List.of(c)));
    }

    /** 409 {@code COBRANCA_AUTOMATICA}: link, Pix e link em lote não existem para a mensalidade que a Kiwify cobra. */
    void exigirComum(CobrancaAluno c) {
        if (eh(c)) {
            throw new ConflictException("Esta mensalidade é cobrada pela Kiwify: não tem link nem Pix.", "COBRANCA_AUTOMATICA");
        }
    }
}
