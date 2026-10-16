package br.com.treinos.api.integracao;

import br.com.treinos.api.conta.ContaLocalRepositorio;
import br.com.treinos.api.conta.DireitosLocais;
import br.com.treinos.api.conta.RecursosDoApp;
import br.com.treinos.api.equipe.ConviteEquipeEmail;
import br.com.treinos.api.receitas.ReceitaService;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Emails;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Casos de uso de {@code /integracao/v1} que o controller chama (controller não fala com repositório). */
@Service
public class InstanciaService {

    private static final Logger LOG = LoggerFactory.getLogger(InstanciaService.class);

    public record Recurso(String codigo, String nome, String tipo, String unidade, boolean aplicado) { }

    private final ProvisionamentoService provisionamento;
    private final DireitosService direitos;
    private final IntegracaoRepositorio repositorio;
    private final ContaLocalRepositorio contas;
    private final AcessoPorDireitos acesso;
    private final ReceitaService receitas;
    private final ConviteEquipeEmail conviteEmail;

    private final br.com.treinos.api.conta.PlanoDaConsultoria plano;

    public InstanciaService(ProvisionamentoService provisionamento, DireitosService direitos,
                            IntegracaoRepositorio repositorio, ContaLocalRepositorio contas, AcessoPorDireitos acesso,
                            ReceitaService receitas, ConviteEquipeEmail conviteEmail,
                            br.com.treinos.api.conta.PlanoDaConsultoria plano) {
        this.plano = plano;
        this.conviteEmail = conviteEmail;
        this.provisionamento = provisionamento;
        this.direitos = direitos;
        this.repositorio = repositorio;
        this.contas = contas;
        this.acesso = acesso;
        this.receitas = receitas;
    }

    /**
     * Sem {@code @Transactional}: a transação é do {@link ProvisionamentoService}. Duas chamadas simultâneas com a mesma
     * chave esbarram na restrição única; a perdedora tem a transação desfeita e roda de novo, já encontrando a
     * operação gravada (replay, ou 409 se o corpo difere).
     */
    public ProvisionamentoService.Resultado provisionar(UUID chave, String hashCorpo, ProvisionarRequest r) {
        ProvisionamentoService.Resultado resultado;
        try {
            resultado = provisionamento.provisionar(chave, hashCorpo, r);
        } catch (DataIntegrityViolationException corrida) {
            resultado = provisionamento.provisionar(chave, hashCorpo, r);
        }
        resultado = comReceitasPadrao(resultado);
        enviarConviteDaConsultoriaNova(resultado, r.administrador().email());
        return resultado;
    }

    /**
     * O convite do administrador vai por e-mail depois do commit do provisionamento, só quando esta chamada criou a
     * consultoria ({@code consultoriaNova} nulo em repetição e adoção: a Central repete o pedido e ninguém recebe duas
     * vezes). E-mail desligado ou falha do provedor não desfazem nada: o {@link ConviteEquipeEmail} engole a falha e só
     * registra a classe do erro. O link continua na resposta para a Central.
     */
    private void enviarConviteDaConsultoriaNova(ProvisionamentoService.Resultado resultado, String email) {
        if (resultado.consultoriaNova() == null) {
            return;
        }
        String link = resultado.corpo().path("administrador").path("convite").path("link").asString();
        if (!link.isBlank()) {
            conviteEmail.enviar(Emails.normalizar(email), link);
        }
    }

