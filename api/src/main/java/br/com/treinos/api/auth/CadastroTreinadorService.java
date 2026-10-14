package br.com.treinos.api.auth;

import br.com.treinos.api.auth.dto.CadastroTreinadorRequest;
import br.com.treinos.api.receitas.ReceitaService;
import br.com.treinos.api.tenant.TenantContext;
import org.springframework.stereotype.Service;

/**
 * Cadastro público de treinador ("Sou treinador, criar conta"): consultoria com a configuração padrão (7.3), usuário
 * TREINADOR, receitas padrão (9.6) e a sessão.
 *
 * <p>Sem transação aqui, de propósito: o Hibernate lê a consultoria ao abrir a sessão, e as receitas ({@code @TenantId})
 * só podem ser gravadas numa transação aberta depois que a consultoria existe e está no {@link TenantContext}. Se as
 * receitas falharem, a conta continua válida e o treinador cria as dele.</p>
 */
@Service
public class CadastroTreinadorService {

    private final CriacaoDeConta criacaoDeConta;
    private final ReceitaService receitas;
    private final AuthService authService;

    public CadastroTreinadorService(CriacaoDeConta criacaoDeConta, ReceitaService receitas, AuthService authService) {
        this.criacaoDeConta = criacaoDeConta;
        this.receitas = receitas;
        this.authService = authService;
    }

    public AuthService.Sessao cadastrar(CadastroTreinadorRequest request) {
        Usuario usuario = criacaoDeConta.criarTreinador(request);
        TenantContext.executarComo(usuario.getConsultoriaId(), () -> {
            receitas.garantirPadrao();
            return null;
        });
        return authService.sessaoNova(usuario);
    }
}
