package br.com.treinos.api.contratos;

import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.contratos.ContratoDtos.AssinarContratoPublicoRequest;
import br.com.treinos.api.contratos.ContratoDtos.ContratoPublicoAberto;
import br.com.treinos.api.contratos.ContratoDtos.ContratoPublicoAssinado;
import br.com.treinos.api.contratos.ContratoDtos.ContratoPublicoConsulta;
import br.com.treinos.api.security.OpaqueTokenGenerator;
import br.com.treinos.api.tenant.TenantContext;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Pattern;

/**
 * Página pública do contrato do responsável. Sem transação aqui: descobre a consultoria pelo hash do código
 * ({@link ContratoPublicoBusca}) e roda cada ação com ela no {@link TenantContext}, a transação abrindo dentro do bloco
 * ({@link ContratoPublicoAcoes}). Os erros de CPF são contados aqui, fora da transação, para a contagem sobreviver ao 422; quem já
 * gastou os erros do IP ou do código leva 429 antes de qualquer conferência. Código fora do formato, inexistente, vencido, usado ou de
 * contrato cancelado: o mesmo 404.
 */
@Service
public class ContratoPublicoService {

    /** 18 bytes aleatórios em base64 url-safe sem preenchimento (144 bits): 24 caracteres. */
    private static final Pattern FORMATO_DO_CODIGO = Pattern.compile("[A-Za-z0-9_-]{24}");

    private final ContratoPublicoBusca busca;
    private final ContratoPublicoAcoes acoes;
    private final LimiteTentativas limite;

    public ContratoPublicoService(ContratoPublicoBusca busca, ContratoPublicoAcoes acoes, LimiteTentativas limite) {
        this.busca = busca;
        this.acoes = acoes;
        this.limite = limite;
    }

    /** O hash do código e a consultoria dele; o código nunca passa daqui. */
    private record Alvo(String hash, UUID consultoriaId) {
        @Override
        public String toString() {
            return "Alvo[...]";
        }
    }

    public ContratoPublicoConsulta consultar(String codigo) {
        Alvo alvo = alvo(codigo);
        return TenantContext.executarComo(alvo.consultoriaId(), () -> acoes.consultar(alvo.hash()));
    }

    public ContratoPublicoAberto abrir(String codigo, String cpf, String ip) {
        Alvo alvo = alvo(codigo);
        return conferindoCpf(alvo, ip, () -> acoes.abrir(alvo.hash(), cpf));
    }

    public byte[] arquivo(String codigo, String cpf, String ip) {
        Alvo alvo = alvo(codigo);
        return conferindoCpf(alvo, ip, () -> acoes.arquivo(alvo.hash(), cpf));
    }

    public ContratoPublicoAssinado assinar(String codigo, AssinarContratoPublicoRequest r, String ip, String agente) {
        Alvo alvo = alvo(codigo);
        return conferindoCpf(alvo, ip, () -> acoes.assinar(alvo.hash(), r, ip, agente));
    }

    private <T> T conferindoCpf(Alvo alvo, String ip, Supplier<T> acao) {
        limite.contratoCpfBloqueado(ip, alvo.hash());
        try {
            return TenantContext.executarComo(alvo.consultoriaId(), acao);
        } catch (ContratoPublicoAcoes.CpfNaoConfere e) {
            limite.contratoCpfErrou(ip, alvo.hash());
            throw e;
        }
    }

    private Alvo alvo(String codigo) {
        if (codigo == null || !FORMATO_DO_CODIGO.matcher(codigo).matches()) {
            throw ContratoPublicoAcoes.linkInvalido();
        }
        String hash = OpaqueTokenGenerator.hash(codigo);
        UUID consultoriaId = busca.consultoriaDoLink(hash).orElseThrow(ContratoPublicoAcoes::linkInvalido);
        return new Alvo(hash, consultoriaId);
    }
}
