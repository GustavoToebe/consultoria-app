package br.com.treinos.api.integracao;

import br.com.treinos.api.conta.ContaLocalRepositorio;
import br.com.treinos.api.conta.DireitosLocais;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Regra de acesso do contrato: {@code liberado = acessoLiberado E (agora − confirmadoEm) ≤ tolerância}.
 * Consultoria sem linha em {@code direitos_locais} (não governada pela Central) fica liberada. Só vale quando
 * {@code treinos.integracao.bloqueio-ativo=true}; desligado, {@link #liberada} nem consulta o banco. A Central fora do ar
 * não derruba o app: o acesso só cai quando a tolerância (padrão 72 h) estoura.
 */
@Service
public class AcessoPorDireitos {

    public record Decisao(boolean liberado, String motivo) {
        static final Decisao LIBERADO = new Decisao(true, null);
    }

    private final ContaLocalRepositorio contas;
    private final IntegracaoProperties propriedades;

    public AcessoPorDireitos(ContaLocalRepositorio contas, IntegracaoProperties propriedades) {
        this.contas = contas;
        this.propriedades = propriedades;
    }

    /** Usada no login, na renovação e a cada requisição autenticada. */
    public boolean liberada(UUID consultoriaId) {
        return decidir(consultoriaId).liberado();
    }

    public Decisao decidir(UUID consultoriaId) {
        if (!propriedades.bloqueioAtivo()) {
            return Decisao.LIBERADO;
        }
        return avaliar(contas.direitos(consultoriaId).orElse(null), Instant.now(), propriedades.toleranciaHoras());
    }

    /** Estado efetivo segundo o contrato, mesmo com o bloqueio desligado (a Central consulta para conciliar). */
    public boolean acessoEfetivo(UUID consultoriaId) {
        return avaliar(contas.direitos(consultoriaId).orElse(null), Instant.now(), propriedades.toleranciaHoras()).liberado();
    }

    static Decisao avaliar(DireitosLocais direitos, Instant agora, int toleranciaHoras) {
        if (direitos == null) {
            return Decisao.LIBERADO;
        }
        if (!direitos.acessoLiberado()) {
            String motivo = direitos.motivoBloqueio();
            return new Decisao(false, motivo == null || motivo.isBlank()
                    ? "O acesso desta consultoria está suspenso. Fale com o suporte."
                    : "O acesso desta consultoria está suspenso: " + motivo);
        }
        if (Duration.between(direitos.confirmadoEm(), agora).compareTo(Duration.ofHours(toleranciaHoras)) > 0) {
            return new Decisao(false, "Não foi possível confirmar o plano desta consultoria. Fale com o suporte.");
        }
        return Decisao.LIBERADO;
    }
}
