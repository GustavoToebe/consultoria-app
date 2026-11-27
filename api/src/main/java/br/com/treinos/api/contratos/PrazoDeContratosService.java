package br.com.treinos.api.contratos;

import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

/**
 * Prazo para o aluno assinar o contrato (D6, S6): 1 a 60 dias ou nulo (não trava, só deixa pendente). É lido na hora de gerar e fixado
 * no contrato ({@code prazo_ate}): mudar o prazo nunca mexe nos contratos já gerados. A consultoria vem da sessão.
 */
@Service
public class PrazoDeContratosService {

    static final int MINIMO_DIAS = 1;
    static final int MAXIMO_DIAS = 60;

    /** Corpo do PUT e resposta do GET e do PUT; {@code null} = não travar o acesso. */
    public record PrazoDeContratos(Integer prazoDias) { }

    private final ConsultoriaRepository consultorias;
    private final Auditoria auditoria;

    public PrazoDeContratosService(ConsultoriaRepository consultorias, Auditoria auditoria) {
        this.consultorias = consultorias;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public PrazoDeContratos obter() {
        return resposta(consultorias.findById(TenantContext.get()).orElseThrow(PrazoDeContratosService::naoEncontrada));
    }

    /**
     * Grava por inteiro (ausente = nulo = não travar). Trava a linha da consultoria antes de ler, na mesma ordem do gerar contrato, de
     * modo que dois PUTs simultâneos se enfileiram; mesmo valor = 200 sem gravar nem auditar.
     */
    @Transactional
    public PrazoDeContratos alterar(PrazoDeContratos r) {
        Integer dias = r == null ? null : r.prazoDias();
        if (dias != null && (dias < MINIMO_DIAS || dias > MAXIMO_DIAS)) {
            throw new ValidacaoException("Confira o prazo para assinar.", "CONTRATO_PRAZO_INVALIDO", List.of(new ApiError.FieldError(
                    "prazoDias", "Informe de " + MINIMO_DIAS + " a " + MAXIMO_DIAS + " dias, ou deixe em branco para não travar o acesso.")));
        }
        Consultoria c = consultorias.travar(TenantContext.get()).orElseThrow(PrazoDeContratosService::naoEncontrada);
        Integer atual = c.getContratoPrazoDias() == null ? null : c.getContratoPrazoDias().intValue();
        if (!Objects.equals(atual, dias)) {
            c.definirContratoPrazoDias(dias == null ? null : dias.shortValue());
            consultorias.saveAndFlush(c);
            auditoria.registrarEvento("CONTRATO_PRAZO_CONFIGURADO", "CONSULTORIA", c.getId(), "Configurou o prazo para assinar contratos.");
        }
        return resposta(c);
    }

    private static PrazoDeContratos resposta(Consultoria c) {
        return new PrazoDeContratos(c.getContratoPrazoDias() == null ? null : c.getContratoPrazoDias().intValue());
    }

    private static NaoEncontradoException naoEncontrada() {
        return new NaoEncontradoException("Consultoria não encontrada.");
    }
}
