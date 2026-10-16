package br.com.treinos.api.auth;

import org.springframework.stereotype.Service;

/**
 * Porteiro do Turnstile: cadastro de treinador, login e "esqueci a senha" chamam {@link #exigir} ANTES de qualquer outra
 * coisa (antes do módulo de autenticação, do BCrypt e do limite por conta). Desligada, não faz nada.
 *
 * <p>Falha fechada em todas as três rotas: se a Cloudflare não responde, a rota devolve 503 e nada é feito. No login isso
 * significa que ninguém novo entra enquanto a Cloudflare estiver fora; quem já tem sessão continua (o {@code /auth/refresh}
 * não passa por aqui). A saída de emergência é desligar {@code TREINOS_TURNSTILE_HABILITADO} e recriar a API.
 *
 * <p>Token ausente ou recusado é uma falha contada no limite por IP ({@link LimiteTentativas#verificacaoFalhou}); IP que já
 * gastou o limite leva 429 antes de a Cloudflare ser chamada. O cabeçalho {@code X-Treinos-Cliente: nativo} não dispensa
 * nada: o app nativo também resolve o desafio (num WebView). O IP é o do socket, que o túnel da Cloudflare já entrega real.
 */
@Service
public class VerificacaoHumana {

    private final TurnstileProperties propriedades;
    private final TurnstileCliente cliente;
    private final LimiteTentativas limite;

    VerificacaoHumana(TurnstileProperties propriedades, TurnstileCliente cliente, LimiteTentativas limite) {
        this.propriedades = propriedades;
        this.cliente = cliente;
        this.limite = limite;
    }

    public boolean habilitada() {
        return propriedades.habilitado();
    }

    public String siteKey() {
        return propriedades.siteKey();
    }

    public void exigir(String token, String ipDoCliente) {
        if (!propriedades.habilitado()) {
            return;
        }
        limite.verificacaoBloqueada(ipDoCliente);
        if (token == null || token.isBlank()) {
            limite.verificacaoFalhou(ipDoCliente);
            throw VerificacaoHumanaException.recusada();
        }
        if (cliente.verificar(token.trim(), ipDoCliente) != TurnstileCliente.Veredito.APROVADO) {
            limite.verificacaoFalhou(ipDoCliente);
            throw VerificacaoHumanaException.recusada();
        }
    }
}