    /**
     * A consultoria criada pela Central nasce com as mesmas receitas do cadastro (inclusive a metodologia que todo plano
     * recebe). Depois do commit do provisionamento, em transação própria dentro do tenant: o Hibernate lê o tenant ao
     * abrir a sessão, e a que gravou a consultoria abriu sem ele. Fora do {@code try} de {@link #provisionar}, para um
     * erro daqui não ser tomado por corrida. Falha não derruba a chamada: o convite só vai na primeira resposta, e o
     * primeiro acesso do administrador (aceite do convite) confere as receitas de novo.
     */
    private ProvisionamentoService.Resultado comReceitasPadrao(ProvisionamentoService.Resultado resultado) {
        if (resultado.consultoriaNova() == null) {
            return resultado;
        }
        try {
            TenantContext.executarComo(resultado.consultoriaNova(), () -> {
                receitas.garantirPadrao();
                return null;
            });
        } catch (RuntimeException e) {
            // Só o id da consultoria e o tipo do erro: nada de dado pessoal no log.
            LOG.error("Receitas padrão não criadas para a consultoria {} ({})", resultado.consultoriaNova(),
                    e.getClass().getSimpleName());
        }
        return resultado;
    }

    /** Novo link para o administrador; o e-mail sai depois do commit da reemissão (e o link volta para a Central). */
    public ProvisionamentoService.ConviteEmitido reemitirConvite(UUID consultoriaId) {
        var reemissao = provisionamento.reemitirConviteDoAdministrador(consultoriaId);
        conviteEmail.enviar(reemissao.email(), reemissao.convite().link());
        return reemissao.convite();
    }

    public DireitosService.Resultado aplicarDireitos(UUID consultoriaId, DireitosInstancia d) {
        return direitos.aplicar(consultoriaId, d);
    }

    /** Conciliação (contrato 5.2): só contagens, nada de dado pessoal. */
    @Transactional(readOnly = true)
    public Map<String, Object> consultar(UUID consultoriaId) {
        var consultoria = repositorio.consultoria(consultoriaId).orElseThrow(IntegracaoException::instanciaNaoEncontrada);
        DireitosLocais d = contas.direitos(consultoriaId).orElseThrow(IntegracaoException::instanciaNaoEncontrada);
        Map<String, Object> uso = new LinkedHashMap<>();
        uso.put(RecursosDoApp.LIMITE_ALUNOS_ATIVOS, repositorio.alunosAtivos(consultoriaId));
        uso.put(RecursosDoApp.LIMITE_MEMBROS_EQUIPE, repositorio.membrosDaEquipe(consultoriaId));
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("tenantId", consultoriaId);
        corpo.put("contratacaoId", d.contratacaoId());
        corpo.put("nome", consultoria.nome());
        corpo.put("slug", consultoria.slug());
        corpo.put("versaoDireitos", d.versao());
        corpo.put("confirmadoEm", d.confirmadoEm());
        corpo.put("acessoEfetivo", acesso.acessoEfetivo(consultoriaId));
        corpo.put("uso", uso);
        return corpo;
    }

    /** Catálogo (contrato 5.5). {@code aplicado} reflete a chave {@code TREINOS_PLANO_APLICAR}: desligada, o consumo só informa. */
    public List<Recurso> recursos() {
        boolean aplicado = plano.aplicando();
        return List.of(
                new Recurso(RecursosDoApp.LIMITE_ALUNOS_ATIVOS, "Alunos ativos", "LIMITE", "aluno", aplicado),
                new Recurso(RecursosDoApp.LIMITE_MEMBROS_EQUIPE, "Membros da equipe", "LIMITE", "pessoa", aplicado),
                new Recurso(RecursosDoApp.FUNCIONALIDADE_MOBILIDADE, "Mobilidade", "FUNCIONALIDADE", null, aplicado),
                new Recurso(RecursosDoApp.FUNCIONALIDADE_PDF, "PDF", "FUNCIONALIDADE", null, aplicado),
                new Recurso(RecursosDoApp.FUNCIONALIDADE_EQUIPE, "Equipe", "FUNCIONALIDADE", null, aplicado));
    }

    public Map<String, Object> saude(String produto) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("status", "UP");
        corpo.put("produto", produto);
        corpo.put("versaoContrato", 1);
        corpo.put("horario", Instant.now());
        return corpo;
    }
}
