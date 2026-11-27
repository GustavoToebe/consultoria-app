package br.com.treinos.api.auditoria;

/**
 * De onde veio o evento, pelo {@code user_agent} gravado (o cabeçalho {@code X-Treinos-Cliente} não é gravado). Navegador sempre
 * traz {@code Mozilla/}; o app nativo usa a pilha de rede do aparelho: {@code okhttp/x} (ou {@code Dalvik/}) no Android e
 * {@code <app>/<build> CFNetwork/x Darwin/x} no iOS. Nunca devolve o texto cru.
 * shortcut: heurística pelo user agent, vale enquanto o app não definir um próprio; trocar por coluna de origem gravada no evento.
 */
final class OrigemDoAcesso {
    private OrigemDoAcesso() { }

    static String de(String userAgent) {
        if(userAgent==null || userAgent.isBlank()) return null;
        if(userAgent.contains("Mozilla/")) return "Web";
        if(userAgent.startsWith("okhttp/") || userAgent.startsWith("Dalvik/")) return "App Android";
        if(userAgent.contains("CFNetwork") || userAgent.contains("Darwin/")) return "App iOS";
        return null;
    }
}
