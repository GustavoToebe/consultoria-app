package br.com.treinos.api.security;

import br.com.plataforma.comum.web.ForbiddenException;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.MotivoDoAcessoDesativado;
import br.com.treinos.api.contratos.TravaPorContrato;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.regex.Pattern;

/**
 * Duas travas do aluno, nesta ordem: contrato pendente vencido ({@link TravaPorContrato}, 403 {@code CONTRATO_PENDENTE}, D5) e
 * acesso pausado por atraso (403 {@code ACESSO_PAUSADO_POR_ATRASO}). Cada uma deixa passar só a sua lista fechada: as rotas
 * {@code /aluno/contratos*} passam nas duas (D21, senão o aluno não consegue assinar) e as rotas de envio da fila offline só na do
 * contrato (D19). As duas consultam o banco a cada chamada e, se a consulta falhar, o erro sobe como 5xx: nunca libera. Só passa
 * sem consulta quem não é aluno (treinador, rota pública): não há o que travar.
 *
 * <p>Pausa por atraso ({@code aluno.acesso_desativado_motivo = 'ATRASO'}, V104; Fase 2, decisão manual do treinador): o aluno
 * continua entrando e mantendo sessão, mas só acessa a lista fechada de rotas necessárias para consultar sua situação, aceitar
 * termos, gerenciar conta/push, assinar contrato e regularizar o pagamento. Qualquer outra rota devolve 403
 * {@code ACESSO_PAUSADO_POR_ATRASO}.
 */
@Component
public class AcessoPausadoInterceptor implements HandlerInterceptor {

    public static final String CODIGO = "ACESSO_PAUSADO_POR_ATRASO";
    public static final String CODIGO_CONTRATO = "CONTRATO_PENDENTE";
    private static final String MENSAGEM = "Seu acesso está pausado por atraso. Regularize o pagamento para continuar.";
    private static final String MENSAGEM_CONTRATO = "Você tem um contrato pendente de assinatura. Assine para continuar.";
    private static final String UUID_REGEX = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
    private static final Pattern LINK_OU_PIX = Pattern.compile("^/aluno/financeiro/cobrancas/" + UUID_REGEX + "/(link|pix)$");
    private static final Pattern CONTRATO_DO_ALUNO = Pattern.compile("^/aluno/contratos/" + UUID_REGEX + "(/arquivo)?$");
    private static final Pattern ASSINAR_CONTRATO = Pattern.compile("^/aluno/contratos/" + UUID_REGEX + "/assinar$");

    private final AlunoRepository alunos;
    private final TravaPorContrato trava;

    public AcessoPausadoInterceptor(AlunoRepository alunos, TravaPorContrato trava) {
        this.alunos = alunos;
        this.trava = trava;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        // Fail-open só nestes dois retornos, onde não há aluno a travar: sem sessão (rota pública; fora delas o Spring Security já
        // recusou antes de chegar aqui) e quem não é aluno (ou sessão de aluno sem cadastro, que toda rota do aluno já recusa).
        if (auth == null || !(auth.getPrincipal() instanceof UsuarioAutenticado eu)) {
            return true;
        }
        if (!"ALUNO".equals(eu.papel()) || eu.alunoId() == null) {
            return true;
        }
        String metodo = request.getMethod();
        String caminho = caminho(request);
        if (permitido(metodo, caminho)) {
            return true; // a lista do ATRASO está inteira dentro da lista do contrato
        }
        // A trava do contrato vem antes da do ATRASO; com a chave desligada ela nem consulta o banco.
        if (!permitidoComContratoVencido(metodo, caminho) && trava.contratoPendenteVencido(eu.consultoriaId(), eu.alunoId())) {
            throw new ForbiddenException(MENSAGEM_CONTRATO, CODIGO_CONTRATO);
        }
        // O MANUAL não chega aqui: o usuário fica inativo e as sessões caem (o filtro JWT recusa antes).
        if (alunos.existsByIdAndAcessoDesativadoMotivo(eu.alunoId(), MotivoDoAcessoDesativado.ATRASO)) {
            throw new ForbiddenException(MENSAGEM, CODIGO);
        }
        return true;
    }

    private static String caminho(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String contexto = request.getContextPath();
        if (contexto != null && !contexto.isEmpty() && uri.startsWith(contexto)) {
            return uri.substring(contexto.length());
        }
        return uri;
    }

    /** Lista fechada do ATRASO: situação, termos, conta e pagamento, mais as quatro rotas {@code /aluno/contratos*} (D21). */
    static boolean permitido(String metodo, String caminho) {
        return doAtraso(metodo, caminho) || rotaDoContrato(metodo, caminho);
    }

    /** Lista fechada do contrato vencido: a do ATRASO mais as quatro rotas de envio da fila offline, só POST (D19). */
    static boolean permitidoComContratoVencido(String metodo, String caminho) {
        return permitido(metodo, caminho) || ("POST".equals(metodo) && ("/aluno/execucoes/lote".equals(caminho)
                || "/aluno/mobilidade/registros".equals(caminho)
                || "/aluno/agua".equals(caminho)
                || "/aluno/sessoes-concluidas".equals(caminho)));
    }

    private static boolean rotaDoContrato(String metodo, String caminho) {
        if ("GET".equals(metodo)) {
            return "/aluno/contratos".equals(caminho) || CONTRATO_DO_ALUNO.matcher(caminho).matches();
        }
        return "POST".equals(metodo) && ASSINAR_CONTRATO.matcher(caminho).matches();
    }

    private static boolean doAtraso(String metodo, String caminho) {
        if ("GET".equals(metodo)) {
            return "/eu".equals(caminho)
                    || "/termos".equals(caminho)
                    || "/aluno/financeiro".equals(caminho)
                    || "/eu/contratacao".equals(caminho)
                    || "/aluno/contratacao".equals(caminho)
                    || "/aluno/meus-dados".equals(caminho);
        }
        if ("PUT".equals(metodo)) {
            return "/eu/senha".equals(caminho);
        }
        if ("DELETE".equals(metodo)) {
            return "/aluno/push-token".equals(caminho);
        }
        if ("POST".equals(metodo)) {
            return "/termos/aceite".equals(caminho)
                    || "/aluno/conta/excluir".equals(caminho)
                    || "/aluno/financeiro/retorno-pagamento".equals(caminho)
                    || LINK_OU_PIX.matcher(caminho).matches();
        }
        return false;
    }
}
