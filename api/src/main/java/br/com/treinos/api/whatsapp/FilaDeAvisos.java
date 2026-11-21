package br.com.treinos.api.whatsapp;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.UUID;

/**
 * A porta de entrada dos avisos pelo WhatsApp para quem gera o fato (a agenda e o job dos lembretes de cobrança): só ids, nada de
 * texto, telefone ou nome. A linha nasce na MESMA transação do fato ({@code MANDATORY}) e só se o aluno autorizou, a consultoria
 * tem conexão e modelo do tipo e (no lembrete) o aluno não desligou os lembretes ({@link WhatsAppRepositorio#enfileirar}). Com a
 * chave desligada não faz nada. Quem decide se o fato existe (a cobrança está aberta, o compromisso mudou) é o chamador;
 * quem confere de novo logo antes de enviar é o {@link PreparoDoAviso}.
 */
@Service
public class FilaDeAvisos {

    /** Um aviso de compromisso: o aluno, o compromisso (a referência) e o tipo ({@code COMPROMISSO_*}). */
    public record AvisoDeCompromisso(UUID alunoId, UUID compromissoId, TipoDeAviso tipo) {
    }

    /** Um aviso de cobrança (o lembrete devido hoje): a consultoria, o aluno, a cobrança (a referência) e o tipo. */
    public record AvisoDeLembrete(UUID consultoriaId, UUID alunoId, UUID cobrancaId, TipoDeAviso tipo) {
    }

    private final WhatsAppRepositorio repositorio;
    private final WhatsAppProperties propriedades;

    FilaDeAvisos(WhatsAppRepositorio repositorio, WhatsAppProperties propriedades) {
        this.repositorio = repositorio;
        this.propriedades = propriedades;
    }

    /** A chave está ligada? (Quem planeja lembretes só trabalha se estiver.) */
    public boolean habilitado() {
        return propriedades.habilitado();
    }

    /** Compromisso marcado, remarcado ou cancelado: um aviso por aluno, na transação da agenda. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void enfileirarDeCompromissos(UUID consultoriaId, Collection<AvisoDeCompromisso> avisos) {
        if (!propriedades.habilitado()) {
            return;
        }
        for (AvisoDeCompromisso a : avisos) {
            if (a.tipo().ehLembrete()) {
                throw new IllegalArgumentException("Tipo de lembrete num aviso de compromisso.");
            }
            repositorio.enfileirar(consultoriaId, a.alunoId(), a.tipo(), a.compromissoId());
        }
    }

    /** Lembretes de cobrança devidos hoje, na transação do planejamento. Devolve quantos linhas nasceram. */
    @Transactional(propagation = Propagation.MANDATORY)
    public int enfileirarDeLembretes(Collection<AvisoDeLembrete> avisos) {
        if (!propriedades.habilitado()) {
            return 0;
        }
        int nasceram = 0;
        for (AvisoDeLembrete a : avisos) {
            if (!a.tipo().ehLembrete()) {
                throw new IllegalArgumentException("Tipo de compromisso num lembrete de cobrança.");
            }
            if (repositorio.enfileirar(a.consultoriaId(), a.alunoId(), a.tipo(), a.cobrancaId())) {
                nasceram++;
            }
        }
        return nasceram;
    }

    /**
     * O aluno saiu (anonimização, "Excluir minha conta") ou deixou de autorizar: o que ainda não saiu não sai mais. Vale com a
     * chave desligada também (é limpeza de dado, não envio).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void cancelarPendentesDoAluno(UUID consultoriaId, UUID alunoId, String motivo) {
        repositorio.cancelarPendentesDoAluno(consultoriaId, alunoId, motivo);
    }
}
